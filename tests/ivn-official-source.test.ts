import { describe, expect, it } from "vitest";
import {
  isOeceCatalogue,
  parseOeceCatalogue,
  proposedOfficialType,
} from "../lib/oece-official-source";
import { syncListingTypeMatches } from "../lib/document-sync-policy";
const base =
  "https://www.gob.pe/institucion/oece/informes-publicaciones?filter%5Bterms%5D=IVN";
const filter = '<input name="filter[terms]" value="IVN" />';
describe("vigilancia oficial IVN", () => {
  it("admite el catálogo oficial de informes", () => {
    expect(isOeceCatalogue(base)).toBe(true);
    expect(
      isOeceCatalogue("https://www.gob.pe/institucion/oece/noticias"),
    ).toBe(false);
  });
  it.each([
    "Informe IVN N.° 045-2025/DGR",
    "INFORME DE VICIOS DE NULIDAD N° 012-2026/OECE-DSAT",
  ])("reconoce el original %s", (title) => {
    expect(proposedOfficialType(title)).toBe("informe_vicio_nulidad");
  });
  it("no transforma una resolución o mención en informe IVN", () => {
    expect(
      proposedOfficialType("Resolución N° 092-2025: Informe IVN 045-2025"),
    ).toBe("resolucion");
    expect(
      proposedOfficialType("Informe de evaluación institucional con IVN"),
    ).toBeNull();
    expect(
      syncListingTypeMatches("resolucion", ["informe_vicio_nulidad"]),
    ).toBe(false);
    expect(syncListingTypeMatches(null, ["informe_vicio_nulidad"])).toBe(false);
  });
  it("extrae PDF, número y procedencia sin IA", () => {
    const html =
      filter +
      '<ul class="js-reports-search-results"><li><a href="/institucion/oece/informes-publicaciones/123-informe-ivn">Informe IVN N° 045-2025/DGR</a><time datetime="2025-03-21">Fecha</time><a href="https://cdn.www.gob.pe/ivn.pdf">Descargar</a></li></ul>';
    const x = parseOeceCatalogue(html, base);
    expect(x.items[0]).toMatchObject({
      detectedType: "informe_vicio_nulidad",
      number: "045-2025/DGR",
      publicationDate: "2025-03-21",
      url: "https://cdn.www.gob.pe/ivn.pdf",
    });
  });
  it("no declara éxito si la fuente ignoró el filtro", () => {
    expect(() =>
      parseOeceCatalogue(
        '<input name="filter[terms]" value="" /><ul class="js-reports-search-results"></ul>',
        base,
      ),
    ).toThrow("filtro");
  });
  it("admite cero resultados comprobados y conserva otras políticas", () => {
    expect(
      parseOeceCatalogue(
        filter + '<ul class="js-reports-search-results"></ul>',
        base,
      ).items,
    ).toEqual([]);
    expect(syncListingTypeMatches(null, ["ley"])).toBe(true);
    expect(
      syncListingTypeMatches("informe_vicio_nulidad", [
        "informe_vicio_nulidad",
      ]),
    ).toBe(true);
  });
});
