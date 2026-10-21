import { describe, expect, it } from "vitest";
import { FICHA_SECCIONES } from "@/lib/necesidad-ficha-secciones";
import { necesidadUpdateSchema } from "@/lib/necesidades";

// Fila real de la necesidad 75992c7d (SELECT * en Supabase), claves snake_case.
const row: Record<string, unknown> = {
  nombre: "CONTRATACION DE SUPERVISION DE OBRA: MEJORAMIENTO DEL SERVICIO DE EDUCACION TECNICO PRODUCTIVA EN EL CETPRO NRO 132780 EN LA LOCALIDAD DE CHALLHUAHUACHO DEL DISTRITO DE CHALLHUAHUACHO, PROVINCIA DE COTABAMBAS Y DEPARTAMENTO DE APURIMAC",
  tipo_objeto: "consultoria_obra",
  tipo_proceso_seleccion: "Concurso Público abreviado",
  tipo_area: "area_usuaria",
  anio_fiscal: 2026,
  entidad: "Municipalidad distrital de Challhuahuacho",
  unidad_ejecutora: "300308",
  area_usuaria: "GERENCIA DE DESARROLLO TERRITORIAL E INFRAESTRUCTURA",
  centro_costo: "GERENCIA DE DESARROLLO TERRITORIAL E INFRAESTRUCTURA",
  responsable: "ABEL HURTADO PALOMINO",
  finalidad_publica:
    "La finalidad pública del presente requerimiento es contratar una consultoría de obra para la adecuada formulación, diseño y supervisión técnica del proyecto de rehabilitación y reconstrucción, garantizando la correcta ejecución conforme a los estándares técnicos y normativos vigentes, con el fin de mejorar la infraestructura pública y atender las necesidades de la población beneficiaria, en cumplimiento con los objetivos institucionales y el marco legal aplicable.",
  meta_presupuestal: "28",
  cui: "2637211",
  especialidad:
    "Consultoría de obra en la especialidad de rehabilitación y reconstrucción de infraestructura pública, que incluya la for",
  descripcion_catalogo:
    "MEJORAMIENTO DEL SERVICIO DE EDUCACION TECNICO PRODUCTIVA EN EL CETPRO NRO 132780 EN LA LOCALIDAD DE CHALLHUAHUACHO DEL DISTRITO DE CHALLHUAHUACHO, PROVINCIA DE COTABAMBAS Y DEPARTAMENTO DE APURIMAC",
  descripcion_detallada:
    "=== PÁGINA 1 ===\nCONSTANCIA DE RECEPCION DATOS DEL SOLICITANTE DNI: 45373962 Datos del solicitante: RAFAEL ROQUE VARGAS DATOS DEL EXPEDIENTE Expediente N°: 2026-30739",
  cantidad: "50000",
  unidad_medida: "SERVICIO",
  fecha_requerida: "2026-05-15",
  fuente_financiamiento: "CANON Y SOBRECANON, REGALIAS, RENTA DE ADUANAS Y PARTICIPACIONES",
  clasificador_gasto: "2.6. 8 1. 4 3",
  monto_estimado: "300000",
  departamento: "Apurimac",
  provincia: "Cotabambas",
  distrito: "Challhuahuacho",
  lugar_entrega: "EN EL LOCAL DE LA CETPRO NRO 132780 EN LA LOCALIDAD DE CHALLHUAHUACHO",
  alcance:
    "La consultoría de obra comprende la formulación, diseño y supervisión técnica del proyecto de rehabilitación y reconstrucción de la infraestructura pública.",
  modalidad_pago: "SUMA ALZADA",
  sistema_entrega: "NO CORRESPONDE",
  plazo_ejecucion: 240,
  status: "incorporado_cmn",
  moneda: "PEN",
  plazo_ejecucion_unidad: "calendario",
  no_objecion: "no_aplica",
  cmn_verificado: true,
};

const toStr = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

describe("repro autoguardado 75992c7d", () => {
  it("arma el payload y lo valida", () => {
    // Siembra base como valoresDeLaBase
    const form: Record<string, string> = {
      nombre: toStr(row.nombre),
      tipoObjeto: toStr(row.tipo_objeto),
      tipoProcesoSeleccion: toStr(row.tipo_proceso_seleccion),
      tipoArea: toStr(row.tipo_area),
    };
    for (const section of FICHA_SECCIONES) {
      for (const field of section.fields) {
        form[field.api] = field.checkbox ? String(Boolean(row[field.col])) : toStr(row[field.col]);
      }
    }

    // construirPayload
    const payload: Record<string, unknown> = {
      nombre: (form.nombre ?? "").trim(),
      tipoObjeto: form.tipoObjeto || undefined,
      tipoProcesoSeleccion: form.tipoProcesoSeleccion ?? "",
      tipoArea: form.tipoArea || undefined,
    };
    for (const section of FICHA_SECCIONES) {
      for (const field of section.fields) {
        const raw = (form[field.api] ?? "").trim();
        if (field.checkbox) {
          payload[field.api] = raw === "true";
        } else if (field.kind === "number") {
          if (raw === "") continue;
          const num = Number(raw);
          if (Number.isFinite(num)) payload[field.api] = num;
        } else {
          payload[field.api] = raw === "" && field.porDefecto ? field.porDefecto : raw;
        }
      }
    }

    const res = necesidadUpdateSchema.safeParse(payload);
    if (!res.success) {
      console.log("ISSUES:", JSON.stringify(res.error.issues, null, 2));
      for (const i of res.error.issues) {
        const campo = i.path.join(".");
        console.log(`  ${campo} = ${JSON.stringify((payload as Record<string, unknown>)[campo])} -> ${i.message}`);
      }
    } else {
      console.log("OK, payload válido");
    }
    expect(res.success).toBe(true);
  });
});
