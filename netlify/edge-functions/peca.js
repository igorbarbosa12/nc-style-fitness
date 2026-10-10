/* ============================================================
   PRÉVIA DA PEÇA NO WHATSAPP
   Quando alguém abre (ou o WhatsApp lê) site/p/12?cor=Preto,
   esta função coloca a foto, o nome e o preço daquela peça no HTML.
   Ela roda no servidor da Netlify. O resto do site continua igual.
   ============================================================ */
const SUPABASE_URL = "https://xblfpqalfxxpnszvcsmy.supabase.co";
const SUPABASE_KEY = "sb_publishable_j5HwtzGoFV8ycSa7Jpcv_g_E5e44L-L"; // a mesma chave pública do js/supabase.js
const LOJA = "NC Style Fitness";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const reais = v => Number(v).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });

export default async (request) => {
  const url = new URL(request.url);
  const id = Number(url.pathname.split("/")[2]);
  const cor = url.searchParams.get("cor") || "";
  try {
    const pagina = await fetch(new URL("/", url));
    let html = await pagina.text();
    // os arquivos do site (css, js, img) são procurados a partir da raiz
    let tags = `<base href="/">`;

    const p = Number.isInteger(id) && id > 0 ? await buscarPeca(id) : null;
    if (p) {
      const fotos = p.fotos || [], fc = p.foto_cores || {};
      // mesma regra do site: foto da cor escolhida, senão as gerais, senão a primeira
      const foto = (cor && fotos.find(f => fc[f] === cor)) || fotos.find(f => !fc[f]) || fotos[0];
      const precos = (p.variacoes || []).map(v => v.preco).filter(v => v != null).map(Number);
      const preco = precos.length ? "a partir de " + reais(Math.min(...precos)) : reais(p.preco);
      const corValida = (p.variacoes || []).some(v => v.cor === cor) ? cor : "";
      const titulo = `${p.nome}${corValida ? ` (${corValida})` : ""} · ${preco}`;
      const desc = (p.descricao || "Peça da NC Style Fitness. Pedido direto pelo WhatsApp.").slice(0, 160);
      const endereco = `${url.origin}/p/${id}${cor ? "?cor=" + encodeURIComponent(cor) : ""}`;

      tags += `
<meta property="og:site_name" content="${LOJA}">
<meta property="og:type" content="product">
<meta property="og:url" content="${esc(endereco)}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(desc)}">`;
      if (foto) {
        // o WhatsApp não garante WebP: a Netlify converte a foto pra JPG quadrado
        const origem = /^https?:/.test(foto) ? foto : "/" + foto.replace(/^\/+/, "");
        const imagem = `${url.origin}/.netlify/images?url=${encodeURIComponent(origem)}&w=600&h=600&fit=cover&fm=jpg`;
        tags += `
<meta property="og:image" content="${esc(imagem)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="600">
<meta property="og:image:height" content="600">
<meta property="og:image:alt" content="${esc(p.nome)}">
<meta name="twitter:card" content="summary_large_image">`;
      }
      html = html
        .replace(/\s*<meta (?:property|name)="(?:og|twitter):[^>]*>/g, "")
        .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(p.nome)} | ${LOJA}</title>`)
        .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(desc)}">`);
    }

    // entra logo depois do <meta charset>, que precisa ficar no começo do arquivo
    html = /<meta charset[^>]*>/i.test(html)
      ? html.replace(/<meta charset[^>]*>/i, m => m + "\n" + tags)
      : html.replace("<head>", "<head>\n" + tags);
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=0, must-revalidate" }
    });
  } catch (erro) {
    console.error(erro);
    // se algo der errado, abre a peça do jeito normal (sem a prévia)
    return Response.redirect(new URL(`/#p/${Number.isInteger(id) ? id : ""}`, url), 302);
  }
};

async function buscarPeca(id) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/produtos?id=eq.${id}&ativo=eq.true&select=nome,descricao,preco,fotos,foto_cores,variacoes(preco,cor)`,
    { headers: { apikey: SUPABASE_KEY } }
  );
  if (!r.ok) return null;
  const [p] = await r.json();
  return p || null;
}

export const config = { path: "/p/*" };
