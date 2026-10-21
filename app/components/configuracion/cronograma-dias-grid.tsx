"use client";

import {
  DIAS_CRONOGRAMA_DEFAULT,
  parseDiasPorProcedimiento,
  type DiasCronograma,
} from "@/lib/cronograma-dias";
import { PROCEDIMIENTOS_COMPETITIVOS } from "@/lib/estrategia-formato";

/**
 * Rejilla de los días estimados del cronograma POR PROCEDIMIENTO (Configuración).
 * Una fila por procedimiento vigente y una columna por día editable. El valor viaja
 * como cadena JSON en el campo `cronogramaDias` del formulario de entidad; el
 * backend lo saneam con `parseDiasPorProcedimiento` antes de persistirlo (JSONB).
 *
 * Solo se editan las duraciones que el Reglamento NO fija (preparatorias y ejecución):
 * los plazos legales de la selección (22/7/3 días hábiles, los 6 de la subasta) son
 * piso duro en código y no aparecen aquí.
 */
const COLUMNAS: ReadonlyArray<{ key: keyof DiasCronograma; short: string; title: string }> = [
  { key: "aprobacionExpediente", short: "Aprob. expediente", title: "Aprobación del expediente de contratación (días hábiles)" },
  { key: "elaboracionBases", short: "Elab. bases", title: "Elaboración de las bases (días hábiles)" },
  { key: "presentacionRequisitos", short: "Present. requisitos", title: "Presentación de requisitos para la firma (días hábiles)" },
  { key: "suscripcionContrato", short: "Suscripción", title: "Suscripción del contrato (días hábiles)" },
];

export function CronogramaDiasGrid({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (json: string) => void;
  disabled?: boolean;
}) {
  // `parseDiasPorProcedimiento` SIEMPRE devuelve el mapa completo (defectos donde
  // falte), así que la rejilla siempre tiene datos aunque `value` esté vacío.
  const mapa = parseDiasPorProcedimiento(value);

  const setCelda = (proc: string, key: keyof DiasCronograma, raw: string) => {
    const soloDigitos = raw.replace(/\D/g, "").slice(0, 3);
    const n = soloDigitos === "" ? DIAS_CRONOGRAMA_DEFAULT[key] : Number(soloDigitos);
    onChange(JSON.stringify({ ...mapa, [proc]: { ...mapa[proc], [key]: n } }));
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs [&_th]:border [&_th]:border-line [&_th]:px-2 [&_th]:py-1.5 [&_th]:font-semibold [&_td]:border [&_td]:border-line [&_td]:px-1.5 [&_td]:py-1">
        <thead>
          <tr className="bg-surface text-muted">
            <th className="text-left">Procedimiento de selección</th>
            {COLUMNAS.map((c) => (
              <th key={c.key} className="text-center" title={c.title}>
                {c.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PROCEDIMIENTOS_COMPETITIVOS.map((p) => (
            <tr key={p.value}>
              <td className="whitespace-nowrap font-medium text-ink">{p.label}</td>
              {COLUMNAS.map((c) => (
                <td key={c.key} className="text-center">
                  <input
                    aria-label={`${p.label} — ${c.title}`}
                    className="w-14 rounded border border-line bg-panel px-1 py-0.5 text-center tabular-nums outline-none focus:border-brand disabled:opacity-50"
                    disabled={disabled}
                    inputMode="numeric"
                    onChange={(e) => setCelda(p.value, c.key, e.target.value)}
                    title={c.title}
                    value={String(mapa[p.value][c.key])}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
