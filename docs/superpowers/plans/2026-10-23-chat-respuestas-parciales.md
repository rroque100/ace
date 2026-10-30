# Corrección de respuestas parciales y avisos del chat

Diseño aprobado por la solicitud del usuario: conservar lo comprobado, distinguir fallo de revisión de falta de evidencia, responder primero y unificar avisos.

- [x] Separar estado de revisión (completa/incompleta/fallida/no disponible) de respaldo documental y forma de publicación.
- [x] Validar filas de revisión individualmente: conservar válidas, marcar ausentes/duplicadas inválidas, comprobar cifras por afirmación.
- [x] Publicar solo afirmaciones respaldadas, respetando coherencia normativa; al fallar la revisión ofrecer un único pasaje literal seleccionado por pertinencia, nunca una conclusión generada sin comprobar.
- [x] Presentar respuesta primero, disposición/fuente breve y un solo bloque de verificación y límites. Mantener el bloque en copias/exportaciones pero representarlo solo una vez en pantalla.
- [x] Probar respuestas mixtas, caída del proveedor, citas falsas, ámbito incorrecto, ausencia de evidencia, persistencia y transmisión. Comprobar tipos, lint y compilación.

No se codifican valores normativos. El pasaje de respaldo se extrae sin modificar su contenido; la lectura literal no se presenta como revisión semántica ni como confirmación de aplicabilidad.


Validación: 107 pruebas en 14 archivos aprobadas. Tipos y lint satisfactorios. Prueba integral con el corpus institucional sin historial ni escrituras: respuesta verificada; al simular caída del revisor, lectura literal con una sola cita. Se preservan los controles de cifras/unidades, citas inexistentes, ámbito y familias normativas. Compilación y publicación se comprueban al cerrar la ejecución.
