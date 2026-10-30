-- Keep the storage column/RPC argument names for existing SQL callers. The API
-- now exposes a flat ingredients array; weekly dates and order IDs are unchanged.
alter table public.weekly_food_weeks drop constraint weekly_food_weeks_menu_check;

-- Collapse published daily menus without changing quantities or matching
-- different foods/units. Unrecognized free-form quantities remain separate.
with entries as (
 select w.id, d.n * 1000 + i.n as position,
 regexp_replace(trim(i.item->>'name'),'\s+',' ','g') as name,
 trim(i.item->>'quantity') as quantity
 from public.weekly_food_weeks w
 cross join lateral jsonb_array_elements(w.menu) with ordinality d(day,n)
 cross join lateral jsonb_array_elements(d.day->'ingredients') with ordinality i(item,n)
 where d.day ? 'ingredients'
), parsed as (
 select *, regexp_match(lower(quantity),'^([0-9]+([.,][0-9]{1,3})?)\s*([^0-9[:space:]]+)$') as parts from entries
), amounts as (
 select *, case when parts[3] in ('g','kg','ml','l','lít','quả','cái','bó','củ','con','hộp','gói') and replace(parts[1],',','.')::numeric > 0
 then replace(parts[1],',','.')::numeric * case when parts[3] in ('kg','l','lít') then 1000 else 1 end end as amount,
 case parts[3] when 'kg' then 'g' when 'l' then 'ml' when 'lít' then 'ml' else parts[3] end as unit
 from parsed
), grouped as (
 select id,min(position) as position,(array_agg(name order by position))[1] as name,unit,sum(amount) as amount,
 (array_agg(quantity order by position))[1] as original
 from amounts
 group by id,lower(name),unit,case when amount is null then position end
), display as (
 select *,case when unit in ('g','ml') and amount>=1000 then amount/1000 else amount end as displayed_amount,
 case when unit='g' and amount>=1000 then 'kg' when unit='ml' and amount>=1000 then 'l' else unit end as displayed_unit
 from grouped
), converted as (
 select id,jsonb_agg(jsonb_build_object('name',name,'quantity',case when amount is null then original else
 replace(trim(trailing '.' from regexp_replace(displayed_amount::text,'(\.[0-9]*?)0+$','\1')),'.',',') || ' ' || displayed_unit end) order by position) as ingredients
 from display group by id
)
update public.weekly_food_weeks w set menu=c.ingredients from converted c where w.id=c.id;

alter table public.weekly_food_weeks add constraint weekly_food_weeks_menu_check check (
 jsonb_typeof(menu)='array' and jsonb_array_length(menu) between 1 and 350
 and not jsonb_path_exists(menu, '$[*] ? (@.type() != "object" || !exists(@.name) || !exists(@.quantity) || @.name.type() != "string" || @.quantity.type() != "string" || exists(@.day) || exists(@.lunch) || exists(@.dinner) || exists(@.ingredients))')
);
