# Project status

## Implemented

- Tauri 2 desktop assistant with React and TypeScript, native platform checks, best-effort GameVault installation and version discovery, and supported-platform gating.
- Wizard step transitions with reduced-motion support. The README shows a browser-rendered capture of the current design and a separate color concept.
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
| Rust suite and desktop build | TypeScript and Vite build passed. Native CI passed 9 Rust tests each on Linux and macOS and 8 on Windows. The Linux job also passed the live official DEB download and SHA-256 smoke test. |
| nginx syntax and public endpoints | Both nginx templates passed isolated syntax validation. A mock upstream verified API forwarding and an HTTP 429 response when the login rate limit was reached. GameVault HTTPS, HTTP redirect, anonymous download denial and hidden API documentation were checked live. The Joiner CNAME resolves publicly and GitHub Pages certificate issuance is pending. |
| Browser QA | Headless Chromium passed desktop platform recommendation, four manual links, troubleshooting, and responsive mobile no-release behavior. |
| Wizard visual QA | Headless Chromium rendered both README previews from the current frontend build, advanced from Welcome to Compatibility, confirmed the step animation, and confirmed that reduced motion disables it. |
| Windows x64 NSIS, Linux x64 AppImage and DEB, Apple Silicon DMG | All four native packages built and their checksums were verified. The AppImage and DEB executable each opened an X11 window in an isolated Linux session. Interactive Windows and macOS installation, and end-to-end setup against the public server, are untested. |
| GitHub Actions and releases | The [v0.1.1 native build and publish workflow passed](https://github.com/doopydoop364/gamevault-joiner/actions/runs/45071205614). The [public v0.1.1 release](https://github.com/doopydoop364/gamevault-joiner/releases/tag/v0.1.1) contains the Windows setup, Linux AppImage and DEB, Apple Silicon DMG, and SHA-256 manifest. The transition was browser-tested; interactive installation of this specific release on all three platforms remains untested. |

## Remaining work

- Complete interactive setup smoke tests on Windows 10/11 x64, Linux x64, and Apple Silicon after the public server is available. Arrange publisher signing and notarization if required for distribution.
- Complete an end-to-end signup, activation and authenticated download with designated accounts. Both registration flags are set to false on the running 17.0.1 backend.
- Verify the GitHub Pages certificate for the custom Joiner domain and enable and test HTTPS enforcement.

## Deployment status

The GitHub repository and v0.1.1 installers are public. GameVault is live at its canonical HTTPS URL through a dedicated Cloudflare Tunnel and loopback nginx origin. Docker now binds backend port 8080 to IPv4 loopback only. The download site is deployed through GitHub Pages, with a DNS-only custom-domain CNAME and TLS provisioning pending. No host firewall rules were edited. PostgreSQL backup restoration passed in an isolated container.
