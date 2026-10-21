/**
 * Alto de un textarea en filas, proporcional a lo que contiene.
 *
 * Los formularios de la necesidad tenían todos los textarea con un alto fijo
 * (`rows={2}` en la ficha, `rows={3}` en el editor de requisitos). Con eso no se
 * lee ni un párrafo: desde que la sección 3.4 puede recibir el EETT/TDR completo
 * y el traslado de la propuesta IA rellena las condiciones y los requisitos del
 * Art. 72.3, revisar lo que se va a firmar obligaba a desplazarse dentro de una
 * caja de dos o tres líneas.
 *
 * Vive en `lib` y no junto a un componente porque lo usan dos que se importan
 * entre sí: la ficha (`necesidad-detail`) importa el editor de requisitos, así
 * que el editor no puede importar de la ficha sin cerrar un ciclo.
 */
export function filasTextarea(valor: string, wide?: boolean): number {
  const texto = valor ?? "";
  const min = wide ? 4 : 2;
  // Tope alto: con lo que redacta la IA —una penalidad por mora son diez líneas
  // con fórmula y viñetas— el usuario tiene que poder LEER lo que va a firmar sin
  // desplazarse dentro de una caja. A partir de aquí manda el scroll interno.
  const max = wide ? 28 : 20;
  if (!texto) return min;

  // Se cuenta línea a línea cuánto envuelve cada una y se SUMA. Antes se tomaba
  // el máximo entre «número de saltos» y «largo total / ancho», y eso se queda
  // corto en cuanto el texto mezcla párrafos largos con líneas sueltas: un texto
  // de diez líneas donde tres envuelven pedía diez filas y necesitaba catorce.
  const porLinea = wide ? 105 : 52;
  const filas = texto
    .split(/\r?\n/)
    .reduce((total, linea) => total + Math.max(1, Math.ceil(linea.length / porLinea)), 0);

  return Math.min(max, Math.max(min, filas + 1));
}
