import * as THREE from 'three';
import {OrbitControls} from './vendor/three/OrbitControls.js';
import {RoomEnvironment} from './vendor/three/RoomEnvironment.js';
import {createLaptop,SCREEN_WIDTH} from './laptop.js';
import {createDesktop} from './desktop.js';
import {icon} from './icons.js';
import {blueprintPalette,blueprintSvg,createBlueprintDevice} from './blueprint-theme.js';

const stage=document.getElementById('stage'),status=document.getElementById('status');
document.querySelectorAll('[data-icon]').forEach(node=>node.replaceChildren(icon(node.dataset.icon)));
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const state={device:'laptop',blueprint:true,hiddenEdges:false,playing:!reducedMotion,depth:1.2};
const stats={ready:false,loadMs:0,drawCalls:0,triangles:0};
const started=performance.now();
const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
renderer.domElement.setAttribute('aria-label','Blueprint computer and exploded architectural drawing');stage.prepend(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,16/9,.05,60);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enablePan=false;controls.enableDamping=false;controls.minDistance=4.5;controls.maxDistance=10;
controls.minAzimuthAngle=-Math.PI/2;controls.maxAzimuthAngle=Math.PI/2;
controls.minPolarAngle=THREE.MathUtils.degToRad(20);controls.maxPolarAngle=Math.PI/2;
const environment=new RoomEnvironment(),generator=new THREE.PMREMGenerator(renderer),environmentTarget=generator.fromScene(environment,.04);
scene.environment=environmentTarget.texture;scene.environmentIntensity=.9;environment.dispose();generator.dispose();
scene.add(new THREE.HemisphereLight('#ffffff','#b7c7db',2));
const light=new THREE.DirectionalLight('#ffffff',3.2);light.position.set(-3,6,4);scene.add(light);
const devices={laptop:createLaptop(),desktop:createDesktop()};
const themes={};
for(const [name,device] of Object.entries(devices)){
  device.update({visible:true,x:0,y:0,z:0,scale:1,lidAngle:105,tilt:7,finish:'silver',bodyColor:'#c4c7cc',screenColor:blueprintPalette.paper});
  scene.add(device.group);themes[name]=createBlueprintDevice(device.group);
}
const layers=Array.from({length:4},(_,index)=>{
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_WIDTH,SCREEN_WIDTH*1037/1920),new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,alphaTest:.005,side:THREE.FrontSide,toneMapped:false}));
  mesh.renderOrder=4+index;return mesh;
});
let elapsed=0,previous=performance.now(),interacting=false,needsRender=true;
const pose={yaw:-28,elevation:23,distance:7.15};
let maps=[];
function sway(){return Math.sin(elapsed/9000*Math.PI*2)*3;}
function updateCamera(){
  camera.position.setFromSpherical(new THREE.Spherical(pose.distance,THREE.MathUtils.degToRad(90-pose.elevation),THREE.MathUtils.degToRad(pose.yaw+sway()))).add(controls.target);
  controls.update();
}
function resetCamera(){
  pose.yaw=-28;pose.elevation=state.device==='desktop'?19:23;pose.distance=state.device==='desktop'?7.35:7.15;
  elapsed=0;controls.target.set(0,state.device==='desktop'?1.25:1.02,.05);updateCamera();needsRender=true;
}
function resize(){
  const {width,height}=stage.getBoundingClientRect();if(!width||!height)return;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,innerWidth<=640?1.25:1.5));renderer.setSize(width,height,false);
  camera.aspect=width/height;camera.updateProjectionMatrix();needsRender=true;
}
function apply(){
  document.documentElement.dataset.mode=state.blueprint?'blueprint':'original';
  document.getElementById('blueprintMode').setAttribute('aria-pressed',state.blueprint);
  document.getElementById('originalMode').setAttribute('aria-pressed',!state.blueprint);
  document.getElementById('hiddenEdges').disabled=!state.blueprint;
  for(const [name,device] of Object.entries(devices)){
    device.group.visible=name===state.device;themes[name].setEnabled(state.blueprint);themes[name].setHiddenEdges(state.hiddenEdges);
    device.screen.material.color.set(state.blueprint?blueprintPalette.paper:'#eaf0f2');
  }
  layers.forEach((mesh,index)=>{
    devices[state.device].screenAnchor.add(mesh);mesh.position.set(0,0,.004+index*.22*state.depth);
    mesh.material.map=maps[index]?.[state.blueprint?'blueprint':'original']||null;mesh.material.needsUpdate=true;
  });
  const play=document.getElementById('play');play.replaceChildren(icon(state.playing?'Pause':'Play'));play.setAttribute('aria-pressed',state.playing);play.title=state.playing?'Pause animation':'Play animation';play.setAttribute('aria-label',play.title);
  document.getElementById('depthValue').value=state.depth.toFixed(2);needsRender=true;
}
async function texture(svg){
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),image=new Image();
  try{
    image.src=url;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=innerWidth<=640?1280:1920;canvas.height=Math.round(canvas.width*1037/1920);
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return texture;
  }finally{URL.revokeObjectURL(url);}
}
controls.addEventListener('start',()=>{interacting=true;});
controls.addEventListener('change',()=>{needsRender=true;});
controls.addEventListener('end',()=>{
  const spherical=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  pose.yaw=THREE.MathUtils.radToDeg(spherical.theta)-sway();pose.elevation=90-THREE.MathUtils.radToDeg(spherical.phi);pose.distance=spherical.radius;
  interacting=false;needsRender=true;
});
document.getElementById('device').addEventListener('change',event=>{state.device=event.target.value;apply();resetCamera();});
document.getElementById('blueprintMode').addEventListener('click',()=>{state.blueprint=true;apply();});
document.getElementById('originalMode').addEventListener('click',()=>{state.blueprint=false;apply();});
document.getElementById('hiddenEdges').addEventListener('change',event=>{state.hiddenEdges=event.target.checked;apply();});
document.getElementById('grid').addEventListener('change',event=>{stage.classList.toggle('grid',event.target.checked);});
document.getElementById('depth').addEventListener('input',event=>{state.depth=Number(event.target.value);apply();});
document.getElementById('play').addEventListener('click',()=>{state.playing=!state.playing;apply();});
document.getElementById('resetCamera').addEventListener('click',resetCamera);
new ResizeObserver(resize).observe(stage);
document.addEventListener('visibilitychange',()=>{previous=performance.now();needsRender=true;});
renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();status.hidden=false;status.textContent='Rendering interrupted. Reload the study.';});
function frame(now){
  requestAnimationFrame(frame);const delta=Math.min(now-previous,50);previous=now;
  if(stats.ready&&state.playing&&!interacting&&!document.hidden){elapsed+=delta;needsRender=true;}
  if(!needsRender)return;
  if(!interacting)updateCamera();
  renderer.render(scene,camera);stats.drawCalls=renderer.info.render.calls;stats.triangles=renderer.info.render.triangles;needsRender=false;
}
apply();resetCamera();resize();requestAnimationFrame(frame);
try{
  maps=await Promise.all(['Background','Middle Ground','Middle Foreground','Foreground'].map(async name=>{
    const response=await fetch(`assets/Architecture%20demo/${encodeURIComponent(name)}.svg`);if(!response.ok)throw new Error('The source drawing could not be loaded.');
    const svg=await response.text();const [original,blueprint]=await Promise.all([texture(svg),texture(blueprintSvg(svg))]);return {original,blueprint};
  }));
  apply();stats.ready=true;stats.loadMs=Math.round(performance.now()-started);status.hidden=true;stage.dataset.ready='true';
  for(const id of ['play','resetCamera'])document.getElementById(id).disabled=false;
}catch(error){status.textContent=error.message;console.error(error);}
window.blueprintStudy={scene,camera,renderer,controls,devices,layers,themes,state,stats};
