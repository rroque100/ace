import { expect, it } from "vitest";
import { chatSourceLocations } from "@/lib/chat-source-locations";
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
