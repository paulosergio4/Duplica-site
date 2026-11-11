// =====================================================================
// DUPLICA · componentes/icones.js
// Ícones em SVG (desenhados em linha, herdam a cor do texto).
// =====================================================================
const svg = (tam, conteudo, extra = '') =>
  `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${conteudo}</svg>`;

let logoN = 0;

export const ICONE = {
  // logo: "D" com o visto saindo dele (o boleto conferido). Gradiente com id próprio em cada cópia.
  logo: (t = 36) => {
    const n = ++logoN;
    return `<svg class="logo" width="${t}" height="${t}" viewBox="0 0 48 48" aria-hidden="true"><defs>
      <linearGradient id="lg-f${n}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF1EA"/><stop offset="1" stop-color="#DFB6B2"/></linearGradient>
      <linearGradient id="lg-c${n}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#522B5B"/><stop offset="1" stop-color="#A0627F"/></linearGradient></defs>
      <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#lg-f${n})"/>
      <path class="logo-d" pathLength="100" d="M27.6 14.3A10.5 10.5 0 0 0 23.5 13.5h-9v21h9a10.5 10.5 0 0 0 10.3-12.6" fill="none" stroke="#2B124C" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
      <path class="logo-v" pathLength="100" d="M19.4 23.6l4 4L36 13.8" fill="none" stroke="url(#lg-c${n})" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  },
  sair: () => svg(20, '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>'),
  upload: () => svg(18, '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>'),
  busca: () => svg(18, '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', 'stroke="#522B5B"'),
  menu: () => svg(22, '<path d="M4 7h16M4 12h16M4 17h16"/>'),
  fechar: () => svg(18, '<path d="M6 6l12 12M18 6L6 18"/>'),
  check: () => svg(18, '<path d="M20 6L9 17l-5-5"/>', 'stroke-width="2.4"'),
  imagem: () => svg(24, '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>', 'stroke="#FBE4D8"'),
  anexo: () => svg(22, '<path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>'),
};
