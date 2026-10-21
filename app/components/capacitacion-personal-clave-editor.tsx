"use client";

import { memo, useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  type FilaCapacitacion,
  capacitacionExcedeHoras,
  capacitacionIncompletas,
  componerRequisitoCapacitacion,
  formatFilasCapacitacion,
  parseFilasCapacitacion,
} from "@/lib/capacitacion-personal-clave";

/**
 * Cuadro de capacitación del personal clave (Art. 72.3.b). Las filas se HEREDAN
 * del cuadro de «Experiencia del personal clave»: hay una por actividad
 * registrada allí, en el mismo orden y con la actividad ya puesta —es el mismo
 * personal—. Aquí solo se completan las horas, la materia y el puesto; la columna
 * «Requisito» se redacta sola con esos tres.
 *
 * Sin actividades heredadas, se muestran las filas que hubiera guardadas. Guarda
 * lo TECLEADO y solo re-sincroniza cuando el valor cambia por FUERA (recarga) o
 * cuando cambian las actividades del cuadro de experiencia.
 */
export const CapacitacionPersonalClaveEditor = memo(function CapacitacionPersonalClaveEditor({
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
  // Se fusiona lo guardado (horas/materia/puesto por índice) con las actividades
  // heredadas: una fila por actividad. Sin actividades, lo guardado tal cual.
  function fusionar(guardadas: FilaCapacitacion[]): FilaCapacitacion[] {
    if (actividades.length === 0) return guardadas;
    return actividades.map((actividad, i) => ({
      actividad,
      horas: guardadas[i]?.horas ?? "",
      materia: guardadas[i]?.materia ?? "",
      puesto: guardadas[i]?.puesto ?? "",
    }));
  }

  const [filas, setFilas] = useState<FilaCapacitacion[]>(() => fusionar(parseFilasCapacitacion(value)));
  const emitido = useRef(value);
  useEffect(() => {
    if (value !== emitido.current) {
      setFilas(fusionar(parseFilasCapacitacion(value)));
      emitido.current = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  // Y cuando cambian las actividades heredadas (se añadió/quitó un puesto en el
  // cuadro de experiencia): se rehacen las filas conservando lo tecleado.
  const actKey = actividades.join("");
  const actRef = useRef(actKey);
  useEffect(() => {
    if (actKey === actRef.current) return;
    actRef.current = actKey;
    setFilas((prev) => fusionar(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actKey]);

  function editar(i: number, cambio: Partial<FilaCapacitacion>) {
    if (readOnly) return;
    const next = filas.map((f, k) => (k === i ? { ...f, ...cambio } : f));
    setFilas(next);
    const texto = formatFilasCapacitacion(next);
    emitido.current = texto;
    onChange(texto);
  }

  const incompletas = capacitacionIncompletas(filas);
  const excede = capacitacionExcedeHoras(filas);
  const celda =
    "w-full rounded-md border border-line bg-panel px-2 py-1 text-[12.5px] leading-relaxed text-ink " +
    "outline-none focus:border-brand focus:shadow-[var(--shadow-focus)]";

  if (filas.length === 0) {
    return (
      <p className="m-0 text-[12px] leading-[1.5] text-muted">
        Agrega puestos en el cuadro de «Experiencia del personal clave» de arriba y aquí aparecerá una fila por cada
        uno para completar su capacitación.
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
              <th scope="col">Horas</th>
              <th scope="col">Materia o área de capacitación</th>
              <th scope="col">Personal clave del cual acreditar el requisito</th>
              <th scope="col">Requisito</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, i) => (
              <tr key={i}>
                <td className="text-muted tabular-nums">{i + 1}</td>
                {/* Heredada del cuadro de experiencia: no se edita aquí. */}
                <td className="min-w-[120px] text-muted">{fila.actividad || <span className="italic">—</span>}</td>
                <td className="min-w-[70px]">
                  <input
                    aria-label={`Horas de capacitación ${i + 1}`}
                    className={celda}
                    disabled={readOnly}
                    inputMode="numeric"
                    onChange={(e) => editar(i, { horas: e.target.value })}
                    placeholder="40"
                    value={fila.horas}
                  />
                </td>
                <td className="min-w-[170px]">
                  <textarea
                    aria-label={`Materia de capacitación ${i + 1}`}
                    className={celda}
                    disabled={readOnly}
                    onChange={(e) => editar(i, { materia: e.target.value })}
                    placeholder="Seguridad y salud en obra"
                    rows={2}
                    value={fila.materia}
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
                <td className="min-w-[190px] text-muted">{componerRequisitoCapacitacion(fila)}</td>
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
              ? `Al requisito ${incompletas[0]} le faltan horas, materia o puesto.`
              : `A los requisitos ${incompletas.join(", ")} les faltan horas, materia o puesto.`}
          </span>
        </p>
      ) : null}
      {excede.length > 0 ? (
        <p className="m-0 flex items-start gap-1.5 text-[11.5px] leading-[1.45] text-warning" role="status">
          <AlertTriangle aria-hidden className="mt-0.5 shrink-0" size={12} />
          <span>
            {excede.length === 1
              ? `El requisito ${excede[0]} supera el máximo de 120 horas del formato.`
              : `Los requisitos ${excede.join(", ")} superan el máximo de 120 horas del formato.`}
          </span>
        </p>
      ) : null}
    </div>
  );
});
