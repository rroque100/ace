"use client";

import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { calcularVencimiento } from "@/lib/cronograma-fechas";
import { useFeriados } from "./use-feriados";

/**
 * Calculadora de vencimientos reutilizable: dada una fecha de inicio y un número
 * de días (hábiles o calendario), calcula la fecha de vencimiento descontando
 * —en el modo hábiles— sábados, domingos y los feriados de Configuración.
 *
 * Sirve para cualquier plazo del proceso: presentación de ofertas, subsanación,
 * consentimiento de la buena pro, plazos de la interacción (A5), etc.
 */
export function CalculadoraPlazos() {
  const { setFechas: feriados } = useFeriados();
  const [inicio, setInicio] = useState("");
  const [dias, setDias] = useState("");
  const [habiles, setHabiles] = useState(true);

  const vencimiento = useMemo(() => {
    const n = Number(dias);
    if (!inicio || !Number.isFinite(n) || dias.trim() === "") return "";
    return calcularVencimiento(inicio, n, { habiles, feriados });
  }, [inicio, dias, habiles, feriados]);

  const fechaLarga = useMemo(() => {
    if (!vencimiento) return "";
    const [y, m, d] = vencimiento.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-PE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  }, [vencimiento]);

  return (
    <div className="calcPlazos">
      <div className="calcPlazosHead">
        <Calculator size={15} />
        <strong>Calculadora de plazos</strong>
      </div>
      <div className="calcPlazosGrid">
        <label>
          <span>Fecha de inicio</span>
          <input onChange={(e) => setInicio(e.target.value)} type="date" value={inicio} />
        </label>
        <label>
          <span>Días</span>
          <input
            inputMode="numeric"
            min={0}
            onChange={(e) => setDias(e.target.value)}
            type="number"
            value={dias}
          />
        </label>
        <label className="calcPlazosTipo">
          <span>Tipo de plazo</span>
          <select onChange={(e) => setHabiles(e.target.value === "habiles")} value={habiles ? "habiles" : "calendario"}>
            <option value="habiles">Días hábiles (descuenta feriados)</option>
            <option value="calendario">Días calendario</option>
          </select>
        </label>
      </div>
      <p className="calcPlazosResultado">
        {vencimiento ? (
          <>
            Vence: <strong>{vencimiento}</strong>
            {fechaLarga ? <span className="calcPlazosLarga"> · {fechaLarga}</span> : null}
          </>
        ) : (
          "Completa la fecha de inicio y los días para calcular el vencimiento."
        )}
      </p>
    </div>
  );
}
