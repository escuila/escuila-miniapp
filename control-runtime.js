/* Supported settings apply to the real app. Preview never grants file access. */
(function(){'use strict';
  var preview=window.parent!==window&&new URLSearchParams(location.search).get('control-preview')==='1',settings={},role='ordinary',roleHandler=null,queued=false;
  var root=document.documentElement,homeIds=['welcome','admin','filters','shortcuts','latest','site','vip'];
  function safe(url){try{var u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch(e){return '';}}
  function text(node,value){if(node&&typeof value==='string'&&node.textContent!==value)node.textContent=value;}
  function attr(node,name,value){if(node&&node.getAttribute(name)!==String(value))node.setAttribute(name,String(value));}
  function mode(){return root.dataset.controlMode||(window.Telegram&&Telegram.WebApp&&Telegram.WebApp.colorScheme)||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');}
  function colors(){var d=settings.design;if(!d)return;var c=d[mode()]||d.light||{};Object.keys({primary:1,background:1,surface:1,text:1}).forEach(function(key){if(!/^#[a-f0-9]{6}$/i.test(c[key]||''))return;({primary:['--btn','--link','--brand','--escuila-primary'],background:['--bg','--secondary-bg'],surface:['--surface','--card-bg'],text:['--text']})[key].forEach(function(v){root.style.setProperty(v,c[key]);if(document.body)document.body.style.setProperty(v,c[key]);});});
    root.style.setProperty('--control-font-size',(Number(d.font_size)||15)+'px');root.style.setProperty('--control-radius',(Number(d.radius)||18)+'px');root.style.setProperty('--control-space',(Number(d.spacing)||14)+'px');root.style.setProperty('--control-card-padding',(Number(d.card_padding)||16)+'px');
    root.style.setProperty('--control-font',d.font==='system'?'-apple-system, "Segoe UI", Tahoma, Arial, sans-serif':({'Tahoma':1,'Arial':1,'sans-serif':1,'serif':1}[d.font]?d.font:'Tahoma'));
    attr(root,'data-card-layout',d.card_layout||'grid');attr(root,'data-card-image',d.card_image===false?'hide':'show');attr(root,'data-image-ratio',d.image_ratio||'landscape');
  }
  function annotate(node,key){attr(node,'data-design-element',key);}
  function update(){queued=false;var d=settings.design;if(!d)return;
    if(document.body)document.body.classList.toggle('dark',mode()==='dark');colors();var logo=document.getElementById('logo');annotate(logo,'logo');if(d.logo_url&&safe(d.logo_url)&&logo.src!==safe(d.logo_url))logo.src=safe(d.logo_url);
    var search=document.getElementById('search');if(!search)search=document.querySelector('#searchwrap input');annotate(document.getElementById('searchwrap'),'search');if(search&&d.texts)attr(search,'placeholder',d.texts.search);
    annotate(document.getElementById('bottombar'),'navigation');
    (d.navigation||[]).forEach(function(n){var node=document.querySelector('#bottombar [data-tab="'+(n.id==='bag'?'favs':n.id)+'"]');if(!node)return;node.hidden=!n.visible;text(node.querySelector('.tlabel'),n.label);node.style.order=(d.navigation||[]).indexOf(n);});
    var welcome=document.querySelector('.home-welcome');if(welcome){text(welcome.querySelector('h1'),d.texts.home_title);text(welcome.querySelector('p'),d.texts.home_intro);
      var view=welcome.parentElement,groups={welcome:[welcome],admin:[view.querySelector('.home-admin')],filters:[view.querySelector('.home-filter')],shortcuts:[view.querySelector('.quick-resources')],site:[view.querySelector('.home-source-link')],vip:[view.querySelector('.member-home-link')]};
      var grid=view.querySelector('.latest-grid');groups.latest=grid?[grid.previousElementSibling,grid]:[];
      if(grid&&grid.previousElementSibling)text(grid.previousElementSibling.querySelector('span')||grid.previousElementSibling.firstChild,d.texts.latest);
      (d.home||homeIds.map(function(id){return{id:id,visible:true};})).forEach(function(section,index){(groups[section.id]||[]).filter(Boolean).forEach(function(node){annotate(node,'home:'+section.id);node.hidden=!section.visible;node.style.order=index;});});
      attr(view,'data-control-home','true');var f=d.filters||{};var labels=view.querySelectorAll('.home-filter-fields label');if(labels[0])labels[0].hidden=f.level===false;if(labels[1])labels[1].hidden=f.type===false;var programme=view.querySelector('.programme-picker');if(programme)programme.hidden=f.programme===false;
    }
    if(!welcome){var contentHost=document.getElementById('view');if(contentHost)contentHost.removeAttribute('data-control-home');}
    document.querySelectorAll('.attachment-site-btn').forEach(function(n){if(n.dataset.sourceCaption==='files')text(n.querySelector('span:last-child'),d.texts.site_download);annotate(n,'texts:site_download');});
    document.querySelectorAll('[data-design-element="texts:files"]').forEach(function(n){text(n.querySelector('span:last-child'),d.texts.files);});
    document.querySelectorAll('[data-reader-action]').forEach(function(n){var r=settings.reader||{};n.hidden=r[n.dataset.readerAction+'_enabled']===false;});
    var host=document.getElementById('view');if(host){var notices=(settings.notices&&settings.notices.items||[]).filter(function(n){var time=Date.now();return n.enabled&&Date.parse(n.start)<=time&&Date.parse(n.end)>=time&&(!preview||n.audience==='all'||n.audience===role);});var old=host.querySelector('.control-notices'),signature=JSON.stringify(notices);if(old&&old.dataset.signature!==signature){old.remove();old=null;}if(notices.length&&!old){old=document.createElement('section');old.className='control-notices';old.dataset.signature=signature;notices.forEach(function(n){var card=document.createElement('article'),title=document.createElement('strong'),p=document.createElement('p');title.textContent=n.title;p.textContent=n.text;card.append(title,p);if(safe(n.url)){var a=document.createElement('a');a.href=safe(n.url);a.target='_blank';a.rel='noopener noreferrer';a.textContent='عرض التفاصيل';card.append(a);}old.append(card);});host.prepend(old);}}
    var reader=document.querySelector('.reading');if(reader){['before','after'].forEach(function(slot){var ad=settings.reader&&settings.reader.advertisements&&settings.reader.advertisements[slot],node=reader.querySelector('[data-ad-slot="'+slot+'"]'),show=ad&&ad.enabled&&!(ad.hide_vip&&(role==='vip'||role==='admin'));if(!show){if(node)node.remove();return;}if(!node){node=document.createElement('aside');node.className='control-ad';node.dataset.adSlot=slot;var viewport=reader.querySelector('.reading-viewport');slot==='before'?viewport.prepend(node):viewport.append(node);}var signature=JSON.stringify(ad);if(node.dataset.signature===signature)return;node.dataset.signature=signature;node.replaceChildren();var label=document.createElement('small'),title=document.createElement('strong'),p=document.createElement('p');label.textContent='إعلان';title.textContent=ad.title;p.textContent=ad.text;node.append(label,title,p);if(safe(ad.url)){var a=document.createElement('a');a.href=safe(ad.url);a.target='_blank';a.rel='noopener noreferrer';a.textContent='عرض التفاصيل';node.append(a);}});}
  }
  function schedule(){if(!queued){queued=true;requestAnimationFrame(update);}}
  function apply(value){settings=value||{};window.EscuilaControl.settings=settings;schedule();}
  window.EscuilaControl={preview:preview,settings:settings,apply:apply,onRole:function(fn){roleHandler=fn;fn(role);},setRole:function(value){role=value;if(roleHandler)roleHandler(role);schedule();}};
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  if(window.Telegram&&Telegram.WebApp&&Telegram.WebApp.onEvent)Telegram.WebApp.onEvent('themeChanged',schedule);
  setInterval(function(){if(settings.notices&&settings.notices.items.length)schedule();},60000);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',schedule);
  if(preview){document.addEventListener('click',function(e){var n=e.target.closest('[data-design-element]');if(n){window.parent.postMessage({type:'escuila:select',element:n.dataset.designElement},location.origin);}if(e.target.closest('.attachment-actions,.attachment-manage,.attachment-site-btn,.attachment-conditions,.member-home-link,#headerAdmin')){e.preventDefault();e.stopImmediatePropagation();}},true);
    window.addEventListener('message',function(event){if(event.source!==window.parent||event.origin!==location.origin)return;var m=event.data;if(!m||m.type!=='escuila:preview')return;apply(m.settings);if(['ordinary','vip','admin'].indexOf(m.role)!==-1)window.EscuilaControl.setRole(m.role);if(['light','dark'].indexOf(m.mode)!==-1){root.dataset.controlMode=m.mode;schedule();}});
    window.parent.postMessage({type:'escuila:ready'},location.origin);
  }
})();
