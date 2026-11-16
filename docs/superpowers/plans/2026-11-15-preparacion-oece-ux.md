# Preparación OECE: flujo de estudio y rendición

Objetivo: orientar al usuario hacia práctica, simulacro completo y repaso, con controles claros, información personal verificable y una rendición consciente.

- Mantener estilos Tailwind y tokens de ACE, accesibilidad por teclado, móvil y temas claro/oscuro.
- Compactar la información editorial del banco y separarla del avance del usuario.
- Tres actividades con un único panel visible: Practicar, Simulacro OECE y Repasar errores. Mantener los accesos por enlace directo.
- Resumen personal calculado solo con intentos entregados, sin borradores y bajo Ley 32069: última respuesta por pregunta, resultados por competencia y tema prioritario. Mostrar tamaño de muestra; no convertirlo en probabilidad de aprobar ni mezclar Ley 30225.
- Reutilizar el historial privado ya consultado por el plan de aprendizaje, sin añadir consultas o exponer preguntas, claves ni identificadores privados en el resumen.
- Añadir una confirmación con configuración y reglas antes de los exámenes cronometrados. Todas las vías deben explicar y respetar el intento activo.
- Configuración con cantidades válidas y resumen dinámico. Repasar un tema debe conservar la ley de origen y limpiar filtros anteriores incompatibles.
- Diferenciar las cuotas y disponibilidad editorial del simulacro del rendimiento personal; conservar las reglas de 72 preguntas y 120 minutos existentes.
- Verificar política con pruebas de aislamiento entre leyes, exclusión de borradores/activos, última respuesta y falta de datos; regresión de APIs sin fuga de claves. Ejecutar tipos, lint y build. Revisar desktop y móvil en preview, sin modificar el intento activo del usuario.

Referencia de formato oficial consultada: https://www.gob.pe/7642 (72 preguntas, 120 minutos). No se añaden umbrales de aprobación ni reglas normativas nuevas.

## Hallazgo de carga y corrección

La carga anterior ejecutaba la disponibilidad dentro de `ace_exam_dashboard` y de nuevo para agrupar por dificultad. Mediciones SQL del entorno: aproximadamente 5,1 s en el resumen anterior y 2,6 s en disponibilidad, con un timeout observado al cargar el preview. Se añade `ace_exam_workspace`, que conserva vencimiento, intento activo e historial sin recalcular el catálogo; las consultas independientes se ejecutan en paralelo. El catálogo mantiene los mismos criterios de elegibilidad.

La migración aditiva se comprobó y aplicó al proyecto ACE: contrato equivalente del historial, aislamiento entre usuarios, privilegios de servicio y entrega/calificación de intentos vencidos en una transacción revertida. El intento activo del administrador sigue intacto. Los timeouts muestran una explicación y un botón para reintentar.

## Revisión visual

Comprobados escritorio y móvil de 390 px, sin desbordamiento horizontal; cambio entre las tres actividades; recomendación inicial; cantidad ajustada al elegir 9 avanzadas de una competencia; selección de 30 para todas; bloqueo explicativo del intento activo; distinción de 83/75/108 disponibles frente a 25/22/25 por simulacro. El diálogo se probó en una vista local temporal sin crear intentos: apertura, Escape, restauración de foco y confirmación. La vista de prueba fue retirada.
