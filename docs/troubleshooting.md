# Troubleshooting

| Symptom | What to check |
| --- | --- |
| No Joiner download on the site | Check the Joiner GitHub releases page. Links appear after the first public release is published. If device detection is unavailable, select the package manually after checking your computer’s OS and CPU. |
| Release lookup or download fails | Check the internet connection, wait if GitHub is rate limiting requests, and retry. A canceled or interrupted download starts over on retry. |
| Verification failed | Retry later using Joiner. If it keeps failing, report the platform and release version and use the official GameVault release page for status. |
| Windows or macOS security blocks a package | The official client may be unsigned. Follow your device’s security guidance and ask the device administrator if you need help. |
| Linux AppImage fails to start | Check the distribution’s AppImage requirements. If a compatible graphical DEB installer is available, try the DEB format instead. |
| Linux DEB opens in a file manager or does nothing | Use the desktop’s graphical package installer, or choose AppImage. Joiner can request that the desktop open a package. GameVault must open successfully before you confirm installation. |
| GameVault is waiting for activation | A server administrator must activate the account. Sign in to the intended server and wait for approval. |
| The folder check fails | Choose a writable folder below a drive root. Choose distinct non-nested locations. Ensure the volume is mounted and available to both apps. |
| A game still uses an older folder | Select the intended GameVault root when starting a new download. Existing installations stay where they were installed. |
| Startup behavior is different | Turn on launch at login and tray startup in GameVault, then sign out and sign back in to test. Opening GameVault yourself normally shows its window. |

Joiner shows operation errors in the wizard. For client failures check the official [GameVault troubleshooting guide](https://gamevau.lt/docs/troubleshooting/) and [client log locations](https://gamevau.lt/docs/clients/gamevault-2/data/).
