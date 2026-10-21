# Corrección del flujo PDF de archivo

Alcance autorizado: los seis hallazgos de la revisión de expedientes-archivo.

1. Importar explícitamente el worker de PDF.js y verificar el trace de /extract en un build de producción.
2. Separar errores del documento de errores del servidor; no atribuir dependencias ausentes a un PDF dañado.
3. Subir PDF grandes directamente a Storage mediante URL firmada, con referencia limitada al usuario, validación de tamaño y limpieza temporal.
4. Propagar avisos de IA fallida y lectura parcial; excluir metadatos de diagnóstico del conteo de campos.
5. Preparar vectores nuevos con identificadores únicos y publicar chunks + metadata mediante transacción SQL. Conservar el índice anterior ante fallos y registrar fallos de descarga.
6. Probar errores, controles de acceso de referencias, publicación transaccional y empaquetado. No usar datos reales ni invocar IA pagada en pruebas.

Despliegue: aplicar la función SQL antes del código; no volver al borrado no atómico si falta la función. Validar producción autenticada cuando haya sesión disponible.
