/* ============================================================
   NC Style Fitness — PAINEL: VENDAS E FIADO
   Usa as funções do admin.js ($, reais, esc, numCampo, toast,
   bolinha, produtos, carregarProdutos) e o sb do supabase.js
   ============================================================ */

const DDD_PADRAO = "92";   // usado quando o telefone do cliente vem sem DDD
const FORMAS = { pix:"Pix", dinheiro:"Dinheiro", debito:"Débito", credito:"Crédito", fiado:"Fiado" };

/* ---------- datas ---------- */
const hojeISO = () => new Date().toLocaleDateString("sv-SE");          // "2026-10-08"
const diaCurto = d => new Date(d).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});
const hora = d => new Date(d).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
/* data escolhida no campo -> data/hora pro banco (hoje = agora; outro dia = meio-dia) */
const dataPraBanco = iso => (!iso || iso===hojeISO()) ? new Date().toISOString() : new Date(iso+"T12:00:00").toISOString();
function nomeDoDia(d){
  const x=new Date(d).toLocaleDateString("sv-SE");
  const ontem=new Date(Date.now()-864e5).toLocaleDateString("sv-SE");
  if(x===hojeISO()) return "Hoje";
  if(x===ontem) return "Ontem";
  const s=new Date(d).toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit"});
  return s.charAt(0).toUpperCase()+s.slice(1);
}
const primeiroNome = n => String(n||"").trim().split(/\s+/)[0] || "";
function linkWhats(tel){
  let d=String(tel||"").replace(/\D/g,"");
  if(!d) return null;
  if(d.length<=9) d=DDD_PADRAO+d;
  if(!(d.startsWith("55") && d.length>=12)) d="55"+d;
  return d;
}
function chipsFormas(el, lista, atual){
  el.innerHTML=lista.map(f=>`<button type="button" class="chip forma" data-forma="${f}" aria-pressed="${f===atual}">${FORMAS[f]}</button>`).join("");
}

/* ============================================================
   ABAS (Produtos / Vendas / Fiado)
   ============================================================ */
const ABAS=["resumo","produtos","vendas","fiado","caixa"];
function irAba(a){
  if(!ABAS.includes(a)) a="resumo";
  document.querySelectorAll("[data-tela]").forEach(m=>m.hidden=m.dataset.tela!==a);
  document.querySelectorAll(".abas-painel [data-aba]").forEach(b=>b.setAttribute("aria-current", b.dataset.aba===a ? "page" : "false"));
  if(a==="vendas") carregarVendas();
  if(a==="fiado") carregarFiado();
  if(a==="caixa") carregarCaixa();      // financeiro.js
  if(a==="resumo") carregarResumoGeral(); // financeiro.js
  window.scrollTo(0,0);
}
function iniciarAbas(){
  if(!$("#vMes").value) $("#vMes").value=hojeISO().slice(0,7);
  irAba(location.hash.slice(1));
}
window.addEventListener("hashchange",()=>irAba(location.hash.slice(1)));
document.querySelector(".abas-painel").addEventListener("click",e=>{
  const b=e.target.closest("[data-aba]"); if(!b) return;
  if(location.hash==="#"+b.dataset.aba) irAba(b.dataset.aba); else location.hash=b.dataset.aba;
});

/* ============================================================
   JANELINHAS (modais)
   ============================================================ */
let modalAberto=null;
function abrirModal(id){
  if(modalAberto) modalAberto.hidden=true;
  modalAberto=$(id); modalAberto.hidden=false; $("#veu").classList.add("aberto");
  modalAberto.scrollTop=0;
}
function fecharModal(){
  if(!modalAberto) return;
  modalAberto.hidden=true; modalAberto=null; $("#veu").classList.remove("aberto");
}
$("#veu").addEventListener("click",fecharModal);
document.querySelectorAll("[data-fechar-modal]").forEach(b=>b.addEventListener("click",fecharModal));
document.addEventListener("keydown",e=>{ if(e.key==="Escape") fecharModal(); });

/* ============================================================
   CLIENTES (lista usada na venda e no fiado)
   ============================================================ */
let clientes=[];   // {id,nome,telefone,observacao,saldo,total_fiado,total_pago}
async function carregarClientes(){
  const [c, s] = await Promise.all([
    sb.from("clientes").select("id,nome,telefone,observacao,saldo_anterior").order("nome"),
    sb.from("saldo_clientes").select("id,saldo,total_fiado,total_pago")
  ]);
  if(c.error) throw c.error;
  if(s.error) throw s.error;
  const saldos=Object.fromEntries(s.data.map(x=>[x.id,x]));
  clientes=c.data.map(x=>({...x, saldo:Number(saldos[x.id]?.saldo||0), total_fiado:Number(saldos[x.id]?.total_fiado||0), total_pago:Number(saldos[x.id]?.total_pago||0)}));
  return clientes;
}

/* cadastrar / editar cliente */
let clienteEditando=null, aposSalvarCliente=null;
function abrirCadastroCliente(cli=null, callback=null, nomeInicial=""){
  clienteEditando=cli; aposSalvarCliente=callback;
  $("#mClienteTit").textContent = cli ? "Editar cliente" : "Cliente novo";
  $("#kNome").value=cli?.nome||nomeInicial; $("#kTel").value=cli?.telefone||""; $("#kObs").value=cli?.observacao||"";
  $("#kAnterior").value = Number(cli?.saldo_anterior||0) > 0 ? formatar(Number(cli.saldo_anterior).toFixed(2)) : "";
  $("#kErro").textContent=""; $("#kExcluir").hidden=!cli;
  abrirModal("#mCliente"); $("#kNome").focus();
}
$("#kSalvar").onclick=async()=>{
  const nome=$("#kNome").value.trim();
  if(!nome){ $("#kErro").textContent="Coloca o nome."; return; }
  const anterior = $("#kAnterior").value.trim() ? numCampo($("#kAnterior").value) : 0;
  if(anterior==null || anterior<0){ $("#kErro").textContent="O valor que ela já devia está estranho. Ex: 1570 ou 1570,50"; return; }
  if(clienteEditando){   // diminuir a dívida antiga não pode deixar o saldo negativo
    const minimo=Math.round((Number(clienteEditando.saldo_anterior||0)-Number(clienteEditando.saldo||0))*100)/100;
    if(anterior<minimo){ $("#kErro").textContent=`Com os pagamentos que ela já fez, aqui não pode ficar menos que ${reais(minimo)}.`; return; }
  }
  const linha={ nome, telefone:$("#kTel").value.trim()||null, observacao:$("#kObs").value.trim()||null, saldo_anterior:Math.round(anterior*100)/100 };
  const b=$("#kSalvar"); b.disabled=true;
  const r = clienteEditando
    ? await sb.from("clientes").update(linha).eq("id",clienteEditando.id).select().single()
    : await sb.from("clientes").insert(linha).select().single();
  b.disabled=false;
  if(r.error){ $("#kErro").textContent="Não deu pra salvar: "+r.error.message; return; }
  fecharModal(); toast("Cliente salvo!");
  await carregarClientes().catch(()=>{});
  const salvo=clientes.find(c=>c.id===r.data.id)||r.data;
  if(aposSalvarCliente) aposSalvarCliente(salvo);
};
$("#kExcluir").onclick=async()=>{
  const deve=Number(clienteEditando.saldo||0);
  if(!confirm(deve>0 ? `${clienteEditando.nome} ainda deve ${reais(deve)}. Excluir mesmo assim? A dívida some junto.` : `Excluir ${clienteEditando.nome}?`)) return;
  const { error }=await sb.from("clientes").delete().eq("id",clienteEditando.id);
  if(error){
    toast(error.code==="23503" ? "Esse cliente tem compras ou pagamentos registrados, não dá pra excluir." : "Não deu pra excluir: "+error.message, true);
    return;
  }
  fecharModal(); toast("Cliente excluído."); fecharFicha(); carregarFiado();
};

/* ============================================================
   ABA VENDAS
   ============================================================ */
let vendasMes=[];
async function carregarVendas(){
  const [y,m]=$("#vMes").value.split("-").map(Number);
  const ini=new Date(y,m-1,1), fim=new Date(y,m,1);
  const { data, error }=await sb.from("vendas")
    .select("id,data,total,forma_pagamento,observacao,cliente_id,clientes(nome,telefone),itens_venda(produto_nome,cor,tamanho,quantidade,preco_unitario,custo_unitario)")
    .gte("data",ini.toISOString()).lt("data",fim.toISOString())
    .order("data",{ascending:false});
  if(error){ $("#vLista").innerHTML=`<p class="vazio">Erro ao carregar: ${esc(error.message)}</p>`; return; }
  vendasMes=data; renderVendas();
}
$("#vMes").addEventListener("change",carregarVendas);

function renderVendas(){
  const soma=l=>l.reduce((s,v)=>s+Number(v.total),0);
  const pecas=vendasMes.reduce((s,v)=>s+v.itens_venda.reduce((a,i)=>a+i.quantidade,0),0);
  const fiado=vendasMes.filter(v=>v.forma_pagamento==="fiado");
  $("#vResumo").innerHTML=`
    <div><b>${reais(soma(vendasMes))}</b><small>vendido no mês</small></div>
    <div><b>${reais(soma(vendasMes)-soma(fiado))}</b><small>recebido à vista</small></div>
    <div class="${fiado.length?"alerta":""}"><b>${reais(soma(fiado))}</b><small>vendido no fiado</small></div>
    <div><b>${pecas}</b><small>peças vendidas</small></div>`;
  if(!vendasMes.length){ $("#vLista").innerHTML=`<p class="vazio">Nenhuma venda nesse mês. Toque em "+ Registrar venda".</p>`; return; }
  let html="", diaAtual="";
  vendasMes.forEach(v=>{
    const dia=nomeDoDia(v.data);
    if(dia!==diaAtual){ html+=`<h3 class="dia">${dia}</h3>`; diaAtual=dia; }
    const itens=v.itens_venda, primeiro=itens[0];
    const resumo = primeiro ? `${primeiro.quantidade}x ${primeiro.produto_nome}${itens.length>1?` + ${itens.length-1}`:""}` : "";
    html+=`<button class="linha-venda" data-venda="${v.id}">
      <div><div class="nome">${esc(v.clientes?.nome||"Venda avulsa")}</div><small>${hora(v.data)} · ${esc(resumo)}</small></div>
      <div class="dir">${reais(v.total)}<span class="selo forma-${v.forma_pagamento}">${FORMAS[v.forma_pagamento]}</span></div>
    </button>`;
  });
  $("#vLista").innerHTML=html;
}
$("#vLista").addEventListener("click",e=>{ const b=e.target.closest("[data-venda]"); if(b) abrirDetalheVenda(vendasMes.find(v=>v.id==b.dataset.venda)); });

/* ---------- detalhe e cancelamento ---------- */
let vendaAberta=null;
function abrirDetalheVenda(v){
  if(!v) return;
  vendaAberta=v;
  $("#mVendaTit").textContent="Venda #"+v.id;
  $("#dVenda").innerHTML=`
    <p class="dica">${new Date(v.data).toLocaleDateString("pt-BR")} às ${hora(v.data)} · ${FORMAS[v.forma_pagamento]}${v.clientes?.nome?` · ${esc(v.clientes.nome)}`:""}</p>
    <div class="itens-lista">${v.itens_venda.map(i=>`
      <div class="item-linha"><div>${i.quantidade}x ${esc(i.produto_nome)}<small>${esc(i.cor)} / ${esc(i.tamanho)} · ${reais(i.preco_unitario)} cada</small></div><b>${reais(i.quantidade*i.preco_unitario)}</b></div>`).join("")}
    </div>
    <div class="total-venda"><span>Total</span><b>${reais(v.total)}</b></div>
    ${linhaLucro(v.itens_venda)}
    ${v.observacao?`<p class="dica">Obs: ${esc(v.observacao)}</p>`:""}`;
  /* mandar pra cliente o que ela levou (sem custo nem lucro) */
  const w=linkWhats(v.clientes?.telefone);
  $("#dWhats").hidden=!w;
  if(w) $("#dWhats").href=linkCompra(w, v.clientes.nome,
    v.itens_venda.map(i=>({ qtd:i.quantidade, nome:i.produto_nome, cor:i.cor, tam:i.tamanho, preco:i.preco_unitario })),
    v.total, v.forma_pagamento, v.data);
  abrirModal("#mVenda");
}
/* resumo da compra pro WhatsApp da cliente: as peças, o total e a forma de pagamento */
function linkCompra(w, nome, itens, total, forma, data){
  const pecas=itens.map(i=>`• ${i.qtd}x ${i.nome} (${i.cor}/${i.tam}): ${reais(i.qtd*i.preco)}`).join("\n");
  const msg=`Oi, ${primeiroNome(nome)}! 😊\n\nObrigada pela compra! Aqui estão as peças que você levou na NC Style Fitness em ${diaCurto(data)}:\n\n${pecas}\n\n*Total: ${reais(total)}*\nPagamento: ${FORMAS[forma]||forma}\n\nPrecisando estou sempre aqui para lhe atender 🤝.`;
  return `https://wa.me/${w}?text=${encodeURIComponent(msg)}`;
}
function linhaLucro(itens){
  const com=itens.filter(i=>i.custo_unitario!=null);
  if(!com.length) return `<p class="dica">Lucro: cadastre o custo das peças no produto pra ver.</p>`;
  const lucro=com.reduce((s,i)=>s+(i.preco_unitario-i.custo_unitario)*i.quantidade,0);
  return `<div class="lucro-linha"><span>Lucro${com.length<itens.length?" (só das peças com custo)":""}</span><b>${reais(lucro)}</b></div>`;
}
$("#dCancelar").onclick=async()=>{
  const v=vendaAberta; if(!v) return;
  let msg=`Cancelar a venda #${v.id} de ${reais(v.total)}?\n\nAs peças voltam pro estoque e o valor sai do financeiro. Não tem como desfazer.`;
  if(v.forma_pagamento==="fiado") msg+=`\n\nComo é fiado, o valor sai também do que o cliente deve.`;
  if(!confirm(msg)) return;
  const b=$("#dCancelar"); b.disabled=true;
  const { error }=await sb.rpc("cancelar_venda",{ p_venda_id:v.id });
  b.disabled=false;
  if(error){ toast("Não deu pra cancelar: "+error.message,true); return; }
  fecharModal(); toast("Venda cancelada. Peças devolvidas ao estoque.");
  carregarProdutos(); carregarVendas();
  if(fichaId) abrirFicha(fichaId);
  if(!$('[data-tela="fiado"]').hidden) carregarFiado();
};

/* ============================================================
   REGISTRAR VENDA
   ============================================================ */
let venda=null;   // {itens:[], forma:null, cliente:null}

async function abrirNovaVenda(clientePre=null){
  venda={ itens:[], forma:null, cliente:clientePre };
  $("#vData").value=hojeISO(); $("#vData").max=hojeISO();
  $("#vObs").value=""; $("#vErro").textContent=""; $("#vClienteBusca").value=""; $("#vClienteSug").innerHTML="";
  chipsFormas($("#vFormas"),["pix","dinheiro","debito","credito","fiado"],null);
  renderItensVenda(); renderClienteVenda(); atualizarFormaVenda();
  $("#editorVenda").hidden=false; document.body.style.overflow="hidden";
  $("#editorVenda .editor-corpo").scrollTop=0;
  carregarClientes().catch(()=>{});
}
function fecharVenda(){ $("#editorVenda").hidden=true; document.body.style.overflow=""; venda=null; }
$("#novaVenda").onclick=()=>abrirNovaVenda();
document.querySelectorAll("[data-fechar-venda]").forEach(b=>b.addEventListener("click",()=>{
  if(venda?.itens.length && !confirm("Sair sem registrar essa venda?")) return;
  fecharVenda();
}));

/* peças da venda */
const variacaoPorId = id => { for(const p of produtos){ const v=(p.variacoes||[]).find(x=>x.id===id); if(v) return {p,v}; } return null; };
const naVenda = id => (venda?.itens||[]).filter(i=>i.variacao_id===id).reduce((s,i)=>s+i.qtd,0);
const totalVenda = () => venda.itens.reduce((s,i)=>s+i.qtd*i.preco,0);

function renderItensVenda(){
  $("#vItens").innerHTML = venda.itens.length ? venda.itens.map((i,n)=>{
    const max=(variacaoPorId(i.variacao_id)?.v.estoque)||i.qtd;
    return `<div class="item-venda">
      <i class="bol" style="background:${bolinha(i.hex)}"></i>
      <div class="info">${esc(i.nome)}<small>${esc(i.cor)} / ${esc(i.tam)} · ${reais(i.preco)} cada</small></div>
      <div class="stepper mini"><button type="button" data-n="${n}" data-d="-1" aria-label="Diminuir">−</button><b>${i.qtd}</b><button type="button" data-n="${n}" data-d="1" aria-label="Aumentar" ${i.qtd>=max?"disabled":""}>+</button></div>
      <b class="sub">${reais(i.qtd*i.preco)}</b>
    </div>`;
  }).join("") : `<p class="dica">Nenhuma peça ainda.</p>`;
  const t=reais(totalVenda());
  $("#vTotal").textContent=t;
  $("#vSalvar").textContent = venda.itens.length ? `Registrar · ${t}` : "Registrar venda";
}
$("#vItens").addEventListener("click",e=>{
  const b=e.target.closest("[data-n]"); if(!b||b.disabled) return;
  const i=venda.itens[+b.dataset.n]; i.qtd+=+b.dataset.d;
  if(i.qtd<=0) venda.itens.splice(+b.dataset.n,1);
  renderItensVenda();
});

/* forma de pagamento */
function atualizarFormaVenda(){
  const fiado=venda.forma==="fiado";
  $("#vDicaFiado").hidden=!fiado;
  $("#vClienteDica").textContent = fiado ? "Obrigatório no fiado: é nele que a dívida fica anotada." : "Opcional na venda à vista. Obrigatório no fiado.";
}
$("#vFormas").addEventListener("click",e=>{
  const b=e.target.closest("[data-forma]"); if(!b) return;
  venda.forma=b.dataset.forma; chipsFormas($("#vFormas"),["pix","dinheiro","debito","credito","fiado"],venda.forma);
  atualizarFormaVenda(); $("#vErro").textContent="";
});

/* cliente da venda */
function renderClienteVenda(){
  const c=venda.cliente;
  $("#vClienteBuscar").hidden=!!c;
  $("#vClienteEscolhido").innerHTML = c ? `<div class="cliente-escolhido">
      <div><b>${esc(c.nome)}</b>${c.saldo>0?`<small>Já deve ${reais(c.saldo)}</small>`:""}</div>
      <button type="button" class="link" id="vTrocarCliente">Trocar</button></div>` : "";
}
$("#vClienteEscolhido").addEventListener("click",e=>{
  if(e.target.closest("#vTrocarCliente")){ venda.cliente=null; renderClienteVenda(); $("#vClienteBusca").focus(); }
});
$("#vClienteBusca").addEventListener("input",()=>{
  const q=$("#vClienteBusca").value.trim().toLowerCase();
  if(!q){ $("#vClienteSug").innerHTML=""; return; }
  const l=clientes.filter(c=>c.nome.toLowerCase().includes(q)).slice(0,6);
  $("#vClienteSug").innerHTML = l.length
    ? l.map(c=>`<button type="button" data-cli="${c.id}"><span>${esc(c.nome)}</span>${c.saldo>0?`<small>deve ${reais(c.saldo)}</small>`:""}</button>`).join("")
    : `<p class="dica">Ninguém com esse nome. Cadastra embaixo.</p>`;
});
$("#vClienteSug").addEventListener("click",e=>{
  const b=e.target.closest("[data-cli]"); if(!b) return;
  venda.cliente=clientes.find(c=>c.id==b.dataset.cli); $("#vClienteBusca").value=""; $("#vClienteSug").innerHTML="";
  renderClienteVenda(); $("#vErro").textContent="";
});
$("#vClienteNovo").onclick=()=>abrirCadastroCliente(null, c=>{ if(venda){ venda.cliente=c; renderClienteVenda(); } }, $("#vClienteBusca").value.trim());

/* salvar a venda */
$("#vSalvar").onclick=async()=>{
  const erro=m=>{ $("#vErro").textContent=m; };
  if(!venda.itens.length) return erro("Adiciona pelo menos uma peça.");
  if(!venda.forma) return erro("Escolhe a forma de pagamento.");
  if(venda.forma==="fiado" && !venda.cliente) return erro("Venda fiado precisa de cliente.");
  erro("");
  const b=$("#vSalvar"); b.disabled=true; b.textContent="Registrando...";
  const data=dataPraBanco($("#vData").value);
  const { error }=await sb.rpc("registrar_venda",{
    p_itens: venda.itens.map(i=>({ variacao_id:i.variacao_id, quantidade:i.qtd, preco_unitario:i.preco })),
    p_forma: venda.forma,
    p_cliente_id: venda.cliente?.id ?? null,
    p_data: data,
    p_observacao: $("#vObs").value.trim() || null
  });
  b.disabled=false;
  if(error){ renderItensVenda(); return erro("Não deu pra registrar: "+error.message); }
  const eraFiado=venda.forma==="fiado", cli=venda.cliente, w=linkWhats(cli?.telefone);
  const total=venda.itens.reduce((s,i)=>s+i.qtd*i.preco,0);
  const link = w ? linkCompra(w, cli.nome, venda.itens, total, venda.forma, data) : null;
  fecharVenda();
  if(link){   // cliente com WhatsApp: oferece mandar o resumo do que ela levou
    $("#voTxt").textContent = eraFiado ? `Anotada no fiado de ${primeiroNome(cli.nome)}: ${reais(total)}.` : `${reais(total)} de ${primeiroNome(cli.nome)}. Estoque atualizado.`;
    $("#mVendaOkTit").textContent=`Venda de ${primeiroNome(cli.nome)}`;
    $("#voWhats").href=link;
    abrirModal("#mVendaOk");
  } else toast(eraFiado ? `Venda anotada no fiado de ${primeiroNome(cli.nome)}.` : "Venda registrada! Estoque atualizado.");
  carregarProdutos();
  if(!$('[data-tela="vendas"]').hidden) carregarVendas();
  if(!$('[data-tela="fiado"]').hidden) carregarFiado();
  if(fichaId) abrirFicha(fichaId);
};

/* ---------- escolher peça ---------- */
let peca=null;   // {p, cor, varId, qtd}
$("#vAddPeca").onclick=()=>{
  peca=null; $("#pBusca").value=""; mostrarPasso(1); renderListaPecas(); abrirModal("#mPeca");
};
function mostrarPasso(n){
  $("#pPasso1").hidden=n!==1; $("#pPasso2").hidden=n!==2; $("#pVoltar").hidden=n!==2;
  $("#mPecaTit").textContent = n===1 ? "Escolher peça" : "Cor e tamanho";
}
$("#pVoltar").onclick=()=>{ mostrarPasso(1); renderListaPecas(); };
function renderListaPecas(){
  const q=$("#pBusca").value.trim().toLowerCase();
  const l=produtos.filter(p=>!q || p.nome.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q))
    .sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"));
  if(!produtos.length){ $("#pLista").innerHTML=`<p class="vazio">Nenhum produto cadastrado ainda.</p>`; return; }
  $("#pLista").innerHTML = l.length ? l.map(p=>{
    const disp=(p.variacoes||[]).reduce((s,v)=>s+Math.max(0,v.estoque-naVenda(v.id)),0);
    return `<button type="button" class="linha-peca" data-p="${p.id}" ${disp?"":"disabled"}>
      <div class="thumb">${p.fotos[0]?`<img src="${esc(p.fotos[0])}" alt="" loading="lazy">`:esc(p.nome[0])}</div>
      <div><div class="nome">${esc(p.nome)}</div><small>${esc(p.categoria)}${p.ativo?"":" · escondido no site"}</small></div>
      <small class="dir">${disp?`${disp} em estoque`:"Esgotado"}</small>
    </button>`;
  }).join("") : `<p class="vazio">Nenhum produto com esse nome.</p>`;
}
$("#pBusca").addEventListener("input",renderListaPecas);
$("#pLista").addEventListener("click",e=>{
  const b=e.target.closest("[data-p]"); if(!b||b.disabled) return;
  const p=produtos.find(x=>x.id==b.dataset.p);
  const cores=[...new Map((p.variacoes||[]).map(v=>[v.cor,v.cor_hex])).entries()];
  const comEstoque=cores.find(([c])=>p.variacoes.some(v=>v.cor===c && v.estoque-naVenda(v.id)>0));
  peca={ p, cores, cor:(comEstoque||cores[0])[0], varId:null, qtd:1 };
  $("#pCab").innerHTML=`<div class="thumb">${p.fotos[0]?`<img src="${esc(p.fotos[0])}" alt="">`:esc(p.nome[0])}</div><div><b>${esc(p.nome)}</b><small>${esc(p.categoria)}</small></div>`;
  $("#pErro").textContent=""; mostrarPasso(2); renderPeca();
});
function renderPeca(){
  const { p, cores, cor }=peca;
  $("#pCores").innerHTML=cores.map(([c,h])=>`<button type="button" class="cor-op" data-c="${esc(c)}" aria-pressed="${c===cor}"><i style="background:${bolinha(h)}"></i>${esc(c)}</button>`).join("");
  const vars=p.variacoes.filter(v=>v.cor===cor);
  const ordem=vars.map(v=>v.tamanho); ordenarTams(ordem);   // P, M, G, GG...
  $("#pTams").innerHTML=ordem.map(t=>{
    const v=vars.find(x=>x.tamanho===t), disp=v.estoque-naVenda(v.id);
    return `<button type="button" class="tam-op" data-v="${v.id}" aria-pressed="${v.id===peca.varId}" ${disp>0?"":"disabled"}>${esc(t)}<small>${Math.max(0,disp)}</small></button>`;
  }).join("");
  const v=p.variacoes.find(x=>x.id===peca.varId);
  const max=v ? v.estoque-naVenda(v.id) : 1;
  if(peca.qtd>max) peca.qtd=Math.max(1,max);
  $("#pQtd").textContent=peca.qtd;
  $("#pMais").disabled=!v || peca.qtd>=max;
  $("#pMenos").disabled=peca.qtd<=1;
}
$("#pCores").addEventListener("click",e=>{
  const b=e.target.closest("[data-c]"); if(!b) return;
  peca.cor=b.dataset.c; peca.varId=null; peca.qtd=1; $("#pPreco").value=""; renderPeca();
});
$("#pTams").addEventListener("click",e=>{
  const b=e.target.closest("[data-v]"); if(!b||b.disabled) return;
  peca.varId=+b.dataset.v; peca.qtd=1;
  const v=peca.p.variacoes.find(x=>x.id===peca.varId);
  $("#pPreco").value=formatar(Number(v.preco ?? peca.p.preco).toFixed(2));
  $("#pErro").textContent=""; renderPeca();
});
$("#pMenos").onclick=()=>{ if(peca.qtd>1){ peca.qtd--; renderPeca(); } };
$("#pMais").onclick=()=>{ peca.qtd++; renderPeca(); };
$("#pAdd").onclick=()=>{
  if(!peca.varId){ $("#pErro").textContent="Escolhe o tamanho."; return; }
  const preco=numCampo($("#pPreco").value);
  if(preco==null || preco<0){ $("#pErro").textContent="Coloca o preço."; return; }
  const v=peca.p.variacoes.find(x=>x.id===peca.varId);
  const ja=venda.itens.find(i=>i.variacao_id===v.id && i.preco===preco);
  if(ja) ja.qtd+=peca.qtd;
  else venda.itens.push({ variacao_id:v.id, nome:peca.p.nome, cor:v.cor, hex:v.cor_hex, tam:v.tamanho, qtd:peca.qtd, preco });
  fecharModal(); renderItensVenda(); $("#vErro").textContent="";
};

/* ============================================================
   ABA FIADO
   ============================================================ */
let ultimaFiado={};   // cliente_id -> data da última compra fiado
async function carregarFiado(){
  try{
    const [_, uf]=await Promise.all([
      carregarClientes(),
      sb.from("vendas").select("cliente_id,data").eq("forma_pagamento","fiado").order("data",{ascending:false})
    ]);
    if(uf.error) throw uf.error;
    ultimaFiado={}; uf.data.forEach(v=>{ if(!ultimaFiado[v.cliente_id]) ultimaFiado[v.cliente_id]=v.data; });
  }catch(err){ $("#fLista").innerHTML=`<p class="vazio">Erro ao carregar: ${esc(err.message)}</p>`; return; }
  renderFiado();
}
function renderFiado(){
  const devendo=clientes.filter(c=>c.saldo>0.009);
  $("#fResumo").innerHTML=`
    <div class="${devendo.length?"alerta":""}"><b>${reais(devendo.reduce((s,c)=>s+c.saldo,0))}</b><small>a receber no fiado</small></div>
    <div><b>${devendo.length}</b><small>${devendo.length===1?"cliente devendo":"clientes devendo"}</small></div>`;
  const q=$("#fBusca").value.trim().toLowerCase();
  let l = $("#fMostrar").value==="todas" ? [...clientes] : devendo;
  if(q) l=l.filter(c=>c.nome.toLowerCase().includes(q) || String(c.telefone||"").includes(q));
  l.sort((a,b)=>(b.saldo-a.saldo) || a.nome.localeCompare(b.nome,"pt-BR"));
  if(!clientes.length){ $("#fLista").innerHTML=`<p class="vazio">Nenhum cliente cadastrado ainda. Ele é cadastrado na hora da venda fiado, ou pelo "+ Cliente".</p>`; return; }
  if(!l.length){ $("#fLista").innerHTML=`<p class="vazio">${q?"Ninguém com esse nome.":"Ninguém devendo. 🎉"}</p>`; return; }
  $("#fLista").innerHTML=l.map(c=>`
    <button class="linha-cliente" data-cli="${c.id}">
      <span class="avatar">${esc(c.nome[0]||"?").toUpperCase()}</span>
      <div><div class="nome">${esc(c.nome)}</div><small>${ultimaFiado[c.id]?`Última compra fiado: ${diaCurto(ultimaFiado[c.id])}`:Number(c.saldo_anterior)>0?"Dívida de antes do painel":(c.telefone?esc(c.telefone):"Sem compras no fiado")}</small></div>
      <div class="dir">${c.saldo>0.009?`<b class="deve">${reais(c.saldo)}</b>`:c.saldo<-0.009?`<span class="selo ok">crédito ${reais(-c.saldo)}</span>`:`<span class="selo ok">Em dia</span>`}</div>
    </button>`).join("");
}
["#fBusca","#fMostrar"].forEach(s=>$(s).addEventListener("input",renderFiado));
$("#fLista").addEventListener("click",e=>{ const b=e.target.closest("[data-cli]"); if(b) abrirFicha(+b.dataset.cli); });
$("#novaCliente").onclick=()=>abrirCadastroCliente(null, c=>{ carregarFiado(); abrirFicha(c.id); });

/* ---------- ficha do cliente ---------- */
let fichaId=null, fichaCli=null, fichaVendas=[];
async function abrirFicha(id){
  fichaId=id;
  $("#telaCliente").hidden=false; document.body.style.overflow="hidden";
  $("#cHist").innerHTML=`<p class="vazio">Carregando...</p>`;
  const [cs, vs, ps]=await Promise.all([
    carregarClientes().then(()=>null).catch(e=>e),
    sb.from("vendas").select("id,data,total,forma_pagamento,observacao,cliente_id,clientes(nome,telefone),itens_venda(produto_nome,cor,tamanho,quantidade,preco_unitario,custo_unitario)").eq("cliente_id",id).order("data",{ascending:false}),
    sb.from("pagamentos").select("*").eq("cliente_id",id).order("data",{ascending:false})
  ]);
  if(fichaId!==id) return;
  const erro=cs||vs.error||ps.error;
  if(erro){ $("#cHist").innerHTML=`<p class="vazio">Erro ao carregar: ${esc(erro.message)}</p>`; return; }
  fichaCli=clientes.find(c=>c.id===id);
  if(!fichaCli){ fecharFicha(); return; }
  fichaVendas=vs.data;
  const c=fichaCli;

  $("#cNome").textContent=c.nome;
  const deve=c.saldo>0.009;
  $("#cSaldoRotulo").textContent = deve ? "Deve" : c.saldo<-0.009 ? "Tem crédito de" : "Situação";
  $("#cSaldo").textContent = deve ? reais(c.saldo) : c.saldo<-0.009 ? reais(-c.saldo) : "Em dia";
  $("#cSaldo").className = deve ? "deve" : "";
  const antes=Number(c.saldo_anterior||0);
  $("#cInfo").textContent=[c.telefone,
    (antes>0 ? `Devia ${reais(antes)} de antes · comprou ${reais(c.total_fiado-antes)} no fiado` : `Comprou ${reais(c.total_fiado)} no fiado`) + ` · pagou ${reais(c.total_pago)}`,
    c.observacao].filter(Boolean).join(" · ");
  $("#cReceber").disabled=!deve;

  const w=linkWhats(c.telefone);
  const cob=$("#cCobrar");
  if(deve && w){
    const msg=`Oi, ${primeiroNome(c.nome)}! 😊\n\nPassando pra lembrar do seu débito na NC Style Fitness:\n\nCompras: ${reais(c.total_fiado)}\nJá pago: ${reais(c.total_pago)}\n*Falta: ${reais(c.saldo)}*\n\nMuito obrigada, precisando estou sempre aqui para lhe atender 🤝.`;
    cob.href=`https://wa.me/${w}?text=${encodeURIComponent(msg)}`; cob.classList.remove("desligado"); cob.textContent="Cobrar no WhatsApp";
  } else {
    cob.removeAttribute("href"); cob.classList.add("desligado"); cob.textContent = w ? "Cobrar no WhatsApp" : "Sem WhatsApp cadastrado";
  }

  const hist=[
    ...vs.data.map(v=>({tipo:"venda",data:v.data,v})),
    ...ps.data.map(p=>({tipo:"pag",data:p.data,p}))
  ].sort((a,b)=>new Date(b.data)-new Date(a.data));
  const linhaAntes = antes>0 ? `
    <button class="hist-item" data-anterior>
      <span class="hist-ico fiado">−</span>
      <div><b>Dívida de antes do painel</b><small>Compras antigas, do caderninho · toque pra mudar o valor</small></div>
      <b class="dir">${reais(antes)}</b>
    </button>` : "";
  $("#cHist").innerHTML = (hist.length || antes>0) ? hist.map(h=> h.tipo==="venda" ? `
    <button class="hist-item" data-hv="${h.v.id}">
      <span class="hist-ico ${h.v.forma_pagamento==="fiado"?"fiado":""}">−</span>
      <div><b>${h.v.forma_pagamento==="fiado"?"Compra no fiado":`Compra (${FORMAS[h.v.forma_pagamento]})`}</b>
        <small>${diaCurto(h.v.data)} · ${h.v.itens_venda.map(i=>`${i.quantidade}x ${esc(i.produto_nome)} (${esc(i.cor)}/${esc(i.tamanho)})`).join(", ")}</small></div>
      <b class="dir">${reais(h.v.total)}</b>
    </button>` : `
    <div class="hist-item">
      <span class="hist-ico pago">+</span>
      <div><b>Pagou</b><small>${diaCurto(h.p.data)} · ${FORMAS[h.p.forma]}${h.p.observacao?` · ${esc(h.p.observacao)}`:""}</small>
        <span class="acoes-pag"><button class="link desfazer" data-hp="${h.p.id}" data-valor="${h.p.valor}">Desfazer</button>${w?`<a class="link desfazer" href="${linkRecibo(w,c,h.p.valor,h.p.forma,h.p.data,c.total_pago,c.saldo)}" target="_blank" rel="noopener">Mandar recibo</a>`:""}</span></div>
      <b class="dir pago">${reais(h.p.valor)}</b>
    </div>`).join("") + linhaAntes : `<p class="vazio">Nenhuma compra ou pagamento ainda.</p>`;
}
function fecharFicha(){ $("#telaCliente").hidden=true; document.body.style.overflow=""; fichaId=null; fichaCli=null; }
document.querySelectorAll("[data-fechar-cliente]").forEach(b=>b.addEventListener("click",()=>{ fecharFicha(); if(!$('[data-tela="fiado"]').hidden) renderFiado(); }));
$("#cEditar").onclick=()=>abrirCadastroCliente(fichaCli, c=>{ abrirFicha(c.id); carregarFiado(); });
$("#cHist").addEventListener("click",async e=>{
  const hv=e.target.closest("[data-hv]"), hp=e.target.closest("[data-hp]");
  if(e.target.closest("[data-anterior]")){ $("#cEditar").click(); return; }
  if(hp){
    if(!confirm(`Desfazer o pagamento de ${reais(hp.dataset.valor)}? O valor volta pra dívida e sai do caixa.`)) return;
    const { error }=await sb.from("pagamentos").delete().eq("id",hp.dataset.hp);
    if(error){ toast("Não deu pra desfazer: "+error.message,true); return; }
    toast("Pagamento desfeito."); abrirFicha(fichaId); carregarFiado();
    return;
  }
  if(hv) abrirDetalheVenda(fichaVendas.find(v=>v.id==hv.dataset.hv));
});

/* ---------- recibo do pagamento pro WhatsApp da cliente ----------
   Mostra quanto ela pagou e quanto falta agora (compras, já pago e falta, igual à cobrança). */
const FORMA_RECIBO = { pix:"no Pix", dinheiro:"em dinheiro", debito:"no cartão de débito", credito:"no cartão de crédito" };
function linkRecibo(w, c, valor, forma, data, totalPago, saldo){
  const pagou=[`Recebi seu pagamento de ${reais(valor)}`, FORMA_RECIBO[forma], `em ${diaCurto(data)}.`].filter(Boolean).join(" ");
  const msg=`Oi, ${primeiroNome(c.nome)}! 😊\n\n${pagou} Obrigada!\n\n` + (saldo>0.009
    ? `Compras: ${reais(c.total_fiado)}\nJá pago: ${reais(totalPago)}\n*Falta: ${reais(saldo)}*`
    : `*Tudo pago na NC Style Fitness!* 🎉`)
    + `\n\nMuito obrigada, precisando estou sempre aqui para lhe atender 🤝.`;
  return `https://wa.me/${w}?text=${encodeURIComponent(msg)}`;
}

/* ---------- receber pagamento ---------- */
let formaReceber=null;
$("#cReceber").onclick=()=>{
  const c=fichaCli; if(!c) return;
  formaReceber=null;
  $("#mReceberTit").textContent=`Receber de ${primeiroNome(c.nome)}`;
  $("#rDeve").textContent=`Deve ${reais(c.saldo)}. Pode receber uma parte ou tudo.`;
  $("#rValor").value=formatar(c.saldo.toFixed(2));
  $("#rData").value=hojeISO(); $("#rData").max=hojeISO();
  $("#rObs").value=""; $("#rErro").textContent="";
  chipsFormas($("#rFormas"),["pix","dinheiro","debito","credito"],null);
  $("#rForm").hidden=false; $("#rFeito").hidden=true;
  abrirModal("#mReceber");
};
$("#rFormas").addEventListener("click",e=>{
  const b=e.target.closest("[data-forma]"); if(!b) return;
  formaReceber=b.dataset.forma; chipsFormas($("#rFormas"),["pix","dinheiro","debito","credito"],formaReceber);
});
$("#rSalvar").onclick=async()=>{
  const c=fichaCli, valor=numCampo($("#rValor").value);
  if(!(valor>0)) return $("#rErro").textContent="Coloca o valor recebido.";
  if(valor>c.saldo+0.009) return $("#rErro").textContent=`O valor passa do que ele deve (${reais(c.saldo)}).`;
  if(!formaReceber) return $("#rErro").textContent="Escolhe a forma de pagamento.";
  const b=$("#rSalvar"); b.disabled=true;
  const data=dataPraBanco($("#rData").value);
  const { error }=await sb.rpc("receber_pagamento",{
    p_cliente_id:c.id, p_valor:valor, p_forma:formaReceber,
    p_data:data, p_observacao:$("#rObs").value.trim()||null
  });
  b.disabled=false;
  if(error) return $("#rErro").textContent="Não deu pra salvar: "+error.message;
  const resto=Math.round((c.saldo-valor)*100)/100, w=linkWhats(c.telefone);
  $("#rFeitoTxt").textContent=`Recebido ${reais(valor)} ${FORMA_RECIBO[formaReceber]||""}. `
    + (resto>0.009 ? `Ainda falta ${reais(resto)}.` : `${primeiroNome(c.nome)} quitou tudo! 🎉`)
    + (w ? "" : " Ela não tem WhatsApp cadastrado, então não dá pra mandar o recibo.");
  $("#rRecibo").hidden=!w;
  if(w) $("#rRecibo").href=linkRecibo(w, c, valor, formaReceber, data, c.total_pago+valor, resto);
  $("#rForm").hidden=true; $("#rFeito").hidden=false;
  abrirFicha(c.id); carregarFiado();
};
