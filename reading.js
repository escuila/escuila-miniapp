/* Escuila reader — native scrolling, bounded canvases and authenticated ranges.
 * PDF.js 6.4.299 (Apache-2.0), loaded only when a PDF is opened. */
(function () {
  'use strict';
  var modulePromise;
  var KEY = 'escuila_reading_v1';
  var paths = {back:'m15 18-6-6 6-6',more:'M5 12h.01M12 12h.01M19 12h.01',close:'m6 6 12 12M6 18 18 6',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',share:'M8 11l8-5M8 13l8 5M6 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M18 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6M18 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6',fit:'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4',plus:'M12 5v14M5 12h14',minus:'M5 12h14',full:'M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6'};
  function node(tag, cls, text) { var n=document.createElement(tag); if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n; }
  function button(label, icon, action) {
    var b=node('button','reading-icon'); b.type='button'; b.setAttribute('aria-label',label);b.title=label;
    b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+paths[icon]+'"/></svg>';
    b.addEventListener('click',action);return b;
  }
  function progress(id) { try {return JSON.parse(localStorage.getItem(KEY)||'{}')[id]||null;}catch(e){return null;} }
  function save(id, value) {
    try {var all=JSON.parse(localStorage.getItem(KEY)||'{}');all[id]=value;var keys=Object.keys(all).sort(function(a,b){return all[b].t-all[a].t;});keys.slice(50).forEach(function(k){delete all[k];});localStorage.setItem(KEY,JSON.stringify(all));}catch(e){}
  }
  function mount(options) {
    var alive=true,pdf=null,task=null,pages=[],current=1,zoom=1,queue=[],busy=false,epoch=0,hideTimer,saveTimer,frame,resizeTimer,pinch=null,restoring=true,pop=null,lastToolTime=0;
    var last=options.resume===false?null:progress(options.id),restored=false,imageUrl=null,imageAbort=null;
    var root=node('section','reading');root.setAttribute('aria-label','قارئ PDF');
    var viewport=node('div','reading-viewport');viewport.dir='ltr';viewport.tabIndex=0;viewport.setAttribute('aria-label','صفحات الملف');
    var content=node('div','reading-pages');viewport.appendChild(content);
    var chrome=node('header','reading-top');chrome.dir='rtl';
    chrome.appendChild(button('رجوع','back',options.back));
    var title=node('div','reading-title',options.name);chrome.appendChild(title);
    var more=button('خيارات القراءة','more',showMenu);chrome.appendChild(more);
    var bottom=node('div','reading-bottom');bottom.dir='rtl';
    var pageButton=node('button','reading-page-count','— / —');pageButton.type='button';pageButton.setAttribute('aria-label','الانتقال إلى صفحة');pageButton.addEventListener('click',showJump);bottom.appendChild(pageButton);
    if(options.format==='image')pageButton.hidden=true;
    bottom.appendChild(button('ملاءمة العرض','fit',function(){setZoom(1);}));
    bottom.appendChild(button('تصغير','minus',function(){setZoom(zoom/1.25);}));
    var scaleLabel=node('span','reading-scale','100%');bottom.appendChild(scaleLabel);
    bottom.appendChild(button('تكبير','plus',function(){setZoom(zoom*1.25);}));
    var loading=node('div','reading-loading');loading.setAttribute('role','status');
    var paper=node('div','reading-loading-paper');for(var l=0;l<6;l++)paper.appendChild(node('i'));loading.appendChild(paper);
    loading.appendChild(node('strong',null,'نجهّز ملفك للقراءة'));
    var loadText=node('span',null,'لحظات وتظهر الصفحة الأولى…');loading.appendChild(loadText);
    root.appendChild(viewport);root.appendChild(loading);root.appendChild(chrome);root.appendChild(bottom);options.host.appendChild(root);
    document.body.classList.add('reading-mode');
    function tools() {lastToolTime=Date.now();root.classList.remove('reading-hidden');clearTimeout(hideTimer);if(!pop)hideTimer=setTimeout(function(){if(alive&&!chrome.contains(document.activeElement)&&!bottom.contains(document.activeElement))root.classList.add('reading-hidden');},2800);}
    function closePop(){if(pop){pop.remove();pop=null;}tools();}
    function panel(label) {closePop();pop=node('div','reading-pop');pop.dir='rtl';pop.setAttribute('role','dialog');pop.setAttribute('aria-label',label);var head=node('div','reading-pop-head');head.appendChild(node('strong',null,label));head.appendChild(button('إغلاق','close',closePop));pop.appendChild(head);root.appendChild(pop);clearTimeout(hideTimer);return pop;}
    function showMenu(){var p=panel('خيارات القراءة');[['تحميل','download',options.download],['مشاركة','share',options.share],['ملء الشاشة','full',fullscreen]].forEach(function(item){if(!item[2])return;var b=button(item[0],item[1],function(){closePop();item[2](b);});b.classList.add('reading-menu-action');b.appendChild(node('span',null,item[0]));p.appendChild(b);});p.querySelector('button').focus();}
    function showJump(){if(!pdf)return;var p=panel('انتقل إلى صفحة');var form=node('form','reading-jump');var input=node('input');input.type='number';input.inputMode='numeric';input.min='1';input.max=pdf.numPages;input.value=current;input.setAttribute('aria-label','رقم الصفحة');var submit=node('button',null,'انتقال');submit.type='submit';form.appendChild(input);form.appendChild(submit);p.appendChild(form);p.appendChild(node('p',null,'من 1 إلى '+pdf.numPages));form.addEventListener('submit',function(event){event.preventDefault();var number=Number(input.value);if(!Number.isInteger(number)||number<1||number>pdf.numPages){input.setCustomValidity('اختر رقمًا من 1 إلى '+pdf.numPages);input.reportValidity();return;}input.setCustomValidity('');closePop();jump(number);});input.addEventListener('input',function(){input.setCustomValidity('');});input.focus();input.select();}
    function fullscreen(){try{if(options.tg&&options.tg.requestFullscreen){options.tg.requestFullscreen();return;}if(document.fullscreenElement){document.exitFullscreen();}else if(root.requestFullscreen){var promise=root.requestFullscreen();if(promise&&promise.catch)promise.catch(function(){});}}catch(e){}tools();}
    function dimensions(p){var width=Math.max(220,Math.min(900,viewport.clientWidth-24))*zoom;return {width:width,height:width*p.ratio};}
    function layout(){pages.forEach(function(p){var d=dimensions(p);p.node.style.width=d.width+'px';p.node.style.height=d.height+'px';});content.style.width=Math.max(viewport.clientWidth,Math.max(220,Math.min(900,viewport.clientWidth-24))*zoom+24)+'px';}
    function position(){var p=pages[current-1];return p?{page:current,fraction:Math.max(0,Math.min(1,(viewport.scrollTop-p.node.offsetTop)/p.node.offsetHeight))}:{page:1,fraction:0};}
    function persist(){if(!pdf||restoring||options.resume===false)return;var at=position();save(options.id,{page:at.page,fraction:at.fraction,total:pdf.numPages,zoom:zoom,t:Date.now()});}
    function jump(number,fraction){var p=pages[number-1];if(!p)return;var gap=fraction?0:pages[0].node.offsetTop;viewport.scrollTop=Math.max(0,p.node.offsetTop+p.node.offsetHeight*(fraction||0)-gap);current=number;schedule();tools();}
    function drop(p){if(p.render){p.render.cancel();p.render=null;}if(p.canvas){p.canvas.width=0;p.canvas.height=0;p.canvas.remove();p.canvas=null;}p.done=false;}
    function setZoom(value,anchor){if(!pdf)return;var at=position(),old=zoom,anchorPage=null,fraction=0,horizontal=0;
      if(anchor){var y=viewport.scrollTop+anchor.y;anchorPage=pages.find(function(p){return p.node.offsetTop+p.node.offsetHeight>=y;})||pages[pages.length-1];fraction=(y-anchorPage.node.offsetTop)/anchorPage.node.offsetHeight;horizontal=viewport.scrollLeft+anchor.x-anchorPage.node.offsetLeft;}
      zoom=Math.max(1,Math.min(3.5,value));if(Math.abs(old-zoom)<0.01)return;epoch++;pages.forEach(drop);layout();scaleLabel.textContent=Math.round(zoom*100)+'%';jump(at.page,at.fraction);
      if(anchor){viewport.scrollTop=anchorPage.node.offsetTop+anchorPage.node.offsetHeight*fraction-anchor.y;viewport.scrollLeft=Math.max(0,anchorPage.node.offsetLeft+horizontal*(zoom/old)-anchor.x);}else viewport.scrollLeft=Math.max(0,(content.offsetWidth-viewport.clientWidth)/2);schedule();tools();}
    function findPage(){var middle=viewport.scrollTop+Math.min(100,viewport.clientHeight*.2),low=0,high=pages.length-1;while(low<high){var m=Math.floor((low+high)/2);if(pages[m].node.offsetTop+pages[m].node.offsetHeight<middle)low=m+1;else high=m;}return low+1;}
    function schedule(){if(!alive||!pdf)return;current=findPage();pageButton.textContent=current+' / '+pdf.numPages;pageButton.setAttribute('aria-label','الصفحة '+current+' من '+pdf.numPages+'، الانتقال إلى صفحة');var wanted=[current,current+1,current-1,current+2].filter(function(n){return n>0&&n<=pages.length;});pages.forEach(function(p){if(wanted.indexOf(p.number)<0&&(p.canvas||p.render))drop(p);});queue=wanted.filter(function(n){return !pages[n-1].done;});draw();clearTimeout(saveTimer);saveTimer=setTimeout(persist,400);}
    async function draw(){while(queue.length&&pages[queue[0]-1].done)queue.shift();if(busy||!alive||!pdf||!queue.length)return;busy=true;var n=queue.shift(),p=pages[n-1],generation=epoch;
      try{var page=await pdf.getPage(n);if(!alive||generation!==epoch)return;var native=page.getViewport({scale:1});var ratio=native.height/native.width;if(Math.abs(p.ratio-ratio)>.01){var before=p.node.offsetHeight;p.ratio=ratio;layout();if(n<current)viewport.scrollTop+=p.node.offsetHeight-before;}
        if(Math.abs(n-current)>2)return;
        var d=dimensions(p),scale=d.width/native.width;var density=Math.min(window.devicePixelRatio||1,1.75,Math.sqrt(2500000/(d.width*d.height)));var screen=page.getViewport({scale:scale});var canvas=node('canvas','reading-canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label','الصفحة '+n);canvas.width=Math.max(1,Math.floor(screen.width*density));canvas.height=Math.max(1,Math.floor(screen.height*density));canvas.style.width='100%';canvas.style.height='100%';if(p.canvas)drop(p);p.canvas=canvas;p.node.appendChild(canvas);
        p.render=page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport:screen,transform:density===1?null:[density,0,0,density,0,0],background:'rgb(255,255,255)'});await p.render.promise;
        if(!alive||generation!==epoch)return;p.render=null;p.done=true;page.cleanup();
        if(!restored){restored=true;loading.remove();root.classList.add('reading-ready');restoring=false;tools();}
      }catch(error){if(alive&&error.name!=='RenderingCancelledException'){p.node.classList.add('reading-page-error');p.node.dataset.error='تعذّر عرض الصفحة';}}finally{busy=false;if(alive){if(queue.length)draw();else if(!restored&&pdf){loading.remove();restoring=false;}}}
    }
    function onScroll(){if(pinch)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(schedule);if(!pop&&Date.now()-lastToolTime>600&&!chrome.contains(document.activeElement)&&!bottom.contains(document.activeElement))root.classList.add('reading-hidden');}
    viewport.addEventListener('scroll',onScroll,{passive:true});
    var clickTime=0;
    viewport.addEventListener('click',function(event){if(pinch||event.target.closest('button'))return;var now=Date.now();if(now-clickTime<300){setZoom(zoom>1.1?1:2);clickTime=0;return;}clickTime=now;root.classList.toggle('reading-hidden');if(!root.classList.contains('reading-hidden'))tools();});
    root.addEventListener('focusin',tools);
    function distance(touches){return Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);}
    viewport.addEventListener('touchstart',function(event){if(event.touches.length!==2)return;var rect=viewport.getBoundingClientRect();pinch={distance:distance(event.touches),zoom:zoom,ratio:1,x:(event.touches[0].clientX+event.touches[1].clientX)/2-rect.left,y:(event.touches[0].clientY+event.touches[1].clientY)/2-rect.top};content.style.transformOrigin=(viewport.scrollLeft+pinch.x)+'px '+(viewport.scrollTop+pinch.y)+'px';},{passive:true});
    viewport.addEventListener('touchmove',function(event){if(!pinch||event.touches.length!==2)return;event.preventDefault();pinch.ratio=Math.max(1/pinch.zoom,Math.min(3.5/pinch.zoom,distance(event.touches)/pinch.distance));content.style.transform='scale('+pinch.ratio+')';},{passive:false});
    function endPinch(){if(!pinch)return;var lastPinch=pinch;pinch=null;content.style.transform='';setZoom(lastPinch.zoom*lastPinch.ratio,lastPinch);schedule();}
    viewport.addEventListener('touchend',endPinch,{passive:true});viewport.addEventListener('touchcancel',endPinch,{passive:true});
    function onResize(){clearTimeout(resizeTimer);resizeTimer=setTimeout(function(){if(!alive||!pdf)return;var at=position();epoch++;pages.forEach(drop);layout();jump(at.page,at.fraction);},120);}
    window.addEventListener('resize',onResize);
    root.addEventListener('keydown',function(event){if(event.key==='Escape'){if(pop)closePop();else options.back();}if(event.target.tagName==='INPUT')return;if(event.key==='ArrowRight'||event.key==='PageDown'){event.preventDefault();jump(Math.min(current+1,pages.length));}else if(event.key==='ArrowLeft'||event.key==='PageUp'){event.preventDefault();jump(Math.max(1,current-1));}});
    async function initialize(pdfDocument){pdf=pdfDocument;if(!alive)return;var first=await pdf.getPage(1);var size=first.getViewport({scale:1});var fragment=document.createDocumentFragment();for(var i=1;i<=pdf.numPages;i++){var pnode=node('div','reading-page');pnode.dataset.page=i;var placeholder=node('span','reading-placeholder',i);placeholder.setAttribute('aria-hidden','true');pnode.appendChild(placeholder);pages.push({number:i,node:pnode,ratio:size.height/size.width,done:false});fragment.appendChild(pnode);}content.appendChild(fragment);layout();var resume=last?Math.max(1,Math.min(pdf.numPages,last.page||1)):1;jump(resume,last?last.fraction:0);schedule();}
    async function load(){try{
      if(options.format==='image'){
        root.setAttribute('aria-label','عارض الصور');imageAbort=new AbortController();var response=await fetch(options.url,{headers:options.headers,signal:imageAbort.signal});if(!response.ok){var failure=new Error('image unavailable');failure.status=response.status;throw failure;}var blob=await response.blob();if(!alive)return;imageUrl=URL.createObjectURL(blob);var image=new Image();image.src=imageUrl;await image.decode();if(!alive)return;
        var imagePage={getViewport:function(args){return {width:image.naturalWidth*args.scale,height:image.naturalHeight*args.scale};},cleanup:function(){},render:function(args){var ctx=args.canvasContext;if(args.transform)ctx.setTransform.apply(ctx,args.transform);ctx.fillStyle='white';ctx.fillRect(0,0,args.viewport.width,args.viewport.height);ctx.drawImage(image,0,0,args.viewport.width,args.viewport.height);return {promise:Promise.resolve(),cancel:function(){}};}};
        await initialize({numPages:1,getPage:function(){return Promise.resolve(imagePage);}});return;
      }
      if(!modulePromise)modulePromise=import('./vendor/pdfjs/pdf.mjs');var engine=await modulePromise;if(!alive)return;
      engine.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.mjs',location.href).href;
      task=engine.getDocument({url:options.url,httpHeaders:options.headers||{},withCredentials:false,rangeChunkSize:262144,disableAutoFetch:true,disableStream:true,isEvalSupported:false,enableXfa:false,canvasMaxAreaInBytes:16000000,standardFontDataUrl:new URL('./vendor/pdfjs/standard_fonts/',location.href).href,cMapUrl:'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/cmaps/',cMapPacked:true,wasmUrl:new URL('./vendor/pdfjs/wasm/',location.href).href});
      task.onProgress=function(data){if(!alive)return;if(data.total>0)loadText.textContent='جارٍ تجهيز الصفحات · '+Math.min(100,Math.round(data.loaded/data.total*100))+'%';};
      task.onPassword=function(update,reason){loading.remove();var p=panel(reason===2?'كلمة المرور غير صحيحة':'هذا الملف محمي');var form=node('form','reading-jump');var input=node('input');input.type='password';input.setAttribute('aria-label','كلمة مرور الملف');input.autocomplete='off';var send=node('button',null,'فتح');form.appendChild(input);send.type='submit';form.appendChild(send);p.appendChild(form);form.addEventListener('submit',function(event){event.preventDefault();update(input.value);closePop();});input.focus();};
      await initialize(await task.promise);
    }catch(error){if(!alive)return;loading.innerHTML='';loading.classList.add('reading-failure');loading.appendChild(node('span','reading-error-symbol','!'));loading.appendChild(node('strong',null,'تعذّر فتح الملف'));loading.appendChild(node('p',null,error.name==='InvalidPDFException'?'قد يكون الملف تالفًا أو غير مكتمل. جرّب تحميله.':'تحقق من اتصالك ثم حاول مجددًا.'));var retry=node('button','reading-retry','إعادة المحاولة');retry.type='button';retry.addEventListener('click',options.retry);loading.appendChild(retry);root.classList.remove('reading-hidden');clearTimeout(hideTimer);if(options.onError)options.onError(error);}}
    load();
    return {destroy:function(){persist();alive=false;epoch++;cancelAnimationFrame(frame);clearTimeout(hideTimer);clearTimeout(saveTimer);clearTimeout(resizeTimer);window.removeEventListener('resize',onResize);pages.forEach(drop);if(task)task.destroy().catch(function(){});if(imageAbort)imageAbort.abort();if(imageUrl)URL.revokeObjectURL(imageUrl);document.body.classList.remove('reading-mode');if(document.fullscreenElement===root)document.exitFullscreen().catch(function(){});root.remove();}};
  }
  window.EscuilaReader={mount:mount,progress:progress};
}());
