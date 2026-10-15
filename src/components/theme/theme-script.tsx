import { THEME_STORAGE_KEY } from "./theme-constants";

// Runs synchronously in <head> before the first paint, so the page never
// flashes the wrong theme. "system" (or no saved value) follows the OS.
const script = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||(p!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.setAttribute("data-theme",d?"dark":"light");r.style.colorScheme=d?"dark":"light"}catch(e){}})()`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
