"use client";

import { AlertTriangle, Check, X } from "lucide-react";
import type { ItemVerificacion, ResumenVerificacion } from "@/lib/necesidad-verificacion";
import { S } from "./necesidad-verificacion-panel-estilos";

const ICONO = { ok: Check, warn: AlertTriangle, stop: X } as const;

/**
 * ¿Está lista la Necesidad para remitirse a la DEC?
 *
 * Responde la pregunta que quien formula se hace de verdad, y que hasta ahora
 * solo se contestaba después —en el expediente, o en el Excel firmado—.
 *
 * Se agrupa por ARTÍCULO y no por sección del formulario para que se aprenda de
 * dónde sale cada exigencia mientras se trabaja. Y cada línea que no está
 * conforme dice la CONSECUENCIA, no el requisito: "campo obligatorio" no explica
 * nada; "sin ella el expediente no puede avisar de que llega tarde", sí.
 */
export function VerificacionNecesidad({
  resumen,
  onIrACampo,
}: {
  resumen: ResumenVerificacion;
  /** Lleva al campo (clave `api`) que resuelve el punto. */
  onIrACampo?: (campo: string) => void;
}) {
  return (
    <section aria-label="Verificación de la necesidad" className={S.verif}>
      <header className={S.verifHead}>
        <h3>¿Está lista para el expediente?</h3>
        {resumen.lista ? (
          <span className={S.verifPill_verifPillOk}>Lista para remitir</span>
        ) : (
          <span className={S.verifPill_verifPillStop}>
            {resumen.bloquean === 1 ? "1 cosa lo impide" : `${resumen.bloquean} cosas lo impiden`}
          </span>
        )}
        <span className={S.verifCuenta}>
          {resumen.conformes} de {resumen.total} conformes
        </span>
      </header>

      {resumen.grupos.map((g) => (
        <div className={S.verifGrupo} key={g.articulo}>
          <p className={S.verifArticulo}>{g.articulo}</p>
          {g.items.map((i) => (
            <Linea item={i} key={i.etiqueta} onIrACampo={onIrACampo} />
          ))}
        </div>
      ))}
    </section>
  );
}

function Linea({
  item,
  onIrACampo,
}: {
  item: ItemVerificacion;
  onIrACampo?: (campo: string) => void;
}) {
  const Icono = ICONO[item.nivel];
  return (
    <div className={`${S.verifItem} verifItem-${item.nivel}`}>
      <Icono className={S.verifIcono} size={13} />
      <span className={S.verifEtiqueta}>{item.etiqueta}</span>
      {/* Solo hay atajo si hay algo que arreglar: en una línea conforme sería
          una invitación a tocar lo que ya está bien. */}
      {item.campo && onIrACampo && item.nivel !== "ok" ? (
        <button className={S.verifIr} onClick={() => onIrACampo(item.campo!)} type="button">
          Ir al campo
        </button>
      ) : null}
      {item.porque ? <p className={S.verifPorque}>{item.porque}</p> : null}
    </div>
  );
}
