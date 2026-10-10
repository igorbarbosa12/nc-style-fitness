/* ============================================================
   MANTER O SUPABASE ATIVO
   O plano grátis do Supabase pausa o projeto depois de 7 dias sem uso.
   Esta função roda sozinha na Netlify a cada 6 horas e faz uma consulta
   pequena no banco, pra ele nunca ficar parado.
   ============================================================ */
const SUPABASE_URL = "https://xblfpqalfxxpnszvcsmy.supabase.co";
const SUPABASE_KEY = "sb_publishable_j5HwtzGoFV8ycSa7Jpcv_g_E5e44L-L"; // a mesma chave pública do js/supabase.js

export default async () => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/produtos?select=id&limit=1`, {
      headers: { apikey: SUPABASE_KEY }
    });
    console.log(`Supabase respondeu ${r.status}`);
  } catch (erro) {
    console.error("Não deu pra falar com o Supabase:", erro);
  }
};

// a cada 6 horas: 3h, 9h, 15h e 21h no horário de Santarém (a Netlify usa o horário UTC)
export const config = { schedule: "0 */6 * * *" };
