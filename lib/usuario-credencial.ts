// El "usuario" con el que se entra a ACE: ocho dígitos, el DNI del servidor.
//
// ── Por qué hay un correo detrás ──────────────────────────────────────────────
//
// Supabase Auth identifica las cuentas por correo o por teléfono; no tiene un
// modo "solo usuario". Así que el usuario de ocho dígitos se convierte SIEMPRE en
// un correo sintético `12345678@ace.local` antes de hablar con Auth, y se vuelve
// a convertir a usuario para enseñarlo. El dominio no existe ni recibe correo: no
// hay recuperación por email, y esa es una consecuencia real de este diseño
// —quien pierda la contraseña necesita que un administrador se la cambie—.
//
// El dominio ya estaba en uso para las cuentas por rol que crea el seed
// (`dec@ace.local`), así que se reutiliza en vez de introducir un segundo.
//
// ── Por qué el dominio es una constante y no configuración ────────────────────
//
// Es parte de la identidad de cada cuenta ya creada. Cambiarlo dejaría fuera a
// todo el mundo de golpe, sin aviso y sin forma obvia de diagnosticarlo. Si algún
// día hace falta cambiarlo, toca migrar los correos en Auth, no editar una
// variable de entorno.

export const DOMINIO_USUARIO = "ace.local";

/** Longitud del usuario: la del DNI peruano. */
export const USUARIO_LONGITUD = 8;

const SOLO_DIGITOS = /^\d+$/;

/** Deja solo dígitos y corta al largo del usuario. Para usar al teclear. */
export function normalizarUsuario(valor: string): string {
  return (valor ?? "").replace(/\D/g, "").slice(0, USUARIO_LONGITUD);
}

export function esUsuarioValido(valor: string): boolean {
  const v = (valor ?? "").trim();
  return v.length === USUARIO_LONGITUD && SOLO_DIGITOS.test(v);
}

/**
 * Usuario → correo interno de Auth.
 *
 * Lanza si el usuario no es válido: construir `undefined@ace.local` crearía una
 * cuenta fantasma que nadie podría usar ni encontrar después.
 */
export function correoDeUsuario(usuario: string): string {
  const v = (usuario ?? "").trim();
  if (!esUsuarioValido(v)) {
    throw new Error(`El usuario debe tener ${USUARIO_LONGITUD} dígitos.`);
  }
  return `${v}@${DOMINIO_USUARIO}`;
}

/**
 * Correo interno → usuario, o null si ese correo no es de esta forma.
 *
 * Null no es un error: las cuentas anteriores a este cambio tienen correos
 * reales y hay que poder seguir mostrándolas.
 */
export function usuarioDeCorreo(correo: string | null | undefined): string | null {
  const v = (correo ?? "").trim().toLowerCase();
  const sufijo = `@${DOMINIO_USUARIO}`;
  if (!v.endsWith(sufijo)) return null;
  const local = v.slice(0, -sufijo.length);
  return esUsuarioValido(local) ? local : null;
}

/**
 * Lo que se le enseña al usuario para identificar una cuenta.
 *
 * Las cuentas nuevas se ven como "12345678"; las antiguas y las de rol del seed
 * (`dec@ace.local`) siguen viéndose por su correo, porque es lo único que las
 * identifica y ocultarlo dejaría filas sin nombre en la tabla de usuarios.
 */
export function etiquetaDeCuenta(correo: string | null | undefined): string {
  return usuarioDeCorreo(correo) ?? (correo ?? "").trim();
}

/**
 * Lo que se teclea en el inicio de sesión → correo para Auth.
 *
 * Acepta las dos formas a propósito. Si solo admitiera los ocho dígitos, todas
 * las cuentas creadas ANTES de este cambio —incluida la del administrador que
 * gestiona las demás— se quedarían fuera el día del despliegue, sin nadie dentro
 * para arreglarlo. Un valor con "@" se pasa tal cual.
 */
export function credencialAIdentificador(valor: string): string {
  const v = (valor ?? "").trim();
  if (v.includes("@")) return v.toLowerCase();
  return correoDeUsuario(v);
}
