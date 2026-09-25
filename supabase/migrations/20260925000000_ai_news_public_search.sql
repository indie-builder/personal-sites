-- Search the public projection in Postgres so Ask does not download the corpus per instance.
create extension if not exists pg_trgm with schema extensions;

alter table public.ai_news_public_items
  add column search_text text generated always as (
    lower(
      coalesce(content->>'title', '') || E'\n' ||
      coalesce(content->>'summary', '') || E'\n' ||
      coalesce(content->>'reason', '') || E'\n' ||
      coalesce(content->>'category', '') || E'\n' ||
      coalesce(content->>'sourceName', '')
    )
  ) stored;

set search_path = public, extensions;
create index ai_news_public_items_search_idx
  on public.ai_news_public_items using gin (search_text gin_trgm_ops);
reset search_path;

create function public.search_ai_news_public_items(p_query text, p_limit integer default 6)
returns table (
  id text,
  title text,
  summary text,
  reason text,
  category text,
  source_name text,
  published_at text,
  score integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with query as (
    select
      lower(btrim(p_query)) as needle,
      replace(replace(replace(lower(btrim(p_query)), '!', '!!'), '%', '!%'), '_', '!_') as pattern
  ), candidates as (
    select
      item.id,
      item.content->>'title' as title,
      item.content->>'summary' as summary,
      item.content->>'reason' as reason,
      item.content->>'category' as category,
      item.content->>'sourceName' as source_name,
      item.content->>'publishedAt' as published_at,
      lower(coalesce(item.content->>'title', '')) as title_lc,
      lower(coalesce(item.content->>'summary', '')) as summary_lc,
      lower(
        coalesce(item.content->>'reason', '') || E'\n' ||
        coalesce(item.content->>'category', '') || E'\n' ||
        coalesce(item.content->>'sourceName', '')
      ) as supporting_lc,
      query.needle
    from public.ai_news_public_items as item
    cross join query
    where query.needle <> ''
      and item.search_text like '%' || query.pattern || '%' escape '!'
  ), ranked as (
    select
      id, title, summary, reason, category, source_name, published_at,
      8 * (length(title_lc) - length(replace(title_lc, needle, ''))) / nullif(length(needle), 0)
      + 2 * (length(summary_lc) - length(replace(summary_lc, needle, ''))) / nullif(length(needle), 0)
      + (length(supporting_lc) - length(replace(supporting_lc, needle, ''))) / nullif(length(needle), 0)
        as score
    from candidates
  )
  select id, title, summary, reason, category, source_name, published_at, score
  from ranked
  where score > 0
  order by score desc, published_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 6), 12));
$$;

revoke all on function public.search_ai_news_public_items(text, integer) from public, anon, authenticated;
grant execute on function public.search_ai_news_public_items(text, integer) to anon, authenticated;
notify pgrst, 'reload schema';
