use serde::Serialize;
use std::{
    fs,
    io::Write,
    path::{Component, Path, PathBuf},
};

#[derive(Clone, Serialize)]
pub struct Directories {
    pub downloads: String,
    pub games: String,
}

pub fn defaults(home: &Path) -> Result<Directories, String> {
    let parent = home.join("GameVault");
    Ok(Directories {
        downloads: display(&parent.join("Downloads"))?,
        games: display(&parent.join("Games"))?,
    })
}

pub fn display(path: &Path) -> Result<String, String> {
    path.to_str().map(str::to_owned).ok_or_else(|| {
        "This location cannot be represented in GameVault. Choose a different folder.".into()
    })
}

fn validate(path: &Path) -> Result<(), String> {
    if !path.is_absolute()
        || path.parent().is_none()
        || path
            .components()
            .any(|item| matches!(item, Component::ParentDir))
    {
        return Err("Choose a full folder path below the root of your drive.".into());
    }
    Ok(())
}

fn resolved_location(path: &Path) -> std::io::Result<PathBuf> {
    match path.canonicalize() {
        Ok(resolved) => Ok(resolved),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            let (Some(parent), Some(name)) = (path.parent(), path.file_name()) else {
                return Err(error);
            };
            Ok(resolved_location(parent)?.join(name))
        }
        Err(error) => Err(error),
    }
}

fn check_distinct(downloads: &Path, games: &Path) -> Result<(), String> {
    if downloads.starts_with(games) || games.starts_with(downloads) {
        return Err("Choose separate, non-nested folders for downloads and games.".into());
    }
    Ok(())
}

fn probe(path: &Path) -> std::io::Result<()> {
    let mut file = tempfile::Builder::new()
        .prefix(".joiner-write-check-")
        .tempfile_in(path)?;
    file.write_all(b"GameVault Joiner write check")?;
    file.close()
}

pub fn prepare(downloads: &Path, games: &Path) -> Result<Directories, String> {
    for path in [downloads, games] {
        validate(path)?;
    }
    let canonical = |path: &Path| {
        resolved_location(path)
            .map_err(|error| format!("Could not resolve {}: {error}", path.display()))
    };
    check_distinct(&canonical(downloads)?, &canonical(games)?)?;
    for path in [downloads, games] {
        fs::create_dir_all(path)
            .map_err(|error| format!("Could not create {}: {error}", path.display()))?;
    }
    check_distinct(&canonical(downloads)?, &canonical(games)?)?;
    for path in [downloads, games] {
        probe(path).map_err(|error| {
            format!(
                "Could not verify write access to {}: {error}",
                path.display()
            )
        })?;
    }
    Ok(Directories {
        downloads: display(downloads)?,
        games: display(games)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_defaults_and_preserves_existing_files() {
        let home = tempfile::tempdir().unwrap();
        let paths = defaults(home.path()).unwrap();
        let downloads = Path::new(&paths.downloads);
        let games = Path::new(&paths.games);
        prepare(downloads, games).unwrap();
        fs::write(games.join("save.dat"), "keep").unwrap();
        prepare(downloads, games).unwrap();
        assert!(downloads.is_dir());
        assert_eq!(fs::read_to_string(games.join("save.dat")).unwrap(), "keep");
        assert_eq!(fs::read_dir(games).unwrap().count(), 1);
    }

    #[test]
    fn rejects_unusable_locations() {
        let home = tempfile::tempdir().unwrap();
        let file = home.path().join("regular-file");
        fs::write(&file, "keep").unwrap();
        let games = home.path().join("Games");
        assert!(prepare(&file, &games).is_err());
        assert!(probe(&file).is_err());
        assert!(prepare(&games, &games.join("nested")).is_err());
        assert!(prepare(Path::new("relative"), &games).is_err());
        assert!(!games.exists());
    }

    #[cfg(unix)]
    #[test]
    fn checks_write_permissions_for_normal_users() {
        use std::os::unix::fs::PermissionsExt;
        let folder = tempfile::tempdir().unwrap();
        fs::set_permissions(folder.path(), fs::Permissions::from_mode(0o555)).unwrap();
        let result = probe(folder.path());
        fs::set_permissions(folder.path(), fs::Permissions::from_mode(0o755)).unwrap();
        // CI executes as an ordinary user. An administrator can still write here.
        if std::env::var_os("CI").is_some() {
            assert_eq!(
                result.unwrap_err().kind(),
                std::io::ErrorKind::PermissionDenied
            );
        }
    }
}
