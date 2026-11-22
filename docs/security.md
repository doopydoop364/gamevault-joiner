# Security

Joiner only requests the Phalcode GameVault frontend release source over HTTPS. The backend validates the tag, expected artifact name, exact repository path, size and SHA-256 format. Asset redirects are limited to GitHub release CDN hosts. Interrupted and failed downloads are discarded. Joiner checks saved bytes again before opening the selected package.

GitHub publishes an asset SHA-256 digest. Joiner requires it. This checks content integrity relative to GitHub’s release metadata. Official updater signatures use a separate Tauri updater key supplied by Phalcode’s release workflow. Joiner does not claim independent publisher signature verification. The normal OS security mechanisms still apply to downloaded programs.

Installer handoff uses literal paths and platform handlers. Joiner delegates any install-time privilege request to the native installer. AppImage files are saved without replacing an existing file. A matching existing file can be verified and reused. Joiner never writes GameVault’s private state. Folder creation only checks and creates selected locations plus a temporary write probe. The GameVault app owns cleanup after game installation.

The wizard displays step-specific errors without credential inputs or authorization headers. Downloaded native installer packages stay under Joiner’s per-user application-data directory after handoff so the system can continue reading them. They can be removed manually once installation finishes. The `client` directory contains versioned AppImages users may still launch.
