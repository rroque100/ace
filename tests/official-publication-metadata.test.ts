import { expect, it } from "vitest";
import { officialPublicationDate } from "@/lib/official-import/publication-metadata";
it("lee la fecha del encabezado oficial y no una fecha citada en el cuerpo",()=>{
 expect(officialPublicationDate('<p class="institution-document__publication-type">Opinión</p><p>23 de setiembre de 2026</p><section>1 de enero de 2020</section>')).toBe("2026-09-23");
 expect(officialPublicationDate('<section>23 de octubre de 2026</section>')).toBeNull();
 expect(officialPublicationDate('<p class="institution-document__publication-type">Opinión</p><p>31 de febrero de 2026</p>')).toBeNull();
});
