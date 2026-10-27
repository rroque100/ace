import { expect, it } from "vitest";
import { officialPublicationDate } from "@/lib/official-import/publication-metadata";
it("lee la fecha del encabezado oficial y no una fecha citada en el cuerpo",()=>{
 expect(officialPublicationDate('<p class="institution-document__publication-type">Opinión</p><p>23 de setiembre de 2026</p><section>1 de enero de 2020</section>')).toBe("2026-09-23");
 expect(officialPublicationDate('<section>23 de octubre de 2026</section>')).toBeNull();
 expect(officialPublicationDate('<p class="institution-document__publication-type">Opinión</p><p>31 de febrero de 2026</p>')).toBeNull();
});
it("lee fechas del encabezado de normas sin tomar fechas del texto o anexos",()=>{
 expect(officialPublicationDate('<div class="header institution-document__header black"><h2>Norma</h2><p>Descripción</p><p>20 de abril de 2025</p></div><section>Modificada el 24 de agosto de 2025</section>')).toBe("2025-04-20");
 expect(officialPublicationDate('<div class="header institution-document__header black"><h2>Norma</h2><p>Sin fecha</p></div><p>20 de abril de 2025</p>')).toBeNull();
});

it("no sustituye la fecha del encabezado por otra clase incrustada en el cuerpo",()=>{
 expect(officialPublicationDate('<div class="institution-document__header"><p>Sin fecha</p></div><section><p class="institution-document__publication-type">Opinión</p><p>1 de enero de 2020</p></section>')).toBeNull();
});
