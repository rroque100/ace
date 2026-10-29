# Simulador de examen ACE

Implementación solicitada a partir del análisis aprobado. Contenido original de ACE, sin copiar preguntas, claves ni explicaciones de LEX. Se conserva el diseño de ACE y se añade navegación Formación → Simulador.

Dos modos: práctica sin vencimiento y simulacro con duración seleccionable. Un intento activo por usuario, respuestas y marcas guardadas, reloj de servidor, entrega idempotente, revisión y estadísticas por tema. Un perfil de 72 preguntas exige disponer de 72 preguntas publicadas; nunca se repiten para completar cupos.

Banco de preguntas versionado con cuatro alternativas, clave, explicación, tema, competencia, dificultad, régimen y referencias con documento, fragmento, artículo, páginas, versión y SHA. Borradores originales contrastados con el corpus. Solo la revisión administrativa explícita publica una pregunta. Administradores pueden probar borradores en práctica, claramente marcada y separada de estadísticas ordinarias. Ninguna revisión automática se presenta como validación humana.

Supabase: preguntas, revisiones, intentos con copia privada inmutable y respuestas. RLS y funciones solo para service_role. API comprueba identidad y rol; datos del intento propios de cada usuario. El navegador no recibe claves antes de la entrega, salvo retroalimentación de preguntas ya contestadas en práctica. Actualizaciones concurrentes usan revisión optimista; fechas y cierre se controlan en PostgreSQL. Fuentes cuyo SHA cambia quedan fuera de nuevos intentos.

UI: entrada Practicar/Rendir/Mi progreso; reloj, pregunta principal con radios accesibles, responded/marked map, guardado explícito, aviso de pendientes y revisión con enlaces a PDF, Normativa y Chat. Móvil de una columna, navegación plegable y controles táctiles. Colores y tipografía existentes, firma visual de recorrido por preguntas, sin estilos copiados de LEX.

Etapas: persistencia y motor; API y permisos; pantalla y banco; borradores con corpus; pruebas, migración y publicación. La IA no es necesaria para guardar, rendir o corregir. No se incluye generación automática con IA en esta primera entrega. Se publica como entrenamiento, no como certificación oficial.
