import {describe,it,expect,vi,beforeEach} from 'vitest';
import {isValidRuc,entityReviewSchema} from '../lib/entity-directory';
import {documentFacts} from '../lib/document-facts';
import {guidedReadingSchema,guidedQuestion} from '../lib/guided-reading';
import {researchBriefSchema,briefText} from '../lib/research-brief';
import {matchesFollow,followSchema,eventLabel} from '../lib/library-follow';
import {discoverOfficialPdfs,officialSourceSchema} from '../lib/library-updates';
const id='11111111-1111-4111-8111-111111111111';
describe('directorio y fichas',()=>{
 it('valida dígito de control, sin afirmar existencia',()=>{expect(isValidRuc('20288774553')).toBe(true);expect(isValidRuc('20288774554')).toBe(false);expect(isValidRuc('123')).toBe(false);});
 it('exige fuente oficial y evidencia para revisar',()=>{expect(entityReviewSchema.safeParse({id,revision:0,name:'Entidad pública',ruc:'',rucVerified:false,status:'verified',aliases:[],sourceUrl:'https://sitio-ejemplo.com',evidence:'Texto de evidencia suficiente',reason:'Revisión del nombre registrado'}).success).toBe(false);});
 it('no permite verificar un RUC ausente',()=>{expect(entityReviewSchema.safeParse({id,revision:0,name:'Entidad pública',ruc:'',rucVerified:true,status:'verified',sourceUrl:'https://www.gob.pe/institucion/oece',evidence:'Texto de evidencia suficiente',reason:'Revisión del nombre registrado'}).success).toBe(false);});
 it('distingue solicitante de emisor y evita inventar consultas',()=>{const f=documentFacts({documentType:'opinion',sourceEntity:'OECE',metadata:{requestingEntity:'Municipalidad',topic:'Consulta documental'}});expect(f.find(x=>x.label==='Solicitante')?.value).toBe('Municipalidad');expect(f.find(x=>x.label==='Solicitante')?.detected).toBe(true);expect(f.some(x=>x.label==='Consultas registradas')).toBe(false);});
 it('laudo muestra roles de partes diferenciados',()=>{const f=documentFacts({documentType:'laudo_arbitral',metadata:{claimant:'Contratista',respondent:'Entidad',arbitrators:'Árbitro registrado'}});expect(f.find(x=>x.label==='Demandante')?.value).toBe('Contratista');expect(f.find(x=>x.label==='Demandado')?.value).toBe('Entidad');});
});
describe('guía e investigación',()=>{
 it('preserva bloque sin inventar página',()=>{const p=guidedReadingSchema.parse({documentId:id,action:'explain',locator:'b2-dos'});expect(p.page).toBeUndefined();expect(guidedQuestion('explain','Original','Párrafo 2')).toContain('Párrafo 2');});
 it('sugiere relaciones con fuente inicial explícita',()=>{expect(guidedQuestion('relate','Original')).toContain('Conserva la fuente inicial');});
 it('no acepta hash o documento arbitrario',()=>{expect(guidedReadingSchema.safeParse({documentId:id,action:'explain',sha256:'inventado'}).success).toBe(false);});
 it('investigación predeterminada es borrador y no decisión',()=>{const b=researchBriefSchema.parse({});expect(b.research_status).toBe('draft');expect(briefText(b)).toContain('Sin precisar');});
});
describe('seguimiento y actualización',()=>{
 it('descubre solo PDF oficiales y elimina duplicados',()=>{const html='<a href="https://cdn.www.gob.pe/a.pdf">Original</a><a href="https://cdn.www.gob.pe/a.pdf">Original</a><a href="https://externo.com/b.pdf">Ajeno</a><a href="http://127.0.0.1/c.pdf">Privado</a>';expect(discoverOfficialPdfs(html,'https://www.gob.pe/oece')).toEqual([{url:'https://cdn.www.gob.pe/a.pdf',title:'Original'}]);});
 it('no registra destinos privados o con credenciales',()=>{for(const url of ['http://www.gob.pe/a','https://user:clave@www.gob.pe/a','https://localhost/a'])expect(officialSourceSchema.safeParse({url,label:'Fuente oficial',documentType:'opinion',sourceEntity:'OECE'}).success).toBe(false);});
 it('no mezcla documento y búsqueda en un seguimiento',()=>{expect(followSchema.safeParse({documentId:id,search:{query:'garantía'},label:'Mi consulta'}).success).toBe(false);});
 it('respeta tipo y régimen revisado de consulta guardada',()=>{const doc={id,title:'Garantía de fiel cumplimiento',document_type:'opinion',source_entity:'OECE',process_type:null,metadata:{regime:'32069',regimeReviewed:false}};expect(matchesFollow({query:'garantía',filters:{documentType:'opinion'}},doc)).toBe(true);expect(matchesFollow({query:'garantía',filters:{documentType:'directiva'}},doc)).toBe(false);expect(matchesFollow({query:'garantía',filters:{regime:'32069'}},doc)).toBe(false);});
 it('distingue nueva publicación de relación revisada',()=>{expect(eventLabel('publication')).toContain('Nueva publicación');expect(eventLabel('version')).toContain('pendiente');expect(eventLabel('reviewed_change')).toContain('revisada');});
});
