# Curso de certificación OECE: alineación con el temario oficial del examen

**Objetivo:** que `/cursos/certificacion-oece` prepare para el examen de certificación tal como está
definido, no como lo ordenó el taller de origen. El examen sigue el **temario oficial del OECE
(versión 2025-04-25)**, que ACE ya tiene en `lib/exam-curriculum.ts`: 3 competencias, 30
subcompetencias y una cuota de preguntas por subcompetencia que suma **72** (25 + 22 + 25). Es el
mismo reparto que usa el simulacro de 120 minutos.

## 1. Diagnóstico

Leyenda del estado: ✅ cubierto · 🟡 parcial · ❌ sin clase. «Peso» = preguntas sobre 72 en el
examen. «Banco» = preguntas publicadas hoy en el simulador para esa subcompetencia.

### Competencia 1 · Actuaciones preparatorias (25 de 72)

| Cód. | Subcompetencia | Peso | Banco | Clase actual | Estado |
|---|---|---|---|---|---|
| 1.1 | Expediente de contratación | 6 | 30 | III Expediente | ✅ |
| 1.2 | Requerimiento, estrategia y mercado | **13** | 65 | VI Actos preparatorios (todo en una clase), V Segmentación | 🟡 la más pesada del examen, cubierta en un solo resumen |
| 1.3 | Tipos y perfiles de evaluadores | 1 | 10 | VII Evaluadores | ✅ |
| 1.4 | Documentos estandarizados (bases) | 1 | 5 | — | ❌ |
| 1.5 | Modificación del Plan Anual | 1 | 5 | IV (solo «no planificadas») | 🟡 |
| 1.6 | Plan Anual y necesidades | 1 | 5 | IV Plan anual | ✅ |
| 1.7 | Actores de la contratación | 1 | 5 | I Actores | ✅ |
| 1.8 | PLADICOP en actuaciones preparatorias | 1 | 5 | — | ❌ |

### Competencia 2 · Selección (22 de 72)

| Cód. | Subcompetencia | Peso | Banco | Clase actual | Estado |
|---|---|---|---|---|---|
| 2.1 | Procedimientos y modalidades | 5 | 25 | X Procedimientos, II Modalidades | ✅ |
| 2.2 | Etapas, plazos y condiciones | **8** | 40 | X (solo la lista de etapas) | 🟡 segunda más pesada; faltan plazos y condiciones de cada etapa |
| 2.3 | Evaluación, principios y criterios | 1 | 5 | — | ❌ |
| 2.4 | Consentimiento y firmeza de la buena pro | 1 | 5 | — | ❌ |
| 2.5 | Pérdida de la buena pro | 1 | 5 | — | ❌ |
| 2.6 | PLADICOP en selección | 2 | 10 | — | ❌ |
| 2.7 | Interposición de apelaciones | 1 | 6 | XI Apelación | ✅ |
| 2.8 | Resolución de apelaciones | 1 | 10 | XI + XXXIII (trámite, resolución y garantía) | ✅ |
| 2.9 | Condiciones para perfeccionar el contrato | 1 | 5 | XII Perfeccionamiento (en la sección de ejecución) | ✅ mal ubicada |
| 2.10 | Requisitos y plazos de perfeccionamiento | 1 | 6 | XII Perfeccionamiento | ✅ mal ubicada |

### Competencia 3 · Ejecución contractual (25 de 72)

| Cód. | Subcompetencia | Peso | Banco | Clase actual | Estado |
|---|---|---|---|---|---|
| 3.1 | Contenido y vigencia del contrato | 1 | 6 | XIII (vigencia) | 🟡 falta contenido del contrato |
| 3.2 | Modificaciones contractuales | **6** | 30 | XV (adicionales y reducciones) | 🟡 faltan ampliación de plazo, hecho sobreviniente, suspensión, cesión, subcontratación |
| 3.3 | Penalidades, garantías, resolución y nulidad | 3 | 15 | XIV Garantías, XVI Resolución y nulidad | 🟡 faltan penalidades |
| 3.4 | Entrega, conformidad y observaciones | 1 | 8 | — | ❌ |
| 3.5 | Controversias y solución de conflictos | 3 | 17 | XVIII Controversias | ✅ |
| 3.6 | Requisitos de ejecución de obras | 1 | 5 | XIII (inicio de plazo) | 🟡 |
| 3.7 | Expediente técnico de obra | 1 | 5 | — | ❌ |
| 3.8 | Residente, supervisor y responsables | 1 | 5 | — | ❌ |
| 3.9 | Adelantos y amortización | 1 | 8 | — | ❌ |
| 3.10 | Modificaciones de obras | **5** | 25 | XVII (solo intervención económica) | 🟡 faltan adicionales de obra, ampliación, suspensión, metrados, plantel |
| 3.11 | Valorización, recepción y liquidación | 1 | 5 | — | ❌ |
| 3.12 | Contratos estandarizados | 1 | 5 | — | ❌ |

**Fuera del temario oficial:** VIII MDA y IX Incentivos de obras. No se borran, pero dejan de estar
en el recorrido principal y pasan a «Complementos».

**Resumen:** 9 subcompetencias ✅, 9 🟡 y 12 ❌. Las 12 sin clase suman 13 de 72 preguntas, y las 🟡 incluyen
las tres más pesadas del examen (1.2 = 13, 2.2 = 8 y 3.2 + 3.10 = 11). Hoy el curso dedica el mismo
espacio a MDA (fuera del temario) que a requerimiento y estrategia (el 18 % del examen).

## 2. Nueva estructura propuesta

Secciones = las 3 competencias oficiales, en su orden. Cada clase indica su peso en el examen.
Los slugs actuales se conservan (el avance guardado sigue valiendo); las clases nuevas son ⭐.

**Competencia 1 · Actuaciones preparatorias (25)**
1. I Actores involucrados (1.7)
2. IV Plan anual y su modificación (1.6 + 1.5, se amplía)
3. V Segmentación (1.2)
4. ⭐ Requerimiento: contenido, estandarización, fichas y no objeción (1.2)
5. ⭐ Interacción con el mercado y cuantía (1.2)
6. ⭐ Estrategia de contratación: procedimiento, pago, entrega, riesgos, garantías y adelantos (1.2)
7. VI → «Actuaciones preparatorias y fraccionamiento» (1.2, se acota a lo que no cubren 4-6)
8. III Expediente de contratación (1.1)
9. VII Evaluadores (1.3)
10. ⭐ Bases y documentos estandarizados (1.4)
11. ⭐ PLADICOP en actuaciones preparatorias (1.8)

**Competencia 2 · Selección (22)**
1. X Procedimientos de selección (2.1)
2. II Modalidades de contratación eficiente (2.1) ← **se mueve desde Actos preparatorios**
3. ⭐ Etapas y plazos de la selección: convocatoria, participantes, consultas y observaciones,
   integración, ofertas, admisión, evaluación, calificación (2.2)
4. ⭐ Evaluación de ofertas: principios, criterios y empate (2.3)
5. ⭐ Buena pro: otorgamiento, consentimiento, firmeza y pérdida (2.4 + 2.5)
6. ⭐ PLADICOP en la selección (2.6)
7. XI Recurso de apelación: interposición (2.7)
8. ⭐ Resolución de la apelación: trámite, plazos, garantía y efectos (2.8)
9. XII Perfeccionamiento del contrato (2.9 + 2.10) ← **se mueve desde Ejecución**

**Competencia 3 · Ejecución contractual (25)**
1. XIII Contenido, vigencia e inicio del contrato (3.1, se amplía)
2. XV Modificaciones contractuales (3.2, se amplía: plazo, sobreviniente, suspensión, cesión, subcontratación)
3. XIV Garantías (3.3)
4. ⭐ Penalidades (3.3)
5. XVI Resolución y nulidad (3.3)
6. ⭐ Recepción, conformidad y pago (3.4)
7. XVIII Controversias (3.5)
8. ⭐ Obras I: requisitos, expediente técnico, residente y supervisión (3.6 + 3.7 + 3.8)
9. ⭐ Obras II: adelantos y amortización (3.9)
10. ⭐ Obras III: adicionales, ampliación, suspensión, metrados y plantel (3.10)
11. XVII Intervención económica (3.10)
12. ⭐ Obras IV: valorización, recepción y liquidación (3.11)
13. ⭐ Contratos estandarizados (3.12)

**Complementos (fuera del temario):** VIII MDA, IX Incentivos de obras.

Resultado: de 18 a 35 clases (11 + 9 + 13 en el recorrido principal y 2 complementos), con 17
clases nuevas y las 30 subcompetencias cubiertas. Cada clase nueva pasa por
la misma verificación contra el corpus que las actuales (`verificada: true` solo si cada cifra se leyó
en el texto de la norma).

## 3. Recursos para entrenar (evaluación)

| # | Recurso | Para qué | Coste | Prioridad |
|---|---|---|---|---|
| R1 | **Peso en el examen** en cada clase y sección («≈13 de 72 preguntas») | Decidir dónde invertir el tiempo | Bajo: dato ya en `exam-curriculum.ts` | Alta |
| R2 | **«Practica este tema»** al final de cada clase: abre el banco filtrado por su subcompetencia | Pasar de leer a responder sin buscar el tema a mano | Medio: el banco aún no acepta `?tema=` para alumnos | Alta |
| R3 | **Prueba diagnóstica** al empezar (≈15 preguntas repartidas por competencia) que recomienda por dónde empezar | Estudiar lo que falla, no todo por igual | Medio: reutiliza el banco | Alta |
| R4 | **Ficha de plazos y cifras** (apelación 8/5 días, perfeccionamiento 8/5 + 3 + 4, garantías 10 %, adicionales 25/15/30 %, contrato menor 8 UIT, garantía de apelación 3 % y 0,5 % MYPE…) imprimible | Lo que más se confunde en el examen, en una sola página | Bajo: cifras ya verificadas en las clases | Alta |
| R5 | **Glosario de siglas** (DEC, PAC del CMN, PMBSO, JPRD, PLADICOP, CPI, MDA, RNP…) | Leer las preguntas sin tropezar con siglas | Bajo | Media |
| R6 | **Caso práctico** por clase (escenario + pregunta razonada) | El examen pregunta casos, no definiciones | Medio: redactar y verificar | Media |
| R7 | **Avance por competencia** en la portada, enlazando con lo que ya mide el simulador | Ver de un vistazo qué competencia está floja | Medio | Media |
| R8 | **Ruta de estudio** según la fecha del examen (clases por semana + simulacros) | Constancia y llegar a tiempo | Medio | Baja |
| R9 | **Línea del proceso** (diagrama de las 3 fases con los hitos) | Ubicar cada tema en el proceso | Bajo | Baja |
| R10 | Vídeos reales | Sustituir la maqueta | Alto: producción propia o licencia | Cuando haya material |

## 4. Fases de ejecución

1. ✅ **Reordenar y pesar** (sin contenido nuevo): secciones = competencias, mover XII a Selección,
   «Complementos» para MDA e Incentivos, R1 (peso por clase) y R4 (ficha de plazos y cifras).
   Hecho: `temas` por clase y `competencia` por sección; `lib/cursos/temario-examen.ts` (pesos);
   `lib/cursos/ficha-cifras.ts` + `/cursos/[curso]/ficha`; la práctica apunta al banco del simulador
   (`?seccion=banco`), que filtra por competencia y tiene el simulacro de 72. Trinquete en
   `tests/cursos-catalogo.test.ts`: la lista de temas oficiales sin clase solo puede encogerse (12 hoy).

   **Integrado en el mismo PR** (trabajo hecho en paralelo, ver
   `docs/evaluaciones/2026-11-17-coherencia-simulador-curso.md`): 6 correcciones de reglas vigentes, R6
   (3 casos por clase, pestaña «Casuística») y las clases de refuerzo XIX (2.2, 2.4, 2.5), XX (3.2), XXI
   (3.9, 3.3), XXII (3.10) y XXIII (3.12). El trinquete baja a **8** temas sin clase: 1.4, 1.8, 2.3, 2.6,
   3.4, 3.7, 3.8 y 3.11. La ficha suma 8 cifras de esas clases.
2. ✅ **Clases de alto peso**: 1.2 con tres clases nuevas (XXIV requerimiento, Art. 44; XXV interacción
   con el mercado y cuantía, Arts. 47–51 y 53; XXVI estrategia, agrupamiento y fraccionamiento, Arts. 45,
   46 y 52), 13 casos y 4 cifras más en la ficha. Elegidas por lo que más pregunta el banco del tema
   (Art. 44 en 32 preguntas). Se usa el texto modificado del 51.3: 6 días hábiles, no 3.
   2.2, 3.2 y 3.10 quedaron cubiertas por XIX, XX y XXII.
3. ✅ **Huecos restantes**: seis clases (XXVII–XXXII) para 1.4 + 1.8 (bases estándar, anuncio y Pladicop
   en actuaciones preparatorias), 2.6 (Pladicop en la selección), 2.3 (evaluación y desempate), 3.4
   (recepción y conformidad), 3.7 + 3.8 (expediente técnico, residente, supervisión y gerente de proyecto)
   y 3.11 (valorización, recepción y liquidación de obra); 20 casos y 8 cifras más en la ficha. **Ningún
   tema oficial queda sin clase**: el trinquete pasa a ser una regla del test.
4. 🟡 **Entrenamiento**: ✅ 2.8 ampliado con la clase XXXIII (trámite y resolución de la apelación, Arts.
   305–315 del Reglamento; 7 casos y 4 cifras en la ficha). ✅ R2: «Practicar» junto a cada tema de la
   clase abre el banco con `?tema=<código>` y deja competencia y tema elegidos. ✅ R5: glosario de siglas
   (Art. 3.1 del Reglamento más las que usa el curso), con test que exige definir toda sigla nueva.
   Pendiente: R3 (prueba diagnóstica).

Cada fase en su propio PR, con verificación legal contra el corpus y tests del catálogo (que ya exigen
base legal, numeración correlativa y que todo artículo citado esté declarado). Se añadirá un test que
exija que **toda subcompetencia del temario oficial tenga al menos una clase**, para que no vuelva a
quedar un tema sin cubrir.
