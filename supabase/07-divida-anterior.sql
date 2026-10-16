-- =====================================================================
-- 07 · DÍVIDA DE ANTES DO PAINEL (fiado do caderninho)
-- Cliente que já devia antes de a loja usar o painel: o valor entra no
-- saldo do fiado sem virar venda (não conta como vendido no mês, não
-- mexe no estoque e não entra no caixa). Quando ela pagar, o pagamento
-- entra no caixa normalmente, como "Recebimento de fiado".
-- Pode rodar de novo sem problema.
-- =====================================================================
alter table clientes
  add column if not exists saldo_anterior numeric(10,2) not null default 0
  check (saldo_anterior >= 0);

-- saldo do fiado = dívida anterior + compras no fiado − pagamentos
create or replace view saldo_clientes
with (security_invoker = true) as
select
  c.id,
  c.nome,
  c.telefone,
  c.saldo_anterior + coalesce(f.total_fiado, 0)                              as total_fiado,
  coalesce(p.total_pago, 0)                                                  as total_pago,
  c.saldo_anterior + coalesce(f.total_fiado, 0) - coalesce(p.total_pago, 0)  as saldo
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
