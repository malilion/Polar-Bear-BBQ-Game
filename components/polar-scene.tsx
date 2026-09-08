'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RotateCcw, Move, ZoomIn, ZoomOut } from 'lucide-react';
import { MENU, BURN_WINDOW, type State } from '../lib/game';

// Static hosts (GitHub Pages project sites) serve the app from a sub-path.
const BASE = import.meta.env?.BASE_URL ?? '/';
const SMOKE_PER_SLOT = 7;

/** Soft radial puff used for smoke sprites; drawn once, no image assets. */
function puffTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,.9)'); grad.addColorStop(.55, 'rgba(255,255,255,.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

type Props = { state: State; onSlot: (index: number) => void; onReady: (ready: boolean) => void };
export default function PolarScene({ state, onSlot, onReady }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const current = useRef({ state, onSlot, onReady });
  const view = useRef<{reset: () => void; zoom: (factor: number) => void} | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);
  useEffect(() => { current.current = { state, onSlot, onReady }; }, [state, onSlot, onReady]);
  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let disposed = false;
    let renderer: THREE.WebGLRenderer;
    current.current.onReady(false);
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' }); }
    // Report asynchronously so the effect body stays free of synchronous setState.
    catch { queueMicrotask(() => setStatus('error')); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-label', '北極熊 3D 烤肉店：拖曳旋轉、滾輪縮放，也可使用下方按鈕操作烤位');
    renderer.domElement.setAttribute('role', 'img');
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#bcdbe2');
    scene.fog = new THREE.Fog('#bcdbe2', 26, 48);
    const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.15, 0);
    controls.enableDamping = true; controls.dampingFactor = .08;
    controls.enablePan = false; controls.minDistance = 9; controls.maxDistance = 34;
    controls.minPolarAngle = .35; controls.maxPolarAngle = Math.PI / 2.12;
    // A slow orbit on the title screen invites people to look around; it stops at the first drag.
    controls.autoRotateSpeed = .5;
    let touched = false;
    const reset = () => {
      const aspect = Math.max(host.clientWidth / Math.max(host.clientHeight,1), .5);
      const distance = Math.max(1, 1.25 / aspect);
      camera.position.set(9 * distance, 10 * distance, 14 * distance);
      controls.target.set(0, 1.15, 0); controls.update();
    };
    view.current = { reset, zoom: factor => { camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target); controls.update(); } };
    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w,h); camera.aspect = w/h; camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize(); reset();
    scene.add(new THREE.HemisphereLight('#f7fbff', '#577e7f', 2.6));
    const sun = new THREE.DirectionalLight('#fff2d1', 3.4);
    sun.position.set(-4,10,7); sun.castShadow = true;
    sun.shadow.mapSize.set(2048,2048);
    Object.assign(sun.shadow.camera, {left:-9,right:9,top:9,bottom:-9,near:.5,far:30});
    sun.shadow.bias=-.0004;sun.shadow.normalBias=.03;
    scene.add(sun);
    const fill=new THREE.DirectionalLight('#c4e9ff',1.8);fill.position.set(5,6,-5);scene.add(fill);
    const hearth=new THREE.PointLight('#ff852a',5,6,2);hearth.position.set(0,1.7,2.15);scene.add(hearth);
    const resources = { geometries: new Set<THREE.BufferGeometry>(), materials: new Set<THREE.Material>(), textures: new Set<THREE.Texture>() };
    const disposeModel=(root: THREE.Object3D) => root.traverse(o=>{
      if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}
    });
    let root: THREE.Group | null = null;
    let chef: THREE.Object3D | undefined, head: THREE.Object3D | undefined, arm: THREE.Object3D | undefined;
    const hitTargets: THREE.Object3D[]=[];
    const embers: THREE.MeshStandardMaterial[]=[];
    const foods: { object: THREE.Object3D; slot: number; kind: 'meat'|'fish'; parts: {material:THREE.MeshStandardMaterial;raw:THREE.Color}[] }[]=[];
    const guests: { object: THREE.Object3D; baseY: number; pop: number; wasVisible: boolean }[]=[];

    // Per-slot rings: hover highlight, "cooked" glow and "about to burn" warning.
    const ringGeometry=new THREE.TorusGeometry(.46,.035,10,40);resources.geometries.add(ringGeometry);
    const ringMaterials={
      hover:new THREE.MeshBasicMaterial({color:'#fff2a8',transparent:true,opacity:.9}),
      ready:new THREE.MeshBasicMaterial({color:'#9df58f',transparent:true,opacity:.85}),
      hurry:new THREE.MeshBasicMaterial({color:'#ff6a3d',transparent:true,opacity:.9}),
    };
    Object.values(ringMaterials).forEach(m=>resources.materials.add(m));
    const rings: THREE.Mesh[]=[];
    const smokeTexture=puffTexture();resources.textures.add(smokeTexture);
    const smokeMaterial=new THREE.SpriteMaterial({map:smokeTexture,transparent:true,depthWrite:false,opacity:.5,color:'#f2f6f7'});
    const charMaterial=new THREE.SpriteMaterial({map:smokeTexture,transparent:true,depthWrite:false,opacity:.6,color:'#4a4744'});
    resources.materials.add(smokeMaterial);resources.materials.add(charMaterial);
    const smoke: { sprite: THREE.Sprite; slot: number; life: number; drift: number; speed: number }[]=[];
    const slotOrigin: THREE.Vector3[]=[];
    const setupSlots=()=>{
      hitTargets.sort((a,b)=>Number(a.userData.slotIndex)-Number(b.userData.slotIndex));
      hitTargets.forEach((target,index)=>{
        const origin=target.getWorldPosition(new THREE.Vector3());slotOrigin[index]=origin;
        const ring=new THREE.Mesh(ringGeometry,ringMaterials.hover);ring.rotation.x=Math.PI/2;
        ring.position.copy(origin).add(new THREE.Vector3(0,.09,0));ring.visible=false;scene.add(ring);rings[index]=ring;
        for(let i=0;i<SMOKE_PER_SLOT;i++){
          const sprite=new THREE.Sprite(smokeMaterial);sprite.visible=false;scene.add(sprite);
          smoke.push({sprite,slot:index,life:i/SMOKE_PER_SLOT,drift:(Math.random()-.5)*.35,speed:.7+Math.random()*.5});
        }
      });
    };
    new GLTFLoader().load(BASE + 'models/polar-bbq.glb', gltf => {
      if(disposed){disposeModel(gltf.scene);return;}
      root=gltf.scene;
      root.traverse(o=>{
        if(o instanceof THREE.Mesh){
          o.castShadow=true;o.receiveShadow=true;resources.geometries.add(o.geometry);
          for(const mat of Array.isArray(o.material)?o.material:[o.material]) resources.materials.add(mat);
          if(o.name.startsWith('GrillHit')){
            o.material=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false});
            resources.materials.add(o.material);o.castShadow=false;hitTargets.push(o);
          }
          if(o.name.startsWith('Ember')&&o.material instanceof THREE.MeshStandardMaterial){o.material=o.material.clone();resources.materials.add(o.material);embers.push(o.material);}
        }
      });
      for(let slot=0;slot<3;slot++){
        const guest=root.getObjectByName('Guest_'+slot);
        if(guest)guests[slot]={object:guest,baseY:guest.position.y,pop:1,wasVisible:true};
        for(const kind of ['meat','fish'] as const){
          const object=root.getObjectByName('Food_'+kind+'_'+slot);
          if(!object)continue;
          const parts: {material:THREE.MeshStandardMaterial;raw:THREE.Color}[]=[];
          object.traverse(o=>{
            if(o instanceof THREE.Mesh && o.userData.cookable && o.material instanceof THREE.MeshStandardMaterial){
              o.material=o.material.clone();resources.materials.add(o.material);
              parts.push({material:o.material,raw:o.material.color.clone()});
            }
          });
          object.visible=false;foods.push({object,slot,kind,parts});
        }
      }
      chef=root.getObjectByName('Chef');head=root.getObjectByName('ChefHead');arm=root.getObjectByName('ChefArmRight');
      scene.add(root);root.updateMatrixWorld(true);setupSlots();setStatus('ready');current.current.onReady(true);
    },undefined,()=>{if(!disposed){setStatus('error');current.current.onReady(false);}});

    // Snow: two layers so near flakes read bigger and drift differently.
    const count=160, positions=new Float32Array(count*3), sizes=new Float32Array(count);
    for(let i=0;i<count;i++){positions[i*3]=(Math.random()-.5)*15;positions[i*3+1]=Math.random()*9;positions[i*3+2]=(Math.random()-.5)*13;sizes[i]=.5+Math.random();}
    const snowGeometry=new THREE.BufferGeometry();snowGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const snowMaterial=new THREE.PointsMaterial({color:'#ffffff',size:.06,transparent:true,opacity:.8,depthWrite:false,map:smokeTexture,alphaTest:.02});
    const snow=new THREE.Points(snowGeometry,snowMaterial);scene.add(snow);resources.geometries.add(snowGeometry);resources.materials.add(snowMaterial);

    const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down: {x:number;y:number}|null=null;let hovered=-1;
    const pick=(e:PointerEvent)=>{
      const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
      ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(hitTargets,false)[0];
      const index=hit?Number(hit.object.userData.slotIndex):-1;return Number.isInteger(index)?index:-1;
    };
    const pointerDown=(e:PointerEvent)=>{down={x:e.clientX,y:e.clientY};touched=true;};
    const pointerMove=(e:PointerEvent)=>{
      if(e.pointerType!=='mouse')return;
      hovered=current.current.state.phase==='playing'?pick(e):-1;
      renderer.domElement.style.cursor=hovered>=0?'pointer':'grab';
    };
    const pointerUp=(e:PointerEvent)=>{
      if(!down || Math.hypot(e.clientX-down.x,e.clientY-down.y)>6){down=null;return;}down=null;
      if(current.current.state.phase!=='playing')return;
      const index=pick(e);if(index>=0)current.current.onSlot(index);
    };
    const pointerLeave=()=>{hovered=-1;};
    const lost=(event:Event)=>{event.preventDefault();setStatus('error');current.current.onReady(false);};
    renderer.domElement.style.cursor='grab';
    renderer.domElement.addEventListener('pointerdown',pointerDown);
    renderer.domElement.addEventListener('pointermove',pointerMove);
    renderer.domElement.addEventListener('pointerup',pointerUp);
    renderer.domElement.addEventListener('pointerleave',pointerLeave);
    renderer.domElement.addEventListener('webglcontextlost',lost);
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    const cooked=new THREE.Color('#b66b2b'),burnt=new THREE.Color('#27211e');
    let last=performance.now(),motionTime=0,clock=0;
    renderer.setAnimationLoop(()=>{
      if(disposed)return;
      const now=performance.now(),dt=Math.min((now-last)/1000,.05);last=now;
      if(document.hidden)return;
      const s=current.current.state;
      const playing=s.phase==='playing';
      const animate=playing&&!reduced.matches;
      if(!reduced.matches)clock+=dt;
      if(animate)motionTime+=dt;
      controls.autoRotate=s.phase==='idle'&&!touched&&!reduced.matches;
      const busy=s.slots.some(Boolean);
      if(chef)chef.rotation.y=Math.sin(motionTime*.8)*.035;
      if(head)head.rotation.z=Math.sin(motionTime*1.2)*.025;
      if(arm)arm.rotation.x=Math.sin(motionTime*(busy?3.4:2))*(busy?.2:.13);
      // Coals breathe; the hearth light flickers with them.
      const glow=.85+Math.sin(clock*5.3)*.12+Math.sin(clock*13.1)*.06;
      hearth.intensity=(busy?6.5:5)*glow;
      for(const m of embers)m.emissiveIntensity=1.7*glow*(busy?1.25:1);
      for(const f of foods){
        const slot=s.slots[f.slot];f.object.visible=!!slot&&slot.food===f.kind;
        if(slot&&slot.food===f.kind){
          const t=MENU[slot.food].time,done=slot.age>=t+BURN_WINDOW;
          for(const p of f.parts)p.material.color.copy(done?burnt:p.raw).lerp(cooked,done?0:Math.min(slot.age/t,1));
        }
      }
      rings.forEach((ring,index)=>{
        const slot=s.slots[index];
        const ready=!!slot&&slot.age>=MENU[slot.food].time;
        const left=slot?MENU[slot.food].time+BURN_WINDOW-slot.age:0;
        const burntNow=!!slot&&left<=0;
        if(!playing){ring.visible=false;return;}
        if(ready&&!burntNow){ring.material=left<1.5?ringMaterials.hurry:ringMaterials.ready;ring.visible=true;const pulse=1+Math.sin(clock*(left<1.5?14:6))*.07;ring.scale.setScalar(pulse);}
        else if(hovered===index){ring.material=ringMaterials.hover;ring.visible=true;ring.scale.setScalar(1);}
        else ring.visible=false;
      });
      for(const puff of smoke){
        const slot=s.slots[puff.slot];const origin=slotOrigin[puff.slot];
        const cooking=!!slot&&origin;
        if(!cooking||!animate&&!puff.sprite.visible){puff.sprite.visible=false;continue;}
        const charred=slot.age>=MENU[slot.food].time+BURN_WINDOW;
        puff.sprite.material=charred?charMaterial:smokeMaterial;
        if(animate){puff.life+=dt*puff.speed*(charred?.55:.8);if(puff.life>1){puff.life=0;puff.drift=(Math.random()-.5)*.35;}}
        const l=puff.life;
        puff.sprite.visible=true;
        puff.sprite.position.set(origin.x+puff.drift*l+Math.sin(clock*2+puff.slot)*.05,origin.y+.15+l*(charred?1.6:1.1),origin.z+Math.cos(clock*1.7+l*4)*.05);
        puff.sprite.scale.setScalar(.18+l*(charred?.7:.45));
        puff.sprite.material.opacity=(charred?.65:.42)*(1-l)*Math.min(1,l*6);
      }
      guests.forEach((g,index)=>{
        const data=s.guests[index];const visible=!!data;
        if(visible&&!g.wasVisible)g.pop=0;
        g.wasVisible=visible;g.object.visible=visible;
        if(!visible)return;
        if(g.pop<1)g.pop=Math.min(1,g.pop+dt*3.2);
        const overshoot=1+Math.sin(g.pop*Math.PI)*.18;
        g.object.scale.setScalar(g.pop<1?g.pop*overshoot:1);
        // Hungry guests fidget; fresh ones sit still.
        const anxious=animate&&data.patience<8;
        g.object.position.y=g.baseY+(anxious?Math.abs(Math.sin(clock*9))*.06:0);
        g.object.rotation.z=anxious?Math.sin(clock*11)*.05:0;
      });
      if(animate){
        for(let i=0;i<count;i++){positions[i*3+1]-=dt*(.35+sizes[i]*.3);positions[i*3]+=Math.sin(clock+i)*dt*.12;if(positions[i*3+1]<0)positions[i*3+1]=9;}
        snowGeometry.attributes.position.needsUpdate=true;
      }
      controls.update();renderer.render(scene,camera);
    });
    return()=>{
      disposed=true;view.current=null;renderer.setAnimationLoop(null);observer.disconnect();controls.dispose();
      renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointermove',pointerMove);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('pointerleave',pointerLeave);renderer.domElement.removeEventListener('webglcontextlost',lost);
      resources.geometries.forEach(g=>g.dispose());resources.materials.forEach(m=>m.dispose());resources.textures.forEach(t=>t.dispose());renderer.dispose();renderer.domElement.remove();
    };
  },[retry]);
  return <><div className="scene-canvas" ref={mount}/>
    {status!=='ready' && <output className="scene-loading" aria-live="polite">{status==='loading'?<><span className="loading-dot"/>正在佈置 3D 小店…</>:<><b>3D 場景暫時無法載入</b><span>請確認瀏覽器已啟用硬體加速。</span><button onClick={()=>{setStatus('loading');setRetry(n=>n+1);}}>重新載入</button></>}</output>}
    {status==='ready' && <div className="view-controls"><span><Move size={14}/> 拖曳旋轉</span><button aria-label="拉近場景" title="拉近場景" onClick={()=>view.current?.zoom(.85)}><ZoomIn size={17}/></button><button aria-label="拉遠場景" title="拉遠場景" onClick={()=>view.current?.zoom(1.15)}><ZoomOut size={17}/></button><button aria-label="重設視角" title="重設視角" onClick={()=>view.current?.reset()}><RotateCcw size={16}/></button></div>}
  </>;
}
