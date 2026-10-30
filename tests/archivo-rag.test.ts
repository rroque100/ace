import { describe, expect, it } from "vitest";
import { parseRagPath, ragRecordFilters, restLiteral } from "../lib/archivo-rag";
describe("organización de carpetas RAG", () => {
  it("conserva el archivador completo y ceros del SIAF", () => {
    expect(parseRagPath("NOTAS DE PAGO/CP_T137_EXP_2955 AL 2968 _2022/CP2959 16 03 2022_SIAF 0982.pdf")).toMatchObject({ type: "NOTAS DE PAGO", cabinet: "CP_T137_EXP_2955 AL 2968 _2022", cp: "CP2959", siaf: "0982", date: "2022-03-16", year: "2022" });
  });
  it("no confunde los dos CP2965", () => {
    const a = parseRagPath("NOTAS DE PAGO/archivador/CP2965 14 03 2022_SIAF 0422.pdf");
    const b = parseRagPath("NOTAS DE PAGO/archivador/CP2965 16 03 2022_SIAF 0774.pdf");
    expect(a.cp).toBe(b.cp); expect(a.siaf).not.toBe(b.siaf); expect(a.path).not.toBe(b.path);
  });
  it("no inventa tipo o ubicación al seleccionar solo un PDF", () => {
    expect(parseRagPath("CP2955 31 02 2022.pdf")).toMatchObject({ type: "", cabinet: "", date: "" });
  });
  it("construye filtros exactos sin perder ceros", () => {
    const filter = decodeURIComponent(ragRecordFilters(new URLSearchParams({ cp: "2955", siaf: "0982" })));
    expect(filter).toContain('metadata->rag->>cp=eq.CP2955');
    expect(filter).toContain('metadata->rag->>siaf=eq.0982');
  });
  it("encapsula puntuación del archivador y rechaza operadores en CP", () => {
    expect(ragRecordFilters(new URLSearchParams({ cabinet: 'x&uploaded_by=neq."y"' }))).not.toContain("&uploaded_by");
    expect(() => ragRecordFilters(new URLSearchParams({ cp: "1),uploaded_by.neq.x" }))).toThrow();
  });
});

it("no agrega comillas a UUID ni año y mantiene el valor de texto original", () => {
  const uuid = "1eabc004-42af-428a-80f6-3455c33a1c32";
  expect(restLiteral(uuid)).toBe(uuid);
  const params = new URLSearchParams("uploaded_by=eq." + restLiteral(uuid) + ragRecordFilters(new URLSearchParams({ year: "2022", cabinet: 'archivo & otro, (2022) "A"' })));
  expect(params.get("uploaded_by")).toBe("eq." + uuid);
  expect(params.get("anio")).toBe("eq.2022");
  expect(params.get("nro_archivador")).toBe('eq.archivo & otro, (2022) "A"');
  expect(Array.from(params.keys())).toEqual(["uploaded_by", "nro_archivador", "anio"]);
});
