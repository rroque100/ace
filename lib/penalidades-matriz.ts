// Puente entre la matriz de «Gestión de riesgos» (Art. 44.3) y el cuadro de
// «Otras penalidades» (apartado f). Puro y sin `docx`: corre en el editor, que
// es un componente CLIENTE.
//
// La matriz la redacta el copiloto como tabla Markdown y su última columna
// —«Relación con Penalidades»— dice, por cada riesgo, si le corresponde multa,
// penalidad por mora, OTRAS penalidades o si no aplica. Solo las «otras
// penalidades» tienen sitio en el apartado f); la mora tiene su propio cuadro y
// «multa / no aplica» no son penalidad de este apartado.

import { segmentarParrafoMd } from "./markdown-tabla";
import type { OtraPenalidad } from "./otras-penalidades";

/** Minúsculas y sin tildes, para comparar cabeceras y celdas sin sorpresas. */
function normaliza(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Filas de la matriz de riesgos cuya penalidad es «otras penalidades», listas
 * para el apartado f).
 *
 * El mapeo es deliberadamente parcial: `supuesto ← «Identificación del Riesgo»`,
 * y **cálculo y verificación vacíos** —la matriz no los trae y los completa a
 * mano quien redacta—. Es materia prima de un traslado que luego se edita, no un
 * apartado terminado.
 *
 * Localiza las columnas por cabecera («identificación…» y «…penalidad…»); si la
 * cabecera no coincide, cae a la convención del modelo: 2.ª columna es el riesgo
 * y la última, la relación con penalidades. Descarta las filas sin supuesto.
 */
export function penalidadesDesdeMatriz(matriz: string | null | undefined): OtraPenalidad[] {
  if (!matriz) return [];

  const tabla = segmentarParrafoMd(matriz).find((s) => s.tipo === "tabla");
  // `< 2`: hace falta cabecera y al menos una fila de datos.
  if (!tabla || tabla.tipo !== "tabla" || tabla.filas.length < 2) return [];

  const cabecera = tabla.filas[0].map(normaliza);
  const idxRiesgo = cabecera.findIndex((c) => c.includes("identificacion"));
  const idxPenal = cabecera.findIndex((c) => c.includes("penalidad"));
  // «Categoría del Riesgo» también contiene «riesgo», por eso el riesgo se busca
  // por «identificacion» y no por «riesgo». Sin cabecera clara, la convención.
  const colRiesgo = idxRiesgo >= 0 ? idxRiesgo : 1;
  const colPenal = idxPenal >= 0 ? idxPenal : cabecera.length - 1;

  const salida: OtraPenalidad[] = [];
  for (const fila of tabla.filas.slice(1)) {
    // «No aplica penalidad…» o «penalidad por mora» contienen «penalidad» pero
    // no «otras penalidad»: la coincidencia por «otras penalidad» ya las excluye.
    if (!normaliza(fila[colPenal] ?? "").includes("otras penalidad")) continue;
    const supuesto = (fila[colRiesgo] ?? "").trim();
    if (!supuesto) continue;
    salida.push({ supuesto, calculo: "", verificacion: "" });
  }
  return salida;
}
