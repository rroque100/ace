# Fiabilidad del Centro Jurídico

Diseño: implementación de los seis hallazgos aprobados por el usuario. No cambiar valores normativos ni presentar una detección automática como revisión jurídica.

## Etapas
- [x] Selección de fuentes: conservar identificadores y permiso de expansión en sesión y mensajes. Recuperar cada fuente seleccionada por separado; reservar un pasaje por documento disponible, distinguir fuentes iniciales y añadidas y advertir faltantes.
- [x] Comparación: mantener la comparación temática con aviso de alcance. Añadir comparación textual de documentos completos del corpus extraído, sin IA, con límites explícitos, documentos y artículos identificados. No equiparar texto extraído con integridad del PDF.
- [x] Estructura: identidad estable de artículo por UUID y cuerpo normativo; no elegir el primero si un número es ambiguo. Exponer versión y ámbito registrado o detectado sin certificarlo.
- [x] Concordancias: validar existencia, documento y número del artículo de destino antes de habilitar el salto. Corrección autorizada, motivo obligatorio y registro persistente antes/después mediante transacción.
- [x] Catálogo: consulta de filtros, orden y paginación en PostgreSQL, con facetas y conteos. Mantener información explícita si la migración no está disponible; no presentar un fallo como catálogo vacío.
- [ ] Validación: pruebas de selección y fallos parciales, estructura ambigua, corrección/auditoría y paginación. Tipos, lint, build y verificación de producción. Móvil: comprobar anchos efectivos antes de afirmar validación; teléfono y micrófono reales requieren dispositivo.

## Restricciones
No borrar ni resegmentar automáticamente artículos existentes. Los cuerpos no revisados se identifican como tales. No ampliar acceso a expedientes privados; las correcciones requieren rol de edición y solo documentos institucionales. La comparación textual se limita a texto disponible y debe anunciar si faltan páginas o si el alcance no puede comprobarse. Las fuentes no recuperadas no se sustituyen silenciosamente por otras.
