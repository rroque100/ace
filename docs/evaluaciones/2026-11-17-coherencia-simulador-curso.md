# Coherencia simulador ↔ curso de certificación OECE — análisis completo

> **Estado de integración (PR #37, 2026-11-17).** Se integraron: las 6 correcciones de la §2 (verificadas de nuevo
> contra el corpus), las clases de refuerzo XIX–XXIII y las casuísticas (3 por clase, pestaña «Casuística»), dentro de
> la estructura por competencias del temario oficial (`lib/cursos/certificacion-oece.ts`). Cada caso solo puede citar
> artículos de la base legal de su clase (`tests/cursos-catalogo.test.ts`); cinco que no cumplían se contrastaron y
> sus artículos se añadieron a la clase. **No** se integró la práctica por tema de balotarios (`?tema=`, recomendación
> D): los puntos de control del curso apuntan ahora al banco del simulador, que ya filtra por competencia y tema. La
> §4.1 afirma que `?seccion=banco` no existe: era cierto en la base de esta rama, pero `main` ya lo admite
> (`lib/simulador-navegacion.ts`).

**Fecha:** 2026-11-17 · **Analizado:** 741 preguntas (360 de Balotarios OECE + 381 del banco revisado) contra las 18 clases de `/cursos/certificacion-oece`.

**Método.** Ocho análisis independientes, pregunta por pregunta, leyendo enunciado, alternativas y respuesta correcta (y en el banco revisado, además, su `explanation` con fuentes): cinco por balotario (`tmp/analisis-b1.md` … `tmp/analisis-b5.md`) y tres por competencia del banco (`tmp/analisis-banco-c1.md` … `-c3.md`). Criterio de «cubierta»: la clase desarrolla el conocimiento central que la respuesta exige (regla, cifra, plazo u órgano); un tema tocado tangencialmente no cuenta. Las contradicciones marcadas como **verificadas** se cotejaron contra el chunk verbatim del corpus (Reglamento texto actualizado al 09.01.2026, con D.S. 001-2026-EF).

## 1. Veredicto global

| Corpus | Preguntas | Cubiertas | % | Contradicciones formales |
|---|---|---|---|---|
| Balotario 1 | 72 | 26 | 36 % | 1 (+1 potencial) |
| Balotario 2 | 72 | 17 | 24 % | 1 |
| Balotario 3 | 72 | 25 | 35 % | 0 (4 inducciones a error) |
| Balotario 4 | 72 | 27 | 37,5 % | 0 (2 preguntas internamente inconsistentes) |
| Balotario 5 | 72 | 14 | 19 % | 0 (2 tensiones) |
| Banco C1 (actuaciones preparatorias) | 130 | 22 | 17 % | 1 |
| Banco C2 (selección) | 117 | 14 | 12 % | 2 |
| Banco C3 (ejecución contractual) | 134 | 16 | 12 % | 0 |
| **Total** | **741** | **161** | **22 %** | **5 formales verificadas + 1 potencial** |

**Conclusión principal:** el curso enseña hoy la *capa introductoria* de cada tema —qué es cada institución, quién la integra, los topes de la Ley— y el examen (balotarios y banco) evalúa predominantemente la *capa operativa del Reglamento*: plazos exactos por etapa, quién registra qué actuación en la Pladicop, reglas por tipo de procedimiento y por sistema de entrega, excepciones a las reglas generales. Un alumno que solo estudia el curso dispone de entre el 12 % y el 37 % del conocimiento que las preguntas exigen.

**Casuísticas.** 91 de 360 preguntas de balotarios (25 %) plantean escenarios prácticos («La Municipalidad X necesita…», «En una contratación bajo MDA…»); el banco revisado es 100 % casuístico por diseño (niveles apply/analyze: 46 %/38 % en C1). El curso, en cambio, no presenta **ninguna** casuística: su contenido es exclusivamente conceptual (resumen → puntos clave → base legal).

## 2. Contradicciones e inducciones a error (verificadas contra el corpus)

1. **Segmentación de lo no programado — el curso enseña el texto derogado del Art. 42.3.** La clase `plan-anual-contrataciones` dice «Lo no planificado exige primero que el área usuaria solicite modificar el CMN». El texto sustituido por el D.S. 001-2026-EF dice: «En el caso de contrataciones no programadas y, siempre que la necesidad esté incluida en el CMN respectivo, la DEC efectúa la segmentación de la contratación **luego de la recepción del requerimiento**» (chunk 48 del Reglamento). El banco C1 (fila 97) evalúa exactamente la regla nueva; el alumno del curso marcaría la opción incorrecta. **Corregir la clase IV.** De paso, incorporar los numerales nuevos: 42.4 (compras centralizadas/corporativas → categorías estratégico/avanzada) y 42.5 (catálogos electrónicos, no competitivos y supuestos excluidos **no se segmentan**).
2. **Cancelación y nulidad de oficio se impugnan ante el TCP sin importar la cuantía (Art. 302.3).** La clase `recurso-apelacion` enseña solo la regla general de cuantía («Tribunal si supera 50 UIT; si no, la AGA»), que lleva a error en esas dos hipótesis. Añadir a la clase XI. (Verificado: chunk 369.)
3. **El jurado conduce las rondas de negociación y diálogo competitivo (Art. 60.4).** La clase `evaluadores` enseña «el jurado evalúa las ofertas y la DEC se encarga del resto de actuaciones», regla general cierta (Art. 56/60.5) pero con esta excepción expresa, además con un integrante del área usuaria que la representa. El banco C2 (fila 83) la evalúa; también B3-1/B3-30. (Verificado: chunk 69.)
4. **La interacción con el mercado no aplica en MDA (Art. 295.1).** La clase `expediente-contratacion` dice que el expediente contiene «la estrategia con la interacción con el mercado» sin la excepción MDA; B1-69 evalúa esa exclusión (y B5-11 la de segmentación). (Verificado: chunk 362.)
5. **Quién registra en la Pladicop: regla general con excepciones (Arts. 14.2.a, 59.5.c, 60.3).** La clase `actores-involucrados` enseña «la DEC registra los actos de las tres fases» sin el «salvo aquellos que le corresponda registrar a los evaluadores»: los comités registran sus actas (59.5.c), los jurados comunican sus prórrogas a la DEC para que esta las registre (60.3) y el oficial de compra registra en SIE. B2-14, B2-38, B3-43 y B3-9 evalúan la regla por procedimiento. (Verificados: chunks 15, 67, 68.)
6. **Indelegabilidad de la AGA al resolver apelaciones (Art. 302.1)** — verificado. La clase I enseña que titular y AGA «pueden delegar, salvo excepciones» sin identificarlas; B2-53 exige saber que esta facultad es indelegable.
7. **Potencial (B1-32):** el curso nunca menciona el **acta de inicio** de obra, documento sobre el que gira la respuesta correcta.

## 3. Brechas de cobertura — los 12 bloques que el examen pesa y el curso no enseña

Ordenados por volumen de preguntas afectadas (balotarios + banco):

1. **Ejecución de obra: suspensión, reprogramación y régimen del plazo** (~35 preguntas). Suspensión del plazo por impago de valorizaciones y sus efectos (107.1/107.4, 202.3), nuevo programa de ejecución (aprobación tácita, <80 % valorizado, ruta crítica — 198), plazos del supervisor 5 d/h y de la entidad 10 d/h con silencio (200.1), diferimiento del inicio (176.7–9), fast track y programa acelerado (207), sustitución de personal clave (189), constatación física, comunicaciones tras el reinicio. *Ninguna clase lo trata.*
2. **Reglas procedimentales de la fase de selección** (~33). Plazos mínimos 22 días y 7 días desde integración (64.1/68.1), consultas 7/3 días (66.1), secuencia y evaluadores por procedimiento (SIE, CP, CPA, comparación de precios: dos ofertas, 3 d/h, sin comité), firmeza de la buena pro y denegatoria ficta (82, 316), pérdida y sucesión de la buena pro (91), subsanación de oferta vs. cambio esencial (78.2/78.4). La clase X da tipología y etapas genéricas.
3. **Requerimiento, estrategia y mercado en detalle (1.2: 65 preguntas en el banco)** — el bloque más numeroso del examen en actuaciones preparatorias: contenido del requerimiento y sus documentos (44.4–44.11), cuantía y sus componentes (53), tipos de indagación y consulta básica/avanzada (48–50), difusión de la interacción (51), excepciones al fraccionamiento (45.2), ítems y agrupamiento (52).
4. **Modificaciones contractuales de bienes/servicios y obras — procedimiento** (~45). Ampliaciones de plazo (10 d/h, prórroga, 12 d con silencio — 142), reducción (109), cesión de posición contractual (112.2.c), suspensión (107), mayores metrados (197), adicionales de emergencia y Contraloría 30–50 % (194/196), topes D&C 40 %/50 % (B2-07), mejora (143), precio no pactado (141).
5. **Contratos estandarizados de uso internacional** (~31). Marco normativo de selección y ejecución, capacidad técnica, tope 50 %, rol de la DGA, subcontratación, guías. Solo se nombran de pasada.
6. **Adelantos y amortización** (~15). 10 %/20 % (178.3.b), fideicomiso > S/ 5 M y exclusión en consultoría (178.2), amortización proporcional (180.2/180.4), diferimiento y adelanto (15 días antes).
7. **Penalidades y garantías — régimen operativo** (~12). Tope 10 % (119.2/229.2), cobro, garantía 5 % tras recepción de obra (183), adecuación de garantías en 10 días (117).
8. **Residentes, supervisión y expediente técnico de obra** (~17). Responsabilidades (186/188/222), sustitución de personal clave (189), coherencia y plazos del ETO (170–171).
9. **Valorización, recepción y liquidación** (~10). Mensualidad (209), reajustes, levantamiento de observaciones, consentimiento (215), liquidación parcial 10 d/h.
10. **Sistemas de entrega de obra** (~10). Solo construcción, diseño y construcción, llave en mano, diseño de operación y mantenimiento, formulación y diseño — y sus efectos en interacción, inicio de plazo e incentivos.
11. **Controversias — procedimiento** (~12). Árbitro único (84.3), plazo 30 días (84.4), ad hoc ≤10 UIT, JPRD disuelta → arbitraje y reconformación (353.11/13), conciliación menor 15+15 (330.2).
12. **Reglas específicas de CPI y MDA** (~30). CPI: 5 proveedores I+D, precomercial, diálogo competitivo, entidades habilitadas, consulta básica/avanzada. MDA: sin segmentación ni interacción (295.1), requerimiento sanitario, jurado de 5, adjudicación por costo-efectividad.

**Bloques con cobertura 0 % de subcompetencias oficiales del examen:** 1.4 (documentos estandarizados), 1.5 (modificación del PAC), 1.6 (plan anual y necesidades — matiz del 42.3), 1.8 (PLADICOP), 2.2 (etapas y plazos — 40 preguntas), 2.3, 2.6, 2.8, 3.1, 3.7, 3.8, 3.9, 3.11, 3.12.

**Clases que no responden ninguna pregunta del corpus analizado:** `garantias` (0 en banco C3), `perfeccionamiento-contrato` (0 en banco C3 y B4), `incentivos-obras-consultoria` (0 en banco C3 y B2/B4), `modalidades-contratacion-eficiente` (0 en B2), `expediente-contratacion` y `plan-anual-contrataciones` (0 en B1/B4). Las tres primeras enseñan reglas de la Ley que sí se evalúan en los balotarios (10 % de fiel cumplimiento, plazos de 8/5/3 días, incentivos 1 %/3 %), pero el banco revisado exige su desarrollo reglamentario.

## 4. Problemas estructurales del simulador (lado preguntas)

1. **Los puntos de control del curso no filtran por tema.** Cada sección enlaza a `/simulador?vista=practicar` prometiendo «preguntas del balotario sobre actores, PAC, expediente…», pero la práctica solo permite elegir balotario completo (72 preguntas de todos los temas). El parámetro `?seccion=` que circula entre alumnos (p. ej. `?seccion=banco`) **no existe** en el simulador y se ignora silenciosamente.
2. **Preguntas defectuosas en los balotarios** (hallazgo del análisis B4): B4-28 es internamente inconsistente (pregunta cuándo NO queda firme la buena pro y la clave responde el caso en que SÍ); B4-51/68 usan descripciones casi idénticas con claves distintas; B4-63 no da la cuantía que la regla de las 50 UIT exige; B2-71 presenta como clave un procedimiento inexistente («Adjudicación Simplificada»); B1-32 gira sobre un «acta de inicio de obra» que no aparece en el corpus del Reglamento. **Corregidas el 2026-11-17 vía `balotario_reviews`**: 6 revisiones con enunciado, alternativas, clave, explicación y cita verbatim del corpus, a nombre de la cuenta Administradora; respaldo en `docs/supabase/2026-11-17-balotario-defectuosas.sql`.
3. **Balotarios 1 y 2 sin etiqueta de competencia** (144 preguntas), y los etiquetados no siguen exactamente el blueprint oficial (25/22/25).

## 5. Recomendaciones

**A. Corregir de inmediato las 6 contradicciones** (sección 2): son cifras y reglas vigentes verificadas contra el corpus que hoy enseñan algo distinto a lo que el examen evalúa. Afectan a las clases I, III, IV, VII y XI. Tras editar, cada clase mantiene `verificada: true` solo si el nuevo texto se vuelve a contrastar chunk a chunk.

**B. Añadir el bloque de casuísticas al modelo de clase** (`ContenidoClase.casuisticas`): por cada clase, 3–5 casos tipo examen con enunciado situacional, la regla que resuelve el caso y su base legal — derivados de las preguntas reales del balotario/banco analizadas (p. ej. «Municipalidad X ante lluvias: ¿quién aprueba el no competitivo?»). Se renderiza como tercera pestaña «Casuística» en `pestanas-clase.tsx`. Es la vía más directa para que el curso «entregue casuísticas para el examen» sin duplicar el simulador.

**C. Completar el temario por fases, priorizando por peso del examen:**
- *Fase 1 (mayor retorno):* módulo de ejecución de obra (suspensión/reprogramación/plazo), reglas procedimentales de selección, modificaciones contractuales (procedimiento), adelantos, penalidades. Cubre los bloques 1–4 y 6–7 (~120 preguntas afectadas).
- *Fase 2:* contratos estandarizados internacionales, sistemas de entrega, residente/supervisor/ETO, valorización-recepción-liquidación, controversias procedimentales, PLADICOP por actuación.
- *Fase 3:* profundización CPI/MDA, principios, modalidades de pago, subcontratación.
Cada clase nueva nace del análisis: tema, reglas y artículos ya identificados en `tmp/analisis-*.md`.

**D. Alinear los puntos de control:** aceptar un filtro temático en el simulador (p. ej. `/simulador?vista=practicar&tema=actos-preparatorios` que agrupe las preguntas de la sección por la clasificación de este análisis) y que el botón de control de cada sección lo use. Corregir además las 4 preguntas defectuosas vía `balotario_reviews` y etiquetar competencias en B1/B2.

## Anexos

En `docs/evaluaciones/2026-11-17-anexos-coherencia/`:

- `analisis-b1.md` … `analisis-b5.md`: análisis por pregunta de cada balotario (clase, tema, casuística, coherencia).
- `analisis-banco-c1.md` … `analisis-banco-c3.md`: análisis por pregunta del banco revisado con cobertura por subcompetencia.
- `banco-revisado.json`: volcado de `exam_questions` (`status=published`) tal como se analizó. Las preguntas de balotarios están en `app/components/balotarios/balotarios-oece.json`; a la fecha hay 6 revisiones en `balotario_reviews` (las preguntas defectuosas corregidas el 2026-11-17).
- Verificaciones verbatim del corpus: Arts. 14, 42 (texto sustituido), 58–60, 176, 295, 302–303 del Reglamento (documento «texto actualizado al 09.01.2026»).
