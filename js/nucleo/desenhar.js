// =====================================================================
// DUPLICA · nucleo/desenhar.js
// desenhar()   → redesenha a tela com o que está no "estado"
// recarregar() → busca de novo os dados no banco e redesenha
// Qualquer arquivo pode importar e chamar essas duas funções.
// =====================================================================
import { estado } from './estado.js?v=19141b7';

let _desenhar = () => {};

/** Usado só pelo app.js para dizer qual função desenha a página */
export function definirDesenho(fn) { _desenhar = fn; }

export function desenhar() { _desenhar(); }

/** antesDeDesenhar: promessa opcional que segura o desenho (a busca no banco já corre em paralelo) */
export async function recarregar(antesDeDesenhar) {
  const dados = await estado.api.carregarTudo();
  if (antesDeDesenhar) await antesDeDesenhar;
  Object.assign(estado, dados);
  // atualiza o meu próprio perfil (pode ter mudado)
  estado.perfil = estado.perfis.find((p) => p.id === estado.perfil.id) || estado.perfil;
  _desenhar();
}
