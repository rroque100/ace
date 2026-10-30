# Entrega de búsqueda confiable

- Régimen: 14 documentos identificados documentalmente (13 Ley 32069, 1 Ley 30225). Método, evidencia y fecha en `documents.metadata.regimeReview`; identificación automática, revisión humana pendiente. No determina aplicabilidad al contrato. Los demás documentos siguen sin régimen confirmado; no se infiere por año.
- Vigencia: registro separado de revisión por comprobar; explicación de método y revisor en la tarjeta de esta versión. Se conservan fechas separadas y versiones históricas. No se han declarado vigencias nuevas.
- Sin resultados: corrección respaldada por vocabulario disponible también al terminar, acciones explícitas para todas las palabras o quitar filtros. La consulta original no se cambia silenciosamente.
- UX: grupo de radios nativos excluyentes, navegación por teclado propia del navegador, estados visibles y filtros avanzados plegados. No se afirma prueba con usuarios reales.
- Error detectado al ampliar evaluación: normalizar referencias antes del recorrido literal alteraba títulos exactos. Se conserva el título literal y la normalización de identificadores se aplica por separado.
- Evaluación ampliada: 25 casos (22 positivos y 3 negativos), nueve tipos documentales, modos literal/palabras/tema, referencia de artículo y filtros de régimen. Inicialmente fallaban cinco identidades; tras corregirlas los 25 pasan. Son expectativas documentales automáticas, no un conjunto representativo de pertinencia jurídica. Revisión especialista pendiente; no se declara porcentaje de precisión jurídica.
- Corpus ampliado: una resolución original MEF de 2026, tres páginas y trece fragmentos. PDF íntegro comprobado con SHA-256 en Storage, tres resultados de Pinecone en la verificación. Manifiesto `docs/importaciones/ampliacion-mef-2026-10-24.json`. Catálogo: 93 documentos indexados. No se presentan los anexos DOCX como PDF.
- IVN: las búsquedas de originales oficiales realizadas no localizaron un informe verificable; los documentos que solo los mencionan no se incorporaron como IVN. Categoría permanece vacía. La ampliación masiva, bases DOCX y revisión humana son trabajo pendiente.
- Micrófono: incluido diagnóstico diferenciado (permisos, dispositivo ausente/ocupado y grabador); reintento sin restricciones solo para OverconstrainedError. No se activó el micrófono del usuario ni se considera verificado su dispositivo.

Validación: 74 pruebas en 11 archivos correctas, comprobación de tipos y compilación de producción. Persiste aviso previo de pdfjs-dist. La validación con teléfono real, hablantes peruanos, usuarios no técnicos y especialista requiere su participación; no se sustituye por pruebas de programación.

Fuentes oficiales revisadas:
- https://www.gob.pe/institucion/mef/normas-legales/6683111
- https://www.gob.pe/institucion/mef/normas-legales/7614342-001-2026-ef-54-01
