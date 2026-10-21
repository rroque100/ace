import { describe, it, expect } from 'vitest';
import { getFeriadosOficiales } from '../lib/feriados-oficiales/index';

describe('getFeriadosOficiales', () => {
  it('returns 2026 holidays', () => {
    const feriados = getFeriadosOficiales('2026');
    expect(feriados.length).toBeGreaterThan(0);
    expect(feriados[0]).toHaveProperty('fecha');
    expect(feriados[0]).toHaveProperty('nombre');
  });

  it('returns empty array for unknown year', () => {
    expect(getFeriadosOficiales('2030')).toEqual([]);
  });

  it('first feriado of 2026 is Año Nuevo', () => {
    const feriados = getFeriadosOficiales('2026');
    expect(feriados.find(f => f.fecha === '2026-01-01')?.nombre).toBe('Año Nuevo');
  });
});
