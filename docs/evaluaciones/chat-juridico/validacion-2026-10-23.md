# Validación del chat jurídico profesional — 23 de octubre de 2026

Estado: implementado y verificado en el proyecto local. Publicación en Vercel pendiente. No se efectuó revisión jurídica humana.

## Funcionalidad
- Contexto con régimen, fechas, objeto contractual y hechos; distinción entre declaración y aplicación confirmada.
- Selección coherente de familias documentales, sin inferir vigencia por año ni equiparar selección con régimen aplicable. Las consultas comparativas conservan ambas familias.
- Recuperación reglamentaria en consultas generales para evitar que las leyes desplacen el desarrollo reglamentario.
- Auditoría semántica de afirmaciones y comprobación de pasajes literales antes de mostrar o guardar la respuesta. Cierre limitado ante fallo, contradicción, cita inexistente o cobertura incompleta.
- Control numérico con unidad y valor exactos, incluidos marcadores agrupados o anotados.
- Documento, artículo/numeral disponibles, versión explícita y página; etiquetas desconocidas cuando no constan. Las versiones extraídas del título no certifican vigencia.
- Estados separados de respaldo documental y aplicación al caso, progreso accesible y panel «Qué comprobó ACE» con pasajes y acceso al PDF. Historial anterior identificado como no reevaluado.
- Adjuntos privados conservados como evidencia del caso, nunca convertidos en fuentes normativas; persistencia mediante JWT y RLS existentes.

## Comprobaciones
- Suite general: 3.128 pruebas aprobadas, cero fallos, con dos trabajadores y límite de 20 segundos por prueba. La ejecución anterior con concurrencia por defecto había dado 109 tiempos de espera en 13 archivos de documentos/Excel; una muestra aislada aprobó y la repetición completa no reprodujo los fallos.
- Suite focalizada tras los últimos ajustes: 59 pruebas aprobadas en 10 archivos.
- TypeScript y ESLint de los archivos modificados: satisfactorios.
- Compilación de producción final: satisfactoria. Conserva un aviso de empaquetado de pdfjs-dist ajeno a este cambio. Un primer intento de guardar el log dentro de .next falló porque Next intenta limpiar esa carpeta; la repetición con log en Temp compiló correctamente.
- Proveedor real de la evaluación: Gemini; modelo gemini-2.5-flash. Siete controles sintéticos completados satisfactoriamente. El primer ensayo había aceptado un objeto incorrecto; se añadió un control conservador y se repitió el ensayo. Véase resultado-sintetico.json.
- Prueba integral con la pregunta sobre garantía: sin historial, adjuntos ni escrituras de chat. Recuperó el artículo reglamentario, separó la fuente de la otra familia normativa y completó la revisión de afirmaciones. Una ejecución duró aproximadamente 11 segundos; no constituye medición de precisión jurídica ni garantía de latencia.

## Límites
El revisor usa otra llamada al mismo proveedor/modelo; puede compartir errores con el generador. Los controles de objeto son conservadores y pueden rechazar paráfrasis correctas. El máximo de 24 afirmaciones y el límite de 25 segundos del revisor conducen a una respuesta limitada si la revisión no termina. La aplicación al caso permanece pendiente de confirmación humana.

El banco revision-especialista.json está preparado, con respuestas de referencia sin completar y estado pendiente. No hay porcentajes de precisión jurídica, dictamen humano ni casos presentados falsamente como revisados. La nueva evaluación no reescribe conversaciones anteriores.


## Integración para publicación en GitHub
Se contrastó la copia local con main remoto 954f820 y se conservaron las mejoras ya publicadas de chat-signals, chat-lexical y chat-recency: selección jerárquica, deduplicación, recuperación léxica, desempate y avisos materiales. Tras la integración aprobaron 98 pruebas en 13 archivos, además de TypeScript. La suite global anterior corresponde a la validación local previa a esta integración; no se presenta como una nueva ejecución global del árbol integrado.
