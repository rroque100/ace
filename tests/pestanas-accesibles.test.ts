import { describe, expect, it } from "vitest";
import {
  idPanel,
  idPestana,
  propsPanel,
  propsPestana,
  siguientePestana,
} from "@/lib/pestanas-accesibles";

describe("propsPestana", () => {
  it("apunta al panel que gobierna", () => {
    const p = propsPestana("archivo", "buscar", "buscar");
    expect(p["aria-controls"]).toBe(idPanel("archivo"));
    expect(p.role).toBe("tab");
  });

  it("todas señalan el mismo panel: solo se monta el activo", () => {
    // Si cada pestaña apuntase a un id propio, las inactivas referenciarian
    // elementos que no existen en el DOM.
    const ids = ["buscar", "subir", "responder"].map(
      (v) => propsPestana("archivo", v, "buscar")["aria-controls"],
    );
    expect(new Set(ids).size).toBe(1);
  });

  it("marca seleccionada solo la activa", () => {
    expect(propsPestana("archivo", "buscar", "buscar")["aria-selected"]).toBe(true);
    expect(propsPestana("archivo", "subir", "buscar")["aria-selected"]).toBe(false);
  });

  it("deja fuera del tabulador las pestañas no activas (indice movil)", () => {
    expect(propsPestana("archivo", "buscar", "buscar").tabIndex).toBe(0);
    expect(propsPestana("archivo", "subir", "buscar").tabIndex).toBe(-1);
  });

  it("no colisiona entre listas distintas de la misma pagina", () => {
    expect(propsPestana("archivo", "buscar", "buscar").id).not.toBe(
      propsPestana("contratos", "buscar", "buscar").id,
    );
  });
});

describe("propsPanel", () => {
  it("apunta de vuelta a la pestaña activa, y ella a el", () => {
    const panel = propsPanel("archivo", "buscar");
    const pestana = propsPestana("archivo", "buscar", "buscar");
    expect(panel["aria-labelledby"]).toBe(pestana.id);
    expect(pestana["aria-controls"]).toBe(panel.id);
  });

  it("cambia de dueño al cambiar de pestaña, sin cambiar de id", () => {
    const a = propsPanel("archivo", "buscar");
    const b = propsPanel("archivo", "subir");
    expect(a.id).toBe(b.id);
    expect(a["aria-labelledby"]).not.toBe(b["aria-labelledby"]);
    expect(b["aria-labelledby"]).toBe(idPestana("archivo", "subir"));
  });

  it("es enfocable para poder leerlo de seguido", () => {
    expect(propsPanel("archivo", "buscar").tabIndex).toBe(0);
    expect(propsPanel("archivo", "buscar").role).toBe("tabpanel");
  });
});

describe("siguientePestana", () => {
  const v = ["buscar", "subir", "responder"] as const;

  it("avanza y retrocede", () => {
    expect(siguientePestana(v, "buscar", "ArrowRight")).toBe("subir");
    expect(siguientePestana(v, "subir", "ArrowLeft")).toBe("buscar");
  });

  it("trata las flechas verticales igual que las horizontales", () => {
    expect(siguientePestana(v, "buscar", "ArrowDown")).toBe("subir");
    expect(siguientePestana(v, "subir", "ArrowUp")).toBe("buscar");
  });

  it("da la vuelta en los extremos", () => {
    expect(siguientePestana(v, "responder", "ArrowRight")).toBe("buscar");
    expect(siguientePestana(v, "buscar", "ArrowLeft")).toBe("responder");
  });

  it("Inicio y Fin saltan a los extremos", () => {
    expect(siguientePestana(v, "subir", "Home")).toBe("buscar");
    expect(siguientePestana(v, "subir", "End")).toBe("responder");
  });

  it("ignora las teclas que no navegan", () => {
    expect(siguientePestana(v, "buscar", "Enter")).toBeNull();
    expect(siguientePestana(v, "buscar", "a")).toBeNull();
    expect(siguientePestana(v, "buscar", "Tab")).toBeNull();
  });

  it("aguanta una lista vacia", () => {
    expect(siguientePestana([], "buscar", "ArrowRight")).toBeNull();
  });

  it("cae en la primera si la activa ya no esta en la lista", () => {
    // Pasa de verdad: 'subir' y 'responder' desaparecen sin permiso de gestion.
    expect(siguientePestana(["buscar"], "responder", "ArrowRight")).toBe("buscar");
  });

  it("con una sola pestaña se queda donde esta", () => {
    expect(siguientePestana(["buscar"], "buscar", "ArrowRight")).toBe("buscar");
  });
});
