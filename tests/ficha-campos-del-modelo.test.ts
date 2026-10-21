import { describe, expect, it } from "vitest";
import {
  campoAplica,
  campoObligatorio,
  FICHA_SECCIONES,
  objetosEfectivosDe,
} from "@/lib/necesidad-ficha-secciones";

/**
 * La ficha no puede esconder un campo que el modelo del procedimiento exige.
 *
 * Se descubrió generando el Word de REQ-2026-0018 (bienes): faltaban las letras
 * b) Sistema de entrega y g) Subcontratación. El PDF-modelo de Licitación
 * Pública abreviada PARA BIENES las trae, y el catálogo de la ficha las limitaba
 * a servicios, obras y consultoría de obra.
 *
 * Con el campo escondido, el área usuaria no tenía dónde escribirlo y el
 * documento salía con dos apartados que nadie podía rellenar.
 *
 * El barrido completo —los quince modelos contra los cuatro objetos— vive en
 * `scripts/generar-requerimiento-docx.mts` y en la consulta que lo encontró;
 * aquí se fija el resultado, que es lo que se puede comprobar sin base de datos.
 */
const CAMPO = (api: string) => FICHA_SECCIONES.flatMap((s) => s.fields).find((f) => f.api === api);

describe("los apartados que el modelo de bienes trae están en la ficha", () => {
  for (const api of ["sistemaEntrega", "subcontratacion"]) {
    it(`«${api}» se muestra cuando el objeto es bienes`, () => {
      const field = CAMPO(api);
      expect(field, `el campo ${api} ya no existe en el catálogo`).toBeDefined();
      expect(campoAplica(field!, objetosEfectivosDe("", "bienes"), "")).toBe(true);
    });
  }

  it("y siguen mostrándose en los otros tres objetos", () => {
    // El arreglo fue AÑADIR bienes, no mover el campo de sitio.
    for (const api of ["sistemaEntrega", "subcontratacion"]) {
      for (const objeto of ["servicios", "obras", "consultoria_obra"] as const) {
        expect(campoAplica(CAMPO(api)!, objetosEfectivosDe("", objeto), ""), `${api} · ${objeto}`).toBe(true);
      }
    }
  });
});

describe("el sistema de entrega es obligatorio en bienes", () => {
  it("lo exige el formato, igual que en obras y consultoría de obra", () => {
    // Verse y ser obligatorio son dos cosas distintas: primero se abrió el campo
    // a bienes, y después se confirmó que el formato además lo EXIGE.
    for (const objeto of ["bienes", "obras", "consultoria_obra"] as const) {
      expect(
        campoObligatorio(CAMPO("sistemaEntrega")!, objetosEfectivosDe("", objeto), ""),
        objeto,
      ).toBe(true);
    }
  });

  it("la subcontratación NO se vuelve obligatoria de rebote", () => {
    // Se abrió a bienes junto con el sistema de entrega, pero es opcional en
    // todos los objetos y no se consultó cambiar eso.
    for (const objeto of ["bienes", "servicios", "obras", "consultoria_obra"] as const) {
      expect(
        campoObligatorio(CAMPO("subcontratacion")!, objetosEfectivosDe("", objeto), ""),
        objeto,
      ).toBe(false);
    }
  });
});
