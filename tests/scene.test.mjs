import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Mesh, Box3, Vector3 } from 'three';
const data=readFileSync(new URL('../public/models/polar-bbq.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
test('Blender export is real bounded mesh geometry with no image planes',()=>{
 let count=0,vertices=0;gltf.scene.traverse(o=>{if(o instanceof Mesh){count++;vertices+=o.geometry.attributes.position.count;assert.ok(o.geometry.index,'indexed mesh expected');}});
 assert.ok(count>200);assert.ok(vertices>10000);
 const size=new Box3().setFromObject(gltf.scene).getSize(new Vector3());
 assert.ok(size.x>10&&size.x<20);assert.ok(size.y>4&&size.y<8);assert.ok(size.z>9&&size.z<15);
 assert.ok(data.byteLength<12_000_000,'GLB must stay small enough for mobile');
});
test('all three clickable grills and six food variants retain the runtime naming contract',()=>{
 for(let i=0;i<3;i++){
  const grill=gltf.scene.getObjectByName('GrillHit'+i);assert.ok(grill);assert.equal(grill.userData.slotIndex,i);
  assert.ok(gltf.scene.getObjectByName('Guest_'+i));
  for(const kind of ['meat','fish']){
   const food=gltf.scene.getObjectByName('Food_'+kind+'_'+i);assert.ok(food);let parts=0;
   food.traverse(o=>{if(o.userData.cookable)parts++;});assert.ok(parts>0,kind+' needs cookable material');
  }
 }
 for(const name of ['Chef','ChefHead','ChefArmRight'])assert.ok(gltf.scene.getObjectByName(name));
});
