# Simulador: continuidad, resultados y aprendizaje

Implementar las cinco mejoras aprobadas en la auditoría del 13 de noviembre.

## Diseño

Una entrada con Practicar, Examen y Mis resultados. Las colecciones importadas
y el banco revisado conservan su procedencia, pero comparten el acceso a resultados.
Los intentos importados pasan a servidor con propietario tomado de la sesión,
instantánea de preguntas, revisión optimista y vencimiento absoluto. Las respuestas
pendientes se respaldan por cuenta en el dispositivo; un fallo de red se muestra.
Entregar requiere confirmación, el vencimiento entrega automáticamente y una
repetición de entrega es idempotente. No se borran resultados desde la interfaz.

La pantalla de examen muestra una pregunta, anterior/siguiente, mapa numerado y
marca de revisión. El historial incluye ambas colecciones, filtros, evolución y
repaso de falladas/omitidas. Los resultados guardan la versión de las preguntas.

El contenido importado tiene clave de origen, no validación jurídica automática.
Se añaden reporte de problemas y revisión administrativa con explicación,
competencia y citas contrastadas con el corpus usando validateExamSources.
Las preguntas con incidencia de enunciado se señalan para revisión. No inventar
artículos, explicaciones ni clasificaciones ausentes. Solo las revisiones que
tienen fuentes comprobadas se etiquetan como revisadas.

## Ejecución

- [x] Modelo y reglas puras: puntuación, vencimiento, integridad, estadísticas.
- [x] SQL y API: intentos propios, cambios con revisión, entrega y revisión editorial.
- [x] Cliente: respaldo por usuario, sincronización, reanudación, aviso sin conexión.
- [x] Interfaz: tres rutas, examen por pregunta, confirmación y resultados conjuntos.
- [x] Contenido: diagnóstico, reporte y publicación editorial comprobada.
- [x] Tests de autorización, vencimiento, concurrencia y puntuación; lint, tipos y build.
- [x] QA visual con el acceso disponible. Documentar activación SQL manual requerida.

SQL nuevo se entrega en docs/supabase según la convención del proyecto; no se
declara sincronización remota activada hasta aplicar la migración.

## Comprobación y activación

- Build completo en `.next-simulador-qa`: correcto. Typecheck: correcto.
- 148 pruebas dirigidas: correctas; lint de los ficheros afectados: sin errores.
- Suite general: 3.946 pruebas aprobadas, cero fallidas y seis omitidas.
- SQL probado en PostgreSQL embebido con `node scripts/verificar-balotarios-sql.mjs`:
  aislamiento de propietario, bloqueo de revisión antigua, entrega idempotente,
  rechazo de respuestas tardías, historial ligero y claves inaccesibles por REST directo.
- QA con sesión local: práctica en blanco, corrección al responder, siguiente pregunta,
  Mis resultados y estado de activación pendiente del examen. El flujo remoto con
  Supabase no está activado en producción; no se afirma probado allí.
- Lint global: cero errores, 76 advertencias previas. Se retiraron dos estados
  sin uso de chat-quality-panel.tsx que causaban cuatro errores del chequeo general.
  Guarda CSS previa: 994 usos, por encima del límite 992. Se migraron a utilidades
  la tarjeta de historial y el espaciado de cobertura del banco: 992 usos, sin
  elevar el límite. La prueba de migración vuelve a pasar.
- Revisión jurídica de las 360 respuestas: pendiente de un editor. Se entregan
  herramientas de revisión y fuentes, no una declaración automática de validez.

Antes de desplegar ejecutar `docs/supabase/2026-11-13-balotarios-fiables.sql` en
el SQL Editor de Supabase. La UI anuncia la falta de activación y permite practicar,
pero no iniciar exámenes que no puedan guardarse. No se importa el historial legado
de clave compartida porque no identifica al propietario. El registro original local
no se borra. Guardar cada revisión editorial exige fuentes comprobadas; los intentos
anteriores conservan sus instantáneas.

Diagnóstico completo de los registros: `docs/qa/2026-11-13-auditoria-balotarios.md`.
Hay 345 enunciados únicos y ninguna pregunta idéntica con las mismas alternativas
y clave en el mismo orden. Las coincidencias de encabezado no se eliminaron.

Para compilar se corrigieron cuatro incompatibilidades previas: parámetros opcionales
del perfil de caso, JWT ausente en su escritura, razón opcional del informe y artículo
nulo en la evaluación del Chat. Se conservaron permisos y reglas jurídicas.
