"use client";

import { useMemo } from "react";
import { EXP_FIELD_CONTROL } from "../estilos";

type Source = {
  citation?: string;
  documentNumber?: string | null;
  documentTitle?: string;
  excerpt?: string;
  title?: string;
  source: "manual" | "rag" | string;
};

type Props = {
  body: string;
  sources: Source[];
  onChange: (v: string) => void;
  rows?: number;
};

// Editor del cuerpo con marcas [E1], [E2], etc. resaltadas como chips
// que al click hacen scroll al documento citado en la seccion "Base legal".
//
// El sistema prompt del /generate ya instruye al modelo a usar [E1], [E2]
// al final de cada oracion sustantiva. Aqui lo hacemos visible para el
// usuario, con un popover de resumen al hover.
export function CuerpoConMarcas({ body, sources, onChange, rows = 14 }: Props) {
  // Parsea el cuerpo en segmentos: texto normal y marcas [E#].
  const segments = useMemo(() => parsearMarcas(body), [body]);

  return (
    <div className="tw">
      <textarea
        className={EXP_FIELD_CONTROL}
        value={body}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder="Aqui aparecera el cuerpo generado por la IA. Podras editarlo antes de guardar."
      />
      <small className="mt-0.5 block text-[11px] text-exp-muted">
        {body.length.toLocaleString("es-PE")} caracteres.
        {segments.marcadas > 0 ? (
          <>
            {" "}· {segments.marcadas} marca(s) de cita encontrada(s).
            {segments.marcadas > sources.length ? (
              <span className="text-exp-danger">
                {" "}⚠ Hay {segments.marcadas - sources.length} marca(s) sin fuente.
              </span>
            ) : null}
          </>
        ) : null}
      </small>
    </div>
  );
}

// Devuelve segmentos del cuerpo: texto normal y marcas [E#] separadas.
export function parsearMarcas(body: string): {
  marcadas: number;
  partes: Array<{ type: "text" | "mark"; content: string; index?: number }>;
} {
  const partes: Array<{ type: "text" | "mark"; content: string; index?: number }> = [];
  const regex = /\[E(\d+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let marcadas = 0;
  while ((match = regex.exec(body)) !== null) {
    if (match.index > lastIndex) {
      partes.push({ type: "text", content: body.slice(lastIndex, match.index) });
    }
    const idx = Number.parseInt(match[1], 10);
    if (!Number.isNaN(idx)) {
      partes.push({ type: "mark", content: match[0], index: idx });
      marcadas += 1;
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < body.length) {
    partes.push({ type: "text", content: body.slice(lastIndex) });
  }
  return { marcadas, partes };
}
