import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { defaultSettings, normalizeSettings, parseDemoConfig, demoConfigFromState, layerOrder, controlSpecs } from '../demo-config.js';

test('published demos contain complete, self-contained configurations and SVGs',async()=>{
  const folders=JSON.parse(await readFile(new URL('../assets/demos.json',import.meta.url),'utf8'));
  assert.equal(folders.length,4);
  const colors=[];
  for(const name of folders){
    const folder=new URL(`../assets/${encodeURIComponent(name)}/`,import.meta.url);
    const json=JSON.parse(await readFile(new URL('demo.json',folder),'utf8'));
    const config=parseDemoConfig(json);colors.push(config.settings.laptop.screenColor);
    assert.deepEqual(normalizeSettings(json),config.settings);
    for(const group of ['canvas','scene','laptop','desktop','animation'])for(const key of Object.keys(defaultSettings()[group]))assert.ok(Object.hasOwn(json[group],key),`${name}: ${group}.${key}`);
    for(const key of layerOrder){assert.ok(config.files[key]);await access(new URL(encodeURIComponent(config.files[key]),folder));}
  }
  assert.deepEqual(colors,['#e8f3f0','#19272b','#191d22','#eaf0f2']);
});

test('partial configuration fills defaults and infers a preset body color',()=>{
  const {settings}=parseDemoConfig({version:1,laptop:{finish:'silver'},canvas:{shadows:false},layers:{foreground:{rotateZ:4}}});
  assert.equal(settings.laptop.bodyColor,'#c4c7cc');assert.equal(settings.canvas.shadows,false);assert.equal(settings.layers.foreground.rotateZ,4);assert.equal(settings.scene.perspective,38);
  assert.equal(normalizeSettings({laptop:{finish:'silver',bodyColor:null}}).laptop.bodyColor,'#c4c7cc');
});

test('each demo has its own presentation defaults',async()=>{
  const expected={
    'Architecture demo':{device:'desktop',finish:'silver',bodyColor:'#c4c7cc',background:0,grid:false,shadows:false,elevation:18,yaw:-28},
    'Music demo':{device:'laptop',finish:'gray',bodyColor:'#4f5560',background:100,grid:false,shadows:true,elevation:12,yaw:-28},
    'Chess Demo':{device:'desktop',finish:'gray',bodyColor:'#4f5560',background:100,grid:true,shadows:true,elevation:18,yaw:-20},
    'Dashboard demo':{device:'laptop',finish:'silver',bodyColor:'#c4c7cc',background:0,grid:true,shadows:true,elevation:24,yaw:-20}
  };
  for(const [name,preset] of Object.entries(expected)){
    const json=JSON.parse(await readFile(new URL(`../assets/${encodeURIComponent(name)}/demo.json`,import.meta.url),'utf8'));
    const {settings}=parseDemoConfig(json);
    assert.equal(settings.device,preset.device,name);
    assert.equal(settings[preset.device].finish,preset.finish,name);
    assert.equal(settings[preset.device].bodyColor,preset.bodyColor,name);
    assert.equal(settings.canvas.background,preset.background,name);
    assert.equal(settings.canvas.grid,preset.grid,name);
    assert.equal(settings.canvas.shadows,preset.shadows,name);
    assert.equal(settings.scene.rotateX,preset.elevation,name);
    assert.equal(settings.scene.rotateY,preset.yaw,name);
    assert.equal(settings.scene.rotateZ,0,`${name}: zero initial camera roll`);
  }
});

test('all configured visual fields have editor controls and only phase is internal',()=>{
  const paths=(value,prefix='')=>Object.entries(value).flatMap(([key,item])=>{
    const path=prefix?`${prefix}.${key}`:key;
    return item!==null&&typeof item==='object'?paths(item,path):[path];
  });
  const numeric=Object.entries(controlSpecs).flatMap(([group,fields])=>fields.flatMap(([key])=>group==='layer'?layerOrder.map(layer=>`layers.${layer}.${key}`):[`${group}.${key}`]));
  const manual=[
    'canvas.grid','canvas.shadows','canvas.background','canvas.panelCollapsed','canvas.highQuality','device',
    'laptop.visible','laptop.finish','laptop.bodyColor','laptop.screenColor',
    'desktop.visible','desktop.finish','desktop.bodyColor','animation.enabled','animation.axis','animation.preset'
  ];
  assert.deepEqual([...numeric,...manual,'animation.time'].sort(),paths(defaultSettings()).sort());
  for(const group of ['scene','layer'])assert.equal(controlSpecs[group].find(([key])=>key==='rotateZ')[1],'Roll (Z)');
});

test('known numeric ranges, boolean types, colors, enums and unsafe fields are validated',()=>{
  const result=normalizeSettings(JSON.parse('{"device":"unknown","canvas":{"background":200,"grid":"false","shadows":false,"assetSet":"wrong"},"scene":{"scale":0,"perspective":1000,"rotateX":-20},"laptop":{"bodyColor":{"toString":"bad"},"screenColor":"url(bad)","finish":"unknown"},"animation":{"speed":0,"axis":"bad"},"layers":{"foreground":{"z":90,"opacity":-1}},"__proto__":{"polluted":true}}'));
  assert.equal(result.device,'laptop');assert.equal(result.canvas.background,100);assert.equal(result.canvas.grid,true);assert.equal(result.canvas.shadows,false);assert.equal(result.scene.scale,.65);assert.equal(result.scene.perspective,60);assert.equal(result.scene.rotateX,0);assert.equal(result.animation.speed,3000);assert.equal(result.animation.axis,'y');assert.equal(result.layers.foreground.z,1.5);assert.equal(result.layers.foreground.opacity,0);assert.equal(result.laptop.bodyColor,'#4f5560');assert.equal(result.laptop.screenColor,'#e8f3f0');assert.equal(result.canvas.assetSet,undefined);assert.equal({}.polluted,undefined);
  assert.deepEqual(normalizeSettings({scene:{perspective:NaN},layers:{background:{scale:Infinity}}}),defaultSettings());
});

test('configuration versions and folder-local filenames are enforced',()=>{
  for(const version of [undefined,0,2,'1'])assert.throws(()=>parseDemoConfig({version}));
  for(const file of ['../screen.svg','/screen.svg','https://example.test/screen.svg','sub/screen.svg','sub\\screen.svg','screen.png',' screen.svg'])assert.throws(()=>parseDemoConfig({version:1,layers:{background:{file}}}));
  assert.equal(parseDemoConfig({version:1,layers:{background:{file:'My screen.svg'}}}).files.background,'My screen.svg');
});

test('copied configurations round-trip all editor settings without runtime metadata',()=>{
  const state=defaultSettings();state.canvas.assetSet='ignored';state.canvas.shadows=false;state.desktop.tilt=12;state.animation.time=1200;state.laptop.bodyColor='#ffffff';state.laptop.finish='custom';
  const files=Object.fromEntries(layerOrder.map((key,index)=>[key,`${index+1}.svg`]));
  const exported=demoConfigFromState(state,files),parsed=parseDemoConfig(JSON.parse(JSON.stringify(exported)));
  assert.deepEqual(parsed.settings,normalizeSettings(state));assert.deepEqual(parsed.files,files);assert.equal(exported.canvas.assetSet,undefined);assert.equal(exported.demoStates,undefined);
});

test('partial configurations keep Sway and animation fields round-trip in JSON',()=>{
  const legacy=normalizeSettings({animation:{enabled:false,axis:'z',speed:8000,time:1600},scene:{rotateY:-41}});
  assert.equal(legacy.animation.preset,'sway');assert.equal(legacy.animation.duration,12000);assert.equal(legacy.animation.time,1600);assert.equal(legacy.scene.rotateY,-41);
  const tour=normalizeSettings({animation:{preset:'tour',duration:45000}});
  assert.equal(tour.animation.preset,'tour');assert.equal(tour.animation.duration,45000);
  assert.equal(normalizeSettings({animation:{preset:'unknown',duration:0}}).animation.preset,'sway');
  assert.equal(normalizeSettings({animation:{duration:0}}).animation.duration,12000);
  assert.equal(normalizeSettings({animation:{duration:Infinity}}).animation.duration,12000);
  assert.equal(normalizeSettings({animation:{preset:'fly-in'}}).animation.preset,'fly-in');
  assert.equal(normalizeSettings({animation:{preset:'inversion'}}).animation.preset,'inversion');
  assert.deepEqual(normalizeSettings(tour),tour);
});

test('reduced motion applies to presets without preventing explicit local play',()=>{
  const config=parseDemoConfig({version:1,animation:{enabled:true}},{reducedMotion:true});assert.equal(config.settings.animation.enabled,false);
  assert.equal(normalizeSettings({animation:{enabled:true}},config.settings).animation.enabled,true);
});
