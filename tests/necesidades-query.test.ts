import { describe, expect, it } from "vitest";
import { construirQueryNecesidades, limpiarBusqueda } from "@/lib/necesidades-query";

const base = { limit: 20, offset: 0, select: "id,nombre" };
const q = (extra: Record<string, string> = {}) =>
  construirQueryNecesidades({ ...base, ...extra });

describe("orden", () => {
  it("por defecto ordena por fecha de creación descendente", () => {
    expect(q()).toContain("order=created_at.desc");
  });

  it("usa el fragmento que se le pasa (ya validado por el route)", () => {
    const query = q({ orden: "monto_estimado.desc.nullslast" });
    expect(query).toContain("order=monto_estimado.desc.nullslast");
    expect(query).not.toContain("order=created_at.desc");
  });

  it("un orden vacío cae al por defecto", () => {
    expect(construirQueryNecesidades({ ...base, orden: "" })).toContain("order=created_at.desc");
  });
});

describe("sintaxis de PostgREST", () => {
  it("los filtros usan '=' y no '.'", () => {
    // El fallo real: se construían como `status.eq.borrador`, que llega como un
    // parámetro sin valor y PostgREST ignora en silencio. La lista salía entera
    // con cualquier filtro puesto y nada daba error.
    const query = q({ status: "borrador" });
    expect(query).toContain("status=eq.borrador");
    expect(query).not.toContain("status.eq.");
  });

  it("cada filtro va como su propio parámetro", () => {
    const query = q({
      meta: "0043",
      oficina: "SUBGERENCIA DE OBRAS",
      status: "conforme",
      tipoObjeto: "bienes",
      tipoProceso: "Comparación de Precios",
    });
    for (const clave of [
      "status=eq.",
      "tipo_objeto=eq.",
      "tipo_proceso_seleccion=eq.",
      "meta_presupuestal=eq.",
      "area_usuaria=eq.",
    ]) {
      expect(query, clave).toContain(clave);
    }
    // Cinco filtros + select, order, limit y offset.
    expect(query.split("&")).toHaveLength(9);
  });

  it("la búsqueda usa 'or=(...)' y no 'or(...)'", () => {
    const query = q({ search: "biblioteca" });
    expect(query).toContain("or=(");
    expect(query).not.toMatch(/&or\(/);
  });

  it("todo parámetro tiene un '=' con algo a la izquierda", () => {
    // Un trozo sin '=' es exactamente la forma que tenía el fallo.
    const query = q({
      meta: "0043",
      oficina: "OGA",
      search: "obra",
      status: "borrador",
      tipoObjeto: "obras",
      tipoProceso: "Licitación Pública de Obras",
    });
    for (const parte of query.split("&")) {
      expect(parte, parte).toMatch(/^[a-z_]+=.+/);
    }
  });
});

describe("codificación de los valores", () => {
  it("deja intacto el operador y codifica el valor", () => {
    const query = q({ tipoProceso: "Licitación Pública de Obras" });
    expect(query).toContain("tipo_proceso_seleccion=eq.Licitaci%C3%B3n%20P%C3%BAblica%20de%20Obras");
  });

  it("NUNCA entrecomilla el valor", () => {
    // Comprobado contra la base real: en un filtro simple de primer nivel
    // PostgREST no despoja las comillas —pasan a ser parte del literal— y la
    // comparación deja de encontrar nada. Entrecomillar "por si acaso" fue
    // exactamente lo que dejó el filtro de oficina sin resultados.
    for (const valor of ["GERENCIA DE OBRAS, PROYECTOS Y CATASTRO", "Meta 0043", "algo.con.puntos"]) {
      const query = q({ oficina: valor });
      expect(decodeURIComponent(query)).toContain(`area_usuaria=eq.${valor}`);
      expect(query).not.toContain("%22");
    }
  });

  it("una coma en el valor no parte el filtro en dos parámetros", () => {
    // Se codifica como %2C y se decodifica DESPUÉS de partir por "&".
    const query = q({ oficina: "GERENCIA DE OBRAS, PROYECTOS Y CATASTRO" });
    expect(query.split("&").filter((p) => p.startsWith("area_usuaria="))).toHaveLength(1);
    expect(query).toContain("%2C");
  });

  it("los valores de una sola palabra pasan tal cual", () => {
    expect(q({ status: "borrador" })).toContain("status=eq.borrador");
    expect(q({ tipoObjeto: "bienes" })).toContain("tipo_objeto=eq.bienes");
  });
});

describe("limpieza del término de búsqueda", () => {
  it("quita lo que rompería la expresión 'or'", () => {
    // Dentro de `or=(a,b)` la coma separa condiciones y los paréntesis cierran
    // el grupo: "servicio (2026), fase 2" provocaría un 400.
    expect(limpiarBusqueda('servicio (2026), fase 2')).toBe("servicio 2026 fase 2");
    expect(limpiarBusqueda('con "comillas"')).toBe("con comillas");
  });

  it("no altera una búsqueda normal", () => {
    expect(limpiarBusqueda("mobiliario biblioteca")).toBe("mobiliario biblioteca");
  });

  it("una búsqueda que era solo signos no genera filtro", () => {
    expect(q({ search: "(),," })).not.toContain("or=");
  });

  it("busca en nombre, código y área", () => {
    const query = q({ search: "obra" });
    expect(query).toContain("nombre.ilike.");
    expect(query).toContain("codigo.ilike.");
    expect(query).toContain("area_usuaria.ilike.");
  });
});

describe("comodines de ilike", () => {
  it("escapa % y _ para que se busquen como texto", () => {
    // Sin esto, buscar "50%" devolvía todo lo que empieza por 50.
    const query = construirQueryNecesidades({ ...base, search: "50% avance" });
    expect(decodeURIComponent(query)).toContain("nombre.ilike.*50\\% avance*");
  });

  it("mantiene los asteriscos que delimitan el patrón", () => {
    const query = decodeURIComponent(construirQueryNecesidades({ ...base, search: "obra" }));
    expect(query).toContain("nombre.ilike.*obra*");
  });
});

describe("bandeja «lo que me toca» (statusIn)", () => {
  it("filtra varios estados a la vez con in.()", () => {
    const query = construirQueryNecesidades({
      ...base,
      statusIn: ["remitido_dec", "en_revision_dec", "conforme"],
    });
    expect(query).toContain("status=in.(remitido_dec,en_revision_dec,conforme)");
  });

  it("statusIn tiene prioridad sobre status simple", () => {
    const query = construirQueryNecesidades({ ...base, status: "borrador", statusIn: ["remitido_dec"] });
    expect(query).toContain("status=in.(remitido_dec)");
    expect(query).not.toContain("status=eq.borrador");
  });

  it("statusIn vacío cae al status simple", () => {
    const query = construirQueryNecesidades({ ...base, status: "borrador", statusIn: [] });
    expect(query).toContain("status=eq.borrador");
  });
});

describe("portafolio (E2)", () => {
  it("filtra por responsable", () => {
    expect(q({ responsable: "JUAN JIMENEZ" })).toContain("responsable=eq.");
  });

  it("«por vencer»: fecha requerida <= la fecha dada", () => {
    const query = construirQueryNecesidades({ ...base, fechaRequeridaHasta: "2026-08-10" });
    expect(query).toContain("fecha_requerida=lte.2026-08-10");
  });

  it("«estancadas»: sin cambios antes de un timestamp", () => {
    const query = decodeURIComponent(
      construirQueryNecesidades({ ...base, updatedAntesDe: "2026-07-17T00:00:00.000Z" }),
    );
    expect(query).toContain("updated_at=lt.2026-07-17T00:00:00.000Z");
  });
});
