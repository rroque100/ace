# Contratos fiables y revisión guiada de ACE

Estado: diseño propuesto; alcance enviado al usuario para aprobación.

## Alcance de la primera entrega
Mejorar Contratos de Subasta Inversa Electrónica y Comparación de Precios, y corregir la presentación de métricas automáticas de IA. Conservar los formatos actuales y los registros existentes. El resto del ciclo de contratación —Necesidades y Expedientes— se trata en una entrega posterior.

## Alternativas consideradas
1. **Fiabilidad y UX de Contratos (recomendada):** arregla lectura de PDF y borradores, revisión de extracción, navegación y validaciones; mejora visible con un alcance comprobable.
2. **Solo diseño visual:** menor alcance, pero deja riesgos de extracción y pérdida de trabajo. No recomendada.
3. **Rehacer todo el ciclo y cambiar el modelo a la vez:** más alcance y riesgo, sin una línea base comparable. Requiere separar proyectos y comprobar migraciones. No recomendada como primera entrega.

## Experiencia
Mantener la identidad de ACE (navegación existente, colores neutros y acento verde). Encabezado con tipo de contrato y estado de guardado real, campos con etiquetas accesibles, tipografía legible y adaptación a pantalla estrecha. El elemento principal es una revisión guiada: Proceso → Contratista → Precios → Condiciones → Revisar. Los pendientes llevan al campo correspondiente; avance de completitud no equivale a validez jurídica.

La entrada ofrece crear SIE, crear CP y continuar un contrato. La biblioteca reúne ambos tipos con búsqueda y filtros. Los recuentos provienen de los datos disponibles; sin cifras ficticias. Mensajes de carga, vacío y error tienen acciones de recuperación. «Guardar borrador», «Guardado en ACE» y «Documento generado» distinguen situaciones reales. «DB» no aparece en las acciones del usuario. Las operaciones destructivas quedan separadas y conservan una confirmación explícita; no se eliminan contratos como parte de las pruebas.

## Borradores
Identificar el borrador por usuario autenticado, tipo y contrato o nueva preparación. No leer automáticamente claves heredadas sin propietario verificable ni borrar datos heredados. Mantener referencia al último estado, guardar al abandonar sin capturar el estado inicial y no marcar guardado si falla el almacenamiento.

No sustituir silenciosamente un contrato cargado por otro borrador. Si existe un borrador local recuperable para el mismo contrato, ofrecer revisar/restaurar ese borrador. Mantener advertencia de cambios pendientes cuando corresponda y conservar navegación por teclado. Evitar desmontajes que descarten datos sin guardarlos.

## Extracción con IA
Reutilizar el proveedor configurado: actualmente Gemini 2.5 Flash. Resolver la ruta de respaldo PDF de forma compatible con el proveedor; no pasar un PDF a una traducción que descarte `input_file`. Usar lectura nativa o extracción existente según capacidades y tamaño; si el archivo excede límites o la lectura es parcial, informar y pedir una sección legible, sin presentarlo como lectura completa. No aumentar automáticamente el límite de OCR ni cambiar el índice/vectorización.

Validar el JSON según tipo de extracción y detectar salidas vacías/truncadas. Los datos extraídos son sugerencias pendientes de revisión. Mostrar el archivo y el resultado antes de aplicar; mantener valores manuales cuando no se encuentra un dato y permitir aplicar sugerencias de manera explícita. No inventar páginas, valores ni porcentajes de confianza. No incorporar ofertas privadas al corpus normativo compartido. Mantener registros de proveedor, modelo y tipo de lectura sin registrar claves ni texto privado innecesario.

## Validaciones y sustento
Separar guardado de borrador incompleto de preparación para exportar. Reutilizar requisitos estructurales existentes entre cliente y servidor; normalizar importes, cantidades, fechas e identificadores sin añadir reglas jurídicas nuevas. Las inconsistencias aritméticas se muestran antes de generar; no se reinterpretan como infracciones legales.

La consulta de sustento utiliza el chat existente con procedimiento y pregunta genérica pertinente; no incluir datos personales ni documentos privados en parámetros de URL. Si se modifica una cláusula o regla normativa, verificar su valor contra el corpus real con la guía de verificación legal antes de codificarla. Ningún nuevo estado de «legalmente aprobado» se deriva solo de completar campos o de una respuesta de IA.

## Modelo y precisión
No cambiar globalmente modelo ni razonamiento en esta entrega. Mostrar el modelo efectivo y las limitaciones en la evaluación administrativa, con datos de ejecución disponibles. Las métricas existentes se llaman puntuación automática/cobertura; no afirmar «respuesta correcta» sin una referencia revisada. Conservar resultados históricos identificados como tales.

Definir un conjunto de referencia de extracción con documentos sintéticos sin datos personales y valores conocidos; incluir PDF de texto, escaneo, campos ausentes, importes y salida inválida. Para preguntas jurídicas, separar pruebas de trazabilidad y abstención de una evaluación jurídica revisada por especialista. No publicar un porcentaje de precisión jurídica ni de superioridad sobre LEX a partir de heurísticas.

## Arquitectura y datos
Mantener APIs de contratos existentes, autenticación, límites y propiedad. Extraer utilidades enfocadas para borrador, validación y lectura compatible de PDF cuando ayude a probarlas. La interfaz reutiliza componentes existentes y carga formularios/listados según necesidad. No alterar tablas, permisos ni proveedor de embeddings; si la implementación descubre una migración imprescindible, documentarla antes de ejecutarla.

## Validación de aceptación
- Crear borrador, editar, salir y recuperar el último dato correcto; aislamiento entre usuarios y contratos.
- JSON inválido, campos ausentes y lectura parcial tienen mensajes explícitos y no borran valores manuales.
- El proveedor recibe realmente el archivo en el respaldo PDF; pruebas con cliente simulado y PDF sintético.
- Guardar y volver a cargar SIE/CP mantiene datos y contrato correcto.
- Progreso, pendientes, etiquetas, navegación por teclado, pantalla estrecha, carga y errores se revisan visualmente.
- Exportación conserva sus formatos y se prueba con datos sintéticos; no eliminar registros reales.
- Tipos, pruebas relevantes y compilación correctos; publicación selectiva y verificación en producción.

Auditoría base: `docs/auditorias/2026-10-14-contratos-ux-ia-lex.md`.
