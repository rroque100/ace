import { describe, expect, it } from "vitest";
import { resolverCabeceraDeOficina } from "@/lib/informe-aprobacion-datos";

// AL y DE de A8 pasaron a guardar el NOMBRE de la oficina elegida en el select
// del paso; el informe imprime a su responsable. Esta función hace esa
// resolución y, sobre todo, no rompe los expedientes ya redactados a mano.
const OFICINAS = [
  {
    nombre: "OFICINA GENERAL DE ADMINISTRACION JEFATURA",
    responsable_nombre: "QUISPE CHIPANA SAUL",
    responsable_cargo: "Jefe",
  },
  {
    nombre: "UNIDAD DE ABASTECIMIENTO",
    responsable_nombre: "ROJAS MAYTAN JUAN",
    responsable_cargo: "Jefe",
  },
];

const PADRON = [
  { nombre: "SAUL QUISPE CHIPANA", grado: "CPC." },
  { nombre: "JUAN ROJAS MAYTAN", grado: "CPC." },
];

describe("resolverCabeceraDeOficina", () => {
  it("del nombre de la oficina saca a su responsable, elevado con el padrón", () => {
    expect(resolverCabeceraDeOficina("OFICINA GENERAL DE ADMINISTRACION JEFATURA", OFICINAS, PADRON)).toBe(
      "CPC. SAUL QUISPE CHIPANA\nOFICINA GENERAL DE ADMINISTRACION JEFATURA",
    );
    expect(resolverCabeceraDeOficina("UNIDAD DE ABASTECIMIENTO", OFICINAS, PADRON)).toBe(
      "CPC. JUAN ROJAS MAYTAN\nJefe de la UNIDAD DE ABASTECIMIENTO",
    );
  });

  it("respeta el texto ya redactado a mano (expedientes anteriores)", () => {
    // El valor no casa con ninguna oficina: es la cabecera de dos líneas que la
    // DEC escribió antes de que el campo fuera un select. No se toca.
    const previo = "CPC. SAUL QUISPE CHIPANA\nOFICINA GENERAL DE ADMINISTRACION";
    expect(resolverCabeceraDeOficina(previo, OFICINAS, PADRON)).toBe(previo);
  });

  it("vacío se queda vacío para que el respaldo de Configuración tome el relevo", () => {
    expect(resolverCabeceraDeOficina("", OFICINAS, PADRON)).toBe("");
  });

  it("deriva el responsable del jefe asignado en Usuarios (fuente única)", () => {
    // La oficina no tiene responsable de texto libre; el jefe sale del usuario
    // marcado como jefe de esa oficina en Configuración → Usuarios.
    const oficinas = [
      { id: "of1", nombre: "DEPENDENCIA ENCARGADA DE CONTRATACIONES", responsable_nombre: null, responsable_cargo: null },
    ];
    const jefes = new Map([["of1", { nombre: "JUAN ROJAS MAYTAN", cargo: "Jefe" }]]);
    const r = resolverCabeceraDeOficina("DEPENDENCIA ENCARGADA DE CONTRATACIONES", oficinas, PADRON, jefes);
    // El nombre ya denota el rol ("… ENCARGADA DE …"), así que NO se antepone
    // "Jefe de la": sale el nombre de la oficina a secas.
    expect(r).toBe("CPC. JUAN ROJAS MAYTAN\nDEPENDENCIA ENCARGADA DE CONTRATACIONES");
  });

  it("el jefe de Usuarios manda sobre el responsable de texto libre de la oficina", () => {
    // Si hay jefe en Usuarios, se usa ese y no el texto suelto de Áreas: así el
    // dato tiene una sola fuente y no se contradicen.
    const oficinas = [
      { id: "of1", nombre: "UNIDAD DE ABASTECIMIENTO", responsable_nombre: "VIEJO NOMBRE", responsable_cargo: "Jefe" },
    ];
    const jefes = new Map([["of1", { nombre: "JUAN ROJAS MAYTAN", cargo: "Jefe" }]]);
    const r = resolverCabeceraDeOficina("UNIDAD DE ABASTECIMIENTO", oficinas, PADRON, jefes);
    expect(r).toContain("CPC. JUAN ROJAS MAYTAN");
    expect(r).not.toContain("VIEJO NOMBRE");
  });

  it("honra una oficina elegida aunque no tenga responsable (no la sustituye)", () => {
    // La DEC eligió DEPENDENCIA ENCARGADA DE CONTRATACIONES, que no tiene
    // responsable en Configuración. Antes esto devolvía "" y el informe la
    // cambiaba por la oficina que gestiona contrataciones (otra distinta). Ahora
    // devuelve algo NO vacío con el nombre de la oficina elegida, para que el
    // respaldo no tome el relevo y la elección no se pierda.
    const catalogo = [
      ...OFICINAS,
      { nombre: "DEPENDENCIA ENCARGADA DE CONTRATACIONES", responsable_nombre: null, responsable_cargo: null },
    ];
    const r = resolverCabeceraDeOficina("DEPENDENCIA ENCARGADA DE CONTRATACIONES", catalogo, PADRON);
    expect(r).not.toBe("");
    expect(r).toContain("DEPENDENCIA ENCARGADA DE CONTRATACIONES");
  });
});
