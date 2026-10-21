"use client";

import { Plus, Trash2 } from "lucide-react";
import { leerPostores, type Postor } from "@/lib/postores-seleccion";
import { PROV_QUITAR, PROV_TABLA, PROV_VACIA } from "./tabla-editor-estilos";

/** Tabla de participantes admitidos/no admitidos del registro (B2, Arts. 67-70). */
export function PostoresEditor({
  value,
  onChange,
  readOnly,
}: {
  value: unknown;
  onChange: (next: Postor[]) => void;
  readOnly?: boolean;
}) {
  const filas = leerPostores(value);

  function editar(i: number, campo: keyof Postor, v: string | boolean) {
    const next = filas.map((f, j) => (j === i ? { ...f, [campo]: v } : f));
    onChange(next);
  }

  function agregar() {
    onChange([...filas, { admitido: true, razonSocial: "", ruc: "" }]);
  }

  function quitar(i: number) {
    onChange(filas.filter((_, j) => j !== i));
  }

  if (readOnly && filas.length === 0) {
    return <p className={PROV_VACIA}>Sin postores registrados.</p>;
  }

  return (
    <div>
      <table className={PROV_TABLA}>
        <thead>
          <tr>
            <th>RUC</th>
            <th>Razón social</th>
            <th>Admitido</th>
            <th>Motivo (si no admitido)</th>
            {!readOnly ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i}>
              <td>
                {readOnly ? (
                  f.ruc
                ) : (
                  <input value={f.ruc} onChange={(e) => editar(i, "ruc", e.target.value)} maxLength={11} />
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
                  f.admitido ? "Sí" : "No"
                ) : (
                  <select value={f.admitido ? "si" : "no"} onChange={(e) => editar(i, "admitido", e.target.value === "si")}>
                    <option value="si">Sí</option>
                    <option value="no">No</option>
                  </select>
                )}
              </td>
              <td>
                {readOnly ? (
                  f.motivoNoAdmision ?? "—"
                ) : (
                  <input
                    value={f.motivoNoAdmision ?? ""}
                    onChange={(e) => editar(i, "motivoNoAdmision", e.target.value)}
                    disabled={f.admitido}
                    placeholder={f.admitido ? "No aplica" : "Motivo de no admisión"}
                  />
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
