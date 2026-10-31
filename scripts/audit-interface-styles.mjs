import fs from 'node:fs';
import path from 'node:path';
const paths=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const target=path.join(dir,entry.name);if(entry.isDirectory())walk(target);else paths.push(target.replaceAll('\\','/'));}}
walk('app');
const styles=paths.filter(file=>file.endsWith('.css')).map(file=>({file,lines:fs.readFileSync(file,'utf8').split('\n').length,bytes:fs.statSync(file).size}));
const inline=paths.filter(file=>file.endsWith('.tsx')&&/style=\{/.test(fs.readFileSync(file,'utf8')));
const imports=paths.filter(file=>/\.tsx$/.test(file)).flatMap(file=>[...fs.readFileSync(file,'utf8').matchAll(/import\s+["']([^"']+\.css)["']/g)].map(match=>({file,stylesheet:match[1]})));
const migrated=['app/components/app-shell.tsx','app/components/sidebar.tsx','app/components/appearance-control.tsx','app/components/year-selector.tsx','app/page.tsx','app/loading.tsx','app/components/auth/auth-ui.tsx'];
const violations=migrated.filter(file=>/style=\{|import\s+["'][^"']+\.css/.test(fs.readFileSync(file,'utf8')));
const report={date:'2026-10-31',routes:paths.filter(file=>file.endsWith('/page.tsx')).length,stylesheets:styles,cssImports:imports,inlineStyleComponents:inline,migratedSharedFiles:migrated,violations};
if(process.argv.includes('--check')){console.log(JSON.stringify({migrated:migrated.length,violations}));process.exitCode=violations.length?1:0;}else console.log(JSON.stringify(report,null,2));
