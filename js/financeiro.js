/* ============================================================
   NC Style Fitness — PAINEL: CAIXA (FINANCEIRO) E RESUMO
   Usa: admin.js ($, reais, esc, numCampo, formatar, toast, produtos,
   estoqueTotal, ESTOQUE_BAIXO, custosOk) e vendas.js (abrirModal, fecharModal,
   hojeISO, nomeDoDia, carregarClientes, clientes, abrirFicha)
   ============================================================ */

/* categorias pra escolher no lançamento (dá pra mudar aqui) */
const CATEGORIAS = {
  saida:   ["Fornecedor / mercadoria","Frete","Anúncio","Embalagem","Taxa de cartão"],
  entrada: ["Outra venda","Dinheiro próprio"]
};
/* cores do gráfico (testadas pra daltonismo e contraste) */
const COR_ENTRADA = "#2774A8";
const COR_SAIDA   = "#C8654F";

/* ---------- datas (a coluna "data" do caixa é só dia, sem hora) ---------- */
const diaLocal = s => new Date(s+"T12:00:00");                       // evita cair no dia anterior
const mesISO = (y,m) => `${y}-${String(m).padStart(2,"0")}`;          // m = 1..12
function limitesMes(valorMes, mesesAntes=0){
  const [y,m]=valorMes.split("-").map(Number);
  const ini=new Date(y, m-1-mesesAntes, 1), fim=new Date(y, m, 1);
  const f=d=>d.toLocaleDateString("sv-SE");
  return { ini:f(ini), fim:f(fim), iniTS:ini.toISOString(), fimTS:fim.toISOString() };
}
const nomeMes = (y,m,longo=false) => {
  const s=new Date(y,m-1,1).toLocaleDateString("pt-BR",{month:longo?"long":"short"}).replace(".","");
  return s.charAt(0).toUpperCase()+s.slice(1);
};
const reaisCurto = v => {
  const a=Math.abs(v);
  if(a>=1000) return "R$ "+(v/1000).toLocaleString("pt-BR",{maximumFractionDigits:1})+" mil";
  return "R$ "+Math.round(v).toLocaleString("pt-BR");
};
const somar = l => l.reduce((s,x)=>s+Number(x.valor),0);

/* ============================================================
   ABA CAIXA
   ============================================================ */
let movsMes=[];
async function carregarCaixa(){
  if(!$("#cxMes").value) $("#cxMes").value=hojeISO().slice(0,7);
  const { ini, fim }=limitesMes($("#cxMes").value);
  const { data, error }=await sb.from("movimentacoes").select("*")
    .gte("data",ini).lt("data",fim).order("data",{ascending:false}).order("id",{ascending:false});
  if(error){ $("#cxLista").innerHTML=`<p class="vazio">Erro ao carregar: ${esc(error.message)}</p>`; return; }
  movsMes=data; renderCaixa();
}
$("#cxMes").addEventListener("change",carregarCaixa);
["#cxBusca","#cxTipo"].forEach(s=>$(s).addEventListener("input",renderCaixa));

function renderCaixa(){
  const ent=somar(movsMes.filter(m=>m.tipo==="entrada")), sai=somar(movsMes.filter(m=>m.tipo==="saida"));
  const saldo=ent-sai;
  $("#cxResumo").innerHTML=`
    <div><b>${reais(ent)}</b><small>entrou</small></div>
    <div><b>${reais(sai)}</b><small>saiu</small></div>
    <div class="${saldo<0?"alerta":""}"><b>${saldo<0?"− ":""}${reais(Math.abs(saldo))}</b><small>${saldo<0?"faltou no mês":"sobrou no mês"}</small></div>`;

  const q=$("#cxBusca").value.trim().toLowerCase(), t=$("#cxTipo").value;
  let l=movsMes;
  if(t) l=l.filter(m=>m.tipo===t);
  if(q) l=l.filter(m=>(m.categoria+" "+(m.descricao||"")).toLowerCase().includes(q));
  if(!movsMes.length){ $("#cxLista").innerHTML=`<p class="vazio">Nada no caixa nesse mês ainda. Vendas à vista e pagamentos de fiado entram sozinhos. Gastos você lança no "+ Saída".</p>`; return; }
  if(!l.length){ $("#cxLista").innerHTML=`<p class="vazio">Nada com esse filtro.</p>`; return; }

  let html="", dia="";
  l.forEach(m=>{
    const d=nomeDoDia(diaLocal(m.data));
    if(d!==dia){ html+=`<h3 class="dia">${d}</h3>`; dia=d; }
    const auto=m.venda_id||m.pagamento_id, ent=m.tipo==="entrada";
    html+=`<button class="linha-mov" data-mov="${m.id}">
      <span class="hist-ico ${ent?"pago":"fiado"}" aria-hidden="true">${ent?"+":"−"}</span>
      <div><div class="nome">${esc(m.categoria)}</div><small>${esc(m.descricao||"")}${auto?`${m.descricao?" · ":""}automático`:""}</small></div>
      <b class="${ent?"val-ent":"val-sai"}">${ent?"+":"−"} ${reais(m.valor)}</b>
    </button>`;
  });
  $("#cxLista").innerHTML=html;
}
$("#cxLista").addEventListener("click",e=>{
  const b=e.target.closest("[data-mov]"); if(!b) return;
  const m=movsMes.find(x=>x.id==b.dataset.mov);
  if(m.venda_id){ toast("Entrou sozinho pela venda. Pra mudar, cancele a venda na aba Vendas."); return; }
  if(m.pagamento_id){ toast("Entrou sozinho pelo fiado. Pra mudar, desfaça o pagamento na ficha do cliente."); return; }
  abrirLancamento(m.tipo, m);
});

/* ---------- lançar entrada / saída ---------- */
let lanc=null;   // {tipo, cat, id}
function abrirLancamento(tipo, mov=null){
  lanc={ tipo, cat:mov?.categoria||null, id:mov?.id||null };
  $("#lValor").value=mov?formatar(Number(mov.valor).toFixed(2)):"";
  $("#lDesc").value=mov?.descricao||"";
  $("#lData").value=mov?.data||hojeISO(); $("#lData").max=hojeISO();
  $("#lErro").textContent=""; $("#lExcluir").hidden=!mov;
  if(mov && !CATEGORIAS[tipo].includes(mov.categoria)){ lanc.cat="__outra"; $("#lOutra").value=mov.categoria; } else $("#lOutra").value="";
  renderLancamento(); abrirModal("#mLanc");
  if(!mov) setTimeout(()=>$("#lValor").focus(),50);
}
function renderLancamento(){
  const editando=!!lanc.id;
  $("#mLancTit").textContent=(editando?"Editar ":"Nova ")+(lanc.tipo==="saida"?"saída":"entrada");
  document.querySelectorAll("#lTipo [data-tipo]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.tipo===lanc.tipo));
  $("#lCats").innerHTML=[...CATEGORIAS[lanc.tipo],"__outra"].map(c=>
    `<button type="button" class="chip forma" data-cat="${esc(c)}" aria-pressed="${c===lanc.cat}">${c==="__outra"?"Outra categoria...":esc(c)}</button>`).join("");
  $("#lOutraCampo").hidden=lanc.cat!=="__outra";
}
$("#lTipo").addEventListener("click",e=>{
  const b=e.target.closest("[data-tipo]"); if(!b) return;
  if(lanc.tipo!==b.dataset.tipo){ lanc.tipo=b.dataset.tipo; lanc.cat=null; }
  renderLancamento();
});
$("#lCats").addEventListener("click",e=>{
  const b=e.target.closest("[data-cat]"); if(!b) return;
  lanc.cat=b.dataset.cat; renderLancamento(); $("#lErro").textContent="";
  if(lanc.cat==="__outra") $("#lOutra").focus();
});
$("#novaSaida").onclick=()=>abrirLancamento("saida");
$("#novaEntrada").onclick=()=>abrirLancamento("entrada");

$("#lSalvar").onclick=async()=>{
  const erro=m=>{ $("#lErro").textContent=m; };
  const valor=numCampo($("#lValor").value);
  if(!(valor>0)) return erro("Coloca o valor.");
  if(!lanc.cat) return erro("Escolhe a categoria.");
  const categoria = lanc.cat==="__outra" ? $("#lOutra").value.trim() : lanc.cat;
  if(!categoria) return erro("Escreve qual é a categoria.");
  if(!$("#lData").value) return erro("Escolhe a data.");
  const linha={ tipo:lanc.tipo, valor, categoria, descricao:$("#lDesc").value.trim()||null, data:$("#lData").value };
  const b=$("#lSalvar"); b.disabled=true;
  const { error } = lanc.id
    ? await sb.from("movimentacoes").update(linha).eq("id",lanc.id)
    : await sb.from("movimentacoes").insert(linha);
  b.disabled=false;
  if(error) return erro("Não deu pra salvar: "+error.message);
  fecharModal(); toast(lanc.tipo==="saida"?"Saída lançada.":"Entrada lançada.");
  if(!$('[data-tela="caixa"]').hidden){
    if($("#lData").value.slice(0,7)!==$("#cxMes").value) $("#cxMes").value=$("#lData").value.slice(0,7);
    carregarCaixa();
  }
  if(!$('[data-tela="resumo"]').hidden) carregarResumoGeral();
};
$("#lExcluir").onclick=async()=>{
  if(!confirm("Excluir esse lançamento? Não tem como desfazer.")) return;
  const { error }=await sb.from("movimentacoes").delete().eq("id",lanc.id);
  if(error){ toast("Não deu pra excluir: "+error.message,true); return; }
  fecharModal(); toast("Lançamento excluído."); carregarCaixa();
};

/* ============================================================
   ABA RESUMO (DASHBOARD)
   ============================================================ */
let rsMeses=[];   // [{y,m,ent,sai}]
async function carregarResumoGeral(){
  if(!$("#rsMes").value) $("#rsMes").value=hojeISO().slice(0,7);
  const mes=$("#rsMes").value, seis=limitesMes(mes,5), um=limitesMes(mes);
  $("#rsKpis").innerHTML=`<p class="vazio">Carregando...</p>`;
  const [mv, vd, cl]=await Promise.all([
    sb.from("movimentacoes").select("tipo,valor,categoria,data").gte("data",seis.ini).lt("data",seis.fim),
    sb.from("vendas").select("total,forma_pagamento,itens_venda(produto_nome,quantidade,preco_unitario,custo_unitario)").gte("data",um.iniTS).lt("data",um.fimTS),
    carregarClientes().then(()=>null).catch(e=>e)
  ]);
  const erro=mv.error||vd.error||cl;
  if(erro){ $("#rsKpis").innerHTML=`<p class="vazio">Erro ao carregar: ${esc(erro.message)}</p>`; return; }

  /* meses do gráfico */
  const [y,m]=mes.split("-").map(Number);
  rsMeses=[];
  for(let i=5;i>=0;i--){ const d=new Date(y,m-1-i,1); rsMeses.push({ y:d.getFullYear(), m:d.getMonth()+1, ent:0, sai:0 }); }
  mv.data.forEach(x=>{
    const k=x.data.slice(0,7), alvo=rsMeses.find(r=>mesISO(r.y,r.m)===k);
    if(alvo) alvo[x.tipo==="entrada"?"ent":"sai"]+=Number(x.valor);
  });
  const atual=rsMeses[5], doMes=mv.data.filter(x=>x.data.slice(0,7)===mes);

  /* números do topo */
  const vendido=vd.data.reduce((s,v)=>s+Number(v.total),0);
  const pecas=vd.data.reduce((s,v)=>s+v.itens_venda.reduce((a,i)=>a+i.quantidade,0),0);
  const receber=clientes.filter(c=>c.saldo>0.009).reduce((s,c)=>s+c.saldo,0);
  const sobrou=atual.ent-atual.sai;
  const eAtual = mes===hojeISO().slice(0,7);

  /* lucro = vendas − custo das peças vendidas − gastos do mês (menos compra de mercadoria,
     porque a mercadoria já entra na conta pelo custo de cada peça vendida) */
  const itensMes=vd.data.flatMap(v=>v.itens_venda);
  const comCusto=itensMes.filter(i=>i.custo_unitario!=null);
  const pecasSemCusto=itensMes.filter(i=>i.custo_unitario==null).reduce((s,i)=>s+i.quantidade,0);
  const receitaC=comCusto.reduce((s,i)=>s+i.preco_unitario*i.quantidade,0);
  const custoC=comCusto.reduce((s,i)=>s+i.custo_unitario*i.quantidade,0);
  const gastos=doMes.filter(x=>x.tipo==="saida" && x.categoria!=="Fornecedor / mercadoria").reduce((s,x)=>s+Number(x.valor),0);
  const lucro=receitaC-custoC-gastos;
  const nomeM=nomeMes(y,m,true).toLowerCase();
  const kLucro = comCusto.length
    ? `<div class="kpi destaque"><small>Lucro em ${nomeM}</small><b>${lucro<0?"− ":""}${reais(Math.abs(lucro))}</b>
        <span>vendas ${reais(receitaC)} − custo das peças ${reais(custoC)} − gastos ${reais(gastos)}</span>
        ${pecasSemCusto?`<span class="aviso-custo">⚠️ ${pecasSemCusto===1?"1 peça vendida está sem custo cadastrado e ficou":`${pecasSemCusto} peças vendidas estão sem custo cadastrado e ficaram`} fora da conta</span>`:""}</div>`
    : `<div class="kpi destaque"><small>Lucro em ${nomeM}</small><b class="sem-dado">—</b>
        <span>${itensMes.length?"Cadastre o custo das peças nos produtos pra calcular o lucro.":"Nenhuma venda nesse mês ainda."}</span></div>`;
  $("#rsKpis").innerHTML=`${kLucro}
    <div class="kpi"><small>Caixa: ${sobrou<0?"faltou":"sobrou"}</small><b>${sobrou<0?"− ":""}${reais(Math.abs(sobrou))}</b><span>entrou ${reais(atual.ent)} · saiu ${reais(atual.sai)}</span></div>
    <div class="kpi"><small>Vendido no mês</small><b>${reais(vendido)}</b><span>${vd.data.length} ${vd.data.length===1?"venda":"vendas"} · ${pecas} ${pecas===1?"peça":"peças"}</span></div>
    <div class="kpi"><small>A receber no fiado</small><b>${reais(receber)}</b><span>${eAtual?"hoje, somando todos os clientes":"valor de hoje (não do mês escolhido)"}</span></div>`;

  renderGrafico();
  $("#rsTabela").innerHTML=`<table class="tabela"><thead><tr><th>Mês</th><th>Entradas</th><th>Saídas</th><th>Sobrou</th></tr></thead><tbody>${
    rsMeses.map(r=>`<tr><td>${nomeMes(r.y,r.m)}/${String(r.y).slice(2)}</td><td>${reais(r.ent)}</td><td>${reais(r.sai)}</td><td>${reais(r.ent-r.sai)}</td></tr>`).join("")}</tbody></table>`;

  /* mais vendidos */
  const top={};
  vd.data.forEach(v=>v.itens_venda.forEach(i=>{
    const t=top[i.produto_nome]||(top[i.produto_nome]={q:0,v:0,l:0,lc:false}); t.q+=i.quantidade; t.v+=i.quantidade*i.preco_unitario;
    if(i.custo_unitario!=null){ t.l+=(i.preco_unitario-i.custo_unitario)*i.quantidade; t.lc=true; }
  }));
  const topL=Object.entries(top).sort((a,b)=>b[1].q-a[1].q||b[1].v-a[1].v).slice(0,5);
  const maxQ=Math.max(1,...topL.map(t=>t[1].q));
  $("#rsTop").innerHTML = topL.length ? topL.map(([n,t])=>`
    <div class="barra-h">
      <div class="barra-txt"><span>${esc(n)}</span><b>${t.q} ${t.q===1?"peça":"peças"}</b></div>
      <div class="barra-trilho"><i style="width:${Math.max(4,t.q/maxQ*100)}%;background:var(--rose-escuro)"></i></div>
      <small>${reais(t.v)} vendidos${t.lc?` · lucro ${reais(t.l)}`:""}</small>
    </div>`).join("") : `<p class="dica">Nenhuma venda registrada nesse mês.</p>`;

  /* saídas por categoria */
  const cats={};
  doMes.filter(x=>x.tipo==="saida").forEach(x=>{ cats[x.categoria]=(cats[x.categoria]||0)+Number(x.valor); });
  const catL=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  const maxC=Math.max(1,...catL.map(c=>c[1]));
  $("#rsSaidas").innerHTML = catL.length ? catL.map(([n,v])=>`
    <div class="barra-h">
      <div class="barra-txt"><span>${esc(n)}</span><b>${reais(v)}</b></div>
      <div class="barra-trilho"><i style="width:${Math.max(4,v/maxC*100)}%;background:${COR_SAIDA}"></i></div>
      <small>${Math.round(v/atual.sai*100)}% das saídas</small>
    </div>`).join("") : `<p class="dica">Nenhuma saída lançada nesse mês.</p>`;

  /* atenção */
  const esgot=produtos.filter(p=>p.ativo && estoqueTotal(p)===0);
  const acabando=produtos.filter(p=>p.ativo && estoqueTotal(p)>0 && (p.variacoes||[]).some(v=>v.estoque<=ESTOQUE_BAIXO));
  const semCusto=custosOk ? produtos.filter(p=>p.ativo && (p.variacoes||[]).some(v=>v.custo==null)) : [];
  const devedores=clientes.filter(c=>c.saldo>0.009).sort((a,b)=>b.saldo-a.saldo).slice(0,3);
  const itens=[];
  if(esgot.length) itens.push(`<button class="aviso-item" data-ir-aba="produtos"><span class="selo zero">Esgotado</span>${esgot.length===1?esc(esgot[0].nome):`${esgot.length} produtos esgotados`}</button>`);
  if(acabando.length) itens.push(`<button class="aviso-item" data-ir-aba="produtos"><span class="selo baixo">Acabando</span>${acabando.length===1?esc(acabando[0].nome):`${acabando.length} produtos com tamanho acabando`}</button>`);
  if(semCusto.length) itens.push(`<button class="aviso-item" data-ir-aba="produtos" data-filtro="semcusto"><span class="selo oculto">Sem custo</span>${semCusto.length===1?`${esc(semCusto[0].nome)} está sem custo`:`${semCusto.length} produtos sem custo cadastrado`}</button>`);
  devedores.forEach(c=>itens.push(`<button class="aviso-item" data-ficha="${c.id}"><span class="selo forma-fiado">Fiado</span>${esc(c.nome)} deve ${reais(c.saldo)}</button>`));
  $("#rsAtencao").innerHTML = itens.length ? itens.join("") : `<p class="dica">Tudo em ordem: nada esgotado e ninguém devendo. 🎉</p>`;
}
$("#rsMes").addEventListener("change",carregarResumoGeral);
$("#rsAtencao").addEventListener("click",e=>{
  const a=e.target.closest("[data-ir-aba]"), f=e.target.closest("[data-ficha]");
  if(a){ $("#fStatus").value = a.dataset.filtro!=null ? a.dataset.filtro : a.textContent.includes("Esgotado")?"esgotados":"baixo"; renderLista(); location.hash="produtos"; }
  if(f) abrirFicha(+f.dataset.ficha);
});

/* ---------- gráfico de barras (SVG, sem biblioteca) ---------- */
function renderGrafico(){
  const W=Math.max(300,Math.round($("#rsGrafico").clientWidth||600)), H=230, pe=62, pd=6, pt=12, pb=28;   // tamanho real da tela, letras não encolhem
  const larg=W-pe-pd, alt=H-pt-pb;
  const maxV=Math.max(...rsMeses.flatMap(r=>[r.ent,r.sai]), 0);
  /* escala "redonda" pro eixo */
  const passo=(()=>{ if(maxV<=0) return 100; const bruto=maxV/4, p=10**Math.floor(Math.log10(bruto)), n=bruto/p;
    return (n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*p; })();
  const topo=passo*4, y=v=>pt+alt-(v/topo)*alt;
  const grupo=larg/rsMeses.length, bw=Math.min(26,(grupo-18)/2);
  const barra=(x,v,cor)=>{ if(v<=0) return ""; const h=Math.max(2,alt*v/topo), r=Math.min(4,h,bw/2), yb=pt+alt;
    return `<path d="M${x},${yb}V${yb-h+r}Q${x},${yb-h} ${x+r},${yb-h}H${x+bw-r}Q${x+bw},${yb-h} ${x+bw},${yb-h+r}V${yb}Z" fill="${cor}"/>`; };
  let g="";
  for(let i=0;i<=4;i++){ const v=passo*i, yy=y(v);
    g+=`<line x1="${pe}" x2="${W-pd}" y1="${yy}" y2="${yy}" stroke="${i?"#EFE8E5":"#CFC4BF"}" stroke-width="1"/>
        <text x="${pe-8}" y="${yy+4}" text-anchor="end" class="eixo">${reaisCurto(v)}</text>`; }
  rsMeses.forEach((r,i)=>{
    const cx=pe+grupo*i+grupo/2, x1=cx-bw-1, x2=cx+1;      // 2px de espaço entre as barras
    g+=`<g class="col" data-i="${i}">
      <rect x="${pe+grupo*i}" y="${pt}" width="${grupo}" height="${alt+pb}" fill="transparent"/>
      ${barra(x1,r.ent,COR_ENTRADA)}${barra(x2,r.sai,COR_SAIDA)}
      <text x="${cx}" y="${H-8}" text-anchor="middle" class="eixo ${i===5?"atual":""}">${nomeMes(r.y,r.m)}</text>
      <title>${nomeMes(r.y,r.m,true)}: entradas ${reais(r.ent)}, saídas ${reais(r.sai)}</title>
    </g>`;
  });
  $("#rsGrafico").innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Entradas e saídas dos últimos 6 meses">${g}</svg><div class="dica-graf" id="rsDica" hidden></div>`;
}
function mostrarDica(i){
  const r=rsMeses[i], dica=$("#rsDica"); if(!r||!dica) return;
  document.querySelectorAll("#rsGrafico .col").forEach(c=>c.classList.toggle("ativa",+c.dataset.i===i));
  dica.innerHTML=`<b>${nomeMes(r.y,r.m,true)} ${r.y}</b>
    <span><i class="sw ent"></i>Entradas <b>${reais(r.ent)}</b></span>
    <span><i class="sw sai"></i>Saídas <b>${reais(r.sai)}</b></span>
    <span class="sob">${r.ent-r.sai<0?"Faltou":"Sobrou"} <b>${reais(Math.abs(r.ent-r.sai))}</b></span>`;
  dica.hidden=false;
}
let timerGraf;
window.addEventListener("resize",()=>{ clearTimeout(timerGraf); timerGraf=setTimeout(()=>{ if(rsMeses.length && !$('[data-tela="resumo"]').hidden) renderGrafico(); },150); });
$("#rsGrafico").addEventListener("pointerover",e=>{ const c=e.target.closest(".col"); if(c) mostrarDica(+c.dataset.i); });
$("#rsGrafico").addEventListener("click",e=>{ const c=e.target.closest(".col"); if(c) mostrarDica(+c.dataset.i); });
$("#rsGrafico").addEventListener("pointerleave",e=>{ if(e.pointerType==="mouse"){ $("#rsDica").hidden=true; document.querySelectorAll("#rsGrafico .col").forEach(c=>c.classList.remove("ativa")); } });
