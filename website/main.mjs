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

function setupCoverRails() {
  const container = document.getElementById("cover-rails");
  const panel = document.querySelector(".library-art");
  const detail = document.getElementById("cover-detail");
  if (!container || !panel || !detail) return;
  const games = [
    { title: "Hollow Knight", description: "Explore a ruined underground kingdom and battle strange creatures.", image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/367520/3c3489495136b26b34f8a9543c7f5645b99d388c/header.jpg?t=1776125684" },
    { title: "Celeste", description: "Climb a mysterious mountain in a precision platformer.", image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/504230/header.jpg?t=1714089525" },
    { title: "Stardew Valley", description: "Restore a farm and build a life in a rural valley.", image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/413150/header.jpg?t=1786554168" },
  ];
  let timer;
  const clear = () => {
    clearTimeout(timer);
    container.querySelectorAll(".cover-rail").forEach(rail => rail.classList.remove("paused"));
    container.querySelectorAll(".cover-card").forEach(card => card.classList.remove("selected"));
    detail.hidden = true;
  };
  const select = (card, game) => {
    container.querySelectorAll(".cover-rail").forEach(rail => rail.classList.add("paused"));
    card.classList.add("selected");
    document.getElementById("cover-title").textContent = game.title;
    document.getElementById("cover-description").textContent = game.description;
    detail.hidden = false;
    const bounds = panel.getBoundingClientRect();
    const rect = card.getBoundingClientRect();
    const left = rect.left - bounds.left - detail.offsetWidth - 10;
    detail.style.left = `${Math.max(8, Math.min(left, bounds.width - detail.offsetWidth - 8))}px`;
    detail.style.top = `${Math.max(8, Math.min(rect.top - bounds.top, bounds.height - detail.offsetHeight - 8))}px`;
  };
  for (let index = 0; index < 3; index++) {
    const rail = document.createElement("div");
    rail.className = "cover-rail";
    for (let item = 0; item < 6; item++) {
      const game = games[(item + index) % games.length];
      const card = document.createElement("button");
      card.type = "button";
      card.className = "cover-card";
      card.setAttribute("aria-label", `${game.title}, example game`);
      const image = document.createElement("img");
      image.src = game.image;
      image.alt = "";
      const label = document.createElement("span");
      label.textContent = game.title;
      card.append(image, label);
      card.addEventListener("pointermove", event => {
        if (event.pointerType !== "mouse") return;
        clear();
        timer = setTimeout(() => { if (card.matches(":hover")) select(card, game); }, 250);
      });
      card.addEventListener("pointerleave", clear);
      card.addEventListener("focus", () => select(card, game));
      card.addEventListener("blur", clear);
      card.addEventListener("click", () => select(card, game));
      rail.append(card);
    }
    container.append(rail);
  }
}

if (typeof document !== "undefined") setupCoverRails();

function setupTheme() {
  const button = document.getElementById("theme-toggle");
  if (!button) return;
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  let preference = null;
  try { preference = localStorage.getItem("gamevault-theme"); } catch {}
  const apply = (theme) => {
    document.documentElement.dataset.theme = theme;
    button.querySelector(".theme-label").textContent = theme === "dark" ? "Light mode" : "Dark mode";
    button.querySelector("[aria-hidden]").textContent = theme === "dark" ? "☀" : "☾";
    button.setAttribute("aria-label", `Switch to ${theme === "dark" ? "light" : "dark"} mode`);
  };
  apply(preference === "dark" || preference === "light" ? preference : systemTheme.matches ? "dark" : "light");
  button.addEventListener("click", () => {
    preference = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem("gamevault-theme", preference); } catch {}
    apply(preference);
  });
  systemTheme.addEventListener("change", event => { if (!preference) apply(event.matches ? "dark" : "light"); });
}

if (typeof document !== "undefined") setupTheme();
