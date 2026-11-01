window.__escaneoTema = () => {
  const rgb = (s) => { const m = (s.match(/[\d.]+/g) || [0, 0, 0]).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] === undefined ? 1 : m[3] }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const fondo = (e) => {
    const capas = [];
    for (let n = e; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.a > 0) { capas.push(c); if (c.a >= 1) break; } }
    let base = { r: 255, g: 255, b: 255 };
    for (let i = capas.length - 1; i >= 0; i--) { const c = capas[i]; base = { r: c.r * c.a + base.r * (1 - c.a), g: c.g * c.a + base.g * (1 - c.a), b: c.b * c.a + base.b * (1 - c.a) }; }
    return base;
  };
  const blancos = [...document.querySelectorAll("body *")].filter((e) => {
    const r = e.getBoundingClientRect(); if (r.width < 30 || r.height < 8) return false;
    const m = getComputedStyle(e).backgroundColor.match(/[\d.]+/g);
    return m && +m[0] > 225 && +m[1] > 225 && +m[2] > 225 && (m[3] === undefined || +m[3] > 0.5);
  }).map((e) => e.tagName + "." + e.className.toString().slice(0, 30) + " " + e.textContent.trim().slice(0, 20)).slice(0, 10);
  const contraste = []; const vistos = new Set();
  document.querySelectorAll("body *").forEach((e) => {
    if (e.closest("script,style,svg")) return;
    const t = [...e.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim().length > 1).map((n) => n.textContent.trim()).join(" ");
    if (!t) return;
    const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return;
    const cs = getComputedStyle(e); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity < 0.3) return;
    if (/^ok(lab|lch)/.test(cs.color)) return; // color con transparencia en oklab: no se puede leer aquí
    const fg = rgb(cs.color), bg = fondo(e);
    const m = { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) };
    const [a, b] = [lum(m), lum(bg)].sort((x, y) => y - x);
    const ratio = (a + 0.05) / (b + 0.05);
    const k = e.tagName + "." + e.className.toString().slice(0, 30) + "|" + t.slice(0, 24);
    if (ratio < 3.5 && !vistos.has(k)) { vistos.add(k); contraste.push(ratio.toFixed(2) + " " + k); }
  });
  return { blancos, contraste: contraste.slice(0, 10) };
};
