// This rules generation has its own saves. The baseline build keeps its original keys.
export const storageKey=key=>'gameplay-v1:'+key;
const scoped=kind=>({
 getItem:key=>globalThis[kind].getItem(storageKey(key)),
 setItem:(key,value)=>globalThis[kind].setItem(storageKey(key),value),
 removeItem:key=>globalThis[kind].removeItem(storageKey(key))
});
export const localGameStorage=scoped('localStorage');
export const sessionGameStorage=scoped('sessionStorage');
