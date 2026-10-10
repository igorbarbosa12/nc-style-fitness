-- =====================================================================
-- NC STYLE FITNESS — BANCO DE DADOS (Supabase)
-- Cole tudo no SQL Editor do Supabase e clique em RUN.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. ADMINS (quem pode mexer no painel)
-- ---------------------------------------------------------------------
create table admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- função que responde "esse usuário logado é admin?"
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;


-- ---------------------------------------------------------------------
-- 2. PRODUTOS E VARIAÇÕES (cor + tamanho + estoque)
-- ---------------------------------------------------------------------
create table produtos (
  id            bigint generated always as identity primary key,
  nome          text not null,
  descricao     text,
  grupo         text not null check (grupo in ('feminino','masculino','praia','acessorios')),
  categoria     text not null,
  preco         numeric(10,2) not null check (preco >= 0),
  preco_antigo  numeric(10,2) check (preco_antigo >= 0),
  fotos         text[] not null default '{}',
  novo          boolean not null default false,
  mais_vendido  boolean not null default false,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now()
);

create table variacoes (
  id          bigint generated always as identity primary key,
  produto_id  bigint not null references produtos(id) on delete cascade,
  cor         text not null,
  cor_hex     text not null default '#2B2B2B',
  tamanho     text not null,
  preco       numeric(10,2) check (preco >= 0),   -- só preencher se o preço mudar por tamanho (ex: garrafa 1 L)
  estoque     integer not null default 0 check (estoque >= 0),
  unique (produto_id, cor, tamanho)
);


-- ---------------------------------------------------------------------
-- 3. CLIENTES, VENDAS E FIADO
-- ---------------------------------------------------------------------
create table clientes (
  id          bigint generated always as identity primary key,
  nome        text not null,
  telefone    text,
  observacao  text,
  criado_em   timestamptz not null default now()
);

create table vendas (
  id               bigint generated always as identity primary key,
  cliente_id       bigint references clientes(id) on delete restrict,
  data             timestamptz not null default now(),
  total            numeric(10,2) not null check (total >= 0),
  forma_pagamento  text not null check (forma_pagamento in ('pix','dinheiro','debito','credito','fiado')),
  observacao       text,
  -- fiado precisa ter cliente
  check (forma_pagamento <> 'fiado' or cliente_id is not null)
);

create table itens_venda (
  id              bigint generated always as identity primary key,
  venda_id        bigint not null references vendas(id) on delete cascade,
  variacao_id     bigint references variacoes(id) on delete set null,
  produto_nome    text not null,      -- guarda o nome mesmo se o produto for apagado depois
  cor             text not null,
  tamanho         text not null,
  quantidade      integer not null check (quantidade > 0),
  preco_unitario  numeric(10,2) not null check (preco_unitario >= 0)
);

-- pagamentos de fiado (pode ser parcial)
create table pagamentos (
  id          bigint generated always as identity primary key,
  cliente_id  bigint not null references clientes(id) on delete restrict,
  valor       numeric(10,2) not null check (valor > 0),
  forma       text not null check (forma in ('pix','dinheiro','debito','credito')),
  data        timestamptz not null default now(),
  observacao  text
);


-- ---------------------------------------------------------------------
-- 4. FINANCEIRO (entradas e saídas)
-- ---------------------------------------------------------------------
create table movimentacoes (
  id            bigint generated always as identity primary key,
  tipo          text not null check (tipo in ('entrada','saida')),
  valor         numeric(10,2) not null check (valor > 0),
  categoria     text not null,        -- ex: venda, recebimento fiado, fornecedor, anúncio, embalagem
  descricao     text,
  data          date not null default current_date,
  venda_id      bigint references vendas(id) on delete cascade,
  pagamento_id  bigint references pagamentos(id) on delete cascade
);


-- ---------------------------------------------------------------------
-- 5. SALDO DE CADA CLIENTE (quanto deve no fiado)
-- ---------------------------------------------------------------------
create view saldo_clientes
with (security_invoker = true) as
select
  c.id,
  c.nome,
  c.telefone,
  coalesce(f.total_fiado, 0)                              as total_fiado,
  coalesce(p.total_pago, 0)                               as total_pago,
  coalesce(f.total_fiado, 0) - coalesce(p.total_pago, 0)  as saldo
from clientes c
left join (
  select cliente_id, sum(total) as total_fiado
  from vendas where forma_pagamento = 'fiado'
  group by cliente_id
) f on f.cliente_id = c.id
left join (
  select cliente_id, sum(valor) as total_pago
  from pagamentos
  group by cliente_id
) p on p.cliente_id = c.id;


-- ---------------------------------------------------------------------
-- 6. SEGURANÇA (RLS)
-- Visitante do site: só LÊ produtos ativos.
-- Admin logado: faz tudo.
-- ---------------------------------------------------------------------
alter table admins         enable row level security;
alter table produtos       enable row level security;
alter table variacoes      enable row level security;
alter table clientes       enable row level security;
alter table vendas         enable row level security;
alter table itens_venda    enable row level security;
alter table pagamentos     enable row level security;
alter table movimentacoes  enable row level security;

-- leitura pública do catálogo
create policy "site le produtos ativos" on produtos
  for select using (ativo = true);

create policy "site le variacoes de produtos ativos" on variacoes
  for select using (exists (select 1 from produtos p where p.id = produto_id and p.ativo = true));

-- admin pode tudo
create policy "admin produtos"      on produtos      for all using (is_admin()) with check (is_admin());
create policy "admin variacoes"     on variacoes     for all using (is_admin()) with check (is_admin());
create policy "admin clientes"      on clientes      for all using (is_admin()) with check (is_admin());
create policy "admin vendas"        on vendas        for all using (is_admin()) with check (is_admin());
create policy "admin itens_venda"   on itens_venda   for all using (is_admin()) with check (is_admin());
create policy "admin pagamentos"    on pagamentos    for all using (is_admin()) with check (is_admin());
create policy "admin movimentacoes" on movimentacoes for all using (is_admin()) with check (is_admin());
create policy "admin ve admins"     on admins        for select using (user_id = auth.uid());


-- ---------------------------------------------------------------------
-- 7. FOTOS DOS PRODUTOS (Storage)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', true);

create policy "admin envia fotos" on storage.objects
  for insert to authenticated with check (bucket_id = 'produtos' and is_admin());
create policy "admin edita fotos" on storage.objects
  for update to authenticated using (bucket_id = 'produtos' and is_admin());
create policy "admin apaga fotos" on storage.objects
  for delete to authenticated using (bucket_id = 'produtos' and is_admin());


-- =====================================================================
-- DEPOIS de criar o usuário no Authentication, rode SÓ a linha abaixo
-- (num SQL novo), trocando pelo e-mail que você cadastrou:
--
-- insert into admins (user_id) select id from auth.users where email = 'EMAIL_AQUI';
-- =====================================================================
