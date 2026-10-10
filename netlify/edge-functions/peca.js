/* ============================================================
   PRÉVIA DA PEÇA NO WHATSAPP
   site/p/12?cor=Preto  → página da peça com foto, nome e preço pro WhatsApp ler
   site/p/12/0.jpg      → a foto da prévia (JPG quadrado, que o WhatsApp sempre aceita)
   Roda no servidor da Netlify. O resto do site continua igual.
   ============================================================ */
const SUPABASE_URL = "https://xblfpqalfxxpnszvcsmy.supabase.co";
const SUPABASE_KEY = "sb_publishable_j5HwtzGoFV8ycSa7Jpcv_g_E5e44L-L"; // a mesma chave pública do js/supabase.js
const LOJA = "NC Style Fitness";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const reais = v => Number(v).toLocaleString("pt-BR", { style:"currency", currency:"BRL" }).replace(/\s/g, " ");

export default async (request) => {
  const url = new URL(request.url);
  const foto = url.pathname.match(/^\/p\/(\d+)\/(\d+)\.jpg$/);
  if (foto) return fotoDaPrevia(url, +foto[1], +foto[2]);
  return paginaDaPeca(url);
};

/* ---------- página da peça ---------- */
async function paginaDaPeca(url) {
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
      const escolhida = (cor && fotos.find(f => fc[f] === cor)) || fotos.find(f => !fc[f]) || fotos[0];
      const precos = (p.variacoes || []).map(v => v.preco).filter(v => v != null).map(Number);
      const preco = precos.length ? "a partir de " + reais(Math.min(...precos)) : reais(p.preco);
      const corValida = (p.variacoes || []).some(v => v.cor === cor) ? cor : "";
      const titulo = `${p.nome}${corValida ? ` (${corValida})` : ""} · ${preco}`;
      const desc = (p.descricao || "Peça da NC Style Fitness. Pedido direto pelo WhatsApp.").slice(0, 160);
      const endereco = `${url.origin}/p/${id}${cor ? "?cor=" + encodeURIComponent(cor) : ""}`;

      tags += `
<meta property="og:site_name" content="${LOJA}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(endereco)}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(desc)}">`;
      if (escolhida) {
        const imagem = `${url.origin}/p/${id}/${fotos.indexOf(escolhida)}.jpg`;
        tags += `
<meta property="og:image" content="${imagem}">
<meta property="og:image:secure_url" content="${imagem}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="600">
<meta property="og:image:height" content="600">
<meta property="og:image:alt" content="${esc(p.nome)}">`;
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
}

/* ---------- foto da prévia ----------
   1º: a versão JPG pronta em img/previa (fotos que vieram com o site)
   2º: a Netlify converte a foto pra JPG (fotos que a loja sobe pelo painel)
   3º: a foto original, do jeito que estiver */
async function fotoDaPrevia(url, id, n) {
  try {
    const p = await buscarPeca(id);
    const foto = p?.fotos?.[n];
    if (!foto) return new Response("Foto não encontrada", { status: 404 });

    const local = !/^https?:/.test(foto);
    const caminho = local ? "/" + foto.replace(/^\/+/, "") : foto;
    const tentativas = [];
    if (local) tentativas.push(new URL("/img/previa/" + caminho.split("/").pop().replace(/\.\w+$/, ".jpg"), url));
    tentativas.push(new URL(`/.netlify/images?url=${encodeURIComponent(caminho)}&w=600&h=600&fit=cover&fm=jpg`, url));
    tentativas.push(local ? new URL(caminho, url) : new URL(foto));

    for (const alvo of tentativas) {
      const r = await fetch(alvo);
      const tipo = r.headers.get("content-type") || "";
      if (r.ok && tipo.startsWith("image/")) {
        return new Response(r.body, {
          status: 200,
          headers: { "content-type": tipo, "cache-control": "public, max-age=86400" }
        });
      }
    }
    return new Response("Foto não encontrada", { status: 404 });
  } catch (erro) {
    console.error(erro);
    return new Response("Erro ao carregar a foto", { status: 502 });
  }
}

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
