const start = Date.UTC(2026, 10, 19, 10);
const legacyProfile = overrides => ({
 status:'active', role:'member', adminCredits:20,
 state:{
  _syncUid:'student', tasks:[{
   id:'math-1', title:'Ôn Toán', date:'2026-11-19', subjectId:'math',
   minutes:30, pomodoros:1, done:true, coinGain:5,
  }],
  subjects:[{id:'math',name:'Toán',icon:'📐',color:'#cbcdef'}],
  days:{'2026-11-19':{minutes:65,pomoMinutes:50,pomodoros:2,taskCoins:5,note:'Ôn 2 chương',mood:'good'}},
  wallet:{coins:50,totalEarned:75,adminCreditsApplied:5},
  room:{version:2,owned:{plant_small:2},placed:[]},
  streak:{rewarded:{'week:2026-11-16':true,'7':'2026-11-19'}},
  timer:{bySubject:{math:50},pomosBySubject:{math:2}},
 },
 ...overrides,
});
module.exports = {start, legacyProfile};
