import { describe, expect, it } from "vitest";
import {
  completarModeloRequestSchema,
  construirMensajesCopiloto,
  copilotoRequestSchema,
  huellaCatalogo,
} from "@/lib/necesidad-copiloto";
import { REQUERIMIENTO_GUIA } from "@/lib/requerimiento-guia";

// Tipo con guía garantizada (existe en REQUERIMIENTO_GUIA).
const TIPO = "Licitación Pública para Bienes";

describe("copilotoRequestSchema", () => {
  it("acepta una petición de redacción válida", () => {
    const parsed = copilotoRequestSchema.safeParse({
      accion: "redactar",
      tipoProcesoSeleccion: TIPO,
      tipoObjeto: "Bienes",
      campoObjetivo: { key: "finalidadPublica", label: "Finalidad pública", valor: "" },
    });
    expect(parsed.success).toBe(true);
  });

  it("rechaza una acción desconocida", () => {
    const parsed = copilotoRequestSchema.safeParse({ accion: "borrar" });
    expect(parsed.success).toBe(false);
  });

  it("aplica valores por defecto (camposLlenos e historial vacíos)", () => {
    const parsed = copilotoRequestSchema.parse({ accion: "revisar" });
    expect(parsed.camposLlenos).toEqual([]);
    expect(parsed.historial).toEqual([]);
    expect(parsed.tipoProcesoSeleccion).toBe("");
  });
});

describe("completarModeloRequestSchema", () => {
  it("acepta un campo objetivo con su molde (plantilla) y lo conserva", () => {
    const parsed = completarModeloRequestSchema.parse({
      tipoProcesoSeleccion: TIPO,
      tipoObjeto: "Servicios",
      camposObjetivo: [
        { api: "finalidadPublica", label: "Finalidad pública", plantilla: "La contratación de [OBJETO] atiende…" },
      ],
    });
    expect(parsed.camposObjetivo[0].plantilla).toContain("[OBJETO]");
  });

  it("un campo sin molde recibe plantilla vacía por defecto", () => {
    const parsed = completarModeloRequestSchema.parse({
      camposObjetivo: [{ api: "entidad", label: "Entidad" }],
    });
    expect(parsed.camposObjetivo[0].plantilla).toBe("");
  });
});

describe("construirMensajesCopiloto", () => {
  it("ancla el prompt a la guía oficial del tipo elegido", () => {
    const mensajes = construirMensajesCopiloto(
      copilotoRequestSchema.parse({ accion: "revisar", tipoProcesoSeleccion: TIPO }),
    );
    const contexto = mensajes.map((m) => m.content).join("\n");
    // El sistema fija el marco normativo.
    expect(contexto).toContain("Ley N.° 32069");
    // El contexto incluye texto real de la guía de ese tipo.
    const primeraGuia = REQUERIMIENTO_GUIA[TIPO][0]?.texto.slice(0, 40) ?? "";
    expect(primeraGuia.length).toBeGreaterThan(0);
    expect(contexto).toContain(primeraGuia);
  });

  it("redactar: incluye el campo objetivo y su valor actual", () => {
    const mensajes = construirMensajesCopiloto(
      copilotoRequestSchema.parse({
        accion: "redactar",
        tipoProcesoSeleccion: TIPO,
        campoObjetivo: { key: "finalidadPublica", label: "Finalidad pública", valor: "Texto previo" },
      }),
    );
    const ultimo = mensajes[mensajes.length - 1];
    expect(ultimo.role).toBe("user");
    expect(ultimo.content).toContain("Finalidad pública");
    expect(ultimo.content).toContain("Texto previo");
  });

  it("redactar: inyecta la estructura obligatoria (molde) y el ejemplo del campo", () => {
    const mensajes = construirMensajesCopiloto(
      copilotoRequestSchema.parse({
        accion: "redactar",
        tipoProcesoSeleccion: TIPO,
        campoObjetivo: {
          key: "finalidadPublica",
          label: "Finalidad pública",
          valor: "",
          plantilla: "La contratación de [OBJETO] atiende la necesidad de [NECESIDAD], promoviendo el valor por dinero.",
          ejemplo: "La contratación del servicio de mantenimiento atiende la necesidad de transitabilidad segura.",
        },
      }),
    );
    const ultimo = mensajes[mensajes.length - 1];
    expect(ultimo.content).toContain("ESTRUCTURA OBLIGATORIA");
    expect(ultimo.content).toContain("atiende la necesidad de [NECESIDAD]");
    expect(ultimo.content).toContain("Ejemplo de referencia");
    expect(ultimo.content).toContain("transitabilidad segura");
  });

  it("redactar: la información ya registrada y el objeto llegan como contexto", () => {
    const mensajes = construirMensajesCopiloto(
      copilotoRequestSchema.parse({
        accion: "redactar",
        tipoObjeto: "Servicios",
        tipoProcesoSeleccion: TIPO,
        campoObjetivo: { key: "finalidadPublica", label: "Finalidad pública", valor: "" },
        camposLlenos: [{ key: "objeto", label: "Objeto de la contratación", valor: "Mantenimiento de vías vecinales" }],
      }),
    );
    const contexto = mensajes.map((m) => m.content).join("\n");
    expect(contexto).toContain("Mantenimiento de vías vecinales");
    expect(contexto).toContain("Servicios");
  });

  it("chat: adjunta el historial antes de la pregunta", () => {
    const mensajes = construirMensajesCopiloto(
      copilotoRequestSchema.parse({
        accion: "chat",
        tipoProcesoSeleccion: TIPO,
        pregunta: "¿Qué garantías debo exigir?",
        historial: [
          { role: "user", content: "Hola" },
          { role: "assistant", content: "Hola, ¿en qué ayudo?" },
        ],
      }),
    );
    const roles = mensajes.map((m) => m.role);
    expect(roles).toContain("assistant");
    const ultimo = mensajes[mensajes.length - 1];
    expect(ultimo.content).toContain("garantías");
  });

  it("camposLlenos filtra los vacíos en el contexto", () => {
    const mensajes = construirMensajesCopiloto(
      copilotoRequestSchema.parse({
        accion: "revisar",
        tipoProcesoSeleccion: TIPO,
        camposLlenos: [
          { key: "objetivo", label: "Objetivo", valor: "Comprar equipos" },
          { key: "alcance", label: "Alcance", valor: "   " },
        ],
      }),
    );
    const contexto = mensajes.map((m) => m.content).join("\n");
    expect(contexto).toContain("Objetivo: Comprar equipos");
    expect(contexto).not.toContain("Alcance:");
  });
});

describe("caché de los campos que exige el modelo", () => {
  // La lista la deriva la IA leyendo el PDF-modelo contra el catálogo de campos
  // de ESE día, y se guardaba en la metadata del documento con el objeto como
  // única clave. Al añadir campos a la ficha —el 26/07 entraron diez— la lista
  // guardada quedaba incompleta y se seguía devolviendo como buena: el aviso
  // «· exige el proceso» no podía señalar nada nuevo.
  const campos = (apis: string[]) => apis.map((api) => ({ api, label: api, seccion: "s" }));

  it("el mismo conjunto de campos da la misma huella, en cualquier orden", () => {
    expect(huellaCatalogo(campos(["a", "b", "c"]))).toBe(huellaCatalogo(campos(["c", "a", "b"])));
  });

  it("añadir un campo cambia la huella, que es lo que invalida la caché", () => {
    const antes = huellaCatalogo(campos(["finalidadPublica", "modalidadPago"]));
    const despues = huellaCatalogo(campos(["finalidadPublica", "modalidadPago", "descripcionGeneral"]));
    expect(despues).not.toBe(antes);
  });

  it("renombrar un campo también la cambia", () => {
    expect(huellaCatalogo(campos(["lugarEntrega"]))).not.toBe(huellaCatalogo(campos(["lugarPrestacion"])));
  });

  it("la huella lleva el número de campos delante, para poder leerla", () => {
    expect(huellaCatalogo(campos(["a", "b", "c"]))).toMatch(/^3-/);
  });
});
