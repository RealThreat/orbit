-- Orbit-owned data only. No Hydra credentials or accounts are imported.
create table public.orbit_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Player' check (char_length(display_name) between 1 and 40),
  bio text not null default '' check (char_length(bio) <= 1000),
  profile_visibility text not null default 'PRIVATE' check (profile_visibility in ('PUBLIC', 'FRIENDS', 'PRIVATE')),
  created_at timestamptz not null default now()
);
alter table public.orbit_profiles enable row level security;
revoke all on public.orbit_profiles from anon, authenticated;
create policy "read own profile" on public.orbit_profiles for select to authenticated using (id = auth.uid());
create policy "update own profile" on public.orbit_profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
grant select on public.orbit_profiles to authenticated;
grant update (display_name, bio, profile_visibility) on public.orbit_profiles to authenticated;

create function public.orbit_create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.orbit_profiles(id, display_name)
    values (new.id, coalesce(nullif(left(trim(new.raw_user_meta_data->>'display_name'),40),''),'Player'));
  return new;
end;
$$;
revoke execute on function public.orbit_create_profile() from public, anon, authenticated;
create trigger orbit_user_created after insert on auth.users for each row execute function public.orbit_create_profile();

create table public.orbit_games (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  shop text not null check (shop in ('steam','epic','launchbox','custom')),
  object_id text not null check (char_length(object_id) between 1 and 256),
  payload jsonb not null default '{}' check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 65536),
  created_at timestamptz not null default now(),
  unique (owner_id, shop, object_id)
);
alter table public.orbit_games enable row level security;
revoke all on public.orbit_games from anon, authenticated;
create policy "own games" on public.orbit_games for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
grant select, insert, update, delete on public.orbit_games to authenticated;

-- Merge atomically: a playtime update cannot discard a simultaneous favourite update.
create function public.orbit_merge_games(games jsonb) returns setof public.orbit_games language plpgsql security invoker set search_path = '' as $$
declare item jsonb;
begin
  if auth.uid() is null or jsonb_typeof(games) <> 'array' or jsonb_array_length(games) > 100 then
    raise exception 'Invalid game batch';
  end if;
  for item in select * from jsonb_array_elements(games) loop
    return query insert into public.orbit_games(owner_id, shop, object_id, payload)
      values (auth.uid(),item->>'shop',item->>'objectId',item - 'id' - 'owner_id' - 'createdAt')
      on conflict (owner_id,shop,object_id) do update set payload = public.orbit_games.payload || excluded.payload
      returning *;
  end loop;
end;
$$;
revoke execute on function public.orbit_merge_games(jsonb) from public, anon;
grant execute on function public.orbit_merge_games(jsonb) to authenticated;

create function public.orbit_add_playtime(game_shop text, game_object_id text, delta_seconds numeric, last_played timestamptz)
returns setof public.orbit_games language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or delta_seconds < 0 or delta_seconds > 1000000000 or delta_seconds is null then
    raise exception 'Invalid playtime delta';
  end if;
  return query update public.orbit_games set payload =
    jsonb_set(jsonb_set(payload,'{playTimeInMilliseconds}',
      to_jsonb(greatest(0,coalesce((payload->>'playTimeInMilliseconds')::numeric,0)) + delta_seconds * 1000)),
      '{lastTimePlayed}',coalesce(to_jsonb(last_played),'null'::jsonb))
    where owner_id = auth.uid() and shop = game_shop and object_id = game_object_id returning *;
end;
$$;
revoke execute on function public.orbit_add_playtime(text,text,numeric,timestamptz) from public, anon;
grant execute on function public.orbit_add_playtime(text,text,numeric,timestamptz) to authenticated;
