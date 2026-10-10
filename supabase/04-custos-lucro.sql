-- =====================================================================
-- NC STYLE FITNESS — CUSTO DAS PEÇAS E LUCRO
-- Cole tudo no SQL Editor do Supabase e clique em RUN.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. CUSTO DE CADA PEÇA (cor + tamanho)
-- Fica numa tabela separada, que SÓ o admin lê.
-- (a tabela produtos é pública pro site; se o custo ficasse lá,
--  qualquer pessoa conseguiria ver quanto a loja paga em cada peça)
-- ---------------------------------------------------------------------
create table if not exists custos (
  variacao_id  bigint primary key references variacoes(id) on delete cascade,
  custo        numeric(10,2) not null check (custo >= 0)
);

alter table custos enable row level security;

drop policy if exists "admin custos" on custos;
create policy "admin custos" on custos
  for all using (is_admin()) with check (is_admin());


-- ---------------------------------------------------------------------
-- 2. CADA PEÇA VENDIDA GUARDA O CUSTO DO DIA DA VENDA
-- (se o custo mudar depois, o lucro das vendas antigas não muda)
-- ---------------------------------------------------------------------
alter table itens_venda
  add column if not exists custo_unitario numeric(10,2) check (custo_unitario >= 0);


-- ---------------------------------------------------------------------
-- 3. REGISTRAR VENDA (mesma de antes, agora salvando o custo)
-- ---------------------------------------------------------------------
create or replace function registrar_venda(
  p_itens       jsonb,
  p_forma       text,
  p_cliente_id  bigint      default null,
  p_data        timestamptz default now(),
  p_observacao  text        default null
) returns bigint
language plpgsql
set search_path = public
as $$
declare
  v_venda_id  bigint;
  v_total     numeric(10,2) := 0;
  v_item      jsonb;
  v_var       record;
  v_qtd       integer;
  v_preco     numeric(10,2);
begin
  if not is_admin() then
    raise exception 'Sem permissão';
  end if;
  if p_forma not in ('pix','dinheiro','debito','credito','fiado') then
    raise exception 'Forma de pagamento inválida';
  end if;
  if p_forma = 'fiado' and p_cliente_id is null then
    raise exception 'Venda fiado precisa de cliente';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'A venda precisa de pelo menos uma peça';
  end if;

  insert into vendas (cliente_id, data, total, forma_pagamento, observacao)
  values (p_cliente_id, coalesce(p_data, now()), 0, p_forma, nullif(trim(p_observacao), ''))
  returning id into v_venda_id;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd   := (v_item->>'quantidade')::integer;
    v_preco := (v_item->>'preco_unitario')::numeric;

    if v_qtd is null or v_qtd <= 0 then
      raise exception 'Quantidade inválida';
    end if;
    if v_preco is null or v_preco < 0 then
      raise exception 'Preço inválido';
    end if;

    select va.id, va.cor, va.tamanho, va.estoque, p.nome, c.custo
      into v_var
      from variacoes va
      join produtos p on p.id = va.produto_id
      left join custos c on c.variacao_id = va.id
     where va.id = (v_item->>'variacao_id')::bigint
       for update of va;

    if not found then
      raise exception 'Peça não encontrada (pode ter sido apagada)';
    end if;
    if v_var.estoque < v_qtd then
      raise exception 'Estoque insuficiente: % (% / %). Tem só %.', v_var.nome, v_var.cor, v_var.tamanho, v_var.estoque;
    end if;

    update variacoes set estoque = estoque - v_qtd where id = v_var.id;

    insert into itens_venda (venda_id, variacao_id, produto_nome, cor, tamanho, quantidade, preco_unitario, custo_unitario)
    values (v_venda_id, v_var.id, v_var.nome, v_var.cor, v_var.tamanho, v_qtd, v_preco, v_var.custo);

    v_total := v_total + v_qtd * v_preco;
  end loop;

  update vendas set total = v_total where id = v_venda_id;

  if p_forma <> 'fiado' and v_total > 0 then
    insert into movimentacoes (tipo, valor, categoria, descricao, data, venda_id)
    values ('entrada', v_total, 'Venda', 'Venda #' || v_venda_id,
            (coalesce(p_data, now()) at time zone 'America/Manaus')::date, v_venda_id);
  end if;

  return v_venda_id;
end;
$$;

revoke execute on function registrar_venda(jsonb, text, bigint, timestamptz, text) from public, anon;
grant  execute on function registrar_venda(jsonb, text, bigint, timestamptz, text) to authenticated;


-- ---------------------------------------------------------------------
-- 4. PREENCHER O CUSTO DE VENDAS ANTIGAS QUE FICARAM SEM
-- Usada pelo painel depois de salvar o custo de um produto:
-- só mexe em peça vendida que ainda não tinha custo nenhum.
-- ---------------------------------------------------------------------
create or replace function preencher_custos_antigos()
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_qtd integer;
begin
  if not is_admin() then
    raise exception 'Sem permissão';
  end if;
  update itens_venda i
     set custo_unitario = c.custo
    from custos c
   where i.variacao_id = c.variacao_id
     and i.custo_unitario is null;
  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;

revoke execute on function preencher_custos_antigos() from public, anon;
grant  execute on function preencher_custos_antigos() to authenticated;
