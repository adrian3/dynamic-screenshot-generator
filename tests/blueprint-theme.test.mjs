import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.core.js';
import {createBlueprintDevice,instanceEdges,renderAppearance,blueprintPalette} from '../blueprint-theme.js';
import {defaultSettings} from '../demo-config.js';

test('blueprint mode restores original materials without changing geometry or transforms',()=>{
  const root=new THREE.Group(),material=new THREE.MeshBasicMaterial({color:'#c4c7cc'});
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material);mesh.name='Chassis';mesh.position.set(2,3,4);root.add(mesh);
  const geometry=mesh.geometry,theme=createBlueprintDevice(root);
  theme.setEnabled(true);assert.notEqual(mesh.material,material);assert.equal(mesh.geometry,geometry);assert.deepEqual(mesh.position.toArray(),[2,3,4]);
  assert.ok(mesh.children.some(child=>child.isLineSegments&&child.visible));
  theme.setEnabled(false);assert.equal(mesh.material,material);assert.ok(mesh.children.every(child=>!child.visible));
  theme.dispose();assert.equal(mesh.children.length,0);
});

test('instanced key outlines follow every instance matrix in one line geometry',()=>{
  const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial(),2);
  mesh.name='Keyboard keys';mesh.setMatrixAt(0,new THREE.Matrix4().makeTranslation(-2,0,0));mesh.setMatrixAt(1,new THREE.Matrix4().makeTranslation(2,0,0));
  const original=new THREE.EdgesGeometry(mesh.geometry),baked=instanceEdges(mesh,original);
  assert.equal(baked.getAttribute('position').count,original.getAttribute('position').count*2);
  baked.computeBoundingBox();assert.equal(baked.boundingBox.min.x,-2.5);assert.equal(baked.boundingBox.max.x,2.5);
  const root=new THREE.Group();root.add(mesh);const theme=createBlueprintDevice(root);assert.equal(theme.stats.lineObjects,1);theme.dispose();
  baked.dispose();original.dispose();
});

test('hidden edges stay optional and can never remain enabled in original mode',()=>{
  const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial()));
  const theme=createBlueprintDevice(root);theme.setEnabled(true);theme.setHiddenEdges(true);
  const ghost=root.children[0].children.find(child=>child.name==='Blueprint hidden edges');assert.equal(ghost.visible,true);assert.equal(ghost.material.depthTest,false);
  theme.setEnabled(false);assert.equal(ghost.visible,false);theme.dispose();
});

test('blueprint mode does not add an outline for every tiny speaker perforation',()=>{
  const root=new THREE.Group();root.add(new THREE.InstancedMesh(new THREE.CylinderGeometry(.004,.004,.001,6),new THREE.MeshBasicMaterial(),360));
  const theme=createBlueprintDevice(root);assert.equal(theme.stats.lineObjects,0);theme.dispose();
});

test('blueprint hardware never takes over the attached screenshot planes',()=>{
  const root=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshBasicMaterial());root.add(body,screen);
  const original=screen.material,theme=createBlueprintDevice(root,{exclude:[screen]});theme.setEnabled(true);
  assert.equal(screen.material,original);assert.equal(screen.children.length,0);assert.equal(theme.stats.meshes,1);theme.dispose();
});

test('blueprint surfaces and line opacity follow the hardware fade',()=>{
  const material=new THREE.MeshBasicMaterial({opacity:.35}),root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),material);root.add(mesh);
  const theme=createBlueprintDevice(root);theme.setEnabled(true);theme.syncOpacity();
  assert.equal(mesh.material.opacity,.35);assert.equal(mesh.material.transparent,true);
  const line=mesh.children.find(child=>child.name==='Blueprint visible edges');assert.equal(line.material.opacity,.53*.35);
  material.opacity=1;theme.syncOpacity();assert.equal(mesh.material.transparent,false);assert.equal(mesh.material.opacity,1);theme.dispose();
});

test('captured screens can retain their original backing inside blueprint hardware',()=>{
  const root=new THREE.Group(),material=new THREE.MeshBasicMaterial({color:'#cabbad'}),mesh=new THREE.Mesh(new THREE.PlaneGeometry(),material);mesh.name='Screen';root.add(mesh);
  const theme=createBlueprintDevice(root);theme.setScreenBlueprint(false);theme.setEnabled(true);assert.equal(mesh.material,material);
  theme.setEnabled(false);theme.setScreenBlueprint(true);theme.setEnabled(true);assert.notEqual(mesh.material,material);theme.dispose();
});

test('blueprint rendering overrides never overwrite the original saved colors',()=>{
  const state=defaultSettings();state.canvas.background='#ff00ff';state.laptop.screenColor='#aabbcc';const original=structuredClone(state);
  state.appearance.style='blueprint';
  assert.deepEqual(renderAppearance(state),{blueprint:true,convertScreens:true,background:blueprintPalette.paper,shadows:false,screenColor:blueprintPalette.paper});
  assert.equal(renderAppearance(state,true).convertScreens,false);assert.equal(renderAppearance(state,true).screenColor,'#aabbcc');
  state.appearance.style='original';assert.equal(renderAppearance(state).background,'#ff00ff');assert.deepEqual(state,original);
});
