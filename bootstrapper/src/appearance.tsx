import { useEffect, useLayoutEffect, useState } from "react";

type Theme = "light" | "dark";
const themeKey = "gamevault-theme";
const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
const systemTheme = (): Theme => colorScheme.matches ? "dark" : "light";

function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(themeKey);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function ThemeToggle() {
  const [preference, setPreference] = useState(savedTheme);
  const [system, setSystem] = useState(systemTheme);
  const theme = preference ?? system;
  const other = theme === "dark" ? "light" : "dark";

  useEffect(() => {
    const update = () => setSystem(systemTheme());
    colorScheme.addEventListener("change", update);
    return () => colorScheme.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function toggleTheme() {
    setPreference(other);
    try { localStorage.setItem(themeKey, other); } catch {
      // The switch still works for the current session if storage is unavailable.
    }
  }

  return <button className="theme-toggle" type="button" onClick={toggleTheme}
    aria-label={`Switch to ${other} mode`}>
    <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
    {theme === "dark" ? "Light mode" : "Dark mode"}
  </button>;
}

const covers = [
  new URL("./assets/hollow-knight.jpg", import.meta.url).href,
  new URL("./assets/celeste.jpg", import.meta.url).href,
  new URL("./assets/stardew-valley.jpg", import.meta.url).href,
];
const rows = [
  [0, 1, 2, 0, 2, 1],
  [2, 0, 1, 2, 1, 0],
  [1, 2, 0, 1, 0, 2],
  [0, 2, 1, 0, 1, 2],
  [2, 1, 0, 2, 0, 1],
];

export function CoverBackdrop() {
  return <div className="cover-backdrop" aria-hidden="true">
    <div className="cover-wall">
      {rows.map((row, index) => <div className="cover-row" key={index}>
        {row.map((cover, tile) => <img key={tile} src={covers[cover]} alt="" draggable={false} />)}
      </div>)}
    </div>
  </div>;
}
