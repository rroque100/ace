# Design — Borrador del wizard de Subir + duplicados en modo lotes

Fecha: 2026-09-18 · Módulo: `/expedientes-archivo` · Estado: aprobado

## Problema

1. **Pestaña Subir (modo individual)**: el formulario del wizard vive solo en
   memoria. Un refresh, un cierre de pestaña o un cambio accidental de pestaña
   pierde toda la catalogación manual (el README del módulo ya promete un
   auto-guardado que no existe).
2. **Modo lotes**: `BatchUpload` no comprueba duplicados en ninguna parte y cada
   PDF crea siempre un legajo nuevo: una carga masiva puede sembrar expedientes
   duplicados silenciosamente.

## Solución A — Borrador del wizard (localStorage)

Patrón espejo de `respuesta-borrador-v1` (pestaña Responder):

- Key `subir-borrador-v1`, TTL 24 h, lectura tras montar (SSR-safe, mismo
  patrón que `use-preferences`).
- Contenido: `{ form, wizardStep, legajo, fileName, fileSize, savedAt }`. El
  `File` no es serializable: al recuperar se avisa "vuelve a cargar el PDF
  (era `nombre`, tamaño)".
- **Guardado**: efecto en el workspace con debounce 1,5 s, solo si hay
  contenido significativo —algún campo aparte de `oficina` (precargada del
  perfil), legajo elegido o paso > 0— y nunca durante la subida. Escritura
  protegida contra redundancia (comparación del serializado).
- **Recuperación**: banner ámbar arriba de la pestaña Subir con "Borrador sin
  terminar · guardado HH:MM" y botones **Recuperar / Descartar**. Recuperar
  aplica `form` (fusionado sobre `baseForm` para tolerar campos nuevos),
  `wizardStep` y legajo. El borrador se mantiene en storage tras recuperar
  (la siguiente pasada del auto-guardado lo mantiene coherente).
- **Limpieza**: subida con éxito, botón Cancelar (confirm) y Descartar.

### Estructura

- `app/components/expedientes-archivo/borrador-subir.ts` — funciones puras
  (parse seguro con validación de shape, caducidad, `tieneContenidoBorrador`).
  Testeables en vitest (entorno node, sin DOM).
- `app/components/expedientes-archivo/use-borrador-subir.ts` — hook con guards
  de `localStorage`: `{ borrador, programarGuardado, recuperar, descartar, limpiar }`.

## Solución B — Duplicados en modo lotes

- Se extrae la firma de duplicados (`k:{sgd}|{serie}` / fallback `t:{title}`),
  hoy inline en `checkDuplicatesFor` del workspace, a una función pura
  compartida `firmaDuplicados` en `duplicados.ts`. El workspace pasa a usarla.
- `BatchItem` gana `duplicates?: DuplicateMatch[]` y `dupSignature?: string`.
- Un efecto con debounce 600 ms revisa cada fila (que no esté `done`/`uploading`)
  cuyo SGD/serie tenga ≥3 chars y cuya firma cambió → llama
  `detectDuplicates` y guarda los matches. Cubre a la vez el post-análisis IA
  (la serie detectada dispara el efecto) y la edición manual en la tabla.
  Si el usuario vacía SGD/serie, se limpia el aviso de la fila.
- **UI**: fila ámbar `<tr>` adicional (colSpan 8) bajo la fila afectada con
  hasta 3 coincidencias y aviso "Se subirá igual; quítalo si es el mismo
  documento" — no bloqueante, mismo criterio que el banner del modo individual.

## Tests

`tests/expedientes-archivo-borrador.test.ts`: parse de JSON inválido → null,
borrador caducado → null, shape inválido → null, contenido significativo
(form vacío → no, solo `oficina` → no, con SGD → sí, paso > 0 → sí) y firma de
duplicados (sgd/serie vs título, con trim).

## Fuera de alcance

- Refactor del prop drilling de `SubirTabContent` (hook `useSubirState`).
- Legajos por fila en el modo lotes.
- Guardar el `File` (imposible en localStorage) o usar IndexedDB.
