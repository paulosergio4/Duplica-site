// =====================================================================
// DUPLICA · telas/index.js
// Lista das telas, na ordem em que aparecem no menu.
// Para criar uma tela nova: copie um arquivo desta pasta, mude o "id",
// "rotulo", "visivel" e "render", e acrescente aqui.
// =====================================================================
import { telaFiscal } from './fiscal.js?v=ca8aa5f';
import { telaFinanceiro } from './financeiro.js?v=ca8aa5f';
import { telaCalendario } from './calendario.js?v=ca8aa5f';
import { telaContasFixas } from './contas-fixas.js?v=ca8aa5f';
import { telaContabilidade } from './contabilidade.js?v=ca8aa5f';
import { telaUsuarios } from './usuarios.js?v=ca8aa5f';
import { telaFiliais } from './filiais.js?v=ca8aa5f';
import { telaRecebimento } from './recebimento.js?v=ca8aa5f';

export const TELAS = [telaFiscal, telaRecebimento, telaFinanceiro, telaCalendario, telaContasFixas, telaContabilidade, telaUsuarios, telaFiliais];

/** Telas que a pessoa logada pode ver */
export const telasDe = (perfil) => TELAS.filter((t) => t.visivel(perfil));

/** Tela que abre ao entrar, conforme o setor */
export function telaInicial(perfil) {
  const preferida = { Fiscal: 'fiscal', Financeiro: 'financeiro', Contabilidade: 'contabilidade', Recebimento: 'receber' }[perfil.setor];
  return telasDe(perfil).find((t) => t.id === preferida)?.id || telasDe(perfil)[0]?.id;
}
