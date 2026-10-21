import { describe, expect, it } from "vitest";
import { decidirSiembra } from "@/lib/necesidad-denominacion";

const MAX = 500;

/** Teclea `texto` letra a letra en `api`, arrastrando el estado como la UI. */
function teclear(
  texto: string,
  api: string,
  inicio: { form: Record<string, string>; sembrados: Set<string> },
) {
  let { form, sembrados } = { form: { ...inicio.form }, sembrados: new Set(inicio.sembrados) };
  for (let i = 1; i <= texto.length; i += 1) {
    const value = texto.slice(0, i);
    const gemelo = api === "nombre" ? "descripcionDetallada" : "nombre";
    const r = decidirSiembra({ api, value, valorGemelo: form[gemelo] ?? "", sembrados, maxNombre: MAX });
    form = { ...form, [api]: value };
    if (r.sembrar) form[r.sembrar] = value;
    sembrados = r.sembrados;
  }
  return { form, sembrados };
}

const vacio = { form: {} as Record<string, string>, sembrados: new Set<string>() };

describe("siembra Nombre ↔ Descripción detallada", () => {
  it("copia el nombre a la descripción vacía mientras se teclea", () => {
    const { form } = teclear("ADQUISICION DE SERVIDOR", "nombre", vacio);
    expect(form.nombre).toBe("ADQUISICION DE SERVIDOR");
    expect(form.descripcionDetallada).toBe("ADQUISICION DE SERVIDOR");
  });

  it("copia en el sentido inverso: descripción → nombre", () => {
    const { form } = teclear("Servidor rack 2U", "descripcionDetallada", vacio);
    expect(form.nombre).toBe("Servidor rack 2U");
  });

  it("no se detiene en la segunda letra (el bug del 'solo si está vacío')", () => {
    // Tras la primera pulsación el gemelo ya NO está vacío: si la condición
    // fuera solo "está vacío", la copia se quedaría en "A".
    const { form } = teclear("ABC", "nombre", vacio);
    expect(form.descripcionDetallada).toBe("ABC");
  });

  it("deja de sembrar en cuanto el usuario escribe en el gemelo", () => {
    const paso1 = teclear("ADQUISICION DE SERVIDOR", "nombre", vacio);
    // El usuario ahora detalla las especificaciones a mano.
    const paso2 = teclear("Servidor rack 2U, 64 GB RAM", "descripcionDetallada", paso1);
    // Y vuelve a retocar el nombre: la descripción ya tiene dueño.
    const paso3 = teclear("ADQUISICION DE SERVIDOR PARA LA OGA", "nombre", paso2);
    expect(paso3.form.descripcionDetallada).toBe("Servidor rack 2U, 64 GB RAM");
    expect(paso3.form.nombre).toBe("ADQUISICION DE SERVIDOR PARA LA OGA");
  });

  it("nunca pisa un campo que ya venía guardado de la base", () => {
    const guardado = {
      form: { descripcionDetallada: "Papel bond A4 de 80g, blanco" },
      sembrados: new Set<string>(),
    };
    const { form } = teclear("ADQUISICION DE PAPEL", "nombre", guardado);
    expect(form.descripcionDetallada).toBe("Papel bond A4 de 80g, blanco");
  });

  it("no siembra un nombre que el servidor rechazaría por largo", () => {
    // La descripción admite 2000 y el nombre 500: pasado el tope se congela en
    // vez de dejar la ficha inguardable con "Too big: expected <=500".
    const largo = "E".repeat(MAX + 50);
    const { form } = teclear(largo, "descripcionDetallada", vacio);
    expect(form.descripcionDetallada).toHaveLength(MAX + 50);
    expect(form.nombre!.length).toBeLessThanOrEqual(MAX);
  });

  it("reanuda la siembra si la descripción vuelve a caber", () => {
    const largo = teclear("E".repeat(MAX + 10), "descripcionDetallada", vacio);
    // Borrar hasta volver bajo el tope: el nombre nunca dejó de seguirla.
    const corto = teclear("SERVIDOR", "descripcionDetallada", largo);
    expect(corto.form.nombre).toBe("SERVIDOR");
  });

  it("ignora los campos que no tienen gemelo", () => {
    const r = decidirSiembra({
      api: "finalidadPublica",
      value: "x",
      valorGemelo: "",
      sembrados: new Set(),
      maxNombre: MAX,
    });
    expect(r.sembrar).toBeNull();
  });
});
