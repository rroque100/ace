# Aviso de intento activo junto al inicio de práctica

Solicitud: explicar el bloqueo y permitir continuar/finalizar o solicitar cancelación desde el propio formulario.

- [x] Verificar la causa: `dash.active` deshabilita iniciar aunque la cantidad sea válida; existía aviso solo en la parte superior.
- [x] Mostrar cantidad y condición de borrador en una región accesible junto a «Empezar práctica», usando colores y botones Tailwind existentes.
- [x] Asociar el botón bloqueado a la explicación mediante `aria-describedby`.
- [x] Ofrecer «Continuar o finalizar» y «Cancelar intento». La segunda acción carga el intento y abre el diálogo de confirmación existente; no envía cancelación automáticamente.
- [x] Conservar los controles de propiedad, confirmación y registro del historial de la API existente.
- [x] Validar tres pruebas de contenido/estados, lint, tipos y apertura/cierre del diálogo en el navegador local, sin confirmar la cancelación del intento del usuario.

La mejora está en `codex/aviso-intento-activo`, sobre el checkout que sirve `localhost:3000`. No modifica la colección de preguntas ni las reglas de calificación.
