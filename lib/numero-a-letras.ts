// Convierte un monto a su representación en letras
// Ej: "603,806.00" → "SEISCIENTOS TRES MIL OCHOCIENTOS SEIS CON 00/100 SOLES"
//
// La moneda se pasa aparte porque no siempre son soles: el requerimiento puede
// ir en dólares (Art. 47.1). Sin argumento, se mantiene el comportamiento de
// siempre —soles— para no tocar a los llamadores existentes.

const UNIDADES = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
const DECENAS = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const CENTENAS = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

function convertirGrupo(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  const c = Math.floor(n / 100);
  const d = Math.floor((n % 100) / 10);
  const u = n % 10;
  let r = c > 0 ? CENTENAS[c] : "";
  if (d === 0 && u === 0) return r;
  if (d === 1) {
    r += (r ? " " : "") + (u === 0 ? "DIEZ" : u === 1 ? "ONCE" : u === 2 ? "DOCE" : u === 3 ? "TRECE" : u === 4 ? "CATORCE" : u === 5 ? "QUINCE" : `DIECI${UNIDADES[u]}`);
    return r;
  }
  if (d === 2) {
    r += (r ? " " : "") + (u === 0 ? "VEINTE" : `VEINTI${UNIDADES[u]}`);
    return r;
  }
  if (d > 0) r += (r ? " " : "") + DECENAS[d];
  // La "y" solo va ENTRE decena y unidad: "ochenta y cinco", pero "doscientos
  // cinco" (sin decena) y "ochenta" (sin unidad) no la llevan. Las decenas 1x y
  // 2x ya salieron arriba, así que aquí `d` es 0 o de 3 a 9.
  if (u > 0) r += (d > 0 ? " Y " : r ? " " : "") + UNIDADES[u];
  return r;
}

/**
 * El nombre de la moneda como se escribe en el «CON XX/100 ___» del formato.
 *
 * Acepta el código («PEN»/«USD»), la etiqueta del desplegable («… Soles (S/)»)
 * o el símbolo: la ficha guarda una de las tres según de dónde venga el dato.
 * Por defecto, soles.
 */
export function nombreMoneda(moneda?: string | null): string {
  const m = (moneda ?? "").toUpperCase();
  if (m.includes("USD") || m.includes("DÓLAR") || m.includes("DOLAR") || m.includes("US$") || m.includes("$")) {
    return "DÓLARES AMERICANOS";
  }
  return "SOLES";
}

export function numeroALetras(monto: string, moneda?: string | null): string {
  const limpio = monto.replace(/[^0-9.,]/g, "").replace(/,/g, ".");
  const partes = limpio.split(".");
  let enteroStr: string;
  let centavosStr: string;
  if (partes.length >= 2 && partes[partes.length - 2].length > 0) {
    enteroStr = partes.slice(0, -1).join("");
    centavosStr = partes[partes.length - 1].padEnd(2, "0").substring(0, 2);
  } else {
    enteroStr = partes[0] || "0";
    centavosStr = "00";
  }
  const entero = Number.parseInt(enteroStr, 10);
  if (!Number.isFinite(entero) || entero < 0) return monto;
  if (entero > 999999999) return monto;
  const millones = Math.floor(entero / 1000000);
  const miles = Math.floor((entero % 1000000) / 1000);
  const resto = entero % 1000;
  const partesLetras: string[] = [];
  if (millones > 0) {
    const g = convertirGrupo(millones);
    partesLetras.push(g === "UN" ? "UN MILLON" : `${g} MILLONES`);
  }
  if (miles > 0) {
    const g = convertirGrupo(miles);
    partesLetras.push(g === "UN" ? "UN MIL" : `${g} MIL`);
  }
  if (resto > 0 || (millones === 0 && miles === 0)) {
    partesLetras.push(convertirGrupo(resto) || "CERO");
  }
  return `${partesLetras.join(" ")} CON ${centavosStr}/100 ${nombreMoneda(moneda)}`;
}
