-- =====================================================================
-- NC STYLE FITNESS — VENDAS E FIADO
-- Cole tudo no SQL Editor do Supabase e clique em RUN.
-- Fuso usado nas datas do financeiro: Manaus (DDD 92)
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. REGISTRAR VENDA
-- Faz tudo de uma vez (ou nada, se der erro):
--   cria a venda, salva as peças, baixa o estoque
--   e, se não for fiado, lança a entrada no financeiro.
-- p_itens: [{"variacao_id": 1, "quantidade": 2, "preco_unitario": 99.90}, ...]
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

    select va.id, va.cor, va.tamanho, va.estoque, p.nome
      into v_var
      from variacoes va
      join produtos p on p.id = va.produto_id
     where va.id = (v_item->>'variacao_id')::bigint
       for update of va;

    if not found then
      raise exception 'Peça não encontrada (pode ter sido apagada)';
    end if;
    if v_var.estoque < v_qtd then
      raise exception 'Estoque insuficiente: % (% / %). Tem só %.', v_var.nome, v_var.cor, v_var.tamanho, v_var.estoque;
    end if;

    update variacoes set estoque = estoque - v_qtd where id = v_var.id;

    insert into itens_venda (venda_id, variacao_id, produto_nome, cor, tamanho, quantidade, preco_unitario)
    values (v_venda_id, v_var.id, v_var.nome, v_var.cor, v_var.tamanho, v_qtd, v_preco);

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


-- ---------------------------------------------------------------------
-- 2. CANCELAR VENDA (registrou errado)
-- Devolve as peças pro estoque e apaga a venda
-- (a entrada no financeiro some junto).
-- ---------------------------------------------------------------------
create or replace function cancelar_venda(p_venda_id bigint)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Sem permissão';
  end if;

  update variacoes va
     set estoque = va.estoque + s.qtd
    from (
      select variacao_id, sum(quantidade) as qtd
        from itens_venda
       where venda_id = p_venda_id and variacao_id is not null
       group by variacao_id
    ) s
   where va.id = s.variacao_id;

  delete from vendas where id = p_venda_id;
  if not found then
    raise exception 'Venda não encontrada';
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 3. RECEBER PAGAMENTO DE FIADO (pode ser parcial)
-- Salva o pagamento e lança a entrada no financeiro.
-- ---------------------------------------------------------------------
create or replace function receber_pagamento(
  p_cliente_id  bigint,
  p_valor       numeric,
  p_forma       text,
  p_data        timestamptz default now(),
  p_observacao  text        default null
) returns bigint
language plpgsql
set search_path = public
as $$
declare
  v_saldo  numeric(10,2);
  v_nome   text;
  v_pag_id bigint;
begin
  if not is_admin() then
    raise exception 'Sem permissão';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'Valor inválido';
  end if;
  if p_forma not in ('pix','dinheiro','debito','credito') then
    raise exception 'Forma de pagamento inválida';
  end if;

  select saldo, nome into v_saldo, v_nome from saldo_clientes where id = p_cliente_id;
  if not found then
    raise exception 'Cliente não encontrada';
  end if;
  if p_valor > v_saldo + 0.009 then
    raise exception 'Valor maior que o saldo devedor (R$ %)', replace(to_char(v_saldo, 'FM9999990.00'), '.', ',');
  end if;

  insert into pagamentos (cliente_id, valor, forma, data, observacao)
  values (p_cliente_id, p_valor, p_forma, coalesce(p_data, now()), nullif(trim(p_observacao), ''))
  returning id into v_pag_id;

  insert into movimentacoes (tipo, valor, categoria, descricao, data, pagamento_id)
  values ('entrada', p_valor, 'Recebimento de fiado', 'Pagamento de ' || v_nome,
          (coalesce(p_data, now()) at time zone 'America/Manaus')::date, v_pag_id);

  return v_pag_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. PERMISSÕES: só usuário logado chama essas funções
-- (e lá dentro ainda confere se é admin)
-- ---------------------------------------------------------------------
revoke execute on function registrar_venda(jsonb, text, bigint, timestamptz, text) from public, anon;
revoke execute on function cancelar_venda(bigint)                                  from public, anon;
revoke execute on function receber_pagamento(bigint, numeric, text, timestamptz, text) from public, anon;

grant execute on function registrar_venda(jsonb, text, bigint, timestamptz, text) to authenticated;
grant execute on function cancelar_venda(bigint)                                  to authenticated;
grant execute on function receber_pagamento(bigint, numeric, text, timestamptz, text) to authenticated;
