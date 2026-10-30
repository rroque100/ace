import { describe, expect, it } from "vitest";
import {
  LISTA_MODULOS_EXTERNOS, MODULOS_EXTERNOS, accionAuditable, credencialParaGuardar, inicioExterno, ipDeSolicitud, leerCredencialExterna,
  decidirAccesoExterno, moduloDeRuta, rutaPermitidaExterno,
} from "@/lib/modulos-acceso";

const AHORA = Date.UTC(2026, 9, 29, 12);

describe("rutas que abre cada módulo: todo lo demás está cerrado", () => {
  const juridico = ["centro_juridico"] as const;
  const simulacro = ["simulacro"] as const;
  const ambos = ["centro_juridico", "simulacro"] as const;

  it("el Centro Jurídico abre el chat, la búsqueda y las normas, con sus APIs", () => {
    for (const ruta of ["/chat", "/busqueda", "/normas", "/api/chat", "/api/chat/sessions/abc", "/api/search/voice", "/api/norms/versions", "/api/documents/123"]) {
      expect(rutaPermitidaExterno(juridico, ruta), ruta).toBe(true);
    }
  });
  it("y no abre nada del personal de la entidad ni del otro módulo", () => {
    for (const ruta of [
      "/necesidades", "/expedientes", "/contratos", "/archivo", "/expedientes-archivo", "/configuracion", "/auditoria", "/metricas", "/evaluacion",
      "/historial", "/guardado", "/alertas", "/validar", "/analizar", "/comparar", "/simulacro",
      "/api/configuracion/users", "/api/necesidades", "/api/processes", "/api/audit", "/api/usage", "/api/asistente", "/api/corpus", "/api/simulacro",
    ]) expect(rutaPermitidaExterno(juridico, ruta), ruta).toBe(false);
  });
  it("el simulacro abre solo su página y su API", () => {
    expect(rutaPermitidaExterno(simulacro, '/simulador')).toBe(true);
    expect(rutaPermitidaExterno(simulacro, '/api/exams/preparation')).toBe(true);
    expect(rutaPermitidaExterno(juridico, '/simulador')).toBe(false);
    expect(rutaPermitidaExterno(juridico, '/api/exams')).toBe(false);
    expect(moduloDeRuta('/api/exams/abc/activity')).toBe('simulacro');
    expect(rutaPermitidaExterno(simulacro, "/simulacro")).toBe(true);
    expect(rutaPermitidaExterno(simulacro, "/api/simulacro/intentos")).toBe(true);
    for (const ruta of ["/chat", "/api/chat", "/normas", "/configuracion"]) expect(rutaPermitidaExterno(simulacro, ruta), ruta).toBe(false);
  });
  it("con ambos módulos abre la suma de los dos y nada más", () => {
    for (const ruta of ["/chat", "/normas", "/simulacro", "/api/simulacro/x", "/api/chat"]) expect(rutaPermitidaExterno(ambos, ruta), ruta).toBe(true);
    expect(rutaPermitidaExterno(ambos, "/")).toBe(true);
    for (const ruta of ["/configuracion", "/necesidades", "/api/configuracion/users"]) expect(rutaPermitidaExterno(ambos, ruta), ruta).toBe(false);
  });
  it("entrar, salir y la comprobación de salud están siempre abiertos; sin módulos, nada más", () => {
    for (const ruta of ["/login", "/auth/signout", "/api/health", "/api/auth/registro"]) {
      expect(rutaPermitidaExterno([], ruta), ruta).toBe(true);
    }
    for (const ruta of ["/chat", "/simulacro", "/"]) expect(rutaPermitidaExterno([], ruta), ruta).toBe(false);
  });
  it("no se deja engañar por prefijos parecidos ni por recorridos de ruta", () => {
    for (const ruta of ["/chatroom", "/chat-admin", "/busquedas", "/normas-internas", "/api/chatty", "/api/searchable", "/simulacros", "/loginx", "/authx/signout"]) {
      expect(rutaPermitidaExterno(ambos, ruta), ruta).toBe(false);
    }
  });
  it("cada página de cada módulo existe como carpeta de la app o está reservada (el simulacro aún no)", () => {
    expect(LISTA_MODULOS_EXTERNOS).toEqual(["centro_juridico", "simulacro"]);
    for (const modulo of LISTA_MODULOS_EXTERNOS) expect(MODULOS_EXTERNOS[modulo].paginas).toContain(MODULOS_EXTERNOS[modulo].inicio);
  });
});

describe("a qué módulo pertenece una ruta y dónde aterriza la persona", () => {
  it("anota el módulo para la auditoría", () => {
    expect(moduloDeRuta("/chat")).toBe("centro_juridico");
    expect(moduloDeRuta("/api/search/documents")).toBe("centro_juridico");
    expect(moduloDeRuta("/simulacro")).toBe("simulacro");
    expect(moduloDeRuta("/login")).toBeNull();
    expect(moduloDeRuta("/configuracion")).toBeNull();
  });
  it("aterriza en el inicio de su primer módulo, no en el panel general", () => {
    expect(inicioExterno(["simulacro", "centro_juridico"])).toBe("/simulacro");
    expect(inicioExterno(["centro_juridico"])).toBe("/chat");
    expect(inicioExterno([])).toBe("/login");
  });
});

describe("credenciales del externo en el token: lo ilegible no abre nada", () => {
  it("lee tipo, módulos, fin de vigencia y cuota", () => {
    const c = leerCredencialExterna({ tipo: "externo", modulos: ["centro_juridico", "simulacro"], vigente_hasta: "2027-01-31T00:00:00Z", cuota_ia_mensual: 200000 }, AHORA);
    expect(c).toMatchObject({ externo: true, modulos: ["centro_juridico", "simulacro"], vencido: false, cuotaIAMensual: 200000 });
    expect(c.vigenteHasta).toBe(Date.parse("2027-01-31T00:00:00Z"));
  });
  it("una cuenta que no es externa no es externa, venga lo que venga", () => {
    for (const meta of [null, undefined, "externo", 5, [], {}, { tipo: "interno", modulos: ["simulacro"] }, { tipo: "Externo" }]) {
      expect(leerCredencialExterna(meta, AHORA).externo, JSON.stringify(meta)).toBe(false);
    }
  });
  it("módulos desconocidos o mal formados se descartan: no se amplía el acceso", () => {
    expect(leerCredencialExterna({ tipo: "externo", modulos: ["centro_juridico", "admin", "__proto__", 5, null, "centro_juridico"] }, AHORA).modulos).toEqual(["centro_juridico"]);
    expect(leerCredencialExterna({ tipo: "externo", modulos: "centro_juridico" }, AHORA).modulos).toEqual([]);
    expect(leerCredencialExterna({ tipo: "externo" }, AHORA).modulos).toEqual([]);
  });
  it("vence al llegar la fecha; sin fecha no vence; una fecha ilegible vence en vez de valer para siempre", () => {
    expect(leerCredencialExterna({ tipo: "externo", modulos: [], vigente_hasta: "2026-10-29T11:59:59Z" }, AHORA).vencido).toBe(true);
    expect(leerCredencialExterna({ tipo: "externo", modulos: [], vigente_hasta: "2026-10-29T12:00:00Z" }, AHORA).vencido).toBe(true);
    expect(leerCredencialExterna({ tipo: "externo", modulos: [], vigente_hasta: "2026-10-29T12:00:01Z" }, AHORA).vencido).toBe(false);
    expect(leerCredencialExterna({ tipo: "externo", modulos: [], vigente_hasta: null }, AHORA).vencido).toBe(false);
    expect(leerCredencialExterna({ tipo: "externo", modulos: [] }, AHORA).vencido).toBe(false);
    expect(leerCredencialExterna({ tipo: "externo", modulos: [], vigente_hasta: "mañana" }, AHORA).vencido).toBe(true);
  });
  it("la cuota solo vale si es un número no negativo; cero es «sin IA», no «sin tope»", () => {
    expect(leerCredencialExterna({ tipo: "externo", modulos: [], cuota_ia_mensual: 0 }, AHORA).cuotaIAMensual).toBe(0);
    expect(leerCredencialExterna({ tipo: "externo", modulos: [], cuota_ia_mensual: 1500.9 }, AHORA).cuotaIAMensual).toBe(1500);
    for (const cuota of [-1, "100", null, Number.NaN, Number.POSITIVE_INFINITY]) expect(leerCredencialExterna({ tipo: "externo", modulos: [], cuota_ia_mensual: cuota }, AHORA).cuotaIAMensual).toBeNull();
  });
  it("lo que se guarda al dar de alta se puede volver a leer, y solo lleva módulos reales", () => {
    const guardado = credencialParaGuardar({ modulos: ["simulacro", "inventado", "simulacro"], vigenteHasta: "2027-03-01T00:00:00Z", cuotaIAMensual: 50000 });
    expect(guardado).toEqual({ tipo: "externo", modulos: ["simulacro"], vigente_hasta: "2027-03-01T00:00:00Z", cuota_ia_mensual: 50000 });
    expect(leerCredencialExterna(guardado, AHORA)).toMatchObject({ externo: true, modulos: ["simulacro"], cuotaIAMensual: 50000, vencido: false });
    expect(credencialParaGuardar({ modulos: [] })).toEqual({ tipo: "externo", modulos: [], vigente_hasta: null, cuota_ia_mensual: null });
  });
});

describe("IP del cliente: las cabeceras de la plataforma mandan sobre las que escribe el cliente", () => {
  const cab = (valores: Record<string, string>) => (nombre: string) => valores[nombre] ?? null;
  it("prefiere la cabecera de la plataforma a x-forwarded-for", () => {
    expect(ipDeSolicitud(cab({ "x-vercel-forwarded-for": "190.12.5.7", "x-forwarded-for": "6.6.6.6, 190.12.5.7" }))).toBe("190.12.5.7");
    expect(ipDeSolicitud(cab({ "x-real-ip": "200.1.2.3", "x-forwarded-for": "6.6.6.6" }))).toBe("200.1.2.3");
  });
  it("de x-forwarded-for toma el primer valor y acepta IPv6", () => {
    expect(ipDeSolicitud(cab({ "x-forwarded-for": "181.65.1.9, 10.0.0.1" }))).toBe("181.65.1.9");
    expect(ipDeSolicitud(cab({ "x-vercel-forwarded-for": "2800:200:e010:1::7" }))).toBe("2800:200:e010:1::7");
  });
  it("lo que no tiene forma de IP no se guarda (ni inyecta texto en la auditoría)", () => {
    for (const malo of ["<script>alert(1)</script>", "1.2.3.4; DROP TABLE", "x".repeat(200), "", "  "]) {
      expect(ipDeSolicitud(cab({ "x-forwarded-for": malo })), malo).toBe("desconocida");
    }
    expect(ipDeSolicitud(cab({}))).toBe("desconocida");
  });
});

describe("qué acciones se registran", () => {
  const sol = (metodo: string, pathname: string, extra: Partial<{ esDocumento: boolean; esPrecarga: boolean }> = {}) => ({ metodo, pathname, esDocumento: false, esPrecarga: false, ...extra });
  it("las páginas que abre y todo lo que escribe", () => {
    expect(accionAuditable(sol("GET", "/chat", { esDocumento: true }))).toBe("ver /chat");
    expect(accionAuditable(sol("POST", "/api/chat"))).toBe("api POST /api/chat");
    expect(accionAuditable(sol("post", "/api/search/voice"))).toBe("api POST /api/search/voice");
    expect(accionAuditable(sol("DELETE", "/api/chat/sessions/1"))).toBe("api DELETE /api/chat/sessions/1");
  });
  it("no las lecturas de API ni las precargas ni los recursos que no son páginas", () => {
    expect(accionAuditable(sol("GET", "/api/norms"))).toBeNull();
    expect(accionAuditable(sol("HEAD", "/api/search"))).toBeNull();
    expect(accionAuditable(sol("OPTIONS", "/api/chat"))).toBeNull();
    expect(accionAuditable(sol("GET", "/chat", { esDocumento: true, esPrecarga: true }))).toBeNull();
    expect(accionAuditable(sol("GET", "/chat"))).toBeNull();
  });
});

describe("decisión del proxy para una cuenta externa", () => {
  const vigente = (modulos: string[]) => leerCredencialExterna({ tipo: "externo", modulos, vigente_hasta: "2027-01-01T00:00:00Z" }, AHORA);
  it("con módulos vigentes deja pasar lo suyo", () => {
    expect(decidirAccesoExterno(vigente(["centro_juridico"]), "/chat")).toEqual({ tipo: "permitir" });
    expect(decidirAccesoExterno(vigente(["simulacro"]), "/api/simulacro/intentos")).toEqual({ tipo: "permitir" });
  });
  it("lo que no es suyo se deniega y se le lleva a su inicio", () => {
    const d = decidirAccesoExterno(vigente(["centro_juridico"]), "/configuracion");
    expect(d).toEqual({ tipo: "denegar", motivo: "ruta", destino: "/chat", esperado: false });
    expect(decidirAccesoExterno(vigente(["simulacro"]), "/chat")).toMatchObject({ tipo: "denegar", destino: "/simulacro" });
  });
  it("«/» abre el inicio personal y no habilita rutas del personal", () => {
    expect(decidirAccesoExterno(vigente(["centro_juridico"]), "/")).toEqual({ tipo: "permitir" });
    expect(rutaPermitidaExterno(["centro_juridico"], "/inicio-interno")).toBe(false);
  });
  it("un acceso vencido solo puede entrar, salir y comprobar la salud, aunque tenga módulos", () => {
    const vencida = leerCredencialExterna({ tipo: "externo", modulos: ["centro_juridico"], vigente_hasta: "2026-01-01T00:00:00Z" }, AHORA);
    for (const ruta of ["/login", "/auth/signout", "/api/health"]) expect(decidirAccesoExterno(vencida, ruta), ruta).toEqual({ tipo: "permitir" });
    for (const ruta of ["/chat", "/api/chat", "/"]) expect(decidirAccesoExterno(vencida, ruta), ruta).toMatchObject({ tipo: "denegar", motivo: "vencido", destino: "/login?acceso=vencido", esperado: false });
  });
  it("una cuenta sin módulos (o con módulos ilegibles) no abre nada más que entrar y salir", () => {
    const vacia = leerCredencialExterna({ tipo: "externo", modulos: ["inventado"] }, AHORA);
    expect(decidirAccesoExterno(vacia, "/login")).toEqual({ tipo: "permitir" });
    expect(decidirAccesoExterno(vacia, "/chat")).toMatchObject({ tipo: "denegar", motivo: "sin_modulos", destino: "/login?acceso=sin_modulos" });
  });
});

describe("entrar y salir no se duplican como acciones", () => {
  it("el POST de registro de acceso y el cierre de sesión no generan una fila propia", () => {
    expect(accionAuditable({ metodo: "POST", pathname: "/api/auth/registro-acceso", esDocumento: false, esPrecarga: false })).toBeNull();
    expect(accionAuditable({ metodo: "POST", pathname: "/auth/signout", esDocumento: false, esPrecarga: false })).toBeNull();
    expect(accionAuditable({ metodo: "GET", pathname: "/api/health", esDocumento: false, esPrecarga: false })).toBeNull();
  });
});

describe("contraseña temporal: hasta elegir la propia no se abre nada más", () => {
  const temporal = (modulos: string[], extra: Record<string, unknown> = {}) =>
    leerCredencialExterna({ tipo: "externo", modulos, vigente_hasta: "2027-01-01T00:00:00Z", cambiar_password: true, ...extra }, AHORA);

  it("solo cuenta el aviso cuando es exactamente `true`: un texto o un 1 no lo encienden ni lo apagan por error", () => {
    expect(temporal(["centro_juridico"]).cambiarPassword).toBe(true);
    for (const valor of [false, null, "true", 1, "si", undefined]) {
      expect(leerCredencialExterna({ tipo: "externo", modulos: ["centro_juridico"], cambiar_password: valor }, AHORA).cambiarPassword, String(valor)).toBe(false);
    }
    expect(leerCredencialExterna({ tipo: "interno", cambiar_password: true }, AHORA).cambiarPassword).toBe(false);
  });

  it("solo puede abrir la pantalla de elegir contraseña, la API que la guarda y salir; todo lo demás la devuelve ahí", () => {
    for (const modulos of [["centro_juridico"], ["simulacro"], ["centro_juridico", "simulacro"]]) {
      const credencial = temporal(modulos);
      for (const ruta of ["/cambiar-password", "/api/auth/cambiar-password", "/auth/signout"]) expect(decidirAccesoExterno(credencial, ruta), ruta).toEqual({ tipo: "permitir" });
      for (const ruta of ["/chat", "/simulacro", "/api/chat", "/api/simulacro/x", "/", "/login", "/configuracion", "/api/configuracion/users"]) {
        expect(decidirAccesoExterno(credencial, ruta), ruta).toEqual({ tipo: "denegar", motivo: "cambiar_password", destino: "/cambiar-password", esperado: true });
      }
    }
  });

  it("llevarla a elegir la contraseña no se cuenta como intento de acceso indebido", () => {
    const decision = decidirAccesoExterno(temporal(["centro_juridico"]), "/chat");
    expect(decision).toMatchObject({ tipo: "denegar", esperado: true });
  });

  it("un acceso vencido o sin módulos manda sobre el aviso: no hay nada que elegir si no se puede entrar", () => {
    expect(decidirAccesoExterno(temporal(["centro_juridico"], { vigente_hasta: "2026-01-01T00:00:00Z" }), "/chat")).toMatchObject({ motivo: "vencido" });
    expect(decidirAccesoExterno(temporal([]), "/chat")).toMatchObject({ motivo: "sin_modulos" });
  });

  it("una vez elegida (aviso apagado) vuelve a abrir sus módulos, y la pantalla de contraseña sigue accesible", () => {
    const normal = leerCredencialExterna({ tipo: "externo", modulos: ["centro_juridico"], cambiar_password: false }, AHORA);
    expect(decidirAccesoExterno(normal, "/chat")).toEqual({ tipo: "permitir" });
    expect(decidirAccesoExterno(normal, "/cambiar-password")).toEqual({ tipo: "permitir" });
  });

  it("editar módulos, vigencia o cuota no enciende ni apaga el aviso: solo se escribe cuando se indica", () => {
    expect(credencialParaGuardar({ modulos: ["simulacro"] })).not.toHaveProperty("cambiar_password");
    expect(credencialParaGuardar({ modulos: ["simulacro"], cambiarPassword: true })).toMatchObject({ cambiar_password: true });
    expect(credencialParaGuardar({ modulos: ["simulacro"], cambiarPassword: false })).toMatchObject({ cambiar_password: false });
  });
});
