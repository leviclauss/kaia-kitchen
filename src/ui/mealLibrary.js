import {
  fetchMeals,
  createMeal,
  updateMeal,
  deleteMeal,
  subscribeMeals,
} from '../supabase.js';
import { setStatus } from './status.js';

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'snack', label: 'Snack' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'any', label: 'Any' },
];

let meals = [];
let unsub = null;
let rootEl = null;
let onMealsChanged = null;
let filterType = 'all';
let searchQ = '';

export function getMeals() {
  return meals;
}

export async function initMealLibrary(container, { onChange } = {}) {
  rootEl = container;
  onMealsChanged = onChange || null;
  rootEl.innerHTML = `
    <div class="library-panel">
      <div class="library-toolbar">
        <h2>Meal library</h2>
        <button type="button" class="btn btn-primary" data-action="add">+ Add meal</button>
      </div>
      <div class="library-filters">
        <input type="search" class="input" data-search placeholder="Search meals…" aria-label="Search meals" />
        <select class="input" data-filter aria-label="Filter by type">
          <option value="all">All types</option>
          ${MEAL_TYPES.map((t) => `<option value="${t.value}">${t.label}</option>`).join('')}
        </select>
      </div>
      <div class="library-list" data-list></div>
      <dialog class="modal" data-modal>
        <form method="dialog" class="modal-form" data-form>
          <h3 data-modal-title>Add meal</h3>
          <input type="hidden" name="id" />
          <label>Name
            <input class="input" name="name" required maxlength="200" placeholder="e.g. Yogurt + soft berries" />
          </label>
          <label>Type
            <select class="input" name="mealType" required>
              ${MEAL_TYPES.map((t) => `<option value="${t.value}">${t.label}</option>`).join('')}
            </select>
          </label>
          <label>Recipe <span class="optional">(optional)</span>
            <textarea class="input" name="recipe" rows="3" placeholder="Tiny steps, big crumbs…"></textarea>
          </label>
          <label>Notes <span class="optional">(optional)</span>
            <textarea class="input" name="notes" rows="2" placeholder="Texture tips, leftovers, vibes…"></textarea>
          </label>
          <div class="modal-actions">
            <button type="submit" class="btn btn-ghost" value="cancel">Cancel</button>
            <button type="submit" class="btn btn-primary" value="save">Save</button>
          </div>
        </form>
      </dialog>
    </div>
  `;

  bindEvents();
  await refresh();
  unsub = subscribeMeals(async () => {
    await refresh({ quiet: true });
  });
}

export function destroyMealLibrary() {
  if (unsub) unsub();
  unsub = null;
}

async function refresh({ quiet = false } = {}) {
  try {
    if (!quiet) setStatus('syncing');
    meals = await fetchMeals();
    renderList();
    if (onMealsChanged) onMealsChanged(meals);
    setStatus('synced');
  } catch (err) {
    console.error(err);
    setStatus('error', 'library');
  }
}

function filtered() {
  const q = searchQ.trim().toLowerCase();
  return meals.filter((m) => {
    if (filterType !== 'all' && m.meal_type !== filterType) return false;
    if (!q) return true;
    return (
      (m.name || '').toLowerCase().includes(q) ||
      (m.recipe || '').toLowerCase().includes(q) ||
      (m.notes || '').toLowerCase().includes(q)
    );
  });
}

function renderList() {
  const list = rootEl.querySelector('[data-list]');
  const items = filtered();
  if (!items.length) {
    list.innerHTML = `<p class="empty-hint">No meals yet — add one, or re-run the SQL seed. The floor is not a meal (usually).</p>`;
    return;
  }
  list.innerHTML = items
    .map(
      (m) => `
    <article class="library-item" data-id="${m.id}">
      <div class="library-item-main">
        <span class="type-chip type-chip--${m.meal_type}">${m.meal_type}</span>
        <h3>${escapeHtml(m.name)}</h3>
        ${m.recipe ? `<p class="muted">${escapeHtml(m.recipe)}</p>` : ''}
        ${m.notes ? `<p class="notes-line">${escapeHtml(m.notes)}</p>` : ''}
      </div>
      <div class="library-item-actions">
        <button type="button" class="btn btn-sm" data-edit="${m.id}">Edit</button>
        <button type="button" class="btn btn-sm btn-danger" data-delete="${m.id}">Delete</button>
      </div>
    </article>`
    )
    .join('');
}

function bindEvents() {
  rootEl.querySelector('[data-action="add"]').addEventListener('click', () => openModal());
  rootEl.querySelector('[data-search]').addEventListener('input', (e) => {
    searchQ = e.target.value;
    renderList();
  });
  rootEl.querySelector('[data-filter]').addEventListener('change', (e) => {
    filterType = e.target.value;
    renderList();
  });

  rootEl.querySelector('[data-list]').addEventListener('click', async (e) => {
    const editId = e.target.closest('[data-edit]')?.getAttribute('data-edit');
    const delId = e.target.closest('[data-delete]')?.getAttribute('data-delete');
    if (editId) {
      const meal = meals.find((m) => m.id === editId);
      if (meal) openModal(meal);
    }
    if (delId) {
      if (!confirm('Delete this meal from the library? (Week slots keep their copied text.)')) return;
      try {
        setStatus('syncing');
        await deleteMeal(delId);
        await refresh();
      } catch (err) {
        console.error(err);
        setStatus('error', 'delete');
        alert('Could not delete meal. Check Supabase policies / connection.');
      }
    }
  });

  const form = rootEl.querySelector('[data-form]');
  form.addEventListener('submit', async (e) => {
    const submitter = e.submitter;
    if (submitter?.value === 'cancel') return;
    e.preventDefault();
    const fd = new FormData(form);
    const id = fd.get('id');
    const payload = {
      name: String(fd.get('name') || '').trim(),
      mealType: String(fd.get('mealType') || 'any'),
      recipe: String(fd.get('recipe') || '').trim(),
      notes: String(fd.get('notes') || '').trim(),
    };
    if (!payload.name) return;
    try {
      setStatus('syncing');
      if (id) await updateMeal(id, payload);
      else await createMeal(payload);
      rootEl.querySelector('[data-modal]').close();
      await refresh();
    } catch (err) {
      console.error(err);
      setStatus('error', 'save');
      alert('Could not save meal.');
    }
  });
}

function openModal(meal = null) {
  const modal = rootEl.querySelector('[data-modal]');
  const form = rootEl.querySelector('[data-form]');
  form.querySelector('[data-modal-title]').textContent = meal ? 'Edit meal' : 'Add meal';
  form.id.value = meal?.id || '';
  form.name.value = meal?.name || '';
  form.mealType.value = meal?.meal_type || 'any';
  form.recipe.value = meal?.recipe || '';
  form.notes.value = meal?.notes || '';
  modal.showModal();
  form.name.focus();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
