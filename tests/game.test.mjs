import test from 'node:test';
import assert from 'node:assert/strict';
import { initial, reduce } from '../lib/game.ts';
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
 const s=tick(play(),24);assert.equal(s.missed,3);assert.equal(s.guests.filter(Boolean).length,1);assert.equal(s.guests.find(Boolean).patience,24);
});
test('round ends after 90 seconds and replay clears earned money and grill state',()=>{
 let s=tick(play(),90);assert.equal(s.phase,'over');assert.equal(s.time,0);assert.deepEqual(reduce(s,{type:'slot',index:0}),s);
 s=reduce({...s,coins:300},{type:'start'});assert.equal(s.phase,'playing');assert.equal(s.coins,0);assert.equal(s.time,90);assert.deepEqual(s.slots,[null,null,null]);
});
test('invalid click indices and non-finite clock inputs leave counters valid',()=>{
 let s=play();for(const index of [-1,3,NaN,Infinity])assert.deepEqual(reduce(s,{type:'slot',index}),s);
 s=reduce(s,{type:'tick',dt:NaN});assert.equal(s.time,90);assert.equal(s.guests[0].patience,24);
});
