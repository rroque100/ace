import { describe, expect, it } from "vitest";
import { objectTypeDeNecesidad } from "@/lib/processes";

// Bug real: derivar (o crear) un expediente de consultoría de obra rompía el
// INSERT en procurement_processes con un 400 (procurement_processes_object_type_check),
// porque la Necesidad usa "consultoria_obra" y la columna solo acepta "consultoria".
describe("objectTypeDeNecesidad", () => {
  it("traduce consultoria_obra a consultoria", () => {
    expect(objectTypeDeNecesidad("consultoria_obra")).toBe("consultoria");
  });

  it("deja los demás tipos tal cual", () => {
    expect(objectTypeDeNecesidad("bienes")).toBe("bienes");
    expect(objectTypeDeNecesidad("servicios")).toBe("servicios");
    expect(objectTypeDeNecesidad("obras")).toBe("obras");
  });
});
