// =====================================================================
// DUPLICA · nucleo/desenhar.js
// desenhar()   → redesenha a tela com o que está no "estado"
// recarregar() → busca de novo os dados no banco e redesenha
// Qualquer arquivo pode importar e chamar essas duas funções.
// =====================================================================
import { estado } from './estado.js?v=795d991';

let _desenhar = () => {};

/** Usado só pelo app.js para dizer qual função desenha a página */
export function definirDesenho(fn) { _desenhar = fn; }

export function desenhar() { _desenhar(); }

export async function recarregar() {
  const dados = await estado.api.carregarTudo();
  Object.assign(estado, dados);
  // atualiza o meu próprio perfil (pode ter mudado)
  estado.perfil = estado.perfis.find((p) => p.id === estado.perfil.id) || estado.perfil;
  _desenhar();
}
