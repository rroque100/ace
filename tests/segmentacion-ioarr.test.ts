import { describe, expect, it } from "vitest";
import { clasificarSegmentacion, CRITERIOS_OBRA_BASICA } from "@/lib/actuaciones-preparatorias";

// Art. 153.2 del Reglamento, última frase, literal:
//   "Los requerimientos de IOARR se consideran básicos."
//
// Es una clasificación AUTOMÁTICA que no depende de los cuatro criterios
// concurrentes (153.2 i-iv). Faltaba: una IOARR que no cumpliera alguno —por
// ejemplo, que la entidad no hubiera ejecutado obras similares— salía
// "avanzada" y se le exigía consulta al mercado avanzada.

const TODOS = CRITERIOS_OBRA_BASICA.map((c) => c.key);
const obra = (extra: Record<string, unknown> = {}) =>
  clasificarSegmentacion({ objeto: "obras_consultoria_obras", ...extra });

describe("segmentación de obras · la regla IOARR del Art. 153.2", () => {
  it("una IOARR es básica aunque no cumpla NINGÚN criterio", () => {
    const r = obra({ criteriosBasica: [], esIoarr: true });
    expect(r.categoria).toBe("contratacion_basica");
    expect(r.nivel).toBe("consulta_mercado_basica");
  });

  it("sin la marca de IOARR, esa misma obra sale avanzada (Art. 153.3)", () => {
    const r = obra({ criteriosBasica: [] });
    expect(r.categoria).toBe("contratacion_avanzada");
    expect(r.nivel).toBe("consulta_mercado_avanzada");
  });

  it("basta con que falte UN criterio para que la diferencia se note", () => {
    const tresDeCuatro = TODOS.slice(0, -1);
    expect(obra({ criteriosBasica: tresDeCuatro }).categoria).toBe("contratacion_avanzada");
    expect(obra({ criteriosBasica: tresDeCuatro, esIoarr: true }).categoria).toBe(
      "contratacion_basica",
    );
  });

  it("señala cuándo la categoría se debe a la IOARR y no a los criterios", () => {
    // Para que el informe pueda decir POR QUÉ salió básica.
    expect(obra({ criteriosBasica: [], esIoarr: true }).porIoarr).toBe(true);
    // Si cumple los cuatro, la IOARR no aporta nada: no se atribuye a ella.
    expect(obra({ criteriosBasica: TODOS, esIoarr: true }).porIoarr).toBe(false);
    expect(obra({ criteriosBasica: TODOS }).porIoarr).toBe(false);
  });

  it("una obra que cumple los cuatro criterios sigue siendo básica sin IOARR", () => {
    expect(obra({ criteriosBasica: TODOS }).categoria).toBe("contratacion_basica");
  });

  it("la compra centralizada manda sobre la IOARR: sigue siendo avanzada", () => {
    // La regla de centralizadas se evalúa antes y fuerza contratación avanzada
    // en obras. Una IOARR centralizada no la degrada a básica.
    const r = obra({ centralizada: true, esIoarr: true, criteriosBasica: [] });
    expect(r.categoria).toBe("contratacion_avanzada");
  });

  it("la marca no afecta a bienes y servicios: el 153 es de obras", () => {
    const r = clasificarSegmentacion({
      objeto: "bienes_servicios",
      cuantiaAlta: true,
      condicionesRiesgo: ["desierto_2anios"],
      esIoarr: true,
    });
    expect(r.categoria).toBe("estrategico");
  });
});
