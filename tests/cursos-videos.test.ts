import { describe, expect, it } from "vitest";
import { clasesEnOrden } from "@/lib/cursos/catalogo";
import { CERTIFICACION_OECE } from "@/lib/cursos/certificacion-oece";
import { ICONOS_VIDEO, VIDEO_ESCENAS } from "@/lib/cursos/videos";
import { ICONOS_COMPONENTES } from "@/app/components/cursos/video-animado";

describe("videos animados de las clases", () => {
  it("la clase actores-involucrados declara su animación y el guion existe", () => {
    const clase = clasesEnOrden(CERTIFICACION_OECE).find((c) => c.slug === "actores-involucrados")!;
    expect(clase.animacion).toBe("actores-involucrados");
    expect(VIDEO_ESCENAS[clase.animacion!]).toBeDefined();
  });

  it("el guion tiene siete escenas completas con fichas y cinta", () => {
    const escenas = VIDEO_ESCENAS["actores-involucrados"]!;
    expect(escenas).toHaveLength(7);
    for (const e of escenas) {
      expect(e.titulo.length, e.titulo).toBeGreaterThan(4);
      expect(e.narracion.length, e.titulo).toBeGreaterThan(60);
      expect(e.fichas.length, e.titulo).toBeGreaterThan(0);
      for (const f of e.fichas) {
        expect(ICONOS_VIDEO, `${e.titulo}: ${f.nombre}`).toContain(f.icono);
        expect(f.nombre.length, e.titulo).toBeGreaterThan(1);
        expect(f.rol.length, e.titulo).toBeGreaterThan(4);
      }
      expect(e.cinta.length, e.titulo).toBeGreaterThan(3);
    }
  });

  it("cada icono permitido tiene su componente en el reproductor, y ningún componente de más", () => {
    expect(Object.keys(ICONOS_COMPONENTES).sort()).toEqual([...ICONOS_VIDEO].sort());
  });

  it("solo las clases con animación tienen guion, y ningún guion queda huérfano", () => {
    const clases = clasesEnOrden(CERTIFICACION_OECE);
    const declaradas = new Set(clases.flatMap((c) => (c.animacion ? [c.animacion] : [])));
    expect([...declaradas].sort()).toEqual(Object.keys(VIDEO_ESCENAS).sort());
    for (const c of clases) if (c.animacion) expect(VIDEO_ESCENAS[c.animacion], c.slug).toBeDefined();
  });
});
