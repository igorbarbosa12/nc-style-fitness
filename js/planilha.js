/* ============================================================
   NC Style Fitness — PAINEL: CÓPIA DE SEGURANÇA (PLANILHA DO EXCEL)
   O plano grátis do Supabase não guarda cópia dos dados. Este botão baixa
   tudo numa planilha: vendas, peças vendidas, fiado, caixa e produtos.
   Usa: admin.js ($, esc, toast), vendas.js (FORMAS), dados.js (GRUPOS), sb
   ============================================================ */

/* gerador de planilha: só carrega quando ela clica no botão (~250 KB) */
const EXCEL_URL = "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js";
const EXCEL_SRI = "sha384-Pqp51FUN2/qzfxZxBCtF0stpc9ONI6MYZpVqmo8m20SoaQCzf+arZvACkLkirlPz";
const DIAS_LEMBRETE = 30;          // depois de quantos dias sem cópia aparece o aviso no Resumo
const CHAVE_COPIA = "nc-ultima-copia";

/* formatos das colunas */
const F_MOEDA = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const F_DATA  = "dd/mm/yyyy";
const F_HORA  = "dd/mm/yyyy hh:mm";

/* ---------- última cópia (fica salva só neste aparelho) ---------- */
function ultimaCopia(){
  try { const s=localStorage.getItem(CHAVE_COPIA); return s ? new Date(s) : null; } catch { return null; }
}
function precisaCopia(){
  const u=ultimaCopia();
  return !u || Date.now()-u.getTime() > DIAS_LEMBRETE*864e5;
}
function mostrarUltimaCopia(){
  const u=ultimaCopia();
  $("#planilhaInfo").textContent = u
    ? `Última cópia baixada neste aparelho: ${u.toLocaleDateString("pt-BR")}.`
    : "Nenhuma cópia baixada neste aparelho ainda.";
}

/* ---------- carregar o gerador ---------- */
let excelCarregando=null;
function carregarExcel(){
  if(window.ExcelJS) return Promise.resolve();
  return excelCarregando ||= new Promise((ok,falha)=>{
    const s=document.createElement("script");
    s.src=EXCEL_URL; s.integrity=EXCEL_SRI; s.crossOrigin="anonymous";
    s.onload=ok;
    s.onerror=()=>{ excelCarregando=null; s.remove(); falha(new Error("Não deu pra abrir o gerador de planilha. Confira a internet e tente de novo.")); };
    document.head.appendChild(s);
  });
}

/* ---------- buscar tudo (o Supabase entrega de 1000 em 1000) ---------- */
async function buscarTudo(tabela, colunas, ordens){
  const PASSO=1000; let tudo=[];
  for(let de=0;;de+=PASSO){
    let q=sb.from(tabela).select(colunas);
    ordens.forEach(([col,asc])=>{ q=q.order(col,{ascending:asc}); });
    const { data, error }=await q.range(de, de+PASSO-1);
    if(error) throw error;
    tudo=tudo.concat(data);
    if(data.length<PASSO) return tudo;
  }
}

/* ---------- datas: o Excel não tem fuso, então grava a hora do Amazonas (loja em Nhamundá),
   não importa de qual aparelho ou cidade a planilha for baixada ---------- */
const FUSO_LOJA = "America/Manaus";
const relogioLoja = new Intl.DateTimeFormat("en-US",{ timeZone:FUSO_LOJA, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hourCycle:"h23" });
const comHora = iso => {
  const p=Object.fromEntries(relogioLoja.formatToParts(new Date(iso)).map(x=>[x.type,x.value]));
  return new Date(Date.UTC(+p.year, p.month-1, +p.day, +p.hour, +p.minute));
};
const soDia   = s => { const [y,m,d]=String(s).slice(0,10).split("-").map(Number); return new Date(Date.UTC(y,m-1,d)); };
const n = v => v==null ? null : Number(v);

/* ---------- uma aba da planilha ---------- */
function novaAba(wb, nome, colunas, linhas){
  const ws=wb.addWorksheet(nome,{ views:[{ state:"frozen", ySplit:1 }] });
  ws.columns=colunas.map(([titulo,largura,formato])=>({ header:titulo, width:largura, style: formato ? { numFmt:formato } : {} }));
  if(linhas.length) ws.addRows(linhas);
  else ws.addRow(["Nada registrado ainda."]);
  ws.getRow(1).eachCell(c=>{
    c.font={ bold:true, color:{ argb:"FF2B2B2B" } };
    c.fill={ type:"pattern", pattern:"solid", fgColor:{ argb:"FFF3E3DF" } };
    c.alignment={ vertical:"middle" };
  });
  ws.getRow(1).height=22;
  if(linhas.length) ws.autoFilter={ from:{ row:1, column:1 }, to:{ row:1, column:colunas.length } };
}

/* ---------- montar e baixar ---------- */
async function baixarPlanilha(){
  const b=$("#baixarPlanilha");
  if(b.disabled) return;
  b.disabled=true; b.textContent="Preparando a planilha...";
  try{
    const [, cls, saldos, vendas, pags, movs, prods, custos]=await Promise.all([
      carregarExcel(),
      buscarTudo("clientes","id,nome,telefone,observacao",[["nome",true],["id",true]]),
      buscarTudo("saldo_clientes","id,total_fiado,total_pago,saldo",[["id",true]]),
      buscarTudo("vendas","id,data,total,forma_pagamento,observacao,cliente_id,itens_venda(produto_nome,cor,tamanho,quantidade,preco_unitario,custo_unitario)",[["data",false],["id",false]]),
      buscarTudo("pagamentos","id,cliente_id,valor,forma,data,observacao",[["data",false],["id",false]]),
      buscarTudo("movimentacoes","id,tipo,valor,categoria,descricao,data",[["data",false],["id",false]]),
      buscarTudo("produtos","id,nome,grupo,categoria,preco,ativo,variacoes(id,cor,tamanho,preco,estoque)",[["nome",true],["id",true]]),
      buscarTudo("custos","variacao_id,custo",[["variacao_id",true]]).catch(()=>[])   // sem o SQL 04, sai sem custo
    ]);
    const nomeCliente=Object.fromEntries(cls.map(c=>[c.id,c.nome]));
    const saldo=Object.fromEntries(saldos.map(s=>[s.id,s]));
    const custo=Object.fromEntries(custos.map(c=>[c.variacao_id,c.custo]));

    const wb=new ExcelJS.Workbook();
    wb.creator="NC Style Fitness"; wb.created=new Date();

    novaAba(wb,"Vendas",
      [["Nº",7],["Data",17,F_HORA],["Cliente",24],["Pagamento",12],["Peças",8],["Total",13,F_MOEDA],["Observação",32]],
      vendas.map(v=>[v.id, comHora(v.data), nomeCliente[v.cliente_id]||null, FORMAS[v.forma_pagamento]||v.forma_pagamento,
        v.itens_venda.reduce((s,i)=>s+i.quantidade,0), n(v.total), v.observacao||null]));

    novaAba(wb,"Peças vendidas",
      [["Venda nº",9],["Data",17,F_HORA],["Cliente",22],["Peça",30],["Cor",14],["Tamanho",10],["Qtd",6],
       ["Preço un.",12,F_MOEDA],["Total",12,F_MOEDA],["Custo un.",12,F_MOEDA],["Lucro",12,F_MOEDA]],
      vendas.flatMap(v=>v.itens_venda.map(i=>{
        const preco=Number(i.preco_unitario), c=n(i.custo_unitario);
        return [v.id, comHora(v.data), nomeCliente[v.cliente_id]||null, i.produto_nome, i.cor, i.tamanho, i.quantidade,
          preco, preco*i.quantidade, c, c==null ? null : (preco-c)*i.quantidade];
      })));

    novaAba(wb,"Fiado",
      [["Cliente",26],["Telefone",17],["Comprou no fiado",16,F_MOEDA],["Já pagou",13,F_MOEDA],["Falta pagar",13,F_MOEDA],["Observação",32]],
      cls.map(c=>{ const s=saldo[c.id]||{};
        return [c.nome, c.telefone||null, n(s.total_fiado)??0, n(s.total_pago)??0, n(s.saldo)??0, c.observacao||null]; })
        .sort((a,b)=>b[4]-a[4]||a[0].localeCompare(b[0],"pt-BR")));

    novaAba(wb,"Pagamentos do fiado",
      [["Data",17,F_HORA],["Cliente",26],["Valor",13,F_MOEDA],["Forma",12],["Observação",32]],
      pags.map(p=>[comHora(p.data), nomeCliente[p.cliente_id]||null, n(p.valor), FORMAS[p.forma]||p.forma, p.observacao||null]));

    novaAba(wb,"Caixa",
      [["Data",12,F_DATA],["Categoria",24],["Descrição",34],["Entrada",13,F_MOEDA],["Saída",13,F_MOEDA]],
      movs.map(m=>[soDia(m.data), m.categoria, m.descricao||null,
        m.tipo==="entrada" ? n(m.valor) : null, m.tipo==="saida" ? n(m.valor) : null]));

    novaAba(wb,"Produtos",
      [["Nº",6],["Produto",30],["Área",12],["Categoria",20],["Cor",16],["Tamanho",10],["Preço",12,F_MOEDA],["Estoque",9],["Custo",12,F_MOEDA],["No site",9]],
      prods.flatMap(p=>{
        const area=GRUPOS[p.grupo]?.nome||p.grupo, site=p.ativo?"Sim":"Não";
        const vars=(p.variacoes||[]).slice().sort((a,b)=>a.cor.localeCompare(b.cor,"pt-BR")||a.id-b.id);
        if(!vars.length) return [[p.id, p.nome, area, p.categoria, null, null, n(p.preco), 0, null, site]];
        return vars.map(v=>[p.id, p.nome, area, p.categoria, v.cor, v.tamanho, n(v.preco??p.preco), v.estoque, n(custo[v.id]), site]);
      }));

    const dados=await wb.xlsx.writeBuffer();
    const arquivo=new Blob([dados],{ type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a=document.createElement("a");
    a.href=URL.createObjectURL(arquivo);
    a.download=`nc-style-fitness-copia-${new Date().toLocaleDateString("sv-SE",{ timeZone:FUSO_LOJA })}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),60000);

    try { localStorage.setItem(CHAVE_COPIA,new Date().toISOString()); } catch {}
    mostrarUltimaCopia();
    tirarLembrete();
    toast(`Planilha baixada: ${vendas.length} ${vendas.length===1?"venda":"vendas"}, ${prods.length} ${prods.length===1?"produto":"produtos"}.`);
  }catch(erro){
    console.error(erro);
    toast(erro.message?.startsWith("Não deu") ? erro.message : "Não deu pra gerar a planilha: "+(erro.message||erro), true);
  }finally{
    b.disabled=false; b.textContent="Baixar planilha";
  }
}

/* aviso no "Atenção" do Resumo (o financeiro.js chama precisaCopia) */
function tirarLembrete(){
  const lista=$("#rsAtencao");
  lista.querySelectorAll("[data-copia]").forEach(e=>e.remove());
  if(!lista.children.length) lista.innerHTML=`<p class="dica">Tudo em ordem: nada esgotado e ninguém devendo. 🎉</p>`;
}

$("#baixarPlanilha").addEventListener("click",baixarPlanilha);
$("#rsAtencao").addEventListener("click",e=>{ if(e.target.closest("[data-copia]")) baixarPlanilha(); });
mostrarUltimaCopia();
