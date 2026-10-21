// Formatea una fecha ISO (2026-07-08) a español: "08 de julio del 2026"

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
];

export function fechaES(fecha: string | undefined | null): string {
  if (!fecha?.trim()) return "";
  const match = fecha.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return fecha.trim();
  const [, anio, mes, dia] = match;
  const d = Number.parseInt(dia, 10);
  const m = Number.parseInt(mes, 10);
  if (m < 1 || m > 12) return fecha.trim();
  return `${d} de ${MESES[m - 1]} del ${anio}`;
}
