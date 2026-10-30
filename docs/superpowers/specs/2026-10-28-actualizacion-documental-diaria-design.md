# Actualización documental diaria de ACE

Estado: propuesta para revisión del usuario. No implementada ni programada todavía.

## Objetivo y base existente

Ampliar el control manual de fuentes, candidatos e incorporaciones de Normativa/Novedades con una pantalla administrativa «Actualización documental». Reutilizar Supabase Storage, el catálogo, los estados de revisión, Pinecone y los conectores oficiales. La actualización ocurre en el servidor y no depende de mantener un navegador o computadora abiertos.

## Alternativas

1. **Automática supervisada (recomendada):** detección y descarga programadas, clasificación con evidencia, indexación cuando los servicios funcionan; los casos dudosos requieren revisión. Mantiene utilidad diaria sin convertir la IA en una certificación jurídica.
2. **Solo detección diaria:** crea candidatos para aprobación manual de toda descarga. Menor autonomía y más trabajo para administración.
3. **Incorporación indiscriminada:** descarga e indexa cualquier coincidencia del buscador. Se descarta por duplicados, regímenes mezclados, archivos incompletos y consumo sin control.

## Interfaz y reglas

- Acceso administrativo «Actualización documental», con Fuentes, Cola, Ejecuciones e Incidencias. En Normativa/Novedades conservar un acceso directo.
- Elegir fuente oficial, tipos de documento y regímenes 32069/30225 por separado; incluir ambos en casos mixtos respaldados. Resoluciones permiten el patrón TCP-S y sus salas, no una consulta literal que omita TCP-S1, TCP-S2, etc.
- Primera versión: revisión diaria a partir de las 06:00 de America/Lima; la pantalla informa el horario efectivo y la próxima revisión. La precisión depende del plan de Vercel. Horario configurable en futuras versiones; no prometer minuto exacto.
- Límite global inicial: hasta 100 PDF nuevos por jornada; configurable por administración, con pausa y ejecución manual. El límite no implica que se completen 100 indexaciones en una sola llamada.
- Mostrar cantidades separadas: detectados, duplicados, originales almacenados, pendientes de clasificación, pendientes de indexación, disponibles y con error. Descargar no equivale a habilitar Chat.
- Archivos PDF aportados manualmente conservan permisos y procedencia. Un archivo privado nunca pasa al corpus institucional por esta automatización. La primera versión automatiza únicamente fuentes oficiales con adaptador autorizado.

## Detección, descarga e incorporación

1. Conector por fuente: catálogo legal OECE y catálogo oficial de opiniones, con parámetros y paginación adecuados a cada uno.
2. Guardar cursor por fuente, última revisión completa y ventana de solapamiento. Revisar novedades y continuar una recuperación histórica como tareas distintas. Si se alcanza un límite o cambia el HTML, registrar revisión parcial; no avanzar el marcador de revisión completa.
3. Superar ventanas máximas del buscador mediante intervalos de fecha y deduplicación; no declarar completo un inventario truncado.
4. Crear tareas persistentes con exclusión de concurrencia, identificador idempotente y reintentos acotados. Un mismo documento no se procesa dos veces por ejecuciones superpuestas.
5. Verificar publicación, enlaces, anexos, formato, tamaño y SHA-256. Guardar el original en Storage; un archivo nuevo no sobrescribe el histórico. Comprobar también una cantidad acotada de enlaces ya aceptados para detectar reemplazos bajo la misma URL, conservando ambas huellas y el historial.
6. Clasificar el régimen a partir del contenido sustantivo y citas literales por página. El nombre TCP, fecha o cita de competencia no bastan. Los casos mixtos conservan ambos regímenes; los dudosos permanecen pendientes.
7. Extraer e indexar con permisos institucionales; verificar integridad, extracción completa y disponibilidad vectorial. Habilitar las consultas solo tras superar esas comprobaciones. La vigencia jurídica sigue siendo una revisión independiente.

## Programación y operación

- Cron diario protegido en Vercel, sin cambiar los otros dos cron existentes. El disparador detecta novedades y encola trabajo; nunca intenta procesar todo un lote dentro de una solicitud.
- Procesamiento por tareas pequeñas con presupuesto de tiempo, arrendamiento temporal y recuperación al siguiente ciclo. La pantalla permite continuar la cola sin dejar el navegador abierto; la frecuencia real de ejecución y los tiempos máximos se validan contra el plan antes de activar producción. Si el plan solo admite una ejecución diaria, el saldo pendiente continúa el día siguiente o por ejecución manual, sin prometer completar todo el lote esa mañana.
- Mantener separados los trabajos institucionales y los expedientes privados. No reutilizar indiscriminadamente el drenador genérico para publicar documentos pendientes de revisión.
- HTTP 402 o fallo de cuotas: conservar el PDF, bloquear las etapas afectadas y evitar reintentos repetitivos. Mostrar la causa y permitir reanudar después de restablecer el servicio. No recargar saldo, cambiar proveedores ni comprar planes automáticamente.
- Sin correos ni mensajes externos. Resumen dentro de ACE, con fecha, alcance revisado, pendientes y errores; no generar avisos repetidos cuando nada cambió.

## Persistencia y seguridad

Migraciones aditivas para configuración de programación, tareas/arrendamientos, intentos y huellas de revisión. RLS administrativa, rutas manuales autenticadas y cron con secreto de servidor; ninguna clave se entrega al navegador. Reutilizar los controles de HTTPS, DNS público, hosts permitidos, límites de bytes y redirecciones. Mantener trazabilidad de cada decisión y evidencia de régimen. No exponer contenidos privados ni publicar documentos por omisión de permisos.

## Pruebas y criterios de aceptación

- Primera ejecución incorpora una publicación válida; repetirla no duplica archivo, catálogo ni vectores.
- Una publicación posterior se detecta con el navegador cerrado; un documento antiguo no bloquea novedades nuevas.
- Se respeta el tope de 100 descargas y se conserva la cola pendiente tras interrupción o agotamiento de tiempo.
- Dos ejecuciones simultáneas no toman el mismo trabajo; los arrendamientos caducados pueden recuperarse.
- Fuente caída, HTML cambiado, PDF corrupto, anexos pendientes, página faltante y OCR parcial se muestran como incidencias; no como ausencia de novedades ni como fuentes completas del Chat.
- HTTP 402 deja el PDF almacenado y la indexación pendiente, sin bucle de consumo. Al restablecer el servicio, se reanuda sin descargar de nuevo.
- Los casos de régimen mixto y fuente sin régimen se distinguen en filtros; no se certifica vigencia automáticamente.
- Validar acceso administrativo, cron, propietario privado y rechazo anónimo; comprobar pantalla adaptable y recorridos Búsqueda/Chat/Normativa.
- Publicar solo después de migración, pruebas y verificación del cron y cola en producción. La primera ejecución manual verificada no se presenta como prueba de que ya ocurrió una ejecución diaria programada.

## Situación del lote TCP-S al preparar el diseño

El usuario eligió lotes de 100 con verificación. La indexación está bloqueada por HTTP 402 de Google (créditos prepagados agotados). Continúa por separado el almacenamiento verificado de originales como candidatos, sin habilitarlos para Chat ni afirmar clasificación definitiva. Esta propuesta no significa que la programación diaria ya esté activa.
