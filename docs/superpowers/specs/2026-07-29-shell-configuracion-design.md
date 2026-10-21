# Shell del módulo Configuración — Rediseño

**Fecha:** 2026-07-29
**Sub-proyecto:** 1 de 5 (Shell del workspace)
**Estado:** Aprobado, pendiente de implementación

## Contexto

El módulo Configuración tiene 6 secciones (Municipalidad, Áreas, Numeración, Membrete,
Usuarios, Feriados) gestionadas por `configuracion-workspace.tsx` (434 líneas). Hoy el
shell es un sidebar fijo de 264px con navegación agrupada por dominio y un indicador de
progreso. Cumple su función, pero hay dos perfiles de uso que conviven sin separarse:

1. **Puesta a punto:** la entidad se configura por primera vez. El admin necesita ver
   qué falta, en qué orden, y sentir que avanza.
2. **Mantenimiento:** ya configurado, el admin entra a cambiar algo puntual y salir.

El shell actual sirve al caso 2 pero no al 1: el progreso es un número pequeño, la
navegación es libre (lo cual está bien), pero no hay un "panel de control" que muestre
el estado global de un vistazo.

Este spec cubre el rediseño del SHELL únicamente. Las 5 pestañas (Municipalidad,
Usuarios, etc.) tendrán sus propios specs en sub-proyectos posteriores.

## Requisitos

Derivados de las sesiones de brainstorming:

- **R1.** Servir a los dos modos: puesta a punto + mantenimiento, sin que uno moleste
  al otro.
- **R2.** Landing por defecto que muestre el estado de las 6 secciones de un vistazo
  (resumen ejecutivo).
- **R3.** Sidebar libre (como hoy) al entrar en una sección, con botón para volver al
  resumen.
- **R4.** Modo "Guíame" opcional: tour discreto que sugiere orden de completado cuando
  hay secciones incompletas.
- **R5.** Búsqueda dentro de configuración (command palette con `Ctrl+K`).
- **R6.** Atajos de teclado: `Ctrl+K`, `↑↓`, `Enter`, `Esc`, `?`.
- **R7.** Responsive: funcionar en tablet (≤1024px) y portátil pequeño.

## Arquitectura

### Estado del shell

Hoy: `active: SectionKey` (6 valores). El cambio clave es tratar "resumen" como un
valor más de ese estado, no como un booleano aparte:

```typescript
type View = "resumen" | SectionKey;
const [active, setActive] = useState<View>("resumen");
```

- `active === "resumen"` → renderiza `ResumenView` (grid de tarjetas).
- `active` es una sección → renderiza sidebar + contenido (como hoy, con botón
  "← Resumen" arriba).

El resto del estado no cambia: `summary`, `saltoPendiente`, `oficinasState` siguen
igual. Lo único nuevo es la rama de renderizado según `active`.

**Nota de implementación:** los lookups `OWNER[active]` y `SECCION_INFO[active]` se
indexan por `SectionKey`. Cuando `active === "resumen"`, no hay entrada. La rama de
renderizado maneja esto: si `active === "resumen"`, se renderiza `ResumenView` antes
de consultar `OWNER` o `SECCION_INFO`. Los valores derivados (`adminSection`,
`oficSection`) quedan como `null` naturalmente. TypeScript exigirá un guard o
narrowing; eso se resuelve en el plan de implementación.

### Sin nuevas APIs

El resumen consume el mismo `Summary` que ya vive en el workspace
(`entityComplete`, `usersCount`, `oficinasCount`, `oficinasConMembrete`,
`oficinasConNumeracion`, `feriadosCount`). No hay nuevas peticiones al servidor.

El único dato que no está en `Summary` hoy es un timestamp de "última modificación"
por sección. Se infiere del estado disponible: la entidad tiene `updated_at` en el
payload del servidor; las oficinas y feriados se cargan en el cliente. Si el timestamp
no está disponible, la tarjeta omite esa línea (graceful degradation).

## Diseño: Resumen ejecutivo (landing)

### Grid de 6 tarjetas

Vista por defecto al abrir Configuración. Un grid responsive de 6 tarjetas (una por
sección), ordenadas por prioridad de puesta a punto:

1. Municipalidad
2. Áreas
3. Numeración
4. Membrete
5. Usuarios
6. Feriados

Cada tarjeta muestra:

- **Icono + nombre** de la sección (iconos existentes: Landmark, Building2, Hash,
  FileSpreadsheet, UserCog, CalendarDays).
- **Badge de estado**: `ok` (verde, completo), `warn` (ámbar, falta algo), `mute`
  (gris, sin datos). Mismo código de color que los indicadores del sidebar actual.
- **Métrica clave** (una línea): lo más útil para esa sección.
  - Municipalidad: "Perfil completo" o "Faltan N campos" + PAC total si existe.
  - Áreas: "N oficinas" o "Sin oficinas".
  - Numeración: "M/N configuradas" o "Sin configurar".
  - Membrete: "M/N con membrete" o "Sin membrete".
  - Usuarios: "N usuarios" + desglose por rol, o "Sin usuarios".
  - Feriados: "N feriados {año}" o "Sin registrar".
- **"Qué falta"** (si incomplete): una línea corta con lo más urgente.
- **Último cambio** (opcional): "Editado hace Xh" si el dato está disponible.

La tarjeta es clickeable: lleva a esa sección (`setActive(section)`).

### CTA "Guíame"

Si hay secciones incompletas, encima del grid:

> "N secciones necesitan configuración. **[Guíame →]**"

Si todo está completo: el CTA desaparece y aparece un sutil "Configuración completa".

### Búsqueda

Barra de búsqueda arriba a la derecha del grid, con hint `Ctrl+K`. Al clic o atajo,
abre el command palette (ver sección Búsqueda).

### Layout responsive

- Desktop (≥1024px): 3 columnas × 2 filas.
- Tablet (640-1023px): 2 columnas × 3 filas.
- Móvil (<640px): 1 columna × 6 filas.

## Diseño: Vista de sección

### Sidebar (264px, izquierda)

Mantiene la estructura actual con un añadido arriba del todo:

- **Botón "← Resumen"** (nuevo): vuelve al landing. Sustituye al indicador de progreso
  circular que hoy ocupa la cabecera del sidebar.
- **Indicador de progreso**: pasa al header de la sección, como badge `5/6`.
- **Navegación agrupada por dominio**: igual que hoy (Entidad / Oficinas y documentos
  / Acceso / Sistema), con badges por sección.

### Header de sección

Mantiene icono + título + descripción, pero ahora incluye el progreso global como
badge (`5/6`) además del estado de la sección activa.

### Responsive (tablet < 1024px)

El sidebar de 264px se colapsa a una **barra horizontal de pestañas** arriba del
contenido:

```
← Resumen   Municipalidad │ Áreas │ Numeración │ …
```

Las agrupaciones por dominio desaparecen en tablet (no caben); el orden se mantiene.
En móvil (<640px) las pestañas se vuelven un `<select>` desplegable.

## Diseño: Modo "Guíame"

Tour opcional, no invasivo. El admin trabaja en la interfaz real mientras un widget
le dice qué toca.

### Widget flotante (esquina inferior derecha)

Muestra:

- **Título**: "Guía de puesta a punto" + paso actual `N/6`.
- **Barra de progreso** del tour.
- **Sección actual**: nombre + una frase de por qué importa (no "rellena X", sino
  "sin áreas no hay numeración").
- **Botones**: "Saltar" (avanza sin completar) y "Entendido" (navega a la sección).

### Flujo

1. Al pulsar "Guíame" en el resumen, el workspace identifica secciones incompletas
   (usa el mismo `listas` que ya existe).
2. **Orden sugerido** por dependencias: Municipalidad → Áreas → Numeración → Membrete
   → Usuarios → Feriados. Saltando las completas.
3. Navega a la primera sección incompleta.
4. Cuando la sección se completa (detectado via `summary`), el widget avanza solo:
   "✓ Áreas listo. Ahora: Numeración".
5. Se puede saltar una sección o cerrar el tour en cualquier momento.

### Persistencia

- Estado del tour (`activo`, `pasoActual`) en `localStorage`.
- Al reabrir Configuración, si el tour quedó a medias, aparece "Reanudar guía" en el
  resumen.
- Cerrar el tour definitivamente limpia el estado.

### Alcance

El guía trabaja a **nivel sección**, no a nivel campo. Decidir "qué campo sigue"
dentro de Municipalidad (20+ campos) es lógica de cada pestaña, no del shell. El guía
dice "completa esta sección" y avanza cuando lo esté.

## Diseño: Búsqueda + atajos

### Command palette (Ctrl+K)

Overlay centrado al pulsar `Ctrl+K` o clic en la barra de búsqueda. UI tipo Spotlight:

- Input de texto en la parte superior.
- Lista de resultados filtrados por la consulta.
- Cada resultado muestra: icono de sección + label + descripción + sección padre.
- Navegación con `↑↓`, selección con `Enter`, cierre con `Esc`.

### Registro estático de campos

Archivo `lib/configuracion-search.ts` con ~30-40 entradas:

```typescript
type SearchEntry = {
  section: SectionKey;
  label: string;
  desc: string;
  selector?: string;  // para scroll-to al seleccionar
};

export const CONFIG_SEARCH: SearchEntry[] = [
  { section: "municipalidad", label: "RUC", desc: "Identificación tributaria (11 dígitos)", selector: "[data-campo-entidad=ruc]" },
  { section: "municipalidad", label: "PAC total", desc: "Monto del Plan Anual de Contrataciones", selector: "[data-campo-entidad=pacMontoTotal]" },
  { section: "municipalidad", label: "UIT", desc: "Unidad impositiva tributaria del ejercicio", selector: "[data-campo-entidad=uitValor]" },
  // …
];
```

**Por qué estático y no crawling dinámico del DOM:**

- Los campos de configuración son legales/de dominio: cambian rara vez.
- Predecible y rápido (sin overhead en runtime).
- Duplica como documentación: la lista completa de qué se puede configurar.
- Ya existen los `data-campo-entidad` en MunicipalidadTab — se reaprovechan.

### Flujo al seleccionar un resultado

1. Si `active !== entry.section`, cambia a esa sección.
2. Si `entry.selector` existe, hace scroll suave al campo y le da foco (con un pequeño
   `requestAnimationFrame` para esperar el render).
3. Si no hay selector (resultado a nivel sección), solo entra a la sección.

### Atajos de teclado

| Atajo | Acción |
|---|---|
| `Ctrl+K` | Abrir/cerrar palette |
| `↑` `↓` | Navegar resultados en el palette |
| `Enter` | Ir al resultado seleccionado |
| `Esc` | Cerrar palette / diálogos |
| `?` | Mostrar ayuda de atajos (overlay pequeño) |

Los atajos se registran con un `useEffect` global en el workspace. El palette, cuando
está abierto, captura `↑↓` y `Enter` con su propio handler.

## Componentes

### Nuevos

| Archivo | Responsabilidad |
|---|---|
| `app/components/configuracion/resumen-view.tsx` | Grid de 6 tarjetas + estado vacío + CTA "Guíame". Recibe `summary`, `onSelect`, `onGuia`. |
| `app/components/configuracion/command-palette.tsx` | Overlay de búsqueda. Recibe `open`, `onClose`, `onNavigate`. Filtra `CONFIG_SEARCH`. |
| `app/components/configuracion/guia-tour.tsx` | Widget flotante. Recibe `listas`, `active`, `onNavigate`, `onClose`. Persiste en localStorage. |
| `lib/configuracion-search.ts` | Registro estático `CONFIG_SEARCH` + tipos. |

### Modificados

| Archivo | Cambio |
|---|---|
| `configuracion-workspace.tsx` | Rama `active === "resumen"` → `ResumenView`. Estado del tour (`guiaActiva`, `pasoGuia`). Estado del palette (`paletteOpen`). `useEffect` para atajos de teclado. El sidebar recibe `onVolverResumen`. El `View` type se amplía con `"resumen"`. |
| `admin-settings.tsx` | Sin cambios. |
| `oficinas-settings.tsx` | Sin cambios. |
| `app/tailwind.css` | Añadir `@source` para los 3 nuevos archivos. |

## Lógica testeable

Funciones puras que se extraen de los componentes para testearlas en Vitest sin red ni
BD, siguiendo el patrón del proyecto (`for (const p of PROCESOS_SELECCION)`):

1. **`ordenGuia(listas: Record<SectionKey, boolean>): SectionKey[]`**
   Dado el estado de completitud, devuelve el orden sugerido saltando completas.
   Test: cada combinación de completitud produce el orden esperado.

2. **`filtrarConfig(query: string, entries: SearchEntry[]): SearchEntry[]`**
   Filtra el registro por texto (coincidencia case-insensitive en label, desc y
   section). Prioriza coincidencias en label > desc > section.
   Test: queries típicas ("RUC", "pac", "feriado") devuelven las entradas correctas.

3. **`metricaSeccion(key: SectionKey, summary: Summary): { texto: string; tono: Indicador }`**
   Extrae la métrica y el tono a mostrar en cada tarjeta del resumen.
   Test: recorre las 6 secciones con varios estados de `summary`.

## Edge cases

- **Todo completo:** tour oculto. Resumen muestra sello "Configuración completa". El
  botón "Guíame" desaparece.
- **Todo vacío:** tour empieza desde Municipalidad. Resumen muestra 6 tarjetas en
  tono `warn` o `mute`.
- **Tour cerrado a medias:** "Reanudar guía" en el resumen. El paso actual persiste
  en localStorage.
- **Búsqueda sin resultados:** estado vacío en el palette: "Nada coincide con «X»".
- **Navegación con cambios sin guardar:** el diálogo de confirmación existente
  (`saltoPendiente`) sigue funcionando al cambiar de sección desde el palette o el
  resumen.
- **Móvil (<640px):** palette a pantalla completa, sidebar → `<select>`, resumen en 1
  columna.

## Fuera de alcance (YAGNI)

- **Resaltado de campos individuales en el tour:** el guía trabaja a nivel sección.
- **Búsqueda de valores** (ej. "buscar dónde dice S/ 5000"): busca etiquetas y
  descripciones, no datos.
- **Permisos por sección:** todas las secciones son admin-only; no hay secciones que
  un admin no pueda ver.
- **Auditoría de cambios** (quién cambió qué): es funcionalidad de backend, no del
  shell.
- **Tour multisección (resaltar la siguiente acción dentro de una sección):** cada
  pestaña tendrá su propio spec en sub-proyectos posteriores.

## Orden de implementación sugerido

1. `View` type + rama `resumen` en el workspace (sin UI nueva, solo estructura).
2. `ResumenView` + `metricaSeccion` (grid de tarjetas).
3. Botón "← Resumen" en el sidebar + progreso global en el header.
4. Responsive del sidebar (pestañas/select).
5. `CommandPalette` + `CONFIG_SEARCH` + atajos de teclado.
6. `GuiaTour` + persistencia.
7. Tests de las 3 funciones puras.
8. Tailwind `@source` + verificación (lint + typecheck + test).
