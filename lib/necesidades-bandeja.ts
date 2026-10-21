// Bandeja "lo que me toca": qué necesidades esperan una acción de ESTE usuario.
//
// La regla es una sola y vive aquí para que el contador del menú (app-shell) y
// el filtro "mine" del listado usen exactamente los mismos estados: el badge
// nunca dice un número distinto al que se ve al entrar. Los estados se derivan
// del rol (la DEC/admin ve su lado; el resto, el del área usuaria), nunca del
// cliente.

import type { SessionUser } from "./auth";
import { ladoDeRol, NECESIDAD_ESTADOS } from "./necesidad-workflow";
import { supabaseUserRest } from "./supabase-server";

/** Estados que esperan la acción del lado del usuario (según su rol). */
export function estadosBandeja(role: string | null | undefined): string[] {
  const { esDec } = ladoDeRol(role);
  const lado = esDec ? "dec" : "area_usuaria";
  return NECESIDAD_ESTADOS.filter((e) => e.actor === lado).map((e) => e.value);
}

/** Tope de conteo del badge: por encima se muestra "99+". */
export const BANDEJA_TOPE = 99;

/**
 * Cuántas necesidades esperan una acción de este usuario. Se cuenta con SU token
 * (RLS): el área usuaria solo ve las suyas; la DEC, las que le fueron remitidas.
 * Falla en silencio a 0: un contador roto no debe tumbar el render del menú.
 */
export async function contarNecesidadesPendientes(user: SessionUser): Promise<number> {
  if (!user.accessToken) return 0;
  const estados = estadosBandeja(user.role);
  if (estados.length === 0) return 0;
  try {
    const filas = await supabaseUserRest<Array<{ id: string }>>(
      user.accessToken,
      `necesidades?status=in.(${estados.join(",")})&select=id&limit=${BANDEJA_TOPE}`,
    );
    return Array.isArray(filas) ? filas.length : 0;
  } catch {
    return 0;
  }
}
