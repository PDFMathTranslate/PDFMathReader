(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var all = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var pages = $('#pages');
  var zoom = 100;
  var translate = true;

  all('.para', pages).forEach(function (p) { p.dataset.o = p.textContent; });
  function show(p, t) { p.textContent = t ? p.dataset.t : p.dataset.o; p.classList.toggle('t', t); }
  function sweep() {
    all('.para', pages).forEach(function (p, i) {
      if (!translate) return show(p, false);
      p.classList.add('loading');
      setTimeout(function () { p.classList.remove('loading'); show(p, true); }, 350 + i * 250);
    });
  }
  all('.para', pages).forEach(function (p) {
    p.addEventListener('click', function () { show(p, !p.classList.contains('t')); });
  });
  all('[data-layout]').forEach(function (b) {
    b.addEventListener('click', function () {
      all('[data-layout]').forEach(function (x) { x.classList.toggle('on', x === b); });
      pages.classList.toggle('h', b.dataset.layout === 'h');
    });
  });
  function applyZoom() {
    $('#zv').textContent = zoom + '%';
    all('.page', pages).forEach(function (p) { p.style.transform = 'scale(' + zoom / 100 + ')'; p.style.marginBottom = (18 + (zoom - 100) * 1.2) + 'px'; });
  }
  $('#zi').onclick = function () { zoom = Math.min(160, zoom + 10); applyZoom(); };
  $('#zo').onclick = function () { zoom = Math.max(60, zoom - 10); applyZoom(); };
  $('#tr').onclick = function () { translate = !translate; this.classList.toggle('on', translate); sweep(); };
  if ('IntersectionObserver' in window) {
    var started = false;
    new IntersectionObserver(function (e, o) { if (e[0].isIntersecting && !started) { started = true; sweep(); o.disconnect(); } }, { threshold: 0.3 }).observe(pages);
  } else sweep();

  var texts = {
    zh: '当目标函数强凸时，梯度下降法线性收敛。',
    ja: '目的関数が強凸のとき、勾配降下法は線形収束します。',
    fr: 'La descente de gradient converge linéairement lorsque l’objectif est fortement convexe.'
  };
  var demo = $('#demo');
  function run() {
    demo.classList.remove('t'); demo.textContent = '…'; demo.classList.add('loading');
    setTimeout(function () { demo.classList.remove('loading'); demo.textContent = texts[$('#lang').value]; demo.classList.add('t'); }, 700);
  }
  demo.addEventListener('click', function () {
    if (demo.classList.contains('t')) { demo.textContent = demo.dataset.src; demo.classList.remove('t'); } else run();
  });
  $('#run').onclick = run; $('#lang').onchange = run;

  all('.settings nav button').forEach(function (b) {
    b.addEventListener('click', function () {
      all('.settings nav button').forEach(function (x) { x.classList.toggle('on', x === b); });
      all('.pane').forEach(function (p) { p.classList.toggle('on', p.id === b.dataset.p); });
    });
  });
})();
