export type Food = 'meat' | 'fish';
export const MENU = {
  meat: { name: '炭烤肉串', emoji: '🍖', time: 4, price: 25 },
  fish: { name: '香烤鮮魚', emoji: '🐟', time: 5, price: 35 },
};
export type Guest = { id: number; food: Food; patience: number; max: number };
export type Slot = { food: Food; age: number } | null;
export type State = {
  phase: 'idle' | 'playing' | 'paused' | 'over'; time: number; coins: number;
  served: number; missed: number; burnt: number; selected: Food;
  slots: Slot[]; guests: (Guest | null)[]; inventory: Record<Food, number>;
  nextId: number; spawn: number; message: string;
};
export function guest(id: number): Guest {
  return { id, food: id % 3 === 1 ? 'fish' : 'meat', patience: 24, max: 24 };
}
export function initial(): State {
  return { phase: 'idle', time: 90, coins: 0, served: 0, missed: 0, burnt: 0,
    selected: 'meat', slots: [null, null, null], guests: [guest(0), guest(1), guest(2)],
    inventory: { meat: 0, fish: 0 }, nextId: 3, spawn: 0,
    message: '今天的目標：90 秒內，賺到 200 金幣！' };
}
export type Action =
  | { type: 'start' | 'pause' | 'resume' }
  | { type: 'select'; food: Food }
  | { type: 'slot'; index: number }
  | { type: 'serve'; index: number }
  | { type: 'tick'; dt: number };
export function reduce(s: State, a: Action): State {
  if (a.type === 'start') return { ...initial(), phase: 'playing', message: '開店囉！選好食材，再點空烤位。' };
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
      return { ...s, slots, message: MENU[s.selected].name + '上烤爐了，等指示變綠再起鍋！' };
    }
    if (slot.age < MENU[slot.food].time) return { ...s, message: '還沒熟喔！再烤一下下。' };
    slots[a.index] = null;
    if (slot.age >= MENU[slot.food].time + 4)
      return { ...s, slots, burnt: s.burnt + 1, message: '烤焦了，清理乾淨再來一份！' };
    return { ...s, slots, inventory: { ...s.inventory, [slot.food]: s.inventory[slot.food] + 1 },
      message: '香噴噴的' + MENU[slot.food].name + '！點客人的「送餐」。' };
  }
  if (a.type === 'serve') {
    const g = s.guests[a.index];
    if (!g) return s;
    if (s.inventory[g.food] <= 0) return { ...s, message: '這位客人想吃' + MENU[g.food].name + '，要先烤好並起鍋喔。' };
    const guests = [...s.guests]; guests[a.index] = null;
    const tip = g.patience > 12 ? 5 : 0;
    return { ...s, guests, served: s.served + 1, coins: s.coins + MENU[g.food].price + tip,
      inventory: { ...s.inventory, [g.food]: s.inventory[g.food] - 1 },
      message: '客人吃得很開心！+' + (MENU[g.food].price + tip) + ' 金幣' + (tip ? '（含小費 5）' : '') };
  }
  if (a.type === 'tick') {
    const dt = Number.isFinite(a.dt) ? Math.max(0, Math.min(a.dt, 1)) : 0;
    const time = Math.max(0, s.time - dt);
    if (time <= 0) return { ...s, time: 0, phase: 'over', message: '今天辛苦了！' };
    let missed = s.missed;
    const guests = s.guests.map(g => {
      if (!g) return null;
      if (g.patience <= dt) { missed++; return null; }
      return { ...g, patience: g.patience - dt };
    });
    let spawn = s.spawn + dt; let nextId = s.nextId;
    if (spawn >= 2) {
      const empty = guests.indexOf(null);
      if (empty !== -1) { guests[empty] = guest(nextId++); }
      spawn = 0;
    }
    return { ...s, time, missed, guests, spawn, nextId,
      slots: s.slots.map(slot => slot ? { ...slot, age: slot.age + dt } : null) };
  }
  return s;
}
