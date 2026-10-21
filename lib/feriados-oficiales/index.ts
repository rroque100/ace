import feriados2026 from './2026.json';
import feriados2027 from './2027.json';

interface FeriadoOficial {
  fecha: string;
  nombre: string;
}

const DATA: Record<string, FeriadoOficial[]> = {
  '2026': feriados2026 as FeriadoOficial[],
  '2027': feriados2027 as FeriadoOficial[],
};

export function getFeriadosOficiales(year: string): FeriadoOficial[] {
  return DATA[year] ?? [];
}
