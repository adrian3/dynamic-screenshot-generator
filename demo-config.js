export const layerOrder=['background','middleground','middleForeground','foreground'];
export const layerNames=['Background','Middle Ground','Middle Foreground','Foreground'];
export const animationPresets=['sway','tour','fly-in','inversion'];

export const controlSpecs={
  scene:[['perspective','Perspective',25,60,1],['rotateX','Rotate X',0,70,1],['rotateY','Rotate Y',-90,90,1],['rotateZ','Roll (Z)',-20,20,1],['scale','Scale',.65,1.65,.01]],
  laptop:[['lidAngle','Lid angle',90,125,1],['x','X',-1.5,1.5,.01],['y','Y',-.2,1,.01],['z','Z',-1,1,.01],['scale','Scale',.65,1.3,.01]],
  desktop:[['tilt','Screen tilt',-5,20,1],['x','X',-1.5,1.5,.01],['y','Y',-.2,1,.01],['z','Z',-1,1,.01],['scale','Scale',.65,1.3,.01]],
  animation:[['angle','Intensity',0,15,.1],['speed','Speed',3000,20000,250],['duration','Duration (ms)',12000,90000,1000],['depth','Z Depth',0,2.5,.01]],
  layer:[['x','X',-1,1,.01],['y','Y',-1,1,.01],['z','Depth',0,1.5,.01],['rotateX','Rotate X',-30,30,1],['rotateY','Rotate Y',-30,30,1],['rotateZ','Roll (Z)',-30,30,1],['scale','Scale',.5,1.5,.01],['opacity','Opacity',0,100,1]]
};

export function isRecord(value) {
  return value!==null&&typeof value==='object'&&!Array.isArray(value);
}

export function defaultSettings() {
  return {
    canvas:{grid:true,shadows:true,background:0,panelCollapsed:false,highQuality:false},
    device:'laptop',
    scene:{perspective:38,rotateX:24,rotateY:-28,rotateZ:0,scale:1},
    laptop:{visible:true,x:0,y:0,z:0,scale:1,lidAngle:105,finish:'gray',bodyColor:'#4f5560',screenColor:'#e8f3f0'},
    desktop:{visible:true,x:0,y:0,z:0,scale:1,tilt:7,finish:'silver',bodyColor:'#c4c7cc'},
    animation:{enabled:true,preset:'sway',axis:'y',angle:4.5,speed:9000,duration:12000,depth:1.2,time:0},
    layers:Object.fromEntries(layerOrder.map((key,index)=>[key,{x:0,y:0,z:index*.22,rotateX:0,rotateY:0,rotateZ:0,scale:1,opacity:100}]))
  };
}

// Only known editor fields from demo JSON or clipboard captures reach rendering.
export function normalizeSettings(input,base=defaultSettings()) {
  const result=structuredClone(base);
  if(!isRecord(input))return result;
  const number=(source,target,key,min,max)=>{if(typeof source?.[key]==='number'&&Number.isFinite(source[key]))target[key]=Math.min(max,Math.max(min,source[key]));};
  const boolean=(source,target,key)=>{if(typeof source?.[key]==='boolean')target[key]=source[key];};
  const choice=(source,target,key,options)=>{if(options.includes(source?.[key]))target[key]=source[key];};
  const color=(source,target,key)=>{if(typeof source?.[key]==='string'&&/^#[0-9a-f]{6}$/i.test(source[key]))target[key]=source[key].toLowerCase();};
  for(const group of ['scene','laptop','desktop','animation'])if(isRecord(input[group]))for(const [key,,min,max] of controlSpecs[group])number(input[group],result[group],key,min,max);
  if(isRecord(input.layers))for(const key of layerOrder)if(isRecord(input.layers[key]))for(const [field,,min,max] of controlSpecs.layer)number(input.layers[key],result.layers[key],field,min,max);
  if(isRecord(input.canvas)){
    for(const key of ['grid','shadows','panelCollapsed','highQuality'])boolean(input.canvas,result.canvas,key);
    number(input.canvas,result.canvas,'background',0,100);
  }
  for(const group of ['laptop','desktop'])if(isRecord(input[group])){
    const source=input[group],target=result[group];
    const hasBodyColor=typeof source.bodyColor==='string'&&/^#[0-9a-f]{6}$/i.test(source.bodyColor);
    boolean(source,target,'visible');choice(source,target,'finish',['gray','silver','custom']);
    if(['gray','silver'].includes(source.finish)&&!hasBodyColor)target.bodyColor=source.finish==='gray'?'#4f5560':'#c4c7cc';
    color(source,target,'bodyColor');
    if(hasBodyColor&&!['gray','silver','custom'].includes(source.finish))target.finish='custom';
  }
  if(isRecord(input.laptop))color(input.laptop,result.laptop,'screenColor');
  choice(input,result,'device',['laptop','desktop']);
  if(isRecord(input.animation)){
    boolean(input.animation,result.animation,'enabled');choice(input.animation,result.animation,'axis',['x','y','z']);
    choice(input.animation,result.animation,'preset',animationPresets);
    number(input.animation,result.animation,'time',0,Number.MAX_SAFE_INTEGER);
  }
  return result;
}

export function parseDemoConfig(value,{reducedMotion=false}={}) {
  if(!isRecord(value)||value.version!==1)throw new Error('demo.json must use version 1.');
  const settings=normalizeSettings(value),files={};
  if(reducedMotion)settings.animation.enabled=false;
  for(const key of layerOrder){
    const file=value.layers?.[key]?.file;
    if(file===undefined)continue;
    if(typeof file!=='string'||!file.toLowerCase().endsWith('.svg')||/[\\/]/.test(file)||file.trim()!==file)throw new Error(`Invalid SVG filename for ${key}.`);
    files[key]=file;
  }
  return {settings,files};
}

export function demoConfigFromState(state,files) {
  const settings=normalizeSettings(state);
  for(const key of layerOrder)settings.layers[key]={file:files[key],...settings.layers[key]};
  return {version:1,...settings};
}
