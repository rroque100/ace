# Trasladar penalidades de la matriz de riesgos → «Otras penalidades» — Diseño

**Fecha:** 2026-07-30
**Módulo:** 1 · Necesidad · Ficha del requerimiento · Gestión de riesgos (Art. 44.3) ↔ Otras penalidades (apartado f)
**Estado:** aprobado (diseño).

## Problema

La matriz de «Gestión de riesgos» (Art. 44.3) trae una columna **«Relación con
Penalidades»** que puede decir *multa / penalidad por mora / otras penalidades /
no aplica*. Cuando una fila indica **«otras penalidades»**, esa penalidad debería
poder registrarse en el cuadro **«Otras penalidades»** (apartado f), en vez de
copiarla a mano. El cuadro «Otras penalidades» conserva su registro manual.

## Decisiones (del usuario)

- **Mapeo:** `Supuesto ← «Identificación del Riesgo»`; **Cálculo y Verificación
  vacíos** (la matriz no los trae; los completa el usuario a mano).
- **Disparo:** un botón **«Traer penalidades de la matriz de riesgos»** dentro
  del cuadro «Otras penalidades», que **añade** las filas trasladadas; el registro
  manual sigue igual.
- **Coincidencia/duplicados:** coincide si la celda **contiene** «otras
  penalidad…» (normalizado, sin tildes ni mayúsculas; excluye multa/mora/«no
  aplica»); al traer, **omite** las que ya existan con el mismo supuesto.

## Alcance

### A. Extracción — `lib/penalidades-matriz.ts` (puro)
`penalidadesDesdeMatriz(matriz: string | null | undefined): OtraPenalidad[]`:
1. Parsea la tabla Markdown de la matriz con `segmentarParrafoMd` (ver §B).
2. Localiza por **cabecera** las columnas «Identificación del Riesgo» y «Relación
   con Penalidades» (normalizado); fallback: columna 1 y última.
3. Por cada fila de datos cuya celda de penalidades contenga `otras penalidad`,
   devuelve `{ supuesto: <identificación del riesgo>, calculo: "", verificacion: "" }`.
   Descarta filas sin supuesto.

### B. Consolidar el parser de tablas Markdown — `lib/markdown-tabla.ts` (nuevo)
Mover `SegmentoParrafo`, `segmentarParrafoMd` y sus ayudantes privados
(`esSeparadorTablaMd`, `esFilaTablaMd`, `celdasFilaMd`) de `lib/requerimiento-docx.ts`
a `lib/markdown-tabla.ts`. Motivo: la extracción (§A) corre en un **componente
cliente**, y `requerimiento-docx.ts` importa la librería `docx` (pesada); moviendo
el parser puro se reutiliza **sin arrastrar `docx` al bundle del cliente**, y queda
un solo parser de pipes. `requerimiento-docx.ts` importa `segmentarParrafoMd` desde
la lib nueva y conserva `tablaMarkdown`/`renderParrafoConTablas` (que sí usan `docx`).
El test que hoy importa `segmentarParrafoMd` desde `requerimiento-docx` pasa a
importarlo de `markdown-tabla`.

### C. Botón en el editor — `app/components/otras-penalidades-editor.tsx`
Nueva prop `matriz?: string`. Un botón **«Traer penalidades de la matriz de
riesgos»** que:
- Calcula `penalidadesDesdeMatriz(matriz)`, filtra las que ya existan (supuesto
  normalizado) y **añade** el resto con `propagar([...filas, ...nuevas])`.
- Se muestra solo si hay candidatas; da feedback breve (cuántas se trasladaron o
  «ya están todas»). No toca las filas existentes salvo para añadir.

### D. Plumbing del valor de la matriz
El editor necesita el valor de `gestionRiesgos` (otro campo). Se pasa como el
editor de requisitos recibe la experiencia del personal clave:
- `ficha-editable.tsx`: `gestionRiesgos={esPenalidades ? (fichaForm.gestionRiesgos ?? "") : ""}`
  (con `esPenalidades = field.kind === "penalidades"`), para no repintar el resto.
- `campo-ficha.tsx`: nueva prop `gestionRiesgos: string`; en el `kind === "penalidades"`
  se pasa `matriz={gestionRiesgos}` al editor.

## Datos

Nada nuevo en BD. El resultado se guarda en `otras_penalidades` con el formato
serializado de siempre (`componerOtrasPenalidades`), así que va al Word y a la
ficha como cualquier otra penalidad.

## Tests

`tests/penalidades-matriz.test.ts` (Node): extrae solo las filas «otras
penalidad»; mapea supuesto←riesgo con cálculo/verificación vacíos; excluye
multa/mora/«no aplica»; detecta columnas por cabecera y por fallback (col 1 /
última); tabla ausente o vacía → `[]`; normaliza tildes/mayúsculas.

## No incluido (YAGNI)

- No se auto-sincroniza: es un botón manual (traer una vez, y editar a mano).
- No se rellena cálculo ni verificación (los pone el usuario).
- No se modifican ni borran las filas manuales existentes (solo se añaden).
