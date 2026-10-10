-- NC STYLE FITNESS — foto por cor
-- Guarda qual foto é de qual cor: { "url da foto": "Nome da cor" }
alter table produtos add column if not exists foto_cores jsonb not null default '{}'::jsonb;
