import { describe, expect, it } from "vitest";
import {
  filaAPersonal,
  mapaCabecerasPersonal,
  nombreCompletoPersonal,
  normalizarCabeceraPersonal,
  personalACelda,
  personalActivo,
} from "@/lib/personal";

// Cabeceras reales del personal.XLS que exporta el SIGA.
const CABECERAS = [
  "empleado", "tipo_empleado", "fecha_ingreso", "estado_civil", "sexo_empleado",
  "grado_inst", "estado", "apellido_paterno", "apellido_materno", "nombres",
  "fecha_reg", "cuser_id", "sec_ejec", "entidad_externa", "centro_costo",
  "docum_ident", "codigo_prof", "flag_interno", "nro_colegiatura", "nombre_cc", "nombre_prof",
];

// Una fila real (SILVA CHARAJA HARRY JESUS).
const FILA = [
  "00481570", "F", "4/04/2023", "", "M", "", "A", "SILVA", "CHARAJA", "HARRY JESUS",
  "", "ALIMA", 300308, "", "01050601", "00481570", "", "", "", "OSLIJ", "",
];

describe("nombreCompletoPersonal · orden natural (nombres, apellidos)", () => {
  it("compone 'NOMBRES PATERNO MATERNO' (col. J + H + I)", () => {
    expect(
      nombreCompletoPersonal({ apellidoPaterno: "SILVA", apellidoMaterno: "CHARAJA", nombres: "HARRY JESUS" }),
    ).toBe("HARRY JESUS SILVA CHARAJA");
  });

  it("sin nombres, deja solo los apellidos; sin apellidos, solo los nombres", () => {
    expect(nombreCompletoPersonal({ apellidoPaterno: "QUISPE", apellidoMaterno: "TICONA", nombres: "" }))
      .toBe("QUISPE TICONA");
    expect(nombreCompletoPersonal({ apellidoPaterno: "", apellidoMaterno: "", nombres: "AIDA" })).toBe("AIDA");
    expect(nombreCompletoPersonal({})).toBe("");
  });
});

describe("normalizarCabeceraPersonal", () => {
  it("baja a minúsculas, quita tildes y unifica separadores", () => {
    expect(normalizarCabeceraPersonal("Apellido Paterno")).toBe("apellido_paterno");
    expect(normalizarCabeceraPersonal("DOCUM. IDENT")).toBe("docum_ident");
    expect(normalizarCabeceraPersonal("Profesión")).toBe("profesion");
  });
});

describe("filaAPersonal · mapea la fila del SIGA a nuestro modelo", () => {
  const mapa = mapaCabecerasPersonal(CABECERAS);

  it("detecta las columnas clave del archivo", () => {
    expect(mapa.has("codigo")).toBe(true);
    expect(mapa.has("documento")).toBe(true);
    expect(mapa.has("apellidoPaterno")).toBe(true);
    expect(mapa.has("unidad")).toBe(true); // nombre_cc
  });

  it("traduce una fila real con su nombre completo y su unidad", () => {
    const p = filaAPersonal(FILA, mapa)!;
    expect(p.codigo).toBe("00481570");
    expect(p.documento).toBe("00481570");
    expect(p.nombreCompleto).toBe("HARRY JESUS SILVA CHARAJA");
    expect(p.unidad).toBe("OSLIJ");
    expect(p.estado).toBe("A");
    expect(personalActivo(p)).toBe(true);
  });

  it("sin código de empleado no hay persona (no se puede reconciliar)", () => {
    const sinCodigo = [...FILA];
    sinCodigo[0] = ""; // empleado vacío
    expect(filaAPersonal(sinCodigo, mapa)).toBeNull();
  });

  it("personalACelda vuelca a snake_case con nombre_completo precalculado", () => {
    const p = filaAPersonal(FILA, mapa)!;
    const celda = personalACelda(p);
    expect(celda.codigo).toBe("00481570");
    expect(celda.nombre_completo).toBe("HARRY JESUS SILVA CHARAJA");
    expect(celda.unidad).toBe("OSLIJ");
    expect(celda.apellido_paterno).toBe("SILVA");
  });
});

describe("personalActivo", () => {
  it("solo 'A' (en cualquier caja) es activo", () => {
    expect(personalActivo({ estado: "A" })).toBe(true);
    expect(personalActivo({ estado: "a" })).toBe(true);
    expect(personalActivo({ estado: "I" })).toBe(false);
    expect(personalActivo({ estado: null })).toBe(false);
  });
});
