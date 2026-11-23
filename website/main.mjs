const REPO = "doopydoop364/gamevault-joiner";
const RELEASES = `https://github.com/${REPO}/releases`;
const ASSETS = {
  windows: "gamevault-joiner-windows-x64-setup.exe",
  appimage: "gamevault-joiner-linux-x64.AppImage",
  deb: "gamevault-joiner-linux-x64.deb",
  macos: "gamevault-joiner-macos-arm64.dmg",
};
const LABELS = { windows: "Download for Windows", appimage: "Download AppImage", macos: "Download for macOS" };
const GALLERY = new URL("https://gamevault.pcenthusiast.blog/gallery-api/api/games?limit=12");
const SAMPLE_GAMES = [
  { title: "Hollow Knight", description: "Explore a ruined underground kingdom and battle strange creatures.", image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/367520/3c3489495136b26b34f8a9543c7f5645b99d388c/header.jpg?t=1776125684" },
  { title: "Celeste", description: "Climb a mysterious mountain in a precision platformer.", image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/504230/header.jpg?t=1714089525" },
  { title: "Stardew Valley", description: "Restore a farm and build a life in a rural valley.", image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/413150/header.jpg?t=1786554168" },
];

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
    hero.textContent = LABELS[format];
    document.getElementById("device").textContent = "Recommended for this device. Other packages are listed below.";
  } catch {
    status.textContent = "Automatic downloads are temporarily unavailable.";
  }
}

if (typeof document !== "undefined") {
  for (const link of document.querySelectorAll("[data-format]")) link.setAttribute("aria-disabled", "true");
  void loadRelease();
}

export function parseGallery(data) {
  const items = Array.isArray(data) ? data : [data?.items, data?.data, data?.games].find(Array.isArray);
  if (!items) return [];
  const games = [];
  const covers = new Set();
  for (const item of items.slice(0, 48)) {
    if (typeof item?.title !== "string" || !item.title.trim() || typeof item.coverUrl !== "string") continue;
    let url;
    try { url = new URL(item.coverUrl); } catch { continue; }
    if (url.origin !== GALLERY.origin || !/^\/gallery-api\/api\/media\/[A-Za-z0-9_-]{1,80}$/.test(url.pathname) ||
      url.username || url.password || url.search || url.hash || covers.has(url.href)) continue;
    const description = typeof item.description === "string" ? item.description.replace(/\s+/g, " ").trim() : "";
    games.push({
      title: item.title.trim().slice(0, 100),
      description: description.length > 180 ? description.slice(0, 179).trimEnd() + "…" : description,
      image: url.href,
    });
    covers.add(url.href);
    if (games.length === 12) break;
  }
  return games;
}

async function setupCoverRails() {
  const container = document.getElementById("cover-rails");
  const panel = document.querySelector(".library-art");
  const detail = document.getElementById("cover-detail");
  const label = document.getElementById("cover-label");
  const title = document.getElementById("cover-title");
  const description = document.getElementById("cover-description");
  const mobile = window.matchMedia("(max-width: 750px)");
  let catalog = [];
  try {
    const response = await fetch(GALLERY, {
      credentials: "omit",
      redirect: "error",
      signal: AbortSignal.timeout(2500),
    });
    if (response.ok && response.headers.get("Content-Type")?.startsWith("application/json")) {
      catalog = parseGallery(await response.json());
    }
  } catch {
    // The public catalog is optional. Keep the preview available even when it is offline.
  }
  const games = catalog.length ? catalog : SAMPLE_GAMES;
  label.textContent = catalog.length ? "From the GameVault library" : "Example games";
  label.hidden = false;

  const rails = [];
  const shown = new Set();
  let selected;
  let timer;
  const clear = () => {
    clearTimeout(timer);
    if (!selected) return;
    rails.forEach(rail => rail.classList.remove("paused"));
    selected.classList.remove("selected");
    selected = undefined;
    detail.hidden = true;
  };
  const select = (card, game) => {
    clear();
    selected = card;
    rails.forEach(rail => rail.classList.add("paused"));
    card.classList.add("selected");
    title.textContent = game.title;
    description.textContent = game.description;
    description.hidden = !game.description;
    detail.hidden = false;
    if (mobile.matches) return;
    const bounds = panel.getBoundingClientRect();
    const rect = card.getBoundingClientRect();
    const left = rect.left - bounds.left - detail.offsetWidth - 10;
    detail.style.left = `${Math.max(8, Math.min(left, bounds.width - detail.offsetWidth - 8))}px`;
    detail.style.top = `${Math.max(8, Math.min(rect.top - bounds.top, bounds.height - detail.offsetHeight - 8))}px`;
  };
  const railCount = 3;
  for (let index = 0; index < railCount; index++) {
    const rail = document.createElement("div");
    rail.className = "cover-rail";
    rails.push(rail);
    let track = games.filter((_, gameIndex) => gameIndex % railCount === index);
    // Three covers fill the desktop viewport at every point in the loop.
    if (track.length < 3) {
      track = [...track];
      for (let offset = 0; track.length < 3; offset++) {
        const game = games[(index + offset) % games.length];
        if (games.length < 3 || !track.includes(game)) track.push(game);
      }
    }
    for (const game of [...track, ...track]) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "cover-card";
      card.classList.toggle("cover-repeat", shown.has(game));
      shown.add(game);
      const image = document.createElement("img");
      image.src = game.image;
      image.alt = "";
      const caption = document.createElement("span");
      caption.textContent = game.title;
      card.append(image, caption);
      card.addEventListener("pointermove", event => {
        if (mobile.matches || event.pointerType !== "mouse") return;
        clear();
        timer = setTimeout(() => { if (card.matches(":hover")) select(card, game); }, 250);
      });
      card.addEventListener("pointerleave", event => {
        if (!mobile.matches && event.pointerType === "mouse") clear();
      });
      card.addEventListener("focus", () => {
        if (card.matches(":focus-visible")) select(card, game);
      });
      card.addEventListener("blur", clear);
      card.addEventListener("click", () => select(card, game));
      rail.append(card);
    }
    container.append(rail);
  }
  mobile.addEventListener("change", clear);
}

function setupCopyAddress() {
  const address = document.getElementById("server-address");
  const button = document.getElementById("copy-server");
  const status = document.getElementById("copy-status");
  button.hidden = false;
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(address.textContent.trim());
      status.textContent = "Server address copied.";
    } catch {
      const range = document.createRange();
      range.selectNodeContents(address);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = "Copy the selected address manually.";
    }
  });
}

if (typeof document !== "undefined") {
  void setupCoverRails();
  setupCopyAddress();
}

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
