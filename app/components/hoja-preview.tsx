"use client";

import type { CeldaPreview } from "@/lib/fase1-export";

/**
 * La hoja tal y como se exporta.
 *
 * Renderiza la MISMA hoja que se descarga —celdas, combinaciones y todo—, no un
 * resumen paralelo: revisar aquí es revisar el archivo. Un listado de marcas
 * decía qué se marca, pero no dejaba ver el formato ni pillar una casilla
 * puesta en la fila de al lado.
 *
 * Lo que ACE rellena se resalta, para distinguirlo del rótulo impreso de la
 * plantilla de un vistazo.
 */
export function HojaPreview({ filas, anchos }: { filas: CeldaPreview[][]; anchos?: number[] }) {
  const total = (anchos ?? []).reduce((a, b) => a + b, 0);
  // Con los anchos del Excel se fija la maqueta (table-layout: fixed) para que
  // las columnas guarden las MISMAS proporciones que el formato original.
  return (
    // El marco y las líneas de celda usaban `var(--border)`, token inexistente en
    // el sistema → el navegador descartaba el shorthand y la hoja salía SIN
    // cuadrícula. Se corrige con `border-line` (el token real de líneas): una vista
    // de hoja de cálculo necesita sus líneas para poder revisar el formato.
    // `hojaPreview`: gancho para las vistas previa a casi pantalla completa
    // (Formato de Estrategia, Anexo N° 1, Certificación), donde el CSS suelta el
    // tope de 460px y deja que desplace el CUERPO del modal —una sola barra de
    // scroll hasta el borde de los botones— en vez de esta caja anidada. En los
    // modales pequeños (sin esa clase de tarjeta) el tope de 460px sigue vigente.
    <div className="hojaPreview max-h-[460px] overflow-auto rounded-[6px] border border-line [&_table]:w-full [&_table]:border-collapse [&_table]:text-[11px] [&_td]:border [&_td]:border-line [&_td]:px-[5px] [&_td]:py-[3px] [&_td]:align-top [&_td]:whitespace-pre-wrap [&_td]:[word-break:break-word]">
      <table style={total > 0 ? { tableLayout: "fixed" } : undefined}>
        {total > 0 ? (
          <colgroup>
            {anchos!.map((w, i) => (
              <col key={i} style={{ width: `${((w / total) * 100).toFixed(3)}%` }} />
            ))}
          </colgroup>
        ) : null}
        <tbody>
          {filas.map((fila, i) => {
            // Fila sin texto = espaciador de la plantilla: se pinta finita.
            const vacia = !fila.some((c) => c.texto.trim());
            return (
              <tr className={vacia ? "[&>td]:h-[7px] [&>td]:!p-0" : undefined} key={i}>
                {fila.map((c) => (
                  <td
                    className={
                      [
                        c.esSeccion ? "bg-[#e2e8f0] font-bold tracking-[0.01em]" : "",
                        c.marca ? "bg-[#dcfce7] font-bold text-center" : c.relleno ? "bg-[#eff6ff]" : "",
                      ]
                        .filter(Boolean)
                        .join(" ") || undefined
                    }
                    colSpan={c.colspan}
                    key={c.celda}
                    rowSpan={c.rowspan}
                    style={{ textAlign: c.alineacion ?? "left", ...(c.negrita ? { fontWeight: 600 } : {}) }}
                    title={c.celda}
                  >
                    {c.texto}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
