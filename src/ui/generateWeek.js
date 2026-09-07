import {
  getClient,
  bulkInsertWeekSlots,
  createMeal,
  HOUSEHOLD_ID,
} from '../supabase.js';
import {
  SLOTS,
  DAY_NAMES,
  DAY_SHORT,
} from '../data/seedMeals.js';
import { setStatus } from './status.js';

const SLOT_TO_MEAL_TYPE = {
  breakfast: 'breakfast',
  snack1: 'snack',
  snack2: 'snack',
  lunch: 'lunch',
  dinner: 'dinner',
};

let hostEl = null;
let draft = null; // { days: [...] } mutable
let onApplied = null;
let onLibraryChanged = null;

/**
 * Mount generate-week UI into the week planner panel.
 * @param {HTMLElement} container week planner root
 * @param {{ getWeekStart: () => string, onApplied: () => void|Promise, onLibraryChanged?: () => void }} opts
 */
export function initGenerateWeek(container, opts) {
  hostEl = container;
  onApplied = opts.onApplied || null;
  onLibraryChanged = opts.onLibraryChanged || null;

  // Toolbar button + modal
  const weekPanel = container.querySelector('.week-panel');
  if (!weekPanel) return;

  let toolbar = weekPanel.querySelector('[data-generate-toolbar]');
  if (!toolbar) {
    toolbar = document.createElement('div');
    toolbar.className = 'generate-toolbar';
    toolbar.setAttribute('data-generate-toolbar', '');
    toolbar.innerHTML = `
      <button type="button" class="btn btn-primary generate-week-btn" data-open-generate>
        ✨ Generate week
      </button>
      <p class="generate-toolbar-hint muted">Blend the recipe book with soft new finger-food ideas</p>
    `;
    const dayNav = weekPanel.querySelector('[data-day-nav]');
    if (dayNav) weekPanel.insertBefore(toolbar, dayNav);
    else weekPanel.insertBefore(toolbar, weekPanel.querySelector('[data-days]'));
  }

  if (!weekPanel.querySelector('[data-generate-modal]')) {
    const dialog = document.createElement('dialog');
    dialog.className = 'modal generate-modal';
    dialog.setAttribute('data-generate-modal', '');
    dialog.innerHTML = `
      <div class="generate-modal-inner">
        <header class="generate-modal-header">
          <h3>✨ Nom Nom week magic</h3>
          <button type="button" class="btn btn-ghost btn-sm" data-close-generate aria-label="Close">✕</button>
        </header>

        <section class="generate-setup" data-generate-setup>
          <p class="generate-blurb">
            Whip up a full Mon–Sun plan for <strong>this week</strong>: mix trusted recipes from the book
            with brand-new soft finger-food ideas. You can edit every slot before applying.
          </p>
          <div class="ratio-slider-block">
            <div class="ratio-labels">
              <span>📖 From the book</span>
              <span class="ratio-value" data-ratio-label>60% book</span>
              <span>🎨 Try new</span>
            </div>
            <input
              type="range"
              class="ratio-slider"
              data-ratio
              min="0"
              max="100"
              step="5"
              value="60"
              aria-label="From the book versus try new"
            />
            <p class="muted ratio-hint">
              Left = invent more new meals · Right = stick closer to the recipe book (liked meals preferred). Default ~60% from the book.
            </p>
          </div>
          <div class="generate-setup-actions">
            <button type="button" class="btn btn-ghost" data-close-generate>Cancel</button>
            <button type="button" class="btn btn-primary" data-run-generate>Generate ✨</button>
          </div>
        </section>

        <section class="generate-loading hidden" data-generate-loading>
          <div class="generate-spinner" aria-hidden="true">🍓</div>
          <p class="generate-loading-text">Stirring soft bites &amp; tiny ideas…</p>
          <p class="muted">This can take a little while.</p>
        </section>

        <section class="generate-error hidden" data-generate-error>
          <p class="generate-error-msg" data-error-msg></p>
          <div class="generate-setup-actions">
            <button type="button" class="btn btn-ghost" data-back-setup>Back</button>
            <button type="button" class="btn btn-primary" data-run-generate>Try again</button>
          </div>
        </section>

        <section class="generate-draft hidden" data-generate-draft>
          <div class="generate-draft-meta">
            <p class="muted" data-draft-stats></p>
            <label class="save-new-check">
              <input type="checkbox" data-save-all-new checked />
              <span>Save new recipes to book</span>
            </label>
          </div>
          <div class="generate-draft-grid" data-draft-grid></div>
          <div class="generate-draft-actions">
            <button type="button" class="btn btn-ghost" data-discard-draft>Discard</button>
            <button type="button" class="btn btn-primary" data-apply-draft>Apply to this week</button>
          </div>
        </section>
      </div>
    `;
    weekPanel.appendChild(dialog);
  }

  bindEvents(opts);
}

export function destroyGenerateWeek() {
  hostEl = null;
  draft = null;
  onApplied = null;
  onLibraryChanged = null;
}

function modal() {
  return hostEl?.querySelector('[data-generate-modal]');
}

function showSection(name) {
  const m = modal();
  if (!m) return;
  m.querySelector('[data-generate-setup]')?.classList.toggle('hidden', name !== 'setup');
  m.querySelector('[data-generate-loading]')?.classList.toggle('hidden', name !== 'loading');
  m.querySelector('[data-generate-error]')?.classList.toggle('hidden', name !== 'error');
  m.querySelector('[data-generate-draft]')?.classList.toggle('hidden', name !== 'draft');
}

function bindEvents(opts) {
  const weekPanel = hostEl.querySelector('.week-panel');
  if (!weekPanel || weekPanel.__generateBound) return;
  weekPanel.__generateBound = true;

  weekPanel.addEventListener('click', (e) => {
    if (e.target.closest('[data-open-generate]')) {
      openModal();
      return;
    }
    if (e.target.closest('[data-close-generate]')) {
      closeModal();
      return;
    }
    if (e.target.closest('[data-run-generate]')) {
      runGenerate(opts);
      return;
    }
    if (e.target.closest('[data-back-setup]')) {
      showSection('setup');
      return;
    }
    if (e.target.closest('[data-discard-draft]')) {
      draft = null;
      showSection('setup');
      return;
    }
    if (e.target.closest('[data-apply-draft]')) {
      applyDraft(opts);
      return;
    }
  });

  weekPanel.addEventListener('input', (e) => {
    const slider = e.target.closest('[data-ratio]');
    if (slider) {
      updateRatioLabel(Number(slider.value));
      return;
    }
    const titleInput = e.target.closest('[data-draft-title]');
    if (titleInput && draft) {
      const di = Number(titleInput.getAttribute('data-day'));
      const slot = titleInput.getAttribute('data-slot');
      const day = draft.days.find((d) => d.dayIndex === di);
      if (day?.slots?.[slot]) day.slots[slot].title = titleInput.value;
      return;
    }
    const recipeInput = e.target.closest('[data-draft-recipe]');
    if (recipeInput && draft) {
      const di = Number(recipeInput.getAttribute('data-day'));
      const slot = recipeInput.getAttribute('data-slot');
      const day = draft.days.find((d) => d.dayIndex === di);
      if (day?.slots?.[slot]) {
        day.slots[slot].recipe = recipeInput.value.trim() || null;
      }
      return;
    }
    const saveOne = e.target.closest('[data-save-new]');
    if (saveOne && draft) {
      const di = Number(saveOne.getAttribute('data-day'));
      const slot = saveOne.getAttribute('data-slot');
      const day = draft.days.find((d) => d.dayIndex === di);
      if (day?.slots?.[slot]) day.slots[slot].saveToBook = saveOne.checked;
    }
  });

  weekPanel.addEventListener('change', (e) => {
    const all = e.target.closest('[data-save-all-new]');
    if (!all || !draft) return;
    const checked = all.checked;
    for (const day of draft.days) {
      for (const s of SLOTS) {
        const cell = day.slots[s.key];
        if (cell?.source === 'new') cell.saveToBook = checked;
      }
    }
    renderDraftGrid();
  });
}

function updateRatioLabel(v) {
  const label = modal()?.querySelector('[data-ratio-label]');
  if (!label) return;
  const book = Math.max(0, Math.min(100, v));
  const neu = 100 - book;
  label.textContent = `${book}% book · ${neu}% new`;
}

function openModal() {
  const m = modal();
  if (!m) return;
  const slider = m.querySelector('[data-ratio]');
  if (slider && !draft) {
    slider.value = '60';
    updateRatioLabel(60);
  }
  if (draft) showSection('draft');
  else showSection('setup');
  m.showModal();
}

function closeModal() {
  modal()?.close();
}

async function runGenerate(opts) {
  const m = modal();
  if (!m) return;
  const slider = m.querySelector('[data-ratio]');
  const existingRatio = Number(slider?.value ?? 60);
  const weekStart = opts.getWeekStart();

  showSection('loading');
  setStatus('syncing', 'generating');

  try {
    const client = getClient();
    if (!client) throw new Error('Supabase not connected');

    const { data, error } = await client.functions.invoke('generate-week', {
      body: { existingRatio, weekStart },
    });

    if (error) {
      let detail = error.message || String(error);
      try {
        // functions.invoke may stash response body on context
        if (data?.error) detail = data.error + (data.detail ? `: ${data.detail}` : '');
      } catch {
        /* ignore */
      }
      throw new Error(detail);
    }

    if (!data?.ok || !data?.plan?.days) {
      throw new Error(data?.error || 'Unexpected response from generate-week');
    }

    draft = structuredClone(data.plan);
    const saveAll = m.querySelector('[data-save-all-new]');
    const defaultSave = saveAll ? saveAll.checked : true;
    for (const day of draft.days) {
      for (const s of SLOTS) {
        const cell = day.slots[s.key];
        if (cell?.source === 'new') cell.saveToBook = defaultSave;
      }
    }

    const stats = m.querySelector('[data-draft-stats]');
    if (stats) {
      const st = data.stats || {};
      stats.textContent = `Draft ready · ~${st.bookSlots ?? '?'} from book · ~${st.newSlots ?? '?'} new · edit anything below`;
    }

    renderDraftGrid();
    showSection('draft');
    setStatus('synced');
  } catch (err) {
    console.error(err);
    setStatus('error', 'generate');
    const msg = m.querySelector('[data-error-msg]');
    if (msg) {
      msg.textContent =
        err?.message ||
        'Could not generate a week. Check that the generate-week function is deployed and CHUTES_API_KEY is set.';
    }
    showSection('error');
  }
}

function renderDraftGrid() {
  const grid = modal()?.querySelector('[data-draft-grid]');
  if (!grid || !draft) return;

  grid.innerHTML = draft.days
    .map((day) => {
      const di = day.dayIndex;
      return `
        <article class="draft-day">
          <h4 class="draft-day-title">${DAY_NAMES[di] || DAY_SHORT[di]}</h4>
          <div class="draft-slots">
            ${SLOTS.map((s) => {
              const cell = day.slots[s.key] || {};
              const isNew = cell.source === 'new';
              const badge = isNew
                ? '<span class="source-badge source-new">new</span>'
                : '<span class="source-badge source-book">book</span>';
              const saveRow = isNew
                ? `<label class="draft-save-one"><input type="checkbox" data-save-new data-day="${di}" data-slot="${s.key}" ${
                    cell.saveToBook !== false ? 'checked' : ''
                  } /> Save</label>`
                : '';
              return `
                <div class="draft-slot" data-type="${s.key}">
                  <div class="draft-slot-head">
                    <span>${s.icon} ${s.label}</span>
                    ${badge}
                  </div>
                  <input
                    class="input"
                    data-draft-title
                    data-day="${di}"
                    data-slot="${s.key}"
                    value="${escapeAttr(cell.title || '')}"
                    maxlength="300"
                  />
                  <textarea
                    class="input draft-recipe"
                    data-draft-recipe
                    data-day="${di}"
                    data-slot="${s.key}"
                    rows="2"
                    placeholder="Recipe / notes (optional)"
                  >${escapeHtml(cell.recipe || cell.notes || '')}</textarea>
                  ${saveRow}
                </div>`;
            }).join('')}
          </div>
        </article>`;
    })
    .join('');
}

async function applyDraft(opts) {
  if (!draft) return;
  const weekStart = opts.getWeekStart();
  const m = modal();
  const applyBtn = m?.querySelector('[data-apply-draft]');
  if (applyBtn) applyBtn.disabled = true;

  try {
    setStatus('syncing', 'applying');

    // Sync titles/recipes from DOM in case input events missed
    m?.querySelectorAll('[data-draft-title]').forEach((el) => {
      const di = Number(el.getAttribute('data-day'));
      const slot = el.getAttribute('data-slot');
      const day = draft.days.find((d) => d.dayIndex === di);
      if (day?.slots?.[slot]) day.slots[slot].title = el.value.trim();
    });
    m?.querySelectorAll('[data-draft-recipe]').forEach((el) => {
      const di = Number(el.getAttribute('data-day'));
      const slot = el.getAttribute('data-slot');
      const day = draft.days.find((d) => d.dayIndex === di);
      if (day?.slots?.[slot]) {
        const v = el.value.trim();
        day.slots[slot].recipe = v || day.slots[slot].recipe;
      }
    });
    m?.querySelectorAll('[data-save-new]').forEach((el) => {
      const di = Number(el.getAttribute('data-day'));
      const slot = el.getAttribute('data-slot');
      const day = draft.days.find((d) => d.dayIndex === di);
      if (day?.slots?.[slot]) day.slots[slot].saveToBook = el.checked;
    });

    // Optionally save new recipes first, collect meal ids
    for (const day of draft.days) {
      for (const s of SLOTS) {
        const cell = day.slots[s.key];
        if (!cell || cell.source !== 'new' || !cell.saveToBook) continue;
        const title = (cell.title || '').trim();
        if (!title) continue;
        try {
          const created = await createMeal({
            name: title,
            mealType: SLOT_TO_MEAL_TYPE[s.key] || 'any',
            recipe: cell.recipe || null,
            notes: cell.notes || null,
            liked: false,
          });
          cell.mealId = created.id;
          cell.source = 'book';
        } catch (err) {
          console.warn('Could not save new recipe to book', title, err);
        }
      }
    }

    const rows = [];
    for (const day of draft.days) {
      for (const s of SLOTS) {
        const cell = day.slots[s.key];
        if (!cell) continue;
        const title = (cell.title || '').trim();
        if (!title) continue;
        rows.push({
          household_id: HOUSEHOLD_ID,
          week_start: weekStart,
          day_index: day.dayIndex,
          slot: s.key,
          title,
          recipe: cell.recipe || null,
          notes: cell.notes || null,
          meal_id: cell.mealId || null,
        });
      }
    }

    await bulkInsertWeekSlots(rows);

    if (onLibraryChanged) onLibraryChanged();
    draft = null;
    closeModal();
    if (onApplied) await onApplied();
    setStatus('synced');
  } catch (err) {
    console.error(err);
    setStatus('error', 'apply');
    alert('Could not apply the generated week. Please try again.');
  } finally {
    if (applyBtn) applyBtn.disabled = false;
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
