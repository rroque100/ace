# Centro Jurídico de ACE

Estado: aprobado por el usuario. Este diseño sustituye como prioridad la propuesta de Contratos: el usuario aclaró que desea mejorar Chat, Búsqueda y Normativa y darles un nombre común.

## Nombre y alternativas
**Centro Jurídico** (recomendado): nombre breve que reúne las tres tareas sin reducir el módulo solo a documentos o a IA. Alternativas: **Biblioteca y Consultas**, más descriptivo pero largo; **Inteligencia Normativa**, más centrado en IA y menos claro para navegación documental.

## Primera entrega propuesta
Agrupar exclusivamente los accesos a `/chat`, `/busqueda` y `/normas` bajo Centro Jurídico. Los nombres de las opciones serán Chat jurídico, Búsqueda documental y Normativa y criterios. Añadir una cabecera de módulo compartida con tres accesos y la tarea principal de cada vista. Mantener las rutas actuales y los enlaces guardados. Archivo documental conserva su acceso, separado de estas tres herramientas.

## Experiencia profesional
Conservar identidad, tipografía y colores de ACE, mejorar jerarquía, etiquetas, foco y presentación en móvil. Evitar duplicar instrucciones y encabezados que no aporten información. Mostrar filtros activos y una acción para limpiarlos. Al pasar entre herramientas conservar filtros documentales compatibles (tipo, año, entidad, documento y procedimiento) cuando estén disponibles, sin enviar automáticamente hechos privados del caso a parámetros de URL. No confundir fecha del caso con año de publicación.

### Chat jurídico
Mantener los campos de contexto recientemente incorporados y las referencias a documento/página. Diferenciar relevancia de fuentes, suficiencia para responder y revisión de vigencia. El nivel de confianza no debe presentarse como porcentaje de exactitud jurídica. Facilitar buscar las fuentes y abrirlas en Normativa o PDF. No dar por confirmados régimen o vigencia solo porque se encontró un fragmento. Conservar historial privado y comportamiento de nueva conversación.

### Búsqueda documental
Dar protagonismo a la consulta, filtros y resultados: título, tipo, entidad, año, ubicación y fragmento. Presentar explícitamente estado de lectura y de vigencia cuando estén disponibles. Ofrecer acciones coherentes para PDF, consulta en chat y revisión en Normativa. Diferenciar sin resultados, carga y fallo de búsqueda; una caída semántica no debe parecer ausencia de documentos.

### Normativa y criterios
Presentar claramente Normas, Criterios y decisiones y Bases y orientación. No exigir artículos propios a guías, opiniones o decisiones; usar página cuando corresponda. Distinguir vigente, no vigente y vigencia sin confirmar con etiquetas y tonos distintos: un valor desconocido no tendrá apariencia de vigencia confirmada. No modificar metadatos jurídicos para lograr una etiqueta favorable. Conservar acceso al PDF y consulta contextual.

## IA y comparación con LEX
Mantener Gemini 2.5 Flash y el índice existente durante esta primera entrega. Reutilizar el diagnóstico ya realizado, que identifica el modelo actual y la diferencia entre cobertura automática y exactitud jurídica. Separar mejoras de navegación/UX de una futura comparación de modelos; no prometer un porcentaje de mejora frente a LEX.

La comparación disponible confirma que LEX también tiene chat y búsqueda con IA y filtros por ley/categoría/año. El objetivo de esta entrega es mejorar claridad y continuidad en ACE, no declarar equivalencia de corpus ni superioridad jurídica sin evaluación comparable.

## Restricciones
No modificar Contratos, Necesidades o Expedientes en esta entrega. No cambiar claves, permisos, tablas, proveedor de embeddings ni contenido de las fuentes. No añadir reglas jurídicas ni declarar vigente una norma sin verificarla. No copiar contenidos editoriales de LEX. Mantener los cambios locales ajenos intactos.

## Aceptación
Los tres accesos tienen nombre de módulo y navegación consistente. Los filtros y enlaces documentales compatibles mantienen contexto. Vigencia desconocida nunca aparece como confirmada. Las referencias conservan documento/página y se abren correctamente. Las tres vistas funcionan por teclado y en pantalla estrecha; estados de carga, error y vacío son comprensibles. Pruebas de clasificación de estado y enlaces, tipos, compilación y revisión visual antes de publicar.
