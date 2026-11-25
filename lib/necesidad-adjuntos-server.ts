import { filtroEettTdr } from "./eett-tdr-documento";
import type { AdjuntoConcordancia } from "./necesidad-concordancia";
import { supabaseRest, supabaseUserRest } from "./supabase-server";

export async function puedeLeerNecesidad(accessToken: string, id: string): Promise<boolean> {
  const rows = await supabaseUserRest<Array<{ id: string }>>(
    accessToken,
    `necesidades?id=eq.${encodeURIComponent(id)}&select=id&limit=1`,
  );
  return rows.length > 0;
}

/** El llamador ya comprobó la visibilidad de la necesidad con el token del usuario. */
export function adjuntosParaConcordancia(id: string) {
  return supabaseRest<AdjuntoConcordancia[]>(
    `documents?${filtroEettTdr(id)}&select=id,file_name,title,metadata&order=created_at.asc,id.asc`,
  );
}
