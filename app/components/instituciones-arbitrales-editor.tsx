"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import {
  avisoJPRD,
  componerControversias,
  type InstitucionArbitral,
  parseInstituciones,
  TEXTO_ESTANDAR_CONTROVERSIAS,
  textoLibreControversias,
} from "@/lib/instituciones-arbitrales";
import {
  type InstitucionArbitralCatalogo,
  parseCatalogoInstituciones,
} from "@/lib/catalogo-instituciones-arbitrales";
import { validateRUC } from "@/lib/utils";
import { filasTextarea } from "@/lib/textarea-alto";

/**
 * Apartado i): solución de controversias contractuales.
 *
 * El texto del apartado (párrafo de conciliación y arbitraje + encabezado de la
 * lista) es EDITABLE y vive en el campo; el botón «Insertar texto estándar» carga
 * la versión oficial (Arts. 330-332). Debajo, el cuadro donde la entidad DESIGNA
 * las instituciones arbitrales entre las que el postor ganador elegirá una (Art.
 * 331.2). El editor compone el texto + la tabla y lo vuelve a leer al abrir, de
 * modo que la columna sigue siendo la de siempre y el Word se exporta igual.
 */
export function InstitucionesArbitralesEditor({
  value,
  onChange,
  readOnly = false,
  objeto = "",
  monto = null,
}: {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
  /** Objeto de contratación; con la cuantía decide el aviso de la JPRD (Art. 346). */
  objeto?: string;
  /** Cuantía estimada, para el umbral de la JPRD. */
  monto?: number | null;
}) {
  const [filas, setFilas] = useState<InstitucionArbitral[]>(() => {
    const leidas = parseInstituciones(value);
    return leidas.length > 0 ? leidas : [{ nombre: "", ruc: "" }];
  });
  const [libre, setLibre] = useState(() => textoLibreControversias(value));
  // Última cadena que ESTE editor emitió: distingue un cambio propio —no hay que
  // resincronizar, borraría lo que se acaba de teclear— de uno externo.
  const emitido = useRef(value);

  // Catálogo de instituciones arbitrales de Configuración: alimenta el
  // autocompletado (datalist) para elegir en vez de teclear. Si está vacío o
  // falla (SQL no aplicado, sin permiso), el campo sigue siendo texto libre.
  const [catalogo, setCatalogo] = useState<InstitucionArbitralCatalogo[]>([]);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const r = await fetch("/api/configuracion/instituciones-arbitrales", { cache: "no-store" });
        const d = await r.json().catch(() => ({}));
        if (vivo && r.ok) setCatalogo(parseCatalogoInstituciones(d.instituciones));
      } catch {
        /* sin catálogo: se sigue tecleando a mano */
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (value === emitido.current) return;
    const leidas = parseInstituciones(value);
    setFilas(leidas.length > 0 ? leidas : [{ nombre: "", ruc: "" }]);
    setLibre(textoLibreControversias(value));
    emitido.current = value;
  }, [value]);

  function propagar(siguientes: InstitucionArbitral[], textoLibre = libre) {
    if (readOnly) return;
    setFilas(siguientes);
    setLibre(textoLibre);
    const texto = componerControversias(siguientes, textoLibre);
    emitido.current = texto;
    onChange(texto);
  }

  const editar = (i: number, cambio: Partial<InstitucionArbitral>) =>
    propagar(filas.map((f, k) => (k === i ? { ...f, ...cambio } : f)));

  // Al elegir/teclear un nombre que coincide con el catálogo, se autocompleta su
  // RUC y se canoniza el nombre. Insensible a mayúsculas y espacios repetidos, de
  // modo que vale tanto seleccionar del desplegable como teclear el nombre con
  // alguna diferencia menor. Sin coincidencia se deja lo tecleado (texto libre).
  function elegirNombre(i: number, nombre: string) {
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const objetivo = norm(nombre);
    const match = objetivo ? catalogo.find((c) => norm(c.nombre) === objetivo) : undefined;
    if (match) editar(i, { nombre: match.nombre, ruc: match.ruc });
    else editar(i, { nombre });
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* Texto del apartado (editable). El botón carga el estándar oficial. */}
      <label className="flex flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2 text-[11.5px] font-semibold text-muted">
          Condiciones adicionales (opcional)
          {readOnly ? null : (
            <button
              className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[11px] font-semibold text-brand transition hover:bg-brand/5"
              onClick={() => propagar(filas, TEXTO_ESTANDAR_CONTROVERSIAS)}
              title="Carga el texto estándar del apartado (conciliación y arbitraje, Arts. 330-332)"
              type="button"
            >
              <FileText size={12} /> Insertar texto estándar
            </button>
          )}
        </span>
        <textarea
          className="w-full rounded-lg border border-line bg-panel px-2.5 py-2 text-[12.5px] leading-relaxed text-ink outline-none focus:border-brand focus:shadow-[var(--shadow-focus)]"
          disabled={readOnly}
          onChange={(e) => propagar(filas, e.target.value)}
          placeholder="Pulsa «Insertar texto estándar» para cargar el párrafo de conciliación y arbitraje, o escribe aquí el texto del apartado."
          rows={Math.max(6, filasTextarea(libre, true))}
          value={libre}
        />
      </label>

      {/* Cuadro de instituciones designadas, DEBAJO del texto del apartado. */}
      <div className="overflow-x-auto rounded-[10px] border border-line">
        <table className="w-full border-collapse text-[12.5px] [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-line [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-muted [&_td]:border-b [&_td]:border-line [&_td]:px-2.5 [&_td]:py-1.5 [&_td]:align-top [&_tr:last-child_td]:border-b-0">
          <thead>
            <tr>
              <th scope="col">N.º</th>
              <th scope="col">Institución arbitral</th>
              <th scope="col">RUC</th>
              {readOnly ? null : <th scope="col"><span className="sr-only">Quitar</span></th>}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, i) => {
              // Se avisa solo cuando hay algo escrito: un RUC vacío está
              // pendiente, no mal puesto.
              const rucMal = fila.ruc.trim() !== "" && !validateRUC(fila.ruc.replace(/\D/g, ""));
              return (
                <tr key={i}>
                  <td className="text-muted tabular-nums">{i + 1}</td>
                  <td>
                    <input
                      aria-label={`Institución arbitral ${i + 1}`}
                      className="w-full rounded-md border border-line bg-panel px-2 py-1 text-[12.5px] text-ink outline-none focus:border-brand focus:shadow-[var(--shadow-focus)]"
                      disabled={readOnly}
                      // Autocompletado desde el catálogo de Configuración: elegir
                      // una institución registrada rellena también su RUC.
                      list="catalogo-instituciones-arbitrales"
                      onChange={(e) => elegirNombre(i, e.target.value)}
                      placeholder="Cámara de Comercio de Lima"
                      value={fila.nombre}
                    />
                  </td>
                  <td>
                    <input
                      aria-describedby={rucMal ? `ruc-error-${i}` : undefined}
                      aria-invalid={rucMal || undefined}
                      aria-label={`RUC de la institución arbitral ${i + 1}`}
                      className="w-full rounded-md border border-line bg-panel px-2 py-1 text-[12.5px] tabular-nums text-ink outline-none focus:border-brand focus:shadow-[var(--shadow-focus)] aria-[invalid]:border-danger"
                      disabled={readOnly}
                      inputMode="numeric"
                      maxLength={11}
                      onChange={(e) => editar(i, { ruc: e.target.value.replace(/\D/g, "").slice(0, 11) })}
                      placeholder="20112273922"
                      value={fila.ruc}
                    />
                    {rucMal ? (
                      <span className="mt-0.5 block text-[11px] font-medium text-danger" id={`ruc-error-${i}`}>
                        El RUC tiene 11 dígitos
                      </span>
                    ) : null}
                  </td>
                  {readOnly ? null : (
                    <td>
                      <button
                        aria-label={`Quitar la institución ${i + 1}`}
                        className="rounded-md p-1 text-muted transition hover:bg-danger/10 hover:text-danger"
                        // Nunca se queda sin filas: se vacía la última en vez de
                        // borrarla, para no dejar el cuadro sin donde escribir.
                        onClick={() =>
                          propagar(
                            filas.length > 1
                              ? filas.filter((_, k) => k !== i)
                              : [{ nombre: "", ruc: "" }],
                          )
                        }
                        type="button"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Autocompletado: las instituciones del catálogo de Configuración. Al
          elegir una, su RUC se rellena solo. No limita: se puede escribir una
          que no esté en el catálogo. */}
      <datalist id="catalogo-instituciones-arbitrales">
        {catalogo.map((c) => (
          <option key={c.id} value={c.nombre} />
        ))}
      </datalist>

      {readOnly ? null : (
        <button
          className="inline-flex w-fit items-center gap-1.5 rounded-lg px-1 text-[12.5px] font-semibold text-brand hover:underline"
          onClick={() => propagar([...filas, { nombre: "", ruc: "" }])}
          type="button"
        >
          <Plus size={13} /> Añadir institución
        </button>
      )}

      <p className="m-0 text-[11.5px] leading-[1.45] text-muted">
        Las instituciones designadas deben contar con <strong>inscripción vigente en el REGAJU</strong>
        (Art. 332.1); el postor ganador elige una de esta lista al suscribir el contrato (Art. 332.2).
        {catalogo.length > 0 ? (
          <> Empieza a escribir para elegir una de las {catalogo.length} registradas en Configuración → Institución arbitral.</>
        ) : null}
      </p>

      {avisoJPRD(objeto, monto) ? (
        <p className="m-0 rounded-lg border border-line bg-surface px-3 py-2 text-[11.5px] leading-[1.5] text-muted">
          {avisoJPRD(objeto, monto)}
        </p>
      ) : null}
    </div>
  );
}
