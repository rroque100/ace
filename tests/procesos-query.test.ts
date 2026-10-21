import { describe, expect, it } from "vitest";
import { construirQueryProcesos, estadosDeFase, limpiarBusqueda } from "@/lib/procesos-query";
import { FASES } from "@/lib/procurement-fases";

const base = { limit: 20, offset: 0 };
const q = (extra: Record<string, string> = {}) => construirQueryProcesos({ ...base, ...extra });

describe("sintaxis de PostgREST", () => {
  it("todo parámetro tiene un '=' con algo a la izquierda", () => {
    // La forma exacta del fallo que dejó sin efecto los filtros de necesidades:
    // `status.eq.x` en vez de `status=eq.x` llega como parámetro sin valor y el
    // servidor lo descarta con un 200 y la lista entera.
    const query = q({
      fase: "F2",
      meta: "237",
      objectType: "bienes",
      oficina: "GERENCIA DE OBRAS, PROYECTOS",
      procedureType: "comparacion_precios",
      search: "obra",
    });
    for (const parte of query.split("&")) {
      expect(parte, parte).toMatch(/^[a-z_.]+=.+/);
    }
  });

  it("no entrecomilla el valor de un filtro simple", () => {
    // En un `eq.` de primer nivel las comillas NO se despojan: se vuelven parte
    // del literal y la comparación deja de encontrar nada.
    const query = q({ oficina: "GERENCIA DE OBRAS, PROYECTOS Y CATASTRO" });
    expect(decodeURIComponent(query)).toContain(
      "necesidades.area_usuaria=eq.GERENCIA DE OBRAS, PROYECTOS Y CATASTRO",
    );
    expect(query).not.toContain("%22");
  });

  it("la búsqueda usa 'or=(...)'", () => {
    const query = q({ search: "mobiliario" });
    expect(query).toContain("or=(");
    expect(query).toContain("nomenclature.ilike.");
    expect(query).toContain("entity.ilike.");
  });
});

describe("filtro por fase", () => {
  it("traduce la fase a la lista de estados del catálogo", () => {
    const query = decodeURIComponent(q({ fase: "F2" }));
    for (const estado of estadosDeFase("F2")) {
      expect(query).toContain(`"${estado}"`);
    }
    expect(query).toContain("status=in.(");
  });

  it("entrecomilla DENTRO de in.(...), donde la coma sí separa", () => {
    // Es el caso contrario al `eq.`: aquí las comillas sí hacen falta.
    expect(decodeURIComponent(q({ fase: "F1" }))).toMatch(/status=in\.\("[a-z_]+"/);
  });

  it("cubre las tres fases del catálogo sin dejar ninguna vacía", () => {
    for (const fase of FASES) {
      expect(estadosDeFase(fase.id).length, fase.id).toBeGreaterThan(0);
    }
  });

  it("una fase desconocida no genera filtro en vez de devolver cero", () => {
    // Inventar `status=in.()` haría que la lista saliera vacía sin explicación.
    expect(q({ fase: "F9" })).not.toContain("status=in.");
  });

  it("el estado concreto manda sobre la fase", () => {
    // Quien eligió "Buena pro" no quiere además el resto de la Fase 2.
    const query = q({ fase: "F2", status: "buena_pro" });
    expect(query).toContain("status=eq.buena_pro");
    expect(query).not.toContain("status=in.");
  });
});

describe("embebido de la necesidad", () => {
  it("sin filtrar por ella, el embebido NO es inner", () => {
    // Con `!inner` desaparecerían los expedientes que aún no tienen necesidad
    // enlazada, que es justo lo contrario de listar "todos".
    expect(q()).toContain("necesidades(");
    expect(q()).not.toContain("necesidades!inner(");
  });

  it("al filtrar por oficina o meta pasa a inner", () => {
    // Sin el inner join, el filtro no descarta: devuelve el expediente con el
    // embebido vacío.
    expect(q({ oficina: "X" })).toContain("necesidades!inner(");
    expect(q({ meta: "237" })).toContain("necesidades!inner(");
  });

  it("trae los datos que la tarjeta enseña", () => {
    for (const campo of ["codigo", "area_usuaria", "meta_presupuestal"]) {
      expect(q(), campo).toContain(campo);
    }
  });
});

describe("limpieza de la búsqueda", () => {
  it("quita lo que rompería el grupo 'or'", () => {
    expect(limpiarBusqueda("obra (2026), fase 2")).toBe("obra 2026 fase 2");
  });

  it("escapa los comodines de ilike", () => {
    expect(decodeURIComponent(q({ search: "50% avance" }))).toContain("50\\% avance");
  });

  it("una búsqueda de solo signos no genera filtro", () => {
    expect(q({ search: "(),," })).not.toContain("or=");
  });
});
