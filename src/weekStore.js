/** Tiny shared week-start store so Week planner + Grocery stay in sync. */

import { mondayOf } from './data/seedMeals.js';

let weekStart = mondayOf();
const listeners = new Set();

export function getWeekStart() {
  return weekStart;
}

export function setWeekStart(iso) {
  if (!iso || iso === weekStart) return;
  weekStart = iso;
  for (const fn of listeners) {
    try {
      fn(weekStart);
    } catch (err) {
      console.error(err);
    }
  }
}

/** Subscribe to week changes. Returns unsubscribe. */
export function subscribeWeekStart(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
