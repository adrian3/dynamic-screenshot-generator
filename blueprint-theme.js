import * as THREE from './vendor/three/three.core.js';

export const blueprintPalette=Object.freeze({paper:'#123e96',ink:'#d5f2ff',secondary:'#7cbbef',grid:'#a6d8ff'});

export function instanceEdges(mesh,edges){
  const source=edges.getAttribute('position');
  const positions=new Float32Array(source.count*mesh.count*3);
  const matrix=new THREE.Matrix4(),point=new THREE.Vector3();
  for(let instance=0;instance<mesh.count;instance++){
    mesh.getMatrixAt(instance,matrix);
    for(let vertex=0;vertex<source.count;vertex++){
      point.fromBufferAttribute(source,vertex).applyMatrix4(matrix);
      point.toArray(positions,(instance*source.count+vertex)*3);
    }
  }
  return new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(positions,3));
}

export function renderAppearance(settings,hasRaster=false){
  const blueprint=settings.appearance?.style==='blueprint';
  const convertScreens=blueprint&&settings.appearance.blueprintScreens&&!hasRaster;
  return {blueprint,convertScreens,background:blueprint?blueprintPalette.paper:settings.canvas.background,shadows:!blueprint&&settings.canvas.shadows,screenColor:convertScreens?blueprintPalette.paper:settings.laptop.screenColor};
}

export function createBlueprintDevice(root,{exclude=[]}={}){
  const surfaces=[],strokes=[],geometries=new Set(),cache=new Map();
  const paper=new THREE.MeshBasicMaterial({color:blueprintPalette.paper,toneMapped:false,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
  const mainLine=new THREE.LineBasicMaterial({color:blueprintPalette.ink,transparent:true,opacity:.88,depthWrite:false,toneMapped:false});
  const fineLine=new THREE.LineBasicMaterial({color:blueprintPalette.ink,transparent:true,opacity:.53,depthWrite:false,toneMapped:false});
  const hiddenLine=new THREE.LineDashedMaterial({color:blueprintPalette.secondary,transparent:true,opacity:.12,depthTest:false,depthWrite:false,toneMapped:false,dashSize:.025,gapSize:.02});
  const ignored=new Set(exclude),meshes=[];root.traverse(object=>{if(object.isMesh&&!ignored.has(object))meshes.push(object);});
  let enabled=false,hidden=false,screenBlueprint=true;
  for(const mesh of meshes){
    const legend=mesh.name==='Keyboard legends';
    surfaces.push({mesh,material:mesh.material,visible:mesh.visible,legend,screen:mesh.name==='Screen'||mesh.name==='Desktop screen'});
    if(legend||mesh.name==='Screen'||mesh.name==='Desktop screen'||(mesh.isInstancedMesh&&mesh.name!=='Keyboard keys'))continue;
    let edges=cache.get(mesh.geometry);
    if(!edges){
      if(mesh.name==='Keyboard keys'){
        // Drafting proxies avoid tracing every bevel on tiny repeated keycaps.
        const {width,height,depth}=mesh.geometry.parameters;
        const proxy=new THREE.BoxGeometry(width,height,depth);edges=new THREE.EdgesGeometry(proxy);proxy.dispose();
      }else edges=new THREE.EdgesGeometry(mesh.geometry,mesh.geometry.type==='RoundedBoxGeometry'?8:28);
      cache.set(mesh.geometry,edges);geometries.add(edges);
    }
    if(mesh.isInstancedMesh){edges=instanceEdges(mesh,edges);geometries.add(edges);}
    const primary=/Chassis|shell|Bezel|bezel|stem|base|Trackpad/.test(mesh.name);
    const visible=new THREE.LineSegments(edges,primary?mainLine:fineLine);
    visible.name='Blueprint visible edges';visible.renderOrder=2;visible.visible=false;
    const ghost=new THREE.LineSegments(edges,hiddenLine);ghost.computeLineDistances();
    ghost.name='Blueprint hidden edges';ghost.renderOrder=1;ghost.visible=false;
    mesh.add(visible,ghost);strokes.push({visible,ghost});
  }
  function setEnabled(value){
    const next=Boolean(value);
    for(const entry of surfaces){
      entry.mesh.material=next&&!entry.legend&&(!entry.screen||screenBlueprint)?paper:entry.material;
      if(entry.legend){
        if(next&&!enabled)entry.visible=entry.mesh.visible;
        if(next)entry.mesh.visible=false;
        else if(enabled)entry.mesh.visible=entry.visible;
      }
    }
    enabled=next;
    for(const stroke of strokes){stroke.visible.visible=enabled;stroke.ghost.visible=enabled&&hidden;}
  }
  function setHiddenEdges(value){hidden=Boolean(value);for(const stroke of strokes)stroke.ghost.visible=enabled&&hidden;}
  function setScreenBlueprint(value){screenBlueprint=Boolean(value);}
  function syncOpacity(){
    const source=[surfaces[0]?.material].flat()[0];
    const opacity=source?.opacity??1;
    paper.opacity=opacity;
    if(paper.transparent!==(opacity<1)){paper.transparent=opacity<1;paper.needsUpdate=true;}
    mainLine.opacity=.88*opacity;fineLine.opacity=.53*opacity;hiddenLine.opacity=.12*opacity;
  }
  function dispose(){
    setEnabled(false);
    for(const stroke of strokes){stroke.visible.removeFromParent();stroke.ghost.removeFromParent();}
    for(const geometry of geometries)geometry.dispose();
    for(const material of [paper,mainLine,fineLine,hiddenLine])material.dispose();
  }
  return {setEnabled,setHiddenEdges,setScreenBlueprint,syncOpacity,dispose,stats:{meshes:meshes.length,lineObjects:strokes.length,segments:strokes.reduce((sum,stroke)=>sum+stroke.visible.geometry.getAttribute('position').count/2,0)}};
}

export function inspectSvg(source){
  const document=new DOMParser().parseFromString(source,'image/svg+xml');
  if(document.querySelector('parsererror'))throw new Error('The source drawing is not valid SVG.');
  const rectangles=[...document.querySelectorAll('rect[fill]')].filter(rect=>!rect.closest('defs')&&!rect.getAttribute('fill').startsWith('url('));
  const largest=rectangles.sort((a,b)=>Number(b.getAttribute('width'))*Number(b.getAttribute('height'))-Number(a.getAttribute('width'))*Number(a.getAttribute('height')))[0];
  const color=new THREE.Color(largest?.getAttribute('fill')||'#ffffff');
  return {raster:Boolean(document.querySelector('image,foreignObject')),darkBackground:.2126*color.r+.7152*color.g+.0722*color.b<.18};
}

export function blueprintSvg(source,{darkBackground=false}={}){
  const document=new DOMParser().parseFromString(source,'image/svg+xml');
  if(document.querySelector('parsererror'))throw new Error('The source drawing is not valid SVG.');
  const color=new THREE.Color();
  for(const element of document.querySelectorAll('*')){
    // Mask colors encode visibility and must never be treated as artwork colors.
    if(element.closest('mask,clipPath'))continue;
    for(const attribute of ['fill','stroke']){
      const value=element.style.getPropertyValue(attribute)||element.getAttribute(attribute);
      if(!value||value==='none'||value.startsWith('url('))continue;
      color.set(value);
      const brightness=.2126*color.r+.7152*color.g+.0722*color.b;
      if(attribute==='stroke'){
        if(element.style.getPropertyValue(attribute))element.style.setProperty(attribute,blueprintPalette.ink);
        else element.setAttribute(attribute,blueprintPalette.ink);
        if(darkBackground&&Number(element.getAttribute('stroke-width'))>12)element.setAttribute('stroke-opacity','.08');
        else if(!element.hasAttribute('stroke-opacity'))element.setAttribute('stroke-opacity',brightness>.35?'.4':'.82');
        else if(Number(element.getAttribute('stroke-opacity'))<.15)element.setAttribute('stroke-opacity',String(Number(element.getAttribute('stroke-opacity'))*1.7));
      }else{
        const rectangle=element.tagName==='rect';
        const surface=rectangle&&!(Number(element.getAttribute('width'))<=10||Number(element.getAttribute('height'))<=10);
        const fill=surface||(!rectangle&&(darkBackground?brightness<.12:brightness>.5))?blueprintPalette.paper:blueprintPalette.ink;
        if(element.style.getPropertyValue(attribute))element.style.setProperty(attribute,fill);else element.setAttribute(attribute,fill);
        if(surface&&!element.hasAttribute('stroke')){element.setAttribute('stroke',blueprintPalette.secondary);element.setAttribute('stroke-opacity','.25');}
        if(!rectangle&&element.closest('pattern')&&fill===blueprintPalette.ink)element.setAttribute('fill-opacity','.1');
      }
    }
    if(element.tagName==='text'||element.tagName==='tspan'){
      element.setAttribute('fill',blueprintPalette.ink);
      if(element.style.getPropertyValue('fill'))element.style.setProperty('fill',blueprintPalette.ink);
    }
  }
  return new XMLSerializer().serializeToString(document.documentElement);
}
