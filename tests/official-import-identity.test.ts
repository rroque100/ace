import { expect, it } from "vitest";
import { findKnownOfficialDocument } from "../lib/official-import/identity";
const item={sha256:"abc",publicationUrl:"https://www.gob.pe/norma",pdfUrl:"https://cdn.www.gob.pe/a.pdf"};
it("reutiliza el documento público por huella aunque cambie el enlace",()=>{
  const record={id:"public",es_institucional:true,metadata:{sha256:"abc"}};
  expect(findKnownOfficialDocument([record],item)).toBe(record);
});
it("un tamaño o título coincidente no prueba identidad",()=>{
  const record={id:"other",es_institucional:true,metadata:{sha256:"different"},file_size:100,title:"Norma"};
  expect(findKnownOfficialDocument([record],item)).toBeUndefined();
});
it("rechaza reutilizar un archivo privado, incluso con huella coincidente",()=>{
  expect(()=>findKnownOfficialDocument([{id:"private",es_institucional:false,metadata:{sha256:"abc"}}],item)).toThrow("privado");
});
