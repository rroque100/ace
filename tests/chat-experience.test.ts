import {describe,it,expect} from 'vitest';
import {chatContinuityKey,readChatSnapshot,conversationUrl} from '@/lib/chat-continuity';
import {feedbackSchema,nextClarification,contextualFollowups} from '@/lib/chat-experience';
import {qualityCaseSchema,sourceCoverage} from '@/lib/chat-quality';
import {workNoteSnapshot} from '@/lib/chat-work-notes';
describe('continuidad y calidad',()=>{
 it('aísla usuario y conversación',()=>{expect(chatContinuityKey('a','1')).not.toBe(chatContinuityKey('b','1'));expect(chatContinuityKey('a','1')).not.toBe(chatContinuityKey('a','2'));});
 it('descarta borradores caducados o dañados',()=>{expect(readChatSnapshot('{')).toBeNull();expect(readChatSnapshot(JSON.stringify({version:1,updatedAt:1,question:'hola',scroll:20}),90000000)).toBeNull();});
 it('conserva navegación sin incluir pregunta en URL',()=>{expect(conversationUrl('https://ace.test/chat?pregunta=privada&documentId=x','s')).toBe('/chat?documentId=x&sessionId=s');});
 it('no admite motivos inventados',()=>{expect(feedbackSchema.safeParse({action:'mark_incorrect',reason:'inventado'}).success).toBe(false);expect(feedbackSchema.safeParse({action:'mark_incorrect',reason:'incorrect_citation'}).success).toBe(true);});
 it('una referencia pendiente no es revisión especializada',()=>{expect(qualityCaseSchema.safeParse({question:'Pregunta de evaluación'}).success).toBe(true);expect(qualityCaseSchema.safeParse({question:'Pregunta de evaluación',status:'reviewed'}).success).toBe(false);});
 it('compara identidad y artículo sin afirmar precisión jurídica',()=>{expect(sourceCoverage([{documentId:'a',article:'1'}],[{documentId:'a',article:'2'}]).located).toBe(0);expect(sourceCoverage([],[]).label).toContain('no acredita');});
 it('no solicita contexto en preguntas generales',()=>{expect(nextClarification({queryScope:'general',missing:['régimen aplicable']} as never)).toBeNull();expect(nextClarification({queryScope:'case',missing:['fechas relevantes','hechos del caso']} as never)?.key).toBe('dates');});
 it('la nota conserva solo fuentes citadas y sesión',()=>{const note=workNoteSnapshot({id:'m',session_id:'s',content:'Regla [F2]',sources:[{documentTitle:'No citada'},{documentTitle:'Citada',documentId:'d',pageStart:2}],metadata:{question:'Pregunta'}});expect(note.sources).toHaveLength(1);expect(note.sources[0].title).toBe('Citada');expect(note.sessionId).toBe('s');expect(note.status).toBe('pending_review');});
 it('seguimiento depende de la consulta',()=>{expect(contextualFollowups({questionText:'Compara las dos versiones',sources:[]} as never).join(' ')).toMatch(/diferencias|compar/i);});
});
