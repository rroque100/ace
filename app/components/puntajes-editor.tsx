"use client";

import { Plus, Trash2 } from "lucide-react";
import { leerPuntajes, type PuntajePostor } from "@/lib/puntajes-seleccion";
import { PROV_QUITAR, PROV_TABLA, PROV_VACIA } from "./tabla-editor-estilos";

/** Tabla del orden de prelación de la evaluación y calificación (B6, Arts. 78-82). */
export function PuntajesEditor({
  value,
  onChange,
  readOnly,
}: {
  value: unknown;
  onChange: (next: PuntajePostor[]) => void;
  readOnly?: boolean;
}) {
  const filas = leerPuntajes(value);

  function editar(i: number, campo: keyof PuntajePostor, v: string | boolean) {
    const next = filas.map((f, j) => {
      if (j !== i) return f;
      if (campo === "orden" || campo === "puntaje") return { ...f, [campo]: Number(v) || 0 };
      return { ...f, [campo]: v };
    });
    onChange(next);
  }

  function agregar() {
    onChange([...filas, { admitida: true, orden: filas.length + 1, puntaje: 0, razonSocial: "" }]);
  }

  function quitar(i: number) {
    onChange(filas.filter((_, j) => j !== i));
  }

  if (readOnly && filas.length === 0) {
    return <p className={PROV_VACIA}>Sin resultados de evaluación registrados.</p>;
  }

  return (
    <div>
      <table className={PROV_TABLA}>
        <thead>
          <tr>
            <th>Orden</th>
            <th>Razón social</th>
            <th>Puntaje</th>
            <th>Admitida</th>
            {!readOnly ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i}>
              <td>
                {readOnly ? (
                  f.orden
                ) : (
                  <input
                    type="number"
                    value={f.orden}
                    onChange={(e) => editar(i, "orden", e.target.value)}
                    min={1}
                  />
                )}
              </td>
              <td>
                {readOnly ? (
                  f.razonSocial
                ) : (
                  <input value={f.razonSocial} onChange={(e) => editar(i, "razonSocial", e.target.value)} />
                )}
              </td>
              <td>
                {readOnly ? (
                  f.puntaje
                ) : (
                  <input
                    type="number"
                    value={f.puntaje}
                    onChange={(e) => editar(i, "puntaje", e.target.value)}
                    min={0}
                    step="0.01"
                  />
                )}
              </td>
              <td>
                {readOnly ? (
                  f.admitida ? "Sí" : "No"
                ) : (
                  <select value={f.admitida ? "si" : "no"} onChange={(e) => editar(i, "admitida", e.target.value === "si")}>
                    <option value="si">Sí</option>
                    <option value="no">No</option>
                  </select>
                )}
              </td>
              {!readOnly ? (
                <td>
                  <button type="button" className={PROV_QUITAR} onClick={() => quitar(i)} aria-label="Quitar postor">
                    <Trash2 size={14} />
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly ? (
        <button type="button" onClick={agregar} className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline">
          <Plus size={14} /> Agregar postor
        </button>
      ) : null}
    </div>
  );
}
