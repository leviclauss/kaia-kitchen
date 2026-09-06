-- Kaia's Nom Nom Week — Supabase schema (v1 couple-app model)
-- Fixed household UUID (document in README; not multi-tenant secure SaaS)
-- Household: c0ffee00-5a1a-4000-8000-00000000cafe

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  meal_type text not null check (meal_type in ('breakfast', 'snack', 'lunch', 'dinner', 'any')),
  recipe text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.week_slots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  week_start date not null,
  day_index int not null check (day_index between 0 and 6),
  slot text not null check (slot in ('breakfast', 'snack1', 'lunch', 'snack2', 'dinner')),
  title text not null default '',
  recipe text,
  notes text,
  meal_id uuid references public.meals (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (household_id, week_start, day_index, slot)
);

create index if not exists meals_household_idx on public.meals (household_id);
create index if not exists week_slots_household_week_idx on public.week_slots (household_id, week_start);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists meals_set_updated_at on public.meals;
create trigger meals_set_updated_at
  before update on public.meals
  for each row execute function public.set_updated_at();

drop trigger if exists week_slots_set_updated_at on public.week_slots;
create trigger week_slots_set_updated_at
  before update on public.week_slots
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Seed household
-- ---------------------------------------------------------------------------

insert into public.households (id, name)
values ('c0ffee00-5a1a-4000-8000-00000000cafe', 'Kaia''s Kitchen')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Seed meals (unique ideas from the original Mon–Sun static plan)
-- ---------------------------------------------------------------------------

insert into public.meals (household_id, name, meal_type, recipe, notes)
select h.id, m.name, m.meal_type, m.recipe, m.notes
from public.households h
cross join (values
  ('Soft scrambled egg, avocado strips, banana toast fingers', 'breakfast', null, null),
  ('Full-fat yogurt + blueberries (halved)', 'snack', null, null),
  ('Shredded chicken, steamed carrot coins, soft pear pieces', 'lunch', null, null),
  ('Cheese cubes + soft steamed apple', 'snack', null, null),
  ('Flaky salmon, mashed sweet potato, soft broccoli florets', 'dinner', null, null),
  ('Oatmeal (plain or with mashed banana), soft peach slices', 'breakfast', null, null),
  ('Cottage cheese + soft melon', 'snack', null, null),
  ('Soft lentils, roasted zucchini coins, ripe mango strips', 'lunch', null, null),
  ('Hummus + cucumber sticks', 'snack', null, null),
  ('Ground turkey, mashed potato, soft green beans', 'dinner', null, null),
  ('French toast fingers (egg + milk), smashed raspberries', 'breakfast', null, null),
  ('Full-fat yogurt + soft pear', 'snack', null, null),
  ('Soft scrambled tofu or egg, steamed cauliflower, banana', 'lunch', null, null),
  ('Soft cheese + steamed carrot sticks', 'snack', null, null),
  ('Mild fish cakes (no breadcrumb nut mix), mashed peas, soft squash', 'dinner', null, 'Skip any nutty binder mixes'),
  ('Plain yogurt parfait: yogurt, soft strawberries, oat circles', 'breakfast', null, null),
  ('Soft pear + a few plain crackers (check label)', 'snack', null, 'Check cracker labels for tree nuts'),
  ('Shredded beef or soft black beans, soft sweet potato cubes, cucumber', 'lunch', null, null),
  ('Avocado + cheese', 'snack', null, null),
  ('Chicken meatballs (plain), pasta tubes (soft), steamed broccoli', 'dinner', null, null),
  ('Soft pancake fingers, mashed banana, side of yogurt', 'breakfast', null, null),
  ('Blueberries + cottage cheese', 'snack', null, null),
  ('Soft white fish, mashed carrot, ripe kiwi (peeled, soft)', 'lunch', null, null),
  ('Hummus + soft pepper strips', 'snack', null, null),
  ('Mild chili (beans + ground turkey, low spice), rice, avocado', 'dinner', null, 'Keep spice gentle'),
  ('Egg muffins (egg + spinach + cheese, soft), orange segments', 'breakfast', null, null),
  ('Yogurt + soft peach', 'snack', null, null),
  ('Leftover meatballs or chicken, soft pasta, steamed zucchini', 'lunch', null, null),
  ('Cheese + soft apple', 'snack', null, null),
  ('Baked chicken thigh (shredded), mashed cauliflower, soft peas', 'dinner', null, null),
  ('Overnight oats (milk + banana), soft berries', 'breakfast', null, null),
  ('Cottage cheese + melon', 'snack', null, null),
  ('Soft chickpeas (mashed a bit), roasted carrot, pear', 'lunch', null, null),
  ('Yogurt + banana', 'snack', null, null),
  ('Mild salmon or turkey, mashed sweet potato, soft broccoli', 'dinner', null, null)
) as m(name, meal_type, recipe, notes)
where h.id = 'c0ffee00-5a1a-4000-8000-00000000cafe'
  and not exists (
    select 1 from public.meals existing
    where existing.household_id = h.id and existing.name = m.name
  );

-- ---------------------------------------------------------------------------
-- RLS — simple couple-app model (anon read/write for fixed household only)
-- ---------------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.meals enable row level security;
alter table public.week_slots enable row level security;

drop policy if exists "households_select_fixed" on public.households;
create policy "households_select_fixed" on public.households
  for select to anon, authenticated
  using (id = 'c0ffee00-5a1a-4000-8000-00000000cafe');

drop policy if exists "meals_all_fixed" on public.meals;
create policy "meals_all_fixed" on public.meals
  for all to anon, authenticated
  using (household_id = 'c0ffee00-5a1a-4000-8000-00000000cafe')
  with check (household_id = 'c0ffee00-5a1a-4000-8000-00000000cafe');

drop policy if exists "week_slots_all_fixed" on public.week_slots;
create policy "week_slots_all_fixed" on public.week_slots
  for all to anon, authenticated
  using (household_id = 'c0ffee00-5a1a-4000-8000-00000000cafe')
  with check (household_id = 'c0ffee00-5a1a-4000-8000-00000000cafe');

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

-- Add tables to the supabase_realtime publication (ignore if already added)
do $$
begin
  begin
    alter publication supabase_realtime add table public.meals;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.week_slots;
  exception when duplicate_object then null;
  end;
end $$;
