# Piloto de corpus oficial OECE — 22 de octubre de 2026

Destino: ACE, proyecto Supabase `medmcaiskvtbckpakseo`. Lote `oece-oficial-2026-10-22`.

Diez opiniones obtenidas del portal oficial de OECE, sin extraer material editorial de LEX. Los PDF originales se conservan en Storage privado; Pinecone almacena sus fragmentos y referencias. No se duplicaron la ley y el reglamento existentes.

## Documentos y comprobaciones

| Opinión | Páginas | Fragmentos | Publicación oficial |
|---|---:|---:|---|
| D000112-2026-OECE-DTN | 7 | 12 | [OECE](https://www.gob.pe/institucion/oece/informes-publicaciones/8709968-opinion-n-d000112-2026-oece-dtn) |
| D000111-2026-OECE-DTN | 4 | 7 | [OECE](https://www.gob.pe/institucion/oece/informes-publicaciones/8698026-opinion-n-d000111-2026-oece-dtn) |
| D000110-2026-OECE-DTN | 6 | 11 | [OECE](https://www.gob.pe/institucion/oece/informes-publicaciones/8698010-opinion-n-d000110-2026-oece-dtn) |
| D000109-2026-OECE-DTN | 4 | 8 | [OECE](https://www.gob.pe/institucion/oece/informes-publicaciones/8697995-opinion-n-d000109-2026-oece-dtn) |
| D000108-2026-OECE-DTN | 5 | 9 | [OECE](https://www.gob.pe/institucion/oece/informes-publicaciones/8697965-opinion-n-d000108-2026-oece-dtn) |
| D000107-2026-OECE-DTN | 10 | 18 | [OECE](https://www.gob.pe/institucion/oece/informes-publicaciones/8674932-opinion-n-d000107-2026-oece-dtn) |
| D000106-2026-OECE-DTN | 4 | 7 | [OECE](https://www.gob.pe/institucion/oece/informes-publicaciones/8674912-opinion-n-d000106-2026-oece-dtn) |
| D000105-2026-OECE-DTN | 6 | 10 | [OECE](https://www.gob.pe/institucion/oece/informes-publicaciones/8663005-opinion-n-d000105-2026-oece-dtn) |
| D000104-2026-OECE-DTN | 9 | 18 | [OECE](https://www.gob.pe/institucion/oece/informes-publicaciones/8662982-opinion-n-d000104-2026-oece-dtn) |
| D000103-2026-OECE-DTN | 6 | 10 | [OECE](https://www.gob.pe/institucion/oece/informes-publicaciones/8646774-opinion-n-d000103-2026-oece-dtn) |

Se comprobó para cada PDF: huella SHA-256 tras descargarlo del almacenamiento, extracción completa, estado indexed, resultados reales de Pinecone y recuperación mediante la función que utiliza Buscar/Consultas con IA.

El catálogo Normativa incluye estos tipos en «Jurisprudencia y opiniones». Se verificó con sesión de administrador que aparecen las diez opiniones y que el detalle presenta el resumen, número correcto, vigencia desconocida, Pinecone verificado y enlace al PDF. Se corrigió el contador del listado y del detalle: antes contaba fragmentos como páginas; ahora cuenta páginas citadas distintas, incluyendo rangos superpuestos.

## Metadatos y límites

La vigencia se conserva como desconocida y la revisión legal como pendiente. La fecha y el año no acreditan vigencia ni aplicación a un régimen concreto. Se corrigió la detección de números con N.° para evitar confundir una ley citada con la propia opinión.

Prueba de Consultas con IA ejecutada en modo de evaluación, sin escribir historial ni suplantar a un usuario. Modelo informado: `gemini-2.5-flash`. Recuperó 8 fuentes del piloto.

Esto completa un lote inicial de opiniones; no representa una copia completa de la biblioteca LEX ni una sincronización periódica.

## Comprobación en producción con sesión iniciada

Se detectó que Vercel carecía de GOOGLE_API_KEY y EMBEDDING_PROVIDER, mientras el corpus del piloto se había indexado con Google. Tras autorización explícita del usuario, se añadieron como secretos de producción GOOGLE_API_KEY, EMBEDDING_PROVIDER, GEMINI_MODEL y GOOGLE_EMBEDDING_MODEL. No se registran sus valores en este informe. El archivo temporal de importación se eliminó después de guardar las variables.

Despliegue final de Vercel: `7HW6uAF9YNXyGfRKdS684uiUZwT8`, estado Ready, commit `663ecd314fc4ac7193d042e08cdd6195e7453866`.

La búsqueda «Opinión D000112-2026-OECE-DTN garantía por adelantos» en la interfaz publicada, filtrada por Opiniones, devolvió diez fragmentos del documento, con páginas y enlaces al PDF. El catálogo y el detalle muestran siete páginas citadas para esta opinión. Salud del servicio: HTTP 200 y ok=true. La prueba anterior que devolvía cero resultados quedó resuelta con la configuración coincidente con el corpus.
