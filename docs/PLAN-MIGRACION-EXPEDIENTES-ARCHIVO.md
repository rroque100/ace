# Plan de migración de esquema — `/expedientes-archivo`

> **Objetivo:** unificar el módulo en un **único esquema de datos canónico** (el del
> SDD §4, ya usado por la UI y por 3 endpoints). Hoy conviven dos esquemas
> incompatibles y el camino crítico de escritura/lectura quedó en el esquema viejo,
> por lo que **el alta descarta casi todos los datos del wizard** (ubicación física,
> persona, serie, SGD).
>
> **Estado del repo:** localhost, sin auth productiva, sin presión de prod
> (ver memoria `no-github-push-sin-pedir`). Esto permite una migración directa sin
> ventana de compatibilidad larga, pero el plan igual ordena los pasos para que sea
> seguro si se aplicara contra datos reales.

---

## 1. Diagnóstico: qué esquema usa cada archivo hoy

| Archivo | Esquema actual | Acción |
|---|---|---|
| `lib/expedientes-archivo.ts` (`ExpedienteArchivo`, catálogos) | **VIEJO** | Reescribir |
| `app/api/expedientes-archivo/route.ts` (GET lista + POST alta) | **VIEJO** | Reescribir |
| `app/api/expedientes-archivo/[id]/route.ts` (GET/POST/DELETE) | **VIEJO** (SELECT) | Reescribir SELECT + añadir PUT/PATCH |
| `lib/expedientes-archivo-search.ts` | **VIEJO** | Reescribir |
| `lib/expedientes-archivo-processing.ts` | **VIEJO** | Reescribir |
| `app/api/expedientes-archivo/ai-search/route.ts` | **MEZCLADO/ROTO** (`sgd_expediente` + `ubicacion` + `nro_caja`) | Corregir |
| `app/api/expedientes-archivo/bulk/route.ts` | **NUEVO** ✅ | Sin cambios (salvo bug §6) |
| `app/api/expedientes-archivo/duplicates/route.ts` | **NUEVO** ✅ | Sin cambios |
| `app/api/expedientes-archivo/export/route.ts` | **NUEVO** ✅ | Sin cambios |
| `app/components/expedientes-archivo/types.ts` + `workspace.tsx` (cliente) | **NUEVO** ✅ | Sin cambios |
| `respuesta/*`, `extract/route.ts` | N/A (no tocan columnas del expediente) | Sin cambios |

**Conclusión:** el esquema **nuevo es el canónico**. Migran los rezagados: el tipo
compartido, el camino de alta/lista/detalle, search, processing y `ai-search`.

---

## 2. Esquema canónico (destino)

Columnas de negocio de `public.expedientes_archivo` tras la migración:

```
sgd_expediente       text
serie_documento      text
anio                 integer            -- 1900..2100
tipo_documento       text  default 'otros'  -- ('resolucion','oficio','decreto','ordenanza','otros')
asunto               text
materia              text
resumen              text
title                text  not null
oficina              text
tipo_almacenamiento  text  default 'folder' -- ('empastado','folder','anillado','archivador','caja_archivistica')
nro_archivador       text
nro_paquete          text
empastado            boolean default false
color_archivador     text
nro_estante          text
nro_piso             text
nro_local            text
folio                text
observaciones        text
persona_tipo         text               -- ('natural','juridica')
persona_documento    text
persona_nombre       text
-- (sin cambios) file_name, file_size, mime_type, storage_bucket, storage_path,
--               status, error_message, body_text, metadata, uploaded_by, created_at, updated_at
```

**Columnas viejas a eliminar al final:** `numero_expediente`, `numero_documento`,
`fecha`, `tipo_contenedor`, `nro_caja`, `color`, `ubicacion`, `codigo_ubicacion`,
`nro_folios`, `remitente`, `destinatario`.

---

## 3. Mapeo de datos viejo → nuevo (backfill)

Para no perder datos de expedientes ya cargados. Marcados `⚠ lossy` los que no
tienen equivalente limpio (se conserva el original en `metadata.legacy` por seguridad).

| Columna vieja | Columna nueva | Nota |
|---|---|---|
| `numero_expediente` | `sgd_expediente` | Convención ya usada por el autofill del cliente (`workspace.tsx:665`) |
| `numero_documento` | `serie_documento` | Idem (`workspace.tsx:666`) |
| `color` | `color_archivador` | Mismo catálogo `ARCHIVO_COLORES` |
| `nro_folios` (int) | `folio` (text) | `folio` es text en el esquema nuevo → cast a texto |
| `tipo_contenedor` | `tipo_almacenamiento` | Remapear valores: `folder→folder`, `archivador→archivador`, `caja→caja_archivistica`, `tomo/paquete/estante/otros→folder` |
| `nro_caja` | `nro_paquete` | ⚠ lossy: el esquema nuevo no tiene "caja"; el nº de contenedor va a `nro_paquete` |
| `ubicacion` (ambiente) | `observaciones` (append) | ⚠ lossy: el ambiente (Archivo Central…) se reemplazó por estante/piso/local; se preserva como nota |
| `codigo_ubicacion` | — (drop) | Se regenera desde local/piso/estante; el viejo no aplica |
| `fecha` | — (drop) | El SDD §20 ya elimina `fecha`; se conserva `anio` |
| `remitente` | `persona_nombre` + `metadata.legacy.remitente` | ⚠ lossy: "remitente" ≠ "persona interesada"; mapeo best-effort |
| `destinatario` | `metadata.legacy.destinatario` | ⚠ lossy: sin columna destino |

> Si el archivo **aún no tiene datos productivos** (probable en localhost), se puede
> **omitir el backfill** (Fase 2) y `TRUNCATE` la tabla + storage, simplificando todo.
> Decidir esto antes de empezar.

---

## 4. Fases de ejecución

### Fase 0 — Pre-requisitos
- [ ] Confirmar si hay datos reales que preservar (define si se hace Fase 2 o se trunca).
- [ ] Backup: `pg_dump` de `expedientes_archivo` + `expedientes_archivo_chunks` (o snapshot Supabase).
- [ ] Confirmar catálogos definitivos con el área de archivo (los actuales son placeholder, ver `lib/expedientes-archivo.ts:13`).

### Fase 1 — SQL: crear columnas nuevas (idempotente, sin romper nada)
Nuevo archivo `docs/supabase/expedientes-archivo-canonico.sql`:
- [ ] `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` para las 23 columnas del §2 que falten
      (con sus `CHECK` de `tipo_documento`, `tipo_almacenamiento`, `persona_tipo`).
- [ ] Índices nuevos: `serie_documento`, `oficina`, `nro_estante`, `anio`, `status`, `created_at`.
- [ ] Mantener las columnas viejas por ahora (coexistencia).

### Fase 2 — SQL: backfill (solo si hay datos a preservar)
- [ ] `UPDATE` aplicando el mapeo del §3, copiando viejo→nuevo solo donde el nuevo esté NULL.
- [ ] Mover `remitente`/`destinatario`/`ubicacion` a `metadata.legacy` con `jsonb_set`.
- [ ] Verificar conteos: `count(*) filter (where sgd_expediente is not null)` vs `numero_expediente`, etc.

### Fase 3 — Código: migrar los archivos rezagados al esquema nuevo
Hacer todo junto (compila o no compila):

1. **`lib/expedientes-archivo.ts`**
   - [ ] Reemplazar el tipo `ExpedienteArchivo` por el del §2 (single source of truth; `types.ts` del cliente debe coincidir 1:1).
   - [ ] Sustituir catálogo `CONTENEDOR_TIPOS` por `ALMACENAMIENTO_TIPOS` = `('empastado','folder','anillado','archivador','caja_archivistica')` + labels.
   - [ ] Añadir catálogo `TIPO_DOCUMENTO` = `('resolucion','oficio','decreto','ordenanza','otros')` y `PERSONA_TIPOS`.
   - [ ] `expedienteSearchSchema`: renombrar `numeroDocumento` → `serieDocumento` (o quitar el post-filtro, ver §6).

2. **`app/api/expedientes-archivo/route.ts`**
   - [ ] `SELECT` → columnas del §2.
   - [ ] POST: leer del FormData las claves **nuevas** que ya manda el cliente
         (`sgdExpediente`, `serieDocumento`, `tipoDocumento`, `oficina`, `folio`,
         `resumen`, `materia`, `asunto`, `observaciones`, `personaTipo`,
         `personaDocumento`, `personaNombre`, `tipoAlmacenamiento`, `nroArchivador`,
         `nroPaquete`, `empastado`, `colorArchivador`, `nroEstante`, `nroPiso`, `nroLocal`, `anio`).
   - [ ] **Eliminar el hack de fallback de columnas faltantes** (`route.ts:218-241`):
         con la migración aplicada ya no hace falta y oculta errores.
   - [ ] Validar `tipoDocumento`/`tipoAlmacenamiento`/`personaTipo`/`colorArchivador` contra catálogos (`normalizeCatalogValue`).

3. **`app/api/expedientes-archivo/[id]/route.ts`**
   - [ ] `SELECT` → §2.
   - [ ] **Añadir `PATCH`** (editar metadata; whitelist de columnas nuevas) — hoy no existe y el SDD lo da por hecho.
   - [ ] **Añadir `PUT`** (reemplazar PDF + reprocesar) — hoy no existe; `replaceExpedienteFile` (cliente) lo llama y devuelve 405. *(Bug separado, pero conviene cerrarlo aquí porque toca el mismo archivo.)*

4. **`lib/expedientes-archivo-processing.ts`**
   - [ ] `processExpedienteDocument`: leer de `expediente` los campos nuevos
         (`serie_documento`, `tipo_documento`, etc.) en lugar de `numero_documento`/`fecha`/`remitente`/`destinatario`.
   - [ ] `buildExpedienteEmbeddingText`: header con `Serie documento`, `Materia`, `Asunto`, `Oficina` (quitar remitente/destinatario/fecha).
   - [ ] Metadata de chunk y PATCH final → columnas nuevas.

5. **`lib/expedientes-archivo-search.ts`**
   - [ ] `ExpRow`/`EXP_SELECT`/`buildUbicacion`/`ExpedienteSearchResult` → ubicación física nueva (`tipo_almacenamiento`, `nro_estante`, `nro_piso`, `nro_local`, `nro_archivador`, `nro_paquete`, `color_archivador`, `folio`).
   - [ ] `ubicacionResumen` → "Estante 3 · Piso 2 · Local A · folder (rojo)".

6. **`app/api/expedientes-archivo/ai-search/route.ts`**
   - [ ] `SELECT` mezclado → columnas nuevas; `ubicacion`/`nro_caja` → estante/piso/local + `nro_archivador`.
   - [ ] `ExpedienteResumen` Pick → campos nuevos.

### Fase 4 — SQL: eliminar columnas viejas (tras verificar Fase 3 en runtime)
- [ ] `ALTER TABLE ... DROP COLUMN IF EXISTS` para las 11 columnas viejas del §2.
- [ ] Eliminar `docs/supabase/expedientes-archivo-add-columns.sql` (obsoleto) y consolidar
      el DDL canónico en `expedientes-archivo.sql`.

### Fase 5 — Limpieza y consistencia
- [ ] `bulk/route.ts:79`: `normalizeContenedorTipo(src.tipoAlmacenamiento)` normaliza contra el
      catálogo **viejo** → `caja_archivistica`/`empastado`/`anillado` caerían en `otros`.
      Cambiar a `normalizeAlmacenamiento` (catálogo nuevo).
- [ ] Sincronizar SDD §4/§9/§20 con el código real (el PATCH/PUT ahora sí existen; quitar el hack documentado).
- [ ] Actualizar `tests/expedientes-archivo.test.ts` (campos nuevos en payloads de upload/search).

---

## 5. Orden seguro de despliegue

```
Fase 1 (add columns)  →  Fase 3 (deploy código nuevo)  →  Fase 2 (backfill)  →  verificar  →  Fase 4 (drop) → Fase 5
```

Las columnas nuevas y viejas coexisten entre Fase 1 y 4, así que en ningún momento
el código (viejo o nuevo) referencia una columna inexistente. Si se trunca la tabla
(sin datos productivos), se colapsa a: **Fase 1 → Fase 3 → Fase 4**.

---

## 6. Decisiones abiertas (resolver antes de codear)

1. **¿Hay datos productivos?** Si no → truncar y saltar backfill (mucho más simple).
2. **Post-filtro por número en search** (`-search.ts:154`): `expedienteSearchSchema` tiene
   `numeroDocumento`. ¿Se renombra a `serieDocumento` o se elimina el post-filtro?
   (La UI nueva no envía ese filtro hoy.)
3. **`remitente`/`destinatario`/`ubicacion`/`fecha`**: confirmar que se pueden descartar
   (preservados en `metadata.legacy`) o si alguno debe mapear a una columna nueva.
4. **Catálogos definitivos** (`ALMACENAMIENTO_TIPOS`, `ARCHIVO_COLORES`, oficinas): hoy son
   placeholder; idealmente entran los reales en la misma migración.

---

## 7. Riesgos y rollback

| Riesgo | Mitigación |
|---|---|
| Pérdida de datos en backfill lossy | Original preservado en `metadata.legacy`; backup en Fase 0 |
| Código nuevo desplegado antes de crear columnas | Orden de despliegue §5 (columnas primero) |
| Chunks/Pinecone con embeddings basados en header viejo | Reindexar (`POST /[id]`) tras Fase 3; opcional reindex masivo |
| Tests rojos | Actualizar en Fase 5; correr `vitest` antes de cerrar |

**Rollback:** mientras no se ejecute Fase 4 (drop), revertir el código a la rama
anterior restaura el comportamiento viejo (las columnas viejas siguen presentes).
La Fase 4 es el punto sin retorno → ejecutarla solo tras verificar alta+lista+search+detalle en runtime.
