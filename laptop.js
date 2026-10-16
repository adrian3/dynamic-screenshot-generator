import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/three/RoundedBoxGeometry.js';
import { roundedOutline, roundedPlane, displayShell } from './display-geometry.js';

export const SCREEN_WIDTH = 3.24;
export const SCREEN_HEIGHT = 1.965;

function horizontalShell(shape, depth, bevel, material, y) {
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,steps:1,curveSegments:16,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:3});
  geometry.rotateX(-Math.PI/2);
  const mesh=new THREE.Mesh(geometry,material);mesh.position.y=y;mesh.castShadow=true;mesh.receiveShadow=true;
  return mesh;
}

export function createLaptop() {
  const group=new THREE.Group();group.name='Laptop';
  const aluminum=new THREE.MeshStandardMaterial({color:'#4f5560',metalness:.82,roughness:.31});
  const deckMaterial=aluminum.clone();deckMaterial.roughness=.38;
  const black=new THREE.MeshStandardMaterial({color:'#14171d',metalness:.12,roughness:.6});
  const keyMaterial=new THREE.MeshStandardMaterial({color:'#090b10',metalness:0,roughness:.74});
  const trackpadMaterial=aluminum.clone();trackpadMaterial.roughness=.45;
  const screenMaterial=new THREE.MeshBasicMaterial({color:'#26343c',toneMapped:false});
  const box=(parent,w,h,d,r,material,x=0,y=0,z=0)=>{
    const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,4,r),material);
    mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  const deckDrop=.14*.25;
  // The trackpad aperture is part of the chassis, rather than a plate on top of it.
  const chassisOutline=roundedOutline(3.4,2.22,.16,.055);
  chassisOutline.holes.push(roundedOutline(1.23,.68,.05,.05,.625));
  const chassis=horizontalShell(chassisOutline,.122,.009,[deckMaterial,aluminum],.012);chassis.name='Chassis';group.add(chassis);
  chassis.scale.y=.75;chassis.position.y=.003+(.012-.003)*.75;
  const bottomGeometry=new THREE.ShapeGeometry(roundedOutline(3.4,2.22,.16,.055),16);
  bottomGeometry.rotateX(-Math.PI/2);bottomGeometry.rotateZ(Math.PI);
  const bottomCover=new THREE.Mesh(bottomGeometry,aluminum);
  bottomCover.name='Bottom cover';bottomCover.position.y=.003;group.add(bottomCover);
  const keyboardRecess=box(group,2.91,.005,1.015,.002,black,0,.142-deckDrop,-.395);keyboardRecess.name='Keyboard recess';
  const trackpadCarrier=horizontalShell(roundedOutline(1.23,.68,.05,.05,.625),.004,.001,black,.118-deckDrop);trackpadCarrier.name='Trackpad recess';group.add(trackpadCarrier);
  const trackpad=horizontalShell(roundedOutline(1.214,.664,.044,.044,.625),.012,.0015,trackpadMaterial,.125-deckDrop);trackpad.name='Trackpad';group.add(trackpad);
  box(group,.29,.014,.017,.006,black,0,.139-deckDrop,1.108);

  const hinge=new THREE.Mesh(new THREE.CylinderGeometry(.042,.042,2.9,32),black);hinge.name='Laptop hinge';
  hinge.rotation.z=Math.PI/2;hinge.position.set(0,.187-deckDrop,-1.027);group.add(hinge);
  const lid=new THREE.Group();lid.name='Lid';lid.position.set(0,.187-deckDrop,-1.027);group.add(lid);
  const lidShell=displayShell(3.4,2.13,.03,.04,.16,.002,aluminum);lidShell.name='Lid shell';lidShell.position.y=1.065;lid.add(lidShell);
  const bezel=displayShell(3.35,2.085,.006,.03,.14,.0008,black);bezel.name='Bezel';bezel.position.set(0,1.07,.017);lid.add(bezel);
  const screenAnchor=new THREE.Group();screenAnchor.name='Screen anchor';screenAnchor.position.set(0,1.075,.022);lid.add(screenAnchor);
  const screen=new THREE.Mesh(roundedPlane(SCREEN_WIDTH,SCREEN_HEIGHT,.035,.10),screenMaterial);
  screen.name='Screen';screenAnchor.add(screen);
  const lens=new THREE.Mesh(new THREE.CircleGeometry(.009,20),new THREE.MeshStandardMaterial({color:'#080d13',metalness:.75,roughness:.14}));
  bezel.geometry.computeBoundingBox();
  const screenTop=screenAnchor.position.y+SCREEN_HEIGHT/2,bezelTop=bezel.position.y+bezel.geometry.boundingBox.max.y;
  lens.name='Camera lens';lens.position.set(0,(screenTop+bezelTop)/2,.022);lid.add(lens);

  const rows=[
    [['esc',.23],...Array.from({length:12},(_,i)=>[`F${i+1}`,.177]),['',.177]],
    [['~',.19],...['1','2','3','4','5','6','7','8','9','0','-','='].map(k=>[k,.177]),['delete',.255]],
    [['tab',.28],...['Q','W','E','R','T','Y','U','I','O','P','[',']'].map(k=>[k,.177]),['\\',.165]],
    [['caps',.33],...['A','S','D','F','G','H','J','K','L',';',"'"].map(k=>[k,.177]),['return',.313]],
    [['shift',.43],...['Z','X','C','V','B','N','M',',','.','/'].map(k=>[k,.177]),['shift',.42]],
    [['fn',.20],['ctrl',.20],['alt',.20],['cmd',.23],['',.96],['cmd',.23],['alt',.20],['<',.17],['^',.17],['>',.17]]
  ];
  const keyGap=.022;
  const rowWidth=row=>row.reduce((n,[,width])=>n+width,0)+(row.length-1)*keyGap;
  // Keep the modifier row aligned with the Shift row without shrinking its keys.
  rows.at(-1)[4][1]+=rowWidth(rows.at(-2))-rowWidth(rows.at(-1));
  const keyGeometry=new RoundedBoxGeometry(1,1,1,2,.14);
  const keyCount=rows.reduce((n,row)=>n+row.length,0);
  const keys=new THREE.InstancedMesh(keyGeometry,keyMaterial,keyCount);keys.name='Keyboard keys';keys.castShadow=true;keys.receiveShadow=true;group.add(keys);
  const legendCanvas=document.createElement('canvas');legendCanvas.width=2048;legendCanvas.height=760;
  const context=legendCanvas.getContext('2d');context.fillStyle='#d4d7de';context.textAlign='center';context.textBaseline='middle';
  const keyLabels=[];let lightKeycaps=false;
  const keyTransform=new THREE.Object3D();let index=0;
  rows.forEach((row,rowIndex)=>{
    const width=rowWidth(row);
    let left=-width/2;
    row.forEach(([label,w])=>{
      const z=-.805+rowIndex*.16;
      keyTransform.position.set(left+w/2,.152-deckDrop,z);keyTransform.scale.set(w,.016,rowIndex===0?.112:.138);keyTransform.updateMatrix();keys.setMatrixAt(index++,keyTransform.matrix);
      context.font=`${label.length>2?14:20}px Arial`;
      const x=((left+w/2)/2.96+.5)*2048,y=((z+.99/2+.39)/.99)*760;
      context.fillText(label,x,y);keyLabels.push({label,x,y});
      left+=w+keyGap;
    });
  });
  const legends=new THREE.CanvasTexture(legendCanvas);legends.colorSpace=THREE.SRGBColorSpace;
  const legendPlane=new THREE.Mesh(new THREE.PlaneGeometry(2.96,.99),new THREE.MeshBasicMaterial({map:legends,transparent:true,depthWrite:false}));
  legendPlane.name='Keyboard legends';
  legendPlane.rotation.x=-Math.PI/2;legendPlane.position.set(0,.1605-deckDrop,-.39);group.add(legendPlane);
  const lightKeys=new THREE.Color('#f3f4f5'),darkKeys=new THREE.Color('#090b10');
  const darkLegends=new THREE.Color('#30343c'),lightLegends=new THREE.Color('#d4d7de');
  let inverting=false;
  function repaintLegends(color) {
    context.clearRect(0,0,legendCanvas.width,legendCanvas.height);context.fillStyle=color;
    keyLabels.forEach(({label,x,y})=>{context.font=`${label.length>2?14:20}px Arial`;context.fillText(label,x,y);});
    legends.needsUpdate=true;
  }

  const holes=new THREE.InstancedMesh(new THREE.CylinderGeometry(.004,.004,.001,6),black,360);
  const dot=new THREE.Object3D();index=0;
  for(const side of [-1,1])for(let row=0;row<30;row++)for(let col=0;col<6;col++){
    dot.position.set(side*(1.514+col*.012),.1448-deckDrop,-.85+row*.028);dot.updateMatrix();holes.setMatrixAt(index++,dot.matrix);
  }
  group.add(holes);
  const portHeight=.003+(.081-.003)*.75;
  for(const side of [-1,1])for(const z of [-.86,-.70]){const port=box(group,.009,.024,.091,.003,black,side*1.710,portHeight,z);port.name='USB port';}
  const audioPort=new THREE.Mesh(new THREE.CylinderGeometry(.013,.013,.008,18),black);audioPort.rotation.z=Math.PI/2;audioPort.position.set(-1.714,portHeight,-.54);audioPort.name='Headphone jack';group.add(audioPort);
  for(const x of [-1.4,1.4])for(const z of [-.83,.83]){
    const foot=new THREE.Mesh(new THREE.CylinderGeometry(.07,.065,.013,20),black);foot.position.set(x,-.002,z);group.add(foot);
  }

  function update(settings) {
    group.children.forEach(child=>{if(child!==lid)child.visible=settings.visible;});
    lid.children.forEach(child=>{if(child!==screenAnchor)child.visible=settings.visible;});
    screen.visible=settings.visible;
    group.position.set(settings.x,settings.y,settings.z);group.scale.setScalar(settings.scale);
    lid.rotation.x=THREE.MathUtils.degToRad(90-settings.lidAngle);
    aluminum.color.set(settings.bodyColor);deckMaterial.color.set(settings.bodyColor);trackpadMaterial.color.set(settings.bodyColor);
    const nextLightKeycaps=settings.finish==='silver'||aluminum.color.getHSL({}).l>.5;
    if(nextLightKeycaps!==lightKeycaps||inverting){
      inverting=false;
      lightKeycaps=nextLightKeycaps;keyMaterial.color.set(lightKeycaps?'#f3f4f5':'#090b10');
      repaintLegends(lightKeycaps?'#30343c':'#d4d7de');legendPlane.material.color.set('#ffffff');
    }
    screenMaterial.color.set(settings.screenColor);
  }
  function setFinishBlend(blend) {
    aluminum.color.setRGB(1-blend,1-blend,1-blend);deckMaterial.color.copy(aluminum.color);trackpadMaterial.color.copy(aluminum.color);
    keyMaterial.color.lerpColors(lightKeys,darkKeys,blend);
    if(!inverting){repaintLegends('#ffffff');inverting=true;}
    legendPlane.material.color.lerpColors(darkLegends,lightLegends,blend);
    return aluminum.color;
  }
  return {group,lid,screenAnchor,screen,update,setFinishBlend};
}
