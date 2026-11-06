-- DEVA v1 başlangıç şeması: tablolar, RLS, RPC'ler ve trigger'lar.

-- Tablolar

create type public.facility_type as enum ('psychiatry_public','psychiatry_private','psychologist',
  'dietitian','child_psychiatry','psychological_counseling','family_therapy','substance_center','university_counseling');
create type public.facility_ownership as enum ('public','private');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  birth_year int not null check (birth_year between 1900 and 2100),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('system','light','dark')),
  daily_checkin_enabled boolean not null default true,
  daily_checkin_time text not null default '20:00',
  post_crisis_followup_enabled boolean not null default true,
  is_pro boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now());
create index conversations_user_last_idx on public.conversations (user_id, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  output_tokens int,
  crisis_level text check (crisis_level in ('none','low','high','critical')),
  crisis_acknowledged boolean not null default false,
  created_at timestamptz not null default now());
create index messages_conversation_idx on public.messages (conversation_id, created_at);

create table public.memory_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 200),
  category text not null check (category in ('fact','preference','event','context')),
  source text not null default 'ai' check (source in ('ai','user')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());
create index memory_notes_user_active_idx on public.memory_notes (user_id, is_active, updated_at desc);

create table public.screening_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_code text not null check (instrument_code in ('PHQ9','GAD7','SCOFF')),
  answers jsonb not null,
  score int not null,
  severity text not null,
  completed_at timestamptz not null default now());
create index screening_user_idx on public.screening_results (user_id, instrument_code, completed_at desc);

create table public.crisis_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null check (level in ('low','high','critical')),
  source text not null check (source in ('chat','screening')),
  message_id uuid references public.messages(id) on delete set null,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now());
create index crisis_user_idx on public.crisis_events (user_id, created_at desc);

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  type public.facility_type not null,
  ownership public.facility_ownership not null,
  city text not null,
  district text,
  address text,
  lat double precision not null,
  lng double precision not null,
  phone text,
  website text,
  languages text[] not null default '{tr}',
  gender text check (gender in ('female','male','both')),
  is_online boolean not null default false,
  price_range text check (price_range in ('ucretsiz','ucuz','orta','pahali')),
  working_hours jsonb,
  accepting_patients boolean not null default true,
  promoted_weight int not null default 0,
  promoted_until timestamptz,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());
create index facilities_geo_idx on public.facilities (city, type) where is_active;

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  facility_id uuid references public.facilities(id) on delete set null,
  title text not null,
  starts_at timestamptz not null,
  remind_at timestamptz,
  remind_enabled boolean not null default true,
  notes text,
  created_at timestamptz not null default now());

create table public.daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  message_count int not null default 0,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  primary key (user_id, day));

create table public.streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_chat_date date,
  updated_at timestamptz not null default now());

create table public.consent (
  user_id uuid primary key references auth.users(id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default now());

-- RLS

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.memory_notes enable row level security;
alter table public.screening_results enable row level security;
alter table public.crisis_events enable row level security;
alter table public.facilities enable row level security;
alter table public.appointments enable row level security;
alter table public.daily_usage enable row level security;
alter table public.streaks enable row level security;
alter table public.consent enable row level security;

-- profiles (kullanıcının kendi satırı)

create policy profiles_own_select on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_own_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_own_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_own_delete on public.profiles for delete to authenticated using (id = auth.uid());

-- user_settings

create policy user_settings_own_select on public.user_settings for select to authenticated using (user_id = auth.uid());
create policy user_settings_own_insert on public.user_settings for insert to authenticated with check (user_id = auth.uid());
create policy user_settings_own_update on public.user_settings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_settings_own_delete on public.user_settings for delete to authenticated using (user_id = auth.uid());

-- conversations

create policy conversations_own_select on public.conversations for select to authenticated using (user_id = auth.uid());
create policy conversations_own_insert on public.conversations for insert to authenticated with check (user_id = auth.uid());
create policy conversations_own_update on public.conversations for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy conversations_own_delete on public.conversations for delete to authenticated using (user_id = auth.uid());

-- messages

create policy messages_own_select on public.messages for select to authenticated using (user_id = auth.uid());
create policy messages_own_insert on public.messages for insert to authenticated with check (user_id = auth.uid());
create policy messages_own_update on public.messages for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy messages_own_delete on public.messages for delete to authenticated using (user_id = auth.uid());

-- memory_notes

create policy memory_notes_own_select on public.memory_notes for select to authenticated using (user_id = auth.uid());
create policy memory_notes_own_insert on public.memory_notes for insert to authenticated with check (user_id = auth.uid());
create policy memory_notes_own_update on public.memory_notes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy memory_notes_own_delete on public.memory_notes for delete to authenticated using (user_id = auth.uid());

-- screening_results

create policy screening_results_own_select on public.screening_results for select to authenticated using (user_id = auth.uid());
create policy screening_results_own_insert on public.screening_results for insert to authenticated with check (user_id = auth.uid());
create policy screening_results_own_update on public.screening_results for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy screening_results_own_delete on public.screening_results for delete to authenticated using (user_id = auth.uid());

-- crisis_events

create policy crisis_events_own_select on public.crisis_events for select to authenticated using (user_id = auth.uid());
create policy crisis_events_own_insert on public.crisis_events for insert to authenticated with check (user_id = auth.uid());
create policy crisis_events_own_update on public.crisis_events for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy crisis_events_own_delete on public.crisis_events for delete to authenticated using (user_id = auth.uid());

-- appointments

create policy appointments_own_select on public.appointments for select to authenticated using (user_id = auth.uid());
create policy appointments_own_insert on public.appointments for insert to authenticated with check (user_id = auth.uid());
create policy appointments_own_update on public.appointments for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy appointments_own_delete on public.appointments for delete to authenticated using (user_id = auth.uid());

-- consent

create policy consent_own_select on public.consent for select to authenticated using (user_id = auth.uid());
create policy consent_own_insert on public.consent for insert to authenticated with check (user_id = auth.uid());
create policy consent_own_update on public.consent for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy consent_own_delete on public.consent for delete to authenticated using (user_id = auth.uid());

-- daily_usage ve streaks: yalnızca servis rolü YAZAR (insert/update/delete politikası yok).
-- Okuma kendi satırıyla sınırlı: sohbet başlığındaki seri çipi ve kota şeridi
-- bu iki tabloyu okur; başka bir kullanıcının verisi yine de görünemez.
create policy streaks_own_select on public.streaks for select to authenticated using (user_id = auth.uid());
create policy daily_usage_own_select on public.daily_usage for select to authenticated using (user_id = auth.uid());

-- facilities: herkese açık okuma, yazma yok (satırlar importer ile servis rolü üzerinden yazılır)

create policy facilities_public_select on public.facilities for select to anon using (is_active);
create policy facilities_authenticated_select on public.facilities for select to authenticated using (is_active);

-- RPC'ler

-- Yakındaki kurumlar: haversine mesafe + sponsorlu/mesafe sıralaması.
create or replace function public.nearby_facilities(
  p_lat double precision, p_lng double precision,
  p_types public.facility_type[] default null,
  p_ownership public.facility_ownership default null,
  p_limit int default 50)
returns table (
  id uuid, slug text, name text, type public.facility_type, ownership public.facility_ownership,
  city text, district text, address text, phone text, website text, languages text[],
  gender text, is_online boolean, price_range text, working_hours jsonb, accepting_patients boolean,
  distance_km double precision, is_sponsored boolean)
language sql stable as $$
  with base as (
    select f.*,
      2 * 6371 * asin(sqrt(
        power(sin(radians(f.lat - p_lat) / 2), 2) +
        cos(radians(p_lat)) * cos(radians(f.lat)) * power(sin(radians(f.lng - p_lng) / 2), 2)
      )) as d
    from public.facilities f
    where f.is_active
      and (p_types is null or f.type = any(p_types))
      and (p_ownership is null or f.ownership = p_ownership)
  )
  select b.id, b.slug, b.name, b.type, b.ownership, b.city, b.district, b.address, b.phone, b.website,
         b.languages, b.gender, b.is_online, b.price_range, b.working_hours, b.accepting_patients,
         round(b.d::numeric, 1)::double precision as distance_km,
         (b.promoted_until is not null and b.promoted_until > now()) as is_sponsored
  from base b
  order by is_sponsored desc, b.promoted_weight desc, b.d asc
  limit p_limit;
$$;
-- DEFAULT parametreli fonksiyonlarda Postgres imzayı zorunlu kılar.
grant execute on function public.nearby_facilities(
  double precision, double precision, public.facility_type[],
  public.facility_ownership, integer
) to anon, authenticated;

-- KVKK: kalıcı silme (sıra önemli: mesajlar conversations üzerinden cascade silinir).
create or replace function public.delete_my_data() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from public.consent where user_id = auth.uid();
  delete from public.appointments where user_id = auth.uid();
  delete from public.crisis_events where user_id = auth.uid();
  delete from public.screening_results where user_id = auth.uid();
  delete from public.daily_usage where user_id = auth.uid();
  delete from public.streaks where user_id = auth.uid();
  delete from public.user_settings where user_id = auth.uid();
  delete from public.memory_notes where user_id = auth.uid();
  delete from public.conversations where user_id = auth.uid();
  delete from public.profiles where id = auth.uid();
end; $$;
grant execute on function public.delete_my_data() to authenticated;

-- Trigger

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.memory_notes
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.facilities
  for each row execute function public.set_updated_at();