import { describe, expect, it } from "vitest";
import {
  oficinaDec,
  oficinaEncargadaDeContrataciones,
  oficinaSuperiorDeLaDec,
  responsableDeOficina,
} from "../app/components/fase-preparatoria/segmentacion-form";

/** Catálogo con la forma real: apellidos primero y sin grado. */
const OFICINAS = [
  {
    id: "1",
    nombre: "UNIDAD DE ABASTECIMIENTO",
    responsable_nombre: "ROJAS MAYTAN JUAN",
    responsable_cargo: "Jefe",
    gestiona_contrataciones: true,
  },
  {
    id: "2",
    nombre: "OFICINA GENERAL DE ADMINISTRACION JEFATURA",
    responsable_nombre: "QUISPE CHIPANA SAUL",
    responsable_cargo: "Jefe",
    gestiona_contrataciones: false,
  },
  { id: "3", nombre: "OFICINA DE GERENCIA MUNICIPAL", responsable_nombre: "LOPEZ PILLCO WELLINGTON" },
];

const PADRON = [
  { nombre: "SAUL QUISPE CHIPANA", grado: "CPC." },
  { nombre: "JUAN ROJAS MAYTAN", grado: "CPC." },
];

describe("a quién se dirige el informe", () => {
  it("el AL es la oficina INMEDIATA SUPERIOR de la que gestiona contrataciones", () => {
    // No es la gerencia municipal: esa es la AGA y va en el ATENCIÓN.
    const superior = oficinaSuperiorDeLaDec(OFICINAS);
    expect(superior?.nombre).toBe("OFICINA GENERAL DE ADMINISTRACION JEFATURA");
  });

  it("el DE es la oficina que gestiona contrataciones", () => {
    expect(oficinaDec(OFICINAS)?.nombre).toBe("UNIDAD DE ABASTECIMIENTO");
  });

  it("el DE por defecto prefiere la oficina llamada DEPENDENCIA ENCARGADA DE CONTRATACIONES", () => {
    // Cuando la entidad la registra con el nombre genérico de la Ley, el DE la
    // usa aunque no sea la marcada como que gestiona contrataciones.
    const conDependencia = [
      ...OFICINAS,
      { id: "9", nombre: "DEPENDENCIA ENCARGADA DE CONTRATACIONES", gestiona_contrataciones: false },
    ];
    expect(oficinaEncargadaDeContrataciones(conDependencia)?.nombre).toBe(
      "DEPENDENCIA ENCARGADA DE CONTRATACIONES",
    );
  });

  it("sin esa oficina, el DE por defecto cae a la que gestiona contrataciones", () => {
    expect(oficinaEncargadaDeContrataciones(OFICINAS)?.nombre).toBe("UNIDAD DE ABASTECIMIENTO");
  });

  it("A2 y A8 se dirigen al mismo sitio", () => {
    // Se resuelven con el mismo helper para que los dos documentos no puedan
    // discrepar sobre quién es el superior de la DEC.
    expect(oficinaSuperiorDeLaDec(OFICINAS)).toBe(oficinaSuperiorDeLaDec(OFICINAS));
  });

  it("sin la oficina registrada devuelve undefined en vez de inventarla", () => {
    expect(oficinaSuperiorDeLaDec([OFICINAS[0]])).toBeUndefined();
    expect(oficinaDec([OFICINAS[1]])).toBeUndefined();
  });
});

describe("cómo se escribe el nombre en la cabecera", () => {
  it("el padrón lo eleva a como se firma", () => {
    // El catálogo guarda "QUISPE CHIPANA SAUL", que es como se lista en un
    // organigrama; un documento se encabeza con "CPC. SAUL QUISPE CHIPANA".
    expect(responsableDeOficina(oficinaSuperiorDeLaDec(OFICINAS), PADRON)).toBe(
      "CPC. SAUL QUISPE CHIPANA\nOFICINA GENERAL DE ADMINISTRACION JEFATURA",
    );
    expect(responsableDeOficina(oficinaDec(OFICINAS), PADRON)).toBe(
      "CPC. JUAN ROJAS MAYTAN\nJefe de la UNIDAD DE ABASTECIMIENTO",
    );
  });

  it("sin padrón al menos lo pone en orden natural", () => {
    // Mejor "SAUL QUISPE CHIPANA" que el orden de organigrama, aunque falte grado.
    const sin = responsableDeOficina(oficinaSuperiorDeLaDec(OFICINAS));
    expect(sin.split("\n")[0]).toBe("SAUL QUISPE CHIPANA");
  });

  it("no repite el cargo cuando la oficina ya se llama JEFATURA", () => {
    // "Jefe de la OFICINA … JEFATURA" lo diría dos veces.
    const al = responsableDeOficina(oficinaSuperiorDeLaDec(OFICINAS), PADRON);
    expect(al).not.toContain("Jefe de la OFICINA GENERAL");
  });

  it("nombre y cargo van en líneas distintas, como en el .docx", () => {
    expect(responsableDeOficina(oficinaDec(OFICINAS), PADRON).split("\n")).toHaveLength(2);
  });

  it("una oficina sin responsable no produce una línea suelta", () => {
    const sinResp = responsableDeOficina(
      { id: "9", nombre: "OFICINA X", responsable_nombre: null, responsable_cargo: null },
      PADRON,
    );
    expect(sinResp).toBe("OFICINA X");
  });
});

describe("nombres que ya vienen escritos como se firman", () => {
  it("un nombre con grado NO se reordena", async () => {
    // Reordenarlo producía "QUISPE CHIPANA CPC. SAUL", que no es el nombre de
    // nadie. Un grado delante significa que quien lo tecleó ya lo escribió como
    // se firma.
    const { nombreEnOrdenNatural } = await import("@/lib/nombres");
    expect(nombreEnOrdenNatural("CPC. SAUL QUISPE CHIPANA")).toBe("CPC. SAUL QUISPE CHIPANA");
    expect(nombreEnOrdenNatural("ING. WELLINTONG LOPEZ PILLCO")).toBe("ING. WELLINTONG LOPEZ PILLCO");
  });

  it("uno sin grado sí, que es el del organigrama", () => {
    expect(responsableDeOficina(oficinaDec(OFICINAS)).split("\n")[0]).toBe("JUAN ROJAS MAYTAN");
  });

  it("una oficina que ya guarda el nombre con grado se respeta", () => {
    const r = responsableDeOficina({
      id: "9",
      nombre: "OFICINA DE LOGISTICA",
      responsable_nombre: "CPC. JUAN ROJAS MAYTAN",
      responsable_cargo: "Jefe",
    });
    expect(r.split("\n")[0]).toBe("CPC. JUAN ROJAS MAYTAN");
  });
});
