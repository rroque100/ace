"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDownToLine, Plus, Trash2 } from "lucide-react";
import { filasTextarea } from "@/lib/textarea-alto";
import {
  componerOtrasPenalidades,
  type OtraPenalidad,
  parseOtrasPenalidades,
  penalidadesIncompletas,
  textoLibrePenalidades,
  TOPE_PENALIDADES,
} from "@/lib/otras-penalidades";
import { penalidadesDesdeMatriz } from "@/lib/penalidades-matriz";

/** Mismo supuesto ignorando tildes, mayúsculas y espacios de sobra. */
function claveSupuesto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Cuadro del apartado f): otras penalidades, además de la de mora.
 *
 * Es OPCIONAL. Por eso arranca vacío —sin ninguna fila— y no se compone nada
 * hasta que se añade la primera: un requerimiento sin otras penalidades es
 * perfectamente válido, y anunciar un cuadro vacío en el documento no lo es.
 */
export function OtrasPenalidadesEditor({
  value,
  onChange,
  readOnly = false,
  matriz = "",
}: {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
  /** Matriz de riesgos (Art. 44.3): fuente del botón «traer penalidades». */
  matriz?: string;
}) {
  const [filas, setFilas] = useState<OtraPenalidad[]>(() => parseOtrasPenalidades(value));
  const [libre, setLibre] = useState(() => textoLibrePenalidades(value));
  const emitido = useRef(value);
  // Feedback del traslado: cuántas se trajeron o si ya estaban todas.
  const [avisoTraslado, setAvisoTraslado] = useState("");

  useEffect(() => {
    if (value === emitido.current) return;
    setFilas(parseOtrasPenalidades(value));
    setLibre(textoLibrePenalidades(value));
    emitido.current = value;
  }, [value]);

  function propagar(siguientes: OtraPenalidad[], textoLibre = libre) {
    if (readOnly) return;
    setFilas(siguientes);
    setLibre(textoLibre);
    const texto = componerOtrasPenalidades(siguientes, textoLibre);
    emitido.current = texto;
    onChange(texto);
  }

  const editar = (i: number, cambio: Partial<OtraPenalidad>) =>
    propagar(filas.map((f, k) => (k === i ? { ...f, ...cambio } : f)));

  // Filas de la matriz de riesgos marcadas «otras penalidades». Solo se ofrece
  // el traslado si hay alguna que no esté ya en el cuadro (por supuesto).
  const candidatas = useMemo(() => penalidadesDesdeMatriz(matriz), [matriz]);
  const nuevasDeMatriz = candidatas.filter(
    (c) => !filas.some((f) => claveSupuesto(f.supuesto) === claveSupuesto(c.supuesto)),
  );

  function traerDeMatriz() {
    if (readOnly) return;
    if (nuevasDeMatriz.length === 0) {
      setAvisoTraslado("Ya están todas las penalidades de la matriz de riesgos.");
      return;
    }
    // Añade, nunca reemplaza: el registro manual sigue igual. Cálculo y
    // verificación llegan vacíos —la matriz no los trae— y por eso saltará el
    // aviso de «incompletas» hasta que se completen.
    propagar([...filas, ...nuevasDeMatriz]);
    setAvisoTraslado(
      nuevasDeMatriz.length === 1
        ? "Se trasladó 1 penalidad de la matriz. Completa su forma de cálculo y verificación."
        : `Se trasladaron ${nuevasDeMatriz.length} penalidades de la matriz. Completa su forma de cálculo y verificación.`,
    );
  }

  const incompletas = penalidadesIncompletas(filas);
  const celda =
    "w-full rounded-md border border-line bg-panel px-2 py-1 text-[12.5px] leading-relaxed text-ink " +
    "outline-none focus:border-brand focus:shadow-[var(--shadow-focus)]";

  return (
    <div className="flex flex-col gap-2.5">
      <p className="m-0 text-[12px] leading-[1.5] text-muted">
        Opcional. Las propone el área usuaria y se validan en la estrategia de contratación. Deben ser
        objetivas, razonables, congruentes y proporcionales con el objeto, sin afectar el equilibrio
        económico financiero del contrato.
      </p>

      {filas.length > 0 ? (
        <div className="overflow-x-auto rounded-[10px] border border-line">
          <table className="w-full border-collapse text-[12.5px] [&_th]:border-b [&_th]:border-line [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-muted [&_td]:border-b [&_td]:border-line [&_td]:px-2.5 [&_td]:py-1.5 [&_td]:align-top [&_tr:last-child_td]:border-b-0">
            <thead>
              <tr>
                <th scope="col">N.º</th>
                <th scope="col">Supuesto de aplicación</th>
                <th scope="col">Forma de cálculo</th>
                <th scope="col">Procedimiento de verificación</th>
                {readOnly ? null : <th scope="col"><span className="sr-only">Quitar</span></th>}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, i) => (
                <tr key={i}>
                  <td className="text-muted tabular-nums">{i + 1}</td>
                  <td className="min-w-[180px]">
                    <textarea
                      aria-label={`Supuesto de aplicación de la penalidad ${i + 1}`}
                      className={celda}
                      disabled={readOnly}
                      onChange={(e) => editar(i, { supuesto: e.target.value })}
                      placeholder="Incumple el plazo de reposición del personal clave"
                      rows={2}
                      value={fila.supuesto}
                    />
                  </td>
                  <td className="min-w-[160px]">
                    <textarea
                      aria-label={`Forma de cálculo de la penalidad ${i + 1}`}
                      className={celda}
                      disabled={readOnly}
                      onChange={(e) => editar(i, { calculo: e.target.value })}
                      placeholder="0.5 UIT por cada día de retraso"
                      rows={2}
                      value={fila.calculo}
                    />
                  </td>
                  <td className="min-w-[160px]">
                    <textarea
                      aria-label={`Procedimiento de verificación de la penalidad ${i + 1}`}
                      className={celda}
                      disabled={readOnly}
                      onChange={(e) => editar(i, { verificacion: e.target.value })}
                      placeholder="Informe del área usuaria con el registro de asistencia"
                      rows={2}
                      value={fila.verificacion}
                    />
                  </td>
                  {readOnly ? null : (
                    <td>
                      <button
                        aria-label={`Quitar la penalidad ${i + 1}`}
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
        // Aviso, no bloqueo: el apartado es opcional, pero una penalidad sin forma
        // de cálculo no se puede aplicar y sin verificación no se puede acreditar.
        <p className="m-0 flex items-start gap-1.5 text-[11.5px] leading-[1.45] text-warning" role="status">
          <AlertTriangle aria-hidden className="mt-0.5 shrink-0" size={12} />
          <span>
            {incompletas.length === 1
              ? `A la penalidad ${incompletas[0]} le falta la forma de cálculo o el procedimiento de verificación.`
              : `A las penalidades ${incompletas.join(", ")} les falta la forma de cálculo o el procedimiento de verificación.`}
          </span>
        </p>
      ) : null}

      {readOnly ? null : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <button
            className="inline-flex w-fit items-center gap-1.5 rounded-lg px-1 text-[12.5px] font-semibold text-brand hover:underline"
            onClick={() => propagar([...filas, { calculo: "", supuesto: "", verificacion: "" }])}
            type="button"
          >
            <Plus size={13} /> Añadir penalidad
          </button>
          {/* Solo si la matriz de riesgos (Art. 44.3) trae filas «otras
              penalidades». Si ya están todas, el botón sigue visible y el clic
              lo dice, en vez de desaparecer sin explicación. */}
          {candidatas.length > 0 ? (
            <button
              className="inline-flex w-fit items-center gap-1.5 rounded-lg px-1 text-[12.5px] font-semibold text-brand hover:underline"
              onClick={traerDeMatriz}
              type="button"
            >
              <ArrowDownToLine size={13} /> Traer penalidades de la matriz de riesgos
            </button>
          ) : null}
        </div>
      )}

      {avisoTraslado ? (
        <p className="m-0 text-[11.5px] leading-[1.45] text-muted" role="status">
          {avisoTraslado}
        </p>
      ) : null}

      {filas.length > 0 ? (
        <p className="m-0 rounded-lg border border-line bg-surface px-3 py-2 text-[11.5px] leading-[1.5] text-muted">
          {TOPE_PENALIDADES}
        </p>
      ) : null}

      <label className="flex flex-col gap-1">
        <span className="text-[11.5px] font-semibold text-muted">
          Notificación y descargos (opcional)
        </span>
        <textarea
          className="w-full rounded-lg border border-line bg-panel px-2.5 py-2 text-[12.5px] leading-relaxed text-ink outline-none focus:border-brand focus:shadow-[var(--shadow-focus)]"
          disabled={readOnly}
          onChange={(e) => propagar(filas, e.target.value)}
          placeholder="Plazo y forma en que se notifica el supuesto incurrido para que el contratista remita sus descargos, y plazo en que la entidad los evalúa y decide."
          // El doble de alto que antes (4 filas en vez de 2) y creciendo con el texto:
          // aqui van dos plazos y dos formas de notificacion, y con dos filas ni siquiera
          // cabia el propio marcador de posicion. `wide` da el minimo de 4.
          rows={filasTextarea(libre, true)}
          value={libre}
        />
      </label>
    </div>
  );
}
