import { describe, expect, it } from "vitest";
import { clasesEnOrden } from "@/lib/cursos/catalogo";
import { CERTIFICACION_OECE } from "@/lib/cursos/certificacion-oece";
import { esQuiz, ICONOS_VIDEO, VIDEO_ESCENAS, type EscenaContenido } from "@/lib/cursos/videos";
import { ICONOS_COMPONENTES } from "@/app/components/cursos/video-animado";

describe("videos animados de las clases", () => {
  it("la clase actores-involucrados declara su animación y el guion existe", () => {
    const clase = clasesEnOrden(CERTIFICACION_OECE).find((c) => c.slug === "actores-involucrados")!;
    expect(clase.animacion).toBe("actores-involucrados");
    expect(VIDEO_ESCENAS[clase.animacion!]).toBeDefined();
  });

  it("el guion tiene siete escenas de contenido y dos comprobaciones interactivas", () => {
    const escenas = VIDEO_ESCENAS["actores-involucrados"]!;
    expect(escenas).toHaveLength(9);
    expect(escenas.filter(esQuiz)).toHaveLength(2);
    for (const e of escenas) {
      expect(e.titulo.length, e.titulo).toBeGreaterThan(4);
      expect(e.cinta.length, e.titulo).toBeGreaterThan(3);
    }
  });

  it("cada escena de contenido narra por segmentos que apuntan a fichas reales", () => {
    const contenido = VIDEO_ESCENAS["actores-involucrados"]!.filter((e): e is EscenaContenido => !esQuiz(e));
    expect(contenido).toHaveLength(7);
    for (const e of contenido) {
      expect(e.guion.length, e.titulo).toBeGreaterThanOrEqual(2);
      expect(e.fichas.length, e.titulo).toBeGreaterThan(0);
      for (const s of e.guion) {
        expect(s.texto.length, e.titulo).toBeGreaterThan(10);
        if (s.ficha !== undefined) {
          expect(s.ficha, e.titulo).toBeGreaterThanOrEqual(0);
          expect(s.ficha, e.titulo).toBeLessThan(e.fichas.length);
        }
      }
      for (const f of e.fichas) {
        expect(ICONOS_VIDEO, `${e.titulo}: ${f.nombre}`).toContain(f.icono);
        expect(f.nombre.length, e.titulo).toBeGreaterThan(1);
        expect(f.rol.length, e.titulo).toBeGreaterThan(4);
      }
    }
  });

  it("cada comprobación tiene una sola respuesta correcta y aclaración que la enseña", () => {
    const quizzes = VIDEO_ESCENAS["actores-involucrados"]!.filter(esQuiz);
    for (const q of quizzes) {
      expect(q.pregunta.length, q.titulo).toBeGreaterThan(15);
      expect(q.opciones).toHaveLength(3);
      expect(q.opciones.filter((o) => o.correcta), q.titulo).toHaveLength(1);
      expect(q.aclaracion.length, q.titulo).toBeGreaterThan(40);
      for (const o of q.opciones) expect(o.texto.length).toBeGreaterThan(2);
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
