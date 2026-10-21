# Evaluación: migrar ACE a Tailwind CSS (y usar TailAdmin)

Fecha: 2026-07-15 · Estado: **evaluación, nada implementado**

## Resumen ejecutivo

Migrar es **técnicamente viable y con menos fricción de la esperada**: no hay colisiones de
nombres, el reset de Tailwind se puede desactivar y los tokens de ACE ya son variables CSS
(el mismo modelo que usa Tailwind v4). Pero el coste real **no está en el CSS**: está en
34,810 líneas de TSX y, sobre todo, en **805 estilos inline** que hay que convertir a mano.

El tapón no es técnico: **no existe ni un solo test de UI**. Los 264 tests son de lógica.
Una migración visual sin red de seguridad se valida a ojo, pantalla por pantalla.

**Recomendación: no comprometerse a la migración completa.** Ejecutar Fase 0 → 2 (red de
seguridad, instalación inerte y un piloto real), medir, y **decidir con datos**.

## Sobre TailAdmin en concreto

| | TailAdmin | ACE |
|---|---|---|
| Next.js / React | 16 / 19 | 16 / 19 ✅ coincide |
| Licencia | MIT ✅ | — |
| Estilos | Tailwind CSS v4 | CSS propio, 19,891 líneas |
| Distribución | repo starter para **clonar** | app en producción |

TailAdmin **no es una librería instalable**: no hay paquete npm, sus componentes están
acoplados al template. Se copian archivos a mano.

Desajuste de fondo: su valor son 10 dashboards genéricos (e-commerce, CRM, analytics).
El núcleo de ACE (`fase-panel`, `segForm`, `pasoList`, expedientes, necesidades) **no
existe en TailAdmin** — habría que rehacerlo igual, pero en Tailwind. Sirve para *chrome*
(layout, sidebar, topbar, tablas, formularios), no para el dominio.

## Lo que se midió

| Métrica | Valor |
|---|---|
| `app/styles.css` | 15,853 líneas |
| `expedientes-archivo.css` | 4,038 líneas |
| Clases CSS distintas | **1,191** |
| Archivos `.tsx` en `app/` | 108 |
| Líneas de `.tsx` | **34,810** |
| Usos de `className=` | **2,625** |
| Usos de `style={{ }}` inline | **805** |
| Usos de `var(--…)` | 1,444 |
| Media queries | 28 |
| `@keyframes` | 9 |
| **Tests que renderizan UI** | **0** |

## Las tres buenas noticias (coexistencia)

**1. Cero colisiones de nombres.** De 1,191 clases, **1,176 son camelCase** (`segForm`,
`pasoList`, `settingsPageLayout`), 0 kebab-case y 15 de una palabra (`brand`, `sidebar`,
`topbar`…). Las utilidades de Tailwind son kebab-case/minúscula. Intersección medida: **0**.
Los dos sistemas pueden convivir sin pisarse los nombres.

**2. El reset se puede desactivar.** Preflight (que quita márgenes, deja los `h1-h6` sin
tamaño y las listas sin viñetas) rompería 19,891 líneas que asumen otra base. Tailwind v4
permite importar solo tema y utilidades:

```css
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
/* se omite: @import "tailwindcss/preflight.css" layer(base); */
```

**3. Los tokens ya son variables CSS.** ACE usa `var(--brand)`, `var(--muted)`,
`var(--border)` en 1,444 sitios. El `@theme` de Tailwind v4 **es** variables CSS: los
tokens actuales se declaran una vez y las utilidades (`bg-brand`, `text-muted`) salen solas.
No hay que reinventar la paleta.

## La mala noticia técnica (decide el enfoque)

**Las cascade layers invierten la precedencia esperada.** En CSS, el estilo **sin capa gana
al estilo en capa**, sin importar la especificidad. Como `styles.css` no está en ninguna
capa y las utilidades de Tailwind irían en `@layer utilities`:

> **ACE siempre le gana a Tailwind.**

Consecuencia práctica: **no se puede "salpicar" Tailwind** sobre un componente ya estilado
para retocarlo — la clase de ACE gana y parece que Tailwind no funciona. La migración tiene
que ser **atómica por elemento**: quitar la clase de ACE y poner las de Tailwind a la vez.

Hay dos estrategias:

- **A (por defecto):** Tailwind en capa. ACE gana los conflictos. Es *seguro* (Tailwind no
  puede romper nada existente) pero obliga a migrar elemento completo.
- **B (recomendada para migrar):** envolver `styles.css` en `@layer legacy` y declarar
  `@layer legacy, theme, base, components, utilities;`. Entonces **Tailwind gana** y se
  puede migrar de forma gradual. El orden relativo *dentro* de `styles.css` se conserva.
  Riesgo a verificar: CSS de terceros sin capa (p. ej. Radix Dialog) cambiaría de
  precedencia relativa.

## El coste real: el JSX, no el CSS

Migrar 1,191 clases no es el problema — se hace por bloques. El grano fino es:

- **805 `style={{ }}` inline.** No son clases: cada uno se convierte a mano. Tailwind no
  ayuda a encontrarlos ni a traducirlos. Es la parte más lenta y más propensa a error.
- **2,625 `className=`.** Muchos con clases compuestas y condicionales.
- **`necesidad-detail.tsx` (1,905 líneas)** y **`expedientes-archivo-workspace.tsx`
  (1,828)** son los dos monstruos. Migrarlos es un proyecto en sí.

## Riesgos

1. **Cero tests de UI (el mayor).** 28 archivos de test, 264 tests, todos de lógica. Ninguna
   regresión visual se detecta automáticamente.
2. **805 estilos inline** — el trabajo invisible que hunde las estimaciones.
3. **La app está en producción** y **toda la sesión actual está sin commitear**. Migrar sobre
   trabajo sin commitear es hacerse trampa: no hay a dónde volver.
4. **TailAdmin no cubre el dominio.** Buena parte de la UI de ACE no tiene plantilla que copiar.
5. **Scope creep.** "Ya que migramos, rediseñamos" es cómo esto pasa de semanas a meses.

## Plan por fases (cada fase decide si hay siguiente)

### Fase 0 — Red de seguridad · *bloqueante*
- Commitear todo lo pendiente. Sin esto no se empieza.
- Montar **regresión visual** (Playwright + captura por pantalla). Para CSS, las capturas
  son lo que detecta roturas; los tests de render no.
- Congelar una **baseline** de las pantallas principales.
- *Salida:* poder demostrar que un cambio no alteró nada visualmente.

### Fase 1 — Instalación inerte
- `tailwindcss` v4 + `@tailwindcss/postcss`.
- Importar **sin preflight**; decidir estrategia A o B de capas.
- Mapear `--brand`/`--muted`/… a `@theme`.
- **Criterio de aceptación: diff visual = 0.** Si algo cambió, se revierte.

### Fase 2 — Piloto medido
- Migrar **una** pantalla pequeña y real de punta a punta.
- **Medir el tiempo de verdad** y extrapolar. Aquí es donde la estimación deja de ser humo.
- *Punto de decisión: seguir, parar o revertir.*

### Fase 3 — Migración por pantallas (solo si Fase 2 convence)
Orden de menor a mayor riesgo; `necesidad-detail` el último.

### Fase 4 — Retirar CSS muerto
Borrar clases según dejan de referenciarse. Requiere un detector de clases huérfanas.

## Alternativa más barata

Usar TailAdmin como **referencia visual**: copiar decisiones de espaciado, jerarquía,
tarjetas y modo oscuro a las variables CSS que ya existen. Coste bajo, sin dependencia,
sin regresiones. Captura buena parte del beneficio estético sin el proyecto de migración.
