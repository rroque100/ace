// Retención de la auditoría de cuentas externas: borra los eventos con más de 12 meses.
//
// La IP es un dato personal (Ley N.° 29733): no se guarda más de lo necesario. Por defecto SIMULA (cuenta lo que
// borraría); con --aplicar borra. El consumo de IA (uso_ia) no se toca: no lleva IP y es contabilidad de costos.
// También purga las solicitudes de acceso YA RESUELTAS (guardan nombre, DNI, correo e IP); las pendientes no se tocan.
//
//   npx tsx --env-file=.env.local scripts/purgar-auditoria-externos.mts [--meses 12] [--aplicar]

import { supabaseRest } from "@/lib/supabase-server";

const args = process.argv.slice(2);
const apply = args.includes("--aplicar");
const mesesArg = args.includes("--meses") ? Number(args[args.indexOf("--meses") + 1]) : 12;
if (!Number.isInteger(mesesArg) || mesesArg < 1 || mesesArg > 120) {
  console.error("--meses debe ser un entero entre 1 y 120.");
  process.exit(1);
}

const corte = new Date();
corte.setUTCMonth(corte.getUTCMonth() - mesesArg);
const filtro = `creado_en=lt.${encodeURIComponent(corte.toISOString())}`;

const viejos = await supabaseRest<Array<{ id: string }>>(`acceso_eventos?${filtro}&select=id&limit=100000`);
console.log(`${apply ? "BORRANDO" : "SIMULACIÓN"} · eventos anteriores a ${corte.toISOString().slice(0, 10)} (${mesesArg} meses): ${viejos.length}`);
if (apply && viejos.length) {
  await supabaseRest(`acceso_eventos?${filtro}`, { method: "DELETE" });
  const quedan = await supabaseRest<Array<{ id: string }>>(`acceso_eventos?${filtro}&select=id&limit=1`);
  console.log(quedan.length ? "Quedan eventos antiguos: repite el comando." : "Hecho: no quedan eventos anteriores al corte.");
} else if (!apply) {
  console.log("Simulación terminada. Repite con --aplicar para borrar.");
}

// Solicitudes de acceso resueltas hace más del plazo. Si el SQL aún no se ejecutó la tabla no existe: se dice y se sigue.
const filtroSolicitudes = `estado=neq.pendiente&resuelta_en=lt.${encodeURIComponent(corte.toISOString())}`;
try {
  const resueltas = await supabaseRest<Array<{ id: string }>>(`solicitudes_acceso?${filtroSolicitudes}&select=id&limit=100000`);
  console.log(`${apply ? "BORRANDO" : "SIMULACIÓN"} · solicitudes de acceso resueltas antes de ${corte.toISOString().slice(0, 10)}: ${resueltas.length}`);
  if (apply && resueltas.length) await supabaseRest(`solicitudes_acceso?${filtroSolicitudes}`, { method: "DELETE" });
} catch (error) {
  console.log(`Solicitudes de acceso: se omiten (${error instanceof Error ? error.message.slice(0, 120) : error}). ¿Falta ejecutar docs/supabase/solicitudes-acceso.sql?`);
}
