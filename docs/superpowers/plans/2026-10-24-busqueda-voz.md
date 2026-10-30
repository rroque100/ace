# Implementación de búsqueda por voz

- [x] Añadir normalización conservadora y verificación de referencias con pruebas.
- [x] Añadir servicio de transcripción y endpoint autenticado con límites y aviso de privacidad.
- [x] Integrar grabación y revisión en un diálogo junto al buscador, reutilizando su asistente.
- [x] Preparar evaluación explícita con archivos de audio autorizados y métricas de referencias.
- [x] Validar pruebas, tipos, compilación y publicación; comprobar interfaz sin activar el micrófono del usuario.

Archivos: lib/voice-search.ts, lib/voice-transcription.ts, app/api/search/voice/route.ts, app/components/voice-search.tsx y CSS, integración en document-search-workspace, tests y docs/evaluaciones de voz.

La revisión visual final se realiza tras la publicación; no se activa el micrófono del usuario durante esa verificación.
