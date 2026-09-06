import { createClient } from '@supabase/supabase-js';
import { HOUSEHOLD_ID } from './data/seedMeals.js';

export { HOUSEHOLD_ID };

let client = null;
let configStatus = 'unknown'; // unknown | missing | ready | error

/**
 * Resolve config from Vite env and optional public/config.json override
 * (handy for GitHub Pages without rebuild).
 */
export async function loadConfig() {
  let url = import.meta.env.VITE_SUPABASE_URL || '';
  let anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  try {
    const base = import.meta.env.BASE_URL || '/';
    const res = await fetch(`${base}config.json`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json.supabaseUrl) url = json.supabaseUrl;
      if (json.supabaseAnonKey) anonKey = json.supabaseAnonKey;
    }
  } catch {
    // optional file — ignore
  }

  const placeholder =
    !url ||
    !anonKey ||
    url.includes('YOUR_PROJECT') ||
    anonKey.includes('YOUR_ANON');

  if (placeholder) {
    configStatus = 'missing';
    client = null;
    return { ok: false, reason: 'missing' };
  }

  try {
    client = createClient(url, anonKey, {
      realtime: { params: { eventsPerSecond: 5 } },
    });
    configStatus = 'ready';
    return { ok: true, url };
  } catch (err) {
    console.error('Supabase client init failed', err);
    configStatus = 'error';
    client = null;
    return { ok: false, reason: 'error', error: err };
  }
}

export function getClient() {
  return client;
}

export function getConfigStatus() {
  return configStatus;
}

export function isConfigured() {
  return configStatus === 'ready' && !!client;
}

/* ---- Meals CRUD ---- */

export async function fetchMeals() {
  const { data, error } = await client
    .from('meals')
    .select('*')
    .eq('household_id', HOUSEHOLD_ID)
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createMeal({ name, mealType, recipe, notes, liked = false }) {
  const { data, error } = await client
    .from('meals')
    .insert({
      household_id: HOUSEHOLD_ID,
      name,
      meal_type: mealType,
      recipe: recipe || null,
      notes: notes || null,
      liked: !!liked,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMeal(id, { name, mealType, recipe, notes, liked }) {
  const patch = {
    name,
    meal_type: mealType,
    recipe: recipe || null,
    notes: notes || null,
  };
  if (liked !== undefined) patch.liked = !!liked;
  const { data, error } = await client
    .from('meals')
    .update(patch)
    .eq('id', id)
    .eq('household_id', HOUSEHOLD_ID)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMeal(id) {
  const { error } = await client
    .from('meals')
    .delete()
    .eq('id', id)
    .eq('household_id', HOUSEHOLD_ID);
  if (error) throw error;
}

/* ---- Week slots ---- */

export async function fetchWeekSlots(weekStart) {
  const { data, error } = await client
    .from('week_slots')
    .select('*')
    .eq('household_id', HOUSEHOLD_ID)
    .eq('week_start', weekStart);
  if (error) throw error;
  return data || [];
}

export async function upsertWeekSlot(slot) {
  const row = {
    household_id: HOUSEHOLD_ID,
    week_start: slot.weekStart,
    day_index: slot.dayIndex,
    slot: slot.slot,
    title: slot.title ?? '',
    recipe: slot.recipe || null,
    notes: slot.notes || null,
    meal_id: slot.mealId || null,
  };

  const { data, error } = await client
    .from('week_slots')
    .upsert(row, { onConflict: 'household_id,week_start,day_index,slot' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function clearWeekSlot({ weekStart, dayIndex, slot }) {
  const { error } = await client
    .from('week_slots')
    .delete()
    .eq('household_id', HOUSEHOLD_ID)
    .eq('week_start', weekStart)
    .eq('day_index', dayIndex)
    .eq('slot', slot);
  if (error) throw error;
}

export async function bulkInsertWeekSlots(rows) {
  if (!rows.length) return [];
  const { data, error } = await client
    .from('week_slots')
    .upsert(rows, { onConflict: 'household_id,week_start,day_index,slot' })
    .select();
  if (error) throw error;
  return data || [];
}

/* ---- Realtime ---- */

export function subscribeMeals(onChange) {
  const channel = client
    .channel('meals-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'meals', filter: `household_id=eq.${HOUSEHOLD_ID}` },
      (payload) => onChange(payload)
    )
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}

export function subscribeWeekSlots(weekStart, onChange) {
  const channel = client
    .channel(`week-slots-${weekStart}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'week_slots', filter: `household_id=eq.${HOUSEHOLD_ID}` },
      (payload) => {
        const row = payload.new?.week_start || payload.old?.week_start;
        if (row === weekStart || !row) onChange(payload);
      }
    )
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}

/* ---- Grocery items ---- */

export async function fetchGroceryItems(weekStart) {
  const { data, error } = await client
    .from('grocery_items')
    .select('*')
    .eq('household_id', HOUSEHOLD_ID)
    .eq('week_start', weekStart)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createGroceryItem({ weekStart, name, haveIt = false, source = 'manual' }) {
  const { data, error } = await client
    .from('grocery_items')
    .insert({
      household_id: HOUSEHOLD_ID,
      week_start: weekStart,
      name: String(name || '').trim(),
      have_it: !!haveIt,
      source: source === 'plan' ? 'plan' : 'manual',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateGroceryItem(id, { name, haveIt }) {
  const patch = {};
  if (name !== undefined) patch.name = String(name || '').trim();
  if (haveIt !== undefined) patch.have_it = !!haveIt;
  const { data, error } = await client
    .from('grocery_items')
    .update(patch)
    .eq('id', id)
    .eq('household_id', HOUSEHOLD_ID)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGroceryItem(id) {
  const { error } = await client
    .from('grocery_items')
    .delete()
    .eq('id', id)
    .eq('household_id', HOUSEHOLD_ID);
  if (error) throw error;
}

export async function upsertGroceryItem({ weekStart, name, haveIt = false, source = 'manual' }) {
  const { data, error } = await client
    .from('grocery_items')
    .upsert(
      {
        household_id: HOUSEHOLD_ID,
        week_start: weekStart,
        name: String(name || '').trim(),
        have_it: !!haveIt,
        source: source === 'plan' ? 'plan' : 'manual',
      },
      { onConflict: 'household_id,week_start,name', ignoreDuplicates: true }
    )
    .select();
  if (error) throw error;
  return data?.[0] || null;
}

/** Insert plan items that are missing; never overwrite existing have_it / manual rows. */
export async function mergePlanGroceryItems(weekStart, names) {
  const unique = [];
  const seen = new Set();
  for (const raw of names) {
    const name = String(raw || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(name);
  }
  if (!unique.length) return [];

  const existing = await fetchGroceryItems(weekStart);
  const existingKeys = new Set(existing.map((r) => r.name.toLowerCase()));
  const toInsert = unique
    .filter((n) => !existingKeys.has(n.toLowerCase()))
    .map((name) => ({
      household_id: HOUSEHOLD_ID,
      week_start: weekStart,
      name,
      have_it: false,
      source: 'plan',
    }));

  if (!toInsert.length) return existing;

  const { data, error } = await client.from('grocery_items').insert(toInsert).select();
  if (error) throw error;
  return [...existing, ...(data || [])];
}

/** Wipe week grocery list and re-seed from plan names (have_it false, source plan). */
export async function resetGroceryFromPlan(weekStart, names) {
  const { error: delErr } = await client
    .from('grocery_items')
    .delete()
    .eq('household_id', HOUSEHOLD_ID)
    .eq('week_start', weekStart);
  if (delErr) throw delErr;

  const unique = [];
  const seen = new Set();
  for (const raw of names) {
    const name = String(raw || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(name);
  }
  if (!unique.length) return [];

  const rows = unique.map((name) => ({
    household_id: HOUSEHOLD_ID,
    week_start: weekStart,
    name,
    have_it: false,
    source: 'plan',
  }));
  const { data, error } = await client.from('grocery_items').insert(rows).select();
  if (error) throw error;
  return data || [];
}

export async function clearHaveGroceryItems(weekStart) {
  const { error } = await client
    .from('grocery_items')
    .update({ have_it: false })
    .eq('household_id', HOUSEHOLD_ID)
    .eq('week_start', weekStart)
    .eq('have_it', true);
  if (error) throw error;
}

export function subscribeGroceryItems(weekStart, onChange) {
  const channel = client
    .channel(`grocery-items-${weekStart}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'grocery_items',
        filter: `household_id=eq.${HOUSEHOLD_ID}`,
      },
      (payload) => {
        const row = payload.new?.week_start || payload.old?.week_start;
        if (row === weekStart || !row) onChange(payload);
      }
    )
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
