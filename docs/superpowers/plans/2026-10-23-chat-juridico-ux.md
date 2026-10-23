# Chat jurídico intuitivo: plan de implementación

**Objetivo:** aplicar el diseño aprobado para preguntar, adjuntar y comprobar normas sin conocimientos técnicos.
**Arquitectura:** conservar estado y rutas del chat; reorganizar presentación, añadir un panel de normas por respuesta y usar apertura progresiva para ajustes.
**Tecnologías:** Next.js, React, CSS existente, Lucide y Radix Dialog.

- [ ] Reorganizar cabecera, historial, ajustes y filtros en app/components/legal-chat.tsx, conservando valores y envío.
- [ ] Simplificar avisos de evidencia, agrupar acciones y presentar normas relacionadas con cada respuesta y originales del caso.
- [ ] Adaptar app/components/case-attachments.tsx y el compositor; datos del caso opcionales y lectura clara.
- [ ] Aplicar estilos acotados en app/styles.css para escritorio/móvil, foco visible y una sola zona principal de desplazamiento.
- [ ] Ejecutar tipos, lint y pruebas relevantes; revisar visualmente y publicar solo los archivos del alcance usando un índice separado.
- [ ] Verificar el despliegue, conversación existente, entrada vacía y panel de fuentes; guardar evidencia visual.

No modificar proveedor, corpus, reglas jurídicas, permisos ni límites de archivos. No incluir otros cambios locales en el commit.
