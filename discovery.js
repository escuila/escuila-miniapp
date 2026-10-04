/* Small, deterministic facets inferred from existing metadata and labels.
 * These display facets never change a category or an access flag. */
(function(root){
  'use strict';
  function normalize(s){return String(s||'').toLowerCase().normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');}
  var kinds=[
    ['روائز',/رائز|روائز|روايز|diagnostic/,'check'],
    ['فروض',/فرض|فروض|devoir/,'fileText'],
    ['امتحانات',/امتحان|امتحانات|examen/,'fileText'],
    ['جذاذات',/جذاذ|جذاذات|fiche pedagogique/,'folder'],
    ['كراسات',/كراس|كراسه|دفتر|cahier/,'library'],
    ['تمارين',/تمرين|تمارين|exercice/,'edit'],
    ['ملخصات',/ملخص|ملخصات|resume/,'bookOpen'],
    ['دروس',/درس|دروس|cours|lecon/,'bookOpen'],
    ['تصحيحات',/تصحيح|تصحيحات|corrig|correction/,'check'],
    ['تخطيطات',/تخطيط|تخطيطات|توزيع|توزيعات/,'clock'],
    ['وثائق',/وثيقه|وثائق|وثايق|documents/,'file']
  ];
  function detect(s){var n=normalize(s);for(var i=0;i<kinds.length;i++)if(kinds[i][1].test(n))return kinds[i][0];return '';}
  function classify(f,path){var m=f.meta||{};return (m.resource_type&&m.resource_type!=='مورد آخر'?(detect(m.resource_type)||m.resource_type):'')||detect(f.n)||detect((f.labels||[]).concat(path||[]).join(' '))||'موارد أخرى';}
  function programme(f,path){return /رايد|رائد|pionnier|pioneer/.test(normalize([f.n].concat(f.labels||[],path||[]).join(' ')))?'pioneer':'general';}
  function icon(kind){var row=kinds.find(function(k){return k[0]===kind;});return row?row[2]:'file';}
  function format(f){var n=String(f.n||'')+' '+String((f.meta||{}).format||'');if(/\.pdf\b|\bPDF\b/i.test(n))return 'PDF';if(/\.docx?\b|\bword\b/i.test(n))return 'Word';if(/\.pptx?\b|\bpowerpoint\b/i.test(n))return 'PPT';if(/\.xlsx?\b/i.test(n))return 'Excel';return '';}
  var api={classify:classify,programme:programme,icon:icon,format:format};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.EscuilaDiscovery=api;
})(typeof window==='object'?window:globalThis);
