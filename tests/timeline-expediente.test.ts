import { describe, expect, it } from "vitest";
import {
  entradasDeAuditoria,
  entradasDePasos,
  unirTimeline,
  type EventoAuditoria,
} from "@/lib/timeline-expediente";

const evento = (extra: Partial<EventoAuditoria>): EventoAuditoria => ({
  action: "process.create",
  actor_reference: "juan@municipalidad.gob.pe",
  created_at: "2026-07-22T17:51:51.000Z",
  details: null,
  ...extra,
});

describe("eventos de auditoría", () => {
  it("traduce las acciones conocidas a lenguaje del usuario", () => {
    const [e] = entradasDeAuditoria([evento({ action: "necesidad.derivar" })]);
    expect(e.label).toBe("Expediente derivado de la necesidad");
    expect(e.tipo).toBe("creacion");
  });

  it("omite las acciones que no sabe traducir", () => {
    // Enseñar "search.hybrid" en crudo convierte la línea de tiempo en un log de
    // servidor: una entrada que el usuario no entiende estorba, no informa.
    expect(entradasDeAuditoria([evento({ action: "search.hybrid" })])).toEqual([]);
    expect(entradasDeAuditoria([evento({ action: "chat.message" })])).toEqual([]);
  });

  it("omite el autoguardado de pasos, que se dispara decenas de veces", () => {
    // Este expediente tiene diez `process.hito.update` del mismo puñado de pasos.
    // Los pasos entran por su `doneAt`, que marca cuándo se COMPLETARON.
    expect(entradasDeAuditoria([evento({ action: "process.hito.update" })])).toEqual([]);
  });

  it("precisa el hecho con el detalle cuando lo hay", () => {
    const [e] = entradasDeAuditoria([
      evento({
        action: "process.document.formato_archivado",
        details: { titulo: "Anexo N° 2 — Aprobación del expediente" },
      }),
    ]);
    expect(e.label).toBe("Formato generado y archivado: Anexo N° 2 — Aprobación del expediente");
  });

  it("conserva el autor", () => {
    const [e] = entradasDeAuditoria([evento({})]);
    expect(e.actor).toBe("juan@municipalidad.gob.pe");
  });

  it("no enseña 'system' como si fuera una persona", () => {
    const [e] = entradasDeAuditoria([evento({ actor_reference: "system" })]);
    expect(e.actor).toBeUndefined();
  });
});

describe("pasos completados", () => {
  const etiqueta = (code: string) => (code === "A4" ? "Estrategia de contratación" : code);

  it("entra el paso hecho, con su etiqueta legible", () => {
    const [e] = entradasDePasos(
      { A4: { status: "hecho", doneAt: "2026-07-22T20:00:00.000Z" } },
      etiqueta,
    );
    expect(e.label).toBe("A4 · Estrategia de contratación completado");
    expect(e.tipo).toBe("paso");
  });

  it("un paso en curso no es un hecho de la historia", () => {
    expect(
      entradasDePasos({ A1: { status: "en_curso", doneAt: "2026-07-22T18:00:00.000Z" } }, etiqueta),
    ).toEqual([]);
  });

  it("un paso hecho sin fecha no se inventa una", () => {
    expect(entradasDePasos({ A1: { status: "hecho", doneAt: null } }, etiqueta)).toEqual([]);
  });

  it("los marcados 'no aplica' no entran: no ocurrió nada", () => {
    expect(
      entradasDePasos({ A2: { status: "na", doneAt: "2026-07-22T19:00:00.000Z" } }, etiqueta),
    ).toEqual([]);
  });

  it("sin hitos no revienta", () => {
    expect(entradasDePasos(null, etiqueta)).toEqual([]);
    expect(entradasDePasos(undefined, etiqueta)).toEqual([]);
  });
});

describe("unión y orden", () => {
  it("ordena de lo más reciente a lo más antiguo", () => {
    // Con veinte entradas, lo último que pasó es lo que se busca al abrir el
    // panel; antes quedaba al final, fuera de la vista.
    const r = unirTimeline([
      { at: "2026-07-20T10:00:00.000Z", label: "viejo", tipo: "creacion" },
      { at: "2026-07-22T10:00:00.000Z", label: "nuevo", tipo: "documento" },
    ]);
    expect(r.map((e) => e.label)).toEqual(["nuevo", "viejo"]);
  });

  it("descarta el mismo hecho contado dos veces", () => {
    // "Expediente creado" llega por `created_at` y por el registro de auditoría,
    // con segundos de diferencia.
    const r = unirTimeline(
      [{ at: "2026-07-22T17:51:51.046Z", label: "Expediente creado", tipo: "creacion" }],
      [{ at: "2026-07-22T17:51:51.406Z", label: "Expediente creado", tipo: "creacion" }],
    );
    expect(r).toHaveLength(1);
  });

  it("no confunde dos hechos distintos con la misma fecha", () => {
    const r = unirTimeline([
      { at: "2026-07-22T17:51:51.000Z", label: "Uno", tipo: "creacion" },
      { at: "2026-07-22T17:51:51.000Z", label: "Dos", tipo: "documento" },
    ]);
    expect(r).toHaveLength(2);
  });

  it("descarta las entradas sin fecha en vez de ponerlas al azar", () => {
    const r = unirTimeline([{ at: "", label: "Sin fecha", tipo: "creacion" }]);
    expect(r).toEqual([]);
  });
});

describe("autor ilegible", () => {
  it("un UUID no se enseña como si fuera una persona", () => {
    // `process.detect_risks` guarda el id del usuario, no su correo. Un UUID
    // ocupa una línea entera y no responde "¿quién hizo esto?".
    const [e] = entradasDeAuditoria([
      evento({ actor_reference: "c26b5e32-cde4-4ee9-ba00-302197162ba3" }),
    ]);
    expect(e.actor).toBeUndefined();
  });

  it("un correo sí", () => {
    const [e] = entradasDeAuditoria([evento({ actor_reference: "juan@mdch.gob.pe" })]);
    expect(e.actor).toBe("juan@mdch.gob.pe");
  });
});

describe("creación contada dos veces", () => {
  it("se queda la versión que dice de qué necesidad salió", () => {
    const r = unirTimeline(
      [{ at: "2026-07-22T17:51:51.046Z", label: "Expediente creado", tipo: "creacion" }],
      [
        {
          at: "2026-07-22T17:51:51.406Z",
          label: "Expediente derivado de la necesidad: REQ-2026-0018",
          tipo: "creacion",
        },
      ],
    );
    expect(r).toHaveLength(1);
    expect(r[0].label).toContain("REQ-2026-0018");
  });

  it("dos creaciones de fechas distintas no se funden", () => {
    const r = unirTimeline([
      { at: "2026-07-22T17:51:00.000Z", label: "Expediente creado", tipo: "creacion" },
      { at: "2026-07-23T09:00:00.000Z", label: "Otra cosa", tipo: "creacion" },
    ]);
    expect(r).toHaveLength(2);
  });
});
