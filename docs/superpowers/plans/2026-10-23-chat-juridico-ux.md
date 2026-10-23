# Chat jurídico intuitivo: plan de implementación

**Objetivo:** aplicar el diseño aprobado para preguntar, adjuntar y comprobar normas sin conocimientos técnicos.
**Arquitectura:** conservar estado y rutas del chat; reorganizar presentación, añadir un panel de normas por respuesta y usar apertura progresiva para ajustes.
**Tecnologías:** Next.js, React, CSS existente, Lucide y Radix Dialog.

- [x] Reorganizar cabecera, historial, ajustes y filtros en app/components/legal-chat.tsx, conservando valores y envío.
- [x] Simplificar avisos de evidencia, agrupar acciones y presentar normas relacionadas con cada respuesta y originales del caso.
- [x] Adaptar app/components/case-attachments.tsx y el compositor; datos del caso opcionales y lectura clara.
- [x] Aplicar estilos acotados en app/styles.css para escritorio/móvil, foco visible y una sola zona principal de desplazamiento.
- [x] Ejecutar tipos, lint y pruebas relevantes; revisar visualmente y publicar solo los archivos del alcance usando un índice separado.
- [x] Verificar el despliegue, conversación existente, entrada vacía y panel de fuentes; guardar evidencia visual.

No modificar proveedor, corpus, reglas jurídicas, permisos ni límites de archivos. No incluir otros cambios locales en el commit.

## Verificación · 23 de octubre de 2026

46 pruebas relevantes aprobadas en nueve archivos, tipos y lint aprobados. Compilación local de producción aprobada; conserva la advertencia preexistente del worker pdfjs-dist. Vercel confirmó Ready para af3d68b510cae890367d51b83818a1584101cc1c y 9c2cbcad5f235fd5e17abba20e15841b465c5a53.

Se comprobó en producción la restauración de la conversación sintética con sus dos adjuntos, la apertura de una cita con enlaces al PDF y Normativa, el cierre por Escape, los filtros opcionales y el inicio de una nueva consulta. Revisión visual de la vista estrecha disponible (614 px): compositor antes de ejemplos y panel vacío de normas oculto. El panel de fuentes se presenta como hoja lateral; el diseño de escritorio conserva una columna para normas. No se realizó una prueba en un teléfono físico.

No cambia el recuperador, el proveedor, los límites de adjuntos ni la evaluación jurídica. Las métricas de recuperación siguen accesibles mediante desplegables y no se presentan como porcentaje de exactitud.
Prueba final: se envió una pregunta de orientación general, finalizó la respuesta, se abrió el panel de normas de esa respuesta y se volvió a Nueva consulta. Evidencia visual local: .next/piloto-oficial/ace-chat-ux-profesional.png.
