// Política de la contraseña que elige una persona externa en su primer ingreso.
//
// Módulo puro y sin dependencias de servidor, a propósito: lo importan el formulario (cliente), que muestra cada requisito
// en vivo, y la ruta del servidor, que es quien de verdad lo impone. Si el cliente y el servidor evaluaran reglas
// distintas, la pantalla diría «todo bien» y el servidor rechazaría, o al revés.
//
// El largo mínimo (8) es el mismo que el de las cuentas del personal (`PASSWORD_MINIMO` en usuarios-tab.tsx).

export const PASSWORD_MINIMO_EXTERNO = 8;
export const PASSWORD_MAXIMO = 120;

// Las que más se prueban en cualquier ataque y las que una persona elige por inercia al cambiar la temporal.
const COMUNES = new Set([
  "12345678", "123456789", "1234567890", "87654321", "11111111", "00000000", "password", "password1", "contrasena", "contrasena1",
  "qwerty123", "qwertyuiop", "abcd1234", "abc12345", "admin123", "contraseña", "contraseña1", "peru2026", "peru2025", "ace12345",
]);

export type RequisitoPassword = { clave: "largo" | "letra_numero" | "sin_usuario" | "no_comun"; texto: string; cumple: boolean };

const sinTildes = (valor: string) => valor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Cada requisito con su estado, en el orden en que se muestran. `usuario` es el DNI de la cuenta (no puede formar parte de la clave). */
export function requisitosPassword(password: string, usuario: string | null): RequisitoPassword[] {
  const dni = (usuario ?? "").trim();
  const normalizada = sinTildes(password);
  return [
    { clave: "largo", texto: `Al menos ${PASSWORD_MINIMO_EXTERNO} caracteres`, cumple: password.length >= PASSWORD_MINIMO_EXTERNO && password.length <= PASSWORD_MAXIMO },
    { clave: "letra_numero", texto: "Una letra y un número", cumple: /\p{L}/u.test(password) && /\d/.test(password) },
    { clave: "sin_usuario", texto: "No contiene tu DNI", cumple: !dni || !password.includes(dni) },
    { clave: "no_comun", texto: "No es una contraseña habitual", cumple: password.length > 0 && !COMUNES.has(normalizada) },
  ];
}

/** Los motivos por los que se rechaza; vacío si la contraseña sirve. Es lo que usa el servidor. */
export function problemasPassword(password: string, usuario: string | null): string[] {
  return requisitosPassword(password, usuario).filter((requisito) => !requisito.cumple).map((requisito) => requisito.texto);
}

/** De 0 a 4, para la barra de fortaleza. Solo orienta: lo que decide si se acepta es `problemasPassword`. */
export function fortalezaPassword(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  let puntos = 0;
  if (password.length >= PASSWORD_MINIMO_EXTERNO) puntos += 1;
  if (password.length >= 12) puntos += 1;
  if (/\p{Ll}/u.test(password) && /\p{Lu}/u.test(password)) puntos += 1;
  if (/\d/.test(password) && /[^\p{L}\d]/u.test(password)) puntos += 1;
  if (COMUNES.has(sinTildes(password))) puntos = Math.min(puntos, 1);
  return Math.min(4, puntos) as 0 | 1 | 2 | 3 | 4;
}
