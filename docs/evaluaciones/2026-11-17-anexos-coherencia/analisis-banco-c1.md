# Banco revisado · Competencia 1 vs curso

**Método.** Se analizaron las 130 preguntas de `competency_code === "1"` de `tmp/banco-revisado.json` (numeradas en su orden de aparición en el JSON) y se contrastaron con las 18 clases del curso (`actos-preparatorios.ts`, `fase-seleccion.ts`, `ejecucion-contractual.ts`, `obras.ts`). Criterio de cobertura: el alumno que estudió la clase dispone del conocimiento central (regla, cifra, plazo, institución) que la respuesta correcta exige; una mención tangencial no cuenta. La coherencia compara el `explanation` del banco con el texto de la clase, no con memoria externa.

| # | Subcomp | Clase o NO_CUBIERTA | Tema específico | Coherencia | Nivel |
|---|---|---|---|---|---|
| 1 | 1.1 | NO_CUBIERTA | Modificación de requerimiento y no objeción (44.7-44.8) | N/A | advanced/analyze |
| 2 | 1.1 | expediente-contratacion | Secuencia CMN→aprobación→convocatoria | OK | advanced/analyze |
| 3 | 1.1 | NO_CUBIERTA | Catálogo obligatorio tras desierto (278, 277.2) | N/A | advanced/analyze |
| 4 | 1.1 | NO_CUBIERTA | Marca y compatibilización de alcance (44.6) | N/A | advanced/analyze |
| 5 | 1.6 | NO_CUBIERTA | Directiva PAC: desiertos en relación de ítems (7.1.c) | N/A | intermediate/apply |
| 6 | 1.1 | NO_CUBIERTA | Ficha de homologación parcial y cuantía (44.9) | N/A | advanced/analyze |
| 7 | 1.1 | NO_CUBIERTA | Objeto por mayor costo y expediente técnico | N/A | advanced/analyze |
| 8 | 1.1 | NO_CUBIERTA | Matriz de riesgos y asignación por capacidad | N/A | advanced/analyze |
| 9 | 1.1 | NO_CUBIERTA | Banda 95%-110% evaluación limitada (133.a) | N/A | advanced/analyze |
| 10 | 1.1 | NO_CUBIERTA | Impedimento de delegados como evaluadores (61.d) | N/A | advanced/analyze |
| 11 | 1.1 | NO_CUBIERTA | Quórum, remoción y mayoría del comité | N/A | advanced/analyze |
| 12 | 1.1 | NO_CUBIERTA | Confidencialidad de información de mercado (47.2) | N/A | advanced/analyze |
| 13 | 1.1 | NO_CUBIERTA | Acceso a ofertas no admitidas (79) | N/A | advanced/analyze |
| 14 | 1.1 | NO_CUBIERTA | Desierto por ítem y reaprobación (84.2) | N/A | advanced/analyze |
| 15 | 1.1 | expediente-contratacion | Dispensa de reaprobación tras desierto (54.4) | OK | advanced/analyze |
| 16 | 1.1 | NO_CUBIERTA | Cambio de modalidad de pago y reaprobación | N/A | advanced/analyze |
| 17 | 1.1 | NO_CUBIERTA | Norma voluntaria sin acreditador (44.5) | N/A | advanced/analyze |
| 18 | 1.1 | NO_CUBIERTA | Estrategia: cronograma y ruta crítica | N/A | advanced/analyze |
| 19 | 1.1 | NO_CUBIERTA | Paquete vs ítems sobre contrato menor (52.1) | N/A | advanced/analyze |
| 20 | 1.1 | NO_CUBIERTA | Solo construcción exige expediente técnico (158.1) | N/A | advanced/analyze |
| 21 | 1.1 | NO_CUBIERTA | Requerimiento preliminar en diálogo competitivo (44.11) | N/A | advanced/analyze |
| 22 | 1.1 | NO_CUBIERTA | Cuantía integral sin duplicar (53.2) | N/A | advanced/analyze |
| 23 | 1.4 | NO_CUBIERTA | Factores de evaluación y bases estándar (55.2) | N/A | advanced/analyze |
| 24 | 1.5 | NO_CUBIERTA | Rectificación PAC y no programadas (Dir. 11 y 15) | N/A | advanced/analyze |
| 25 | 1.2 | segmentacion-contrataciones | Objetivo de la segmentación | OK | basic/understand |
| 26 | 1.2 | NO_CUBIERTA | Normas voluntarias: condiciones acumulativas (44.5) | N/A | advanced/analyze |
| 27 | 1.2 | NO_CUBIERTA | No objeción por déficit de necesidad (44.8) | N/A | advanced/analyze |
| 28 | 1.2 | NO_CUBIERTA | Riesgo de dependencia externa (44.3) | N/A | advanced/analyze |
| 29 | 1.2 | NO_CUBIERTA | Estrategia en catálogos electrónicos (277.2) | N/A | advanced/analyze |
| 30 | 1.1 | NO_CUBIERTA | Reaprobación por cambio de cuantía (54.4) | N/A | advanced/analyze |
| 31 | 1.1 | NO_CUBIERTA | Cuantía según requerimiento final (53.2) | N/A | advanced/analyze |
| 32 | 1.2 | NO_CUBIERTA | Desempeño funcional y costo de ciclo de vida | N/A | advanced/analyze |
| 33 | 1.2 | NO_CUBIERTA | Consulta avanzada: herramientas diferenciadas (49.2) | N/A | advanced/analyze |
| 34 | 1.3 | NO_CUBIERTA | Suplentes, mayoría y voto en discordia | N/A | advanced/analyze |
| 35 | 1.2 | NO_CUBIERTA | Modificación conjunta y no objeción (44.7-44.8) | N/A | advanced/analyze |
| 36 | 1.2 | NO_CUBIERTA | Difusión del requerimiento: plazos (51) | N/A | advanced/analyze |
| 37 | 1.6 | NO_CUBIERTA | Directiva PAC: aprobación y publicación (8.1, 9.1) | N/A | advanced/analyze |
| 38 | 1.7 | evaluadores | DJ conflicto de intereses antes de designar | OK | intermediate/apply |
| 39 | 1.2 | NO_CUBIERTA | Objeto por prestación de mayor costo (44.10) | N/A | advanced/analyze |
| 40 | 1.2 | NO_CUBIERTA | Confidencialidad de plano no público (47.2) | N/A | advanced/analyze |
| 41 | 1.2 | NO_CUBIERTA | Indagación avanzada: dos fuentes (48.3) | N/A | advanced/analyze |
| 42 | 1.2 | NO_CUBIERTA | Consulta avanzada: difusión y taller (49.2) | N/A | advanced/analyze |
| 43 | 1.2 | NO_CUBIERTA | Ítems sobre cuantía de contrato menor (52.1) | N/A | advanced/analyze |
| 44 | 1.2 | NO_CUBIERTA | Cuantía: menor costo integral (53.2) | N/A | advanced/analyze |
| 45 | 1.2 | NO_CUBIERTA | Costo integral con consumibles (44.4) | N/A | advanced/analyze |
| 46 | 1.2 | NO_CUBIERTA | Excepción de imprevisibilidad (45.2.b) | N/A | advanced/analyze |
| 47 | 1.2 | NO_CUBIERTA | Excepción presupuestal de fraccionamiento (45.2.a) | N/A | advanced/analyze |
| 48 | 1.2 | NO_CUBIERTA | Ficha de homologación de alcance parcial (44.9) | N/A | advanced/analyze |
| 49 | 1.2 | NO_CUBIERTA | Requerimiento preliminar funcional (44.11) | N/A | advanced/analyze |
| 50 | 1.2 | NO_CUBIERTA | Norma obligatoria y actualización de cuantía (44.5) | N/A | advanced/analyze |
| 51 | 1.2 | NO_CUBIERTA | Fecha límite de entrega y cronograma | N/A | advanced/analyze |
| 52 | 1.2 | NO_CUBIERTA | Compatibilización no valida exclusividad (44.6) | N/A | advanced/analyze |
| 53 | 1.2 | NO_CUBIERTA | Cuantía comunicada como referencia (53.4) | N/A | advanced/analyze |
| 54 | 1.2 | NO_CUBIERTA | Prestaciones accesorias y ciclo de vida (44.4) | N/A | intermediate/apply |
| 55 | 1.2 | NO_CUBIERTA | Marca sin compatibilización aprobada (44.6) | N/A | intermediate/apply |
| 56 | 1.2 | NO_CUBIERTA | Objeción solo por necesidad y finalidad (44.8) | N/A | intermediate/apply |
| 57 | 1.2 | NO_CUBIERTA | Objeto por prestación de mayor costo (44.10) | N/A | intermediate/apply |
| 58 | 1.2 | NO_CUBIERTA | Confidencialidad de información no pública (47.2) | N/A | intermediate/apply |
| 59 | 1.2 | NO_CUBIERTA | Indagación avanzada: mínimo dos fuentes (48.3) | N/A | intermediate/apply |
| 60 | 1.2 | NO_CUBIERTA | Consulta avanzada: dos herramientas (49.2) | N/A | intermediate/apply |
| 61 | 1.2 | NO_CUBIERTA | Indagación complementaria a consulta (50.2) | N/A | intermediate/apply |
| 62 | 1.2 | NO_CUBIERTA | Informe de planeamiento y presupuesto (45.2.a) | N/A | intermediate/apply |
| 63 | 1.2 | NO_CUBIERTA | Hecho generador posterior al requerimiento (45.2.b) | N/A | intermediate/apply |
| 64 | 1.2 | NO_CUBIERTA | Agrupar solo si es más eficiente (52.2) | N/A | intermediate/apply |
| 65 | 1.2 | NO_CUBIERTA | Cuantía: todos los conceptos (53.2) | N/A | intermediate/apply |
| 66 | 1.1 | expediente-contratacion | Estrategia documentada en el expediente (46.2) | OK | intermediate/apply |
| 67 | 1.3 | NO_CUBIERTA | Experiencia mínima del experto de jurado (57.2) | N/A | intermediate/apply |
| 68 | 1.8 | NO_CUBIERTA | Difusión: plazo mínimo de consultas (51.2) | N/A | intermediate/apply |
| 69 | 1.3 | evaluadores | Composición mínima del comité (56.1.b) | OK | intermediate/apply |
| 70 | 1.4 | NO_CUBIERTA | Contenido mínimo de bases (55.3) | N/A | intermediate/apply |
| 71 | 1.2 | NO_CUBIERTA | Reuniones uno a uno (50.1.b.2) | N/A | intermediate/apply |
| 72 | 1.2 | NO_CUBIERTA | Ficha de homologación aplicable (44.9) | N/A | intermediate/apply |
| 73 | 1.5 | NO_CUBIERTA | Rectificación de error material del PAC (art. 15) | N/A | intermediate/apply |
| 74 | 1.5 | NO_CUBIERTA | No programada: agregación automática (art. 11) | N/A | intermediate/apply |
| 75 | 1.6 | NO_CUBIERTA | Formulación del PAC en objetos contractuales (6.3) | N/A | intermediate/apply |
| 76 | 1.6 | NO_CUBIERTA | Convocatoria sin previsión en PAC (10.2) | N/A | intermediate/apply |
| 77 | 1.2 | NO_CUBIERTA | Ítems: cuantía sobre contrato menor (52.1.b) | N/A | intermediate/understand |
| 78 | 1.2 | NO_CUBIERTA | Suma de ítems sin duplicar traslados (53.3) | N/A | advanced/analyze |
| 79 | 1.8 | NO_CUBIERTA | Registro del PAC en Seace/CUBSO (9.1) | N/A | intermediate/apply |
| 80 | 1.2 | NO_CUBIERTA | Exigencias sin sustento y calificación (44.6) | N/A | advanced/analyze |
| 81 | 1.5 | NO_CUBIERTA | Rectificación e indicador de oportunidad (13.3) | N/A | advanced/analyze |
| 82 | 1.6 | NO_CUBIERTA | Agrupar necesidades sin duplicar (Dir. PAC 6) | N/A | advanced/analyze |
| 83 | 1.8 | NO_CUBIERTA | Anuncio futuro vs difusión con consultas | N/A | advanced/analyze |
| 84 | 1.8 | NO_CUBIERTA | Acta de reunión y cuantía final (51.4-51.5) | N/A | advanced/analyze |
| 85 | 1.3 | NO_CUBIERTA | Revisión de calificación con jurado: DEC | N/A | basic/understand |
| 86 | 1.2 | NO_CUBIERTA | Requerimiento de obra: expediente técnico | N/A | basic/understand |
| 87 | 1.1 | NO_CUBIERTA | Clasificación de obra al aprobar (157.1) | N/A | basic/understand |
| 88 | 1.2 | NO_CUBIERTA | No competitiva: DEC identifica proveedor (101.1) | N/A | intermediate/understand |
| 89 | 1.1 | expediente-contratacion | Custodia del expediente: DEC (54.1) | OK | basic/understand |
| 90 | 1.1 | expediente-contratacion | Dispensa de reaprobación tras desierto (54.4) | OK | intermediate/apply |
| 91 | 1.1 | expediente-contratacion | Contenido: requerimiento final (54.2.a) | OK | basic/understand |
| 92 | 1.1 | expediente-contratacion | Necesidad en CMN para aprobar (54.3) | OK | intermediate/apply |
| 93 | 1.3 | NO_CUBIERTA | Impedimento del delegado aprobador | N/A | intermediate/apply |
| 94 | 1.1 | expediente-contratacion | Aprobación por autoridad de gestión (54.2) | OK | intermediate/apply |
| 95 | 1.2 | NO_CUBIERTA | No competitiva: sin segmentación (101.1) | N/A | basic/understand |
| 96 | 1.2 | NO_CUBIERTA | Normas técnicas obligatorias (44.5) | N/A | basic/understand |
| 97 | 1.2 | plan-anual-contrataciones | Segmentación de contratación no programada (42.3) | CONTRADICE | intermediate/apply |
| 98 | 1.2 | NO_CUBIERTA | Requerimiento en MDA (295) | N/A | intermediate/understand |
| 99 | 1.2 | actores-involucrados | DEC: normativa sí, técnica no | OK | intermediate/apply |
| 100 | 1.2 | NO_CUBIERTA | Perfil de riesgos de la estrategia (49.2) | N/A | intermediate/understand |
| 101 | 1.2 | plan-anual-contrataciones | DEC verifica necesidad en CMN (14.2.c) | OK | intermediate/apply |
| 102 | 1.2 | NO_CUBIERTA | Normas voluntarias condicionadas (44.5) | N/A | basic/understand |
| 103 | 1.2 | NO_CUBIERTA | CPI: requerimiento por funcionalidades | N/A | basic/understand |
| 104 | 1.2 | NO_CUBIERTA | MDA: sin segmentación ni interacción (295.1) | N/A | basic/understand |
| 105 | 1.2 | NO_CUBIERTA | Catálogos: exclusiones preparatorias (277.2) | N/A | intermediate/apply |
| 106 | 1.2 | NO_CUBIERTA | Riesgos desde el requerimiento (44.3) | N/A | basic/understand |
| 107 | 1.2 | NO_CUBIERTA | Compra centralizada: estratégico (42.4) | N/A | intermediate/apply |
| 108 | 1.2 | NO_CUBIERTA | CPI: difusión y vigilancia tecnológica (248.2) | N/A | intermediate/understand |
| 109 | 1.4 | NO_CUBIERTA | Bases: factores facultativos (55.2) | N/A | basic/understand |
| 110 | 1.7 | evaluadores | DEC recibe ofertas y da buena pro | OK | basic/apply |
| 111 | 1.7 | actores-involucrados | Área técnica estratégica (25.1.d) | OK | basic/understand |
| 112 | 1.8 | NO_CUBIERTA | Medios físicos transitorios (DCT 13.1) | N/A | basic/apply |
| 113 | 1.2 | segmentacion-contrataciones | Segmentación exceptúa contratos menores (42.1) | OK | basic/understand |
| 114 | 1.2 | segmentacion-contrataciones | Informe a áreas usuarias con cronograma (42.2) | OK | intermediate/apply |
| 115 | 1.2 | NO_CUBIERTA | Estrategia: tipo de evaluador (46.1.e) | N/A | intermediate/understand |
| 116 | 1.4 | NO_CUBIERTA | DEC evalúa propuestas del jurado (55.2) | N/A | intermediate/analyze |
| 117 | 1.2 | NO_CUBIERTA | Segmentación sobre PAC actualizado (DCT 1.2) | N/A | intermediate/apply |
| 118 | 1.5 | NO_CUBIERTA | Actualización del PAC aprobado (DCT 1.2) | N/A | intermediate/apply |
| 119 | 1.7 | evaluadores | Jurado evalúa; DEC, el resto | OK | basic/understand |
| 120 | 1.7 | NO_CUBIERTA | Impedimentos previos a contratar (32.4) | N/A | basic/understand |
| 121 | 1.2 | actos-preparatorios | Contenido de la estrategia (49.1) | OK | basic/understand |
| 122 | 1.4 | NO_CUBIERTA | Propuestas del jurado y bases estándar (55.2) | N/A | intermediate/apply |
| 123 | 1.3 | evaluadores | Designación del jurado (60.1) | OK | basic/understand |
| 124 | 1.3 | NO_CUBIERTA | Jurado conduce negociación y diálogo (60.4) | N/A | intermediate/apply |
| 125 | 1.2 | NO_CUBIERTA | Valor por dinero en estrategia (46.1) | N/A | intermediate/understand |
| 126 | 1.3 | NO_CUBIERTA | Opiniones técnicas no vinculantes (56.4) | N/A | basic/apply |
| 127 | 1.3 | evaluadores | Oficial de compra conduce y prepara bases | OK | basic/understand |
| 128 | 1.2 | NO_CUBIERTA | Fuentes de indagación en Pladicop (48.2) | N/A | basic/apply |
| 129 | 1.3 | evaluadores | Bases por DEC; evaluación por jurado | OK | basic/understand |
| 130 | 1.2 | NO_CUBIERTA | Requisitos BIM en obras | N/A | basic/understand |

## Cobertura por subcompetencia

| Subcomp | Etiqueta | Preguntas | Cubiertas | % |
|---|---|---|---|---|
| 1.1 | Expediente de contratación | 30 | 8 | 27 % |
| 1.2 | Requerimiento, estrategia y mercado | 65 | 6 | 9 % |
| 1.3 | Tipos y perfiles de evaluadores | 10 | 4 | 40 % |
| 1.4 | Documentos estandarizados | 5 | 0 | 0 % |
| 1.5 | Modificación del Plan Anual | 5 | 0 | 0 % |
| 1.6 | Plan Anual y necesidades | 5 | 0 | 0 % |
| 1.7 | Actores de la contratación | 5 | 4 | 80 % |
| 1.8 | PLADICOP en actuaciones preparatorias | 5 | 0 | 0 % |

Nota: la fila 97 (subcomp 1.2) se cuenta aparte como "cubierta con contradicción" (la clase trata el tema pero enseña una regla divergente). Las clases que aportan cobertura son: `expediente-contratacion` (8), `evaluadores` (7), `segmentacion-contrataciones` (3), `actores-involucrados` (2), `plan-anual-contrataciones` (1 + la fila 97), `actos-preparatorios` (1). Las clases de modalidades, MDA, procedimientos de selección, apelación y ejecución/obras no cubren ninguna pregunta de esta competencia.

## Temas NO cubiertos por el curso (agrupados)

- **Reglas de contenido y modificación del requerimiento — Rgto 44** (30 preg.: 1, 4, 6-8, 17-22, 26-28, 32, 35, 39, 45, 48-52, 54-57, 72, 80, 100, 102, 106): el banco exige dominar normas técnicas obligatorias vs voluntarias con acreditador en el mercado (44.5: 17, 26, 50, 96, 102); prohibición de marca y compatibilización aprobada (44.6: 4, 52, 55, 80); potestad de la DEC de modificar el requerimiento y no objeción del área usuaria solo por riesgo a necesidad/finalidad pública (44.7-44.8: 1, 27, 35, 56); prestaciones accesorias y costo de ciclo de vida (44.4: 32, 45, 54); fichas de homologación de alcance total o parcial (44.9: 6, 48, 72); objeto por prestación de mayor costo (44.10: 7, 39, 57); identificación de riesgos, perfil de riesgos y matriz de riesgos (44.3, 49.2, 156: 8, 28, 100, 106); requerimiento preliminar del diálogo competitivo (44.11: 21, 49); condiciones de ejecución y cronograma (44.2: 18, 51). La clase `actos-preparatorios` solo enseña quién formula el requerimiento y que la interacción lo perfecciona.
- **Cuantía de la contratación — Rgto 53** (7 preg.: 9, 22, 31, 44, 53, 65, 78): incluir todos los conceptos aplicables sin duplicar ni omitir, sumar ítems sin re-agregar costos comunes (53.3), actualizar con el mercado, comunicar la cuantía cuando es referencia para ofertar (53.4) y la banda 95 %-110 % de la evaluación económica limitada con diseño definido (133.a). El curso solo menciona la cuantía como contenido del expediente y la cifra del PAC del CMN para certificar.
- **Interacción con el mercado — Rgto 47-51** (15 preg.: 12, 33, 36, 40-42, 58-61, 68, 71, 83, 84, 128): confidencialidad de información no pública obtenida directa o indirectamente (47.2); fuentes de la indagación e indagación básica (1 fuente) vs avanzada (2 o más) (48.2-48.3); consulta básica (1 herramienta) vs avanzada (2 o más) y sus herramientas —difusión, talleres, reuniones uno a uno— (49.2, 50.1-50.2); régimen completo de difusión del requerimiento: plazo mínimo de 5 días hábiles, 6 para absolver, 3 para reunión de confirmación, acta publicada al día hábil siguiente, y su distinción del anuncio de contratación futura (Rgto 43 y 51). El curso solo enseña que la interacción "puede ser indagación o consulta".
- **Excepciones al fraccionamiento — Rgto 45.2** (4 preg.: 46, 47, 62, 63): causal presupuestal acreditada con informe de la oficina de planeamiento y presupuesto (45.2.a) e imprevisibilidad con verificación de magnitudes del CMN y hecho generador posterior al primer requerimiento de objeto idéntico (45.2.b). El curso enseña la prohibición de fraccionar (Ley 50) pero no sus excepciones.
- **Agrupamiento y relación de ítems — Rgto 52** (4 preg.: 19, 43, 64, 77): cada contratación individual por ítems/lotes/tramos debe superar la cuantía del contrato menor y el agrupamiento exige sustento de eficiencia frente a contratar por separado.
- **Directiva del PAC (0002-2025-EF/54.01, RD 0041-2025) y transitorias** (13 preg.: 5, 24, 37, 73-76, 79, 81, 82, 112, 117, 118): formulación del PAC agrupando necesidades del CMN en objetos contractuales sin duplicar (6, 6.3); plazos de aprobación (15 días hábiles tras el PIA) y de registro/publicación en Seace de la Pladicop con CUBSO y sede digital (8.1, 9.1); inclusión de procedimientos desiertos o nulos y, en ítems, solo los no adjudicados (7.1.c); contratación no programada agregada automáticamente sin ser modificación (art. 11); rectificación limitada a errores materiales de registro (art. 15) e indicador de oportunidad de convocatoria (13.3); actualización transitoria del PAC aprobado según la DGA y segmentación sobre ese PAC actualizado (DCT 1.2) y uso de medios físicos y digitales conforme a la LPAG mientras Pladicop no implemente funcionalidades (DCT 13.1). El curso trata el PAC del CMN pero no la Directiva ni estas reglas de detalle.
- **Bases estándar y factores de evaluación — Rgto 55** (5 preg.: 23, 70, 109, 116, 122): contenido mínimo de las bases (requerimiento, documentos de oferta, condiciones de ejecución contractual) y uso obligatorio de bases estándar (55.3); factores facultativos que oficial de compra o comité pueden adicionar, suprimir o ajustar respetando evaluación, acreditación, puntaje y metodología, y el rol de la DEC de evaluar y decidir las propuestas de los integrantes del jurado (55.2). No existe clase de documentos estandarizados.
- **Evaluadores: impedimentos, perfiles y funcionamiento** (9 preg.: 10, 11, 34, 67, 85, 93, 120, 124, 126): impedimento del delegado que aprobó el expediente o firmó la designación en ese proceso (61.d); verificación previa de impedimentos personales 1.F-1.G y por parentesco 2.D-2.E (32.4 Ley); quórum con el número total de designados, reemplazo por suplente, prohibición de abstenerse y voto en discordia (56.3, 59); experiencia mínima del experto de jurado (8 años general, 5 en la especialidad, 57.2); jurado conduce las rondas de negociación o diálogo competitivo por mayoría (60.4); opiniones técnicas solicitadas por evaluadores no vinculantes (56.4); revisión de requisitos de calificación de ofertas admitidas a cargo de la DEC (60.5, 72.2). La clase `evaluadores` cubre composición, designación y responsabilidades básicas, no estas reglas.
- **Regímenes especiales de actuaciones preparatorias** (11 preg.: 3, 29, 88, 95, 98, 103-105, 108, 115, 125): catálogos electrónicos de acuerdo marco —exclusión de segmentación, interacción y aprobación del expediente, y paso obligatorio al catálogo tras desierto— (277.2, 278); MDA —requerimiento con servicios asociados, cantidades, plazo y exclusión de segmentación/interacción (295)—; CPI —requerimiento solo con objetivos o funcionalidades y consulta avanzada con difusión y vigilancia tecnológica (248.2)—; selección no competitiva —DEC identifica al proveedor y puede aplicar el art. 47 (101.1)—; variables expresas de estrategia (46.1.e) y valor por dinero como marco (46.1). Las clases de MDA/CPI presentan la institución pero no sus reglas preparatorias.
- **Obras: expediente técnico, clasificación y BIM** (4 preg.: 20, 86, 87, 130): la ruta de solo construcción exige expediente técnico aprobado (158.1) y el requerimiento de obra se plasma en él; identificación de especialidad, subespecialidad y tipología al aprobar el expediente (157.1); planificación de requisitos BIM por la entidad (SNPMGI). Las clases de obras del curso se centran en ejecución, no en preparación.
- **Salvedad del 54.4: reaprobación cuando el informe del desierto exige cambios** (3 preg.: 14, 16, 30): la cadena modificación del requerimiento/estrategia → no objeción → nueva aprobación del expediente → bases antes de volver a convocar. El curso enseña la dispensa "por regla general", pero no la salvedad que la desactiva.
- **Otros** (2 preg.): acceso a ofertas tras la buena pro con excepción de las no admitidas (79: 13); segmentación de compras centralizadas y corporativas de bienes/servicios como estratégicas (42.4: 107).

## Contradicciones con el curso

- **Fila 97 (42.3 modificado, segmentación de lo no programado).** La respuesta correcta/fundamento dice: con la necesidad incluida en el CMN, la DEC segmenta "luego de recibir el requerimiento" y "no basta una mera solicitud de modificación del CMN" (fuente citada por el banco: "42.3. En el caso de contrataciones no programadas y, siempre que la necesidad esté incluida en el CMN respectivo, la DEC efectúa la segmentación de la contratación luego de la recepción del requerimiento."). La clase `plan-anual-contrataciones` dice: "Si una contratación no estaba prevista, la DEC la segmenta después de que el área usuaria solicite la modificación del CMN (Reglamento, Art. 42)" y, en puntos clave, "Lo no planificado exige primero que el área usuaria solicite modificar el CMN". La regla del curso refleja el texto previo a la modificación del numeral; aplicada al supuesto del banco lleva a marcar la opción incorrecta (D). Matiz: si se lee que el curso alude al caso en que la necesidad no está en el CMN, ambas frases pueden convivir, pero la redacción general del punto clave choca con el 42.3 vigente para lo no programado con necesidad ya incluida.
- Matices que no son contradicción formal pero pueden inducir a error: (fila 85) el curso sintetiza que con jurado "este evalúa las ofertas y la DEC se encarga del resto de actuaciones", sin distinguir que la revisión de requisitos de calificación corresponde a la DEC; (fila 76) el curso dice que las entidades "convocan procedimientos para los requerimientos previstos en ella (Ley 53)" (descriptivo), mientras el banco exige saber que la previsión en el PAC no es requisito para convocar, sí la del CMN (Directiva 10.2).

## Estadísticas

- Cubiertas: 22/130 (17 %) · No cubiertas: 107 · Contradicciones: 1 (fila 97, contada aparte)
- Por dificultad: basic 26, intermediate 48, advanced 56
- Por nivel cognitivo: understand 29, apply 44, analyze 57
- Cobertura por clase: expediente-contratacion 8 · evaluadores 7 · segmentacion-contrataciones 3 · actores-involucrados 2 · plan-anual-contrataciones 1 (+1 contradicción) · actos-preparatorios 1 · resto de clases: 0
- Lectura general: el curso cubre bien las reglas básicas de institución (expediente, evaluadores, actores, segmentación), pero el banco de C1 se concentra en reglas operativas finas del requerimiento (art. 44), la cuantía (art. 53), la interacción con el mercado (arts. 47-51), la Directiva del PAC y los regímenes especiales (catálogos, MDA, CPI, no competitiva), además de escenarios avanzados de análisis que exigen esas reglas.
