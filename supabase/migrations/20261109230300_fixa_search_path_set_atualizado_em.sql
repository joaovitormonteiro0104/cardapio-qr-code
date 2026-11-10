-- =============================================================================
-- Fixa o search_path de set_atualizado_em (aviso do Supabase advisor 0011)
--
-- Sem search_path fixo, uma função usa o search_path de quem a chama; um
-- usuário mal-intencionado poderia criar um objeto com o mesmo nome num schema
-- que vem antes e "sequestrar" a chamada. Com search_path vazio, só resolve o
-- que é do pg_catalog (now() vem de lá), então a função continua igual.
-- =============================================================================

alter function public.set_atualizado_em() set search_path = '';
