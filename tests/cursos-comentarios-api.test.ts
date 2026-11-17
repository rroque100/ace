import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ auth: vi.fn(), sistema: vi.fn(), usuario: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: m.auth }));
vi.mock("@/lib/supabase-server", () => ({ supabaseRest: m.sistema, supabaseUserRest: m.usuario }));

import { GET, POST } from "@/app/api/cursos/comentarios/route";
import { DELETE } from "@/app/api/cursos/comentarios/[id]/route";
import { POST as meGusta } from "@/app/api/cursos/comentarios/[id]/me-gusta/route";

const ID = "33333333-3333-4333-8333-333333333333";
const yo = { id: "11111111-1111-4111-8111-111111111111", accessToken: "jwt-propio", isAdmin: false, nombreCompleto: "Ana Pérez" };
const admin = { ...yo, isAdmin: true };
const CURSO = "certificacion-oece";
const CLASE = "garantias";
const url = "https://ace.test/api/cursos/comentarios";
const post = (b: unknown) => new Request(url, { method: "POST", body: JSON.stringify(b) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const tablaAusente = () =>
  new Error(`Supabase REST(user) 404: {"code":"PGRST205","message":"Could not find the table 'public.curso_comentarios'"}`);
const filaCreada = { id: ID, user_id: yo.id, autor: "Ana Pérez", texto: "Hola", padre_id: null, created_at: "2026-11-17T10:00:00Z" };

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ error: new Response(null, { status: 401 }) });
});

describe("sin sesión", () => {
  it("no lee, no escribe, no borra ni da «me gusta»", async () => {
    expect((await GET(new Request(`${url}?curso=${CURSO}&clase=${CLASE}`))).status).toBe(401);
    expect((await POST(post({ curso: CURSO, clase: CLASE, texto: "x" }))).status).toBe(401);
    expect((await DELETE(new Request(url), params(ID))).status).toBe(401);
    expect((await meGusta(new Request(url, { method: "POST", body: "{}" }), params(ID))).status).toBe(401);
    expect(m.sistema).not.toHaveBeenCalled();
    expect(m.usuario).not.toHaveBeenCalled();
  });
});

describe("leer", () => {
  it("lee con el JWT de la persona y devuelve hilos sin user_id", async () => {
    m.auth.mockResolvedValue({ user: yo });
    m.usuario.mockResolvedValue([{ ...filaCreada, user_id: "otra-cuenta", curso_comentario_likes: [{ user_id: yo.id }] }]);
    const r = await GET(new Request(`${url}?curso=${CURSO}&clase=${CLASE}`));
    const x = await r.json();
    expect(m.usuario.mock.calls[0][0]).toBe("jwt-propio");
    expect(x.disponible).toBe(true);
    expect(x.comentarios[0]).toMatchObject({ id: ID, meGusta: 1, leGusta: true, propio: false });
    expect(JSON.stringify(x)).not.toContain("otra-cuenta");
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("una clase que no está en el catálogo da 404", async () => {
    m.auth.mockResolvedValue({ user: yo });
    expect((await GET(new Request(`${url}?curso=${CURSO}&clase=inventada`))).status).toBe(404);
    expect(m.usuario).not.toHaveBeenCalled();
  });

  it("sin la migración aplicada, avisa en vez de romper la clase", async () => {
    m.auth.mockResolvedValue({ user: yo });
    m.usuario.mockRejectedValue(tablaAusente());
    expect(await (await GET(new Request(`${url}?curso=${CURSO}&clase=${CLASE}`))).json()).toEqual({ comentarios: [], disponible: false });
  });

  it("cualquier otro error se propaga", async () => {
    m.auth.mockResolvedValue({ user: yo });
    m.usuario.mockRejectedValue(new Error("Supabase REST(user) 500: boom"));
    await expect(GET(new Request(`${url}?curso=${CURSO}&clase=${CLASE}`))).rejects.toThrow("500");
  });
});

describe("comentar", () => {
  it("autor y user_id salen de la sesión, no del cuerpo", async () => {
    m.auth.mockResolvedValue({ user: yo });
    m.sistema.mockResolvedValue([filaCreada]);
    const r = await POST(post({ curso: CURSO, clase: CLASE, texto: "  Hola  ", autor: "Administración", user_id: "otro" }));
    expect(r.status).toBe(201);
    const enviado = JSON.parse(m.sistema.mock.calls[0][1].body);
    expect(enviado).toEqual({ curso: CURSO, clase: CLASE, user_id: yo.id, autor: "Ana Pérez", texto: "Hola", padre_id: null });
  });

  it("sin nombre en el perfil firma «Participante», nunca con el DNI", async () => {
    m.auth.mockResolvedValue({ user: { ...yo, nombreCompleto: "45871236" } });
    m.sistema.mockResolvedValue([filaCreada]);
    await POST(post({ curso: CURSO, clase: CLASE, texto: "Hola" }));
    expect(JSON.parse(m.sistema.mock.calls[0][1].body).autor).toBe("Participante");
  });

  it("rechaza texto vacío o clase inexistente sin tocar la base", async () => {
    m.auth.mockResolvedValue({ user: yo });
    expect((await POST(post({ curso: CURSO, clase: CLASE, texto: "   " }))).status).toBe(400);
    expect((await POST(post({ curso: CURSO, clase: "inventada", texto: "Hola" }))).status).toBe(400);
    expect((await POST(post({ curso: CURSO, clase: CLASE, texto: "Hola", padreId: "no-uuid" }))).status).toBe(400);
    expect(m.sistema).not.toHaveBeenCalled();
  });

  it("solo se responde a un comentario raíz de la misma clase", async () => {
    m.auth.mockResolvedValue({ user: yo });
    m.sistema.mockResolvedValueOnce([]);
    expect((await POST(post({ curso: CURSO, clase: CLASE, texto: "Hola", padreId: ID }))).status).toBe(404);
    expect(m.sistema.mock.calls[0][0]).toContain(`clase=eq.${CLASE}`);

    m.sistema.mockResolvedValueOnce([{ id: ID, padre_id: "44444444-4444-4444-8444-444444444444" }]);
    expect((await POST(post({ curso: CURSO, clase: CLASE, texto: "Hola", padreId: ID }))).status).toBe(400);
    expect(m.sistema).toHaveBeenCalledTimes(2);

    const RESPUESTA = "55555555-5555-4555-8555-555555555555";
    m.sistema.mockResolvedValueOnce([{ id: ID, padre_id: null }]).mockResolvedValueOnce([{ ...filaCreada, id: RESPUESTA, padre_id: ID }]);
    const r = await POST(post({ curso: CURSO, clase: CLASE, texto: "Hola", padreId: ID }));
    expect(r.status).toBe(201);
    // La respuesta creada vuelve entera: con armarHilos se perdía (descarta filas con padre) y el cliente rompía.
    expect(await r.json()).toMatchObject({ padreId: ID, comentario: { id: RESPUESTA, propio: true, meGusta: 0 } });
  });

  it("un comentario raíz creado vuelve con sus datos", async () => {
    m.auth.mockResolvedValue({ user: yo });
    m.sistema.mockResolvedValue([filaCreada]);
    const x = await (await POST(post({ curso: CURSO, clase: CLASE, texto: "Hola" }))).json();
    expect(x).toMatchObject({ padreId: null, comentario: { id: ID, autor: "Ana Pérez", propio: true, puedeBorrar: true } });
  });

  it("sin la migración aplicada responde 503", async () => {
    m.auth.mockResolvedValue({ user: yo });
    m.sistema.mockRejectedValue(tablaAusente());
    expect((await POST(post({ curso: CURSO, clase: CLASE, texto: "Hola" }))).status).toBe(503);
  });
});

describe("borrar", () => {
  it("el autor borra con su JWT: decide la RLS", async () => {
    m.auth.mockResolvedValue({ user: yo });
    m.usuario.mockResolvedValue([{ id: ID }]);
    expect((await DELETE(new Request(url), params(ID))).status).toBe(200);
    expect(m.usuario.mock.calls[0][0]).toBe("jwt-propio");
    expect(m.sistema).not.toHaveBeenCalled();
  });

  it("si la RLS no deja borrar nada (ajeno o inexistente), 404", async () => {
    m.auth.mockResolvedValue({ user: yo });
    m.usuario.mockResolvedValue([]);
    expect((await DELETE(new Request(url), params(ID))).status).toBe(404);
  });

  it("un administrador modera con service_role", async () => {
    m.auth.mockResolvedValue({ user: admin });
    m.sistema.mockResolvedValue([{ id: ID }]);
    expect((await DELETE(new Request(url), params(ID))).status).toBe(200);
    expect(m.sistema.mock.calls[0][1].method).toBe("DELETE");
    expect(m.usuario).not.toHaveBeenCalled();
  });

  it("un id que no es UUID no llega a la base", async () => {
    m.auth.mockResolvedValue({ user: admin });
    expect((await DELETE(new Request(url), params("1 or 1=1"))).status).toBe(400);
    expect(m.sistema).not.toHaveBeenCalled();
  });
});

describe("me gusta", () => {
  const pedir = (b: unknown, id = ID) => meGusta(new Request(url, { method: "POST", body: JSON.stringify(b) }), params(id));

  it("da y quita con el JWT propio y el user_id de la sesión", async () => {
    m.auth.mockResolvedValue({ user: yo });
    m.usuario.mockResolvedValue(undefined);
    expect((await pedir({ activo: true, user_id: "otro" })).status).toBe(200);
    expect(JSON.parse(m.usuario.mock.calls[0][2].body)).toEqual({ comentario_id: ID, user_id: yo.id });
    expect((await pedir({ activo: false })).status).toBe(200);
    expect(m.usuario.mock.calls[1][2].method).toBe("DELETE");
    expect(m.usuario.mock.calls[1][1]).toContain(`user_id=eq.${yo.id}`);
  });

  it("si el comentario se borró entretanto, 404", async () => {
    m.auth.mockResolvedValue({ user: yo });
    m.usuario.mockRejectedValue(new Error(`Supabase REST(user) 409: {"code":"23503"}`));
    expect((await pedir({ activo: true })).status).toBe(404);
  });

  it("valida id y cuerpo", async () => {
    m.auth.mockResolvedValue({ user: yo });
    expect((await pedir({ activo: "si" })).status).toBe(400);
    expect((await pedir({ activo: true }, "x")).status).toBe(400);
    expect(m.usuario).not.toHaveBeenCalled();
  });
});
