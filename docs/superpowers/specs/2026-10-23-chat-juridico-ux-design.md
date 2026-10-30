# Diseño propuesto: chat jurídico accesible para personas no técnicas

Fecha: 23 de octubre de 2026. Estado: diseño aprobado por el usuario; implementación autorizada.

## Objetivo
Que una persona pueda escribir su duda, aportar documentos y comprobar la norma que respalda la respuesta sin conocer términos de IA ni configurar filtros.

## Alternativas
1. Conversación primero (recomendada): pregunta como acción principal, fuentes a un lado en escritorio y panel desplegable en móvil. Ajustes progresivos. Menos esfuerzo para preguntas generales y casos con documentos.
2. Asistente paso a paso: pedir primero datos del caso y después la consulta. Orienta a principiantes, pero añade pasos a las preguntas sencillas.
3. Escritorio avanzado: mostrar filtros, documentos y métricas permanentemente. Facilita análisis intensivo, pero aumenta la carga visual para el público objetivo.

## Diseño recomendado
- Una sola cabecera «Chat jurídico» y explicación breve: «Pregunta sobre contrataciones y revisa las normas que sustentan la respuesta».
- Área central de conversación. Pantalla inicial con una pregunta visible, tres ejemplos comprensibles y acceso a adjuntar documentos.
- Compositor con etiqueta «¿Qué necesitas resolver?», botón «Enviar consulta» y acción «Adjuntar documento». No exigir régimen ni fechas. Mostrar los archivos seleccionados y permitir quitarlos de la consulta sin borrar el original.
- «Añadir datos del caso» opcional con régimen, fechas y hechos. «Afinar búsqueda» y «Personalizar respuesta» plegados por defecto. Unificar la ubicación de filtros existentes sin perder sus valores.
- Historial como «Mis consultas», con abrir/cerrar accesible y una acción «Nueva consulta» claramente diferenciada.
- Respuesta con contenido primero, límites expresados en lenguaje claro y sección «Normas consultadas». Distinguir «Documentos de tu caso» de normas. Acceso desde cada referencia al PDF y su página cuando esté disponible. No convertir metadatos desconocidos en vigencia confirmada.
- Panel de fuentes lateral en escritorio y plegable en pantallas pequeñas, conservando el contexto de la pregunta y evitando dobles barras de desplazamiento en el flujo principal.
- Sustituir score/calidad/literal visibles por un mensaje comprensible sobre evidencia y comprobaciones pendientes. Conservar métricas y proveedor/modelo en «Detalles de la respuesta», cerrado inicialmente. No presentar relevancia como precisión jurídica.
- Acciones principales «Copiar» y «Guardar»; exportación y acciones adicionales agrupadas para reducir ruido. Mantener las funciones existentes disponibles.
- Estados de envío y lectura con texto claro, cancelación disponible, errores junto al elemento afectado y recuperación de texto ante fallos.

## Dirección visual
Conservar la identidad verde petróleo de ACE. Fondo gris muy claro, superficies blancas, texto oscuro y acento ámbar únicamente para comprobaciones pendientes. Tipografía existente del producto, texto de lectura de 16 px y altura de línea generosa. Espaciado coherente, bordes suaves y foco de teclado visible. La característica principal es la relación clara entre respuesta y norma, no elementos decorativos.

## Alcance y compatibilidad
Cambiar presentación y organización del chat y sus componentes compartidos solo cuando sea necesario. Mantener autenticación, historial privado, límites de adjuntos, proveedor Gemini y recuperación actuales. No cambiar el corpus ni reglas jurídicas. Preservar búsquedas, conversaciones y enlaces existentes. No añadir dependencias si los componentes actuales bastan.

## Validación
Tipos y lint; pruebas existentes relevantes de chat, fuentes, sesiones y adjuntos. Revisión visual en escritorio y móvil, navegación por teclado, envío y cancelación, restauración de conversación y consulta de fuentes/PDF. Publicación en el proyecto Vercel existente y comprobación de su estado y pantalla real. No afirmar precisión jurídica a partir de estas pruebas de software.
