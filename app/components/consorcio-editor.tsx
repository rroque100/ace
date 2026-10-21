"use client";

import { memo, useEffect, useRef, useState } from "react";
import {
  type CondicionesConsorcio,
  MENSAJE_CONSORCIO,
  componerConsorcio,
  parseConsorcio,
} from "@/lib/consorcio";

/**
 * Condiciones de participación en consorcio (Art. 72.3.d).
 *
 * Tres casillas —D.1/D.2/D.3—, cada una con su número; se incluyen «una o más».
 * El requisito se compone con las marcadas y se guarda en el `detalle` del tipo
 * `consorcio` (texto canónico), del que se relee al abrir.
 */
export const ConsorcioEditor = memo(function ConsorcioEditor({
  value,
  onChange,
  readOnly = false,
}: {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
}) {
  const [cond, setCond] = useState<CondicionesConsorcio>(() => parseConsorcio(value));
  const emitido = useRef(value);
  useEffect(() => {
    if (value !== emitido.current) {
      setCond(parseConsorcio(value));
      emitido.current = value;
    }
  }, [value]);

  function editar(cambio: Partial<CondicionesConsorcio>) {
    if (readOnly) return;
    const next = { ...cond, ...cambio };
    setCond(next);
    const texto = componerConsorcio(next);
    emitido.current = texto;
    onChange(texto);
  }

  const filas = [
    { on: cond.d1, marcar: (v: boolean) => editar({ d1: v }), num: cond.n1, setNum: (n: string) => editar({ n1: n }), etiqueta: "El número máximo de consorciados es de", clave: "D.1" },
    { on: cond.d2, marcar: (v: boolean) => editar({ d2: v }), num: cond.n2, setNum: (n: string) => editar({ n2: n }), etiqueta: "El porcentaje mínimo de participación de cada consorciado es de", sufijo: "%", clave: "D.2" },
    { on: cond.d3, marcar: (v: boolean) => editar({ d3: v }), num: cond.n3, setNum: (n: string) => editar({ n3: n }), etiqueta: "El porcentaje mínimo de participación en la ejecución del contrato, para el integrante del consorcio que acredite mayor experiencia, es de", sufijo: "%", clave: "D.3" },
  ] as const;

  const ningunaMarcada = !cond.d1 && !cond.d2 && !cond.d3;

  return (
    <div className="reqCalConsorcio">
      {/* El mensaje del formato mientras no se marca ninguna: es lo que iría en
          el documento, para que se vea que falta elegir las condiciones. */}
      {ningunaMarcada ? <p className="reqCalConsorcioMsg">{MENSAJE_CONSORCIO}</p> : null}
      {filas.map((f) => (
        <div className="reqCalConsorcioFila" key={f.clave}>
          <label className="reqCalConsorcioCheck">
            <input
              checked={f.on}
              disabled={readOnly}
              onChange={(e) => f.marcar(e.target.checked)}
              type="checkbox"
            />
            <span>
              <strong>{f.clave}.</strong> {f.etiqueta}
            </span>
          </label>
          {f.on ? (
            <span className="reqCalConsorcioNum">
              <input
                aria-label={`Valor de ${f.clave}`}
                disabled={readOnly}
                inputMode="numeric"
                min={0}
                onChange={(e) => f.setNum(e.target.value)}
                placeholder="—"
                type="number"
                value={f.num}
              />
              {"sufijo" in f && f.sufijo ? <span>{f.sufijo}</span> : null}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
});
