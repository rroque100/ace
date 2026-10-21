import { describe, expect, it } from "vitest";
import { LIMITES_TEXTO, necesidadUpdateSchema } from "@/lib/necesidades";

// Los topes de LIMITES_TEXTO (que el cliente usa para capar la entrada y evitar
// PATCH 400) DEBEN coincidir con los optionalText(n) del schema. Este test lo
// verifica campo por campo: aceptar exactamente el tope y rechazar tope+1.
describe("LIMITES_TEXTO coincide con los topes del schema de la necesidad", () => {
  for (const [campo, max] of Object.entries(LIMITES_TEXTO)) {
    it(`${campo}: acepta ${max} y rechaza ${max + 1}`, () => {
      const enTope = necesidadUpdateSchema.safeParse({ [campo]: "a".repeat(max) });
      expect(enTope.success, `${campo} debería aceptar ${max} caracteres`).toBe(true);

      const excede = necesidadUpdateSchema.safeParse({ [campo]: "a".repeat(max + 1) });
      expect(excede.success, `${campo} debería rechazar ${max + 1} caracteres`).toBe(false);
    });
  }
});
