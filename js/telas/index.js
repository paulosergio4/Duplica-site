// =====================================================================
// DUPLICA · telas/index.js
// Lista das telas, na ordem em que aparecem no menu.
// Para criar uma tela nova: copie um arquivo desta pasta, mude o "id",
// "rotulo", "visivel" e "render", e acrescente aqui.
// =====================================================================
import { telaFiscal } from './fiscal.js?v=543c57a';
import { telaFinanceiro } from './financeiro.js?v=543c57a';
import { telaCalendario } from './calendario.js?v=543c57a';
import { telaContasFixas } from './contas-fixas.js?v=543c57a';
import { telaContabilidade } from './contabilidade.js?v=543c57a';
import { telaUsuarios } from './usuarios.js?v=543c57a';
import { telaFiliais } from './filiais.js?v=543c57a';
import { telaRecebimento } from './recebimento.js?v=543c57a';

export const TELAS = [telaFiscal, telaRecebimento, telaFinanceiro, telaCalendario, telaContasFixas, telaContabilidade, telaUsuarios, telaFiliais];

/** Telas que a pessoa logada pode ver */
export const telasDe = (perfil) => TELAS.filter((t) => t.visivel(perfil));

/** Tela que abre ao entrar, conforme o setor */
export function telaInicial(perfil) {
  const preferida = { Fiscal: 'fiscal', Financeiro: 'financeiro', Contabilidade: 'contabilidade', Recebimento: 'receber' }[perfil.setor];
  return telasDe(perfil).find((t) => t.id === preferida)?.id || telasDe(perfil)[0]?.id;
}
