# Centro Jurídico: diseño UX/UI con Tailwind CSS

## Objetivo
Unificar Chat, Búsqueda y Normativa como herramientas de trabajo jurídico fáciles de utilizar, conservando las funciones y las fuentes actuales.

## Dirección recomendada
Evolucionar la identidad existente de ACE: azul oscuro para títulos, verde petróleo para acciones, superficies claras y bordes discretos. Reutilizar los tokens y fuentes instalados. Evitar un aspecto de panel estadístico y elementos decorativos sin utilidad.

Alternativas consideradas: cambiar solamente colores no resuelve la jerarquía; sustituir todo por una plantilla administrativa introduce controles ajenos a las tareas jurídicas. Se recomienda rediseñar las superficies de trabajo y componentes compartidos.

## Diseño compartido
- Navegación común de tres destinos con estado activo inequívoco, etiquetas completas y foco visible.
- Cabecera compacta, una descripción de tarea y acciones principales identificables.
- Escala consistente de texto, separación, controles y tarjetas. Texto de lectura cómodo y ancho limitado.
- Botones y campos utilizables con teclado y táctil; etiquetas visibles y mensajes de carga, vacío y error diferenciados.
- Opciones secundarias plegadas; avisos jurídicos breves y detalles accesibles sin competir con el contenido.
- Diseño adaptable: columnas según espacio realmente disponible; en teléfono, filtros y fuentes accesibles mediante paneles o secciones plegables.

## Chat
Dar prioridad a la conversación y al campo para preguntar. Fuentes vinculadas a la respuesta; contexto del caso, filtros y detalles técnicos secundarios. Conservar citas, revisión documental, adjuntos, sesiones y límites de fuentes.

## Búsqueda
Campo principal dominante; modos excluyentes claros. Tipo, régimen y fecha próximos al campo; filtros avanzados plegados. Resultados compactos con pasaje, página y acciones Leer PDF, Consultar en Chat y Ver en Normativa. Conservar selección, historial, voz, correcciones y alcance de recuperación.

## Normativa
Listado compacto y lector como zona principal. Índice utilizable sin comprimir el texto; procedencia, versiones y estado documental secundarios. Conservar documento y artículo al pasar a Chat o Búsqueda. No presentar extracción ni referencias automáticas como revisión jurídica.

## Implementación
Utilizar Tailwind CSS 4 ya instalado, registrando únicamente las nuevas fuentes necesarias. Migrar los componentes y superficies de estos tres módulos de forma acotada, resolviendo la precedencia del CSS anterior. No habilitar un reset global ni modificar otros módulos. No cambiar consultas, permisos o reglas jurídicas por motivos visuales.

## Validación
Comprobar tipos, lint, compilación y pruebas funcionales relevantes. Revisar visualmente las tres rutas, sus estados vacíos y con contenido, teclado y anchuras de escritorio y teléfono disponibles. Informar por separado cualquier prueba de dispositivo real pendiente. Verificar que no se pierdan consulta, filtros, fuentes o documento seleccionado al navegar.

## Alcance
Incluye el diseño de los tres menús y sus pantallas, así como componentes visuales compartidos. No incorpora documentos nuevos ni certifica vigencia o precisión jurídica. La publicación debe seguir la revisión funcional y visual.
