import test from 'node:test';
import assert from 'node:assert/strict';
import { initial, reduce, patienceFor, stars, comboBonus, EVENT_TTL } from '../lib/game.ts';
const play=()=>reduce(initial(),{type:'start'});
const tick=(s,seconds)=>{for(let i=0;i<seconds;i++)s=reduce(s,{type:'tick',dt:1});return s;};
test('three cooking slots are independent; serving consumes only the matching meal',()=>{
 let s=play();s=reduce(s,{type:'slot',index:0});s=reduce(s,{type:'select',food:'fish'});s=reduce(s,{type:'slot',index:1});
 s=tick(s,4);s=reduce(s,{type:'slot',index:0});s=reduce(s,{type:'slot',index:1});
 assert.equal(s.inventory.meat,1);assert.equal(s.inventory.fish,0);assert.equal(s.slots[1].food,'fish');
 s=reduce(s,{type:'serve',index:1});assert.equal(s.coins,0);assert.equal(s.inventory.meat,1);
 s=reduce(s,{type:'serve',index:0});assert.equal(s.coins,30);assert.equal(s.served,1);assert.equal(s.inventory.meat,0);
 s=tick(s,1);s=reduce(s,{type:'slot',index:1});s=reduce(s,{type:'serve',index:1});assert.equal(s.coins,70);
});
test('food can be collected before the burn deadline and must be discarded at the deadline',()=>{
 let s=reduce(play(),{type:'slot',index:0});s=tick(s,7);s=reduce(s,{type:'slot',index:0});assert.equal(s.inventory.meat,1);
 s=reduce(play(),{type:'slot',index:0});s=tick(s,8);s=reduce(s,{type:'slot',index:0});assert.equal(s.inventory.meat,0);assert.equal(s.burnt,1);assert.equal(s.slots[0],null);
});
test('pause freezes both cooking and customer patience',()=>{
 let s=reduce(play(),{type:'slot',index:0});s=tick(s,2);s=reduce(s,{type:'pause'});const snapshot=structuredClone(s);s=tick(s,9);assert.deepEqual(s,snapshot);
 s=reduce(s,{type:'resume'});s=tick(s,1);assert.equal(s.time,87);assert.equal(s.slots[0].age,3);
});
test('customers leave after patience expires and fresh guests have full patience',()=>{
 const s=tick(play(),24);assert.equal(s.missed,3);assert.equal(s.guests.filter(Boolean).length,1);assert.equal(s.guests.find(Boolean).patience,patienceFor(24));assert.ok(patienceFor(24)<24&&patienceFor(24)>16);
});
test('round ends after 90 seconds and replay clears earned money and grill state',()=>{
 let s=tick(play(),90);assert.equal(s.phase,'over');assert.equal(s.time,0);assert.deepEqual(reduce(s,{type:'slot',index:0}),s);
 s=reduce({...s,coins:300},{type:'start'});assert.equal(s.phase,'playing');assert.equal(s.coins,0);assert.equal(s.time,90);assert.deepEqual(s.slots,[null,null,null]);
});
test('invalid click indices and non-finite clock inputs leave counters valid',()=>{
 let s=play();for(const index of [-1,3,NaN,Infinity])assert.deepEqual(reduce(s,{type:'slot',index}),s);
 s=reduce(s,{type:'tick',dt:NaN});assert.equal(s.time,90);assert.equal(s.guests[0].patience,24);
});
test('fast serves build a combo that pays bonus tips; a missed guest resets it',()=>{
 let s=play();
 for(let round=0;round<3;round++){
  const index=s.guests.findIndex(Boolean);
  s=reduce(s,{type:'select',food:s.guests[index].food});s=reduce(s,{type:'slot',index:0});
  s=tick(s,5);s=reduce(s,{type:'slot',index:0});s=reduce(s,{type:'serve',index});
 }
 assert.equal(s.combo,3);assert.equal(s.bestCombo,3);assert.equal(s.event.kind,'serve');
 assert.equal(s.tips,5+5+(5+comboBonus(3)));
 s=tick(s,30);assert.ok(s.missed>0);assert.equal(s.combo,0);assert.equal(s.bestCombo,3);
});
test('slow serves earn no tip and break the streak without losing the base price',()=>{
 let s=play();s=reduce(s,{type:'slot',index:0});s=tick(s,15);s=reduce(s,{type:'slot',index:0});
 assert.equal(s.slots[0],null);assert.equal(s.burnt,1);
 s=reduce(s,{type:'slot',index:0});s=tick(s,4);s=reduce(s,{type:'slot',index:0});
 const guest=s.guests.findIndex(g=>g&&g.food==='meat');assert.ok(s.guests[guest].patience<=s.guests[guest].max/2);
 const coins=s.coins;s=reduce(s,{type:'serve',index:guest});assert.equal(s.coins,coins+25);assert.equal(s.combo,0);
});
test('events carry an id, a clock stamp and age out of the trailing window',()=>{
 let s=play();assert.equal(s.event.kind,'start');assert.equal(s.event.at,90);
 s=reduce(s,{type:'slot',index:0});const placed=s.event;assert.equal(placed.kind,'place');assert.equal(placed.index,0);
 s=tick(s,4);assert.equal(s.event.kind,'ready');assert.ok(s.event.id>placed.id);
 assert.ok(s.events.every(e=>e.at-s.time<=EVENT_TTL));assert.ok(!s.events.includes(placed));
});
test('star thresholds and later guests preferring fish',()=>{
 assert.equal(stars(0),0);assert.equal(stars(200),1);assert.equal(stars(350),2);assert.equal(stars(999),3);
 const s=tick(play(),60);const late=s.guests.filter(Boolean);assert.ok(late.length>0);
 assert.ok(late.every(g=>g.max===patienceFor(60)||g.max===patienceFor(58)||g.max===patienceFor(59)||g.max<24));
});
