// =====================================================================
// DUPLICA · telas/index.js
// Lista das telas, na ordem em que aparecem no menu.
// Para criar uma tela nova: copie um arquivo desta pasta, mude o "id",
// "rotulo", "visivel" e "render", e acrescente aqui.
// =====================================================================
import { telaFiscal } from './fiscal.js?v=9b9ec3e';
import { telaFinanceiro } from './financeiro.js?v=9b9ec3e';
import { telaCalendario } from './calendario.js?v=9b9ec3e';
import { telaContasFixas } from './contas-fixas.js?v=9b9ec3e';
import { telaContabilidade } from './contabilidade.js?v=9b9ec3e';
import { telaUsuarios } from './usuarios.js?v=9b9ec3e';
import { telaFiliais } from './filiais.js?v=9b9ec3e';

export const TELAS = [telaFiscal, telaFinanceiro, telaCalendario, telaContasFixas, telaContabilidade, telaUsuarios, telaFiliais];

/** Telas que a pessoa logada pode ver */
export const telasDe = (perfil) => TELAS.filter((t) => t.visivel(perfil));

/** Tela que abre ao entrar, conforme o setor */
export function telaInicial(perfil) {
  const preferida = { Fiscal: 'fiscal', Financeiro: 'financeiro', Contabilidade: 'contabilidade' }[perfil.setor];
  return telasDe(perfil).find((t) => t.id === preferida)?.id || telasDe(perfil)[0]?.id;
}
