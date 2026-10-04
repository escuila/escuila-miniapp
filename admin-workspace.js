/* Category workspace. Permissions and concurrent-edit checks live on the API. */
(function () {
  'use strict';
  window.EscuilaAdminWorkspace = {
    renderCategories: function (ctx, top) {
      var el = ctx.el, button = ctx.button, view = ctx.view;
      view.innerHTML = '';
      view.appendChild(ctx.title('تنظيم الأقسام', button('إضافة قسم', 'primary-btn', function () { edit(null); })));
      view.appendChild(el('p', 'screen-description', 'افتح قسمًا لتعديله أو حذفه. رتّب المكتبة حسب المستوى ثم المادة، واحتفظ بالتفاصيل في بطاقة المورد.'));
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
        var review = el('section', 'organization-review');
        review.appendChild(el('h2', null, 'مراجعة التنظيم'));
        review.appendChild(el('p', null, items.length + ' قسم · ' + items.filter(function (row) { return row.parent_id === null; }).length + ' أقسام رئيسية'));
        [['empty','أقسام فارغة قابلة للحذف', function (row) { return row.can_delete; }], ['deep','مسارات طويلة تحتاج مراجعة', function (row) { return row.depth > 3; }]].forEach(function (entry) {
          review.appendChild(button(items.filter(entry[2]).length + ' · ' + entry[1], 'secondary-btn', function () { top.filter = entry[0]; top.offset = 0; draw(); }));
        });
        review.appendChild(el('p', 'category-path', 'نقل القسم يحافظ على موارده وأقسامه الفرعية. حماية VIP تبقى محفوظة عند إعادة التنظيم.'));
        host.appendChild(review);
        var tools = el('div', 'category-tools');
        var search = el('input', 'admin-input'); search.type = 'search'; search.placeholder = 'ابحث عن قسم…'; search.setAttribute('aria-label', 'البحث في الأقسام'); search.value = top.query || '';
        var filter = el('select', 'admin-input'); filter.setAttribute('aria-label', 'تصفية الأقسام');
        [['all','كل الأقسام'],['visible','الظاهرة'],['hidden','المخفية'],['empty','الفارغة القابلة للحذف'],['deep','المسارات الطويلة'],['vip','أقسام VIP']].forEach(function (pair) { var option = el('option', null, pair[1]); option.value = pair[0]; filter.appendChild(option); });
        filter.value = top.filter || 'all'; tools.appendChild(search); tools.appendChild(filter); host.appendChild(tools);
        var list = el('div', 'category-list'); host.appendChild(list);
        search.addEventListener('input', function () { top.query = search.value; top.offset = 0; results(); });
        filter.addEventListener('change', function () { top.filter = filter.value; top.offset = 0; results(); });
        results();
        function results() {
          list.innerHTML = '';
          var words = ctx.normalize(top.query || '').split(/\s+/).filter(Boolean);
          var matched = items.filter(function (item) {
            var match = filter.value === 'all' || filter.value === 'empty' && item.can_delete || filter.value === 'deep' && item.depth > 3 || filter.value === 'vip' && item.effective_premium || filter.value === 'visible' && item.effective_visible || filter.value === 'hidden' && !item.effective_visible;
            return match && words.every(function (w) { return ctx.normalize(item.path).indexOf(w) !== -1; });
          });
          list.appendChild(el('p', 'resource-count', matched.length + ' قسم'));
          var offset = Math.min(top.offset || 0, Math.max(0, Math.floor((matched.length - 1) / 30) * 30)); top.offset = offset;
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
        field('is_premium', 'الوصول للقسم', item ? String(!!item.effective_premium) : 'false', [['false','مجاني'],['true','خاص بمشتركي VIP']]);
        if (item && item.effective_premium) controls.is_premium.querySelector('[value="false"]').disabled = true;
        var order = field('sort_order', 'الترتيب · الرقم الأصغر يظهر أولًا', item ? item.sort_order : 0); order.min = -10000; order.max = 10000; order.step = 1;
        var note = el('p', 'resource-editor-note'); form.appendChild(note);
        function accessNote() {
          var parent = items.find(function (row) { return String(row.id) === controls.parent_id.value; });
          note.textContent = 'نقل القسم يشمل موارده وأقسامه الفرعية.' + (item && item.effective_premium ? ' سيبقى القسم وموارده خاصين بـ VIP بعد النقل.' : parent && parent.effective_premium ? ' القسم الرئيسي خاص بـ VIP.' : '') + (parent && !parent.effective_visible ? ' القسم الرئيسي مخفي، لذلك سيبقى هذا القسم مخفيًا.' : '');
        }
        controls.parent_id.addEventListener('change', accessNote); accessNote();
        var error = el('p', 'resource-error'); error.setAttribute('role', 'alert'); error.hidden = true; form.appendChild(error);
        var actions = el('div', 'resource-actions');
        var save = button('حفظ القسم', 'primary-btn', function () {
          if (!form.reportValidity() || save.disabled) return;
          form.querySelectorAll('button,input,select').forEach(function (node) { node.disabled = true; }); error.hidden = true;
          ctx.api('/api/admin/category', {method:'POST', body:{id:item ? item.id : null, stamp:item ? item.stamp : null, data:{name:name.value, parent_id:controls.parent_id.value ? Number(controls.parent_id.value) : null, is_visible:controls.is_visible.value === 'true', is_premium:controls.is_premium.value === 'true', sort_order:Number(order.value)}}}).then(function () {
            ctx.toast('حُفظ القسم'); ctx.refreshCatalog(); load();
          }).catch(function (e) { unlock(); error.textContent = e.message; error.hidden = false; });
        });
        actions.appendChild(save); actions.appendChild(button('العودة للأقسام', 'secondary-btn', load)); form.appendChild(actions);
        var remove = null;
        function unlock() {
          form.querySelectorAll('button,input,select').forEach(function (node) { node.disabled = false; });
          if (remove) remove.disabled = !item.can_delete;
        }
        if (item && (item.direct_files || item.drafts)) {
          var moveSection = el('section', 'delete-section');
          moveSection.appendChild(el('h3', null, 'نقل موارد القسم'));
          moveSection.appendChild(el('p', null, item.direct_files + ' مورد منشور · ' + item.drafts + ' مسودة مرتبطة. الأقسام الفرعية تبقى في مكانها.'));
          var targetLabel = el('label', 'resource-field'); targetLabel.appendChild(el('span', null, 'نقل الموارد إلى'));
          var targetSelect = el('select', 'admin-input'); targetSelect.setAttribute('data-field','move_target');
          var blank = el('option', null, 'اختر قسمًا آخر…'); blank.value = ''; targetSelect.appendChild(blank);
          items.filter(function (row) { return row.id !== item.id && row.effective_visible; }).forEach(function (row) { var opt = el('option', null, row.path + (row.effective_premium ? ' · VIP' : '')); opt.value = row.id; targetSelect.appendChild(opt); });
          targetLabel.appendChild(targetSelect); moveSection.appendChild(targetLabel);
          var moveConfirm = el('div', 'delete-confirm'); moveConfirm.hidden = true; moveConfirm.setAttribute('role','group'); moveConfirm.setAttribute('aria-label','تأكيد نقل الموارد');
          var moveDescription = el('p'); moveConfirm.appendChild(moveDescription);
          var move = button('مراجعة نقل الموارد', 'secondary-btn', function () {
            if (!targetSelect.value) { ctx.toast('اختر القسم الذي ستنقل إليه الموارد'); targetSelect.focus(); return; }
            var target = items.find(function (row) { return String(row.id) === targetSelect.value; });
            moveDescription.textContent = 'نقل ' + item.direct_files + ' مورد و' + item.drafts + ' مسودة إلى «' + target.path + '»؟ الروابط والمفضلة وحماية VIP تبقى محفوظة. لن يُحذف القسم الحالي.';
            moveConfirm.hidden = false; targetSelect.disabled = true; move.hidden = true; moveYes.focus();
          });
          var moveYes = button('تأكيد نقل الموارد', 'primary-btn', function () {
            var target = items.find(function (row) { return String(row.id) === targetSelect.value; });
            form.querySelectorAll('button,input,select').forEach(function (node) { node.disabled = true; }); error.hidden = true;
            ctx.api('/api/admin/category-move-resources',{method:'POST',body:{id:item.id,target_id:target.id,stamp:item.stamp,target_stamp:target.stamp,files:item.direct_files,drafts:item.drafts,confirm:true}}).then(function () { ctx.toast('نُقلت الموارد مع حفظ حماية VIP'); ctx.refreshCatalog(); load(); })
              .catch(function (e) { unlock(); targetSelect.disabled = true; error.textContent = e.message; error.hidden = false; error.scrollIntoView({block:'nearest'}); });
          });
          moveConfirm.appendChild(moveYes); moveConfirm.appendChild(button('إلغاء النقل', 'secondary-btn', function () { moveConfirm.hidden = true; targetSelect.disabled = false; move.hidden = false; move.focus(); }));
          moveSection.appendChild(move); moveSection.appendChild(moveConfirm); form.appendChild(moveSection);
        }
        if (item) {
          var danger = el('section', 'delete-section');
          danger.appendChild(el('h3', null, 'حذف القسم'));
          var reason = item.can_delete ? 'القسم فارغ. سيُحذف اسمه فقط بعد التأكيد.' : 'انقل الموارد والأقسام الفرعية أولًا. يجب ألا تبقى مسودات مرتبطة أو حقوق وصول محفوظة للمستخدمين.';
          danger.appendChild(el('p', null, reason));
          var confirm = el('div', 'delete-confirm'); confirm.hidden = true; confirm.setAttribute('role','group'); confirm.setAttribute('aria-label','تأكيد حذف القسم');
          confirm.appendChild(el('p', null, 'حذف «' + item.name + '» نهائيًا؟'));
          remove = button('حذف القسم', 'danger-btn', function () { confirm.hidden = false; remove.hidden = true; yes.focus(); }); remove.disabled = !item.can_delete;
          var yes = button('تأكيد حذف القسم', 'danger-btn', function () {
            form.querySelectorAll('button,input,select').forEach(function (node) { node.disabled = true; }); error.hidden = true;
            ctx.api('/api/admin/category-delete',{method:'POST',body:{id:item.id,stamp:item.stamp,confirm:true}}).then(function () { ctx.toast('حُذف القسم الفارغ'); ctx.refreshCatalog(); load(); })
              .catch(function (e) { unlock(); error.textContent = e.message; error.hidden = false; });
          });
          confirm.appendChild(yes); confirm.appendChild(button('إلغاء الحذف', 'secondary-btn', function () { confirm.hidden = true; remove.hidden = false; remove.focus(); }));
          danger.appendChild(remove); danger.appendChild(confirm); form.appendChild(danger);
        }
        form.addEventListener('submit', function (e) { e.preventDefault(); save.click(); }); host.appendChild(form);
      }
    }
  };
})();
