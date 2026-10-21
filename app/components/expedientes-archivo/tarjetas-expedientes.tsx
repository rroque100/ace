"use client";

import { memo } from "react";
import { FileText, MapPin } from "lucide-react";
import type { TarjetasExpedientesProps } from "./types";
import {
  EXP_CARD,
  EXP_CARDS_GRID,
  EXP_CARD_HEADER,
  EXP_CARD_ICON,
  EXP_CARD_META,
  EXP_CARD_TITLE,
  EXP_CARD_UBICACION,
  expStatusClass,
} from "./estilos";
import { cn } from "@/lib/utils";

export const TarjetasExpedientes = memo(function TarjetasExpedientes({
  exps,
  onOpen,
  formatBytes,
  statusLabel,
}: TarjetasExpedientesProps) {
  return (
    <div className={cn("tw", EXP_CARDS_GRID)}>
      {exps.map((exp) => (
        <button key={exp.id} type="button" className={EXP_CARD} onClick={() => onOpen(exp)}>
          <div className={EXP_CARD_HEADER}>
            <div className={EXP_CARD_ICON}>
              <FileText size={16} />
            </div>
            <span className={expStatusClass(exp.status)} data-status={exp.status}>
              {statusLabel(exp.status)}
            </span>
          </div>
          <h3 className={EXP_CARD_TITLE}>{exp.title}</h3>
          <div className={EXP_CARD_META}>
            <span>
              {exp.anio ? `${exp.anio} · ` : ""}
              {formatBytes(exp.file_size)}
            </span>
            <span>{exp.oficina ?? "Sin oficina"}</span>
          </div>
          {exp.nro_estante || exp.nro_piso || exp.nro_local ? (
            <div className={EXP_CARD_UBICACION}>
              <MapPin size={12} />
              {[exp.nro_estante && `E${exp.nro_estante}`, exp.nro_piso && `P${exp.nro_piso}`, exp.nro_local]
                .filter(Boolean)
                .join(" / ")}
            </div>
          ) : (
            <div className={cn(EXP_CARD_UBICACION, "text-exp-muted")}>
              <MapPin size={12} />
              Sin ubicación
            </div>
          )}
        </button>
      ))}
    </div>
  );
});
