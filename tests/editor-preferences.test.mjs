import test from 'node:test';
import assert from 'node:assert/strict';
import { PREFERENCES_KEY, LEGACY_STATE_KEY, normalizePreferences, loadPreferences, savePreferences, clearPreferences } from '../editor-preferences.js';

function memoryStorage(values={}) {
  const entries=new Map(Object.entries(values));
  return {entries,getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key)};
}

test('only the folder and animation choices can be saved',()=>{
  const storage=memoryStorage();
  savePreferences({assetSet:'Dashboard demo',animationPreset:'inversion',scene:{rotateY:80},animation:{time:1234},canvas:{grid:false},demoStates:{},device:'desktop'},storage);
  assert.deepEqual(JSON.parse(storage.getItem(PREFERENCES_KEY)),{assetSet:'Dashboard demo',animationPreset:'inversion'});
  for(const preset of ['sway','tour','fly-in','inversion'])assert.equal(normalizePreferences({animationPreset:preset}).animationPreset,preset);
});

test('legacy migration keeps selections and discards all visual and runtime overrides',()=>{
  const legacy={canvas:{assetSet:'Chess Demo',background:0,panelCollapsed:true},animation:{preset:'tour',enabled:false,time:57000,duration:90000},scene:{rotateZ:20},demoStates:{'Chess Demo':{animation:{preset:'sway'}}}};
  const storage=memoryStorage({[LEGACY_STATE_KEY]:JSON.stringify(legacy)}),preferences=loadPreferences(storage);
  assert.deepEqual(preferences,{assetSet:'Chess Demo',animationPreset:'tour'});
  savePreferences(preferences,storage);
  assert.equal(storage.getItem(LEGACY_STATE_KEY),null);assert.deepEqual(loadPreferences(storage),preferences);
});

test('current preferences take precedence over old full-state storage',()=>{
  const storage=memoryStorage({[PREFERENCES_KEY]:JSON.stringify({assetSet:'Music demo',animationPreset:'fly-in'}),[LEGACY_STATE_KEY]:JSON.stringify({canvas:{assetSet:'Chess Demo'},animation:{preset:'sway'}})});
  assert.deepEqual(loadPreferences(storage),{assetSet:'Music demo',animationPreset:'fly-in'});
});

test('missing, malformed or invalid preferences cannot inject scene settings',()=>{
  for(const raw of [null,'broken','null','[]','2','{"assetSet":12,"animationPreset":"unknown","__proto__":{"polluted":true}}']){
    const storage=memoryStorage(raw===null?{}:{[PREFERENCES_KEY]:raw});
    assert.deepEqual(loadPreferences(storage),{assetSet:'',animationPreset:null});
  }
  assert.equal({}.polluted,undefined);
  const storage=memoryStorage({[PREFERENCES_KEY]:'broken',[LEGACY_STATE_KEY]:JSON.stringify({canvas:{assetSet:'Architecture demo'},animation:{preset:'inversion'}})});
  assert.deepEqual(loadPreferences(storage),{assetSet:'Architecture demo',animationPreset:'inversion'});
});

test('blocked storage never prevents the editor from loading or operating',()=>{
  const storage={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');},removeItem(){throw new Error('blocked');}};
  assert.deepEqual(loadPreferences(storage),{assetSet:'',animationPreset:null});
  assert.doesNotThrow(()=>savePreferences({assetSet:'Chess Demo',animationPreset:'sway'},storage));
  assert.doesNotThrow(()=>clearPreferences(storage));
});

test('reset clears current and legacy app storage without deleting unrelated origin data',()=>{
  const storage=memoryStorage({[PREFERENCES_KEY]:'{}',[LEGACY_STATE_KEY]:'{}',unrelated:'keep'});
  clearPreferences(storage);assert.deepEqual([...storage.entries],[['unrelated','keep']]);
});
