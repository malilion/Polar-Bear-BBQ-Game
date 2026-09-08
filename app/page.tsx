'use client';
import { useEffect, useReducer, useState } from 'react';
import { Snowflake, Coins, Clock3, Pause, Play, HelpCircle, Flame, ChefHat, Check, RotateCcw, Star, X, Utensils, Fish, Beef } from 'lucide-react';
import PolarScene from '../components/polar-scene';
import { Dialog } from '@base-ui/react/dialog';
import { initial, reduce, MENU, type Food } from '../lib/game';

const names = ['小白', '阿企', '棕棕', '雪球', '松松', '小鹿'];
const faces = ['🐻‍❄️', '🐧', '🐻', '🐰', '🐿️', '🦊'];
export default function Home() {
  const [s, dispatch] = useReducer(reduce, undefined, initial);
  const [help, setHelp] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
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
  const live = s.phase === 'playing';
  const time = Math.ceil(s.time);
  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="北極熊烤肉店首頁"><span className="brand-icon"><ChefHat size={26}/></span><span>北極熊烤肉店<small>POLAR BEAR BBQ</small></span></a>
        <div className="top-actions"><span className="weather"><Snowflake size={16}/> −28°C <span>小雪</span></span>
          <button className="icon-btn" title="遊戲玩法" aria-label="遊戲玩法" onClick={() => { dispatch({type:'pause'}); setHelp(true); }}><HelpCircle size={21}/></button>
          <button className="icon-btn" title={s.phase === 'paused' ? '繼續營業' : '暫停營業'} aria-label={s.phase === 'paused' ? '繼續營業' : '暫停營業'} disabled={s.phase === 'idle' || s.phase === 'over'} onClick={() => dispatch({type:s.phase === 'paused' ? 'resume' : 'pause'})}>{s.phase === 'paused' ? <Play size={20}/> : <Pause size={20}/>}</button>
        </div>
      </header>
      <section className="daybar" aria-label="營業狀態">
        <div><span className={'status-dot ' + (live ? 'active' : '')}/><strong>雪地小店 · 第 1 天</strong><span className="daynote">把暖呼呼的美味，送到大家手上。</span></div>
        <div className="stats"><span className="money"><Coins size={20}/><b>{s.coins}</b><small>/ 200</small></span><span className={'time ' + (time < 20 ? 'urgent' : '')}><Clock3 size={18}/><b>{Math.floor(time/60)}:{String(time%60).padStart(2,'0')}</b></span></div>
      </section>
      <div className="game-layout">
        <section className="scene" aria-label="北極熊的雪地餐廳">
          <PolarScene state={s} onSlot={index => dispatch({type: 'slot', index})} onReady={ready => { setSceneReady(ready); if (!ready) dispatch({type: 'pause'}); }}/>
          <div className="scene-label"><Snowflake size={15}/> 極地暖心食堂 · 3D</div>
          <div className="shop-label"><span>營業目標</span><b><Star size={16}/> 200 金幣</b><div className="goal-track"><i style={{width:Math.min(s.coins/200*100,100)+'%'}}/></div></div>
          <div className="scene-bottom"><span className="chef-badge"><ChefHat size={18}/> 店長小白</span><span className="scene-quote">「外面再冷，也要好好吃飯。」</span></div>
          {s.phase !== 'playing' && !help && <div className={"scene-overlay " + (s.phase === 'idle' ? 'intro-overlay' : '')}>
            <div className="start-card">
              <span className="round-icon">{s.phase === 'over' ? <Star size={30}/> : s.phase === 'paused' ? <Pause size={30}/> : <Flame size={30}/>}</span>
              <p className="eyebrow">{s.phase === 'over' ? '今日營業結束' : s.phase === 'paused' ? '讓炭火休息一下' : '雪地裡，開飯囉！'}</p>
              <h1>{s.phase === 'over' ? (s.coins >= 200 ? '暖心小店，達標！' : '今天也辛苦了！') : s.phase === 'paused' ? '小店暫停營業' : '準備好當烤肉店長了嗎？'}</h1>
              <p>{s.phase === 'over' ? '每一份熱食，都讓雪地暖了一點。' : s.phase === 'paused' ? '時間和火候都會等你回來。' : '拖曳看看小店，再來烤一份暖心料理。'}</p>
              {s.phase === 'over' && <div className="results"><span><b>{s.coins}</b>金幣</span><span><b>{s.served}</b>位飽足客人</span><span><b>{s.missed}</b>位離開客人</span></div>}
              <button className="primary" disabled={!sceneReady} onClick={() => dispatch({type:s.phase === 'paused' ? 'resume' : 'start'})}>{s.phase === 'over' ? <RotateCcw size={18}/> : <Play size={18}/>} {s.phase === 'over' ? '再開店一次' : s.phase === 'paused' ? '繼續營業' : (sceneReady ? '開始營業' : '場景載入中…')}<span>→</span></button>
              {s.phase === 'idle' && <small>90 秒挑戰 · 目標 200 金幣</small>}
            </div>
          </div>}
        </section>
        <aside className="orders">
          <div className="section-heading"><div><span className="eyebrow">熱騰騰，馬上好</span><h2>客人的點單 <span>{s.guests.filter(Boolean).length}</span></h2></div><Utensils size={21}/></div>
          <div className="guest-list">{s.guests.map((g,index) => g ? <article className="guest" key={g.id}>
            <div className="guest-top"><span className={'avatar avatar-'+g.id%3}>{faces[g.id%faces.length]}</span><div><h3>{names[g.id%names.length]}<span>想吃</span></h3><p>{MENU[g.food].name}</p></div><span className="order-food" aria-hidden="true">{MENU[g.food].emoji}</span></div>
            <div className="patience-label"><span>{g.patience < 8 ? '肚子咕嚕咕嚕…' : '期待熱呼呼的美味'}</span><span>{Math.ceil(g.patience)}s</span></div>
            <div className={'patience '+(g.patience < 8 ? 'low' : '')}><i style={{width:g.patience/g.max*100+'%'}}/></div>
            <button className={'serve '+(s.inventory[g.food] ? 'ready' : '')} disabled={!live || !s.inventory[g.food]} onClick={() => dispatch({type:'serve',index})}>{s.inventory[g.food] ? <Check size={16}/> : <Utensils size={15}/>} {s.inventory[g.food] ? '送餐' : '等待餐點'}<span><Coins size={14}/> {MENU[g.food].price}</span></button>
          </article> : <div className="guest empty-guest" key={'empty'+index}><span>☃️</span><p>下一位客人正在路上…</p></div>)}</div>
          <div className="order-tip"><Star size={17}/><span>快快上菜，有機會多拿 <b>5 金幣</b>小費！</span></div>
        </aside>
        <section className="kitchen">
          <div className="kitchen-head"><div><Flame size={23}/><h2>小白的烤爐</h2><span>選食材 → 點空烤位 → 變綠起鍋</span></div><span className="fire-status">炭火正旺</span></div>
          <div className="cook-area">
            <div className="ingredients"><span className="eyebrow">① 選擇食材</span>{(['meat','fish'] as Food[]).map(food => <button aria-pressed={s.selected===food} className={'ingredient '+(s.selected===food ? 'selected' : '')} key={food} onClick={() => dispatch({type:'select',food})}><span className="food-emoji">{MENU[food].emoji}</span><span><b>{MENU[food].name}</b><small>{MENU[food].time} 秒烤熟</small></span>{s.selected===food && <Check size={16}/>}</button>)}</div>
            <div className="grill-section"><span className="eyebrow">② 點烤位，掌握火候</span><div className="grill">{s.slots.map((slot,index) => {
              const ready = !!slot && slot.age >= MENU[slot.food].time;
              const burned = !!slot && slot.age >= MENU[slot.food].time+4;
              return <button key={index} disabled={!live} className={'grill-slot '+(burned ? 'burned' : ready ? 'cooked' : slot ? 'cooking' : '')} onClick={() => dispatch({type:'slot',index})} aria-label={'烤位 '+(index+1)+'：'+(!slot ? '放入'+MENU[s.selected].name : burned ? '清理烤焦食物' : ready ? '起鍋'+MENU[slot.food].name : '烘烤中')}>
                <span className="slot-number">0{index+1}</span><span className="grill-food">{slot ? burned ? '💨' : MENU[slot.food].emoji : '+'}</span><b>{!slot ? '放入食材' : burned ? '烤焦了 · 清理' : ready ? '剛剛好！起鍋' : '烘烤中…'}</b>
                {slot ? <><div className="cook-progress"><i style={{width:Math.min(slot.age/(MENU[slot.food].time+4)*100,100)+'%'}}/></div><small>{burned ? '點一下重新開始' : ready ? Math.max(0,Math.ceil(MENU[slot.food].time+4-slot.age))+' 秒後烤焦' : Math.max(0,Math.ceil(MENU[slot.food].time-slot.age))+' 秒後熟透'}</small></> : <small>空烤位</small>}
              </button>;
            })}</div></div>
            <div className="tray"><span className="eyebrow">③ 起鍋待送</span><div className="tray-item"><Beef size={24}/><span>肉串</span><b>× {s.inventory.meat}</b></div><div className="tray-item"><Fish size={24}/><span>烤魚</span><b>× {s.inventory.fish}</b></div><small>烤好後，點客人送餐</small></div>
          </div>
          <div className="message" role="status"><ChefHat size={18}/><span>{s.message}</span></div>
        </section>
      </div>
      <footer><span>一爐炭火，一點幸福。</span><span>3D 極地烤肉小遊戲 · 非官方作品</span></footer>
      <Dialog.Root open={help} onOpenChange={setHelp}><Dialog.Portal><Dialog.Backdrop className="modal-backdrop"/><Dialog.Popup className="help-modal"><Dialog.Title>小店長營業指南</Dialog.Title><Dialog.Close className="close" aria-label="關閉玩法"><X size={20}/></Dialog.Close><Dialog.Description>90 秒內賺到 200 金幣，就是今天的暖心店長！</Dialog.Description><ol><li><b>選食材、放上烤爐</b><p>肉串烤 4 秒，鮮魚烤 5 秒，可以同時使用三個烤位，也能直接點 3D 場景的烤爐。</p></li><li><b>烤位變綠，馬上起鍋</b><p>熟透後有 4 秒可以起鍋，太久會烤焦。烤焦的食物點一下就能清理。</p></li><li><b>依照點單，送上餐點</b><p>起鍋後點客人的「送餐」。客人最多等 24 秒，前 12 秒上菜可多拿 5 金幣。</p></li></ol><Dialog.Close className="primary">我知道了<Check size={18}/></Dialog.Close></Dialog.Popup></Dialog.Portal></Dialog.Root>
    </main>
  );
}
