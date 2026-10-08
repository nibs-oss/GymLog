/**
 * Appearance is a per-device preference (localStorage), applied as
 * <html data-theme="dark|light"> before first paint by THEME_INIT_SCRIPT.
 * Light colours live in app/globals.css.
 */
export type ThemePref = "dark" | "light" | "system";

export const THEME_KEY = "gymlog.theme";
const CHANGE_EVENT = "gymlog:theme";
const LIGHT_QUERY = "(prefers-color-scheme: light)";

/** Runs in <head> before the page draws, so there's no flash of the wrong theme. */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_KEY}")||"dark";var m=window.matchMedia("${LIGHT_QUERY}");var a=function(){document.documentElement.dataset.theme=p==="system"?(m.matches?"light":"dark"):p};a();if(p==="system")m.addEventListener("change",a)}catch(e){}})();`;

export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "system" ? v : "dark";
  } catch {
    return "dark";
  }
}

let systemListener: (() => void) | null = null;

export function setThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    // Storage blocked: the choice still applies until the page reloads
  }
  const media = window.matchMedia(LIGHT_QUERY);
  const apply = () => {
    document.documentElement.dataset.theme = pref === "system" ? (media.matches ? "light" : "dark") : pref;
  };
  if (systemListener) media.removeEventListener("change", systemListener);
  systemListener = pref === "system" ? apply : null;
  if (systemListener) media.addEventListener("change", systemListener);
  apply();
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeThemePref(cb: () => void) {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
