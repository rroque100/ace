# Revisión del Centro Jurídico compacto y responsive

## Implementación
- Cabecera y navegación compactas; textos auxiliares principales de 13px.
- Búsqueda con filtros de tipo, régimen y año inmediatamente después del campo. Coincidencia literal y rango de publicación se conservan en opciones plegables.
- Normativa con catálogo y lector separados. Volver al catálogo conserva filtros y selección; permite continuar leyendo. Ficha e índice se despliegan a petición, sin ocultar errores de carga.
- Chat con compositor adherente cuando hay mensajes. El asistente flotante reserva espacio según la altura del compositor mediante ResizeObserver, con limpieza al salir.
- Administración plegable dentro del Centro Jurídico, manteniendo los permisos existentes.
- Adaptación por ancho de contenedor y umbrales de 980px, 720px y 480px: menú lateral en panel, campos y catálogo en una columna cuando corresponde, controles ajustados y consideración del área segura inferior.

## Comprobación
43 pruebas correctas de navegación, filtros, traspaso de fuentes, rutas normativas y búsqueda documental. Tipos, lint y compilación de producción comprobados durante la implementación.

En producción, con viewport efectivo de 1280 × 720:
- El lector conservó documento y artículo por URL, sin catálogo lateral vacío. Su inicio pasó de aproximadamente 1964px a 503px en el mismo documento de prueba.
- Volver al catálogo conservó el filtro Reglamento, los dos resultados y la posibilidad de continuar con el documento seleccionado.
- Una conversación existente mostró el compositor con posición sticky, sin generar otra respuesta ni modificar mensajes.
- Cinco enlaces administrativos permanecieron en un apartado cerrado y accesible.
- Búsqueda presentó consulta y filtros principales en la primera pantalla. No se observó desbordamiento horizontal de página.

## Límites de validación
Se intentó aplicar un viewport de 390 × 844 mediante el control documentado del navegador, pero el tamaño efectivo siguió siendo 1280 × 720, también en una pestaña nueva. El override se restableció. Por tanto, esta entrega NO acredita una prueba visual móvil efectiva: quedan pendientes teléfono real, teclado virtual y lector de pantalla. Las reglas adaptables están implementadas, pero no deben confundirse con esa validación pendiente.

La compilación conserva el aviso anterior de externalización de pdfjs-dist, sin impedir el build. No se modificaron reglas jurídicas ni se midió precisión legal.
