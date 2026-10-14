import * as THREE from 'three';
import { roundedPlane, displayShell } from './display-geometry.js';

export const DESKTOP_SCREEN_WIDTH=3.24;
export const DESKTOP_SCREEN_HEIGHT=DESKTOP_SCREEN_WIDTH*9/16;
const PANEL_DEPTH=.064;
const HINGE_RADIUS=.038;
const HINGE_Y=1.18;
const HINGE_Z=-.2;
const PANEL_OFFSET=HINGE_RADIUS+PANEL_DEPTH/2;

function createStem(material) {
  // The profile uses depth/height coordinates, with the bend behind the panel.
  const side=new THREE.Shape();
  side.moveTo(-.4,.056);side.lineTo(-.55,.056);
  side.bezierCurveTo(-.61,.056,-.65,.083,-.626,.16);
  side.lineTo(HINGE_Z-.051,HINGE_Y-.066);
  side.quadraticCurveTo(HINGE_Z-.036,HINGE_Y-.016,HINGE_Z-.007,HINGE_Y);
  side.lineTo(HINGE_Z+.012,HINGE_Y-.02);
  side.quadraticCurveTo(HINGE_Z-.013,HINGE_Y-.035,HINGE_Z-.024,HINGE_Y-.08);
  side.lineTo(-.597,.15);
  side.bezierCurveTo(-.614,.099,-.583,.086,-.541,.086);
  side.lineTo(-.4,.086);side.closePath();
  const geometry=new THREE.ExtrudeGeometry(side,{depth:.38,steps:1,curveSegments:24,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:3});
  geometry.translate(0,0,-.19);geometry.rotateY(-Math.PI/2);
  const stem=new THREE.Mesh(geometry,material);stem.name='Desktop stem';stem.castShadow=true;stem.receiveShadow=true;
  return stem;
}

export function createDesktop() {
  const group=new THREE.Group();group.name='Desktop';
  const aluminum=new THREE.MeshStandardMaterial({color:'#c4c7cc',metalness:.86,roughness:.3});
  const baseMaterial=aluminum.clone();baseMaterial.roughness=.36;
  const black=new THREE.MeshStandardMaterial({color:'#12171c',metalness:.16,roughness:.4});
  const screenMaterial=new THREE.MeshBasicMaterial({color:'#e8f3f0',toneMapped:false});
  const hardware=new THREE.Group();hardware.name='Desktop stand';group.add(hardware);
  const base=displayShell(1.65,.9,.044,.09,.09,.005,baseMaterial);
  base.name='Desktop base';base.geometry.rotateX(-Math.PI/2);base.position.set(0,.03,HINGE_Z);hardware.add(base);
  hardware.add(createStem(aluminum));
  const hinge=new THREE.Mesh(new THREE.CylinderGeometry(HINGE_RADIUS,HINGE_RADIUS,.42,48),aluminum);
  hinge.name='Desktop tilt hinge';hinge.rotation.z=Math.PI/2;hinge.position.set(0,HINGE_Y,HINGE_Z);hinge.castShadow=true;hardware.add(hinge);
  for(const x of [-.6,.6])for(const z of [-.28,.28]){
    const foot=new THREE.Mesh(new THREE.CylinderGeometry(.042,.042,.01,16),black);foot.position.set(x,.003,HINGE_Z+z);hardware.add(foot);
  }

  // Share the hinge axis, keeping the rotating rear face tangent to its barrel.
  const head=new THREE.Group();head.name='Desktop panel';head.position.copy(hinge.position);group.add(head);
  const shell=displayShell(3.4,1.98,PANEL_DEPTH,.055,.09,.003,aluminum);
  shell.name='Desktop shell';shell.position.set(0,.38,PANEL_OFFSET);head.add(shell);
  const bezel=displayShell(3.36,1.94,.005,.05,.085,.0008,black);
  bezel.name='Desktop bezel';bezel.position.set(0,.38,PANEL_OFFSET+.0345);head.add(bezel);
  const screenAnchor=new THREE.Group();screenAnchor.name='Desktop screen anchor';screenAnchor.position.set(0,.38,PANEL_OFFSET+.039);head.add(screenAnchor);
  const screen=new THREE.Mesh(roundedPlane(DESKTOP_SCREEN_WIDTH,DESKTOP_SCREEN_HEIGHT,.035,.05),screenMaterial);
  screen.name='Desktop screen';screenAnchor.add(screen);
  const lens=new THREE.Mesh(new THREE.CircleGeometry(.006,20),new THREE.MeshStandardMaterial({color:'#080d13',metalness:.75,roughness:.14}));
  lens.position.set(0,1.321,PANEL_OFFSET+.039);head.add(lens);
  const led=new THREE.Mesh(new THREE.CircleGeometry(.003,12),new THREE.MeshBasicMaterial({color:'#8fc2ae',toneMapped:false}));
  led.position.set(1.52,-.565,PANEL_OFFSET+.039);head.add(led);
  const vents=new THREE.InstancedMesh(new THREE.BoxGeometry(.027,.008,.016),black,64);
  vents.name='Desktop vents';const vent=new THREE.Object3D();
  for(let i=0;i<64;i++){vent.position.set(-1.386+i*.044,-.608,PANEL_OFFSET-.013);vent.updateMatrix();vents.setMatrixAt(i,vent.matrix);}
  head.add(vents);

  function update(settings) {
    hardware.visible=settings.visible;
    head.children.forEach(child=>{if(child!==screenAnchor)child.visible=settings.visible;});
    screen.visible=settings.visible;
    group.position.set(settings.x,settings.y,settings.z);group.scale.setScalar(settings.scale);
    head.rotation.x=THREE.MathUtils.degToRad(-settings.tilt);
    aluminum.color.set(settings.bodyColor);baseMaterial.color.set(settings.bodyColor);
    screenMaterial.color.set(settings.screenColor);
  }
  return {group,head,screenAnchor,screen,update};
}
