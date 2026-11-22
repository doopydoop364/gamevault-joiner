const REPO = "doopydoop364/gamevault-joiner";
const RELEASES = `https://github.com/${REPO}/releases`;
const ASSETS = {
  windows: "gamevault-joiner-windows-x64-setup.exe",
  appimage: "gamevault-joiner-linux-x64.AppImage",
  deb: "gamevault-joiner-linux-x64.deb",
  macos: "gamevault-joiner-macos-arm64.dmg",
};
const LABELS = { windows: "Windows x64", appimage: "Linux x64", macos: "Apple Silicon" };

export function detect({ platform = "", architecture = "", bitness = "", wow64 = false } = {}) {
  if (wow64 || bitness !== "64") return null;
  const os = platform.toLowerCase();
  if (architecture === "x86" && os === "windows") return "windows";
  if (architecture === "x86" && os === "linux") return "appimage";
  if (architecture === "arm" && os === "macos") return "macos";
  return null;
}

export function parseRelease(data) {
  const tag = data?.tag_name;
  if (typeof tag !== "string" || !/^v[0-9]+\.[0-9]+\.[0-9]+$/.test(tag) ||
      data.draft !== false || data.prerelease !== false || !Array.isArray(data.assets)) return null;
  const files = {};
  for (const [format, name] of Object.entries(ASSETS)) {
    const expected = `${RELEASES}/download/${tag}/${name}`;
    const matching = data.assets.filter((item) =>
      item?.name === name && item.state === "uploaded" && item.browser_download_url === expected,
    );
    if (matching.length === 1) files[format] = expected;
  }
  return { tag, files, page: `${RELEASES}/tag/${tag}` };
}

async function deviceFormat() {
  try {
    const ua = navigator.userAgentData;
    if (!ua || ua.mobile) return null;
    const hints = await ua.getHighEntropyValues(["architecture", "bitness", "wow64"]);
    return detect({ ...hints, platform: ua.platform });
  } catch {
    return null;
  }
}

async function loadRelease() {
  const status = document.getElementById("release");
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { signal: AbortSignal.timeout(8000) });
    if (response.status === 404) {
      status.textContent = "A public Joiner release is not available yet.";
      return;
    }
    if (!response.ok) throw new Error("Release request failed");
    const release = parseRelease(await response.json());
    if (!release) throw new Error("Unexpected release metadata");
    const link = Object.assign(document.createElement("a"), { href: release.page, textContent: release.tag });
    status.replaceChildren("Latest release ", link);
    for (const element of document.querySelectorAll("[data-format]")) {
      const url = release.files[element.dataset.format];
      if (!url) continue;
      element.href = url;
      element.classList.remove("unavailable");
      element.removeAttribute("aria-disabled");
    }

    const format = await deviceFormat();
    const url = release.files[format];
    if (!url) return;
    const hero = document.getElementById("recommended");
    hero.href = url;
    hero.textContent = `Download for ${LABELS[format]}`;
    document.getElementById("device").textContent = "Recommended for this device. Other packages are listed below.";
  } catch {
    status.textContent = "Release details are temporarily unavailable. Try the GitHub releases page below.";
  }
}

if (typeof document !== "undefined") {
  for (const link of document.querySelectorAll("[data-format]")) link.setAttribute("aria-disabled", "true");
  void loadRelease();
}
