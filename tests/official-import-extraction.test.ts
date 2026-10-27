import { expect, it } from "vitest";
import { assertCompleteOfficialExtraction } from "../lib/official-import/extraction";
it("no admite texto largo si el OCR solo cubre parte del PDF",()=>{
  expect(()=>assertCompleteOfficialExtraction({text:"Texto legible ".repeat(1000),ocrPartial:true})).toThrow("OCR parcial");
});
it("admite extracción completa y rechaza PDF sin texto suficiente",()=>{
  expect(()=>assertCompleteOfficialExtraction({text:"Texto legible ".repeat(100),ocrPartial:false})).not.toThrow();
  expect(()=>assertCompleteOfficialExtraction({text:"",ocrPartial:false})).toThrow("sin texto");
});
