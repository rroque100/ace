# Actualización documental — verificación del 29 de octubre de 2026

Módulo administrativo: https://ace-rormi.vercel.app/actualizacion-documental

## Implementado

- Cinco fuentes oficiales activas: opiniones, acuerdos de Sala Plena, leyes, directivas y resoluciones TCP-S.
- Configuración por tipos y regímenes; cuota diaria máxima de 100 reservas de descarga, fecha de Lima.
- Detección incremental y recorrido histórico con continuación visible, duplicados por SHA-256 y conservación de originales/versiones.
- Cola persistente por descarga, clasificación e indexación; permisos administrativos, leases, reintentos limitados y registro de incidencias.
- Redirecciones entre fichas oficiales de gob.pe acotadas y validadas; destinos externos rechazados.
- Circuito por créditos agotados: el original se conserva y la IA se reanuda desde administración.
- Programación registrada en Vercel: 11:00 UTC, desde las 06:00 America/Lima. El disparo efectivo depende del proveedor; cada ciclo procesa un lote acotado.

## Comprobaciones

- 32 pruebas de las cinco suites relevantes correctas; TypeScript sin errores.
- Compilación de producción correcta y pantalla administrativa verificada con sesión real.
- Funciones SQL de permisos, cuota, arrendamientos y circuito comprobadas con transacción revertida.
- Descarga real: cuatro originales nuevos almacenados y verificados; continúan pendientes de clasificación/indexación.
- El lote previo de 100 resoluciones permanece almacenado, pendiente de IA.
- Ejecución manual desde producción observada: inicio y final registrados. Acceso anónimo al disparador rechazado con HTTP 401.
- Horario diario registrado, todavía sin una ejecución diaria automática observada después de esta publicación.

## Pendiente externo

Google informó HTTP 402 por créditos agotados. Restablecer créditos en la cuenta del proveedor y pulsar «Reintentar tras restablecer IA». La descarga no certifica el régimen ni la vigencia. Los documentos nuevos solo se habilitan para consultas cuando terminan las comprobaciones e indexación correspondientes.

La biblioteca oficial continúa recorriéndose por lotes: los candidatos detectados no equivalen a documentos ya disponibles en Chat.
