# Numeración de A6/A7/A8 desde la oficina del usuario — Spec de diseño

**Fecha:** 2026-08-06
**Estado:** Aprobado por el usuario

## Contexto

Los campos de número de documento de los pasos A6 (`documento_designacion`),
A7 (`numero_solicitud`) y A8 (`numero_informe`) deben tomar la sugerencia y el
correlativo de **Configuración → Numeración**, de la **oficina a la que pertenece
el usuario autenticado** (no de la oficina DEC fija).

Estado actual:

- La sugerencia (`/api/numeracion/sugerido`) y el consumo (`emitirNumeroInforme`)
  se anclan a la oficina con `gestiona_contrataciones=true` (la DEC).
- El front solo pide la sugerencia al abrir **A8**; la reutiliza para A7 (misma
  serie INFORME). **A6 no recibe sugerencia ni consume**: el número se escribe a
  mano y se imprime tal cual en el `.docx`.
- Numeración guarda por `(oficina, tipo, año)` con `siguiente` («Empieza en») y
  `sufijo` («Sigla propia»). Tipos: OFICIO, INFORME, CARTA, MEMORANDUM, CONTRATO
  (`lib/document-number.ts:29`).

## Principio

- Sugerencia y consumo se toman de la **oficina del usuario autenticado**
  (`user.oficinaId`), con **fallback a la DEC** si esa oficina no tiene counter
  del tipo configurado en Numeración.
- Tipos: **A7 y A8 → INFORME**. **A6 → MEMORANDUM** (oficial_compra) o
  **INFORME** (comité/jurado), coincidiendo con el prefijo/label dinámico
  (`designacion-evaluadores.ts:38-47`).

## Cambios

### 1. `/api/numeracion/sugerido` (`app/api/numeracion/sugerido/route.ts`)
- Resolver la oficina: `user.oficinaId` primero; si esa oficina no tiene counter
  del `tipo` pedido, cae a la DEC (`gestiona_contrataciones=is.true`).
- La firma no cambia (ya acepta `tipo` por query).

### 2. Generalizar `emitirNumeroInforme` (`lib/informe-aprobacion-datos.ts:557`)
- Nuevos params opcionales: `oficinaId?: string | null` y
  `tipo?: "INFORME" | "MEMORANDUM"`.
- Query del counter (`expedientes_doc_counters?...&tipo=eq.{tipo}`) y
  `formatDocumentNumber({ tipo })` dejan de ir fijos a INFORME.
- Si `tipo` no se pasa y `hito === "A6"`, se deriva de `data.tipo_evaluador`
  (oficial_compra → MEMORANDUM, resto → INFORME).
- Resolución de oficina: si `oficinaId` tiene counter del tipo/año, esa; si no,
  DEC. Mantiene idempotencia (`{campo}_emitido`), respeta un número propio del
  usuario, y consume vía RPC `consumir_correlativo` con el tipo correcto.
- Se admite `"A6"` en la unión del parámetro `hito`.

### 3. Front `app/components/fase-panel.tsx`
- **A6**: cuando `code==="A6"` y `tipo_evaluador ∈ {oficial_compra, comite,
  jurado}`, pedir la sugerencia con `tipo=MEMORANDUM` (oficial) o `tipo=INFORME`
  (comité/jurado); sembrar `documento_designacion` +
  `documento_designacion_semilla` si el campo está vacío. Re-pedir al cambiar
  `tipo_evaluador`.
- **A7/A8**: sin cambios funcionales (siguen pidiendo INFORME); la oficina pasa
  a ser la del usuario vía el endpoint.

### 4. Endpoints de descarga (consumo real)
- A7 `certificacion-xlsx/route.ts:33` y A8 `informe-aprobacion/route.ts:29`:
  pasar `oficinaId: user.oficinaId` y `tipo: "INFORME"`.
- **A6** `evaluadores-docx/route.ts`: cuando `kind==="memo"` y `miembroIndex ==
  null` (descarga de grupo, la que se archiva), llamar
  `emitirNumeroInforme(user, id, "A6", "documento_designacion", year,
  { oficinaId: user.oficinaId })`. La jurada y el consentimiento no consumen.

### 5. Casos borde
- Usuario sin `oficinaId` → fallback DEC → si la DEC tampoco tiene counter, sin
  sugerencia (campo vacío y editable a mano).
- A6 sin `tipo_evaluador` → no se sugiere número.
- Si el usuario ya escribió su número (distinto de la semilla), se respeta y no
  se consume el counter.

## Verificación
- `npx tsc --noEmit`, `npx eslint`, `npx vitest run`, `npm run build`.
- Manual: A6 oficial (MEMORANDUM), A6 comité (INFORME), A7 y A8, con la oficina
  del usuario con y sin counter del tipo; verificar la oficina con fallback a la
  DEC y el no consumo en la vista previa.

## Alcance
No se toca el modelo legal (la DEC sigue siendo la responsable de A6/A7/A8); se
cambia solo la oficina cuya serie de Numeración se aplica. No hay commits sin
visto bueno del usuario.
