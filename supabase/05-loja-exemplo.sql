-- =====================================================================
-- NC STYLE FITNESS — LOJA DE EXEMPLO (dados fictícios pra demonstração)
-- ATENÇÃO: APAGA todos os produtos, vendas, clientes, pagamentos e o
-- caixa, e cadastra uma loja de exemplo no lugar. Os logins não mudam.
-- As fotos ficam na pasta img/fotos do site.
-- =====================================================================

-- 1. LIMPAR TUDO (menos os logins)
truncate movimentacoes, pagamentos, itens_venda, vendas, clientes, custos, variacoes, produtos restart identity;


-- 2. AJUDANTES (só existem durante esta execução)
create or replace function pg_temp.prod(
  p_nome text, p_grupo text, p_cat text, p_preco numeric, p_desc text,
  p_fotos text[], p_fc jsonb, p_novo boolean, p_mv boolean, p_ordem int
) returns bigint language sql as $$
  insert into produtos (nome, descricao, grupo, categoria, preco, fotos, foto_cores, novo, mais_vendido, ativo, criado_em)
  values (p_nome, p_desc, p_grupo, p_cat, p_preco, p_fotos, p_fc, p_novo, p_mv, true, now() - make_interval(mins => p_ordem))
  returning id;
$$;

-- uma cor em vários tamanhos: p_tams e p_est na mesma ordem
create or replace function pg_temp.cor(
  p_prod bigint, p_cor text, p_hex text, p_tams text[], p_est int[], p_custo numeric, p_precos numeric[] default null
) returns void language plpgsql as $$
declare i int; v bigint; c numeric;
begin
  for i in 1 .. array_length(p_tams, 1) loop
    insert into variacoes (produto_id, cor, cor_hex, tamanho, estoque, preco)
    values (p_prod, p_cor, p_hex, p_tams[i], p_est[i], case when p_precos is null then null else p_precos[i] end)
    returning id into v;
    c := case when p_precos is null then p_custo else round(p_precos[i] * 0.45, 2) end;
    insert into custos (variacao_id, custo) values (v, c);
  end loop;
end $$;


-- 3. PRODUTOS
do $$
declare p bigint;
  f text := 'img/fotos/';
begin
  p := pg_temp.prod('Conjunto Leg Canelada', 'feminino', 'Conjunto de Leg', 159.90,
    'Tecido canelado com elastano, legging de cintura alta e top com bojo removível. Não marca e não fica transparente no agachamento.',
    array[f||'prod-conjunto-leg-rose.webp'], '{}', true, true, 1);
  perform pg_temp.cor(p, 'Rosé', '#C9837F', array['P','M','G','GG'], array[4,6,3,0], 72);

  p := pg_temp.prod('Conjunto Leg Essencial', 'feminino', 'Conjunto de Leg', 139.90,
    'Poliamida de toque gelado, cós alto que segura bem e top nadador de alças duplas. O conjunto que vai do treino pra rua.',
    array[f||'banner-1-celular.webp', f||'cat-feminino.webp'],
    jsonb_build_object(f||'banner-1-celular.webp', 'Rosé', f||'cat-feminino.webp', 'Preto'), false, true, 2);
  perform pg_temp.cor(p, 'Rosé',  '#C98A86', array['P','M','G','GG'], array[3,5,4,2], 62);
  perform pg_temp.cor(p, 'Preto', '#2B2B2B', array['P','M','G','GG'], array[5,7,4,3], 62);

  p := pg_temp.prod('Conjunto Short Canelado', 'feminino', 'Conjunto de Short', 119.90,
    'Short de cintura alta com 12 cm de perna e top de costas cruzadas. Canelado firme, que não enrola na coxa.',
    array[f||'prod-conjunto-short-oliva.webp'], '{}', true, false, 3);
  perform pg_temp.cor(p, 'Verde Oliva', '#5F6A3E', array['P','M','G'], array[3,4,2], 52);

  p := pg_temp.prod('Conjunto Short Biker', 'feminino', 'Conjunto de Short', 129.90,
    'Bermuda biker com cós largo e top de alcinhas duplas. Fica lindo com uma camisa aberta por cima.',
    array[f||'banner-2-celular.webp'], '{}', false, true, 4);
  perform pg_temp.cor(p, 'Café', '#5A4034', array['P','M','G'], array[2,5,3], 56);

  p := pg_temp.prod('Macaquinho Alcinha', 'feminino', 'Macaquinho', 139.90,
    'Peça única de alcinhas cruzadas nas costas, com bojo e short de 10 cm. Tecido sem costura na frente.',
    array[f||'prod-macaquinho-terracota.webp'], '{}', false, true, 5);
  perform pg_temp.cor(p, 'Terracota', '#B5654A', array['P','M','G'], array[2,4,3], 60);

  p := pg_temp.prod('Macacão Longo', 'feminino', 'Macacão', 189.90,
    'Macacão inteiro de poliamida com alças finas e costas abertas. Modela sem apertar.',
    array[f||'prod-macacao-preto.webp'], '{}', true, false, 6);
  perform pg_temp.cor(p, 'Preto', '#2B2B2B', array['P','M','G'], array[2,3,2], 85);

  p := pg_temp.prod('Top Cropped Faixa', 'feminino', 'Cropped', 69.90,
    'Top faixa sem alças, com elástico de silicone por dentro pra não descer. Combina com qualquer legging.',
    array[f||'prod-cropped-faixa-rose.webp'], '{}', false, false, 7);
  perform pg_temp.cor(p, 'Rosé', '#C77E80', array['P','M','G'], array[4,6,3], 28);

  p := pg_temp.prod('Blusa de Tule Manga Longa', 'feminino', 'Blusa de Tule', 89.90,
    'Tule leve e transparente pra usar por cima do top. Manga longa com punho e barra reta.',
    array[f||'prod-blusa-tule-preta.webp'], '{}', false, false, 8);
  perform pg_temp.cor(p, 'Preto', '#2B2B2B', array['P','M','G'], array[1,1,0], 38);

  p := pg_temp.prod('Camisa Dry Fit', 'masculino', 'Camisa Masculina', 79.90,
    'Tecido dry fit que seca rápido, manga raglan e gola careca. Leve pro treino e pro dia a dia.',
    array[f||'prod-camisa-masc-azul.webp', f||'cat-masculino.webp', f||'banner-3-celular.webp'],
    jsonb_build_object(f||'prod-camisa-masc-azul.webp', 'Azul Marinho', f||'cat-masculino.webp', 'Cinza', f||'banner-3-celular.webp', 'Preto'), false, true, 9);
  perform pg_temp.cor(p, 'Azul Marinho', '#2A3550', array['P','M','G','GG'], array[3,5,5,2], 32);
  perform pg_temp.cor(p, 'Cinza',        '#6B6B6E', array['P','M','G','GG'], array[2,4,4,2], 32);
  perform pg_temp.cor(p, 'Preto',        '#2B2B2B', array['P','M','G','GG'], array[4,6,5,3], 32);

  p := pg_temp.prod('Short Tactel', 'masculino', 'Short Masculino', 69.90,
    'Short de tactel com bolsos laterais, elástico com cordão e perna de 15 cm.',
    array[f||'prod-short-masc-preto.webp', f||'banner-3-celular.webp'],
    jsonb_build_object(f||'prod-short-masc-preto.webp', 'Preto', f||'banner-3-celular.webp', 'Cinza'), false, false, 10);
  perform pg_temp.cor(p, 'Preto', '#2B2B2B', array['P','M','G','GG'], array[3,5,4,2], 29);
  perform pg_temp.cor(p, 'Cinza', '#6B6B6E', array['P','M','G','GG'], array[2,3,3,1], 29);

  p := pg_temp.prod('Biquíni Cortininha', 'praia', 'Biquíni', 119.90,
    'Top cortininha de amarrar no pescoço e calcinha de lacinho nas laterais. Ponteiras douradas.',
    array[f||'cat-moda-praia.webp'], '{}', true, false, 11);
  perform pg_temp.cor(p, 'Caramelo', '#A8693B', array['P','M','G'], array[3,4,2], 48);

  p := pg_temp.prod('Garrafa Térmica', 'acessorios', 'Garrafas', 49.90,
    'Inox de parede dupla: gelada por até 24 horas e quente por até 12. Não sua por fora.',
    array[f||'prod-garrafa-rose.webp'], '{}', false, true, 12);
  perform pg_temp.cor(p, 'Rosé', '#D9A5A0', array['500 ml','750 ml','1 L'], array[6,4,3], null, array[49.90, 59.90, 69.90]);

  p := pg_temp.prod('Kit 3 Meias Cano Médio', 'acessorios', 'Meias', 29.90,
    'Três pares de algodão com punho canelado e sola acolchoada.',
    array[f||'prod-meias-brancas.webp'], '{}', false, false, 13);
  perform pg_temp.cor(p, 'Branco', '#F1EEE9', array['Único'], array[12], 11);

  p := pg_temp.prod('Boné Dad Hat', 'acessorios', 'Boné', 49.90,
    'Algodão lavado, aba curva e regulagem de fivela atrás.',
    array[f||'prod-bone-bege.webp'], '{}', false, false, 14);
  perform pg_temp.cor(p, 'Bege', '#CDBBA3', array['Único'], array[6], 19);
end $$;


-- 4. CLIENTES DO FIADO (nomes inventados)
insert into clientes (nome, observacao) values
  ('Carla Mendes', 'Paga sempre no dia 10'),
  ('Juliana Rocha', null),
  ('Patrícia Lima', 'Prefere Pix'),
  ('Fernanda Souza', null),
  ('Renata Alves', null),
  ('Bianca Costa', 'Cliente desde o começo da loja');


-- 5. SEIS MESES DE VENDAS, FIADO E CAIXA
do $$
declare
  tz constant text := 'America/Manaus';
  agora timestamptz := now();
  inicio date := (date_trunc('month', agora at time zone tz) - interval '5 months')::date;
  m int; n int; k int; j int; q int;
  mes_ini date; ult_dia int; dia int;
  v_data timestamptz; v_id bigint; v_total numeric; v_forma text; v_cli bigint;
  r record; x float; venda_qtd int[] := array[11, 15, 18, 21, 25, 0];
  pago numeric; deve numeric; p_data timestamptz; parte numeric;
begin
  perform setseed(0.42);

  for m in 0 .. 5 loop
    mes_ini := (inicio + make_interval(months => m))::date;
    ult_dia := extract(day from (mes_ini + interval '1 month - 1 day'))::int;
    if m = 5 then
      ult_dia := extract(day from (agora at time zone tz))::int;
      n := greatest(3, round(ult_dia * 0.85)::int);
    else
      n := venda_qtd[m + 1];
    end if;

    for k in 1 .. n loop
      dia := 1 + floor(random() * ult_dia)::int;
      v_data := ((mes_ini + (dia - 1)) + make_interval(hours => 9 + floor(random() * 11)::int, mins => floor(random() * 60)::int)) at time zone tz;
      if v_data > agora then v_data := agora - make_interval(hours => 1 + floor(random() * 5)::int); end if;

      x := random();
      v_forma := case when x < 0.42 then 'pix' when x < 0.62 then 'credito' when x < 0.72 then 'debito' when x < 0.84 then 'dinheiro' else 'fiado' end;
      v_cli := case when v_forma = 'fiado' then (select id from clientes order by random() limit 1) else null end;

      insert into vendas (cliente_id, data, total, forma_pagamento) values (v_cli, v_data, 0, v_forma) returning id into v_id;

      q := case when random() < 0.62 then 1 when random() < 0.8 then 2 else 3 end;
      v_total := 0;
      for j in 1 .. q loop
        select va.id, va.cor, va.tamanho, coalesce(va.preco, p.preco) as preco, c.custo, p.nome
          into r
          from variacoes va join produtos p on p.id = va.produto_id left join custos c on c.variacao_id = va.id
         order by (case when p.mais_vendido then 2.2 else 1 end) * random() desc
         limit 1;
        insert into itens_venda (venda_id, variacao_id, produto_nome, cor, tamanho, quantidade, preco_unitario, custo_unitario)
        values (v_id, r.id, r.nome, r.cor, r.tamanho, 1, r.preco, r.custo);
        v_total := v_total + r.preco;
      end loop;

      update vendas set total = v_total where id = v_id;
      if v_forma <> 'fiado' then
        insert into movimentacoes (tipo, valor, categoria, descricao, data, venda_id)
        values ('entrada', v_total, 'Venda', 'Venda #' || v_id, (v_data at time zone tz)::date, v_id);
      end if;
    end loop;
  end loop;

  -- pagamentos do fiado: o que é antigo já foi pago, o recente ainda está aberto
  for r in select v.id, v.cliente_id, v.data, v.total, c.nome from vendas v join clientes c on c.id = v.cliente_id
           where v.forma_pagamento = 'fiado' order by v.data loop
    if r.data < agora - interval '50 days' then parte := 1;
    elsif r.data < agora - interval '20 days' then parte := 0.5;
    else parte := 0; end if;
    if parte > 0 then
      pago := round(r.total * parte, 2);
      p_data := least(agora - interval '1 day', r.data + make_interval(days => 10 + floor(random() * 15)::int));
      insert into pagamentos (cliente_id, valor, forma, data) values (r.cliente_id, pago, case when random() < 0.7 then 'pix' else 'dinheiro' end, p_data)
      returning id into v_id;
      insert into movimentacoes (tipo, valor, categoria, descricao, data, pagamento_id)
      values ('entrada', pago, 'Recebimento de fiado', 'Pagamento de ' || r.nome, (p_data at time zone tz)::date, v_id);
    end if;
  end loop;

  -- saídas de cada mês
  for m in 0 .. 5 loop
    mes_ini := (inicio + make_interval(months => m))::date;
    insert into movimentacoes (tipo, valor, categoria, descricao, data) values
      ('saida', case when m = 0 then 2650.00 else round((900 + random() * 500)::numeric, 2) end, 'Fornecedor / mercadoria',
       case when m = 0 then 'Estoque inicial da coleção' else 'Reposição de peças' end, mes_ini + 2);
    if m < 5 then
      insert into movimentacoes (tipo, valor, categoria, descricao, data) values
        ('saida', round((120 + random() * 60)::numeric, 2), 'Anúncio', 'Impulsionamento no Instagram', mes_ini + 7),
        ('saida', round((55 + random() * 35)::numeric, 2), 'Embalagem', 'Sacolas e papel de seda', mes_ini + 12),
        ('saida', round((40 + random() * 50)::numeric, 2), 'Frete', 'Envio de pedidos', mes_ini + 20);
    end if;
    insert into movimentacoes (tipo, valor, categoria, descricao, data)
    select 'saida', round(sum(total) * 0.035, 2), 'Taxa de cartão', 'Taxa da maquininha', least((agora at time zone tz)::date, mes_ini + 27)
      from vendas
     where forma_pagamento in ('credito', 'debito')
       and (data at time zone tz)::date >= mes_ini and (data at time zone tz)::date < (mes_ini + interval '1 month')::date
    having sum(total) > 0;
  end loop;
end $$;
