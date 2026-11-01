# Migración completa a Tailwind — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que toda la interfaz de ACE se escriba con utilidades de Tailwind sobre los tokens del sistema, sin CSS propio por componente ni colores a mano, de modo que el modo claro y el oscuro sean correctos por construcción.

**Architecture:** Migración incremental por componente, de mayor a menor valor para el usuario (primero lo que ven las cuentas externas). Cada componente se convierte entero, se borra el CSS que deja huérfano y un test «trinquete» impide que las cifras vuelvan a subir. No hay reescritura en bloque: `styles.css` está en una capa de menor prioridad que las utilidades, así que un componente a medio migrar sigue funcionando.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS 4.3 (`@tailwindcss/postcss`), Radix, Vitest, Node 22.

## Global Constraints

- Código, comentarios y commits en español; los commits describen el síntoma o el beneficio que ve el usuario (`CLAUDE.md`).
- Sin Preflight global: el reset vive solo en `.tw`. Un componente migrado debe quedar dentro de un contenedor `.tw`.
- Colores **solo con tokens** (`bg-panel`, `text-muted`, `border-line`, `border-line-strong`, `bg-warning-soft`, `text-on-brand`…). Nada de `#rrggbb`, `bg-white` ni clases de la paleta por defecto (`slate`, `teal`, `amber`…): `tests/paleta-colores.test.ts` lo impide.
- Los tokens de contraste ya están calculados (≥4,5:1 texto, ≥3:1 bordes de control); no se reajustan en esta migración.
- Cada tarea termina verificada con `npm run typecheck`, `npm run lint`, los tests de paleta y de migración y `npm run build`.
- Los pasos de commit se ejecutan **solo cuando el usuario lo pida**; el trabajo se entrega en PRs pequeños (una tarea o una fase por PR).
- No hay tests de renderizado (Vitest corre en `node`): la verificación visual es parte obligatoria de cada tarea. Las cuentas externas solo abren Centro Jurídico y Simulador; para el resto de pantallas inicia sesión el propio usuario.
- No se tocan las migraciones SQL ni la lógica de datos: es un cambio de presentación.
- Para verificar un cambio visual **no** se ejecutan descargas, cambios de usuarios, generación de preguntas ni escrituras de documentos (regla de `docs/interface-tailwind-migration-2026-10-31.md`). Se revisa con datos existentes.
- Criterios de aceptación heredados de ese documento: Inter autoalojada, cuerpo de 14–16 px, lector jurídico a 18 px ajustable, controles táctiles de ~44 px, foco visible, movimiento reducido y **sin desbordamiento horizontal** en escritorio, tableta y celular.

---

## Relación con el trabajo del 31/10

`docs/interface-tailwind-migration-2026-10-31.md` ya fijó el objetivo (una sola tecnología de estilos, sin hojas CSS por pantalla ni `style` estático), migró la base compartida (AppShell, Sidebar, Inicio, apariencia, acceso, primitivos) y dejó una auditoría: `node scripts/audit-interface-styles.mjs --check` comprueba que los 7 componentes de su lista `migrated` no tengan `style={…}` ni importen CSS (hoy: `{"migrated":7,"violations":[]}`). Este plan **continúa** ese trabajo con la misma cautela (la revisión del 31/10 rechazó convertirlo todo de una pasada): una tarea por componente, y cada componente migrado se **añade a esa lista `migrated`** para que la auditoría lo vigile desde entonces. Lo que este plan añade: la medición por componente, el borrado del CSS que queda huérfano, el test de trinquete y el orden por valor para el usuario.

---

## Punto de partida (medido el 2026-11-01 sobre `main` `fa734a8`)

| Dato | Valor |
|---|---|
| Ficheros `.tsx` | 232 — 89 solo Tailwind · 30 mezclados · 86 solo CSS propio · 27 sin clases |
| Usos de clase propia en `className` | 1.667 en 113 ficheros |
| `app/styles.css` | 11.344 líneas, 1.877 reglas; **123 reglas (657 líneas) ya huérfanas** |
| `style={…}` en línea | 372 (225 son literales puros, 100 llevan expresión) |
| Literales `#rrggbb` en TSX | 434 |
| `@source` en `app/tailwind.css` | 74 entradas |

## Hallazgos que condicionan el plan

1. **Tailwind escanea solo.** `app/tailwind.css` no usa `source(none)`: una clase `animate-[expSlideDown_200ms_ease]` que vive en un fichero que **no** está en la lista de `@source` sale en el CSS de producción. La nota del `CLAUDE.md` («no hay escaneo automático… añádelo a `@source`») es falsa hoy y las 74 entradas son redundantes. La Task 0.3 lo verifica y lo corrige.
2. **Las utilidades ganan a `styles.css`.** `styles.css` se importa con `layer(legacy)` y el orden es `theme, legacy, tw-base, components, utilities`. Poner utilidades sobre un elemento que aún lleva su clase vieja funciona sin `!`; por eso la migración puede ser gradual. Lo que **no** está en capa (`workspace.css`) sí gana a las utilidades: ahí solo quedan tokens y reglas de modo oscuro.
3. **Hay código muerto.** `app/components/semantic-search.tsx` (799 líneas), `lifecycle-map.tsx` (166) y `contract-form.tsx` (163) no los importa nadie (solo aparecen en documentación). Se borran en vez de migrarse.
4. **El Centro Jurídico ya tiene una capa de compatibilidad.** `app/components/legal-workspace.css` (431 líneas, ~300 selectores `.legalWorkspace …`) estiliza las clases de `legal-chat.tsx` con `@apply`. Migrar ese componente implica quitar también esas reglas (Task 2.6).
5. **Contratos no usa clases: usa estilos en línea.** `contrato-sie-form` (106 `style`), `contrato-cp-form` (94), las dos listas y el workspace concentran ~250 de los 372. Es el mayor foco de colores fijos (hex) y de modo oscuro roto fuera de `styles.css`.
6. **Las clases compartidas frenan el borrado.** `secondaryButton` (77 ficheros), `primaryButton` (51), `compactButton` (37), `emptyState` (20), `eyebrow` y `spinIcon` (18), `formMessage` (17), `toolPanel`/`toolPanelHeader` (14), `errorText` (13), `formActions` (11), `documentList` (10), `toolBody` (8). Sus reglas solo se pueden borrar cuando el último consumidor se migra; la Task 6.1 lo cierra.

## Tabla de equivalencias (clases compartidas → Tailwind)

Los primitivos ya existen en `app/components/ui` (`Button`, `buttonClasses`, `Card`, `Alert`, `EmptyState`, `Field`, `Input`, `Select`, `Textarea`). Un `<Link>` que debe parecer botón usa `buttonClasses(...)` (sigue siendo enlace).

| Clase vieja | Sustituir por |
|---|---|
| `primaryButton` | `<Button variant="primary">` / `buttonClasses({ variant: "primary" })` |
| `secondaryButton` | `<Button variant="secondary">` / `buttonClasses({ variant: "secondary" })` |
| `compactButton` | `<Button size="sm" variant="secondary">` |
| `dangerButton` | `<Button destructive variant="primary">` |
| `iconButton` | `<IconButton>` |
| `emptyState` | `<EmptyState>` |
| `formMessage` | `<Alert tone="info">` |
| `errorText`, `evalError`, `authError` | `<Alert tone="danger">` |
| `eyebrow` | `mb-[7px] text-xs font-bold uppercase text-brand` |
| `spinIcon` | `animate-spin` |
| `formActions` | `flex justify-end gap-2.5` |
| `toolPanel` | `<Card>` (o `overflow-hidden rounded-[10px] border border-line bg-panel shadow-card`) |
| `toolPanelHeader` | `flex items-center justify-between gap-4 border-b border-line bg-panel p-[18px] text-ink` |
| `toolBody` | `grid gap-4 p-[18px]` |
| campo de texto / select | `<Input>` / `<Select>` (borde `border-line-strong`, placeholder `text-placeholder`) |
| fondo blanco | `bg-panel` |
| texto gris | `text-muted` |
| borde decorativo / de control | `border-line` / `border-line-strong` |
| tinte de estado | `bg-danger-soft`, `bg-warning-soft`, `bg-success-soft`, `bg-info-soft`, `bg-accent-soft` |

---

## Fase 0 — Guardas y herramientas

### Task 0.1: Test «trinquete» de migración

**Files:**
- Create: `tests/tailwind-migracion.test.ts`

**Interfaces:**
- Produce: topes `usosClasePropia`, `ficherosConClasePropia`, `estilosEnLinea` y `lineasStylesCss`. Cada tarea posterior baja los que haya movido.

- [ ] **Step 1: Escribir el test** (los topes son las cifras medidas hoy; el test pasa de inmediato porque mide lo mismo)

```ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Trinquete de la migración a Tailwind: las cifras solo pueden BAJAR. Si falla por arriba, el cambio ha
// reintroducido CSS propio o estilos en línea; si falla porque has bajado algo, baja la cifra aquí para
// fijar el avance. Plan: docs/superpowers/plans/2026-11-01-migracion-tailwind-completa.md
const TOPE = {
  // Veces que un `className` usa una clase definida en app/styles.css.
  usosClasePropia: 1667,
  // Ficheros .tsx que usan alguna.
  ficherosConClasePropia: 113,
  // `style={{…}}` en línea: los dinámicos (anchos %, colores de datos) son legítimos; los literales no.
  estilosEnLinea: 372,
  // Tamaño de la hoja heredada.
  lineasStylesCss: 11344,
};

const RAIZ = process.cwd();
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), "utf-8");
function ficheros(dir: string, ext: string[]): string[] {
  return readdirSync(join(RAIZ, dir)).flatMap((n) => {
    const r = `${dir}/${n}`;
    if (statSync(join(RAIZ, r)).isDirectory()) return ficheros(r, ext);
    return ext.some((e) => n.endsWith(e)) ? [r] : [];
  });
}

const propias = new Set([...leer("app/styles.css").replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]));
const tsx = ficheros("app", [".tsx"]);

describe("migración a Tailwind: el trinquete solo baja", () => {
  it("usos de clase propia en className", () => {
    let usos = 0;
    const conClase = new Set<string>();
    for (const ruta of tsx) {
      for (const m of leer(ruta).matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g)) {
        const s = (m[1] ?? m[2] ?? m[3] ?? "").replace(/\$\{[^}]*\}/g, " ");
        for (const t of s.split(/\s+/)) if (t && propias.has(t) && !/[:[/]/.test(t)) { usos++; conClase.add(ruta); }
      }
    }
    expect(usos, "usa utilidades de Tailwind y la tabla de equivalencias del plan").toBeLessThanOrEqual(TOPE.usosClasePropia);
    expect(conClase.size).toBeLessThanOrEqual(TOPE.ficherosConClasePropia);
  });

  it("estilos en línea", () => {
    const n = tsx.reduce((a, r) => a + (leer(r).match(/style=\{\{/g)?.length ?? 0), 0);
    expect(n, "los literales (padding, display, colores) van a utilidades; solo los dinámicos se quedan").toBeLessThanOrEqual(TOPE.estilosEnLinea);
  });

  it("tamaño de styles.css", () => {
    expect(leer("app/styles.css").split("\n").length).toBeLessThanOrEqual(TOPE.lineasStylesCss);
  });
});
```

- [ ] **Step 2: Ejecutarlo**

```bash
npx vitest run tests/tailwind-migracion.test.ts
```
Esperado: 3 tests pasan (los topes son exactamente la medición actual).

- [ ] **Step 3: Comprobar que muerde**: añade temporalmente `style={{ padding: 8 }}` en cualquier TSX, ejecuta el test (debe fallar en «estilos en línea») y revierte.

- [ ] **Step 4: Commit** (cuando el usuario lo pida)

```bash
git add tests/tailwind-migracion.test.ts
git commit -m "test(migracion): el CSS propio y los estilos en línea ya no pueden volver a crecer"
```

---

### Task 0.2: Herramientas de migración (CSS huérfano y escáner de tema)

**Files:**
- Create: `scripts/css-huerfano.mjs`
- Create: `docs/qa/escaneo-tema.js`

**Interfaces:**
- Produce: `node scripts/css-huerfano.mjs` (reglas huérfanas), `--fichero=<tsx>` (clases propias, exclusivas y líneas liberables) y `--clase=<nombre>` (quién la usa); `window.__escaneoTema()` para pegar en la consola del navegador y obtener `{ blancos, contraste }`.

- [ ] **Step 1: Crear `scripts/css-huerfano.mjs`**

```js
// Lista las reglas de app/styles.css cuyas clases ya no usa ningún componente.
// Uso:  node scripts/css-huerfano.mjs            → resumen y rangos de líneas
//       node scripts/css-huerfano.mjs --clase=toolPanel   → quién usa esa clase
//
// Es un informe, no borra nada: una clase armada en tiempo de ejecución
// (`msg-${rol}`) parece huérfana aunque no lo sea, así que cada rango se revisa
// a mano antes de quitarlo.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = process.cwd();
const CSS = "app/styles.css";

function ficheros(dir, ext) {
  return readdirSync(join(RAIZ, dir)).flatMap((n) => {
    const r = `${dir}/${n}`;
    if (n === "node_modules" || n === ".next") return [];
    if (statSync(join(RAIZ, r)).isDirectory()) return ficheros(r, ext);
    return ext.some((e) => n.endsWith(e)) ? [r] : [];
  });
}

// Reglas planas con su rango de líneas. Las @media/@supports se recorren por dentro.
function reglas(css) {
  const out = [];
  const pila = [];
  let inicio = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "{") {
      pila.push({ sel: css.slice(inicio, i).trim(), pos: i });
      inicio = i + 1;
    } else if (c === "}") {
      const { sel, pos } = pila.pop();
      if (!sel.startsWith("@")) {
        out.push({ sel, desde: css.slice(0, pos).split("\n").length, hasta: css.slice(0, i).split("\n").length });
      }
      inicio = i + 1;
    } else if (c === ";" && pila.length === 0) {
      inicio = i + 1;
    }
  }
  return out;
}

// Los comentarios se vacían pero conservan sus saltos de línea: los rangos que se imprimen siguen siendo los reales.
const css = readFileSync(join(RAIZ, CSS), "utf-8").replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
const fuentes = [...ficheros("app", [".tsx", ".ts"]), ...ficheros("lib", [".ts", ".tsx"])];
const textos = Object.fromEntries(fuentes.map((f) => [f, readFileSync(join(RAIZ, f), "utf-8")]));

const arg = process.argv.find((a) => a.startsWith("--clase="));
if (arg) {
  const clase = arg.slice("--clase=".length);
  const re = new RegExp(`(?<![\\w-])${clase}(?![\\w-])`);
  const usan = fuentes.filter((f) => re.test(textos[f]));
  console.log(`${clase}: ${usan.length} fichero(s)\n${usan.join("\n")}`);
  process.exit(0);
}

const arg2 = process.argv.find((a) => a.startsWith("--fichero="));
if (arg2) {
  // Qué clases propias usa un componente, cuáles son solo suyas y cuánto CSS libera migrarlo.
  const fichero = arg2.slice("--fichero=".length);
  const propias = new Set([...css.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]));
  const suyas = new Set();
  for (const m of textos[fichero].matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g)) {
    const s = (m[1] ?? m[2] ?? m[3] ?? "").replace(/\$\{[^}]*\}/g, " ");
    for (const t of s.split(/\s+/)) if (t && propias.has(t) && !/[:[/]/.test(t)) suyas.add(t);
  }
  const otros = (c) => fuentes.filter((f) => f !== fichero && new RegExp(`(?<![\\w-])${c}(?![\\w-])`).test(textos[f]));
  const exclusivas = [...suyas].filter((c) => otros(c).length === 0);
  const compartidas = [...suyas].filter((c) => otros(c).length > 0);
  const liberadas = reglas(css).filter((r) => {
    const cl = [...r.sel.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]);
    return cl.length > 0 && cl.every((c) => exclusivas.includes(c));
  });
  const n = liberadas.reduce((a, r) => a + (r.hasta - r.desde + 1), 0);
  console.log(`${fichero}: ${suyas.size} clases propias · ${exclusivas.length} exclusivas · ${compartidas.length} compartidas`);
  console.log(`Migrarlo libera ${liberadas.length} reglas (${n} líneas) de ${CSS}`);
  console.log(`exclusivas:  ${exclusivas.join(" ")}`);
  console.log(`compartidas: ${compartidas.join(" ")}`);
  process.exit(0);
}

const usadas = new Set();
for (const t of Object.values(textos)) for (const m of t.matchAll(/[A-Za-z_][\w-]*/g)) usadas.add(m[0]);

const todas = reglas(css);
const huerfanas = todas.filter((r) => {
  const cl = [...r.sel.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]);
  return cl.length > 0 && cl.every((c) => !usadas.has(c));
});
const lineas = huerfanas.reduce((n, r) => n + (r.hasta - r.desde + 1), 0);
console.log(`${huerfanas.length} reglas huérfanas de ${todas.length} (${lineas} líneas de ${css.split("\n").length})`);
for (const r of huerfanas.slice(0, 400)) console.log(`${r.desde}-${r.hasta}  ${r.sel.replace(/\s+/g, " ").slice(0, 90)}`);
```

- [ ] **Step 2: Crear `docs/qa/escaneo-tema.js`** (se pega en `javascript_tool` con el tema oscuro puesto; devuelve los elementos con fondo casi blanco y el texto bajo 3,5:1 sobre su fondo real)

```js
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
```

- [ ] **Step 3: Probarlos**

```bash
node scripts/css-huerfano.mjs | head -3
node scripts/css-huerfano.mjs --clase=secondaryButton | head -1
```
Esperado: `123 reglas huérfanas de 1877 (657 líneas de 11344)` y `secondaryButton: 77 fichero(s)`.

- [ ] **Step 4: Commit** (cuando el usuario lo pida)

```bash
git add scripts/css-huerfano.mjs docs/qa/escaneo-tema.js
git commit -m "chore(migracion): herramientas para ver qué CSS ya no usa nadie y qué se queda blanco en oscuro"
```

---

### Task 0.3: Corregir el `CLAUDE.md` y podar `@source`

**Files:**
- Modify: `app/tailwind.css` (quitar las 74 líneas `@source`, dejar su explicación)
- Modify: `CLAUDE.md` (sección «Tailwind: activación acotada»)

**Interfaces:**
- Produce: un CSS generado idéntico y una guía que ya no manda a mantener una lista que no hace falta.

- [ ] **Step 1: Guardar el conjunto de utilidades actual**

```bash
npm run build
cat .next/static/chunks/*.css | grep -oE '\.[A-Za-z0-9_\\:\[\]/.%-]+' | sort -u > /tmp/utilidades-antes.txt
wc -l /tmp/utilidades-antes.txt
```

- [ ] **Step 2: Quitar las líneas `@source`**

```bash
grep -v '^@source' app/tailwind.css > /tmp/tailwind.css && cp /tmp/tailwind.css app/tailwind.css
```
Deja un comentario donde estaba la lista: «Tailwind detecta las fuentes solo (no usamos `source(none)`); no hace falta registrar cada componente».

- [ ] **Step 3: Reconstruir y comparar**

```bash
npm run build
cat .next/static/chunks/*.css | grep -oE '\.[A-Za-z0-9_\\:\[\]/.%-]+' | sort -u > /tmp/utilidades-despues.txt
diff /tmp/utilidades-antes.txt /tmp/utilidades-despues.txt && echo IGUAL
```
Esperado: `IGUAL`. Si hay diferencias, restaura `app/tailwind.css` (`git checkout app/tailwind.css`) y deja solo las entradas `@source` de los ficheros que aparezcan en el diff.

- [ ] **Step 4: Actualizar `CLAUDE.md`**: sustituir el punto «No hay escaneo automático…» por «Tailwind detecta las clases solo; no hay lista que mantener», y la línea de «Migrado hasta ahora» por el estado real (ver Task 6.3).

- [ ] **Step 5: Commit** (cuando el usuario lo pida)

```bash
git add app/tailwind.css CLAUDE.md
git commit -m "docs(tailwind): quitar la lista de @source que ya no hace falta y corregir la guía"
```

---

## Fase 1 — Retirar lo que sobra

### Task 1.1: Borrar componentes huérfanos y CSS muerto

**Files:**
- Delete: `app/components/semantic-search.tsx`, `app/components/lifecycle-map.tsx`, `app/components/contract-form.tsx`
- Modify: `app/styles.css` (rangos que imprime `node scripts/css-huerfano.mjs`)
- Modify: `docs/SDD-ACE.md` (líneas 307, 350 y 775 citan `semantic-search.tsx`)

**Interfaces:**
- Produce: ~1.130 líneas de TSX y las reglas que solo ellos usaban fuera del proyecto.

- [ ] **Step 1: Confirmar que siguen sin importadores**

```bash
grep -rnE "semantic-search|SemanticSearch\b|lifecycle-map|LifecycleMap|contract-form|ContractForm\b" app lib tests --include=*.ts --include=*.tsx | grep -v "^app/components/\(semantic-search\|lifecycle-map\|contract-form\).tsx"
```
Esperado: sin salida (solo `runSemanticSearch` de `normative-browser.tsx` puede aparecer: es otra cosa). Si aparece un importador, **no se borra**: se pasa a la Fase 3 como un componente más.

- [ ] **Step 2: Borrar**

```bash
git rm app/components/semantic-search.tsx app/components/lifecycle-map.tsx app/components/contract-form.tsx
```

- [ ] **Step 3: Retirar el CSS huérfano.** Ejecuta `node scripts/css-huerfano.mjs`. Para cada rango, comprueba que la clase no se arma en ejecución (`grep -rn "<raíz de la clase>" app lib`) y bórralo de abajo hacia arriba con `sed -i 'DESDE,HASTAd' app/styles.css`. Conserva cualquier regla cuyo comentario diga que la usa algo externo (p. ej. `.skipLink` si lo referencia el HTML de `layout.tsx` con otra grafía).

- [ ] **Step 4: Verificar**

```bash
npm run typecheck && npm run lint && npx vitest run tests/paleta-colores.test.ts tests/tailwind-migracion.test.ts && npm run build
```
Esperado: verde; el test de migración falla indicando cifras menores: bájalas (`lineasStylesCss`, `usosClasePropia`, `ficherosConClasePropia`).

- [ ] **Step 5: Comprobar a ojo** `/chat`, `/busqueda`, `/normas`, `/validar` en claro y oscuro: nada cambia.

- [ ] **Step 6: Commit** (cuando el usuario lo pida)

```bash
git add -A app docs tests
git commit -m "chore(limpieza): tres componentes sin uso y más de 600 líneas de CSS que nadie referenciaba"
```

---

## Fase 2 — Centro Jurídico (lo que ven las cuentas externas)

Orden por valor y riesgo: primero el que casi no comparte clases (búsqueda), después el chat, que es el mayor.

### Task 2.1: Búsqueda documental

**Tamaño:** M (1166 líneas de TSX · 45 clases propias, 41 exclusivas · libera 108 reglas / 108 líneas de `styles.css`)

**Files:**
- Modify: `app/components/document-search-workspace.tsx`
- Modify: `app/styles.css` (solo las reglas que el script marque como huérfanas tras migrar)
- Modify: `app/components/search-discovery.css (17 líneas; ya usa tokens, solo revisar)`
- Vista donde se comprueba: `/busqueda` — Cuenta externa: búsqueda por frase y por tema, filtros, resultados, asistente «Ayúdame a buscar».

**Interfaces:**
- Consume: la tabla de equivalencias y el procedimiento de arriba; `Button`/`buttonClasses`/`Card`/`Alert`/`EmptyState`/`Field` de `app/components/ui`.
- Produce: el componente sin ninguna clase propia exclusiva; las 4 compartidas se sustituyen por su equivalente (tabla) o se dejan si aún las usa otro fichero.

Clases exclusivas (se borran de `styles.css` al terminar): `documentMatchText documentResult documentResultMeta documentVersion documentSearchHint documentVersions documentResultTags documentWhy documentResultActions documentSecondaryActions documentMatches documentMatch documentMatchTop documentMatchActions documentPrimaryFilters documentSearchWorkspace documentSearchIntro documentSearchEyebrow documentSearchForm documentSearchModes documentSearchComposer documentLiteralChoice searchPublicationRange mobileFilterToggle documentSearchFilters mobileFilterHeader documentFilterGrid mobileFilterFooter documentActiveFilters documentCoverage documentSearchError documentSearchStatus documentSelection documentSearchResults documentResultsHeading documentResultOrdering documentSearchPending documentScopeNote documentSearchEmpty documentPagination` … y 1 más (`node scripts/css-huerfano.mjs --fichero=…` las da todas)

Clases compartidas con otros ficheros (se sustituyen aquí; su regla se borra en la Task 6.1 cuando nadie las use): `documentSelect secondaryButton primaryButton spin`

Solo comparte 4 clases: es el candidato más limpio y sirve para validar el procedimiento.

- [ ] **Step 1: Medir el punto de partida**

```bash
node scripts/css-huerfano.mjs --fichero=app/components/document-search-workspace.tsx
```
Esperado: `45 clases propias · 41 exclusivas · 4 compartidas`.

- [ ] **Step 2: Capturar el «antes»** en `/busqueda`: claro y oscuro, a 1280 px y a 375 px (`resize_window` con `preset: "mobile"`). En cada una ejecuta `docs/qa/escaneo-tema.js` y guarda el resultado; pega las capturas en la descripción del PR.

- [ ] **Step 3: Convertir.** Reemplaza cada clase propia del fichero por utilidades con la tabla de equivalencias (colores solo con tokens; el test de paleta lo exige). Si la raíz del componente no está dentro de un contenedor `.tw`, añade `tw` al elemento raíz de la página (Preflight no es global y sin `.tw` los botones y `box-sizing` salen sin reset).

- [ ] **Step 4: Retirar el CSS que ya nadie usa**

```bash
node scripts/css-huerfano.mjs | head -80
```
Para cada rango de `app/styles.css` que corresponda a una clase exclusiva de este fichero: comprueba que su raíz no se arma en tiempo de ejecución (`grep -rn "<raíz>" app lib`, por ejemplo `msg-` para `msg-${rol}`) y bórralo de abajo hacia arriba (`sed -i 'DESDE,HASTAd' app/styles.css`) para que los números de línea no se desplacen.

- [ ] **Step 5: Verificar**

```bash
npm run typecheck && npm run lint
npx vitest run tests/paleta-colores.test.ts tests/tailwind-migracion.test.ts
```
Esperado: sin errores; el test de migración **falla** si algún tope no se ha bajado todavía (baja la cifra en `tests/tailwind-migracion.test.ts` al valor nuevo que imprime el fallo, nunca la subas). Después `npm run build`.

Registra el componente en la auditoría del 31/10: añade `'app/components/document-search-workspace.tsx'` al array `migrated` de `scripts/audit-interface-styles.mjs` y ejecuta

```bash
node scripts/audit-interface-styles.mjs --check
```
Esperado: `"violations":[]`. Si lista una violación, el componente aún tiene un `style={…}` estático o importa un CSS: conviértelo (solo los estilos dinámicos pueden quedarse, y en ese caso el componente no entra en `migrated` hasta que no quede ninguno).

- [ ] **Step 6: Capturar el «después»** con el mismo procedimiento del Step 2 y compara: misma maquetación, sin elementos blancos en oscuro, sin texto bajo 3,5:1 y sin desbordamiento horizontal a 375 px.

- [ ] **Step 7: Commit** (solo cuando el usuario lo pida)

```bash
git add app/components/document-search-workspace.tsx app/styles.css tests/tailwind-migracion.test.ts scripts/audit-interface-styles.mjs
git commit -m "refactor(busqueda): la búsqueda documental pasa a Tailwind y no se queda a medias en oscuro"
```

---


### Task 2.2: Chat jurídico

**Tamaño:** L (1812 líneas de TSX · 105 clases propias, 76 exclusivas · libera 259 reglas / 1055 líneas de `styles.css`)

**Files:**
- Modify: `app/components/legal-chat.tsx`
- Modify: `app/styles.css` (solo las reglas que el script marque como huérfanas tras migrar)
- Modify: `app/components/legal-workspace.css (las reglas `.legalWorkspace …` de las clases de este fichero)`
- Vista donde se comprueba: `/chat` — Cuenta externa: conversación, fuentes, compositor, «Personalizar respuesta», adjuntos, estados de error y de cuota.

**Interfaces:**
- Consume: la tabla de equivalencias y el procedimiento de arriba; `Button`/`buttonClasses`/`Card`/`Alert`/`EmptyState`/`Field` de `app/components/ui`.
- Produce: el componente sin ninguna clase propia exclusiva; las 29 compartidas se sustituyen por su equivalente (tabla) o se dejan si aún las usa otro fichero.

Clases exclusivas (se borran de `styles.css` al terminar): `sourceExactBox chatTechnicalDetails sourceQuoteLabel sourceQuoteWeak sourceFullExcerpt answerTableWrap answerTable answerNumbered coverageGrid answerUseCard answerUseWarnings chatPlainEvidence answerUseActions msgEvidence msgEvidenceCount msgEvidenceMeta confidenceMeaning precisionLine evidenceCardActions chatConversation chatEmptyRedesign chatEmptyIntro chatEmptyIcon chatEmptyExamples exampleCards msgRow msgAvatar msgBubble msgBubbleTop chatAiLabel loadingInline msgBubbleBody streamCursor msgCitationWarning msgError msgSourceChips sourceChip responseActions responseActionsHint chatMoreActions` … y 36 más (`node scripts/css-huerfano.mjs --fichero=…` las da todas)

Clases compartidas con otros ficheros (se sustituyen aquí; su regla se borra en la Task 6.1 cuando nadie las use): `sourceRefButton sourceRefMissing sourceModalReference sourceModalReferenceHeader sourceModalMeta sourceQuote sourceActions secondaryButton compactButton answerBullet answerContent reviewApplicability warningList evidenceCard sourceLink legalWorkspacePanel legalWorkspaceHistory responseActionButton compactAction formMessage errorText eyebrow styleSelectors styleSelectorsTitle primaryButton dialogOverlay sourceModal sourceModalBody dialogActions`

Es el componente más grande (1.800 líneas). Divide el Step 3 en bloques y comprueba la pantalla entre bloques: cabecera y modos → conversación y burbujas → fuentes y normas → compositor y adjuntos → estados vacíos y de error. Las reglas `@apply` de `legal-workspace.css` de cada bloque se borran junto con las de `styles.css`.

- [ ] **Step 1: Medir el punto de partida**

```bash
node scripts/css-huerfano.mjs --fichero=app/components/legal-chat.tsx
```
Esperado: `105 clases propias · 76 exclusivas · 29 compartidas`.

- [ ] **Step 2: Capturar el «antes»** en `/chat`: claro y oscuro, a 1280 px y a 375 px (`resize_window` con `preset: "mobile"`). En cada una ejecuta `docs/qa/escaneo-tema.js` y guarda el resultado; pega las capturas en la descripción del PR.

- [ ] **Step 3: Convertir.** Reemplaza cada clase propia del fichero por utilidades con la tabla de equivalencias (colores solo con tokens; el test de paleta lo exige). Si la raíz del componente no está dentro de un contenedor `.tw`, añade `tw` al elemento raíz de la página (Preflight no es global y sin `.tw` los botones y `box-sizing` salen sin reset).

- [ ] **Step 4: Retirar el CSS que ya nadie usa**

```bash
node scripts/css-huerfano.mjs | head -80
```
Para cada rango de `app/styles.css` que corresponda a una clase exclusiva de este fichero: comprueba que su raíz no se arma en tiempo de ejecución (`grep -rn "<raíz>" app lib`, por ejemplo `msg-` para `msg-${rol}`) y bórralo de abajo hacia arriba (`sed -i 'DESDE,HASTAd' app/styles.css`) para que los números de línea no se desplacen.

- [ ] **Step 5: Verificar**

```bash
npm run typecheck && npm run lint
npx vitest run tests/paleta-colores.test.ts tests/tailwind-migracion.test.ts
```
Esperado: sin errores; el test de migración **falla** si algún tope no se ha bajado todavía (baja la cifra en `tests/tailwind-migracion.test.ts` al valor nuevo que imprime el fallo, nunca la subas). Después `npm run build`.

Registra el componente en la auditoría del 31/10: añade `'app/components/legal-chat.tsx'` al array `migrated` de `scripts/audit-interface-styles.mjs` y ejecuta

```bash
node scripts/audit-interface-styles.mjs --check
```
Esperado: `"violations":[]`. Si lista una violación, el componente aún tiene un `style={…}` estático o importa un CSS: conviértelo (solo los estilos dinámicos pueden quedarse, y en ese caso el componente no entra en `migrated` hasta que no quede ninguno).

- [ ] **Step 6: Capturar el «después»** con el mismo procedimiento del Step 2 y compara: misma maquetación, sin elementos blancos en oscuro, sin texto bajo 3,5:1 y sin desbordamiento horizontal a 375 px.

- [ ] **Step 7: Commit** (solo cuando el usuario lo pida)

```bash
git add app/components/legal-chat.tsx app/styles.css tests/tailwind-migracion.test.ts scripts/audit-interface-styles.mjs
git commit -m "refactor(chat): el chat jurídico pasa a Tailwind y sigue el tema claro y oscuro"
```

---


### Task 2.3: Normativa (navegador de normas)

**Tamaño:** L (1089 líneas de TSX · 44 clases propias, 25 exclusivas · libera 50 reglas / 285 líneas de `styles.css`)

**Files:**
- Modify: `app/components/normative-browser.tsx`
- Modify: `app/styles.css` (solo las reglas que el script marque como huérfanas tras migrar)
- Modify: `app/components/normative-browser.css (45 líneas) y app/components/norm-article-reading.css (55 líneas)`
- Vista donde se comprueba: `/normas` — Cuenta externa: pestañas Normas, Criterios y decisiones, Bases y orientación; filtros, paginación y lector de articulado.

**Interfaces:**
- Consume: la tabla de equivalencias y el procedimiento de arriba; `Button`/`buttonClasses`/`Card`/`Alert`/`EmptyState`/`Field` de `app/components/ui`.
- Produce: el componente sin ninguna clase propia exclusiva; las 19 compartidas se sustituyen por su equivalente (tabla) o se dejan si aún las usa otro fichero.

Clases exclusivas (se borran de `styles.css` al terminar): `normBrowser normCategoryTabs normFilters normCardTags normDetailHeader normAmends normQualityStrip versionPanel versionList versionChip normJurisprudence articleLayout articleNavCol articleSearch semanticInNorm semanticNormResults articleReader articleReaderHeader articleSection articleBadges legalReadingPanel concordanciaPanel concordanciaGroup concordanciaList concordanciaChip`

Clases compartidas con otros ficheros (se sustituyen aquí; su regla se borra en la Task 6.1 cuando nadie las use): `toolPanel sourceTabs secondaryButton formMessage errorText normGrid normList emptyState normCard normCardMeta normTag normDetail eyebrow primaryButton compactButton vigenteToggle resolved external sourceActions`

Casi todo el componente usa clases propias (1 de Tailwind frente a 75). El lector de articulado y sus vistas comparten estilos con `norm-article-reading.css`: migra ambos juntos.

- [ ] **Step 1: Medir el punto de partida**

```bash
node scripts/css-huerfano.mjs --fichero=app/components/normative-browser.tsx
```
Esperado: `44 clases propias · 25 exclusivas · 19 compartidas`.

- [ ] **Step 2: Capturar el «antes»** en `/normas`: claro y oscuro, a 1280 px y a 375 px (`resize_window` con `preset: "mobile"`). En cada una ejecuta `docs/qa/escaneo-tema.js` y guarda el resultado; pega las capturas en la descripción del PR.

- [ ] **Step 3: Convertir.** Reemplaza cada clase propia del fichero por utilidades con la tabla de equivalencias (colores solo con tokens; el test de paleta lo exige). Si la raíz del componente no está dentro de un contenedor `.tw`, añade `tw` al elemento raíz de la página (Preflight no es global y sin `.tw` los botones y `box-sizing` salen sin reset).

- [ ] **Step 4: Retirar el CSS que ya nadie usa**

```bash
node scripts/css-huerfano.mjs | head -80
```
Para cada rango de `app/styles.css` que corresponda a una clase exclusiva de este fichero: comprueba que su raíz no se arma en tiempo de ejecución (`grep -rn "<raíz>" app lib`, por ejemplo `msg-` para `msg-${rol}`) y bórralo de abajo hacia arriba (`sed -i 'DESDE,HASTAd' app/styles.css`) para que los números de línea no se desplacen.

- [ ] **Step 5: Verificar**

```bash
npm run typecheck && npm run lint
npx vitest run tests/paleta-colores.test.ts tests/tailwind-migracion.test.ts
```
Esperado: sin errores; el test de migración **falla** si algún tope no se ha bajado todavía (baja la cifra en `tests/tailwind-migracion.test.ts` al valor nuevo que imprime el fallo, nunca la subas). Después `npm run build`.

Registra el componente en la auditoría del 31/10: añade `'app/components/normative-browser.tsx'` al array `migrated` de `scripts/audit-interface-styles.mjs` y ejecuta

```bash
node scripts/audit-interface-styles.mjs --check
```
Esperado: `"violations":[]`. Si lista una violación, el componente aún tiene un `style={…}` estático o importa un CSS: conviértelo (solo los estilos dinámicos pueden quedarse, y en ese caso el componente no entra en `migrated` hasta que no quede ninguno).

- [ ] **Step 6: Capturar el «después»** con el mismo procedimiento del Step 2 y compara: misma maquetación, sin elementos blancos en oscuro, sin texto bajo 3,5:1 y sin desbordamiento horizontal a 375 px.

- [ ] **Step 7: Commit** (solo cuando el usuario lo pida)

```bash
git add app/components/normative-browser.tsx app/styles.css tests/tailwind-migracion.test.ts scripts/audit-interface-styles.mjs
git commit -m "refactor(normas): el navegador de normas pasa a Tailwind y sigue el tema claro y oscuro"
```

---


### Task 2.4: Comparar normas

**Tamaño:** S (581 líneas de TSX · 34 clases propias, 4 exclusivas · libera 7 reglas / 36 líneas de `styles.css`)

**Files:**
- Modify: `app/components/normative-compare.tsx`
- Modify: `app/styles.css` (solo las reglas que el script marque como huérfanas tras migrar)
- Vista donde se comprueba: `/comparar` — Comparación lado a lado de dos normas.

**Interfaces:**
- Consume: la tabla de equivalencias y el procedimiento de arriba; `Button`/`buttonClasses`/`Card`/`Alert`/`EmptyState`/`Field` de `app/components/ui`.
- Produce: el componente sin ninguna clase propia exclusiva; las 30 compartidas se sustituyen por su equivalente (tabla) o se dejan si aún las usa otro fichero.

Clases exclusivas (se borran de `styles.css` al terminar): `compareSide compareSideHeader evidenceMini compareColumns`

Clases compartidas con otros ficheros (se sustituyen aquí; su regla se borra en la Task 6.1 cuando nadie las use): `sourceRefButton sourceRefMissing answerContent answerBullet sideMuted sourceLink toolPanel toolPanelHeader eyebrow toolBody promptInput exampleQuestions formActions secondaryButton primaryButton formMessage errorText emptyState documentList listHeader warningList dialogOverlay sourceModal sourceModalBody sourceModalReference sourceModalReferenceHeader sourceModalMeta sourceQuote compactButton dialogActions`

Solo 4 clases exclusivas; casi todo es compartido, así que el valor está en quitar las compartidas de este fichero.

- [ ] **Step 1: Medir el punto de partida**

```bash
node scripts/css-huerfano.mjs --fichero=app/components/normative-compare.tsx
```
Esperado: `34 clases propias · 4 exclusivas · 30 compartidas`.

- [ ] **Step 2: Capturar el «antes»** en `/comparar`: claro y oscuro, a 1280 px y a 375 px (`resize_window` con `preset: "mobile"`). En cada una ejecuta `docs/qa/escaneo-tema.js` y guarda el resultado; pega las capturas en la descripción del PR.

- [ ] **Step 3: Convertir.** Reemplaza cada clase propia del fichero por utilidades con la tabla de equivalencias (colores solo con tokens; el test de paleta lo exige). Si la raíz del componente no está dentro de un contenedor `.tw`, añade `tw` al elemento raíz de la página (Preflight no es global y sin `.tw` los botones y `box-sizing` salen sin reset).

- [ ] **Step 4: Retirar el CSS que ya nadie usa**

```bash
node scripts/css-huerfano.mjs | head -80
```
Para cada rango de `app/styles.css` que corresponda a una clase exclusiva de este fichero: comprueba que su raíz no se arma en tiempo de ejecución (`grep -rn "<raíz>" app lib`, por ejemplo `msg-` para `msg-${rol}`) y bórralo de abajo hacia arriba (`sed -i 'DESDE,HASTAd' app/styles.css`) para que los números de línea no se desplacen.

- [ ] **Step 5: Verificar**

```bash
npm run typecheck && npm run lint
npx vitest run tests/paleta-colores.test.ts tests/tailwind-migracion.test.ts
```
Esperado: sin errores; el test de migración **falla** si algún tope no se ha bajado todavía (baja la cifra en `tests/tailwind-migracion.test.ts` al valor nuevo que imprime el fallo, nunca la subas). Después `npm run build`.

Registra el componente en la auditoría del 31/10: añade `'app/components/normative-compare.tsx'` al array `migrated` de `scripts/audit-interface-styles.mjs` y ejecuta

```bash
node scripts/audit-interface-styles.mjs --check
```
Esperado: `"violations":[]`. Si lista una violación, el componente aún tiene un `style={…}` estático o importa un CSS: conviértelo (solo los estilos dinámicos pueden quedarse, y en ese caso el componente no entra en `migrated` hasta que no quede ninguno).

- [ ] **Step 6: Capturar el «después»** con el mismo procedimiento del Step 2 y compara: misma maquetación, sin elementos blancos en oscuro, sin texto bajo 3,5:1 y sin desbordamiento horizontal a 375 px.

- [ ] **Step 7: Commit** (solo cuando el usuario lo pida)

```bash
git add app/components/normative-compare.tsx app/styles.css tests/tailwind-migracion.test.ts scripts/audit-interface-styles.mjs
git commit -m "refactor(comparar): la comparación de normas pasa a Tailwind"
```

---


### Task 2.5: Subida de documentos

**Tamaño:** M (1229 líneas de TSX · 44 clases propias, 18 exclusivas · libera 41 reglas / 234 líneas de `styles.css`)

**Files:**
- Modify: `app/components/document-upload.tsx`
- Modify: `app/styles.css` (solo las reglas que el script marque como huérfanas tras migrar)
- Vista donde se comprueba: `/documentos` — Subir un PDF, ver el estado de indexación, lista de documentos y acciones.

**Interfaces:**
- Consume: la tabla de equivalencias y el procedimiento de arriba; `Button`/`buttonClasses`/`Card`/`Alert`/`EmptyState`/`Field` de `app/components/ui`.
- Produce: el componente sin ninguna clase propia exclusiva; las 26 compartidas se sustituyen por su equivalente (tabla) o se dejan si aún las usa otro fichero.

Clases exclusivas (se borran de `styles.css` al terminar): `documentStats uploadFields fieldHint checkboxField uploadTypeNote amendmentBox corpusReadiness corpusChecklist corpusCheckItem corpusWarnings procedureQualityGrid corpusMissingList documentToolbar documentFilters bulkDeleteBox dangerButton documentQuality documentAmends`

Clases compartidas con otros ficheros (se sustituyen aquí; su regla se borra en la Task 6.1 cuando nadie las use): `uploadPanel panelHeader eyebrow analysisHelpBox sourceActions secondaryButton compactButton documentForm documentSectionTitle filePicker formGrid fullSpan formActions primaryButton formMessage ruleItem sourceMetaGrid emptyState documentList documentItem documentIcon documentError documentActions dialogOverlay dialogContent dialogActions`

- [ ] **Step 1: Medir el punto de partida**

```bash
node scripts/css-huerfano.mjs --fichero=app/components/document-upload.tsx
```
Esperado: `44 clases propias · 18 exclusivas · 26 compartidas`.

- [ ] **Step 2: Capturar el «antes»** en `/documentos`: claro y oscuro, a 1280 px y a 375 px (`resize_window` con `preset: "mobile"`). En cada una ejecuta `docs/qa/escaneo-tema.js` y guarda el resultado; pega las capturas en la descripción del PR.

- [ ] **Step 3: Convertir.** Reemplaza cada clase propia del fichero por utilidades con la tabla de equivalencias (colores solo con tokens; el test de paleta lo exige). Si la raíz del componente no está dentro de un contenedor `.tw`, añade `tw` al elemento raíz de la página (Preflight no es global y sin `.tw` los botones y `box-sizing` salen sin reset).

- [ ] **Step 4: Retirar el CSS que ya nadie usa**

```bash
node scripts/css-huerfano.mjs | head -80
```
Para cada rango de `app/styles.css` que corresponda a una clase exclusiva de este fichero: comprueba que su raíz no se arma en tiempo de ejecución (`grep -rn "<raíz>" app lib`, por ejemplo `msg-` para `msg-${rol}`) y bórralo de abajo hacia arriba (`sed -i 'DESDE,HASTAd' app/styles.css`) para que los números de línea no se desplacen.

- [ ] **Step 5: Verificar**

```bash
npm run typecheck && npm run lint
npx vitest run tests/paleta-colores.test.ts tests/tailwind-migracion.test.ts
```
Esperado: sin errores; el test de migración **falla** si algún tope no se ha bajado todavía (baja la cifra en `tests/tailwind-migracion.test.ts` al valor nuevo que imprime el fallo, nunca la subas). Después `npm run build`.

Registra el componente en la auditoría del 31/10: añade `'app/components/document-upload.tsx'` al array `migrated` de `scripts/audit-interface-styles.mjs` y ejecuta

```bash
node scripts/audit-interface-styles.mjs --check
```
Esperado: `"violations":[]`. Si lista una violación, el componente aún tiene un `style={…}` estático o importa un CSS: conviértelo (solo los estilos dinámicos pueden quedarse, y en ese caso el componente no entra en `migrated` hasta que no quede ninguno).

- [ ] **Step 6: Capturar el «después»** con el mismo procedimiento del Step 2 y compara: misma maquetación, sin elementos blancos en oscuro, sin texto bajo 3,5:1 y sin desbordamiento horizontal a 375 px.

- [ ] **Step 7: Commit** (solo cuando el usuario lo pida)

```bash
git add app/components/document-upload.tsx app/styles.css tests/tailwind-migracion.test.ts scripts/audit-interface-styles.mjs
git commit -m "refactor(documentos): la subida y lista de documentos pasa a Tailwind y sigue el tema oscuro"
```

---


### Task 2.6: Retirar `legal-workspace.css`

**Files:**
- Delete: `app/components/legal-workspace.css` (cuando quede vacío)
- Modify: el `import` de ese CSS (`grep -rn "legal-workspace.css" app`) y la clase `legalWorkspace` de los `<section>` de `app/chat/page.tsx`, `app/busqueda/page.tsx`, `app/normas/page.tsx` y `app/comparar/page.tsx`

- [ ] **Step 1: Ver qué queda**

```bash
grep -cE "legalWorkspace" app/components/legal-workspace.css
grep -rn "legal-workspace.css" app
```
Esperado: 0 reglas (las quitaron las Tasks 2.1–2.5). Si queda alguna, pertenece a un componente de la fase que no se migró: termina esa tarea antes.

- [ ] **Step 2: Borrar el fichero y sus `import`**, y quitar la clase `legalWorkspace` de los cuatro `<section>` de página (ya no estiliza nada).

- [ ] **Step 3: Verificar** `npm run typecheck && npm run lint && npm run build` y revisar las cuatro rutas en claro y oscuro.

- [ ] **Step 4: Commit** (cuando el usuario lo pida)

```bash
git add -A app
git commit -m "refactor(centro-juridico): se retira la capa de compatibilidad y las cuatro pantallas usan Tailwind directo"
```

---

## Fase 3 — Herramientas de análisis

### Task 3.1: Validador de procedimientos

**Tamaño:** M (955 líneas de TSX · 33 clases propias, 16 exclusivas · libera 56 reglas / 337 líneas de `styles.css`)

**Files:**
- Modify: `app/components/procedure-validator.tsx`
- Modify: `app/styles.css` (solo las reglas que el script marque como huérfanas tras migrar)
- Vista donde se comprueba: `/validar` — Formulario de validación, reglas, resultado y banner.

**Interfaces:**
- Consume: la tabla de equivalencias y el procedimiento de arriba; `Button`/`buttonClasses`/`Card`/`Alert`/`EmptyState`/`Field` de `app/components/ui`.
- Produce: el componente sin ninguna clase propia exclusiva; las 17 compartidas se sustituyen por su equivalente (tabla) o se dejan si aún las usa otro fichero.

Clases exclusivas (se borran de `styles.css` al terminar): `validatorLayout validatorForm validatorSteps validationReadiness validatorAssistPanel validatorSectionTitle procedurePresetGrid procedurePresetCard requiredChecklist validatorEmptyGuide validatorResult decisionGrid validationBanner sourcePanel validatorWide corpusGrid`

Clases compartidas con otros ficheros (se sustituyen aquí; su regla se borra en la Task 6.1 cuando nadie las use): `toolPanel toolPanelHeader eyebrow formGrid formActions secondaryButton primaryButton evalError formMessage successText sourceCoverage ruleList ruleItem sourceCard sourceActions compactButton criticalSearchList`

Es de las cabeceras de `styles.css` que más líneas libera (337).

- [ ] **Step 1: Medir el punto de partida**

```bash
node scripts/css-huerfano.mjs --fichero=app/components/procedure-validator.tsx
```
Esperado: `33 clases propias · 16 exclusivas · 17 compartidas`.

- [ ] **Step 2: Capturar el «antes»** en `/validar`: claro y oscuro, a 1280 px y a 375 px (`resize_window` con `preset: "mobile"`). En cada una ejecuta `docs/qa/escaneo-tema.js` y guarda el resultado; pega las capturas en la descripción del PR.

- [ ] **Step 3: Convertir.** Reemplaza cada clase propia del fichero por utilidades con la tabla de equivalencias (colores solo con tokens; el test de paleta lo exige). Si la raíz del componente no está dentro de un contenedor `.tw`, añade `tw` al elemento raíz de la página (Preflight no es global y sin `.tw` los botones y `box-sizing` salen sin reset).

- [ ] **Step 4: Retirar el CSS que ya nadie usa**

```bash
node scripts/css-huerfano.mjs | head -80
```
Para cada rango de `app/styles.css` que corresponda a una clase exclusiva de este fichero: comprueba que su raíz no se arma en tiempo de ejecución (`grep -rn "<raíz>" app lib`, por ejemplo `msg-` para `msg-${rol}`) y bórralo de abajo hacia arriba (`sed -i 'DESDE,HASTAd' app/styles.css`) para que los números de línea no se desplacen.

- [ ] **Step 5: Verificar**

```bash
npm run typecheck && npm run lint
npx vitest run tests/paleta-colores.test.ts tests/tailwind-migracion.test.ts
```
Esperado: sin errores; el test de migración **falla** si algún tope no se ha bajado todavía (baja la cifra en `tests/tailwind-migracion.test.ts` al valor nuevo que imprime el fallo, nunca la subas). Después `npm run build`.

Registra el componente en la auditoría del 31/10: añade `'app/components/procedure-validator.tsx'` al array `migrated` de `scripts/audit-interface-styles.mjs` y ejecuta

```bash
node scripts/audit-interface-styles.mjs --check
```
Esperado: `"violations":[]`. Si lista una violación, el componente aún tiene un `style={…}` estático o importa un CSS: conviértelo (solo los estilos dinámicos pueden quedarse, y en ese caso el componente no entra en `migrated` hasta que no quede ninguno).

- [ ] **Step 6: Capturar el «después»** con el mismo procedimiento del Step 2 y compara: misma maquetación, sin elementos blancos en oscuro, sin texto bajo 3,5:1 y sin desbordamiento horizontal a 375 px.

- [ ] **Step 7: Commit** (solo cuando el usuario lo pida)

```bash
git add app/components/procedure-validator.tsx app/styles.css tests/tailwind-migracion.test.ts scripts/audit-interface-styles.mjs
git commit -m "refactor(validar): el validador de procedimientos pasa a Tailwind y sigue el tema oscuro"
```

---


### Task 3.2: Analizador de documentos

**Tamaño:** M (638 líneas de TSX · 36 clases propias, 11 exclusivas · libera 24 reglas / 142 líneas de `styles.css`)

**Files:**
- Modify: `app/components/document-analyzer.tsx`
- Modify: `app/styles.css` (solo las reglas que el script marque como huérfanas tras migrar)
- Vista donde se comprueba: `/analizar` — Subir/seleccionar un documento y ver el análisis.

**Interfaces:**
- Consume: la tabla de equivalencias y el procedimiento de arriba; `Button`/`buttonClasses`/`Card`/`Alert`/`EmptyState`/`Field` de `app/components/ui`.
- Produce: el componente sin ninguna clase propia exclusiva; las 25 compartidas se sustituyen por su equivalente (tabla) o se dejan si aún las usa otro fichero.

Clases exclusivas (se borran de `styles.css` al terminar): `analysisWorkspace analyzerForm analysisModeGrid uploadField inlineCheck analysisReport analysisSection analysisList clauseItem analysisDisclaimer analyzerHistory`

Clases compartidas con otros ficheros (se sustituyen aquí; su regla se borra en la Task 6.1 cuando nadie las use): `toolPanel toolPanelHeader eyebrow toolBody formGrid promptInput analysisHelpBox formActions primaryButton secondaryButton formMessage errorText successText evidenceSummary evidenceSummaryHeader sourceCoverage clauseList ruleList ruleItem compactButton documentList sourceItem sourceItemHeader sourceMetaGrid sourceActions`

- [ ] **Step 1: Medir el punto de partida**

```bash
node scripts/css-huerfano.mjs --fichero=app/components/document-analyzer.tsx
```
Esperado: `36 clases propias · 11 exclusivas · 25 compartidas`.

- [ ] **Step 2: Capturar el «antes»** en `/analizar`: claro y oscuro, a 1280 px y a 375 px (`resize_window` con `preset: "mobile"`). En cada una ejecuta `docs/qa/escaneo-tema.js` y guarda el resultado; pega las capturas en la descripción del PR.

- [ ] **Step 3: Convertir.** Reemplaza cada clase propia del fichero por utilidades con la tabla de equivalencias (colores solo con tokens; el test de paleta lo exige). Si la raíz del componente no está dentro de un contenedor `.tw`, añade `tw` al elemento raíz de la página (Preflight no es global y sin `.tw` los botones y `box-sizing` salen sin reset).

- [ ] **Step 4: Retirar el CSS que ya nadie usa**

```bash
node scripts/css-huerfano.mjs | head -80
```
Para cada rango de `app/styles.css` que corresponda a una clase exclusiva de este fichero: comprueba que su raíz no se arma en tiempo de ejecución (`grep -rn "<raíz>" app lib`, por ejemplo `msg-` para `msg-${rol}`) y bórralo de abajo hacia arriba (`sed -i 'DESDE,HASTAd' app/styles.css`) para que los números de línea no se desplacen.

- [ ] **Step 5: Verificar**

```bash
npm run typecheck && npm run lint
npx vitest run tests/paleta-colores.test.ts tests/tailwind-migracion.test.ts
```
Esperado: sin errores; el test de migración **falla** si algún tope no se ha bajado todavía (baja la cifra en `tests/tailwind-migracion.test.ts` al valor nuevo que imprime el fallo, nunca la subas). Después `npm run build`.

Registra el componente en la auditoría del 31/10: añade `'app/components/document-analyzer.tsx'` al array `migrated` de `scripts/audit-interface-styles.mjs` y ejecuta

```bash
node scripts/audit-interface-styles.mjs --check
```
Esperado: `"violations":[]`. Si lista una violación, el componente aún tiene un `style={…}` estático o importa un CSS: conviértelo (solo los estilos dinámicos pueden quedarse, y en ese caso el componente no entra en `migrated` hasta que no quede ninguno).

- [ ] **Step 6: Capturar el «después»** con el mismo procedimiento del Step 2 y compara: misma maquetación, sin elementos blancos en oscuro, sin texto bajo 3,5:1 y sin desbordamiento horizontal a 375 px.

- [ ] **Step 7: Commit** (solo cuando el usuario lo pida)

```bash
git add app/components/document-analyzer.tsx app/styles.css tests/tailwind-migracion.test.ts scripts/audit-interface-styles.mjs
git commit -m "refactor(analizar): el analizador de documentos pasa a Tailwind y sigue el tema oscuro"
```

---


### Task 3.3: Métricas

**Tamaño:** S (456 líneas de TSX · 39 clases propias, 12 exclusivas · libera 13 reglas / 63 líneas de `styles.css`)

**Files:**
- Modify: `app/components/metrics-dashboard.tsx`
- Modify: `app/styles.css` (solo las reglas que el script marque como huérfanas tras migrar)
- Vista donde se comprueba: `/metricas` — Tarjetas y tablas de uso. Aquí los gráficos deben usar `chart-1…6`.

**Interfaces:**
- Consume: la tabla de equivalencias y el procedimiento de arriba; `Button`/`buttonClasses`/`Card`/`Alert`/`EmptyState`/`Field` de `app/components/ui`.
- Produce: el componente sin ninguna clase propia exclusiva; las 27 compartidas se sustituyen por su equivalente (tabla) o se dejan si aún las usa otro fichero.

Clases exclusivas (se borran de `styles.css` al terminar): `statHint metricActions indexPipeline pipePill pipeUploaded pipeProcessing pipeIndexed pipeError pipeStuck metricMessage operationalVerify verifyGrid`

Clases compartidas con otros ficheros (se sustituyen aquí; su regla se borra en la Task 6.1 cuando nadie las use): `ruleList ruleItem emptyState evalLayout evalStats statCard statLabel toolPanel toolPanelHeader eyebrow secondaryButton compactButton primaryButton evalError sourceCoverage sourceMetaGrid evidenceCard criticalSearchList sourceCard evalGrid documentList evalResult auditList auditRow auditAction auditMeta auditTime`

Si hay colores de series en línea, sustitúyelos por los tokens `--chart-1…6` (`bg-chart-1`, `fill-chart-2`…).

- [ ] **Step 1: Medir el punto de partida**

```bash
node scripts/css-huerfano.mjs --fichero=app/components/metrics-dashboard.tsx
```
Esperado: `39 clases propias · 12 exclusivas · 27 compartidas`.

- [ ] **Step 2: Capturar el «antes»** en `/metricas`: claro y oscuro, a 1280 px y a 375 px (`resize_window` con `preset: "mobile"`). En cada una ejecuta `docs/qa/escaneo-tema.js` y guarda el resultado; pega las capturas en la descripción del PR.

- [ ] **Step 3: Convertir.** Reemplaza cada clase propia del fichero por utilidades con la tabla de equivalencias (colores solo con tokens; el test de paleta lo exige). Si la raíz del componente no está dentro de un contenedor `.tw`, añade `tw` al elemento raíz de la página (Preflight no es global y sin `.tw` los botones y `box-sizing` salen sin reset).

- [ ] **Step 4: Retirar el CSS que ya nadie usa**

```bash
node scripts/css-huerfano.mjs | head -80
```
Para cada rango de `app/styles.css` que corresponda a una clase exclusiva de este fichero: comprueba que su raíz no se arma en tiempo de ejecución (`grep -rn "<raíz>" app lib`, por ejemplo `msg-` para `msg-${rol}`) y bórralo de abajo hacia arriba (`sed -i 'DESDE,HASTAd' app/styles.css`) para que los números de línea no se desplacen.

- [ ] **Step 5: Verificar**

```bash
npm run typecheck && npm run lint
npx vitest run tests/paleta-colores.test.ts tests/tailwind-migracion.test.ts
```
Esperado: sin errores; el test de migración **falla** si algún tope no se ha bajado todavía (baja la cifra en `tests/tailwind-migracion.test.ts` al valor nuevo que imprime el fallo, nunca la subas). Después `npm run build`.

Registra el componente en la auditoría del 31/10: añade `'app/components/metrics-dashboard.tsx'` al array `migrated` de `scripts/audit-interface-styles.mjs` y ejecuta

```bash
node scripts/audit-interface-styles.mjs --check
```
Esperado: `"violations":[]`. Si lista una violación, el componente aún tiene un `style={…}` estático o importa un CSS: conviértelo (solo los estilos dinámicos pueden quedarse, y en ese caso el componente no entra en `migrated` hasta que no quede ninguno).

- [ ] **Step 6: Capturar el «después»** con el mismo procedimiento del Step 2 y compara: misma maquetación, sin elementos blancos en oscuro, sin texto bajo 3,5:1 y sin desbordamiento horizontal a 375 px.

- [ ] **Step 7: Commit** (solo cuando el usuario lo pida)

```bash
git add app/components/metrics-dashboard.tsx app/styles.css tests/tailwind-migracion.test.ts scripts/audit-interface-styles.mjs
git commit -m "refactor(metricas): el panel de métricas pasa a Tailwind y usa la paleta de gráficos"
```

---


### Task 3.4: Evaluación

**Tamaño:** S (400 líneas de TSX · 27 clases propias, 7 exclusivas · libera 10 reglas / 57 líneas de `styles.css`)

**Files:**
- Modify: `app/components/eval-dashboard.tsx`
- Modify: `app/styles.css` (solo las reglas que el script marque como huérfanas tras migrar)
- Vista donde se comprueba: `/evaluacion` — Panel de evaluación de calidad del chat.

**Interfaces:**
- Consume: la tabla de equivalencias y el procedimiento de arriba; `Button`/`buttonClasses`/`Card`/`Alert`/`EmptyState`/`Field` de `app/components/ui`.
- Produce: el componente sin ninguna clase propia exclusiva; las 20 compartidas se sustituyen por su equivalente (tabla) o se dejan si aún las usa otro fichero.

Clases exclusivas (se borran de `styles.css` al terminar): `evalResultHead evalScore compactTextarea evalQuestionList evalQuestion evalHistory evalHistoryRow`

Clases compartidas con otros ficheros (se sustituyen aquí; su regla se borra en la Task 6.1 cuando nadie las use): `emptyState evalLayout evalStats statCard statLabel toolPanelHeader eyebrow buttonCluster secondaryButton primaryButton evalError evalGrid toolPanel documentList evalResult feedMeta toolBody followForm noteTextarea iconButton`

- [ ] **Step 1: Medir el punto de partida**

```bash
node scripts/css-huerfano.mjs --fichero=app/components/eval-dashboard.tsx
```
Esperado: `27 clases propias · 7 exclusivas · 20 compartidas`.

- [ ] **Step 2: Capturar el «antes»** en `/evaluacion`: claro y oscuro, a 1280 px y a 375 px (`resize_window` con `preset: "mobile"`). En cada una ejecuta `docs/qa/escaneo-tema.js` y guarda el resultado; pega las capturas en la descripción del PR.

- [ ] **Step 3: Convertir.** Reemplaza cada clase propia del fichero por utilidades con la tabla de equivalencias (colores solo con tokens; el test de paleta lo exige). Si la raíz del componente no está dentro de un contenedor `.tw`, añade `tw` al elemento raíz de la página (Preflight no es global y sin `.tw` los botones y `box-sizing` salen sin reset).

- [ ] **Step 4: Retirar el CSS que ya nadie usa**

```bash
node scripts/css-huerfano.mjs | head -80
```
Para cada rango de `app/styles.css` que corresponda a una clase exclusiva de este fichero: comprueba que su raíz no se arma en tiempo de ejecución (`grep -rn "<raíz>" app lib`, por ejemplo `msg-` para `msg-${rol}`) y bórralo de abajo hacia arriba (`sed -i 'DESDE,HASTAd' app/styles.css`) para que los números de línea no se desplacen.

- [ ] **Step 5: Verificar**

```bash
npm run typecheck && npm run lint
npx vitest run tests/paleta-colores.test.ts tests/tailwind-migracion.test.ts
```
Esperado: sin errores; el test de migración **falla** si algún tope no se ha bajado todavía (baja la cifra en `tests/tailwind-migracion.test.ts` al valor nuevo que imprime el fallo, nunca la subas). Después `npm run build`.

Registra el componente en la auditoría del 31/10: añade `'app/components/eval-dashboard.tsx'` al array `migrated` de `scripts/audit-interface-styles.mjs` y ejecuta

```bash
node scripts/audit-interface-styles.mjs --check
```
Esperado: `"violations":[]`. Si lista una violación, el componente aún tiene un `style={…}` estático o importa un CSS: conviértelo (solo los estilos dinámicos pueden quedarse, y en ese caso el componente no entra en `migrated` hasta que no quede ninguno).

- [ ] **Step 6: Capturar el «después»** con el mismo procedimiento del Step 2 y compara: misma maquetación, sin elementos blancos en oscuro, sin texto bajo 3,5:1 y sin desbordamiento horizontal a 375 px.

- [ ] **Step 7: Commit** (solo cuando el usuario lo pida)

```bash
git add app/components/eval-dashboard.tsx app/styles.css tests/tailwind-migracion.test.ts scripts/audit-interface-styles.mjs
git commit -m "refactor(evaluacion): el panel de evaluación pasa a Tailwind y sigue el tema oscuro"
```

---


---

## Fase 4 — Procesos (Necesidades y Expedientes)

### Task 4.1: Editor de ítems de la necesidad

**Tamaño:** S (407 líneas de TSX · 24 clases propias, 20 exclusivas · libera 32 reglas / 179 líneas de `styles.css`)

**Files:**
- Modify: `app/components/necesidad-items-editor.tsx`
- Modify: `app/styles.css` (solo las reglas que el script marque como huérfanas tras migrar)
- Vista donde se comprueba: `/necesidades/[id]` — Ficha de necesidad → ítems o paquete. Solo comparte 4 clases.

**Interfaces:**
- Consume: la tabla de equivalencias y el procedimiento de arriba; `Button`/`buttonClasses`/`Card`/`Alert`/`EmptyState`/`Field` de `app/components/ui`.
- Produce: el componente sin ninguna clase propia exclusiva; las 4 compartidas se sustituyen por su equivalente (tabla) o se dejan si aún las usa otro fichero.

Clases exclusivas (se borran de `styles.css` al terminar): `necItems necItemsHead fichaSubgrupo necItemsHint necItemsTablaScroll necItemsTabla visuallyHidden necItemsPaqueteCelda necItemsSinPaqueteCelda necItemsNro necItemsCodigo necItemsDesc necItemsCifra necItemsCalculado necItemsResumen necItemsSuma aviso--error necItemsNota necItemsPaquetes necItemsSueltos`

Clases compartidas con otros ficheros (se sustituyen aquí; su regla se borra en la Task 6.1 cuando nadie las use): `segCronoRemove secondaryButton compactButton aviso`

- [ ] **Step 1: Medir el punto de partida**

```bash
node scripts/css-huerfano.mjs --fichero=app/components/necesidad-items-editor.tsx
```
Esperado: `24 clases propias · 20 exclusivas · 4 compartidas`.

- [ ] **Step 2: Capturar el «antes»** en `/necesidades/[id]`: claro y oscuro, a 1280 px y a 375 px (`resize_window` con `preset: "mobile"`). En cada una ejecuta `docs/qa/escaneo-tema.js` y guarda el resultado; pega las capturas en la descripción del PR.

- [ ] **Step 3: Convertir.** Reemplaza cada clase propia del fichero por utilidades con la tabla de equivalencias (colores solo con tokens; el test de paleta lo exige). Si la raíz del componente no está dentro de un contenedor `.tw`, añade `tw` al elemento raíz de la página (Preflight no es global y sin `.tw` los botones y `box-sizing` salen sin reset).

- [ ] **Step 4: Retirar el CSS que ya nadie usa**

```bash
node scripts/css-huerfano.mjs | head -80
```
Para cada rango de `app/styles.css` que corresponda a una clase exclusiva de este fichero: comprueba que su raíz no se arma en tiempo de ejecución (`grep -rn "<raíz>" app lib`, por ejemplo `msg-` para `msg-${rol}`) y bórralo de abajo hacia arriba (`sed -i 'DESDE,HASTAd' app/styles.css`) para que los números de línea no se desplacen.

- [ ] **Step 5: Verificar**

```bash
npm run typecheck && npm run lint
npx vitest run tests/paleta-colores.test.ts tests/tailwind-migracion.test.ts
```
Esperado: sin errores; el test de migración **falla** si algún tope no se ha bajado todavía (baja la cifra en `tests/tailwind-migracion.test.ts` al valor nuevo que imprime el fallo, nunca la subas). Después `npm run build`.

Registra el componente en la auditoría del 31/10: añade `'app/components/necesidad-items-editor.tsx'` al array `migrated` de `scripts/audit-interface-styles.mjs` y ejecuta

```bash
node scripts/audit-interface-styles.mjs --check
```
Esperado: `"violations":[]`. Si lista una violación, el componente aún tiene un `style={…}` estático o importa un CSS: conviértelo (solo los estilos dinámicos pueden quedarse, y en ese caso el componente no entra en `migrated` hasta que no quede ninguno).

- [ ] **Step 6: Capturar el «después»** con el mismo procedimiento del Step 2 y compara: misma maquetación, sin elementos blancos en oscuro, sin texto bajo 3,5:1 y sin desbordamiento horizontal a 375 px.

- [ ] **Step 7: Commit** (solo cuando el usuario lo pida)

```bash
git add app/components/necesidad-items-editor.tsx app/styles.css tests/tailwind-migracion.test.ts scripts/audit-interface-styles.mjs
git commit -m "refactor(necesidades): el editor de ítems pasa a Tailwind y sigue el tema oscuro"
```

---


### Task 4.2: Copiloto de la necesidad

**Tamaño:** S (410 líneas de TSX · 25 clases propias, 11 exclusivas · libera 14 reglas / 96 líneas de `styles.css`)

**Files:**
- Modify: `app/components/necesidad-copiloto.tsx`
- Modify: `app/styles.css` (solo las reglas que el script marque como huérfanas tras migrar)
- Vista donde se comprueba: `/necesidades/[id]` — Panel del copiloto dentro de la ficha.

**Interfaces:**
- Consume: la tabla de equivalencias y el procedimiento de arriba; `Button`/`buttonClasses`/`Card`/`Alert`/`EmptyState`/`Field` de `app/components/ui`.
- Produce: el componente sin ninguna clase propia exclusiva; las 14 compartidas se sustituyen por su equivalente (tabla) o se dejan si aún las usa otro fichero.

Clases exclusivas (se borran de `styles.css` al terminar): `copilotoMsgTexto copilotoAcciones copilotoMsg copilotoDegradada copilotoFuentes copilotoFuentesLabel copilotoFuente copilotoMsgAcc copilotoPensando copilotoError copilotoInput`

Clases compartidas con otros ficheros (se sustituyen aquí; su regla se borra en la Task 6.1 cuando nadie las use): `copiloto copilotoHead copilotoTitulo iconButton copilotoSub secondaryButton compactButton copilotoRedactar copilotoLog copilotoVacio copilotoLink assistant spin primaryButton`

- [ ] **Step 1: Medir el punto de partida**

```bash
node scripts/css-huerfano.mjs --fichero=app/components/necesidad-copiloto.tsx
```
Esperado: `25 clases propias · 11 exclusivas · 14 compartidas`.

- [ ] **Step 2: Capturar el «antes»** en `/necesidades/[id]`: claro y oscuro, a 1280 px y a 375 px (`resize_window` con `preset: "mobile"`). En cada una ejecuta `docs/qa/escaneo-tema.js` y guarda el resultado; pega las capturas en la descripción del PR.

- [ ] **Step 3: Convertir.** Reemplaza cada clase propia del fichero por utilidades con la tabla de equivalencias (colores solo con tokens; el test de paleta lo exige). Si la raíz del componente no está dentro de un contenedor `.tw`, añade `tw` al elemento raíz de la página (Preflight no es global y sin `.tw` los botones y `box-sizing` salen sin reset).

- [ ] **Step 4: Retirar el CSS que ya nadie usa**

```bash
node scripts/css-huerfano.mjs | head -80
```
Para cada rango de `app/styles.css` que corresponda a una clase exclusiva de este fichero: comprueba que su raíz no se arma en tiempo de ejecución (`grep -rn "<raíz>" app lib`, por ejemplo `msg-` para `msg-${rol}`) y bórralo de abajo hacia arriba (`sed -i 'DESDE,HASTAd' app/styles.css`) para que los números de línea no se desplacen.

- [ ] **Step 5: Verificar**

```bash
npm run typecheck && npm run lint
npx vitest run tests/paleta-colores.test.ts tests/tailwind-migracion.test.ts
```
Esperado: sin errores; el test de migración **falla** si algún tope no se ha bajado todavía (baja la cifra en `tests/tailwind-migracion.test.ts` al valor nuevo que imprime el fallo, nunca la subas). Después `npm run build`.

Registra el componente en la auditoría del 31/10: añade `'app/components/necesidad-copiloto.tsx'` al array `migrated` de `scripts/audit-interface-styles.mjs` y ejecuta

```bash
node scripts/audit-interface-styles.mjs --check
```
Esperado: `"violations":[]`. Si lista una violación, el componente aún tiene un `style={…}` estático o importa un CSS: conviértelo (solo los estilos dinámicos pueden quedarse, y en ese caso el componente no entra en `migrated` hasta que no quede ninguno).

- [ ] **Step 6: Capturar el «después»** con el mismo procedimiento del Step 2 y compara: misma maquetación, sin elementos blancos en oscuro, sin texto bajo 3,5:1 y sin desbordamiento horizontal a 375 px.

- [ ] **Step 7: Commit** (solo cuando el usuario lo pida)

```bash
git add app/components/necesidad-copiloto.tsx app/styles.css tests/tailwind-migracion.test.ts scripts/audit-interface-styles.mjs
git commit -m "refactor(necesidades): el copiloto de la ficha pasa a Tailwind y sigue el tema oscuro"
```

---


### Task 4.3: Detalle del expediente

**Tamaño:** M (1214 líneas de TSX · 24 clases propias, 9 exclusivas · libera 11 reglas / 68 líneas de `styles.css`)

**Files:**
- Modify: `app/components/process-detail.tsx`
- Modify: `app/styles.css` (solo las reglas que el script marque como huérfanas tras migrar)
- Vista donde se comprueba: `/expedientes/[id]` — Cabecera, tracker de fases y paneles del expediente (cuenta interna, oficina Abastecimiento).

**Interfaces:**
- Consume: la tabla de equivalencias y el procedimiento de arriba; `Button`/`buttonClasses`/`Card`/`Alert`/`EmptyState`/`Field` de `app/components/ui`.
- Produce: el componente sin ninguna clase propia exclusiva; las 15 compartidas se sustituyen por su equivalente (tabla) o se dejan si aún las usa otro fichero.

Clases exclusivas (se borran de `styles.css` al terminar): `fichaRow fichaLabel fichaOrigen fichaValue processStatus fichaGrid processSide processSoon desiertoButton`

Clases compartidas con otros ficheros (se sustituyen aquí; su regla se borra en la Task 6.1 cuando nadie las use): `sideMuted emptyState formMessage errorText successText processPanel processPanelHead panelTitulo panelOrigen secondaryButton compactButton primaryButton timeline sourceMetaGrid sourceActions`

Mezcla 78 utilidades con 62 clases propias; además tiene 17 literales hex que se sustituyen por tokens con la tabla de arriba.

- [ ] **Step 1: Medir el punto de partida**

```bash
node scripts/css-huerfano.mjs --fichero=app/components/process-detail.tsx
```
Esperado: `24 clases propias · 9 exclusivas · 15 compartidas`.

- [ ] **Step 2: Capturar el «antes»** en `/expedientes/[id]`: claro y oscuro, a 1280 px y a 375 px (`resize_window` con `preset: "mobile"`). En cada una ejecuta `docs/qa/escaneo-tema.js` y guarda el resultado; pega las capturas en la descripción del PR.

- [ ] **Step 3: Convertir.** Reemplaza cada clase propia del fichero por utilidades con la tabla de equivalencias (colores solo con tokens; el test de paleta lo exige). Si la raíz del componente no está dentro de un contenedor `.tw`, añade `tw` al elemento raíz de la página (Preflight no es global y sin `.tw` los botones y `box-sizing` salen sin reset).

- [ ] **Step 4: Retirar el CSS que ya nadie usa**

```bash
node scripts/css-huerfano.mjs | head -80
```
Para cada rango de `app/styles.css` que corresponda a una clase exclusiva de este fichero: comprueba que su raíz no se arma en tiempo de ejecución (`grep -rn "<raíz>" app lib`, por ejemplo `msg-` para `msg-${rol}`) y bórralo de abajo hacia arriba (`sed -i 'DESDE,HASTAd' app/styles.css`) para que los números de línea no se desplacen.

- [ ] **Step 5: Verificar**

```bash
npm run typecheck && npm run lint
npx vitest run tests/paleta-colores.test.ts tests/tailwind-migracion.test.ts
```
Esperado: sin errores; el test de migración **falla** si algún tope no se ha bajado todavía (baja la cifra en `tests/tailwind-migracion.test.ts` al valor nuevo que imprime el fallo, nunca la subas). Después `npm run build`.

Registra el componente en la auditoría del 31/10: añade `'app/components/process-detail.tsx'` al array `migrated` de `scripts/audit-interface-styles.mjs` y ejecuta

```bash
node scripts/audit-interface-styles.mjs --check
```
Esperado: `"violations":[]`. Si lista una violación, el componente aún tiene un `style={…}` estático o importa un CSS: conviértelo (solo los estilos dinámicos pueden quedarse, y en ese caso el componente no entra en `migrated` hasta que no quede ninguno).

- [ ] **Step 6: Capturar el «después»** con el mismo procedimiento del Step 2 y compara: misma maquetación, sin elementos blancos en oscuro, sin texto bajo 3,5:1 y sin desbordamiento horizontal a 375 px.

- [ ] **Step 7: Commit** (solo cuando el usuario lo pida)

```bash
git add app/components/process-detail.tsx app/styles.css tests/tailwind-migracion.test.ts scripts/audit-interface-styles.mjs
git commit -m "refactor(expedientes): el detalle del expediente pasa a Tailwind y sigue el tema oscuro"
```

---


### Task 4.4: Panel de fase

**Tamaño:** L (4178 líneas de TSX · 41 clases propias, 21 exclusivas · libera 36 reglas / 236 líneas de `styles.css`)

**Files:**
- Modify: `app/components/fase-panel.tsx`
- Modify: `app/styles.css` (solo las reglas que el script marque como huérfanas tras migrar)
- Vista donde se comprueba: `/expedientes/[id]` — Los pasos A1–A9 de cada fase (el fichero más grande: 4.178 líneas).

**Interfaces:**
- Consume: la tabla de equivalencias y el procedimiento de arriba; `Button`/`buttonClasses`/`Card`/`Alert`/`EmptyState`/`Field` de `app/components/ui`.
- Produce: el componente sin ninguna clase propia exclusiva; las 20 compartidas se sustituyen por su equivalente (tabla) o se dejan si aún las usa otro fichero.

Clases exclusivas (se borran de `styles.css` al terminar): `pasoContextoToggle pasoGrupo pasoGrupoProgreso pasoGrupoCheck pasoGrupoBarra pasoGrupoCuenta pasoExport faseUnoPanel faseSyncBtn faseRutaCritica faseRutaCriticaIr faseCopilotoBtn faseDetalle accionGroups accionGroup accionGroupHead accionNumeral accionLabel accionOpcional accionMiniProgress faseToast`

Clases compartidas con otros ficheros (se sustituyen aquí; su regla se borra en la Task 6.1 cuando nadie las use): `secondaryButton compactButton spinIcon primaryButton processPanel processPanelHead panelTitulo faseUnoBadge panelToggle formMessage errorText successText copiloto copilotoHead copilotoTitulo iconButton copilotoSub copilotoLog copilotoVacio sideMuted`

Ya es mayoritariamente Tailwind (257 utilidades frente a 65 clases propias): solo hay que convertir las 65 y los 13 hex. Divide el Step 3 por paso (A1…A9) y comprueba la fase correspondiente entre bloques; no mezcles esta tarea con otros cambios del panel.

- [ ] **Step 1: Medir el punto de partida**

```bash
node scripts/css-huerfano.mjs --fichero=app/components/fase-panel.tsx
```
Esperado: `41 clases propias · 21 exclusivas · 20 compartidas`.

- [ ] **Step 2: Capturar el «antes»** en `/expedientes/[id]`: claro y oscuro, a 1280 px y a 375 px (`resize_window` con `preset: "mobile"`). En cada una ejecuta `docs/qa/escaneo-tema.js` y guarda el resultado; pega las capturas en la descripción del PR.

- [ ] **Step 3: Convertir.** Reemplaza cada clase propia del fichero por utilidades con la tabla de equivalencias (colores solo con tokens; el test de paleta lo exige). Si la raíz del componente no está dentro de un contenedor `.tw`, añade `tw` al elemento raíz de la página (Preflight no es global y sin `.tw` los botones y `box-sizing` salen sin reset).

- [ ] **Step 4: Retirar el CSS que ya nadie usa**

```bash
node scripts/css-huerfano.mjs | head -80
```
Para cada rango de `app/styles.css` que corresponda a una clase exclusiva de este fichero: comprueba que su raíz no se arma en tiempo de ejecución (`grep -rn "<raíz>" app lib`, por ejemplo `msg-` para `msg-${rol}`) y bórralo de abajo hacia arriba (`sed -i 'DESDE,HASTAd' app/styles.css`) para que los números de línea no se desplacen.

- [ ] **Step 5: Verificar**

```bash
npm run typecheck && npm run lint
npx vitest run tests/paleta-colores.test.ts tests/tailwind-migracion.test.ts
```
Esperado: sin errores; el test de migración **falla** si algún tope no se ha bajado todavía (baja la cifra en `tests/tailwind-migracion.test.ts` al valor nuevo que imprime el fallo, nunca la subas). Después `npm run build`.

Registra el componente en la auditoría del 31/10: añade `'app/components/fase-panel.tsx'` al array `migrated` de `scripts/audit-interface-styles.mjs` y ejecuta

```bash
node scripts/audit-interface-styles.mjs --check
```
Esperado: `"violations":[]`. Si lista una violación, el componente aún tiene un `style={…}` estático o importa un CSS: conviértelo (solo los estilos dinámicos pueden quedarse, y en ese caso el componente no entra en `migrated` hasta que no quede ninguno).

- [ ] **Step 6: Capturar el «después»** con el mismo procedimiento del Step 2 y compara: misma maquetación, sin elementos blancos en oscuro, sin texto bajo 3,5:1 y sin desbordamiento horizontal a 375 px.

- [ ] **Step 7: Commit** (solo cuando el usuario lo pida)

```bash
git add app/components/fase-panel.tsx app/styles.css tests/tailwind-migracion.test.ts scripts/audit-interface-styles.mjs
git commit -m "refactor(expedientes): el panel de fase termina de pasar a Tailwind"
```

---


### Task 4.5: Archivo

**Tamaño:** S (543 líneas de TSX · 25 clases propias, 5 exclusivas · libera 5 reglas / 28 líneas de `styles.css`)

**Files:**
- Modify: `app/components/archivo-workspace.tsx`
- Modify: `app/styles.css` (solo las reglas que el script marque como huérfanas tras migrar)
- Vista donde se comprueba: `/archivo` — Archivo documental heredado. Comprueba antes con `grep -rn "/archivo" app` que la ruta sigue enlazada desde el menú; si no, se trata como código muerto y se borra en vez de migrarse.

**Interfaces:**
- Consume: la tabla de equivalencias y el procedimiento de arriba; `Button`/`buttonClasses`/`Card`/`Alert`/`EmptyState`/`Field` de `app/components/ui`.
- Produce: el componente sin ninguna clase propia exclusiva; las 20 compartidas se sustituyen por su equivalente (tabla) o se dejan si aún las usa otro fichero.

Clases exclusivas (se borran de `styles.css` al terminar): `pillGroup archivoAnswer archivoAnswerText archivoSources archivoResults`

Clases compartidas con otros ficheros (se sustituyen aquí; su regla se borra en la Task 6.1 cuando nadie las use): `uploadPanel panelHeader eyebrow documentForm styleSelectors styleSelectorsTitle formGrid fullSpan formActions primaryButton formMessage documentSectionTitle documentItem documentIcon documentActions emptyState filePicker secondaryButton documentList documentError`

- [ ] **Step 1: Medir el punto de partida**

```bash
node scripts/css-huerfano.mjs --fichero=app/components/archivo-workspace.tsx
```
Esperado: `25 clases propias · 5 exclusivas · 20 compartidas`.

- [ ] **Step 2: Capturar el «antes»** en `/archivo`: claro y oscuro, a 1280 px y a 375 px (`resize_window` con `preset: "mobile"`). En cada una ejecuta `docs/qa/escaneo-tema.js` y guarda el resultado; pega las capturas en la descripción del PR.

- [ ] **Step 3: Convertir.** Reemplaza cada clase propia del fichero por utilidades con la tabla de equivalencias (colores solo con tokens; el test de paleta lo exige). Si la raíz del componente no está dentro de un contenedor `.tw`, añade `tw` al elemento raíz de la página (Preflight no es global y sin `.tw` los botones y `box-sizing` salen sin reset).

- [ ] **Step 4: Retirar el CSS que ya nadie usa**

```bash
node scripts/css-huerfano.mjs | head -80
```
Para cada rango de `app/styles.css` que corresponda a una clase exclusiva de este fichero: comprueba que su raíz no se arma en tiempo de ejecución (`grep -rn "<raíz>" app lib`, por ejemplo `msg-` para `msg-${rol}`) y bórralo de abajo hacia arriba (`sed -i 'DESDE,HASTAd' app/styles.css`) para que los números de línea no se desplacen.

- [ ] **Step 5: Verificar**

```bash
npm run typecheck && npm run lint
npx vitest run tests/paleta-colores.test.ts tests/tailwind-migracion.test.ts
```
Esperado: sin errores; el test de migración **falla** si algún tope no se ha bajado todavía (baja la cifra en `tests/tailwind-migracion.test.ts` al valor nuevo que imprime el fallo, nunca la subas). Después `npm run build`.

Registra el componente en la auditoría del 31/10: añade `'app/components/archivo-workspace.tsx'` al array `migrated` de `scripts/audit-interface-styles.mjs` y ejecuta

```bash
node scripts/audit-interface-styles.mjs --check
```
Esperado: `"violations":[]`. Si lista una violación, el componente aún tiene un `style={…}` estático o importa un CSS: conviértelo (solo los estilos dinámicos pueden quedarse, y en ese caso el componente no entra en `migrated` hasta que no quede ninguno).

- [ ] **Step 6: Capturar el «después»** con el mismo procedimiento del Step 2 y compara: misma maquetación, sin elementos blancos en oscuro, sin texto bajo 3,5:1 y sin desbordamiento horizontal a 375 px.

- [ ] **Step 7: Commit** (solo cuando el usuario lo pida)

```bash
git add app/components/archivo-workspace.tsx app/styles.css tests/tailwind-migracion.test.ts scripts/audit-interface-styles.mjs
git commit -m "refactor(archivo): el archivo documental pasa a Tailwind"
```

---


---

## Fase 5 — Contratos (estilos en línea → utilidades)

Los cinco ficheros concentran ~250 de los 372 `style={…}` y 108 literales hex. Regla de conversión:

| En línea | Utilidad |
|---|---|
| `style={{ display: "flex", gap: 8 }}` | `className="flex gap-2"` |
| `padding: 12` / `margin: "0 0 8px"` | `p-3` / `mb-2` |
| `color: "#64748b"` | `text-muted` |
| `background: "#fff"` | `bg-panel` |
| `border: "1px solid #e2e8f0"` | `border border-line` |
| `border: "1px solid #cbd5e1"` (campo) | `border border-line-strong` |
| `fontSize: 13` / `fontWeight: 600` | `text-[13px]` / `font-semibold` |
| ancho dinámico (`width` calculado en %) | **se queda** como `style` (solo ese atributo) |

Los estilos dinámicos (anchos en %, colores que vienen de datos) se quedan; los literales se convierten. Cada tarea deja el contador de `estilosEnLinea` más bajo y el de hex en TSX también (`tests/paleta-colores.test.ts` tiene su propio tope: bájalo también).

### Task 5.1: Workspace y listas de Contratos

**Files:**
- Modify: `app/components/contratos-workspace.tsx` (99 líneas, 12 `style`, 13 hex)
- Modify: `app/components/contrato-sie-list.tsx` (165 líneas, 19 `style`, 13 hex)
- Modify: `app/components/contrato-cp-list.tsx` (147 líneas, 16 `style`, 9 hex)
- Vista: `/contratos` (cuenta interna con permiso de contratos)

- [ ] **Step 1: Medir.** `grep -c "style={{" app/components/contratos-workspace.tsx app/components/contrato-sie-list.tsx app/components/contrato-cp-list.tsx` → `12`, `19`, `16`.
- [ ] **Step 2: Capturar el «antes»** de `/contratos` (claro/oscuro, 1280 y 375 px) y ejecutar `docs/qa/escaneo-tema.js`.
- [ ] **Step 3: Convertir** con la tabla de arriba, y añadir `tw` a la raíz de `app/contratos/page.tsx` si no lo tiene.
- [ ] **Step 4: Verificar** `npm run typecheck && npm run lint && npx vitest run tests/paleta-colores.test.ts tests/tailwind-migracion.test.ts && npm run build`; bajar `estilosEnLinea` y `hexEnComponentes` a los valores que impriman los tests.
- [ ] **Step 5: Capturar el «después»** y comparar (sin blancos en oscuro, sin desbordamiento a 375 px).
- [ ] **Step 6: Commit** (cuando el usuario lo pida)

```bash
git add app tests
git commit -m "refactor(contratos): el listado de contratos deja de fijar colores y sigue el tema oscuro"
```

### Task 5.2: Formulario de contrato por Comparación de Precios

**Files:**
- Modify: `app/components/contrato-cp-form.tsx` (680 líneas, 94 `style`, 27 hex)
- Vista: `/contratos` → nuevo contrato (CP)

- [ ] **Step 1: Medir.** `grep -c "style={{" app/components/contrato-cp-form.tsx` → `94`.
- [ ] **Step 2: Capturar el «antes»** del formulario completo en claro y oscuro y con un campo en error de validación.
- [ ] **Step 3: Convertir por secciones del formulario** (datos generales → contratista → plazos y montos → garantías → botones), comprobando la pantalla entre secciones. Los campos pasan a `<Input>`/`<Select>`/`<Textarea>` de `app/components/ui/field.tsx` (borde `border-line-strong`, placeholder `text-placeholder`).
- [ ] **Step 4: Verificar** igual que la Task 5.1 y bajar los topes.
- [ ] **Step 5: Comprobar un guardado real** (crear y editar un contrato de prueba): la migración no debe cambiar ningún valor enviado.
- [ ] **Step 6: Commit** (cuando el usuario lo pida)

```bash
git add app tests
git commit -m "refactor(contratos): el formulario de comparación de precios usa Tailwind y se lee en modo oscuro"
```

### Task 5.3: Formulario de contrato por Subasta Inversa Electrónica

**Files:**
- Modify: `app/components/contrato-sie-form.tsx` (1.079 líneas, 106 `style`, 46 hex)
- Vista: `/contratos` → nuevo contrato (SIE)

- [ ] **Step 1: Medir.** `grep -c "style={{" app/components/contrato-sie-form.tsx` → `106`.
- [ ] **Step 2: Capturar el «antes»** del formulario completo en claro y oscuro y con un campo en error de validación.
- [ ] **Step 3: Convertir por secciones del formulario** y comprobar la pantalla entre secciones (es el mayor del módulo). Mismas reglas de conversión y mismos primitivos que la Task 5.2.
- [ ] **Step 4: Verificar** igual que la Task 5.1 y bajar los topes.
- [ ] **Step 5: Comprobar un guardado real** (crear y editar un contrato de prueba): no debe cambiar ningún valor enviado.
- [ ] **Step 6: Commit** (cuando el usuario lo pida)

```bash
git add app tests
git commit -m "refactor(contratos): el formulario de subasta inversa usa Tailwind y se lee en modo oscuro"
```

---

## Fase 6 — Cierre

### Task 6.1: Borrar las clases compartidas

**Files:**
- Modify: `app/styles.css`

- [ ] **Step 1: Ver quién queda usando cada una**

```bash
for c in secondaryButton primaryButton compactButton dangerButton emptyState eyebrow spinIcon formMessage errorText formActions toolPanel toolPanelHeader toolBody documentList; do node scripts/css-huerfano.mjs --clase=$c | head -1; done
```
Esperado al final de las Fases 2–5: `0 fichero(s)` en todas. Las que aún tengan consumidores son ficheros que ninguna tarea cubrió (módulos pequeños: configuración, oficinas, auth): migrarlos aquí, uno a uno, con el procedimiento de las tareas.

- [ ] **Step 2: Borrar las reglas** de cada clase con 0 consumidores (`node scripts/css-huerfano.mjs` las lista) y verificar `typecheck`, `lint`, tests y `build`.

- [ ] **Step 3: Commit** (cuando el usuario lo pida)

```bash
git add app tests
git commit -m "chore(css): se borran las clases compartidas que ya no usa ningún componente"
```

### Task 6.2: Decidir el destino de `styles.css`

**Files:**
- Modify: `app/tailwind.css` (línea `@import "./styles.css" layer(legacy);`)
- Delete (si queda vacío): `app/styles.css`

- [ ] **Step 1: Medir lo que queda**

```bash
wc -l app/styles.css
node scripts/css-huerfano.mjs | head -1
```
- [ ] **Step 2: Si `styles.css` tiene menos de ~300 líneas** (variables heredadas, `@keyframes`, reglas de impresión), moverlas a `app/workspace.css` o a `@layer base` de `app/tailwind.css` y borrar el `@import … layer(legacy)` y el fichero. Si queda más, deja el fichero y anota en el `CLAUDE.md` qué contiene y por qué no se migró.
- [ ] **Step 3: Verificar** `npm run build` y revisar `/login`, `/chat`, `/necesidades`, `/expedientes`, `/configuracion` en claro y oscuro.
- [ ] **Step 4: Commit** (cuando el usuario lo pida)

```bash
git add -A app
git commit -m "refactor(css): la hoja heredada desaparece y todo el estilo vive en Tailwind y los tokens"
```

### Task 6.3: Documentación y topes finales

**Files:**
- Modify: `CLAUDE.md` (sección «Tailwind», estado de la migración)
- Modify: `tests/tailwind-migracion.test.ts` y `tests/paleta-colores.test.ts` (topes al valor final)

- [ ] **Step 1: Poner los topes en lo que mida cada test** (no a ojo): ejecuta ambos, copia las cifras que impriman al fallar y bájalas hasta que pasen justo.
- [ ] **Step 2: Reescribir en `CLAUDE.md`** el párrafo de «Migrado hasta ahora» con el estado real y la regla: *todo componente nuevo se escribe con utilidades y tokens; no se crean clases en CSS*.
- [ ] **Step 3: Commit** (cuando el usuario lo pida)

```bash
git add CLAUDE.md tests
git commit -m "docs(tailwind): la migración termina y las guardas fijan el estado final"
```

---

## Criterios de éxito

- `tests/tailwind-migracion.test.ts` con `usosClasePropia`, `ficherosConClasePropia` y `lineasStylesCss` en 0 (o en la cifra justificada de la Task 6.2) y `estilosEnLinea` reducido a los dinámicos legítimos (esperado: ≤ 100).
- `tests/paleta-colores.test.ts` con `hexEnComponentes` ≤ 50 (los que sean datos, como colores de series).
- Ninguna pantalla con elementos blancos ni texto bajo 3,5:1 en oscuro (escáner de la Task 0.2) en las rutas de las Fases 2–5.
- `npm run typecheck`, `npm run lint`, `npx vitest run` y `npm run build` en verde, y el CI de GitHub en verde.

## Riesgos y cómo se controlan

| Riesgo | Control |
|---|---|
| Un cambio visual no deseado (no hay tests de renderizado) | Capturas antes/después en claro, oscuro, 1280 y 375 px y escáner de tema en cada tarea; PRs de una tarea. |
| Una clase armada en ejecución parece huérfana y se borra | El script es solo informe; cada rango se contrasta con `grep` de su raíz antes de borrar. |
| Un componente migrado queda fuera de `.tw` y pierde el reset | Step 3 de cada tarea obliga a comprobar el contenedor; el síntoma es un botón con fondo gris o un `box-sizing` roto. |
| Las cuentas externas no ven pantallas internas | Las Fases 3–5 requieren que el usuario inicie sesión con una cuenta interna; la Fase 2 se puede comprobar con la cuenta externa. |
| `fase-panel.tsx` (4.178 líneas) | Se divide por pasos A1–A9 dentro de su tarea y no se mezcla con otros cambios. |
