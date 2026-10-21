import { describe, it, expect } from 'vitest';
import { getFeriadosOficiales } from '../lib/feriados-oficiales/index';

/**
 * Detecta si un array de feriados tiene fechas duplicadas (misma fecha ISO).
 */
function tieneDuplicados(feriados: { fecha: string }[]): boolean {
  const seen = new Set<string>();
  for (const f of feriados) {
    if (seen.has(f.fecha)) return true;
    seen.add(f.fecha);
  }
  return false;
}

function duplicados(feriados: { fecha: string; nombre: string }[]): { fecha: string; nombre: string }[] {
  const seen = new Set<string>();
  const dups: { fecha: string; nombre: string }[] = [];
  for (const f of feriados) {
    if (seen.has(f.fecha)) dups.push(f);
    seen.add(f.fecha);
  }
  return dups;
}

describe('detección de feriados duplicados', () => {
  it('getFeriadosOficiales(2026) retorna todos los feriados del año', () => {
    const feriados = getFeriadosOficiales('2026');
    expect(feriados.length).toBeGreaterThan(0);
    for (const f of feriados) {
      expect(f).toHaveProperty('fecha');
      expect(f).toHaveProperty('nombre');
      expect(f.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('los datos oficiales de 2026 no tienen fechas duplicadas', () => {
    const feriados = getFeriadosOficiales('2026');
    expect(tieneDuplicados(feriados)).toBe(false);
  });

  it('tieneDuplicados detecta una fecha repetida', () => {
    const data = [
      { fecha: '2026-01-01', nombre: 'Año Nuevo' },
      { fecha: '2026-01-01', nombre: 'Año Nuevo (dup)' },
    ];
    expect(tieneDuplicados(data)).toBe(true);
  });

  it('tieneDuplicados retorna false si todas las fechas son únicas', () => {
    const data = [
      { fecha: '2026-01-01', nombre: 'Año Nuevo' },
      { fecha: '2026-12-25', nombre: 'Navidad' },
    ];
    expect(tieneDuplicados(data)).toBe(false);
  });

  it('duplicados enumera los feriados que comparten fecha', () => {
    const data = [
      { fecha: '2026-07-28', nombre: 'Fiestas Patrias' },
      { fecha: '2026-07-28', nombre: 'Fiestas Patrias (dup)' },
      { fecha: '2026-11-01', nombre: 'Todos los Santos' },
    ];
    expect(duplicados(data)).toEqual([{ fecha: '2026-07-28', nombre: 'Fiestas Patrias (dup)' }]);
  });

  it('duplicados retorna array vacío sin repeticiones', () => {
    const feriados = getFeriadosOficiales('2026');
    expect(duplicados(feriados)).toEqual([]);
  });

  it('agregar un feriado con fecha ya existente produce duplicado', () => {
    const originales = getFeriadosOficiales('2026');
    const modificados = [...originales, { fecha: '2026-12-25', nombre: 'Navidad (otra vez)' }];
    expect(tieneDuplicados(modificados)).toBe(true);
    expect(duplicados(modificados)).toEqual([{ fecha: '2026-12-25', nombre: 'Navidad (otra vez)' }]);
  });
});
