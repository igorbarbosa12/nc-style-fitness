-- ============================================================
-- NC Style Fitness — MODA CASUAL
-- Libera as áreas "casual-feminino" e "casual-masculino" nos produtos.
-- Não mexe em nenhuma peça que já existe.
-- ============================================================
alter table produtos drop constraint if exists produtos_grupo_check;
alter table produtos add constraint produtos_grupo_check
  check (grupo in ('feminino','masculino','casual-feminino','casual-masculino','praia','acessorios'));
