-- =============================================================================
-- Bucket de fotos do cardápio (AGENTS.md §6.7)
--
-- Público para leitura (a URL pública vai em itens_cardapio.foto_url).
-- Limites de tamanho e tipo espelham a validação do storageRepo (item 5):
-- 2 MB, apenas jpeg/png/webp. O Storage recusa uploads fora disso mesmo que o
-- frontend seja burlado.
--
-- Quem pode fazer upload/remover (só gerência) é política de storage e entra
-- na migration de RLS (item 3). Até lá, ninguém consegue gravar.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cardapio-fotos',
  'cardapio-fotos',
  true,
  2097152, -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
