# Lote oficial de diez documentos por categoría

Diseño aprobado el 22 de octubre de 2026. Lote en ejecución, no representa cien documentos completados. Corte de comprobación: 2026-10-22T19:21:02.097Z.

| Categoría | Meta | Candidatos PDF | Indexados o reutilizados | Error | Excluidos |
|---|---:|---:|---:|---:|---:|
| Leyes | 10 | 4 | 2 | 0 | 0 |
| Reglamentos | 10 | 3 | 0 | 0 | 1 |
| Directivas | 10 | 10 | 2 | 0 | 0 |
| Opiniones | 10 | 10 | 10 | 0 | 0 |
| Resoluciones del Tribunal | 10 | 10 | 2 | 0 | 0 |
| Acuerdos de Sala Plena | 10 | 10 | 2 | 0 | 0 |
| Pronunciamientos | 10 | 10 | 2 | 0 | 0 |
| Informes de vicios de nulidad | 10 | 0 | 0 | 0 | 0 |
| Bases estándar | 10 | 0 | 0 | 0 | 0 |
| Guías e instructivos | 10 | 10 | 2 | 0 | 0 |

Las diez opiniones existentes cuentan para la cuota. Cada indexación completada comprueba PDF almacenado mediante SHA-256, extracción completa según el procesador y recuperación real en Pinecone. Los documentos se conservan en Storage privado.

## Adaptación de ACE

Catálogo compartido con diez categorías; nuevas categorías compatibles con los registros anteriores; tres grupos en Normativa (normas, jurisprudencia y opiniones, bases y orientación); filtros en Buscar y acceso desde resultados al grupo correcto. Consultas con IA identifica cada fuente como norma, criterio u orientación. Las fuentes de orientación no satisfacen la cobertura crítica de ley o reglamento. Régimen no determinado y vigencia desconocida quedan explícitos cuando aún requieren revisión.

## Límites y exclusiones

Las bases actuales consultadas del MEF ofrecen archivos DOCX. Se registran diez enlaces oficiales en el archivo de pendientes, sin hacer pasar una conversión por PDF oficial. Los informes IVN requieren originales oficiales; no se reemplazan por resoluciones o noticias que solo los mencionan. No se agregan leyes o reglamentos ajenos para completar artificialmente la cuota de diez.

Se excluyó del RAG el PDF de DS 001-2026-EF porque sus últimas páginas incluyen otra norma. El archivo original se conserva para revisión. Las versiones del reglamento se identifican individualmente en el manifiesto.

## Ejecución administrativa

Validar sin escribir en producción:
```text
npm exec --yes --package=tsx -- tsx scripts/import-corpus-oficial.ts docs/importaciones/corpus-oficial-2026-10-22.json --limit=7
```
Aplicar y reanudar el lote:
```text
npm exec --yes --package=tsx -- tsx scripts/import-corpus-oficial.ts docs/importaciones/corpus-oficial-2026-10-22.json --apply --limit=100
```
Filtrar una categoría añadiendo, por ejemplo, `--type=directiva`. Se requiere el entorno privado del servidor; no se copian claves al manifiesto. No ejecutar dos importaciones del mismo lote a la vez. El importador detecta bloqueos de procesos terminados, comprueba integridad y no repite elementos completados.

Pruebas afectadas: 44 comprobaciones satisfactorias y TypeScript sin errores. La ampliación de la restricción documents_document_type_check está aplicada en medmcaiskvtbckpakseo mediante el SQL versionado del proyecto.
