// Keep the rules-generation namespace: preview progress survives its promotion to main.
export const storageKey=key=>'gameplay-v1:'+key;
export function readGameSave(storage,key,migrateLegacy=false){
 const current=storage.getItem(storageKey(key));if(current!==null)return current;
 if(!migrateLegacy)return null;
 const original=storage.getItem(key);if(original!==null){try{storage.setItem(storageKey(key),original);}catch{/* A full store must not prevent reading the untouched old save. */}}
 return original;
}
const migrateLegacy=typeof location!=='undefined'&&!/\/(preview|versions)\//.test(location.pathname);
const scoped=kind=>({
 getItem:key=>readGameSave(globalThis[kind],key,kind==='localStorage'&&migrateLegacy),
 setItem:(key,value)=>globalThis[kind].setItem(storageKey(key),value),
 removeItem:key=>globalThis[kind].removeItem(storageKey(key))
});
export const localGameStorage=scoped('localStorage');
export const sessionGameStorage=scoped('sessionStorage');
