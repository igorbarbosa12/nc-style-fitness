-- ============================================================
-- NC Style Fitness — DEVOLVER UMA PEÇA DA VENDA
-- A cliente devolve só uma (ou algumas) peças, sem cancelar a venda toda:
--   * a peça volta pro estoque
--   * o valor sai do total da venda (e do fiado, se for fiado)
--   * se a venda foi paga na hora, o valor sai da entrada do caixa "Venda #N"
--   * se era a última peça, a venda some inteira (igual cancelar)
-- ============================================================
create or replace function devolver_item(p_item_id bigint, p_qtd integer default 1)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_item  record;
  v_venda record;
  v_valor numeric(10,2);
begin
  if not is_admin() then
    raise exception 'Sem permissão';
  end if;

  select * into v_item from itens_venda where id = p_item_id for update;
  if not found then
    raise exception 'Peça não encontrada nessa venda';
  end if;
  if p_qtd is null or p_qtd <= 0 or p_qtd > v_item.quantidade then
    raise exception 'Quantidade inválida: essa venda tem % dessa peça', v_item.quantidade;
  end if;

  select * into v_venda from vendas where id = v_item.venda_id for update;
  v_valor := p_qtd * v_item.preco_unitario;

  -- volta pro estoque (se a peça ainda existe no cadastro)
  if v_item.variacao_id is not null then
    update variacoes set estoque = estoque + p_qtd where id = v_item.variacao_id;
  end if;

  -- tira da venda
  if p_qtd = v_item.quantidade then
    delete from itens_venda where id = p_item_id;
  else
    update itens_venda set quantidade = quantidade - p_qtd where id = p_item_id;
  end if;

  -- era a última peça: a venda some (a entrada do caixa cai junto, on delete cascade)
  if not exists (select 1 from itens_venda where venda_id = v_venda.id) then
    delete from vendas where id = v_venda.id;
    return;
  end if;

  update vendas set total = greatest(total - v_valor, 0) where id = v_venda.id;

  -- venda paga na hora: a entrada "Venda #N" do caixa diminui junto
  if v_venda.forma_pagamento <> 'fiado' and v_valor > 0 then
    update movimentacoes set valor = valor - v_valor
     where venda_id = v_venda.id and tipo = 'entrada' and valor > v_valor;
  end if;
end;
$$;

revoke execute on function devolver_item(bigint, integer) from public, anon;
grant  execute on function devolver_item(bigint, integer) to authenticated;
