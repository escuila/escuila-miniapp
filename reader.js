/* Escuila reader: local PDF.js rendering, images and sanitized articles. */
(function () {
  'use strict';
  var pdfLibrary;
  function pdfjs() {
    if (!pdfLibrary) pdfLibrary = import('./vendor/pdfjs/pdf.mjs').then(function (lib) {
      lib.GlobalWorkerOptions.workerSrc = new URL('vendor/pdfjs/pdf.worker.mjs', document.baseURI).href;
      return lib;
    }).catch(function (e) { pdfLibrary = null; throw e; });
    return pdfLibrary;
  }
  function node(tag, cls, text) {
    var n = document.createElement(tag); if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text; return n;
  }
  function button(label, action) {
    var b = node('button', 'reader-control', label); b.type = 'button';
    b.addEventListener('click', action); return b;
  }
  function safeURL(raw, base) {
    if (!raw || !String(raw).trim()) return null;
    try { var url = new URL(raw, base); return /^https?:$/.test(url.protocol) ? url.href : null; } catch (e) { return null; }
  }
  function articleContent(html, base) {
    var parsed = new DOMParser().parseFromString(html, 'text/html');
    var source = parsed.querySelector('.post-body, .entry-content, article, main') || parsed.body;
    var allowed = ['P','DIV','SPAN','H1','H2','H3','H4','H5','H6','BR','STRONG','B','EM','I','UL','OL','LI','BLOCKQUOTE','PRE','CODE','TABLE','TBODY','THEAD','TR','TH','TD','A','IMG','HR'];
    var drop = ['SCRIPT','STYLE','NOSCRIPT','IFRAME','OBJECT','EMBED','FORM','INPUT','BUTTON','NAV','HEADER','FOOTER','META','LINK'];
    function copy(src, dest) {
      Array.prototype.forEach.call(src.childNodes, function (child) {
        if (child.nodeType === 3) { dest.appendChild(document.createTextNode(child.textContent)); return; }
        if (child.nodeType !== 1 || drop.indexOf(child.tagName) !== -1) return;
        if (allowed.indexOf(child.tagName) === -1) { copy(child, dest); return; }
        var clean = node(child.tagName.toLowerCase());
        if (child.tagName === 'A') {
          var href = safeURL(child.getAttribute('href'), base);
          if (href) { clean.href = href; clean.rel = 'noopener noreferrer'; clean.target = '_blank'; }
        }
        if (child.tagName === 'IMG') {
          var image = safeURL(child.getAttribute('src') || child.getAttribute('data-src'), base);
          if (!image) return;
          clean.src = image; clean.alt = child.getAttribute('alt') || ''; clean.loading = 'lazy'; clean.referrerPolicy = 'no-referrer';
        }
        copy(child, clean); dest.appendChild(clean);
      });
    }
    var result = node('article', 'reader-article'); copy(source, result); return result;
  }
  window.EscuilaReader = {
    articleContent: articleContent,
    mount: function (host, options) {
      var active = true, controller = new AbortController(), task, pdf, renderTask, resizeTimer, pageNumber = 1, zoom = 1, generation = 0;
      var objectURL = null, image = null;
      var key = 'escuila_reading_page_v1_' + options.fileId + '_' + (options.part || 'file');
      host.className = 'escuila-reader';
      var header = node('div', 'reader-header');
      header.appendChild(button('رجوع', options.onBack));
      header.appendChild(node('h1', 'reader-title', options.title));
      var actions = node('div', 'reader-actions');
      actions.appendChild(button('المفضلة', options.onFavorite));
      var source = null;
      var download = button('تحميل', function () { if (source) options.onSource(source); else options.onDownload(); });
      actions.appendChild(download); header.appendChild(actions); host.appendChild(header);
      var tools = node('div', 'reader-tools'); tools.hidden = true;
      var previous = button('السابق', function () { changePage(pageNumber - 1); });
      var next = button('التالي', function () { changePage(pageNumber + 1); });
      var counter = node('input', 'reader-page-input'); counter.type = 'number'; counter.min = 1; counter.setAttribute('aria-label', 'رقم الصفحة');
      var total = node('span', 'reader-page-total');
      counter.addEventListener('change', function () { changePage(Number(counter.value)); });
      var minus = button('−', function () { setZoom(zoom - 0.25); }); minus.setAttribute('aria-label', 'تصغير');
      var plus = button('+', function () { setZoom(zoom + 0.25); }); plus.setAttribute('aria-label', 'تكبير');
      var fit = button('ملاءمة', function () { setZoom(1); });
      [previous,counter,total,next,minus,plus,fit].forEach(function (n) { tools.appendChild(n); }); host.appendChild(tools);
      var status = node('div', 'reader-status', 'جارٍ تجهيز المورد…'); status.setAttribute('role', 'status'); host.appendChild(status);
      var stage = node('div', 'reader-stage'); stage.tabIndex = 0; stage.setAttribute('aria-label', 'محتوى المورد'); host.appendChild(stage);
      var canvas = node('canvas', 'reader-canvas'); canvas.dir = 'ltr'; canvas.setAttribute('aria-label', 'صفحة PDF');
      function message(text) { status.textContent = text; status.hidden = false; }
      function setZoom(value) {
        zoom = Math.max(0.5, Math.min(3, value));
        if (pdf) draw();
        else if (image) { image.style.width = (zoom * 100) + '%'; image.style.maxWidth = 'none'; }
      }
      function changePage(value) {
        if (!pdf || !Number.isFinite(value)) return;
        pageNumber = Math.max(1, Math.min(pdf.numPages, Math.round(value))); stage.scrollTop = 0; stage.scrollLeft = 0; draw();
      }
      async function draw() {
        var current = ++generation;
        if (renderTask) { renderTask.cancel(); try { await renderTask.promise; } catch (e) {} }
        if (!active || !pdf) return;
        counter.value = pageNumber; previous.disabled = pageNumber <= 1; next.disabled = pageNumber >= pdf.numPages;
        message('جارٍ عرض الصفحة…');
        try {
          var page = await pdf.getPage(pageNumber);
          if (!active || current !== generation) return;
          var base = page.getViewport({scale:1});
          var width = Math.max(240, stage.clientWidth - 24);
          var viewport = page.getViewport({scale:width / base.width * zoom});
          var ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(5000000 / (viewport.width * viewport.height)));
          canvas.width = Math.floor(viewport.width * ratio); canvas.height = Math.floor(viewport.height * ratio);
          canvas.style.width = Math.floor(viewport.width) + 'px'; canvas.style.height = Math.floor(viewport.height) + 'px';
          renderTask = page.render({canvasContext:canvas.getContext('2d'),viewport:viewport,transform:ratio !== 1 ? [ratio,0,0,ratio,0,0] : null});
          await renderTask.promise;
          if (!active || current !== generation) return;
          status.hidden = true;
          try { localStorage.setItem(key, String(pageNumber)); } catch (e) {}
        } catch (e) { if (active && current === generation && e.name !== 'RenderingCancelledException') message('تعذّر عرض الصفحة. جرّب صفحة أخرى أو أعد فتح المورد.'); }
      }
      function resize() { clearTimeout(resizeTimer); resizeTimer = setTimeout(function () { if (active && pdf) draw(); }, 180); }
      window.addEventListener('resize', resize);
      Promise.resolve().then(function () { return options.load(controller.signal); }).then(async function (resource) {
        if (!active) return;
        if (resource.kind === 'article') {
          source = resource.source; download.textContent = 'المصدر';
          stage.appendChild(articleContent(resource.html, resource.source)); status.hidden = true; return;
        }
        if (resource.type.indexOf('image/') === 0) {
          image = node('img', 'reader-image'); image.alt = options.title;
          objectURL = URL.createObjectURL(resource.blob);
          image.onload = function () { if (active) status.hidden = true; };
          image.onerror = function () { if (active) message('تعذّر عرض الصورة. أعد المحاولة.'); };
          image.src = objectURL; stage.appendChild(image);
          tools.hidden = false; [previous,counter,total,next].forEach(function (n) { n.hidden = true; }); return;
        }
        var data = new Uint8Array(await resource.blob.arrayBuffer());
        if (!active) return;
        if (resource.type.indexOf('pdf') === -1 && String.fromCharCode.apply(null,data.slice(0,5)) !== '%PDF-') throw new Error('هذا النوع لا يدعم القراءة داخل التطبيق');
        var lib = await pdfjs(); if (!active) return;
        task = lib.getDocument({data:data,isEvalSupported:false,enableXfa:false,useSystemFonts:false,
          standardFontDataUrl:new URL('vendor/pdfjs/standard_fonts/',document.baseURI).href,
          wasmUrl:new URL('vendor/pdfjs/wasm/',document.baseURI).href,
          cMapUrl:'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/cmaps/',cMapPacked:true});
        pdf = await task.promise; if (!active) { pdf.destroy(); return; }
        try { pageNumber = Math.max(1, Math.min(pdf.numPages, Number(localStorage.getItem(key)) || 1)); } catch (e) {}
        counter.max = pdf.numPages; total.textContent = 'من ' + pdf.numPages; tools.hidden = false;
        stage.appendChild(canvas); await draw();
      }).catch(function (error) {
        if (!active || error.name === 'AbortError') return;
        status.hidden = true; options.onError(error, host);
      });
      return function () {
        active = false; generation++; controller.abort(); clearTimeout(resizeTimer); window.removeEventListener('resize', resize);
        if (renderTask) renderTask.cancel(); if (task) task.destroy().catch(function () {});
        if (objectURL) URL.revokeObjectURL(objectURL);
      };
    }
  };
})();
