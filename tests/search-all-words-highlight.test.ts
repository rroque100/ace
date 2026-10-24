import { expect, it } from "vitest";
import { allWordsMatchParts } from "@/lib/document-search";
it("resalta palabras en orden distinto conservando texto y escape",()=>{
 const text="<b>Contrato</b> y GARANTÍA";
 const parts=allWordsMatchParts(text,"garantia contrato");
 expect(parts.map(part=>part.text).join("")).toBe(text);
 expect(parts.filter(part=>part.match).map(part=>part.text)).toEqual(["Contrato","GARANTÍA"]);
});
