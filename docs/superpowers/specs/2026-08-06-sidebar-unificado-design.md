# Sidebar unificado — Spec de diseño

**Fecha:** 2026-08-06
**Estado:** Aprobado por el usuario

## Contexto

El menú lateral global está duplicado en dos archivos que han divergido:

- `app/components/app-shell.tsx` (server component, **en producción**) renderiza el
  sidebar inline. Tiene la caja de usuario rica (avatar por rol, oficina, jefe,
  scope) y badges (Alertas, Bandeja de necesidades), pero **sin** colapso, sin menú
  móvil y sin atajos.
- `app/components/sidebar.tsx` (client component, **código muerto**: ningún archivo
  lo importa) tiene colapso persistido, atajos `[`/`]`/`Ctrl+\`, menú móvil con
  scrim e items admin bloqueados con candado, pero una caja de usuario pobre y **sin
  estilos CSS** (`.collapsed`, `.sidebarMobileToggle`, etc. no existen en
  `styles.css`).

Ambos duplican el array de navegación (20 items), con riesgo de divergencia.

Objetivo: **unificar** en un único componente cliente, **recuperar** colapso, menú
móvil y atajos, y **pulir** el look oscuro actual. Decisiones acordadas con el
usuario:

- Look: pulir el estilo teal oscuro actual (272px, gradiente `--nav-bg`), no
  rediseñar la paleta.
- Items de Administrar: **seguir filtrando** para no-admins (no se muestran
  candados).
- `YearSelector` permanece en el topbar (estado actual de producción).

## Arquitectura

### Fuente única de navegación: `lib/navegacion.ts`

Nuevo módulo `.ts` (sin JSX; guarda referencias a componentes lucide) que exporta
`NAVEGACION` con el mismo contenido que el array `navigation` de `app-shell.tsx:117`
(6 secciones, 20 items) y un tipo derivado:

```ts
export type ActiveId =
  (typeof NAVEGACION)[number]["items"][number]["id"];
```

Se borra el array duplicado de `app-shell.tsx` y la estructura de `sidebar.tsx`.

### `app/components/sidebar.tsx` (reescrito, client component)

Props:

```ts
type SidebarProps = {
  active: ActiveId;
  sections: NavSection[];            // ya filtradas por rol en el servidor
  user: SessionUser | null;
  newsCount: number;
  bandejaNecesidades: number;
  officeName: string | null;
};
```

Renderiza (en orden):

1. `<button className="sidebarMobileToggle">` (hamburguesa; solo visible ≤980px,
   `position: fixed`).
2. `{mobileOpen && <div className="sidebarMobileScrim" />}`.
3. `<aside className="sidebar ..." data-collapsed>` con:
   - `<div className="sidebarTop">`: `Link.brand` + `<button className="sidebarCollapseBtn">`
     (colapso manual, `PanelLeftClose`/`PanelLeftOpen`).
   - `nav.nav` con las secciones recibidas.
   - userBox **rico** (portado de `app-shell.tsx:243-295`): avatar por rol,
     identidad, badge de rol, oficina, jefe, scope, signout.

Estado: `collapsed` (persistido en `ace-sidebar-collapsed`), `mobileOpen`.
Atajos: `[` y `]` alternan colapso (ignora inputs/textareas/editable); `Ctrl+\`
también. Al navegar (`onClick` de cada Link) se cierra `mobileOpen`.

### `app/components/app-shell.tsx` (server component)

Sin cambios en su papel: resuelve `getSessionUser`, `countRecentNews`,
`getOfficeName`, `contarNecesidadesPendientes`; **filtra** `NAVEGACION` por
`isAdmin` (la decisión de autorización queda en el servidor) y renderiza
`<Sidebar ...>` en lugar del `aside` inline. Conserva `skipLink`, `main.shell`,
topbar (eyebrow, título, `YearSelector`, action) y `section.content`.

## Comportamiento

- **Colapso desktop** (>980px): `272px ↔ ~72px`. En colapso: labels ocultos
  (`.navLabel`), items centrados solo-icono con `title`, badges visibles, userBox
  reducido a avatar con tooltip.
- **Móvil** (≤980px): el sidebar pasa a **drawer** fijo (`position: fixed`,
  `translateX(-100%)` → `mobileOpen` → `translateX(0)`), con scrim de cierre y
  botón hamburguesa fijo arriba-izquierda. Reemplaza el sidebar estático actual de
  la media query de línea 8498.
- **Items admin**: filtrados en el servidor (sin candados).

## Pulido visual (look oscuro actual)

- Header del sidebar: card `brand` existente + botón de colapso a la derecha.
- Nav: mismas clases oscuras (`.nav`, `.nav a.active` con gradiente teal).
- userBox rico intacto; en colapso solo avatar.
- Transición suave de ancho en colapso.

## CSS

Bloque nuevo al **final** de `app/styles.css` (gana por orden de cascada) con:

- `.sidebarTop`, `.sidebarCollapseBtn`, `.brandText`.
- `.sidebar.collapsed` (ancho 72px, `.navLabel` oculto, nav centrado, userBox
  compacto) y `.sidebar[data-collapsed]`.
- `.navLabel`, `.sidebarMobileToggle`, `.sidebarMobileScrim`, `.sidebar.mobileOpen`.
- Media query móvil: drawer en lugar de sidebar estático.

Se ajusta la media query responsive existente (línea ~8498) para quitar el
comportamiento estático y dejar paso al drawer.

## Verificación

- `npx tsc --noEmit`
- `npx eslint app/components/sidebar.tsx app/components/app-shell.tsx lib/navegacion.ts`
- `npx vitest run`
- Revisión visual en el preview (exige sesión): colapso, atajos, móvil, badges.

## Alcance

No se toca: `YearSelector`, topbar, `skipLink`, el array de items (solo se mueve),
ni las rutas admin. No hay commits sin visto bueno del usuario.
