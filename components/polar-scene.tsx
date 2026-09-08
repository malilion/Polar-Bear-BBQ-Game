'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RotateCcw, Move, ZoomIn, ZoomOut } from 'lucide-react';
import { MENU, type State } from '../lib/game';

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
    setStatus('loading');
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' }); }
    catch { setStatus('error'); return; }
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
    const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.15, 0);
    controls.enableDamping = true; controls.dampingFactor = .08;
    controls.enablePan = false; controls.minDistance = 9; controls.maxDistance = 34;
    controls.minPolarAngle = .35; controls.maxPolarAngle = Math.PI / 2.12;
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
    const resources = { geometries: new Set<THREE.BufferGeometry>(), materials: new Set<THREE.Material>() };
    const disposeModel=(root: THREE.Object3D) => root.traverse(o=>{
      if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}
    });
    let root: THREE.Group | null = null;
    let chef: THREE.Object3D | undefined, head: THREE.Object3D | undefined, arm: THREE.Object3D | undefined;
    const hitTargets: THREE.Object3D[]=[];
    const foods: { object: THREE.Object3D; slot: number; kind: 'meat'|'fish'; parts: {material:THREE.MeshStandardMaterial;raw:THREE.Color}[] }[]=[];
    const guests: THREE.Object3D[]=[];
    new GLTFLoader().load('/models/polar-bbq.glb', gltf => {
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
        }
      });
      for(let slot=0;slot<3;slot++){
        const guest=root.getObjectByName('Guest_'+slot);if(guest)guests[slot]=guest;
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
      scene.add(root);setStatus('ready');current.current.onReady(true);
    },undefined,()=>{if(!disposed){setStatus('error');current.current.onReady(false);}});
    const count=90, positions=new Float32Array(count*3);
    for(let i=0;i<count;i++){positions[i*3]=(Math.random()-.5)*13;positions[i*3+1]=Math.random()*8;positions[i*3+2]=(Math.random()-.5)*11;}
    const snowGeometry=new THREE.BufferGeometry();snowGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const snowMaterial=new THREE.PointsMaterial({color:'#ffffff',size:.045,transparent:true,opacity:.75,depthWrite:false});
    const snow=new THREE.Points(snowGeometry,snowMaterial);scene.add(snow);resources.geometries.add(snowGeometry);resources.materials.add(snowMaterial);
    const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down: {x:number;y:number}|null=null;
    const pointerDown=(e:PointerEvent)=>{down={x:e.clientX,y:e.clientY};};
    const pointerUp=(e:PointerEvent)=>{
      if(!down || Math.hypot(e.clientX-down.x,e.clientY-down.y)>6){down=null;return;}down=null;
      if(current.current.state.phase!=='playing')return;
      const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
      ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(hitTargets,false)[0];
      if(hit){const index=Number(hit.object.userData.slotIndex);if(Number.isInteger(index))current.current.onSlot(index);}
    };
    const lost=(event:Event)=>{event.preventDefault();setStatus('error');current.current.onReady(false);};
    renderer.domElement.addEventListener('pointerdown',pointerDown);
    renderer.domElement.addEventListener('pointerup',pointerUp);
    renderer.domElement.addEventListener('webglcontextlost',lost);
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    const cooked=new THREE.Color('#b66b2b'),burnt=new THREE.Color('#27211e');
    let last=performance.now(),motionTime=0;
    renderer.setAnimationLoop(()=>{
      if(disposed)return;
      const now=performance.now(),dt=Math.min((now-last)/1000,.05);last=now;
      if(document.hidden)return;
      const s=current.current.state;
      const animate=s.phase==='playing'&&!reduced.matches;
      if(animate)motionTime+=dt;
      if(chef)chef.rotation.y=Math.sin(motionTime*.8)*.035;
      if(head)head.rotation.z=Math.sin(motionTime*1.2)*.025;
      if(arm)arm.rotation.x=Math.sin(motionTime*2)*.13;
      for(const f of foods){
        const slot=s.slots[f.slot];f.object.visible=!!slot&&slot.food===f.kind;
        if(slot&&slot.food===f.kind){
          const t=MENU[slot.food].time,done=slot.age>=t+4;
          for(const p of f.parts)p.material.color.copy(done?burnt:p.raw).lerp(cooked,done?0:Math.min(slot.age/t,1));
        }
      }
      guests.forEach((guest,index)=>{guest.visible=!!s.guests[index];});
      if(animate){
        for(let i=0;i<count;i++){positions[i*3+1]-=dt*.5;if(positions[i*3+1]<0)positions[i*3+1]=8;}
        snowGeometry.attributes.position.needsUpdate=true;
      }
      controls.update();renderer.render(scene,camera);
    });
    return()=>{
      disposed=true;view.current=null;renderer.setAnimationLoop(null);observer.disconnect();controls.dispose();
      renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('webglcontextlost',lost);
      resources.geometries.forEach(g=>g.dispose());resources.materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();
    };
  },[retry]);
  return <><div className="scene-canvas" ref={mount}/>
    {status!=='ready' && <div className="scene-loading" role="status">{status==='loading'?<><span className="loading-dot"/>正在佈置 3D 小店…</>:<><b>3D 場景暫時無法載入</b><span>請確認瀏覽器已啟用硬體加速。</span><button onClick={()=>setRetry(n=>n+1)}>重新載入</button></>}</div>}
    {status==='ready' && <div className="view-controls"><span><Move size={14}/> 拖曳旋轉</span><button aria-label="拉近場景" title="拉近場景" onClick={()=>view.current?.zoom(.85)}><ZoomIn size={17}/></button><button aria-label="拉遠場景" title="拉遠場景" onClick={()=>view.current?.zoom(1.15)}><ZoomOut size={17}/></button><button aria-label="重設視角" title="重設視角" onClick={()=>view.current?.reset()}><RotateCcw size={16}/></button></div>}
  </>;
}
