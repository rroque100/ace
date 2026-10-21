// Configura el proyecto de Vercel para el despliegue: sube todas las variables
// de .env.local a los entornos de Vercel y dispara un redeploy de producción.
// Pensado para arrancar el proyecto contra el Supabase nuevo sin tocar el panel.
//
// El token se lee de una variable de entorno; NO lo escribas en este fichero.
//
//   VERCEL_TOKEN    -> token con acceso al team (Settings -> Tokens; Scope = el
//                      team donde vive el proyecto, NO "personal"). Obligatorio.
//   VERCEL_TEAM     -> slug o id del team (por defecto rafaelroque412-7737s-projects)
//   VERCEL_PROJECT  -> nombre del proyecto (por defecto "ace")
//   VERCEL_APP_URL  -> URL pública de producción (por defecto https://ace-two-roan.vercel.app)
//                      se usa para NEXT_PUBLIC_APP_URL (nunca localhost en prod)
//
// Uso (PowerShell):
//   $env:VERCEL_TOKEN = "vck_..."
//   node scripts/vercel-setup.mjs
//
// Reejecutable: usa upsert, así que actualiza las que ya existan.

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const token = process.env.VERCEL_TOKEN;
if (!token) {
  console.error("Falta VERCEL_TOKEN (token de Vercel con acceso al team).");
  process.exit(1);
}
const teamInput = process.env.VERCEL_TEAM || "rafaelroque412-7737s-projects";
const projectName = process.env.VERCEL_PROJECT || "ace";
const appUrl = process.env.VERCEL_APP_URL || "https://ace-two-roan.vercel.app";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Variables que NO deben subir a Vercel (son de scripts/migración local).
const SKIP = new Set(["VERCEL_TOKEN", "VERCEL_TEAM", "VERCEL_PROJECT", "VERCEL_APP_URL", "SUPABASE_NEW_TOKEN", "NEW_REF", "OLD_SERVICE_ROLE", "NEW_SERVICE_ROLE", "OLD_SUPABASE_URL", "NEW_SUPABASE_URL"]);

async function api(path, { method = "GET", body, team = true } = {}) {
  const url = new URL("https://api.vercel.com" + path);
  if (team && teamId) url.searchParams.set("teamId", teamId);
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* deja json en null */ }
  if (!res.ok) {
    const msg = json?.error?.message || text || res.statusText;
    const err = new Error(`HTTP ${res.status} en ${method} ${path}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

// Parser sencillo de .env: KEY=VALUE, ignora comentarios, quita comillas y `export`.
function parseEnv(txt) {
  const out = {};
  for (let line of txt.split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice(7).trim();
    const i = line.indexOf("=");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

// ── 1) Resolver el teamId (id directo → slug → team por defecto del token) ───
let teamId = null;
if (teamInput.startsWith("team_")) {
  teamId = teamInput;
  console.log(`Team (id): ${teamId}`);
} else {
  // a) intentar resolver por slug (requiere que el token vea el team)
  try {
    const t = await api(`/v2/teams?slug=${encodeURIComponent(teamInput)}`, { team: false });
    teamId = (t && t.id) || (t?.teams?.[0]?.id) || null;
    if (teamId) console.log(`Team: ${teamInput} -> ${teamId}`);
  } catch {
    /* el token puede no poder listar teams por slug; probamos por defecto */
  }
  // b) si no, usar el team por defecto del propio token
  if (!teamId) {
    const me = await api(`/v2/user`, { team: false });
    teamId = me?.user?.defaultTeamId || null;
    if (teamId) console.log(`Team por defecto del token: ${teamId}`);
  }
  if (!teamId) {
    console.error(
      `No pude resolver el team. Crea el token con Scope = el TEAM ("rafaelroque412-7737's projects"), ` +
        `no "Personal Account"; o pasa VERCEL_TEAM con el id (team_...).`,
    );
    process.exit(1);
  }
}

// ── 2) Localizar el proyecto ────────────────────────────────────────────────
const project = await api(`/v9/projects/${encodeURIComponent(projectName)}`);
const projectId = project.id;
console.log(`Proyecto: ${project.name} (${projectId})`);

// ── 3) Subir variables de .env.local ────────────────────────────────────────
const env = parseEnv(await readFile(join(root, ".env.local"), "utf8"));
env["NEXT_PUBLIC_APP_URL"] = appUrl; // en prod nunca localhost
const targets = ["production", "preview", "development"];

let ok = 0, fail = 0, skipped = 0;
console.log(`\nSubiendo variables (${Object.keys(env).length}) a ${targets.join("/")}:\n`);
for (const [key, value] of Object.entries(env)) {
  if (SKIP.has(key)) { skipped++; continue; }
  if (value === "" || value.startsWith("PEGA_AQUI") || value.startsWith("<")) {
    console.log(`  ${key} … OMITIDA (valor vacío/placeholder)`); skipped++; continue;
  }
  try {
    await api(`/v10/projects/${projectId}/env?upsert=true`, {
      method: "POST",
      body: { key, value, type: "encrypted", target: targets },
    });
    console.log(`  ${key} … ok`);
    ok++;
  } catch (e) {
    console.log(`  ${key} … ERROR (${e.message})`);
    fail++;
  }
}
console.log(`\nVariables: ${ok} ok · ${fail} error · ${skipped} omitidas`);

// ── 4) Redeploy de producción (build fresco para reincrustar NEXT_PUBLIC_*) ──
console.log("\nDisparando redeploy de producción…");
try {
  const list = await api(`/v6/deployments?projectId=${projectId}&target=production&limit=1`);
  const last = list?.deployments?.[0];
  if (!last) {
    console.log("  No encontré un deployment de producción previo. Haz el primer deploy desde el panel/CLI.");
  } else {
    const body = { name: project.name, target: "production" };
    if (last.meta?.githubCommitSha || last.gitSource) {
      // Redeploy desde el mismo commit git = build completo (reincrusta env)
      body.gitSource = last.gitSource || {
        type: "github",
        repoId: last.meta?.githubRepoId,
        ref: last.meta?.githubCommitRef,
        sha: last.meta?.githubCommitSha,
      };
    } else {
      body.deploymentId = last.uid; // fallback: redeploy por id
    }
    const dep = await api(`/v13/deployments?forceNew=1`, { method: "POST", body });
    console.log(`  Redeploy lanzado: https://${dep.url || dep.alias?.[0] || "(ver panel)"}`);
    console.log("  Estado inicial:", dep.readyState || dep.status || "QUEUED");
  }
} catch (e) {
  console.log(`  No pude disparar el redeploy por API (${e.message}).`);
  console.log("  Hazlo a mano: Deployments -> ⋯ -> Redeploy (desmarca 'Use existing Build Cache').");
}

console.log("\nHecho. En ~1-2 min recarga https://ace-two-roan.vercel.app y comprueba que ya no da 500.");
