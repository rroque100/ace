# Importar carpetas y consultar expedientes

## Subir RAG

Seleccionar la carpeta de tipo documental (por ejemplo NOTAS DE PAGO), que contiene las carpetas de archivadores y sus PDF. Revisar la tabla antes de importar. Los campos son editables; el código del archivador se conserva íntegro, el CP no se guarda como SGD y el SIAF mantiene ceros iniciales. Las fechas proceden del nombre, no son una confirmación del contenido. Para carpetas con otra estructura se corrigen tipo y archivador antes de subir.

La ubicación común del lote es opcional. Si existen distintos estantes o locales, importar por grupos o corregir después desde la ficha. Coincidencias de CP requieren revisión explícita. No se reemplazan archivos por compartir un CP.

Los archivos se guardan secuencialmente. Se detecta contenido ya guardado por el mismo usuario mediante SHA-256 calculado en servidor. Esta comprobación no es una restricción única de base de datos: dos subidas simultáneas desde sesiones distintas todavía pueden producir dos registros. No hay sobrescritura automática. El límite por archivo sigue siendo 100 MB. Una petición rechazada por límite de frecuencia se reintenta; las respuestas ambiguas no se repiten automáticamente.

## Buscar RAG

Consulta paginada de registros con filtros exactos por CP, SIAF, código de archivador, tipo y año. CP/SIAF usan los metadatos de la nueva importación: los registros anteriores siguen visibles pero no adquieren esos campos automáticamente. Cada resultado ofrece ficha/PDF, ubicación y estado.

Seleccionar «Consultar este expediente» limita la recuperación y la pregunta a su identificador. La consulta general usa todos los documentos accesibles, no los filtros de la tabla. Se muestran fragmentos y citas a documentos/páginas. Los controles de autorización se verifican en servidor.

## OCR y recuperación

Se procesa un bloque de tres páginas originales por invocación. Cada bloque se conserva en la tabla existente expedientes_ocr_cache, bajo una clave específica de archivo y rango. Una reserva por versión evita procesamiento concurrente del mismo documento. Una reserva de más de seis minutos puede recuperarse. La publicación final del índice usa la función SQL atómica archivo_publicar_indice ya instalada.

La subida inicia un bloque. En Buscar RAG, «Procesar hasta completar» continúa automáticamente bloque a bloque mientras esa pestaña permanezca abierta. Se puede pausar después del bloque actual; cambiar de pestaña también detiene las siguientes invocaciones. El siguiente intento reutiliza los bloques guardados. Se requiere un paso final para publicar el índice, separado del OCR.

Si se cierra el navegador, el cron existente de recuperación corre una vez al día y avanza un documento por invocación con la configuración predeterminada. No equivale a un trabajador continuo; para grandes lotes debe utilizarse el trabajador de indexación existente o ajustar la programación según el alojamiento. Los errores se reintentan manualmente. No se debe presentar el archivo como consultable por contenido antes de la publicación completa.

No se han cargado los PDF reales de NOTAS DE PAGO durante el desarrollo. No se requiere una migración nueva: se reutilizan registros, metadata JSON, caché OCR y publicación atómica existentes.
