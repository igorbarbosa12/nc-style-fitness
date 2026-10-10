-- =====================================================================
-- NC STYLE FITNESS — VÍDEO DA PEÇA (opcional)
-- Guarda o endereço de um vídeo curto da peça no corpo.
-- O vídeo fica no mesmo lugar das fotos (Storage, pasta "produtos/videos").
-- Já aplicado no Supabase em 10/10/2026.
-- =====================================================================
alter table produtos add column if not exists video text;
comment on column produtos.video is 'Endereço de um vídeo curto da peça (opcional)';
