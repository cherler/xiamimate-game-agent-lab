// Presentation travels beside the deterministic game state, never inside its hash.
// Draw events deliberately omit the card identity and hand UID.
const traces=new WeakMap();
export function beginCardEvents(state,actor,action,source){const trace={seq:state.seq,actor,action:{...action},source:{...source},events:[],cause:{...source},batch:0};traces.set(state,trace);return trace;}
export function cardEvent(state,event){const trace=traces.get(state);if(trace)trace.events.push(structuredClone({source:trace.cause,...event}));}
export function cardBatch(state){const trace=traces.get(state);return trace?++trace.batch:0;}
export function cardCause(state){return traces.get(state)?.cause;}
export function withCardSource(state,source,fn,announce=true){const trace=traces.get(state);if(!trace)return fn();const previous=trace.cause;trace.cause={...source};if(announce)cardEvent(state,{kind:'trigger'});try{return fn();}finally{trace.cause=previous;}}
export function cardPresentation(state){const trace=traces.get(state);if(!trace)return null;const {actor,action,source,events}=trace;return structuredClone({seq:state.seq,actor,action,source,events});}
