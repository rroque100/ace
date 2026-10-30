import fs from 'node:fs';
async function main() {
  process.loadEnvFile('.env.local');
  const url = 'https://ace-rormi.vercel.app/api/library/sync/cron';
  const unauthenticated = await fetch(url);
  if (unauthenticated.status !== 401) throw Error(`Cron público devolvió ${unauthenticated.status}`);
  const { getSupabaseAdminClient } = await import('../lib/supabase-server');
  const c = await getSupabaseAdminClient();
  const { data: settings, error } = await c.from('legal_sync_settings').select('enabled,last_started_at,last_finished_at').single();
  if (error) throw error;
  const result = { checkedAt: new Date().toISOString(), anonymousStatus: unauthenticated.status, settings, automaticDailyExecutionObserved: false, manualProductionTrigger: 'Verified through authenticated administration UI; production secret intentionally not exported.' };
  fs.writeFileSync('docs/importaciones/actualizacion-documental-produccion-2026-10-29.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
