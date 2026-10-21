import { describe, expect, it } from "vitest";
import {
  avanceDeObligatorios,
  camposAplicables,
  camposVisiblesDeSeccion,
  type EjesFicha,
  esCampoExigible,
  esCampoObligatorio,
  obligatoriosDelProceso,
} from "@/lib/necesidad-ficha-derivar";
import { FICHA_SECCIONES, type FichaField } from "@/lib/necesidad-ficha-secciones";
import { objetosEfectivosDe } from "@/lib/necesidad-ficha-secciones";
import type { ObjetoFilter } from "@/lib/procesos-seleccion";

/**
 * Reglas que deciden QUE campos ve el area usuaria. Vivian dentro del componente
 * de detalle y no se podian probar sin renderizar. Estas pruebas son de Node
 * (no montan React) y recorren el catalogo entero, que es lo que detecta que una
 * seccion o un proceso nuevo se quede sin clasificar.
 */
function ejesDe(objeto: ObjetoFilter | "", exigidos: string[] = [], hayItems = false): EjesFicha {
  return {
    proceso: "",
    objeto,
    objetosEfectivos: objetosEfectivosDe("", (objeto || undefined) as ObjetoFilter | undefined),
    exigidosModelo: new Set(exigidos),
    hayItems,
  };
}

const campo = (extra: Partial<FichaField>): FichaField => ({
  col: "nombre",
  api: "campoDePrueba",
  label: "Campo de prueba",
  ...extra,
});

describe("esCampoObligatorio", () => {
  it("el obligatorio incondicional lo es para cualquier eje", () => {
    expect(esCampoObligatorio(campo({ obligatorio: true }), ejesDe("bienes"))).toBe(true);
    expect(esCampoObligatorio(campo({ obligatorio: true }), ejesDe("servicios"))).toBe(true);
  });

  it("un campo de UNA prestacion deja de exigirse cuando el requerimiento tiene items", () => {
    const f = campo({ obligatorio: true, noExigibleConItems: true });
    expect(esCampoObligatorio(f, ejesDe("bienes", [], false))).toBe(true);
    expect(esCampoObligatorio(f, ejesDe("bienes", [], true))).toBe(false);
  });
});

describe("esCampoExigible: la ficha MAS el modelo", () => {
  it("lo que el modelo lista se vuelve exigible aunque no sea obligatorio de base", () => {
    const f = campo({ api: "campoModelo" });
    expect(esCampoExigible(f, ejesDe("bienes", []))).toBe(false);
    expect(esCampoExigible(f, ejesDe("bienes", ["campoModelo"]))).toBe(true);
  });
});

describe("camposAplicables", () => {
  it("nunca devuelve campos ocultos", () => {
    for (const section of FICHA_SECCIONES) {
      const aplicables = camposAplicables(section.fields, ejesDe("bienes"));
      expect(aplicables.every((f) => !f.oculto)).toBe(true);
    }
  });
});

describe("obligatoriosDelProceso: el modelo SUMA, no resta", () => {
  // Es el fallo que ya ocurrio una vez: con el PDF-modelo cargado, «Finalidad
  // publica» o «Area usuaria» dejaban de contar como obligatorios si la IA no
  // los habia listado. Un modelo no puede degradar un obligatorio de base.
  for (const objeto of ["bienes", "servicios", "obras", "consultoria_obra"] as ObjetoFilter[]) {
    it(`ningun obligatorio de base desaparece al cargar un modelo (${objeto})`, () => {
      const sinModelo = obligatoriosDelProceso(ejesDe(objeto, []));
      const conModelo = obligatoriosDelProceso(ejesDe(objeto, ["campoQueNoExisteEnLaFicha"]));
      const apisConModelo = new Set(conModelo.map((f) => f.api));
      for (const f of sinModelo) {
        expect(apisConModelo.has(f.api), `«${f.api}» se perdio al cargar el modelo`).toBe(true);
      }
    });
  }

  it("hay obligatorios de base para bienes (el catalogo no quedo vacio)", () => {
    expect(obligatoriosDelProceso(ejesDe("bienes")).length).toBeGreaterThan(0);
  });
});

describe("camposVisiblesDeSeccion", () => {
  const ejes = ejesDe("bienes");

  it("con «mostrar todos» no oculta nada", () => {
    for (const section of FICHA_SECCIONES) {
      const { visibles, ocultosOpcionales } = camposVisiblesDeSeccion(section, ejes, {
        mostrarTodos: true,
        tieneValor: () => false,
      });
      expect(ocultosOpcionales).toBe(0);
      expect(visibles.length).toBe(camposAplicables(section.fields, ejes).length);
    }
  });

  it("los subgrupos nunca se parten: cada apartado sale en un bloque contiguo", () => {
    for (const section of FICHA_SECCIONES) {
      const { visibles } = camposVisiblesDeSeccion(section, ejes, {
        mostrarTodos: true,
        tieneValor: () => false,
      });
      const vistos = new Set<string>();
      let anterior: string | null = null;
      for (const f of visibles) {
        const clave = f.subgrupo ?? "";
        if (clave !== anterior) {
          expect(vistos.has(clave), `el subgrupo «${clave}» aparece partido en ${section.title}`).toBe(false);
          vistos.add(clave);
          anterior = clave;
        }
      }
    }
  });

  it("un opcional ya relleno no se oculta en «solo obligatorios»", () => {
    // El opcional se conserva si tiene valor: ocultar un dato escrito seria
    // hacerlo desaparecer sin avisar.
    const seccionConOpcional = FICHA_SECCIONES.find((s) =>
      camposAplicables(s.fields, ejes).some((f) => !esCampoObligatorio(f, ejes) && !f.recomendado),
    );
    if (!seccionConOpcional) return;
    const opcional = camposAplicables(seccionConOpcional.fields, ejes).find(
      (f) => !esCampoObligatorio(f, ejes) && !f.recomendado,
    )!;
    const { visibles } = camposVisiblesDeSeccion(seccionConOpcional, ejes, {
      mostrarTodos: false,
      tieneValor: (f) => f.api === opcional.api,
    });
    expect(visibles.some((f) => f.api === opcional.api)).toBe(true);
  });
});

describe("avanceDeObligatorios", () => {
  const campos = [campo({ api: "a" }), campo({ api: "b" }), campo({ api: "c" }), campo({ api: "d" })];

  it("cuenta hechos y calcula el porcentaje", () => {
    const hechos = new Set(["a", "b"]);
    expect(avanceDeObligatorios(campos, (f) => hechos.has(f.api))).toEqual({
      done: 2,
      faltan: 2,
      pct: 50,
      total: 4,
    });
  });

  it("sin campos el porcentaje es 0, no NaN", () => {
    expect(avanceDeObligatorios([], () => true)).toEqual({ done: 0, faltan: 0, pct: 0, total: 0 });
  });
});
