import {
  fetchWeekSlots,
  upsertWeekSlot,
  clearWeekSlot,
  bulkInsertWeekSlots,
  subscribeWeekSlots,
  HOUSEHOLD_ID,
} from '../supabase.js';
import {
  SLOTS,
  DAY_NAMES,
  DAY_SHORT,
  DAY_EMOJIS,
  DEFAULT_WEEK_PLAN,
  mondayOf,
  addDaysISO,
  formatWeekLabel,
  dateForDay,
} from '../data/seedMeals.js';
import {
  getWeekStart as storeGetWeekStart,
  setWeekStart as storeSetWeekStart,
  subscribeWeekStart,
} from '../weekStore.js';
import { getMeals } from './mealLibrary.js';
import { setStatus } from './status.js';

let rootEl = null;
let weekStart = storeGetWeekStart();
let slotsByKey = new Map(); // `${dayIndex}:${slot}` → row
let unsub = null;
let unsubWeek = null;
let dayFilter = 'all';
let seededThisSession = new Set();

export function getWeekStart() {
  return weekStart;
}

export function setWeekStart(iso) {
  storeSetWeekStart(iso);
}

export async function initWeekPlanner(container) {
  rootEl = container;
  rootEl.innerHTML = `
    <div class="week-panel">
      <div class="week-nav">
        <button type="button" class="btn btn-icon" data-prev aria-label="Previous week">‹</button>
        <div class="week-nav-center">
          <h2 class="week-label" data-week-label></h2>
          <button type="button" class="btn btn-sm btn-ghost" data-today>This week</button>
        </div>
        <button type="button" class="btn btn-icon" data-next aria-label="Next week">›</button>
      </div>
      <nav class="day-nav" aria-label="Jump to day" data-day-nav>
        <button type="button" class="day-pill active" data-day="all">All week</button>
        ${DAY_SHORT.map(
          (d, i) => `<button type="button" class="day-pill" data-day="${i}">${d}</button>`
        ).join('')}
      </nav>
      <div class="days" data-days></div>
      <dialog class="modal" data-slot-modal>
        <form method="dialog" class="modal-form" data-slot-form>
          <h3 data-slot-title>Edit slot</h3>
          <input type="hidden" name="dayIndex" />
          <input type="hidden" name="slot" />
          <label>Title
            <input class="input" name="title" required maxlength="300" placeholder="What's on the menu?" />
          </label>
          <label>Recipe <span class="optional">(optional)</span>
            <textarea class="input" name="recipe" rows="3"></textarea>
          </label>
          <label>Notes <span class="optional">(optional)</span>
            <textarea class="input" name="notes" rows="2"></textarea>
          </label>
          <fieldset class="library-picker">
            <legend>Or pick from library</legend>
            <select class="input" data-library-select>
              <option value="">— Choose a saved meal —</option>
            </select>
          </fieldset>
          <div class="modal-actions">
            <button type="button" class="btn btn-danger btn-sm" data-clear-slot>Clear slot</button>
            <span class="modal-spacer"></span>
            <button type="submit" class="btn btn-ghost" value="cancel">Cancel</button>
            <button type="submit" class="btn btn-primary" value="save">Save</button>
          </div>
        </form>
      </dialog>
    </div>
  `;

  bindEvents();
  if (unsubWeek) unsubWeek();
  unsubWeek = subscribeWeekStart((ws) => {
    if (ws !== weekStart) loadWeek(ws);
  });
  await loadWeek(storeGetWeekStart());
}

export function destroyWeekPlanner() {
  if (unsub) unsub();
  unsub = null;
  if (unsubWeek) unsubWeek();
  unsubWeek = null;
}

export function refreshLibraryPicker() {
  const select = rootEl?.querySelector('[data-library-select]');
  if (!select) return;
  const meals = getMeals();
  const current = select.value;
  select.innerHTML =
    `<option value="">— Choose a saved meal —</option>` +
    meals
      .map(
        (m) =>
          `<option value="${m.id}">${escapeHtml(m.name)} (${m.meal_type})</option>`
      )
      .join('');
  select.value = current;
}

async function loadWeek(start) {
  weekStart = start;
  storeSetWeekStart(start);
  if (unsub) unsub();
  updateWeekLabel();
  try {
    setStatus('syncing');
    const rows = await fetchWeekSlots(weekStart);
    slotsByKey = new Map();
    for (const r of rows) {
      slotsByKey.set(`${r.day_index}:${r.slot}`, r);
    }
    if (rows.length === 0 && !seededThisSession.has(weekStart)) {
      await seedDefaultWeekIfCurrent();
    }
    renderDays();
    unsub = subscribeWeekSlots(weekStart, async (payload) => {
      // Only react to this week's rows
      const ws = payload.new?.week_start || payload.old?.week_start;
      if (ws && ws !== weekStart) return;
      try {
        const fresh = await fetchWeekSlots(weekStart);
        slotsByKey = new Map();
        for (const r of fresh) slotsByKey.set(`${r.day_index}:${r.slot}`, r);
        renderDays();
        setStatus('synced');
      } catch (err) {
        console.error(err);
        setStatus('error', 'realtime');
      }
    });
    setStatus('synced');
  } catch (err) {
    console.error(err);
    setStatus('error', 'week');
    renderDays();
  }
}

async function seedDefaultWeekIfCurrent() {
  const current = mondayOf();
  if (weekStart !== current) return;
  seededThisSession.add(weekStart);
  const rows = [];
  DEFAULT_WEEK_PLAN.forEach((day, dayIndex) => {
    SLOTS.forEach((s) => {
      const title = day[s.key];
      if (!title) return;
      rows.push({
        household_id: HOUSEHOLD_ID,
        week_start: weekStart,
        day_index: dayIndex,
        slot: s.key,
        title,
        recipe: null,
        notes: null,
        meal_id: null,
      });
    });
  });
  try {
    const inserted = await bulkInsertWeekSlots(rows);
    for (const r of inserted) {
      slotsByKey.set(`${r.day_index}:${r.slot}`, r);
    }
  } catch (err) {
    console.warn('Client-side week seed failed (library SQL seed may still apply)', err);
  }
}

function updateWeekLabel() {
  const label = rootEl.querySelector('[data-week-label]');
  label.textContent = formatWeekLabel(weekStart);
}

function renderDays() {
  const daysEl = rootEl.querySelector('[data-days]');
  daysEl.innerHTML = DAY_NAMES.map((name, dayIndex) => {
    const dateISO = dateForDay(weekStart, dayIndex);
    const hidden =
      dayFilter !== 'all' && String(dayFilter) !== String(dayIndex) ? 'hidden-day' : '';
    return `
      <section class="day-card ${hidden}" data-day-index="${dayIndex}" id="day-${dayIndex}">
        <div class="day-header">
          <div>
            <h2>${name}</h2>
            <span class="day-date">${formatShortDate(dateISO)}</span>
          </div>
          <span class="emoji" aria-hidden="true">${DAY_EMOJIS[dayIndex]}</span>
        </div>
        <div class="meals">
          ${SLOTS.map((s) => renderSlot(dayIndex, s)).join('')}
        </div>
      </section>`;
  }).join('');
}

function renderSlot(dayIndex, s) {
  const row = slotsByKey.get(`${dayIndex}:${s.key}`);
  const title = row?.title?.trim();
  const empty = !title;
  return `
    <article class="meal meal-slot ${empty ? 'meal-slot--empty' : ''}" data-type="${s.key}" data-day="${dayIndex}" data-slot="${s.key}">
      <span class="meal-icon" aria-hidden="true">${s.icon}</span>
      <span class="meal-label">${s.label}</span>
      <p class="meal-food">${empty ? '<em>Tap to add — tiny tummy, big plans</em>' : escapeHtml(title)}</p>
      ${
        !empty && (row.recipe || row.notes)
          ? `<p class="meal-meta">${escapeHtml([row.recipe, row.notes].filter(Boolean).join(' · '))}</p>`
          : ''
      }
      <button type="button" class="meal-edit-btn" aria-label="Edit ${s.label}">Edit</button>
    </article>`;
}

function formatShortDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function bindEvents() {
  rootEl.querySelector('[data-prev]').addEventListener('click', () => {
    loadWeek(addDaysISO(weekStart, -7));
  });
  rootEl.querySelector('[data-next]').addEventListener('click', () => {
    loadWeek(addDaysISO(weekStart, 7));
  });
  rootEl.querySelector('[data-today]').addEventListener('click', () => {
    loadWeek(mondayOf());
  });

  rootEl.querySelector('[data-day-nav]').addEventListener('click', (e) => {
    const pill = e.target.closest('.day-pill');
    if (!pill) return;
    dayFilter = pill.getAttribute('data-day');
    rootEl.querySelectorAll('.day-pill').forEach((p) => p.classList.remove('active'));
    pill.classList.add('active');
    rootEl.querySelectorAll('.day-card').forEach((card) => {
      if (dayFilter === 'all') card.classList.remove('hidden-day');
      else
        card.classList.toggle(
          'hidden-day',
          String(card.getAttribute('data-day-index')) !== String(dayFilter)
        );
    });
    if (dayFilter !== 'all') {
      document.getElementById(`day-${dayFilter}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  rootEl.querySelector('[data-days]').addEventListener('click', (e) => {
    const article = e.target.closest('.meal-slot');
    if (!article) return;
    openSlotModal(
      Number(article.getAttribute('data-day')),
      article.getAttribute('data-slot')
    );
  });

  const form = rootEl.querySelector('[data-slot-form]');
  const libSelect = rootEl.querySelector('[data-library-select]');

  libSelect.addEventListener('change', () => {
    const id = libSelect.value;
    if (!id) return;
    const meal = getMeals().find((m) => m.id === id);
    if (!meal) return;
    form.title.value = meal.name || '';
    form.recipe.value = meal.recipe || '';
    form.notes.value = meal.notes || '';
  });

  rootEl.querySelector('[data-clear-slot]').addEventListener('click', async () => {
    const dayIndex = Number(form.dayIndex.value);
    const slot = form.slot.value;
    try {
      setStatus('syncing');
      await clearWeekSlot({ weekStart, dayIndex, slot });
      slotsByKey.delete(`${dayIndex}:${slot}`);
      rootEl.querySelector('[data-slot-modal]').close();
      renderDays();
      setStatus('synced');
    } catch (err) {
      console.error(err);
      setStatus('error', 'clear');
      alert('Could not clear slot.');
    }
  });

  form.addEventListener('submit', async (e) => {
    if (e.submitter?.value === 'cancel') return;
    e.preventDefault();
    const dayIndex = Number(form.dayIndex.value);
    const slot = form.slot.value;
    const title = String(form.title.value || '').trim();
    const recipe = String(form.recipe.value || '').trim();
    const notes = String(form.notes.value || '').trim();
    const mealId = libSelect.value || null;
    if (!title) return;
    try {
      setStatus('syncing');
      const row = await upsertWeekSlot({
        weekStart,
        dayIndex,
        slot,
        title,
        recipe,
        notes,
        mealId,
      });
      slotsByKey.set(`${dayIndex}:${slot}`, row);
      rootEl.querySelector('[data-slot-modal]').close();
      renderDays();
      setStatus('synced');
    } catch (err) {
      console.error(err);
      setStatus('error', 'save');
      alert('Could not save slot.');
    }
  });
}

function openSlotModal(dayIndex, slotKey) {
  const s = SLOTS.find((x) => x.key === slotKey);
  const row = slotsByKey.get(`${dayIndex}:${slotKey}`);
  const modal = rootEl.querySelector('[data-slot-modal]');
  const form = rootEl.querySelector('[data-slot-form]');
  refreshLibraryPicker();
  form.querySelector('[data-slot-title]').textContent = `${DAY_NAMES[dayIndex]} · ${s?.label || slotKey}`;
  form.dayIndex.value = dayIndex;
  form.slot.value = slotKey;
  form.title.value = row?.title || '';
  form.recipe.value = row?.recipe || '';
  form.notes.value = row?.notes || '';
  rootEl.querySelector('[data-library-select]').value = row?.meal_id || '';
  modal.showModal();
  form.title.focus();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
