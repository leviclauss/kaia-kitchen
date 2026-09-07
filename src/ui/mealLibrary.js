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

const FILTER_CHIPS = [{ value: 'all', label: 'All' }, ...MEAL_TYPES];

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
    <div class="library-panel recipe-book">
      <div class="library-toolbar">
        <div class="library-toolbar-text">
          <div class="library-title-row">
            <h2>Recipe book</h2>
            <span class="count-badge" data-count>0</span>
          </div>
          <p class="library-subtitle">Kaia's saved meals &amp; snacks</p>
        </div>
        <button type="button" class="btn btn-primary btn-add-recipe" data-action="add">+ Add recipe</button>
      </div>
      <div class="library-filters">
        <input type="search" class="input" data-search placeholder="Search recipes…" aria-label="Search recipes" />
        <div class="filter-chips" role="group" aria-label="Filter by type" data-chips>
          ${FILTER_CHIPS.map(
            (t) =>
              `<button type="button" class="filter-chip${t.value === 'all' ? ' active' : ''}" data-filter-chip="${t.value}">${t.label}</button>`
          ).join('')}
        </div>
        <select class="input filter-select-fallback" data-filter aria-label="Filter by type">
          <option value="all">All types</option>
          ${MEAL_TYPES.map((t) => `<option value="${t.value}">${t.label}</option>`).join('')}
        </select>
      </div>
      <div class="library-grid" data-list></div>
      <dialog class="modal" data-modal>
        <form method="dialog" class="modal-form" data-form>
          <h3 data-modal-title>Add recipe</h3>
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
            <textarea class="input" name="recipe" rows="6" placeholder="Tiny steps, big crumbs…"></textarea>
          </label>
          <label>Notes <span class="optional">(optional)</span>
            <textarea class="input" name="notes" rows="2" placeholder="Texture tips, leftovers, vibes…"></textarea>
          </label>
          <label class="liked-check">
            <input type="checkbox" name="liked" />
            <span>❤️ Liked</span>
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
  window.addEventListener('kaia:meals-changed', onMealsChangedEvent);
}

function onMealsChangedEvent() {
  refresh({ quiet: true });
}

export function destroyMealLibrary() {
  window.removeEventListener('kaia:meals-changed', onMealsChangedEvent);
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

function previewLines(text, maxLines = 3) {
  if (!text) return '';
  const lines = String(text).trim().split(/\n+/).filter(Boolean);
  const clipped = lines.slice(0, maxLines).join('\n');
  return escapeHtml(clipped);
}

function renderList() {
  const list = rootEl.querySelector('[data-list]');
  const countEl = rootEl.querySelector('[data-count]');
  const items = filtered();
  if (countEl) countEl.textContent = String(meals.length);

  if (!items.length) {
    const noRecipes = meals.length === 0;
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-emoji">${noRecipes ? '📖🍓' : '🔍'}</div>
        <h3>${noRecipes ? 'Your recipe book is empty' : 'No matching recipes'}</h3>
        <p class="muted">${
          noRecipes
            ? "Add Kaia's first meal or snack — or re-run the SQL seed. The floor is not a meal (usually)."
            : 'Try another search or type filter.'
        }</p>
        ${
          noRecipes
            ? `<button type="button" class="btn btn-primary" data-empty-add>+ Add recipe</button>`
            : `<button type="button" class="btn btn-ghost" data-empty-clear>Clear filters</button>`
        }
      </div>`;
    return;
  }

  list.innerHTML = items
    .map((m) => {
      const liked = !!m.liked;
      const recipePreview = m.recipe
        ? `<p class="recipe-preview">${previewLines(m.recipe, 3)}</p>`
        : `<p class="recipe-preview recipe-preview--empty muted">No recipe steps yet</p>`;
      const notes = m.notes
        ? `<p class="notes-line">${escapeHtml(m.notes)}</p>`
        : '';
      return `
    <article class="recipe-card${liked ? ' recipe-card--liked' : ''}" data-id="${m.id}">
      <button type="button" class="recipe-card-body" data-open="${m.id}" aria-label="Edit ${escapeHtml(m.name)}">
        <div class="recipe-card-top">
          <span class="type-chip type-chip--${m.meal_type}">${m.meal_type}</span>
          <span class="liked-badge" aria-hidden="true">${liked ? '❤️' : ''}</span>
        </div>
        <h3>${escapeHtml(m.name)}</h3>
        ${recipePreview}
        ${notes}
      </button>
      <div class="recipe-card-actions">
        <button type="button" class="btn btn-sm liked-toggle${liked ? ' is-liked' : ''}" data-like="${m.id}" aria-pressed="${liked}" title="${liked ? 'Unlike' : 'Like'}">
          ${liked ? '❤️ Liked' : '♡ Like'}
        </button>
        <button type="button" class="btn btn-sm" data-edit="${m.id}">Edit</button>
        <button type="button" class="btn btn-sm btn-danger" data-delete="${m.id}">Remove</button>
      </div>
    </article>`;
    })
    .join('');
}

function setFilter(value) {
  filterType = value;
  rootEl.querySelectorAll('[data-filter-chip]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-filter-chip') === value);
  });
  const select = rootEl.querySelector('[data-filter]');
  if (select) select.value = value;
  renderList();
}

function bindEvents() {
  rootEl.querySelector('[data-action="add"]').addEventListener('click', () => openModal());
  rootEl.querySelector('[data-search]').addEventListener('input', (e) => {
    searchQ = e.target.value;
    renderList();
  });
  rootEl.querySelector('[data-filter]').addEventListener('change', (e) => {
    setFilter(e.target.value);
  });
  rootEl.querySelector('[data-chips]').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filter-chip]');
    if (!chip) return;
    setFilter(chip.getAttribute('data-filter-chip'));
  });

  rootEl.querySelector('[data-list]').addEventListener('click', async (e) => {
    const emptyAdd = e.target.closest('[data-empty-add]');
    if (emptyAdd) {
      openModal();
      return;
    }
    const emptyClear = e.target.closest('[data-empty-clear]');
    if (emptyClear) {
      searchQ = '';
      const search = rootEl.querySelector('[data-search]');
      if (search) search.value = '';
      setFilter('all');
      return;
    }

    const likeId = e.target.closest('[data-like]')?.getAttribute('data-like');
    if (likeId) {
      e.preventDefault();
      e.stopPropagation();
      const meal = meals.find((m) => m.id === likeId);
      if (!meal) return;
      try {
        setStatus('syncing');
        await updateMeal(likeId, {
          name: meal.name,
          mealType: meal.meal_type,
          recipe: meal.recipe || '',
          notes: meal.notes || '',
          liked: !meal.liked,
        });
        await refresh();
      } catch (err) {
        console.error(err);
        setStatus('error', 'like');
        alert('Could not update liked status.');
      }
      return;
    }

    const editId =
      e.target.closest('[data-edit]')?.getAttribute('data-edit') ||
      e.target.closest('[data-open]')?.getAttribute('data-open');
    const delId = e.target.closest('[data-delete]')?.getAttribute('data-delete');

    if (editId && !delId) {
      const meal = meals.find((m) => m.id === editId);
      if (meal) openModal(meal);
      return;
    }

    if (delId) {
      e.preventDefault();
      e.stopPropagation();
      if (!confirm('Remove this recipe from the book? (Week slots keep their copied text.)')) return;
      try {
        setStatus('syncing');
        await deleteMeal(delId);
        await refresh();
      } catch (err) {
        console.error(err);
        setStatus('error', 'delete');
        alert('Could not remove recipe. Check Supabase policies / connection.');
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
      liked: form.liked.checked,
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
      alert('Could not save recipe.');
    }
  });
}

function openModal(meal = null) {
  const modal = rootEl.querySelector('[data-modal]');
  const form = rootEl.querySelector('[data-form]');
  form.querySelector('[data-modal-title]').textContent = meal ? 'Edit recipe' : 'Add recipe';
  form.id.value = meal?.id || '';
  form.name.value = meal?.name || '';
  form.mealType.value = meal?.meal_type || 'any';
  form.recipe.value = meal?.recipe || '';
  form.notes.value = meal?.notes || '';
  form.liked.checked = !!meal?.liked;
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
