# Banco revisado · Competencia 3 vs curso

Análisis de las 134 preguntas del banco revisado con `competency_code === "3"` (ejecución contractual) contra las 18 clases del curso (4 archivos). Criterio de cobertura: la clase entrega el conocimiento central (regla, cifra, plazo o institución) que la respuesta correcta exige; un tema tocado de pasada no cuenta. Coherencia: `OK` = consistente con el curso, `CONTRADICE` = choca con una afirmación del curso, `N/A` = no cubierto. Nivel = `cognitive_level · difficulty` (understand/apply/analyze · bas=int basic, int=intermediate, adv=advanced).

| # | Subcomp | Clase o NO_CUBIERTA | Tema específico | Coherencia | Nivel |
|---|---|---|---|---|---|
| 1 | 3.1 | NO_CUBIERTA | Subcontratación: tope 40% del vigente | N/A | analyze·adv |
| 2 | 3.4 | NO_CUBIERTA | Mora en subsanación (144.7) | N/A | analyze·adv |
| 3 | 3.2 | modificaciones-contrato | Tope acumulado de adicionales 25% | OK | analyze·adv |
| 4 | 3.9 | NO_CUBIERTA | Amortización de adelanto (180.2/180.4) | N/A | analyze·adv |
| 5 | 3.8 | NO_CUBIERTA | Sustitución temporal de personal clave | N/A | analyze·adv |
| 6 | 3.10 | NO_CUBIERTA | Suspensión por impago de valorizaciones | N/A | analyze·adv |
| 7 | 3.11 | NO_CUBIERTA | Observaciones y consentimiento de liquidación | N/A | analyze·adv |
| 8 | 3.3 | NO_CUBIERTA | Límite indemnizatorio y vicios ocultos | N/A | analyze·adv |
| 9 | 3.1 | NO_CUBIERTA | Tope de subcontratación 40% | N/A | apply·int |
| 10 | 3.5 | NO_CUBIERTA | Árbitro único por defecto (84.3) | N/A | apply·int |
| 11 | 3.5 | resolucion-controversias | JPRD: validez/nulidad excluidas | OK | apply·int |
| 12 | 3.5 | NO_CUBIERTA | Controversias no suspenden obligaciones | N/A | apply·int |
| 13 | 3.3 | NO_CUBIERTA | Disminución de garantías por reducción | N/A | apply·int |
| 14 | 3.3 | NO_CUBIERTA | Continuación pese a vicio de nulidad | N/A | analyze·int |
| 15 | 3.2 | NO_CUBIERTA | Reducción de obras: 25% | N/A | apply·int |
| 16 | 3.4 | actores-involucrados | Recepción no es conformidad | OK | apply·int |
| 17 | 3.2 | NO_CUBIERTA | Cesión de posición contractual | N/A | apply·int |
| 18 | 3.9 | NO_CUBIERTA | Amortización total solicitada | N/A | apply·int |
| 19 | 3.7 | NO_CUBIERTA | Revisión no impide modificar | N/A | apply·int |
| 20 | 3.10 | NO_CUBIERTA | Sustitución: condiciones de puntaje | N/A | apply·int |
| 21 | 3.10 | NO_CUBIERTA | Sustitución autorizada por silencio | N/A | analyze·int |
| 22 | 3.11 | NO_CUBIERTA | Verificación de levantamiento (212.8) | N/A | analyze·int |
| 23 | 3.12 | NO_CUBIERTA | Modificación por error imputable | N/A | analyze·int |
| 24 | 3.3 | NO_CUBIERTA | Cobro de penalidades (119.3) | N/A | apply·int |
| 25 | 3.2 | NO_CUBIERTA | Aumento de garantía por adicional | N/A | apply·int |
| 26 | 3.3 | resolucion-nulidad-contrato | Nulidad por documentación falsa | OK | apply·int |
| 27 | 3.2 | modificaciones-contrato | Adicionales de bienes: 25% | OK | apply·int |
| 28 | 3.2 | NO_CUBIERTA | Ampliación del plazo de garantías | N/A | apply·bas |
| 29 | 3.6 | inicio-plazo-vigencia-contrato | Inicio de plazo de obra: terreno | OK | apply·int |
| 30 | 3.11 | NO_CUBIERTA | Valorización mensual de supervisión | N/A | apply·int |
| 31 | 3.11 | NO_CUBIERTA | Costo de supervisión por atraso | N/A | apply·int |
| 32 | 3.10 | intervencion-economica | Rechazo de intervención económica | OK | apply·int |
| 33 | 3.7 | NO_CUBIERTA | Contenido del informe de revisión | N/A | apply·int |
| 34 | 3.10 | NO_CUBIERTA | Omisión de programa acelerado | N/A | apply·int |
| 35 | 3.10 | NO_CUBIERTA | Ruta crítica y holgura | N/A | analyze·adv |
| 36 | 3.10 | NO_CUBIERTA | Suspensión por omisiones (171.4) | N/A | apply·int |
| 37 | 3.3 | NO_CUBIERTA | Garantía 5% tras recepción de obra | N/A | apply·int |
| 38 | 3.10 | NO_CUBIERTA | Ampliación del componente diseño | N/A | analyze·adv |
| 39 | 3.10 | NO_CUBIERTA | Mayores metrados vs adicional | N/A | analyze·adv |
| 40 | 3.10 | NO_CUBIERTA | Adicional de emergencia | N/A | analyze·adv |
| 41 | 3.9 | NO_CUBIERTA | Diferencia de amortización (180.4) | N/A | apply·int |
| 42 | 3.10 | NO_CUBIERTA | Exclusión por omisión del expediente | N/A | analyze·adv |
| 43 | 3.5 | actores-involucrados | Anulación de laudo: titular | OK | analyze·int |
| 44 | 3.10 | NO_CUBIERTA | Precio de partida nueva (196) | N/A | analyze·adv |
| 45 | 3.10 | NO_CUBIERTA | Intensificación de trabajos | N/A | analyze·adv |
| 46 | 3.10 | NO_CUBIERTA | Ampliación parcial por tramo | N/A | analyze·adv |
| 47 | 3.10 | intervencion-economica | Intervención: exclusión de gastos generales | OK | analyze·adv |
| 48 | 3.10 | NO_CUBIERTA | Costos reconocidos por ampliación | N/A | analyze·adv |
| 49 | 3.12 | resolucion-controversias | Otros mecanismos en estandarizados | OK | apply·int |
| 50 | 3.2 | NO_CUBIERTA | Condiciones de reducción (109.1) | N/A | analyze·adv |
| 51 | 3.2 | NO_CUBIERTA | Reducción y ajuste de plazo | N/A | analyze·adv |
| 52 | 3.2 | NO_CUBIERTA | Mejora del contrato (143) | N/A | analyze·adv |
| 53 | 3.2 | NO_CUBIERTA | Adicional vs modificación residual | N/A | analyze·adv |
| 54 | 3.2 | NO_CUBIERTA | Hecho sobreviniente imputable | N/A | analyze·adv |
| 55 | 3.2 | NO_CUBIERTA | Prórroga y silencio en ampliación | N/A | analyze·adv |
| 56 | 3.2 | NO_CUBIERTA | Ampliación de contratos vinculados | N/A | analyze·adv |
| 57 | 3.2 | NO_CUBIERTA | Suspensión y trámites de gestión | N/A | analyze·adv |
| 58 | 3.2 | NO_CUBIERTA | Monto de adicional sin precio pactado | N/A | analyze·adv |
| 59 | 3.2 | NO_CUBIERTA | Modificación por adenda (110) | N/A | analyze·adv |
| 60 | 3.3 | NO_CUBIERTA | Límite de penalidades por ítem | N/A | analyze·adv |
| 61 | 3.3 | NO_CUBIERTA | Aumento de garantía y pago | N/A | analyze·adv |
| 62 | 3.6 | NO_CUBIERTA | Inicio en ejecución rápida | N/A | analyze·adv |
| 63 | 3.6 | NO_CUBIERTA | Inicio diferido y adelanto | N/A | analyze·adv |
| 64 | 3.6 | NO_CUBIERTA | Daños por inicio tardío (0,05%/3%) | N/A | analyze·adv |
| 65 | 3.7 | NO_CUBIERTA | Coherencia del expediente técnico | N/A | analyze·adv |
| 66 | 3.2 | NO_CUBIERTA | Plazo de resolución (142.5) | N/A | apply·bas |
| 67 | 3.5 | NO_CUBIERTA | Plazo para solicitar arbitraje | N/A | apply·bas |
| 68 | 3.5 | resolucion-controversias | Contrato menor: conciliación | OK | understand·bas |
| 69 | 3.5 | NO_CUBIERTA | Arbitraje ad hoc: 10 UIT | N/A | apply·int |
| 70 | 3.3 | NO_CUBIERTA | Terminación anticipada en API | N/A | apply·int |
| 71 | 3.4 | NO_CUBIERTA | Plazo de subsanación: 30% | N/A | apply·int |
| 72 | 3.4 | NO_CUBIERTA | Plazo de conformidad: 7 días | N/A | apply·bas |
| 73 | 3.5 | NO_CUBIERTA | Reconformación de JPRD: 30 días | N/A | understand·bas |
| 74 | 3.5 | resolucion-controversias | Mérito ejecutivo de decisión JPRD | OK | apply·int |
| 75 | 3.5 | NO_CUBIERTA | Disolución de JPRD → arbitraje | N/A | apply·int |
| 76 | 3.10 | NO_CUBIERTA | Programa acelerado por retraso | N/A | apply·int |
| 77 | 3.1 | NO_CUBIERTA | Definición de contrato | N/A | understand·bas |
| 78 | 3.1 | NO_CUBIERTA | Responsabilidad en subcontratación | N/A | understand·bas |
| 79 | 3.4 | actores-involucrados | Registro de conformidad en Pladicop | OK | apply·bas |
| 80 | 3.4 | actores-involucrados | Alcance de revisión de la DEC | OK | apply·int |
| 81 | 3.1 | NO_CUBIERTA | Contratación complementaria | N/A | apply·int |
| 82 | 3.1 | NO_CUBIERTA | Plazo de supervisión hasta recepción | N/A | apply·bas |
| 83 | 3.2 | modificaciones-contrato | Equilibrio económico financiero | OK | apply·bas |
| 84 | 3.2 | NO_CUBIERTA | Prórroga de solicitud de ampliación | N/A | apply·bas |
| 85 | 3.10 | NO_CUBIERTA | Opinión del supervisor: 5 días | N/A | apply·bas |
| 86 | 3.10 | NO_CUBIERTA | Falta de opinión del supervisor | N/A | apply·int |
| 87 | 3.10 | NO_CUBIERTA | Plazo de decisión de la entidad | N/A | apply·bas |
| 88 | 3.2 | NO_CUBIERTA | Plazo de decisión en consultoría | N/A | apply·bas |
| 89 | 3.2 | NO_CUBIERTA | Formalización: publicación sin adenda | N/A | apply·bas |
| 90 | 3.2 | NO_CUBIERTA | Modificación de monto: requisitos | N/A | apply·int |
| 91 | 3.2 | NO_CUBIERTA | Registro de ampliación por silencio | N/A | apply·bas |
| 92 | 3.2 | NO_CUBIERTA | Plazo de solicitud: 10 días | N/A | apply·int |
| 93 | 3.2 | NO_CUBIERTA | Silencio: excepción por procedimiento | N/A | apply·bas |
| 94 | 3.10 | NO_CUBIERTA | Silencio en ampliación de obra | N/A | apply·bas |
| 95 | 3.2 | NO_CUBIERTA | Conceptos en consultoría sin tarifa | N/A | apply·bas |
| 96 | 3.3 | NO_CUBIERTA | Penalidades en contrato menor: 10% | N/A | apply·bas |
| 97 | 3.3 | NO_CUBIERTA | Resolución en contrato de contingencia | N/A | apply·int |
| 98 | 3.10 | NO_CUBIERTA | Incremento 50% en diseño y construcción | N/A | apply·int |
| 99 | 3.12 | NO_CUBIERTA | Sustento presupuestal ante MEF (30%) | N/A | apply·int |
| 100 | 3.3 | NO_CUBIERTA | Pago por hitos ejecutados | N/A | apply·bas |
| 101 | 3.3 | NO_CUBIERTA | Pérdida de viabilidad sobreviniente | N/A | apply·int |
| 102 | 3.3 | NO_CUBIERTA | Terminación presupuestal (D&C) | N/A | apply·int |
| 103 | 3.3 | NO_CUBIERTA | Exceso 50% en estandarizado | N/A | apply·int |
| 104 | 3.12 | NO_CUBIERTA | Falta de financiamiento (221.2.f) | N/A | apply·int |
| 105 | 3.4 | NO_CUBIERTA | Subsanación en plazo sin penalidad | N/A | understand·bas |
| 106 | 3.4 | NO_CUBIERTA | Retraso de la entidad no imputable | N/A | apply·int |
| 107 | 3.5 | NO_CUBIERTA | Sin decisión de JPRD → arbitraje | N/A | apply·int |
| 108 | 3.5 | NO_CUBIERTA | Plazos de conciliación en contrato menor | N/A | apply·int |
| 109 | 3.5 | resolucion-controversias | Materias conciliables | OK | understand·bas |
| 110 | 3.5 | NO_CUBIERTA | Conveniencia de iniciar arbitraje | N/A | analyze·adv |
| 111 | 3.5 | NO_CUBIERTA | Institución arbitral sancionada | N/A | apply·int |
| 112 | 3.5 | NO_CUBIERTA | Cómputo tras decisión de JPRD | N/A | apply·int |
| 113 | 3.2 | NO_CUBIERTA | Suspensión sin gastos adicionales | N/A | apply·int |
| 114 | 3.2 | NO_CUBIERTA | Trámites durante la suspensión | N/A | apply·int |
| 115 | 3.2 | NO_CUBIERTA | Solicitud en consultoría: 10 días | N/A | apply·bas |
| 116 | 3.9 | NO_CUBIERTA | Fideicomiso en adelanto de obra | N/A | apply·int |
| 117 | 3.6 | NO_CUBIERTA | Inicio del componente obra (D&C) | N/A | analyze·adv |
| 118 | 3.7 | NO_CUBIERTA | Jefe de elaboración del expediente | N/A | understand·bas |
| 119 | 3.8 | NO_CUBIERTA | Cuaderno en elaboración (188.2) | N/A | understand·bas |
| 120 | 3.8 | NO_CUBIERTA | Gerente de proyecto (222) | N/A | understand·bas |
| 121 | 3.5 | NO_CUBIERTA | Requisitos de integrante de JPRD | N/A | apply·int |
| 122 | 3.8 | NO_CUBIERTA | Inspectores en lugar de supervisor | N/A | apply·int |
| 123 | 3.9 | NO_CUBIERTA | Garantía de adelanto en consultoría | N/A | apply·int |
| 124 | 3.9 | NO_CUBIERTA | Fideicomiso en servicios de edificación | N/A | apply·int |
| 125 | 3.9 | NO_CUBIERTA | Límites de adelantos (10%/20%) | N/A | apply·bas |
| 126 | 3.12 | NO_CUBIERTA | Límite 50% en estandarizado | N/A | understand·bas |
| 127 | 3.2 | NO_CUBIERTA | Causal de ampliación en consultoría | N/A | understand·bas |
| 128 | 3.10 | NO_CUBIERTA | Efecto del programa acelerado | N/A | apply·int |
| 129 | 3.10 | NO_CUBIERTA | Adicionales >30%: Contraloría | N/A | analyze·adv |
| 130 | 3.7 | NO_CUBIERTA | Pronunciamiento: 10 días (171.3) | N/A | apply·int |
| 131 | 3.11 | NO_CUBIERTA | Reajustes en valorización o liquidación | N/A | apply·int |
| 132 | 3.8 | NO_CUBIERTA | Certificación del gerente de proyecto | N/A | apply·int |
| 133 | 3.10 | NO_CUBIERTA | Informe del supervisor: 5 días | N/A | understand·bas |
| 134 | 3.9 | NO_CUBIERTA | Renovación de garantía de adelanto | N/A | apply·int |

Preguntas cubiertas por clase: resolucion-controversias 5 (#11, 49, 68, 74, 109) · actores-involucrados 4 (#16, 43, 79, 80) · modificaciones-contrato 3 (#3, 27, 83) · intervencion-economica 2 (#32, 47) · resolucion-nulidad-contrato 1 (#26) · inicio-plazo-vigencia-contrato 1 (#29). Las 12 clases restantes no cubren ninguna pregunta de competencia 3 (incluidas garantias y perfeccionamiento-contrato).

## Cobertura por subcompetencia

| Subcomp | Etiqueta | Preguntas | Cubiertas | % |
|---|---|---|---|---|
| 3.1 | Contenido y vigencia del contrato | 6 | 0 | 0 % |
| 3.2 | Modificaciones contractuales | 30 | 3 | 10 % |
| 3.3 | Penalidades, garantías, resolución y nulidad | 15 | 1 | 6,7 % |
| 3.4 | Entrega, conformidad y observaciones | 8 | 3 | 37,5 % |
| 3.5 | Controversias y solución de conflictos | 17 | 5 | 29,4 % |
| 3.6 | Requisitos de ejecución de obras | 5 | 1 | 20 % |
| 3.7 | Expediente técnico de obra | 5 | 0 | 0 % |
| 3.8 | Residente, supervisor y responsables | 5 | 0 | 0 % |
| 3.9 | Adelantos y amortización | 8 | 0 | 0 % |
| 3.10 | Modificaciones de obras | 25 | 2 | 8 % |
| 3.11 | Valorización, recepción y liquidación | 5 | 0 | 0 % |
| 3.12 | Contratos estandarizados | 5 | 1 | 20 % |
| **Total** | | **134** | **16** | **11,9 %** |

## Temas NO cubiertos por el curso (agrupados)

- **Procedimiento reglamentario de modificaciones en bienes, servicios y consultorías** (25 preguntas: #15, 17, 50-59, 66, 84, 88-93, 95, 113-115, 127): el banco exige las reglas del Reglamento que el curso nunca desarrolla: condiciones de la reducción (prestaciones no ejecutadas, cuantificables y divisibles, sin impedir la finalidad, 109.1) y determinación del plazo en la misma resolución (109.2); causal residual de "otras modificaciones" solo si no aplican adicional/reducción/ampliación, con requisitos de adenda, sustento técnico-legal y opinión del supervisor (110.1-110.5); cesión de posición contractual entre entidades (112.2.c); mejora con iguales o mejores características (143); ampliaciones: solicitud en 10 días hábiles desde el fin del hecho generador (142.3/199.1.a), prórroga de hasta 10 días hábiles para presentar, decisión en 12 días hábiles con silencio aprobatorio y su excepción por incumplimiento del procedimiento (142.5/199.1.b), formalización por publicación en Pladicop sin adenda y registro del silencio en 2 días hábiles (142.8), ampliación de contratos directamente vinculados (142.6), conceptos reconocibles en consultoría sin tarifa (199.1.c); monto del adicional sin precio pactado vía estructura de costos (141.2) y prohibición de regularización (141.3); suspensión del plazo por eventos no atribuibles sin reconocimiento de gastos salvo los necesarios (107.1) y con trámites de gestión permitidos durante ella (107.4); reducción de obras también al 25 % (64.1).
- **Modificaciones de obras: adicionales, metrados, ampliaciones y aceleración** (20 preguntas: #6, 34-36, 38-40, 42, 44-46, 48, 76, 85-87, 94, 98, 128, 129, 133): ampliación solo por impacto en la ruta crítica del programa vigente, con holgura y ampliaciones parciales por tramos (198.1, 200.1.b, 200.2); plazos de 5 días hábiles para la opinión de la supervisión y 10 días hábiles para la decisión de la entidad, con silencio aprobatorio (200.1.c-d); ampliación del componente diseño por remisión al 199 (200.3); mayores metrados autorizados por el supervisor sin aprobación previa (197); adicionales: procedimiento con resolución previa, prohibición de regularización, excepción de emergencia y pago de referencias presupuestadas con fijación provisional del precio (194, 196); exclusión de adicionales por omisiones del expediente imputables al contratista en diseño y construcción (195.1.b) e incremento de hasta 50 % del componente obra que no califica como adicional (175.1); intensificación de trabajos con adenda y respaldo presupuestario (191); costos vinculados y acreditados por la ampliación (201); suspensión por impago de dos valorizaciones con reconocimiento de costos (202.3); programa y calendario acelerados por retraso injustificado y sus consecuencias (207.1, 207.3); autorización de la Contraloría para adicionales de obra entre 30 % y 50 % (curso corta en el 30 % del titular).
- **Controversias: procedimiento arbitral, conciliatorio y JPRD** (12 preguntas: #10, 12, 67, 69, 73, 75, 107, 108, 110-112, 121): árbitro único por defecto ante duda (84.3); plazo de 30 días hábiles para solicitar arbitraje (84.4); arbitraje ad hoc solo hasta 10 UIT (84.1); el inicio del mecanismo no suspende obligaciones (76.5); JPRD disuelta o sin decisión habilita arbitraje (353.11) y reconformación en 30 días calendario (353.13); plazos de conciliación en contratos menores de 15 + 15 días hábiles (330.2); análisis de costo-beneficio previo a iniciar arbitraje (353.14); 20 días hábiles para designar nueva institución sancionada (323.2); cómputo del plazo desde la notificación de la decisión de la JPRD (353.10); requisitos del integrante de la JPRD (77.7.d).
- **Adelantos y amortización** (7 preguntas: #4, 18, 41, 116, 123-125): amortización proporcional con la excepción del saldo mayor que la valorización (180.2) y tratamiento de diferencias en valorización posterior o liquidación (180.4); fideicomiso para adelanto directo de obra solo si el componente supera S/ 5 000 000; exclusión del fideicomiso en adelantos de consultoría de obra (178.2); límites del 10 % (adelanto directo) y 20 % (materiales) en solo construcción (178.3.b); fideicomiso en servicios de edificación con intervenciones y descuento proporcional (137.3-137.4).
- **Garantías: adecuación por modificaciones y regímenes especiales** (6 preguntas: #13, 25, 28, 37, 61, 134): aumento y disminución proporcional de garantías dentro de 10 días hábiles de aprobada/publicada la modificación, y presentación del aumento como requisito de pago (117.1, 117.3, 117.4); ampliación del plazo de vigencia; retención del 5 % del monto vigente tras la recepción de obra para tramitar la devolución (183.2.a, 183.3); renovación de la garantía de adelanto por plazo idéntico y reducción al saldo pendiente (113).
- **Penalidades** (6 preguntas: #2, 24, 60, 96, 105, 106): límite conjunto de mora y otras penalidades al 10 % del monto vigente del contrato, ítem o contrato menor (119.2, 229.2); deducción de pagos a cuenta, parciales o finales y, de ser necesario, ejecución de la garantía (119.3); mora durante la subsanación con exclusión de los días de revisión de la entidad (144.7); ausencia de penalidad si se subsana en plazo y no imputación del retraso de la entidad (144.4, 144.6).
- **Nulidad y terminación anticipada: regímenes especiales** (6 preguntas: #14, 70, 97, 100-102): continuación de la ejecución pese a vicio de nulidad con informes favorables y análisis costo-beneficio, facultad indelegable (71.3); pago de hitos ejecutados en terminación anticipada (121) y en API (252.5); pérdida de viabilidad sobreviniente en diseño y construcción (175.2.a); terminación anticipada presupuestal por exceder el 50 % de incremento (175.2.b); resolución en contratos de contingencia por stock (285.d).
- **Residente, supervisor y responsables de obra** (7 preguntas: #5, 20, 21, 119, 120, 122, 132): sustitución de profesionales clave con conservación de las condiciones de puntaje (189.2), autorización por silencio en 5 días hábiles (189.3/189.5) y sustitución temporal sin penalidad dentro del plazo vigente (189.4); anotaciones en el cuaderno de incidencias durante la elaboración del expediente (188.2); gerente de proyecto y su certificación en contratos estandarizados (222, 222.2); inicio de obra con inspectores en lugar de supervisor (186.4).
- **Expediente técnico de obra** (6 preguntas: #19, 33, 36, 65, 118, 130): coherencia del expediente con objetivos, alcances y parámetros de la inversión y análisis de eficiencia constructiva (170.1, 170.3); contenido del informe de revisión y que la revisión no impide aprobar modificaciones no advertidas (171.1); pronunciamiento de la entidad en 10 días desde el informe del supervisor (171.3); suspensión del plazo por omisiones que afectan el programa (171.4); jefe de elaboración como responsable técnico.
- **Requisitos de ejecución de obras: inicio y regímenes especiales** (4 preguntas: #62-64, 117): inicio en ejecución rápida con entrega de terreno distinta del acceso para inspecciones (176.4, 176.5); inicio diferido por acuerdo con suspensión del adelanto y reanudación 15 días antes de la nueva fecha (176.7-176.9); daños por inicio tardío hasta 0,05 % diario con tope de 3 % del monto contractual; inicio del componente obra en diseño y construcción dentro de 20 días de aprobado el expediente.
- **Valorización, recepción y liquidación de obra** (5 preguntas: #7, 22, 30, 31, 131): valorizaciones mensuales como pagos a cuenta en supervisión (211); mayor costo de supervisión por atraso imputable deducido de valorizaciones (210); reajustes solicitables en valorización o liquidación (209.4); verificación del levantamiento del pliego sin nuevas observaciones (212.8); régimen de liquidación con plazos de 30/50/15 días y consentimiento con observaciones no atendidas (215).
- **Contratos estandarizados internacionales** (5 preguntas: #23, 99, 103, 104, 126): límite del 50 % del presupuesto de obra del expediente aprobado (221.2.d, 64.7); sustento de capacidad presupuestal ante el MEF al exceder el 30 % (221.2.e); prohibición de modificar monto por errores imputables al contratista que elaboró el diseño (221.2.g); suspensión por falta de financiamiento o resolución (221.2.f).
- **Subcontratación** (3 preguntas: #1, 9, 78): tope del 40 % del monto del contrato vigente con acumulación de subcontratos vigentes y exclusión de prestaciones esenciales vetadas por las bases (108.1); responsabilidad total del contratista frente a la entidad (Ley, Art. 4).
- **Contenido y vigencia: reglas específicas** (3 preguntas: #77, 81, 82): definición legal de contrato (Ley, Art. 4); contratación complementaria que agota la necesidad sin nueva convocatoria (146.1); plazo de la supervisión vinculado a la obra y como mínimo hasta su recepción (62.1).
- **Límite indemnizatorio en obras** (1 pregunta: #8): habilitación por monto, mínimo de 20 % del valor actualizado, exclusión del dolo y culpa inexcusable, y reclamo de vicios ocultos tras la recepción (216).
- **Conformidad y observaciones: plazos** (2 preguntas: #71, 72): conformidad en 7 días (144.3) y plazo de subsanación hasta 30 % del plazo del entregable (144.4).

## Contradicciones con el curso

- Ninguna pregunta de competencia 3 contradice formalmente una afirmación del curso: las 16 cubiertas son consistentes (16 OK, 0 CONTRADICE) y las no cubiertas exigen reglas que el curso simplemente no enseña.
- Casos límite revisados, clasificados como vacío (no contradicción): (fila 15) el banco aplica el 25 % también a la reducción de obras (64.1) y el curso solo enseña ese tope para bienes, servicios y consultorías, sin afirmar nada distinto para obras; (fila 129) el banco exige autorización de la Contraloría para adicionales de obra entre 30 % y 50 % y el curso termina su escala en el 30 % del titular; (fila 123) el curso enseña la regla general de que el fideicomiso garantiza adelantos (Ley, Art. 61) y el banco aplica la excepción del 178.2 para consultorías de obra — regla especial no enseñada, no afirmación opuesta.

## Estadísticas

- Cubiertas: 16/134 (11,9 %) · No cubiertas: 118 · Contradicciones: 0
- Por dificultad del banco (134): basic 32, intermediate 65, advanced 37
- Cubiertas por dificultad: basic 4/32, intermediate 10/65, advanced 2/37
- Por nivel cognitivo del banco: understand 12, apply 80, analyze 42
- Clases que cubren algo de la competencia 3: 6 de 18 (resolucion-controversias 5, actores-involucrados 4, modificaciones-contrato 3, intervencion-economica 2, resolucion-nulidad-contrato 1, inicio-plazo-vigencia-contrato 1); garantias, perfeccionamiento-contrato e incentivos-obras-consultoria no cubren ninguna pregunta del banco.
