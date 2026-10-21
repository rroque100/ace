// Acceso de SOLO LECTURA al proyecto Supabase de "control" — una app DISTINTA
// del usuario (gestión de cotizaciones/pedidos, org "control" en su cuenta de
// Supabase), no el proyecto de ACE. Existe únicamente para el import de
// "Nueva necesidad" por N° de pedido: ACE consulta `siga_pedido` +
// `siga_pedido_item` de esa base y arma la propuesta de necesidad — nunca
// escribe ahí.
//
// Es un servicio EXTERNO real: si sus credenciales faltan o cambian, o el
// proyecto está caído, el import por N° de pedido falla (ver
// app/api/necesidades/import-pedido-control/route.ts), pero el resto de ACE
// no depende de esto — el import por archivo .xlsx (lib/pedido-compra-import.ts)
// sigue funcionando igual.
//
// La clave de servicio de "control" tiene el mismo alcance que cualquier
// service_role: puede leer y escribir CUALQUIER tabla de esa base, no solo
// `siga_pedido*`. Aquí se usa exclusivamente para GET; conviene, cuando sea
// posible, cambiarla por una credencial de solo lectura acotada a esas dos
// tablas en el propio proyecto "control".

function getControlConfig() {
  const url = process.env.CONTROL_SUPABASE_URL;
  const serviceRoleKey = process.env.CONTROL_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Falta CONTROL_SUPABASE_URL o CONTROL_SUPABASE_SERVICE_ROLE_KEY (import por N° de pedido)");
  }
  return { serviceRoleKey, url: url.replace(/\/$/, "") };
}

export async function controlSupabaseRest<T>(path: string): Promise<T> {
  const { serviceRoleKey, url } = getControlConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    cache: "no-store",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    method: "GET",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`control Supabase REST ${response.status}: ${detail}`);
  }
  return response.json() as Promise<T>;
}
