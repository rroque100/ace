"use client";

import { memo, useEffect, useRef, useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import {
  FILA_PERSONAL_CLAVE_VACIA,
  type FilaPersonalClave,
  formatPersonalClave,
  parsePersonalClave,
  personalClaveIncompletas,
} from "@/lib/personal-clave";

/**
 * Cuadro de la experiencia del personal clave (Art. 72.3.b).
 *
 * Una fila por puesto: tiempo mínimo, actividad en la que se exige y cargo. Se
 * añaden y se quitan con el botón. Sin filas no compone nada —el requisito puede
 * no aplicar— y en el requerimiento sale como tabla.
 *
 * Igual que el de otras penalidades: guarda lo TECLEADO (con sus espacios) y solo
 * re-sincroniza cuando el valor cambia por FUERA (recarga de la ficha), para no
 * borrar un espacio recién escrito con el round-trip serializar → parsear.
 */
export const PersonalClaveEditor = memo(function PersonalClaveEditor({
  value,
  onChange,
  readOnly = false,
}: {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
}) {
  const [filas, setFilas] = useState<FilaPersonalClave[]>(() => parsePersonalClave(value));
  const emitido = useRef(value);

  useEffect(() => {
    if (value === emitido.current) return;
    setFilas(parsePersonalClave(value));
    emitido.current = value;
  }, [value]);

  function propagar(siguientes: FilaPersonalClave[]) {
    if (readOnly) return;
    setFilas(siguientes);
    const texto = formatPersonalClave(siguientes);
    emitido.current = texto;
    onChange(texto);
  }

  const editar = (i: number, cambio: Partial<FilaPersonalClave>) =>
    propagar(filas.map((f, k) => (k === i ? { ...f, ...cambio } : f)));

  const incompletas = personalClaveIncompletas(filas);
  const celda =
    "w-full rounded-md border border-line bg-panel px-2 py-1 text-[12.5px] leading-relaxed text-ink " +
    "outline-none focus:border-brand focus:shadow-[var(--shadow-focus)]";

  return (
    <div className="flex flex-col gap-2.5">
      {filas.length > 0 ? (
        <div className="overflow-x-auto rounded-[10px] border border-line">
          <table className="w-full border-collapse text-[12.5px] [&_th]:border-b [&_th]:border-line [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-muted [&_td]:border-b [&_td]:border-line [&_td]:px-2.5 [&_td]:py-1.5 [&_td]:align-top [&_tr:last-child_td]:border-b-0">
            <thead>
              <tr>
                <th scope="col">N.º</th>
                <th scope="col">Actividad</th>
                <th scope="col">Cantidad</th>
                <th scope="col">Tiempo de experiencia mínimo</th>
                <th scope="col">Trabajos o prestaciones en la actividad requerida</th>
                <th scope="col">Puesto, cargo y/o posición</th>
                {readOnly ? null : <th scope="col"><span className="sr-only">Quitar</span></th>}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, i) => (
                <tr key={i}>
                  <td className="text-muted tabular-nums">{i + 1}</td>
                  <td className="min-w-[150px]">
                    <textarea
                      aria-label={`Actividad del personal clave ${i + 1}`}
                      className={celda}
                      disabled={readOnly}
                      onChange={(e) => editar(i, { actividad: e.target.value })}
                      placeholder="Estructuras metálicas"
                      rows={2}
                      value={fila.actividad}
                    />
                  </td>
                  <td className="min-w-[70px]">
                    <input
                      aria-label={`Cantidad de personal clave ${i + 1}`}
                      className={celda}
                      disabled={readOnly}
                      inputMode="numeric"
                      min={1}
                      onChange={(e) => editar(i, { cantidad: e.target.value })}
                      placeholder="1"
                      type="number"
                      value={fila.cantidad}
                    />
                  </td>
                  <td className="min-w-[130px]">
                    <input
                      aria-label={`Tiempo de experiencia mínimo del personal clave ${i + 1}`}
                      className={celda}
                      disabled={readOnly}
                      onChange={(e) => editar(i, { tiempo: e.target.value })}
                      placeholder="tres (3) años"
                      type="text"
                      value={fila.tiempo}
                    />
                  </td>
                  <td className="min-w-[190px]">
                    <textarea
                      aria-label={`Trabajos o prestaciones del personal clave ${i + 1}`}
                      className={celda}
                      disabled={readOnly}
                      onChange={(e) => editar(i, { trabajos: e.target.value })}
                      placeholder="supervisión de montaje de estructuras metálicas"
                      rows={2}
                      value={fila.trabajos}
                    />
                  </td>
                  <td className="min-w-[150px]">
                    <textarea
                      aria-label={`Puesto, cargo o posición del personal clave ${i + 1}`}
                      className={celda}
                      disabled={readOnly}
                      onChange={(e) => editar(i, { puesto: e.target.value })}
                      placeholder="Ingeniero residente"
                      rows={2}
                      value={fila.puesto}
                    />
                  </td>
                  {readOnly ? null : (
                    <td>
                      <button
                        aria-label={`Quitar el puesto ${i + 1}`}
                        className="rounded-md p-1 text-muted transition hover:bg-danger/10 hover:text-danger"
                        onClick={() => propagar(filas.filter((_, k) => k !== i))}
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
      ) : null}

      {incompletas.length > 0 ? (
        <p className="m-0 flex items-start gap-1.5 text-[11.5px] leading-[1.45] text-warning" role="status">
          <AlertTriangle aria-hidden className="mt-0.5 shrink-0" size={12} />
          <span>
            {incompletas.length === 1
              ? `Al puesto ${incompletas[0]} le falta el tiempo, la actividad o el cargo.`
              : `A los puestos ${incompletas.join(", ")} les falta el tiempo, la actividad o el cargo.`}
          </span>
        </p>
      ) : null}

      {readOnly ? null : (
        <button
          className="inline-flex w-fit items-center gap-1.5 rounded-lg px-1 text-[12.5px] font-semibold text-brand hover:underline"
          onClick={() => propagar([...filas, { ...FILA_PERSONAL_CLAVE_VACIA }])}
          type="button"
        >
          <Plus size={13} /> Agregar personal clave
        </button>
      )}
    </div>
  );
});
