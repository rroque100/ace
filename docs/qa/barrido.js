// Barrido de estilos calculados sobre VARIAS pantallas a la vez, con ancho y tema fijos.
//
// Sustituye al flujo manual de docs/qa/estilos-computados.js (una pantalla, el ancho que tenga la ventana, un
// reload por cada medición). Carga cada ruta en un iframe del mismo origen con el ancho que se pida, espera a que
// el DOM se estabilice, pone el tema y mide cada elemento. Las mediciones van a IndexedDB (no al límite de 5 MB de
// localStorage), así que caben muchas rutas × anchos × temas.
//
// Uso, en la consola del navegador con el código SIN migrar:
//   await __barrido.guardar("etiqueta", ["/chat", "/busqueda"], { anchos: [1024, 375] })
// Tras migrar:
//   await __barrido.comparar("etiqueta", ["/chat", "/busqueda"], { anchos: [1024, 375] })
//
// Mide solo el estado inicial de cada pantalla (con todos los <details> cerrados y abiertos). Los estados que piden
// pulsar algo (diálogos, popovers, resultados de una búsqueda) se siguen comprobando con estilos-computados.js.
(() => {
  const PROPS = [
    "display", "position", "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "align-items", "align-self",
    "justify-content", "justify-self", "gap", "grid-template-columns", "grid-column", "padding-top", "padding-right",
    "padding-bottom", "padding-left", "margin-top", "margin-right", "margin-bottom", "margin-left", "border-top-width",
    "border-right-width", "border-bottom-width", "border-left-width", "border-top-style", "border-top-left-radius",
    "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-align", "text-transform",
    "text-decoration-line", "white-space", "overflow-x", "overflow-y", "opacity", "min-height", "min-width", "max-width",
    "max-height", "cursor", "z-index", "top", "left", "right", "bottom", "visibility", "list-style-type", "text-overflow",
    "word-break", "overflow-wrap", "transform",
    // colores: se comparan aparte (pasar un hex a un token los cambia a propósito)
    "color", "background-color", "border-top-color", "border-bottom-color", "border-left-color", "border-right-color", "box-shadow",
  ];
  const COLOR = new Set(["color", "background-color", "border-top-color", "border-bottom-color", "border-left-color", "border-right-color", "box-shadow"]);
  const ALIN = new Set(["align-items", "align-self", "justify-content", "justify-self"]);
  const EXCLUIR = ".legalWorkspaceHistory";
  const esp = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── IndexedDB mínima ───────────────────────────────────────────────────────────────────────────────────
  const db = () =>
    new Promise((res, rej) => {
      const q = indexedDB.open("qa-barrido", 1);
      q.onupgradeneeded = () => q.result.createObjectStore("m");
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
  const poner = async (k, v) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction("m", "readwrite"); t.objectStore("m").put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); };
  const leer = async (k) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction("m").objectStore("m").get(k); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); };

  // ── Medición de una ruta ───────────────────────────────────────────────────────────────────────────────
  async function cargar(ruta, ancho) {
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;left:-20000px;top:0;width:" + ancho + "px;height:900px;border:0;visibility:hidden";
    f.src = ruta;
    document.body.appendChild(f);
    await new Promise((r) => { f.onload = r; setTimeout(r, 15000); });
    const doc = () => f.contentDocument;
    // espera a que el DOM de <main> se estabilice (hidratación, datos)
    let prev = -1, igual = 0;
    for (let i = 0; i < 40; i++) {
      const n = doc() && doc().querySelector("main") ? doc().querySelector("main").querySelectorAll("*").length : -1;
      if (n === prev && n > 0) { if (++igual >= 4) break; } else { igual = 0; prev = n; }
      await esp(500);
    }
    return f;
  }

  function medir(f) {
    const w = f.contentWindow, doc = f.contentDocument;
    const main = doc.querySelector("main");
    if (!main) return null;
    return [...main.querySelectorAll("*")]
      .filter((e) => !e.closest(EXCLUIR))
      .map((e) => {
        const cs = w.getComputedStyle(e), r = e.getBoundingClientRect();
        const o = { _: e.tagName.toLowerCase() + "|" + (e.textContent || "").trim().slice(0, 18), w: Math.round(r.width), h: Math.round(r.height) };
        for (const p of PROPS) o[p] = cs.getPropertyValue(p);
        return o;
      });
  }

  async function ruta(rutaUrl, ancho, temas) {
    const f = await cargar(rutaUrl, ancho);
    const out = {};
    const doc = f.contentDocument;
    if (!doc.querySelector("main")) { f.remove(); return { error: "sin <main> (¿sesión o ruta sin acceso?): " + (f.contentWindow.location.pathname) }; }
    for (const estado of ["cerrado", "abierto"]) {
      doc.querySelectorAll("main details").forEach((d) => (d.open = estado === "abierto"));
      await esp(500);
      for (const tema of temas) {
        doc.documentElement.dataset.theme = tema;
        await esp(1200);
        out[estado + "|" + tema] = medir(f);
      }
    }
    out.destino = f.contentWindow.location.pathname;
    f.remove();
    return out;
  }

  const clave = (et, r, a, t) => et + "::" + r + "::" + a + "::" + t;

  window.__barrido = {
    async guardar(etiqueta, rutas, opc) {
      const { anchos = [1024, 375], temas = ["light", "dark"] } = opc || {};
      const resumen = [];
      for (const r of rutas) for (const a of anchos) {
        const m = await ruta(r, a, temas);
        if (m.error) { resumen.push(r + " @" + a + ": " + m.error); continue; }
        for (const k of Object.keys(m)) if (k !== "destino") await poner(clave(etiqueta, r, a, k), m[k]);
        resumen.push(r + " @" + a + ": " + Object.keys(m).filter((k) => k !== "destino").map((k) => k + "=" + (m[k] ? m[k].length : "x")).join(" ") + (m.destino !== r ? " (redirige a " + m.destino + ")" : ""));
      }
      return resumen;
    },
    async comparar(etiqueta, rutas, opc) {
      const { anchos = [1024, 375], temas = ["light", "dark"] } = opc || {};
      const informe = {};
      for (const r of rutas) for (const a of anchos) {
        const m = await ruta(r, a, temas);
        if (m.error) { informe[r + " @" + a] = m.error; continue; }
        const por = {};
        for (const k of Object.keys(m)) {
          if (k === "destino") continue;
          const antes = await leer(clave(etiqueta, r, a, k));
          if (!antes) { por[k] = "sin medición guardada"; continue; }
          const ahora = m[k];
          // Pares de elementos a comparar. Si el DOM tiene otro tamaño (el historial o las búsquedas guardadas del
          // usuario cambian entre mediciones), se alinean por el principio y por el final y se deja fuera lo del medio.
          let pares = antes.map((x, i) => [x, ahora[i], i]);
          let nota = "";
          if (antes.length !== ahora.length) {
            let p = 0;
            while (p < antes.length && p < ahora.length && antes[p]._ === ahora[p]._) p++;
            let s = 0;
            while (s < antes.length - p && s < ahora.length - p && antes[antes.length - 1 - s]._ === ahora[ahora.length - 1 - s]._) s++;
            pares = [
              ...antes.slice(0, p).map((x, i) => [x, ahora[i], i]),
              ...antes.slice(antes.length - s).map((x, i) => [x, ahora[ahora.length - s + i], antes.length - s + i]),
            ];
            nota = "DOM " + antes.length + "→" + ahora.length + " (se comparan " + pares.length + ")";
          }
          const dif = []; let colores = 0; const ejColores = [];
          pares.forEach(([x, y, i]) => {
            const c = [];
            for (const q of ["w", "h"]) if (Math.abs(x[q] - y[q]) > 1) c.push(q + ":" + x[q] + "→" + y[q]);
            for (const p of PROPS) {
              let u = x[p], v = y[p];
              if (COLOR.has(p)) { if (u !== v) { colores++; if (ejColores.length < 4) ejColores.push(i + ":" + x._ + " " + p + " " + u + "→" + v); } continue; }
              if (ALIN.has(p)) { u = u.replace(/flex-(end|start)/g, "$1"); v = v.replace(/flex-(end|start)/g, "$1"); }
              if (p === "border-top-left-radius" && parseFloat(u) >= 999 && parseFloat(v) >= 999) continue;
              if (u !== v) c.push(p + ":" + u + "→" + v);
            }
            // Primero los elementos cuya PROPIA propiedad cambia (la causa); los que solo cambian de tamaño (por arrastre
            // de un padre o un hermano) van detrás.
            const propias = c.filter((z) => !/^[wh]:/.test(z));
            if (c.length) (propias.length ? dif.unshift : dif.push).call(dif, i + ":" + x._ + " {" + propias.concat(c.filter((z) => /^[wh]:/.test(z))).slice(0, 3).join(", ") + "}");
          });
          if (dif.length || colores || nota) por[k] = { estructura: dif.length, colores, nota, ejemplos: dif.slice(0, 4), ejColores };
        }
        informe[r + " @" + a] = Object.keys(por).length ? por : "idéntico";
      }
      return informe;
    },
  };
  return "listo: __barrido.guardar / __barrido.comparar";
})();
