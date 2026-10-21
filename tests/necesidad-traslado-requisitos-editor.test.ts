import { describe, expect, it } from "vitest";
import { parseRequisitos, repartirRequisitos } from "@/lib/requisitos-calificacion";

// Contrato entre la extracción de la propuesta IA y el editor de requisitos.
//
// El campo 3.5.1 no es texto libre: alimenta un editor donde cada tipo del
// Art. 72.3 tiene un ESTADO (No aplica / Obligatorio / Facultativo) y dos
// casillas, «¿Qué se exige exactamente?» y «¿Con qué se acredita?». Antes el
// traslado escribía prosa y todo caía en el cajón de heredados: el campo se veía
// lleno pero sin un solo tipo registrado.
//
// Este texto es la SALIDA REAL del modelo con el formato impuesto, verificada
// contra Gemini. Si el prompt se afloja, estos tests caen.
const DE_LA_IA =
  "OBLIGATORIOS:\n" +
  "- Capacidad legal: El postor debe contar con inscripcion vigente en el RNP, capitulo de bienes — Acredita: con la constancia de inscripcion vigente del RNP\n" +
  "- Experiencia del postor en la especialidad: Monto facturado acumulado de hasta S/ 18,750.00 en bienes iguales o similares en los ultimos cinco (5) anios — Acredita: con copia de contratos y sus respectivas conformidades\n" +
  "FACULTATIVOS:\n" +
  "- Condiciones de participacion en consorcio: maximo dos (2) consorciados con participacion minima de 30% cada uno — Acredita: con la promesa de consorcio — Sustento: para asegurar responsabilidad solidaria";

const reparto = repartirRequisitos(parseRequisitos(DE_LA_IA));

describe("el traslado calza en los campos del editor del 72.3", () => {
  it("lo que la propuesta exige queda en estado OBLIGATORIO", () => {
    expect(reparto.porTipo.get("capacidad_legal")?.estado).toBe("obligatorio");
    expect(reparto.porTipo.get("experiencia_postor")?.estado).toBe("obligatorio");
  });

  it("lo que la propuesta presenta como adicional queda en FACULTATIVO", () => {
    expect(reparto.porTipo.get("consorcio")?.estado).toBe("facultativo");
  });

  it('un tipo que la propuesta declara "No aplica" no se registra: queda en «No aplica»', () => {
    // La propuesta decía «C. CAPACIDAD TÉCNICA Y PROFESIONAL — No aplica».
    // Ausente del texto ⇒ el editor lo muestra como "No aplica", que es lo que
    // se quiere decir. Registrarlo con detalle vacío sería afirmar otra cosa.
    expect(reparto.porTipo.has("capacidad_tecnica")).toBe(false);
  });

  it("«¿Qué se exige exactamente?» recibe el detalle, sin la acreditación", () => {
    const legal = reparto.porTipo.get("capacidad_legal")!;
    expect(legal.detalle).toBe("El postor debe contar con inscripcion vigente en el RNP, capitulo de bienes");
    expect(legal.detalle).not.toContain("Acredita");
  });

  it("«¿Con qué se acredita?» recibe su propio segmento", () => {
    expect(reparto.porTipo.get("capacidad_legal")?.acreditacion).toBe(
      "con la constancia de inscripcion vigente del RNP",
    );
    expect(reparto.porTipo.get("experiencia_postor")?.acreditacion).toContain("contratos");
  });

  it("el sustento solo llega en los facultativos, que son los que la DEC puede excluir", () => {
    expect(reparto.porTipo.get("consorcio")?.sustento).toBe("para asegurar responsabilidad solidaria");
    expect(reparto.porTipo.get("capacidad_legal")?.sustento).toBe("");
  });

  it("nada acaba en el cajón de «heredados»", () => {
    expect(reparto.otrosObligatorios).toEqual([]);
    expect(reparto.otrosFacultativos).toEqual([]);
  });

  it("las etiquetas se reconocen aunque vengan sin tildes", () => {
    // El modelo escribe "Condiciones de participacion en consorcio"; el mapeo
    // normaliza diacríticos, así que casa igual.
    expect(reparto.porTipo.has("consorcio")).toBe(true);
  });
});
