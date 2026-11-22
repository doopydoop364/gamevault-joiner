use crate::releases::{self, Package};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    io::{Read, Write},
    path::Path,
    sync::atomic::{AtomicBool, Ordering},
};
use tempfile::NamedTempFile;

#[derive(Clone, Serialize)]
pub struct Progress {
    pub received: u64,
    pub total: u64,
}

struct Integrity {
    received: u64,
    hash: Sha256,
}

impl Integrity {
    fn add(&mut self, bytes: &[u8], expected: u64) -> Result<(), String> {
        self.received += bytes.len() as u64;
        if self.received > expected {
            return Err(
                "The download exceeded its published size. The installer was discarded.".into(),
            );
        }
        self.hash.update(bytes);
        Ok(())
    }

    fn finish(self, size: u64, digest: &str) -> Result<(), String> {
        if self.received != size {
            return Err("The download ended early. Retry to download again.".into());
        }
        if format!("{:x}", self.hash.finalize()) != digest {
            return Err("SHA-256 verification failed. The installer was discarded.".into());
        }
        Ok(())
    }
}

pub fn verify_file(package: &Package, path: &Path) -> Result<(), String> {
    let mut file = std::fs::File::open(path)
        .map_err(|e| format!("Could not reopen the verified installer: {e}"))?;
    let mut buffer = [0; 64 * 1024];
    let mut integrity = Integrity {
        received: 0,
        hash: Sha256::new(),
    };
    loop {
        let count = file
            .read(&mut buffer)
            .map_err(|e| format!("Could not verify the saved installer: {e}"))?;
        if count == 0 {
            break;
        }
        integrity.add(&buffer[..count], package.size)?;
    }
    integrity.finish(package.size, &package.digest)
}

fn check_cancelled(cancel: &AtomicBool) -> Result<(), String> {
    if cancel.load(Ordering::SeqCst) {
        return Err("Download canceled. You can retry when ready.".into());
    }
    Ok(())
}

pub async fn fetch(
    package: &Package,
    directory: &Path,
    cancel: &AtomicBool,
    progress: impl Fn(Progress),
) -> Result<NamedTempFile, String> {
    check_cancelled(cancel)?;
    let mut response = releases::client()?
        .get(package.url.clone())
        .send()
        .await
        .map_err(|_| "Download could not start. Check your connection and retry.")?;
    if response.status() != reqwest::StatusCode::OK {
        return Err(format!(
            "The download returned HTTP {}. Retry to refresh the release.",
            response.status().as_u16()
        ));
    }
    if response
        .content_length()
        .is_some_and(|length| length != package.size)
    {
        return Err("The download size differs from the official release metadata.".into());
    }
    let mut file = NamedTempFile::new_in(directory)
        .map_err(|e| format!("Could not create a temporary installer: {e}"))?;
    let mut integrity = Integrity {
        received: 0,
        hash: Sha256::new(),
    };
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "The download was interrupted. Retry to download again.")?
    {
        check_cancelled(cancel)?;
        integrity.add(&chunk, package.size)?;
        file.write_all(&chunk)
            .map_err(|e| format!("Could not save the installer: {e}"))?;
        progress(Progress {
            received: integrity.received,
            total: package.size,
        });
    }
    check_cancelled(cancel)?;
    integrity.finish(package.size, &package.digest)?;
    file.as_file()
        .sync_all()
        .map_err(|e| format!("Could not finish saving the installer: {e}"))?;
    Ok(file)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore = "uses live GitHub HTTPS traffic and downloads the official DEB"]
    fn official_release_smoke() {
        use crate::releases::Flavor;
        tauri::async_runtime::block_on(async {
            let package = releases::latest(Flavor::Deb).await.unwrap();
            let directory = tempfile::tempdir().unwrap();
            let file = fetch(&package, directory.path(), &AtomicBool::new(false), |_| {})
                .await
                .unwrap();
            verify_file(&package, file.path()).unwrap();
        });
    }

    #[test]
    fn verifies_complete_download_and_rejects_corruption() {
        let digest = format!("{:x}", Sha256::digest(b"game"));
        for (bytes, succeeds) in [
            (b"game".as_slice(), true),
            (b"gam", false),
            (b"spam", false),
            (b"games", false),
        ] {
            let mut check = Integrity {
                received: 0,
                hash: Sha256::new(),
            };
            let result = check.add(bytes, 4).and_then(|_| check.finish(4, &digest));
            assert_eq!(result.is_ok(), succeeds);
        }
        assert!(check_cancelled(&AtomicBool::new(true)).is_err());
    }
}
