// Original vector tokens: lightweight portraits shared by the two tabletop games.
export function portrait(id='N01'){
 if(id==='T06')return '<svg viewBox="0 0 140 90" aria-hidden="true"><ellipse cx="70" cy="80" rx="30" ry="5" fill="#6eaaac" opacity=".2"/><path d="M70 8L96 31L86 64L70 79L54 64L44 31Z" fill="#82cdd0" stroke="#e4d488" stroke-width="3"/><path d="M70 8L61 33L70 79L79 33Z" fill="#d5f1e1"/><path d="M44 31L61 33L70 8M96 31L79 33" fill="none" stroke="#f7e6ab" stroke-width="2"/><path d="M27 23V35M21 29H33M109 55V65M104 60H114" stroke="#d9b963" stroke-width="3"/></svg>';
 if(WORKSHOP_SHAPES[id])return workshopPortrait(id);
 const source=id;
 if(id.startsWith('S')||['T04','T05'].includes(id)){
  const n=Number(id.slice(1))||1,spell=['S02','S06','S07','S08','S11','T05'].includes(id),c=['#7b6ba4','#7b91bc','#aa82af'][n%3];
  return `<svg viewBox="0 0 140 90" aria-hidden="true"><ellipse cx="70" cy="80" rx="38" ry="5" fill="#514267" opacity=".18"/><circle cx="70" cy="44" r="32" fill="none" stroke="${c}" stroke-width="2" opacity=".5"/>${spell?`<path d="M70 7L79 33L109 38L86 54L90 81L70 65L49 81L53 54L31 38L61 33Z" fill="${c}"/><circle cx="70" cy="44" r="11" fill="#eee6fb"/>`:`<path d="M40 77L49 39H91L101 77Z" fill="${c}"/><path d="M42 37L70 8L98 37Z" fill="${c}"/><rect x="53" y="39" width="34" height="22" rx="8" fill="#ebe5ee"/><circle cx="62" cy="49" r="3" fill="#514267"/><circle cx="78" cy="49" r="3" fill="#514267"/><path d="M104 26V75" stroke="#a99970" stroke-width="4"/><path d="M104 14L108 24L119 26L109 31L104 42L100 31L89 26L100 23Z" fill="#e2c979"/>`}<circle cx="25" cy="19" r="3" fill="#b0a1d0"/><circle cx="119" cy="63" r="3" fill="#b0a1d0"/></svg>`;
 }
 id=({N09:'N03',N10:'N04',F09:'F01',F10:'F03',F11:'F05',T03:'F01',T07:'F05',W09:'W03',W10:'W05'})[id]||id;
 const green=id.startsWith('F'),c=green?'#73ac87':'#cda45e',dark='#284b48',eye='#fff3cb';
 let shape='';
 if(['N03'].includes(id))shape=`<path d="M36 67Q10 23 50 39Q70 14 90 39Q130 23 104 67L83 78H57Z" fill="${c}"/><circle cx="57" cy="48" r="13" fill="${eye}"/><circle cx="83" cy="48" r="13" fill="${eye}"/><circle cx="59" cy="49" r="5" fill="${dark}"/><circle cx="81" cy="49" r="5" fill="${dark}"/><path d="M64 58L76 58L70 68Z" fill="#e17e58"/>`;
 else if(['F01','F02','F03','F05'].includes(id))shape=`<path d="M56 72L61 43H80L86 72Z" fill="#9b7950"/><circle cx="49" cy="36" r="21" fill="#528a70"/><circle cx="88" cy="36" r="21" fill="#528a70"/><circle cx="70" cy="28" r="26" fill="${c}"/><circle cx="60" cy="38" r="4" fill="${eye}"/><circle cx="80" cy="38" r="4" fill="${eye}"/><path d="M65 50Q70 54 75 50" fill="none" stroke="${dark}" stroke-width="3"/>`;
 else if(id==='F04')shape=`<path d="M52 28L38 12M52 28L54 9M88 28L102 12M88 28L86 9" stroke="${c}" stroke-width="6" stroke-linecap="round"/><path d="M45 30Q70 18 95 30L84 65L70 76L56 65Z" fill="${c}"/><circle cx="57" cy="43" r="4" fill="${dark}"/><circle cx="83" cy="43" r="4" fill="${dark}"/><ellipse cx="70" cy="62" rx="8" ry="5" fill="${dark}"/>`;
 else if(['N05','C10','C11','C12'].includes(id))shape=`<path d="M30 73L41 30L62 14L93 21L112 75Z" fill="#839c99"/><path d="M41 30L65 42L62 14M65 42L79 76M65 42L93 21" fill="none" stroke="#b9d0c0" stroke-width="4"/><circle cx="55" cy="49" r="4" fill="${eye}"/><circle cx="84" cy="49" r="4" fill="${eye}"/>`;
 else if(id==='W01')shape=`<path d="M42 66Q20 84 19 57" fill="none" stroke="${c}" stroke-width="5"/><ellipse cx="70" cy="56" rx="34" ry="21" fill="${c}"/><circle cx="84" cy="34" r="13" fill="#e4bc72"/><circle cx="85" cy="52" r="5" fill="${dark}"/><circle cx="105" cy="61" r="5" fill="#e17e58"/>`;
 else if(['N01','N02','N04','W02','W03','W04','W05','T01','T02'].includes(id))shape=`<path d="M40 74L44 49H96L100 74Z" fill="${c}"/><rect x="47" y="21" width="46" height="36" rx="11" fill="${c}"/><path d="M44 31L70 19L96 31" fill="none" stroke="#f0ce87" stroke-width="7"/><rect x="52" y="35" width="36" height="12" rx="5" fill="${dark}"/><circle cx="61" cy="41" r="3" fill="${eye}"/><circle cx="79" cy="41" r="3" fill="${eye}"/><path d="M37 57L29 74M103 57L111 74" stroke="${c}" stroke-width="12" stroke-linecap="round"/><circle cx="70" cy="65" r="5" fill="${eye}"/>`;
 else shape=`<circle cx="70" cy="45" r="29" fill="none" stroke="${c}" stroke-width="3"/><path d="M78 10L46 48H67L61 80L96 39H74Z" fill="${c}"/><circle cx="29" cy="32" r="4" fill="${eye}"/><circle cx="108" cy="63" r="3" fill="${eye}"/>`;
 return `<svg viewBox="0 0 140 90" aria-hidden="true"><ellipse cx="70" cy="79" rx="45" ry="6" fill="#102f2c" opacity=".2"/>${shape}${source!==id?'<circle cx="109" cy="19" r="10" fill="#d7bf7c"/><path d="M109 12V26M102 19H116" stroke="#526f60" stroke-width="2"/>':''}</svg>`;
}

const WORKSHOP_SHAPES={
 N01:{color:'#6e9fb0',body:'apprentice'},N02:{color:'#9b9b6b',body:'guard'},N04:{color:'#ab8656',body:'artisan'},
 W02:{color:'#c78657',body:'guard'},W03:{color:'#ceaa56',body:'artisan'},W04:{color:'#bd7656',body:'spring'},W05:{color:'#789a91',body:'mech'},
 W09:{color:'#83ad97',body:'repair'},W10:{color:'#8c8aaf',body:'magnet'},T01:{color:'#d8b870',body:'part'},T02:{color:'#78bca5',body:'repair'}
};
function workshopPortrait(id){
 const {color:c,body}=WORKSHOP_SHAPES[id],eyes='<rect x="55" y="32" width="30" height="13" rx="5" fill="#294d4a"/><circle cx="63" cy="38" r="3" fill="#fff2c6"/><circle cx="77" cy="38" r="3" fill="#fff2c6"/>';
 let shape='';
 if(body==='part')shape=`<path d="M48 56L37 72M92 56L103 72" stroke="${c}" stroke-width="8"/><path d="M45 30L70 16L95 30V67H45Z" fill="${c}"/><circle cx="70" cy="42" r="12" fill="#294d4a"/><circle cx="70" cy="42" r="5" fill="#fff2c6"/><circle cx="70" cy="74" r="10" fill="#456560"/><circle cx="70" cy="74" r="4" fill="#dfca93"/>`;
 else if(body==='repair')shape=`<rect x="47" y="24" width="46" height="43" rx="14" fill="${c}"/>${eyes}<path d="M57 66L50 79M83 66L90 79" stroke="${c}" stroke-width="10"/><path d="M92 58L110 35M104 26Q95 44 113 43L118 34" fill="none" stroke="#4c7774" stroke-width="7"/><path d="M70 51V63M64 57H76" stroke="#f2ffdf" stroke-width="5"/>`;
 else if(body==='magnet')shape=`<path d="M39 56L28 32M101 56L111 32" stroke="${c}" stroke-width="10"/><path d="M31 29V14H45V28Q45 42 59 28V14H73V29Q73 59 45 53" transform="translate(37 2) scale(.85)" fill="#b56169"/><path d="M45 76L50 37H90L97 76Z" fill="${c}"/>${eyes}<path d="M66 55L58 68H73L68 77L85 59H71L77 49Z" fill="#f0dc9b"/>`;
 else {shape=`<path d="M42 72L48 48H92L98 72Z" fill="${c}"/><rect x="48" y="19" width="44" height="34" rx="${body==='mech'?4:10}" fill="${c}"/>${eyes}`;
  if(body==='guard')shape+=`<path d="M25 40L46 35L56 51L48 75L33 81L23 63Z" fill="#738f99" stroke="#e9d898" stroke-width="4"/><path d="M38 44V70M28 53H49" stroke="#c6d8d1" stroke-width="4"/><path d="M94 53L109 74" stroke="${c}" stroke-width="12"/>`;
  else if(body==='spring')shape+=`<path d="M57 66L49 70L63 74L49 78H63M83 66L76 70L90 74L76 78H90" fill="none" stroke="#526d6b" stroke-width="4"/><path d="M43 51L28 34M97 51L112 34" stroke="${c}" stroke-width="9"/>`;
  else if(body==='mech')shape+=`<rect x="25" y="38" width="23" height="38" rx="5" fill="${c}"/><rect x="93" y="38" width="23" height="38" rx="5" fill="${c}"/><rect x="44" y="69" width="20" height="12" rx="4" fill="#41686b"/><rect x="77" y="69" width="20" height="12" rx="4" fill="#41686b"/><circle cx="70" cy="61" r="8" fill="#bce6d4"/>`;
  else if(body==='apprentice')shape+='<path d="M41 27L70 10L99 27Z" fill="#d8bf76"/><rect x="35" y="49" width="16" height="21" rx="4" fill="#8b7152"/><path d="M94 54L105 71" stroke="#6e9fb0" stroke-width="8"/>';
  else shape+=`<path d="M35 51L25 70M100 52L110 69" stroke="${c}" stroke-width="10"/><circle cx="58" cy="26" r="9" fill="none" stroke="#486865" stroke-width="5"/><circle cx="82" cy="26" r="9" fill="none" stroke="#486865" stroke-width="5"/><path d="M60 60H80M70 50V70" stroke="#f2e2aa" stroke-width="6"/>`;
 }
 return `<svg viewBox="0 0 140 90" aria-hidden="true"><ellipse cx="70" cy="81" rx="43" ry="5" fill="#153e3629"/>${shape}</svg>`;
}
