import './styles/main.css';
import { loadConfig, isConfigured } from './supabase.js';
import { renderSetupScreen } from './ui/setup.js';
import { initStickers } from './ui/stickers.js';
import { initStatus, setStatus } from './ui/status.js';
import { initMealLibrary, destroyMealLibrary } from './ui/mealLibrary.js';
import {
  initWeekPlanner,
  destroyWeekPlanner,
  refreshLibraryPicker,
} from './ui/weekPlanner.js';

const app = document.getElementById('app');
const statusHost = document.getElementById('status-host');

async function boot() {
  initStickers();
  initStatus(statusHost);

  const config = await loadConfig();
  if (!config.ok || !isConfigured()) {
    setStatus('offline', 'setup needed');
    renderSetupScreen(app);
    return;
  }

  setStatus('syncing', 'connecting');
  app.innerHTML = `
    <div class="app-tabs" role="tablist">
      <button type="button" class="tab active" role="tab" aria-selected="true" data-tab="week">Week planner</button>
      <button type="button" class="tab" role="tab" aria-selected="false" data-tab="library">Recipe book</button>
    </div>
    <div class="tab-panels">
      <div class="tab-panel" data-panel="week"></div>
      <div class="tab-panel hidden" data-panel="library"></div>
    </div>
  `;

  const weekPanel = app.querySelector('[data-panel="week"]');
  const libPanel = app.querySelector('[data-panel="library"]');

  await initWeekPlanner(weekPanel);
  await initMealLibrary(libPanel, {
    onChange: () => refreshLibraryPicker(),
  });

  app.querySelector('.app-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (!tab) return;
    const name = tab.getAttribute('data-tab');
    app.querySelectorAll('.tab').forEach((t) => {
      const on = t.getAttribute('data-tab') === name;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    app.querySelectorAll('.tab-panel').forEach((p) => {
      p.classList.toggle('hidden', p.getAttribute('data-panel') !== name);
    });
  });

  window.addEventListener('online', () => setStatus('synced'));
  window.addEventListener('offline', () => setStatus('offline'));

  window.addEventListener('beforeunload', () => {
    destroyMealLibrary();
    destroyWeekPlanner();
  });
}

boot().catch((err) => {
  console.error(err);
  setStatus('error');
  app.innerHTML = `<section class="setup-card"><h2>Uh-oh</h2><p>Something went sideways. Check the console and your Supabase config.</p></section>`;
});
