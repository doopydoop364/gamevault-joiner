#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod directories;
mod download;
mod installation;
mod platform;
mod releases;

use std::{
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
};
use tauri::{ipc::Channel, AppHandle, Manager, State};

#[derive(Default)]
struct Session {
    busy: AtomicBool,
    cancel: AtomicBool,
    ready: Mutex<Option<Verified>>,
}

struct Verified {
    package: releases::Package,
    path: PathBuf,
}

struct Busy<'a>(&'a AtomicBool);

impl Drop for Busy<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

fn home(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().home_dir().map_err(|_| "Your home folder could not be located.".into())
}

#[tauri::command]
async fn inspect(app: AppHandle) -> Result<platform::Platform, String> {
    let home = home(&app)?;
    tauri::async_runtime::spawn_blocking(move || platform::inspect(&app, &home))
        .await.map_err(|_| "The compatibility check did not finish.".into())
}

#[tauri::command]
fn default_directories(app: AppHandle) -> Result<directories::Directories, String> {
    directories::defaults(&home(&app)?)
}

#[tauri::command]
async fn prepare_directories(downloads: String, games: String) -> Result<directories::Directories, String> {
    tauri::async_runtime::spawn_blocking(move || directories::prepare(Path::new(&downloads), Path::new(&games)))
        .await.map_err(|_| "The folder check did not finish.")?
}

#[tauri::command]
async fn latest(flavor: releases::Flavor) -> Result<releases::Package, String> {
    if !platform::supports(flavor) {
        return Err("This installer is incompatible with your computer.".into());
    }
    releases::latest(flavor).await
}

#[tauri::command]
async fn download_client(
    app: AppHandle,
    session: State<'_, Session>,
    flavor: releases::Flavor,
    expected_version: String,
    on_progress: Channel<download::Progress>,
) -> Result<String, String> {
    if !platform::supports(flavor) {
        return Err("This installer is incompatible with your computer.".into());
    }
    if session.busy.swap(true, Ordering::SeqCst) {
        return Err("A download is already in progress.".into());
    }
    let _busy = Busy(&session.busy);
    session.cancel.store(false, Ordering::SeqCst);
    *session.ready.lock().map_err(|_| "Restart Joiner and retry.")? = None;
    let package = releases::latest(flavor).await?;
    if package.version != expected_version {
        return Err("A new official release appeared. Check the release again before downloading.".into());
    }

    let base = app.path().app_local_data_dir().map_err(|_| "Could not locate the local application data folder.")?;
    fs::create_dir_all(&base).map_err(|e| format!("Could not create the local application data folder: {e}"))?;
    let (staging, path) = installation::location(&base, &package.name, flavor)?;
    let directory = path.parent().ok_or("Invalid installer location.")?;
    let file = download::fetch(&package, directory, &session.cancel, |progress| {
        let _ = on_progress.send(progress);
    }).await?;
    installation::mark_download(file.path(), flavor)?;
    installation::save(file, &path)?;
    if let Some(staging) = staging {
        // The native installer may still be reading the file after Joiner closes.
        let _ = staging.keep();
    }
    let display = directories::display(&path)?;
    *session.ready.lock().map_err(|_| "Restart Joiner and retry.")? = Some(Verified { package, path });
    Ok(display)
}

#[tauri::command]
fn cancel_download(session: State<'_, Session>) {
    session.cancel.store(true, Ordering::SeqCst);
}

#[tauri::command]
async fn install_client(session: State<'_, Session>) -> Result<(), String> {
    if session.busy.swap(true, Ordering::SeqCst) {
        return Err("Please wait for the current operation to finish.".into());
    }
    let _busy = Busy(&session.busy);
    let (package, path) = {
        let ready = session.ready.lock().map_err(|_| "Restart Joiner and retry.")?;
        let verified = ready.as_ref().ok_or("Download and verify the official installer first.")?;
        (verified.package.clone(), verified.path.clone())
    };
    tauri::async_runtime::spawn_blocking(move || {
        download::verify_file(&package, &path)?;
        installation::open(&path, package.flavor)
    }).await.map_err(|_| "The installer could not be opened.")?
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Session::default())
        .invoke_handler(tauri::generate_handler![
            inspect, default_directories, prepare_directories, latest, download_client,
            cancel_download, install_client
        ])
        .run(tauri::generate_context!())
        .expect("could not start GameVault Joiner");
}
