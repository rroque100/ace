import { describe, expect, it } from "vitest";
import {
  MAX_TEXTO_COMENTARIO, armarHilos, haceCuanto, iniciales, nombreVisible, ordenarHilos, totalComentarios, validarTexto,
  type FilaComentario,
} from "@/lib/cursos/comentarios";

const YO = "11111111-1111-4111-8111-111111111111";
const OTRO = "22222222-2222-4222-8222-222222222222";
const fila = (p: Partial<FilaComentario> & Pick<FilaComentario, "id" | "created_at">): FilaComentario => ({
  user_id: OTRO, autor: "Ana Pérez", texto: "Texto", padre_id: null, curso_comentario_likes: [], ...p,
});

describe("hilos de comentarios", () => {
  const filas = [
    fila({ id: "a", created_at: "2026-11-10T10:00:00Z", curso_comentario_likes: [{ user_id: YO }, { user_id: OTRO }] }),
    fila({ id: "b", created_at: "2026-11-12T10:00:00Z", user_id: YO }),
    fila({ id: "a2", padre_id: "a", created_at: "2026-11-11T09:00:00Z" }),
    fila({ id: "a1", padre_id: "a", created_at: "2026-11-10T11:00:00Z", user_id: YO }),
    fila({ id: "huerfana", padre_id: "borrado", created_at: "2026-11-12T12:00:00Z" }),
  ];

  it("agrupa un solo nivel, con las respuestas en orden cronológico y sin huérfanas", () => {
    const hilos = armarHilos(filas, YO, false);
    expect(hilos.map((h) => h.id)).toEqual(["a", "b"]);
    expect(hilos[0].respuestas.map((r) => r.id)).toEqual(["a1", "a2"]);
    expect(totalComentarios(hilos)).toBe(4);
  });

  it("cuenta «me gusta», marca los propios y no expone user_id", () => {
    const [a, b] = armarHilos(filas, YO, false);
    expect(a).toMatchObject({ meGusta: 2, leGusta: true, propio: false, puedeBorrar: false });
    expect(b).toMatchObject({ meGusta: 0, leGusta: false, propio: true, puedeBorrar: true });
    expect(JSON.stringify(armarHilos(filas, YO, false))).not.toContain(OTRO);
  });

  it("un administrador puede borrar cualquiera, aunque no sea suyo", () => {
    const [a] = armarHilos(filas, YO, true);
    expect(a).toMatchObject({ propio: false, puedeBorrar: true });
    expect(a.respuestas.every((r) => r.puedeBorrar)).toBe(true);
  });

  it("ordena por recientes o por populares sin mutar la lista", () => {
    const hilos = armarHilos(filas, YO, false);
    expect(ordenarHilos(hilos, "recientes").map((h) => h.id)).toEqual(["b", "a"]);
    expect(ordenarHilos(hilos, "populares").map((h) => h.id)).toEqual(["a", "b"]);
    expect(hilos.map((h) => h.id)).toEqual(["a", "b"]);
  });
});

describe("validación y presentación", () => {
  it("acepta texto con contenido y lo normaliza", () => {
    expect(validarTexto("  hola\r\n\r\n\r\n\r\nmundo  ")).toEqual({ ok: true, texto: "hola\n\nmundo" });
  });
  it("rechaza vacío, no texto y lo demasiado largo", () => {
    for (const malo of ["", "   \n ", null, 42, undefined]) expect(validarTexto(malo).ok, String(malo)).toBe(false);
    expect(validarTexto("x".repeat(MAX_TEXTO_COMENTARIO)).ok).toBe(true);
    expect(validarTexto("x".repeat(MAX_TEXTO_COMENTARIO + 1)).ok).toBe(false);
  });
  it("nunca firma con el DNI ni con el correo", () => {
    expect(nombreVisible("  Ana   María  Pérez ")).toBe("Ana María Pérez");
    for (const v of [null, "", "45871236", "ana@entidad.gob.pe"]) expect(nombreVisible(v), String(v)).toBe("Participante");
  });
  it("iniciales del avatar", () => {
    expect(iniciales("Ana María Pérez")).toBe("AP");
    expect(iniciales("Participante")).toBe("P");
  });
  it("tiempo relativo en español", () => {
    const ahora = Date.parse("2026-11-17T12:00:00Z");
    const hace = (s: number) => new Date(ahora - s * 1000).toISOString();
    expect(haceCuanto(hace(10), ahora)).toBe("Hace un momento");
    expect(haceCuanto(hace(5 * 60), ahora)).toBe("Hace 5 min");
    expect(haceCuanto(hace(3 * 3600), ahora)).toBe("Hace 3 h");
    expect(haceCuanto(hace(86400), ahora)).toBe("Hace un día");
    expect(haceCuanto(hace(13 * 86400), ahora)).toBe("Hace 13 días");
    expect(haceCuanto(hace(65 * 86400), ahora)).toBe("Hace 2 meses");
    expect(haceCuanto(hace(800 * 86400), ahora)).toBe("Hace 2 años");
    // Un reloj del cliente adelantado no da «hace -3 min».
    expect(haceCuanto(new Date(ahora + 60_000).toISOString(), ahora)).toBe("Hace un momento");
  });
});
