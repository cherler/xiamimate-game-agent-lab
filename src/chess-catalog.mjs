import {UNIT_LIST as FIRST} from './chess-catalog-v1.mjs';
const unit=(id,name,race,role,cost,hp,attackValue,range,skill,art,effect)=>({id,name,race,role,cost,hp,attackValue,range,interval:role==='游击'||role==='刺客'?.95:1.2,skill,art,effect});
export const GUARD_SKILLS={C14:{self:200,nearby:100,seconds:4},C17:{self:220,nearby:100,seconds:4}};
export function chessSkillText(id,version=4,mult=1){
 const shield=GUARD_SKILLS[id];
 if(shield)return version<4?`自身与相邻友军各获得 ${Math.round(100*mult)} 点屏障，持续 4 秒。`:`自身获得 ${Math.round(shield.self*mult)} 点屏障，相邻友军获得 ${Math.round(shield.nearby*mult)} 点，持续 ${shield.seconds} 秒。`;
 return chessInfo(id)?.effect||'';
}
export const UNIT_LIST=[...FIRST.map(c=>({...c,role:c.id==='C08'?'刺客':c.role,skill:c.id})),
 unit('C13','星尘射手','星塔','游击',1,360,52,4,'bolt','S01','星矢：对当前目标造成 180 点伤害。'),
 unit('C14','潮汐卫兵','潮汐','前卫',1,620,38,1,'guard','N02','潮盾：获得 200 点屏障。'),
 unit('C15','逐星者','星塔','刺客',2,460,68,1,'assassin','S03','开战跃向敌方后排，前三击强化。'),
 unit('C16','潮音使','潮汐','术师',2,430,38,3,'heal','F10','潮音：治疗生命最低的三位友军。'),
 unit('C17','月环守卫','星塔','前卫',3,780,55,1,'guard','S04','月环：获得屏障并为相邻友军提供保护。'),
 unit('C18','深流猎手','潮汐','游击',3,620,88,4,'bolt','N10','穿流：对当前目标造成 260 点伤害。'),
 unit('C19','熔炉统领','工坊','前卫',4,1150,85,1,'quake','W05','震荡：伤害周围敌人并获得屏障。'),
 unit('C20','森歌祭司','林地','术师',4,760,55,3,'heal','F11','森歌：为三位受伤友军恢复生命。'),
 unit('C21','暮影猎手','游民','刺客',4,780,120,1,'assassin','N04','开战跃向后排，前三击强化。'),
 unit('C22','晶岩法师','岩灵','术师',4,720,60,4,'nova','C12','碎晶：伤害目标附近的敌人。'),
 unit('C23','彗星先知','星塔','术师',5,900,75,4,'meteor','S11','彗星：对所有敌军造成 240 点伤害。'),
 unit('C24','深海巨灵','潮汐','前卫',5,1500,115,1,'quake','N05','海啸：伤害周围敌人并获得屏障。')
];
export const UNITS=Object.fromEntries(UNIT_LIST.map(c=>[c.id,c]));
export const NEUTRALS={Z01:unit('Z01','荒野潜兽','野怪','野怪',1,250,25,1,'none','W01',''),Z02:unit('Z02','石壳蛮兽','野怪','野怪',2,700,60,1,'none','C10',''),Z03:unit('Z03','夜幕巨兽','野怪','野怪',4,2100,115,2,'none','W05','')};
export const chessInfo=id=>UNITS[id]||NEUTRALS[id];
export const POOL_COPIES={1:30,2:25,3:18,4:12,5:10};
export const SHOP_ODDS={1:[100,0,0,0,0],2:[100,0,0,0,0],3:[70,30,0,0,0],4:[55,30,15,0,0],5:[40,35,23,2,0],6:[30,35,28,7,0],7:[20,30,33,15,2],8:[15,25,35,20,5],9:[10,20,30,30,10],10:[5,15,25,35,20]};
export const LEVEL_XP={1:1,2:1,3:2,4:4,5:8,6:12,7:16,8:24,9:32};
export const LEVEL_COST=Object.fromEntries(Object.entries(LEVEL_XP).map(([level,xp])=>[level,Math.ceil(xp/4)*5]));
export const ITEMS={blade:{name:'精钢刃',icon:'sword',text:'攻击 +20',attack:20},shell:{name:'护心甲',icon:'shield',text:'受到伤害减少 8%',reduction:.08},seed:{name:'生命石',icon:'heart',text:'生命 +200',hp:200},orb:{name:'法力珠',icon:'spark',text:'初始法力 +25',mana:25},bell:{name:'疾风铃',icon:'up',text:'攻击速度 +15%',speed:.15},leaf:{name:'复苏叶',icon:'plus',text:'每 3 秒恢复 3% 生命',regen:.03}};
export const TRAITS={工坊:{thresholds:[2,4],text:['开场屏障 +100','开场屏障 +220']},林地:{thresholds:[2,4],text:['每 3 秒回复 3% 生命','每 3 秒回复 6% 生命']},游民:{thresholds:[2,4],text:['攻击 +12%','攻击 +25%']},岩灵:{thresholds:[2,4],text:['生命 +15%','生命 +30%']},星塔:{thresholds:[2,4],text:['初始法力 +25','初始法力 +50']},潮汐:{thresholds:[2,4],text:['伤害减免 8%','伤害减免 16%']},前卫:{thresholds:[2,4,6],text:['伤害减免 8%','伤害减免 16%','伤害减免 25%']},游击:{thresholds:[2,4,6],text:['攻速 +15%','攻速 +30%','攻速 +50%']},术师:{thresholds:[2,4,6],text:['技能效果 +15%','技能效果 +30%','技能效果 +50%']},刺客:{thresholds:[2,4],text:['每三次普攻额外造成 40% 伤害','每三次普攻额外造成 80% 伤害']}};
