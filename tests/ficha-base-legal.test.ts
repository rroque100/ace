import { describe, expect, it } from "vitest";
import { FICHA_SECCIONES, type FichaField } from "@/lib/necesidad-ficha-secciones";

// El requerimiento se sustenta en la Ley 32069 y su Reglamento (D.S. 009-2025-EF)
// y en NINGUNA otra norma. No es purismo: meter aquí normativa general —o la
// derogada Ley 30225— desplaza el fundamento propio de la contratación y deja
// citas que el área usuaria no puede contrastar con el formato que está
// llenando. Este test evita que se cuelen por descuido.

const campos = (): FichaField[] => FICHA_SECCIONES.flatMap((s) => s.fields);

/** Normas cuya mención en una base legal delata un fundamento ajeno o caduco. */
const NORMAS_PROHIBIDAS = [
  /\bley\s*30225\b/i, // régimen anterior, derogado por la Ley 32069
  /\bley\s*27444\b/i, // procedimiento administrativo general
  /\bd\.?\s*s\.?\s*344-2018\b/i, // reglamento del régimen anterior
  /\bopini[oó]n\b/i, // opiniones del OECE/OSCE: no son la norma
  /\bdirectiva\b/i,
];

describe("las bases legales de la ficha solo citan la Ley 32069 y su Reglamento", () => {
  for (const campo of campos()) {
    if (!campo.baseLegal) continue;
    it(`${campo.api}: sin normativa ajena`, () => {
      for (const prohibida of NORMAS_PROHIBIDAS) {
        expect(campo.baseLegal, `«${campo.label}» cita ${prohibida}`).not.toMatch(prohibida);
      }
    });
  }

  it("cuando se nombra una ley, es la 32069", () => {
    const otras = campos()
      .flatMap((c) => (c.baseLegal ?? "").match(/\bley\s*\d+\b/gi) ?? [])
      .filter((cita) => !/32069/.test(cita));
    expect(otras).toEqual([]);
  });
});

describe("Finalidad pública lleva la fórmula del Art. 44.1", () => {
  const finalidad = (): FichaField => {
    const f = campos().find((c) => c.api === "finalidadPublica");
    if (!f) throw new Error("Falta el campo finalidadPublica");
    return f;
  };

  it("es obligatorio y se redacta como párrafo", () => {
    expect(finalidad().obligatorio).toBe(true);
    expect(finalidad().kind).toBe("textarea");
  });

  it("la plantilla reproduce las tres piezas del Art. 44.1, en orden", () => {
    // "atienden una NECESIDAD para el cumplimiento de la FINALIDAD PÚBLICA,
    //  promoviendo el VALOR POR DINERO"
    const plantilla = (finalidad().plantilla ?? "").toLowerCase();
    const necesidad = plantilla.indexOf("necesidad");
    const finalidadPublica = plantilla.indexOf("finalidad pública");
    const valorPorDinero = plantilla.indexOf("valor por dinero");

    expect(necesidad, "la plantilla no nombra la necesidad").toBeGreaterThan(-1);
    expect(finalidadPublica, "la plantilla no nombra la finalidad pública").toBeGreaterThan(-1);
    expect(valorPorDinero, "la plantilla no nombra el valor por dinero").toBeGreaterThan(-1);
    // El orden importa: la necesidad se atiende PARA cumplir la finalidad, y esa
    // decisión PROMUEVE el valor por dinero. Invertirlo cambia el razonamiento.
    expect(necesidad).toBeLessThan(finalidadPublica);
    expect(finalidadPublica).toBeLessThan(valorPorDinero);
  });

  it("deja huecos que el área usuaria debe rellenar", () => {
    expect(finalidad().plantilla).toMatch(/\[.+?\]/);
  });

  it("la base legal cita el Art. 44.1 del Reglamento", () => {
    expect(finalidad().baseLegal).toMatch(/44\.1/);
    expect(finalidad().baseLegal).toMatch(/reglamento/i);
  });
});

describe("los artículos citados dicen lo que el campo afirma", () => {
  // Contrastado contra el texto indexado en `norma_articulos` el 2026-07-26. La
  // ficha citaba seis artículos que hablan de otra cosa: la meta presupuestal se
  // apoyaba en el Art. 7 de la Ley (supuestos EXCLUIDOS del ámbito), el año
  // fiscal en el Art. 8 (acuerdos comerciales), la fuente de financiamiento en el
  // Art. 9 (actores del proceso), el objetivo del PEI en el Art. 6 (enfoques de
  // la Ley), la programación en el Art. 42 del Reglamento (segmentación de
  // contrataciones) y la penalidad por mora en el Art. 161 (modalidades de pago
  // para OBRAS, en una ficha que también sirve a servicios).
  const campo = (api: string): FichaField => {
    const f = campos().find((c) => c.api === api);
    if (!f) throw new Error(`Falta el campo ${api}`);
    return f;
  };
  const base = (api: string) => campo(api).baseLegal ?? "";

  it("la penalidad por mora se apoya en el Art. 120, no en el de obras", () => {
    expect(base("penalidadMora")).toMatch(/Art\.\s*120/);
    expect(base("penalidadMora")).not.toMatch(/Art\.\s*161/);
  });

  it("adelanto, garantías y conformidad citan su artículo, no «Reglamento» a secas", () => {
    expect(base("adelantoDirecto")).toMatch(/Art\.\s*137/);
    expect(base("garantias")).toMatch(/Art\.\s*138/);
    expect(base("recepcionConformidad")).toMatch(/Art\.\s*144/);
  });

  it("la programación no se apoya en el artículo de segmentación", () => {
    // El Art. 42 del Reglamento es «Segmentación de contrataciones»: no dice nada
    // del CMN ni del PAC. El CMN/PAC no está regulado en la Ley ni en el
    // Reglamento indexados, así que estos campos se explican SIN citar artículo
    // antes que citar uno que no los sostiene.
    for (const api of ["periodoProgramacion", "trimestre", "mesProgramado", "peiAccion", "poiActividad"]) {
      expect(base(api), api).not.toMatch(/Art\.\s*42/);
    }
  });

  it("los datos presupuestales no se apoyan en artículos institucionales de la Ley", () => {
    for (const api of ["anioFiscal", "metaPresupuestal", "fuenteFinanciamiento", "peiObjetivo"]) {
      expect(base(api), api).not.toMatch(/Art\.\s*[6789]\b/);
    }
  });

  it("ningún campo se apoya en «Reglamento» a secas, sin decir qué artículo", () => {
    // Se mira solo cuando el texto ATRIBUYE algo al Reglamento, es decir cuando
    // abre con «Reglamento ·». Decir que el Reglamento NO regula algo —el plazo
    // para respuestas entre las partes sale del formato, no de la norma— es
    // información legítima y no una cita vaga.
    for (const c of campos()) {
      const bl = (c.baseLegal ?? "").trim();
      if (!bl.toLowerCase().startsWith("reglamento")) continue;
      expect(bl, `«${c.label}» se apoya en el Reglamento sin decir qué artículo`).toMatch(/Art\.\s*\d/);
    }
  });
});
