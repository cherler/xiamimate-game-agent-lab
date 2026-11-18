// A decision window belongs to a match and one simulation step. It is consumed once.
export function openWindow({matchId,epoch,actor,ids,fallback,budget,now=()=>performance.now()}) {
  const opened=now(), token={matchId,epoch,actor}, legal=new Set(ids);
  if(!legal.has(fallback)) throw new Error('备用动作无效');
  let closed=false, answer=null, failure=null, latency=null;
  return {
    token,
    offer(tag,reply) {
      if(closed || answer || failure || tag.matchId!==matchId || tag.epoch!==epoch || tag.actor!==actor) return false;
      latency=now()-opened;
      if(latency>=budget){failure='timeout';return false;}
      if(!legal.has(reply?.id)){failure='invalid';return false;}
      answer={...reply,ms:latency}; return true;
    },
    fail(reason){if(!closed&&!answer){failure=reason;latency=now()-opened;}},
    cancel(){closed=true;},
    finish() {
      if(closed) return null;
      closed=true;
      if(answer) return {...answer,reason:null};
      return {id:fallback,source:'fallback',reason:failure||'timeout',ms:latency??(now()-opened)};
    }
  };
}
