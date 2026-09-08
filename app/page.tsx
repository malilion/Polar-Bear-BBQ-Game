'use client';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Snowflake, Coins, Clock3, Pause, Play, HelpCircle, Flame, ChefHat, Check, RotateCcw, Star, X, Utensils, Fish, Beef, Volume2, VolumeX, Zap, Trophy } from 'lucide-react';
import PolarScene from '../components/polar-scene';
import { Dialog } from '@base-ui/react/dialog';
import { initial, reduce, stars, MENU, GOAL, STARS, BURN_WINDOW, EVENT_TTL, type Food } from '../lib/game';
import { play, unlock, isMuted, setMuted } from '../lib/sound';

const names = ['小白', '阿企', '棕棕', '雪球', '松松', '小鹿'];
const faces = ['🐻‍❄️', '🐧', '🐻', '🐰', '🐿️', '🦊'];
const SLOT_KEYS = ['Q', 'W', 'E'];
const SERVE_KEYS = ['A', 'S', 'D'];
const BEST_KEY = 'polar-bbq-best';
const FLASH_TTL = .45;

function readBest(): number {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}

export default function Home() {
  const [s, dispatch] = useReducer(reduce, undefined, initial);
  const [help, setHelp] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [muted, setMutedState] = useState(isMuted);
  const [storedBest, setStoredBest] = useState(readBest);
  const seen = useRef(0);

  useEffect(() => {
    if (s.phase !== 'playing') return;
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      dispatch({ type: 'tick', dt: (now - last) / 1000 }); last = now;
    }, 100);
    const hidden = () => { if (document.hidden) dispatch({ type: 'pause' }); };
    document.addEventListener('visibilitychange', hidden);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', hidden); };
  }, [s.phase]);

  // Side effects only (sound, storage). Popups and flashes are derived from
  // `s.events` below, so nothing here needs to set React state.
  useEffect(() => {
    const e = s.event;
    if (!e || e.id === seen.current) return;
    seen.current = e.id;
    play(e.kind === 'serve' && s.combo >= 3 ? 'combo' : e.kind);
    if (e.kind === 'over' && s.coins > storedBest) {
      try { localStorage.setItem(BEST_KEY, String(s.coins)); } catch { /* storage blocked */ }
    }
  }, [s.event, s.combo, s.coins, storedBest]);

  const start = useCallback(() => {
    unlock();
    setStoredBest(readBest());
    dispatch({ type: s.phase === 'paused' ? 'resume' : 'start' });
  }, [s.phase]);
  const toggleMute = () => { unlock(); const next = !muted; setMuted(next); setMutedState(next); };

  // Keyboard: 1/2 pick food, Q/W/E grill slots, A/S/D serve guests, Space pauses.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (help || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const target = ev.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const key = ev.key.toUpperCase();
      if (key === ' ' || key === 'P') {
        if (s.phase === 'idle' || s.phase === 'over') { if (sceneReady) start(); }
        else dispatch({ type: s.phase === 'paused' ? 'resume' : 'pause' });
        ev.preventDefault(); return;
      }
      if (s.phase !== 'playing') return;
      if (key === '1') dispatch({ type: 'select', food: 'meat' });
      else if (key === '2') dispatch({ type: 'select', food: 'fish' });
      else if (SLOT_KEYS.includes(key)) dispatch({ type: 'slot', index: SLOT_KEYS.indexOf(key) });
      else if (SERVE_KEYS.includes(key)) dispatch({ type: 'serve', index: SERVE_KEYS.indexOf(key) });
      else return;
      ev.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s.phase, help, sceneReady, start]);

  const live = s.phase === 'playing';
  const time = Math.ceil(s.time);
  const rating = stars(s.coins);
  const nextStar = STARS.find(goal => s.coins < goal);
  const best = Math.max(storedBest, s.phase === 'over' ? s.coins : 0);
  const isRecord = s.phase === 'over' && s.coins > 0 && s.coins >= storedBest;
  // Recent events, aged by the game clock: they freeze on pause and vanish on their own.
  const recent = s.events.filter(e => e.at - s.time <= EVENT_TTL && e.at - s.time >= 0);
  const popups = recent.filter(e => e.kind === 'serve' || e.kind === 'burn' || e.kind === 'miss').map(e => ({
    id: e.id,
    text: e.kind === 'serve' ? '+' + e.value : e.kind === 'burn' ? '烤焦了' : '客人走了',
    tone: e.kind !== 'serve' ? 'bad' : (e.value ?? 0) >= 45 ? 'combo' : 'coin',
  }));
  const flash = recent.find(e => e.at - s.time <= FLASH_TTL && ['serve', 'burn', 'miss', 'ready'].includes(e.kind))?.kind ?? null;

  return (
    <main className={'app' + (flash ? ' flash-' + flash : '') + (live ? ' live' : '')}>
      <header className="hud">
        <span className="brand"><span className="brand-icon"><ChefHat size={22}/></span><span>北極熊烤肉店<small>POLAR BEAR BBQ</small></span></span>
        <div className="hud-center">
          <span className="chip weather"><Snowflake size={14}/> −28°C</span>
          <span className="chip goal" title="營業目標">
            <span className="star-row" aria-label={rating + ' 顆星'}>{[0,1,2].map(i => <Star key={i} size={14} className={i < rating ? 'lit' : ''}/>)}</span>
            <span className="goal-track"><i style={{width:Math.min(s.coins/(nextStar ?? STARS[2])*100,100)+'%'}}/></span>
            <small>{nextStar ? nextStar : '滿星'}</small>
          </span>
          {s.combo >= 2 && <span className={'combo ' + (s.combo >= 5 ? 'hot' : '')} aria-live="polite"><Zap size={13}/> 連擊 ×{s.combo}</span>}
        </div>
        <div className="stats">
          <span className="money"><Coins size={18}/><b>{s.coins}</b>
            <span className="popups" aria-hidden="true">{popups.map(p => <i key={p.id} className={'popup ' + p.tone}>{p.text}</i>)}</span>
          </span>
          <span className={'time ' + (time < 20 && live ? 'urgent' : '')}><Clock3 size={16}/><b>{Math.floor(time/60)}:{String(time%60).padStart(2,'0')}</b></span>
        </div>
        <div className="actions">
          {best > 0 && <span className="chip best" title="本機最佳成績"><Trophy size={14}/> {best}</span>}
          <button className="icon-btn" title={muted ? '開啟音效' : '關閉音效'} aria-label={muted ? '開啟音效' : '關閉音效'} aria-pressed={muted} onClick={toggleMute}>{muted ? <VolumeX size={18}/> : <Volume2 size={18}/>}</button>
          <button className="icon-btn" title="遊戲玩法" aria-label="遊戲玩法" onClick={() => { dispatch({type:'pause'}); setHelp(true); }}><HelpCircle size={19}/></button>
          <button className="icon-btn" title={s.phase === 'paused' ? '繼續營業' : '暫停營業'} aria-label={s.phase === 'paused' ? '繼續營業' : '暫停營業'} disabled={s.phase === 'idle' || s.phase === 'over'} onClick={() => dispatch({type:s.phase === 'paused' ? 'resume' : 'pause'})}>{s.phase === 'paused' ? <Play size={18}/> : <Pause size={18}/>}</button>
        </div>
      </header>

      <section className="stage" aria-label="北極熊的雪地餐廳">
        <PolarScene state={s} onSlot={index => dispatch({type: 'slot', index})} onReady={ready => { setSceneReady(ready); if (!ready) dispatch({type: 'pause'}); }}/>

        {s.phase !== 'playing' && !help && <div className="scene-overlay">
          <div className={'start-card ' + (s.phase === 'over' ? 'result-card' : '')}>
            {s.phase === 'over'
              ? <span className="star-row big" aria-label={rating + ' 顆星'}>{[0,1,2].map(i => <Star key={i} size={30} className={i < rating ? 'lit' : ''} style={{animationDelay: i * .15 + 's'}}/>)}</span>
              : <span className="round-icon">{s.phase === 'paused' ? <Pause size={28}/> : <Flame size={28}/>}</span>}
            <p className="eyebrow">{s.phase === 'over' ? (isRecord ? '本機新紀錄！' : '今日營業結束') : s.phase === 'paused' ? '讓炭火休息一下' : '雪地裡，開飯囉！'}</p>
            <h1>{s.phase === 'over' ? (rating === 3 ? '雪地傳說級店長！' : rating === 2 ? '暖心小店，生意興隆！' : rating === 1 ? '暖心小店，達標！' : '今天也辛苦了！') : s.phase === 'paused' ? '小店暫停營業' : '準備好當烤肉店長了嗎？'}</h1>
            <p>{s.phase === 'over' ? (nextStar ? '再賺 ' + (nextStar - s.coins) + ' 金幣就能拿下一顆星。' : '每一份熱食，都讓雪地暖了一點。') : s.phase === 'paused' ? '時間和火候都會等你回來。' : '拖曳看看小店，再來烤一份暖心料理。'}</p>
            {s.phase === 'over' && <div className="results"><span><b>{s.coins}</b>金幣</span><span><b>{s.served}</b>位飽足客人</span><span><b>{s.tips}</b>小費</span><span><b>×{s.bestCombo}</b>最高連擊</span></div>}
            <button className="primary" disabled={!sceneReady} onClick={start}>{s.phase === 'over' ? <RotateCcw size={18}/> : <Play size={18}/>} {s.phase === 'over' ? '再開店一次' : s.phase === 'paused' ? '繼續營業' : (sceneReady ? '開始營業' : '場景載入中…')}<span>→</span></button>
            {s.phase === 'idle' && <small>90 秒挑戰 · {GOAL} 金幣達標 · 按 <kbd>空白鍵</kbd> 開始</small>}
          </div>
        </div>}

        <aside className="orders" aria-label="客人的點單">
          <div className="panel-head"><Utensils size={16}/><h2>客人的點單</h2><span>{s.guests.filter(Boolean).length}</span></div>
          <div className="guest-list">{s.guests.map((g,index) => g ? <article className={'guest ' + (g.patience < 8 ? 'anxious' : '') + (s.inventory[g.food] ? ' can-serve' : '')} key={g.id}>
            <span className={'avatar avatar-'+g.id%3}>{faces[g.id%faces.length]}</span>
            <div className="guest-body">
              <h3><span className="guest-name">{names[g.id%names.length]}</span><span className="guest-order"><em aria-hidden="true">{MENU[g.food].emoji}</em>{MENU[g.food].name}</span></h3>
              <div className={'patience '+(g.patience < 8 ? 'low' : g.patience > g.max / 2 ? 'tip' : '')}><i style={{width:g.patience/g.max*100+'%'}}/></div>
              <small>{g.patience < 8 ? '肚子咕嚕咕嚕…' : g.patience > g.max / 2 ? '快速上菜有小費！' : '期待熱呼呼的美味'} · {Math.ceil(g.patience)}s</small>
            </div>
            <button className={'serve '+(s.inventory[g.food] ? 'ready' : '')} disabled={!live || !s.inventory[g.food]} onClick={() => dispatch({type:'serve',index})} aria-label={'送餐給' + names[g.id%names.length]}><kbd>{SERVE_KEYS[index]}</kbd>{s.inventory[g.food] ? <Check size={15}/> : <Coins size={13}/>}<span>{s.inventory[g.food] ? '送餐' : MENU[g.food].price}</span></button>
          </article> : <div className="guest empty-guest" key={'empty'+index}><span>☃️</span><p>下一位客人正在路上…</p></div>)}</div>
          <p className="order-tip"><Star size={13}/> 耐心過半前上菜 +5 小費；連續快送 3 次、5 次有連擊獎金</p>
        </aside>

        <output className={'message ' + (s.message ? 'show' : '')} aria-live="polite"><ChefHat size={16}/><span key={s.message}>{s.message}</span></output>

        <section className="kitchen" aria-label="小白的烤爐">
          <div className="ingredients">
            <span className="eyebrow">① 食材</span>
            {(['meat','fish'] as Food[]).map((food, i) => <button aria-pressed={s.selected===food} className={'ingredient '+(s.selected===food ? 'selected' : '')} key={food} onClick={() => dispatch({type:'select',food})}><kbd>{i + 1}</kbd><span className="food-emoji">{MENU[food].emoji}</span><span><b>{MENU[food].name}</b><small>{MENU[food].time} 秒 · {MENU[food].price} 金幣</small></span></button>)}
          </div>
          <div className="grill-section">
            <span className="eyebrow"><Flame size={13}/> ② 烤位 · 變綠起鍋</span>
            <div className="grill">{s.slots.map((slot,index) => {
              const ready = !!slot && slot.age >= MENU[slot.food].time;
              const burned = !!slot && slot.age >= MENU[slot.food].time+BURN_WINDOW;
              const left = slot ? MENU[slot.food].time + BURN_WINDOW - slot.age : 0;
              return <button key={index} disabled={!live} className={'grill-slot '+(burned ? 'burned' : ready ? (left < 1.5 ? 'cooked hurry' : 'cooked') : slot ? 'cooking' : '')} onClick={() => dispatch({type:'slot',index})} aria-label={'烤位 '+(index+1)+'：'+(!slot ? '放入'+MENU[s.selected].name : burned ? '清理烤焦食物' : ready ? '起鍋'+MENU[slot.food].name : '烘烤中')}>
                <kbd className="slot-key">{SLOT_KEYS[index]}</kbd>
                <span className="grill-food">{slot ? burned ? '💨' : MENU[slot.food].emoji : '+'}</span>
                <b>{!slot ? '放入' + MENU[s.selected].name : burned ? '烤焦 · 清理' : ready ? '起鍋！' : '烘烤中'}</b>
                {slot ? <><div className="cook-progress"><i style={{width:Math.min(slot.age/(MENU[slot.food].time+BURN_WINDOW)*100,100)+'%'}}/><em style={{left:MENU[slot.food].time/(MENU[slot.food].time+BURN_WINDOW)*100+'%'}}/></div><small>{burned ? '點一下清理' : ready ? Math.max(0,Math.ceil(left))+' 秒後烤焦' : Math.max(0,Math.ceil(MENU[slot.food].time-slot.age))+' 秒後熟透'}</small></> : <small>空烤位</small>}
              </button>;
            })}</div>
          </div>
          <div className="tray">
            <span className="eyebrow">③ 待送</span>
            <div className={'tray-item ' + (s.inventory.meat ? 'has' : '')}><Beef size={20}/><b>× {s.inventory.meat}</b></div>
            <div className={'tray-item ' + (s.inventory.fish ? 'has' : '')}><Fish size={20}/><b>× {s.inventory.fish}</b></div>
          </div>
        </section>
      </section>

      <Dialog.Root open={help} onOpenChange={setHelp}><Dialog.Portal><Dialog.Backdrop className="modal-backdrop"/><Dialog.Popup className="help-modal"><Dialog.Title>小店長營業指南</Dialog.Title><Dialog.Close className="close" aria-label="關閉玩法"><X size={20}/></Dialog.Close><Dialog.Description>90 秒內賺到 {GOAL} 金幣就達標；{STARS[1]} 金幣兩顆星、{STARS[2]} 金幣三顆星！</Dialog.Description>
        <ol><li><b>選食材、放上烤爐</b><p>肉串烤 4 秒，鮮魚烤 5 秒，可以同時使用三個烤位，也能直接點 3D 場景的烤爐。</p></li><li><b>烤位變綠，馬上起鍋</b><p>熟透後有 4 秒可以起鍋，太久會烤焦。烤焦的食物點一下就能清理，而且會中斷連擊。</p></li><li><b>依照點單，送上餐點</b><p>起鍋後點客人的「送餐」。客人越晚越沒耐心；耐心還剩一半以上就上菜可多拿 5 金幣。</p></li><li><b>連擊獎金</b><p>連續快速上菜 3 次每份再加 5 金幣、5 次加 10 金幣。客人走掉或食物烤焦都會歸零。</p></li></ol>
        <div className="keys"><span className="eyebrow">鍵盤快捷鍵</span><div><kbd>1</kbd><kbd>2</kbd> 選食材</div><div><kbd>Q</kbd><kbd>W</kbd><kbd>E</kbd> 烤位</div><div><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 送餐</div><div><kbd>空白鍵</kbd> 開始 / 暫停</div></div>
        <Dialog.Close className="primary">我知道了<Check size={18}/></Dialog.Close>
        <p className="credit">一爐炭火，一點幸福。3D 極地烤肉小遊戲 · 非官方作品</p></Dialog.Popup></Dialog.Portal></Dialog.Root>
    </main>
  );
}
