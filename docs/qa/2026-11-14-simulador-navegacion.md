# Navegación del simulador — verificación

## Resultado

- Tres pestañas principales: Balotarios OECE, Banco de preguntas e Historial.
- Practicar y Rendir examen dentro de Balotarios OECE.
- Conteos del catálogo remoto y desglose de los cinco balotarios. No mostrar cero revisadas si la consulta falla o todavía no termina.
- Banco con agregados autenticados: revisadas disponibles, pendientes y retiradas; sin publicar preguntas o claves en la API de resumen.
- Historial con intentos de ambas colecciones y aviso mientras carga el banco. Los borradores administrativos no inflan el acierto global.
- Corregida la composición de estilos de botones principales: no acumular `bg-panel` y `bg-brand`, que dejaba texto blanco sobre fondo blanco.

## Evidencia

- Preview compilado: `http://localhost:3101/simulador`.
- Datos consultados: balotarios 0 revisadas / 360 pendientes; banco 11 revisadas disponibles / 231 pendientes / 0 retiradas. Son valores observados, no constantes en la interfaz.
- 12 archivos de pruebas, 83 pruebas aprobadas: navegación antigua/nueva, cuentas exactas, permisos, errores sin ceros inventados, exámenes y guardia de Tailwind.
- TypeScript y compilación de producción correctos. Lint de archivos modificados sin errores.
- Navegador interno: selector de las cinco colecciones, revisión por balotario, preparación de examen, banco con datos reales, historial con ambos orígenes, navegación con Home y Atrás, conservación del formulario del banco al cambiar de sección.
- Móvil: viewport solicitado de 390 px, ancho útil y contenido de 380 px, sin desbordamiento horizontal; pestañas de 75 px de alto. Comprobado contraste en temas claro y oscuro; tema y viewport restaurados.
- Capturas locales en `tmp/navegacion-banco.png`, `tmp/navegacion-banco-oscuro.png` y `tmp/navegacion-movil.png` del checkout principal; no forman parte del código.

## Alcance

No cambia respuestas, revisiones normativas ni tablas de base de datos. No se crearon intentos nuevos para esta comprobación. Esta mejora de navegación está preparada en la rama `codex/simulador-navegacion`; todavía no se publicó en producción.
