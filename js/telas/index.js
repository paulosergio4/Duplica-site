// =====================================================================
// DUPLICA · telas/index.js
// Lista das telas, na ordem em que aparecem no menu.
// Para criar uma tela nova: copie um arquivo desta pasta, mude o "id",
// "rotulo", "visivel" e "render", e acrescente aqui.
// =====================================================================
import { telaFiscal } from './fiscal.js?v=a3d7d3b';
import { telaFinanceiro } from './financeiro.js?v=a3d7d3b';
import { telaCalendario } from './calendario.js?v=a3d7d3b';
import { telaContasFixas } from './contas-fixas.js?v=a3d7d3b';
import { telaContabilidade } from './contabilidade.js?v=a3d7d3b';
import { telaUsuarios } from './usuarios.js?v=a3d7d3b';
import { telaFiliais } from './filiais.js?v=a3d7d3b';
import { telaRecebimento } from './recebimento.js?v=a3d7d3b';

export const TELAS = [telaFiscal, telaRecebimento, telaFinanceiro, telaCalendario, telaContasFixas, telaContabilidade, telaUsuarios, telaFiliais];

/** Telas que a pessoa logada pode ver */
export const telasDe = (perfil) => TELAS.filter((t) => t.visivel(perfil));

/** Tela que abre ao entrar, conforme o setor */
export function telaInicial(perfil) {
  const preferida = { Fiscal: 'fiscal', Financeiro: 'financeiro', Contabilidade: 'contabilidade', Recebimento: 'receber' }[perfil.setor];
  return telasDe(perfil).find((t) => t.id === preferida)?.id || telasDe(perfil)[0]?.id;
}
