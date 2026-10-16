import * as THREE from 'three';
import { OrbitControls } from './vendor/three/OrbitControls.js';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';
import { createLaptop, SCREEN_WIDTH } from './laptop.js';
import { createDesktop } from './desktop.js';
import { icon } from './icons.js';
import { layerOrder, layerNames, controlSpecs as specs, defaultSettings, normalizeSettings, parseDemoConfig } from './demo-config.js';
import { CAMERA_DISTANCE, FLY_IN_DURATION, PRESET_TRANSITION_DURATION, transitionWeight, blendCameraPose, flyInPose, isCameraTour, cameraStartPose, sampleCameraPose, sampleFlyIn, sampleInversion, snapshotCamera, captureDemoConfig } from './camera-motion.js';
import { loadPreferences, savePreferences, clearPreferences } from './editor-preferences.js';

const isLocalHost=['localhost','127.0.0.1','[::1]'].includes(location.hostname)||location.hostname.endsWith('.localhost');
const MIN_ELEVATION=0;
const MAX_ELEVATION=70;
const layerColors=['#2d7f86','#7c9a5f','#c78457','#9a729d'];
let builtInSets=[];
const viewport=document.getElementById('viewport');
const renderStatus=document.getElementById('renderStatus');
const root=document.documentElement;
document.getElementById('localAssetActions').hidden=!isLocalHost;
document.querySelector('label[for="assetSetSelect"]').textContent=isLocalHost?'Folder':'Demo';
let state;
let assetSets=[];
let serverSets=[];
let localSets=[];
let folderHandle=null;
let localUrls=[];
let assetVersion=0;
let interacting=false;
let applyingCamera=false;
let needsRender=true;
let elapsed=0;
let entranceElapsed=0;
let presetTransition=null;
let preferences=loadPreferences();
let activeSet=null;
let activeLayerFiles={};
let demoBaseSettings=null;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;

function defaults() {
  const settings=defaultSettings();settings.animation.enabled=!reducedMotion;settings.canvas.assetSet='';return settings;
}

function rememberSelections() {
  preferences={assetSet:state.canvas.assetSet,animationPreset:state.animation.preset};
  savePreferences(preferences);
}
state=defaults();state.canvas.assetSet=preferences.assetSet;

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
renderer.shadowMap.type=THREE.VSMShadowMap;
renderer.shadowMap.autoUpdate=false;
renderer.domElement.id='sceneCanvas';
renderer.domElement.setAttribute('aria-label','3D computer and layered screenshots');
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
keyLight.shadow.mapSize.set(1024,1024);keyLight.shadow.radius=18;keyLight.shadow.blurSamples=16;
keyLight.shadow.camera.left=-5;keyLight.shadow.camera.right=5;keyLight.shadow.camera.top=5;keyLight.shadow.camera.bottom=-5;
keyLight.shadow.camera.near=.1;keyLight.shadow.camera.far=20;keyLight.shadow.bias=-.0003;keyLight.shadow.normalBias=.01;
scene.add(keyLight);
const fillLight=new THREE.DirectionalLight('#dcecff',2);fillLight.position.set(5,3,1);scene.add(fillLight);
const rimLight=new THREE.DirectionalLight('#ffffff',2);rimLight.position.set(1,5,-5);scene.add(rimLight);

const laptop=createLaptop();scene.add(laptop.group);
const desktop=createDesktop();scene.add(desktop.group);
const devices={laptop,desktop};
// Capture hardware materials before attaching screenshot layers; those must not fade with the device.
const deviceMaterials=new Map();
for(const device of Object.values(devices))device.group.traverse(object=>{
  for(const material of [object.material].flat().filter(Boolean))if(!deviceMaterials.has(material))deviceMaterials.set(material,{opacity:material.opacity,transparent:material.transparent});
});
let deviceOpacity=1;
const layerMeshes=layerOrder.map((key,index)=>{
  const material=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,alphaTest:.005,side:THREE.FrontSide,toneMapped:false});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_WIDTH,SCREEN_WIDTH*1037/1920),material);
  mesh.name=layerNames[index];mesh.renderOrder=index+2;mesh.visible=false;laptop.screenAnchor.add(mesh);return mesh;
});
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.14}));
ground.rotation.x=-Math.PI/2;ground.position.y=-.015;ground.receiveShadow=true;scene.add(ground);
const grid=new THREE.GridHelper(16,64,'#a8bbc0','#d9e2e5');grid.position.y=-.012;
grid.material.transparent=true;grid.material.opacity=.26;grid.material.depthWrite=false;scene.add(grid);

function target(group,path){return path?state[group][path]:state[group];}
function makeControl(group,[key,label,min,max,step],path) {
  const row=document.createElement('div');row.className='control';
  if(group==='animation'&&['speed','duration'].includes(key))row.classList.add('wide-value');
  const id=`${group}-${path?`${path}-`:''}${key}`;
  const text=document.createElement('label');text.htmlFor=id;text.textContent=label;
  const range=document.createElement('input');range.type='range';range.id=id;
  const number=document.createElement('input');number.type='number';number.id=`${id}-value`;number.setAttribute('aria-label',`${label} value`);
  for(const input of [range,number]){input.min=min;input.max=max;input.step=step;input.value=target(group,path)[key];input.dataset.group=group;input.dataset.key=key;if(path)input.dataset.path=path;}
  const update=value=>{
    if(!Number.isFinite(Number(value))||value==='')return;
    const next=THREE.MathUtils.clamp(Number(value),min,max);
    if(group==='animation'&&((key==='speed'&&['sway','fly-in'].includes(state.animation.preset))||(key==='duration'&&isCameraTour(state.animation.preset))))elapsed*=next/target(group,path)[key];
    target(group,path)[key]=next;range.value=next;number.value=next;
    applyState();
  };
  range.addEventListener('input',()=>update(range.value));number.addEventListener('input',()=>update(number.value));
  row.append(text,range,number);return row;
}

function renderControls() {
  for(const group of ['scene','laptop','desktop','animation'])document.getElementById(`${group}Controls`).replaceChildren(...specs[group].map(spec=>makeControl(group,spec)));
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
  document.getElementById('canvasShadow').checked=state.canvas.shadows;
  document.getElementById('canvasBg').value=state.canvas.background;
  document.getElementById('bodyColor').value=state[state.device].bodyColor;
  document.getElementById('screenColor').value=state.laptop.screenColor;
  document.getElementById('deviceSelect').value=state.device;
  document.getElementById('deviceVisible').checked=state[state.device].visible;
  document.getElementById('laptopControls').hidden=state.device!=='laptop';
  document.getElementById('desktopControls').hidden=state.device!=='desktop';
  document.getElementById('highQuality').checked=state.canvas.highQuality;
  document.getElementById('animationAxis').value=state.animation.axis;
  document.getElementById('animationPreset').value=state.animation.preset;
  const tour=isCameraTour(state.animation.preset),fly=state.animation.preset==='fly-in',sway=state.animation.preset==='sway'||fly;
  document.getElementById('swayAxisRow').hidden=!sway;
  for(const key of ['angle','speed','duration'])document.getElementById(`animation-${key}`).closest('.control').hidden=key==='duration'?!tour:!sway;
  const playing=state.animation.enabled;
  const play=document.getElementById('animationToggle');play.querySelector('[data-icon]').replaceChildren(icon(playing?'Pause':'Play'));
  document.getElementById('animationLabel').textContent=playing?'Pause':'Play';
  play.setAttribute('aria-pressed',playing);play.setAttribute('aria-label',playing?'Pause animation':'Play animation');
  document.getElementById('replayEntrance').hidden=!fly;
  const panel=document.getElementById('panelToggle');panel.replaceChildren(icon(state.canvas.panelCollapsed?'PanelRightOpen':'PanelRightClose'));
  panel.setAttribute('aria-expanded',!state.canvas.panelCollapsed);panel.title=state.canvas.panelCollapsed?'Expand controls':'Collapse controls';panel.setAttribute('aria-label',panel.title);
  const inverting=state.animation.preset==='inversion';
  document.getElementById('bodyColor').disabled=inverting;
  document.getElementById('bodyColor').title=inverting?'Body color follows Inversion':'Display body color';
  document.querySelectorAll('[data-finish]').forEach(button=>{
    button.disabled=inverting;button.setAttribute('aria-pressed',!inverting&&button.dataset.finish===state[state.device].finish);
  });
}

function resize() {
  const {width,height}=viewport.getBoundingClientRect();
  if(width<=0||height<=0)return;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,state.canvas.highQuality?2:1.5));renderer.setSize(width,height,false);
  camera.aspect=width/height;camera.updateProjectionMatrix();needsRender=true;
}

function applyState() {
  document.getElementById('app').classList.toggle('panel-collapsed',state.canvas.panelCollapsed);
  const shade=Math.round(255-state.canvas.background*2.55);
  root.style.setProperty('--canvas-color',`rgb(${shade},${shade},${shade})`);root.style.setProperty('--canvas-ink',shade<128?'#e6edf1':'#20272d');
  grid.visible=state.canvas.grid;grid.material.color.set(shade<128?'#687780':'#d0dadd');
  if(renderer.shadowMap.enabled!==state.canvas.shadows){
    renderer.shadowMap.enabled=state.canvas.shadows;
    scene.traverse(object=>{for(const material of [object.material].flat().filter(Boolean))material.needsUpdate=true;});
  }
  ground.visible=state.canvas.shadows;
  laptop.update(state.laptop);
  desktop.update({...state.desktop,screenColor:state.laptop.screenColor});
  if(presetTransition)for(const entry of presetTransition.materials)entry.targetColor.copy(entry.material.color);
  laptop.group.visible=state.device==='laptop';desktop.group.visible=state.device==='desktop';
  controls.target.set(0,state.device==='desktop'?1.25:1.05,.05);
  const screenAnchor=devices[state.device].screenAnchor;
  layerMeshes.forEach((mesh,index)=>{
    if(mesh.parent!==screenAnchor)screenAnchor.add(mesh);
    const values=state.layers[layerOrder[index]];
    mesh.position.set(values.x,values.y,.003+index*.0005+values.z*state.animation.depth);
    mesh.rotation.set(THREE.MathUtils.degToRad(values.rotateX),THREE.MathUtils.degToRad(values.rotateY),THREE.MathUtils.degToRad(values.rotateZ));
    mesh.scale.setScalar(values.scale);mesh.material.opacity=values.opacity/100;
  });
  camera.fov=state.scene.perspective;camera.updateProjectionMatrix();
  syncControls();resize();renderer.shadowMap.needsUpdate=state.canvas.shadows;needsRender=true;
  state.animation.time=elapsed;
}

function startAnimation(preset,{fromDemo=false}={}) {
  cancelPresetTransition();
  const enabled=state.animation.enabled;
  state.scene=structuredClone(demoBaseSettings?.scene||defaults().scene);
  state.animation=structuredClone(demoBaseSettings?.animation||defaults().animation);
  state.animation.preset=preset;state.animation.enabled=enabled;
  if(!fromDemo){
    if(isCameraTour(preset))state.scene=cameraStartPose(preset,state.device);
    if(preset==='inversion')state.animation.depth=2.5;
    if(preset==='fly-in')state.scene={...flyInPose};
  }
  elapsed=0;entranceElapsed=preset==='fly-in'&&!enabled?FLY_IN_DURATION:0;
  state.animation.time=elapsed;
}

function cancelPresetTransition() {
  presetTransition=null;deviceOpacity=-1;
}

function capturePresetTransition() {
  return {
    time:0,cameraActive:true,blendMaterials:true,camera:snapshotCamera(camera,controls.target),groundOpacity:ground.material.opacity,
    layers:layerMeshes.map(mesh=>({z:mesh.position.z,scale:mesh.scale.x})),
    materials:[...deviceMaterials.keys()].map(material=>({material,color:material.color.clone(),opacity:material.opacity}))
  };
}

function beginPresetTransition(from) {
  if(!from||!state.animation.enabled||reducedMotion)return;
  for(const entry of from.materials)entry.targetColor=entry.material.color.clone();
  presetTransition=from;
}

function blendAppearance(weight) {
  if(presetTransition.blendMaterials)ground.material.opacity=THREE.MathUtils.lerp(presetTransition.groundOpacity,ground.material.opacity,weight);
  layerMeshes.forEach((mesh,index)=>{
    const from=presetTransition.layers[index];
    mesh.position.z=THREE.MathUtils.lerp(from.z,mesh.position.z,weight);
    mesh.scale.setScalar(THREE.MathUtils.lerp(from.scale,mesh.scale.x,weight));
  });
  if(!presetTransition.blendMaterials)return;
  for(const {material,color,opacity} of presetTransition.materials){
    material.color.lerp(color,1-weight);material.opacity=THREE.MathUtils.lerp(opacity,material.opacity,weight);
    const transparent=deviceMaterials.get(material).transparent||material.opacity<1;
    if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}
  }
}

function applyCameraRoll(roll=sampleCameraPose(state.scene,state.animation,elapsed).rotateZ) {
  camera.rotateZ(THREE.MathUtils.degToRad(roll));
}

function applyEntrance() {
  const fly=state.animation.preset==='fly-in';
  const opacity=fly?sampleFlyIn(entranceElapsed).deviceOpacity:1;
  if(opacity!==deviceOpacity||presetTransition){
    for(const [material,base] of deviceMaterials){
      material.opacity=base.opacity*opacity;
      const fadingFrom=presetTransition?.blendMaterials&&presetTransition.materials.find(entry=>entry.material===material).opacity<1;
      const transparent=base.transparent||opacity<1||fadingFrom;
      if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}
    }
    deviceOpacity=opacity;
  }
  ground.material.opacity=.14*opacity;
  layerMeshes.forEach((mesh,index)=>{
    const values=state.layers[layerOrder[index]],motion=fly?sampleFlyIn(entranceElapsed,index):{depthOffset:0,scale:1};
    mesh.position.z=.003+index*.0005+values.z*state.animation.depth+motion.depthOffset;
    mesh.scale.setScalar(values.scale*motion.scale);
  });
}

function cameraFromState(pose=sampleCameraPose(state.scene,state.animation,elapsed)) {
  const angle=THREE.MathUtils.degToRad(pose.rotateY),phi=THREE.MathUtils.degToRad(90-pose.rotateX);
  const aspectFit=camera.aspect<1?1/camera.aspect:1;
  const distance=CAMERA_DISTANCE/pose.scale*aspectFit;
  controls.minDistance=CAMERA_DISTANCE/1.65*aspectFit;controls.maxDistance=CAMERA_DISTANCE/.65*aspectFit;
  if(camera.fov!==pose.perspective){camera.fov=pose.perspective;camera.updateProjectionMatrix();}
  camera.position.setFromSpherical(new THREE.Spherical(distance,phi,angle)).add(controls.target);
  applyingCamera=true;controls.update();applyingCamera=false;
  applyCameraRoll(pose.rotateZ);
}

function applyInversion(yaw) {
  if(state.animation.preset!=='inversion')return;
  yaw??=THREE.MathUtils.radToDeg(Math.atan2(camera.position.x-controls.target.x,camera.position.z-controls.target.z));
  const color=devices[state.device].setFinishBlend(sampleInversion(yaw));
  document.getElementById('bodyColor').value=`#${color.getHexString()}`;
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

controls.addEventListener('start',()=>{
  if(isCameraTour(state.animation.preset)||presetTransition){
    const pose=snapshotCamera(camera,controls.target);
    for(const [key] of specs.scene)state.scene[key]=pose[key];
    elapsed=0;
  }
  if(presetTransition)presetTransition.cameraActive=false;
  interacting=true;readCamera();
  // Position captures X/Y motion; Z motion needs its existing roll phase.
  if(['sway','fly-in'].includes(state.animation.preset)&&state.animation.axis!=='z')elapsed=0;
});
controls.addEventListener('change',()=>{
  if(!applyingCamera){
    // OrbitControls resets roll when it updates the look-at orientation.
    applyCameraRoll();readCamera();state.animation.time=elapsed;
  }
});
controls.addEventListener('end',()=>{interacting=false;readCamera();state.animation.time=elapsed;needsRender=true;});

function renderAssetOptions() {
  const byName=new Map();for(const set of [...builtInSets,...serverSets,...localSets])byName.set(set.name,set);
  if(activeSet&&!byName.has(activeSet.name))byName.set(activeSet.name,activeSet);
  assetSets=[...byName.values()];
  if(!assetSets.some(set=>set.name===state.canvas.assetSet))state.canvas.assetSet=assetSets[0]?.name||'';
  const select=document.getElementById('assetSetSelect');
  select.replaceChildren(...assetSets.map(set=>{const option=document.createElement('option');option.value=set.name;option.textContent=set.name;return option;}));
  select.value=state.canvas.assetSet;
}

function serverSet(name,base,source='server',files=null) {
  const layers=files?mapFiles(files):layerOrder.map((key,index)=>({key,name:`${layerNames[index]}.svg`,url:new URL(`${encodeURIComponent(layerNames[index])}.svg`,base).href}));
  return {name,source,base,files,layers,configUrl:new URL('demo.json',base).href};
}

async function loadPublishedSets() {
  const response=await fetch('assets/demos.json',{cache:'no-store'});
  if(!response.ok)throw new Error('Could not load assets/demos.json.');
  const names=await response.json();
  if(!Array.isArray(names)||!names.length||names.some(name=>typeof name!=='string'||!name.trim()||name==='.'||name==='..'||/[\\/]/.test(name)))throw new Error('assets/demos.json must list demo folder names.');
  const base=new URL('assets/',location.href);
  builtInSets=[...new Set(names)].map(name=>serverSet(name,new URL(`${encodeURIComponent(name)}/`,base),'built-in'));
}

async function configurationFor(set) {
  let value=null,warning='';
  try{
    if(set.handle){
      try{value=JSON.parse(await (await (await set.handle.getFileHandle('demo.json')).getFile()).text());}
      catch(error){if(error.name!=='NotFoundError')throw error;}
    }else{
      const response=await fetch(set.configUrl,{cache:'no-store'});
      if(response.ok)value=await response.json();else if(response.status!==404)throw new Error('Could not read demo.json.');
    }
    const config=value===null?{settings:defaults(),files:{}}:parseDemoConfig(value,{reducedMotion});
    return {...config,warning};
  }catch(error){
    warning=`Using default settings: ${error.message}`;
    return {settings:defaults(),files:{},warning,error:error.message};
  }
}

function configuredLayers(set,files) {
  return layerOrder.map(key=>{
    const file=files[key];
    if(file!==undefined){
      if(set.handle){const selected=set.files.find(entry=>entry.name===file);if(!selected)throw new Error(`Missing ${file}.`);return {...selected,key};}
      return {key,name:file,url:new URL(encodeURIComponent(file),set.base).href};
    }
    const fallback=set.layers?.find(layer=>layer.key===key);
    if(!fallback)throw new Error('The demo needs four SVG layers.');
    return fallback;
  });
}

function demoActionsEnabled(enabled) {
  for(const id of ['copyDemo','resetDemo'])document.getElementById(id).disabled=!enabled;
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

async function loadAssetSet(name,{persist=true,restore=false}={}) {
  const set=assetSets.find(set=>set.name===name);if(!set)return;
  const version=++assetVersion;
  demoActionsEnabled(false);
  document.getElementById('assetStatus').textContent='Loading demo';
  const config=await configurationFor(set);
  if(version!==assetVersion)return;
  if(restore&&config.error){document.getElementById('assetStatus').textContent=`Could not restore defaults: ${config.error}`;demoActionsEnabled(Boolean(activeSet));return;}
  let layers;
  try{layers=configuredLayers(set,config.files);}
  catch(error){document.getElementById('assetStatus').textContent=error.message;document.getElementById('assetSetSelect').value=state.canvas.assetSet;demoActionsEnabled(Boolean(activeSet));return;}
  const results=await Promise.allSettled(layers.map(textureFromFile));
  const loaded=results.filter(result=>result.status==='fulfilled').map(result=>result.value);
  if(version!==assetVersion||loaded.length!==4){
    loaded.forEach(({texture})=>texture.dispose());
    if(version===assetVersion){document.getElementById('assetStatus').textContent='Could not load all four SVG layers.';document.getElementById('assetSetSelect').value=state.canvas.assetSet;demoActionsEnabled(Boolean(activeSet));}
    return;
  }
  // Commit settings and textures together, so a slow demo cannot replace a newer one.
  const playback=activeSet&&!restore?{animation:structuredClone(state.animation),elapsed,entranceElapsed}:null;
  const from=playback&&state.animation.enabled&&!reducedMotion?capturePresetTransition():null;
  demoBaseSettings=normalizeSettings(config.settings);
  state=structuredClone(demoBaseSettings);state.canvas.assetSet=name;
  const preset=playback?playback.animation.preset:restore?state.animation.preset:preferences.animationPreset||state.animation.preset;
  startAnimation(preset,{fromDemo:preset===demoBaseSettings.animation.preset});activeSet=set;
  if(playback){
    state.animation=playback.animation;elapsed=playback.elapsed;entranceElapsed=playback.entranceElapsed;
    state.animation.time=elapsed;
  }
  activeLayerFiles=Object.fromEntries(layers.map(layer=>[layer.key,layer.name]));
  results.forEach((result,index)=>{
    const {texture,ratio}=result.value;
    const mesh=layerMeshes[index];mesh.material.map?.dispose();mesh.geometry.dispose();
    mesh.geometry=new THREE.PlaneGeometry(SCREEN_WIDTH,SCREEN_WIDTH*ratio);mesh.material.map=texture;mesh.material.needsUpdate=true;mesh.visible=true;
  });
  applyState();
  if(from){from.blendMaterials=false;beginPresetTransition(from);}
  if(persist)rememberSelections();
  renderAssetOptions();
  document.getElementById('assetStatus').textContent=config.warning;
  demoActionsEnabled(true);
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
    for(const url of folders){const listing=await fetch(url,{cache:'no-store'});if(!listing.ok)continue;const files=directoryLinks(await listing.text(),url).filter(link=>link.pathname.startsWith(url.pathname)&&link.pathname.toLowerCase().endsWith('.svg')).map(link=>({name:decodeURIComponent(link.pathname.split('/').pop()),url:link.href}));if(files.length>=4)sets.push(serverSet(decodeURIComponent(url.pathname.split('/').at(-2)),url,'server',files));}
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
  const rootFiles=await filesInHandle(handle),rootLayers=mapFiles(rootFiles);if(rootLayers)sets.push({name:handle.name,source:'local',handle,files:rootFiles,layers:rootLayers});
  for await(const [name,entry] of handle.entries())if(entry.kind==='directory'){const files=await filesInHandle(entry),layers=mapFiles(files);if(layers)sets.push({name,source:'local',handle:entry,files,layers});}
  localSets=sets;renderAssetOptions();
  await loadAssetSet(sets[0]?.name||state.canvas.assetSet);
  document.getElementById('assetSetSelect').value=state.canvas.assetSet;
  if(activeSet?.files?.some(file=>oldUrls.includes(file.url)))localUrls.push(...oldUrls);
  else oldUrls.forEach(url=>URL.revokeObjectURL(url));
  if(!sets.length)document.getElementById('assetStatus').textContent='No folders with four SVG layers found.';
}

document.getElementById('assetSetSelect').addEventListener('change',event=>loadAssetSet(event.target.value));
document.getElementById('chooseAssetsFolder').addEventListener('click',async()=>{
  if(!window.showDirectoryPicker){document.getElementById('assetStatus').textContent='Folder selection requires Chrome or Edge.';return;}
  try{folderHandle=await window.showDirectoryPicker({mode:'read'});await scanLocal(folderHandle);}catch(error){if(error.name!=='AbortError')document.getElementById('assetStatus').textContent='Could not read that folder.';}
});
document.getElementById('rescanAssetsFolder').addEventListener('click',async()=>{if(folderHandle)await scanLocal(folderHandle);else {await scanServer();await loadAssetSet(state.canvas.assetSet);}});
document.getElementById('animationToggle').addEventListener('click',()=>{
  state.animation.enabled=!state.animation.enabled;
  applyState();
});
document.getElementById('replayEntrance').addEventListener('click',()=>{
  cancelPresetTransition();
  elapsed=0;entranceElapsed=0;state.animation.enabled=true;applyState();
});
document.getElementById('animationPreset').addEventListener('change',event=>{
  const from=activeSet&&!reducedMotion?capturePresetTransition():null;
  if(event.target.value==='fly-in')state.animation.enabled=!reducedMotion;
  startAnimation(event.target.value);applyState();
  beginPresetTransition(from);
  rememberSelections();
});
document.getElementById('animationAxis').addEventListener('change',event=>{state.animation.axis=event.target.value;applyState();});
document.getElementById('canvasGrid').addEventListener('change',event=>{state.canvas.grid=event.target.checked;applyState();});
document.getElementById('canvasShadow').addEventListener('change',event=>{state.canvas.shadows=event.target.checked;applyState();});
document.getElementById('canvasBg').addEventListener('input',event=>{state.canvas.background=Number(event.target.value);applyState();});
document.getElementById('screenColor').addEventListener('input',event=>{
  state.laptop.screenColor=event.target.value;
  applyState();
});
document.getElementById('bodyColor').addEventListener('input',event=>{state[state.device].bodyColor=event.target.value;state[state.device].finish='custom';applyState();});
document.querySelectorAll('[data-finish]').forEach(button=>button.addEventListener('click',()=>{state[state.device].finish=button.dataset.finish;state[state.device].bodyColor=button.dataset.finish==='gray'?'#4f5560':'#c4c7cc';applyState();}));
document.getElementById('deviceSelect').addEventListener('change',event=>{
  if(!Object.hasOwn(devices,event.target.value))return;
  cancelPresetTransition();
  state.device=event.target.value;
  if(isCameraTour(state.animation.preset)){state.scene=cameraStartPose(state.animation.preset,state.device);elapsed=0;}
  applyState();
});
document.getElementById('deviceVisible').addEventListener('change',event=>{state[state.device].visible=event.target.checked;applyState();});
document.getElementById('panelToggle').addEventListener('click',()=>{state.canvas.panelCollapsed=!state.canvas.panelCollapsed;applyState();});
document.getElementById('resetView').addEventListener('click',()=>{
  cancelPresetTransition();
  const tour=isCameraTour(state.animation.preset);
  const fly=state.animation.preset==='fly-in';
  state.scene=tour?cameraStartPose(state.animation.preset,state.device):fly?{...flyInPose}:structuredClone(demoBaseSettings?.scene||defaults().scene);
  if(state.animation.preset==='inversion')state.animation.depth=2.5;
  elapsed=tour||fly?0:demoBaseSettings?.animation.time||0;
  if(fly)entranceElapsed=FLY_IN_DURATION;
  applyState();
});
document.getElementById('openSettings').addEventListener('click',()=>document.getElementById('settingsModal').showModal());
document.getElementById('highQuality').addEventListener('change',event=>{state.canvas.highQuality=event.target.checked;applyState();});
document.getElementById('resetDemo').addEventListener('click',()=>loadAssetSet(state.canvas.assetSet,{restore:true}));
let copyFeedbackTimer;
document.getElementById('copyDemo').addEventListener('click',async()=>{
  if(!activeSet)return;
  const snapshot={...state,animation:{...state.animation,time:elapsed}};
  const capture=captureDemoConfig(snapshot,activeLayerFiles,camera,controls.target);
  if(state.animation.preset==='inversion')capture.capture.bodyColor=document.getElementById('bodyColor').value;
  const content=JSON.stringify(capture,null,2)+'\n';
  const button=document.getElementById('copyDemo'),status=document.getElementById('copyStatus');
  clearTimeout(copyFeedbackTimer);button.disabled=true;status.textContent='';
  button.replaceChildren(icon('Copy'));button.title='Copy scene JSON';button.setAttribute('aria-label','Copy scene JSON');
  try{
    if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(content);
    button.replaceChildren(icon('Check'));button.title='JSON copied';button.setAttribute('aria-label','JSON copied');status.textContent='Scene JSON copied';
  }catch{
    const field=document.getElementById('copyJSON');field.value=content;
    document.getElementById('copyFallback').showModal();field.focus();field.select();
    status.textContent='Clipboard unavailable. Scene JSON opened.';
  }finally{
    button.disabled=!activeSet;
    copyFeedbackTimer=setTimeout(()=>{button.replaceChildren(icon('Copy'));button.title='Copy scene JSON';button.setAttribute('aria-label','Copy scene JSON');status.textContent='';},2200);
  }
});
async function resetApp() {
  cancelPresetTransition();
  clearPreferences();preferences={assetSet:'',animationPreset:null};
  const previousUrls=localUrls;localUrls=[];localSets=[];folderHandle=null;
  activeSet=null;activeLayerFiles={};demoBaseSettings=null;
  state=defaults();elapsed=0;entranceElapsed=0;
  renderControls();renderAssetOptions();applyState();
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
  if(activeSet&&state.animation.enabled&&!interacting&&!document.hidden){
    elapsed+=delta;
    if(state.animation.preset==='fly-in')entranceElapsed=Math.min(FLY_IN_DURATION,entranceElapsed+delta);
    state.animation.time=elapsed;needsRender=true;
    if(presetTransition)presetTransition.time=Math.min(PRESET_TRANSITION_DURATION,presetTransition.time+delta);
  }
  if(needsRender){
    const pose=sampleCameraPose(state.scene,state.animation,elapsed),weight=transitionWeight(presetTransition?.time??PRESET_TRANSITION_DURATION);
    if(!interacting){
      const target=[0,state.device==='desktop'?1.25:1.05,.05];
      controls.target.fromArray(target.map((value,index)=>presetTransition?THREE.MathUtils.lerp(presetTransition.camera.target[index],value,weight):value));
      cameraFromState(presetTransition?.cameraActive?blendCameraPose(presetTransition.camera,pose,weight):pose);
    }
    if(presetTransition)for(const entry of presetTransition.materials)entry.material.color.copy(entry.targetColor);
    applyEntrance();applyInversion(presetTransition?.cameraActive?pose.rotateY:undefined);
    if(presetTransition)blendAppearance(weight);
    if(state.animation.preset==='inversion'&&presetTransition){
      const body=devices[state.device].group.getObjectByName(state.device==='laptop'?'Chassis':'Desktop shell');
      document.getElementById('bodyColor').value=`#${[body.material].flat()[0].color.getHexString()}`;
    }
    renderer.render(scene,camera);needsRender=false;
    if(presetTransition?.time===PRESET_TRANSITION_DURATION)presetTransition=null;
  }
}
renderControls();applyState();demoActionsEnabled(false);
requestAnimationFrame(frame);
try{await loadPublishedSets();}
catch(error){document.getElementById('assetStatus').textContent=error.message;}
await scanServer();renderAssetOptions();
if(state.canvas.assetSet)await loadAssetSet(state.canvas.assetSet);
else {renderStatus.textContent='No demos available.';renderStatus.classList.add('error');}

export {scene,camera,renderer,controls,laptop,desktop,layerMeshes,state};
