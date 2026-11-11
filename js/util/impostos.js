// =====================================================================
// DUPLICA · util/impostos.js
// Calendário de impostos de uma empresa do LUCRO REAL (comércio varejista
// / supermercado em Minas Gerais). Só as DATAS são previstas aqui: o VALOR
// de cada imposto só existe depois que a contabilidade apura e gera a guia.
//
// Cada item:
//   dia     → dia do vencimento no mês seguinte ao da competência
//             ('ultimo' = último dia útil do mês)
//   ajuste  → se cair em sábado, domingo ou feriado nacional:
//             'antes' = antecipa para o dia útil anterior (federais)
//             'depois' = passa para o próximo dia útil (ICMS/MG)
//   porLoja → true: uma guia por loja (cada inscrição estadual)
//             false: uma guia só, no CNPJ matriz (final 0001)
// CONFIRA COM O CONTADOR: prazos mudam por decreto e alguns dependem do
// enquadramento da empresa (ex.: IRPJ/CSLL mensal por estimativa ou trimestral).
// =====================================================================
export const IMPOSTOS_LUCRO_REAL = [
  { id: 'icms', nome: 'ICMS próprio', guia: 'DAE', orgao: 'SEFAZ-MG', esfera: 'Estadual', dia: 8, ajuste: 'depois', porLoja: true,
    obs: 'Apuração débito e crédito do mês anterior. Varejo e supermercados: dia 8 (RICMS/MG 2023, art. 112).' },
  { id: 'inss', nome: 'INSS (folha)', guia: 'DARF · DCTFWeb', orgao: 'Receita Federal', esfera: 'Federal', dia: 20, ajuste: 'antes', porLoja: false,
    obs: 'Contribuição previdenciária da empresa e dos empregados.' },
  { id: 'irrf', nome: 'IRRF (salários e serviços)', guia: 'DARF · DCTFWeb', orgao: 'Receita Federal', esfera: 'Federal', dia: 20, ajuste: 'antes', porLoja: false,
    obs: 'Imposto de renda retido na fonte.' },
  { id: 'csrf', nome: 'PIS/COFINS/CSLL retidos de terceiros', guia: 'DARF · DCTFWeb', orgao: 'Receita Federal', esfera: 'Federal', dia: 20, ajuste: 'antes', porLoja: false,
    obs: 'Retenções sobre serviços tomados (código 5952), quando houver.' },
  { id: 'fgts', nome: 'FGTS', guia: 'Guia FGTS Digital', orgao: 'FGTS Digital', esfera: 'Federal', dia: 20, ajuste: 'antes', porLoja: false,
    obs: 'Depósito do FGTS dos empregados.' },
  { id: 'pis', nome: 'PIS (não cumulativo)', guia: 'DARF', orgao: 'Receita Federal', esfera: 'Federal', dia: 25, ajuste: 'antes', porLoja: false,
    obs: 'Alíquota de 1,65% sobre o faturamento, com créditos.' },
  { id: 'cofins', nome: 'COFINS (não cumulativa)', guia: 'DARF', orgao: 'Receita Federal', esfera: 'Federal', dia: 25, ajuste: 'antes', porLoja: false,
    obs: 'Alíquota de 7,6% sobre o faturamento, com créditos.' },
  { id: 'irpj', nome: 'IRPJ (estimativa mensal)', guia: 'DARF', orgao: 'Receita Federal', esfera: 'Federal', dia: 'ultimo', ajuste: 'antes', porLoja: false,
    obs: 'Se a empresa apura por trimestre, a guia vem só em jan, abr, jul e out.' },
  { id: 'csll', nome: 'CSLL (estimativa mensal)', guia: 'DARF', orgao: 'Receita Federal', esfera: 'Federal', dia: 'ultimo', ajuste: 'antes', porLoja: false,
    obs: 'Acompanha o IRPJ (mensal ou trimestral).' },
];

/** Impostos sem dia fixo: aparecem só como lembrete */
export const IMPOSTOS_EVENTUAIS = [
  { nome: 'ICMS ST / antecipação / DIFAL', guia: 'DAE', quando: 'Na entrada de mercadoria de outro estado, conforme a nota.' },
  { nome: 'ISS retido de serviços tomados', guia: 'Guia da prefeitura', quando: 'Quando contratar serviço com retenção; prazo da prefeitura.' },
  { nome: 'IPTU', guia: 'Carnê da prefeitura', quando: 'Anual (à vista ou parcelado), por imóvel.' },
  { nome: 'Alvará / taxa de fiscalização e vigilância sanitária', guia: 'Guia da prefeitura', quando: 'Anual, por loja.' },
  { nome: 'IPVA e licenciamento dos veículos', guia: 'DAE', quando: 'Anual, conforme o final da placa.' },
  { nome: 'Contribuição sindical patronal / taxas de conselho', guia: 'Boleto', quando: 'Anual, se a empresa optar ou for obrigada.' },
];

const FERIADOS = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'];   // nacionais de data fixa
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const util = (d) => d.getDay() !== 0 && d.getDay() !== 6 && !FERIADOS.includes(iso(d).slice(5));

/** Vencimento do imposto no mês (ano, mes 0-11) em que ele é PAGO, já no dia útil certo */
export function vencimentoImposto(imp, ano, mes) {
  const ultimo = new Date(ano, mes + 1, 0, 12).getDate();
  const d = new Date(ano, mes, imp.dia === 'ultimo' ? ultimo : Math.min(imp.dia, ultimo), 12);
  const passo = imp.ajuste === 'depois' ? 1 : -1;
  while (!util(d)) d.setDate(d.getDate() + passo);
  return iso(d);
}

/** Competência (mês anterior ao do pagamento): "10/2026" */
export function competenciaDe(ano, mes) {
  const d = new Date(ano, mes - 1, 1, 12);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
