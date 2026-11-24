/* FacetShelf 帮助中心 —— 导航 / 上下篇 / 页脚 / 搜索入口 / 图片点击放大
 *
 * 数据来源：<root>/<lang>/catalog.json（每页只需 <body data-lang data-page>）
 */
(function () {
  'use strict';

  var selfScript = document.currentScript || document.querySelector('script[src*="nav.js"]');
  var selfSrc = selfScript ? selfScript.src : '';
  var root = selfSrc.replace(/assets\/nav\.js.*$/, '');

  var body = document.body;
  var lang = body.getAttribute('data-lang') || 'zh';
  var page = body.getAttribute('data-page') || '';

  var TEXT = {
    zh: { brand: 'FacetShelf 帮助中心', toc: '目录', search: '搜索帮助…',
          prev: '上一篇', next: '下一篇', other: 'English', noResult: '没有匹配的条目' },
    en: { brand: 'FacetShelf Help Center', toc: 'Contents', search: 'Search help…',
          prev: 'Previous', next: 'Next', other: '中文', noResult: 'No matching entries' }
  };
  var t = TEXT[lang] || TEXT.zh;
  var otherLang = lang === 'zh' ? 'en' : 'zh';

  function url(pagePath) {
    return root + lang + '/' + (pagePath || 'index') + '.html';
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // ── 分组展开状态（sessionStorage，关掉浏览器就忘） ──
  var OPEN_KEY = 'hs-nav-open';

  function readOpenGroups() {
    try {
      var raw = sessionStorage.getItem(OPEN_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (err) {
      return [];
    }
  }

  function saveOpenGroups() {
    try {
      var ids = [];
      var nodes = document.querySelectorAll('#hs-nav details.nav-group[open]');
      for (var i = 0; i < nodes.length; i++) {
        var id = nodes[i].getAttribute('data-group');
        if (id) ids.push(id);
      }
      sessionStorage.setItem(OPEN_KEY, JSON.stringify(ids));
    } catch (err) { /* 隐私模式等场景静默失败 */ }
  }

  function flatten(catalog) {
    var out = [];
    (catalog.groups || []).forEach(function (group) {
      (group.items || []).forEach(function (item) {
        out.push({ path: item.path, title: item.title, desc: item.desc, group: group.title });
      });
    });
    return out;
  }

  function renderNav(catalog, items) {
    var sidebar = document.getElementById('hs-nav');
    if (!sidebar) return;
    sidebar.innerHTML = '';

    var brand = el('a', 'nav-brand', catalog.home && catalog.home.title ? catalog.home.title : t.brand);
    brand.href = url('');
    sidebar.appendChild(brand);

    var toggle = el('button', 'nav-toggle', '☰ ' + t.toc);
    toggle.type = 'button';
    toggle.addEventListener('click', function () { sidebar.classList.toggle('is-open'); });
    sidebar.appendChild(toggle);

    var navBody = el('div', 'nav-body');
    sidebar.appendChild(navBody);

    // 搜索
    var searchWrap = el('div', 'nav-search');
    var input = document.createElement('input');
    input.type = 'search';
    input.placeholder = t.search;
    input.setAttribute('aria-label', t.search);
    var results = el('div', 'search-results');
    searchWrap.appendChild(input);
    searchWrap.appendChild(results);
    navBody.appendChild(searchWrap);

    // 分组（可折叠；展开状态记在 sessionStorage，跳页后不会把用户手动展开的组收回去）
    var savedOpen = readOpenGroups();
    (catalog.groups || []).forEach(function (group) {
      var groupItems = group.items || [];
      var hasCurrent = groupItems.some(function (item) { return item.path === page; });

      var groupEl = document.createElement('details');
      groupEl.className = 'nav-group';
      groupEl.setAttribute('data-group', group.id || '');
      if (hasCurrent || savedOpen.indexOf(group.id) >= 0) groupEl.open = true;

      var summary = document.createElement('summary');
      summary.className = 'nav-group-title';
      summary.textContent = group.title;
      // 只在用户点击时记录（恢复时设置 open 也会触发 toggle，不能用 toggle 事件）
      summary.addEventListener('click', function () {
        setTimeout(saveOpenGroups, 0);
      });
      groupEl.appendChild(summary);

      var list = el('ul', 'nav-list');
      groupItems.forEach(function (item) {
        var li = document.createElement('li');
        var a = el('a', null, item.title);
        a.href = url(item.path);
        if (item.path === page) {
          a.className = 'is-current';
          a.setAttribute('aria-current', 'page');
        }
        li.appendChild(a);
        list.appendChild(li);
      });
      groupEl.appendChild(list);
      navBody.appendChild(groupEl);
    });

    // 语言切换
    var bottom = el('div', 'nav-bottom');
    var langLink = el('a', null, t.other);
    langLink.href = root + otherLang + '/' + (page || 'index') + '.html';
    bottom.appendChild(langLink);
    navBody.appendChild(bottom);

    initSearch(input, results, items);
  }

  var indexPromise = null;
  function loadIndex() {
    if (window.HS_INDEX) return Promise.resolve(window.HS_INDEX);
    if (indexPromise) return indexPromise;
    indexPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = root + 'assets/search-index.js';
      s.onload = function () { resolve(window.HS_INDEX || []); };
      s.onerror = function () { reject(new Error('search index not found')); };
      document.head.appendChild(s);
    });
    return indexPromise;
  }

  function initSearch(input, results, items) {
    var byPath = {};
    items.forEach(function (item) { byPath[item.path] = item; });

    function run() {
      var q = input.value.trim().toLowerCase();
      if (!q) { results.innerHTML = ''; return; }
      loadIndex().then(function (index) {
        var hits = [];
        index.forEach(function (entry) {
          if (entry.lang !== lang) return;
          var score = 0;
          if ((entry.title || '').toLowerCase().indexOf(q) >= 0) score += 100;
          (entry.headings || []).forEach(function (h) {
            if (String(h).toLowerCase().indexOf(q) >= 0) score += 20;
          });
          if ((entry.text || '').toLowerCase().indexOf(q) >= 0) score += 5;
          if (score > 0) hits.push({ entry: entry, score: score });
        });
        hits.sort(function (a, b) { return b.score - a.score; });
        results.innerHTML = '';
        if (!hits.length) {
          results.appendChild(el('div', 'search-empty', t.noResult));
          return;
        }
        hits.slice(0, 12).forEach(function (hit) {
          var meta = byPath[hit.entry.path] || {};
          var a = el('a');
          a.href = url(hit.entry.path);
          a.appendChild(el('span', null, hit.entry.title || meta.title || hit.entry.path));
          if (meta.desc) a.appendChild(el('span', 'sr-desc', meta.desc));
          results.appendChild(a);
        });
      }).catch(function () {
        results.innerHTML = '';
        results.appendChild(el('div', 'search-empty', t.noResult));
      });
    }

    input.addEventListener('focus', function () { loadIndex().catch(function () {}); });
    input.addEventListener('input', run);
  }

  function renderCards(catalog) {
    var host = document.getElementById('hs-cards');
    if (!host) return;
    host.innerHTML = '';
    (catalog.groups || []).forEach(function (group) {
      var grid = el('div', 'cards');
      grid.appendChild(el('h2', null, group.title));
      (group.items || []).forEach(function (item) {
        var a = el('a', 'card');
        a.href = url(item.path);
        a.appendChild(el('span', 'card-title', item.title));
        if (item.desc) a.appendChild(el('span', 'card-desc', item.desc));
        grid.appendChild(a);
      });
      host.appendChild(grid);
    });
  }

  function renderPager(catalog) {
    var content = document.querySelector('.content');
    if (!content || !page) return;
    var items = flatten(catalog);
    var idx = -1;
    for (var i = 0; i < items.length; i++) {
      if (items[i].path === page) { idx = i; break; }
    }
    if (idx < 0) return;

    var box = el('div', 'pager');
    var prev = idx > 0 ? items[idx - 1] : null;
    var next = idx < items.length - 1 ? items[idx + 1] : null;

    if (prev) {
      var a1 = el('a', 'pager-prev');
      a1.href = url(prev.path);
      a1.appendChild(el('span', 'pager-label', '← ' + t.prev));
      a1.appendChild(el('span', 'pager-title', prev.title));
      box.appendChild(a1);
    } else {
      box.appendChild(el('span', 'pager-prev'));
    }

    if (next) {
      var a2 = el('a', 'pager-next');
      a2.href = url(next.path);
      a2.appendChild(el('span', 'pager-label', t.next + ' →'));
      a2.appendChild(el('span', 'pager-title', next.title));
      box.appendChild(a2);
    }

    content.appendChild(box);
  }

  function renderFooter() {
    if (document.querySelector('.site-footer')) return;
    var footer = el('div', 'site-footer');
    var year = new Date().getFullYear();
    footer.textContent = '© ' + year + ' FacetShelf';
    body.appendChild(footer);
  }

  // ── 正文图片放大：点击弹出遮罩显示原图，多图可上一张/下一张 ──
  var ZOOM_TEXT = {
    zh: { close: '关闭', prev: '上一张', next: '下一张', zoom: '点击放大' },
    en: { close: 'Close', prev: 'Previous image', next: 'Next image', zoom: 'Click to enlarge' }
  };

  function initLightbox() {
    var images = Array.prototype.slice.call(
      document.querySelectorAll('.content img')
    ).filter(function (img) { return !img.closest('.hs-zoom'); });
    if (!images.length) return;

    var zt = ZOOM_TEXT[lang] || ZOOM_TEXT.zh;
    var box = null, big = null, closeBtn = null, prevBtn = null, nextBtn = null, counter = null;
    var current = 0, lastFocus = null;

    images.forEach(function (img) {
      img.classList.add('is-zoomable');
      img.setAttribute('role', 'button');
      img.setAttribute('tabindex', '0');
      img.setAttribute('title', zt.zoom);
      img.addEventListener('click', function () { open(images.indexOf(img)); });
      img.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open(images.indexOf(img));
        }
      });
    });

    function build() {
      box = el('div', 'hs-zoom');
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');

      big = el('img', 'hs-zoom-img');
      closeBtn = el('button', 'hs-zoom-btn hs-zoom-close', '×');
      closeBtn.setAttribute('aria-label', zt.close);
      prevBtn = el('button', 'hs-zoom-btn hs-zoom-prev', '‹');
      prevBtn.setAttribute('aria-label', zt.prev);
      nextBtn = el('button', 'hs-zoom-btn hs-zoom-next', '›');
      nextBtn.setAttribute('aria-label', zt.next);
      counter = el('div', 'hs-zoom-count');

      closeBtn.addEventListener('click', close);
      prevBtn.addEventListener('click', function (e) { e.stopPropagation(); step(-1); });
      nextBtn.addEventListener('click', function (e) { e.stopPropagation(); step(1); });
      box.addEventListener('click', function (e) { if (e.target === box) close(); });
      big.addEventListener('click', function (e) { e.stopPropagation(); });

      box.appendChild(big);
      box.appendChild(closeBtn);
      box.appendChild(prevBtn);
      box.appendChild(nextBtn);
      box.appendChild(counter);
      body.appendChild(box);
    }

    function show() {
      var img = images[current];
      big.src = img.currentSrc || img.src;
      big.alt = img.alt || '';
      var multi = images.length > 1;
      prevBtn.hidden = !multi;
      nextBtn.hidden = !multi;
      counter.hidden = !multi;
      counter.textContent = (current + 1) + ' / ' + images.length;
    }

    function open(index) {
      if (!box) build();
      lastFocus = document.activeElement;
      current = index;
      show();
      box.classList.add('is-open');
      document.documentElement.classList.add('hs-zoom-lock');
      closeBtn.focus();
      document.addEventListener('keydown', onKey);
    }

    function close() {
      if (!box) return;
      box.classList.remove('is-open');
      document.documentElement.classList.remove('hs-zoom-lock');
      document.removeEventListener('keydown', onKey);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    function step(delta) {
      current = (current + delta + images.length) % images.length;
      show();
    }

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    }
  }

  function boot() {
    fetch(root + lang + '/catalog.json', { credentials: 'same-origin' })
      .then(function (resp) {
        if (!resp.ok) throw new Error('catalog ' + resp.status);
        return resp.json();
      })
      .then(function (catalog) {
        if (catalog.htmlLang) document.documentElement.setAttribute('lang', catalog.htmlLang);
        var items = flatten(catalog);
        window.HS = { root: root, lang: lang, catalog: catalog, items: items };
        renderNav(catalog, items);
        renderCards(catalog);
        renderPager(catalog);
        renderFooter();
      })
      .catch(function (err) {
        if (window.console) console.warn('[help] catalog load failed:', err);
      });
  }

  initLightbox();
  boot();
})();