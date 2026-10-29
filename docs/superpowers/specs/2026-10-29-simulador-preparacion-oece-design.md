# Preparación OECE en el simulador de ACE — diseño

Fecha: 2026-10-29. Alcance solicitado: siete mejoras del simulador existente. No se copia contenido de LEX ni se representa el entrenamiento como certificación oficial.

## Evidencia de partida

- Motor existente: práctica, examen, guardado, marcas, reloj y calificación en servidor, historial, fuentes con página, revisión editorial e intentos con versión fija.
- Banco inicial: diez borradores originales de marco general, todos de dificultad editorial básica. No equivalen a cobertura del temario ni a revisión experta.
- Fuente comprobada en la página oficial: https://www.gob.pe/institucion/oece/informes-publicaciones/320786-temario-de-evaluacion-del-examen-de-certificacion
- Archivo marcado VIGENTE: https://cdn.www.gob.pe/uploads/document/file/7983730/320786-temario-de-evaluacion-del-examen-de-certificacion-de-los-compradores-publicos-vigente.pdf?v=1745603236
- PDF leído: cinco páginas, fecha 25/04/2025. Incluye tres competencias, treinta subcompetencias y distribución por subcompetencia. La página distingue un segundo archivo NO VIGENTE, que no se utilizará.
- La duración de 120 minutos se apoya en la orientación operativa del OECE: https://www.gob.pe/7642-orientaciones-sobre-el-servicio-de-rendicion-de-examen-de-certificacion-rendir-el-examen-supervisado-de-certificacion-por-niveles

## Alternativas y decisión recomendada

A. Ampliar solo el banco: más contenido, pero el sorteo actual no garantiza distribución, calidad ni cobertura.
B. Preparación estructurada sobre el motor actual (recomendada): temario versionado, simulacro con cuotas, revisión editorial, medición y repaso. Conserva los intentos previos y evita rehacer el módulo.
C. Generar cada examen con IA al comenzar: facilita volumen, pero dificulta reproducibilidad, revisión de claves y evaluación. No se elige para rendir exámenes.

## Entrega 1 — Temario, perfil y control editorial

### Temario y cuotas

Añadir catálogo versionado de competencias y subcompetencias. Guardar título oficial, código, fuente, fecha y peso. Etiquetar cada pregunta con versión del temario, competencia, subcompetencia y tema; el servidor verifica la relación entre esos campos.

Pesos por subcompetencia, transcritos del PDF:

| Competencia | Subcompetencias y cantidad por simulacro | Total |
|---|---|---:|
| Actuaciones preparatorias | 1.1:6; 1.2:13; 1.3:1; 1.4:1; 1.5:1; 1.6:1; 1.7:1; 1.8:1 | 25 |
| Selección | 2.1:5; 2.2:8; 2.3:1; 2.4:1; 2.5:1; 2.6:2; 2.7:1; 2.8:1; 2.9:1; 2.10:1 | 22 |
| Ejecución contractual | 3.1:1; 3.2:6; 3.3:3; 3.4:1; 3.5:3; 3.6:1; 3.7:1; 3.8:1; 3.9:1; 3.10:5; 3.11:1; 3.12:1 | 25 |

Perfil «Preparación OECE · Ley 32069»: 72 preguntas, 120 minutos, cuotas de las treinta subcompetencias. Se valida dentro de la transacción del servidor; no se confía en parámetros del navegador. Antes de empezar se muestran disponibles, requeridas y faltantes, con enlaces al banco para administradores. Si falta una cuota, no se inicia ni se rellena con repeticiones o borradores. No basta tener 72 preguntas en total.

Conservar «Práctica personalizada» y «Simulacro personalizado» sin denominarlos equivalentes al oficial. Los borradores siguen limitados a práctica administrativa. Los diez borradores antiguos quedan en «Marco general» hasta que su clasificación sea revisada; no se asignan artificialmente a las cuotas.

### Revisión y dificultad

Separar dificultad editorial (básica, intermedia, avanzada) de demanda cognitiva (comprender, aplicar, analizar). La dificultad medida se presenta aparte cuando existan datos; ninguna etiqueta se convierte en acreditación de nivel OECE.

Cada pregunta publicada debe tener: clasificación válida, versión normativa y fecha de corte, clave única, explicación de la correcta, explicación individual de las tres alternativas descartadas y fuentes verificables. Una lista de revisión exige comprobar ambigüedad, pertinencia de los distractores, condiciones, excepciones y correspondencia del fundamento. Registrar quién revisó, cuándo y sobre qué versión; el sistema no afirma que el actor sea especialista por el solo hecho de ser administrador.

Cambios de clave, contenido o fuente crean nueva revisión. Conservar la copia fijada del intento y sus resultados anteriores. Las preguntas antiguas que no satisfagan el nuevo estándar quedan fuera del perfil OECE, aunque puedan conservarse para práctica conforme al estado editorial vigente.

## Entrega 2 — Banco original con meta 360 y cinco balotarios

Meta editorial: cinco veces la cuota de cada subcompetencia; total 125 preparatorias, 110 selección y 125 ejecución contractual. Crear cinco conjuntos de 72 con la distribución del temario, sin repetir identificadores entre conjuntos de la misma edición. Registrar la edición del banco, la versión de cada pregunta y las fuentes usadas.

Trabajar en cinco lotes de 72, preparando primero los temas con corpus suficiente. Consultar el texto real del corpus antes de formular reglas, cifras, plazos o excepciones. No fabricar variaciones superficiales para alcanzar la cantidad; la revisión editorial detecta duplicación semántica y preguntas que en realidad evalúan el mismo caso.

La asistencia de IA produce borradores persistentes y trazables, nunca claves publicadas automáticamente. Si faltan fuentes o falla el proveedor, dejar una tarea de autoría visible, sin ocultar el fallo ni sustituir la evidencia por conocimiento del modelo. No prometer 360 preguntas revisadas hasta que existan 360 aprobaciones humanas registradas. No generar ni ejecutar llamadas de pago innecesarias para rendir o corregir.

La preparación de contenido puede producir 360 borradores originales cuando el corpus lo permita; las preguntas dudosas se separan con su motivo y no cuentan como disponibles. Los balotarios se habilitan únicamente cuando sus 72 preguntas estén publicadas y cumplan el estándar. Guardar una versión editorial fija del balotario para que no cambie silenciosamente al actualizar el banco.

## Entrega 3 — Medición, valoración y repaso

### Eventos y privacidad

Registrar por intento y revisión de pregunta: respuesta, primera selección, marcas, resultado final y tiempo activo aproximado. Medir actividad visible con intervalos limitados y validación del servidor; distinguir ese indicador de duración total del intento. No afirmar que el tiempo mide atención o capacidad jurídica. No recoger audio ni pulsaciones de texto.

Mediciones editoriales: número de respuestas válidas, proporción de aciertos, omisiones, tiempo aproximado y alternativas elegidas. Separar prácticas con resolución visible, simulacros, borradores y repeticiones. Para estudiar dificultad usar las primeras exposiciones calificadas de cada usuario a esa revisión; los repetidos no inflan la muestra.

Discriminación: correlación punto-biserial entre acierto en una pregunta y resultado del resto del examen en simulacros comparables. No calcular cuando no hay variación, el resto no es comparable o la muestra es insuficiente. Con menos de 30 usuarios válidos mostrar «Muestra insuficiente»; con 30 o más indicar «Exploratorio», tamaño de muestra y método. Ese umbral es una decisión de producto, no una norma OECE ni garantía psicométrica.

Valoración discreta: «Pregunta ambigua», «Clave discutible», «Fuente desactualizada» y «Explicación insuficiente», con comentario opcional. El reporte crea una cola editorial trazable; no modifica automáticamente la clave ni una nota histórica. Administración puede retirar la pregunta de nuevos intentos mientras la revisa.

### Repaso y progreso

«Repasar mis errores» recupera preguntas incorrectas u omitidas de intentos propios, solo en sus versiones actuales elegibles; indica si una fuente o pregunta fue actualizada o retirada. Se inicia como práctica y la selección se hace en servidor. Si ya no hay preguntas válidas, explicar por qué; no devolver versiones obsoletas.

Progreso por competencia y subcompetencia: aciertos, omisiones, preguntas distintas practicadas, últimas fechas y cobertura del temario. Mostrar diagnóstico de estudio y temas sugeridos, no «probabilidad de aprobar» ni certificación. Mantener separados los resultados de borradores administrativos.

## UX y accesibilidad

Mantener Tailwind y el diseño actual de ACE. Entrada con «Practicar», «Simulacro de preparación OECE» y «Mi progreso». Una tarjeta de cobertura explica por qué un balotario todavía no está disponible. El perfil fijo oculta controles de duración y cantidad innecesarios; la personalización queda en su modalidad específica.

Banco administrativo con filtros por competencia, subcompetencia, estado y demanda cognitiva; formulario editorial y ficha de fuente visibles. Estadísticas técnicas plegadas, con explicación del tamaño de muestra. En móvil conservar una columna, alternativas completas, navegación plegable y controles accesibles por teclado. Validar en vista estrecha; distinguirlo de pruebas en teléfono físico.

## Arquitectura y seguridad

Migraciones aditivas para temario, edición/balotarios, campos editoriales, eventos agregables y reportes. Extender las funciones transaccionales existentes; mantener identidad desde sesión, permisos por propietario y administración. No exponer clave, razones de descarte ni fuentes reveladoras antes de entregar un simulacro. La práctica puede revelar después de contestar. No permitir que un parámetro de cliente habilite borradores, exceda cuotas o acceda a intentos ajenos.

Separar módulos de temario/perfil, selección, revisión editorial y métricas para no seguir ampliando indefinidamente los componentes actuales. APIs y datos conservan compatibilidad con intentos anteriores; los perfiles nuevos exigen campos nuevos, los históricos mantienen su esquema fijado.

## Criterios de aceptación

1. El catálogo suma treinta subcompetencias, cuotas 25/22/25 y 72 en total, con procedencia y fecha visibles.
2. Un banco con 72 publicadas pero cuotas incorrectas no habilita el perfil. Con cuotas completas se obtienen exactamente 72 sin duplicados y 120 minutos impuestos por servidor.
3. Cinco balotarios de una edición no comparten preguntas y cumplen las treinta cuotas. La falta de contenido bloquea solo los conjuntos afectados con motivo visible.
4. Borradores, fuentes cambiadas, preguntas retiradas y clasificación incompleta no participan en el perfil OECE.
5. La revisión exige explicación por alternativa y queda registrada; ninguna tarea automática se presenta como revisión experta.
6. Recarga, concurrencia, entrega repetida, vencimiento y privacidad de claves siguen funcionando.
7. Reportes y métricas aíslan usuarios, revisiones y modalidades; muestras pequeñas no generan indicadores de dificultad supuestamente concluyentes.
8. Repaso recupera solo errores propios elegibles y progreso no promete aprobar ni obtener certificación.
9. Verificar permisos, migración, cuotas y regresiones; revisar el recorrido en producción antes de informar que está publicado.

## Límite de ejecución

La implementación de software, la autoría asistida y la revisión humana son estados distintos. El trabajo automático entrega software y borradores contrastados; la aprobación jurídica individual corresponde a una persona que revise las fuentes. Ningún contador de meta equivale a preguntas listas. No se contrata un especialista ni se envían datos a terceros para obtener esa revisión sin una instrucción adicional del usuario.
