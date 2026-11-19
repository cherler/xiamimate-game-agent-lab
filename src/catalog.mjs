import {CARD_LIST as FOUNDATION} from './catalog-v1.mjs';
const factions={N:'中立',W:'工坊',F:'林地',S:'星塔'};
function card(id,name,cost,attack,health,effect,extra={}){
 return {id,name,cost,attack,health,stats:health?`${attack}／${health}`:'法术',kind:health?'unit':'spell',faction:factions[id[0]],guard:false,shield:false,rush:false,drain:false,role:'',effect,...extra};
}
export const CARD_LIST=[...FOUNDATION.map(c=>({...c})),
 card('N09','灰羽信使',2,2,1,'遗赠：抽 1 张牌。'),
 card('N10','暮色游侠',3,2,3,'汲取。',{drain:true}),
 card('N11','断章术',2,0,0,'沉默一个敌方单位：移除关键词、触发效果和获得的强化。'),
 card('N12','流光箭',1,0,0,'对一个敌方单位造成 1 点伤害，抽 1 张牌。'),
 card('W09','维修学徒',2,1,3,'入场：召唤一个 1／1 零件偶。'),
 card('W10','磁能装配师',3,2,4,'每当你召唤一个召唤物，使它获得 +1 攻击。'),
 card('W11','应急护罩',1,0,0,'使一个友方单位获得护盾和 +0／+2。'),
 card('W12','零件总动员',3,0,0,'召唤两个 1／1 零件偶，然后使所有友方召唤物获得 +1 攻击。'),
 card('F09','新芽使者',2,2,2,'入场：召唤一个 1／1 芽灵。'),
 card('F10','月露祭司',4,2,4,'余辉：为己方英雄恢复 2 点生命。'),
 card('F11','共生古藤',4,2,4,'每当己方英雄实际恢复生命，获得 +1／+1。每次治疗触发一次。'),
 card('F12','繁茂新生',3,0,0,'抉择：萌发，召唤两个芽灵并使所有友方单位 +1 攻击；或回春，治疗英雄 4 点并抽 1 张。',{choices:[{id:'bloom',name:'萌发',text:'召唤两个 1／1 芽灵，使所有友方单位 +1 攻击。'},{id:'renew',name:'回春',text:'为己方英雄恢复 4 点生命，抽 1 张牌。'}]}),
 card('S01','星尘学徒',1,1,3,'每当你施放法术，获得 +1 攻击，每回合最多触发两次。'),
 card('S02','寒星箭',2,0,0,'对一个敌方单位造成 2 点伤害并冰封。'),
 card('S03','双光使者',2,3,2,'连奏：抽 1 张牌。'),
 card('S04','星界守卫',3,2,4,'守护。连奏：获得护盾。',{guard:true}),
 card('S05','观星师',3,3,3,'入场：从牌库抽取 1 张法术牌。没有法术则不抽牌。'),
 card('S06','星火连弹',3,0,0,'对一个敌方角色造成 2 点伤害。连奏：改为 4 点。'),
 card('S07','霜环',4,0,0,'对所有敌方单位同时造成 1 点伤害并冰封。'),
 card('S08','吸星术',3,0,0,'对一个敌方单位造成 3 点伤害。汲取。',{drain:true}),
 card('S09','暮星侍卫',4,3,5,'汲取。',{drain:true}),
 card('S10','星辉导师',5,3,5,'余辉：若本回合施放过法术，召唤一个 2／2 星灵。'),
 card('S11','破晓彗星',6,0,0,'对一个敌方单位造成 7 点伤害，同时对其他敌方单位造成 2 点伤害。'),
 card('S12','双生星使',4,3,4,'连奏：召唤一个 2／2 星灵。')
];
// Third playtest: shield units can hold a board through early trades.
for(const [id,change] of Object.entries({W02:{health:3},W04:{health:4},F04:{attack:4}})){const c=CARD_LIST.find(c=>c.id===id);Object.assign(c,change);c.stats=`${c.attack}／${c.health}`;}
export const CARDS=Object.fromEntries(CARD_LIST.map(c=>[c.id,c]));
export const TOKENS={
 T01:card('T01','零件偶',0,1,1,'召唤物。',{faction:'工坊',token:true}),
 T02:card('T02','维修偶',0,2,2,'召唤物。',{faction:'工坊',token:true}),
 T03:card('T03','芽灵',0,1,1,'召唤物。',{faction:'林地',token:true}),
 T04:card('T04','星灵',0,2,2,'召唤物。',{faction:'星塔',token:true}),
 T07:card('T07','守望幼苗',0,0,2,'守护。召唤物。',{faction:'林地',token:true,guard:true}),
 T06:card('T06','余光水晶',0,0,0,'本回合获得 1 点能量，最多 8 点。',{faction:'中立',token:true}),
 T05:card('T05','萤光火花',0,0,0,'对一个敌方单位造成 1 点伤害。',{faction:'星塔',token:true})
};
const twice=ids=>ids.split(' ').flatMap(id=>[id,id]);
export const PRESETS=[
 {id:'W-swarm',faction:'W',name:'工坊零件潮',style:'召唤与铺场',guide:'先让磁能装配师站住，再召唤零件偶；零件总动员能把小伙伴变成威胁。',deck:twice('N01 N03 N06 W01 W03 W05 W08 W09 W10 W12')},
 {id:'W-shield',faction:'W',name:'工坊重装',style:'护盾与交换',guide:'用护盾吃掉一次伤害，再用应急护罩保住重要单位；沉默可以拆掉对手的成长核心。',deck:twice('N02 N09 N10 N11 W02 W03 W04 W05 W07 W11')},
 {id:'F-growth',faction:'F',name:'林地共生',style:'治疗与成长',guide:'共生古藤需要真正的治疗才会成长。月露祭司和英雄技能可连续触发它。',deck:twice('N03 N06 N10 F01 F02 F03 F05 F06 F10 F11')},
 {id:'F-bloom',faction:'F',name:'林地萌芽',style:'铺场与群体强化',guide:'用芽灵占住战场，再打林地复苏。繁茂新生能在进攻与补给之间做选择。',deck:twice('N01 N06 N12 F01 F02 F04 F06 F08 F09 F12')},
 {id:'S-combo',faction:'S',name:'星塔连奏',style:'出牌顺序与爆发',guide:'先打一张低费牌，再触发连奏。英雄技能提供火花；留下星尘学徒，让法术带来更多攻击。',deck:twice('N09 N12 S01 S02 S03 S04 S05 S06 S10 S12')},
 {id:'S-frost',faction:'S',name:'星塔霜息',style:'冰封与反击',guide:'用流光箭补牌并启动连奏，霜环挡住铺场；双生星使和星火连弹把控场转化为反击。',deck:twice('N02 N12 S06 S07 S02 S04 S12 S08 S09 S11')}
];
export const STARTERS=Object.fromEntries(['W','F','S'].map(f=>[f,PRESETS.find(p=>p.faction===f).deck]));
export const HEROES={
 W:{name:'铜铃工匠',faction:'工坊',power:'火花点射',text:'2 能量，对一个敌方单位造成 1 点伤害。'},
 F:{name:'苔光园丁',faction:'林地',power:'苔光治愈',text:'2 能量，为一个友方角色恢复 2 点生命。'},
 S:{name:'星灯旅者',faction:'星塔',power:'星灯火种',text:'2 能量，获得一张 0 费萤光火花：对一个敌方单位造成 1 点伤害。手牌已满时不能使用。'}
};
export const POWER_ALTERNATIVES={
 W:{id:'assemble',name:'拼装零件',text:'2 能量，召唤一个 1／1 零件偶。与点射共用每回合一次的英雄技能。',icon:'cards',art:'T01',outcome:'召唤 1／1'},
 F:{id:'seedling',name:'守望幼苗',text:'2 能量，召唤一个 0／2 守护幼苗。与治愈共用每回合一次的英雄技能。',icon:'shield',art:'T07',outcome:'0／2 守护'},
 S:{id:'stargaze',name:'燃灯观星',text:'2 能量，自身受到 2 点伤害，抽 1 张牌。与火种共用每回合一次；生命不足或牌库为空时不可用。',icon:'eye',art:'S05',outcome:'−2 生命 · 抽 1'}
};
export const KEYWORDS={
 守护:'普通攻击必须先攻击守护单位；法术不受影响。',护盾:'抵挡下一包伤害，然后消失。',速攻:'入场当回合即可攻击单位，但不能攻击英雄。',
 入场:'从手牌打出该单位时触发，召唤物不会触发。',遗赠:'单位死亡后触发，沉默后失效。',
 连奏:'本回合先打出过另一张牌，才触发额外效果。英雄技能与普通攻击不计作出牌。',
 冰封:'不能攻击；在其控制者下一次结束回合时解除。重复冰封不叠加时长。',
 汲取:'造成实际生命伤害时，为己方英雄回复等量生命。护盾抵挡和溢出伤害不计入。',
 余辉:'在己方回合结束时触发。',沉默:'移除单位关键词、触发效果、冰封和强化，攻击与生命上限恢复基础值；不会补满当前生命。',
 抉择:'打出时选择一种效果，支付一次费用，只执行所选效果。'
};
