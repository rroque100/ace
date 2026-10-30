# Simulador: aprendizaje, revisión y continuidad — 29/10/2026

## Implementado

- Accesos Estudiar, Rendir simulacro y Repasar errores, con continuación prioritaria del intento activo.
- Pendientes por subcompetencia y acceso al banco filtrado. Cola de revisión priorizada, responsable, observaciones e historial por versión; no aprueba ni publica automáticamente.
- Práctica corta configurable por competencia y tema. Disponibilidad calculada con fuentes elegibles; el servidor valida la selección.
- Informe de temas débiles, omisiones, pasajes para repasar y tiempo activo observado cuando existe medición suficiente.
- Repaso programado de errores y omisiones, derivado de los últimos 100 intentos entregados, con intervalos de 1/3/7/14/30 días. No incrementa retención por repetir el mismo día; cambia el seguimiento si cambia la revisión.
- Tutor IA con explicación, ejemplo y comparación de alternativas, después de responder en práctica o entregar. Validación de fuentes y referencias, límite de solicitudes y contabilidad por módulo. Fallos de proveedor no inventan respuestas ni modifican notas.
- Biblioteca de cinco balotarios, edición, cobertura, fecha de publicación, intentos y mejor resultado cuando existen conjuntos publicados. Los pendientes aparecen como pendientes.
- Posición de lectura guardada en servidor; enlace con pregunta; respuesta pendiente recuperable en la misma pestaña y separada por usuario. El usuario confirma cualquier reintento de guardado.
- PDF bajo API del simulador: exige intento propio, fuente ya revelada y huella de versión coincidente. Permisos de Chat y Normativa se mantienen separados para usuarios externos.
- Las operaciones de examen sin IA no quedan bloqueadas por cuota de IA; el tutor conserva los controles de cuota.

## Verificación

145 pruebas correctas en doce archivos, incluyendo permisos externos y los cambios recientes de acceso de main. TypeScript completo y lint del módulo sin errores.

Migración 202610290009 aplicada. Pruebas SQL con rollback correctas: repaso privado, checkpoint ajeno rechazado, trazabilidad de dos observaciones, rechazo de revisión antigua, permisos cerrados y selección por competencia. No se conservaron preguntas ni notas de prueba.

Navegador: pendientes y enlace a subcompetencia 1.2, cola de 242 borradores, tutor solo después de responder, reanudación real en pregunta 2, informe de intento ya entregado, vista de 390 × 844 con ancho de contenido igual al disponible. No se modificaron respuestas durante esta prueba. No sustituye una prueba con teléfono físico.

## Límites pendientes

El proveedor de IA devolvió 402 en la prueba real del tutor: falta restablecer su saldo/cuota. El tutor informa la limitación y el resto del módulo permanece disponible. La generación del tutor se comprobó con respuestas simuladas y validación de referencias; no se declara una explicación real generada cuando el proveedor rechazó la llamada.

El banco sigue sin preguntas aprobadas/publicadas. Las nuevas funciones no convierten los 215 borradores clasificados en preguntas revisadas. Habilitar el perfil completo requiere revisión humana suficiente en las treinta cuotas; los cinco conjuntos exigen 360 preguntas aprobadas sin repetidos.
