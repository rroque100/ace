# Normativa profesional — alcance solicitado

Se implementa el diseño de tres etapas solicitado por el usuario en un recorrido centrado en lectura.

1. Fiabilidad: usar catálogo institucional completo con cursor; paginar listado y cargar indicadores solo de la página; filtros tipados y comparación de vigencia por estado. Versiones por `documentFamily` y fechas independientes. Errores auxiliares se publican como avisos; no se confunden con ausencia. Detalle institucional y UUID validado.
2. Lectura: buscador por título/número, Tipo/Régimen/Fecha principales; tarjetas compactas, ficha de procedencia y diagnóstico plegado; índice por secciones registradas sin inventar capítulos, avisos ante numeración repetida; página PDF y texto original predominantes. Móvil apila listado y lectura.
3. Asistencia: extracto y señales de palabras claramente automáticos; referencias detectadas/enlazadas, sin declarar revisión jurídica. Chat recibe ID exacto, artículo y selección cerrada mediante handoff autenticado. Comparación abre el módulo existente con versión origen fijada; no se inventan diferencias jurídicas.

Pruebas: estados vigente/no vigente/desconocido; familias y fechas; paginación mayor a límites anteriores y fallo parcial; selección y traslado al Chat; referencias automáticas. Ejecutar tipos, lint, build y comprobación de producción. Revisión humana de concordancias y vigencia permanece explícitamente pendiente.
