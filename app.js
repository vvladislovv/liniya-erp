/* Линия ERP — кликабельное демо. Состояние живёт в памяти страницы и (если можно) в localStorage. */
(function () {
  'use strict';
  const S = window.SEED;
  const KEY = 'liniya-erp-demo-v1';
  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rub = n => Math.round(n).toLocaleString('ru-RU') + ' ₽';
  const num = n => Math.round(n).toLocaleString('ru-RU');
  const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 : 0;
  const pctStr = v => String(v).replace('.', ',') + '%';
  const W = id => S.workers.find(w => w.id === id);
  const initials = n => n.split(' ').map(p => p[0]).slice(0, 2).join('');

  /* ---------- Хранилище ---------- */
  const store = {
    get() { try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* без хранилища тоже работаем */ } },
    clear() { try { localStorage.removeItem(KEY); } catch (e) { /* ok */ } }
  };

  function freshState() {
    const fp = {};
    S.factShift.people.forEach(p => {
      fp[p.id] = { here: false, hours: S.factShift.normHours, early: false, move: null, mentor: p.isNew ? (p.mentor || '') : '' };
    });
    const wf = {};
    S.factShift.people.forEach(p => {
      const lines = [];
      const moveH = p.move ? p.move.hours : 0;
      lines.push({ svc: S.factShift.service, hours: p.hours - moveH });
      if (p.move) lines.push({ svc: p.move.to, hours: p.move.hours });
      wf[p.id] = { lines, early: !!p.early, mentor: p.mentor || '', hist: [] };
    });
    return {
      role: null,
      theme: null,
      crit: {},
      critOpen: false,
      clock: 15,
      active: 2841,
      o: {
        qty: 10, reserve: 20,
        assigned: { w1: 'confirmed', w2: 'confirmed', w3: 'assigned' },
        offers: {}, selected: [], medOk: {}, raced: [], reserveList: [], qtyHist: [], meta: {}, moment: 0
      },
      fm: { people: fp, submitted: false, at: '' },
      wf: { status: 'prelim', source: 'Бригадир Р. Хабибуллин, 22.10 08:12', rows: wf },
      acc: { worker: 'w1', extraApproved: false, nextTariff: false, recalc: 0 },
      pay: { batch: null, st: {}, notes: {}, sel: S.payouts.map(p => p.id) },
      audit: S.audit.slice(),
      integ: S.integrations.slice(),
      jTab: 'audit'
    };
  }

  let st = store.get();
  if (!st || !st.o || !st.wf) st = freshState();
  const save = () => store.set(st);
  const now = () => { st.clock += 1; const m = st.clock; return '22.10 ' + (20 + Math.floor(m / 60)) + ':' + String(m % 60).padStart(2, '0'); };
  const me = () => S.roles.find(r => r.id === st.role) || S.roles[0];
  const can = view => !!st.role && (S.access[st.role] || []).includes(view);
  function tick(code) { if (!st.crit[code]) { st.crit[code] = true; save(); renderCriteria(true); } }
  const initName = full => { const p = full.split(' '); return p[0][0] + '. ' + p[1]; };
  function log(what, why, kind) { st.audit.unshift({ t: now(), who: initName(me().person) + ' (' + me().name.toLowerCase() + ')', what, why: why || '—', kind: kind || 'op' }); }
  function shortName(full) { const [a, b] = full.split(' '); return a + ' ' + (b ? b[0] + '.' : ''); }

  /* ---------- Иконки ---------- */
  const ICON = {
    staffing: '<path d="M4 6h16M4 12h10M4 18h6" /><circle cx="18" cy="16" r="3"/>',
    preshift: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    foreman: '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 17.5h2"/>',
    workfact: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 12l2 2 4-4"/>',
    accruals: '<path d="M5 20V10M10 20V4M15 20v-7M20 20v-4"/>',
    payouts: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h3"/>',
    attention: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.2v.1"/>',
    kpi: '<path d="M4 19h16"/><path d="M6 15l4-5 3 3 5-7"/>',
    journal: '<path d="M5 4h14v16H5z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    phone: '<path d="M6.5 3.5l3 .5 1.5 4-2 1.5a11 11 0 005.5 5.5l1.5-2 4 1.5.5 3c0 1-1 2-2 2C10.5 19.5 4.5 13.5 4.5 5.5c0-1 1-2 2-2z"/>',
    send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.3v.1"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8v.1"/>',
    moon: '<path d="M19 14.5A7.5 7.5 0 019.5 5 7.5 7.5 0 1019 14.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M5.2 18.8l1.4-1.4M17.4 6.6l1.4-1.4"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
    refresh: '<path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 4v7h-7"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14a6 6 0 013.5 6"/>',
    flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>'
  };
  const ic = (n, s) => '<svg viewBox="0 0 24 24" width="' + (s || 16) + '" height="' + (s || 16) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[n] + '</svg>';

  /* ---------- Навигация ---------- */
  const VIEWS = {
    staffing: { title: 'Комплектование', sub: 'Заказы на 23 октября', group: 'Операции' },
    preshift: { title: 'Перед сменой', sub: 'Подтверждения, «едет», замены', group: 'Операции' },
    foreman: { title: 'Смена бригадира', sub: 'Мобильный web/PWA', group: 'Операции' },
    workfact: { title: 'WorkFact', sub: 'Факт смены №2836 · 21 октября', group: 'Операции' },
    accruals: { title: 'Начисления', sub: 'Период 16–31 октября', group: 'Деньги' },
    payouts: { title: 'Выплаты', sub: 'Закрытый период 01–15 октября', group: 'Деньги' },
    attention: { title: 'Требует внимания', sub: 'Отклонения по команде', group: 'Контроль' },
    kpi: { title: 'Показатели', sub: 'Неделя 16–22 октября', group: 'Контроль' },
    journal: { title: 'Журнал', sub: 'Аудит и интеграции', group: 'Система' }
  };
  const route = () => { const h = (location.hash || '').replace(/^#\/?/, ''); return VIEWS[h] ? h : null; };
  function go(v) { if (location.hash !== '#/' + v) location.hash = '#/' + v; else render(); }

  function renderNav() {
    const cur = route();
    let html = '', grp = '';
    Object.keys(VIEWS).forEach(k => {
      const v = VIEWS[k];
      if (v.group !== grp) { grp = v.group; html += '<div class="nav-group">' + grp + '</div>'; }
      const locked = !can(k);
      const badge = k === 'attention' ? '<span class="badge">' + attentionItems().filter(a => a.lvl === 'crit').length + '</span>' : '';
      html += '<a href="#/' + k + '" class="' + (cur === k ? 'active ' : '') + (locked ? 'locked' : '') + '" ' + (locked ? 'title="Нет доступа для роли «' + esc(me().name) + '»"' : '') + '>' + ic(locked ? 'lock' : k, 18) + '<span>' + v.title + '</span>' + (locked ? '' : badge) + '</a>';
    });
    $('#nav').innerHTML = html;
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    $('#themeBtn').innerHTML = ic(dark ? 'sun' : 'moon', 18) + '<span>' + (dark ? 'Светлая тема' : 'Тёмная тема') + '</span>';
  }

  function renderTop() {
    const v = VIEWS[route()] || {};
    const DATES = ['Чт, 22 октября · 20:15', 'Чт, 22 октября · 21:30', 'Пт, 23 октября · 18:30', 'Пт, 23 октября · 19:55'];
    $('.date-chip').textContent = DATES[O().moment || 0];
    $('#topTitle').innerHTML = '<b>' + esc(v.title || '') + '</b><span>' + esc(v.sub || '') + '</span>';
    const r = me();
    $('#roleBtn').innerHTML = '<span class="avatar">' + initials(r.person) + '</span><span class="rb-text"><b>' + esc(r.person) + '</b><small>' + esc(r.name) + '</small></span>';
  }

  /* ---------- Вход ---------- */
  function renderLogin() {
    const el = $('#login');
    if (st.role) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = '<div class="login-box">' +
      '<div class="login-head"><span class="brand-mark"><svg viewBox="0 0 32 32" width="48" height="48"><rect width="32" height="32" rx="8" fill="currentColor"/><rect x="7" y="9" width="18" height="3.2" rx="1.6" fill="#8B66FF"/><rect x="7" y="14.4" width="13" height="3.2" rx="1.6" fill="var(--bg)"/><rect x="7" y="19.8" width="8" height="3.2" rx="1.6" fill="var(--bg)" opacity=".55"/></svg></span>' +
      '<div><h1>Линия ERP</h1><p>Один цикл вместо Bitrix24, таблиц и переписок: заказ → комплектование → факт → начисление → выплата.</p></div></div>' +
      '<h2>Войдите как демо-пользователь — увидите систему глазами роли</h2>' +
      '<div class="role-cards">' + S.roles.map(r => '<button class="role-card" type="button" data-action="login" data-role="' + r.id + '"><span class="avatar">' + initials(r.person) + '</span><b>' + esc(r.name) + '</b><small>' + esc(r.desc) + '</small><span class="go">Войти →</span></button>').join('') + '</div>' +
      '<p class="login-foot">В рабочей версии — индивидуальные аккаунты, 2FA и отзыв сессий. Здесь пароль не нужен: данные вымышленные. Роль можно сменить в правом верхнем углу.</p></div>';
  }

  /* ---------- Счёт кандидатов (объяснимые рекомендации) ---------- */
  function scoreOf(w) {
    const r = [];
    let s = 0;
    s += Math.min(w.obj, 30) / 30 * 30;
    r.push(w.obj > 0 ? ['plus', w.obj + ' смен на объекте'] : ['', 'не был на объекте']);
    s += Math.min(w.svc, 40) / 40 * 20;
    if (w.svc >= 10) r.push(['plus', 'опыт услуги: ' + w.svc]);
    s += (w.svc ? w.ok / w.svc : 1) * 15;
    const disc = w.ns === 0 ? 15 : Math.max(0, 15 - w.ns * 5);
    s += disc;
    r.push(w.ns === 0 ? ['plus', '0 невыходов за 90 дн.'] : ['minus', w.ns + ' невыход' + (w.ns === 1 ? '' : 'а') + ' за 90 дн.']);
    const rec = w.last <= 3 ? 10 : w.last <= 7 ? 6 : w.last <= 14 ? 3 : 0;
    s += rec;
    r.push([w.last > 14 ? 'minus' : '', 'выход ' + w.last + ' дн. назад']);
    s += 10;
    if (w.isNew) r.push(['new', 'новичок · нужен наставник']);
    if (w.medbook && !st.o.medOk[w.id]) r.push(['warn', 'медкнижка просрочена 14.10']);
    return { s: Math.round(s), r };
  }

  /* ---------- Комплектование ---------- */
  const O = () => st.o;
  const target = () => Math.ceil(O().qty * (1 + O().reserve / 100));
  const asgIds = () => Object.keys(O().assigned);
  const confCount = () => asgIds().filter(id => ['confirmed', 'enroute', 'arrived', 'late'].includes(O().assigned[id])).length;

  function orderStats(o) {
    if (o.focus) return { qty: O().qty, assigned: asgIds().length, confirmed: confCount(), target: target() };
    const t = Math.ceil(o.qty * (1 + o.reserve / 100));
    return { qty: o.qty, assigned: o.assigned, confirmed: o.confirmed, target: t };
  }

  function vStaffing() {
    tick('A03');
    const o = S.orders.find(x => x.id === 2841);
    const qty = O().qty, tg = target(), as = asgIds().length, cf = confCount();
    const defT = Math.max(0, tg - as), defO = Math.max(0, qty - as);
    const scale = Math.max(tg, as) + 1.5;
    const w = n => (n / scale * 100).toFixed(2) + '%';
    const list = S.orders.map(x => {
      const s = orderStats(x);
      const cw = Math.min(100, s.confirmed / s.target * 100), aw = Math.min(100 - cw, (s.assigned - s.confirmed) / s.target * 100);
      const late = x.lateChange ? '<span class="pill crit">изменён после дедлайна</span>' : '';
      const short = s.assigned < s.qty ? '<span class="pill crit">дефицит ' + (s.qty - s.assigned) + '</span>' : (s.assigned < s.target ? '<span class="pill warn">до цели ' + (s.target - s.assigned) + '</span>' : '<span class="pill ok">укомплектован</span>');
      return '<button type="button" class="order-item ' + (x.id === st.active ? 'active' : '') + '" data-action="pickOrder" data-id="' + x.id + '">' +
        '<span class="oi-top"><span>№' + x.id + ' · ' + x.shift.toLowerCase() + ' ' + x.time + '</span><span>' + s.assigned + '/' + s.target + '</span></span>' +
        '<span class="oi-name">' + esc(x.service) + ' × ' + s.qty + '</span>' +
        '<span class="oi-sub">' + esc(x.object) + ' · ' + esc(x.client) + '</span>' +
        '<span class="minibar"><i class="c" style="width:' + cw + '%"></i><i class="a" style="width:' + aw + '%"></i></span>' +
        '<span class="oh-meta">' + short + late + '</span></button>';
    }).join('');

    if (st.active !== 2841) {
      const x = S.orders.find(y => y.id === st.active);
      const s = orderStats(x);
      return '<div class="staff"><div class="orders">' + list + '</div><div class="card"><div class="order-head"><div class="oh-title"><span class="kicker">Заказ №' + x.id + ' · ' + esc(x.client) + '</span><h2>' + esc(x.service) + ' × ' + s.qty + ' · ' + esc(x.object) + '</h2></div>' +
        (x.lateChange ? '<div class="callout crit">' + ic('alert', 18) + '<div><b>Позднее изменение:</b> ' + x.lateChange.from + ' → ' + x.lateChange.to + ' в ' + x.lateChange.at.slice(11) + ' (дедлайн 18:00). ' + esc(x.lateChange.by) + '. История сохранена, операторы территории уведомлены.</div></div>' : '') +
        '<div class="stats">' + statCells(s.qty, x.reserve, s.target, s.assigned, s.confirmed) + '</div>' +
        '<p class="muted small">В демо подробно проработан заказ №2841 — откройте его слева, чтобы пройти сценарий комплектования.</p></div></div></div>';
    }

    const preIds = asgIds();
    const assignedRows = preIds.map(id => candRow(W(id), true)).join('');
    const cands = S.workers.filter(x => !O().assigned[x.id] && !O().raced.includes(x.id))
      .map(x => ({ w: x, sc: scoreOf(x) })).sort((a, b) => b.sc.s - a.sc.s);
    const candRows = cands.map(c => candRow(c.w, false, c.sc)).join('');
    const excl = S.excluded.concat(O().raced.map(id => { const x = W(id); return { name: x.name, reason: 'Пересечение смен', detail: 'Назначен ' + x.race.time + ', ' + x.race.object + ' (' + x.race.by + ')', kind: 'crit' }; }));
    const nSel = O().selected.length;

    return '<div class="staff"><div class="orders">' + list + '</div>' +
      '<div class="grid">' +
      '<div class="card"><div class="order-head">' +
      '<div class="oh-row"><div class="oh-title"><span class="kicker">Заказ №' + o.id + ' · ' + esc(o.client) + ' · ' + esc(o.territory) + '</span><h2>' + esc(o.service) + ' × ' + qty + ' · ' + esc(o.object) + '</h2>' +
      '<div class="oh-meta"><span class="pill">Пт, 23 октября</span><span class="pill">' + o.shift + ' ' + o.time + '</span><span class="pill">норматив ' + o.normHours + ' ч</span>' + o.reqs.map(r => '<span class="pill info">' + r + '</span>').join('') + '</div></div>' +
      '<div class="cand-tools"><button class="btn sm" type="button" data-action="changeQty">' + ic('edit', 14) + 'Изменить заказ</button></div></div>' +
      '<div class="fill"><div><div class="fill-bar" role="img" aria-label="Подтвердили ' + cf + ', назначено ' + as + ', заказ ' + qty + ', цель ' + tg + '">' +
      '<span class="seg conf" style="width:' + w(cf) + '"></span><span class="seg asg" style="left:' + w(cf) + ';width:' + w(as - cf) + '"></span>' +
      '<span class="mark" style="left:' + w(qty) + '"></span><span class="mark target" style="left:' + w(tg) + '"></span></div>' +
      '<div class="fill-labels"><span class="lq" style="left:' + w(qty) + '">заказ ' + qty + '</span><span class="lt' + (tg / scale > 0.78 ? ' end' : '') + '" style="left:' + w(tg) + '">цель ' + tg + '</span>' +
      '<span class="lg"><i class="c"></i>подтвердили <i class="a"></i>назначены</span></div></div>' +
      '<div class="stats">' + statCells(qty, O().reserve, tg, as, cf, defO, defT) + '</div></div>' +
      (O().qtyHist.length ? '<div class="hist">' + O().qtyHist.map(h => '<span>' + esc(h) + '</span>').join('') + '</div>' : '') +
      '</div></div>' +

      '<div class="card"><div class="card-h"><div><h2>Назначены · ' + as + '</h2><p class="muted small">3 записаны заранее по повторяющемуся расписанию</p></div></div>' + assignedRows + '</div>' +

      '<div class="card"><div class="card-h"><div><h2>Подходящие кандидаты · ' + cands.length + '</h2><p class="muted small">Отфильтрованы пересечения, блокировки, недоступность и обязательные требования. Счёт объясним: каждая причина видна.</p></div>' +
      '<div class="cand-tools"><button class="btn sm" type="button" data-action="selectTop">Выбрать лучших ' + Math.max(defT, 1) + '</button>' +
      '<button class="btn sm primary" type="button" data-action="massOffer" ' + (nSel ? '' : 'disabled') + '>' + ic('send', 14) + 'Предложить смену' + (nSel ? ' (' + nSel + ')' : '') + '</button></div></div>' +
      candRows + '</div>' +

      '<div class="card"><div class="card-h"><div><h2>Не подходят · ' + excl.length + '</h2><p class="muted small">Система показывает причину, а не просто прячет человека</p></div></div><div class="excl">' +
      excl.map(e => '<div class="excl-row"><b>' + esc(e.name) + '</b><span class="pill ' + e.kind + '">' + esc(e.reason) + '</span><small>' + esc(e.detail) + '</small></div>').join('') + '</div></div>' +
      '</div></div>';
  }

  function statCells(qty, reserve, tg, as, cf, defO, defT) {
    if (defO == null) { defO = Math.max(0, qty - as); defT = Math.max(0, tg - as); }
    return '<div class="stat"><small>Заказ клиента</small><b>' + qty + '</b></div>' +
      '<div class="stat"><small>Резерв</small><b>+' + (tg - qty) + '</b><em>' + reserve + '%</em></div>' +
      '<div class="stat target"><small>Операционная цель</small><b>' + tg + '</b></div>' +
      '<div class="stat"><small>Назначено</small><b>' + as + '</b></div>' +
      '<div class="stat ' + (cf >= qty ? 'done' : '') + '"><small>Подтвердили</small><b>' + cf + '</b></div>' +
      '<div class="stat ' + (defO > 0 ? 'deficit' : defT > 0 ? '' : 'done') + '"><small>Дефицит</small><b>' + (defO > 0 ? defO : defT) + '</b><em>' + (defO > 0 ? 'до заказа' : defT > 0 ? 'до цели' : 'нет') + '</em></div>';
  }

  const OFFER = {
    offered: ['info', 'Предложено'], delivered: ['info', 'Доставлено'], yes: ['ok', 'Согласился'], no: ['', 'Отказался'], none: ['warn', 'Не ответил'],
    blocked: ['crit', 'Отклонено сервером'], needs: ['warn', 'Согласна · нужна проверка'], wait: ['amber', 'Согласился · лист ожидания']
  };
  const ASG = { confirmed: ['ok', 'Подтвердил'], enroute: ['info', 'Едет'], arrived: ['ok', 'На объекте'], late: ['warn', 'Опаздывает'], notleft: ['crit', 'Не выехал'], assigned: ['', 'Ждём подтверждения'], noanswer: ['warn', 'Не отвечает'], declined: ['crit', 'Отказался'] };
  const MOMENTS = ['22.10 · 20:15 — заказ укомплектован', '22.10 · 21:30 — вечер накануне', '23.10 · 18:30 — за полтора часа до смены', '23.10 · 19:55 — старт смены'];
  const NEXT = ['Вечер накануне', 'За полтора часа до смены', 'Старт смены'];
  const hm = (h, m) => String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');

  function candRow(w, assigned, sc) {
    sc = sc || scoreOf(w);
    const off = O().offers[w.id];
    const sel = O().selected.includes(w.id);
    let status = '';
    if (assigned) { const a = ASG[O().assigned[w.id]] || ASG.assigned; status = '<span class="pill ' + a[0] + '"><span class="dot"></span>' + a[1] + '</span>'; }
    else if (off) { const a = OFFER[off]; status = '<span class="pill ' + a[0] + '">' + a[1] + '</span>'; }
    const acts = assigned
      ? '<button class="btn sm ghost" type="button" data-action="call" data-id="' + w.id + '" aria-label="Позвонить">' + ic('phone', 15) + '</button>' +
        '<button class="btn sm" type="button" data-action="transfer" data-id="' + w.id + '">' + ic('swap', 14) + '<span>Перевести</span></button>' +
        '<button class="btn sm danger" type="button" data-action="unassign" data-id="' + w.id + '">Снять</button>'
      : '<button class="btn sm ghost" type="button" data-action="call" data-id="' + w.id + '" aria-label="Позвонить">' + ic('phone', 15) + '</button>' +
        '<button class="btn sm lbl" type="button" data-action="offerOne" data-id="' + w.id + '" ' + (off ? 'disabled' : '') + '>Предложить</button>' +
        '<button class="btn sm primary" type="button" data-action="assign" data-id="' + w.id + '">Назначить</button>';
    return '<div class="cand ' + (assigned ? 'is-assigned' : '') + '">' +
      (assigned ? '<span class="avatar" style="width:24px;height:24px;font-size:10px">' + initials(w.name) + '</span>' : '<input type="checkbox" aria-label="Выбрать ' + esc(w.name) + '" data-action="toggleSel" data-id="' + w.id + '" ' + (sel ? 'checked' : '') + '>') +
      '<div class="cand-name"><button type="button" data-action="worker" data-id="' + w.id + '">' + esc(w.name) + '</button><small>+7 9•• ••• ' + w.tail + (status ? '' : '') + '</small>' + (status ? '<span>' + status + '</span>' : '') + '</div>' +
      '<div class="score"><b>' + sc.s + '<span class="muted small"> / 100</span></b><span class="track"><i style="width:' + sc.s + '%"></i></span></div>' +
      '<div class="reasons">' + sc.r.map(r => '<span class="reason ' + r[0] + '">' + esc(r[1]) + '</span>').join('') + '</div>' +
      '<div class="cand-act">' + acts + '</div></div>';
  }

  function doAssign(id, viaOffer) {
    const w = W(id);
    if (w.race) {
      O().raced.push(id);
      O().selected = O().selected.filter(x => x !== id);
      delete O().offers[id];
      st.integ.unshift({ t: now(), sys: 'ERP', dir: 'внутр.', ent: 'Назначение №2841', ext: 'ASG-' + id, res: 'err', msg: 'Конфликт: исполнитель уже назначен на пересекающуюся смену (' + w.race.object + '), запись отклонена базой' });
      tick('A06'); save();
      if (!viaOffer) {
        modal({ title: 'Сервер отклонил назначение', body: '<div class="callout crit">' + ic('alert', 18) + '<div><b>' + esc(w.name) + '</b> уже назначен на ' + esc(w.race.time) + ', ' + esc(w.race.object) + ' — ' + esc(w.race.by) + ', ' + esc(w.race.ago) + '.</div></div><p>Пересекающиеся смены запрещены на уровне базы данных, поэтому два оператора не могут одновременно забрать одного человека. Исполнитель перенесён в «Не подходят» с причиной.</p><p class="muted small">Критерий приёмки A06</p>', ok: 'Понятно' });
      }
      render();
      return 'blocked';
    }
    if (w.medbook && !O().medOk[id]) {
      if (viaOffer) return 'needs';
      modal({
        title: 'Медкнижка просрочена',
        body: '<div class="callout warn">' + ic('alert', 18) + '<div><b>' + esc(w.name) + '</b>: медкнижка истекла 14.10.2026. Объект требует медкнижку.</div></div><p>Назначить можно только решением оператора. Решение и причина попадут в аудит.</p>' +
          '<label class="field" id="f-med"><span>Причина решения</span><textarea id="medReason" placeholder="Например: продление подано 20.10, справка о прохождении есть"></textarea><span class="err-t" hidden>Укажите причину</span></label>',
        ok: 'Назначить под мою ответственность', cancel: 'Отмена',
        onOk: () => {
          const v = $('#medReason').value.trim();
          if (!v) { $('#f-med').classList.add('err'); $('#f-med .err-t').hidden = false; return false; }
          O().medOk[id] = v;
          log('Заказ №2841: назначена ' + w.name + ' с просроченной медкнижкой', v, 'sens');
          tick('A04');
          O().assigned[id] = 'assigned';
          O().selected = O().selected.filter(x => x !== id);
          if (O().offers[id]) O().offers[id] = 'yes';
          save(); render();
          toast('Назначена с решением оператора. Запись в аудите.');
          return true;
        }
      });
      return 'pending';
    }
    O().assigned[id] = 'assigned';
    O().selected = O().selected.filter(x => x !== id);
    log('Заказ №2841: назначен ' + w.name, viaOffer ? 'Согласился на массовое предложение, правило: по счёту до цели' : 'Ручное назначение');
    save();
    if (!viaOffer) { render(); toast('<b>' + esc(w.name) + '</b> назначен. Осталось до цели: ' + Math.max(0, target() - asgIds().length)); }
    return 'assigned';
  }

  function massOffer(ids) {
    if (!ids.length) return;
    ids.forEach(id => { O().offers[id] = 'offered'; });
    O().selected = [];
    st.integ.unshift({ t: now(), sys: 'Сообщения', dir: 'выход', ent: 'Массовое предложение №2841', ext: 'MSG-B' + (1000 + st.clock), res: 'ok', msg: 'Отправлено ' + ids.length + ' сообщений с кнопками «Иду / Не могу»' });
    save(); render();
    toast('Предложение отправлено ' + ids.length + ' исполнителям. Ответы приходят в реальном времени.');
    const order = ids.slice().sort((a, b) => {
      const ra = { yes: 0, no: 1, none: 2 }[W(a).reply || 'none'], rb = { yes: 0, no: 1, none: 2 }[W(b).reply || 'none'];
      return ra - rb || scoreOf(W(b)).s - scoreOf(W(a)).s;
    });
    let i = 0;
    setTimeout(() => { ids.forEach(id => { if (O().offers[id] === 'offered') O().offers[id] = 'delivered'; }); save(); render(); }, 700);
    const step = () => {
      if (i >= order.length) {
        order.forEach(id => { if (O().offers[id] === 'delivered') O().offers[id] = 'none'; });
        tick('A05'); save(); render();
        const yes = order.filter(id => O().assigned[id]).length;
        toast('Итог: назначено ' + yes + ' по правилу комплектования. ' + (target() - asgIds().length > 0 ? 'До цели ещё ' + (target() - asgIds().length) + '.' : 'Цель достигнута.'));
        return;
      }
      const id = order[i++], w = W(id);
      const rep = w.reply || 'none';
      if (rep === 'yes') {
        if (asgIds().length >= target() && !w.race && !(w.medbook && !O().medOk[id])) O().offers[id] = 'wait';
        else {
          const r = doAssign(id, true);
          O().offers[id] = r === 'blocked' ? 'blocked' : r === 'needs' ? 'needs' : 'yes';
          if (r === 'blocked') { toast('Сервер отклонил назначение <b>' + esc(w.name) + '</b>: пересечение смен (A06)'); }
        }
      } else if (rep === 'no') O().offers[id] = 'no';
      if (rep === 'none') { i < order.length ? step() : setTimeout(step, 0); return; }
      save(); render();
      setTimeout(step, 650);
    };
    setTimeout(step, 1500);
  }

  /* ---------- Перед сменой ---------- */
  function vPreshift() {
    const ids = asgIds(), M = O().meta || {}, mo = O().moment || 0;
    const rows = ids.map(id => {
      const w = W(id), s = O().assigned[id], a = ASG[s] || ASG.assigned, m = M[id] || {};
      const bad = ['declined', 'noanswer', 'notleft'].includes(s);
      return '<tr class="' + (bad ? 'hl' : '') + '"><td><b>' + esc(w.name) + '</b><div class="muted small">+7 9•• ••• ' + w.tail + '</div></td>' +
        '<td><span class="pill ' + a[0] + '"><span class="dot"></span>' + a[1] + '</span></td>' +
        '<td class="small">' + (m.src ? esc(m.src) + '<div class="muted">' + esc(m.t || '') + '</div>' : '<span class="muted">—</span>') + '</td>' +
        '<td class="small nowrap">' + (m.eta ? '<b>' + esc(m.eta) + '</b>' + (m.km ? '<div class="muted">' + esc(m.km) + '</div>' : '') : '<span class="muted">—</span>') + '</td>' +
        '<td class="r"><div class="cand-act">' +
        '<button class="btn sm ghost" type="button" data-action="call" data-id="' + id + '" aria-label="Позвонить">' + ic('phone', 15) + '</button>' +
        (bad ? '<button class="btn sm primary" type="button" data-action="replace" data-id="' + id + '">Найти замену</button>' : '') +
        (s === 'late' ? '<button class="btn sm" type="button" data-action="warnForeman" data-id="' + id + '">Предупредить бригадира</button>' : '') +
        '</div></td></tr>';
    }).join('');
    const cnt = k => ids.filter(id => O().assigned[id] === k).length;
    const chip = (k, cls, label) => cnt(k) ? '<span class="pill ' + cls + '">' + label + ' ' + cnt(k) + '</span>' : '';
    const others = S.orders.filter(o => !o.focus).map(o => {
      const s = orderStats(o);
      return '<tr class="' + (o.lateChange ? 'hl' : '') + '"><td>№' + o.id + '</td><td>' + esc(o.service) + '<div class="muted small">' + esc(o.object) + '</div></td><td class="r">' + s.qty + '</td><td class="r">' + s.assigned + '</td><td class="r">' + s.confirmed + '</td><td>' +
        (o.lateChange ? '<span class="pill crit">' + o.lateChange.from + ' → ' + o.lateChange.to + ' после дедлайна</span>' : s.confirmed >= s.qty ? '<span class="pill ok">готов</span>' : '<span class="pill warn">ждём ' + (s.qty - s.confirmed) + '</span>') + '</td></tr>';
    }).join('');
    const bot = '<div class="card"><div class="card-h"><div><h2>Откуда берётся «едет»</h2><p class="muted small">Статус ставит сам исполнитель, одной кнопкой</p></div></div><div class="card-b" style="display:grid;gap:12px">' +
      '<div class="botmsg"><div class="botmsg-h"><span class="avatar" style="width:26px;height:26px;font-size:10px">Л</span><b>Линия · смены</b><span class="muted small">бот MAX / Telegram</span></div>' +
      '<div class="bubble">Смена сегодня в 20:00, РЦ Север-2, Химки. Вход через КПП-2, пропуск по паспорту. Вы выезжаете?</div>' +
      '<div class="bbtns"><span class="main">Выезжаю</span><span>Опаздываю</span><span>Не смогу</span></div></div>' +
      '<div class="ps-rules"><div><b>18:00</b><span>бот спрашивает всех назначенных, выезжают ли они</span></div><div><b>18:30</b><span>нет «Выезжаю» — статус «Не выехал», оператору задача найти замену, руководитель видит это в «Требует внимания»</span></div><div><b>19:30+</b><span>прибытие отмечает бригадир на объекте</span></div></div>' +
      '<p class="muted small">«Выезжаю» и «Опаздываю» сразу спрашивают, через сколько человек будет, — так появляется время прибытия. Геопозиция по желанию заказчика: только с согласия исполнителя и только на время пути.</p></div></div>';
    return '<div class="page-head"><div><h1>Перед сменой</h1><p>Ночь 23 октября, заказ №2841. Оператор видит, кто подтвердил, кто уже едет и когда будет, кто опаздывает и кто не выехал, — и успевает заменить людей до начала смены.</p></div>' +
      '<div class="cand-tools"><span class="pill">' + esc(MOMENTS[mo]) + '</span>' +
      (mo < 3 ? '<button class="btn primary" type="button" data-action="psNext">' + ic('refresh', 15) + NEXT[mo] + ' →</button>' : '<button class="btn" type="button" data-action="psReset">Начать сначала</button>') + '</div></div>' +
      '<div class="ps-grid"><div class="card"><div class="card-h"><h2>Заказ №2841 · Комплектовщик × ' + O().qty + ' · РЦ Север-2</h2>' +
      '<div class="oh-meta">' + chip('arrived', 'ok', 'на объекте') + chip('enroute', 'info', 'едут') + chip('confirmed', 'ok', 'подтвердили') + chip('late', 'warn', 'опаздывают') + chip('assigned', '', 'ждём ответа') + chip('noanswer', 'warn', 'тишина') + chip('notleft', 'crit', 'не выехали') + chip('declined', 'crit', 'отказ') + '</div></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Исполнитель</th><th>Статус</th><th>Откуда данные</th><th>Прибытие</th><th class="r">Действия</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
      '<div class="grid">' + bot + '<div class="card"><div class="card-h"><h2>Остальные заказы на 23.10</h2></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>№</th><th>Услуга</th><th class="r">Заказ</th><th class="r">Назн.</th><th class="r">Подтв.</th><th></th></tr></thead><tbody>' + others + '</tbody></table></div></div></div></div>';
  }

  // Сценарий вечера: статусы меняются так, как их присылали бы исполнители и бригадир
  function psAdvance() {
    const o = O(); o.meta = o.meta || {};
    const mo = (o.moment || 0) + 1;
    asgIds().forEach((id, i) => {
      const s = o.assigned[id], m = o.meta[id] || {};
      if (mo === 1) {
        if (['assigned', 'confirmed'].includes(s)) {
          const r = i === 3 ? 'noanswer' : i === 5 ? 'declined' : 'confirmed';
          o.assigned[id] = r;
          o.meta[id] = r === 'noanswer' ? { src: 'Бот: вопрос доставлен, ответа нет', t: '22.10 · 3 напоминания' } :
            r === 'declined' ? { src: 'Бот: «Не смогу», причина — заболел', t: '22.10 · ' + hm(20, 41) } :
            { src: 'Бот: «Подтверждаю смену»', t: '22.10 · ' + hm(20, 20 + i * 3) };
        }
      } else if (mo === 2) {
        if (s === 'confirmed') {
          if (i === 4) { o.assigned[id] = 'late'; o.meta[id] = { src: 'Бот: «Опаздываю на 20 минут»', t: '23.10 · 18:14', eta: '≈ 20:20' }; }
          else if (i === 7) { o.assigned[id] = 'notleft'; o.meta[id] = { src: 'Нет «Выезжаю» к 18:30', t: 'задача оператору создана' }; }
          else { o.assigned[id] = 'enroute'; o.meta[id] = { src: 'Бот: «Выезжаю»', t: '23.10 · ' + hm(18, 2 + i * 2), eta: 'к ' + hm(19, 20 + i * 3), km: i % 3 === 0 ? 'по геопозиции: ' + (3 + (i * 5) % 11) + ' км' : '' }; }
        }
      } else if (mo === 3) {
        if (s === 'enroute') { o.assigned[id] = 'arrived'; o.meta[id] = { src: 'Бригадир Р. Хабибуллин отметил прибытие', t: '23.10 · ' + hm(19, 22 + i * 3), eta: hm(19, 22 + i * 3) }; }
      }
    });
    o.moment = mo;
    log('Заказ №2841: статусы перед сменой обновлены (' + MOMENTS[mo] + ')', 'Ответы исполнителей в боте и отметки бригадира');
    save(); render();
    const n = k => asgIds().filter(id => o.assigned[id] === k).length;
    toast(mo === 1 ? 'Ответы за вечер: есть отказ и тишина — их можно заменить.' : mo === 2 ? 'Едут ' + n('enroute') + ', опаздывает ' + n('late') + ', не выехал ' + n('notleft') + '.' : 'На объекте ' + n('arrived') + '. Опоздавший будет к 20:20.');
  }

  /* ---------- Бригадир (PWA) ---------- */
  function vForeman() {
    const f = S.factShift, P = st.fm.people;
    const here = f.people.filter(p => P[p.id].here).length;
    const hours = f.people.reduce((s, p) => s + (P[p.id].here ? P[p.id].hours : 0), 0);
    const cards = f.people.map(p => {
      const x = P[p.id];
      return '<div class="pwa-person ' + (x.here ? 'here' : '') + '"><div class="pp-top"><span class="avatar">' + initials(p.name) + '</span><b>' + esc(p.name) + (p.isNew ? ' <span class="pill info">новичок</span>' : '') + '</b>' +
        '<button class="tgl" type="button" aria-pressed="' + x.here + '" aria-label="Прибыл: ' + esc(p.name) + '" data-action="fmHere" data-id="' + p.id + '"></button></div>' +
        (x.here ? '<div class="pp-row"><span class="stepper"><button type="button" data-action="fmHours" data-id="' + p.id + '" data-d="-1" aria-label="Меньше часов">−</button><span>' + x.hours + ' ч</span><button type="button" data-action="fmHours" data-id="' + p.id + '" data-d="1" aria-label="Больше часов">+</button></span>' +
          '<button class="btn sm ' + (x.early ? 'amber' : '') + '" type="button" data-action="fmEarly" data-id="' + p.id + '">Ранний уход</button>' +
          '<button class="btn sm ' + (x.move ? 'amber' : '') + '" type="button" data-action="fmMove" data-id="' + p.id + '">' + (x.move ? 'Грузчик ' + x.move.hours + ' ч' : 'Перевод') + '</button></div>' +
          (p.isNew ? '<div class="pp-row"><span class="muted">Наставник:</span><select data-action="fmMentor" data-id="' + p.id + '" aria-label="Наставник"><option value="">не выбран</option>' + f.people.filter(q => !q.isNew).map(q => '<option ' + (x.mentor === q.name ? 'selected' : '') + '>' + esc(q.name) + '</option>').join('') + '</select></div>' : '') : '') +
        '</div>';
    }).join('');
    const phone = '<div class="phone"><div class="phone-screen"><span class="phone-island"></span><span class="phone-home"></span><div class="phone-status"><span>20:15</span><span>LTE ▮▮▮</span></div>' +
      '<div class="pwa-head"><small>Линия · бригадир</small><h2>РЦ Север-2 · ночь 21→22.10</h2><small>Комплектовщик · 20:00–08:00 · заказ ' + f.qty + ' · смена №' + f.id + '</small></div>' +
      (st.fm.submitted ? '<div style="padding:0 12px 12px"><div class="callout ok">' + ic('check', 18) + '<div><b>Предварительный факт передан</b> оператору в ' + esc(st.fm.at) + '. Финальный факт подтверждает оператор.</div></div></div>' : '') +
      '<div class="pwa-sum"><div><small>Прибыли</small><b>' + here + '/' + f.people.length + '</b></div><div><small>Часов</small><b>' + hours + '</b></div><div><small>Заказ</small><b>' + f.qty + '</b></div></div>' +
      '<div class="pwa-tools"><button class="btn sm" type="button" data-action="fmAll">Отметить всех</button></div>' +
      '<div class="pwa-list">' + cards + '</div>' +
      '<div class="pwa-foot"><button class="btn ' + (st.fm.submitted ? '' : 'primary') + '" type="button" data-action="fmSubmit" ' + (here ? '' : 'disabled') + '>' + ic(st.fm.submitted ? 'refresh' : 'send', 16) + (st.fm.submitted ? 'Отправить уточнение' : 'Передать предварительный факт') + '</button></div></div></div>';
    const notes = '<div class="phone-notes"><div class="card note-card"><h2>Что видит бригадир</h2><p class="muted">Только свои объекты и смены, только нужных людей. Работает в браузере телефона как приложение (PWA), онлайн.</p></div>' +
      '<div class="card note-card"><h2>Чего бригадир не может</h2><p class="muted">Не видит ставок и сумм, не утверждает финальный WorkFact и ничего не начисляет. Его данные — предварительные, финальный факт подтверждает оператор или руководитель.</p><span class="crit-tag" style="justify-self:start">A07</span></div>' +
      '<div class="card note-card"><h2>Попробуйте</h2><p class="muted">Отметьте прибывших, поставьте раннему уходу 7 часов, переведите одного человека на «Грузчика» на 2 часа и передайте факт. Затем войдите как оператор и откройте WorkFact.</p></div></div>';
    return '<div class="phone-stage">' + phone + notes + '</div>';
  }

  function fmSubmit() {
    const f = S.factShift, P = st.fm.people;
    const rows = {};
    f.people.forEach(p => {
      const x = P[p.id];
      if (!x.here) return;
      const mh = x.move ? x.move.hours : 0;
      const lines = [{ svc: f.service, hours: Math.max(0, x.hours - mh) }];
      if (x.move) lines.push({ svc: 'Грузчик', hours: mh });
      rows[p.id] = { lines, early: x.early, mentor: x.mentor, hist: [] };
    });
    st.wf = { status: 'prelim', source: 'Бригадир Р. Хабибуллин, ' + now(), rows };
    st.fm.submitted = true; st.fm.at = now().slice(6);
    log('Смена №2836: предварительный факт, ' + Object.keys(rows).length + ' чел.', 'Передан со смартфона, без начислений', 'fact');
    tick('A07'); save(); render();
    toast('Предварительный факт передан оператору. Денег бригадир не видит и не начисляет.');
  }

  /* ---------- WorkFact ---------- */
  function vWorkfact() {
    const f = S.factShift, rows = st.wf.rows, ids = Object.keys(rows);
    const factN = ids.length, q = f.qty;
    const kpi = Math.min(factN / q, 1) * 100, over = Math.max(0, factN - q), def = Math.max(0, q - factN);
    const conf = st.wf.status === 'confirmed';
    const mayConfirm = ['operator', 'head'].includes(st.role);
    const tr = ids.map(id => {
      const r = rows[id], p = f.people.find(x => x.id === id);
      const tot = r.lines.reduce((s, l) => s + l.hours, 0);
      return '<tr><td><b>' + esc(p.name) + '</b>' + (r.mentor ? '<div class="muted small">наставник: ' + esc(r.mentor) + '</div>' : '') + (r.hist.length ? '<div class="hist">' + r.hist.map(h => '<span>' + esc(h) + '</span>').join('') + '</div>' : '') + '</td>' +
        '<td><div class="svc-line">' + r.lines.map(l => '<span class="pill">' + esc(l.svc) + ' · ' + l.hours + ' ч</span>').join('') + (r.early ? '<span class="pill warn">ранний уход</span>' : '') + '</div></td>' +
        '<td class="r"><b>' + tot + '</b></td>' +
        '<td><span class="pill ' + (conf ? 'ok' : 'info') + '">' + (conf ? 'подтверждён' : 'предварительный') + '</span></td>' +
        '<td class="r"><button class="btn sm" type="button" data-action="wfEdit" data-id="' + id + '" ' + (mayConfirm ? '' : 'disabled') + '>' + ic('edit', 14) + 'Изменить</button></td></tr>';
    }).join('');
    const totalH = ids.reduce((s, id) => s + rows[id].lines.reduce((a, l) => a + l.hours, 0), 0);
    return '<div class="page-head"><div><h1>WorkFact · смена №2836</h1><p>РЦ Север-2, ночь 21→22 октября, Комплектовщик. Источник: ' + esc(st.wf.source) + '. Период сверки 16–31.10 открыт.</p></div>' +
      '<div class="cand-tools">' + (conf ? '<span class="pill ok">' + ic('check', 14) + 'Факт подтверждён</span>' : '<button class="btn primary" type="button" data-action="wfConfirm" ' + (mayConfirm ? '' : 'disabled title="Подтверждает только оператор или руководитель ОКВ"') + '>' + ic('check', 15) + 'Подтвердить факт смены</button>') + '</div></div>' +
      '<div class="pay-sum"><div class="card kpi"><small>Заказ</small><b>' + q + '</b><span class="sub">человек</span></div><div class="card kpi"><small>Факт</small><b>' + factN + '</b><span class="sub">' + totalH + ' ч всего</span></div>' +
      '<div class="card kpi accent"><small>Выполнение = MIN(факт / заказ; 1)</small><b>' + pctStr(Math.round(kpi * 10) / 10) + '</b><span class="sub">' + (over ? 'избыток ' + over + ' — считается отдельно' : def ? 'дефицит ' + def : 'точно по заказу') + '</span></div>' +
      '<div class="card kpi"><small>Правка после подтверждения</small><b>' + (conf ? 'с причиной' : 'свободно') + '</b><span class="sub">после закрытия периода — корректировка</span></div></div>' +
      '<div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Исполнитель</th><th>Услуги и часы</th><th class="r">Часы</th><th>Статус</th><th class="r"></th></tr></thead><tbody>' + tr + '</tbody></table></div></div>';
  }

  function wfEdit(id) {
    const r = st.wf.rows[id], p = S.factShift.people.find(x => x.id === id), conf = st.wf.status === 'confirmed';
    const main = r.lines[0];
    modal({
      title: 'Изменить факт: ' + p.name,
      body: (conf ? '<div class="callout warn">' + ic('alert', 18) + '<div>Факт уже подтверждён. Правка возможна только с причиной, старое и новое значение сохранятся в истории.</div></div>' : '<div class="callout info">' + ic('info', 18) + '<div>До подтверждения причина необязательна, история всё равно сохраняется.</div></div>') +
        '<label class="field"><span>' + esc(main.svc) + ', часов</span><input id="wfH" type="number" inputmode="decimal"min="0" max="16" step="0.5" value="' + main.hours + '"></label>' +
        '<label class="field" id="f-wf"><span>Причина' + (conf ? '' : ' (необязательно)') + '</span><textarea id="wfR" placeholder="Например: клиент подтвердил уход в 06:00"></textarea><span class="err-t" hidden>Для подтверждённого факта причина обязательна</span></label>',
      ok: 'Сохранить', cancel: 'Отмена',
      onOk: () => {
        const h = parseFloat($('#wfH').value), why = $('#wfR').value.trim();
        if (isNaN(h) || h < 0 || h > 16) return false;
        if (conf && !why) { $('#f-wf').classList.add('err'); $('#f-wf .err-t').hidden = false; return false; }
        if (h === main.hours) return true;
        const t = now();
        r.hist.push(t.slice(6) + ' · ' + shortName(me().person) + ' · ' + main.svc + ' ' + main.hours + ' → ' + h + ' ч' + (why ? ' · ' + why : ''));
        log('WorkFact №2836, ' + p.name + ': ' + main.svc + ' ' + main.hours + ' → ' + h + ' ч', why || '—', 'fact');
        main.hours = h;
        if (conf) tick('A08');
        save(); render(); toast('Факт изменён, история сохранена' + (conf ? ' с причиной' : '') + '.');
        return true;
      }
    });
  }

  /* ---------- Начисления ---------- */
  function accLines(wid) {
    const a = S.accruals[wid];
    return a.lines;
  }
  function accCalc(wid) {
    const L = accLines(wid);
    const hrs = L.filter(l => l.kind === 'hours').reduce((s, l) => s + l.hours * l.rate, 0);
    const bon = L.filter(l => l.kind === 'bonus').reduce((s, l) => s + l.amount, 0);
    const ext = L.filter(l => l.kind === 'extra' && (st.acc.extraApproved || l.approved)).reduce((s, l) => s + l.amount, 0);
    const pend = L.filter(l => l.kind === 'extra' && !(st.acc.extraApproved || l.approved)).reduce((s, l) => s + l.amount, 0);
    const hold = L.filter(l => l.kind === 'hold').reduce((s, l) => s + l.amount, 0);
    return { hrs, bon, ext, pend, hold, total: hrs + bon + ext - hold };
  }
  function vAccruals() {
    const wid = st.acc.worker, a = S.accruals[wid], c = accCalc(wid);
    const isHead = st.role === 'head';
    const rows = a.lines.map(l => {
      if (l.kind === 'hours') return '<tr><td>' + l.date + '</td><td>' + esc(l.label) + '<div class="muted small">' + esc(l.fact) + '</div></td><td class="r nowrap">' + l.hours + ' ч × ' + l.rate + ' ₽</td><td class="r"><b>' + rub(l.hours * l.rate) + '</b></td><td><span class="pill">' + esc(l.tariff) + '</span></td></tr>';
      if (l.kind === 'bonus') return '<tr><td>—</td><td>' + esc(l.label) + '</td><td class="r">премия</td><td class="r"><b>+' + rub(l.amount) + '</b></td><td><span class="pill">' + esc(l.basis) + '</span></td></tr>';
      if (l.kind === 'extra') { const ok = st.acc.extraApproved || l.approved; return '<tr class="' + (ok ? '' : 'hl') + '"><td>—</td><td>' + esc(l.label) + '<div class="muted small">' + esc(l.basis) + '</div></td><td class="r">доплата</td><td class="r"><b>' + (ok ? '+' + rub(l.amount) : '<span class="muted">' + rub(l.amount) + '</span>') + '</b></td><td>' + (ok ? '<span class="pill ok">подтвердил Д. Шуров</span>' : '<div class="cand-act" style="justify-content:flex-start"><span class="pill warn">ждёт руководителя</span><button class="btn sm primary" type="button" data-action="approveExtra" ' + (isHead ? '' : 'disabled title="Подтверждает только руководитель ОКВ"') + '>Подтвердить</button></div>') + '</td></tr>'; }
      return '<tr><td>—</td><td>' + esc(l.label) + '</td><td class="r">удержание</td><td class="r"><b>−' + rub(l.amount) + '</b></td><td><span class="pill">' + esc(l.basis) + '</span></td></tr>';
    }).join('');
    const tariffs = S.tariffs.map(t => '<div style="display:grid;gap:4px"><b>' + esc(t.code) + '</b>' + t.versions.concat(st.acc.nextTariff && t.code === 'СЕВ2-КОМП-НОЧЬ' ? [{ v: 4, rate: 340, from: '2026-11-01', to: null, isNew: true }] : []).map(v => {
      const cur = !v.isNew && (v.to === null) && !(st.acc.nextTariff && t.code === 'СЕВ2-КОМП-НОЧЬ' && v.v === 3 && false);
      return '<div class="ver"><span class="pill ' + (v.isNew ? 'amber' : cur ? 'ok' : '') + '">v' + v.v + '</span><span>' + v.rate + ' ₽/ч</span><span class="muted small">с ' + v.from.split('-').reverse().slice(0, 2).join('.') + (v.to ? ' по ' + v.to.split('-').reverse().slice(0, 2).join('.') : st.acc.nextTariff && t.code === 'СЕВ2-КОМП-НОЧЬ' && v.v === 3 ? ' по 31.10' : '') + '</span></div>';
    }).join('') + '</div>').join('');
    return '<div class="page-head"><div><h1>Начисления · 16–31 октября</h1><p>Каждая сумма раскладывается до строки тарифа с версией. Изменение тарифа не переписывает прошлые начисления, повтор расчёта не создаёт дубль.</p></div>' +
      '<div class="seg-tabs" role="tablist">' + Object.keys(S.accruals).map(k => '<button type="button" role="tab" class="' + (k === wid ? 'on' : '') + '" data-action="accWorker" data-id="' + k + '">' + esc(S.accruals[k].name) + '</button>').join('') + '</div></div>' +
      '<div class="acc-grid"><div class="card"><div class="card-h"><div><h2>' + esc(a.name) + '</h2><p class="muted small">' + esc(a.note) + '</p></div><div class="cand-tools"><button class="btn sm" type="button" data-action="recalc">' + ic('refresh', 14) + 'Пересчитать</button></div></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Дата</th><th>Основание</th><th class="r">Расчёт</th><th class="r">Сумма</th><th>Тариф / документ</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="formula"><span class="term"><small>часы × ставка</small><b>' + rub(c.hrs) + '</b></span><span class="op">+</span><span class="term"><small>премии</small><b>' + rub(c.bon) + '</b></span><span class="op">+</span><span class="term"><small>доплаты</small><b>' + rub(c.ext) + '</b></span><span class="op">−</span><span class="term"><small>удержания</small><b>' + rub(c.hold) + '</b></span><span class="op">=</span><span class="term total"><small>к начислению</small><b>' + rub(c.total) + '</b></span>' + (c.pend ? '<span class="pill warn" style="margin-left:auto">ещё ' + rub(c.pend) + ' ждут подтверждения</span>' : '') + '</div></div>' +
      '<div class="grid"><div class="card"><div class="card-h"><h2>Версии тарифов</h2><button class="btn sm" type="button" data-action="newTariff" ' + (st.acc.nextTariff ? 'disabled' : '') + '>Новая версия с 01.11</button></div><div class="card-b" style="display:grid;gap:14px">' + tariffs + '</div></div>' +
      '<div class="card"><div class="card-h"><h2>Снимок расчёта</h2></div><div class="card-b"><dl class="kv"><dt>Ключ</dt><dd class="num">ACC-' + wid.toUpperCase() + '-2610B</dd><dt>Вход</dt><dd>WorkFact ' + a.lines.filter(l => l.fact).map(l => l.fact).filter((v, i, s) => s.indexOf(v) === i).join(', ') + '</dd><dt>Тарифы</dt><dd>версии на дату смены</dd><dt>Пересчётов</dt><dd>' + st.acc.recalc + ' · дублей 0</dd><dt>После выплаты</dt><dd>только корректировка или сторно</dd></dl></div></div></div></div>';
  }

  /* ---------- Выплаты ---------- */
  const PST = { ready: ['', 'Готово к выплате'], batch: ['info', 'В пакете'], sent: ['info', 'Отправлено'], paid: ['ok', 'Оплачено'], error: ['crit', 'Ошибка'], unknown: ['warn', 'Статус неизвестен'], checking: ['warn', 'Сверяем статус…'], fixed: ['amber', 'Реквизиты исправлены'], retry: ['info', 'Повтор отправлен'] };
  const pSt = id => st.pay.st[id] || 'ready';
  function vPayouts() {
    const P = S.payouts;
    const sum = f => P.filter(f).reduce((s, p) => s + p.amount, 0);
    const paid = sum(p => pSt(p.id) === 'paid'), err = P.filter(p => pSt(p.id) === 'error').length;
    const rows = P.map(p => {
      const s = pSt(p.id), a = PST[s];
      let act = '';
      if (s === 'error') act = '<button class="btn sm primary" type="button" data-action="fixReq" data-id="' + p.id + '">Исправить реквизиты · ОКВ</button>';
      if (s === 'fixed') act = '<button class="btn sm primary" type="button" data-action="retryPay" data-id="' + p.id + '">' + ic('refresh', 14) + 'Повторить безопасно</button>';
      return '<tr class="' + (s === 'error' ? 'hl' : '') + '"><td>' + (s === 'ready' ? '<input type="checkbox" data-action="paySel" data-id="' + p.id + '" ' + (st.pay.sel.includes(p.id) ? 'checked' : '') + ' aria-label="Выбрать ' + esc(p.name) + '">' : '') + '</td>' +
        '<td><b>' + esc(p.name) + '</b><div class="muted small">' + p.id + ' · ' + esc(p.terr) + '</div></td><td class="r"><b>' + rub(p.amount) + '</b></td><td class="nowrap">' + esc(st.pay.notes[p.id + 'm'] || p.method) + '</td>' +
        '<td><span class="pill ' + a[0] + '">' + a[1] + '</span>' + (p.outcome === 'error' && ['error', 'fixed'].includes(s) ? '<div class="muted small">' + esc(p.error) + '</div>' : '') + (st.pay.notes[p.id] ? '<div class="muted small">' + esc(st.pay.notes[p.id]) + '</div>' : '') + '</td><td class="r">' + act + '</td></tr>';
    }).join('');
    const nReady = st.pay.sel.filter(id => pSt(id) === 'ready').length;
    const inBatch = P.filter(p => pSt(p.id) === 'batch').length;
    return '<div class="page-head"><div><h1>Выплаты · 01–15 октября</h1><p>Очередь по всем территориям. Провайдер подключается через адаптер; при таймауте система сначала сверяет фактический статус, чтобы не заплатить дважды.</p></div>' +
      '<div class="cand-tools">' + (inBatch ? '<button class="btn primary" type="button" data-action="sendBatch">' + ic('send', 15) + 'Отправить пакет ' + esc(st.pay.batch) + ' провайдеру</button>' : '<button class="btn primary" type="button" data-action="makeBatch" ' + (nReady ? '' : 'disabled') + '>Сформировать пакет (' + nReady + ')</button>') + '</div></div>' +
      '<div class="pay-sum"><div class="card kpi"><small>К выплате за период</small><b>' + rub(sum(() => true)) + '</b><span class="sub">' + P.length + ' исполнителей, 4 территории</span></div>' +
      '<div class="card kpi"><small>Оплачено</small><b>' + rub(paid) + '</b><span class="sub">' + P.filter(p => pSt(p.id) === 'paid').length + ' выплат</span></div>' +
      '<div class="card kpi ' + (err ? 'accent' : '') + '"><small>Ошибки</small><b>' + err + '</b><span class="sub">возвращаются в ОКВ на исправление</span></div>' +
      '<div class="card kpi"><small>Провайдер</small><b style="font-size:17px">Адаптер выплат</b><span class="sub">статусы по API, ключ идемпотентности</span></div></div>' +
      '<div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Исполнитель</th><th class="r">Сумма</th><th>Реквизиты</th><th>Статус</th><th class="r"></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }
  function sendBatch() {
    const ids = S.payouts.filter(p => pSt(p.id) === 'batch').map(p => p.id);
    ids.forEach(id => { st.pay.st[id] = 'sent'; });
    st.integ.unshift({ t: now(), sys: 'Выплаты', dir: 'выход', ent: 'Пакет ' + st.pay.batch, ext: st.pay.batch, res: 'ok', msg: 'Отправлено ' + ids.length + ' выплат, ключи идемпотентности = ID выплат' });
    save(); render();
    let i = 0;
    const step = () => {
      if (i >= ids.length) {
        const u = S.payouts.find(p => p.outcome === 'timeout' && ids.includes(p.id));
        if (u) setTimeout(() => {
          st.pay.st[u.id] = 'checking'; save(); render();
          setTimeout(() => {
            st.pay.st[u.id] = 'paid'; st.pay.notes[u.id] = 'Таймаут → сверка по ключу: платёж уже прошёл, повтор не нужен';
            st.integ.unshift({ t: now(), sys: 'Выплаты', dir: 'выход', ent: 'Сверка статуса', ext: u.id, res: 'ok', msg: 'Таймаут при отправке. Запрос статуса по ключу: оплачено. Повтор не выполнялся' });
            save(); render(); toast('Таймаут по ' + u.id + ': сверили статус — уже оплачено, двойной выплаты нет.');
          }, 1600);
        }, 500);
        return;
      }
      const id = ids[i++], p = S.payouts.find(x => x.id === id);
      st.pay.st[id] = p.outcome === 'error' ? 'error' : p.outcome === 'timeout' ? 'unknown' : 'paid';
      if (p.outcome === 'error') st.integ.unshift({ t: now(), sys: 'Выплаты', dir: 'вход', ent: 'Статус выплаты', ext: id, res: 'err', msg: p.error + ' — возвращено в очередь ОКВ' });
      save(); render();
      setTimeout(step, 300);
    };
    setTimeout(step, 600);
  }

  /* ---------- Требует внимания ---------- */
  // Отклонения следуют за состоянием демо: набрали цель, подтвердили факт или оплатили, и карточка уходит.
  function attentionItems() {
    return S.attention.map(a => {
      if (a.type === 'Дефицит') {
        const tg = target(), as = asgIds().length;
        return as >= tg ? null : { ...a, text: 'Назначено ' + as + ' из цели ' + tg + ', до смены меньше суток' };
      }
      if (a.type === 'Незакрытый WorkFact') return st.wf.status === 'confirmed' ? null : a;
      if (a.type === 'Ошибка выплаты') {
        const ps = pSt(a.title.split(' · ')[0]);
        if (ps === 'paid') return null;
        if (ps === 'fixed' || ps === 'retry') return { ...a, lvl: 'info', text: 'Реквизиты исправлены, бухгалтер повторяет выплату с тем же ключом' };
      }
      return a;
    }).filter(Boolean);
  }

  // Шапка карты: на десктопе «23.10», на телефоне число и день недели, чтобы подписи не налезали друг на друга
  function heatDay(d) {
    const [dd, mm] = d.split('.').map(Number), wd = new Date(+S.today.slice(0, 4), mm - 1, dd).toLocaleDateString('ru-RU', { weekday: 'short' });
    return '<span class="h"><span class="hd">' + d + '</span><span class="hm"><b>' + dd + '</b><small>' + wd + '</small></span></span>';
  }

  function vAttention() {
    const H = S.heat;
    const lv = v => v < 50 ? 'l0' : v < 80 ? 'l1' : v < 100 ? 'l2' : 'l3';
    const heat = '<div class="heat"><span></span>' + H.days.map(heatDay).join('') +
      H.rows.map(r => '<span class="rl" title="' + esc(r[0]) + '">' + esc(r[0]) + '</span>' + r[1].map((v, i) => '<span class="c ' + lv(v) + '" title="' + esc(r[0]) + ', ' + H.days[i] + ': ' + v + '% цели">' + v + '</span>').join('')).join('') + '</div>';
    const list = attentionItems().map(a => '<div class="att"><span class="lvl ' + a.lvl + '"></span><div class="att-body"><div class="oh-meta"><span class="pill ' + a.lvl + '">' + ({ crit: 'Критично', warn: 'Важно', info: 'К сведению' })[a.lvl] + '</span><span class="pill">' + esc(a.type) + '</span></div><b>' + esc(a.title) + '</b><span class="muted">' + esc(a.text) + '</span>' +
      '<div class="att-meta"><span>Ответственный: ' + esc(a.owner) + '</span><span>Срок: ' + esc(a.due) + '</span><span>' + esc(a.esc) + '</span></div></div><button class="btn sm" type="button" data-action="nav" data-v="' + a.go + '">Открыть</button></div>').join('');
    return '<div class="page-head"><div><h1>Требует внимания</h1><p>Отклонения по команде с тремя уровнями критичности, ответственным, сроком и эскалацией. Директор этот поток не получает — только агрегаты.</p></div></div>' +
      '<div class="grid"><div class="card"><div class="card-h"><div><h2>Карта заполнения на 7 дней</h2><p class="muted small">% операционной цели по объектам. Красное видно заранее, а не вечером перед сменой.</p></div><div class="legend"><span><i style="background:var(--crit)"></i>&lt; 50%</span><span><i style="background:var(--warn)"></i>50–79%</span><span><i style="background:var(--line-2)"></i>80–99%</span><span><i style="background:var(--ok)"></i>100%</span></div></div><div class="card-b">' + heat + '</div></div>' +
      '<div class="card">' + list + '</div></div>';
  }

  /* ---------- Показатели директора ---------- */
  function vKpi() {
    tick('A13');
    const wk = S.week;
    const sumO = wk.reduce((s, r) => s + r[2], 0), sumF = wk.reduce((s, r) => s + r[3], 0);
    const covered = wk.reduce((s, r) => s + Math.min(r[3], r[2]), 0);
    const over = wk.reduce((s, r) => s + Math.max(0, r[3] - r[2]), 0), def = wk.reduce((s, r) => s + Math.max(0, r[2] - r[3]), 0);
    const days = []; wk.forEach(r => { let d = days.find(x => x.d === r[0]); if (!d) { d = { d: r[0], o: 0, c: 0, f: 0 }; days.push(d); } d.o += r[2]; d.c += Math.min(r[2], r[3]); d.f += r[3]; });
    const fn = S.funnel;
    const funnel = fn.map((r, i) => '<div class="f-row ' + (i === fn.length - 1 ? 'last' : '') + '"><span>' + r[0] + '</span><span class="f-bar"><i style="width:' + (r[1] / fn[0][1] * 100).toFixed(1) + '%"></i></span><b class="num" style="text-align:right">' + r[1] + '</b>' + (i ? '' : '') + '</div>').join('');
    // столбики выполнения по дням + линия 95%
    const Wd = 520, Hd = 180, pad = 60, padR = 8, bw = (Wd - pad - padR) / days.length;
    const y = v => Hd - 24 - (v - 80) / 20 * (Hd - 48);
    const bars = days.map((d, i) => { const v = d.c / d.o * 100, x = pad + i * bw + bw * 0.18, wv = bw * 0.64; const low = v < 95; return '<rect x="' + x.toFixed(1) + '" y="' + y(v).toFixed(1) + '" width="' + wv.toFixed(1) + '" height="' + (Hd - 24 - y(v)).toFixed(1) + '" rx="4" fill="' + (low ? 'var(--amber)' : 'var(--ink-3)') + '" opacity="' + (low ? 1 : .55) + '"><title>' + d.d + ': ' + pctStr(Math.round(v * 10) / 10) + '</title></rect><text x="' + (x + wv / 2).toFixed(1) + '" y="' + (y(v) - 6).toFixed(1) + '" text-anchor="middle" font-size="11" fill="var(--ink-2)">' + Math.round(v) + '</text><text x="' + (x + wv / 2).toFixed(1) + '" y="' + (Hd - 6) + '" text-anchor="middle" font-size="11" fill="var(--ink-3)">' + d.d + '</text>'; }).join('');
    const chart = '<svg viewBox="0 0 ' + Wd + ' ' + Hd + '" role="img" aria-label="Выполнение заказов по дням"><line x1="' + pad + '" x2="' + (Wd - padR) + '" y1="' + y(95) + '" y2="' + y(95) + '" stroke="var(--ink)" stroke-dasharray="4 4" stroke-width="1"/><text x="2" y="' + (y(95) + 4) + '" font-size="11" fill="var(--ink-2)">цель 95%</text>' + bars + '<line x1="' + pad + '" x2="' + (Wd - padR) + '" y1="' + (Hd - 24) + '" y2="' + (Hd - 24) + '" stroke="var(--line-2)"/></svg>';
    const ex = [[2836, 'РЦ Север-2 · 21.10', 10, 12], [2830, 'РЦ Север-2 · 20.10', 10, 7]];
    const exRows = ex.map(r => { const k = Math.min(r[3] / r[2], 1) * 100; return '<tr><td>№' + r[0] + '</td><td>' + r[1] + '</td><td class="r">' + r[2] + '</td><td class="r">' + r[3] + '</td><td class="r"><b>' + Math.round(k) + '%</b></td><td>' + (r[3] > r[2] ? '<span class="pill amber">избыток ' + (r[3] - r[2]) + '</span>' : r[3] < r[2] ? '<span class="pill crit">дефицит ' + (r[2] - r[3]) + '</span>' : '—') + '</td></tr>'; }).join('');
    return '<div class="page-head"><div><h1>Показатели · 16–22 октября</h1><p>Агрегаты для директора: выполнение считается как MIN(факт / заказ; 1), избыток не завышает процент и показывается отдельно.</p></div></div>' +
      '<div class="kpi-grid"><div class="card kpi accent"><small>Выполнение заказов</small><b>' + pctStr(pct(covered, sumO)) + '</b><span class="sub">' + covered + ' из ' + sumO + ' выходов по заказу</span></div>' +
      '<div class="card kpi"><small>Избыток (отдельно)</small><b>+' + over + '</b><span class="sub">выходов сверх заказа</span></div>' +
      '<div class="card kpi"><small>Дефицит</small><b>−' + def + '</b><span class="sub">не закрыто по заказам</span></div>' +
      '<div class="card kpi"><small>Невыходы</small><b>' + pctStr(Math.round((1 - fn[5][1] / fn[4][1]) * 1000) / 10) + '</b><span class="sub">' + (fn[4][1] - fn[5][1]) + ' из ' + fn[4][1] + ' подтвердивших</span></div></div>' +
      '<div class="dir-grid"><div class="card"><div class="card-h"><div><h2>Выполнение по дням, %</h2><p class="muted small">Янтарным — дни ниже цели 95%</p></div></div><div class="card-b chart">' + chart + '</div></div>' +
      '<div class="card"><div class="card-h"><h2>Воронка смены за неделю</h2></div><div class="card-b funnel">' + funnel + '<p class="muted small" style="margin-top:6px">От предложения до принятого WorkFact доходит ' + Math.round(fn[6][1] / fn[0][1] * 100) + '%; главная потеря — между «доставлено» и «согласились».</p></div></div></div>' +
      '<div class="card" style="margin-top:16px"><div class="card-h"><div><h2>Как считается выполнение</h2><p class="muted small">Пример из критериев приёмки</p></div><span class="crit-tag">A13</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Смена</th><th>Объект</th><th class="r">Заказ</th><th class="r">Факт</th><th class="r">Выполнение</th><th>Отдельно</th></tr></thead><tbody>' + exRows + '</tbody></table></div></div>';
  }

  /* ---------- Журнал ---------- */
  function vJournal() {
    if (st.jTab === 'integ') tick('A01');
    const tabs = '<div class="seg-tabs"><button type="button" class="' + (st.jTab === 'audit' ? 'on' : '') + '" data-action="jTab" data-t="audit">Бизнес-аудит</button><button type="button" class="' + (st.jTab === 'integ' ? 'on' : '') + '" data-action="jTab" data-t="integ">Интеграции</button></div>';
    let body;
    if (st.jTab === 'audit') body = '<table class="tbl"><thead><tr><th>Время</th><th>Кто</th><th>Что изменилось</th><th>Основание</th></tr></thead><tbody>' + st.audit.map(a => '<tr><td class="nowrap">' + esc(a.t) + '</td><td>' + esc(a.who) + '</td><td>' + esc(a.what) + (a.kind === 'sens' ? ' <span class="pill warn">чувствительное</span>' : '') + '</td><td class="muted">' + esc(a.why) + '</td></tr>').join('') + '</tbody></table>';
    else body = '<table class="tbl"><thead><tr><th>Время</th><th>Система</th><th>Направл.</th><th>Сущность</th><th>Внешний ID</th><th>Результат</th></tr></thead><tbody>' + st.integ.map(a => '<tr><td class="nowrap">' + esc(a.t) + '</td><td>' + esc(a.sys) + '</td><td>' + esc(a.dir) + '</td><td>' + esc(a.ent) + '</td><td class="num">' + esc(a.ext) + '</td><td><span class="res-' + a.res + '">' + ({ ok: '✓', err: '✕', skip: '↷' })[a.res] + '</span> ' + esc(a.msg) + '</td></tr>').join('') + '</tbody></table>';
    return '<div class="page-head"><div><h1>Журнал</h1><p>Аудит хранит «было → стало» и основание, доступ к чувствительным данным пишется отдельно. Журнал интеграций: система, направление, сущность, внешний ID, результат.</p></div>' + tabs + '</div><div class="card"><div class="tbl-wrap">' + body + '</div></div>';
  }

  function vNoAccess(v) {
    tick('A12');
    const who = S.roles.filter(r => (S.access[r.id] || []).includes(v));
    return '<div class="card card-b" style="max-width:620px;display:grid;gap:14px;margin:40px auto"><div class="callout info">' + ic('lock', 18) + '<div><b>Раздел «' + esc(VIEWS[v].title) + '» недоступен для роли «' + esc(me().name) + '».</b> Доступ определяется ролью, функциональными правами и областью «территория → клиент → объект».</div></div>' +
      '<p>Есть доступ у ролей: ' + who.map(r => '<b>' + esc(r.name) + '</b>').join(', ') + '.</p><div class="cand-tools">' + who.slice(0, 3).map(r => '<button class="btn" type="button" data-action="setRole" data-role="' + r.id + '" data-v="' + v + '">Войти как ' + esc(r.name.toLowerCase()) + '</button>').join('') + '</div><span class="crit-tag" style="justify-self:start">A12</span></div>';
  }

  /* ---------- Критерии ---------- */
  const HINT = {
    A03: 'Комплектование, заказ №2841', A04: 'Назначить Светлану Орлову', A05: 'Выбрать лучших → Предложить смену', A06: 'Назначить Рустама Каримова', A11: 'Кнопка с трубкой у любого человека',
    A02: 'Комплектование → «Изменить заказ»', A07: 'Роль «Бригадир» → передать факт', A08: 'WorkFact: подтвердить, затем изменить часы', A09: 'Начисления: «Пересчитать» или новая версия тарифа',
    A10: 'Выплаты: пакет → ошибка → исправить → повтор', A12: 'Открыть раздел без доступа (замок в меню)', A13: 'Роль «Директор» → Показатели', A01: 'Журнал → Интеграции'
  };
  function renderCriteria(flash) {
    const done = S.criteria.filter(c => st.crit[c[0]]).length, n = S.criteria.length;
    const r = 10, C = 2 * Math.PI * r, off = C * (1 - done / n);
    const ring = '<svg class="ring" viewBox="0 0 26 26"><circle cx="13" cy="13" r="' + r + '" fill="none" stroke="var(--line)" stroke-width="3"/><circle cx="13" cy="13" r="' + r + '" fill="none" stroke="var(--ok)" stroke-width="3" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + off.toFixed(2) + '" transform="rotate(-90 13 13)" stroke-linecap="round"/></svg>';
    let html = '<button class="crit-fab" type="button" data-action="critToggle" aria-label="Критерии приёмки: ' + done + ' из ' + n + '" aria-expanded="' + st.critOpen + '">' + ring + '<span class="crit-t">Критерии приёмки</span> ' + done + '/' + n + '</button>';
    if (st.critOpen) html += '<div class="crit-panel"><header><h3>Ваши критерии из ТЗ, раздел 7</h3><small>Отмечаются сами, когда вы проходите сценарий в демо</small></header><ul class="crit-list">' +
      S.criteria.map(c => '<li class="' + (st.crit[c[0]] ? 'done' : '') + '"><span class="ck">' + (st.crit[c[0]] ? ic('check', 11) : '') + '</span><b>' + c[0] + '</b><span>' + esc(c[1]) + '<br><span class="muted" style="font-size:11.5px">' + esc(HINT[c[0]] || '') + '</span></span></li>').join('') + '</ul></div>';
    $('#criteria').innerHTML = html;
    if (flash) { const f = $('.crit-fab'); if (f) f.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 400 }); }
  }

  /* ---------- Модалки, шторка, тосты, меню ---------- */
  let modalCfg = null;
  function modal(cfg) {
    modalCfg = cfg;
    $('#modal').innerHTML = '<div class="scrim" data-action="mClose"></div><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mT"><div class="modal-h"><h2 id="mT">' + esc(cfg.title) + '</h2></div><div class="modal-b">' + cfg.body + '</div><div class="modal-f">' + (cfg.cancel ? '<button class="btn" type="button" data-action="mClose">' + esc(cfg.cancel) + '</button>' : '') + '<button class="btn primary" type="button" data-action="mOk">' + esc(cfg.ok || 'Готово') + '</button></div></div>';
    const f = $('#modal textarea, #modal input, #modal select'); if (f && matchMedia('(pointer: fine)').matches) setTimeout(() => f.focus(), 30); // на телефоне клавиатура не должна закрывать шторку сама
  }
  const closeModal = () => { $('#modal').innerHTML = ''; modalCfg = null; };
  function drawer(html) { $('#drawer').innerHTML = '<div class="scrim" data-action="dClose"></div><aside class="drawer" role="dialog" aria-modal="true">' + html + '</aside>'; }
  const closeDrawer = () => { $('#drawer').innerHTML = ''; };
  function toast(html) {
    const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = ic('info', 16) + '<div>' + html + '</div>';
    t.dataset.k = html;
    [...$('#toasts').children].filter(x => x.dataset.k === html).forEach(x => x.remove());
    $('#toasts').appendChild(t); setTimeout(() => t.remove(), 4200);
    while ($('#toasts').children.length > 2) $('#toasts').firstChild.remove();
  }
  function roleMenu(btn) {
    const r = btn.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.right - 280, innerWidth - 288));
    $('#menu').innerHTML = '<div class="scrim" data-action="menuClose" style="position:fixed;inset:0;z-index:69"></div><div class="menu" role="menu" style="top:' + (r.bottom + 6) + 'px;left:' + left + 'px">' +
      S.roles.map(x => '<button type="button" role="menuitem" class="' + (x.id === st.role ? 'on' : '') + '" data-action="setRole" data-role="' + x.id + '"><span class="avatar">' + initials(x.person) + '</span><span><b>' + esc(x.name) + '</b><small>' + esc(x.person) + '</small></span></button>').join('') +
      '<button type="button" role="menuitem" data-action="logout"><span class="avatar" style="background:var(--panel-2);color:var(--ink-2)">' + ic('x', 14) + '</span><span><b>Выйти</b><small>к выбору роли</small></span></button></div>';
  }

  function workerDrawer(id) {
    const w = W(id), sc = scoreOf(w);
    drawer('<div class="drawer-h"><div style="display:grid;gap:4px"><h2>' + esc(w.name) + '</h2><div class="oh-meta"><span class="pill ok">активный</span>' + (w.isNew ? '<span class="pill info">новичок</span>' : '') + '</div></div><button class="icon-btn" type="button" data-action="dClose" aria-label="Закрыть">' + ic('x', 16) + '</button></div>' +
      '<div class="drawer-b"><dl class="kv"><dt>Телефон</dt><dd>+7 9•• ••• ' + w.tail + ' <span class="muted small">полный номер скрыт</span></dd><dt>ИНН</dt><dd>•••• •••• ' + (1000 + parseInt(w.tail.replace(' ', ''), 10) % 9000) + '</dd><dt>Территория</dt><dd>Москва Север</dd><dt>Юрлицо</dt><dd>' + esc(w.le || 'ООО «Линия Персонал»') + '</dd><dt>Форма</dt><dd>Самозанятый · выплаты через адаптер</dd>' +
      '<dt>Медкнижка</dt><dd>' + (w.medbook ? '<span class="pill warn">истекла 14.10.2026</span>' : 'действует до 03.2027') + '</dd><dt>Навыки</dt><dd>Комплектовщик, Грузчик' + (w.svc > 30 ? ', Наставник' : '') + '</dd><dt>Спецодежда</dt><dd>Спецобувь 43, жилет L</dd><dt>Bitrix ID</dt><dd class="num">B24-' + (57000 + parseInt(w.tail.replace(' ', ''), 10) % 1000) + '</dd><dt>Блокировки</dt><dd class="muted">нет</dd></dl>' +
      '<div class="card card-b" style="display:grid;gap:8px"><b>Почему ' + sc.s + ' из 100</b><div class="reasons">' + sc.r.map(r => '<span class="reason ' + r[0] + '">' + esc(r[1]) + '</span>').join('') + '</div><p class="muted small">Веса настраиваются руководителем: постоянство на объекте, опыт услуги, успешные смены, дисциплина, давность выхода.</p></div>' +
      '<div class="cand-tools"><button class="btn" type="button" data-action="call" data-id="' + id + '">' + ic('phone', 15) + 'Позвонить</button><button class="btn" type="button" disabled title="Нет права на просмотр полного номера">Показать номер</button></div></div>');
  }

  /* ---------- Действия ---------- */
  const A = {
    login: el => { st.role = el.dataset.role; save(); go(me().home); render(); },
    logout: () => { st.role = null; $('#menu').innerHTML = ''; save(); render(); },
    setRole: el => { st.role = el.dataset.role; $('#menu').innerHTML = ''; save(); const v = el.dataset.v || (can(route()) ? route() : me().home); go(v); render(); toast('Вы вошли как <b>' + esc(me().name) + '</b>: ' + esc(me().person)); },
    roleMenu: el => roleMenu(el),
    menuClose: () => { $('#menu').innerHTML = ''; },
    theme: () => {
      const root = document.documentElement;
      const dark = root.getAttribute('data-theme') === 'dark';
      st.theme = dark ? 'light' : 'dark'; root.setAttribute('data-theme', st.theme); save(); renderNav(); syncThemeColor();
    },
    reset: () => { const role = st.role, theme = st.theme; store.clear(); st = freshState(); st.role = role; st.theme = theme; save(); render(); toast('Демо сброшено к началу сценария.'); },
    openSide: () => $('#shell').classList.add('side-open'),
    closeSide: () => $('#shell').classList.remove('side-open'),
    nav: el => go(el.dataset.v),
    pickOrder: el => { st.active = +el.dataset.id; save(); render(); },
    toggleSel: el => { const id = el.dataset.id, s = O().selected; const i = s.indexOf(id); if (i >= 0) s.splice(i, 1); else s.push(id); save(); render(); },
    selectTop: () => {
      const need = Math.max(1, target() - asgIds().length);
      const c = S.workers.filter(x => !O().assigned[x.id] && !O().raced.includes(x.id) && !O().offers[x.id]).map(x => ({ id: x.id, s: scoreOf(x).s })).sort((a, b) => b.s - a.s);
      O().selected = c.slice(0, need + 3).map(x => x.id); save(); render();
      toast('Выбрано ' + O().selected.length + ': нужно ' + need + ' до цели + запас на отказы.');
    },
    massOffer: () => massOffer(O().selected.slice()),
    offerOne: el => massOffer([el.dataset.id]),
    assign: el => doAssign(el.dataset.id, false),
    unassign: el => { const w = W(el.dataset.id); delete O().assigned[w.id]; log('Заказ №2841: снят ' + w.name, 'Решение оператора'); save(); render(); toast('<b>' + esc(w.name) + '</b> снят с заказа.'); },
    transfer: el => {
      const w = W(el.dataset.id);
      modal({ title: 'Перевести на другой заказ', body: '<p>' + esc(w.name) + ' будет снят с №2841 и назначен на выбранный заказ той же услуги. Пересечения проверит сервер.</p><label class="field"><span>Заказ</span><select id="trTo"><option value="2846">№2846 · Комплектовщик · РЦ Подольск · ночь 23.10</option></select></label>', ok: 'Перевести', cancel: 'Отмена',
        onOk: () => { delete O().assigned[w.id]; log('Перевод ' + w.name + ': №2841 → №2846', 'Решение оператора'); save(); render(); toast('<b>' + esc(w.name) + '</b> переведён на №2846.'); return true; } });
    },
    call: el => {
      const w = W(el.dataset.id);
      st.integ.unshift({ t: now(), sys: 'Телефония', dir: 'выход', ent: 'Звонок · ' + w.name, ext: 'CALL-' + (92000 + st.clock), res: 'ok', msg: 'Callback через API: оператор ↔ исполнитель, номер в браузер не передавался' });
      tick('A11'); save();
      toast('Соединяем через телефонию: ваш внутренний ↔ <b>+7 9•• ••• ' + w.tail + '</b>. Полный номер не передаётся в браузер.');
      if (route() === 'journal') render();
    },
    changeQty: () => {
      modal({ title: 'Изменить заказ №2841', body: '<div class="callout warn">' + ic('alert', 18) + '<div>Дедлайн изменений — 22.10 в 18:00, сейчас 20:15. Это позднее изменение: история сохранится, операторы территории получат уведомление.</div></div>' +
        '<label class="field"><span>Количество по заказу клиента</span><input id="qN" type="number" inputmode="numeric"min="1" max="40" value="' + O().qty + '"></label><label class="field" id="f-q"><span>Основание</span><textarea id="qR" placeholder="Например: письмо клиента 22.10 19:40, доп. поставка"></textarea><span class="err-t" hidden>Для позднего изменения нужно основание</span></label>',
        ok: 'Сохранить изменение', cancel: 'Отмена',
        onOk: () => {
          const n = parseInt($('#qN').value, 10), why = $('#qR').value.trim();
          if (!n || n < 1) return false;
          if (!why) { $('#f-q').classList.add('err'); $('#f-q .err-t').hidden = false; return false; }
          if (n === O().qty) return true;
          const t = now();
          O().qtyHist.push(t + ' · ' + shortName(me().person) + ' · заказ ' + O().qty + ' → ' + n + ' · ' + why);
          log('Заказ №2841: количество ' + O().qty + ' → ' + n + ' (после дедлайна)', why, 'order');
          O().qty = n; tick('A02'); save(); render();
          toast('Заказ изменён: цель пересчитана до ' + target() + '. Операторы территории уведомлены.');
          return true;
        } });
    },
    psNext: () => psAdvance(),
    psReset: () => { const o = O(); o.moment = 0; o.meta = {}; asgIds().forEach((id, i) => { o.assigned[id] = i < 2 ? 'confirmed' : 'assigned'; }); save(); render(); },
    warnForeman: el => { const w = W(el.dataset.id); toast('Бригадир получил уведомление: <b>' + esc(w.name) + '</b> будет к 20:20.'); },
    replace: el => {
      const out = W(el.dataset.id);
      const c = S.workers.filter(x => !O().assigned[x.id] && !O().raced.includes(x.id) && !x.medbook).map(x => ({ w: x, s: scoreOf(x).s })).sort((a, b) => b.s - a.s);
      if (!c.length) { toast('Свободных подходящих кандидатов нет — эскалация руководителю.'); return; }
      const n = c[0].w;
      modal({ title: 'Замена для ' + out.name, body: '<p>Лучший свободный кандидат по объяснимому счёту:</p><div class="card card-b" style="display:grid;gap:6px"><b>' + esc(n.name) + ' · ' + c[0].s + '/100</b><div class="reasons">' + scoreOf(n).r.map(r => '<span class="reason ' + r[0] + '">' + esc(r[1]) + '</span>').join('') + '</div></div>', ok: 'Назначить замену', cancel: 'Отмена',
        onOk: () => { delete O().assigned[out.id]; const mo = O().moment || 0; O().meta = O().meta || {}; O().assigned[n.id] = mo >= 2 ? 'enroute' : mo === 1 ? 'confirmed' : 'assigned'; if (mo) O().meta[n.id] = mo >= 2 ? { src: 'Согласился на замену и выехал', t: '23.10 · 18:41', eta: 'к 19:50' } : { src: 'Согласился на замену в боте', t: '22.10 · 21:48' }; log('Заказ №2841: замена ' + out.name + ' → ' + n.name, 'Отказ / нет ответа перед сменой'); save(); render(); toast('Замена назначена: <b>' + esc(n.name) + '</b>.'); return true; } });
    },
    worker: el => workerDrawer(el.dataset.id),
    dClose: () => closeDrawer(),
    mClose: () => closeModal(),
    mOk: () => { if (!modalCfg) return; const r = modalCfg.onOk ? modalCfg.onOk() : true; if (r !== false) closeModal(); },
    fmHere: el => { const x = st.fm.people[el.dataset.id]; x.here = !x.here; save(); render(); },
    fmAll: () => { Object.values(st.fm.people).forEach(x => { x.here = true; }); save(); render(); },
    fmHours: el => { const x = st.fm.people[el.dataset.id]; x.hours = Math.max(1, Math.min(14, x.hours + (+el.dataset.d))); save(); render(); },
    fmEarly: el => { const x = st.fm.people[el.dataset.id]; x.early = !x.early; x.hours = x.early ? 7 : S.factShift.normHours; save(); render(); },
    fmMove: el => { const x = st.fm.people[el.dataset.id]; x.move = x.move ? null : { to: 'Грузчик', hours: 2 }; save(); render(); },
    fmSubmit: () => fmSubmit(),
    wfConfirm: () => { st.wf.status = 'confirmed'; log('WorkFact №2836: подтверждён финальный факт, ' + Object.keys(st.wf.rows).length + ' чел.', '—', 'fact'); save(); render(); toast('Факт подтверждён. Теперь любая правка — только с причиной.'); },
    wfEdit: el => wfEdit(el.dataset.id),
    accWorker: el => { st.acc.worker = el.dataset.id; save(); render(); },
    approveExtra: () => { st.acc.extraApproved = true; log('Доплата 600 ₽ (А. Нурланов) подтверждена', 'Холодильная зона 21.10, запрос оператора О. Кравец'); save(); render(); toast('Доплата подтверждена руководителем и вошла в начисление.'); },
    recalc: () => { st.acc.recalc += 1; tick('A09'); save(); render(); toast('Пересчёт №' + st.acc.recalc + ': итог тот же — <b>' + rub(accCalc(st.acc.worker).total) + '</b>. Дубль не создан.'); },
    newTariff: () => { st.acc.nextTariff = true; log('Тариф СЕВ2-КОМП-НОЧЬ: новая версия v4, 340 ₽/ч с 01.11', 'Индексация по договору с клиентом'); tick('A09'); save(); render(); toast('Версия v4 действует с 01.11. Начисления за октябрь не изменились: ' + rub(accCalc(st.acc.worker).total) + '.'); },
    paySel: el => { const s = st.pay.sel, i = s.indexOf(el.dataset.id); if (i >= 0) s.splice(i, 1); else s.push(el.dataset.id); save(); render(); },
    makeBatch: () => { st.pay.batch = 'PB-1042'; st.pay.sel.filter(id => pSt(id) === 'ready').forEach(id => { st.pay.st[id] = 'batch'; }); save(); render(); toast('Пакет PB-1042 сформирован.'); },
    sendBatch: () => sendBatch(),
    fixReq: el => {
      const p = S.payouts.find(x => x.id === el.dataset.id);
      modal({ title: 'Исправить реквизиты · ' + p.name, body: '<div class="callout info">' + ic('lock', 18) + '<div>Прежние реквизиты не раскрываются: видно только «' + esc(p.method) + '». Правка и её автор попадут в журнал доступа к чувствительным данным.</div></div>' +
        '<label class="field"><span>Способ</span><select id="rqT"><option>СБП по номеру телефона</option><option>Банковский счёт</option></select></label><label class="field" id="f-rq"><span>Новые реквизиты</span><input id="rqV" inputmode="tel" autocomplete="off" placeholder="+7 9__ ___ __ __"><span class="err-t" hidden>Укажите реквизиты</span></label>', ok: 'Сохранить реквизиты', cancel: 'Отмена',
        onOk: () => {
          const v = $('#rqV').value.replace(/\D/g, '');
          if (v.length < 4) { $('#f-rq').classList.add('err'); $('#f-rq .err-t').hidden = false; return false; }
          st.pay.st[p.id] = 'fixed'; st.pay.notes[p.id + 'm'] = ($('#rqT').value.startsWith('СБП') ? 'СБП ···· ' : 'Счёт ···· ') + v.slice(-2);
          log('Реквизиты ' + p.name + ' изменены (старые не раскрыты)', 'Ошибка выплаты ' + p.id + ': ' + p.error, 'sens');
          save(); render(); toast('Реквизиты исправлены. Бухгалтер может безопасно повторить выплату.'); return true;
        } });
    },
    retryPay: el => {
      const id = el.dataset.id; st.pay.st[id] = 'retry'; save(); render();
      setTimeout(() => {
        st.pay.st[id] = 'paid'; st.pay.notes[id] = 'Повтор с тем же ключом ' + id + ': оплачено один раз';
        st.integ.unshift({ t: now(), sys: 'Выплаты', dir: 'выход', ent: 'Повтор выплаты', ext: id, res: 'ok', msg: 'Тот же ключ идемпотентности, провайдер подтвердил одну оплату' });
        tick('A10'); save(); render(); toast('Выплата прошла. Ключ тот же — двойной оплаты быть не может.');
      }, 1200);
    },
    jTab: el => { st.jTab = el.dataset.t; save(); render(); },
    critToggle: () => { st.critOpen = !st.critOpen; save(); renderCriteria(); }
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
    if (A[a]) { e.preventDefault(); A[a](el, e); }
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.matches('input[type=checkbox][data-action]')) { A[el.dataset.action] && A[el.dataset.action](el); }
    if (el.matches('select[data-action=fmMentor]')) { st.fm.people[el.dataset.id].mentor = el.value; save(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeDrawer(); $('#menu').innerHTML = ''; } });

  /* ---------- Рендер ---------- */
  // Подписи ячеек для карточной раскладки таблиц на телефоне (стили в styles.css, max-width: 640px).
  // Первая содержательная ячейка становится заголовком карточки, ячейки с кнопками уходят отдельной строкой,
  // длинные тексты занимают всю ширину.
  function labelTables(root) {
    root.querySelectorAll('table.tbl').forEach(t => {
      const heads = [...t.querySelectorAll('thead th')].map(h => h.textContent.trim());
      t.querySelectorAll('tbody tr').forEach(tr => {
        let titled = false;
        [...tr.children].forEach((td, i) => {
          if (td.querySelector('input[type=checkbox]')) { td.classList.add('sel'); return; }
          const hasText = td.textContent.trim().length > 0;
          if (td.querySelector('button')) td.classList.add('act');
          if (!titled && hasText && !td.classList.contains('act')) { td.classList.add('t'); titled = true; }
          else if (heads[i]) td.dataset.label = heads[i];
          if (td.textContent.trim().length > 26 || td.querySelector('.svc-line')) td.classList.add('wide');
        });
      });
    });
  }
  // Цвет системной панели браузера совпадает с верхом страницы в текущей теме
  function syncThemeColor() {
    const c = getComputedStyle(document.documentElement).getPropertyValue(st.role ? '--panel' : '--bg').trim();
    if (!c) return;
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.removeAttribute('media'); m.setAttribute('content', c); });
  }

  function render() {
    if (st.theme) document.documentElement.setAttribute('data-theme', st.theme);
    syncThemeColor();
    renderLogin();
    if (!st.role) { renderCriteria(); return; }
    let v = route();
    if (!v) { go(me().home); return; }
    renderNav(); renderTop();
    const map = { staffing: vStaffing, preshift: vPreshift, foreman: vForeman, workfact: vWorkfact, accruals: vAccruals, payouts: vPayouts, attention: vAttention, kpi: vKpi, journal: vJournal };
    const keep = $('.pwa-list') ? $('.pwa-list').scrollTop : 0;
    $('#view').innerHTML = can(v) ? map[v]() : vNoAccess(v);
    labelTables($('#view'));
    document.body.dataset.view = v;
    if (keep && $('.pwa-list')) $('.pwa-list').scrollTop = keep;
    $('#shell').classList.remove('side-open');
    renderCriteria();
  }
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  render();
})();
