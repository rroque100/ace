import fs from 'node:fs';

async function main() {
  process.loadEnvFile('.env.local');
  if (new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname !== 'medmcaiskvtbckpakseo.supabase.co') throw Error('Proyecto no autorizado.');
  const { getSupabaseAdminClient } = await import('../lib/supabase-server');
  const c = await getSupabaseAdminClient();
  const report = JSON.parse(fs.readFileSync('docs/importaciones/celex-activacion-2026-10-27.json', 'utf8'));
  const ids = report.entries.map((e: {id: string}) => e.id);
  const {data: docs, error} = await c.from('documents').select('id,title,status,mime_type,metadata').in('id', ids);
  if (error) throw error;
  const checks = [];
  for (const doc of docs ?? []) {
    const {count, error: chunkError} = await c.from('document_chunks').select('id', {count:'exact',head:true}).eq('document_id',doc.id);
    if (chunkError) throw chunkError;
    const nonPdf = doc.mime_type !== 'application/pdf';
    const {count: invalidPages,error: pagesError} = await c.from('document_chunks').select('id',{count:'exact',head:true}).eq('document_id',doc.id).or('page_start.not.is.null,page_end.not.is.null');
    if (pagesError) throw pagesError;
    checks.push({id:doc.id,title:doc.title,indexed:doc.status==='indexed',complete:doc.metadata.indexedTextComplete===true,chunks:count,nonPdf,physicalPagesAbsent:nonPdf ? invalidPages===0 : null,pipeline:doc.metadata.indexingPipelineVersion,hasOriginalHash:typeof doc.metadata.sha256==='string'});
  }
  const passed = checks.length===48 && checks.every(e=>e.indexed && e.complete && (e.chunks??0)>0 && (!e.nonPdf || e.physicalPagesAbsent));
  fs.writeFileSync('docs/importaciones/celex-activacion-auditoria-2026-10-27.json',JSON.stringify({checkedAt:new Date().toISOString(),passed,documents:checks},null,2));
  console.log(JSON.stringify({passed,checked:checks.length,indexed:checks.filter(e=>e.indexed&&e.complete).length,nonPdf:checks.filter(e=>e.nonPdf).length}));
  if(!passed) process.exitCode=1;
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Falló la auditoría');process.exitCode=1;});
