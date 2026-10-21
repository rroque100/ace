// Topes por CUANTÍA de los procedimientos de selección (Arts. 54 y 55 de la Ley
// 32069; Arts. 93, 94 y 95 del Reglamento, D.S. 009-2025-EF).
//
// Los IMPORTES no están en la norma publicada: los Arts. 93-95 remiten a la tabla
// anual de la DSEACE-OECE. Para 2026 esa tabla ("TOPES … Año Fiscal 2026") se
// sustenta en el D.S. 301-2025-EF y en el Art. 14 de la Ley 32513 (presupuesto
// 2026). Los importes cambian cada año con la UIT, así que son CONFIGURABLES por
// año en Configuración; aquí van los de 2026 como valor por defecto.
//
// Se DEDUCE la MODALIDAD (abreviada o no) que antes la app no podía afirmar —solo
// la familia del Art. 54.1—. Como la tabla tiene rangos que se SOLAPAN (p. ej. un
// bien de S/ 90 000 cabe en «abreviada», en «comparación de precios» y, con ficha
// técnica, en «subasta inversa»), se devuelven las opciones ELEGIBLES con su
// motivo, sin forzar una: la decisión sigue siendo de la DEC (Art. 72.1).

/** Cuatro importes que gobiernan toda la tabla de topes de un año fiscal. */
export type TopesProcedimiento = {
  /** Año fiscal al que corresponden estos importes. */
  anio: number;
  /** Piso: por ENCIMA de este monto aplican los procedimientos; por debajo (o
   *  igual) es contratación de menor cuantía / contrato menor. 2026: 44 000. */
  piso: number;
  /** Frontera bienes/servicios: cuantía ≥ este monto → Licitación/Concurso
   *  Público; por debajo, su modalidad Abreviada. 2026: 485 000. */
  licitacionConcurso: number;
  /** Frontera de OBRAS: cuantía ≥ este monto → Licitación Pública de obras; por
   *  debajo, Licitación Pública abreviada de obras. 2026: 5 000 000. */
  licitacionObras: number;
  /** Techo de la Comparación de Precios (bienes y servicios en general): cuantía
   *  ≤ este monto → cabe Comparación de Precios. 2026: 100 000. */
  comparacionPrecios: number;
};

/** Topes del año fiscal 2026 (tabla DSEACE-OECE). Valor por defecto. */
export const TOPES_2026: TopesProcedimiento = {
  anio: 2026,
  piso: 44_000,
  licitacionConcurso: 485_000,
  licitacionObras: 5_000_000,
  comparacionPrecios: 100_000,
};

export type FamiliaObjeto = "bienes" | "servicio" | "consultoria" | "obra";

/**
 * Familia del objeto para la tabla de topes. Acepta tanto el enum de la ficha
 * (`bienes`/`servicios`/`obras`/`consultoria_obra`) como los rótulos con acento.
 * Consultoría se comprueba ANTES que obra: «consultoria_obra» no empieza por
 * «obra», pero dejarlo explícito evita sorpresas si algún día cambia el enum.
 */
export function familiaDeObjeto(objeto?: string | null): FamiliaObjeto | null {
  const o = (objeto ?? "").toLowerCase().trim();
  if (o.startsWith("consultor")) return "consultoria";
  if (o.startsWith("obra")) return "obra";
  if (o.startsWith("servicio")) return "servicio";
  if (o.startsWith("bien")) return "bienes";
  return null;
}

export type ProcedimientoElegible = {
  /** `value` EXACTO del catálogo (lib/procesos-seleccion.ts), para preseleccionar. */
  value: string;
  /** Por qué es elegible, con la cuantía y el año de los topes. */
  motivo: string;
};

const fmt = (n: number) => `S/ ${n.toLocaleString("es-PE")}`;

/**
 * Procedimientos ELEGIBLES por cuantía para un objeto, según los topes del año.
 *
 * Devuelve `[]` si no se puede decidir (objeto o cuantía sin definir): la app ya
 * sugiere la familia por el Art. 54.1, y la modalidad no se afirma sin cuantía.
 * Si la cuantía no supera el piso, devuelve el marcador de contrato menor
 * (`value: ""`) con el motivo, para poder avisarlo.
 */
export function procedimientosElegibles(
  objeto: string | null | undefined,
  cuantia: number | null | undefined,
  fichaTecnica: boolean,
  topes: TopesProcedimiento = TOPES_2026,
): ProcedimientoElegible[] {
  const fam = familiaDeObjeto(objeto);
  const c = typeof cuantia === "number" && Number.isFinite(cuantia) ? cuantia : null;
  if (!fam || c === null) return [];

  if (c <= topes.piso) {
    return [
      {
        value: "",
        motivo: `La cuantía (${fmt(c)}) no supera el piso de ${fmt(topes.piso)}: es contratación de menor cuantía (contrato menor), fuera de estos procedimientos (topes ${topes.anio}).`,
      },
    ];
  }

  const out: ProcedimientoElegible[] = [];

  if (fam === "obra") {
    out.push(
      c >= topes.licitacionObras
        ? { value: "Licitación Pública de obras", motivo: `Obra con cuantía ≥ ${fmt(topes.licitacionObras)}: Licitación Pública (topes ${topes.anio}).` }
        : { value: "Licitación Pública abreviada de obras", motivo: `Obra con cuantía entre ${fmt(topes.piso)} y ${fmt(topes.licitacionObras)}: Licitación Pública abreviada de obras (topes ${topes.anio}).` },
    );
    return out;
  }

  if (fam === "consultoria") {
    out.push(
      c >= topes.licitacionConcurso
        ? { value: "Concurso Público para consultorías y servicios de mantenimiento vial", motivo: `Consultoría con cuantía ≥ ${fmt(topes.licitacionConcurso)}: Concurso Público (topes ${topes.anio}).` }
        : { value: "Concurso Público abreviado", motivo: `Consultoría con cuantía entre ${fmt(topes.piso)} y ${fmt(topes.licitacionConcurso)}: Concurso Público abreviado (topes ${topes.anio}).` },
    );
    return out;
  }

  // Bienes o servicio en general: familia principal por la frontera de 485 000…
  if (fam === "bienes") {
    out.push(
      c >= topes.licitacionConcurso
        ? { value: "Licitación Pública para bienes", motivo: `Bienes con cuantía ≥ ${fmt(topes.licitacionConcurso)}: Licitación Pública (topes ${topes.anio}).` }
        : { value: "Licitación Pública abreviada para bienes", motivo: `Bienes con cuantía entre ${fmt(topes.piso)} y ${fmt(topes.licitacionConcurso)}: Licitación Pública abreviada (topes ${topes.anio}).` },
    );
  } else {
    out.push(
      c >= topes.licitacionConcurso
        ? { value: "Concurso Público de servicios", motivo: `Servicio con cuantía ≥ ${fmt(topes.licitacionConcurso)}: Concurso Público de Servicios (topes ${topes.anio}).` }
        : { value: "Concurso Público abreviado", motivo: `Servicio con cuantía entre ${fmt(topes.piso)} y ${fmt(topes.licitacionConcurso)}: Concurso Público abreviado (topes ${topes.anio}).` },
    );
  }

  // …y las ALTERNATIVAS que la tabla permite en el mismo rango.
  if (c <= topes.comparacionPrecios) {
    out.push({
      value: "Comparación de Precios",
      motivo: `La cuantía no supera ${fmt(topes.comparacionPrecios)}: también cabe Comparación de Precios (topes ${topes.anio}).`,
    });
  }
  if (fichaTecnica) {
    out.push({
      value: "Subasta Inversa Electrónica",
      motivo: "El requerimiento está estandarizado con ficha técnica: cabe Subasta Inversa Electrónica (Art. 96.1).",
    });
  }
  return out;
}

/**
 * Lee los topes desde los campos (texto) de Configuración, cayendo al defecto
 * 2026 en cada importe que no venga o no sea válido. No rompe si el SQL de las
 * columnas aún no se aplicó: un campo ausente = valor por defecto.
 */
export function topesDeConfiguracion(entity: {
  topeAnio?: string | null;
  topePiso?: string | null;
  topeLicitacionConcurso?: string | null;
  topeLicitacionObras?: string | null;
  topeComparacionPrecios?: string | null;
}): TopesProcedimiento {
  const num = (v: string | null | undefined, def: number) => {
    const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : def;
  };
  return {
    anio: num(entity.topeAnio, TOPES_2026.anio),
    piso: num(entity.topePiso, TOPES_2026.piso),
    licitacionConcurso: num(entity.topeLicitacionConcurso, TOPES_2026.licitacionConcurso),
    licitacionObras: num(entity.topeLicitacionObras, TOPES_2026.licitacionObras),
    comparacionPrecios: num(entity.topeComparacionPrecios, TOPES_2026.comparacionPrecios),
  };
}
