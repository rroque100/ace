# Preparación para el simulacro OECE

Rama: `codex/preparacion-oece-ux`, basada en main `8e54342`.

## Cambios

- Tres actividades con un solo panel visible: practicar, simulacro completo y repasar errores. Accesos por hash conservados y foco trasladado al encabezado de la actividad.
- Avance personal separado de disponibilidad editorial. La última exposición de cada pregunta cuenta una vez; solo se incluyen intentos entregados, sin borradores, de Ley 32069. Se informa el tamaño de la muestra y la limitación a los últimos 100 intentos cuando corresponde.
- Recomendación de tema según errores y omisiones; sin datos, práctica inicial de diez preguntas. Los indicadores no se presentan como una predicción de aprobación.
- Cantidades ajustadas a la selección, accesos rápidos y resumen dinámico. El repaso de un tema conserva la ley de origen y limpia filtros incompatibles anteriores.
- Resumen previo a los exámenes cronometrados, con cantidad, tiempo, ley y reglas de rendición. Diálogo modal nativo, cancelación con Escape y restitución de foco.
- Intentos activos bloquean los nuevos inicios en todas las vías con explicación; no se cancela ni sustituye el intento del usuario.
- Historial con dificultad elegida. Recuperación de errores iniciales repite tanto la carga del espacio como la del intento enlazado y su posición.
- Estilos Tailwind con tokens existentes y adaptación móvil.

## Validación

- 76 pruebas aprobadas en 11 suites del módulo de exámenes y navegación.
- ESLint y compilación de producción con TypeScript correctos.
- Revisión adicional de código sin hallazgos pendientes; corregido un fallo de retry de enlaces a intentos.
- SQL en transacción revertida: equivalencia del contrato personal, aislamiento de usuarios, permisos de servicio y entrega/calificación al vencer el tiempo.
- Migración aditiva `202611150002_exam_workspace.sql` aplicada al proyecto ACE. No modifica preguntas, respuestas ni la configuración de los exámenes; el intento activo anterior se conserva.
- Consulta personal anterior: unos 5128 ms. Nueva consulta personal: 2,949 ms en la medición registrada. Son tiempos SQL del entorno medido, no tiempos totales de carga; disponibilidad sigue siendo una consulta independiente.
- Revisión visual de escritorio y móvil a 390 px; sin desbordamiento horizontal. Las capturas están en `desktop.png` y `mobile.png`.
- Comprobados cambio de actividad, recomendación inicial, nueve avanzadas para competencia 1, treinta avanzadas para todas las competencias y bloqueo del intento activo.
- Diálogo probado en una página local temporal sin crear intentos: apertura, cancelación, confirmación y foco. La página temporal fue eliminada antes de compilar.

Preview compilado: http://localhost:3103/simulador?seccion=banco

Comprobación final del preview compilado: carga correcta, 266 preguntas, avance vacío para el administrador cuyas sesiones son borradores, cambio al simulacro y bloqueo explicativo por su intento en curso.

Pendientes de commit, push y despliegue de la aplicación. La función SQL nueva ya está activada y convive con las anteriores.
