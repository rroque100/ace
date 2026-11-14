# Navegación del simulador

Diseño solicitado y aprobado por el usuario: «Balotarios OECE», «Banco de preguntas» e «Historial», con cantidades reales de revisadas y pendientes.

- Tres pestañas principales por colección y resultados. Practicar/Rendir examen son opciones internas de Balotarios OECE; no compiten con las colecciones.
- Mantener montados los exámenes al cambiar de sección. Conservar enlaces anteriores con `vista=practicar`, `vista=examen`, `vista=resultados` y `attempt`; añadir `seccion` para enlaces directos al banco. Atrás/adelante y teclado deben reflejar el contenido visible.
- Balotarios: contar las revisiones registradas del catálogo remoto; mostrar total y pendientes, y detalle por balotario. Mientras carga o falla la consulta, indicar que la revisión no está confirmada, sin inventar ceros.
- Banco: contar todas las preguntas con acceso de servidor, publicar solo agregados autenticados. Revisadas disponibles = suma de `ace_exam_availability(p_admin=false)`, que exige revisión registrada y fuentes actuales. Pendientes = borradores/publicadas no elegibles. Retiradas aparte. No afirmar validación jurídica total.
- Usar los tokens, tipografía y utilidades Tailwind existentes. Pestañas compactas, controles de al menos 44 px, foco visible, móvil sin desbordamiento. No introducir CSS propio ni dependencias.
- Validar navegación antigua/nueva, conteos con fuentes desactualizadas, errores de carga, autenticación, persistencia al cambiar pestañas, vista móvil y escritorio.
