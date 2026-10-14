import * as THREE from 'three';
import { OrbitControls } from './vendor/three/OrbitControls.js';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';
import { createLaptop, SCREEN_WIDTH } from './laptop.js';
import { icon } from './icons.js';

const STORAGE_KEY='living-screenshots-3d-state-v1';
const isLocalHost=['localhost','127.0.0.1','[::1]'].includes(location.hostname)||location.hostname.endsWith('.localhost');
const CAMERA_DISTANCE=8;
const MIN_ELEVATION=0;
const MAX_ELEVATION=70;
const layerOrder=['background','middleground','middleForeground','foreground'];
const layerNames=['Background','Middle Ground','Middle Foreground','Foreground'];
const layerColors=['#2d7f86','#7c9a5f','#c78457','#9a729d'];
const demoScreenColors={
  'Dashboard demo':'#e8f3f0',
  'Chess Demo':'#19272b',
  'Music demo':'#191d22',
  'Architecture demo':'#eaf0f2'
};
const builtInSets=Object.keys(demoScreenColors).map(name=>({name,source:'built-in',layers:layerOrder.map((key,index)=>({key,name:`${layerNames[index]}.svg`,url:`assets/${name}/${layerNames[index]}.svg`}))}));
const viewport=document.getElementById('viewport');
const renderStatus=document.getElementById('renderStatus');
const root=document.documentElement;
document.getElementById('localAssetActions').hidden=!isLocalHost;
document.querySelector('label[for="assetSetSelect"]').textContent=isLocalHost?'Folder':'Demo';
let state;
let assetSets=[...builtInSets];
let serverSets=[];
let localSets=[];
let folderHandle=null;
let localUrls=[];
let assetVersion=0;
let interacting=false;
let applyingCamera=false;
let needsRender=true;
let elapsed=0;

function defaults() {
  return {
    canvas:{grid:true,background:0,panelCollapsed:false,assetSet:'Dashboard demo',highQuality:false},
    scene:{perspective:38,rotateX:24,rotateY:-28,rotateZ:0,scale:1},
    laptop:{visible:true,x:0,y:0,z:0,scale:1,lidAngle:105,finish:'gray',bodyColor:'#4f5560',screenColor:demoScreenColors['Dashboard demo']},
    demoScreenColors:{...demoScreenColors},
    animation:{enabled:!matchMedia('(prefers-reduced-motion: reduce)').matches,axis:'y',angle:4.5,speed:9000,depth:1.2,time:0},
    layers:Object.fromEntries(layerOrder.map((key,index)=>[key,{x:0,y:0,z:index*.22,rotateX:0,rotateY:0,rotateZ:0,scale:1,opacity:100}]))
  };
}

function merge(defaultValue,saved) {
  if(!saved||typeof saved!=='object')return defaultValue;
  for(const [key,value] of Object.entries(saved)) {
    if(!(key in defaultValue))continue;
    if(defaultValue[key]&&typeof defaultValue[key]==='object')merge(defaultValue[key],value);
    else if(typeof defaultValue[key]===typeof value && (typeof value!=='number'||Number.isFinite(value)))defaultValue[key]=value;
  }
  return defaultValue;
}

function loadState() {
  try{return merge(defaults(),JSON.parse(localStorage.getItem(STORAGE_KEY)));}catch{return defaults();}
}
function saveState(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{}}
state=loadState();elapsed=state.animation.time;

document.querySelectorAll('[data-icon]').forEach(element=>element.replaceChildren(icon(element.dataset.icon)));
document.querySelectorAll('summary').forEach(element=>element.append(icon('ChevronDown')));

let renderer;
try {
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
} catch(error) {
  renderStatus.textContent='3D rendering is unavailable in this browser. Enable hardware acceleration and reload.';
  renderStatus.classList.add('error');
  throw error;
}
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate=false;
renderer.domElement.id='sceneCanvas';
renderer.domElement.setAttribute('aria-label','3D laptop and layered screenshots');
viewport.prepend(renderer.domElement);

const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(state.scene.perspective,1,.05,60);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enablePan=false;controls.enableDamping=false;
controls.minAzimuthAngle=-Math.PI/2;controls.maxAzimuthAngle=Math.PI/2;
controls.minPolarAngle=THREE.MathUtils.degToRad(90-MAX_ELEVATION);controls.maxPolarAngle=THREE.MathUtils.degToRad(90-MIN_ELEVATION);
controls.minDistance=3.5;controls.maxDistance=10;
controls.target.set(0,1.05,.05);

const environment=new RoomEnvironment();
const pmrem=new THREE.PMREMGenerator(renderer);
const environmentTarget=pmrem.fromScene(environment,.04);
scene.environment=environmentTarget.texture;
scene.environmentIntensity=.9;
environment.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight('#ffffff','#bbc7d0',1.4));
const keyLight=new THREE.DirectionalLight('#fff7ed',3.4);
keyLight.position.set(-3.5,6,4);keyLight.castShadow=true;
keyLight.shadow.mapSize.set(2048,2048);keyLight.shadow.camera.left=-5;keyLight.shadow.camera.right=5;keyLight.shadow.camera.top=5;keyLight.shadow.camera.bottom=-5;
keyLight.shadow.camera.near=.1;keyLight.shadow.camera.far=20;keyLight.shadow.bias=-.0003;keyLight.shadow.normalBias=.01;
scene.add(keyLight);
const fillLight=new THREE.DirectionalLight('#dcecff',2);fillLight.position.set(5,3,1);scene.add(fillLight);
const rimLight=new THREE.DirectionalLight('#ffffff',2);rimLight.position.set(1,5,-5);scene.add(rimLight);

const laptop=createLaptop();scene.add(laptop.group);
const layerMeshes=layerOrder.map((key,index)=>{
  const material=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,alphaTest:.005,side:THREE.FrontSide,toneMapped:false});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_WIDTH,SCREEN_WIDTH*1037/1920),material);
  mesh.name=layerNames[index];mesh.renderOrder=index+2;mesh.visible=false;laptop.screenAnchor.add(mesh);return mesh;
});
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.14}));
ground.rotation.x=-Math.PI/2;ground.position.y=-.015;ground.receiveShadow=true;scene.add(ground);
const grid=new THREE.GridHelper(16,64,'#a8bbc0','#d9e2e5');grid.position.y=-.012;
grid.material.transparent=true;grid.material.opacity=.26;grid.material.depthWrite=false;scene.add(grid);

const specs={
  scene:[['perspective','Perspective',25,60,1],['rotateX','Rotate X',MIN_ELEVATION,MAX_ELEVATION,1],['rotateY','Rotate Y',-90,90,1],['rotateZ','Rotate Z',-20,20,1],['scale','Scale',.65,1.65,.01]],
  laptop:[['lidAngle','Lid angle',90,125,1],['x','X',-1.5,1.5,.01],['y','Y',-.2,1,.01],['z','Z',-1,1,.01],['scale','Scale',.65,1.3,.01]],
  animation:[['angle','Intensity',0,15,.1],['speed','Speed',3000,20000,250],['depth','Z Depth',0,2.5,.01]],
  layer:[['x','X',-1,1,.01],['y','Y',-1,1,.01],['z','Depth',0,1.5,.01],['rotateX','Rotate X',-30,30,1],['rotateY','Rotate Y',-30,30,1],['rotateZ','Rotate Z',-30,30,1],['scale','Scale',.5,1.5,.01],['opacity','Opacity',0,100,1]]
};

function target(group,path){return path?state[group][path]:state[group];}
function makeControl(group,[key,label,min,max,step],path) {
  const row=document.createElement('div');row.className='control';
  const id=`${group}-${path?`${path}-`:''}${key}`;
  const text=document.createElement('label');text.htmlFor=id;text.textContent=label;
  const range=document.createElement('input');range.type='range';range.id=id;
  const number=document.createElement('input');number.type='number';number.id=`${id}-value`;number.setAttribute('aria-label',`${label} value`);
  for(const input of [range,number]){input.min=min;input.max=max;input.step=step;input.value=target(group,path)[key];input.dataset.group=group;input.dataset.key=key;if(path)input.dataset.path=path;}
  const update=value=>{
    if(!Number.isFinite(Number(value))||value==='')return;
    const next=THREE.MathUtils.clamp(Number(value),min,max);
    target(group,path)[key]=next;range.value=next;number.value=next;
    applyState();
  };
  range.addEventListener('input',()=>update(range.value));number.addEventListener('input',()=>update(number.value));
  row.append(text,range,number);return row;
}

function renderControls() {
  for(const group of ['scene','laptop','animation'])document.getElementById(`${group}Controls`).replaceChildren(...specs[group].map(spec=>makeControl(group,spec)));
  const sections=layerOrder.map((key,index)=>{
    const detail=document.createElement('details');detail.className='section';
    const summary=document.createElement('summary');
    const title=document.createElement('span');title.className='layer-title';
    const dot=document.createElement('span');dot.className='layer-dot';dot.style.setProperty('--dot-color',layerColors[index]);
    title.append(dot,layerNames[index]);summary.append(title,icon('ChevronDown'));
    const body=document.createElement('div');body.className='section-body';body.append(...specs.layer.map(spec=>makeControl('layers',spec,key)));
    detail.append(summary,body);return detail;
  });
  document.getElementById('layerControls').replaceChildren(...sections);
}

function syncControls() {
  document.querySelectorAll('input[data-group]').forEach(input=>{input.value=target(input.dataset.group,input.dataset.path)[input.dataset.key];});
  document.getElementById('canvasGrid').checked=state.canvas.grid;
  document.getElementById('canvasBg').value=state.canvas.background;
  document.getElementById('bodyColor').value=state.laptop.bodyColor;
  document.getElementById('screenColor').value=state.laptop.screenColor;
  document.getElementById('laptopVisible').checked=state.laptop.visible;
  document.getElementById('highQuality').checked=state.canvas.highQuality;
  document.getElementById('animationAxis').value=state.animation.axis;
  const play=document.getElementById('animationToggle');play.querySelector('[data-icon]').replaceChildren(icon(state.animation.enabled?'Pause':'Play'));
  document.getElementById('animationLabel').textContent=state.animation.enabled?'Pause':'Play';
  play.setAttribute('aria-pressed',state.animation.enabled);play.setAttribute('aria-label',state.animation.enabled?'Pause animation':'Play animation');
  const panel=document.getElementById('panelToggle');panel.replaceChildren(icon(state.canvas.panelCollapsed?'PanelRightOpen':'PanelRightClose'));
  panel.setAttribute('aria-expanded',!state.canvas.panelCollapsed);panel.title=state.canvas.panelCollapsed?'Expand controls':'Collapse controls';panel.setAttribute('aria-label',panel.title);
  document.querySelectorAll('[data-finish]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.finish===state.laptop.finish));
}

function resize() {
  const width=viewport.clientWidth,height=viewport.clientHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,state.canvas.highQuality?2:1.5));renderer.setSize(width,height,false);
  camera.aspect=width/height;camera.updateProjectionMatrix();needsRender=true;
}

function applyState({persist=true}={}) {
  document.getElementById('app').classList.toggle('panel-collapsed',state.canvas.panelCollapsed);
  const shade=Math.round(255-state.canvas.background*2.55);
  root.style.setProperty('--canvas-color',`rgb(${shade},${shade},${shade})`);root.style.setProperty('--canvas-ink',shade<128?'#e6edf1':'#20272d');
  grid.visible=state.canvas.grid;grid.material.color.set(shade<128?'#687780':'#d0dadd');
  laptop.update(state.laptop);
  layerMeshes.forEach((mesh,index)=>{
    const values=state.layers[layerOrder[index]];
    mesh.position.set(values.x,values.y,.003+index*.0005+values.z*state.animation.depth);
    mesh.rotation.set(THREE.MathUtils.degToRad(values.rotateX),THREE.MathUtils.degToRad(values.rotateY),THREE.MathUtils.degToRad(values.rotateZ));
    mesh.scale.setScalar(values.scale);mesh.material.opacity=values.opacity/100;
  });
  camera.fov=state.scene.perspective;camera.updateProjectionMatrix();
  syncControls();resize();renderer.shadowMap.needsUpdate=true;needsRender=true;
  state.animation.time=elapsed;
  if(persist)saveState();
}

function cameraFromState() {
  const wave=Math.sin(elapsed/state.animation.speed*Math.PI*2)*state.animation.angle;
  let elevation=state.scene.rotateX,yaw=state.scene.rotateY,roll=state.scene.rotateZ;
  if(state.animation.axis==='x')elevation+=wave;
  else if(state.animation.axis==='z')roll+=wave;
  else yaw+=wave;
  elevation=THREE.MathUtils.clamp(elevation,MIN_ELEVATION,MAX_ELEVATION);yaw=THREE.MathUtils.clamp(yaw,-90,90);
  const angle=THREE.MathUtils.degToRad(yaw),phi=THREE.MathUtils.degToRad(90-elevation);
  const aspectFit=camera.aspect<1?1/camera.aspect:1;
  const distance=CAMERA_DISTANCE/state.scene.scale*aspectFit;
  controls.minDistance=CAMERA_DISTANCE/1.65*aspectFit;controls.maxDistance=CAMERA_DISTANCE/.65*aspectFit;
  camera.position.setFromSpherical(new THREE.Spherical(distance,phi,angle)).add(controls.target);
  applyingCamera=true;controls.update();applyingCamera=false;
  camera.rotateZ(THREE.MathUtils.degToRad(roll));
}

function readCamera() {
  const offset=camera.position.clone().sub(controls.target);
  const spherical=new THREE.Spherical().setFromVector3(offset);
  state.scene.rotateX=THREE.MathUtils.clamp(90-THREE.MathUtils.radToDeg(spherical.phi),MIN_ELEVATION,MAX_ELEVATION);
  state.scene.rotateY=THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(spherical.theta),-90,90);
  const aspectFit=camera.aspect<1?1/camera.aspect:1;
  state.scene.scale=THREE.MathUtils.clamp(CAMERA_DISTANCE*aspectFit/spherical.radius,.65,1.65);
  syncControls();needsRender=true;
}

controls.addEventListener('start',()=>{interacting=true;readCamera();elapsed=0;});
controls.addEventListener('change',()=>{if(!applyingCamera){readCamera();state.animation.time=elapsed;saveState();}});
controls.addEventListener('end',()=>{interacting=false;readCamera();saveState();needsRender=true;});

function renderAssetOptions() {
  const byName=new Map();for(const set of [...builtInSets,...serverSets,...localSets])byName.set(set.name,set);
  assetSets=[...byName.values()];
  if(!assetSets.some(set=>set.name===state.canvas.assetSet))state.canvas.assetSet=builtInSets[0].name;
  const select=document.getElementById('assetSetSelect');
  select.replaceChildren(...assetSets.map(set=>{const option=document.createElement('option');option.value=set.name;option.textContent=set.name;return option;}));
  select.value=state.canvas.assetSet;
}

async function textureFromFile(file) {
  const response=await fetch(file.url);if(!response.ok)throw new Error(`Could not load ${file.name}`);
  const blob=await response.blob();
  const url=URL.createObjectURL(blob);const image=new Image();
  try {
    image.src=url;await image.decode();
    const maxWidth=Math.min(renderer.capabilities.maxTextureSize,innerWidth<=640?1280:1920);
    const scale=Math.min(1,maxWidth/image.naturalWidth);
    const canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    return {texture,ratio:image.naturalHeight/image.naturalWidth};
  } finally {URL.revokeObjectURL(url);}
}

async function loadAssetSet(name,{persist=true}={}) {
  const set=assetSets.find(set=>set.name===name);if(!set)return;
  const version=++assetVersion;
  state.canvas.assetSet=name;
  if(Object.hasOwn(state.demoScreenColors,name))state.laptop.screenColor=state.demoScreenColors[name];
  applyState({persist});
  document.getElementById('assetStatus').textContent='Loading layers';
  const results=await Promise.allSettled(set.layers.map(textureFromFile));
  const loaded=results.filter(result=>result.status==='fulfilled').map(result=>result.value);
  if(version!==assetVersion||loaded.length!==4){loaded.forEach(({texture})=>texture.dispose());if(version===assetVersion)document.getElementById('assetStatus').textContent='Could not load all four SVG layers.';return;}
  results.forEach((result,index)=>{
    const {texture,ratio}=result.value;
    const mesh=layerMeshes[index];mesh.material.map?.dispose();mesh.geometry.dispose();
    mesh.geometry=new THREE.PlaneGeometry(SCREEN_WIDTH,SCREEN_WIDTH*ratio);mesh.material.map=texture;mesh.material.needsUpdate=true;mesh.visible=true;
  });
  document.getElementById('assetStatus').textContent='';
  renderStatus.hidden=true;viewport.dataset.ready='true';needsRender=true;
}

function mapFiles(files) {
  const sorted=[...files].sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
  const normalize=name=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
  const used=new Set();const selected={};
  const tests={background:['background','bg'],middleForeground:['middleforeground','middleforeround','midforeground'],middleground:['middleground','middle'],foreground:['foreground','foreround']};
  for(const key of ['background','middleForeground','middleground','foreground']){
    const match=sorted.find(file=>!used.has(file.name)&&tests[key].some(test=>normalize(file.name).includes(test)));
    if(match){selected[key]=match;used.add(match.name);}
  }
  for(const key of layerOrder)if(!selected[key]){const file=sorted.find(file=>!used.has(file.name));if(file){selected[key]=file;used.add(file.name);}}
  return layerOrder.every(key=>selected[key])?layerOrder.map(key=>({...selected[key],key})):null;
}

function directoryLinks(html,base) {
  return [...new DOMParser().parseFromString(html,'text/html').querySelectorAll('a[href]')].map(link=>new URL(link.getAttribute('href'),base)).filter(url=>url.origin===location.origin);
}
async function scanServer() {
  if(!isLocalHost)return false;
  try {
    const base=new URL('assets/',location.href);const response=await fetch(base,{cache:'no-store'});if(!response.ok)return false;
    const folders=directoryLinks(await response.text(),base).filter(url=>url.pathname.startsWith(base.pathname)&&url.pathname!==base.pathname&&url.pathname.endsWith('/'));
    const sets=[];
    for(const url of folders){const listing=await fetch(url,{cache:'no-store'});if(!listing.ok)continue;const files=directoryLinks(await listing.text(),url).filter(link=>link.pathname.toLowerCase().endsWith('.svg')).map(link=>({name:decodeURIComponent(link.pathname.split('/').pop()),url:link.href}));const layers=mapFiles(files);if(layers)sets.push({name:decodeURIComponent(url.pathname.split('/').at(-2)),source:'server',layers});}
    serverSets=sets;renderAssetOptions();return sets.length>0;
  }catch{return false;}
}

async function filesInHandle(handle) {
  const files=[];
  for await(const [name,entry] of handle.entries())if(entry.kind==='file'&&name.toLowerCase().endsWith('.svg')){const url=URL.createObjectURL(await entry.getFile());localUrls.push(url);files.push({name,url});}
  return files;
}
async function scanLocal(handle) {
  const oldUrls=localUrls;localUrls=[];const sets=[];
  const rootLayers=mapFiles(await filesInHandle(handle));if(rootLayers)sets.push({name:handle.name,source:'local',layers:rootLayers});
  for await(const [name,entry] of handle.entries())if(entry.kind==='directory'){const layers=mapFiles(await filesInHandle(entry));if(layers)sets.push({name,source:'local',layers});}
  localSets=sets;renderAssetOptions();
  await loadAssetSet(sets[0]?.name||state.canvas.assetSet);
  document.getElementById('assetSetSelect').value=state.canvas.assetSet;
  oldUrls.forEach(url=>URL.revokeObjectURL(url));
  if(!sets.length)document.getElementById('assetStatus').textContent='No folders with four SVG layers found.';
}

document.getElementById('assetSetSelect').addEventListener('change',event=>loadAssetSet(event.target.value));
document.getElementById('chooseAssetsFolder').addEventListener('click',async()=>{
  if(!window.showDirectoryPicker){document.getElementById('assetStatus').textContent='Folder selection requires Chrome or Edge.';return;}
  try{folderHandle=await window.showDirectoryPicker({mode:'read'});await scanLocal(folderHandle);}catch(error){if(error.name!=='AbortError')document.getElementById('assetStatus').textContent='Could not read that folder.';}
});
document.getElementById('rescanAssetsFolder').addEventListener('click',async()=>{if(folderHandle)await scanLocal(folderHandle);else {await scanServer();await loadAssetSet(state.canvas.assetSet);}});
document.getElementById('animationToggle').addEventListener('click',()=>{state.animation.enabled=!state.animation.enabled;applyState();});
document.getElementById('animationAxis').addEventListener('change',event=>{state.animation.axis=event.target.value;applyState();});
document.getElementById('canvasGrid').addEventListener('change',event=>{state.canvas.grid=event.target.checked;applyState();});
document.getElementById('canvasBg').addEventListener('input',event=>{state.canvas.background=Number(event.target.value);applyState();});
document.getElementById('screenColor').addEventListener('input',event=>{
  state.laptop.screenColor=event.target.value;
  if(Object.hasOwn(state.demoScreenColors,state.canvas.assetSet))state.demoScreenColors[state.canvas.assetSet]=event.target.value;
  applyState();
});
document.getElementById('bodyColor').addEventListener('input',event=>{state.laptop.bodyColor=event.target.value;state.laptop.finish='custom';applyState();});
document.querySelectorAll('[data-finish]').forEach(button=>button.addEventListener('click',()=>{state.laptop.finish=button.dataset.finish;state.laptop.bodyColor=button.dataset.finish==='gray'?'#4f5560':'#c4c7cc';applyState();}));
document.getElementById('laptopVisible').addEventListener('change',event=>{state.laptop.visible=event.target.checked;applyState();});
document.getElementById('panelToggle').addEventListener('click',()=>{state.canvas.panelCollapsed=!state.canvas.panelCollapsed;applyState();});
document.getElementById('resetView').addEventListener('click',()=>{state.scene=defaults().scene;elapsed=0;applyState();});
document.getElementById('openSettings').addEventListener('click',()=>document.getElementById('settingsModal').showModal());
document.getElementById('highQuality').addEventListener('change',event=>{state.canvas.highQuality=event.target.checked;applyState();});
async function resetApp() {
  try{localStorage.clear();}catch{}
  const previousUrls=localUrls;localUrls=[];localSets=[];folderHandle=null;
  state=defaults();elapsed=0;
  renderControls();renderAssetOptions();applyState({persist:false});
  document.getElementById('settingsModal').close();
  await loadAssetSet(state.canvas.assetSet,{persist:false});
  previousUrls.forEach(url=>URL.revokeObjectURL(url));
}
for(const id of ['resetAll','resetApp'])document.getElementById(id).addEventListener('click',resetApp);

new ResizeObserver(resize).observe(viewport);
renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();renderStatus.hidden=false;renderStatus.textContent='The 3D session was interrupted. Reload to continue.';renderStatus.classList.add('error');});
let previous=performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const delta=Math.min(now-previous,50);previous=now;
  if(state.animation.enabled&&!interacting&&!document.hidden){elapsed+=delta;needsRender=true;}
  if(needsRender){if(!interacting)cameraFromState();renderer.render(scene,camera);needsRender=false;}
}
renderControls();renderAssetOptions();applyState();loadAssetSet(state.canvas.assetSet);scanServer();
requestAnimationFrame(frame);

export {scene,camera,renderer,controls,laptop,layerMeshes,state};
