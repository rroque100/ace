import { expect, it } from "vitest";
import { countReferencedPages } from "../lib/document-pages";

it("cuenta siete páginas aunque contengan doce fragmentos", () => {
  const pages = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 7];
  expect(countReferencedPages(pages.map(page => ({ page_start: page, page_end: page })))).toBe(7);
});
it("une rangos superpuestos sin sumar páginas ausentes", () => {
  expect(countReferencedPages([
    { page_start: 3, page_end: 5 }, { page_start: 1, page_end: 3 },
    { page_start: 8, page_end: 9 },
  ])).toBe(7);
});
it("admite un extremo ausente e ignora referencias inválidas", () => {
  expect(countReferencedPages([
    { page_start: null, page_end: 2 }, { page_start: 4, page_end: null },
    { page_start: null, page_end: null }, { page_start: 0, page_end: -1 },
  ])).toBe(2);
});
