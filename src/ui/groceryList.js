import {
  fetchGroceryItems,
  createGroceryItem,
  updateGroceryItem,
  deleteGroceryItem,
  mergePlanGroceryItems,
  resetGroceryFromPlan,
  clearHaveGroceryItems,
  subscribeGroceryItems,
  fetchWeekSlots,
} from '../supabase.js';
import {
  mondayOf,
  addDaysISO,
  formatWeekLabel,
} from '../data/seedMeals.js';
import {
  getWeekStart,
  setWeekStart,
  subscribeWeekStart,
} from '../weekStore.js';
import { setStatus } from './status.js';

const GENERIC_DROP = new Set([
  'and',
  'or',
  'with',
  'side',
  'of',
  'a',
  'an',
  'the',
  'to',
  'for',
  'plain',
  'soft',
  'mild',
  'leftover',
  'leftovers',
]);

let rootEl = null;
let weekStart = getWeekStart();
let items = [];
let filter = 'need'; // need | have | all
let unsub = null;
let unsubWeek = null;

export async function initGroceryList(container) {
  rootEl = container;
  weekStart = getWeekStart();
  rootEl.innerHTML = `
    <div class="grocery-panel">
      <div class="week-nav">
        <button type="button" class="btn btn-icon" data-prev aria-label="Previous week">‹</button>
        <div class="week-nav-center">
          <h2 class="week-label" data-week-label></h2>
          <button type="button" class="btn btn-sm btn-ghost" data-today>This week</button>
        </div>
        <button type="button" class="btn btn-icon" data-next aria-label="Next week">›</button>
      </div>

      <div class="grocery-toolbar">
        <div class="grocery-toolbar-text">
          <div class="library-title-row">
            <h2>Grocery list</h2>
            <span class="count-badge" data-need-count>0</span>
          </div>
          <p class="library-subtitle">Need-to-buy checklist for this week 🛒</p>
        </div>
        <div class="grocery-toolbar-actions">
          <button type="button" class="btn btn-primary" data-generate>Generate from week</button>
          <button type="button" class="btn" data-add>+ Add item</button>
          <button type="button" class="btn btn-sm btn-ghost" data-clear-have>Clear have</button>
          <button type="button" class="btn btn-sm btn-danger" data-reset title="Replace list from plan">Reset from plan</button>
        </div>
      </div>

      <div class="filter-chips grocery-filters" role="group" aria-label="Filter grocery items" data-filters>
        <button type="button" class="filter-chip active" data-filter="need">Need to buy</button>
        <button type="button" class="filter-chip" data-filter="have">Have</button>
        <button type="button" class="filter-chip" data-filter="all">All</button>
      </div>

      <div class="grocery-list" data-list></div>
    </div>
  `;

  bindEvents();
  if (unsubWeek) unsubWeek();
  unsubWeek = subscribeWeekStart((ws) => {
    if (ws !== weekStart) loadWeek(ws);
  });
  await loadWeek(getWeekStart());
}

export function destroyGroceryList() {
  if (unsub) unsub();
  unsub = null;
  if (unsubWeek) unsubWeek();
  unsubWeek = null;
}

async function loadWeek(start) {
  weekStart = start;
  setWeekStart(start);
  updateWeekLabel();
  if (unsub) unsub();
  try {
    setStatus('syncing');
    items = await fetchGroceryItems(weekStart);
    renderList();
    unsub = subscribeGroceryItems(weekStart, async () => {
      try {
        items = await fetchGroceryItems(weekStart);
        renderList();
        setStatus('synced');
      } catch (err) {
        console.error(err);
        setStatus('error', 'realtime');
      }
    });
    setStatus('synced');
  } catch (err) {
    console.error(err);
    setStatus('error', 'grocery');
    items = [];
    renderList();
  }
}

function updateWeekLabel() {
  const label = rootEl.querySelector('[data-week-label]');
  if (label) label.textContent = formatWeekLabel(weekStart);
}

function visibleItems() {
  if (filter === 'need') return items.filter((i) => !i.have_it);
  if (filter === 'have') return items.filter((i) => i.have_it);
  return items;
}

function renderList() {
  const list = rootEl.querySelector('[data-list]');
  const needCount = items.filter((i) => !i.have_it).length;
  const badge = rootEl.querySelector('[data-need-count]');
  if (badge) badge.textContent = String(needCount);

  const rows = visibleItems();
  if (!items.length) {
    list.innerHTML = `
      <div class="empty-state grocery-empty">
        <div class="empty-state-emoji" aria-hidden="true">🍓🛒🐕</div>
        <h3>Empty basket</h3>
        <p class="muted">Tap <strong>Generate from week</strong> to pull ingredients from meal slots, or add your own.</p>
        <button type="button" class="btn btn-primary" data-empty-generate>Generate from week</button>
      </div>`;
    list.querySelector('[data-empty-generate]')?.addEventListener('click', () => generateFromWeek(false));
    return;
  }

  if (!rows.length) {
    list.innerHTML = `
      <div class="empty-state grocery-empty">
        <div class="empty-state-emoji" aria-hidden="true">${filter === 'have' ? '✨' : '📝'}</div>
        <h3>${filter === 'have' ? 'Nothing marked as have yet' : 'All caught up!'}</h3>
        <p class="muted">${
          filter === 'have'
            ? 'Check items off as you find them in the fridge.'
            : 'Everything on the list is marked as have. Nice shopping!'
        }</p>
      </div>`;
    return;
  }

  list.innerHTML = rows
    .map((item) => {
      const checked = item.have_it ? 'checked' : '';
      const haveClass = item.have_it ? 'grocery-row--have' : '';
      const sourceHint =
        item.source === 'plan'
          ? '<span class="grocery-source" title="From meal plan">plan</span>'
          : '<span class="grocery-source grocery-source--manual" title="Added manually">manual</span>';
      return `
        <div class="grocery-row ${haveClass}" data-id="${item.id}">
          <label class="grocery-check">
            <input type="checkbox" data-toggle ${checked} aria-label="Have ${escapeHtml(item.name)}" />
            <span class="grocery-check-ui" aria-hidden="true"></span>
          </label>
          <input class="input grocery-name" data-name value="${escapeAttr(item.name)}" maxlength="200" aria-label="Item name" />
          ${sourceHint}
          <button type="button" class="btn btn-sm btn-danger grocery-delete" data-delete aria-label="Remove ${escapeHtml(item.name)}">✕</button>
        </div>`;
    })
    .join('');
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

  rootEl.querySelector('[data-filters]').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filter]');
    if (!chip) return;
    filter = chip.getAttribute('data-filter');
    rootEl.querySelectorAll('[data-filter]').forEach((c) => {
      c.classList.toggle('active', c === chip);
    });
    renderList();
  });

  rootEl.querySelector('[data-generate]').addEventListener('click', () => generateFromWeek(false));
  rootEl.querySelector('[data-reset]').addEventListener('click', () => {
    if (
      !confirm(
        'Reset from plan? This replaces the whole grocery list for this week (manual items and checkoffs will be cleared).'
      )
    ) {
      return;
    }
    generateFromWeek(true);
  });
  rootEl.querySelector('[data-add]').addEventListener('click', () => addManualItem());
  rootEl.querySelector('[data-clear-have]').addEventListener('click', async () => {
    try {
      setStatus('syncing');
      await clearHaveGroceryItems(weekStart);
      items = await fetchGroceryItems(weekStart);
      renderList();
      setStatus('synced');
    } catch (err) {
      console.error(err);
      setStatus('error', 'clear');
      alert('Could not clear have items.');
    }
  });

  rootEl.querySelector('[data-list]').addEventListener('change', async (e) => {
    const toggle = e.target.closest('[data-toggle]');
    if (!toggle) return;
    const row = toggle.closest('[data-id]');
    const id = row?.getAttribute('data-id');
    if (!id) return;
    const haveIt = toggle.checked;
    try {
      setStatus('syncing');
      const updated = await updateGroceryItem(id, { haveIt });
      items = items.map((i) => (i.id === id ? updated : i));
      renderList();
      setStatus('synced');
    } catch (err) {
      console.error(err);
      setStatus('error', 'toggle');
      toggle.checked = !haveIt;
      alert('Could not update item.');
    }
  });

  rootEl.querySelector('[data-list]').addEventListener('click', async (e) => {
    const del = e.target.closest('[data-delete]');
    if (!del) return;
    const row = del.closest('[data-id]');
    const id = row?.getAttribute('data-id');
    if (!id) return;
    try {
      setStatus('syncing');
      await deleteGroceryItem(id);
      items = items.filter((i) => i.id !== id);
      renderList();
      setStatus('synced');
    } catch (err) {
      console.error(err);
      setStatus('error', 'delete');
      alert('Could not delete item.');
    }
  });

  let nameTimer = null;
  rootEl.querySelector('[data-list]').addEventListener('input', (e) => {
    const input = e.target.closest('[data-name]');
    if (!input) return;
    const row = input.closest('[data-id]');
    const id = row?.getAttribute('data-id');
    if (!id) return;
    clearTimeout(nameTimer);
    nameTimer = setTimeout(async () => {
      const name = String(input.value || '').trim();
      if (!name) return;
      try {
        setStatus('syncing');
        const updated = await updateGroceryItem(id, { name });
        items = items.map((i) => (i.id === id ? updated : i));
        setStatus('synced');
      } catch (err) {
        console.error(err);
        setStatus('error', 'rename');
        // Unique constraint clash — refresh
        try {
          items = await fetchGroceryItems(weekStart);
          renderList();
        } catch {
          /* ignore */
        }
        alert('Could not rename (maybe a duplicate name?).');
      }
    }, 450);
  });
}

async function addManualItem() {
  const name = prompt('Add grocery item:');
  if (name == null) return;
  const trimmed = String(name).trim();
  if (!trimmed) return;
  try {
    setStatus('syncing');
    const row = await createGroceryItem({
      weekStart,
      name: trimmed,
      haveIt: false,
      source: 'manual',
    });
    items = [...items, row];
    renderList();
    setStatus('synced');
  } catch (err) {
    console.error(err);
    setStatus('error', 'add');
    alert('Could not add item (maybe it already exists?).');
    try {
      items = await fetchGroceryItems(weekStart);
      renderList();
    } catch {
      /* ignore */
    }
  }
}

async function generateFromWeek(reset) {
  try {
    setStatus('syncing');
    const slots = await fetchWeekSlots(weekStart);
    const names = extractIngredientsFromSlots(slots);
    if (!names.length) {
      setStatus('synced');
      alert('No meal titles found for this week yet. Fill the week planner first!');
      return;
    }
    if (reset) {
      items = await resetGroceryFromPlan(weekStart, names);
    } else {
      items = await mergePlanGroceryItems(weekStart, names);
    }
    // Prefer need filter after generate
    filter = 'need';
    rootEl.querySelectorAll('[data-filter]').forEach((c) => {
      c.classList.toggle('active', c.getAttribute('data-filter') === 'need');
    });
    renderList();
    setStatus('synced');
  } catch (err) {
    console.error(err);
    setStatus('error', 'generate');
    alert('Could not generate grocery list.');
  }
}

/** v1 ingredient extraction from week slot titles (+ optional recipe first line). */
export function extractIngredientsFromSlots(slots) {
  const displayByKey = new Map(); // lower → first casing
  for (const slot of slots || []) {
    const title = String(slot?.title || '').trim();
    if (!title) continue;
    collectParts(title, displayByKey);
    const recipe = String(slot?.recipe || '').trim();
    if (recipe) {
      const firstLine = recipe.split(/\r?\n/)[0] || '';
      if (firstLine.trim()) collectParts(firstLine, displayByKey);
    }
  }
  return [...displayByKey.values()];
}

function collectParts(text, displayByKey) {
  const parts = text
    .split(/,|\+|\/|\band\b/gi)
    .map((p) => p.trim())
    .filter(Boolean);

  for (let part of parts) {
    // Drop trailing parenthetical notes: "blueberries (halved)" → keep but trim junk
    part = part.replace(/\s+/g, ' ').trim();
    // Skip very short / generic tokens
    const lower = part.toLowerCase();
    if (part.length < 2) continue;
    if (GENERIC_DROP.has(lower)) continue;
    // Skip pure fillers like "plain or with mashed banana" fragments that are too long? keep them for v1
    if (!displayByKey.has(lower)) {
      displayByKey.set(lower, part);
    }
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, '&#39;');
}
