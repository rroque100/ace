import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ user: null as unknown, registrar: vi.fn(async () => {}) }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: "consulta", entity: null, oficina_id: null } }) }) }) }),
  }),
}));
vi.mock("@/lib/auditoria-externos", () => ({ registrarEventoAcceso: mocks.registrar }));
import { updateSession } from "@/lib/supabase/middleware";

const AHORA = Date.now();
const DIA = 86_400_000;
const externo = (appMetadata: Record<string, unknown>) => ({ id: "ext-1", email: "12345678@ace.local", app_metadata: appMetadata });
const juridico = externo({ tipo: "externo", modulos: ["centro_juridico"], vigente_hasta: new Date(AHORA + 30 * DIA).toISOString(), cuota_ia_mensual: 50000 });

function solicitud(ruta: string, opciones: { metodo?: string; cabeceras?: Record<string, string> } = {}) {
  return new NextRequest(`http://localhost:3000${ruta}`, {
    method: opciones.metodo ?? "GET",
    headers: { accept: "text/html", "x-forwarded-for": "190.12.5.7, 10.0.0.1", "user-agent": "Mozilla/5.0 prueba", ...opciones.cabeceras },
  });
}
const reenviada = (respuesta: Response, nombre: string) => respuesta.headers.get(`x-middleware-request-${nombre}`);

beforeEach(() => {
  mocks.registrar.mockClear();
  mocks.user = null;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proyecto.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-de-prueba");
});

describe("proxy: cuenta externa con un módulo", () => {
  it("deja pasar su módulo, anota la visita con su IP y le pasa su identidad al servidor", async () => {
    mocks.user = juridico;
    const trabajos: Promise<unknown>[] = [];
    const respuesta = await updateSession(solicitud("/chat"), (t) => trabajos.push(t));
    expect(respuesta.status).toBe(200);
    await Promise.all(trabajos);
    expect(mocks.registrar).toHaveBeenCalledTimes(1);
    expect(mocks.registrar).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: "ext-1", usuario: "12345678", modulo: "centro_juridico", accion: "ver /chat", ruta: "/chat", metodo: "GET", ip: "190.12.5.7", userAgent: "Mozilla/5.0 prueba" }));
    expect(reenviada(respuesta, "x-ace-uid")).toBe("ext-1");
    expect(reenviada(respuesta, "x-ace-tipo")).toBe("externo");
    expect(reenviada(respuesta, "x-ace-cuota")).toBe("50000");
    expect(reenviada(respuesta, "x-ace-ip")).toBe("190.12.5.7");
    expect(reenviada(respuesta, "x-ace-ruta")).toBe("/chat");
  });

  it("lo que escribe en la IP o la query nunca se guarda: solo la ruta", async () => {
    mocks.user = juridico;
    await updateSession(solicitud("/busqueda?q=mi+pregunta+privada"), (t) => void t);
    const llamada = mocks.registrar.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(llamada[0].ruta).toBe("/busqueda");
    expect(JSON.stringify(llamada[0])).not.toContain("privada");
  });

  it("anota lo que ESCRIBE (preguntar al chat) y no las lecturas de API", async () => {
    mocks.user = juridico;
    await updateSession(solicitud("/api/chat", { metodo: "POST", cabeceras: { accept: "application/json" } }), (t) => void t);
    await updateSession(solicitud("/api/chat/sessions", { cabeceras: { accept: "application/json" } }), (t) => void t);
    expect(mocks.registrar).toHaveBeenCalledTimes(1);
    expect(mocks.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: "api POST /api/chat", modulo: "centro_juridico" }));
  });

  it("una navegación dentro de la app (RSC) cuenta como visita; la precarga, no", async () => {
    mocks.user = juridico;
    await updateSession(solicitud("/normas", { cabeceras: { accept: "text/x-component", rsc: "1" } }), (t) => void t);
    expect(mocks.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: "ver /normas" }));
    mocks.registrar.mockClear();
    await updateSession(solicitud("/normas", { cabeceras: { accept: "text/x-component", rsc: "1", "next-router-prefetch": "1" } }), (t) => void t);
    expect(mocks.registrar).not.toHaveBeenCalled();
  });

  it("una página que no es suya la devuelve a su inicio y el intento queda anotado", async () => {
    mocks.user = juridico;
    const respuesta = await updateSession(solicitud("/configuracion"), (t) => void t);
    expect(respuesta.status).toBeGreaterThanOrEqual(300);
    expect(respuesta.status).toBeLessThan(400);
    expect(new URL(respuesta.headers.get("location") ?? "").pathname).toBe("/chat");
    expect(mocks.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: "acceso denegado (ruta): /configuracion", estado: 403 }));
  });

  it("«/» la lleva a su inicio sin contarse como intento indebido", async () => {
    mocks.user = juridico;
    const respuesta = await updateSession(solicitud("/"), (t) => void t);
    expect(new URL(respuesta.headers.get("location") ?? "").pathname).toBe("/chat");
    expect(mocks.registrar).not.toHaveBeenCalled();
  });

  it("una API que no es suya responde 403 (no una redirección) y queda anotada", async () => {
    mocks.user = juridico;
    for (const ruta of ["/api/configuracion/users", "/api/necesidades", "/api/processes", "/api/asistente"]) {
      const respuesta = await updateSession(solicitud(ruta, { metodo: "POST", cabeceras: { accept: "application/json" } }), (t) => void t);
      expect(respuesta.status, ruta).toBe(403);
      expect((await respuesta.json()).error, ruta).toContain("no tiene acceso");
    }
    expect(mocks.registrar).toHaveBeenCalledTimes(4);
  });

  it("no se le abre el simulacro si no lo tiene habilitado, ni el Centro Jurídico si solo tiene el simulacro", async () => {
    mocks.user = juridico;
    expect((await updateSession(solicitud("/simulacro"), (t) => void t)).headers.get("location")).toContain("/chat");
    mocks.user = externo({ tipo: "externo", modulos: ["simulacro"] });
    expect((await updateSession(solicitud("/chat"), (t) => void t)).headers.get("location")).toContain("/simulacro");
    expect((await updateSession(solicitud("/simulacro"), (t) => void t)).status).toBe(200);
  });
});

describe("proxy: cuenta externa vencida o sin módulos", () => {
  it("un acceso vencido no abre nada: solo entrar y salir", async () => {
    mocks.user = externo({ tipo: "externo", modulos: ["centro_juridico"], vigente_hasta: new Date(AHORA - DIA).toISOString() });
    const pagina = await updateSession(solicitud("/chat"), (t) => void t);
    expect(pagina.headers.get("location")).toContain("/login?acceso=vencido");
    const api = await updateSession(solicitud("/api/chat", { metodo: "POST", cabeceras: { accept: "application/json" } }), (t) => void t);
    expect(api.status).toBe(403);
    expect((await api.json()).error).toContain("vencido");
    expect((await updateSession(solicitud("/login"), (t) => void t)).status).toBe(200);
    expect((await updateSession(solicitud("/auth/signout", { metodo: "POST" }), (t) => void t)).status).toBe(200);
    expect(mocks.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: "acceso denegado (vencido): /chat" }));
  });

  it("una fecha de fin ilegible vence en vez de valer para siempre", async () => {
    mocks.user = externo({ tipo: "externo", modulos: ["centro_juridico"], vigente_hasta: "pronto" });
    expect((await updateSession(solicitud("/chat"), (t) => void t)).headers.get("location")).toContain("acceso=vencido");
  });

  it("una cuenta sin módulos (p. ej. registrada por su cuenta) no abre nada", async () => {
    mocks.user = externo({ tipo: "externo", modulos: [] });
    expect((await updateSession(solicitud("/chat"), (t) => void t)).headers.get("location")).toContain("acceso=sin_modulos");
    expect((await updateSession(solicitud("/api/chat", { metodo: "POST", cabeceras: { accept: "application/json" } }), (t) => void t)).status).toBe(403);
  });
});

describe("proxy: las cabeceras de identidad no se pueden falsear", () => {
  it("lo que el cliente mande con esos nombres se sobrescribe con lo validado", async () => {
    mocks.user = juridico;
    const respuesta = await updateSession(solicitud("/chat", { cabeceras: { "x-ace-uid": "otro-usuario", "x-ace-tipo": "interno", "x-ace-cuota": "999999999", "x-ace-ip": "1.1.1.1", "x-ace-ruta": "/necesidades" } }), (t) => void t);
    expect(reenviada(respuesta, "x-ace-uid")).toBe("ext-1");
    expect(reenviada(respuesta, "x-ace-tipo")).toBe("externo");
    expect(reenviada(respuesta, "x-ace-cuota")).toBe("50000");
    expect(reenviada(respuesta, "x-ace-ip")).toBe("190.12.5.7");
    expect(reenviada(respuesta, "x-ace-ruta")).toBe("/chat");
  });

  it("sin sesión llegan vacías: nadie puede presentarse como un usuario que no es", async () => {
    const respuesta = await updateSession(solicitud("/login", { cabeceras: { "x-ace-uid": "admin-falso", "x-ace-tipo": "interno" } }), (t) => void t);
    expect(respuesta.status).toBe(200);
    expect(reenviada(respuesta, "x-ace-uid")).toBe("");
    expect(reenviada(respuesta, "x-ace-tipo")).toBe("");
  });

  it("sin sesión se sigue enviando a /login y las APIs responden 401", async () => {
    const pagina = await updateSession(solicitud("/chat"), (t) => void t);
    expect(new URL(pagina.headers.get("location") ?? "").pathname).toBe("/login");
    const api = await updateSession(solicitud("/api/chat", { metodo: "POST", cabeceras: { accept: "application/json" } }), (t) => void t);
    expect(api.status).toBe(401);
  });

  it("la IP viene de las cabeceras de la plataforma antes que de x-forwarded-for, que escribe el cliente", async () => {
    mocks.user = juridico;
    const respuesta = await updateSession(solicitud("/chat", { cabeceras: { "x-vercel-forwarded-for": "181.65.1.9", "x-forwarded-for": "6.6.6.6" } }), (t) => void t);
    expect(reenviada(respuesta, "x-ace-ip")).toBe("181.65.1.9");
  });
});

describe("proxy: el personal de la entidad no cambia", () => {
  const interno = { id: "int-1", email: "99999999@ace.local", app_metadata: { tipo: "interno" } };
  it("accede a todo como antes, sin que se anote nada, y sin cuota", async () => {
    mocks.user = interno;
    for (const ruta of ["/chat", "/necesidades", "/configuracion", "/api/necesidades"]) {
      const respuesta = await updateSession(solicitud(ruta, { cabeceras: { accept: "application/json" } }), (t) => void t);
      expect(respuesta.status, ruta).toBe(200);
      expect(reenviada(respuesta, "x-ace-tipo"), ruta).toBe("interno");
      expect(reenviada(respuesta, "x-ace-cuota"), ruta).toBe("");
    }
    expect(mocks.registrar).not.toHaveBeenCalled();
  });
  it("una cuenta antigua sin `tipo` (anterior a este cambio) sigue siendo personal de la entidad", async () => {
    mocks.user = { id: "viejo", email: "11111111@ace.local", app_metadata: {} };
    expect((await updateSession(solicitud("/necesidades"), (t) => void t)).status).toBe(200);
    expect(mocks.registrar).not.toHaveBeenCalled();
  });
});

describe("proxy: solicitud de acceso (pública) y contraseña temporal", () => {
  const temporal = externo({ tipo: "externo", modulos: ["centro_juridico"], vigente_hasta: new Date(AHORA + 30 * DIA).toISOString(), cambiar_password: true });

  it("sin sesión se puede abrir el formulario de solicitud y enviarlo; el resto sigue pidiendo sesión", async () => {
    expect((await updateSession(solicitud("/acceso"), (t) => void t)).status).toBe(200);
    const envio = await updateSession(solicitud("/api/acceso/solicitud", { metodo: "POST", cabeceras: { accept: "application/json" } }), (t) => void t);
    expect(envio.status).toBe(200);
    // Solo esas dos rutas exactas: nada «bajo» ellas queda abierto por accidente.
    for (const ruta of ["/api/acceso", "/api/acceso/otra", "/acceso/x", "/api/configuracion/externos/solicitudes"]) {
      const respuesta = await updateSession(solicitud(ruta, { cabeceras: { accept: "application/json" } }), (t) => void t);
      expect(respuesta.status, ruta).not.toBe(200);
    }
  });

  it("una cuenta externa ya con sesión no usa el formulario de solicitud: se le lleva a su módulo", async () => {
    mocks.user = juridico;
    const respuesta = await updateSession(solicitud("/acceso"), (t) => void t);
    expect(new URL(respuesta.headers.get("location") ?? "").pathname).toBe("/chat");
  });

  it("con la contraseña temporal, cualquier página la lleva a elegir la suya, sin anotarlo como intento indebido", async () => {
    mocks.user = temporal;
    for (const ruta of ["/chat", "/busqueda", "/", "/configuracion"]) {
      const respuesta = await updateSession(solicitud(ruta), (t) => void t);
      expect(new URL(respuesta.headers.get("location") ?? "").pathname, ruta).toBe("/cambiar-password");
    }
    expect(mocks.registrar).not.toHaveBeenCalled();
  });

  it("con la contraseña temporal las APIs responden 403 con un código que la pantalla puede reconocer", async () => {
    mocks.user = temporal;
    const respuesta = await updateSession(solicitud("/api/chat", { metodo: "POST", cabeceras: { accept: "application/json" } }), (t) => void t);
    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toMatchObject({ codigo: "cambiar_password" });
  });

  it("la pantalla de elegir contraseña, su API y salir siguen abiertas con la contraseña temporal", async () => {
    mocks.user = temporal;
    expect((await updateSession(solicitud("/cambiar-password"), (t) => void t)).status).toBe(200);
    expect((await updateSession(solicitud("/api/auth/cambiar-password", { metodo: "POST", cabeceras: { accept: "application/json" } }), (t) => void t)).status).toBe(200);
    expect((await updateSession(solicitud("/auth/signout", { metodo: "POST" }), (t) => void t)).status).toBe(200);
  });

  it("elegida la contraseña, la cuenta vuelve a su módulo", async () => {
    mocks.user = externo({ tipo: "externo", modulos: ["centro_juridico"], vigente_hasta: new Date(AHORA + 30 * DIA).toISOString(), cambiar_password: false });
    expect((await updateSession(solicitud("/chat"), (t) => void t)).status).toBe(200);
  });

  it("el personal de la entidad no se ve afectado por ninguna de las dos cosas", async () => {
    mocks.user = { id: "int-2", email: "88888888@ace.local", app_metadata: { tipo: "interno", cambiar_password: true } };
    expect((await updateSession(solicitud("/necesidades"), (t) => void t)).status).toBe(200);
  });
});
