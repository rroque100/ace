# Operación de Centro Jurídico privado

## Almacenamiento y permisos
No se requieren tablas ni políticas nuevas: búsquedas usan chat_sessions.metadata.kind=legal_search; adjuntos usan chat_messages.metadata.kind=case_attachment. Todas las operaciones de filas usan JWT y RLS de las conversaciones. Las rutas de adjuntos verifican además owner_id y una ruta exacta vinculada al ID del mensaje.

El bucket ace-case-attachments se crea privado al recibir el primer adjunto válido. No crear políticas públicas o de lectura global. Los originales se guardan cifrados y autenticados con AES-GCM, vinculados a su ruta; solo una ruta autorizada entrega el original descifrado. Los adjuntos no se registran en documents ni se envían a Pinecone.

## Clave y copias
CASE_ATTACHMENT_ENCRYPTION_KEY es obligatoria en producción: sin ella, subir o descargar adjuntos falla de forma explícita (nunca se cifra en silencio con otra clave). Solo en desarrollo local sin configurar se tolera un derivado de SUPABASE_SERVICE_ROLE_KEY. Conservar la clave efectiva al migrar o rotar claves: cambiarla sin conservar el valor anterior impide descifrar originales previos. Respaldar conjuntamente filas privadas, objetos y configuración de claves. No guardar claves en Git.

## Límites y lectura
PDF, PNG y JPEG, hasta 4 MiB por archivo, 12 adjuntos por conversación y cuatro seleccionados por pregunta. PDF con OCR limitado a diez páginas cuando es necesario. Máximo de texto guardado y enviado: 20.000 caracteres por adjunto. Truncamiento, páginas vacías o escaneadas sin lectura y transcripción de imágenes se marcan para revisión. El texto extraído no es prueba de exactitud jurídica.

## Historial y observabilidad
Historial de búsqueda privado de las últimas 25 consultas completadas; restauración por ID y cuerpo de solicitud, sin hechos del caso en URL. Conversaciones y adjuntos se recuperan mediante rutas autenticadas sin caché. El modelo y proveedor efectivos, versión de instrucciones, tiempos, fuentes y advertencias se guardan en el turno privado; el coste no se inventa cuando no se dispone de uso facturable. Auditoría general oculta el texto de pregunta/búsqueda.

## Comprobaciones
Pruebas de acceso cruzado, rutas manipuladas, formato/tamaño, cifrado y su vinculación a la ruta, filtros múltiples, metadatos desconocidos, restauración privada y generación con fuentes C# separadas de F#. Los escenarios sintéticos sirven para verificar funcionamiento, no para medir precisión jurídica.
