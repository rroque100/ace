# Matriz de riesgos obligatoria según segmentación — Diseño

**Fecha:** 2026-07-30
**Módulo:** 1 · Necesidad / Expediente · Gestión de riesgos (Art. 44.3) · Segmentación (Art. 125 / 153)
**Estado:** aprobado (diseño). Decisiones cerradas con el usuario (2026-07-30).

## Problema

La matriz de gestión de riesgos (Art. 44.3) es **obligatoria** cuando la
contratación se segmenta como **Estratégico** (bienes/servicios: alta cuantía +
alto riesgo) o **Contratación Avanzada** (obras/consultoría de obra). En los
demás cuadrantes —Rutinaria, Operacional, Crítico, Contratación Básica— no es
exigible en el expediente y se gestiona en ejecución (Art. 66, 125.1, 153.2).

Hoy el campo `gestion_riesgos` es un textarea `recomendado: true`
([necesidad-ficha-secciones.ts:473](../../../lib/necesidad-ficha-secciones.ts)),
**nunca obligatorio bajo ninguna condición**, y no hay ninguna puerta que exija
la matriz cuando la segmentación lo requiere.

## Hallazgo que decide la capa: NO va en la ficha

Investigado el flujo (ver «Notas técnicas»), la obligatoriedad **no puede vivir
en la ficha de la necesidad**:

- La categoría de segmentación se calcula desde el paso **A2** del expediente
  (`clasificarSegmentacion`), y depende de la cuantía, que a su vez depende del
  `valor_estimado` que **se fija recién en A5** tras la interacción con el
  mercado. En la fase de ficha ese dato **no existe todavía**.
- El único condicionante que la ficha conoce es el `objeto`
  (`obligatorioPara`), y el objeto **no equivale** a la categoría (la categoría
  cruza cuantía × riesgo). Exigir la matriz en la ficha por objeto sería exigir
  de más (todo bien/servicio) o de menos, nunca lo que pide la norma.
- El orden real es: ficha (con riesgos) → `conforme` → derivar → expediente →
  A2 (segmentación). La ficha y la segmentación son subsistemas **separados en
  el tiempo**; los `EjesFicha` no reciben nada de la fase preparatoria.

Esto coincide con la propia norma: el Art. 54.2 la trata como **requisito del
expediente** / contenido de la **estrategia**, no de la propuesta del área
usuaria.

**Conclusión: la exigencia condicionada por segmentación pertenece a la capa del
expediente**, junto a las demás comprobaciones del Art. 54.2, que ya viven en
[lib/expediente-contenido.ts](../../../lib/expediente-contenido.ts).

## Decisiones

- **Capa:** expediente, no ficha. La regla se añade a `contenidoExpediente`.
- **Regla (dominio):** la matriz es exigible ⟺
  `clasificarSegmentacion(hitos.A2.data).categoria ∈ {"estrategico", "contratacion_avanzada"}`.
  En los otros cuatro cuadrantes el literal aparece como **no aplica** (mismo
  patrón que los «según corresponda» ya existentes), no como faltante.
- **Sin cambio de firma:** `contenidoExpediente(hitos, valorEstimado)` ya recibe
  `hitos`, así que deriva la categoría internamente desde `hitos.A2.data`. No
  hace falta propagar la categoría ni tocar `EjesFicha`.
- **Señal de cumplimiento en A3:** se considera cumplida cuando
  **`A3.riesgos_asignacion`** tiene contenido —es el campo dedicado del
  Art. 44.3, «Riesgos identificados y su asignación a las partes»
  ([actuaciones-preparatorias.ts:955](../../../lib/actuaciones-preparatorias.ts))—,
  con **`A3.condiciones_obra`** (que arrastra la matriz de la ficha vía
  `fase1-precarga`) como **respaldo**. La asignación es justamente el insumo que
  la estrategia necesita, así que es la señal más fiel; sniffing del texto de la
  matriz sería más frágil y se descartó.
- **Dureza de la puerta: blanda**, igual que las puertas actuales (deshabilita
  «Guardar paso» en A8 y sube el faltante a la torre de control). No se añade
  validación dura en el servidor: hoy `hitos/route.ts` no valida ninguna de las
  puertas existentes, y hacer dura solo esta rompería la coherencia.
- **Dónde surge el faltante: solo en A8** (aprobación del expediente), que es
  donde `contenidoExpediente` ya se consume. Cero cableado extra. (Se descartó
  duplicarlo en el cierre de A4.)

## Alcance

### A. Regla en `lib/expediente-contenido.ts`
- Importar `clasificarSegmentacion` y el tipo de A2 desde
  `lib/actuaciones-preparatorias.ts`.
- Reconstruir `SegmentacionInput` desde `hitos.A2.data` igual que hace
  [segmentacion-informe/route.ts:157-163](../../../app/api/processes/[id]/fase1/segmentacion-informe/route.ts)
  y [fase-panel.tsx:2035-2037](../../../app/components/fase-panel.tsx) (objeto,
  cuantiaAlta, condicionesRiesgo, criteriosBasica, centralizada, esIoarr).
- Añadir un `LiteralExpediente` nuevo, base legal **Art. 44.3** (insumo del
  54.2.a/54.2.c), con:
  - `noAplica: true` cuando la categoría no está en el conjunto disparador (o
    cuando A2 aún no tiene datos → no se puede exigir lo que no se ha
    segmentado).
  - `cumple` = matriz presente en A3 (ver «Señal de cumplimiento»).
  - `detalle` que nombre la categoría («Por ser una contratación **Estratégica**
    la matriz de gestión de riesgos es obligatoria (Art. 44.3): regístrala/
    asígnala en A3») cuando falta.
- `faltaParaAprobar` / `puedeAprobarExpediente` no cambian: filtran por `cumple`
  y ya excluyen los `noAplica` a través de `cumple`.

### B. UI (sin trabajo nuevo si la puerta es blanda en A8)
`contenidoExpediente` ya alimenta el gate de A8
([fase-panel.tsx:1119-1120](../../../app/components/fase-panel.tsx),
`:1847-1854`) y la torre de control (`:2127-2130`). El literal nuevo aparece
solo por añadirse a la lista: **cero trabajo de UI**. (El gate en A4 quedó
descartado, así que no hay cableado adicional.)

### C. (Opcional, relacionado) La matriz como contenido de la estrategia A4
Hoy la matriz **no** figura como campo propio de A4; vive como insumo en A3
(`riesgos_asignacion` + `condiciones_obra`). Enumerarla como contenido de la
estrategia sería un cambio aparte; se deja fuera de este diseño y se anota como
mejora futura.

## Datos

Nada nuevo en BD. La categoría se calcula al vuelo desde `hitos.A2.data`
(JSONB `procurement_processes.hitos`); no existe —ni se crea— columna de
categoría. La señal de cumplimiento se lee de `hitos.A3.data`.

## Tests

Ampliar [tests/expediente-contenido.test.ts](../../../tests/expediente-contenido.test.ts)
recorriendo el catálogo de categorías (estilo del proyecto):
- `estrategico` y `contratacion_avanzada` con A3 sin matriz → literal Art. 44.3
  **faltante** (no `cumple`, no `noAplica`).
- `estrategico`/`contratacion_avanzada` con `A3.riesgos_asignacion` con contenido
  → **cumple**.
- `rutinaria`, `operacional`, `critico`, `contratacion_basica` → literal
  **`noAplica`** (nunca bloquea).
- A2 vacío/sin segmentar → `noAplica` (no se exige lo no segmentado).
- Reusar los `SegmentacionInput` de fixtures de `tests/segmentacion-*.test.ts`.

## No incluido (YAGNI)

- **No** hay obligatoriedad en la capa de la ficha (imposible: el dato no existe
  ahí). `gestion_riesgos` sigue `recomendado` en la ficha.
- **No** se añade validación dura en el servidor (salvo que se confirme).
- **No** se modela la matriz como factor de evaluación puntuable para jurado
  (eso es el P3, diseño propio).
- **No** se añade la matriz como campo de la estrategia A4 (mejora aparte, §C).

## Notas técnicas (evidencia del flujo)

- La segmentación **no se persiste**: `clasificarSegmentacion`
  ([actuaciones-preparatorias.ts:320](../../../lib/actuaciones-preparatorias.ts))
  se recalcula al vuelo desde `hitos.A2.data`; solo se guardan sus inputs.
- La matriz llega al expediente vía
  [fase1-precarga.ts:280-286](../../../lib/fase1-precarga.ts): `gestion_riesgos`
  + `matrizRiesgosTexto(n.riesgos)` → `A3.condiciones_obra` (para cualquier
  objeto, no solo obra).
- Puertas existentes (todas blandas, en cliente): `contenidoExpediente` /
  `faltaParaAprobar` / `puedeAprobarExpediente`
  ([expediente-contenido.ts:61-161](../../../lib/expediente-contenido.ts));
  `puedeCerrarEstrategia` (cierre de A4); `problemasDelPaso` (calidad de paso).
  El PATCH de `hitos/route.ts` no ejecuta ninguna.
