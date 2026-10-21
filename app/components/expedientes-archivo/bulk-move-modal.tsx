"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { ExpSlideOver } from "./slide-over-shell";
import type { BulkMoveModalProps } from "./types";
import { EXP_FIELD, EXP_FIELD_CONTROL, EXP_FIELD_LABEL, EXP_SLIDE_OVER_BODY, EXP_SLIDE_OVER_FOOTER, expBtnClass, expMessageClass } from "./estilos";
import { cn } from "@/lib/utils";

export function BulkMoveModal({ count, onClose, onApply, canChangeOficina = true }: BulkMoveModalProps) {
  const [oficina, setOficina] = useState("");
  const [nroEstante, setNroEstante] = useState("");
  const [nroPiso, setNroPiso] = useState("");
  const [nroLocal, setNroLocal] = useState("");
  const [nroArchivador, setNroArchivador] = useState("");
  const [color, setColor] = useState("");

  const filledCount = [oficina, nroEstante, nroPiso, nroLocal, nroArchivador, color]
    .filter((v) => v.trim().length > 0).length;

  function apply() {
    const updates: Record<string, unknown> = {};
    if (oficina.trim()) updates.oficina = oficina.trim();
    if (nroEstante.trim()) updates.nroEstante = nroEstante.trim();
    if (nroPiso.trim()) updates.nroPiso = nroPiso.trim();
    if (nroLocal.trim()) updates.nroLocal = nroLocal.trim();
    if (nroArchivador.trim()) updates.nroArchivador = nroArchivador.trim();
    if (color) updates.colorArchivador = color;
    onApply(updates);
  }

  // Escape, foco atrapado y bloqueo de scroll los aporta ExpSlideOver (Radix).
  return (
    <ExpSlideOver
      modificador="expSlideOver-modal"
      onClose={onClose}
      subtitulo="Solo se aplican los campos con valor. El resto se preserva."
      titulo={`Mover / reasignar ${count} expediente${count === 1 ? "" : "s"}`}
    >
        <div className={cn("tw", EXP_SLIDE_OVER_BODY)}>
          <div className={cn(expMessageClass("info"), "mt-0")}>
            <strong className="font-bold">
              {filledCount} campo{filledCount === 1 ? "" : "s"} a modificar
            </strong>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-2.5">
            {canChangeOficina ? (
              <div className={cn(EXP_FIELD, "col-span-2")}>
                <label className={EXP_FIELD_LABEL}>Oficina</label>
                <input
                  value={oficina}
                  onChange={(e) => setOficina(e.target.value)}
                  placeholder="Si lo dejas vacío no se cambia"
                  className={EXP_FIELD_CONTROL}
                />
              </div>
            ) : null}
            <div className={EXP_FIELD}>
              <label className={EXP_FIELD_LABEL}>Estante</label>
              <input
                value={nroEstante}
                onChange={(e) => setNroEstante(e.target.value)}
                placeholder="Ej. 3"
                className={EXP_FIELD_CONTROL}
              />
            </div>
            <div className={EXP_FIELD}>
              <label className={EXP_FIELD_LABEL}>Piso</label>
              <input
                value={nroPiso}
                onChange={(e) => setNroPiso(e.target.value)}
                placeholder="Ej. 2"
                className={EXP_FIELD_CONTROL}
              />
            </div>
            <div className={EXP_FIELD}>
              <label className={EXP_FIELD_LABEL}>Local / ambiente</label>
              <input
                value={nroLocal}
                onChange={(e) => setNroLocal(e.target.value)}
                placeholder="Ej. A-1"
                className={EXP_FIELD_CONTROL}
              />
            </div>
            <div className={EXP_FIELD}>
              <label className={EXP_FIELD_LABEL}>Nº archivador</label>
              <input
                value={nroArchivador}
                onChange={(e) => setNroArchivador(e.target.value)}
                placeholder="Opcional"
                className={EXP_FIELD_CONTROL}
              />
            </div>
            <div className={cn(EXP_FIELD, "col-span-2")}>
              <label className={EXP_FIELD_LABEL}>Color</label>
              <select
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className={EXP_FIELD_CONTROL}
              >
                <option value="">— Sin cambio —</option>
                <option value="rojo">Rojo</option>
                <option value="azul">Azul</option>
                <option value="verde">Verde</option>
                <option value="amarillo">Amarillo</option>
                <option value="naranja">Naranja</option>
                <option value="celeste">Celeste</option>
                <option value="negro">Negro</option>
                <option value="blanco">Blanco</option>
                <option value="plomo">Plomo</option>
                <option value="otros">Otros</option>
              </select>
            </div>
          </div>
        </div>
        <div className={EXP_SLIDE_OVER_FOOTER}>
          <button type="button" className={expBtnClass("ghost")} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className={expBtnClass("primary")}
            onClick={apply}
            disabled={filledCount === 0}
          >
            <Save size={16} /> Aplicar a {count} ({filledCount} campo{filledCount === 1 ? "" : "s"})
          </button>
        </div>
    </ExpSlideOver>
  );
}
