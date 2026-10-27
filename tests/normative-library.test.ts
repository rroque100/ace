import { expect, it } from "vitest";
import { matchesNormValidity, normativeVersions, referenceReviewLabel, repeatedArticleNumbers, normTitleMatches, annotateArticleSections } from "@/lib/normative-library";
import type { SearchCatalogueRow } from "@/lib/document-search";
it("no confunde vigente con no vigente ni revisión pendiente",()=>{
  expect(matchesNormValidity("no vigente",null,"vigente")).toBe(false);
  expect(matchesNormValidity("vigente",null,"vigente")).toBe(true);
  expect(matchesNormValidity("vigente","revision pendiente","unknown")).toBe(true);
  expect(matchesNormValidity(null,null,"unknown")).toBe(true);
  expect(matchesNormValidity("vigente",null,"inventado")).toBe(false);
});
it("agrupa versiones como Búsqueda y ordena por actualización, no carga o año",()=>{
  const row={id:"a",title:"Reglamento de la Ley 32069",document_type:"reglamento",source_entity:null,process_type:null,metadata:{documentNumber:"009-2025-EF",year:2026,versionDate:"2025-01-01"}} as SearchCatalogueRow;
  const newer={...row,id:"b",metadata:{...row.metadata,year:2025,versionDate:"2026-01-09"}};
  expect(normativeVersions([row,newer])[0].documents.map(item=>item.id)).toEqual(["b","a"]);
  expect(normativeVersions([{...row,document_type:"bases_estandar"}])[0].documents).toHaveLength(1);
});
it("no atribuye revisión jurídica a un enlace resuelto y detecta numeración repetida",()=>{
  expect(referenceReviewLabel(true,"id")).toContain("sin revisar");
  expect(referenceReviewLabel(false,null)).toContain("sin localizar");
  expect(repeatedArticleNumbers([{articleNumber:"1"},{articleNumber:"2"},{articleNumber:"1"}])).toEqual(["1"]);
});
it("reconoce formato equivalente de número sin sustituir su identidad",()=>{
  const row:SearchCatalogueRow={id:"doc",title:"Opinión N.° D000102-2026-OECE-DTN",document_type:"opinion",source_entity:null,process_type:null,metadata:{documentNumber:"D000102-2026-OECE-DTN"}};
  expect(normTitleMatches(row,"Opinión N.º D102/2026/OECE/DTN")).toBe(true);
  expect(normTitleMatches(row,"D103/2026/OECE/DTN")).toBe(false);
});
it("solo usa encabezados explícitos y conserva la procedencia sin inventar capítulos",()=>{
  const rows=annotateArticleSections([{content:"Texto.\nTÍTULO II\nDISPOSICIONES GENERALES\nCAPÍTULO I\nOBJETO",section_title:null},{content:"Una referencia al capítulo II no es encabezado.",section_title:null},{content:"Otro texto",section_title:"Sección registrada"}]);
  expect(rows[0].section_title).toBeNull();
  expect(rows[1].section_title).toContain("TÍTULO II");expect(rows[1].section_title).toContain("CAPÍTULO I");expect(rows[1].sectionOrigin).toBe("explicit-text-heading");
  expect(rows[2].section_title).toBe("Sección registrada");
});
it("recupera encabezados finales que el PDF unió al artículo previo",()=>{
  expect(annotateArticleSections([{content:"Fin del artículo. SUBCAPÍTULO 5 Garantías",section_title:null},{content:"Texto siguiente",section_title:null}])[1].section_title).toBe("SUBCAPÍTULO 5 Garantías");
  expect(annotateArticleSections([{content:"Según el CAPÍTULO II del otro documento",section_title:null},{content:"Texto siguiente",section_title:null}])[1].section_title).toBeNull();
});
