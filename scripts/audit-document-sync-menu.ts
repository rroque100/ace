import fs from 'node:fs';
import { createHash } from 'node:crypto';
async function main() {
  process.loadEnvFile('.env.local');
  const {syncOverview} = await import('../lib/document-sync');
  const {getSupabaseAdminClient} = await import('../lib/supabase-server');
  const c = await getSupabaseAdminClient();
  const overview = await syncOverview();
  const path = 'docs/importaciones/actualizacion-documental-prueba-menu-2026-10-29.json';
  const mode = process.argv[2] ?? 'before';
  const snapshot = {
    checkedAt: new Date().toISOString(), settings: overview.settings,
    counts: overview.counts, stages: overview.stages, usage: overview.usage,
    sources: overview.sources.map(s=>({id:s.id,label:s.label,config:s.config})),
    latestEvent: overview.events?.[0] ?? null,
  };
  if (mode === 'before') {
    fs.writeFileSync(path, JSON.stringify({before:snapshot},null,2));
    console.log(JSON.stringify({mode,counts:snapshot.counts,stages:snapshot.stages,usage:snapshot.usage}));
    return;
  }
  const report = JSON.parse(fs.readFileSync(path,'utf8'));
  const {data:docs,error} = await c.from('documents').select('id,title,storage_bucket,storage_path,status,metadata').eq('es_institucional',true).contains('metadata',{syncManaged:true}).gt('metadata->>importedAt',report.before.checkedAt).order('created_at',{ascending:false}).limit(100);
  if(error) throw error;
  const verified=[];
  for (const d of (docs??[]).slice(0,3)) {
    const {data,error:downloadError}=await c.storage.from(d.storage_bucket).download(d.storage_path);
    if(downloadError||!data)throw Error('No se pudo verificar un original');
    const sha=createHash('sha256').update(Buffer.from(await data.arrayBuffer())).digest('hex');
    if(sha!==d.metadata.sha256)throw Error('El archivo almacenado no coincide con su huella');
    verified.push({id:d.id,title:d.title,status:d.status,sha256Matches:true});
  }
  report.after=snapshot;
  report.newOriginals=(docs??[]).length;
  report.originalsVerified=verified;
  report.productionEndpoints=await Promise.all(['/api/library/sync','/api/library/sync/cron'].map(async p=>({path:p,status:(await fetch('https://ace-rormi.vercel.app'+p,{redirect:'manual'})).status})));
  fs.writeFileSync(path,JSON.stringify(report,null,2));
  console.log(JSON.stringify({mode,counts:snapshot.counts,stages:snapshot.stages,usage:snapshot.usage,runStarted:snapshot.settings.last_started_at,runFinished:snapshot.settings.last_finished_at,newOriginals:report.newOriginals,originalsVerified:verified,productionEndpoints:report.productionEndpoints}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
