import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EXAM_CURRICULUM } from '../lib/exam-curriculum';
import { examQuestionSchema, type ExamQuestion } from '../lib/exam-policy';

type Case = { numero: string; input: ExamQuestion };
type Review = { lote: number; sha256: string; items: Array<{ numero: string; verdict: string }> };
type State = { total: number; preparadas: number; balotarios: Array<{ slot: number; preparadas: number }>; asignaciones: Array<{ slot: number; questionId: string; subcompetencyCode: string }> };

const directory = new URL('../output/cinco-simulaciones-2026-11-16/', import.meta.url);
const read = <T,>(name: string): T => JSON.parse(readFileSync(new URL(name, directory), 'utf8').replace(/^\uFEFF/, ''));
const items = read<Case[]>('preguntas-115.json');
const batches = Array.from({ length: 5 }, (_, i) => read<Case[]>(`lote-${i + 1}.json`)).flat();

describe('edición de cinco simulaciones y casuística compleja', () => {
  it('las 115 altas cumplen el contrato editorial y las cuotas faltantes', () => {
    expect(items).toHaveLength(115);
    expect(new Set(items.map(r => r.input.id)).size).toBe(115);
    const counts: Record<string, number> = {};
    for (const r of items) {
      const result = examQuestionSchema.safeParse(r.input);
      expect(result.success ? [] : result.error.issues, r.numero).toEqual([]);
      expect(r.input.difficulty).toBe('advanced');
      expect(r.input.cognitiveLevel).toBe('analyze');
      expect(r.input.sourceCutoff).toBe('2026-10-29');
      expect(r.input.topic).toBe(EXAM_CURRICULUM.find(c => c.code === r.input.subcompetencyCode)?.label);
      counts[r.input.subcompetencyCode] = (counts[r.input.subcompetencyCode] ?? 0) + 1;
    }
    expect(counts).toEqual({ '1.1':21,'1.2':20,'1.4':1,'1.5':2,'1.6':1,'1.8':2,'2.1':15,'2.2':15,'2.3':2,'2.4':2,'2.5':3,'2.6':5,'3.2':10,'3.3':2,'3.6':3,'3.7':1,'3.10':10 });
  });

  it('cada caso procede de un lote revisado íntegramente y sin cambios posteriores', () => {
    for (let n = 1; n <= 5; n++) {
      const batch = read<Case[]>(`lote-${n}.json`), review = read<Review>(`revision-lote-${n}.json`);
      expect(review.lote).toBe(n);
      expect(review.sha256).toBe(createHash('sha256').update(readFileSync(new URL(`lote-${n}.json`, directory))).digest('hex'));
      expect(review.items).toHaveLength(batch.length);
      expect(review.items.map(r => r.numero).sort()).toEqual(batch.map(r => r.numero).sort());
      expect(review.items.every(r => r.verdict === 'approve')).toBe(true);
    }
  });

  it('el equilibrio de posiciones conserva las respuestas y sus fundamentos revisados', () => {
    for (const r of items) {
      const original = batches.find(b => b.numero === r.numero)!.input;
      const q = r.input;
      expect(q.prompt, r.numero).toBe(original.prompt);
      expect(q.explanation, r.numero).toBe(original.explanation);
      expect(q.sources, r.numero).toEqual(original.sources);
      expect(q.options.find(o => o.id === q.correctOption)!.text, r.numero).toBe(original.options.find(o => o.id === original.correctOption)!.text);
      expect(q.options.map(o => o.text).sort(), r.numero).toEqual(original.options.map(o => o.text).sort());
      for (const option of q.options) {
        const prior = original.options.find(o => o.text === option.text)!;
        expect(q.optionRationales[option.id], r.numero).toBe(original.optionRationales[prior.id]);
      }
    }
  });

  it('el manifiesto fija cinco conjuntos disjuntos que cubren las treinta cuotas', () => {
    const state = read<{ rows: Array<{ estado: State }> }>('estado-final.json').rows[0].estado;
    expect(state.total).toBe(381);
    expect(state.preparadas).toBe(381);
    expect(state.balotarios).toHaveLength(5);
    expect(state.asignaciones).toHaveLength(360);
    expect(new Set(state.asignaciones.map(r => r.questionId)).size).toBe(360);
    for (const set of state.balotarios) {
      const rows = state.asignaciones.filter(r => r.slot === set.slot);
      expect(rows).toHaveLength(72);
      expect(set.preparadas).toBe(72);
      for (const c of EXAM_CURRICULUM) expect(rows.filter(r => r.subcompetencyCode === c.code).length, `${set.slot}/${c.code}`).toBe(c.quota);
    }
  });
});
