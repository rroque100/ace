"use client";

import { memo, useEffect, useRef, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import {
  type FilaFormacion,
  componerRequisitoFormacion,
  formacionIncompletas,
  formatFilasFormacion,
  parseFilasFormacion,
} from "@/lib/formacion-academica";

/**
 * Cuadro de formación académica del personal clave (Art. 72.3.b, C.2.1).
 *
 * Las filas se HEREDAN del cuadro de «Experiencia del personal clave»: hay una
 * por actividad registrada allí, en el mismo orden y con la actividad ya puesta
 * —es el mismo personal—. Aquí solo se completan el grado/título y el puesto. La
 * columna «Requisito» se redacta sola con esos dos.
 *
 * Sin actividades heredadas, se muestran las filas que hubiera guardadas (por si
 * se registró antes de tener el cuadro de experiencia). Guarda lo TECLEADO y solo
 * re-sincroniza cuando el valor cambia por FUERA.
 */
export const FormacionAcademicaEditor = memo(function FormacionAcademicaEditor({
  value,
  onChange,
  readOnly = false,
  actividades,
}: {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
  /** Actividades del cuadro de experiencia del personal clave, en orden. */
  actividades: string[];
}) {
  // Se fusiona lo guardado (grado/puesto por índice) con las actividades
  // heredadas: una fila por actividad. Sin actividades, lo guardado tal cual.
  function fusionar(guardadas: FilaFormacion[]): FilaFormacion[] {
    if (actividades.length === 0) return guardadas;
    return actividades.map((actividad, i) => ({
      actividad,
      grado: guardadas[i]?.grado ?? "",
      puesto: guardadas[i]?.puesto ?? "",
    }));
  }

  const [filas, setFilas] = useState<FilaFormacion[]>(() => fusionar(parseFilasFormacion(value)));
  const emitido = useRef(value);
  // Re-sincroniza cuando el valor cambia por fuera (recarga).
  useEffect(() => {
    if (value !== emitido.current) {
      setFilas(fusionar(parseFilasFormacion(value)));
      emitido.current = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  // Y cuando cambian las actividades heredadas (se añadió/quitó un puesto en el
  // cuadro de experiencia): se rehacen las filas conservando grado/puesto.
  const actKey = actividades.join("");
  const actRef = useRef(actKey);
  useEffect(() => {
    if (actKey === actRef.current) return;
    actRef.current = actKey;
    setFilas((prev) => fusionar(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actKey]);

  function editar(i: number, cambio: Partial<FilaFormacion>) {
    if (readOnly) return;
    const next = filas.map((f, k) => (k === i ? { ...f, ...cambio } : f));
    setFilas(next);
    const texto = formatFilasFormacion(next);
    emitido.current = texto;
    onChange(texto);
  }

  const incompletas = formacionIncompletas(filas);
  const celda =
    "w-full rounded-md border border-line bg-panel px-2 py-1 text-[12.5px] leading-relaxed text-ink " +
    "outline-none focus:border-brand focus:shadow-[var(--shadow-focus)]";

  if (filas.length === 0) {
    return (
      <p className="m-0 text-[12px] leading-[1.5] text-muted">
        Agrega puestos en el cuadro de «Experiencia del personal clave» de arriba y aquí aparecerá una fila por cada
        uno para completar su formación académica.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="overflow-x-auto rounded-[10px] border border-line">
        <table className="w-full border-collapse text-[12.5px] [&_th]:border-b [&_th]:border-line [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-muted [&_td]:border-b [&_td]:border-line [&_td]:px-2.5 [&_td]:py-1.5 [&_td]:align-top [&_tr:last-child_td]:border-b-0">
          <thead>
            <tr>
              <th scope="col">N.º</th>
              <th scope="col">Actividad</th>
              <th scope="col">Grado de bachiller o título profesional requerido</th>
              <th scope="col">Personal clave del cual acreditar el requisito</th>
              <th scope="col">Requisito</th>
              {readOnly || actividades.length > 0 ? null : <th scope="col"><span className="sr-only">Quitar</span></th>}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, i) => (
              <tr key={i}>
                <td className="text-muted tabular-nums">{i + 1}</td>
                {/* Heredada del cuadro de experiencia: no se edita aquí. */}
                <td className="min-w-[120px] text-muted">{fila.actividad || <span className="italic">—</span>}</td>
                <td className="min-w-[170px]">
                  <textarea
                    aria-label={`Grado o título del personal clave ${i + 1}`}
                    className={celda}
                    disabled={readOnly}
                    onChange={(e) => editar(i, { grado: e.target.value })}
                    placeholder="Título profesional de Ingeniero Civil"
                    rows={2}
                    value={fila.grado}
                  />
                </td>
                <td className="min-w-[150px]">
                  <textarea
                    aria-label={`Personal clave del cual acreditar ${i + 1}`}
                    className={celda}
                    disabled={readOnly}
                    onChange={(e) => editar(i, { puesto: e.target.value })}
                    placeholder="Ingeniero residente"
                    rows={2}
                    value={fila.puesto}
                  />
                </td>
                <td className="min-w-[190px] text-muted">{componerRequisitoFormacion(fila)}</td>
                {/* Solo se puede quitar si NO viene heredada del cuadro de
                    experiencia; si viene de ahí, se quita en aquel cuadro. */}
                {readOnly || actividades.length > 0 ? null : (
                  <td>
                    <button
                      aria-label={`Quitar el requisito ${i + 1}`}
                      className="rounded-md p-1 text-muted transition hover:bg-danger/10 hover:text-danger"
                      onClick={() => editar(i, { grado: "", puesto: "" })}
                      type="button"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {incompletas.length > 0 ? (
        <p className="m-0 flex items-start gap-1.5 text-[11.5px] leading-[1.45] text-warning" role="status">
          <AlertTriangle aria-hidden className="mt-0.5 shrink-0" size={12} />
          <span>
            {incompletas.length === 1
              ? `Al requisito ${incompletas[0]} le falta el grado o el puesto.`
              : `A los requisitos ${incompletas.join(", ")} les falta el grado o el puesto.`}
          </span>
        </p>
      ) : null}
    </div>
  );
});
