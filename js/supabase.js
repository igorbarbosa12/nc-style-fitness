/* NC Style Fitness — CONEXÃO COM O SUPABASE
   Essa chave é a pública (publishable). Pode ficar no site.
   NUNCA coloque aqui a service_role / secret key.
*/
const SUPABASE_URL = "https://xblfpqalfxxpnszvcsmy.supabase.co";
const SUPABASE_KEY = "sb_publishable_j5HwtzGoFV8ycSa7Jpcv_g_E5e44L-L";
const BUCKET = "produtos";   // pasta das fotos no Storage

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
