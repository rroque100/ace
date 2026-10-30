export type Theme = "light" | "dark";
export type ResolvedTheme = "light" | "dark";
export const THEME_KEY = "exp:theme";
export const THEME_EVENT = "ace:theme";
export function validTheme(value: unknown): Theme {
  return value === "dark" ? "dark" : "light";
}
// Constant trusted source; no account data or user text is interpolated.
export const THEME_BOOTSTRAP = `(()=>{let t='light';try{t=localStorage.getItem('exp:theme')==='dark'?'dark':'light';localStorage.setItem('exp:theme',t)}catch{}document.documentElement.dataset.theme=t;const m=document.querySelector('meta[name="theme-color"]');if(m)m.content=t==='dark'?'#101923':'#f4f7fa'})()`;
