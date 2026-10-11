/* ============================================================
   NC Style Fitness — PAINEL COMO APP (service worker)
   Só cuida do painel (admin.html). Não guarda nada em cache: o painel
   sempre abre a versão mais nova do site. Sem internet, mostra um aviso
   em vez da tela de erro do navegador.
   ============================================================ */
const SEM_INTERNET = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sem internet | NC Painel</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;
    background:#F6F1EE;color:#2B2B2B;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center}
  div{max-width:340px}
  h1{font-weight:500;font-size:1.3rem;margin:0 0 8px}
  p{color:#7D7370;line-height:1.5;margin:0 0 20px}
  button{height:46px;padding:0 22px;border:0;border-radius:10px;background:#C48C83;color:#fff;font:inherit;font-weight:600}
</style></head>
<body><div>
  <h1>Sem internet</h1>
  <p>O painel precisa de internet pra mostrar as vendas e o estoque. Confira o Wi-Fi ou os dados móveis e tente de novo.</p>
  <button onclick="location.reload()">Tentar de novo</button>
</div></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", e => {
  if (e.request.mode !== "navigate") return;   // fotos, scripts e banco vão direto pra internet
  e.respondWith(
    fetch(e.request).catch(() => new Response(SEM_INTERNET, {
      headers: { "content-type": "text/html; charset=utf-8" }
    }))
  );
});
