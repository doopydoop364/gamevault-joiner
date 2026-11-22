import { useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Channel, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { SERVER, canAdvance, matchesPath, settings } from "./onboarding.mjs";
import "./style.css";

type Flavor = "nsis" | "appimage" | "deb" | "dmg";
type Platform = {
  os: string; arch: string; distro: string | null; formats: Flavor[];
  existing: string[]; version: string | null;
};
type Package = { name: string; version: string; size: number; flavor: Flavor };
type Paths = { downloads: string; games: string };
type Progress = { received: number; total: number };

const stages = ["Welcome", "Compatibility", "GameVault client", "Server & account", "Local folders", "Verify settings", "Ready to play"];
const formats: Record<Flavor, string> = {
  nsis: "Windows setup", appimage: "AppImage", deb: "Debian package", dmg: "macOS disk image",
};
const installerHelp: Record<Flavor, string> = {
  nsis: "Follow the GameVault installer, then open GameVault from Start.",
  appimage: "Joiner saves a separate version of the AppImage and opens it. You can use that file to start GameVault again.",
  deb: "Complete installation in your graphical package installer, then open GameVault from your app menu. If your system has no package installer, use AppImage.",
  dmg: "Drag GameVault to Applications in the disk image, then open it from Applications. macOS may ask before replacing an existing app.",
};
const empty = { downloads: "", games: "" };
const official = "https://gamevau.lt/";
const mib = (bytes: number) => (bytes / 1048576).toFixed(1);

function App() {
  const [stage, setStage] = useState(0);
  const [platform, setPlatform] = useState<Platform>();
  const [flavor, setFlavor] = useState<Flavor>();
  const [release, setRelease] = useState<Package>();
  const [saved, setSaved] = useState("");
  const [progress, setProgress] = useState<Progress>();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [clientOpen, setClientOpen] = useState(false);
  const [reviewedExisting, setReviewedExisting] = useState(false);
  const [allowInstall, setAllowInstall] = useState(false);
  const [keepExisting, setKeepExisting] = useState(false);
  const [paths, setPaths] = useState<Paths>(empty);
  const [prepared, setPrepared] = useState(false);
  const [observed, setObserved] = useState("");
  const [profileReady, setProfileReady] = useState(false);
  const [enabled, setEnabled] = useState<boolean[]>(settings.map(() => false));

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label);
    setError("");
    setNotice("");
    try { await task(); }
    catch (problem) { setError(String(problem)); }
    finally { setBusy(""); }
  }

  function inspect() {
    return run("Checking your computer…", async () => {
      const detected = await invoke<Platform>("inspect");
      setPlatform(detected);
      setFlavor(detected.formats[0]);
      setPaths(await invoke<Paths>("default_directories"));
    });
  }

  useEffect(() => { void inspect(); }, []);

  function changePaths(value: Paths) {
    setPaths(value);
    setPrepared(false);
    setObserved("");
  }

  function pick(kind: keyof Paths | "parent") {
    void run("Choosing a folder…", async () => {
      const folder = await open({ directory: true, multiple: false });
      if (typeof folder !== "string") return;
      if (kind === "parent") {
        const sep = platform?.os === "windows" ? "\\" : "/";
        const root = folder.replace(/[\\/]+$/, "");
        changePaths({ downloads: root + sep + "Downloads", games: root + sep + "Games" });
      } else {
        changePaths({ ...paths, [kind]: folder });
      }
    });
  }

  function copy(value: string) {
    void run("Copying…", async () => {
      await writeText(value);
      setNotice("Copied to your clipboard.");
    });
  }

  function browse(url: string) {
    void run("Opening your browser…", () => openUrl(url));
  }

  const copyField = (label: string, value: string) => (
    <div className="path"><div><span>{label}</span><code>{value}</code></div>
      <button disabled={!!busy} onClick={() => copy(value)}>Copy</button></div>
  );
  const rootMatches = matchesPath(paths.games, observed, platform?.os === "windows");
  const supported = Boolean(platform?.formats.length);
  const next = canAdvance(stage, { supported, clientOpen, prepared, profileReady, rootMatches, enabledCount: enabled.filter(Boolean).length });
  const existing = Boolean(platform?.existing.length);

  function go(to: number) {
    setStage(to);
    setError("");
    setNotice("");
    document.querySelector("main")?.focus();
  }

  function advance() {
    if (stage !== 5) {
      go(stage + 1);
      return;
    }
    void run("Rechecking both folders…", async () => {
      await invoke("prepare_directories", paths);
      go(6);
    });
  }

  let content: ReactNode;
  switch (stage) {
    case 0:
      content = <>
        <h1>Set up your game library.</h1>
        <p>Install the official GameVault 2 desktop client, prepare your game folders, and connect to our server.</p>
        <div className="callout"><strong>GameVault 2 is in public beta.</strong><p>Joiner uses the official stable update channel. You’ll finish your profile and preferences in GameVault.</p></div>
      </>;
      break;
    case 1:
      content = <>
        <h1>Check compatibility</h1>
        {platform ? <>
          <div className="callout"><strong>{platform.distro ?? ({ windows: "Windows", linux: "Linux", macos: "macOS" }[platform.os] ?? platform.os)} · {platform.arch}</strong>
            <p>{supported ? "A matching GameVault package is available for this platform." : "This OS and CPU combination is outside the supported desktop builds."}</p></div>
          {existing ? <><h2>Existing GameVault indicators</h2><ul>{platform.existing.map((entry) => <li key={entry}>{entry}</li>)}</ul></> :
            <p>No GameVault 2 installation was found in common locations. Portable and custom installations may need to be checked manually.</p>}
          {supported && <p>{platform.version ? `Detected version ${platform.version}.` : "Check Settings → About in GameVault for the exact installed version."}</p>}
          {!supported && <button disabled={!!busy} onClick={() => browse(official)}>Official GameVault website</button>}
        </> : <button disabled={!!busy} onClick={() => void inspect()}>Retry compatibility check</button>}
      </>;
      break;
    case 2:
      content = <>
        <h1>Get GameVault</h1>
        <label className="check"><input type="checkbox" checked={clientOpen} onChange={(event) => setClientOpen(event.target.checked)} />
          GameVault 2 is installed and opens on this computer</label>
        <p>Already using GameVault? You can continue with your current installation. To upgrade, check Settings → About and use GameVault’s built-in updater when available.</p>
        <div className="callout">
          {platform && platform.formats.length > 1 && <label className="field">Package format
            <select value={flavor} disabled={!!busy} onChange={(event) => {
              setFlavor(event.target.value as Flavor); setRelease(undefined); setSaved(""); setProgress(undefined); setAllowInstall(false); setError("");
            }}>{platform.formats.map((option) => <option key={option} value={option}>{formats[option]}</option>)}</select></label>}
          {flavor && <p>{installerHelp[flavor]}</p>}
          <p>Official builds may be unsigned. Follow your operating system’s security guidance if it blocks the installer.</p>
          <div className="actions">
            <button disabled={!!busy || !flavor} onClick={() => void run("Checking GitHub Releases…", async () => {
              setRelease(undefined); setSaved(""); setProgress(undefined); setAllowInstall(false);
              setRelease(await invoke<Package>("latest", { flavor }));
            })}>{release ? "Refresh release" : "Check stable release"}</button>
          </div>
          {release && <>
            <p><strong>GameVault {release.version}</strong> · {mib(release.size)} MiB</p>
            {!saved && <button disabled={!!busy} onClick={() => void run("Downloading and verifying…", async () => {
              const channel = new Channel<Progress>();
              channel.onmessage = setProgress;
              setProgress({ received: 0, total: release.size });
              setSaved(await invoke<string>("download_client", { flavor, expectedVersion: release.version, onProgress: channel }));
            })}>Download and verify</button>}
            {busy === "Downloading and verifying…" && <button className="quiet" onClick={() => {
              void invoke("cancel_download").then(() => setNotice("Cancel requested. Waiting for the download to stop."), (problem) => setError(String(problem)));
            }}>Cancel download</button>}
          </>}
          {progress && <div className="transfer"><progress aria-label="Official installer download progress" value={progress.received} max={progress.total} />
            <span>{mib(progress.received)} / {mib(progress.total)} MiB</span></div>}
          {saved && <>
            {copyField("SHA-256 verified installer", saved)}
            <label className="check"><input type="checkbox" checked={allowInstall} onChange={(event) => setAllowInstall(event.target.checked)} />
              This is a fresh install, or I checked the installed version, backed up my data, closed GameVault, and chose to upgrade the existing client.</label>
            <button className="primary" disabled={!allowInstall || !!busy} onClick={() => void run("Opening the verified installer…", async () => {
              await invoke("install_client");
              setNotice("Handoff started. Finish installation and open GameVault, then confirm above.");
            })}>Open {flavor === "appimage" ? "GameVault" : "installer"}</button>
          </>}
        </div>
      </>;
      break;
    case 4:
      content = <>
        <h1>Choose your game folders</h1>
        <p>Joiner creates missing folders and checks that it can write to each one. The default locations are under <strong>GameVault</strong> in your home folder. GameVault 2 keeps each game’s downloaded archive and installed files under the same library root. Use <strong>Games</strong> for that root. Joiner creates <strong>Downloads</strong> as a separate reserved folder.</p>
        <pre aria-label="Default GameVault folder structure">{'GameVault\n├── Downloads\n└── Games'}</pre>
        <label className="check"><input type="checkbox" checked={reviewedExisting} onChange={(event) => {
          setReviewedExisting(event.target.checked); setPrepared(false);
        }} />I checked Settings → Downloads for existing locations, or this is a fresh setup.</label>
        <label className="check"><input type="checkbox" checked={keepExisting} onChange={(event) => {
          setKeepExisting(event.target.checked); setPrepared(false); setObserved("");
        }} />Keep my currently configured locations</label>
        {keepExisting && <p>Choose the library root already listed in GameVault. Keep your other existing roots in GameVault as well.</p>}
        <div className="actions">
          {!keepExisting && <button disabled={!!busy} onClick={() => pick("parent")}>Change parent folder</button>}
          <button disabled={!!busy} onClick={() => pick("downloads")}>Choose reserved folder</button>
          <button disabled={!!busy} onClick={() => pick("games")}>Choose library root</button>
          {!keepExisting && <button disabled={!!busy} onClick={() => void run("Restoring home defaults…", async () => {
            changePaths(await invoke<Paths>("default_directories"));
          })}>Restore defaults</button>}
        </div>
        {copyField("Reserved downloads folder", paths.downloads)}
        {copyField("GameVault library root", paths.games)}
        <button className="primary" disabled={!!busy || !reviewedExisting || !paths.downloads || !paths.games}
          onClick={() => void run("Checking write access…", async () => {
            setPrepared(false);
            await invoke("prepare_directories", paths);
            setPrepared(true);
            setNotice("Both folders are ready and writable.");
          })}>{keepExisting ? "Check existing folders" : "Create and check folders"}</button>
      </>;
      break;
    case 3:
      content = <>
        <h1>Connect to our server</h1>
        {copyField("Server address", SERVER)}
        <ol>
          <li>In GameVault, open <strong>New Profile</strong> and paste the server address.</li>
          <li>Choose <strong>Sign Up</strong> if you need an account or <strong>Sign In</strong> if you already have one. Enter credentials in GameVault.</li>
          <li>New accounts wait for an administrator to approve access. Return here after you can sign in and see the library.</li>
        </ol>
        <button disabled={!!busy} onClick={() => browse(SERVER + "/")}>Open server in browser</button>
        <label className="check"><input type="checkbox" checked={profileReady} onChange={(event) => setProfileReady(event.target.checked)} />
          I am signed in to this server in the GameVault desktop client</label>
      </>;
      break;
    case 5:
      content = <>
        <h1>Verify GameVault settings</h1>
        <p>In GameVault, open <strong>Settings → Downloads → Download locations</strong>. {keepExisting ?
          "Keep using your existing root." : "Add the library root below and select it when starting a download. Leave existing entries in place."}
          {" "}Copy or type the root shown in GameVault back here.</p>
        {copyField("GameVault library root", paths.games)}
        <label className="field">Library root shown in GameVault
          <input value={observed} onChange={(event) => setObserved(event.target.value)} />
        </label>
        {observed && <small>{rootMatches ? "Matches selected root" : "Folder does not match your selection"}</small>}
        <h2>After downloading</h2>
        <p>Turn on each option in GameVault and check it here once you see it enabled.</p>
        {settings.map(([label, description], index) => <div key={label}>
          {index === 3 && <h2>Startup</h2>}
          <label className="check"><input type="checkbox" checked={enabled[index]} onChange={(event) =>
            setEnabled(enabled.map((value, item) => item === index ? event.target.checked : value))} />
            <span>{label}<small>{description}</small></span></label>
        </div>)}
        <p>You can change these preferences in GameVault at any time.</p>
      </>;
      break;
    default:
      content = <>
        <h1>Your library is ready.</h1>
        <p>Open the library in GameVault, pick a title, and choose Download. GameVault handles extraction and installation according to your settings.</p>
        <div className="callout">{copyField("Reserved downloads folder", paths.downloads)}{copyField("GameVault library root", paths.games)}</div>
      </>;
  }

  return <div className="shell">
    <aside><div className="brand"><span className="mark" aria-hidden="true">∷</span> GameVault Joiner</div>
      <nav aria-label="Setup progress"><ol>{stages.map((label, index) => <li key={label} aria-current={index === stage ? "step" : undefined}>
        <span aria-hidden="true">{index < stage ? "✓" : index + 1}</span>{label}
      </li>)}</ol></nav></aside>
    <main tabIndex={-1}>
      <div className="step">Step {stage + 1} of {stages.length}</div>
      {content}
      {busy && <p role="status" className="feedback">{busy}</p>}
      {notice && <p role="status" className="feedback">{notice}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <footer>{stage > 0 && <button disabled={!!busy} onClick={() => go(stage - 1)}>Back</button>}
        {stage < stages.length - 1 && <button className="primary" disabled={!next || !!busy} onClick={advance}>
          {stage === 0 ? "Start setup" : stage === 5 ? "Finish setup" : "Continue"}
        </button>}</footer>
    </main>
  </div>;
}

createRoot(document.getElementById("root")!).render(<App />);
