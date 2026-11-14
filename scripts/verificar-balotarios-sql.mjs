// PostgreSQL en memoria: no usa .env ni se conecta a producción.
// Preparación: npm install --prefix tmp/qa-sql --no-save --package-lock=false @electric-sql/pglite
import { PGlite } from '../tmp/qa-sql/node_modules/@electric-sql/pglite/dist/index.js';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
await db.query('insert into auth.users values ($1),($2)',[owner,other]);
await db.exec(readFileSync('docs/supabase/2026-11-13-balotarios-fiables.sql','utf8'));
await db.exec(readFileSync('docs/supabase/2026-11-13-balotarios-fiables.sql','utf8'));
const source=JSON.parse(readFileSync('app/components/balotarios/balotarios-oece.json','utf8'));
const questions=source.balotarios[0].preguntas.map(q=>({...q,id:`b1-q${q.n}`}));
async function rpc(actor,action,input={}) {return (await db.query('select public.ace_balotario_operar($1::uuid,$2,$3::jsonb) as result',[actor,action,JSON.stringify(input)])).rows[0].result;}
let t=await rpc(owner,'start',{balotario:1,questions});
assert.equal(t.questions.length,72);
assert.equal((await rpc(owner,'start',{balotario:1,questions})).id,t.id);
assert.equal((await rpc(other,'dashboard')).active,null);
await assert.rejects(()=>rpc(other,'save',{id:t.id,revision:0,questionId:'b1-q1',option:'A',flagged:false,position:0}));
t=await rpc(owner,'save',{id:t.id,revision:0,questionId:'b1-q1',option:questions[0].correcta,flagged:true,position:3});
assert.equal(t.revision,1);assert.equal(t.position,3);assert.deepEqual(t.flagged,['b1-q1']);
await assert.rejects(()=>rpc(owner,'save',{id:t.id,revision:0,questionId:'b1-q2',option:'A',flagged:false,position:1}));
t=await rpc(owner,'position',{id:t.id,revision:1,position:55});
assert.equal(t.position,55);assert.equal(t.answers['b1-q1'],questions[0].correcta);assert.equal(Object.keys(t.answers).length,1);
t=await rpc(owner,'save',{id:t.id,revision:2,questionId:'b1-q1',option:questions[0].correcta,flagged:false,position:4});
assert.deepEqual(t.flagged,[]);
const wrong=questions[1].opciones.find(o=>o.letra!==questions[1].correcta).letra;
t=await rpc(owner,'save',{id:t.id,revision:3,questionId:'b1-q2',option:wrong,flagged:false,position:1});
t=await rpc(owner,'submit',{id:t.id,revision:4});
assert.equal(t.result.correct,1);assert.equal(t.result.incorrect,1);assert.equal(t.result.omitted,70);
assert.equal((await rpc(owner,'submit',{id:t.id,revision:2})).revision,t.revision);
assert.equal((await rpc(owner,'get',{id:t.id})).questions.length,72);
assert.equal((await rpc(owner,'dashboard')).history[0].questions.length,0);
let expired=await rpc(owner,'start',{balotario:1,questions});
await db.query(`update public.balotario_attempts set started_at=now()-interval '121 minutes',deadline_at=now()-interval '1 minute' where id=$1`,[expired.id]);
expired=await rpc(owner,'save',{id:expired.id,revision:0,questionId:'b1-q1',option:'A',flagged:false,position:0});
assert.equal(expired.state,'submitted');assert.deepEqual(expired.answers,{});assert.equal(expired.result.seconds,7200);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${other}';`);
await assert.rejects(()=>db.query('select * from public.balotario_attempts'));
await assert.rejects(()=>rpc(owner,'dashboard'));
await db.close();console.log('SQL OK: inicio idempotente, propietario/RLS, revisión concurrente, respuestas, entrega idempotente, vencimiento y detalle ligero.');

