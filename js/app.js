/* ============================================================
   FUNCIONAMENTO DO SITE (os dados ficam em dados.js)
   Endereços: site/#feminino, #masculino/Short Masculino, #todos, #p/12 (produto)
   ============================================================ */

/* link de peça que vai no WhatsApp (site/p/12?cor=Preto) vira #p/12/Preto aqui dentro */
const linkPeca = location.pathname.match(/^\/p\/(\d+)\/?$/);
if(linkPeca){
  const cor = new URLSearchParams(location.search).get("cor");
  history.replaceState(null, "", "/#p/" + linkPeca[1] + (cor ? "/" + encodeURIComponent(cor) : ""));
}

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const reais = v => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const precoDe = (p,tam) => p.precos ? p.precos[tam] : p.preco;
const menorPreco = p => p.precos ? Math.min(...Object.values(p.precos)) : p.preco;
const reduz = matchMedia("(prefers-reduced-motion: reduce)").matches;
const linkWhats = txt => `https://wa.me/${WHATSAPP}` + (txt ? `?text=${encodeURIComponent(txt)}` : "");
/* link da peça pra mensagem: o WhatsApp mostra a foto dela (só funciona com o site no ar) */
const linkDaPeca = (id, cor) => /^https?:$/.test(location.protocol)
  ? `${location.origin}/p/${id}${cor ? "?cor=" + encodeURIComponent(cor) : ""}` : "";

/* cores: "#000" (lisa) ou "#000,#C48C83" (2 ou 3 cores = bolinha partida) */
const coresDe = h => String(h||"").split(",").map(s=>s.trim()).filter(Boolean);
const primeiraCor = h => coresDe(h)[0] || "#2B2B2B";
function bolinha(h){
  const l = coresDe(h);
  if(l.length < 2) return l[0] || "#2B2B2B";
  if(l.length === 2) return `linear-gradient(135deg, ${l[0]} 50%, ${l[1]} 50%)`;
  const p = 100/l.length;
  return `conic-gradient(${l.map((c,i)=>`${c} ${i*p}% ${(i+1)*p}%`).join(", ")})`;
}
const tinta = hex => `color-mix(in srgb, ${primeiraCor(hex)} 20%, #F3ECE9)`;
const traco = hex => `color-mix(in srgb, ${primeiraCor(hex)} 65%, #2B2B2B)`;
const desenho = (p,hex) => `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${ICONES[p.cat]||ICONES["Blusa Feminina"]}" fill="none" stroke="${esc(traco(hex))}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
const foto = (url, alt, extra="") => `<img class="fade ${extra}" src="${esc(url)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;

/* fotos da cor escolhida primeiro, depois as gerais (sem cor marcada) */
function fotosDaCor(p, cor){
  const fc = p.fotoCores || {}, todas = p.fotos || [];
  const daCor = todas.filter(u => fc[u] === cor), gerais = todas.filter(u => !fc[u]);
  return daCor.length ? [...daCor, ...gerais] : (gerais.length ? gerais : todas);
}
const esgotado = (p,cor,tam) => (p.esgotado||[]).includes(cor+"|"+tam);
const grupoDe = p => GRUPOS[p.grupo] ? p.grupo : Object.keys(GRUPOS).find(k => GRUPOS[k].cats.includes(p.cat));

/* ---------- card de produto ---------- */
function seloDe(p){
  const off = p.precoAntigo ? Math.round((1 - p.preco/p.precoAntigo)*100) : 0;
  if(p.semEstoque) return `<span class="selo escuro">Esgotado</span>`;
  if(off > 0)      return `<span class="selo off">-${off}%</span>`;
  if(p.poucas)     return `<span class="selo escuro">Últimas peças</span>`;
  if(p.novo)       return `<span class="selo">Novo</span>`;
  return "";
}
function cardHTML(p){
  const c0 = p.cores[0], fotos = fotosDaCor(p, c0[0]);
  const capa = fotos[0] ? foto(fotos[0], p.nome) + (fotos[1] ? foto(fotos[1], "", "alt") : "") : desenho(p, c0[1]);
  const nomes = p.cores.map(c => c[0]).join(", ");
  return `<a class="card${p.semEstoque ? " esgotado" : ""}" href="#p/${p.id}">
    <div class="foto"${fotos[0] ? "" : ` style="background:${esc(tinta(c0[1]))}"`}>${seloDe(p)}${capa}</div>
    <span class="nome">${esc(p.nome)}</span>
    <span class="precos">${p.precoAntigo ? `<s>${reais(p.precoAntigo)}</s>` : ""}${p.precos ? "<small>a partir de</small>" : ""}<span class="preco">${reais(menorPreco(p))}</span></span>
    <span class="cores" role="img" aria-label="${p.cores.length > 1 ? "Cores" : "Cor"}: ${esc(nomes)}">${p.cores.map(c => `<i style="background:${esc(bolinha(c[1]))}"></i>`).join("")}</span>
  </a>`;
}
const esqueletos = n => Array(n).fill(`<div class="card esqueleto" aria-hidden="true"><div class="foto"></div><span class="nome"></span><span class="preco"></span></div>`).join("");

/* ---------- fotos aparecem suavemente quando carregam ---------- */
const marcaFoto = e => { const t = e.target; if(t.tagName === "IMG" && t.classList.contains("fade")) t.classList.add("ok"); };
document.addEventListener("load", marcaFoto, true);
document.addEventListener("error", marcaFoto, true);
function varrerFotos(){ $$("img.fade:not(.ok)").forEach(i => { if(i.complete) i.classList.add("ok"); }); }

/* ---------- faixa de avisos ---------- */
let iAviso = 1;
function trocaAviso(){
  const el = $("#aviso"); el.style.opacity = 0;
  setTimeout(() => { el.textContent = AVISOS[iAviso++ % AVISOS.length]; el.style.opacity = 1; }, reduz ? 0 : 350);
}
if(AVISOS.length){ $("#aviso").textContent = AVISOS[0]; if(AVISOS.length > 1) setInterval(trocaAviso, 4500); }

/* ---------- links, rodapé e números ---------- */
$$("[data-whats]").forEach(a => a.href = linkWhats());
$$(".lkInsta").forEach(a => a.href = INSTAGRAM);
$("#rHorario").textContent = LOJA.horario || "";   $("#rHorario").hidden = !LOJA.horario;
$("#rPagamento").textContent = LOJA.pagamento ? "Pagamento: " + LOJA.pagamento : ""; $("#rPagamento").hidden = !LOJA.pagamento;
$("#rDemo").hidden = !LOJA.demo;
$("#numeros").innerHTML =
  (LOJA.anos ? `<div><b>${esc(LOJA.anos)}</b><span>anos de loja</span></div>` : "") +
  (LOJA.clientes ? `<div><b>${esc(LOJA.clientes)}</b><span>clientes atendidas</span></div>` : "");

/* ---------- áreas e menus ---------- */
$("#areas").innerHTML = Object.entries(GRUPOS).map(([k,g]) => `
  <a class="area-card" href="#${k}">
    <div class="foto">${g.foto ? foto(g.foto, "") : ""}
      <div class="area-rotulo"><b>${esc(g.nome)}</b><span>Ver peças <i aria-hidden="true">→</i></span></div>
    </div>
  </a>`).join("");
$("#menuDesk").innerHTML = Object.entries(GRUPOS).map(([k,g]) => `<a href="#${k}" data-area="${k}">${esc(g.nome)}</a>`).join("")
  + `<a href="#todos" data-area="todos">Ver tudo</a>`;

function renderMenu(){
  const temProduto = c => !carregado || PRODUTOS.some(p => p.cat === c);
  $("#menuLista").innerHTML = Object.entries(GRUPOS).map(([k,g]) =>
    `<h3><a href="#${k}">${esc(g.nome)}</a></h3>` +
    g.cats.filter(temProduto).map(c => `<a class="lk" href="#${k}/${encodeURIComponent(c)}">${esc(c)}</a>`).join("")
  ).join("") +
  `<h3><a href="#todos">Ver tudo</a></h3>` +
  (LOJA.horario ? `<p class="lk" style="border:0;color:var(--suave)">Atendimento: ${esc(LOJA.horario)}</p>` : "") +
  `<a class="btn" href="${linkWhats()}" target="_blank" rel="noopener">Falar no WhatsApp</a>`;
}

/* ---------- abrir e fechar painéis ---------- */
let focoAntes = null;
function abrir(el){
  fecharTudo(); focoAntes = document.activeElement;
  el.classList.add("aberta"); $("#veu").classList.add("aberto"); document.body.style.overflow = "hidden";
  setTimeout(() => el.querySelector("button, a, input")?.focus({preventScroll:true}), 50);
}
function fecharTudo(){
  const tinha = $$(".folha.aberta,.gaveta.aberta");
  tinha.forEach(x => x.classList.remove("aberta"));
  $("#veu").classList.remove("aberto"); document.body.style.overflow = "";
  if(tinha.length && focoAntes && document.contains(focoAntes)) focoAntes.focus({preventScroll:true});
}
$("#veu").addEventListener("click", fecharTudo);
$$("[data-fechar]").forEach(b => b.addEventListener("click", fecharTudo));
document.addEventListener("keydown", e => { if(e.key === "Escape") fecharTudo(); });
$("#abrirMenu").onclick = () => abrir($("#gaveta"));
$("#menuLista").addEventListener("click", e => { if(e.target.closest("a[href^='#']")) fecharTudo(); });

/* ---------- cabeçalho com sombra ao rolar ---------- */
const posicoes = {};
addEventListener("scroll", () => {
  $("#topo").classList.toggle("rolou", scrollY > 4);
  posicoes[location.hash] = scrollY;
}, {passive:true});

/* ---------- seções aparecem ao rolar ---------- */
if(!reduz && "IntersectionObserver" in window){
  document.documentElement.classList.add("anima");
  const io = new IntersectionObserver(es => es.forEach(e => {
    if(e.isIntersecting){ e.target.classList.add("visto"); io.unobserve(e.target); }
  }), {rootMargin:"0px 0px -6% 0px", threshold:0.06});
  $$(".revela").forEach(el => io.observe(el));
}

/* ============================================================
   NAVEGAÇÃO (o botão voltar do celular funciona)
   ============================================================ */
let carregado = false, deuErro = false;
const pilha = [location.hash];
let clique = { hash:null, em:0 };
history.scrollRestoration = "manual";
document.addEventListener("click", e => {
  const a = e.target.closest("a[href^='#']");
  if(a) clique = { hash: new URL(a.href).hash, em: performance.now() };
}, true);

function lerRota(){
  const h = decodeURIComponent(location.hash.slice(1));
  const peca = h.match(/^p\/(\d+)(?:\/(.+))?$/);
  if(peca) return { vista:"produto", id:+peca[1], cor: peca[2] || null };
  const [g, cat] = h.split("/");
  if(g === "todos" || GRUPOS[g]) return { vista:"area", g, cat: cat || null };
  return { vista:"inicio" };
}

function aoMudarEndereco(){
  const h = location.hash;
  const foiClique = clique.hash === h && performance.now() - clique.em < 1500;
  clique.hash = null;
  let voltando = false;
  if(h !== pilha[pilha.length-1]){
    if(!foiClique && pilha.length > 1 && pilha[pilha.length-2] === h){ pilha.pop(); voltando = true; }
    else pilha.push(h);
  }
  const alvo = voltando ? (posicoes[h] || 0) : 0;
  const trocar = () => { fecharTudo(); mostrarVista(); scrollTo(0, alvo); };
  if(document.startViewTransition && !reduz){
    // navegadores novos: a página antiga some e a nova aparece suavemente
    document.startViewTransition(trocar).finished.then(() => { if(alvo) scrollTo(0, alvo); });
  }else{
    trocar();
    if(alvo) requestAnimationFrame(() => scrollTo(0, alvo));
  }
  const titulo = $(lerRota().vista === "inicio" ? ".hero h1" : (lerRota().vista === "area" ? "#aTitulo" : "#pNome"));
  if(titulo && !voltando){ titulo.tabIndex = -1; titulo.focus({preventScroll:true}); }
}
addEventListener("hashchange", aoMudarEndereco);

function mostrarVista(){
  const r = lerRota();
  let vista = r.vista;
  if(vista !== "inicio" && !carregado) vista = "area";        // ainda carregando
  $("#vInicio").hidden = vista !== "inicio";
  $("#vArea").hidden   = vista !== "area";
  $("#vProduto").hidden = vista !== "produto";
  document.body.dataset.vista = vista;
  $$("#menuDesk a").forEach(a => {
    if(r.vista === "area" && a.dataset.area === r.g) a.setAttribute("aria-current","page");
    else a.removeAttribute("aria-current");
  });

  if(r.vista === "inicio"){ document.title = "NC Style Fitness | Do treino ao look casual"; return; }
  if(!carregado){
    $("#aTitulo").textContent = deuErro ? "Ops" : "Carregando…";
    $("#aQtd").textContent = ""; $("#aChips").hidden = true;
    $("#aGrade").innerHTML = deuErro
      ? `<p class="vazio">Não deu pra carregar as peças agora. Tenta atualizar a página.</p>`
      : esqueletos(4);
    return;
  }
  if(r.vista === "area") renderArea(r.g, r.cat);
  else if(!renderPagina(r.id, r.cor)){
    $("#vProduto").hidden = true; $("#vArea").hidden = false;
    $("#aTitulo").textContent = "Peça não encontrada";
    $("#aQtd").textContent = ""; $("#aChips").hidden = true;
    $("#aGrade").innerHTML = `<p class="vazio">Essa peça não está mais no site. <a class="link" href="#todos">Ver todas as peças</a></p>`;
  }
  varrerFotos();
}

/* ---------- área: lista de peças com filtros ---------- */
let areaAtual = { g:null, cat:null };
function renderArea(g, cat){
  const lista = g === "todos" ? PRODUTOS : PRODUTOS.filter(p => GRUPOS[g].cats.includes(p.cat));
  const chips = g === "todos"
    ? Object.entries(GRUPOS).filter(([,v]) => PRODUTOS.some(p => v.cats.includes(p.cat))).map(([k,v]) => [k, v.nome])
    : GRUPOS[g].cats.filter(c => lista.some(p => p.cat === c)).map(c => [c, c]);
  if(cat && !chips.some(c => c[0] === cat)) cat = null;
  const mostra = !cat ? lista
    : g === "todos" ? lista.filter(p => GRUPOS[cat].cats.includes(p.cat))
    : lista.filter(p => p.cat === cat);
  // disponíveis primeiro, esgotados no fim
  mostra.sort((a,b) => a.semEstoque - b.semEstoque);

  $("#aTitulo").textContent = g === "todos" ? "Todas as peças" : GRUPOS[g].nome;
  $("#aQtd").textContent = `${mostra.length} ${mostra.length === 1 ? "peça" : "peças"}`;
  $("#aChips").hidden = chips.length < 2;
  $("#aChips").innerHTML = [["","Todos"], ...chips].map(([v,n]) =>
    `<button class="chip" data-chip="${esc(v)}" aria-pressed="${(cat||"") === v}">${esc(n)}</button>`).join("");
  $("#aGrade").innerHTML = mostra.length ? mostra.map(cardHTML).join("") : `<p class="vazio">Nenhuma peça aqui ainda.</p>`;
  document.title = `${g === "todos" ? "Todas as peças" : GRUPOS[g].nome} | NC Style Fitness`;
  areaAtual = { g, cat };
}
$("#aChips").addEventListener("click", e => {
  const b = e.target.closest("[data-chip]"); if(!b) return;
  const cat = b.dataset.chip || null, g = areaAtual.g;
  history.replaceState(null, "", "#" + g + (cat ? "/" + encodeURIComponent(cat) : ""));
  pilha[pilha.length-1] = location.hash;
  renderArea(g, cat); varrerFotos();
});

/* ---------- página do produto ---------- */
let sel = null, nFotos = 1, galeriaAtual = "";
function renderPagina(id, corPedida){
  const p = PRODUTOS.find(x => x.id === id);
  if(!p) return false;
  const corLivre = p.cores.find(c => c[0] === corPedida)
    || p.cores.find(c => p.tams.some(t => !esgotado(p, c[0], t))) || p.cores[0];
  sel = { p, cor: corLivre, tam: null, qtd: 1 };
  if(p.tams.length === 1 && !esgotado(p, corLivre[0], p.tams[0])) sel.tam = p.tams[0];

  $("#pCat").textContent = p.cat;
  $("#pNome").textContent = p.nome;
  $("#pTamRotulo").textContent = p.precos ? "Tamanho / volume" : "Tamanho";
  $("#pDesc").textContent = p.descricao; $("#pSobre").hidden = !p.descricao;
  $("#pAviso").textContent = "";
  galeriaAtual = ""; renderGaleria(); renderOpcoes();

  // "Você também pode gostar": mesma área primeiro, depois os mais vendidos
  const g = grupoDe(p), viu = new Set([p.id]), rel = [];
  [...PRODUTOS.filter(x => grupoDe(x) === g), ...PRODUTOS.filter(x => x.maisVendido)].forEach(x => {
    if(!viu.has(x.id) && !x.semEstoque && rel.length < 8){ viu.add(x.id); rel.push(x); }
  });
  $("#pRel").innerHTML = rel.map(cardHTML).join("");
  $("#pRelSecao").hidden = !rel.length;
  document.title = `${p.nome} | NC Style Fitness`;
  return true;
}
function renderGaleria(){
  const { p, cor } = sel, fotos = fotosDaCor(p, cor[0]);
  const chave = fotos.join("|") || "desenho" + cor[1];
  if(chave === galeriaAtual) return;
  galeriaAtual = chave;
  const gal = $("#pGaleria");
  gal.innerHTML = fotos.length
    ? fotos.map((f,i) => `<img class="fade" src="${esc(f)}" alt="${esc(p.nome)}, ${esc(cor[0])}, foto ${i+1} de ${fotos.length}" decoding="async">`).join("")
    : `<div class="desenho" style="background:${esc(tinta(cor[1]))}">${desenho(p, cor[1])}</div>`;
  gal.scrollLeft = 0;
  nFotos = Math.max(1, fotos.length);
  $(".pp-galeria").classList.toggle("uma", nFotos < 2);
  $("#pPontos").innerHTML = Array(nFotos).fill("<i></i>").join("");
  marcarFoto(); varrerFotos();
}
const fotoAtual = () => { const g = $("#pGaleria"); return Math.min(nFotos-1, Math.round(g.scrollLeft / (g.clientWidth || 1))); };
function marcarFoto(){
  const i = fotoAtual();
  $("#pContador").textContent = `${i+1} / ${nFotos}`;
  $$("#pPontos i").forEach((d,k) => d.classList.toggle("on", k === i));
}
function irFoto(d){
  const g = $("#pGaleria"), i = (fotoAtual() + d + nFotos) % nFotos;
  g.scrollTo({ left: i * g.clientWidth, behavior: reduz ? "auto" : "smooth" });
}
$("#pGaleria").addEventListener("scroll", () => requestAnimationFrame(marcarFoto), {passive:true});
$("#pGaleria").addEventListener("keydown", e => {
  if(e.key === "ArrowRight"){ e.preventDefault(); irFoto(1); }
  if(e.key === "ArrowLeft"){ e.preventDefault(); irFoto(-1); }
});
$("#pAnt").onclick = () => irFoto(-1);
$("#pProx").onclick = () => irFoto(1);
$("#pVoltar").onclick = () => {
  if(pilha.length > 1) history.back();
  else location.hash = sel ? grupoDe(sel.p) || "todos" : "";
};

function renderOpcoes(){
  const { p, cor, tam, qtd } = sel;
  $("#pPreco").innerHTML = (p.precoAntigo ? `<s>${reais(p.precoAntigo)}</s>` : "")
    + (tam ? reais(precoDe(p, tam)) : (p.precos ? "<small>a partir de </small>" : "") + reais(menorPreco(p)));
  $("#pCorNome").textContent = cor[0];
  $("#pCores").innerHTML = p.cores.map((c,i) =>
    `<button class="cor" data-i="${i}" style="background:${esc(bolinha(c[1]))}" aria-label="${esc(c[0])}" aria-pressed="${c === cor}"></button>`).join("");
  $("#pTams").innerHTML = p.tams.map(t => {
    const fora = esgotado(p, cor[0], t);
    return `<button class="tam" data-t="${esc(t)}" aria-pressed="${t === tam}"${fora ? ` disabled aria-label="${esc(t)}, esgotado"` : ""}>${esc(t)}</button>`;
  }).join("");
  const fora = p.tams.filter(t => esgotado(p, cor[0], t)), tudoFora = fora.length === p.tams.length;
  $("#pTamNota").textContent = tudoFora ? "Esgotado nessa cor. Chama no WhatsApp pra saber quando chega."
    : fora.length ? `${fora.join(", ")} ${fora.length > 1 ? "esgotados" : "esgotado"} nessa cor.` : "";
  $("#pQtd").textContent = qtd;
  $("#adicionar").disabled = tudoFora;
  $("#ppFixoNome").textContent = p.nome;
  $("#ppFixoPreco").textContent = tam ? reais(precoDe(p, tam)) : (p.precos ? "a partir de " : "") + reais(menorPreco(p));
  $("#ppFixoAdd").disabled = tudoFora;
  $("#adicionar").textContent = tudoFora ? "Esgotado nessa cor" : "Adicionar à sacola";
  const link = linkDaPeca(p.id, cor[0]);
  $("#pWhats").href = linkWhats(`Olá! Tenho uma dúvida sobre: ${p.nome} (${cor[0]}${tam ? ", " + tam : ""}).` + (link ? `\n${link}` : ""));
}
$("#pCores").addEventListener("click", e => {
  const b = e.target.closest("[data-i]"); if(!b) return;
  sel.cor = sel.p.cores[+b.dataset.i];
  if(sel.tam && esgotado(sel.p, sel.cor[0], sel.tam)) sel.tam = null;
  if(!sel.tam && sel.p.tams.length === 1 && !esgotado(sel.p, sel.cor[0], sel.p.tams[0])) sel.tam = sel.p.tams[0];
  renderGaleria(); renderOpcoes();
});
$("#pTams").addEventListener("click", e => {
  const b = e.target.closest("[data-t]"); if(!b || b.disabled) return;
  sel.tam = b.dataset.t; $("#pAviso").textContent = ""; renderOpcoes();
});
$("#menos").onclick = () => { if(sel.qtd > 1){ sel.qtd--; renderOpcoes(); } };
$("#mais").onclick  = () => { if(sel.qtd < 20){ sel.qtd++; renderOpcoes(); } };
$("#adicionar").onclick = () => {
  if(!sel.tam){
    $("#pAviso").textContent = "Escolha um tamanho pra continuar.";
    $("#pTams button:not(:disabled)")?.focus();
    return;
  }
  const { p, cor, tam, qtd } = sel, chave = `${p.id}|${cor[0]}|${tam}`, ja = sacola.find(i => i.chave === chave);
  if(ja) ja.qtd += qtd;
  else sacola.push({ chave, id:p.id, nome:p.nome, cor:cor[0], hex:cor[1], tam, qtd, preco:precoDe(p, tam), foto:fotosDaCor(p, cor[0])[0] || "" });
  salvar(); atualizarSacola(true);
  mostrarToast(qtd > 1 ? `${qtd} peças adicionadas` : "Adicionado à sacola");
  sel.qtd = 1; renderOpcoes();
};

/* ---------- aviso "adicionado" ---------- */
let tToast;
function mostrarToast(txt){
  $("#toastTxt").textContent = txt;
  $("#toast").classList.add("mostrar");
  clearTimeout(tToast); tToast = setTimeout(() => $("#toast").classList.remove("mostrar"), 3500);
}
$("#toastVer").onclick = () => { $("#toast").classList.remove("mostrar"); abrirSacola(); };

/* ---------- sacola ---------- */
let sacola = [];
try{ sacola = JSON.parse(localStorage.getItem("ncsf_sacola") || "[]"); if(!Array.isArray(sacola)) sacola = []; }catch(e){ sacola = []; }
function salvar(){ try{ localStorage.setItem("ncsf_sacola", JSON.stringify(sacola)); }catch(e){} }
const totalSacola = () => sacola.reduce((s,i) => s + i.preco*i.qtd, 0);
const qtdSacola = () => sacola.reduce((s,i) => s + i.qtd, 0);
const nomeDo = i => i.nome || PRODUTOS.find(x => x.id === i.id)?.nome || "Produto";
function atualizarSacola(pulo){
  const q = qtdSacola(), c = $("#contador");
  c.hidden = !q; c.textContent = q;
  if(pulo && !reduz){ c.classList.remove("pulo"); void c.offsetWidth; c.classList.add("pulo"); }
  $("#abrirSacola").setAttribute("aria-label", q ? `Abrir sacola, ${q} ${q === 1 ? "item" : "itens"}` : "Abrir sacola");
  $("#barra").classList.toggle("visivel", q > 0);
  document.body.classList.toggle("tem-sacola", q > 0);
  $("#barraQtd").textContent = `Ver sacola (${q} ${q === 1 ? "item" : "itens"})`;
  $("#barraTotal").textContent = reais(totalSacola());
  if(!q){ $("#sItens").innerHTML = `<p class="vazio">Sua sacola está vazia. Escolha uma peça pra começar.</p>`; $("#sFim").hidden = true; return; }
  $("#sFim").hidden = false;
  $("#sItens").innerHTML = sacola.map((i,n) => {
    const p = PRODUTOS.find(x => x.id === i.id);
    const mini = i.foto ? `<img src="${esc(i.foto)}" alt="">` : (p ? desenho(p, i.hex) : "");
    return `<div class="item"><div class="mini"${i.foto ? "" : ` style="background:${esc(tinta(i.hex))}"`}>${mini}</div>
      <div class="info">${esc(nomeDo(i))}<small>${esc(i.cor)} / ${esc(i.tam)}</small></div>
      <div class="lado">${reais(i.preco*i.qtd)}<div class="qtd"><button data-n="${n}" data-d="-1" aria-label="Diminuir">−</button><span>${i.qtd}</span><button data-n="${n}" data-d="1" aria-label="Aumentar">+</button></div></div></div>`;
  }).join("");
  $("#sTotal").textContent = reais(totalSacola());
}
$("#sItens").addEventListener("click", e => {
  const b = e.target.closest("[data-n]"); if(!b) return;
  const i = sacola[+b.dataset.n]; i.qtd += +b.dataset.d;
  if(i.qtd <= 0) sacola.splice(+b.dataset.n, 1);
  salvar(); atualizarSacola();
});
function abrirSacola(){ $("#sAviso").textContent = ""; abrir($("#folhaSacola")); }
$("#abrirSacola").onclick = abrirSacola;
$("#barra").onclick = abrirSacola;
$("#enviar").onclick = () => {
  const nome = $("#sNome").value.trim();
  if(!nome){ $("#sAviso").textContent = "Coloca seu nome pra gente saber quem é."; $("#sNome").focus(); return; }
  let msg = `Olá! Quero fazer um pedido pelo site 🛍️\n\n`;
  sacola.forEach(i => {
    const link = linkDaPeca(i.id, i.cor);
    msg += `• ${i.qtd}x ${nomeDo(i)}\n   ${i.cor} / ${i.tam} = ${reais(i.preco*i.qtd)}\n` + (link ? `   ${link}\n` : "");
  });
  msg += `\n*Total: ${reais(totalSacola())}*\n\nNome: ${nome}`;
  const obs = $("#sObs").value.trim(); if(obs) msg += `\nObs: ${obs}`;
  window.open(linkWhats(msg), "_blank", "noopener");
};

/* ---------- vídeo do destaque ----------
   Só baixa depois que a página carregou, e não baixa em internet fraca,
   no modo economia de dados ou pra quem pediu menos movimento. */
const video = $("#heroVideo"), pausa = $("#heroPausa");
let heroNaTela = true;
const internetFraca = () => { const c = navigator.connection; return !!(c && (c.saveData || /2g$/.test(c.effectiveType || ""))); };
const tocar = () => { if(video.querySelector("source") && heroNaTela && !document.hidden && !video.dataset.pausado) video.play().catch(() => {}); };
function iniciarVideo(){
  if(!video || reduz || internetFraca()) return;
  video.innerHTML = `<source src="${video.dataset.webm}" type="video/webm"><source src="${video.dataset.mp4}" type="video/mp4">`;
  video.addEventListener("playing", () => { video.classList.add("tocando"); pausa.hidden = false; }, { once:true });
  video.load(); tocar();
}
if(video){
  // pausa quando o destaque sai da tela (economiza bateria) e volta quando aparece
  if("IntersectionObserver" in window)
    new IntersectionObserver(([e]) => { heroNaTela = e.isIntersecting; heroNaTela ? tocar() : video.pause(); }).observe(video);
  document.addEventListener("visibilitychange", () => document.hidden ? video.pause() : tocar());
  pausa.onclick = () => {
    const parar = !video.dataset.pausado;
    if(parar){ video.dataset.pausado = "1"; video.pause(); } else { delete video.dataset.pausado; tocar(); }
    pausa.classList.toggle("parado", parar);
    pausa.setAttribute("aria-label", parar ? "Continuar vídeo" : "Pausar vídeo");
  };
  if(document.readyState === "complete") setTimeout(iniciarVideo, 300);
  else addEventListener("load", () => setTimeout(iniciarVideo, 300));
}

/* ---------- números contando quando aparecem ---------- */
function contar(el){
  const m = el.textContent.match(/^(\d+)(.*)$/); if(!m) return;
  const fim = +m[1], resto = m[2], t0 = performance.now(), dur = 1300;
  const passo = t => {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(fim * e) + resto;
    if(p < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}
if(!reduz && "IntersectionObserver" in window && $("#numeros").children.length){
  const io = new IntersectionObserver(es => { if(es[0].isIntersecting){ $$("#numeros b").forEach(contar); io.disconnect(); } }, { threshold:.6 });
  io.observe($("#numeros"));
}

/* ---------- barra fixa da peça (celular) ----------
   aparece quando o botão "Adicionar à sacola" sobe e sai da tela */
$("#pInfoPag span").textContent = LOJA.pagamento ? "Pagamento: " + LOJA.pagamento : "";
$("#pInfoPag").hidden = !LOJA.pagamento;
$("#ppFixoAdd").onclick = () => $("#adicionar").click();
if("IntersectionObserver" in window){
  new IntersectionObserver(([e]) => {
    const mostrar = !e.isIntersecting && e.boundingClientRect.top < 0 && document.body.dataset.vista === "produto";
    $("#ppFixo").classList.toggle("visivel", mostrar);
    document.body.classList.toggle("fixo-on", mostrar);
  }).observe($("#adicionar"));
}

/* ---------- início ---------- */
function renderInicio(){
  const mais = PRODUTOS.filter(p => p.maisVendido && !p.semEstoque);
  const novos = PRODUTOS.filter(p => p.novo && !p.semEstoque);
  $("#trilhoMais").innerHTML = mais.map(cardHTML).join("");
  $("#secMaisVendidos").hidden = !mais.length;
  $("#trilhoNovos").innerHTML = novos.map(cardHTML).join("");
  $("#secNovos").hidden = !novos.length;
  // o botão da foto "Do treino pra rua" leva pra peça que aparece nela
  const look = PRODUTOS.find(p => p.fotos.includes($("#edFoto").getAttribute("src")));
  if(look){
    $("#edLink").href = `#p/${look.id}`;
    $("#edLink").textContent = /^conjunto/i.test(look.cat) ? "Ver esse conjunto" : "Ver a peça da foto";
    const etiqueta = $("#edLook");
    etiqueta.href = `#p/${look.id}`;
    etiqueta.innerHTML = `<span class="look-txt"><small>Na foto</small>${esc(look.nome)}</span><b>${reais(menorPreco(look))}</b><i aria-hidden="true">→</i>`;
    etiqueta.hidden = false;
  }
}

async function iniciarLoja(){
  try{
    await carregarProdutosDoBanco();
    carregado = true;
  }catch(e){
    console.error(e);
    deuErro = true;
    $("#trilhoMais").innerHTML = `<p class="vazio">Não deu pra carregar as peças agora. Tenta atualizar a página.</p>`;
    $("#secNovos").hidden = true;
  }
  if(carregado){
    // tira da sacola o que saiu do site e atualiza preços e nomes
    sacola = sacola.filter(i => PRODUTOS.some(p => p.id === i.id)).map(i => {
      const p = PRODUTOS.find(x => x.id === i.id);
      return { ...i, nome: p.nome, preco: precoDe(p, i.tam) ?? i.preco };
    });
    salvar();
    renderInicio(); renderMenu();
  }
  mostrarVista(); atualizarSacola(); varrerFotos();
}

$("#trilhoMais").innerHTML = esqueletos(4);
$("#trilhoNovos").innerHTML = esqueletos(4);
renderMenu(); mostrarVista(); atualizarSacola(); varrerFotos();
iniciarLoja();
