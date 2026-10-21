import { describe, expect, it } from "vitest";
import { FORMATOS_ARCHIVABLES } from "@/lib/archivar-formato";
import { CICLO_CONTRATACION } from "@/lib/contratacion-modulos";
import { processDocKinds } from "@/lib/processes";

const formatos = Object.values(FORMATOS_ARCHIVABLES);

describe("catálogo de formatos archivables", () => {
  it("todos usan un kind válido de process_documents", () => {
    for (const f of formatos) {
      expect(processDocKinds as readonly string[], f.titulo).toContain(f.kind);
    }
  });

  it("ningún formato reclama un requisito OBLIGATORIO de una etapa", () => {
    // Un falso positivo aquí da por foliada una etapa que no lo está, que es
    // peor que el 0% del que partíamos. El checklist de bases es el caso claro:
    // no es "Bases del procedimiento" aunque hable de ellas.
    const obligatorios = CICLO_CONTRATACION.flatMap((e) =>
      e.documentos.filter((d) => d.obligatorio),
    );
    for (const f of formatos) {
      const chocan = obligatorios.filter((d) => {
        if (d.kind !== f.kind) return false;
        if (!d.tituloIncluye?.length) return true;
        const t = f.titulo.toLowerCase();
        return d.tituloIncluye.some((k) => t.includes(k.toLowerCase()));
      });
      expect(chocan.map((d) => d.label), `${f.titulo} (${f.kind})`).toEqual([]);
    }
  });

  it("el Anexo N° 1 satisface el informe de mercado por su título", () => {
    // La etapa lo busca por palabra clave; si se renombra sin "mercado" deja de
    // contar y nadie se entera.
    expect(FORMATOS_ARCHIVABLES["A5|anexo1"].titulo.toLowerCase()).toContain("mercado");
  });

  it("el Anexo N° 2 satisface el acta de aprobación por su título", () => {
    const f = FORMATOS_ARCHIVABLES["A8|anexo2"];
    expect(f.kind).toBe("acta");
    expect(f.titulo.toLowerCase()).toContain("aprobaci");
  });

  it("el checklist de bases NO entra como bases", () => {
    expect(FORMATOS_ARCHIVABLES["A9|bases_checklist"].kind).toBe("otros");
  });

  it("cada clave nombra el paso que la genera", () => {
    for (const [clave, f] of Object.entries(FORMATOS_ARCHIVABLES)) {
      expect(clave.startsWith(`${f.paso}|`), clave).toBe(true);
    }
  });

  it("los títulos son únicos: el reemplazo localiza por paso + título", () => {
    const titulos = formatos.map((f) => `${f.paso}|${f.titulo}`);
    expect(new Set(titulos).size).toBe(titulos.length);
  });
});
