import { describe, expect, it } from "vitest";
import {
  PROCESOS_SELECCION,
  esProcesoValido,
  pdfsModeloDeProceso,
  procesoDePdfModelo,
} from "@/lib/procesos-seleccion";

// El vínculo modelo ↔ tipo de proceso vive en `documents.metadata.procesoSeleccion`
// y es lo que `resolverModeloDocId` consulta para anclar el RAG. Antes el único
// puente era el nombre del archivo, que se rompía en silencio al renombrar: la
// búsqueda devolvía null, indistinguible de "este procedimiento no tiene modelo".

describe("esProcesoValido: qué se acepta como vínculo", () => {
  it("acepta los procedimientos del catálogo", () => {
    expect(esProcesoValido("Licitación Pública para bienes")).toBe(true);
    expect(esProcesoValido("Procedimiento de Selección No Competitivo")).toBe(true);
  });

  it("rechaza el marcador «— Por definir —», que no es un procedimiento", () => {
    expect(esProcesoValido("")).toBe(false);
    expect(esProcesoValido("   ")).toBe(false);
  });

  it("rechaza null, undefined y cualquier cosa fuera del catálogo", () => {
    expect(esProcesoValido(null)).toBe(false);
    expect(esProcesoValido(undefined)).toBe(false);
    // Vocabulario del régimen derogado: no debe poder guardarse como vínculo.
    expect(esProcesoValido("Adjudicación Simplificada")).toBe(false);
  });
});

describe("procesoDePdfModelo: autodetección al subir", () => {
  it("todo modelo del catálogo se reconoce por su nombre de archivo", () => {
    const archivos = PROCESOS_SELECCION.flatMap((p) => p.pdfs ?? []);
    expect(archivos.length).toBeGreaterThan(0);
    for (const archivo of archivos) {
      // Un mismo modelo puede servir a varios procedimientos —la tipología del
      // Reglamento es más gruesa que las plantillas—, así que basta con que
      // resuelva a UNO que de verdad lo declare.
      const proceso = procesoDePdfModelo(archivo);
      expect(proceso, `«${archivo}» no resuelve a ningún procedimiento`).not.toBeNull();
      expect(pdfsModeloDeProceso(proceso as string)).toContain(archivo);
    }
  });

  it("ida y vuelta: procedimiento → modelos → procedimiento que los declara", () => {
    for (const p of PROCESOS_SELECCION) {
      for (const archivo of pdfsModeloDeProceso(p.value)) {
        const vuelta = procesoDePdfModelo(archivo);
        expect(vuelta).not.toBeNull();
        expect(pdfsModeloDeProceso(vuelta as string)).toContain(archivo);
      }
    }
  });

  it("no distingue tildes ni mayúsculas: los nombres reales mezclan ambas", () => {
    // En el expediente conviven «REQUERIMIENTO LICITACIÓN…» y «requerimiento
    // CONCURSO…», así que la comparación no puede ser literal.
    expect(procesoDePdfModelo("requerimiento licitacion publica de obras.pdf")).toBe(
      "Licitación Pública de obras",
    );
    expect(procesoDePdfModelo("REQUERIMIENTO  LICITACIÓN   PÚBLICA  DE  OBRAS.PDF")).toBe(
      "Licitación Pública de obras",
    );
  });

  it("un archivo que no es un modelo oficial no se vincula solo", () => {
    expect(procesoDePdfModelo("mi plantilla interna.pdf")).toBeNull();
    expect(procesoDePdfModelo("")).toBeNull();
    expect(procesoDePdfModelo(null)).toBeNull();
  });

  it("no confunde un procedimiento con su modalidad abreviada", () => {
    // «LICITACION PUBLICA ABREVIADA DE OBRAS» y «LICITACIÓN PÚBLICA DE OBRAS»
    // solo se distinguen por una palabra; vincular al que no es dejaría al
    // copiloto redactando con el formato equivocado.
    expect(procesoDePdfModelo("REQUERIMIENTO LICITACION PUBLICA ABREVIADA DE OBRAS.pdf")).toBe(
      "Licitación Pública abreviada de obras",
    );
  });
});
