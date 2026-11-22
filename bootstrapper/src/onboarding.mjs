export const SERVER = "https://gamevault.pcenthusiast.blog";

export const settings = [
  ["Auto-Extract Downloads", "Unpack downloaded archives."],
  ["Auto-Install Games", "Start the installer or copy portable game files after extraction."],
  ["Auto-Delete Source Files", "Let GameVault remove archives and extracted source files after successful installation."],
  ["Launch GameVault on Computer Startup", "Start GameVault when you sign in to your computer."],
  ["Minimize GameVault to System Tray on Startup", "Keep automatic launches in the tray."],
];

export function matchesPath(expected, observed, windows) {
  if (!expected || !observed) return false;
  const clean = (path) => {
    if (!windows) return path.replace(/\/+$/, "");
    return path.replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();
  };
  return clean(expected) === clean(observed);
}

export function canAdvance(stage, state) {
  switch (stage) {
    case 0: return true;
    case 1: return state.supported;
    case 2: return state.clientOpen;
    case 3: return state.profileReady;
    case 4: return state.prepared;
    case 5: return state.rootMatches && state.enabledCount === settings.length;
    default: return false;
  }
}
