import { describe, expect, it } from "vitest";
import { elegirModelo } from "@/lib/openai-server";

// La precedencia de modelos era POR VARIABLE, no por proveedor: `OPENAI_PDF_OCR_MODEL`
// ganaba aunque el proveedor activo fuese Gemini o Z.ai. Con `GOOGLE_API_KEY` puesta
// y `OPENAI_PDF_OCR_MODEL=gpt-4o`, el OCR pedía "gpt-4o" a
// generativelanguage.googleapis.com → «models/gpt-4o is not found» (404), el PDF
// quedaba en error y el mensaje guardado ("404 status code (no body)") no
// mencionaba el modelo. Verificado contra el endpoint real: gpt-4o → 404,
// gemini-2.5-flash → 200.

const POR_DEFECTO = { gemini: "gemini-2.5-flash", openai: "gpt-4o-mini", zai: "glm-4.5v" };

describe("elegirModelo", () => {
  it("usa el override del proveedor activo", () => {
    expect(elegirModelo("gemini", { gemini: "gemini-3-pro" }, POR_DEFECTO)).toBe("gemini-3-pro");
    expect(elegirModelo("zai", { zai: "glm-5v" }, POR_DEFECTO)).toBe("glm-5v");
  });

  it("IGNORA el override de otro proveedor: es el fallo que rompía el OCR", () => {
    expect(elegirModelo("gemini", { openai: "gpt-4o" }, POR_DEFECTO)).toBe("gemini-2.5-flash");
    expect(elegirModelo("zai", { openai: "gpt-4o" }, POR_DEFECTO)).toBe("glm-4.5v");
    expect(elegirModelo("openai", { gemini: "gemini-2.5-flash" }, POR_DEFECTO)).toBe("gpt-4o-mini");
  });

  it("un valor en blanco es «sin configurar», no un modelo sin nombre", () => {
    // `??` dejaba pasar la cadena vacía y se pedía model: "".
    expect(elegirModelo("gemini", { gemini: "" }, POR_DEFECTO)).toBe("gemini-2.5-flash");
    expect(elegirModelo("gemini", { gemini: "   " }, POR_DEFECTO)).toBe("gemini-2.5-flash");
    expect(elegirModelo("gemini", { gemini: undefined }, POR_DEFECTO)).toBe("gemini-2.5-flash");
  });

  it("recorta los espacios de alrededor", () => {
    expect(elegirModelo("openai", { openai: "  gpt-4.1-mini \n" }, POR_DEFECTO)).toBe("gpt-4.1-mini");
  });

  it("sin ningún override, cada proveedor cae a su propio valor", () => {
    for (const p of ["gemini", "openai", "zai"] as const) {
      expect(elegirModelo(p, {}, POR_DEFECTO)).toBe(POR_DEFECTO[p]);
    }
  });
});
