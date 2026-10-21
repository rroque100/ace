"use client";

import { Plus, Trash2 } from "lucide-react";
import { cuantiaDeProveedores, leerProveedores, type ProveedorConsultado } from "@/lib/anexo1-interaccion";
import { PROV_QUITAR, PROV_TABLA, PROV_VACIA } from "./tabla-editor-estilos";

/**
 * Tabla de proveedores consultados del Anexo N° 1 (Art. 49).
 *
 * Las propuestas recibidas son lo que determina la cuantía de la contratación
 * (Art. 47.1), así que se capturan estructuradas y no como texto libre: con
 * texto libre no se puede calcular nada ni volcar cada fila al sustento.
 */
export function ProveedoresConsultadosEditor({
  value,
  onChange,
  readOnly,
  criterio,
  documentoSugerido,
}: {
  value: unknown;
  onChange: (next: ProveedorConsultado[]) => void;
  readOnly?: boolean;
  criterio: string;
  // Documento de origen del requerimiento, leído del Resumen de la Necesidad
  // de ESTE expediente ("pedido de compra SIGA N° 001838"). Es el documento
  // real de la entidad con el que se consultó; el código REQ-… es interno.
  documentoSugerido?: string;
}) {
  const filas = leerProveedores(value);
  const cuantia = cuantiaDeProveedores(filas, criterio);

  function editar(i: number, campo: keyof ProveedorConsultado, v: string) {
    const next = filas.map((f, j) =>
      j === i ? { ...f, [campo]: campo === "monto" ? (v === "" ? undefined : Number(v)) : v } : f,
    );
    onChange(next);
  }

  return (
    <div className={PROV_TABLA}>
      {filas.length === 0 ? (
        <p className={PROV_VACIA}>
          Sin proveedores. Añade uno por cada consulta realizada: sus propuestas determinan la
          cuantía de la contratación.
          {documentoSugerido ? (
            <>
              {" "}
              El documento se rellenará con <strong>{documentoSugerido}</strong>, tomado del resumen
              del requerimiento.
            </>
          ) : null}
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>RUC</th>
              <th>Razón social</th>
              <th>Documento de la consulta</th>
              <th>Fecha</th>
              <th>Propuesta (S/)</th>
              {!readOnly ? <th aria-label="Quitar" /> : null}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>
                <td>
                  <input
                    disabled={readOnly}
                    inputMode="numeric"
                    maxLength={11}
                    onChange={(e) => editar(i, "ruc", e.target.value)}
                    placeholder="20123456789"
                    value={f.ruc ?? ""}
                  />
                </td>
                <td>
                  <input
                    disabled={readOnly}
                    onChange={(e) => editar(i, "razonSocial", e.target.value)}
                    placeholder="DISTRIBUIDORA VIPASA S.A."
                    value={f.razonSocial ?? ""}
                  />
                </td>
                <td>
                  <input
                    disabled={readOnly}
                    onChange={(e) => editar(i, "documento", e.target.value)}
                    placeholder="PEDIDO DE COMPRA N° 1838-2026"
                    value={f.documento ?? ""}
                  />
                </td>
                <td>
                  <input
                    disabled={readOnly}
                    onChange={(e) => editar(i, "fecha", e.target.value)}
                    type="date"
                    value={f.fecha ?? ""}
                  />
                </td>
                <td>
                  <input
                    disabled={readOnly}
                    inputMode="decimal"
                    onChange={(e) => editar(i, "monto", e.target.value)}
                    type="number"
                    value={f.monto ?? ""}
                  />
                </td>
                {!readOnly ? (
                  <td>
                    <button
                      aria-label={`Quitar el proveedor ${i + 1}`}
                      className={PROV_QUITAR}
                      onClick={() => onChange(filas.filter((_, j) => j !== i))}
                      type="button"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!readOnly ? (
        <button
          className="secondaryButton compactButton"
          // La fila nueva llega con el pedido del requerimiento puesto: es el
          // documento con el que se consulta en la práctica. Queda editable —
          // se puede haber consultado con otro.
          onClick={() => onChange([...filas, documentoSugerido ? { documento: documentoSugerido } : {}])}
          type="button"
        >
          <Plus size={13} /> Añadir proveedor
        </button>
      ) : null}

      {cuantia != null ? (
        <p className="m-0 text-[13px]">
          Cuantía según {criterio === "promedio" ? "el promedio" : "la menor propuesta"}:{" "}
          <strong>
            S/ {cuantia.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
        </p>
      ) : null}
    </div>
  );
}
