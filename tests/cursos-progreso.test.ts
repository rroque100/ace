import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ auth: vi.fn(), rest: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: m.auth }));
vi.mock("@/lib/supabase-server", () => ({ supabaseUserRest: m.rest }));

import { GET, POST } from "@/app/api/cursos/progreso/route";
import { leerProgreso, marcarClase } from "@/lib/cursos/progreso-server";

const yo = { id: "11111111-1111-4111-8111-111111111111", accessToken: "jwt-propio" };
const CURSO = "certificacion-oece";
const get = (curso: string) => new Request(`https://ace.test/api/cursos/progreso?curso=${curso}`);
const post = (b: unknown) => new Request("https://ace.test/api/cursos/progreso", { method: "POST", body: JSON.stringify(b) });
const tablaAusente = () =>
  new Error(`Supabase REST(user) 404: {"code":"PGRST205","message":"Could not find the table 'public.curso_progreso' in the schema cache"}`);

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ error: new Response(null, { status: 401 }) });
});

describe("API de progreso de cursos", () => {
  it("sin sesión no lee ni escribe", async () => {
    expect((await GET(get(CURSO))).status).toBe(401);
    expect((await POST(post({ curso: CURSO, clase: "garantias", completada: true }))).status).toBe(401);
    expect(m.rest).not.toHaveBeenCalled();
  });

  it("lee con el JWT de la persona, no con service_role", async () => {
    m.auth.mockResolvedValue({ user: yo });
    m.rest.mockResolvedValue([{ clase: "garantias" }]);
    const r = await GET(get(CURSO));
    expect(await r.json()).toEqual({ completadas: ["garantias"], disponible: true });
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(m.rest.mock.calls[0][0]).toBe("jwt-propio");
  });

  it("el propietario sale de la sesión aunque el cuerpo traiga otro", async () => {
    m.auth.mockResolvedValue({ user: yo });
    m.rest.mockResolvedValue(undefined);
    expect((await POST(post({ curso: CURSO, clase: "garantias", completada: true, user_id: "otro" }))).status).toBe(200);
    const [token, ruta, init] = m.rest.mock.calls[0];
    expect(token).toBe("jwt-propio");
    expect(ruta).toContain("on_conflict=user_id,curso,clase");
    expect(JSON.parse(init.body)).toEqual({ user_id: yo.id, curso: CURSO, clase: "garantias" });
  });

  it("desmarcar borra solo esa clase de ese curso", async () => {
    m.auth.mockResolvedValue({ user: yo });
    m.rest.mockResolvedValue(undefined);
    await POST(post({ curso: CURSO, clase: "garantias", completada: false }));
    const [, ruta, init] = m.rest.mock.calls[0];
    expect(init.method).toBe("DELETE");
    expect(ruta).toBe(`curso_progreso?curso=eq.${CURSO}&clase=eq.garantias`);
  });

  it("rechaza cursos o clases que no están en el catálogo", async () => {
    m.auth.mockResolvedValue({ user: yo });
    expect((await POST(post({ curso: CURSO, clase: "inventada", completada: true }))).status).toBe(400);
    expect((await POST(post({ curso: "nada", clase: "garantias", completada: true }))).status).toBe(400);
    expect((await POST(post({ curso: CURSO, clase: "garantias" }))).status).toBe(400);
    expect((await GET(get("nada"))).status).toBe(404);
    expect(m.rest).not.toHaveBeenCalled();
  });

  it("sin la migración aplicada, la lectura avisa y la escritura responde 503", async () => {
    m.auth.mockResolvedValue({ user: yo });
    m.rest.mockRejectedValue(tablaAusente());
    expect(await (await GET(get(CURSO))).json()).toEqual({ completadas: [], disponible: false });
    const r = await POST(post({ curso: CURSO, clase: "garantias", completada: true }));
    expect(r.status).toBe(503);
  });
});

describe("el fallback solo cubre la tabla ausente", () => {
  it("cualquier otro error se propaga", async () => {
    m.rest.mockRejectedValue(new Error("Supabase REST(user) 500: boom"));
    await expect(leerProgreso("t", CURSO)).rejects.toThrow("500");
    await expect(marcarClase("t", yo.id, CURSO, "garantias", true)).rejects.toThrow("500");
  });

  it("un PGRST205 de otra tabla tampoco se trata como «sin migrar»", async () => {
    m.rest.mockRejectedValue(new Error(`{"code":"PGRST205","message":"Could not find the table 'public.otra'"}`));
    await expect(leerProgreso("t", CURSO)).rejects.toThrow("PGRST205");
  });
});
