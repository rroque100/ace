import { beforeEach, describe, expect, it, vi } from "vitest";
import { cargarCatalogo, olvidarCatalogo } from "@/lib/settings-catalog-cache";

/**
 * `useSettingsCatalog` pedía `/api/settings/catalog` una vez POR CADA componente
 * que lo usara. Son trece, y en la ficha de necesidad coinciden dos en pantalla
 * —el detalle y el formulario—, así que se pedía el mismo catálogo dos veces a
 * la vez. Navegar entre pantallas lo volvía a pedir entero cada vez.
 *
 * La caché vive fuera de React porque el problema es entre INSTANCIAS: un
 * `useRef` o un estado no lo resuelven, cada componente tiene el suyo.
 */
describe("una sola petición del catálogo para todos", () => {
  beforeEach(() => {
    olvidarCatalogo();
  });

  it("dos llamadas a la vez comparten UNA sola petición", async () => {
    const fetchFalso = vi.fn(async () => new Response(JSON.stringify({ entity: { name: "ACE" } })));
    const [a, b] = await Promise.all([cargarCatalogo(fetchFalso), cargarCatalogo(fetchFalso)]);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(a).toBe(b); // el MISMO objeto: no dos copias equivalentes
  });

  it("una llamada posterior reutiliza lo ya cargado", async () => {
    const fetchFalso = vi.fn(async () => new Response(JSON.stringify({ entity: { name: "ACE" } })));
    await cargarCatalogo(fetchFalso);
    await cargarCatalogo(fetchFalso);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it("si falla NO se cachea el fallo: el siguiente vuelve a intentarlo", async () => {
    // Cachear el error dejaría la aplicación sin catálogo hasta recargar, y el
    // fallo típico aquí es una red que va y viene.
    const queFalla = vi.fn(async () => {
      throw new Error("sin red");
    });
    await expect(cargarCatalogo(queFalla)).rejects.toThrow("sin red");
    const queVa = vi.fn(async () => new Response(JSON.stringify({ entity: { name: "ACE" } })));
    await cargarCatalogo(queVa);
    expect(queVa).toHaveBeenCalledTimes(1);
  });

  it("una respuesta no-ok tampoco se cachea", async () => {
    const noOk = vi.fn(async () => new Response("nope", { status: 500 }));
    await expect(cargarCatalogo(noOk)).rejects.toThrow();
    const queVa = vi.fn(async () => new Response(JSON.stringify({ entity: { name: "ACE" } })));
    await cargarCatalogo(queVa);
    expect(queVa).toHaveBeenCalledTimes(1);
  });

  it("olvidarCatalogo obliga a pedirlo de nuevo", () => {
    // Lo necesita Configuración: al guardar la entidad, el catálogo en memoria
    // deja de ser cierto.
    const fetchFalso = vi.fn(async () => new Response(JSON.stringify({})));
    return cargarCatalogo(fetchFalso)
      .then(() => olvidarCatalogo())
      .then(() => cargarCatalogo(fetchFalso))
      .then(() => expect(fetchFalso).toHaveBeenCalledTimes(2));
  });
});
