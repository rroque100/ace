"use client";

import { useEffect, useRef, useState } from "react";
import {
  componerFormulaReajuste,
  type FormulaReajuste,
  type ModalidadReajuste,
  parseFormulaReajuste,
  PLANTILLA_REAJUSTE_OBRA,
  TEXTO_NO_CORRESPONDE,
} from "@/lib/formula-reajuste";
import { filasTextarea } from "@/lib/textarea-alto";

/**
 * Apartado h): fórmula de reajuste (Arts. 136.2 y 209). Se elige UNA opción —se
 * aplica o no corresponde—, mutuamente excluyentes, así que van como radios.
 *
 * El régimen difiere por objeto: obras y consultoría de obra usan fórmulas
 * polinómicas (Art. 209); bienes, servicios y consultoría en general siguen el
 * IPC (Art. 136.2, plantilla del catálogo). Al elegir «se aplica» se precarga la
 * plantilla que corresponde para editarla en el sitio.
 */
export function FormulaReajusteEditor({
  value,
  onChange,
  readOnly = false,
  plantilla = "",
  objeto = "",
}: {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
  /** Estructura sugerida para bienes/servicios (Art. 136.2), del catálogo. */
  plantilla?: string;
  /** Objeto de contratación; en obras rige el reajuste polinómico (Art. 209). */
  objeto?: string;
}) {
  const [datos, setDatos] = useState<FormulaReajuste>(() => parseFormulaReajuste(value));
  const emitido = useRef(value);

  useEffect(() => {
    if (value === emitido.current) return;
    setDatos(parseFormulaReajuste(value));
    emitido.current = value;
  }, [value]);

  function propagar(siguiente: FormulaReajuste) {
    if (readOnly) return;
    setDatos(siguiente);
    const texto = componerFormulaReajuste(siguiente);
    emitido.current = texto;
    onChange(texto);
  }

  // Obras y consultoría de obra → reajuste polinómico (Art. 209); el resto sigue
  // la plantilla del catálogo (IPC, Art. 136.2).
  const esObra = objeto === "obras" || objeto === "consultoria_obra";
  const plantillaEfectiva = esObra ? PLANTILLA_REAJUSTE_OBRA : plantilla;

  const elegir = (modalidad: ModalidadReajuste) =>
    modalidad === "aplica"
      ? propagar({ modalidad, detalle: datos.detalle.trim() || plantillaEfectiva })
      : propagar({ modalidad, detalle: "" });

  const opcion = (modalidad: ModalidadReajuste, texto: string) => {
    const elegida = datos.modalidad === modalidad;
    return (
      <label
        className={
          "flex cursor-pointer items-start gap-2.5 rounded-[10px] border p-3 transition " +
          (elegida ? "border-brand bg-brand-soft/40" : "border-line bg-surface hover:border-brand/40")
        }
        key={modalidad}
      >
        <input
          checked={elegida}
          className="mt-0.5 size-3.5 shrink-0 accent-[var(--brand)]"
          disabled={readOnly}
          name="modalidad-formula-reajuste"
          onChange={() => elegir(modalidad)}
          type="radio"
        />
        <span className="text-[12.5px] leading-[1.5] text-ink">{texto}</span>
      </label>
    );
  };

  return (
    <div className="flex flex-col gap-2.5">
      <p className="m-0 text-[12px] leading-[1.5] text-muted">
        Opcional. Procede en contratos de ejecución periódica o continuada (IPC, Art. 136.2) y en obras
        y consultoría de obra (fórmulas polinómicas, Art. 209). Elige <strong>una</strong> opción.
      </p>

      <div className="grid gap-2">
        {opcion("aplica", "Se aplica reajuste")}
        {opcion("no_corresponde", TEXTO_NO_CORRESPONDE)}
      </div>

      {datos.modalidad === "aplica" ? (
        <label className="flex flex-col gap-1">
          <span className="text-[11.5px] font-semibold text-muted">Fórmula(s) de reajuste y procedimiento</span>
          <textarea
            className="w-full rounded-lg border border-line bg-panel px-2.5 py-2 text-[12.5px] leading-relaxed text-ink outline-none focus:border-brand focus:shadow-[var(--shadow-focus)]"
            disabled={readOnly}
            onChange={(e) => propagar({ ...datos, detalle: e.target.value })}
            placeholder={plantillaEfectiva}
            rows={filasTextarea(datos.detalle, true)}
            value={datos.detalle}
          />
        </label>
      ) : null}
    </div>
  );
}
