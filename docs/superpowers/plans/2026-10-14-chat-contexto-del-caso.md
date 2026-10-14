# Plan: contexto del caso en chat

Objetivo: implementar el diseño aprobado en `docs/superpowers/specs/2026-10-14-chat-contexto-del-caso-design.md`.
Arquitectura: contexto opcional validado, separado de la pregunta; recuperación y generación comunes a respuestas en directo y no interactivas; persistencia en metadata existente bajo RLS.
Restricciones: no migración, no nuevos proveedores, no inferir régimen por fecha, no publicar cambios ajenos. Ejecución en esta conversación.

- [x] Crear `lib/chat-case-context.ts`: esquema con régimen (200 caracteres), fechas (1000), hechos (6000); formato de contexto y regla del servidor. Probar datos vacíos, límites, delimitación e información ausente.
- [x] Integrar esquema, consulta contextual y regla en `lib/legal-chat.ts`; guardar contexto en metadata de mensajes y sesiones. Mantener compatibles solicitudes anteriores y aplicar regla a ambos flujos.
- [x] Añadir ruta autenticada `app/api/chat/sessions/[id]/route.ts` para recuperar exclusivamente una sesión propia y sus mensajes, validar UUID, devolver 404 si no visible por RLS.
- [x] Añadir formulario opcional al chat, enviar contexto, mostrarlo en cada turno, restaurar al abrir sesión y limpiar al iniciar nueva conversación. Incorporar enlace para continuar desde historial.
- [ ] Probar unidad, integración de generación/persistencia y ruta privada; ejecutar tipos y compilación; revisar interfaz, publicar cambios explícitos y comprobar despliegue.

Verificación previa a publicación: 30 pruebas aprobadas, comprobación de tipos y compilación de producción correctas; revisión de código sin errores ni advertencias.
