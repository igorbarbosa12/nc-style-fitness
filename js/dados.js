/* NC Style Fitness — DADOS DA LOJA
   Aqui você muda WhatsApp, horário, avisos e categorias.
   Os produtos vêm do banco (painel admin.html).
*/

/* ============================================================
   CONFIGURAÇÃO
   ============================================================ */
const WHATSAPP  = "5592994529440";            // 55 + DDD + número
const INSTAGRAM = "https://instagram.com/nc_stylefitness";

/* Informações do rodapé e da faixa de números.
   Deixe "" (vazio) pra esconder o que não quiser mostrar. */
const LOJA = {
  horario:   "Segunda a sábado, das 9h às 19h",
  pagamento: "Pix, cartão de crédito e débito, e dinheiro",
  anos:      "3",        // anos de loja
  clientes:  "500+",     // clientes atendidas
  demo:      true        // true = mostra no rodapé que é site de demonstração
};

/* Mensagens da faixa do topo (vão alternando) */
const AVISOS = [
  "Faça seu pedido direto pelo WhatsApp",
  "Moda fitness feminina e masculina",
  "Do treino ao look casual"
];

/* Áreas da loja e as categorias de cada uma.
   foto: imagem do card "Escolha sua área". O painel também usa essa lista. */
const GRUPOS = {
  feminino:   { nome:"Feminino",   foto:"img/fotos/cat-feminino.webp",
                cats:["Conjunto de Leg","Conjunto de Short","Macaquinho","Macacão","Cropped","Blusa Feminina","Blusa de Tule"] },
  masculino:  { nome:"Masculino",  foto:"img/fotos/cat-masculino.webp",
                cats:["Camisa Masculina","Short Masculino"] },
  praia:      { nome:"Moda Praia", foto:"img/fotos/cat-moda-praia.webp",
                cats:["Biquíni"] },
  acessorios: { nome:"Acessórios", foto:"img/fotos/cat-acessorios.webp",
                cats:["Garrafas","Meias","Boné"] }
};

/* Até quantas peças no estoque aparece o selo "Últimas peças" */
const POUCAS_PECAS = 3;

/* ============================================================
   PRODUTOS — vêm do banco (cadastrados no painel admin.html)
   ============================================================ */
let PRODUTOS = [];

async function carregarProdutosDoBanco(){
  const { data, error } = await sb
    .from("produtos")
    .select("*, variacoes(*)")
    .eq("ativo", true)
    .order("criado_em", { ascending:false });
  if(error) throw error;

  PRODUTOS = data.filter(p => p.variacoes.length).map(p => {
    const cores = [], tams = [], esgotado = [], precos = {};
    let total = 0;
    p.variacoes.sort((a,b) => a.id - b.id).forEach(v => {
      if(!cores.some(c => c[0] === v.cor)) cores.push([v.cor, v.cor_hex]);
      if(!tams.includes(v.tamanho)) tams.push(v.tamanho);
      if(v.estoque <= 0) esgotado.push(v.cor + "|" + v.tamanho);
      if(v.preco != null) precos[v.tamanho] = Number(v.preco);
      total += Math.max(0, v.estoque);
    });
    return {
      id: p.id, nome: p.nome, descricao: p.descricao || "", cat: p.categoria, grupo: p.grupo,
      preco: Number(p.preco), precoAntigo: p.preco_antigo ? Number(p.preco_antigo) : null,
      foto: p.fotos[0] || "", fotos: p.fotos, fotoCores: p.foto_cores || {},
      novo: p.novo, maisVendido: p.mais_vendido,
      cores, tams, esgotado,
      precos: Object.keys(precos).length ? precos : null,
      semEstoque: total === 0,
      poucas: total > 0 && total <= POUCAS_PECAS
    };
  });
}

/* Desenhos provisórios por categoria (aparecem só em produto sem foto) */
const ICONES = {
  "Conjunto de Leg":"M36 10h6q8 10 16 0h6l2 22q-16 5-32 0Z M34 38H66L69 92H56L50 58L44 92H31Z",
  "Conjunto de Short":"M36 14h6q8 10 16 0h6l2 22q-16 5-32 0Z M30 46H70L75 80H56L50 64L44 80H25Z",
  "Macaquinho":"M36 12H44Q50 22 56 12H64L66 44L74 80H54L50 62L46 80H26L34 44Z",
  "Macacão":"M37 8H44Q50 17 56 8H63L65 38L69 92H56L50 56L44 92H31L35 38Z",
  "Cropped":"M30 22L38 22Q50 36 62 22L70 22L74 62Q50 70 26 62Z",
  "Blusa Feminina":"M38 18L24 26L16 42L28 47L32 40V84H68V40L72 47L84 42L76 26L62 18Q50 28 38 18Z",
  "Blusa de Tule":"M38 14L22 20L8 62L18 65L32 36V86H68V36L82 65L92 62L78 20L62 14Q50 24 38 14Z",
  "Camisa Masculina":"M35 16L20 24L12 42L25 48L29 40V86H71V40L75 48L88 42L80 24L65 16Q50 26 35 16Z",
  "Short Masculino":"M26 24H74L80 74H56L50 50L44 74H20Z M26 32H74",
  "Biquíni":"M28 20L48 23L38 42Z M52 23L72 20L62 42Z M48 23Q50 21 52 23 M26 58H74L58 80H42Z",
  "Garrafas":"M42 8H58V18H42Z M38 20H62Q66 24 66 30V86Q66 90 62 90H38Q34 90 34 86V30Q34 24 38 20Z M34 42H66",
  "Meias":"M40 12H60V58L74 70Q80 78 72 84L50 88Q36 88 40 76Z M40 22H60",
  "Boné":"M20 62Q22 30 50 28Q78 30 80 62Z M20 62Q8 64 6 70Q30 72 50 62 M50 28V62"
};
