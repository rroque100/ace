# Centro Jurídico: revisión UX/UI con Tailwind

## Cambios
- Navegación común de Chat, Búsqueda y Normativa, con estado activo y descripción de tarea en anchos amplios.
- Estilos con Tailwind CSS 4, tokens existentes de ACE y alcance `.legalWorkspace`; sin Preflight global.
- Chat: pregunta antes de adjuntos y contexto; fuentes al lado en anchos amplios y después de la conversación cuando falta espacio.
- Búsqueda: entrada antes de historial y cobertura, asistencia junto al título, modos excluyentes y tarjetas con pasaje y acciones.
- Normativa: catálogo y lector con anchos mínimos controlados, índice acotado, versiones plegables y ficha técnica secundaria.
- Foco visible, controles de al menos 44px para acciones principales y respeto de movimiento reducido.

## Validación
- 43 pruebas correctas en cinco archivos: navegación, filtros compartidos, traspaso de fuentes, rutas de Normativa y búsqueda documental.
- Comprobación de tipos, ESLint de los componentes modificados y compilación de producción correctos durante la implementación.
- Producción: Chat con campo visible al entrar; Búsqueda con campo vacío y visible al acceder directamente. A 1280px de ventana, el ancho de página observado fue 1270px, sin desbordamiento horizontal en ambas pantallas.
- Consulta literal de prueba «garantía de fiel cumplimiento»: 24 documentos con coincidencias, pasajes resaltados y acciones de PDF, Chat y Normativa disponibles.
- Normativa: documento y artículo seleccionados conservados por URL; acceso al PDF, índice y comparación de versiones presentes.

## Límites
La revisión visual se realizó en el navegador de escritorio disponible. No acredita validación en teléfono real, lector de pantalla ni todas las combinaciones de documentos. Los estilos adaptables se organizan por ancho disponible del contenedor, para tener en cuenta el menú lateral. No se modificaron las reglas de recuperación o revisión jurídica, ni se midió precisión legal en esta entrega.

La compilación mantiene el aviso previo de externalización de `pdfjs-dist`; no impidió compilar. Las fechas, estados y concordancias pendientes de revisión documental continúan identificados como tales.
