# Revisión documentada de vigencia

Diseño aprobado: un administrador o perfil jurídico registra un resultado vigente, parcialmente vigente, no vigente o información insuficiente. Debe identificar versión, fecha a la que se comprobó, fuente oficial y justificación. Alcance: documento completo o artículos identificados por UUID y cuerpo normativo. El autor y la fecha de registro los determina el servidor.

El registro no certifica automáticamente la aplicabilidad a un contrato. Las revisiones son institucionales, visibles a usuarios autenticados que pueden consultar ese documento. No contienen datos de expedientes privados. El historial es inmutable y conserva correcciones, sin borrar revisiones anteriores. Guardado con revisión optimista para evitar sobrescribir trabajo simultáneo.

La revisión del documento y las de artículos se conservan separadas. Revisar un artículo no declara vigente el PDF completo. Cambiar archivo, versión o estructura invalida la revisión activa y conserva su historial. Normativa, Búsqueda y Chat muestran la misma información de catálogo; una conversación histórica conserva su texto original y consulta el estado actual al abrir la fuente.

La interfaz mantiene Tailwind y el lenguaje visual existente: tarjeta discreta de revisión con estado, versión, fecha, autor y acceso al sustento; formulario plegado para perfiles autorizados. El historial admite paginación. No se marcará ningún documento real como revisado durante las pruebas sin una revisión humana efectiva.

Una revisión posterior por artículos deja pendiente la confirmación del documento completo; la revisión completa anterior permanece en el historial. Una nueva revisión completa puede confirmar nuevamente el conjunto.
