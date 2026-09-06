/** Sync status pill in the header. */

let el = null;

export function initStatus(container) {
  el = document.createElement('div');
  el.className = 'sync-status sync-status--offline';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="sync-dot"></span><span class="sync-label">Offline</span>`;
  container.appendChild(el);
  return el;
}

export function setStatus(state, detail = '') {
  if (!el) return;
  el.className = `sync-status sync-status--${state}`;
  const label = el.querySelector('.sync-label');
  const text =
    state === 'synced'
      ? 'Synced'
      : state === 'syncing'
        ? 'Syncing…'
        : state === 'error'
          ? 'Sync error'
          : 'Offline';
  label.textContent = detail ? `${text} · ${detail}` : text;
}
