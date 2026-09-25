-- Two-character Chinese searches have no useful trigrams. Scan the small public
-- projection in Postgres rather than fetching it into every application instance.
drop index if exists public.ai_news_public_items_search_idx;

create or replace function public.search_ai_news_public_items(p_query text, p_limit integer default 6)
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
  with search_term as (
    select lower(btrim(p_query)) as needle
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
      search_term.needle
    from public.ai_news_public_items as item
    cross join search_term
    where search_term.needle <> ''
      and strpos(item.search_text, search_term.needle) > 0
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

-- ponytail: sequential scan of the public projection; add a CJK-aware index if corpus growth makes p95 slow.
notify pgrst, 'reload schema';
