export type Food = 'meat' | 'fish';
export const MENU = {
  meat: { name: '炭烤肉串', emoji: '🍖', time: 4, price: 25 },
  fish: { name: '香烤鮮魚', emoji: '🐟', time: 5, price: 35 },
};
export const ROUND = 90;
export const GOAL = 200;
/** Coins needed for 1, 2 and 3 stars. */
export const STARS = [GOAL, 350, 500];
export const BURN_WINDOW = 4;
export const FAST_TIP = 5;
/** Extra coins per serve once the streak reaches each threshold. */
export const COMBO_BONUS: [number, number][] = [[3, 5], [5, 10]];

export type Guest = { id: number; food: Food; patience: number; max: number };
export type Slot = { food: Food; age: number } | null;
/** One-shot signal for the UI (sound, popups). `id` increments so effects can dedupe. */
export type Event = {
  id: number;
  kind: 'start' | 'place' | 'ready' | 'collect' | 'burn' | 'serve' | 'miss' | 'over' | 'combo';
  /** Clock reading (seconds left) when it happened, so the UI can age it without timers. */
  at: number;
  value?: number;
  index?: number;
};
/** How long a popup/flash stays derived from `events`, in game seconds. */
export const EVENT_TTL = 1.2;
export type State = {
  phase: 'idle' | 'playing' | 'paused' | 'over'; time: number; coins: number;
  served: number; missed: number; burnt: number; selected: Food;
  slots: Slot[]; guests: (Guest | null)[]; inventory: Record<Food, number>;
  nextId: number; spawn: number; message: string;
  combo: number; bestCombo: number; tips: number;
  /** Latest signal plus a short trailing window of recent ones (for popups). */
  event: Event | null; events: Event[];
};

/** Later guests are hungrier: patience shrinks from 24 s to 16 s over the round. */
export function patienceFor(elapsed: number): number {
  const t = Math.max(0, Math.min(elapsed / ROUND, 1));
  return Math.round(24 - 8 * t);
}
export function guest(id: number, elapsed = 0): Guest {
  const patience = patienceFor(elapsed);
  // Fish is pricier and slower; it shows up more often as the day goes on.
  const fish = elapsed < 30 ? id % 3 === 1 : id % 2 === 1;
  return { id, food: fish ? 'fish' : 'meat', patience, max: patience };
}
export function stars(coins: number): number {
  return STARS.filter(goal => coins >= goal).length;
}
export function comboBonus(combo: number): number {
  let bonus = 0;
  for (const [at, value] of COMBO_BONUS) if (combo >= at) bonus = value;
  return bonus;
}
export function initial(): State {
  return { phase: 'idle', time: ROUND, coins: 0, served: 0, missed: 0, burnt: 0,
    selected: 'meat', slots: [null, null, null], guests: [guest(0), guest(1), guest(2)],
    inventory: { meat: 0, fish: 0 }, nextId: 3, spawn: 0,
    message: '今天的目標：90 秒內，賺到 200 金幣！',
    combo: 0, bestCombo: 0, tips: 0, event: null, events: [] };
}
export type Action =
  | { type: 'start' | 'pause' | 'resume' }
  | { type: 'select'; food: Food }
  | { type: 'slot'; index: number }
  | { type: 'serve'; index: number }
  | { type: 'tick'; dt: number };

function emit(s: State, kind: Event['kind'], extra: Partial<Event> = {}): Event {
  return { id: (s.event?.id ?? 0) + 1, kind, at: s.time, ...extra };
}
/** Attach a new event and drop stale ones from the trailing window. */
function withEvent(s: State, event: Event, time = s.time): State {
  const events = [...s.events, event].filter(e => e.at - time <= EVENT_TTL).slice(-6);
  return { ...s, event, events };
}
export function reduce(s: State, a: Action): State {
  if (a.type === 'start') {
    const fresh = initial();
    return withEvent({ ...fresh, phase: 'playing', message: '開店囉！選好食材，再點空烤位。' }, emit(fresh, 'start'));
  }
  if (a.type === 'pause') return s.phase === 'playing' ? { ...s, phase: 'paused' } : s;
  if (a.type === 'resume') return s.phase === 'paused' ? { ...s, phase: 'playing' } : s;
  if (a.type === 'select') return { ...s, selected: a.food };
  if (s.phase !== 'playing') return s;
  if (a.type === 'slot') {
    if (!Number.isInteger(a.index) || a.index < 0 || a.index >= s.slots.length) return s;
    const slot = s.slots[a.index];
    const slots = [...s.slots];
    if (!slot) {
      slots[a.index] = { food: s.selected, age: 0 };
      return withEvent({ ...s, slots, message: MENU[s.selected].name + '上烤爐了，等指示變綠再起鍋！' }, emit(s, 'place', { index: a.index }));
    }
    if (slot.age < MENU[slot.food].time) return { ...s, message: '還沒熟喔！再烤一下下。' };
    slots[a.index] = null;
    if (slot.age >= MENU[slot.food].time + BURN_WINDOW)
      return withEvent({ ...s, slots, burnt: s.burnt + 1, combo: 0, message: '烤焦了，清理乾淨再來一份！' }, emit(s, 'burn', { index: a.index }));
    return withEvent({ ...s, slots, inventory: { ...s.inventory, [slot.food]: s.inventory[slot.food] + 1 },
      message: '香噴噴的' + MENU[slot.food].name + '！點客人的「送餐」。' }, emit(s, 'collect', { index: a.index }));
  }
  if (a.type === 'serve') {
    const g = s.guests[a.index];
    if (!g) return s;
    if (s.inventory[g.food] <= 0) return { ...s, message: '這位客人想吃' + MENU[g.food].name + '，要先烤好並起鍋喔。' };
    const guests = [...s.guests]; guests[a.index] = null;
    const fast = g.patience > g.max / 2;
    const combo = fast ? s.combo + 1 : 0;
    const tip = (fast ? FAST_TIP : 0) + comboBonus(combo);
    const earned = MENU[g.food].price + tip;
    const note = combo >= 3 ? `（連擊 ×${combo}，小費 ${tip}）` : tip ? '（含小費 5）' : fast ? '' : '（客人等太久，沒有小費）';
    return withEvent({ ...s, guests, served: s.served + 1, coins: s.coins + earned, tips: s.tips + tip,
      combo, bestCombo: Math.max(s.bestCombo, combo),
      inventory: { ...s.inventory, [g.food]: s.inventory[g.food] - 1 },
      message: '客人吃得很開心！+' + earned + ' 金幣' + note },
      emit(s, 'serve', { value: earned, index: a.index }));
  }
  if (a.type === 'tick') {
    const dt = Number.isFinite(a.dt) ? Math.max(0, Math.min(a.dt, 1)) : 0;
    const time = Math.max(0, s.time - dt);
    if (time <= 0) return withEvent({ ...s, time: 0, phase: 'over', message: '今天辛苦了！' }, emit(s, 'over'), 0);
    let missed = s.missed;
    let event: Event | null = null;
    const guests = s.guests.map(g => {
      if (!g) return null;
      if (g.patience <= dt) { missed++; event = emit(s, 'miss'); return null; }
      return { ...g, patience: g.patience - dt };
    });
    const elapsed = ROUND - time;
    let spawn = s.spawn + dt; let nextId = s.nextId;
    if (spawn >= 2) {
      const empty = guests.indexOf(null);
      if (empty !== -1) { guests[empty] = guest(nextId++, elapsed); }
      spawn = 0;
    }
    const slots = s.slots.map(slot => slot ? { ...slot, age: slot.age + dt } : null);
    // Announce the moment a slot crosses "cooked" so the UI can chime once.
    slots.forEach((slot, index) => {
      const before = s.slots[index];
      if (slot && before && before.age < MENU[slot.food].time && slot.age >= MENU[slot.food].time)
        event = emit(s, 'ready', { index });
    });
    const next = { ...s, time, missed, guests, spawn, nextId, slots, combo: missed > s.missed ? 0 : s.combo,
      events: s.events.filter(e => e.at - time <= EVENT_TTL) };
    return event ? withEvent(next, event, time) : next;
  }
  return s;
}
