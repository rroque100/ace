import { describe, expect, it } from "vitest";
import { esIdSeguro } from "@/lib/supabase-server";

// Los endpoints de configuración interpolan el id en filtros PostgREST
// (`?id=eq.${id}`). Un id con `&` permitiría añadir filtros propios y convertir
// un borrado puntual en masivo, así que solo se acepta la forma de UUID.
describe("esIdSeguro · guarda de interpolación en filtros PostgREST", () => {
  it("acepta un UUID válido, en minúscula y mayúscula", () => {
    expect(esIdSeguro("cd8fbda9-1ad0-4493-9add-836043e25dec")).toBe(true);
    expect(esIdSeguro("CD8FBDA9-1AD0-4493-9ADD-836043E25DEC")).toBe(true);
  });

  it("rechaza intentos de colar filtros extra", () => {
    // El caso real: convertir el borrado de UNA fila en un borrado masivo.
    expect(esIdSeguro("cd8fbda9-1ad0-4493-9add-836043e25dec&nombre=neq.x")).toBe(false);
    expect(esIdSeguro("*")).toBe(false);
    expect(esIdSeguro("eq.any")).toBe(false);
    expect(esIdSeguro("1;drop")).toBe(false);
  });

  it("rechaza vacíos, malformados y lo que no es cadena", () => {
    expect(esIdSeguro("")).toBe(false);
    expect(esIdSeguro("cd8fbda9-1ad0-4493-9add")).toBe(false);
    expect(esIdSeguro(null)).toBe(false);
    expect(esIdSeguro(undefined)).toBe(false);
    expect(esIdSeguro(123)).toBe(false);
  });
});
