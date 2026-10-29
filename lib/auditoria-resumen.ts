// Resumen de la auditoría de cuentas externas para el panel del administrador: cuánta IA consume cada cuenta en cada
// módulo, y la exportación de los eventos a CSV. Módulo puro: recibe filas ya leídas.

export type FilaUsoIA = {
  usuario_id: string | null;
  modulo: string | null;
  operacion: string | null;
  tokens_entrada: number;
  tokens_salida: number;
  costo_estimado: number | string | null;
  estimado?: boolean | null;
};

export type ConsumoModulo = { modulo: string; llamadas: number; tokens: number; tokensEntrada: number; tokensSalida: number; costo: number; conEstimados: boolean };
export type ConsumoUsuario = { usuarioId: string; llamadas: number; tokens: number; costo: number; modulos: ConsumoModulo[] };

const num = (valor: unknown) => {
  const n = typeof valor === "string" ? Number(valor) : valor;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0;
};

/** Consumo por cuenta y, dentro de ella, por módulo. El costo se redondea al final, no en cada fila, para no acumular error. */
export function resumirConsumo(filas: readonly FilaUsoIA[]): { usuarios: ConsumoUsuario[]; total: { llamadas: number; tokens: number; costo: number } } {
  const porUsuario = new Map<string, Map<string, ConsumoModulo>>();
  for (const fila of filas) {
    if (!fila.usuario_id) continue;
    const modulos = porUsuario.get(fila.usuario_id) ?? new Map<string, ConsumoModulo>();
    const clave = fila.modulo ?? "otros";
    const modulo = modulos.get(clave) ?? { modulo: clave, llamadas: 0, tokens: 0, tokensEntrada: 0, tokensSalida: 0, costo: 0, conEstimados: false };
    const entrada = Math.round(num(fila.tokens_entrada));
    const salida = Math.round(num(fila.tokens_salida));
    modulo.llamadas += 1;
    modulo.tokensEntrada += entrada;
    modulo.tokensSalida += salida;
    modulo.tokens += entrada + salida;
    modulo.costo += num(fila.costo_estimado);
    modulo.conEstimados ||= Boolean(fila.estimado);
    modulos.set(clave, modulo);
    porUsuario.set(fila.usuario_id, modulos);
  }
  const usuarios: ConsumoUsuario[] = [...porUsuario.entries()].map(([usuarioId, modulos]) => {
    const lista = [...modulos.values()].map((m) => ({ ...m, costo: Math.round(m.costo * 1e6) / 1e6 })).sort((a, b) => b.tokens - a.tokens);
    return {
      usuarioId,
      llamadas: lista.reduce((s, m) => s + m.llamadas, 0),
      tokens: lista.reduce((s, m) => s + m.tokens, 0),
      costo: Math.round(lista.reduce((s, m) => s + m.costo, 0) * 1e6) / 1e6,
      modulos: lista,
    };
  }).sort((a, b) => b.tokens - a.tokens);
  return {
    usuarios,
    total: {
      llamadas: usuarios.reduce((s, u) => s + u.llamadas, 0),
      tokens: usuarios.reduce((s, u) => s + u.tokens, 0),
      costo: Math.round(usuarios.reduce((s, u) => s + u.costo, 0) * 1e6) / 1e6,
    },
  };
}

// ── CSV ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Celda de CSV. Una celda que empieza por `=`, `+`, `-`, `@` o un tabulador la interpreta Excel como fórmula: la IP, la
 * ruta o el nombre del navegador los controla quien navega, así que se neutraliza con una comilla simple delante (la
 * práctica recomendada por OWASP para la «inyección CSV»).
 */
export function celdaCsv(valor: unknown): string {
  let texto = valor === null || valor === undefined ? "" : String(valor);
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return /[",\n\r;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function aCsv(columnas: readonly string[], filas: ReadonlyArray<Record<string, unknown>>): string {
  const cabecera = columnas.map(celdaCsv).join(",");
  const cuerpo = filas.map((fila) => columnas.map((columna) => celdaCsv(fila[columna])).join(","));
  // BOM para que Excel abra las tildes bien; saltos de línea CRLF como pide la norma del formato.
  return `﻿${[cabecera, ...cuerpo].join("\r\n")}\r\n`;
}
