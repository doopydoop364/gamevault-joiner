use crate::releases::Flavor;
use std::{fs, path::{Path, PathBuf}, process::{Command, Stdio}};
use tempfile::NamedTempFile;

pub fn save(file: NamedTempFile, path: &Path) -> Result<(), String> {
    file.persist_noclobber(path).map_err(|error| {
        format!("Could not save the verified file without replacing an existing file: {}", error.error)
    })?;
    Ok(())
}

pub fn open(path: &Path, flavor: Flavor) -> Result<(), String> {
    match flavor {
        Flavor::Nsis => open_windows(path),
        Flavor::Dmg => launch(Command::new("/usr/bin/open").arg(path), "Disk Image Mounter"),
        Flavor::Deb => launch(Command::new("/usr/bin/xdg-open").arg(path), "your graphical package installer"),
        Flavor::Appimage => launch(&mut Command::new(path), "GameVault AppImage"),
    }
}

fn launch(command: &mut Command, name: &str) -> Result<(), String> {
    let mut child = command.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).spawn().map_err(|error| format!("Could not open {name}: {error}"))?;
    // These handlers can start successfully and then fail before opening a window.
    std::thread::sleep(std::time::Duration::from_millis(350));
    if let Some(status) = child.try_wait().map_err(|error| format!("Could not check {name}: {error}"))? {
        return if status.success() {
            Ok(())
        } else {
            Err(format!("{name} exited before the handoff finished ({status}). Check the package instructions or try a supported alternative."))
        };
    }
    std::thread::spawn(move || { let _ = child.wait(); });
    Ok(())
}

pub fn mark_download(path: &Path, flavor: Flavor) -> Result<(), String> {
    #[cfg(unix)]
    if flavor == Flavor::Appimage {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))
            .map_err(|error| format!("Could not make the AppImage executable: {error}"))?;
    }
    #[cfg(target_os = "macos")]
    if flavor == Flavor::Dmg {
        let seconds = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
            .map_err(|_| "Check your computer clock and try again.")?.as_secs();
        let status = Command::new("/usr/bin/xattr").args(["-w", "com.apple.quarantine"])
            .arg(format!("0081;{seconds:x};GameVault Joiner;")).arg(path).status()
            .map_err(|_| "Could not apply macOS download security metadata.")?;
        if !status.success() {
            return Err("Could not apply macOS download security metadata.".into());
        }
    }
    #[cfg(windows)]
    if flavor == Flavor::Nsis {
        use std::ffi::OsString;
        let mut stream = OsString::from(path);
        stream.push(":Zone.Identifier");
        fs::write(PathBuf::from(stream), "[ZoneTransfer]\r\nZoneId=3\r\n")
            .map_err(|error| format!("Could not apply Windows download security metadata: {error}"))?;
    }
    Ok(())
}

#[cfg(windows)]
fn open_windows(path: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_SHOWNORMAL};
    let path: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    let verb: Vec<u16> = "open".encode_utf16().chain(Some(0)).collect();
    let result = unsafe {
        ShellExecuteW(std::ptr::null_mut(), verb.as_ptr(), path.as_ptr(), std::ptr::null(),
            std::ptr::null(), SW_SHOWNORMAL)
    };
    if result as isize <= 32 {
        return Err("Windows did not open the installer. Check Windows security notifications and retry.".into());
    }
    Ok(())
}

#[cfg(not(windows))]
fn open_windows(_path: &Path) -> Result<(), String> {
    Err("The Windows installer requires Windows.".into())
}

pub fn location(base: &Path, name: &str, flavor: Flavor) -> Result<(Option<tempfile::TempDir>, PathBuf), String> {
    if flavor == Flavor::Appimage {
        let base = base.join("client");
        fs::create_dir_all(&base).map_err(|error| format!("Could not create the AppImage folder: {error}"))?;
        return Ok((None, base.join(name)));
    }
    let temp = tempfile::Builder::new().prefix("official-installer-").tempdir_in(base)
        .map_err(|error| format!("Could not create the installer folder: {error}"))?;
    let path = temp.path().join(name);
    Ok((Some(temp), path))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn existing_appimage_is_never_overwritten() {
        let dir = tempfile::tempdir().unwrap();
        let (_, path) = location(dir.path(), "GameVault.AppImage", Flavor::Appimage).unwrap();
        fs::write(&path, "existing").unwrap();
        let mut staging = NamedTempFile::new_in(path.parent().unwrap()).unwrap();
        staging.write_all(b"replacement").unwrap();
        assert!(save(staging, &path).is_err());
        assert_eq!(fs::read_to_string(path).unwrap(), "existing");
    }
}
