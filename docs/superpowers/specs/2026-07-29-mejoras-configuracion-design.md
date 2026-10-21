# Mejoras del módulo Configuración — Spec maestro

**Fecha:** 2026-07-29
**Cubre:** Sub-proyectos 2-6 (Municipalidad, Usuarios, Oficinas, Feriados, Cross-cutting)
**Estado:** Pendiente de revisión
**Spec relacionado:** `2026-07-29-shell-configuracion-design.md` (Shell, ya aprobado)

## Contexto

Este spec cubre 21 mejoras de funcionalidad, UX y UI identificadas tras una revisión
profunda del código del módulo Configuración (post-migración a Tailwind). Se agrupan
por sub-proyecto para permitir implementación incremental. Cada mejora es
independiente: se puede shippear por separado.

El orden de implementación sugerido va de mayor impacto / menor esfuerzo a menor
impacto / mayor esfuerzo.

---

## 1. Cross-cutting (aplica a todo el módulo)

### 1.1 Componente `SaveStatus` compartido

**Problema:** Cada pestaña implementa su propio indicador de guardado con patrones
distintos. Municipalidad tiene un `SaveStatus` de 4 estados (`saving/saved/dirty/error`).
Usuarios usa toasts. Áreas/Numeración usan `SavedBadge` (auto-oculta a los 30s).
Feriados no tienen indicador.

**Solución:** Extraer el componente `SaveStatus` de `municipalidad-tab.tsx:1035` a un
componente compartido en `app/components/configuracion/save-status.tsx`. Estandarizar
los 4 estados visuales. Las pestañas que usan botón manual (Áreas, Numeración,
Feriados) lo muestran junto al botón. Las de auto-guardado (Municipalidad) lo muestran
en el pie.

**Archivos:**
- Nuevo: `app/components/configuracion/save-status.tsx`
- Modificados: `municipalidad-tab.tsx`, `feriados-tab.tsx`, `areas-tab.tsx`,
  `numeracion-tab.tsx`, `admin-settings.tsx`

### 1.2 Estados vacíos con guía

**Problema:** Los empty states de Áreas, Numeración y Usuarios son descriptivos pero no
orientan a la acción. El de Membrete (`membrete-tab.tsx:79`) sí: explica el paso previo
y el siguiente.

**Solución:** Patrón `EmptyState` con 3 partes: qué falta, por qué importa, qué hacer
ahora (botón o link). Aplicar a las pestañas que tienen listas vacías.

**Archivos:**
- Nuevo: `app/components/configuracion/empty-state.tsx`
- Modificados: `areas-tab.tsx`, `numeracion-tab.tsx`, `usuarios-tab.tsx`,
  `modelos-requerimiento.tsx`

### 1.3 Tokens de radio y tipografía

**Problema:** Tras la migración hay 12 valores de `border-radius` y 12 de tamaño de
fuente ad hoc (`rounded-[6px]`, `rounded-[7px]`, `text-[10.5px]`, `text-[11.5px]`, …).

**Solución:** Definir 4 radios y 6 tamaños en `app/tailwind.css` bajo `@theme`:

```css
@theme {
  --radius-sm: 6px;   /* inputs compactos, badges internos */
  --radius-md: 9px;   /* botones, inputs estándar */
  --radius-lg: 12px;  /* paneles, tarjetas */
  --radius-xl: 16px;  /* modales, secciones grandes */

  --text-xs: 11px;
  --text-sm: 12.5px;
  --text-base: 13.5px;
  --text-md: 14.5px;
  --text-lg: 16px;
  --text-xl: 18px;
}
```

Después reemplazar progresivamente `rounded-[8px]` → `rounded-md`, `text-[12.5px]` →
`text-sm`, etc. La migración puede ser incremental: aplicar a un sub-módulo a la vez.

**Archivos:** `app/tailwind.css` + migración progresiva en cada `.tsx`.

### 1.4 Accessibility — labels en switches

**Problema:** El `switchControl` de `procesos-modal.tsx:390` usa un `<label>` que envuelve
el `<input>` pero sin `aria-label` explícito en el track. Los lectores de pantalla no
anuncian claramente "Activado/Desactivado".

**Solución:** Añadir `role="switch"` y `aria-checked` al track visible, y `aria-label`
descriptivo al `<input>` (ej. "Activar Licitación Pública"). El toggle de Numeración
(`numeracion-tab.tsx`) ya usa un patrón mejor; alinear el de Procesos al mismo.

**Archivos:** `procesos-modal.tsx`, `numeracion-tab.tsx`.

---

## 2. Municipalidad

### 2.1 Sub-secciones con navegación por anchors

**Problema:** El formulario de `municipalidad-tab.tsx` (1084 líneas) es un solo scroll
con 5 bloques: datos de entidad, tipo de gobierno, gerente, resoluciones PIA/PAC,
montos/UIT, vista previa. No hay navegación interna.

**Solución:** Añadir una mini-nav de anchors (sticky, lado izquierdo o como pills
horizontales) que enlaza a cada bloque: `#datos`, `#gobierno`, `#gerente`, `#pac`,
`#preview`. El checklist existente (`municipalidad-tab.tsx:655`) ya usa
`data-campo-entidad` y `irACampo()` — extender el mismo patrón a nivel sección.

No es un wizard: el auto-guardado sigue funcionando. Los anchors solo hacen scroll
suave + resaltan la sección activa (con `IntersectionObserver`).

**Archivos:** `municipalidad-tab.tsx`.

### 2.2 Vista previa en columna lateral (split-view)

**Problema:** La "vista previa — cómo se verá en los documentos"
(`municipalidad-tab.tsx:968`) está al final del formulario. El admin escribe arriba,
hace scroll para ver el resultado, vuelve arriba para corregir.

**Solución:** En desktop (≥1024px), mover la vista previa a una columna lateral
`position: sticky` a la derecha del formulario. El layout pasa de 1 columna a 2
(`grid grid-cols-[1fr_320px]`). En tablet/móvil, la vista previa vuelve a su posición
actual (al final) o se muestra con un toggle "Editar / Previsualizar".

El contenido de la vista previa no cambia: reutiliza el componente `Dato` existente.

**Archivos:** `municipalidad-tab.tsx`.

### 2.3 Claridad en PAC de obras (calculado, no editable)

**Problema:** El campo "PAC obras" es `readOnly` con un placeholder. Los admins no
entienden por qué no pueden editarlo.

**Solución:** Añadir una micro-ayuda permanente bajo el campo (no placeholder, que
desaparece al tener valor): "Calculado: PAC total − bienes y servicios. Para ajustar,
modifica uno de los dos." Icono de info opcional.

**Archivos:** `municipalidad-tab.tsx` (línea ~889).

### 2.4 Promover el umbral del contrato menor

**Problema:** El cálculo de 8 UIT (`municipalidad-tab.tsx:950`), que decide si una
contratación puede agruparse por ítems, está en una tarjeta informativa al final del
bloque PAC.

**Solución:** Extraerlo a una "tarjeta destacada" visible nada más entrar a la
sección (antes del formulario), con el importe grande y la explicación debajo.
También incluirlo en el resumen ejecutivo del shell.

**Archivos:** `municipalidad-tab.tsx`, y futuro `resumen-view.tsx`.

---

## 3. Usuarios

### 3.1 Drawer lateral para edición

**Problema:** Cada usuario es una tarjeta expandible inline
(`usuarios-tab.tsx:477`). Al editar, el formulario crece dentro de la lista y empuja
todo hacia abajo.

**Solución:** Al pulsar "Editar" en un usuario, abrir un drawer lateral derecho
(`position: fixed`, 400-480px de ancho, overlay semi-transparente detrás) con el
formulario completo. La lista queda visible e inmóvil. El drawer usa el mismo patrón
que `ConfirmDialog` pero para edición.

Beneficio: la lista no se deforma, el contexto visual se mantiene, y se puede cerrar
con Esc (como los modales existentes).

**Archivos:** `usuarios-tab.tsx`. Posible nuevo componente `user-edit-drawer.tsx`.

### 3.2 Matriz visual de permisos

**Problema:** Los permisos por rol se muestran como texto monoespaciado
(`usuarios-tab.tsx:358`), como si fuera la API cruda.

**Solución:** Reemplazar el bloque `<code>` por una tabla visual: filas = capacidades
(ver expedientes, editar, aprobar, etc.), columnas = roles, celdas = ✓/✗ con color.
Los datos ya están en `rolePermissions` y `lib/permisos-contratacion.ts`.

```text
                  Admin   Jefe   DEC   Legal   ...
Ver expedientes     ✓      ✓      ✓     ✓
Editar expediente   ✓      ✓      ✓     —
Aprobar DEC         ✓      ✓      —     —
```

**Archivos:** `usuarios-tab.tsx`. Posible nuevo helper en
`lib/configuracion-types.ts` para aplanar permisos a matriz.

### 3.3 UX de contraseñas temporales

**Problema:** Las credenciales generadas se muestran en un panel y el aviso dice "solo
se muestran una vez". Si el admin no las copia, se pierden al crear otro usuario.

**Solución:**
- Botón "Copiar" junto a cada credencial con feedback visual (cambia a "Copiado ✓"
  durante 2s).
- La credencial NO se elimina al crear otro usuario (acumula, como ya hace
  `createdCredentials`).
- Botón "Ya la entregué" para descartar explícitamente.
- Botón "Descargar .txt" para guardar todas las credenciales pendientes como archivo.

**Archivos:** `usuarios-tab.tsx` (panel de credenciales), `admin-settings.tsx`.

### 3.4 Indicador de fortaleza de contraseña

**Problema:** Las contraseñas generadas son aleatorias pero no hay feedback de
fortaleza.

**Solución:** Mostrar una barra de fortaleza (4 niveles: débil/aceptable/fuerte/muy
fuerte) junto a la contraseña generada. Como son aleatorias de 16+ caracteres, siempre
serán "fuerte" o "muy fuerte", pero el feedback visual da confianza y educará al admin
sobre qué hace una buena contraseña.

**Archivos:** `usuarios-tab.tsx`. Helper de cálculo en `lib/password-strength.ts`.

---

## 4. Oficinas

### 4.1 Simplificar jerarquía visual del modal de Procesos

**Problema:** Cada tarjeta de proceso (`procesos-modal.tsx`) muestra switch, nombre
editable, tags, grid de 4 campos y detalles avanzados, todo con el mismo peso visual.

**Solución:**
- Reducir el grid visible por defecto a 2 campos: Objeto + Sustento legal.
- Categoría y Descripción operativa pasan dentro de "Opciones avanzadas" (junto a
  Código y Orden, que ya están ahí).
- El header de la tarjeta (switch + nombre + tags) se hace más compacto: menos
  padding, fuente ligeramente menor.
- Resultado: la tarjeta "respira" más; lo importante (nombre, activo/inactivo) se
  distingue de lo secundario.

**Archivos:** `procesos-modal.tsx`.

### 4.2 Mini-mockup en Numeración

**Problema:** El preview del correlativo (`numeracion-tab.tsx:271`) muestra
`DEC N° 001-2026-MDCH/LOG` como texto. No muestra dónde aparece en un documento real.

**Solución:** Añadir un mini-mockup visual: una hoja estilizada (CSS puro, borde
gris, proporción A4) con el número en la esquina superior derecha y una marca de
agua "Ejemplo" tenue. No es un PDF real — es una ilustración contextual.

**Archivos:** `numeracion-tab.tsx`.

### 4.3 Preview de membrete más visible

**Problema:** El preview del PDF membretado (`membrete-tab.tsx:222`) es de 240px de
alto. El botón "Ver a pantalla completa" existe pero es poco visible.

**Solución:**
- Aumentar el preview a 320px en desktop.
- Hacer el botón "Ver a pantalla completa" más prominente (botón primario en vez de
  secundario, icono más grande).
- Añadir overlay de zoom al hacer clic en el preview (no solo el botón).

**Archivos:** `membrete-tab.tsx`.

### 4.4 Drag & drop en Modelos de requerimiento

**Problema:** La subida de PDF (`modelos-requerimiento.tsx`) usa solo un botón. El
drag & drop es el estándar esperado.

**Solución:** Zona de drop con borde discontinuo que ocupa el ancho del panel. Al
arrastrar un archivo encima, el borde se vuelve sólido y el fondo se tiñe suave. Al
soltar, dispara el mismo `upload(file)` que ya existe. El botón "Subir PDF" queda
dentro de la zona como fallback para clic.

**Archivos:** `modelos-requerimiento.tsx`.

### 4.5 Resaltar filas con error en importación de Áreas

**Problema:** En el preview de importación (`areas-import-modal.tsx`), los errores se
listan en un bloque aparte pero las filas problemáticas no se destacan en la tabla.

**Solución:** Las filas con error se pintan con fondo rojo suave
(`bg-danger-soft/50`) y un icono de alerta al inicio. Al pasar el ratón, tooltip con
el mensaje de error específico.

**Archivos:** `areas-import-modal.tsx`.

---

## 5. Feriados

### 5.1 Importación del calendario oficial

**Problema:** Los feriados nacionales del Perú se meten a mano uno por uno. El MEF
publica la lista cada año.

**Solución:** Mantener un JSON estático en `lib/feriados-oficiales/` con los feriados
nacionales por año (actualizable en el repo cuando sale el DU). Botón "Importar
feriados oficiales de {año}" que los precarga. El admin confirma y se guardan;
después puede añadir los locales.

El JSON no es una API externa: vive en el repo y se actualiza con un commit. Es la
lista oficial del MEF, no cambios dinámicos.

```json
[
  { "fecha": "2026-01-01", "nombre": "Año Nuevo" },
  { "fecha": "2026-05-01", "nombre": "Día del Trabajador" },
  ...
]
```

**Archivos:**
- Nuevo: `lib/feriados-oficiales/2026.json` (y años según se necesiten)
- Nuevo: `lib/feriados-oficiales/index.ts` (helper para cargar el año)
- Modificados: `feriados-tab.tsx`

### 5.2 Detección de duplicados

**Problema:** Se puede añadir el mismo feriado dos veces (misma fecha, diferente
nombre). No hay validación.

**Solución:** Al introducir una fecha que ya existe en la lista, mostrar un aviso
inline bajo el campo: "Ya existe un feriado en esta fecha: «Día de la Independencia».
¿Añadir de todas formas?" con un checkbox o botón "Añadir de todas formas". No bloquea: avisa.

**Archivos:** `feriados-tab.tsx`.

---

## Orden de implementación

Ordenado por impacto / esfuerzo (mayor impacto y menor esfuerzo primero):

### Fase 1 — Quick wins (bajo esfuerzo, alto impacto)
1. **1.3** Tokens de radio y tipografía (definición en `@theme`).
2. **5.2** Detección de feriados duplicados.
3. **2.3** Claridad en PAC de obras.
4. **1.1** `SaveStatus` compartido (extraer de Municipalidad).

### Fase 2 — Mejoras medias (esfuerzo medio, alto impacto)
5. **3.2** Matriz visual de permisos.
6. **5.1** Importación del calendario oficial.
7. **4.4** Drag & drop en Modelos.
8. **4.5** Resaltar filas con error en importación.
9. **1.2** Estados vacíos con guía.
10. **2.4** Promover umbral del contrato menor.

### Fase 3 — Rediseños (mayor esfuerzo)
11. **2.1** Sub-secciones con anchors en Municipalidad.
12. **2.2** Vista previa split-view en Municipalidad.
13. **3.1** Drawer lateral para edición de Usuarios.
14. **3.3** UX de contraseñas temporales.
15. **4.1** Simplificar jerarquía del modal de Procesos.

### Fase 4 — Pulido final
16. **3.4** Indicador de fortaleza de contraseña.
17. **4.2** Mini-mockup en Numeración.
18. **4.3** Preview de membrete más visible.
19. **1.4** Accessibility en switches.
20. **1.3** Migración progresiva de tokens (aplicar a cada sub-módulo).

---

## Fuera de alcance (YAGNI)

- **Auditoría de cambios** (quién cambió qué y cuándo): es backend, no UI.
- **Permisos por sección**: todas las secciones son admin-only.
- **Búsqueda de valores** (encontrar dónde dice "S/ 5000"): busca etiquetas, no datos.
- **Exportación de la configuración completa**: útil pero no prioritaria.
- **Multi-entidad** (varias entidades en una sola instancia): cambio arquitectónico
  mayor, fuera de alcance.
- **Wizard forzado de puesta a punto**: el tour "Guíame" del shell ya cubre esto de
  forma opcional.

---

## Testing

Cada mejora debe pasar:
- `npm run lint` — 0 errores.
- `npm run typecheck` — limpio.
- `npm run test` — tests existentes siguen pasando. Añadir tests para:
  - `feriados-oficiales/index.ts`: el helper carga el año correcto.
  - `password-strength.ts`: los 4 niveles se calculan bien.
  - Matriz de permisos: el aplanado produce la estructura esperada.
  - Detección de duplicados: fecha repetida → aviso.

---

## Dependencias con el spec del Shell

Algunas mejoras se benefician del shell rediseñado pero NO lo bloquean:
- **2.4** (umbral en resumen ejecutivo) necesita `resumen-view.tsx` del shell.
- **1.1** (`SaveStatus`) puede vivir sin el shell; el shell solo lo consume.

Orden recomendado: implementar el **shell primero**, después este spec. Pero si se
quiere paralelizar, las Fases 1 y 2 se pueden empezar sin el shell.
