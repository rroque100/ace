# Selector de dificultad del simulador

Alcance aprobado: Todas, Básica, Intermedia y Avanzada para prácticas y simulacros personalizados. Los perfiles OECE, repaso y balotarios conservan sus reglas.

1. Añadir filtro validado, cómputos por dificultad y un selector accesible integrado con los estilos Tailwind existentes. Evitar temas duplicados al agrupar por nivel.
2. Filtrar en servidor y base de datos por régimen, competencia, tema y dificultad conjuntamente; rechazar cantidades imposibles y conservar el nivel solicitado en el intento.
3. Proteger identidades y borradores administrativos; no modificar preguntas ni recalificar sus niveles editoriales.
4. Probar política, API y selección real en una transacción revertida; ejecutar tipos, lint y compilación. Verificar selector en preview local.

Diseño: mismo control nativo y foco visible que los demás filtros, cantidad junto a cada opción, niveles sin preguntas deshabilitados y mensaje útil para selecciones vacías. Mantener todas las dificultades como valor inicial.

## Validación completada

- 41 pruebas en seis suites, TypeScript, ESLint y compilación de producción correctos.
- Selección SQL comprobada en transacción revertida: intersección de filtros, duración, nivel guardado, disponibilidad, bloqueo de intento activo, valores inválidos, borradores y permisos.
- Migración aditiva aplicada al proyecto ACE; las preguntas y los intentos de prueba no se modificaron de forma persistente.
- Preview de producción en localhost:3101: 242 disponibles, 81 básicas, 155 intermedias y 6 avanzadas. Verificados cambio de nivel, ajuste de cantidad, competencia y simulacro personalizado. El intento previo del usuario sigue intacto.
- Cambios de aplicación pendientes de commit y despliegue; rama codex/dificultad-simulador.
