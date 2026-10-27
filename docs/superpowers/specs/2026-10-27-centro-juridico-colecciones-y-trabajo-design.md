# Centro Jurídico: biblioteca, bases editables y fuentes de trabajo

Fecha: 27 de octubre de 2026.

## Objetivo y alcance solicitado

Adaptar a ACE las ocho funciones aprobadas por el usuario: colecciones por materia, bases editables, Chat con documento y PDF, entidad/RUC, selección y exportación, favoritos por caso, novedades oficiales y seguimientos específicos. Mantener un catálogo único para Chat, Búsqueda y Normativa, con navegación responsive en Tailwind CSS.

La entrega se divide en cuatro etapas verificables. No se crea otro buscador, otro sistema de carpetas ni otro generador de bases. No se copian índices o análisis privados de CELEX. La ampliación documental utiliza las fuentes oficiales ya localizadas.

## Estado comprobado

- El lote revisado contiene 78 referencias: 15 existentes y 63 nuevas.
- Hay 15 PDF nuevos indexados: 12 directivas y tres opiniones.
- Pendientes: 19 DOCX originales, cuatro PDF complementarios y 25 copias de texto de publicaciones web oficiales.
- Los cuatro PDF son dos lineamientos, un código de ética y un índice documental.
- Los 119 registros institucionales anteriores conservaron sus metadatos y estados durante la importación.
- Existen `carpetas` y `guardados`, las API `/api/folders` y `/api/saved`, y la pantalla `SavedWorkspace`.
- Existen selección de documentos y ampliación de corpus en Búsqueda/Chat, sugerencias en `contextualFollowups`, notas en `legal_work_notes` y vínculos con necesidades, expedientes y contratos SIE/CP.
- Existen plantillas y generación de bases por expediente. La nueva biblioteca de originales debe integrarse con ese recorrido.
- El procesamiento documental actual exige PDF; las categorías oficiales actuales no distinguen lineamiento, código de ética, comunicado e índice.

## Enfoques considerados

1. **Ampliar el Centro Jurídico existente — recomendado.** Reutiliza fuentes, permisos, selección y carpetas; exige adaptar taxonomía, índice y lectores.
2. Crear un portal separado inspirado en CELEX. Duplica navegación, versiones y estados, con riesgo de divergencia respecto del Chat.
3. Añadir únicamente enlaces de descarga. Resuelve el acceso a originales, pero no la consulta, las referencias ni el trabajo con fuentes.

Se adopta la primera alternativa. Cada etapa debe poder validarse sin presentar las siguientes como terminadas.

## Etapa 1 — Activar y clasificar los documentos pendientes

### Formatos y localizadores

- PDF: conservar el archivo, su huella SHA-256 y la extracción por página; habilitar RAG solo si se acredita extracción completa.
- DOCX: conservar el original intacto y extraer párrafos, encabezados y tablas desde OOXML, sin ejecutar macros, vínculos ni recursos externos. Asignar localizadores estables dentro de la versión, por ejemplo sección, párrafo o tabla/fila.
- Publicaciones web: conservar la copia de texto existente y su URL oficial. Identificar cada bloque mediante un localizador estable de sección/párrafo. Distinguir expresamente la copia de texto del documento oficial en PDF.
- Nunca inventar páginas para DOCX o texto web. Las citas muestran el localizador real y el enlace al original. Una conversión posterior a PDF se guarda como derivada y no reemplaza al original.
- Un documento con extracción fallida, incompleta o sin localizadores utilizables permanece fuera del RAG y muestra una causa concreta.

### Categorías y valor de las fuentes

- Incorporar `lineamiento`, `codigo_etica`, `comunicado` e `indice_documental` a la clasificación y a los filtros compartidos.
- Separar categoría documental y función de la fuente. Bases son modelos/orientación; comunicados son publicaciones informativas; índices ayudan a localizar documentos y no justifican por sí mismos una regla jurídica.
- El Chat debe expresar esas diferencias y no equiparar un comunicado, una base o un índice con una disposición normativa.
- Migrar únicamente los registros identificados del lote, conservando originales, huellas, procedencia, versiones y revisiones previas. No deducir régimen o vigencia por el título, la fecha o el emisor.
- Mostrar estados independientes: original disponible, extracción completa, indexado, revisión jurídica y anexos comprobados/pendientes.
- Mantener filtros y paginación en servidor; ampliar las listas permitidas en las consultas de catálogo y búsqueda, no solo en los selectores visuales.

### Validación

Probar extracción de tablas DOCX, referencias estables por versión, contenido completo, exclusión de fallos del RAG y correspondencia entre cita y texto. Verificar en Supabase y Pinecone cada documento habilitado. No marcar como comprobados anexos no descargados.

## Etapa 2 — Colecciones, bases editables y novedades

### Colecciones por materia

Ofrecer accesos a RNP, SEACE, obras, garantías, arbitraje y sanciones desde Normativa y Búsqueda. Aplican filtros del catálogo existente y conservan consulta, selección y retorno al Chat.

Separar materias propuestas automáticamente de las revisadas. Un documento puede pertenecer a varias materias. Mostrar cantidades reales y distinguir categoría vacía, ausencia de coincidencias y error de consulta. La asignación temática no confirma régimen ni vigencia.

### Bases editables

Crear una vista de bases dentro de Normativa con filtros de procedimiento, objeto y versión. Cada ficha muestra norma aprobatoria, procedencia, original DOCX, estado y versión disponible; no llamar vigente a la versión más reciente sin revisión.

Acciones: leer contenido, descargar original y vincular una copia/referencia a una necesidad o expediente accesible. Reutilizar el recorrido existente de elaboración de bases; no modificar la sección oficial ni sustituir plantillas existentes automáticamente. La vinculación requiere una acción explícita del usuario y conserva el documento y su huella.

### Novedades oficiales

Vista de publicaciones e incorporaciones recientes con dos fechas diferenciadas: publicación oficial comprobada y carga en ACE. Acceso a documento, versión y fuente. Mostrar cambios relacionados como detectados o revisados, según la evidencia disponible; una mención no demuestra modificación o derogación.

La primera entrega ofrece un feed consultable, no un robot de actualización ni avisos recurrentes. No supone que el catálogo sea exhaustivo o esté actualizado por una fecha de importación.

### UX y validación

Usar el diseño existente en Tailwind: tarjetas compactas, acciones primarias claras, filtros plegables en móvil, navegación por teclado y estados accesibles. Comprobar conteos y enlaces contra el catálogo, mantener originales descargables y validar la vinculación sin alterar el expediente.

## Etapa 3 — Entidad/RUC y carpetas de fuentes

### Entidades

Separar emisor, entidad contratante y solicitante. Añadir búsqueda por nombre/RUC en opiniones y pronunciamientos. Mostrar procedencia del dato y ausencia de revisión; no completar RUC por similitud de nombre.

Normalizar identificadores como texto, validar su forma y resolver nombres solo contra registros disponibles. Ampliar metadatos e índice en servidor. Un filtro sin registros clasificados debe explicarlo y permitir retirarlo, sin fingir ausencia de documentos pertinentes.

### Carpetas y pasajes

Ampliar `/guardado`, `carpetas` y `guardados` para reunir documentos, pasajes y respuestas con una instantánea de documento, versión, localizador, huella, fuente oficial y fecha de consulta. Conservar anotaciones personales.

Permitir crear/renombrar carpetas, mover elementos y abrir la selección en Chat. Mantener fuentes iniciales seleccionadas y distinguir las adicionales cuando se permita ampliar. Aplicar límites de consulta explícitos; no omitir silenciosamente fuentes de una carpeta grande.

Vincular una carpeta o selección con una necesidad, expediente o contrato SIE/CP mediante un registro personal de apoyo. Reutilizar los permisos y el patrón de `legal_work_notes`. No compartir carpetas entre usuarios, modificar documentos del procedimiento o aprobar actuaciones por esta vinculación.

### Exportación

Exportar una relación de fuentes en DOCX y CSV: título, versión, emisor, pasaje/localizador, revisión, enlace oficial y fecha de consulta. Mostrar vista previa y selección antes de generar. El documento exportado distingue textos originales, notas personales y respuestas asistidas pendientes de revisión.

La exportación inicial contiene la relación, no una descarga masiva de todos los originales. Comprobar nuevamente permisos sobre cada fuente al exportar y evitar fórmulas activas en CSV. Las carpetas y notas personales mantienen aislamiento por usuario.

### Validación

Pruebas de autorización, referencias inaccesibles, carpetas ajenas, datos inválidos, conservación de instantáneas, CSV seguro, fuentes exportadas y selección del Chat. Validar destinos accesibles en servidor, sin confiar en los identificadores enviados por la interfaz.

## Etapa 4 — Chat y lectura integrada

En escritorio, lector y Chat coordinados; en móvil, panel de fuentes accesible. Cada cita abre su página o bloque real. Mostrar siempre documento, versión y alcance de selección. El fallo del visor conserva acceso al original y al texto disponible.

Reutilizar y ampliar las sugerencias existentes. Basarlas en pregunta, fuente citada, tipo documental y límites detectados. Ejemplos de acciones: explicar el bloque citado, revisar un requisito, comparar con una versión seleccionada o precisar el dato decisivo del caso. No proponer excepciones o conclusiones como si ya estuvieran comprobadas.

Dar acceso a guardar pasaje, reunir fuentes y preparar una nota para el trabajo desde la lectura. La selección de originales para Chat debe persistir al cambiar entre las tres pantallas y al volver desde una respuesta.

Validar el recorrido completo: colección → búsqueda → documento/bloque → Chat → guardar → carpeta → exportar o vincular. Las pruebas de programación no acreditan precisión jurídica; los casos jurídicos revisados por especialistas siguen identificados por separado.

## Operación y publicación

- Conservar cambios locales ajenos y secretos fuera de Git. Los documentos originales permanecen en Storage privado.
- Preparar migraciones aditivas, validarlas y aplicarlas por etapa. No reemplazar funciones de base de datos sin conservar filtros y permisos existentes.
- Ejecutar pruebas específicas, comprobación de tipos y build según los archivos afectados; realizar comprobaciones de interfaz responsive con evidencia.
- Registrar por etapa qué quedó implementado, migrado, indexado, probado y publicado. No declarar publicado un cambio solo porque está guardado localmente.
- No comprometer precisión jurídica, actualización automática, validación en teléfono real ni comparación completa sin la evidencia correspondiente.

## Criterios globales de aceptación

1. Cada una de las ocho funciones solicitadas tiene un recorrido visible y comprobable.
2. Los 48 registros pendientes tienen resultado individual: habilitado con evidencia o pendiente con causa explícita.
3. Las fuentes no PDF conservan citas verificables sin páginas inventadas.
4. Chat, Búsqueda y Normativa comparten documento, versión, materia y estados de revisión.
5. Carpetas, notas, vínculos y exportaciones respetan permisos y no cambian el procedimiento.
6. Se mantienen accesos al original y a la fuente oficial ante fallos parciales.
7. Las cuatro etapas se validan y reportan por separado.
