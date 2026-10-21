"use client";

import { ArrowRight, GitCompareArrows } from "lucide-react";

export type CambioCampo = { label: string; antes: string; despues: string };

/**
 * Diff del ciclo de no objeción (D3, Art. 44.7): muestra QUÉ modificó la DEC en
 * el requerimiento (campo → antes → después), comparando la versión que remitió
 * el área usuaria con la propuesta de la DEC. Así el área usuaria da (u objeta)
 * su no objeción viendo el cambio, no a ciegas.
 */
export function DiffNoObjecion({ cambios }: { cambios: CambioCampo[] }) {
  if (cambios.length === 0) {
    return (
      <div className="diffNoObj">
        <p className="diffNoObjVacio">
          <GitCompareArrows size={13} aria-hidden /> La DEC no modificó campos del requerimiento. Revisa su
          sustento (arriba) antes de dar tu no objeción.
        </p>
      </div>
    );
  }

  return (
    <div className="diffNoObj">
      <div className="diffNoObjHead">
        <GitCompareArrows size={14} aria-hidden />
        <strong>Cambios propuestos por la DEC</strong>
        <span className="diffNoObjNum">
          {cambios.length} campo{cambios.length === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="diffNoObjLista">
        {cambios.map((c, i) => (
          <li className="diffNoObjItem" key={i}>
            <span className="diffNoObjCampo">{c.label}</span>
            <div className="diffNoObjPar">
              <span className="diffAntes" title={c.antes || "(vacío)"}>
                {c.antes || "—"}
              </span>
              <ArrowRight className="diffFlecha" size={12} aria-hidden />
              <span className="diffDespues" title={c.despues || "(vacío)"}>
                {c.despues || "—"}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
