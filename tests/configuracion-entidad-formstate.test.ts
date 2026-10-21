import { describe, expect, it } from "vitest";
import { entitySchema, toFormState } from "@/lib/configuracion-entidad";
import { emptyEntity } from "@/lib/configuracion-types";

// `toFormState` reconstruye el formulario tras cada guardado/carga. Si olvida un
// campo del schema, el formulario lo pierde al sincronizar y el siguiente
// guardado lo sobrescribe con null. Pasó con la sección AGA: los campos se
// guardaban y se borraban solos. Este test lo blinda: TODA clave del esquema
// (que es lo que el formulario edita) debe salir de `toFormState`.
describe("toFormState no suelta ningún campo del esquema de la entidad", () => {
  it("mapea todas las claves que valida entitySchema", () => {
    const claves = Object.keys(entitySchema.shape);
    const salida = toFormState(emptyEntity);
    const faltantes = claves.filter((k) => !(k in salida));
    expect(faltantes).toEqual([]);
  });

  it("conserva los datos del gerente y del AGA (round-trip)", () => {
    const entidad = {
      ...emptyEntity,
      managerFullName: "WELLINTONG LOPEZ PILLCO",
      managerPosition: "GERENTE MUNICIPAL",
      managerDni: "12345678",
      agaDegree: "CPC",
      agaFullName: "SAUL QUISPE CHIPANA",
      agaPosition: "Jefe de la OGA",
      agaDni: "45373962",
      agaResolutionNumber: "123-2026-MDCH/A",
    };
    const form = toFormState(entidad);
    expect(form.managerFullName).toBe("WELLINTONG LOPEZ PILLCO");
    expect(form.managerPosition).toBe("GERENTE MUNICIPAL");
    expect(form.agaFullName).toBe("SAUL QUISPE CHIPANA");
    expect(form.agaPosition).toBe("Jefe de la OGA");
    expect(form.agaDni).toBe("45373962");
    expect(form.agaResolutionNumber).toBe("123-2026-MDCH/A");
  });
});
