# Cinco simulaciones independientes del Banco

Publicación verificada el 16/11/2026.

- Banco: **381 preguntas preparadas y elegibles**; 115 altas de casuística compleja avanzada.
- Se conservaron exactamente las 266 preguntas anteriores. La transacción de publicación también comprobó que no cambió ningún intento existente.
- Biblioteca: cinco conjuntos de 72 preguntas, 360 identificadores diferentes, sin preguntas compartidas entre los cinco conjuntos. Las otras 21 continúan en el Banco.
- Cada conjunto respeta las treinta cuotas curriculares: 25 de actuaciones preparatorias, 22 de selección y 25 de ejecución contractual.
- Dificultades del Banco: 81 básicas, 155 intermedias y 145 avanzadas.
- Acceso: **Simulador → Banco de preguntas → Simulacro OECE → Biblioteca de simulaciones · cinco balotarios**.
- La pestaña separada «Balotarios OECE» conserva su colección anterior. El simulacro aleatorio completo también continúa disponible.

## Revisión y alcance

Las 115 altas cuentan con una revisión adicional asistida por IA, correcciones documentadas, clave única, fundamento por alternativa y pasajes literales del corpus institucional. Son casos hipotéticos, no expedientes reales documentados ni preguntas oficiales. La dificultad es editorial; aún no hay calibración psicométrica con muestras de usuarios. El corte documental es 29/10/2026; la revisión no garantiza cambios normativos posteriores ni aprobación del examen oficial.

Las observaciones iniciales y su resolución quedan en los archivos de revisión. Los hashes identifican la versión del lote revisada. El archivo final equilibra las posiciones de respuesta conservando el texto de cada opción, su clave y sus razones.

## Comprobaciones

- Contrato editorial de las 115 altas, fuentes literales y metadatos, singularidad de identificadores y enunciados.
- Tres pruebas automatizadas: contrato editorial; cobertura quíntuple; conservación de textos, claves y fundamentos al equilibrar opciones.
- Simulación de publicación e inicio de los cinco conjuntos por una cuenta no administradora, en transacción revertida.
- Publicación por las funciones editoriales existentes; comprobación posterior independiente de 381 registros y las 360 asignaciones.
- Ninguna prueba canceló ni reemplazó el intento activo del administrador.
- Optimización de consulta de fuentes: 552 comparaciones equivalentes con la regla anterior, incluidos identificadores inválidos y ambos modos de revisión. Sin ampliar permisos.

## Cuotas

| Apartado | Disponibles | Por simulación | Meta para cinco |
|---|---:|---:|---:|
| 1.1 | 30 | 6 | 30 |
| 1.2 | 65 | 13 | 65 |
| 1.3 | 10 | 1 | 5 |
| 1.4 | 5 | 1 | 5 |
| 1.5 | 5 | 1 | 5 |
| 1.6 | 5 | 1 | 5 |
| 1.7 | 5 | 1 | 5 |
| 1.8 | 5 | 1 | 5 |
| 2.1 | 25 | 5 | 25 |
| 2.10 | 6 | 1 | 5 |
| 2.2 | 40 | 8 | 40 |
| 2.3 | 5 | 1 | 5 |
| 2.4 | 5 | 1 | 5 |
| 2.5 | 5 | 1 | 5 |
| 2.6 | 10 | 2 | 10 |
| 2.7 | 6 | 1 | 5 |
| 2.8 | 10 | 1 | 5 |
| 2.9 | 5 | 1 | 5 |
| 3.1 | 6 | 1 | 5 |
| 3.10 | 25 | 5 | 25 |
| 3.11 | 5 | 1 | 5 |
| 3.12 | 5 | 1 | 5 |
| 3.2 | 30 | 6 | 30 |
| 3.3 | 15 | 3 | 15 |
| 3.4 | 8 | 1 | 5 |
| 3.5 | 17 | 3 | 15 |
| 3.6 | 5 | 1 | 5 |
| 3.7 | 5 | 1 | 5 |
| 3.8 | 5 | 1 | 5 |
| 3.9 | 8 | 1 | 5 |

## Archivos

- `casos-115.md`: enunciados, alternativas, claves, razones y procedencia.
- `preguntas-115.json` y `matriz-115.csv`: altas finales y matriz editorial.
- `lote-*.json` y `revision-lote-*.json`: lotes revisados y veredictos.
- `estado-final.json`: conteos y manifiesto de la edición, sin datos de usuarios.
- `publicar-y-ensamblar.sql`: operación aplicada una sola vez; sus precondiciones rechazan una reaplicación.

## Cierre de integración

- Cuatro pruebas permanentes de contenido y manifiesto aprobadas, además de las tres comprobaciones de preparación.
- Comprobación de tipos y compilación de producción aprobadas.
- Verificación visual en producción: 381 revisadas, cero pendientes, cinco balotarios con 72/72 disponibles. Los botones de la cuenta administradora siguen bloqueados por su intento previo en curso.
- Respaldo de contenido, revisiones y validaciones preparado para su integración desde la rama codex/cinco-simulaciones-casos. Los datos ya están publicados; la operación SQL de alta no debe repetirse durante el despliegue.
