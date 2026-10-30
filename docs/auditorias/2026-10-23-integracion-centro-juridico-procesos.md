# Integración del Centro Jurídico con Necesidades, Expedientes y Contratos

Análisis del código local, 23/10/2026. No se modificaron flujos, permisos ni datos de producción. No se verificó aquí la correspondencia de todas las rutas locales con el despliegue actual ni la estructura efectiva de la base de datos.

## Situación observada

- Necesidades tiene ficha, documentos, observaciones, workflow y copiloto. `lib/necesidad-copiloto.ts` recupera fuentes y diferencia modelos de normas.
- La derivación a Expedientes en `app/api/necesidades/[id]/derivar/route.ts` usa capacidad expediente.manage, enlaza necesidad/process y precarga hitos. Incluye reconexión para evitar duplicados por vínculos antiguos incompletos.
- `lib/processes.ts` contiene un adaptador de tipo de objeto entre Necesidades y Expedientes. Debe reutilizarse: los valores de clasificación no son idénticos.
- Expedientes comparte contexto mediante `app/components/expediente-contexto.tsx`. Algunas acciones de sustento generan un borrador contextual y avisan de citas no autorizadas; no todas equivalen a la verificación documental del Chat.
- Los esquemas y rutas revisados de contratos_sie y contratos_cp guardan usuario, nomenclatura, estado y JSON del formulario, sin un process_id explícito en esos esquemas/rutas. Esto debe contrastarse con la base efectiva antes de migrar. Una nomenclatura no constituye una clave de relación fiable.

## Diseño propuesto

Conservar los módulos y conectar su contexto mediante una capa común de consulta documental y evidencia. La necesidad conserva su ficha; el expediente concentra hitos y documentos del proceso; cada contrato mantiene versión y vínculo explícito al expediente. El Centro Jurídico aporta fuentes, explicaciones y comprobación, sin cambiar decisiones administrativas automáticamente.

### Contexto autorizado

Un endpoint recibe tipo e ID del registro, etapa/campo y pregunta. Recupera en servidor solo los datos permitidos para ese usuario. Compone contexto con objeto original y normalizado, procedimiento provisional/confirmado, monto/moneda, fechas relevantes, régimen declarado/revisado, etapa y documentos seleccionados. Marca datos pendientes y su procedencia. No deduce automáticamente régimen de un año fiscal ni convierte un procedimiento previsto en decisión confirmada.

Contexto mínimo y revisable: se puede excluir información antes de enviarla al proveedor. El usuario decide si consulta normativa institucional, documentos privados autorizados del caso o ambos. Resultados etiquetados por origen; un modelo de formulario no se presenta como disposición jurídica.

### Evidencia guardada

Crear un vínculo entre registro/campo y sustento, con IDs de documento y fragmento, versión/huella del PDF, página/artículo disponibles, pasaje, consulta, alcance, versión del contexto, revisión realizada, autor, fecha y estado de aceptación. Guardar una instantánea para reconstruir qué fuente se usó en esa decisión. Modificaciones posteriores generan nueva revisión; no sobrescriben silenciosamente un sustento aprobado. Separar apoyo documental de aplicabilidad al caso.

### Interfaz común

Panel «Fuentes y revisión» en los tres módulos. Acciones: Buscar fuentes para esta etapa, Consultar este caso, Ver PDF, Adjuntar sustento y Revisar cambios propuestos. Mostrar contexto cargado, datos faltantes y documentos incluidos. Regresar conserva campo, borrador, filtros y selección. En móvil, panel accesible; no duplicar un chat completo por módulo.

### Necesidades

Buscar criterios relacionados con el campo seleccionado, revisar coherencia de ficha y documentos y registrar observaciones con fuente. Mantener separados texto original, propuesta de IA y texto aceptado. La derivación transfiere vínculos y antecedentes sin declarar revisados los campos por haber usado IA.

### Expedientes

Heredar la necesidad y permitir contraste con el estado actual. Búsqueda por hito, fuentes ligadas al sustento y lista de pendientes. Las reglas deterministas comprobadas deben distinguirse de recomendaciones y de revisiones de texto. Registrar cambios en objeto, monto, fechas o procedimiento y señalar qué sustentos requieren revisión. No insertar una cita generada sin cotejarla con el corpus.

### Contratos

Seleccionar un expediente autorizado al crear/importar el contrato. Precargar únicamente datos con procedencia y estado confirmado; los datos extraídos de PDF siguen sujetos a revisión. Comparar cláusulas y datos con antecedentes, separar propuesta de texto de validación jurídica y guardar versión de cada contrato y sus fuentes. La revisión de IA no equivale a aprobación o firma.

### Datos y permisos

Verificar relación efectiva antes de migrar. Incorporar clave foránea explícita de contrato a expediente si falta, permitiendo borradores independientes cuando el flujo lo requiera. No vincular contratos antiguos solo por coincidencia de nomenclatura: previsualizar candidatos y resolver ambigüedades. Mantener restricciones transaccionales para prevenir derivaciones duplicadas.

Reutilizar capacidades, oficina, entidad y RLS en cada endpoint, incluso al abrir una sesión de chat creada desde un módulo. El acceso al corpus institucional no otorga acceso a expedientes privados. No indexar borradores privados como corpus institucional ni incluir hechos sensibles en URLs. Aplicar minimización, registro y retención de consultas/adjuntos.

## Etapas y comprobación

1. Mapear vínculos reales, taxonomías, permisos y estados de los tres módulos; detectar duplicados o relaciones ambiguas sin modificar datos.
2. Construir contexto autorizado y transferencia privada al buscador/Chat con retorno al registro. Probar aislamiento entre usuarios y permisos por módulo.
3. Añadir panel común y persistencia de evidencia. Verificar página, documento, versión y campo; guardar solo tras aceptación.
4. Integrar precarga y revisión contractual; pruebas de cambio de datos y protección de borradores.
5. Añadir seguimiento de actualización de fuentes y evaluación con casos completos revisados por responsables.

Criterios de aceptación: un recorrido Necesidad → Expediente → Contrato conserva identidad, datos y antecedentes; cada sustento abre su fuente original; ningún dato faltante se inventa; una modificación relevante marca lo afectado para revisión; el usuario puede rechazar propuestas; el acceso cruzado no autorizado se deniega en servidor.
