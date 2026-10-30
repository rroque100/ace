import fs from 'node:fs';
import {parseOeceCatalogue,OECE_OFFICIAL_SOURCE} from '../lib/oece-official-source';
import {officialPage} from '../lib/library-updates';
async function main(){const html=await officialPage(OECE_OFFICIAL_SOURCE);const parsed=parseOeceCatalogue(html,OECE_OFFICIAL_SOURCE);const report={checkedAt:new Date().toISOString(),source:OECE_OFFICIAL_SOURCE,status:'preview_not_imported',...parsed};fs.mkdirSync('docs/importaciones',{recursive:true});fs.writeFileSync('docs/importaciones/oece-fuente-oficial-2026-10-28.json',JSON.stringify(report,null,2));console.log(JSON.stringify({source:report.source,publications:parsed.publications,pdfs:parsed.items.length,withoutPdf:parsed.withoutPdf,nextUrl:parsed.nextUrl,first:parsed.items[0]?.title}));}
main().catch(e=>{console.error(e instanceof Error?e.message:'Falló la lectura');process.exitCode=1;});
