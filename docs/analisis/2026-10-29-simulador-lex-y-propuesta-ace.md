# Simulador LEX y adaptación a ACE — 29/10/2026

Revisión funcional con sesión autorizada en LEX y lectura del código local de ACE. Documento de análisis: no se implementó un simulador en ACE.

## Flujo observado en LEX

1. Entrada /app/quiz y selector /app/quiz/create: cinco balotarios, cada uno con 72 preguntas y dos horas. No se observó personalización de número, temas o duración en ese selector.
2. Una sola evaluación activa: al iniciar un intento se ofrece continuar o cancelar y se bloquea el inicio de los otros balotarios.
3. Examen: una pregunta por pantalla, cuatro alternativas, rótulo de competencia, temporizador, navegación anterior/siguiente y cuadrícula de 72 posiciones con estados actual, respondida y pendiente.
4. La alternativa seleccionada se conservó al navegar y recargar. La selección guardada se comprobó visualmente. La barra de porcentaje refleja la posición de la pregunta; conviene distinguirla del número respondido.
5. Al regresar al selector aparece la continuidad del intento, con pregunta y tiempo restante. El reloj continuó durante la revisión; no se comprobó el comportamiento automático al agotar las dos horas.
6. Historial: filtros por mes y balotario, agrupación de intentos, puntaje, nivel y enlace al resultado.
7. Resultado histórico: correctas sobre total, nivel alcanzado y rangos de clasificación. No se verificó que esos rangos sean el formato oficial vigente del OECE.
8. Resolución histórica: alternativa elegida, alternativa marcada como correcta, explicación y navegación por estados. En las dos explicaciones observadas se repite una justificación general sin artículo, numeral o enlace verificable al PDF. La muestra no permite calificar toda la precisión jurídica del banco.
9. Cancelación: se muestra una confirmación que advierte que elimina el progreso y no registra nota. No se confirmó la cancelación ni se presentó una evaluación nueva. Quedó un intento de prueba sin calificar en el balotario 1.

## Qué aprovechar en ACE

No se encontró módulo de preguntas, intentos o exámenes en app/lib/migraciones. Sí existen sesión y roles, biblioteca documental, enlaces a PDF, selección de fragmentos, citas por página/bloque, Chat y registros de revisión documental. Son base para el módulo, pero no un banco de preguntas listo para evaluar.

## Diseño recomendado

Nuevo acceso «Simulador de examen», con tres entradas: Practicar, Rendir simulacro y Mi progreso. Administración separada del banco.

- Práctica: temas y régimen explícitos, sesiones breves, explicación después de responder, marcar dudas y repetir errores.
- Simulacro: perfil configurable; se puede ofrecer 72 preguntas/120 minutos como formato equivalente al observado en LEX. Temporizador y vencimiento controlados por servidor, respuestas guardadas, aviso de pendientes antes de entregar y recuperación al recargar. El formato observado no se presenta como examen oficial.
- Revisión: mostrar respuesta elegida y clave revisada; explicación de la opción correcta y de los distractores, con documento, versión, artículo/numeral y página o bloque real. Acciones a Normativa y a un Chat que conserve la fuente seleccionada.
- Progreso: aciertos y omisiones separados, tiempo, resultados por competencia/tema y plan de repaso. No inferir dominio profesional a partir de pocos intentos.
- UX: conservar colores y tipografía de ACE, una pregunta principal, controles de alternativa semánticos accesibles por teclado, guardado visible y navegación en panel para pantallas pequeñas. Distinguir ubicación, respondidas y marcadas. No depender solo del color.

## Banco y uso de IA

Se recomienda banco revisado con apoyo opcional de IA. Alternativas: banco manual (consistente, más esfuerzo de autoría), generación en cada intento (rápida pero variable y difícil de auditar), e híbrido (recomendado: IA propone borradores y una revisión aprueba cada versión).

Cada versión de pregunta debe guardar enunciado, cuatro alternativas, clave, régimen, competencia/tema, dificultad, explicación, referencias documentales exactas, fecha normativa, revisor y estado. Una pregunta ambigua o cuya fuente cambió vuelve a revisión. No publicar borradores como si estuvieran jurídicamente comprobados.

El examen se corrige mediante la clave aprobada, sin llamadas a IA. La IA puede redactar borradores, explicar con fuentes o sugerir repaso. El banco publicado, el reloj, guardado y la calificación deben seguir disponibles sin créditos de Google.

## Implementación por etapas

1. Banco versionado, revisión editorial, fuentes, balotarios y controles de publicación. Preparar preguntas originales a partir de las fuentes oficiales verificadas de ACE.
2. Motor de examen: intentos y respuestas propios de cada usuario, selección de preguntas, orden fijado para el intento, guardado, vencimiento, entrega idempotente y calificación en servidor. No exponer claves en el navegador antes de entregar.
3. Revisión de respuestas, enlaces con Chat/Normativa, estadísticas y práctica de errores.
4. Asistencia de IA para autoría y repaso; detección de fuentes modificadas y revalidación de preguntas.

Supabase conservaría banco, versiones, referencias, balotarios, intentos y respuestas con permisos por usuario/rol. El intento fija sus preguntas y claves para que una actualización posterior no cambie la nota histórica. Tailwind y componentes existentes permiten mantener coherencia con ACE.

## Criterios de aceptación

Verificar recarga y reconexión; tiempo independiente del reloj del dispositivo; entrega repetida sin doble nota; ausencia de claves antes de entregar; aislamiento entre usuarios; preguntas retiradas no incluidas en nuevos intentos; enlace a la página citada; acceso por teclado y pruebas en móvil; revisión jurídica humana de las claves. Las pruebas de código no equivalen a precisión jurídica comprobada.

La cobertura actual de ACE permite iniciar con Ley y Reglamento y las opiniones previamente verificadas. No conviene construir preguntas de otras categorías suponiendo que todo el catálogo esté clasificado y vigente.
