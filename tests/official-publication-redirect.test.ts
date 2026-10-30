import { describe, expect, it } from "vitest";
import { officialPublicationRedirect } from "../lib/library-updates";
describe("redirecciones de publicaciones oficiales", () => {
  const source =
    "https://www.gob.pe/institucion/oece/normas-legales/396705-28716";
  it("permite el traslado de una ficha a otra entidad oficial", () => {
    const target =
      "https://www.gob.pe/institucion/congreso-de-la-republica/normas-legales/396705-28716";
    expect(officialPublicationRedirect(source, target)).toBe(target);
  });
  it("rechaza destinos externos, privados, inseguros o ajenos a fichas", () => {
    for (const target of [
      "https://example.com/a",
      "https://127.0.0.1/a",
      "http://www.gob.pe/a",
      "https://www.gob.pe/login",
    ]) {
      expect(() => officialPublicationRedirect(source, target)).toThrow();
    }
  });
});
