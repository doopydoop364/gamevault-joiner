use reqwest::{redirect, Client, Url};
use semver::Version;
use serde::{Deserialize, Serialize};
use std::time::Duration;

const REPO: &str = "/Phalcode/gamevault-frontend/releases/download/";
const LATEST: &str = "https://api.github.com/repos/Phalcode/gamevault-frontend/releases/latest";
pub const LIMIT: u64 = 1_500_000_000;

#[derive(Deserialize)]
pub struct Release {
    tag_name: String,
    draft: bool,
    prerelease: bool,
    assets: Vec<Asset>,
}

#[derive(Deserialize)]
struct Asset {
    name: String,
    size: u64,
    digest: Option<String>,
    browser_download_url: String,
}

#[derive(Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum Flavor {
    Nsis,
    Appimage,
    Deb,
    Dmg,
}

#[derive(Clone, Serialize)]
pub struct Package {
    pub version: String,
    pub name: String,
    pub size: u64,
    pub flavor: Flavor,
    #[serde(skip)]
    pub url: Url,
    #[serde(skip)]
    pub digest: String,
}

pub fn select(release: Release, flavor: Flavor) -> Result<Package, String> {
    let tag = &release.tag_name;
    let version = Version::parse(tag.strip_prefix('v').unwrap_or(tag))
        .map_err(|_| "The latest official release has an unfamiliar version.")?;
    if release.draft || release.prerelease || !version.pre.is_empty() || !version.build.is_empty() {
        return Err("The latest official release is not a stable-channel build.".into());
    }
    let name = match flavor {
        Flavor::Nsis => format!("GameVault-windows-x64-{version}-setup.exe"),
        Flavor::Appimage => format!("GameVault-linux-x64-{version}.AppImage"),
        Flavor::Deb => format!("GameVault-linux-x64-{version}.deb"),
        Flavor::Dmg => format!("GameVault-macos-arm64-{version}.dmg"),
    };
    let mut matches = release
        .assets
        .into_iter()
        .filter(|asset| asset.name == name);
    let asset = matches
        .next()
        .ok_or("The official release has no matching installer.")?;
    if matches.next().is_some() || !(1..=LIMIT).contains(&asset.size) {
        return Err("The official installer metadata is ambiguous or has an invalid size.".into());
    }
    let url = Url::parse(&asset.browser_download_url).map_err(|_| "Invalid installer URL.")?;
    if !clean_https(&url)
        || url.host_str() != Some("github.com")
        || url.path() != format!("{REPO}{tag}/{name}")
        || url.query().is_some()
    {
        return Err("The installer URL is outside the official release source.".into());
    }
    let digest = asset.digest.as_deref().and_then(|value| value.strip_prefix("sha256:"))
        .filter(|value| value.len() == 64 && value.bytes().all(|c| c.is_ascii_hexdigit()))
        .ok_or("GitHub did not provide a usable SHA-256 digest. Retry later or visit GameVault's official website.")?;
    Ok(Package {
        version: version.to_string(),
        name,
        size: asset.size,
        flavor,
        url,
        digest: digest.to_ascii_lowercase(),
    })
}

fn clean_https(url: &Url) -> bool {
    url.scheme() == "https"
        && url.port().is_none()
        && url.username().is_empty()
        && url.password().is_none()
        && url.fragment().is_none()
}

pub fn client() -> Result<Client, String> {
    Client::builder()
        .https_only(true)
        .user_agent(concat!("GameVault-Joiner/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(Duration::from_secs(12))
        .read_timeout(Duration::from_secs(20))
        .timeout(Duration::from_secs(1800))
        .redirect(redirect::Policy::custom(|attempt| {
            let url = attempt.url();
            // Metadata never follows redirects. Only GitHub's release CDN can receive asset redirects.
            let from_release = attempt.previous().first().is_some_and(|first| {
                first.host_str() == Some("github.com") && first.path().starts_with(REPO)
            });
            if from_release
                && clean_https(url)
                && attempt.previous().len() <= 3
                && matches!(
                    url.host_str(),
                    Some("release-assets.githubusercontent.com" | "objects.githubusercontent.com")
                )
            {
                attempt.follow()
            } else {
                attempt.error("Untrusted release redirect")
            }
        }))
        .build()
        .map_err(|_| "Could not initialize secure networking.".into())
}

pub async fn latest(flavor: Flavor) -> Result<Package, String> {
    let mut response = client()?
        .get(LATEST)
        .header("Accept", "application/vnd.github+json")
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|_| "Could not reach GitHub Releases. Check your connection and retry.")?;
    if !response.status().is_success() {
        return Err(format!(
            "GitHub Releases returned HTTP {}. Retry later.",
            response.status().as_u16()
        ));
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "GitHub release metadata was interrupted.")?
    {
        if bytes.len() + chunk.len() > 2_000_000 {
            return Err("GitHub release metadata exceeded the size limit.".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    let release =
        serde_json::from_slice(&bytes).map_err(|_| "GitHub returned invalid release metadata.")?;
    select(release, flavor)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn fixture(name: &str) -> serde_json::Value {
        json!({
            "tag_name": "17.2.0", "draft": false, "prerelease": false,
            "assets": [{ "name": name, "size": 100, "digest": format!("sha256:{}", "a".repeat(64)),
                "browser_download_url": format!("https://github.com{REPO}17.2.0/{name}") }]
        })
    }

    #[test]
    fn selects_only_platform_specific_versioned_assets() {
        for (flavor, name) in [
            (Flavor::Nsis, "GameVault-windows-x64-17.2.0-setup.exe"),
            (Flavor::Appimage, "GameVault-linux-x64-17.2.0.AppImage"),
            (Flavor::Deb, "GameVault-linux-x64-17.2.0.deb"),
            (Flavor::Dmg, "GameVault-macos-arm64-17.2.0.dmg"),
        ] {
            let release = serde_json::from_value(fixture(name)).unwrap();
            assert_eq!(select(release, flavor).unwrap().name, name);
        }
        let alias = serde_json::from_value(fixture("GameVault-linux-x64-latest.AppImage")).unwrap();
        assert!(select(alias, Flavor::Appimage).is_err());
    }

    #[test]
    fn rejects_preview_untrusted_url_and_bad_digest() {
        for (field, value) in [
            (
                "browser_download_url",
                json!("https://github.com.evil.example/payload.AppImage"),
            ),
            ("digest", json!("sha256:nonhex")),
            ("digest", serde_json::Value::Null),
            ("size", json!(0)),
        ] {
            let mut data = fixture("GameVault-linux-x64-17.2.0.AppImage");
            data["assets"][0][field] = value;
            assert!(select(serde_json::from_value(data).unwrap(), Flavor::Appimage).is_err());
        }
        let mut data = fixture("GameVault-linux-x64-17.2.0.AppImage");
        data["prerelease"] = json!(true);
        assert!(select(serde_json::from_value(data).unwrap(), Flavor::Appimage).is_err());
    }
}
