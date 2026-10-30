import {describe,it,expect} from 'vitest';
import {legalReadingBlocks,readingPreferences} from '../lib/norm-reading';
describe('legal reading presentation',()=>{
 it('separates consecutive definitions without changing original text',()=>{
 const text='Artículo 4 . Definiciones Para los fines: a) Contratos: acuerdos. b) Subcontratación: relación. c) Compra corporativa: modalidad.';
 const blocks=legalReadingBlocks(text);expect(blocks).toHaveLength(4);expect(blocks.join('')).toBe(text);expect(blocks[2]).toMatch(/^b\)/);
 });
 it('retains all spacing and explicit paragraph breaks',()=>{const text='Primero.\n\n  Segundo.\nTercero.';expect(legalReadingBlocks(text).join('')).toBe(text);expect(legalReadingBlocks(text)).toHaveLength(2);});
 it('does not turn a cited literal into a paragraph',()=>{const text='Según el literal a) Contratos y el artículo 113.1. Garantías.';expect(legalReadingBlocks(text)).toEqual([text]);});
 it('separates consecutive numbered provisions',()=>{const text='Regla 35.1. El área determina. 35.2. La entidad revisa.';expect(legalReadingBlocks(text)).toHaveLength(3);expect(legalReadingBlocks(text).join('')).toBe(text);});
 it('handles empty and nonenumerated text unchanged',()=>{expect(legalReadingBlocks('')).toEqual([]);expect(legalReadingBlocks('Texto original.')).toEqual(['Texto original.']);});
 it('validates stored preferences and bounds font size',()=>{expect(readingPreferences('{')).toEqual({size:18,font:'serif',spacing:'comfortable'});expect(readingPreferences('{"size":900,"font":"x"}').size).toBe(18);expect(readingPreferences('{"size":22,"font":"sans","spacing":"compact"}')).toEqual({size:22,font:'sans',spacing:'compact'});});
});
