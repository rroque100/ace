import { requireAdmin } from "@/lib/auth";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/configuracion/oficinas/template
// Devuelve un .xlsx con la estructura esperada + 3 filas de ejemplo.
// El cliente lo descarga para que el admin llene sus oficinas reales.
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const headers = [
    "nombre",
    "entidad",
    "ruc",
    "responsable_nombre",
    "responsable_cargo",
    "sufijo",
    "ancho",
    "activo",
  ];
  const example = [
    [
      "Gerencia Municipal",
      "Municipalidad Distrital de Chorrillos",
      "20123456789",
      "Juan Pérez García",
      "Gerente Municipal",
      "2026-MDCH/GM",
      3,
      "si",
    ],
    [
      "Subgerencia de Recursos Humanos",
      "Municipalidad Distrital de Chorrillos",
      "20123456789",
      "Ana López Vargas",
      "Subgerente de RR.HH.",
      "2026-MDCH/SGRRHH",
      4,
      "si",
    ],
    [
      "Oficina de Asesoría Jurídica",
      "Municipalidad Distrital de Chorrillos",
      "20123456789",
      "Carlos Mendoza Ríos",
      "Jefe de Asesoría Jurídica",
      "2026-MDCH/OAJ",
      3,
      "si",
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...example]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(18, h.length + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, "Oficinas");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-oficinas.xlsx"',
    },
  });
}
