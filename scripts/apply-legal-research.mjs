import fs from 'node:fs';
process.loadEnvFile('.env.local');
const ref='medmcaiskvtbckpakseo';
if(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname!==`${ref}.supabase.co`)throw Error('Proyecto no autorizado.');
const config=fs.readFileSync('.mcp.json','utf8');
const token=process.env.SUPABASE_NEW_TOKEN??config.match(/sbp_[A-Za-z0-9]+/)?.[0];
if(!token)throw Error('No está disponible el acceso administrativo existente.');
const files=['202610270004_legal_research.sql','202610270005_library_updates.sql','202610270006_arbitral_library.sql'];
for(const file of files){const sql=fs.readFileSync(`supabase/migrations/${file}`,'utf8');const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','User-Agent':'Mozilla/5.0'},body:JSON.stringify({query:sql}),signal:AbortSignal.timeout(60000)});if(!response.ok){const body=await response.text();throw Error(`${file}: HTTP ${response.status} ${body.slice(0,600)}`);}console.log(`Aplicada: ${file}`);}
