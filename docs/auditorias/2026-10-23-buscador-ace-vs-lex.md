# Evaluación de búsqueda jurídica: ACE y LEX

Fecha: 23 de octubre de 2026. Revisión de interfaz autenticada y del código local de ACE. No se implementaron cambios en la aplicación durante esta evaluación.

## Conclusión

LEX mostró mayor cobertura de opiniones para la consulta probada. ACE ya dispone de una base funcional amplia y de conexión directa con Chat y Normativa. Su siguiente mejora debe concentrarse en cobertura, calidad de metadatos, relevancia y continuidad de navegación; después, simplificar la presentación. Una consulta no permite declarar superioridad general de precisión.

## Qué se comprobó

- LEX: búsqueda por palabras o frases, selección de tipos documentales, filtros de año y objeto al seleccionar opiniones, resultados agrupados por documento, pasajes resaltados, conteo y paginación. Un resultado abre ficha con fecha de publicación, descripción, PDF integrado con coincidencias resaltadas, descarga y guardado en carpeta.
- ACE: búsqueda de frase normalizada y por significado; clasificación Objeto/Materia/Tema; tipo, entidad, año, vigencia, artículo, proceso y filtros ampliados de régimen/tipos/años. Resultados por documento con coincidencias y páginas; orden y paginación; abrir original, guardar, consultar con IA, explorar en Normativa, comparar y copiar fuente. Historial privado y avisos de alcance ya existen.
- LEX: la frase «garantía de fiel cumplimiento», restringida a opiniones, mostró 123 resultados.
- ACE: la misma frase mostró 9 documentos entre todos los tipos y 1 al restringir a opiniones. Los valores no se comparan como porcentajes de precisión ni garantizan que las semánticas internas de ambos motores sean idénticas.
- ACE: una descripción sobre documentos de garantías para asegurar el cumplimiento de un contrato recuperó 12 documentos por significado. Se observó paginación 1 de 2; los primeros resultados incluyeron reglamentos relacionados. No se validó jurídicamente cada resultado.
- ACE: «Consultar con IA» trasladó correctamente el documento exacto y la pregunta al chat, sin enviar automáticamente la pregunta. Al volver con Atrás se perdió la búsqueda y regresó al modo literal vacío. El historial permite recuperarla manualmente, pero no sustituye una vuelta continua.
- Normativa: categorías Normas / Criterios y decisiones / Bases y orientación; algunos registros muestran «0 pag.» y etiquetas de régimen o vigencia pendientes.

## Problemas y prioridades

### P0: cobertura y confianza en el catálogo

1. Ampliar y mantener el corpus institucional mediante fuentes autorizadas/oficiales, con procedencia y fecha de última comprobación. Mostrar documentos indexados, pendientes y cobertura por categoría. El número de documentos descargados no equivale al número disponible para búsqueda.
2. Unificar entidades mediante identificadores y alias: hoy figuran variantes del nombre de Congreso y de OECE. Conservar unidad emisora cuando sea relevante.
3. Separar fecha de publicación original, fecha de actualización del texto, fecha de carga y periodo de aplicación confirmado. «Año registrado» no debe parecer automáticamente el año de publicación. No resolver discrepancias jurídicas por fecha de carga.
4. Relacionar versiones de una misma norma. Presentar una familia con versiones accesibles, sin borrar el texto histórico ni declarar automáticamente que la versión más reciente aplica a todos los casos.
5. Revisar clasificación. En el catálogo visible, las opciones mostraban 49 documentos sin objeto y 40 sin materia/tema. Los conteos por categorías son de catálogo, no facetas de los resultados. La clasificación sugerida actual deriva de título y tema; puede excluir normas generales pertinentes al filtrar.
6. Usar un estado común de vigencia y revisión en los tres módulos; diferenciar norma obligatoria, criterio interpretativo, decisión sobre un caso y guía operativa. Una etiqueta verde no acredita la aplicación al caso.

### P1: motor y continuidad de trabajo

1. Conservar consulta, filtros, modo, orden, página, documento abierto y posición al volver de Chat o Normativa. Guardar consultas sensibles como estado privado o identificador autorizado; evitar volcar hechos privados del caso en una URL pública compartible.
2. Mantener modos claros, pero añadir búsquedas de número documental y artículo: reconocer formatos alternativos de guiones, tildes, N.º y numeración. La búsqueda literal actual exige una frase continua normalizada; «Palabras o frase» puede generar otra expectativa.
3. Ofrecer «Frase exacta», «Todas estas palabras» y «Cualquiera de estas palabras» dentro de opciones avanzadas, sin introducir operadores obligatorios para usuarios no técnicos. No sustituir silenciosamente una frase exacta por una búsqueda semántica.
4. Combinar recuperación textual y semántica de forma explícita, con prioridad a identificadores exactos y mejor selección del pasaje de vista previa. Reordenar por pertinencia del pasaje, identidad documental y ámbito elegido; no solo por cantidad de fragmentos.
5. Un resultado por documento con versiones relacionadas. Deduplicar pasajes solapados y diferenciar fragmentos de ocurrencias de una frase. No presentar «13 fragmentos» como 13 menciones independientes.
6. En clasificación, mantener accesibles los documentos generales y sin clasificar; ofrecer ampliar la búsqueda si el filtro deja una lista vacía. Revisar etiquetas antes de tratarlas como una clasificación jurídica confirmada.
7. Autocompletar títulos, números, entidades normalizadas y temas. Ofrecer corrección de escritura como sugerencia confirmable. El estado vacío ya contiene recomendaciones; convertirlas en acciones: quitar este filtro, usar frase más corta, buscar por significado.

### P1: UX de búsqueda documental

- Campo principal visible con ejemplos breves. Dos opciones comprensibles: «Tengo palabras o un número» y «Quiero describir un tema».
- En escritorio, filtros laterales compactos: Tipo, Régimen y Fecha primero; Objeto/Materia/Tema y detalles bajo Más filtros. En móvil, panel de filtros con Aplicar y Restablecer. La sesión se revisó en escritorio; esta organización móvil es una propuesta, no una auditoría móvil completada.
- Mostrar filtros activos con su nombre y valor y botón para quitar cada uno. El aviso actual de «1 ajuste(s)» obliga a reabrir el formulario para descubrir qué se seleccionó.
- Encoger la cabecera después de buscar; reservar el espacio para comparar resultados. Evitar repetir encabezados e instrucciones de alcance alrededor del formulario.
- Tarjeta: título y número; entidad, publicación/versión y régimen; un único estado; 2–4 líneas de pasaje pertinente con resaltado; página; Ver documento / Consultar este documento / Guardar. El resto al desplegar.
- La vista previa actual permite hasta 1.100 caracteres y reproduce cabeceras de página y ruido de extracción. Limpiar solo el resumen de presentación, conservando disponible el texto original para comprobación.
- Panel de lectura con página, pasaje y navegación entre coincidencias; conservar búsqueda detrás. No es necesario llevar al usuario a otra herramienta para cada comprobación.
- Mantener la ayuda extensa en «Alcance de la búsqueda». Mensajes simples: «No se encontraron documentos con estos filtros» frente a «No se pudo completar la búsqueda».
- Sustituir «documento(s)», «fragmento(s)» y abreviaturas ambiguas por singular/plural correcto. En Normativa, sustituir «0 pag.» por «Páginas sin registrar» cuando falte el dato.
- Mantener teclado, foco visible, contraste, controles táctiles y anuncios de carga. No se hizo medición formal de contraste, lector de pantalla ni ensayo con usuarios en esta revisión.

## Función de cada sección

| Sección | Necesidad del usuario | Debe entregar |
|---|---|---|
| Búsqueda documental | Encontrar y reunir fuentes | Documentos y pasajes pertinentes, ubicación y acceso al original |
| Chat jurídico | Entender una duda o analizar un caso | Respuesta fundamentada, citas verificables y límites de aplicación |
| Normativa y criterios | Estudiar y comprobar una fuente | Ficha canónica, articulado, versiones, procedencia y documentos relacionados |

Flujo recomendado: buscar → revisar pasaje/PDF → seleccionar una o varias fuentes → preguntar al chat → volver al resultado o ficha conservando el contexto. La consulta del chat debe indicar si usa solo los documentos elegidos o permite ampliar el corpus; nunca ampliar sin avisar ni confundir un fragmento relacionado con una conclusión jurídica comprobada.

## Límites técnicos observados en el código

- `lib/document-search-server.ts` carga y filtra el catálogo completo por consulta. Hay un límite explícito de 2.000 documentos que produce error antes de ofrecer un total incompleto. Para crecer, trasladar facetas, conteos y paginación al índice/base y evitar reenviar todos los IDs por petición.
- La recuperación por significado solicita 20 fragmentos. El total mostrado corresponde a documentos recuperados, no a todos los documentos potencialmente pertinentes. Ordenar por fecha en ese conjunto no equivale a buscar los más recientes de todo el catálogo.
- El orden literal utiliza prioridad de título y cantidad de fragmentos coincidentes. Conviene añadir pertinencia del pasaje y búsqueda por identificador.
- La interfaz admite parámetros iniciales, pero las búsquedas realizadas no actualizan/restauran un estado de navegación completo. La pérdida al volver del chat se reprodujo en pantalla.
- La clasificación sugerida utiliza reglas sobre título y tema; no equivale a revisar el contenido íntegro.

## Etapas recomendadas y aceptación

1. **Continuidad y claridad:** conservar estado al volver, chips individuales, tarjetas compactas, nombres consistentes y distinguir falta de datos de un valor cero. Aceptación: volver desde Chat o Normativa conserva filtros, resultados y página; cada tarjeta se entiende sin desplegar detalles.
2. **Calidad del catálogo y del motor:** ampliar corpus, corregir metadatos, agrupar versiones, búsqueda por número/artículo y mejorar selección de pasajes. Aceptación: número exacto recupera su documento; versiones identificables; conteos y ausencia de clasificación no inducen a falsas conclusiones.
3. **Investigación asistida:** selección de varias fuentes, lectura integrada, consultas guardadas y alertas opcionales; escalado del índice y evaluación con especialistas. Aceptación: el chat recibe exactamente las fuentes seleccionadas y comunica cualquier ampliación.

Medir con preguntas, frases y números revisados: éxito del documento esperado en primeros 5/10 resultados, calidad del orden, documentos relevantes omitidos, calidad de páginas, filtros incorrectos, tiempo hasta abrir una fuente y latencia mediana/P95. La cobertura se debe medir por separado de la relevancia. No se asignó un porcentaje de precisión durante esta revisión.

## Evidencia y referencias

- ACE: https://ace-rormi.vercel.app/busqueda
- Chat: https://ace-rormi.vercel.app/chat
- Normativa: https://ace-rormi.vercel.app/normas
- LEX: https://lexcontrataciones.com/app/buscar
- Ejemplo de ficha LEX: https://lexcontrataciones.com/app/documento/37950
- Capturas guardadas: `C:/Users/USER/.codex/visualizations/2026/10/21/01a15fc4-5111-7a21-b166-65f394aa2be9/ace-busqueda-evaluacion.png` y `lex-busqueda-evaluacion.png` en la misma carpeta.

No se inspeccionó el código interno de LEX, no se hizo extracción masiva ni se validó en esta auditoría una regla normativa concreta. Las recomendaciones describen funcionamiento del buscador y UX, no asesoramiento sobre un caso contractual.
