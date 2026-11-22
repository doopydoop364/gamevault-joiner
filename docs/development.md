# Development and releases

Use Node.js 22, npm, stable Rust, and a native runner for your target. Follow the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for WebView2 and MSVC on Windows, Xcode on macOS, or WebKitGTK and bundle tools on Linux.

```sh
cd bootstrapper
npm install
npm run tauri -- dev
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

From the repository root, run `node --test website/*.test.mjs` and `python3 -m unittest discover -s tests`. Build the static website with `python3 website/build.py`. For local use, serve the output with `python3 -m http.server --bind 127.0.0.1 --directory website/dist`.

React owns the wizard state and calls typed Tauri commands. Rust owns compatibility checks, directory creation, release selection, network integrity, and installer handoff. The release URL and checksum are derived internally. The site reads the Joiner GitHub release API at runtime and enables links only when the expected named assets are published.

## Local and upstream configuration

- Joiner uses the GameVault 2 **stable** channel. The GitHub latest release tag must be a stable semantic version. GameVault 2 is itself a public beta. Package names are checked against versioned upstream assets.
- Upstream persists roots and download switches in WebView storage. Tray state and login-item registration are written through client commands. The shipped deep link targets games. No supported public interface for injecting the Joiner profile or preferences was found in the reviewed source. The wizard verifies via user observation and path comparison, then rechecks local write access.
- Existing installation checks look at known app paths, application data, and Joiner-managed AppImages. Custom install locations and externally managed AppImages may need manual confirmation. Use GameVault’s **Settings → About** as the source for the running client version.
- The browser suggests a package only if Client Hints report a supported OS and CPU. Manual platform selection remains available in browsers without these hints.
- Joiner uses the canonical public HTTPS server URL. Moving the project GitHub repository requires updating the release links and repository constant in the site and its test.

Sources reviewed include the [upstream stable release assets](https://github.com/Phalcode/gamevault-frontend/releases/expanded_assets/17.2.0), [updater commands](https://github.com/Phalcode/gamevault-frontend/blob/17.2.0/src-tauri/src/lib.rs), [root management](https://github.com/Phalcode/gamevault-frontend/blob/17.2.0/src/utils/rootPaths.ts), [settings UI](https://github.com/Phalcode/gamevault-frontend/blob/17.2.0/src/pages/Settings.tsx), [authentication state](https://github.com/Phalcode/gamevault-frontend/blob/17.2.0/src/context/AuthContext.tsx), and [deep link parser](https://github.com/Phalcode/gamevault-frontend/blob/17.2.0/src/utils/deepLink.ts).

## Release procedure

1. Generate and commit `bootstrapper/package-lock.json` and `bootstrapper/src-tauri/Cargo.lock` in a network-enabled checkout. Use those lockfiles for subsequent release work.
2. Match versions in `bootstrapper/package.json`, `bootstrapper/src-tauri/Cargo.toml`, and `bootstrapper/src-tauri/tauri.conf.json`. Run the native build matrix on `main`.
3. Download the workflow artifacts and complete the smoke tests below. Arrange Joiner signing and notarization for production distribution where required by OS policy.
4. Push a matching stable tag like `v0.1.0` to publish. CI verifies all four packages and stages a draft with SHA-256 checksums before publishing it. A failed publish may leave a draft. Inspect its assets before completing the release or clearing it for a retry.
5. Verify the website shows the released tag and correct asset links.

## Native smoke tests

Test the installer on each target from a normal account on a clean machine and with an existing GameVault 2 install. On Linux test AppImage separately from DEB. Confirm cancel/retry, native warnings, existing data preservation, path selection, server profile, pending activation, authenticated download, and startup after a fresh login. Try with a file at a proposed folder path and with a directory the user cannot write. Confirm corrupt downloads cannot reach the installer. Record the OS, package, build tag, and results before tagging.
