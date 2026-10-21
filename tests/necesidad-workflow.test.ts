import { describe, expect, it } from "vitest";
import {
  ACCIONES,
  NECESIDAD_ESTADOS,
  accionPorId,
  accionesDisponibles,
  ladoDeRol,
  puedeEjecutar,
} from "@/lib/necesidad-workflow";

const DEC = ladoDeRol("dec");
const ADMIN = ladoDeRol("admin");
const AREA = ladoDeRol("area_usuaria");
const ATE = ladoDeRol("ate");
const CONSULTA = ladoDeRol("consulta");

describe("necesidad-workflow · estados y catálogo", () => {
  it("el ciclo va de borrador a incorporado_cmn, con `anulada` como salida lateral", () => {
    expect(NECESIDAD_ESTADOS).toHaveLength(8);
    expect(NECESIDAD_ESTADOS[0].value).toBe("borrador");
    // `anulada` va al final del catálogo pero NO es el final del trámite: es
    // salirse de él. El último paso del ciclo sigue siendo la derivación.
    expect(NECESIDAD_ESTADOS.at(-1)?.value).toBe("anulada");
    expect(NECESIDAD_ESTADOS.at(-2)?.value).toBe("incorporado_cmn");
  });

  it("cada acción apunta a un estado destino válido", () => {
    const estados = new Set(NECESIDAD_ESTADOS.map((e) => e.value));
    for (const a of ACCIONES) {
      expect(estados.has(a.hacia)).toBe(true);
      expect(a.desde.every((d) => estados.has(d))).toBe(true);
    }
  });
});

describe("necesidad-workflow · lado por rol", () => {
  it("mapea dec/admin a DEC y area_usuaria/ate a área usuaria", () => {
    expect(DEC.esDec).toBe(true);
    expect(ADMIN.esDec).toBe(true);
    expect(AREA.esAreaUsuaria).toBe(true);
    expect(ATE.esAreaUsuaria).toBe(true);
    expect(CONSULTA.esDec).toBe(false);
    expect(CONSULTA.esAreaUsuaria).toBe(false);
  });
});

describe("necesidad-workflow · gating flexible (DEC puede todo)", () => {
  it("la DEC puede ejecutar acciones del área usuaria", () => {
    const remitir = accionPorId("remitir")!;
    expect(puedeEjecutar(remitir, DEC)).toBe(true);
    expect(puedeEjecutar(remitir, AREA)).toBe(true);
  });

  it("el área usuaria NO puede ejecutar acciones de la DEC", () => {
    const revisar = accionPorId("iniciar_revision")!;
    expect(puedeEjecutar(revisar, AREA)).toBe(false);
    expect(puedeEjecutar(revisar, DEC)).toBe(true);
  });

  it("consulta no puede ejecutar nada", () => {
    expect(accionesDisponibles("borrador", CONSULTA)).toHaveLength(0);
  });
});

// Las salidas del ciclo (anular, volver a borrador, reactivar, reabrir) están
// disponibles casi siempre y taparían lo que estos tests miran: cuál es el paso
// SIGUIENTE del trámite desde cada estado.
const SALIDAS = new Set(["anular", "reactivar", "volver_borrador", "reabrir"]);
const avances = (
  estado: string,
  lado: { esDec: boolean; esAreaUsuaria: boolean },
): string[] => accionesDisponibles(estado, lado).map((a) => a.action).filter((a) => !SALIDAS.has(a));

describe("necesidad-workflow · transiciones disponibles", () => {
  it("desde borrador el área usuaria solo puede remitir", () => {
    expect(avances("borrador", AREA)).toEqual(["remitir"]);
  });

  it("desde en_revision_dec la DEC puede observar, pedir no objeción o aprobar", () => {
    const acc = accionesDisponibles("en_revision_dec", DEC).map((a) => a.action);
    expect(acc).toContain("observar");
    expect(acc).toContain("solicitar_no_objecion");
    expect(acc).toContain("aprobar_conforme");
  });

  it("desde no_objecion_pendiente el área usuaria otorga u objeta", () => {
    // Sobre la no objeción en curso solo caben estas dos. Las salidas del ciclo
    // (anular, volver a borrador) no la resuelven: la abandonan.
    expect(avances("no_objecion_pendiente", AREA).sort()).toEqual(["objetar", "otorgar_no_objecion"]);
  });

  it("solicitar_no_objecion verifica el CMN y marca no objeción solicitada", () => {
    const a = accionPorId("solicitar_no_objecion")!;
    expect(a.setCmnVerificado).toBe(true);
    expect(a.setNoObjecion).toBe("solicitada");
    expect(a.requiereSustento).toBe(true);
  });

  it("otorgar_no_objecion lleva a conforme", () => {
    const a = accionPorId("otorgar_no_objecion")!;
    expect(a.hacia).toBe("conforme");
    expect(a.setNoObjecion).toBe("otorgada");
  });
});

// Volver a empezar el workflow.
//
// Mientras nadie haya derivado la necesidad, su estado no ha producido nada
// aguas abajo: rehacer el ciclo borrador → remitido → en revisión → conforme no
// rompe nada. En cuanto hay expediente, deshacerlo dejaría la Fase 1 sembrada
// desde un requerimiento que formalmente ha vuelto a ser un borrador; ahí el
// camino es `reabrir`, que desvincula de forma explícita.
describe("necesidad-workflow · volver a borrador", () => {
  const SIN = { tieneExpediente: false };
  const CON = { tieneExpediente: true };
  const acciones = (estado: string, ctx: { tieneExpediente: boolean }) =>
    accionesDisponibles(estado, AREA, ctx).map((a) => a.action);

  it("se ofrece desde cualquier estado del ciclo, sin expediente", () => {
    for (const estado of ["remitido_dec", "en_revision_dec", "observado", "no_objecion_pendiente", "conforme"]) {
      expect(acciones(estado, SIN), estado).toContain("volver_borrador");
    }
  });

  it("NO se ofrece si la necesidad ya está derivada a un expediente", () => {
    for (const estado of ["remitido_dec", "en_revision_dec", "conforme"]) {
      expect(acciones(estado, CON), estado).not.toContain("volver_borrador");
    }
  });

  it("no se ofrece desde borrador: ya se está ahí", () => {
    expect(acciones("borrador", SIN)).not.toContain("volver_borrador");
  });

  it("no se ofrece desde incorporado_cmn: ahí el camino es «reabrir»", () => {
    expect(acciones("incorporado_cmn", SIN)).not.toContain("volver_borrador");
    expect(accionesDisponibles("incorporado_cmn", DEC, SIN).map((a) => a.action)).toContain("reabrir");
  });

  it("lleva a borrador y limpia la no objeción de la versión que se abandona", () => {
    const a = accionPorId("volver_borrador")!;
    expect(a.hacia).toBe("borrador");
    // El ciclo del Art. 44.7 se refiere a una versión concreta del
    // requerimiento: si vuelve a borrador, lo actuado sobre ella ya no aplica.
    expect(a.setNoObjecion).toBe("no_aplica");
    expect(a.requiereSinExpediente).toBe(true);
  });

  it("no desvincula expedientes: para eso está «reabrir»", () => {
    expect(accionPorId("volver_borrador")!.borrarProcessId).toBeUndefined();
  });

  it("sin contexto se comporta como si no hubiera expediente (compatibilidad)", () => {
    expect(accionesDisponibles("conforme", AREA).map((a) => a.action)).toContain("volver_borrador");
  });
});

// Ajuste 1: observar exige haber iniciado la revisión.
//
// Antes se podía observar directamente desde `remitido_dec`. Dos problemas: la
// barra de progreso saltaba del paso 2 a un desvío del 3 sin haber pasado por
// él, y no se puede observar lo que no se ha declarado revisado — el rastro
// quedaba sin el momento en que la DEC tomó el requerimiento.
describe("necesidad-workflow · observar exige revisión previa", () => {
  it("no se puede observar un requerimiento recién remitido", () => {
    expect(accionesDisponibles("remitido_dec", DEC).map((a) => a.action)).not.toContain("observar");
  });

  it("desde remitido la DEC primero inicia la revisión", () => {
    expect(accionesDisponibles("remitido_dec", DEC).map((a) => a.action)).toContain("iniciar_revision");
  });

  it("una vez en revisión sí se puede observar", () => {
    expect(accionesDisponibles("en_revision_dec", DEC).map((a) => a.action)).toContain("observar");
  });

  it("el flujo no tiene saltos: todo estado de observado viene de en_revision_dec", () => {
    expect(accionPorId("observar")!.desde).toEqual(["en_revision_dec"]);
  });
});

// Ajuste 2: cerrar una necesidad que no se va a contratar.
//
// Antes solo se podía BORRAR, lo que pierde el rastro de que existió y de por
// qué se dejó. `anulada` lo conserva con su sustento.
describe("necesidad-workflow · anular y reactivar", () => {
  const SIN = { tieneExpediente: false };
  const CON = { tieneExpediente: true };

  it("se puede anular desde cualquier estado del ciclo, incluido borrador", () => {
    for (const estado of ["borrador", "remitido_dec", "en_revision_dec", "observado", "no_objecion_pendiente", "conforme"]) {
      expect(accionesDisponibles(estado, AREA, SIN).map((a) => a.action), estado).toContain("anular");
    }
  });

  it("NO se puede anular una necesidad ya derivada a un expediente", () => {
    expect(accionesDisponibles("conforme", AREA, CON).map((a) => a.action)).not.toContain("anular");
    // Y desde derivado tampoco: primero hay que reabrir para soltar el expediente.
    expect(accionesDisponibles("incorporado_cmn", DEC, SIN).map((a) => a.action)).not.toContain("anular");
  });

  it("anular exige sustento: es una decisión que alguien firma", () => {
    const a = accionPorId("anular")!;
    expect(a.requiereSustento).toBe(true);
    expect(a.requiereSinExpediente).toBe(true);
    expect(a.hacia).toBe("anulada");
  });

  it("no es un callejón sin salida: se reactiva a borrador", () => {
    const acc = accionesDisponibles("anulada", AREA, SIN).map((a) => a.action);
    expect(acc).toEqual(["reactivar"]);
    expect(accionPorId("reactivar")!.hacia).toBe("borrador");
  });

  it("desde anulada no se puede remitir ni derivar sin pasar por borrador", () => {
    const acc = accionesDisponibles("anulada", DEC, SIN).map((a) => a.action);
    expect(acc).not.toContain("remitir");
    expect(acc).not.toContain("aprobar_conforme");
  });

  it("anular no borra el vínculo con ningún expediente: no puede haberlo", () => {
    expect(accionPorId("anular")!.borrarProcessId).toBeUndefined();
  });

  it("es un estado terminal: nadie tiene el turno", () => {
    const def = NECESIDAD_ESTADOS.find((e) => e.value === "anulada")!;
    expect(def.actor).toBeNull();
  });
});
