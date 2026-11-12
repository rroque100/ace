// Complemento de barrido.js: cuando `__barrido.comparar` dice que una pantalla cambió, esto dice QUÉ cambió y POR QUÉ.
// Se carga en la consola (o con un <script>) en la misma página donde se usó barrido.js; lee sus mediciones de IndexedDB.
//
//   await __detalle("etiqueta", "/historial", 1024, "cerrado|light")  → cambios agrupados por etiqueta y propiedad
//   await __causa("/historial", "font-weight", 1, 1024)                 → el primer elemento que cambia, sus antecesores y
//                                                                          TODAS las reglas que fijan esa propiedad (con su capa)
// `__causa` lee la medición "main::<ruta>::<ancho>::cerrado|light": cambia la etiqueta en el código si guardaste otra.
// Así se encontró cada fallo de la segunda pasada de la migración (ver el plan 2026-11-01-migracion-tailwind-completa.md).
window.__detalle = async (etiqueta, ruta, ancho = 1024, estado = "cerrado|light", max = 60) => {
  const PROPS = ["display","position","flex-direction","flex-wrap","flex-grow","flex-shrink","align-items","align-self","justify-content","justify-self","gap","grid-template-columns","grid-column","padding-top","padding-right","padding-bottom","padding-left","margin-top","margin-right","margin-bottom","margin-left","border-top-width","border-right-width","border-bottom-width","border-left-width","border-top-style","border-top-left-radius","font-size","font-weight","font-style","line-height","letter-spacing","text-align","text-transform","text-decoration-line","white-space","overflow-x","overflow-y","opacity","min-height","min-width","max-width","max-height","cursor","z-index","top","left","right","bottom","visibility","list-style-type","text-overflow","word-break","overflow-wrap","transform","color","background-color","border-top-color","border-bottom-color","border-left-color","border-right-color","box-shadow"];
  const esp = (ms) => new Promise((r) => setTimeout(r, ms));
  const db = await new Promise((res, rej) => { const q = indexedDB.open("qa-barrido", 1); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  const antes = await new Promise((res) => { const t = db.transaction("m").objectStore("m").get(etiqueta + "::" + ruta + "::" + ancho + "::" + estado); t.onsuccess = () => res(t.result); });
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;left:-20000px;top:0;width:" + ancho + "px;height:900px;border:0;visibility:hidden";
  f.src = ruta; document.body.appendChild(f);
  await new Promise((r) => { f.onload = r; setTimeout(r, 15000); });
  let prev = -1, igual = 0;
  for (let i = 0; i < 40; i++) { const n = f.contentDocument.querySelector("main")?.querySelectorAll("*").length ?? -1; if (n === prev && n > 0) { if (++igual >= 4) break; } else { igual = 0; prev = n; } await esp(500); }
  const [abierto, tema] = estado.split("|");
  f.contentDocument.querySelectorAll("main details").forEach((d) => (d.open = abierto === "abierto"));
  f.contentDocument.documentElement.dataset.theme = tema; await esp(1500);
  const w = f.contentWindow, els = [...f.contentDocument.querySelector("main").querySelectorAll("*")].filter((e) => !e.closest(".legalWorkspaceHistory"));
  const grupos = {}, filas = [];
  if (els.length !== antes.length) { f.remove(); return "DOM " + antes.length + "→" + els.length; }
  els.forEach((e, i) => {
    const cs = w.getComputedStyle(e), x = antes[i], c = [];
    for (const p of PROPS) { const v = cs.getPropertyValue(p); if (v !== x[p]) c.push(p + ":" + x[p] + "→" + v); }
    if (!c.length) return;
    const cls = (typeof e.className === "string" ? e.className : "").split(/\s+/).filter((t) => /[A-Z]/.test(t) && !/[:\[]/.test(t)).slice(0, 2).join(".");
    for (const z of c) { const k = e.tagName.toLowerCase() + " " + z; grupos[k] = (grupos[k] || 0) + 1; }
    if (filas.length < max) filas.push(i + ":" + e.tagName.toLowerCase() + (cls ? "." + cls : "") + "|" + (e.textContent || "").trim().slice(0, 16) + " {" + c.slice(0, 4).join(", ") + "}");
  });
  f.remove();
  return { grupos: Object.entries(grupos).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, n]) => n + "× " + k), filas: filas.slice(0, 15) };
};

// Primeros elementos cuya propiedad difiere de la medición guardada, con las reglas que la fijan.
window.__causa = async (ruta, prop, n = 1, ancho = 1024, saltar = 0) => {
  const db = await new Promise((res) => { const q = indexedDB.open("qa-barrido", 1); q.onsuccess = () => res(q.result); });
  const antes = await new Promise((res) => { const t = db.transaction("m").objectStore("m").get("main::" + ruta + "::" + ancho + "::cerrado|light"); t.onsuccess = () => res(t.result); });
  const f = document.createElement("iframe"); f.style.cssText = "position:fixed;left:-20000px;width:" + ancho + "px;height:900px"; f.src = ruta; document.body.appendChild(f);
  await new Promise((r) => (f.onload = r)); await new Promise((r) => setTimeout(r, 9000));
  const d = f.contentDocument, w = f.contentWindow; d.querySelectorAll("main details").forEach((x) => (x.open = false)); await new Promise((r) => setTimeout(r, 800));
  const els = [...d.querySelector("main").querySelectorAll("*")].filter((e) => !e.closest(".legalWorkspaceHistory"));
  const idx = []; let s = 0;
  els.forEach((e, i) => { if (idx.length < n && antes[i] && w.getComputedStyle(e).getPropertyValue(prop) !== antes[i][prop]) { if (s++ >= saltar) idx.push(i); } });
  const out = idx.map((i) => {
    const el = els[i], hits = [];
    const walk = (rules, ctx) => { for (const r of rules) { if (r.selectorText) { try { if (el.matches(r.selectorText) && r.style.getPropertyValue(prop)) hits.push(ctx + " " + r.selectorText.slice(0, 200) + " { " + r.style.getPropertyValue(prop) + " }"); } catch {} } else if (r.cssRules) walk(r.cssRules, ctx + (r.conditionText ? "@" + r.conditionText.slice(0, 30) : r.name ? "@" + r.name : "")); } };
    for (const sh of d.styleSheets) { try { walk(sh.cssRules, ""); } catch {} }
    const anc = []; let p = el.parentElement; while (p && anc.length < 3) { anc.push(p.tagName.toLowerCase() + "[" + String(p.className).slice(0, 150) + "]"); p = p.parentElement; }
    return i + ": " + el.tagName + " «" + el.textContent.trim().slice(0, 25) + "» " + prop + " " + antes[i][prop] + "→" + w.getComputedStyle(el).getPropertyValue(prop) + " [" + String(el.className?.baseVal ?? el.className).slice(0, 200) + "]\n↑ " + anc.join("\n↑ ") + "\n" + hits.join("\n");
  });
  f.remove(); return out.join("\n\n");
};
