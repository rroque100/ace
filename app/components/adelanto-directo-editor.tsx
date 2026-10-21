"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  type AdelantoDirecto,
  componerAdelantoDirecto,
  type ModalidadAdelanto,
  parseAdelantoDirecto,
  PLANTILLA_ADELANTO_OBRA,
  TEXTO_NO_CORRESPONDE,
} from "@/lib/adelanto-directo";
import { filasTextarea } from "@/lib/textarea-alto";

/**
 * Apartado e): adelanto directo (Art. 137). Se elige UNA opción —se otorga o no
 * corresponde—, mutuamente excluyentes, así que van como grupo de radios.
 *
 * Al elegir «se otorga» se precarga la plantilla en el detalle para editarla en
 * el sitio: así la elección queda guardada aunque falte completar cifras, y el
 * área usuaria ve la estructura que el texto debe seguir (Art. 137: número,
 * porcentaje no mayor al 30% en conjunto y plazo para solicitarlo).
 */
export function AdelantoDirectoEditor({
  value,
  onChange,
  readOnly = false,
  plantilla = "",
  objeto = "",
}: {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
  /** Estructura sugerida para el detalle del adelanto (viene del catálogo). */
  plantilla?: string;
  /** Objeto de contratación; en bienes/servicios el Art. 137 lo restringe. */
  objeto?: string;
}) {
  const [datos, setDatos] = useState<AdelantoDirecto>(() => parseAdelantoDirecto(value));
  const emitido = useRef(value);

  useEffect(() => {
    if (value === emitido.current) return;
    setDatos(parseAdelantoDirecto(value));
    emitido.current = value;
  }, [value]);

  function propagar(siguiente: AdelantoDirecto) {
    if (readOnly) return;
    setDatos(siguiente);
    const texto = componerAdelantoDirecto(siguiente);
    emitido.current = texto;
    onChange(texto);
  }

  // El régimen difiere por objeto: obras y consultoría de obra tienen su propia
  // estructura (topes por sistema de entrega y plazo de 10 días, Arts. 178-179);
  // bienes y servicios usan la plantilla del catálogo (tope 30%, Art. 66.3).
  const esObra = objeto === "obras" || objeto === "consultoria_obra";
  const plantillaEfectiva = esObra ? PLANTILLA_ADELANTO_OBRA : plantilla;

  const elegir = (modalidad: ModalidadAdelanto) =>
    modalidad === "otorga"
      ? propagar({ modalidad, detalle: datos.detalle.trim() || plantillaEfectiva })
      : propagar({ modalidad, detalle: "" });

  // El Art. 137 tasa el adelanto directo en bienes y servicios; en obras y
  // consultoría de obra rige el régimen de obras, así que ahí el aviso no aplica.
  const esBienesServicios = objeto === "bienes" || objeto === "servicios";

  const opcion = (modalidad: ModalidadAdelanto, texto: string) => {
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
          name="modalidad-adelanto-directo"
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
        En bienes y servicios el adelanto directo solo procede en los supuestos del Art. 137. Elige{" "}
        <strong>una</strong> opción.
      </p>

      <div className="grid gap-2">
        {opcion("otorga", "Se otorga adelanto directo")}
        {opcion("no_corresponde", TEXTO_NO_CORRESPONDE)}
      </div>

      {datos.modalidad === "otorga" ? (
        <label className="flex flex-col gap-1">
          <span className="text-[11.5px] font-semibold text-muted">Condiciones del adelanto directo</span>
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

      {datos.modalidad === "otorga" && esBienesServicios ? (
        // Aviso, no bloqueo: el apartado es una propuesta que la estrategia
        // valida. Pero en bienes y servicios el adelanto directo no es libre.
        <p className="m-0 flex items-start gap-1.5 text-[11.5px] leading-[1.45] text-warning" role="status">
          <AlertTriangle aria-hidden className="mt-0.5 shrink-0" size={12} />
          <span>
            En bienes y servicios el adelanto directo solo procede en los supuestos tasados del Art. 137
            (p. ej. bienes de alta complejidad bajo llave en mano o servicios especializados de gestión
            de instalaciones) y debe sustentarse en la estrategia de contratación.
          </span>
        </p>
      ) : null}
    </div>
  );
}
