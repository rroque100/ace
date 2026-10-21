// Resuelve los VALORES reales de un expediente para su plantilla de bases
// (lib/bases-plantillas.ts), cruzando cada CampoBases contra los hitos A1-A9
// ya registrados o contra el dato de la entidad contratante. No inventa nada:
// un campo sin dato queda `resuelto: false` con `valor: ""`, igual que la
// plantilla oficial deja `[...]` sin completar (lib/bases-docx.ts, Task 4, lo
// imprime así).

import { plantillaDeProceso } from "./bases-plantillas";
import type { HitosMap } from "./procurement-fases";

export type FilaFactorEvaluacion = { factor: string; sustento: string };

export type ValorBases = {
  ruta: string;
  label: string;
  valor: string;
  resuelto: boolean;
  /** Solo presente cuando el campoHito es un array real (hoy: factores_items).
   *  lib/bases-docx.ts lo usa para pintar una tabla; `valor` sigue trayendo un
   *  resumen en texto plano para cualquier otro consumidor. */
  filas?: FilaFactorEvaluacion[];
};

function txt(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}

// Filas de un campoHito que es un array real (hoy, solo factores_items: A4 lo
// guarda como FactorEvaluacion[] = {nombre?, sustento?}[], ver
// lib/estrategia-formato.ts — NO como texto). `txt()` lo trataba como "" y
// "Factores de evaluación" nunca se resolvía en ningún .docx generado hasta
// este fix. No se acopla al nombre del campo: cualquier array de objetos con
// `nombre`/`sustento` se lee igual.
function filasDeArray(v: unknown): FilaFactorEvaluacion[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.map((item) => {
    const o = (item ?? {}) as Record<string, unknown>;
    return { factor: txt(o.nombre), sustento: txt(o.sustento) };
  });
}

export function resolverBases(
  proceso: string,
  hitos: HitosMap,
  entidad: { nombre: string; ruc: string },
  // Año fiscal de la necesidad de origen (necesidades.anio_fiscal). `null`
  // cuando el expediente no tiene necesidad enlazada, o esta no lo tiene
  // registrado — el campo queda sin resolver, igual que cualquier otro dato
  // ausente. Parámetro opcional (no todos los llamadores lo necesitan, p. ej.
  // los tests que no ejercitan cap1.anioFiscal).
  anioFiscal: number | null = null,
): ValorBases[] | null {
  const plantilla = plantillaDeProceso(proceso);
  if (!plantilla) return null;

  return plantilla.seccionEspecifica.map((campo): ValorBases => {
    if (campo.origen === "libre") {
      return { label: campo.label, resuelto: false, ruta: campo.ruta, valor: "" };
    }
    if (campo.origen === "necesidad") {
      // Hoy, solo cap1.anioFiscal. No vive en ningún hito ni en entity_settings,
      // sino en la necesidad de origen — el llamador la trae y la pasa aquí ya
      // resuelta (ver la ruta de exportación).
      const valor = anioFiscal !== null ? String(anioFiscal) : "";
      return { label: campo.label, resuelto: valor !== "", ruta: campo.ruta, valor };
    }
    if (campo.origen === "entidad") {
      // Nombre/RUC de la entidad contratante: no viven en ningún hito, sino en
      // Configuración → Municipalidad (entity_settings). El llamador los trae y
      // los pasa aquí ya resueltos (ver la ruta de exportación, Task 4).
      const valor = campo.ruta === "cap1.entidad.ruc" ? entidad.ruc.trim() : entidad.nombre.trim();
      return { label: campo.label, resuelto: valor !== "", ruta: campo.ruta, valor };
    }
    // origen === "literal"
    const data = (hitos[campo.hito!]?.data ?? {}) as Record<string, unknown>;
    const crudo = data[campo.campoHito!];
    const filas = filasDeArray(crudo);
    if (filas) {
      const valor = filas.map((f) => `${f.factor}: ${f.sustento}`).join("\n");
      // Array vacío: igual que cualquier otro campo sin dato, sin `filas` (para
      // que un consumidor no tenga que distinguir "array vacío" de "ausente").
      return filas.length > 0
        ? { filas, label: campo.label, resuelto: true, ruta: campo.ruta, valor }
        : { label: campo.label, resuelto: false, ruta: campo.ruta, valor: "" };
    }
    const valor = txt(crudo);
    return { label: campo.label, resuelto: valor !== "", ruta: campo.ruta, valor };
  });
}
