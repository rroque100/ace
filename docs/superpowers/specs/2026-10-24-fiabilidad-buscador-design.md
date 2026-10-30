# Primera etapa: fiabilidad del buscador

Alcance autorizado por el usuario: corrección de avisos parciales y continuidad de coincidencias por artículo.

Se expone un estado estructurado para las vías semántica, léxica y comprobación de referencias. El buscador mantiene los resultados recuperados y muestra un resumen visible cuando falla alguna vía, con razones en Alcance de esta búsqueda. No se introduce una etiqueta de certeza jurídica.

Una función compartida normaliza la consulta literal y el artículo padre tanto al buscar documentos como al pedir coincidencias adicionales. Se conserva la forma original para mostrarla al usuario. La paginación descarta IDs repetidos y detiene cargas que no incorporan pasajes; el PDF sigue accesible.

Se mantiene la autorización del endpoint y el corpus institucional permitido. Fallos completos siguen siendo errores, no cero coincidencias. No hay cambios en taxonomía, corpus, ranking o reglas normativas. Se verifica con pruebas de regresión, compilación y lectura de resultados publicados. No se provocan fallos de proveedores en producción para probar el aviso: esos casos se simulan en pruebas.
