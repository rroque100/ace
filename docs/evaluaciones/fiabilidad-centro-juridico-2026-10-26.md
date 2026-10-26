# Fiabilidad: selección, comparación y Normativa

## Cambios implementados
- Fuentes iniciales por UUID, persistidas con el permiso de expansión. Se reserva un pasaje por documento recuperado y se identifican las fuentes añadidas. Se publica la cobertura de la selección y se distinguen documentos sin pasajes de consultas fallidas.
- Comparación temática con IA identificada como selección de pasajes. Nuevo modo determinista de comparación de todo el texto indexado disponible; regiones completas de diferencias, PDF y páginas registradas, paginación visual. No certifica integridad de extracción ni efectos jurídicos.
- Artículos identificados por documento, UUID, cuerpo y versión disponible. Números ambiguos dejan de seleccionar el primero. El Chat puede leer el artículo exacto y conserva su identidad en citas e historial.
- Identificación manual de cuerpo normativo con permiso de revisión, motivo obligatorio, control de concurrencia e historial. No se asignaron cuerpos automáticamente a los artículos existentes.
- Concordancias: existencia, pertenencia, número y tipo del destino comprobados antes del salto. Correcciones con rol autorizado y auditoría atómica; las referencias internas no pueden trasladarse a otro documento. Verificar el destino no equivale a revisar su relación jurídica.
- Listado de Normativa con filtros, conteos, orden y paginación en PostgreSQL. Versiones consultadas únicamente para la familia del documento abierto.

## Comprobaciones
- 104 pruebas correctas en 14 archivos durante la implementación, con pruebas nuevas para selección, ambigüedad de artículos, comparación textual, permisos y concurrencia.
- Tipos, lint y compilación de producción comprobados. Permanece el aviso previo de externalización de pdfjs-dist.
- Migraciones aplicadas al proyecto ACE medmcaiskvtbckpakseo mediante la API de gestión.
- scripts/verify-normative-reliability.sql comprueba paginación, vigencia, permisos, correcciones auditadas y rechazo de revisión concurrente en una transacción revertida. Después de la prueba quedaron cero revisiones ficticias de referencias y estructura.
- La consulta real de catálogo devolvió 19 normas y la consulta de familia del reglamento de prueba devolvió dos versiones.

## Límites que permanecen
La identidad de un artículo no acredita por sí misma su régimen aplicable. La revisión humana de cuerpos, destinos y versiones sigue pendiente donde el catálogo no la registra. Las diferencias de texto pueden incluir OCR y fragmentación; no se presentan como modificaciones jurídicas confirmadas.

La validación en teléfono físico, teclado virtual y micrófono real requiere dispositivo y participación del usuario. Debe registrarse por separado de la revisión de escritorio; no se acredita por reglas CSS ni pruebas de programación.
