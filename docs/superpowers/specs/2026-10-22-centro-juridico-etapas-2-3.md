# Centro Jurídico: etapas 2 y 3

Diseño aprobado por el usuario al solicitar implementar las etapas 2 y 3 del informe de LEX.

## Filtros y continuidad
Conservar filtros actuales. Añadir varios tipos y años (OR dentro de cada grupo, AND entre grupos), régimen revisado y opción explícita para incluir desconocidos. No deducir régimen ni vigencia por año. Guardar búsquedas completas en sesiones privadas de tipo legal_search, con fecha de ejecución y restauración sin texto privado en URL. Historial plegable y títulos deterministas.

## Adjuntos privados
Reutilizar propiedad y RLS de chat_sessions/chat_messages. Cada adjunto pertenece a una conversación del usuario autenticado. Bucket privado exclusivo, sin políticas públicas ni lectura directa para usuarios. Acceso al original mediante ruta que comprueba propietario y prefijo de almacenamiento. PDF, PNG y JPEG, hasta 4 MiB por archivo, cuatro seleccionados por pregunta. Extracción limitada y marcada como parcial cuando corresponde. Fuentes C# del caso separadas de F# oficiales; nunca indexar los adjuntos en el corpus institucional.

## Observabilidad
Guardar proveedor/modelo efectivo, versión de instrucciones, tiempos de recuperación y respuesta, cantidades y advertencias en metadatos privados del turno. Coste no disponible explícito cuando el proveedor no lo entrega. No registrar texto del caso ni adjuntos en auditoría general. Mantener modelo y embeddings actuales.

## Verificación
Pruebas de aislamiento entre propietarios y sesiones, tipos/tamaños y páginas de archivos, filtros y restauración, compatibilidad de turnos previos. Compilación y comprobación de producción antes de cerrar ambas etapas.

Los originales se cifran con autenticación y se vinculan a la ruta del propietario. Mantener la clave de cifrado al migrar o rotar credenciales; por defecto deriva de la clave de servicio actual de Supabase, y puede fijarse con CASE_ATTACHMENT_ENCRYPTION_KEY antes de la primera carga. Los textos extraídos siguen protegidos por RLS de conversaciones.
