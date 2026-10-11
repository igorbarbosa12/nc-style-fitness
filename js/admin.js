/* ============================================================
   NC Style Fitness — PAINEL ADMIN (login + produtos)
   Vendas e fiado ficam em vendas.js
   Usa: GRUPOS (dados.js) e sb (supabase.js)
   ============================================================ */

/* atalhos de tamanhos e cores no cadastro */
const TAMANHOS_PRONTOS = {
  "P ao GG": ["P","M","G","GG"],
  "PP ao XG": ["PP","P","M","G","GG","XG"],
  "Único": ["Único"],
  "Garrafa": ["500 ml","800 ml","1 L"]
};
const CORES_PRONTAS = [
  ["Preto","#2B2B2B"],["Branco","#F8F6F3"],["Off White","#E8E0D6"],["Rosé","#C48C83"],
  ["Rosa","#D9A5A0"],["Marrom","#6B4A3A"],["Caramelo","#B57A4E"],["Bege","#D8C8B4"],
  ["Cinza","#8A8D90"],["Azul Marinho","#2E3A50"],["Verde Oliva","#6E7350"],["Lilás","#A99BB8"]
];
const ESTOQUE_BAIXO = 2;   // até quantas peças conta como "estoque baixo"

/* ---------- utilidades ---------- */
/* cores: "#000" (lisa) ou "#000,#C48C83" (2 ou 3 cores = bolinha partida) */
const coresDe = h => String(h||"").split(",").map(s=>s.trim()).filter(Boolean);
const primeiraCor = h => coresDe(h)[0] || "#2B2B2B";
function bolinha(h){
  const l=coresDe(h);
  if(l.length<2) return l[0]||"#2B2B2B";
  if(l.length===2) return `linear-gradient(135deg, ${l[0]} 50%, ${l[1]} 50%)`;
  const p=100/l.length;
  return `conic-gradient(${l.map((c,i)=>`${c} ${i*p}% ${(i+1)*p}%`).join(", ")})`;
}

const $ = s => document.querySelector(s);
const reais = v => Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num = v => { const n = parseFloat(String(v??"").replace(/\./g,"").replace(",",".")); return isNaN(n) ? null : n; };
const numCampo = v => { // aceita "159,90" e "159.90"
  const s = String(v??"").trim(); if(!s) return null;
  const n = s.includes(",") ? num(s) : parseFloat(s); return isNaN(n) ? null : n;
};
const formatar = v => v==null ? "" : String(v).replace(".",",");
const duasCasas = v => v==null || v==="" ? "" : formatar(Number(v).toFixed(2));   // 159.9 -> "159,90"
let timerToast;
function toast(msg, erro=false){
  const t=$("#toast"); t.textContent=msg; t.classList.toggle("erro",erro); t.classList.add("on");
  clearTimeout(timerToast); timerToast=setTimeout(()=>t.classList.remove("on"),3200);
}

/* ============================================================
   LOGIN
   ============================================================ */
async function iniciar(){
  const { data:{ session } } = await sb.auth.getSession();
  if(session) entrarNoPainel(); else mostrarLogin();
}
function mostrarLogin(msg=""){
  $("#telaPainel").hidden=true; $("#telaLogin").hidden=false; $("#lErro").textContent=msg;
}
$("#formLogin").addEventListener("submit", async e=>{
  e.preventDefault();
  const b=$("#lBotao"); b.disabled=true; b.textContent="Entrando..."; $("#lErro").textContent="";
  const { error } = await sb.auth.signInWithPassword({ email:$("#lEmail").value.trim(), password:$("#lSenha").value });
  b.disabled=false; b.textContent="Entrar";
  if(error){ $("#lErro").textContent = error.message.includes("Invalid") ? "E-mail ou senha incorretos." : "Não deu pra entrar: "+error.message; return; }
  entrarNoPainel();
});
async function entrarNoPainel(){
  const { data:ehAdmin, error } = await sb.rpc("is_admin");
  if(error || !ehAdmin){ await sb.auth.signOut(); mostrarLogin("Esse usuário não tem acesso ao painel."); return; }
  $("#telaLogin").hidden=true; $("#telaPainel").hidden=false;
  carregarProdutos();
  iniciarAbas();   // vendas.js
}
$("#sair").onclick = async ()=>{ await sb.auth.signOut(); location.reload(); };

/* ============================================================
   LISTA DE PRODUTOS
   ============================================================ */
let produtos=[];
const estoqueTotal = p => (p.variacoes||[]).reduce((s,v)=>s+v.estoque,0);

let custosOk=true;   // false se o SQL 04 ainda não foi rodado
async function carregarProdutos(){
  const [r, c] = await Promise.all([
    sb.from("produtos").select("*, variacoes(*)").order("criado_em",{ascending:false}),
    sb.from("custos").select("variacao_id,custo")
  ]);
  const { data, error } = r;
  if(error){ $("#lista").innerHTML=`<p class="vazio">Erro ao carregar: ${esc(error.message)}</p>`; return; }
  custosOk=!c.error;
  const custo=Object.fromEntries((c.data||[]).map(x=>[x.variacao_id,Number(x.custo)]));
  data.forEach(p=>(p.variacoes||[]).forEach(v=>{ v.custo = custo[v.id] ?? null; }));
  produtos=data; renderResumo(); renderLista();
}
function renderResumo(){
  const ativos=produtos.filter(p=>p.ativo).length;
  const pecas=produtos.reduce((s,p)=>s+estoqueTotal(p),0);
  const esgot=produtos.filter(p=>estoqueTotal(p)===0).length;
  $("#resumo").innerHTML=`
    <div><b>${produtos.length}</b><small>produtos cadastrados</small></div>
    <div><b>${ativos}</b><small>visíveis no site</small></div>
    <div><b>${pecas}</b><small>peças em estoque</small></div>
    <div class="${esgot?"alerta":""}"><b>${esgot}</b><small>esgotados</small></div>`;
}
function seloEstoque(p){
  const t=estoqueTotal(p);
  if(!p.ativo) return `<span class="selo oculto">Escondido</span>`;
  if(t===0) return `<span class="selo zero">Esgotado</span>`;
  if((p.variacoes||[]).some(v=>v.estoque<=ESTOQUE_BAIXO)) return `<span class="selo baixo">${t} peças, acabando</span>`;
  return `<span class="selo ok">${t} peças</span>`;
}
function renderLista(){
  const busca=$("#busca").value.trim().toLowerCase(), g=$("#fGrupo").value, st=$("#fStatus").value;
  let l=produtos.filter(p=>!busca || p.nome.toLowerCase().includes(busca) || p.categoria.toLowerCase().includes(busca));
  if(g) l=l.filter(p=>p.grupo===g);
  if(st==="ativos") l=l.filter(p=>p.ativo);
  if(st==="inativos") l=l.filter(p=>!p.ativo);
  if(st==="esgotados") l=l.filter(p=>estoqueTotal(p)===0);
  if(st==="baixo") l=l.filter(p=>(p.variacoes||[]).some(v=>v.estoque<=ESTOQUE_BAIXO));
  if(st==="semcusto") l=l.filter(p=>(p.variacoes||[]).some(v=>v.custo==null));
  if(!produtos.length){ $("#lista").innerHTML=`<p class="vazio">Nenhum produto ainda. Toque em "+ Novo produto" pra cadastrar o primeiro.</p>`; return; }
  if(!l.length){ $("#lista").innerHTML=`<p class="vazio">Nenhum produto com esse filtro.</p>`; return; }
  $("#lista").innerHTML=l.map(p=>`
    <button class="linha" data-id="${p.id}">
      <div class="thumb">${p.fotos[0]?`<img src="${esc(p.fotos[0])}" alt="" loading="lazy">`:esc(p.nome[0])}</div>
      <div><div class="nome">${esc(p.nome)}</div><small>${esc(p.categoria)}</small>${seloEstoque(p)}</div>
      <div class="dir">${reais(p.preco)}</div>
    </button>`).join("");
}
$("#lista").addEventListener("click",e=>{ const b=e.target.closest("[data-id]"); if(b) abrirEditor(produtos.find(p=>p.id==b.dataset.id)); });
["#busca","#fGrupo","#fStatus"].forEach(s=>$(s).addEventListener("input",renderLista));
$("#fGrupo").innerHTML+=Object.entries(GRUPOS).map(([k,v])=>`<option value="${k}">${v.nome}</option>`).join("");
$("#novoProduto").onclick=()=>abrirEditor(null);

/* ============================================================
   EDITOR DE PRODUTO
   ============================================================ */
let ed=null;   // produto sendo editado

function abrirEditor(p){
  const vars=p?.variacoes||[];
  const cores=[], tams=[], estoque={}, precoTam={}, custoTam={};
  vars.forEach(v=>{
    if(!cores.some(c=>c.nome===v.cor)) cores.push({nome:v.cor,hex:v.cor_hex});
    if(!tams.includes(v.tamanho)) tams.push(v.tamanho);
    estoque[v.cor+"|"+v.tamanho]=v.estoque;
    if(v.preco!=null) precoTam[v.tamanho]=v.preco;
    if(v.custo!=null && custoTam[v.tamanho]==null) custoTam[v.tamanho]=v.custo;
  });
  ordenarTams(tams);
  const custoUnico=vars.find(v=>v.custo!=null)?.custo ?? null;
  ed={ id:p?.id||null, fotos:[...(p?.fotos||[])], fotoCores:{...(p?.foto_cores||{})}, fotosNovas:[], fotosRemovidas:[],
       video:p?.video||"", videoNovo:null, videoAntigo:null,
       cores, tams, estoque, precoTam, custoTam, usarPrecoTam:Object.keys(precoTam).length>0 };

  $("#eTitulo").textContent = p ? "Editar produto" : "Novo produto";
  $("#eNome").value=p?.nome||"";
  $("#eDescricao").value=p?.descricao||"";
  $("#eGrupo").innerHTML=Object.entries(GRUPOS).map(([k,v])=>`<option value="${k}">${v.nome}</option>`).join("");
  $("#eGrupo").value=p?.grupo||"feminino";
  preencherCategorias(p?.categoria);
  $("#ePreco").value=duasCasas(p?.preco);
  $("#ePrecoAntigo").value=duasCasas(p?.preco_antigo);
  $("#eCusto").value=custoUnico!=null?formatar(Number(custoUnico).toFixed(2)):"";
  $("#eCustoCampo").querySelector("span").textContent = custosOk ? "Custo da peça (R$) · só você vê, não aparece no site" : "Custo da peça: rode o SQL 04 no Supabase pra liberar";
  $("#eCusto").disabled=!custosOk;
  $("#eUsarPrecoTam").checked=ed.usarPrecoTam;
  $("#eAtivo").checked=p ? p.ativo : true;
  $("#eNovo").checked=!!p?.novo;
  $("#eMaisVendido").checked=!!p?.mais_vendido;
  $("#eExcluir").hidden=!p;
  $("#eErro").textContent=""; $("#eEnviando").textContent=""; $("#eVideoEnviando").textContent="";
  renderVideo();

  renderFotos(); renderCores(); renderTams(); renderPrecoTam(); renderMatriz();
  $("#editor").hidden=false; document.body.style.overflow="hidden";
  $(".editor-corpo").scrollTop=0;
}
function fecharEditor(){ $("#editor").hidden=true; document.body.style.overflow=""; ed=null; }

function preencherCategorias(atual){
  const cats=GRUPOS[$("#eGrupo").value].cats;
  $("#eCategoria").innerHTML=cats.map(c=>`<option>${esc(c)}</option>`).join("");
  if(atual && cats.includes(atual)) $("#eCategoria").value=atual;
}
$("#eGrupo").addEventListener("change",()=>preencherCategorias());

/* cancelar: apaga fotos enviadas que não foram salvas */
document.querySelectorAll("[data-cancelar]").forEach(b=>b.addEventListener("click",async()=>{
  if(ed?.fotosNovas.length) await apagarFotos(ed.fotosNovas);
  if(ed?.videoNovo) await apagarFotos([ed.videoNovo]);
  fecharEditor();
}));

/* ---------- fotos ---------- */
function renderFotos(){
  $("#eFotos").innerHTML = ed.fotos.length ? ed.fotos.map((u,i)=>`
    <div class="foto"><img src="${esc(u)}" alt="">
      ${i===0?`<span class="capa">Capa</span>`:""}
      <div class="acoes">
        ${i>0?`<button type="button" data-capa="${i}" aria-label="Usar como capa" title="Usar como capa">★</button>`:""}
        <button type="button" data-tirar="${i}" aria-label="Remover foto" title="Remover">✕</button>
      </div>
      <select data-fc="${esc(u)}" aria-label="Cor desta foto">
        <option value="">Todas as cores</option>
        ${ed.cores.map(c=>`<option ${ed.fotoCores[u]===c.nome?"selected":""}>${esc(c.nome)}</option>`).join("")}
      </select>
    </div>`).join("") : `<p class="dica">Sem fotos ainda. No site aparece um desenho provisório.</p>`;
}
$("#eFotos").addEventListener("change",e=>{
  const s=e.target.closest("[data-fc]"); if(!s) return;
  if(s.value) ed.fotoCores[s.dataset.fc]=s.value; else delete ed.fotoCores[s.dataset.fc];
});
$("#eFotos").addEventListener("click",async e=>{
  const capa=e.target.closest("[data-capa]"), tirar=e.target.closest("[data-tirar]");
  if(capa){ const [f]=ed.fotos.splice(+capa.dataset.capa,1); ed.fotos.unshift(f); renderFotos(); }
  if(tirar){
    const [u]=ed.fotos.splice(+tirar.dataset.tirar,1);
    if(ed.fotosNovas.includes(u)){ ed.fotosNovas=ed.fotosNovas.filter(x=>x!==u); apagarFotos([u]); }
    else ed.fotosRemovidas.push(u);
    renderFotos();
  }
});
$("#eArquivo").addEventListener("change",async e=>{
  const arquivos=[...e.target.files]; e.target.value="";
  for(let i=0;i<arquivos.length;i++){
    $("#eEnviando").textContent=`Enviando foto ${i+1} de ${arquivos.length}...`;
    try{
      const url=await enviarFoto(arquivos[i]);
      ed.fotos.push(url); ed.fotosNovas.push(url); renderFotos();
    }catch(err){ toast("Erro ao enviar foto: "+err.message,true); }
  }
  $("#eEnviando").textContent="";
});

/* diminui a foto antes de enviar (máx 1200px), economiza espaço e deixa o site rápido */
async function comprimir(arquivo){
  const img=await createImageBitmap(arquivo);
  const escala=Math.min(1,1200/Math.max(img.width,img.height));
  const c=document.createElement("canvas");
  c.width=Math.round(img.width*escala); c.height=Math.round(img.height*escala);
  c.getContext("2d").drawImage(img,0,0,c.width,c.height);
  let blob=await new Promise(r=>c.toBlob(r,"image/webp",0.82));
  if(!blob || blob.type!=="image/webp") blob=await new Promise(r=>c.toBlob(r,"image/jpeg",0.85));
  return blob;
}
async function enviarFoto(arquivo){
  const blob=await comprimir(arquivo);
  return enviarArquivo(blob,"",blob.type==="image/webp"?"webp":"jpg");
}
async function enviarArquivo(blob,pasta,ext){
  const caminho=`${pasta}${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const { error }=await sb.storage.from(BUCKET).upload(caminho,blob,{contentType:blob.type,cacheControl:"31536000"});
  if(error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
}

/* ---------- vídeo (opcional) ---------- */
function renderVideo(){
  $("#eVideo").innerHTML = ed.video
    ? `<div class="video-prev"><video src="${esc(ed.video)}" muted loop playsinline autoplay></video>
        <button type="button" class="btn contorno" id="eVideoTirar">Remover vídeo</button></div>`
    : `<p class="dica">Sem vídeo.</p>`;
  $("#eVideoTexto").textContent = ed.video ? "Trocar vídeo" : "+ Escolher vídeo";
}
$("#eVideo").addEventListener("click",e=>{
  if(!e.target.closest("#eVideoTirar")) return;
  if(ed.video===ed.videoNovo){ apagarFotos([ed.videoNovo]); ed.videoNovo=null; }   // ainda não tinha sido salvo
  else ed.videoAntigo=ed.video;                                                     // apaga quando salvar
  ed.video=""; $("#eVideoEnviando").textContent=""; renderVideo();
});
$("#eVideoArquivo").addEventListener("change",async e=>{
  const arquivo=e.target.files[0]; e.target.value=""; if(!arquivo) return;
  if(!arquivo.type.startsWith("video/") && !/\.(mp4|mov|m4v|webm)$/i.test(arquivo.name)) return toast("Escolhe um arquivo de vídeo.",true);
  const aviso=$("#eVideoEnviando"), salvar=$("#eSalvar");
  salvar.disabled=true;
  try{
    aviso.textContent="Preparando o vídeo...";
    const blob=await prepararVideo(arquivo,p=>aviso.textContent=`Preparando o vídeo... ${Math.round(p*100)}%`);
    aviso.textContent="Enviando o vídeo...";
    const url=await enviarArquivo(blob,"videos/",blob.type==="video/webm"?"webm":"mp4");
    if(ed.videoNovo) apagarFotos([ed.videoNovo]);      // trocou um vídeo que ainda não tinha sido salvo
    else if(ed.video) ed.videoAntigo=ed.video;          // o vídeo salvo é apagado quando salvar
    ed.video=url; ed.videoNovo=url; renderVideo();
    aviso.textContent=`Vídeo pronto (${(blob.size/1048576).toFixed(1).replace(".",",")} MB). Clique em "Salvar produto".`;
  }catch(err){ aviso.textContent=""; toast(err.message||"Não deu pra enviar o vídeo.",true); }
  finally{ salvar.disabled=false; }
});

/* diminui o vídeo antes de enviar: 720p, sem som, no máximo 15 segundos, em MP4 que abre em qualquer celular.
   Usa a biblioteca Mediabunny (só é baixada quando alguém escolhe um vídeo). */
const VIDEO_MAX_SEG=15;
async function prepararVideo(arquivo,progresso){
  let mb=null;
  try{ mb=await import("https://cdn.jsdelivr.net/npm/mediabunny@1.59.1/dist/bundles/mediabunny.min.mjs"); }catch(e){ console.warn(e); }
  if(mb && typeof VideoEncoder!=="undefined"){
    const input=new mb.Input({ source:new mb.BlobSource(arquivo), formats:mb.ALL_FORMATS });
    const trilha=await input.getPrimaryVideoTrack();
    if(!trilha) throw new Error("Esse arquivo não tem vídeo.");
    const duracao=await input.computeDuration();
    const par=n=>Math.max(2,Math.floor(n/2)*2);
    const deitado=trilha.displayWidth>trilha.displayHeight;
    const lado=deitado ? { height:par(Math.min(720,trilha.displayHeight)) } : { width:par(Math.min(720,trilha.displayWidth)) };
    // MP4 (H.264) abre em qualquer celular; se o navegador não souber gerar, usa WebM (VP9)
    const codec=await mb.getFirstEncodableVideoCodec(["avc","vp9"],{ width:720, height:1280 });
    if(codec){
      const mp4=codec==="avc";
      const output=new mb.Output({ format:mp4 ? new mb.Mp4OutputFormat({ fastStart:"in-memory" }) : new mb.WebMOutputFormat(), target:new mb.BufferTarget() });
      const conversao=await mb.Conversion.init({ input, output,
        video:{ ...lado, codec, quality:new mb.Quality({ bitrate:1500000 }), frameRate:30, forceTranscode:true },
        audio:{ discard:true },
        ...(duracao>VIDEO_MAX_SEG ? { trim:{ start:0, end:VIDEO_MAX_SEG } } : {}) });
      if(conversao.isValid){
        conversao.onProgress=progresso;
        await conversao.execute();
        return new Blob([output.target.buffer],{ type:mp4 ? "video/mp4" : "video/webm" });
      }
      console.warn("Conversão inválida:",conversao.discardedTracks.map(d=>d.reason).join(", "));
    }
  }
  // navegador sem suporte: só envia se o arquivo já for leve
  if(arquivo.size<=8*1048576 && /mp4|webm/.test(arquivo.type)) return arquivo;
  throw new Error("Esse navegador não conseguiu preparar o vídeo. Tenta pelo Chrome, ou exporta o vídeo em 720p (no CapCut, por exemplo) antes de enviar.");
}
async function apagarFotos(urls){
  const caminhos=urls.map(u=>u.split(`/object/public/${BUCKET}/`)[1]).filter(Boolean);
  if(caminhos.length) await sb.storage.from(BUCKET).remove(caminhos);
}

/* ---------- cores ---------- */
function renderCores(){
  if(ed.fotos.length) renderFotos();
  $("#eCores").innerHTML = ed.cores.length ? ed.cores.map((c,i)=>
    `<span class="chip"><i style="background:${bolinha(c.hex)}"></i>${esc(c.nome)}<button type="button" data-i="${i}" aria-label="Remover ${esc(c.nome)}">×</button></span>`).join("")
    : `<p class="dica">Nenhuma cor ainda.</p>`;
  $("#eCoresProntas").innerHTML=CORES_PRONTAS.filter(([n])=>!ed.cores.some(c=>c.nome===n))
    .map(([n,h])=>`<button type="button" class="chip" data-n="${n}" data-h="${h}"><i style="background:${h}"></i>${n}</button>`).join("");
}
function addCor(nome,hex){
  nome=nome.trim(); if(!nome) return;
  if(ed.cores.some(c=>c.nome.toLowerCase()===nome.toLowerCase())){ toast("Essa cor já foi adicionada."); return; }
  ed.cores.push({nome,hex}); renderCores(); renderMatriz();
}
$("#eCores").addEventListener("click",e=>{ const b=e.target.closest("[data-i]"); if(!b) return;
  ed.cores.splice(+b.dataset.i,1); renderCores(); renderMatriz(); });
$("#eCoresProntas").addEventListener("click",e=>{ const b=e.target.closest("[data-n]"); if(b) addCor(b.dataset.n,b.dataset.h); });
/* 2ª e 3ª cor (peça com mais de uma cor) */
function mostrarExtras(n){
  $("#eCorHex2").hidden=n<2; $("#eCorHex3").hidden=n<3;
  $("#eMaisCor").hidden=n>=3; $("#eMaisCor").textContent=n<2?"+ 2ª cor":"+ 3ª cor";
  $("#eMenosCor").hidden=n<2;
}
let extras=1;
$("#eMaisCor").onclick=()=>{ extras=Math.min(3,extras+1); mostrarExtras(extras); };
$("#eMenosCor").onclick=()=>{ extras=Math.max(1,extras-1); mostrarExtras(extras); };
$("#eAddCor").onclick=()=>{
  const hex=[$("#eCorHex").value, extras>=2&&$("#eCorHex2").value, extras>=3&&$("#eCorHex3").value].filter(Boolean).join(",");
  const nome=$("#eCorNome").value;
  if(!nome.trim()){ toast(extras>1?"Dá um nome pra combinação (ex: Preto e Rosé).":"Dá um nome pra cor."); return; }
  addCor(nome,hex); $("#eCorNome").value=""; extras=1; mostrarExtras(1);
};

/* ---------- tamanhos ---------- */
const ORDEM=["PP","P","M","G","GG","XG","XGG","Único"];
function ordenarTams(l){ l.sort((a,b)=>{ const ia=ORDEM.indexOf(a), ib=ORDEM.indexOf(b);
  if(ia>-1&&ib>-1) return ia-ib; const na=parseFloat(a), nb=parseFloat(b);
  if(!isNaN(na)&&!isNaN(nb)) return (a.includes("L")&&!a.includes("ml")?na*1000:na)-(b.includes("L")&&!b.includes("ml")?nb*1000:nb);
  return 0; }); }
function renderTams(){
  $("#eTams").innerHTML = ed.tams.length ? ed.tams.map((t,i)=>
    `<span class="chip">${esc(t)}<button type="button" data-i="${i}" aria-label="Remover ${esc(t)}">×</button></span>`).join("")
    : `<p class="dica">Nenhum tamanho ainda.</p>`;
  $("#eTamsProntos").innerHTML=Object.keys(TAMANHOS_PRONTOS).map(k=>`<button type="button" class="chip" data-k="${k}">${k}</button>`).join("");
}
function addTam(t){ t=t.trim(); if(!t||ed.tams.includes(t)) return; ed.tams.push(t); ordenarTams(ed.tams); renderTams(); renderPrecoTam(); renderMatriz(); }
$("#eTams").addEventListener("click",e=>{ const b=e.target.closest("[data-i]"); if(!b) return;
  ed.tams.splice(+b.dataset.i,1); renderTams(); renderPrecoTam(); renderMatriz(); });
$("#eTamsProntos").addEventListener("click",e=>{ const b=e.target.closest("[data-k]"); if(!b) return;
  TAMANHOS_PRONTOS[b.dataset.k].forEach(t=>{ if(!ed.tams.includes(t)) ed.tams.push(t); });
  ordenarTams(ed.tams); renderTams(); renderPrecoTam(); renderMatriz(); });
$("#eAddTam").onclick=()=>{ addTam($("#eTamNome").value); $("#eTamNome").value=""; };

/* ---------- preço por tamanho ---------- */
function renderPrecoTam(){
  const usar=ed.usarPrecoTam;
  $("#ePrecoCampo").hidden=usar; $("#eCustoCampo").hidden=usar;
  $("#ePrecoTam").innerHTML = !usar ? "" : (ed.tams.length
    ? ed.tams.map(t=>`<div class="preco-tam">
        <b>${esc(t)}</b>
        <label class="campo"><span>Preço (R$)</span><input data-pt="${esc(t)}" inputmode="decimal" value="${duasCasas(ed.precoTam[t])}" placeholder="0,00"></label>
        <label class="campo"><span>Custo (R$)</span><input data-ct="${esc(t)}" inputmode="decimal" value="${ed.custoTam[t]!=null?formatar(Number(ed.custoTam[t]).toFixed(2)):""}" placeholder="opcional" ${custosOk?"":"disabled"}></label>
        <small class="dica" data-mg="${esc(t)}">${textoMargem(ed.precoTam[t],ed.custoTam[t])}</small>
      </div>`).join("")
    : `<p class="dica">Adicione os tamanhos primeiro.</p>`);
  renderMargem();
}
/* "você ganha R$ X por peça (Y%)" */
function textoMargem(preco,custo){
  if(!(preco>0) || custo==null) return "";
  const g=preco-custo;
  if(g<0) return `⚠️ Custo maior que o preço: perde ${reais(-g)} por peça`;
  return `Você ganha ${reais(g)} por peça (${Math.round(g/preco*100)}% do preço)`;
}
function renderMargem(){
  $("#eMargem").textContent = ed.usarPrecoTam ? "" : textoMargem(numCampo($("#ePreco").value), numCampo($("#eCusto").value));
}
["#ePreco","#eCusto"].forEach(s=>$(s).addEventListener("input",()=>{ if(ed) renderMargem(); }));
$("#eUsarPrecoTam").addEventListener("change",e=>{ ed.usarPrecoTam=e.target.checked; renderPrecoTam(); });
$("#ePrecoTam").addEventListener("input",e=>{
  const i=e.target.closest("[data-pt]"), c=e.target.closest("[data-ct]");
  if(i) ed.precoTam[i.dataset.pt]=numCampo(i.value);
  if(c) ed.custoTam[c.dataset.ct]=numCampo(c.value);
  const t=(i||c)?.dataset.pt||(i||c)?.dataset.ct; if(t==null) return;
  const m=[...document.querySelectorAll("#ePrecoTam [data-mg]")].find(x=>x.dataset.mg===t);
  if(m) m.textContent=textoMargem(ed.precoTam[t],ed.custoTam[t]);
});

/* ---------- estoque (cor x tamanho) ---------- */
function renderMatriz(){
  if(!ed.cores.length || !ed.tams.length){ $("#eMatriz").innerHTML=`<p class="dica">Adicione pelo menos uma cor e um tamanho.</p>`; return; }
  const total=t=>ed.cores.reduce((s,c)=>s+(+ed.estoque[c.nome+"|"+t]||0),0);
  $("#eMatriz").innerHTML=`<table class="matriz">
    <thead><tr><th>Cor</th>${ed.tams.map(t=>`<th>${esc(t)}</th>`).join("")}</tr></thead>
    <tbody>${ed.cores.map(c=>`<tr><td><i style="background:${bolinha(c.hex)}"></i>${esc(c.nome)}</td>${ed.tams.map(t=>{
      const k=c.nome+"|"+t; return `<td><input type="number" min="0" inputmode="numeric" data-k="${esc(k)}" value="${ed.estoque[k]??0}" aria-label="${esc(c.nome)} ${esc(t)}"></td>`;}).join("")}</tr>`).join("")}</tbody>
    <tfoot><tr><td>Total</td>${ed.tams.map(t=>`<td data-tot="${esc(t)}">${total(t)}</td>`).join("")}</tr></tfoot></table>`;
}
$("#eMatriz").addEventListener("input",e=>{
  const i=e.target.closest("[data-k]"); if(!i) return;
  ed.estoque[i.dataset.k]=Math.max(0,parseInt(i.value)||0);
  const t=i.dataset.k.split("|")[1];
  const cel=[...document.querySelectorAll("[data-tot]")].find(x=>x.dataset.tot===t);
  if(cel) cel.textContent=ed.cores.reduce((s,c)=>s+(+ed.estoque[c.nome+"|"+t]||0),0);
});
$("#eMatriz").addEventListener("focusin",e=>{ if(e.target.matches("input")) e.target.select(); });

/* ---------- salvar ---------- */
$("#eSalvar").onclick=async()=>{
  const erro=m=>{ $("#eErro").textContent=m; };
  const nome=$("#eNome").value.trim();
  if(!nome) return erro("Coloca o nome do produto.");
  if(!ed.cores.length) return erro("Adiciona pelo menos uma cor.");
  if(!ed.tams.length) return erro("Adiciona pelo menos um tamanho.");
  let preco=numCampo($("#ePreco").value);
  if(ed.usarPrecoTam){
    const faltando=ed.tams.filter(t=>!(ed.precoTam[t]>0));
    if(faltando.length) return erro("Falta o preço de: "+faltando.join(", "));
    preco=Math.min(...ed.tams.map(t=>ed.precoTam[t]));
  } else if(!(preco>0)) return erro("Coloca o preço.");
  const precoAntigo=numCampo($("#ePrecoAntigo").value);
  if(precoAntigo!=null && precoAntigo<=preco) return erro("O preço antigo tem que ser maior que o preço atual.");
  const custoUnico=numCampo($("#eCusto").value);
  const custoDe = t => ed.usarPrecoTam ? (ed.custoTam[t] ?? null) : custoUnico;
  if(ed.tams.some(t=>custoDe(t)!=null && custoDe(t)<0)) return erro("O custo não pode ser negativo.");
  erro("");

  const b=$("#eSalvar"); b.disabled=true; b.textContent="Salvando...";
  try{
    const linha={ nome, descricao:$("#eDescricao").value.trim()||null, grupo:$("#eGrupo").value, categoria:$("#eCategoria").value,
      preco, preco_antigo:precoAntigo, fotos:ed.fotos, video:ed.video||null,
      foto_cores:Object.fromEntries(Object.entries(ed.fotoCores).filter(([u,c])=>ed.fotos.includes(u)&&ed.cores.some(x=>x.nome===c))), ativo:$("#eAtivo").checked, novo:$("#eNovo").checked, mais_vendido:$("#eMaisVendido").checked };
    let id=ed.id;
    if(id){ const { error }=await sb.from("produtos").update(linha).eq("id",id); if(error) throw error; }
    else { const { data, error }=await sb.from("produtos").insert(linha).select("id").single(); if(error) throw error; id=data.id; ed.id=id; }

    const vars=[];
    ed.cores.forEach(c=>ed.tams.forEach(t=>vars.push({ produto_id:id, cor:c.nome, cor_hex:c.hex, tamanho:t,
      estoque:+ed.estoque[c.nome+"|"+t]||0, preco: ed.usarPrecoTam ? ed.precoTam[t] : null })));
    const { data:salvas, error:e2 }=await sb.from("variacoes").upsert(vars,{onConflict:"produto_id,cor,tamanho"}).select("id,tamanho");
    if(e2) throw e2;
    const { error:e3 }=await sb.from("variacoes").delete().eq("produto_id",id).not("id","in",`(${salvas.map(v=>v.id).join(",")})`);
    if(e3) throw e3;

    /* custo de cada peça (tabela separada, só o admin vê) */
    if(custosOk){
      const comCusto=salvas.filter(v=>custoDe(v.tamanho)!=null), semCusto=salvas.filter(v=>custoDe(v.tamanho)==null);
      if(comCusto.length){
        const { error:e4 }=await sb.from("custos").upsert(comCusto.map(v=>({ variacao_id:v.id, custo:custoDe(v.tamanho) })),{onConflict:"variacao_id"});
        if(e4) throw e4;
        await sb.rpc("preencher_custos_antigos");   // vendas antigas sem custo ganham o custo agora
      }
      if(semCusto.length){
        const { error:e5 }=await sb.from("custos").delete().in("variacao_id",semCusto.map(v=>v.id));
        if(e5) throw e5;
      }
    }

    if(ed.fotosRemovidas.length) await apagarFotos(ed.fotosRemovidas);
    if(ed.videoAntigo) await apagarFotos([ed.videoAntigo]);
    ed.fotosNovas=[]; ed.videoNovo=null; ed.videoAntigo=null;
    toast("Produto salvo!");
    fecharEditor(); carregarProdutos();
  }catch(err){
    erro("Não deu pra salvar: "+err.message);
  }finally{ b.disabled=false; b.textContent="Salvar produto"; }
};

/* ---------- excluir ---------- */
$("#eExcluir").onclick=async()=>{
  if(!confirm(`Excluir "${$("#eNome").value}"? Isso apaga o produto, o estoque e as fotos. Não tem como desfazer.\n\nSe só quer tirar do site, desmarque "Mostrar no site".`)) return;
  const { error }=await sb.from("produtos").delete().eq("id",ed.id);
  if(error){ toast("Não deu pra excluir: "+error.message,true); return; }
  await apagarFotos([...ed.fotos,...ed.fotosRemovidas,ed.video,ed.videoAntigo].filter(Boolean));
  toast("Produto excluído."); fecharEditor(); carregarProdutos();
};

// espera todos os arquivos (inclusive vendas.js) carregarem antes de começar
document.addEventListener("DOMContentLoaded", iniciar);

/* ============================================================
   PAINEL COMO APP (ícone na tela inicial do celular)
   Android/computador: aparece o botão "Instalar app" no topo.
   iPhone: Safari > Compartilhar > Adicionar à Tela de Início.
   ============================================================ */
if("serviceWorker" in navigator && location.protocol!=="file:"){
  navigator.serviceWorker.register("sw-painel.js",{ scope:"/admin" }).catch(e=>console.warn("App do painel:",e));
}
let pedidoInstalar=null;
window.addEventListener("beforeinstallprompt",e=>{
  e.preventDefault(); pedidoInstalar=e; $("#instalarApp").hidden=false;
});
$("#instalarApp").onclick=async ()=>{
  if(!pedidoInstalar) return;
  pedidoInstalar.prompt();
  const { outcome }=await pedidoInstalar.userChoice;
  pedidoInstalar=null; $("#instalarApp").hidden=true;
  if(outcome==="accepted") toast("Pronto! O painel vai aparecer na tela inicial.");
};
window.addEventListener("appinstalled",()=>{ pedidoInstalar=null; $("#instalarApp").hidden=true; });
