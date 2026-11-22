"""Collect unambiguous native packages and verify release version consistency."""
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tomllib

ROOT = Path(__file__).resolve().parents[1]
BUNDLES = ROOT / "bootstrapper/src-tauri/target/release/bundle"
OUTPUT = ROOT / "out"
PLATFORMS = {
    "windows-x64": {"nsis/*-setup.exe": "gamevault-joiner-windows-x64-setup.exe"},
    "linux-x64": {"appimage/*.AppImage": "gamevault-joiner-linux-x64.AppImage",
                  "deb/*.deb": "gamevault-joiner-linux-x64.deb"},
    "macos-arm64": {"dmg/*.dmg": "gamevault-joiner-macos-arm64.dmg"},
}


def collect(platform):
    OUTPUT.mkdir(exist_ok=True)
    for pattern, name in PLATFORMS[platform].items():
        matches = sorted(BUNDLES.glob(pattern))
        if len(matches) != 1:
            raise SystemExit(f"Expected one package for {pattern}, got {len(matches)}")
        shutil.copyfile(matches[0], OUTPUT / name)


def verify_release(tag):
    if not re.fullmatch(r"v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)", tag):
        raise SystemExit("Expected a stable version tag such as v0.1.0")
    application = ROOT / "bootstrapper"
    npm_version = json.loads((application / "package.json").read_text())["version"]
    tauri_version = json.loads((application / "src-tauri/tauri.conf.json").read_text())["version"]
    cargo_version = tomllib.loads((application / "src-tauri/Cargo.toml").read_text())["package"]["version"]
    if {npm_version, tauri_version, cargo_version} != {tag[1:]}:
        raise SystemExit("The release tag must match package.json, Cargo.toml and tauri.conf.json")
    expected = {name for platform in PLATFORMS.values() for name in platform.values()}
    found = {file.name for file in OUTPUT.iterdir() if file.is_file() and file.stat().st_size > 0}
    if found != expected:
        raise SystemExit(f"Release asset mismatch, expected {sorted(expected)}, found {sorted(found)}")


if __name__ == "__main__":
    target = sys.argv[1]
    if target == "checksums":
        verify_release(os.environ["GITHUB_REF_NAME"])
    else:
        collect(target)
