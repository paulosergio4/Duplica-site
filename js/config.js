// =====================================================================
// DUPLICA · config.js
// O ÚNICO arquivo que você precisa editar para ligar o sistema ao banco.
//
// 1. No Supabase, abra: Project Settings → API
// 2. Copie "Project URL" para SUPABASE_URL
// 3. Copie a chave "anon public" para SUPABASE_ANON_KEY
//    (essa chave pode ficar no site; a segurança está nas regras do banco)
//
// Enquanto os dois campos estiverem vazios, o sistema roda em
// MODO DEMONSTRAÇÃO: dados de exemplo salvos só no seu navegador.
// =====================================================================

export const CONFIG = {
  SUPABASE_URL: 'https://tnksiwxtdgqypgnlfhzl.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRua3Npd3h0ZGdxeXBnbmxmaHpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyNjc1MDIsImV4cCI6MjEwOTg0MzUwMn0.48EZu9IuD6HCcyC9VNoH42_ieA6dPvgHrFkHxmcGgGU',

  // O login é "empresa + usuário". Por baixo, o Supabase usa um e-mail
  // montado assim: usuario@codigoempresa.<DOMINIO_LOGIN>  (ninguém recebe e-mail)
  DOMINIO_LOGIN: 'duplica.app',

  // Quantos dias antes do vencimento um boleto que não chegou vira "Atenção"
  DIAS_ATENCAO: 5,

  // Suporte do Duplica (aparece na página de cadastro e quando o teste grátis
  // termina). WhatsApp só com números, com DDI e DDD: '5537999999999'.
  SUPORTE_WHATSAPP: '',
  SUPORTE_EMAIL: '',
};

export const MODO_DEMO = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;
