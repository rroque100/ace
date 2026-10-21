import { describe, expect, it } from "vitest";
import { PROPORCION_SUBSANACION, topeSubsanacion } from "@/lib/plazo-subsanacion";
import { FICHA_SECCIONES } from "@/lib/necesidad-ficha-secciones";

/**
 * El formato dice el tope sin número: «un plazo para subsanar, el cual no debe
 * ser mayor al 30% del plazo del entregable correspondiente». Ese 30% se
 * calcula sobre el plazo de ejecución que el área usuaria ya registró.
 */
const campo = (api: string) => FICHA_SECCIONES.flatMap((s) => s.fields).find((f) => f.api === api)!;

describe("el 30% del plazo del entregable", () => {
  it("es el que fija el Art. 144", () => {
    expect(PROPORCION_SUBSANACION).toBe(0.3);
  });

  it("sale de la cifra registrada en el plazo de ejecución", () => {
    expect(topeSubsanacion(60)).toBe(18);
    expect(topeSubsanacion(30)).toBe(9);
    expect(topeSubsanacion(10)).toBe(3);
  });

  it("redondea hacia ABAJO, porque es un máximo", () => {
    // 7 × 0,3 = 2,1. Redondear hacia arriba daría 3, que ya pasa del tope.
    expect(topeSubsanacion(7)).toBe(2);
    expect(topeSubsanacion(365)).toBe(109); // 109,5
  });

  it("acepta el valor tal como viene del formulario, que es texto", () => {
    expect(topeSubsanacion("60")).toBe(18);
    expect(topeSubsanacion(" 60 ")).toBe(18);
  });

  it("sin plazo de ejecución no hay tope que calcular", () => {
    expect(topeSubsanacion(null)).toBeNull();
    expect(topeSubsanacion(undefined)).toBeNull();
    expect(topeSubsanacion("")).toBeNull();
    expect(topeSubsanacion("no es un número")).toBeNull();
    expect(topeSubsanacion(0)).toBeNull();
    expect(topeSubsanacion(-5)).toBeNull();
  });

  it("y con plazos tan cortos que el 30% no llega a un día, tampoco", () => {
    // Un tope de cero bloquearía el campo entero. Quedarse sin registrar el
    // plazo es peor que registrar uno que la norma no sabe expresar en días
    // enteros, así que ahí no se aplica tope.
    expect(topeSubsanacion(3)).toBeNull(); // 0,9
    expect(topeSubsanacion(1)).toBeNull();
    expect(topeSubsanacion(4)).toBe(1); // 1,2 — el primero que sí cabe
  });
});

describe("la conformidad arranca en siete días", () => {
  it("porque siete es la regla y veinte la excepción", () => {
    // Art. 144: siete días, o hasta veinte si hacen falta pruebas que
    // verifiquen el cumplimiento. Lo excepcional se elige; lo normal no.
    expect(campo("conformidadPlazo").porDefecto).toBe("7");
  });

  it("y el valor por defecto cabe en el rango del propio campo", () => {
    const f = campo("conformidadPlazo");
    const n = Number(f.porDefecto);
    expect(n).toBeGreaterThanOrEqual(f.min!);
    expect(n).toBeLessThanOrEqual(f.max!);
  });

  it("el formulario lo siembra al abrir, así que el campo lo TIENE", async () => {
    // Sin la siembra, un numérico con valor por defecto se guardaba vacío:
    // `construirPayload` se salta los números en blanco.
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("app/components/necesidad/usar-ficha-form.ts", "utf-8");
    const i = fuente.indexOf("function startFichaEdit");
    const cuerpo = fuente.slice(i, fuente.indexOf("setFichaEdit(true)", i));
    expect(cuerpo).toContain("f.porDefecto");
    expect(cuerpo).toContain("initial[f.api] = f.porDefecto");
  });

  it("y siembra TODOS los que la norma impone, no solo este", () => {
    // El cómputo del plazo (Art. 105.3) es el otro.
    const conDefecto = FICHA_SECCIONES.flatMap((s) => s.fields).filter((f) => f.porDefecto);
    expect(conDefecto.map((f) => f.api).sort()).toEqual(["conformidadPlazo", "plazoEjecucionUnidad"]);
  });
});

describe("el tope llega hasta la casilla", () => {
  it("el padre lo calcula y lo baja como número suelto", async () => {
    // Se vigila el fuente porque el suite no monta React. Baja como escalar y
    // no leyendo el formulario dentro del campo: eso anularía su memoización.
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("app/components/necesidad/ficha-editable.tsx", "utf-8");
    expect(fuente).toContain("topeSubsanacion(fichaForm.plazoEjecucion)");
    expect(fuente).toContain('field.api === "conformidadPlazoSubsanacion" ? topeSubsanacionDias : null');
  });

  it("y el motivo dice de dónde sale el número", async () => {
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("app/components/necesidad/ficha-editable.tsx", "utf-8");
    expect(fuente).toContain("es el 30% del plazo de ejecución");
  });

  it("el campo lo aplica en el input y al salir", async () => {
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("app/components/necesidad/campo-ficha.tsx", "utf-8");
    // El calculado manda sobre el tope fijo del catálogo.
    expect(fuente).toContain("const topeEfectivo = topeCalculado ?? field.max ?? null");
    expect(fuente).toContain("max={field.kind === \"number\" ? topeEfectivo ?? undefined : undefined}");
    // Y la validación al salir del campo, que es la que da el motivo.
    const i = fuente.indexOf("const validarAlSalir");
    const cuerpo = fuente.slice(i, fuente.indexOf("\n  };", i));
    expect(cuerpo).toContain("n > topeEfectivo");
    expect(cuerpo).toContain("topeMotivo");
  });

  it("el rango se comprueba aunque el campo no sea obligatorio", async () => {
    // Pasarse del tope es un error igual en un campo opcional, y además el
    // esquema lo rechazaría con un 400 al guardar.
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("app/components/necesidad/campo-ficha.tsx", "utf-8");
    const i = fuente.indexOf("const validarAlSalir");
    const cuerpo = fuente.slice(i, fuente.indexOf("\n  };", i));
    expect(cuerpo.indexOf("n > topeEfectivo")).toBeLessThan(cuerpo.indexOf("if (!obligatorio)"));
  });
});
