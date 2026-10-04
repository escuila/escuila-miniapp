/* Category workspace. Permissions and concurrent-edit checks live on the API. */
(function () {
  'use strict';
  window.EscuilaAdminWorkspace = {
    renderCategories: function (ctx, top) {
      var el = ctx.el, button = ctx.button, view = ctx.view;
      view.innerHTML = '';
      view.appendChild(ctx.title('تنظيم الأقسام', button('إضافة قسم', 'primary-btn', function () { edit(null); })));
      view.appendChild(el('p', 'screen-description', 'رتّب أقسام المكتبة، وعدّل أسماءها ومكانها وظهورها.'));
      var host = el('div', 'category-workspace'); view.appendChild(host);
      var items = [], loaded = false;
      load();
      function load() {
        host.innerHTML = ''; host.appendChild(el('p', 'loading', 'جارٍ تحميل الأقسام…'));
        ctx.api('/api/admin/categories').then(function (r) {
          if (!host.isConnected) return;
          items = r.items; loaded = true; draw();
        }).catch(function (e) { host.innerHTML = ''; host.appendChild(el('p', 'resource-error', e.message)); host.appendChild(button('إعادة المحاولة', 'secondary-btn', load)); });
      }
      function draw() {
        host.innerHTML = '';
        var tools = el('div', 'category-tools');
        var search = el('input', 'admin-input'); search.type = 'search'; search.placeholder = 'ابحث عن قسم…'; search.setAttribute('aria-label', 'البحث في الأقسام'); search.value = top.query || '';
        var filter = el('select', 'admin-input'); filter.setAttribute('aria-label', 'ظهور الأقسام');
        [['all','كل الأقسام'],['visible','الظاهرة'],['hidden','المخفية']].forEach(function (pair) { var option = el('option', null, pair[1]); option.value = pair[0]; filter.appendChild(option); });
        filter.value = top.filter || 'all'; tools.appendChild(search); tools.appendChild(filter); host.appendChild(tools);
        var list = el('div', 'category-list'); host.appendChild(list);
        search.addEventListener('input', function () { top.query = search.value; top.offset = 0; results(); });
        filter.addEventListener('change', function () { top.filter = filter.value; top.offset = 0; results(); });
        results();
        function results() {
          list.innerHTML = '';
          var words = ctx.normalize(top.query || '').split(/\s+/).filter(Boolean);
          var matched = items.filter(function (item) { return words.every(function (w) { return ctx.normalize(item.path).indexOf(w) !== -1; }) && (filter.value === 'all' || item.effective_visible === (filter.value === 'visible')); });
          list.appendChild(el('p', 'resource-count', matched.length + ' قسم'));
          var offset = top.offset || 0;
          matched.slice(offset, offset + 30).forEach(function (item) {
            var row = button('', 'category-row', function () { edit(item); });
            row.appendChild(el('strong', null, item.name));
            row.appendChild(el('span', 'category-path', item.path));
            row.appendChild(el('span', 'resource-row-meta', item.direct_files + ' مورد · ' + item.children + ' قسم فرعي'));
            row.appendChild(el('span', 'category-status', (item.effective_visible ? 'ظاهر' : 'مخفي') + ' · ' + (item.effective_premium ? 'VIP' : 'مجاني')));
            list.appendChild(row);
          });
          if (!matched.length) list.appendChild(el('p', 'empty', 'لا توجد أقسام مطابقة.'));
          var pages = el('div', 'btn-row content-pagination');
          if (offset) pages.appendChild(button('السابق', 'secondary-btn', function () { top.offset = Math.max(0, offset - 30); results(); }));
          if (offset + 30 < matched.length) pages.appendChild(button('التالي', 'secondary-btn', function () { top.offset = offset + 30; results(); }));
          list.appendChild(pages);
        }
      }
      function edit(item) {
        if (!loaded) { ctx.toast('انتظر تحميل الأقسام أولًا'); return; }
        host.innerHTML = '';
        var form = el('form', 'resource-form category-form');
        form.appendChild(el('h2', 'screen-heading', item ? 'تعديل القسم' : 'قسم جديد'));
        var controls = {};
        function field(key, label, value, options) {
          var wrap = el('label', 'resource-field'); wrap.appendChild(el('span', null, label));
          var input = el(options ? 'select' : 'input', 'admin-input'); input.setAttribute('data-field', key);
          if (options) options.forEach(function (option) { var node = el('option', null, option[1]); node.value = option[0]; input.appendChild(node); });
          else input.type = key === 'sort_order' ? 'number' : 'text';
          input.value = value; controls[key] = input; wrap.appendChild(input); form.appendChild(wrap); return input;
        }
        var name = field('name', 'اسم القسم', item ? item.name : ''); name.required = true; name.maxLength = 100;
        function validParent(candidate) {
          var byId = {}; items.forEach(function (row) { byId[row.id] = row; });
          var cur = candidate, seen = {};
          while (cur && !seen[cur.id]) { if (item && cur.id === item.id) return false; seen[cur.id] = true; cur = byId[cur.parent_id]; }
          return !cur;
        }
        var parents = [['', 'قسم رئيسي في المكتبة']].concat(items.filter(validParent).map(function (row) { return [String(row.id), row.path]; }));
        field('parent_id', 'داخل القسم', item && item.parent_id !== null ? String(item.parent_id) : '', parents);
        field('is_visible', 'ظهور القسم', item ? String(!!item.is_visible) : 'true', [['true','ظاهر للمستخدمين'],['false','مخفي مؤقتًا']]);
        field('is_premium', 'الوصول للقسم', item ? String(!!item.is_premium) : 'false', [['false','مجاني'],['true','خاص بمشتركي VIP']]);
        var order = field('sort_order', 'الترتيب · الرقم الأصغر يظهر أولًا', item ? item.sort_order : 0); order.min = -10000; order.max = 10000; order.step = 1;
        var note = el('p', 'resource-editor-note'); form.appendChild(note);
        function accessNote() {
          var parent = items.find(function (row) { return String(row.id) === controls.parent_id.value; });
          note.textContent = 'تغيير الظهور أو الوصول يشمل موارد القسم وأقسامه الفرعية.' + (parent && !parent.effective_visible ? ' القسم الرئيسي مخفي، لذلك سيبقى هذا القسم مخفيًا.' : '') + (parent && parent.effective_premium ? ' القسم الرئيسي خاص بـ VIP.' : '');
        }
        controls.parent_id.addEventListener('change', accessNote); accessNote();
        var error = el('p', 'resource-error'); error.setAttribute('role', 'alert'); error.hidden = true; form.appendChild(error);
        var actions = el('div', 'resource-actions');
        var save = button('حفظ القسم', 'primary-btn', function () {
          if (!form.reportValidity() || save.disabled) return;
          save.disabled = true; error.hidden = true;
          ctx.api('/api/admin/category', {method:'POST', body:{id:item ? item.id : null, stamp:item ? item.stamp : null, data:{name:name.value, parent_id:controls.parent_id.value ? Number(controls.parent_id.value) : null, is_visible:controls.is_visible.value === 'true', is_premium:controls.is_premium.value === 'true', sort_order:Number(order.value)}}}).then(function () {
            ctx.toast('حُفظ القسم'); ctx.refreshCatalog(); load();
          }).catch(function (e) { save.disabled = false; error.textContent = e.message; error.hidden = false; });
        });
        actions.appendChild(save); actions.appendChild(button('العودة للأقسام', 'secondary-btn', draw)); form.appendChild(actions);
        form.addEventListener('submit', function (e) { e.preventDefault(); save.click(); }); host.appendChild(form);
      }
    }
  };
})();
