/**
 * Lista los usuarios (profiles) con su rol, para un vistazo rápido fuera de la app.
 * Uso: npx tsx --env-file=.env.local scripts/listar-usuarios.mts
 */
import { supabaseRest } from "@/lib/supabase-server";
import { appRoleLabel, isAppRole } from "@/lib/permisos-contratacion";

type Perfil = {
  email: string | null;
  role: string | null;
  es_jefe: boolean | null;
  nombre_completo: string | null;
  cargo: string | null;
  oficina_id: string | null;
};

const perfiles = await supabaseRest<Perfil[]>(
  "profiles?select=email,role,es_jefe,nombre_completo,cargo,oficina_id&order=role.asc,email.asc",
);

const oficinas = await supabaseRest<Array<{ id: string; nombre: string }>>(
  "oficinas?select=id,nombre",
).catch(() => []);
const nombreOficina = new Map(oficinas.map((o) => [o.id, o.nombre]));

console.log(`TOTAL USUARIOS: ${perfiles.length}\n`);

const porRol = new Map<string, number>();
for (const p of perfiles) porRol.set(p.role ?? "(sin rol)", (porRol.get(p.role ?? "(sin rol)") ?? 0) + 1);
console.log("CONTEO POR ROL:");
for (const [rol, n] of [...porRol.entries()].sort((a, b) => b[1] - a[1])) {
  const label = isAppRole(rol) ? appRoleLabel(rol) : rol;
  console.log(`  ${String(n).padStart(3)}  ${rol}  (${label})`);
}

console.log("\nDETALLE:");
for (const p of perfiles) {
  const jefe = p.es_jefe ? " [JEFE]" : "";
  const ofi = p.oficina_id ? ` · ${nombreOficina.get(p.oficina_id) ?? p.oficina_id.slice(0, 8)}` : "";
  console.log(`  ${(p.role ?? "?").padEnd(16)} ${(p.email ?? "?").padEnd(28)} ${(p.nombre_completo ?? "").slice(0, 30)}${ofi}${jefe}`);
}
