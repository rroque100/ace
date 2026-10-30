export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";
export const THEME_KEY = "exp:theme";
export const THEME_EVENT = "ace:theme";
export function validTheme(value: unknown): Theme {
  return value === "light" || value === "dark" ? value : "system";
}
// Constant trusted source; no account data or user text is interpolated.
export const THEME_BOOTSTRAP = `(()=>{let t='system';try{t=localStorage.getItem('exp:theme')}catch{}const d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'})()`;
