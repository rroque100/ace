# Integración oficial OECE — 28 de octubre de 2026

La fuente de nuevas descargas es https://www.gob.pe/institucion/oece/normas-legales. No se implementó un conector de descarga de LEX.

## Resultado comprobado

- Primera página: 25 publicaciones con PDF; 1 incorporada y 24 pendientes de revisión administrativa.
- Resolución 9438-2026-TCP-S1: original en Supabase, 20 páginas físicas, 19 fragmentos; texto completo e indexación en Pinecone comprobados. Véase `oece-conector-auditoria-2026-10-28.json`.
- El panel administrativo de Novedades permite registrar la fuente, revisar publicaciones recientes y continuar la paginación histórica. Revisar la primera página no descarta la continuación pendiente.
- Cada incorporación requiere clasificación, procedencia, versión y revisión explícita de anexos. La aprobación documental no certifica vigencia ni aplicación jurídica.
- Duplicados por enlace y por huella de contenido; las versiones nuevas no sobrescriben el original.

## Límites explícitos

La ejecución es manual y acotada a una página; no hay frecuencia automática ni descarga de todo el catálogo. El detector de novedades encuentra enlaces nuevos: no certifica que un PDF ya aceptado no haya sido reemplazado bajo la misma URL. Esa comprobación periódica de archivos existentes queda pendiente.

Las mejoras aprobadas de directorio, fichas, lectura guiada, seguimiento, carpetas de investigación y laudos están implementadas. Se aplicaron las migraciones 202610270004–202610280002. El directorio inicial contiene nombres detectados, no entidades verificadas automáticamente. Un laudo de contratación pública del archivo oficial OSCE fue indexado; un candidato de inversión ajeno al ámbito quedó excluido reversiblemente del corpus institucional.

## Verificación

121 pruebas en 20 archivos correctas durante la entrega; 28 pruebas focalizadas correctas tras el ajuste final de revisión reciente. TypeScript y compilación de producción correctos. El lector abrió el PDF de 20 páginas y preparó una consulta con pasaje y versión fijados, sin enviar la pregunta automáticamente. La emulación móvil no pudo confirmarse; teléfono físico y revisión jurídica especializada pendientes.
