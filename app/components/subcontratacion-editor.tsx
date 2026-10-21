"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  componerSubcontratacion,
  faltaSustentoProhibicion,
  type ModalidadSubcontratacion,
  parseSubcontratacion,
  type Subcontratacion,
  TEXTO_NO_CORRESPONDE,
  TEXTO_PERMITIDA,
  TEXTO_PROHIBIDA,
} from "@/lib/subcontratacion";
import { filasTextarea } from "@/lib/textarea-alto";

/**
 * Apartado g): subcontratación. Se elige UNA de las opciones del modelo:
 * permitida, prohibida o «No corresponde».
 *
 * Son mutuamente excluyentes, así que van como grupo de radios y no como
 * casillas: con casillas se pueden marcar varias, y las bases admiten solo una.
 * El texto de cada opción se muestra completo antes de elegir —es lo que va a
 * quedar escrito en el documento— en vez de esconderlo tras una etiqueta corta.
 *
 * El Art. 108.1 acota la exclusión de prestaciones esenciales y la PROHIBICIÓN
 * «en el caso de bienes y servicios»; en obras solo rige la regla general del
 * 40%. Por eso esas dos opciones se ofrecen solo cuando el objeto es bien o
 * servicio (o si ya venían elegidas, para no perder un dato guardado).
 */
export function SubcontratacionEditor({
  value,
  onChange,
  readOnly = false,
  objeto = "",
}: {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
  /** Objeto de contratación; el Art. 108.1 acota prohibir/excluir a bienes y servicios. */
  objeto?: string;
}) {
  const [datos, setDatos] = useState<Subcontratacion>(() => parseSubcontratacion(value));
  const emitido = useRef(value);

  useEffect(() => {
    if (value === emitido.current) return;
    setDatos(parseSubcontratacion(value));
    emitido.current = value;
  }, [value]);

  function propagar(siguiente: Subcontratacion) {
    if (readOnly) return;
    setDatos(siguiente);
    const texto = componerSubcontratacion(siguiente);
    emitido.current = texto;
    onChange(texto);
  }

  const opcion = (modalidad: ModalidadSubcontratacion, texto: string) => {
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
          name="modalidad-subcontratacion"
          onChange={() => propagar({ ...datos, modalidad })}
          type="radio"
        />
        <span className="text-[12.5px] leading-[1.5] text-ink">{texto}</span>
      </label>
    );
  };

  const areaBase =
    "w-full rounded-lg border border-line bg-panel px-2.5 py-2 text-[12.5px] leading-relaxed " +
    "text-ink outline-none focus:border-brand focus:shadow-[var(--shadow-focus)]";

  const esBienesServicios = objeto === "bienes" || objeto === "servicios";
  // Prohibir y excluir esenciales son opciones de bienes y servicios (Art. 108.1).
  // Se muestran también si YA venían elegidas, para no ocultar un dato guardado.
  const mostrarProhibida = esBienesServicios || datos.modalidad === "prohibida";
  const mostrarEsenciales =
    datos.modalidad === "permitida" && (esBienesServicios || datos.prestacionesExcluidas.trim().length > 0);

  return (
    <div className="flex flex-col gap-2.5">
      <p className="m-0 text-[12px] leading-[1.5] text-muted">
        Se incluye <strong>solo una</strong> de las opciones, a propuesta del área usuaria y previa
        validación en la estrategia de contratación.
      </p>

      <div className="grid gap-2">
        {opcion("no_corresponde", TEXTO_NO_CORRESPONDE)}
        {opcion("permitida", TEXTO_PERMITIDA)}
        {mostrarProhibida ? opcion("prohibida", TEXTO_PROHIBIDA) : null}
      </div>

      {datos.modalidad === "permitida" ? (
        // El subcontratista debe tener RNP vigente y la entidad aprueba la
        // subcontratación de forma previa (Art. 108.2-108.3): son condiciones de
        // ejecución, informativas aquí, que NO se escriben en el requerimiento.
        <p className="m-0 text-[11.5px] leading-[1.45] text-muted">
          El subcontratista debe contar con RNP vigente; la entidad aprueba la subcontratación de forma
          previa, en cinco (5) días hábiles (Art. 108.2-108.3). Se verifica en ejecución.
        </p>
      ) : null}

      {mostrarEsenciales ? (
        <label className="flex flex-col gap-1">
          <span className="text-[11.5px] font-semibold text-muted">
            Prestaciones esenciales excluidas de la subcontratación (opcional)
          </span>
          <textarea
            className={areaBase}
            disabled={readOnly}
            onChange={(e) => propagar({ ...datos, prestacionesExcluidas: e.target.value })}
            placeholder="Las que el área usuaria haya determinado en los términos de referencia del numeral 3.4, de corresponder."
            rows={filasTextarea(datos.prestacionesExcluidas, true)}
            value={datos.prestacionesExcluidas}
          />
        </label>
      ) : null}

      {datos.modalidad === "prohibida" ? (
        <label className="flex flex-col gap-1">
          <span className="text-[11.5px] font-semibold text-muted">
            Sustento de la prohibición
          </span>
          <textarea
            aria-invalid={faltaSustentoProhibicion(datos) || undefined}
            className={areaBase}
            disabled={readOnly}
            onChange={(e) => propagar({ ...datos, sustento: e.target.value })}
            placeholder="Por qué la naturaleza de la prestación no admite subcontratar, evaluado en la estrategia de contratación."
            rows={filasTextarea(datos.sustento, true)}
            value={datos.sustento}
          />
        </label>
      ) : null}

      {faltaSustentoProhibicion(datos) ? (
        // Aviso, no bloqueo: la ficha es un borrador que se completa por pasos. Pero
        // el Art. 108.1 no admite prohibir sin sustentarlo, y sin esto el apartado
        // llega a las bases con una restriccion que nadie justifico.
        <p className="m-0 flex items-start gap-1.5 text-[11.5px] leading-[1.45] text-warning" role="status">
          <AlertTriangle aria-hidden className="mt-0.5 shrink-0" size={12} />
          <span>
            El Art. 108.1 solo admite prohibir la subcontratación «de así haberse evaluado en la
            estrategia de contratación, con el sustento correspondiente».
          </span>
        </p>
      ) : null}
    </div>
  );
}
