# Formato oficial del .docx de Bases (A9) — Design

**Fecha:** 2026-09-02
**Contexto:** El usuario abrió el expediente `03315fbc-dfc2-4f86-8c30-4be955dde5b6` (Licitación Pública abreviada para bienes) y pidió que el `.docx` generado por A9 "Elaborar Bases" respete el formato del PDF oficial OECE (`actuaciones-preparatorias/bases/7614342-1-bases-estandar-licitacion-publica-para-bienes.pdf`), y que aplique a todos los tipos de procedimiento, no solo a este expediente.

## Estado actual

`lib/bases-docx.ts` ya trae escrito en su propio comentario de cabecera que es un "borrador estructural": Arial 10pt (correcto, coincide con la instrucción de uso del PDF oficial), pero todo el contenido — Sección General y Sección Específica — se imprime como párrafos de texto plano con negrita heurística. No hay portada, no hay estilos de encabezado reales de Word, no hay tablas, no hay pie de página.

## Bug encontrado durante la exploración

`lib/bases-elaboracion.ts`'s `txt()` solo acepta `string` o `number`; cualquier otro tipo devuelve `""`. El campoHito `factores_items` (Factores de evaluación, A4) se guarda como un array real (`FactorEvaluacion[] = {nombre?, sustento?}[]`, ver `lib/estrategia-formato.ts`), no como texto. Consecuencia: en **todo** documento de Bases generado hasta hoy, "Factores de evaluación" sale como `[...]` sin resolver, sin importar lo que la DEC haya registrado — nunca ha funcionado. Se corrige como parte de este trabajo, porque es precisamente el campo que se convierte en tabla.

Se comprobó que `otras_penalidades` (`tipo: "textarea"`) y `var_f_requisitos_calificacion` (prosa preformateada vía `formatRequisitos()`, ver `lib/requisitos-calificacion.ts`) son genuinamente texto libre, no filas de tabla — no se fuerzan a tabla, se preservan sus saltos de línea.

## Alcance aprobado por el usuario

1. Portada con el título real del procedimiento (sin el logo/escudo del OECE ni la leyenda de simbología — esas son instrucciones del OECE para quien elabora las bases, no parte del documento final que firma la entidad).
2. Tablas de Word reales donde el dato subyacente es genuinamente tabular (hoy: Factores de evaluación). Los campos de texto libre NO se fuerzan a tabla.
3. Aplica a **todos** los tipos de procedimiento (`lib/bases-docx.ts` es genérico, no por tipo) — no solo a Licitación Pública para bienes ni al expediente que disparó el pedido.

## Fuera de alcance (explícito)

- Réplica pixel-perfect de márgenes exactos del PDF oficial (se usan márgenes estándar de documento gubernamental: 3cm superior/inferior, 2.5cm izquierdo/derecho — razonables, no medidos al milímetro contra el PDF).
- Logos, escudos o membrete gráfico (de la entidad o del OECE).
- Tablas para `otras_penalidades` / `var_f_requisitos_calificacion` (son texto libre real, no datos tabulares).
- Encabezado de página (solo se agrega pie de página con numeración).
- Cambiar el modelo de datos de ningún campoHito existente (el fix de `factores_items` es aditivo: nueva propiedad opcional, no cambia el tipo de `valor`).

## Arquitectura

### 1. `lib/bases-elaboracion.ts` — `ValorBases` gana `filas` opcional

```ts
export type FilaFactorEvaluacion = { factor: string; sustento: string };

export type ValorBases = {
  ruta: string;
  label: string;
  valor: string;
  resuelto: boolean;
  /** Solo presente cuando el campoHito es un array real (hoy: factores_items).
   *  bases-docx.ts lo usa para pintar una tabla; `valor` sigue trayendo un
   *  resumen en texto plano para cualquier otro consumidor. */
  filas?: FilaFactorEvaluacion[];
};
```

`resolverBases()` detecta cuándo `data[campo.campoHito]` es un array (hoy, únicamente para `campoHito === "factores_items"`, comprobado con `Array.isArray`, sin acoplarse al nombre del campo para que sea extensible): construye `filas` mapeando `{nombre, sustento}` → `{factor, sustento}` (con `""` de respaldo por campo ausente), y `valor` como un resumen unido con salto de línea (`"<factor>: <sustento>"` por fila) para que el string siga siendo útil donde se use como texto. Si el array está vacío, `resuelto: false` (mismo criterio que un campo vacío hoy).

Ningún otro campoHito existente es un array hoy (confirmado: `otras_penalidades` y `var_f_requisitos_calificacion` son string), así que el resto de `resolverBases()` no cambia de comportamiento.

### 2. `lib/bases-docx.ts` — reescritura de la composición

**Configuración de página:** `sections[0].properties.page` con tamaño A4 y márgenes 3cm (top/bottom) × 2.5cm (left/right) — constantes en twips (docx usa 1/1440 pulgada; 3cm ≈ 1701 twips, 2.5cm ≈ 1417 twips).

**Portada:** nuevo helper `paginaPortada(proceso: string)` que devuelve los `Paragraph[]` de una portada (proceso en mayúsculas, tamaño mayor, centrado; línea "N° [NOMENCLATURA DEL PROCEDIMIENTO DE SELECCIÓN]"; línea "CONTRATACIÓN DE [CONSIGNAR SEGÚN EL OBJETO]" — ambas como placeholders literales entre corchetes, igual que el PDF oficial, porque ACE no tiene esos datos en A1-A9 todavía) seguida de un salto de página (`PageBreak`).

**Encabezados con estilo real:** `esEncabezado()` se mantiene (mismo heurístico), pero en vez de `bold: true` sobre un párrafo normal, el encabezado detectado se distingue en dos niveles:
- Líneas que matchean `/^CAPÍTULO\s/` → `HeadingLevel.HEADING_1`.
- El resto de encabezados detectados (numerales tipo `2.2 CONSIDERACIONES...`) → `HeadingLevel.HEADING_2`.

Se registran estilos base (`heading1`/`heading2`) en el `Document` con Arial y el tamaño que ya usa el resto del documento, para no romper la convención tipográfica de "todo Arial 10-12pt" del original (los títulos oficiales no son dramáticamente más grandes que el cuerpo).

**Sección Específica:**
- Título "SECCIÓN ESPECÍFICA" como `HEADING_1`, con salto de página antes (arranca en su propia página, como en el PDF).
- Cada capítulo (`cap1`/`cap3`/`cap4`/...) como `HEADING_2`.
- Cada campo: si `campo.origen` no es de tipo "tabla" (ver abajo), se pinta como un párrafo con el label en negrita seguido de dos puntos y el valor; si el valor contiene `\n` (verificado con `otras_penalidades`/`var_f_requisitos_calificacion`, que sí traen saltos de línea reales), se parte en varios `Paragraph` en vez de uno solo aplastado.
- Si el `ValorBases` trae `filas` (hoy, solo Factores de evaluación): se pinta como una `Table` de Word de 2 columnas (encabezado "Factor" / "Sustento", una fila por elemento de `filas`), en vez del párrafo label:valor. Fila vacía (`filas.length === 0`) se trata igual que "no resuelto": línea `[...]`.

**Pie de página:** `Footer` con un párrafo centrado que use los campos de Word `PageNumber.CURRENT` / `PageNumber.TOTAL_PAGES` ("Página X de Y"), mismo tamaño/fuente que el cuerpo.

## Testing

- `tests/bases-elaboracion.test.ts` (nuevo, no existe hoy — hasta ahora `resolverBases` solo se ejercitaba indirectamente vía los tests de plantillas): casos para `factores_items` como array con datos, array vacío, y el caso ya cubierto de campos string normales, para fijar el contrato de `filas`.
- `lib/bases-docx.ts` no tiene tests hoy (solo se verificó end-to-end con el chequeo de firma `"PK"` en tests temporales durante Fase D). Se añade `tests/bases-docx.test.ts` con pruebas de las funciones puras nuevas que no dependan de `docx`'s output binario: el heurístico de nivel de encabezado, el split de párrafos multilínea, y la construcción de filas de tabla desde `ValorBases[]`. La verificación de que el `.docx` generado sigue siendo un ZIP válido con portada + secciones se hace con el mismo patrón de test temporal ya usado en toda esta fase (se borra al terminar).

## Self-review

- Sin placeholders: cada sección tiene comportamiento concreto, no "TBD".
- Consistencia: el fix de `resolverBases()` es aditivo (no cambia la forma de `valor`, que sigue siendo string), así que no rompe ningún consumidor existente de `ValorBases.valor`.
- Alcance: un solo archivo de lib (`bases-elaboracion.ts`) + un solo archivo de composición (`bases-docx.ts`) + sus tests — no toca `bases-plantillas.ts` ni ninguna plantilla de texto ya transcrita.
- Ambigüedad resuelta explícitamente: "portada" = solo título/nomenclatura/objeto, sin logos (decidido con el usuario); "tablas" = solo donde el dato es un array real, no todo bloque que en el PDF se vea como cuadro.
