# Centro Jurídico: entidades, lectura asistida y actualización controlada

Fecha: 27 de octubre de 2026. Alcance solicitado: adaptar las siete mejoras revisadas de CELEX a las funciones existentes de ACE.

## Decisión y alternativas

Se recomienda ampliar las pantallas y servicios actuales. Crear otro portal duplicaría fuentes y revisiones; limitarse a enlaces externos impediría usar las fuentes en Chat y en el trabajo. La implementación se divide en tres entregas comprobables, manteniendo las siete funciones solicitadas.

El catálogo existente, los bloques verificables, las carpetas y las exportaciones se reutilizan. No se sustituye una revisión por una inferencia ni se publica una categoría vacía como si tuviera cobertura documental.

## Entrega A: directorio y fichas

### Directorio de entidades

Crear un registro institucional con nombre canónico, siglas/alias, RUC opcional, procedencia oficial, evidencia, fecha de consulta y estado detectado/verificado/rechazado. El nombre y el RUC tienen comprobaciones independientes. Validar formato y dígito de control del RUC no acredita existencia ni titularidad.

Autocompletado autenticado y paginado en servidor, con búsqueda normalizada por nombre, alias y RUC, 10 resultados por página y sin cargar todo el directorio. Conservar consulta y filtros al seleccionar. Mostrar por separado entidades del directorio y documentos accesibles asociados. Cero documentos asociados no significa inexistencia de documentos en otras bibliotecas.

La población inicial reutiliza los nombres con evidencia explícita del catálogo como detectados. Los registros verificados requieren una fuente oficial consultable y revisión administrativa trazable; no copiar el directorio privado de CELEX ni inventar RUC por similitud. La interfaz identifica honestamente los registros pendientes. El administrador puede revisar, corregir y asociar entidades a documentos con historial de cambios. Emisor, solicitante y contratante son roles separados.

### Fichas por tipo

Componente común reutilizable en Normativa, Búsqueda y lector, con una cabecera y campos especializados:

- Opinión: número, fecha oficial, emisor, solicitante, asunto y consultas registradas. Las consultas inferidas se etiquetan y nunca aparecen como citas originales.
- Pronunciamiento: número, fecha, entidad, procedimiento, objeto y asunto.
- Base: procedimiento, objeto, norma aprobatoria, versión y original editable.
- Laudo: identificador, institución/árbitros, partes, objeto, fecha y pretensiones registradas; distinguir datos detectados de revisados.
- Otros: título, emisor, tipo, publicación, versión, procedencia y estado de revisión.

No deducir régimen por fecha, sigla institucional o año. Ocultar campos ausentes secundarios, manteniendo un aviso de cobertura donde sea necesario. Los estados técnicos se agrupan en un desplegable; revisión jurídica y versión permanecen visibles.

## Entrega B: lector e investigación

### Análisis guiado

Dentro del lector ofrecer Explicar este pasaje, Identificar las consultas, Resumir las conclusiones y Relacionar con otras fuentes. Las acciones abren o continúan el Chat existente con documento, versión, artículo/cuerpo normativo si existe, bloque o página y pasaje seleccionado. La primera acción se limita al pasaje y su contexto; consultas y conclusiones pueden necesitar todo el documento. Si la recuperación es parcial, la respuesta debe decirlo y evitar una conclusión de exhaustividad.

Las primeras tres acciones conservan las fuentes seleccionadas. Relacionar solicita expresamente ampliar la búsqueda, manteniendo la fuente original y diferenciando las adicionales. Los localizadores son identificadores validados en servidor; nunca aceptar texto enviado por el cliente como evidencia oficial. Una versión modificada genera aviso y exige recargar la fuente.

Mostrar claramente Texto original / Explicación asistida. Reutilizar comprobación de citas y disponibilidad de originales. No añadir un segundo motor de respuestas ni reemplazar el verificador actual.

### Expediente de investigación

Ampliar las carpetas personales con pregunta de trabajo, objetivo, estado borrador/en revisión/cerrado y notas. Conservar compatibilidad con carpetas existentes y sus elementos guardados. Crear un expediente de investigación no crea ni aprueba un expediente de contratación.

Permitir reunir fuentes y respuestas, abrir selección en Chat y preparar un informe con pregunta, notas, respuesta asistida diferenciada, títulos, versiones, localizadores, enlaces y límites. Reutilizar la exportación DOCX/CSV y comprobación actual de permisos; no exportar fuentes inaccesibles. Conservar las instantáneas y advertir cambios de huella.

La vinculación con necesidades, expedientes y contratos reutiliza referencias personales y vista previa. No altera registros operativos, bases o decisiones jurídicas. El informe es borrador pendiente de revisión, con fecha de generación y fuentes.

## Entrega C: actualización, seguimiento y laudos

### Actualización controlada

Crear un registro de fuentes oficiales permitidas y ejecuciones con estados pendiente/en curso/completa/parcial/fallida. Un conector consulta únicamente publicaciones oficiales y destinos autorizados, con tiempos y tamaños limitados, validación de URL/redirecciones, protección ante destinos internos y registro de procedencia. No usar sesiones privadas de CELEX como conector.

Una ejecución detecta candidatos, compara identificador oficial, URL y huella, relaciona versiones sin sobreescribir originales y registra anexos con estado individual. Separar nueva publicación, archivo cambiado, posible versión y relación jurídica revisada. Una mención de otra norma no acredita modificación o derogación.

La primera ejecución es manual por administrador con vista previa. Los candidatos requieren aprobación de incorporación y extracción/indexación completa antes de entrar en Chat. Un archivo incompleto o anexo necesario no comprobado queda pendiente y muestra causa. Las fuentes aceptadas conservan el estado de revisión jurídica independiente.

Preparar un servicio invocable de manera programada, pero no activar una frecuencia recurrente sin definir fuentes, volumen, coste y cadencia. La pantalla muestra última ejecución satisfactoria, fallos y cobertura real; no promete actualización exhaustiva.

### Seguimiento

Guardar por usuario documento/familia o criterios de búsqueda normalizados, con opción de pausar y eliminar el seguimiento. El evento se genera a partir de publicaciones aceptadas o cambios registrados; la búsqueda semántica se identifica como detección limitada, no censo exhaustivo.

Crear bandeja de novedades jurídicas vinculada a las alertas existentes, sin confundir alertas operativas del expediente. Deduplicar por seguimiento, evento y versión. Mostrar qué cambió, procedencia, fecha y estado detectado/revisado; permitir marcar leído. La primera entrega usa avisos dentro de ACE, sin enviar correos ni activar notificaciones externas.

### Laudos

Añadir laudo_arbitral a la clasificación, restricciones SQL, índice, filtros compartidos, lectores y Chat. El tipo de fuente se distingue expresamente de una norma general. Metadatos: identificador oficial, fecha, institución, árbitros, demandante/demandado, entidad, contratista, objeto, contrato/procedimiento cuando consten y pretensiones.

La importación reutiliza la cadena oficial con original privado, huella, extracción, páginas y comprobación de recuperación. Deduplicar laudo, corrección y anulación como documentos relacionados, sin dar por acreditada esa relación hasta revisar evidencia. Mostrar cobertura vacía si todavía no hay fuentes válidas.

Validar la cadena con un lote piloto de hasta cinco documentos de fuente oficial accesible. Si no se localizan o descargan originales válidos, registrar el impedimento; no sustituirlos por documentos inventados ni extraer áreas restringidas. Los nombres de partes públicas se muestran según el original; los expedientes privados mantienen permisos.

## UX compartida

Una entrada con buscador y accesos Normas / Opiniones y criterios / Bases editables / Mis fuentes. Mantener las colecciones y Novedades como accesos secundarios, evitando duplicar menús. Los filtros específicos aparecen según el tipo, con etiquetas activas y restablecimiento. Abrir un documento conserva resultados, selección y posición.

En escritorio, acciones de lectura y Chat coordinadas; en móvil, paneles con retorno claro, controles de al menos 44 px y sin desplazamiento horizontal. Usar Tailwind y componentes existentes, etiquetas visibles, foco de teclado, cierre accesible y estados cargando/sin datos/error diferenciados. No usar encuestas emergentes. La valoración negativa discreta conserva motivos existentes.

## Seguridad y trazabilidad

Autenticación en todas las rutas privadas. RLS por propietario para investigación y seguimiento. Revisiones y conectores solo para administradores. Comprobar permisos al leer, guardar, vincular y exportar; no confiar en identificadores ni instantáneas del cliente. Guardar actor, fecha, motivo y evidencia de las revisiones. No exponer claves, originales privados, registros de autenticación ni datos de otras oficinas.

Migraciones aditivas e idempotentes con verificación previa de funciones SQL existentes. Mantener estados y filtros compartidos en Chat, Búsqueda y Normativa. Preservar cambios locales ajenos. No hacer push forzado ni declarar terminado un despliegue antes de READY y comprobación de la URL pública.

## Criterios de aceptación y pruebas

1. Entidades: nombre/sigla/RUC, paginación, roles y cobertura independiente; corrección administrativa trazable, sin falsos verificados.
2. Fichas: campos por tipo y ausencia de datos honesta; revisión y versiones coherentes en los tres menús.
3. Lector: acción conserva fuente y localizador; bloque ajeno, versión cambiada y fuente inaccesible rechazados; ampliación explícita.
4. Investigación: aislamiento entre usuarios, compatibilidad de carpetas, informe con citas y vista previa de vinculación.
5. Actualización: duplicados, nueva versión, anexos incompletos, redirecciones peligrosas y fallos parciales; candidatos no entran al RAG antes de validarse.
6. Seguimiento: aislamiento, deduplicación, pausa, lectura y distinción entre publicación y relación jurídica revisada.
7. Laudos: cadena completa con original oficial, clasificación, filtros y citas; cobertura vacía si no hay documentos aceptados.
8. Pruebas específicas, tipos y compilación; recorrido real en navegador y viewport móvil. La validación en teléfono físico y la precisión jurídica por especialistas se reportan aparte.

La entrega se informa por separado como implementada, migrada, poblada, probada y publicada. La identidad jurídica de entidades y la calidad de las respuestas no se acreditan únicamente con pruebas de programación.
