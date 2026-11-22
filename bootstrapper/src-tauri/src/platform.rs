use crate::releases::Flavor;
use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
pub struct Platform {
    os: &'static str,
    arch: &'static str,
    distro: Option<String>,
    formats: Vec<Flavor>,
    existing: Vec<String>,
    pub version: Option<String>,
}

fn formats(os: &str, arch: &str) -> Vec<Flavor> {
    match (os, arch) {
        ("windows", "x86_64") => vec![Flavor::Nsis],
        ("linux", "x86_64") => vec![Flavor::Appimage, Flavor::Deb],
        ("macos", "aarch64") => vec![Flavor::Dmg],
        _ => vec![],
    }
}

pub fn supports(flavor: Flavor) -> bool {
    formats(std::env::consts::OS, native_arch()).contains(&flavor)
}

fn native_arch() -> &'static str {
    #[cfg(windows)]
    {
        use windows_sys::Win32::System::Threading::{GetCurrentProcess, IsWow64Process2};
        let mut process = 0;
        let mut native = 0;
        let ok = unsafe { IsWow64Process2(GetCurrentProcess(), &mut process, &mut native) };
        return match (ok, native) {
            (0, _) => "unknown",
            (_, 0x8664) if std::env::consts::ARCH == "x86_64" => "x86_64",
            (_, 0xaa64) => "aarch64",
            _ => "unsupported",
        };
    }
    #[cfg(not(windows))]
    std::env::consts::ARCH
}

fn known_client_paths(home: &Path) -> Vec<PathBuf> {
    match std::env::consts::OS {
        "windows" => ["ProgramFiles", "LOCALAPPDATA"]
            .into_iter()
            .filter_map(std::env::var_os)
            .flat_map(|path| {
                let base = PathBuf::from(path);
                [
                    base.join("GameVault/GameVault.exe"),
                    base.join("Programs/GameVault/GameVault.exe"),
                ]
            })
            .collect(),
        "linux" => vec![
            PathBuf::from("/usr/bin/gamevault"),
            PathBuf::from("/usr/local/bin/gamevault"),
        ],
        "macos" => vec![
            PathBuf::from("/Applications/GameVault.app"),
            home.join("Applications/GameVault.app"),
        ],
        _ => vec![],
    }
}

fn version_from_command(path: &Path) -> Option<String> {
    let output = match std::env::consts::OS {
        "linux" if path == Path::new("/usr/bin/gamevault") => Command::new("/usr/bin/dpkg-query")
            .args(["-W", "-f=${Status}\n${Version}\n", "gamevault"])
            .output()
            .ok()?,
        "macos" => Command::new("/usr/bin/plutil")
            .args(["-extract", "CFBundleShortVersionString", "raw", "-o", "-"])
            .arg(path.join("Contents/Info.plist"))
            .output()
            .ok()?,
        _ => return None,
    };
    if !output.status.success() {
        return None;
    }
    let value = String::from_utf8(output.stdout).ok()?;
    let version = if std::env::consts::OS == "linux" {
        value.strip_prefix("install ok installed\n")?.trim()
    } else {
        value.trim()
    };
    semver::Version::parse(version).ok().map(|v| v.to_string())
}

#[cfg(windows)]
fn windows_installed_version() -> Option<String> {
    use windows_sys::Win32::System::Registry::{
        RegGetValueW, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, RRF_RT_REG_SZ,
    };
    let key: Vec<u16> = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\GameVault"
        .encode_utf16()
        .chain(Some(0))
        .collect();
    let name: Vec<u16> = "DisplayVersion".encode_utf16().chain(Some(0)).collect();
    [HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER]
        .into_iter()
        .filter_map(|root| {
            let mut data = [0u16; 128];
            let mut bytes = (data.len() * 2) as u32;
            let status = unsafe {
                RegGetValueW(
                    root,
                    key.as_ptr(),
                    name.as_ptr(),
                    RRF_RT_REG_SZ,
                    std::ptr::null_mut(),
                    data.as_mut_ptr().cast(),
                    &mut bytes,
                )
            };
            if status != 0 || bytes < 2 || bytes as usize > data.len() * 2 {
                return None;
            }
            let version = String::from_utf16(&data[..(bytes as usize / 2) - 1]).ok()?;
            semver::Version::parse(&version).ok()
        })
        .max()
        .map(|version| version.to_string())
}

pub fn ensure_no_downgrade(installed: Option<&str>, incoming: &str) -> Result<(), String> {
    let newer = installed
        .and_then(|value| semver::Version::parse(value).ok())
        .zip(semver::Version::parse(incoming).ok())
        .is_some_and(|(installed, incoming)| installed > incoming);
    if newer {
        return Err("The detected GameVault version is newer. Keep the installed version or use GameVault’s updater.".into());
    }
    Ok(())
}

pub fn inspect(app: &AppHandle, home: &Path) -> Platform {
    let os = std::env::consts::OS;
    let arch = native_arch();
    let distro = if os == "linux" {
        fs::read_to_string("/etc/os-release").ok().and_then(|text| {
            text.lines()
                .find_map(|line| line.strip_prefix("PRETTY_NAME="))
                .map(|value| value.trim_matches('"').to_owned())
        })
    } else {
        None
    };
    let mut paths: Vec<_> = known_client_paths(home)
        .into_iter()
        .filter(|path| path.exists())
        .collect();
    let mut version = paths
        .iter()
        .filter_map(|path| version_from_command(path))
        .max_by_key(|value| semver::Version::parse(value).ok());
    if os == "linux" {
        if let Ok(base) = app.path().app_local_data_dir() {
            if let Ok(entries) = fs::read_dir(base.join("client")) {
                for entry in entries.flatten() {
                    let name = entry.file_name();
                    let Some(found) = name.to_str().and_then(appimage_version) else {
                        continue;
                    };
                    if entry.file_type().is_ok_and(|kind| kind.is_file()) {
                        if version
                            .as_deref()
                            .and_then(|value| semver::Version::parse(value).ok())
                            .is_none_or(|value| found > value)
                        {
                            version = Some(found.to_string());
                        }
                        paths.push(entry.path());
                    }
                }
            }
        }
    }
    let mut existing: Vec<_> = paths.into_iter().map(|p| p.display().to_string()).collect();
    #[cfg(windows)]
    if let Some(registered) = windows_installed_version() {
        version = Some(registered);
        existing.push("GameVault registered in Windows Installed Apps".into());
    }
    if app
        .path()
        .data_dir()
        .is_ok_and(|path| path.join("com.phalcode.gamevault").is_dir())
        || app
            .path()
            .config_dir()
            .is_ok_and(|path| path.join("com.phalcode.gamevault").is_dir())
    {
        existing.push("Existing GameVault 2 application data".into());
    }
    Platform {
        os,
        arch,
        distro,
        formats: formats(os, arch),
        existing,
        version,
    }
}

fn appimage_version(name: &str) -> Option<semver::Version> {
    semver::Version::parse(
        name.strip_prefix("GameVault-linux-x64-")?
            .strip_suffix(".AppImage")?,
    )
    .ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn does_not_downgrade_a_detected_release() {
        assert!(ensure_no_downgrade(Some("17.2.0"), "17.1.0").is_err());
        assert!(ensure_no_downgrade(Some("17.2.0"), "17.2.0").is_ok());
        assert!(ensure_no_downgrade(Some("17.1.0"), "17.2.0").is_ok());
        assert!(ensure_no_downgrade(None, "17.2.0").is_ok());
    }

    #[test]
    fn platform_matrix() {
        assert_eq!(formats("windows", "x86_64"), [Flavor::Nsis]);
        assert_eq!(formats("linux", "x86_64"), [Flavor::Appimage, Flavor::Deb]);
        assert_eq!(formats("macos", "aarch64"), [Flavor::Dmg]);
        for (os, arch) in [
            ("windows", "aarch64"),
            ("linux", "aarch64"),
            ("macos", "x86_64"),
            ("freebsd", "x86_64"),
        ] {
            assert!(formats(os, arch).is_empty());
        }
        assert!(appimage_version("GameVault-linux-x64-17.2.0.AppImage").is_some());
        assert!(appimage_version("GameVault-linux-x64-latest.AppImage").is_none());
    }
}
