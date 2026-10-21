import { describe, expect, it } from "vitest";
import {
  CAMPOS_NARRATIVA,
  destinatarioDeLaFicha,
  destinoAProponer,
  oficinaDec,
  personaDeLaFirma,
  responsableDeOficina,
} from "@/app/components/fase-preparatoria/segmentacion-form";

// El PARA del informe de segmentación se propone desde la ficha de necesidad:
// el responsable del área usuaria en la primera línea y su área debajo. El
// memorando va dirigido a una PERSONA en un cargo; el catálogo de oficinas solo
// conoce cargos genéricos.

describe("destinatarioDeLaFicha", () => {
  it("compone responsable y área en dos líneas", () => {
    expect(
      destinatarioDeLaFicha("CCAHUANA MENDOZA NILDO", "OFICINA DE GERENCIA DE DESARROLLO ECONOMICO"),
    ).toBe("NILDO CCAHUANA MENDOZA\nOFICINA DE GERENCIA DE DESARROLLO ECONOMICO");
  });

  it("con solo uno de los dos, no deja una línea en blanco", () => {
    expect(destinatarioDeLaFicha("CCAHUANA MENDOZA NILDO", "")).toBe("NILDO CCAHUANA MENDOZA");
    expect(destinatarioDeLaFicha("", "GERENCIA DE SERVICIOS")).toBe("GERENCIA DE SERVICIOS");
  });

  it("sin datos devuelve vacío: entonces manda el catálogo de oficinas", () => {
    expect(destinatarioDeLaFicha("", "")).toBe("");
    expect(destinatarioDeLaFicha("   ", "  ")).toBe("");
  });

  it("recorta los espacios sobrantes de la ficha", () => {
    expect(destinatarioDeLaFicha("  ROJAS MAYTAN JUAN  ", "  GERENCIA  ")).toBe(
      "JUAN ROJAS MAYTAN\nGERENCIA",
    );
  });
});

// La regla no es "solo si está vacío" sino "solo si nadie lo ha escrito".
//
// El valor que sale del catálogo de oficinas es un DEFECTO, no una decisión. Si
// el paso A2 se abrió antes de que el PARA se tomara de la ficha, el campo
// quedó guardado con ese defecto — y con la regla anterior ya nunca se
// actualizaba: parecía que la ficha "no cargaba".
describe("destinoAProponer", () => {
  const FICHA = "NILDO CCAHUANA MENDOZA\nOFICINA DE GERENCIA DE DESARROLLO ECONOMICO";
  const OFICINA = "Jefe de la Oficina General de Administración";

  it("propone el de la ficha cuando el campo está vacío", () => {
    expect(destinoAProponer({ actual: "", deLaFicha: FICHA, deOficina: OFICINA })).toBe(FICHA);
  });

  it("SUSTITUYE el defecto del catálogo por el de la ficha", () => {
    // Es el caso que hacía parecer que no cargaba.
    expect(destinoAProponer({ actual: OFICINA, deLaFicha: FICHA, deOficina: OFICINA })).toBe(FICHA);
  });

  it("NO toca un texto escrito a mano: el documento se firma", () => {
    const aMano = "SR. DIRECTOR REGIONAL DE SALUD";
    expect(destinoAProponer({ actual: aMano, deLaFicha: FICHA, deOficina: OFICINA })).toBeNull();
  });

  it("cae al catálogo si la ficha no trae responsable ni área", () => {
    expect(destinoAProponer({ actual: "", deLaFicha: "", deOficina: OFICINA })).toBe(OFICINA);
  });

  it("sin ficha ni catálogo no propone nada", () => {
    expect(destinoAProponer({ actual: "", deLaFicha: "", deOficina: "" })).toBeNull();
  });

  it("no propone lo que ya está puesto: evita un guardado inútil", () => {
    expect(destinoAProponer({ actual: FICHA, deLaFicha: FICHA, deOficina: OFICINA })).toBeNull();
  });

  it("ignora diferencias de espaciado al comparar con el defecto", () => {
    expect(destinoAProponer({ actual: `  ${OFICINA}  `, deLaFicha: FICHA, deOficina: OFICINA })).toBe(
      FICHA,
    );
  });
});

// El DE (remitente) sale de la oficina que hace de DEC. Va en DOS líneas —
// nombre arriba, oficina debajo— igual que el PARA: en la cabecera de un
// memorando el nombre y el cargo no comparten renglón.
//
// El nombre sale en ORDEN NATURAL. El catálogo de oficinas guarda
// "ROJAS MAYTAN JUAN" —apellidos primero, como en un organigrama—, pero un
// documento se encabeza "JUAN ROJAS MAYTAN". Con el padrón de personas cargado
// se le antepone además el grado.
describe("responsableDeOficina", () => {
  it("compone nombre y cargo-de-oficina en dos líneas", () => {
    expect(
      responsableDeOficina({
        id: "1",
        nombre: "Unidad de Abastecimiento",
        responsable_nombre: "ROJAS MAYTAN JUAN",
        responsable_cargo: "Jefe",
      }),
    ).toBe("JUAN ROJAS MAYTAN\nJefe de la Unidad de Abastecimiento");
  });

  it("sin cargo, debajo va el nombre de la oficina a secas", () => {
    expect(
      responsableDeOficina({
        id: "1",
        nombre: "Unidad de Abastecimiento",
        responsable_nombre: "ROJAS MAYTAN JUAN",
      }),
    ).toBe("JUAN ROJAS MAYTAN\nUnidad de Abastecimiento");
  });

  it("sin responsable queda solo la oficina, sin línea en blanco", () => {
    expect(responsableDeOficina({ id: "1", nombre: "Unidad de Abastecimiento" })).toBe(
      "Unidad de Abastecimiento",
    );
  });

  it("sin oficina no inventa nada", () => {
    expect(responsableDeOficina(undefined)).toBe("");
  });
});

describe("oficinaDec", () => {
  const LOG = { id: "1", nombre: "Oficina de Logística" };
  const ABA = { id: "2", nombre: "Unidad de Abastecimiento", gestiona_contrataciones: true };

  it("elige la marcada en Configuración, se llame como se llame", () => {
    // Con un nombre fijo en el código, el DE salía vacío en cuanto la entidad
    // llamaba distinto a su DEC.
    expect(oficinaDec([LOG, ABA])?.nombre).toBe("Unidad de Abastecimiento");
  });

  it("sin ninguna marcada devuelve undefined y manda el respaldo por nombre", () => {
    expect(oficinaDec([LOG])).toBeUndefined();
  });
});

// Qué exige el Reglamento y qué es práctica de la Guía, en el bloque narrativo
// del informe. Contrastado contra el texto indexado:
//
//   Art. 42.2 — "la DEC informa mediante DOCUMENTO INTERNO a todas las áreas
//               usuarias la clasificación en categorías […] adjuntando un
//               cronograma para la presentación de los requerimientos".
//   Art. 125.4 — orienta a disminuir riesgos la ESTRATEGIA DE CONTRATACIÓN
//               (paso A4), no la segmentación.
describe("origen de los campos narrativos del informe", () => {
  // Tras retirar la cabecera del memorando (Número/PARA/ATENCIÓN/DE), TODO el
  // bloque narrativo es práctica de la Guía —ya no hay campos del Reglamento—, así
  // que se eliminó el discriminador `fuente`. El guard vivo es la COMPOSICIÓN:
  // que sean exactamente los cinco campos de análisis y que ninguno de cabecera
  // reaparezca (el 125.4 sitúa los de riesgo en A4, aquí se anticipan).
  it("el bloque narrativo son los cinco campos de análisis, sin cabecera de memorando", () => {
    expect(CAMPOS_NARRATIVA.map((c) => c.key)).toEqual([
      "justificacion",
      "continuidad",
      "riesgoMercado",
      "estrategiaMitigacion",
      "puntoControl",
    ]);
  });
});

// Los campos de cabecera del memorando (PARA/ATENCIÓN/DE) se retiraron del
// formulario y del .docx; el helper `destinatarioDeLaFicha` sigue vivo (compone
// responsable + área en dos líneas) y se conserva su prueba.
describe("destinatarioDeLaFicha · formato de dos líneas", () => {
  it("compone el responsable y su área en dos líneas", () => {
    expect(
      destinatarioDeLaFicha("JIMENEZ ORIHUELA JUAN", "GERENCIA DE SERVICIOS MUNICIPALES"),
    ).toBe("JUAN JIMENEZ ORIHUELA\nGERENCIA DE SERVICIOS MUNICIPALES");
  });
});

// El catálogo tiene DOS variantes de la Oficina General de Administración: la
// simple y la que lleva "JEFATURA". El memorando se dirige a la segunda.
describe("PARA · oficina destinataria", () => {
  it("con el nombre ya en JEFATURA no repite el cargo", () => {
    // "Jefe de la OFICINA … JEFATURA" dice dos veces lo mismo.
    expect(
      responsableDeOficina({
        id: "1",
        nombre: "OFICINA GENERAL DE ADMINISTRACION JEFATURA",
        responsable_nombre: "CPC. SAUL QUISPE CHIPANA",
        responsable_cargo: "Jefe",
      }),
    ).toBe("CPC. SAUL QUISPE CHIPANA\nOFICINA GENERAL DE ADMINISTRACION JEFATURA");
  });

  it("en una oficina normal el cargo sí encabeza la segunda línea", () => {
    expect(
      responsableDeOficina({
        id: "2",
        nombre: "UNIDAD DE ABASTECIMIENTO",
        responsable_nombre: "CPC. JUAN ROJAS MAYTAN",
        responsable_cargo: "Jefe",
      }),
    ).toBe("CPC. JUAN ROJAS MAYTAN\nJefe de la UNIDAD DE ABASTECIMIENTO");
  });

  it("el grado viaja en el nombre, no en el cargo", () => {
    // Lo resuelve /api/oficinas contra Configuración › Usuarios antes de llegar
    // aquí: la oficina guarda "QUISPE CHIPANA SAUL" y sin grado.
    const salida = responsableDeOficina({
      id: "1",
      nombre: "OFICINA GENERAL DE ADMINISTRACION JEFATURA",
      responsable_nombre: "CPC. SAUL QUISPE CHIPANA",
    });
    expect(salida.split("\n")[0]).toBe("CPC. SAUL QUISPE CHIPANA");
  });
});

// El formato de la firma ha cambiado varias veces: una línea con guion largo,
// luego dos líneas, luego con grado académico. Comparar solo contra el defecto
// de HOY dejaba congelados los valores guardados antes: se tomaban por texto
// escrito a mano y no se actualizaban nunca.
describe("personaDeLaFirma", () => {
  it("extrae el nombre del formato antiguo de una línea", () => {
    expect(personaDeLaFirma("SAUL QUISPE CHIPANA — Jefe de la OFICINA GENERAL DE ADMINISTRACION")).toBe(
      "SAUL QUISPE CHIPANA",
    );
  });

  it("y del formato actual de dos líneas con grado", () => {
    expect(personaDeLaFirma("CPC. SAUL QUISPE CHIPANA\nOFICINA GENERAL DE ADMINISTRACION JEFATURA")).toBe(
      "SAUL QUISPE CHIPANA",
    );
  });

  it("no confunde un apellido largo con un grado académico", () => {
    // El grado se reconoce por el punto final, no por ser corto.
    expect(personaDeLaFirma("NILDO CCAHUANA MENDOZA")).toBe("NILDO CCAHUANA MENDOZA");
  });

  it("un campo vacío no tiene persona", () => {
    expect(personaDeLaFirma("")).toBe("");
  });
});

describe("destinoAProponer · actualiza los formatos antiguos", () => {
  it("sustituye el PARA guardado con el formato de una línea", () => {
    // Es exactamente lo que había en pantalla y no se actualizaba.
    const guardado = "SAUL QUISPE CHIPANA — Jefe de la OFICINA GENERAL DE ADMINISTRACION";
    const nuevo = "CPC. SAUL QUISPE CHIPANA\nOFICINA GENERAL DE ADMINISTRACION JEFATURA";
    expect(destinoAProponer({ actual: guardado, deLaFicha: "", deOficina: nuevo })).toBe(nuevo);
  });

  it("sustituye el ATENCIÓN guardado con los apellidos delante", () => {
    const guardado = "CCAHUANA MENDOZA NILDO\nOFICINA DE GERENCIA DE DESARROLLO ECONOMICO";
    const nuevo = "NILDO CCAHUANA MENDOZA\nOFICINA DE GERENCIA DE DESARROLLO ECONOMICO";
    expect(destinoAProponer({ actual: guardado, deLaFicha: nuevo, deOficina: "" })).toBe(nuevo);
  });

  it("sigue SIN tocar el nombre de otra persona escrito a mano", () => {
    // La protección de lo escrito a mano no se pierde: solo se reconoce como
    // defecto lo que nombra a la MISMA persona.
    const aMano = "SR. DIRECTOR REGIONAL DE SALUD";
    const nuevo = "CPC. SAUL QUISPE CHIPANA\nOFICINA GENERAL DE ADMINISTRACION JEFATURA";
    expect(destinoAProponer({ actual: aMano, deLaFicha: "", deOficina: nuevo })).toBeNull();
  });

  it("no reescribe si ya está en el formato nuevo", () => {
    const nuevo = "CPC. SAUL QUISPE CHIPANA\nOFICINA GENERAL DE ADMINISTRACION JEFATURA";
    expect(destinoAProponer({ actual: nuevo, deLaFicha: "", deOficina: nuevo })).toBeNull();
  });
});

// El DE se quedó atrás: usaba "solo si está vacío" mientras el PARA y el
// ATENCIÓN ya usaban la regla completa. Resultado: un remitente guardado con el
// formato viejo no se actualizaba nunca.
describe("DE (remitente) · actualiza igual que los demás", () => {
  it("sustituye el formato antiguo aunque cambie la oficina", () => {
    // Valor real que quedaba congelado en pantalla. La persona es la misma
    // ("ROJAS MAYTAN JUAN" ↔ "JUAN ROJAS MAYTAN"), lo que cambia es la oficina:
    // antes se buscaba por nombre fijo, ahora manda la marcada como DEC.
    const guardado = "ROJAS MAYTAN JUAN — OFICINA DE LOGISTICA";
    const nuevo = "CPC. JUAN ROJAS MAYTAN\nJefe de la UNIDAD DE ABASTECIMIENTO";
    expect(destinoAProponer({ actual: guardado, deLaFicha: "", deOficina: nuevo })).toBe(nuevo);
  });

  it("no toca un remitente escrito a mano por otra persona", () => {
    const aMano = "MARIA LOPEZ TORRES\nJefa de la Oficina de Presupuesto";
    const nuevo = "CPC. JUAN ROJAS MAYTAN\nJefe de la UNIDAD DE ABASTECIMIENTO";
    expect(destinoAProponer({ actual: aMano, deLaFicha: "", deOficina: nuevo })).toBeNull();
  });

  it("la oficina DEC manda sobre el nombre fijo de respaldo", () => {
    const oficinas = [
      { id: "1", nombre: "OFICINA DE LOGISTICA", responsable_nombre: "CPC. JUAN ROJAS MAYTAN" },
      {
        id: "2",
        nombre: "UNIDAD DE ABASTECIMIENTO",
        responsable_nombre: "CPC. JUAN ROJAS MAYTAN",
        responsable_cargo: "Jefe",
        gestiona_contrataciones: true,
      },
    ];
    expect(responsableDeOficina(oficinaDec(oficinas))).toBe(
      "CPC. JUAN ROJAS MAYTAN\nJefe de la UNIDAD DE ABASTECIMIENTO",
    );
  });
});

// Estabilidad al reabrir y al cambiar de expediente.
//
// Las propuestas se aplican una vez por montaje. Si la función volviera a
// proponer sobre su propio resultado, cada apertura marcaría el paso como
// modificado y el usuario vería "cambios sin guardar" sin haber tocado nada.
describe("las propuestas no se repiten sobre sí mismas", () => {
  const PARA = "CPC. SAUL QUISPE CHIPANA\nOFICINA GENERAL DE ADMINISTRACION JEFATURA";
  const ATENCION = "NILDO CCAHUANA MENDOZA\nOFICINA DE GERENCIA DE DESARROLLO ECONOMICO";
  const DE = "CPC. JUAN ROJAS MAYTAN\nJefe de la UNIDAD DE ABASTECIMIENTO";

  it("una segunda pasada sobre el valor ya propuesto no propone nada", () => {
    expect(destinoAProponer({ actual: PARA, deLaFicha: "", deOficina: PARA })).toBeNull();
    expect(destinoAProponer({ actual: ATENCION, deLaFicha: ATENCION, deOficina: "" })).toBeNull();
    expect(destinoAProponer({ actual: DE, deLaFicha: "", deOficina: DE })).toBeNull();
  });

  it("converge: aplicar la propuesta y volver a evaluar da null", () => {
    const guardado = "ROJAS MAYTAN JUAN — OFICINA DE LOGISTICA";
    const primera = destinoAProponer({ actual: guardado, deLaFicha: "", deOficina: DE });
    expect(primera).toBe(DE);
    const segunda = destinoAProponer({ actual: primera!, deLaFicha: "", deOficina: DE });
    expect(segunda).toBeNull();
  });

  it("sin fuentes no propone nada aunque el campo esté vacío", () => {
    // Al abrir un expediente cuya necesidad no tiene responsable, el ATENCIÓN
    // se queda vacío en lugar de heredar el de otro expediente.
    expect(destinoAProponer({ actual: "", deLaFicha: "", deOficina: "" })).toBeNull();
  });

  it("cada expediente propone su propio ATENCIÓN, no el del anterior", () => {
    // El ATENCIÓN sale de la ficha de CADA necesidad; el PARA y el DE son de la
    // entidad y sí son iguales en todos los expedientes, que es lo correcto.
    const otro = "ABEL HURTADO PALOMINO\nGERENCIA DE DESARROLLO TERRITORIAL E INFRAESTRUCTURA";
    expect(destinoAProponer({ actual: ATENCION, deLaFicha: otro, deOficina: "" })).toBeNull();
  });
});

// Número del informe: se SUGIERE desde Configuración › Numeración pero no se
// reserva. Reservarlo en cada vista previa gastaría correlativos y dejaría
// huecos en la serie, que es lo único que una numeración correlativa no puede
// permitirse.
// Los tests del campo «número del informe» se retiraron con el campo: la
// cabecera de memorando ya no se captura aquí (la aporta el membrete/numeración
// de la entidad).
