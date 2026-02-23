-- ============================================================
-- HomeQuest — Schema Migration v7
-- Family Number + Kid PIN Join + Parent Portal PIN
-- ============================================================
-- Adds:
--   A) families.family_number: unique short code for kid join flow
--   B) children.child_pin_hash: bcrypt hash for kid PIN
--   C) family_settings: parent portal PIN columns
--   D) kid_sessions table: token-based kid sessions
--   E) RPCs: verify_kid_join, kid_get_catalog, kid_get_points,
--      kid_toggle_chore, kid_redeem_reward, set_child_pin,
--      set/verify/disable_parent_portal_pin
--
-- SAFE to run in Supabase SQL Editor.
-- Run AFTER v6 migration.
-- Requires pgcrypto extension (enabled by default in Supabase).
-- ============================================================

begin;

-- Ensure pgcrypto is available
create extension if not exists pgcrypto;

-- ============================================================
-- 1) Family Number: unique short code on families table
-- ============================================================

alter table public.families
  add column if not exists family_number text;

create or replace function generate_family_number()
returns text
language plpgsql
as $$
declare
  v_code text;
  v_exists boolean;
begin
  loop
    v_code := upper(substr(replace(encode(gen_random_bytes(4), 'base64'), '/', ''), 1, 6));
    select exists(select 1 from public.families where family_number = v_code) into v_exists;
    if not v_exists then
      return v_code;
    end if;
  end loop;
end;
$$;

update public.families
set family_number = generate_family_number()
where family_number is null;

alter table public.families
  alter column family_number set not null,
  alter column family_number set default generate_family_number();

drop index if exists idx_families_family_number;
create unique index idx_families_family_number on public.families(family_number);

-- ============================================================
-- 2) Children: add child_pin_hash column
-- ============================================================

alter table public.children
  add column if not exists child_pin_hash text;

-- ============================================================
-- 3) Family Settings: parent portal PIN columns
-- ============================================================

alter table public.family_settings
  add column if not exists parent_portal_pin_hash text,
  add column if not exists parent_portal_pin_enabled boolean not null default false,
  add column if not exists parent_portal_pin_timeout_minutes int not null default 15;

-- ============================================================
-- 4) Kid Sessions table
-- ============================================================

create table if not exists public.kid_sessions (
  id uuid primary key default gen_random_uuid(),
  kid_token text not null unique,
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_kid_sessions_token on public.kid_sessions(kid_token);
create index if not exists idx_kid_sessions_expires on public.kid_sessions(expires_at);

-- No RLS on kid_sessions — accessed only via security definer RPCs

-- ============================================================
-- 5) Helper: validate_kid_token
-- ============================================================

create or replace function validate_kid_token(p_kid_token text)
returns table(family_id uuid, child_id uuid)
language plpgsql
security definer
as $$
begin
  return query
    select ks.family_id, ks.child_id
    from public.kid_sessions ks
    where ks.kid_token = p_kid_token
      and ks.expires_at > now();

  if not found then
    raise exception 'Invalid or expired kid session token'
      using hint = 'Re-join using Family Number + PIN';
  end if;
end;
$$;

-- ============================================================
-- 6) RPC: verify_kid_join
-- ============================================================

create or replace function verify_kid_join(
  p_family_number text,
  p_pin text
)
returns json
language plpgsql
security definer
as $$
declare
  v_family_id uuid;
  v_family_pin_hash text;
  v_token text;
  v_children json;
begin
  select f.id into v_family_id
  from public.families f
  where f.family_number = upper(trim(p_family_number));

  if v_family_id is null then
    return json_build_object('ok', false, 'error', 'family_not_found');
  end if;

  -- Check if any child in this family has this PIN
  -- We verify against ALL children's PINs; if match, return all children
  if not exists (
    select 1 from public.children c
    where c.family_id = v_family_id
      and c.child_pin_hash is not null
      and c.child_pin_hash = crypt(p_pin, c.child_pin_hash)
  ) then
    return json_build_object('ok', false, 'error', 'invalid_pin');
  end if;

  -- Generate kid session token
  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.kid_sessions (kid_token, family_id, expires_at)
  values (v_token, v_family_id, now() + interval '24 hours');

  -- Return children list
  select json_agg(json_build_object(
    'child_id', c.id,
    'display_name', c.display_name
  ) order by c.created_at)
  into v_children
  from public.children c
  where c.family_id = v_family_id;

  return json_build_object(
    'ok', true,
    'family_id', v_family_id,
    'kid_token', v_token,
    'children', coalesce(v_children, '[]'::json)
  );
end;
$$;

grant execute on function public.verify_kid_join(text, text) to anon, authenticated;

-- ============================================================
-- 7) RPC: kid_select_child (bind token to specific child)
-- ============================================================

create or replace function kid_select_child(
  p_kid_token text,
  p_child_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_family_id uuid;
  v_child_family_id uuid;
begin
  select ks.family_id into v_family_id
  from public.kid_sessions ks
  where ks.kid_token = p_kid_token
    and ks.expires_at > now();

  if v_family_id is null then
    return json_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select c.family_id into v_child_family_id
  from public.children c
  where c.id = p_child_id;

  if v_child_family_id is null or v_child_family_id != v_family_id then
    return json_build_object('ok', false, 'error', 'child_not_in_family');
  end if;

  update public.kid_sessions
  set child_id = p_child_id
  where kid_token = p_kid_token;

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.kid_select_child(text, uuid) to anon, authenticated;

-- ============================================================
-- 8) RPC: kid_get_catalog (chores + rewards for family)
-- ============================================================

create or replace function kid_get_catalog(p_kid_token text)
returns json
language plpgsql
security definer
as $$
declare
  v_family_id uuid;
  v_chores json;
  v_rewards json;
begin
  select ks.family_id into v_family_id
  from public.kid_sessions ks
  where ks.kid_token = p_kid_token
    and ks.expires_at > now();

  if v_family_id is null then
    raise exception 'Invalid or expired session'
      using hint = 'Re-join using Family Number + PIN';
  end if;

  select json_agg(json_build_object(
    'id', cc.id,
    'family_id', cc.family_id,
    'category', cc.category,
    'title', cc.title,
    'points', cc.points,
    'active', cc.active,
    'sort_order', cc.sort_order
  ) order by cc.sort_order)
  into v_chores
  from public.chore_catalog cc
  where cc.family_id = v_family_id;

  select json_agg(json_build_object(
    'id', rc.id,
    'family_id', rc.family_id,
    'category', rc.category,
    'title', rc.title,
    'cost', rc.cost,
    'requires_approval', rc.requires_approval,
    'active', rc.active,
    'sort_order', rc.sort_order
  ) order by rc.sort_order)
  into v_rewards
  from public.reward_catalog rc
  where rc.family_id = v_family_id;

  return json_build_object(
    'chores', coalesce(v_chores, '[]'::json),
    'rewards', coalesce(v_rewards, '[]'::json)
  );
end;
$$;

grant execute on function public.kid_get_catalog(text) to anon, authenticated;

-- ============================================================
-- 9) RPC: kid_get_points (child balance + daily points)
-- ============================================================

create or replace function kid_get_points(
  p_kid_token text,
  p_child_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_family_id uuid;
  v_session_child_id uuid;
  v_child_family_id uuid;
  v_balance int;
  v_lifetime int;
begin
  select ks.family_id, ks.child_id into v_family_id, v_session_child_id
  from public.kid_sessions ks
  where ks.kid_token = p_kid_token
    and ks.expires_at > now();

  if v_family_id is null then
    raise exception 'Invalid or expired session';
  end if;

  select c.family_id into v_child_family_id
  from public.children c where c.id = p_child_id;

  if v_child_family_id is null or v_child_family_id != v_family_id then
    raise exception 'Child not in family';
  end if;

  select
    coalesce(sum(pl.points_delta), 0)::int,
    coalesce(sum(case when pl.points_delta > 0 then pl.points_delta else 0 end), 0)::int
  into v_balance, v_lifetime
  from public.points_ledger pl
  where pl.child_id = p_child_id;

  return json_build_object(
    'child_id', p_child_id,
    'points', v_balance,
    'lifetime_points', v_lifetime,
    'updated_at', now()
  );
end;
$$;

grant execute on function public.kid_get_points(text, uuid) to anon, authenticated;

-- ============================================================
-- 10) RPC: kid_toggle_chore
-- ============================================================

create or replace function kid_toggle_chore(
  p_kid_token text,
  p_child_id uuid,
  p_chore_id uuid,
  p_date_key date
)
returns json
language plpgsql
security definer
as $$
declare
  v_family_id uuid;
  v_child_family_id uuid;
  v_points int;
  v_deleted int;
begin
  select ks.family_id into v_family_id
  from public.kid_sessions ks
  where ks.kid_token = p_kid_token
    and ks.expires_at > now();

  if v_family_id is null then
    raise exception 'Invalid or expired session';
  end if;

  select c.family_id into v_child_family_id
  from public.children c where c.id = p_child_id;

  if v_child_family_id is null or v_child_family_id != v_family_id then
    raise exception 'Child not in family';
  end if;

  select points into v_points
  from public.chore_catalog
  where id = p_chore_id and family_id = v_family_id and active = true;

  if v_points is null then
    return json_build_object('error', 'Chore not found or inactive');
  end if;

  delete from public.daily_status_v2
  where child_id = p_child_id
    and chore_id = p_chore_id
    and date_key = p_date_key;

  get diagnostics v_deleted = row_count;

  if v_deleted > 0 then
    insert into public.points_ledger (family_id, child_id, date_key, event_type, ref_id, points_delta, meta)
    values (v_family_id, p_child_id, p_date_key, 'chore_uncheck', p_chore_id, -v_points, '{}');

    return json_build_object('ok', true, 'completed', false);
  else
    insert into public.daily_status_v2 (child_id, chore_id, date_key, completed)
    values (p_child_id, p_chore_id, p_date_key, true);

    insert into public.points_ledger (family_id, child_id, date_key, event_type, ref_id, points_delta, meta)
    values (v_family_id, p_child_id, p_date_key, 'chore_complete', p_chore_id, v_points, '{}');

    return json_build_object('ok', true, 'completed', true);
  end if;
end;
$$;

grant execute on function public.kid_toggle_chore(text, uuid, uuid, date) to anon, authenticated;

-- ============================================================
-- 11) RPC: kid_redeem_reward
-- ============================================================

create or replace function kid_redeem_reward(
  p_kid_token text,
  p_child_id uuid,
  p_reward_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_family_id uuid;
  v_child_family_id uuid;
  v_cost int;
  v_balance int;
  v_redemption_id uuid;
begin
  select ks.family_id into v_family_id
  from public.kid_sessions ks
  where ks.kid_token = p_kid_token
    and ks.expires_at > now();

  if v_family_id is null then
    raise exception 'Invalid or expired session';
  end if;

  select c.family_id into v_child_family_id
  from public.children c where c.id = p_child_id;

  if v_child_family_id is null or v_child_family_id != v_family_id then
    raise exception 'Child not in family';
  end if;

  select cost into v_cost
  from public.reward_catalog
  where id = p_reward_id and family_id = v_family_id and active = true;

  if v_cost is null then
    return json_build_object('error', 'Reward not found or inactive');
  end if;

  select coalesce(sum(points_delta), 0) into v_balance
  from public.points_ledger
  where child_id = p_child_id;

  if v_balance < v_cost then
    return json_build_object('error', 'Not enough points');
  end if;

  insert into public.reward_redemptions (child_id, reward_id, cost, status)
  values (p_child_id, p_reward_id, v_cost, 'approved')
  returning id into v_redemption_id;

  insert into public.points_ledger (family_id, child_id, date_key, event_type, ref_id, points_delta, meta)
  values (v_family_id, p_child_id, current_date, 'purchase', p_reward_id, -v_cost, '{}');

  return json_build_object('ok', true, 'redemption_id', v_redemption_id);
end;
$$;

grant execute on function public.kid_redeem_reward(text, uuid, uuid) to anon, authenticated;

-- ============================================================
-- 12) RPC: kid_get_chore_status (daily completion state)
-- ============================================================

create or replace function kid_get_chore_status(
  p_kid_token text,
  p_child_id uuid,
  p_date_key date
)
returns json
language plpgsql
security definer
as $$
declare
  v_family_id uuid;
  v_child_family_id uuid;
  v_result json;
begin
  select ks.family_id into v_family_id
  from public.kid_sessions ks
  where ks.kid_token = p_kid_token
    and ks.expires_at > now();

  if v_family_id is null then
    raise exception 'Invalid or expired session';
  end if;

  select c.family_id into v_child_family_id
  from public.children c where c.id = p_child_id;

  if v_child_family_id is null or v_child_family_id != v_family_id then
    raise exception 'Child not in family';
  end if;

  select json_agg(json_build_object(
    'chore_id', ds.chore_id,
    'completed', ds.completed
  ))
  into v_result
  from public.daily_status_v2 ds
  where ds.child_id = p_child_id
    and ds.date_key = p_date_key;

  return json_build_object(
    'child_id', p_child_id,
    'date_key', p_date_key,
    'statuses', coalesce(v_result, '[]'::json)
  );
end;
$$;

grant execute on function public.kid_get_chore_status(text, uuid, date) to anon, authenticated;

-- ============================================================
-- 13) RPC: kid_get_badges
-- ============================================================

create or replace function kid_get_badges(
  p_kid_token text,
  p_child_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_family_id uuid;
  v_child_family_id uuid;
  v_result json;
begin
  select ks.family_id into v_family_id
  from public.kid_sessions ks
  where ks.kid_token = p_kid_token
    and ks.expires_at > now();

  if v_family_id is null then
    raise exception 'Invalid or expired session';
  end if;

  select c.family_id into v_child_family_id
  from public.children c where c.id = p_child_id;

  if v_child_family_id is null or v_child_family_id != v_family_id then
    raise exception 'Child not in family';
  end if;

  select json_agg(json_build_object(
    'badge_key', cb.badge_key,
    'badge_name', cb.badge_name,
    'badge_icon', cb.badge_icon,
    'threshold', cb.threshold,
    'earned_at', cb.earned_at
  ))
  into v_result
  from public.child_badges cb
  where cb.child_id = p_child_id;

  return json_build_object(
    'child_id', p_child_id,
    'badges', coalesce(v_result, '[]'::json)
  );
end;
$$;

grant execute on function public.kid_get_badges(text, uuid) to anon, authenticated;

-- ============================================================
-- 14) RPC: kid_get_redemptions
-- ============================================================

create or replace function kid_get_redemptions(
  p_kid_token text,
  p_child_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_family_id uuid;
  v_child_family_id uuid;
  v_result json;
begin
  select ks.family_id into v_family_id
  from public.kid_sessions ks
  where ks.kid_token = p_kid_token
    and ks.expires_at > now();

  if v_family_id is null then
    raise exception 'Invalid or expired session';
  end if;

  select c.family_id into v_child_family_id
  from public.children c where c.id = p_child_id;

  if v_child_family_id is null or v_child_family_id != v_family_id then
    raise exception 'Child not in family';
  end if;

  select json_agg(json_build_object(
    'id', rr.id,
    'reward_id', rr.reward_id,
    'reward_title', coalesce(rc.title, 'Unknown'),
    'cost', rr.cost,
    'status', rr.status,
    'purchased_at', rr.created_at
  ) order by rr.created_at desc)
  into v_result
  from public.reward_redemptions rr
  left join public.reward_catalog rc on rc.id = rr.reward_id
  where rr.child_id = p_child_id;

  return json_build_object(
    'child_id', p_child_id,
    'redemptions', coalesce(v_result, '[]'::json)
  );
end;
$$;

grant execute on function public.kid_get_redemptions(text, uuid) to anon, authenticated;

-- ============================================================
-- 15) RPC: set_child_pin (parent-only, via auth)
-- ============================================================

create or replace function set_child_pin(
  p_child_id uuid,
  p_pin text
)
returns json
language plpgsql
security definer
as $$
declare
  v_family_id uuid;
begin
  select c.family_id into v_family_id
  from public.children c
  where c.id = p_child_id;

  if v_family_id is null then
    return json_build_object('ok', false, 'error', 'Child not found');
  end if;

  if not is_family_member(v_family_id) then
    return json_build_object('ok', false, 'error', 'Not authorized');
  end if;

  if p_pin is null or length(trim(p_pin)) < 4 then
    return json_build_object('ok', false, 'error', 'PIN must be at least 4 digits');
  end if;

  update public.children
  set child_pin_hash = crypt(p_pin, gen_salt('bf'))
  where id = p_child_id;

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.set_child_pin(uuid, text) to authenticated;

-- ============================================================
-- 16) RPC: set_parent_portal_pin
-- ============================================================

create or replace function set_parent_portal_pin(
  p_family_id uuid,
  p_pin text
)
returns json
language plpgsql
security definer
as $$
begin
  if not is_family_member(p_family_id) then
    return json_build_object('ok', false, 'error', 'Not authorized');
  end if;

  if p_pin is null or length(trim(p_pin)) < 4 then
    return json_build_object('ok', false, 'error', 'PIN must be at least 4 digits');
  end if;

  update public.family_settings
  set parent_portal_pin_hash = crypt(p_pin, gen_salt('bf')),
      parent_portal_pin_enabled = true
  where family_id = p_family_id;

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.set_parent_portal_pin(uuid, text) to authenticated;

-- ============================================================
-- 17) RPC: verify_parent_portal_pin
-- ============================================================

create or replace function verify_parent_portal_pin(
  p_family_id uuid,
  p_pin text
)
returns json
language plpgsql
security definer
as $$
declare
  v_hash text;
begin
  if not is_family_member(p_family_id) then
    return json_build_object('ok', false, 'error', 'Not authorized');
  end if;

  select parent_portal_pin_hash into v_hash
  from public.family_settings
  where family_id = p_family_id;

  if v_hash is null then
    return json_build_object('ok', false, 'error', 'No PIN set');
  end if;

  if v_hash = crypt(p_pin, v_hash) then
    return json_build_object('ok', true);
  else
    return json_build_object('ok', false, 'error', 'Wrong PIN');
  end if;
end;
$$;

grant execute on function public.verify_parent_portal_pin(uuid, text) to authenticated;

-- ============================================================
-- 18) RPC: disable_parent_portal_pin
-- ============================================================

create or replace function disable_parent_portal_pin(
  p_family_id uuid,
  p_pin text
)
returns json
language plpgsql
security definer
as $$
declare
  v_hash text;
begin
  if not is_family_member(p_family_id) then
    return json_build_object('ok', false, 'error', 'Not authorized');
  end if;

  select parent_portal_pin_hash into v_hash
  from public.family_settings
  where family_id = p_family_id;

  if v_hash is not null and v_hash != crypt(p_pin, v_hash) then
    return json_build_object('ok', false, 'error', 'Wrong PIN');
  end if;

  update public.family_settings
  set parent_portal_pin_enabled = false,
      parent_portal_pin_hash = null
  where family_id = p_family_id;

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.disable_parent_portal_pin(uuid, text) to authenticated;

-- ============================================================
-- 19) RPC: get_family_number (convenience for parents)
-- ============================================================

create or replace function get_family_number(p_family_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_number text;
begin
  if not is_family_member(p_family_id) then
    return json_build_object('ok', false, 'error', 'Not authorized');
  end if;

  select family_number into v_number
  from public.families
  where id = p_family_id;

  return json_build_object('ok', true, 'family_number', v_number);
end;
$$;

grant execute on function public.get_family_number(uuid) to authenticated;

-- ============================================================
-- 20) Cleanup: expire old kid sessions (optional cron target)
-- ============================================================

create or replace function cleanup_expired_kid_sessions()
returns void
language sql
security definer
as $$
  delete from public.kid_sessions where expires_at < now();
$$;

-- ============================================================
-- 21) Update remove_child to also delete kid_sessions
-- ============================================================

create or replace function remove_child(p_child_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_family_id uuid;
begin
  select family_id into v_family_id
  from children
  where id = p_child_id;

  if v_family_id is null then
    raise exception 'Child not found';
  end if;

  if not is_family_member(v_family_id) then
    raise exception 'Not authorized';
  end if;

  delete from kid_sessions where child_id = p_child_id;
  delete from daily_status_v2 where child_id = p_child_id;
  delete from daily_status where child_id = p_child_id;
  delete from points_ledger where child_id = p_child_id;
  delete from reward_redemptions where child_id = p_child_id;
  delete from child_badges where child_id = p_child_id;
  delete from children where id = p_child_id;

  return jsonb_build_object('ok', true, 'child_id', p_child_id);
end;
$$;

commit;

-- ============================================================
-- DONE! After running this migration:
--   1. All existing families get a unique family_number
--   2. Parents can set child PINs via set_child_pin RPC
--   3. Kids can join via verify_kid_join(family_number, pin)
--   4. Kid actions go through kid_toggle_chore, kid_redeem_reward
--   5. Parent Portal PIN: set/verify/disable via RPCs
--   6. kid_sessions table stores token-based kid sessions (24h TTL)
-- ============================================================
