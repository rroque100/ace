import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// El banco de preguntas de oro (scripts/evaluar-chat-oro.mts) usa servicios reales y se corre aparte (workflow «Chat: banco de
// oro»). Lo que SÍ se puede comprobar siempre, sin red, es que el fichero de casos esté bien formado: un caso sin ninguna
// expectativa pasaría siempre y daría una falsa tranquilidad, y una expectativa mal escrita nunca se enteraría de que falla.

type Parte = { nombre?: string; contieneAlguno?: string[] };
type Caso = {
  id?: string; grupo?: string; pregunta?: string; contiene?: string[]; contieneAlguno?: string[]; noContiene?: string[];
  fuentes?: unknown[]; sinFuentes?: boolean; partes?: Parte[]; intermitente?: boolean; nota?: string;
};
const { casos } = JSON.parse(readFileSync("docs/evaluaciones/chat-juridico/preguntas-oro.json", "utf8")) as { casos: Caso[] };

const tieneExpectativa = (caso: Caso) =>
  Boolean(caso.contiene?.length || caso.contieneAlguno?.length || caso.noContiene?.length || caso.fuentes?.length || caso.sinFuentes || caso.partes?.length);

describe("banco de preguntas de oro: formato", () => {
  it("cada caso tiene id único, grupo y pregunta", () => {
    const vistos = new Set<string>();
    for (const caso of casos) {
      expect(caso.id, JSON.stringify(caso).slice(0, 80)).toBeTruthy();
      expect(vistos.has(caso.id!), `id repetido: ${caso.id}`).toBe(false);
      vistos.add(caso.id!);
      expect(caso.grupo, caso.id).toBeTruthy();
      expect(caso.pregunta?.trim().length, caso.id).toBeGreaterThan(5);
    }
  });

  it("ningún caso pasa siempre: todos fijan al menos una expectativa", () => {
    for (const caso of casos) expect(tieneExpectativa(caso), `${caso.id} no comprueba nada`).toBe(true);
  });

  it("ninguna expectativa de texto está vacía (una cadena vacía está contenida en cualquier respuesta)", () => {
    for (const caso of casos) {
      for (const frase of [...(caso.contiene ?? []), ...(caso.contieneAlguno ?? []), ...(caso.noContiene ?? []), ...(caso.partes ?? []).flatMap((p) => p.contieneAlguno ?? [])]) {
        expect(frase.trim().length, `${caso.id}: expectativa vacía`).toBeGreaterThan(0);
      }
    }
  });

  it("un caso de completitud contesta al menos dos partes, cada una con nombre y con términos que la distingan", () => {
    const completitud = casos.filter((caso) => caso.grupo === "completitud");
    expect(completitud.length).toBeGreaterThan(0);
    for (const caso of completitud) {
      expect(caso.partes?.length ?? 0, `${caso.id}: una pregunta de una sola parte no es de completitud`).toBeGreaterThanOrEqual(2);
      for (const parte of caso.partes ?? []) {
        expect(parte.nombre?.trim(), `${caso.id}: parte sin nombre`).toBeTruthy();
        expect(parte.contieneAlguno?.length ?? 0, `${caso.id}: parte «${parte.nombre}» sin términos`).toBeGreaterThan(0);
      }
    }
  });

  it("las partes solo existen en casos de completitud, que es donde el informe las cuenta", () => {
    for (const caso of casos) if (caso.partes) expect(caso.grupo, caso.id).toBe("completitud");
  });

  it("un caso intermitente explica por qué lo es y qué lo dejaría verde", () => {
    for (const caso of casos.filter((c) => c.intermitente)) {
      expect(caso.nota?.trim().length ?? 0, `${caso.id}: falta la nota de por qué es intermitente`).toBeGreaterThan(20);
    }
  });
});
