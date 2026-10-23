# Chat jurídico profesional: diseño

Fecha: 2026-10-23
Estado: aprobado por el usuario e implementado en el proyecto local; revisión jurídica humana y publicación pendientes.

## Objetivo y alcance autorizado
Aplicar las seis mejoras solicitadas al chat existente, conservando historial, adjuntos privados, búsqueda y proveedores configurados. No cambiar automáticamente de modelo, inventar reglas de transición ni afirmar revisión jurídica humana inexistente.

## Enfoques considerados
1. Solo modificar instrucciones: rápido, pero no impide citas falsas ni confianza excesiva.
2. Añadir verificación de evidencia y controles de publicación al flujo actual (recomendado): permite corregir confianza, citas y formato sin reconstruir el chat.
3. Reconstruir el sistema con múltiples agentes: mayor coste, complejidad y latencia; no necesario para este alcance.

## Diseño funcional
### Régimen y contexto
Usar régimen, fechas y hechos ya disponibles; añadir objeto contractual opcional. Separar lo declarado por el usuario, lo documentado y lo no comprobado. No asignar régimen por año ni inventar fechas de transición. Si falta contexto, ofrecer la regla del documento identificado como respuesta condicionada y pedir los datos que permiten aplicarla. Detectar fuentes de regímenes distintos y separar su exposición; si no hay evidencia suficiente, declarar aplicabilidad pendiente.

### Disposiciones y citas
Presentar documento, artículo/numeral, versión registrada y página por fuente citada, sin inventar valores ausentes. Diferenciar el artículo propio del documento de una referencia a otra norma incluida en su texto. No presentar metadatos como verificación independiente del contenido. Mantener acceso al PDF.

### Verificación y publicación
Antes de publicar una conclusión final, comprobar marcadores existentes, ubicación y evidencia textual. Añadir una evaluación semántica independiente por afirmación jurídica, limitada a sus fragmentos citados, que devuelva afirmación, fuente, pasaje literal y resultado: respaldada, contradicha o insuficiente. Validar que el pasaje realmente exista; la evaluación automática no equivale a dictamen humano. Si falla el evaluador, faltan citas o hay contradicción, no publicar la afirmación como confirmada: entregar respuesta limitada con fragmentos disponibles y límites explícitos. Durante la generación mostrar progreso, no conclusiones aún sin revisar. Aplicar idéntico control al chat normal, transmisión e historial guardado.

### Respuesta y confianza
Respuesta directa primero; luego fundamento, condiciones/excepciones pertinentes y datos faltantes. No añadir excepciones de memoria. Sustituir la confianza jurídica alta por dos estados: respaldo documental (comprobación automática completada / parcial / no comprobado) y aplicación al caso (pendiente o no confirmada automáticamente). Una coincidencia semántica, página válida o contexto completo no confirma por sí sola aplicabilidad jurídica. Recalcular y persistir estados después de la verificación, nunca antes.

### Evaluación profesional
Crear un banco versionado de casos con régimen, fechas, objeto, referencias esperadas, excepciones y respuesta de referencia. Incluir pruebas adversariales de cifra correcta con fuente equivocada, regímenes mezclados, ausencia de fuentes, versiones y fallo del verificador. Separar pruebas automáticas de revisión humana: cada caso tendrá estado pendiente de especialista, autor de revisión y fecha; no fabricar porcentajes de precisión ni presentar casos pendientes como validados. Preparar guía y formato para que un especialista aporte referencias y firme su revisión. No hay especialista humano disponible en esta sesión.

## Arquitectura y límites
Mantener módulos pequeños para contexto, contratos de evidencia, auditoría semántica y evaluación. Preservar RLS y aislamiento de adjuntos: no incorporar datos privados a Pinecone ni a informes de evaluación. Mantener compatibilidad con conversaciones antiguas mostrándolas como no reevaluadas. El proveedor actual recibe solo la pregunta/contexto y fuentes necesarias según la integración existente; la segunda evaluación añade latencia y consumo. Limitar tamaño y tiempo; fallo cerrado para afirmaciones no verificadas, sin reintentos ilimitados.

## Verificación de aceptación
Pruebas unitarias de contratos, citas y estados; integración del flujo normal/transmitido y persistencia; pruebas de errores del proveedor y de acceso privado existente; tipos, lint y compilación apropiados. Toda regla normativa concreta introducida en casos de referencia deberá verificarse en el corpus mediante la habilidad de verificación legal. La publicación en producción se informará por separado y solo se afirmará tras comprobar el despliegue.

## Secuencia
1. Contexto y citas trazables.
2. Auditoría semántica y control de publicación.
3. Interfaz de estados y estructura de respuesta.
4. Banco de evaluación, pruebas y reporte de límites.

## Revisión interna
Alcance alineado a los seis puntos; sin umbrales legales inventados ni promesas de precisión. La confirmación humana de calidad queda explícitamente pendiente. No modificar cambios locales ajenos.
