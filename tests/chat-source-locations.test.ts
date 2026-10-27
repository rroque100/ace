import { expect, it } from "vitest";
import { chatSourceLocations, recordedVersion, canonicalSourceMarkers } from "@/lib/chat-source-locations";
const sources = [
  { documentTitle: "Documento A", pageStart: 2, pageEnd: 4 },
  { documentTitle: "Documento B", pageStart: null, pageEnd: null },
];
it("enumera solo fuentes citadas válidas, con ubicaciones reales y sin duplicarlas", () => {
  const result = chatSourceLocations("Texto [F1]. Repetido [F1, Art. 3]. Fuente ausente [F99].", sources);
  expect(result).toContain("Documento A · páginas 2–4");
  expect(result.match(/Documento A/g)).toHaveLength(1);
  expect(result).not.toContain("Documento B");
  expect(result).not.toContain("F99");
});
it("declara la ausencia de página y no confunde el artículo con una página", () => {
  expect(chatSourceLocations("Texto [F2, Art. 999]", sources)).toContain("página no disponible");
  expect(chatSourceLocations("Texto sin citas", sources)).toBe("");
});
it("cita bloques de DOCX sin fabricar páginas",()=>{const text=chatSourceLocations("Texto [F1]",[{documentTitle:"Modelo editable",pageStart:null,pageEnd:null,locator:"b1-a",locatorLabel:"Tabla extraída 1 · fila 2"}]);expect(text).toContain("Tabla extraída 1");expect(text).toContain("sin página física");expect(text).not.toContain("página 1");});

it("incluye todas las fuentes de una cita agrupada y descarta índices inexistentes", () => {
  const result = chatSourceLocations("Texto [F1, F2, F99].", sources);
  expect(result).toContain("Documento A");
  expect(result).toContain("Documento B");
  expect(result).not.toContain("F99");
});

it("distingue artículo, numeral y versión registrados y declara lo desconocido", () => {
  const located = chatSourceLocations("Regla [F1]", [{ documentTitle: "Documento sintético", pageStart: 2, pageEnd: 2, article: "X", numeral: "X.a", version: "versión de prueba" }]);
  expect(located).toContain("artículo X, numeral X.a");
  expect(located).toContain("versión: versión de prueba");
  expect(chatSourceLocations("Texto [F1]", sources)).toContain("versión: no registrada");
});
it("solo extrae versión de etiquetas explícitas y no convierte un año en vigencia", () => {
  expect(recordedVersion("Documento del año 2026")).toBeNull();
  expect(recordedVersion("Documento — texto actualizado al 01.01.2026")).toContain("según título");
  expect(recordedVersion("Documento", "Revisión institucional A")).toBe("Revisión institucional A");
});
it("mantiene artículos visibles y referencias clicables sin duplicar anotaciones", () => {
  const input = "Regla [F1, Artículo X], [F2, Artículo X].";
  const normalized = canonicalSourceMarkers(input);
  expect(normalized).toBe("Regla (Artículo X) [F1] [F2].");
  expect(canonicalSourceMarkers(normalized)).toBe(normalized);
  expect(canonicalSourceMarkers("Regla [F1, F2].")).toBe("Regla [F1] [F2].");
});
