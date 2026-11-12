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

// Leitor de código de barras da Scandit (câmera do celular). Chave do painel
  // ssl.scandit.com. Vazio = usa o leitor próprio (mais simples). A chave de
  // teste vale até 12/12/2026; depois disso o Duplica volta sozinho ao leitor próprio.
  SCANDIT_KEY: 'Ar74eB+oN0GBDrF5HfmMd2whXHRbJRuq9R9lqrguSAyEXSbRa2kl2o96H0ypHTIc609IFU1KbAIZeLVgVVTZeMBLskiWcS1FxF+MePAuYiU2IbanXwM/MBAuwXtgfhJOvmC8wMhNpGShQchprV7Kx19mz1adFTiqa0yk62BpQtFOfjh/An6DbHJBKbF2RVfpF0agLhhktYaIaeKVGmCjgGxhnTaAayMhH17GBXdH1R9QUHpKoUuYSrl0w0usXheMwU2TgNZqHvq8Z6fiKH7PFFZK+QUTWXsB/kX0asZJOP61auY7bHSVYaBUS3WvV6DXFmxndJl0n4HEbU2NO0VUUXtT/wKkNiYp2FsEGz9NeqilOM5+7QdKdDp5WyPKbfhwcXGe+8RtlA7BeubMwWu8CExrKZS2WCPab3xX/1txy/YnWEVtG0jKcVR2Gk1IUXwNv1j2fdh7tmq7OjN2omLYgltfaS9udiiG2X1TP6Z8tITneubgTw8LTDBBx5H6Q7PYJg1Utude6wswEzAITh+jlKYOlhNY4fuIjywJfJ7v898QGO62nwlwWwg+kwd9+4iCD3WbVb6SyO92aJ93gNcKmYMjBBz/bROi/iHYgcaSyVw5eTxz8y5YUc6Qh1WnjjpThQdk9pU3idOqaY9c4TZe/RmyFQwbJdIPin3tzpBvQBQDrVhY+zCl84Zh47E1GZjToZ5TQDtLkYCSX+oSl72sLUw5HP6wMMZJlNVocHYTQOxdv2fZylV5c15FvT2XWYndB/hujvZJBOt+EgnDQ9aIYKC8RZY8rmpUnfxI5d0+Q8+4ifjo1Bdurks5NNH8rLUF9qxVlAzfhcWz4VLvWex5PLTNz1/g9pDo/T3JdimmD3PeTCwh2hUWLSaIVMrG6kNaDpBugYXO1Od4OXL2uAiz2b1kaatMcjMXjGTSAdTgL8b8nTFBwq9JcPQpLuffAbE2bj8RJ1QQL6Im7USJjXjeUJma29WwHUHLqpJ9TgQiIXe9EPt6okWA0lFDakKUpsBFWRTnp9/EiBbSvvN9dqqqqejCv9jLoyQ56VKyYMsw8huB2rBcD9t+sDmHOkgwb6e240rxaTgw9ryYFpa4eXcT4Xf86vdKXSGMUogAPp1eoy9iuSKvpoBz1hxbfgwOBKuZ6m9Ebksm67vj4AfRM2fVjRB457bANR5XtLvJmYKIulW286kfmG9mPiijyqCnXxSSYld0xQ==',
};

export const MODO_DEMO = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;
