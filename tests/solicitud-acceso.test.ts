import { describe, expect, it } from "vitest";
import {
  LIMITES_SOLICITUD, codigoDeSolicitud, decidirSolicitud, mensajeBienvenida, solicitudSchema,
} from "@/lib/solicitud-acceso";
import { LISTA_MODULOS_EXTERNOS } from "@/lib/modulos-acceso";

const buena = {
  nombre: "María Fernanda Quispe Huamán",
  dni: "45871236",
  correo: "Maria.Quispe@Ejemplo.com",
  celular: "987 654 321",
  institucion: "Municipalidad Distrital de Challhuahuacho",
  modulos: ["centro_juridico"],
  motivo: "Preparo el examen de certificación OECE y necesito consultar la Ley 32069.",
  consentimiento: true,
};

describe("el formulario de solicitud de acceso valida en el servidor lo mismo que en la pantalla", () => {
  it("acepta una solicitud completa y normaliza el correo", () => {
    const r = solicitudSchema.safeParse(buena);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.correo).toBe("maria.quispe@ejemplo.com");
  });

  it("el celular y la institución son opcionales, también como texto vacío", () => {
    expect(solicitudSchema.safeParse({ ...buena, celular: "", institucion: "" }).success).toBe(true);
    const { celular, institucion, ...sin } = buena;
    void celular; void institucion;
    expect(solicitudSchema.safeParse(sin).success).toBe(true);
  });

  it("cada campo obligatorio rechaza lo que no sirve, con un mensaje que dice qué corregir", () => {
    const casos: Array<[string, Record<string, unknown>, string]> = [
      ["nombre corto", { nombre: "Ana" }, "nombre completo"],
      ["nombre con dígitos", { nombre: "Maria 123 Quispe" }, "letras"],
      ["nombre con marcado", { nombre: "<script>alert(1)</script>" }, "letras"],
      ["DNI de 7 dígitos", { dni: "4587123" }, "8 dígitos"],
      ["DNI con letras", { dni: "4587123a" }, "8 dígitos"],
      ["correo sin arroba", { correo: "mariaejemplo.com" }, "correo válido"],
      ["celular con letras", { celular: "tel: 987" }, "celular válido"],
      ["motivo corto", { motivo: "Para ver" }, "para qué lo necesitas"],
      ["motivo larguísimo", { motivo: "x".repeat(501) }, "demasiado largo"],
      ["sin módulos", { modulos: [] }, "al menos un módulo"],
      ["sin consentimiento", { consentimiento: false }, "tratamiento de tus datos"],
    ];
    for (const [nombre, cambio, fragmento] of casos) {
      const r = solicitudSchema.safeParse({ ...buena, ...cambio });
      expect(r.success, nombre).toBe(false);
      if (!r.success) expect(r.error.issues[0]?.message.toLowerCase(), nombre).toContain(fragmento.toLowerCase());
    }
  });

  it("solo acepta módulos que existen: nadie puede pedir (ni colar) uno inventado", () => {
    for (const modulos of [["admin"], ["centro_juridico", "configuracion"], ["__proto__"], "centro_juridico", [5]]) {
      expect(solicitudSchema.safeParse({ ...buena, modulos }).success, JSON.stringify(modulos)).toBe(false);
    }
    expect(solicitudSchema.safeParse({ ...buena, modulos: [...LISTA_MODULOS_EXTERNOS] }).success).toBe(true);
  });

  it("los campos que la persona no debe poder fijar (estado, rol, cuota) se descartan del resultado", () => {
    const r = solicitudSchema.safeParse({ ...buena, estado: "aprobada", role: "admin", cuota_ia_mensual: 999, tipo: "interno" });
    expect(r.success).toBe(true);
    if (r.success) {
      for (const clave of ["estado", "role", "cuota_ia_mensual", "tipo"]) expect(r.data, clave).not.toHaveProperty(clave);
    }
  });
});

describe("qué se hace con una solicitud válida", () => {
  const base = { senales: { sitioWeb: "", tardoMs: 15_000 }, pendientesMismoDni: 0, solicitudesIpUltimaHora: 0, ipConocida: true, pendientesTotales: 3 };

  it("una solicitud normal se acepta", () => {
    expect(decidirSolicitud(base)).toEqual({ tipo: "aceptar" });
  });

  it("el campo trampa relleno delata a un bot: se descarta en silencio, sin decirle por qué", () => {
    expect(decidirSolicitud({ ...base, senales: { sitioWeb: "http://spam.example", tardoMs: 15_000 } })).toEqual({ tipo: "descartar", motivo: "bot" });
    expect(decidirSolicitud({ ...base, senales: { sitioWeb: "   ", tardoMs: 15_000 } })).toEqual({ tipo: "aceptar" });
  });

  it("un envío instantáneo no lo hizo una persona; sí se le avisa, por si fue un autocompletado muy rápido", () => {
    const rapido = decidirSolicitud({ ...base, senales: { sitioWeb: "", tardoMs: LIMITES_SOLICITUD.tiempoMinimoMs - 1 } });
    expect(rapido).toMatchObject({ tipo: "rechazar", motivo: "muy_rapida", estado: 429 });
    expect(decidirSolicitud({ ...base, senales: { sitioWeb: "", tardoMs: LIMITES_SOLICITUD.tiempoMinimoMs } })).toEqual({ tipo: "aceptar" });
    // Sin la señal (alguien que llama a la API a mano) no se bloquea por velocidad: lo frenan los demás límites.
    expect(decidirSolicitud({ ...base, senales: {} })).toEqual({ tipo: "aceptar" });
    expect(decidirSolicitud({ ...base, senales: { tardoMs: "rápido" } })).toEqual({ tipo: "aceptar" });
  });

  it("una solicitud repetida del mismo DNI se descarta con la misma respuesta de éxito: no revela qué DNI están registrados", () => {
    expect(decidirSolicitud({ ...base, pendientesMismoDni: 1 })).toEqual({ tipo: "descartar", motivo: "duplicada" });
  });

  it("limita las solicitudes por IP y hora, pero no castiga a quien no se pudo identificar", () => {
    expect(decidirSolicitud({ ...base, solicitudesIpUltimaHora: LIMITES_SOLICITUD.porIpPorHora - 1 })).toEqual({ tipo: "aceptar" });
    expect(decidirSolicitud({ ...base, solicitudesIpUltimaHora: LIMITES_SOLICITUD.porIpPorHora })).toMatchObject({ tipo: "rechazar", motivo: "limite_ip", estado: 429 });
    expect(decidirSolicitud({ ...base, ipConocida: false, solicitudesIpUltimaHora: 99 })).toEqual({ tipo: "aceptar" });
  });

  it("con la bandeja llena no se reciben más hasta que el administrador la despeje", () => {
    expect(decidirSolicitud({ ...base, pendientesTotales: LIMITES_SOLICITUD.pendientesTotales - 1 })).toEqual({ tipo: "aceptar" });
    expect(decidirSolicitud({ ...base, pendientesTotales: LIMITES_SOLICITUD.pendientesTotales })).toMatchObject({ tipo: "rechazar", motivo: "saturado", estado: 503 });
  });

  it("el bot manda sobre lo demás: una trampa rellena nunca llega a contar como solicitud, ni con la bandeja llena", () => {
    expect(decidirSolicitud({ ...base, senales: { sitioWeb: "x", tardoMs: 1 }, pendientesTotales: 10_000 })).toEqual({ tipo: "descartar", motivo: "bot" });
  });
});

describe("código de la solicitud", () => {
  it("es corto, estable y legible", () => {
    const id = "3f2a9c1e-7b44-4d0a-9a55-0c1d2e3f4a5b";
    expect(codigoDeSolicitud(id)).toBe("SA-3F2A9C1E");
    expect(codigoDeSolicitud(id)).toBe(codigoDeSolicitud(id));
  });
});

describe("mensaje de bienvenida que el administrador entrega", () => {
  const datos = { nombre: "María Fernanda Quispe", usuario: "45871236", passwordTemporal: "Ace-abc123def456!9", urlLogin: "https://ace.example/login", modulos: ["centro_juridico", "simulacro"] };

  it("lleva lo necesario para entrar y explica el cambio de contraseña", () => {
    const m = mensajeBienvenida(datos);
    for (const parte of ["Hola María,", "https://ace.example/login", "45871236", "Ace-abc123def456!9", "Centro Jurídico, Simulacro de examen", "elegir tu propia contraseña"]) {
      expect(m, parte).toContain(parte);
    }
  });

  it("incluye la vigencia solo si existe", () => {
    expect(mensajeBienvenida({ ...datos, vigenteHasta: "2027-03-15T23:59:59-05:00" })).toMatch(/Acceso vigente hasta el 15 de marzo de 2027/);
    expect(mensajeBienvenida(datos)).not.toMatch(/vigente hasta/);
  });

  it("no deja líneas en blanco de más aunque falten módulos o vigencia", () => {
    for (const variante of [datos, { ...datos, modulos: [] }, { ...datos, modulos: [], vigenteHasta: null }, { ...datos, nombre: null }]) {
      const m = mensajeBienvenida(variante);
      expect(m, JSON.stringify(variante)).not.toMatch(/\n\n\n/);
      expect(m.startsWith("\n")).toBe(false);
      expect(m.endsWith("\n")).toBe(false);
    }
    expect(mensajeBienvenida({ ...datos, nombre: null }).startsWith("Hola,")).toBe(true);
  });

  it("ignora módulos que no existen en vez de imprimirlos", () => {
    expect(mensajeBienvenida({ ...datos, modulos: ["centro_juridico", "inventado"] })).not.toContain("inventado");
  });
});
