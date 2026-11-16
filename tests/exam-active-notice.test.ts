import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ExamActiveNotice } from '../app/components/exam-active-notice';

const callbacks = { onContinue: () => {}, onCancel: () => {} };
it('explica el bloqueo por el intento de borradores y ofrece ambas salidas', () => {
  const html = renderToStaticMarkup(createElement(ExamActiveNotice, { count: 72, preview: true, busy: false, ...callbacks }));
  expect(html).toContain('72');
  expect(html).toContain('preguntas en borrador todavía en curso');
  expect(html).toContain('Continuar o finalizar');
  expect(html).toContain('Cancelar intento');
  expect(html).toContain('historial sin calificación');
  expect(html).toContain('id="exam-active-description"');
});
it('no identifica como borrador una práctica de preguntas publicadas', () => {
  const html = renderToStaticMarkup(createElement(ExamActiveNotice, { count: 10, preview: false, busy: false, ...callbacks }));
  expect(html).toContain('10');
  expect(html).not.toContain('en borrador');
});
it('impide solicitar ambas acciones mientras se carga el intento', () => {
  const html = renderToStaticMarkup(createElement(ExamActiveNotice, { count: 72, preview: true, busy: true, ...callbacks }));
  expect(html.match(/disabled=""/g)).toHaveLength(2);
});
