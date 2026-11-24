// Presentation only: legal actions remain the authority for whether a card can be played.
export function cardGuidance(s,actor,card,info,actions){
 if(!card||!info||s.phase!=='play'||s.winner!==null)return '';
 if(s.turn!==actor)return '等待你的回合';
 const p=s.players[actor],plays=actions.filter(a=>a.type==='play'&&a.uid===card.uid);
 if(!plays.length){
  if(p.mana<info.cost)return `差 ${info.cost-p.mana} 费`;
  if(info.kind==='unit'&&p.board.length>=5)return '战场已满';
  return '没有可选目标';
 }
 const summonCount={W09:1,W12:2,F09:1,F12:2,S12:(p.cardsPlayed||0)>0?1:0}[info.id]||0;
 const room=Math.max(0,5-p.board.length-(info.kind==='unit'?1:0));
 if(summonCount>room)return `${info.id==='F12'?'绽放：':''}${info.kind==='unit'?'附带召唤':'仅召唤'} ${room} / ${summonCount}`;
 return plays.some(a=>a.target!==null)?'选择亮起的目标':'';
}
