/** Built-in library + default week plan from the original static site. */

export const HOUSEHOLD_ID = 'c0ffee00-5a1a-4000-8000-00000000cafe';

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const SLOTS = [
  { key: 'breakfast', label: 'Breakfast', icon: '🌅', mealType: 'breakfast' },
  { key: 'snack1', label: 'Snack 1', icon: '🫐', mealType: 'snack' },
  { key: 'lunch', label: 'Lunch', icon: '☀️', mealType: 'lunch' },
  { key: 'snack2', label: 'Snack 2', icon: '🧀', mealType: 'snack' },
  { key: 'dinner', label: 'Dinner', icon: '🌙', mealType: 'dinner' },
];

export const DAY_EMOJIS = ['🍓', '🐕', '🍓', '🐕', '🍓', '🐕', '🍓'];

/** Unique meal ideas for the library (name + meal_type). */
export const LIBRARY_SEED = [
  { name: 'Soft scrambled egg, avocado strips, banana toast fingers', mealType: 'breakfast' },
  { name: 'Full-fat yogurt + blueberries (halved)', mealType: 'snack' },
  { name: 'Shredded chicken, steamed carrot coins, soft pear pieces', mealType: 'lunch' },
  { name: 'Cheese cubes + soft steamed apple', mealType: 'snack' },
  { name: 'Flaky salmon, mashed sweet potato, soft broccoli florets', mealType: 'dinner' },
  { name: 'Oatmeal (plain or with mashed banana), soft peach slices', mealType: 'breakfast' },
  { name: 'Cottage cheese + soft melon', mealType: 'snack' },
  { name: 'Soft lentils, roasted zucchini coins, ripe mango strips', mealType: 'lunch' },
  { name: 'Hummus + cucumber sticks', mealType: 'snack' },
  { name: 'Ground turkey, mashed potato, soft green beans', mealType: 'dinner' },
  { name: 'French toast fingers (egg + milk), smashed raspberries', mealType: 'breakfast' },
  { name: 'Full-fat yogurt + soft pear', mealType: 'snack' },
  { name: 'Soft scrambled tofu or egg, steamed cauliflower, banana', mealType: 'lunch' },
  { name: 'Soft cheese + steamed carrot sticks', mealType: 'snack' },
  { name: 'Mild fish cakes (no breadcrumb nut mix), mashed peas, soft squash', mealType: 'dinner', notes: 'Skip any nutty binder mixes' },
  { name: 'Plain yogurt parfait: yogurt, soft strawberries, oat circles', mealType: 'breakfast' },
  { name: 'Soft pear + a few plain crackers (check label)', mealType: 'snack', notes: 'Check cracker labels for tree nuts' },
  { name: 'Shredded beef or soft black beans, soft sweet potato cubes, cucumber', mealType: 'lunch' },
  { name: 'Avocado + cheese', mealType: 'snack' },
  { name: 'Chicken meatballs (plain), pasta tubes (soft), steamed broccoli', mealType: 'dinner' },
  { name: 'Soft pancake fingers, mashed banana, side of yogurt', mealType: 'breakfast' },
  { name: 'Blueberries + cottage cheese', mealType: 'snack' },
  { name: 'Soft white fish, mashed carrot, ripe kiwi (peeled, soft)', mealType: 'lunch' },
  { name: 'Hummus + soft pepper strips', mealType: 'snack' },
  { name: 'Mild chili (beans + ground turkey, low spice), rice, avocado', mealType: 'dinner', notes: 'Keep spice gentle' },
  { name: 'Egg muffins (egg + spinach + cheese, soft), orange segments', mealType: 'breakfast' },
  { name: 'Yogurt + soft peach', mealType: 'snack' },
  { name: 'Leftover meatballs or chicken, soft pasta, steamed zucchini', mealType: 'lunch' },
  { name: 'Cheese + soft apple', mealType: 'snack' },
  { name: 'Baked chicken thigh (shredded), mashed cauliflower, soft peas', mealType: 'dinner' },
  { name: 'Overnight oats (milk + banana), soft berries', mealType: 'breakfast' },
  { name: 'Cottage cheese + melon', mealType: 'snack' },
  { name: 'Soft chickpeas (mashed a bit), roasted carrot, pear', mealType: 'lunch' },
  { name: 'Yogurt + banana', mealType: 'snack' },
  { name: 'Mild salmon or turkey, mashed sweet potato, soft broccoli', mealType: 'dinner' },
];

/**
 * Default week plan: array of 7 days, each with slot key → title.
 * Used to seed the current week client-side when empty.
 */
export const DEFAULT_WEEK_PLAN = [
  // Monday
  {
    breakfast: 'Soft scrambled egg, avocado strips, banana toast fingers',
    snack1: 'Full-fat yogurt + blueberries (halved)',
    lunch: 'Shredded chicken, steamed carrot coins, soft pear pieces',
    snack2: 'Cheese cubes + soft steamed apple',
    dinner: 'Flaky salmon, mashed sweet potato, soft broccoli florets',
  },
  // Tuesday
  {
    breakfast: 'Oatmeal (plain or with mashed banana), soft peach slices',
    snack1: 'Cottage cheese + soft melon',
    lunch: 'Soft lentils, roasted zucchini coins, ripe mango strips',
    snack2: 'Hummus + cucumber sticks',
    dinner: 'Ground turkey, mashed potato, soft green beans',
  },
  // Wednesday
  {
    breakfast: 'French toast fingers (egg + milk), smashed raspberries',
    snack1: 'Full-fat yogurt + soft pear',
    lunch: 'Soft scrambled tofu or egg, steamed cauliflower, banana',
    snack2: 'Soft cheese + steamed carrot sticks',
    dinner: 'Mild fish cakes (no breadcrumb nut mix), mashed peas, soft squash',
  },
  // Thursday
  {
    breakfast: 'Plain yogurt parfait: yogurt, soft strawberries, oat circles',
    snack1: 'Soft pear + a few plain crackers (check label)',
    lunch: 'Shredded beef or soft black beans, soft sweet potato cubes, cucumber',
    snack2: 'Avocado + cheese',
    dinner: 'Chicken meatballs (plain), pasta tubes (soft), steamed broccoli',
  },
  // Friday
  {
    breakfast: 'Soft pancake fingers, mashed banana, side of yogurt',
    snack1: 'Blueberries + cottage cheese',
    lunch: 'Soft white fish, mashed carrot, ripe kiwi (peeled, soft)',
    snack2: 'Hummus + soft pepper strips',
    dinner: 'Mild chili (beans + ground turkey, low spice), rice, avocado',
  },
  // Saturday
  {
    breakfast: 'Egg muffins (egg + spinach + cheese, soft), orange segments',
    snack1: 'Yogurt + soft peach',
    lunch: 'Leftover meatballs or chicken, soft pasta, steamed zucchini',
    snack2: 'Cheese + soft apple',
    dinner: 'Baked chicken thigh (shredded), mashed cauliflower, soft peas',
  },
  // Sunday
  {
    breakfast: 'Overnight oats (milk + banana), soft berries',
    snack1: 'Cottage cheese + melon',
    lunch: 'Soft chickpeas (mashed a bit), roasted carrot, pear',
    snack2: 'Yogurt + banana',
    dinner: 'Mild salmon or turkey, mashed sweet potato, soft broccoli',
  },
];

/** Monday ISO date (YYYY-MM-DD) for a given Date. */
export function mondayOf(date = new Date()) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0); // noon avoids DST edge cases
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}

export function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDaysISO(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  dt.setDate(dt.getDate() + days);
  return toISODate(dt);
}

export function formatWeekLabel(weekStartISO) {
  const start = new Date(weekStartISO + 'T12:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts = { month: 'short', day: 'numeric' };
  const y = start.getFullYear() !== end.getFullYear()
    ? `, ${start.getFullYear()} – ${end.toLocaleDateString(undefined, { ...opts, year: 'numeric' })}`
    : ` – ${end.toLocaleDateString(undefined, opts)}, ${end.getFullYear()}`;
  return `${start.toLocaleDateString(undefined, opts)}${y}`;
}

export function dateForDay(weekStartISO, dayIndex) {
  return addDaysISO(weekStartISO, dayIndex);
}
