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
## Verificación publicada
La versión a3adb28 quedó Ready en Vercel y publicada en ace-rormi.vercel.app. Se comprobó la apertura del artículo exacto, sus identificadores en enlaces al Chat, las dos versiones de la familia y el formulario autorizado de corrección con historial. La comparación textual recorrió 441 y 495 bloques, produjo 23 regiones de diferencias y permitió avanzar a la segunda página. Son diferencias del texto disponible, no cambios jurídicos certificados.

Durante la revisión se corrigió un problema visual previo del comparador: los identificadores recibidos por enlace no aparecían entre los primeros 30 documentos del selector. Ahora se recuperan también los nombres de esas selecciones exactas y se mantienen visibles aunque no pertenezcan a esa página del catálogo.

Se confirmó un ancho efectivo de 390 píxeles y ausencia de desbordamiento horizontal del documento en la lectura y en la comparación. Esto no sustituye las pruebas de teléfono, teclado virtual, audio y PDF en un dispositivo físico.
La selección de dos fuentes con ampliación se comprobó desde Búsqueda hasta Chat y después de recargar la sesión. En pantalla estrecha se verificó un compositor visible de 302 píxeles, con ancho de ventana 390 y documento 380. Se reforzó también la cuadrícula del comparador con columnas que pueden encogerse y una columna bajo 720 píxeles, evitando que títulos largos recorten la segunda selección. Compilación de producción final correcta.
