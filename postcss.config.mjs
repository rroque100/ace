// PostCSS: activa Tailwind v4 vía su plugin oficial.
//
// Importante: el estilado histórico de la app vive en app/styles.css (CSS propio,
// sin directivas de Tailwind). El plugin deja ese archivo pasar sin cambios —solo
// procesa el punto de entrada app/tailwind.css, que carga las capas theme y
// utilities SIN el Preflight global— así ninguna otra página cambia.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
