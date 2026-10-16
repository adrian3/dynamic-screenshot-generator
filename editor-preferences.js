import { animationPresets, isRecord } from './demo-config.js';

export const PREFERENCES_KEY='living-screenshots-3d-preferences-v1';
export const LEGACY_STATE_KEY='living-screenshots-3d-state-v1';

export function normalizePreferences(input) {
  return {
    assetSet:isRecord(input)&&typeof input.assetSet==='string'?input.assetSet:'',
    animationPreset:isRecord(input)&&animationPresets.includes(input.animationPreset)?input.animationPreset:null
  };
}

export function loadPreferences(storage) {
  try {
    storage??=globalThis.localStorage;
    try {
      const saved=JSON.parse(storage.getItem(PREFERENCES_KEY));
      if(isRecord(saved))return normalizePreferences(saved);
    }catch{}
    const legacy=JSON.parse(storage.getItem(LEGACY_STATE_KEY));
    return normalizePreferences({assetSet:legacy?.canvas?.assetSet,animationPreset:legacy?.animation?.preset});
  }catch{return normalizePreferences(null);}
}

export function savePreferences(preferences,storage) {
  try {
    storage??=globalThis.localStorage;
    storage.setItem(PREFERENCES_KEY,JSON.stringify(normalizePreferences(preferences)));
    storage.removeItem(LEGACY_STATE_KEY);
  }catch{}
}

export function clearPreferences(storage) {
  for(const key of [PREFERENCES_KEY,LEGACY_STATE_KEY])try{(storage??globalThis.localStorage).removeItem(key);}catch{}
}
