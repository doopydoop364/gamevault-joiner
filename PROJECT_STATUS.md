# Project status

## Implemented

- Tauri 2 desktop assistant with React and TypeScript, native platform checks, best-effort GameVault installation and version discovery, and supported-platform gating.
- Official stable release asset discovery, streaming transfer progress, cancellation and retry, mandatory SHA-256 and size verification, and native installer handoff.
- Home-directory defaults and custom folder selection, write checks, non-destructive path creation, and upgrade confirmation.
- Guided server profile, signup and activation flow. GameVault handles credentials. Wizard completion compares the library root reported by the user, checks all five preference confirmations, and rechecks write access.
- Responsive download site with release information, conditional device recommendations, manual downloads, and troubleshooting.
- Native runner workflows for Windows x64, Linux x64 and Apple Silicon. Tag publication collects four packages plus checksums. A separate CI job builds the website artifact.
- Read-only server configuration inspection, proposed loopback Compose overlay and nginx examples, and backup, verification and rollback procedures.

## Upstream constraints

- GameVault 2 is in public beta. Joiner selects the stable update channel.
- The reviewed source stores library roots and several preferences in desktop WebView state. It provides one root per game and creates download, extraction, and installation directories inside the same version tree. Joiner creates both requested directories and guides users to use `Games` as their root or keep an existing root. `Downloads` is reserved.
- GameVault’s shipped deep links target games. The wizard uses the supported in-client profile and settings screens, with user-observed checks in place of direct reads or writes of private client state.
- GitHub publishes SHA-256 digests for reviewed assets. Joiner fails closed if the digest is absent or invalid. GameVault’s Tauri updater signature verification and OS signing are separate.
- Custom installations can require manual identification. Linux AppImage files are kept as separate versions. Transparent binary replacement is delegated to the official client updater and native installers.
- The postimg reference pages were inaccessible. The five settings and their behavior were cross-checked against the named upstream settings and source.

## Validation performed

| Check | Result |
| --- | --- |
| Python project tests | Three passed. They cover the website and release naming contract, incomplete releases and version tags, and the canonical server address. |
| JavaScript behavioral assertions | Four passed in the Node 22 test runner. |
| Static site build | Produced `website/dist` with the HTML, CSS and JavaScript. |
| Compose | Existing file parsed and the proposed merged override passed `docker compose config --quiet`. |
| Whitespace | `git diff --check` passed. |
| Rust suite and desktop build | TypeScript and Vite build passed. Rust suites and bundles are being checked in native CI. |
| nginx syntax and public endpoints | Both nginx templates passed isolated container syntax validation. Public DNS returned NXDOMAIN for both names. |
| Browser QA | Unrun. |
| Windows x64 NSIS, Linux x64 AppImage and DEB, Apple Silicon DMG | Implementation and CI configured. No native artifacts or graphical installer smoke tests have been verified. |
| GitHub Actions and releases | Private GitHub repository created and main pushed. Native CI is running. No release published. |

## Remaining work

- Confirm native CI and approval for public repository visibility before publishing the first downloadable release. npm and Cargo lockfiles are committed.
- Run native CI, fix any build failures, then execute the smoke tests in the development guide on Windows 10/11 x64, Linux x64, and Apple Silicon. Get signing and notarization in place where required, then tag and publish.
- The running GameVault backend is 17.0.1 and its installed code supports both registration flags. It has port 8080 bound on all host interfaces. External reachability and an end-to-end registration and download still require verification.
- Review the deployment changes with the server owner before modifying the proxy, backend binding, DNS, firewall, or public service exposure.

## Deployment status

No server, network or public hosting changes were made. The Joiner website is prepared locally and the release workflow is configured in Git. There are no published Joiner installers.
