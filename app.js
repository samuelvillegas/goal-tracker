/* Focus Ledger — offline task stopwatch.
   All data lives in this browser's localStorage. Nothing is sent anywhere. */
(function () {
  'use strict';

  var STORE_KEY = 'focus-ledger/v1';
  var SCHEMA = 1;
  var S = 1000, M = 60000, H = 3600000;
  var RING_DOTS = 60, SUMMARY_DOTS = 20, SHARE_DOTS = 24, LOG_LIMIT = 8;

  /* ---------------- state ---------------- */

  var state = {
    schema: SCHEMA,
    tasks: [],       // {id, name, createdAt}
    sessions: [],    // {id, taskId, start, dur}
    active: null,    // {taskId, startedAt}
    range: 'today'   // 'today' | 'week'
  };

  function uid() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function load() {
    var raw;
    try { raw = localStorage.getItem(STORE_KEY); } catch (e) { return; }
    if (!raw) return;
    var data;
    try { data = JSON.parse(raw); } catch (e) { return; }
    adopt(data);
  }

  function adopt(data) {
    if (!data || typeof data !== 'object') return false;
    var tasks = Array.isArray(data.tasks) ? data.tasks : [];
    var sessions = Array.isArray(data.sessions) ? data.sessions : [];

    state.tasks = tasks.filter(function (t) {
      return t && typeof t.id === 'string' && typeof t.name === 'string';
    }).map(function (t) {
      return { id: t.id, name: String(t.name).slice(0, 60), createdAt: Number(t.createdAt) || Date.now() };
    });

    var ids = {};
    state.tasks.forEach(function (t) { ids[t.id] = true; });

    state.sessions = sessions.filter(function (s) {
      return s && ids[s.taskId] && isFinite(s.start) && isFinite(s.dur) && s.dur > 0;
    }).map(function (s) {
      return { id: typeof s.id === 'string' ? s.id : uid(), taskId: s.taskId, start: Number(s.start), dur: Number(s.dur) };
    }).sort(function (a, b) { return a.start - b.start; });

    state.active = null;
    if (data.active && ids[data.active.taskId] && isFinite(data.active.startedAt)) {
      var at = Math.min(Number(data.active.startedAt), Date.now()); // guard a clock that moved back
      state.active = { taskId: data.active.taskId, startedAt: at };
    }
    state.range = data.range === 'week' ? 'week' : 'today';
    return true;
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        schema: SCHEMA, tasks: state.tasks, sessions: state.sessions,
        active: state.active, range: state.range, savedAt: Date.now()
      }));
    } catch (e) {
      message('Could not save — this browser is blocking local storage, or it is full.');
    }
  }

  /* ---------------- time helpers ---------------- */

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function clock(ms) {
    var s = Math.max(0, Math.floor(ms / S));
    return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60);
  }

  function short(ms) {
    var sec = Math.max(0, Math.floor(ms / S));
    if (sec < 60) return sec + 's';            // a short session should not read as "0m"
    var m = Math.floor(sec / 60), h = Math.floor(m / 60);
    return h ? h + 'h' + pad(m % 60) + 'm' : m + 'm';
  }

  function hm(t) { var d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  function startOfToday() { var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }

  function startOfWeek() {           // weeks run Monday to Sunday
    var d = new Date(); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  }

  function rangeStart() { return state.range === 'week' ? startOfWeek() : startOfToday(); }

  /* ---------------- derived view data ---------------- */

  function derive() {
    var from = rangeStart(), now = Date.now();
    var live = state.active ? Math.max(0, now - state.active.startedAt) : 0;
    var byTask = {};

    state.tasks.forEach(function (t) { byTask[t.id] = { total: 0, count: 0 }; });
    state.sessions.forEach(function (s) {
      if (s.start < from || !byTask[s.taskId]) return;
      byTask[s.taskId].total += s.dur;
      byTask[s.taskId].count += 1;
    });
    if (state.active && byTask[state.active.taskId] && state.active.startedAt >= from) {
      byTask[state.active.taskId].total += live;
      byTask[state.active.taskId].count += 1;
    }

    var rows = state.tasks.map(function (t, i) {
      var agg = byTask[t.id];
      return {
        task: t, index: i, num: pad(i + 3),
        total: agg.total, count: agg.count,
        active: !!state.active && state.active.taskId === t.id
      };
    });

    var grand = rows.reduce(function (a, r) { return a + r.total; }, 0);
    var max = rows.reduce(function (a, r) { return Math.max(a, r.total); }, 1);
    rows.forEach(function (r) {
      r.share = grand ? r.total / grand : 0;
      r.peak = max ? r.total / max : 0;
    });

    var activeRow = rows.filter(function (r) { return r.active; })[0] || null;
    return { rows: rows, grand: grand, live: live, activeRow: activeRow, from: from };
  }

  /* ---------------- tiny DOM helpers ---------------- */

  var $ = function (id) { return document.getElementById(id); };

  function setText(el, value) { if (el && el.textContent !== value) el.textContent = value; }
  function setClass(el, name, on) { if (el) el.classList.toggle(name, !!on); }
  function svg(tag) { return document.createElementNS('http://www.w3.org/2000/svg', tag); }

  function dotStrip(count) {         // returns {el, set(filled, hot)}
    var strip = document.createElement('span');
    strip.className = 'dots';
    var pips = [];
    for (var i = 0; i < count; i++) { var pip = document.createElement('i'); strip.appendChild(pip); pips.push(pip); }
    var last = -1, lastHot = null;
    return {
      el: strip,
      set: function (filled, hot) {
        if (filled === last && hot === lastHot) return;
        last = filled; lastHot = hot;
        for (var i = 0; i < count; i++) {
          pips[i].className = i < filled ? (hot ? 'hot' : 'on') : '';
        }
      }
    };
  }

  function icon(path, size) {
    var el = svg('svg');
    el.setAttribute('width', size); el.setAttribute('height', size);
    el.setAttribute('viewBox', '0 0 24 24'); el.setAttribute('aria-hidden', 'true');
    el.setAttribute('fill', 'none'); el.setAttribute('stroke', 'currentColor');
    el.setAttribute('stroke-width', '2'); el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    var p = svg('path'); p.setAttribute('d', path); el.appendChild(p);
    return el;
  }

  function solidIcon(kind, size) {
    var el = svg('svg');
    el.setAttribute('width', size); el.setAttribute('height', size);
    el.setAttribute('viewBox', '0 0 24 24'); el.setAttribute('aria-hidden', 'true');
    el.setAttribute('fill', 'currentColor');
    var shape;
    if (kind === 'stop') {
      shape = svg('rect');
      shape.setAttribute('x', '5'); shape.setAttribute('y', '5');
      shape.setAttribute('width', '14'); shape.setAttribute('height', '14'); shape.setAttribute('rx', '2');
    } else {
      shape = svg('path');
      shape.setAttribute('d', 'M8 4.8v14.4a1 1 0 0 0 1.5.86l11.5-7.2a1 1 0 0 0 0-1.72L9.5 3.94A1 1 0 0 0 8 4.8z');
    }
    el.appendChild(shape);
    return el;
  }

  var PENCIL = 'M4 20h4l10-10-4-4L4 16v4z';
  var TRASH = 'M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13';

  /* ---------------- stopwatch actions ---------------- */

  function closeActive(at) {
    if (!state.active) return;
    var dur = Math.max(0, at - state.active.startedAt);
    if (dur >= S) {
      state.sessions.push({ id: uid(), taskId: state.active.taskId, start: state.active.startedAt, dur: dur });
    }
    state.active = null;
  }

  function toggle(taskId) {
    var at = Date.now(), starting = !state.active || state.active.taskId !== taskId;
    closeActive(at);
    if (starting) state.active = { taskId: taskId, startedAt: at };
    save();
    render();
  }

  function addTask(name) {
    name = String(name || '').trim().slice(0, 60);
    if (!name) return;
    state.tasks.push({ id: uid(), name: name, createdAt: Date.now() });
    save();
    render();
  }

  function renameTask(id, name) {
    name = String(name || '').trim().slice(0, 60);
    if (!name) return;
    state.tasks.forEach(function (t) { if (t.id === id) t.name = name; });
    save();
    render();
  }

  function deleteTask(id) {
    if (state.active && state.active.taskId === id) state.active = null;
    state.tasks = state.tasks.filter(function (t) { return t.id !== id; });
    state.sessions = state.sessions.filter(function (s) { return s.taskId !== id; });
    save();
    render();
  }

  /* ---------------- the ring ---------------- */

  var ringPips = [];

  function buildRing() {
    var host = $('ring');
    if (!host || ringPips.length) return;
    for (var i = 0; i < RING_DOTS; i++) {
      var a = i / RING_DOTS * Math.PI * 2;
      var c = svg('circle');
      c.setAttribute('cx', (110 + 98 * Math.sin(a)).toFixed(2));
      c.setAttribute('cy', (110 - 98 * Math.cos(a)).toFixed(2));
      c.setAttribute('r', i % 5 === 0 ? '3.2' : '2.2');
      host.appendChild(c);
      ringPips.push(c);
    }
  }

  var ringLast = { sec: -1, on: null };

  function paintRing(running, live) {
    var sec = running ? Math.floor(live / S) % 60 : -1;
    if (sec === ringLast.sec && running === ringLast.on) return;
    ringLast.sec = sec; ringLast.on = running;
    for (var i = 0; i < ringPips.length; i++) {
      var lit = running && i <= sec;
      ringPips[i].setAttribute('fill', lit ? '#FF4A26' : (i % 5 === 0 ? '#8A8A8A' : '#4A4A4A'));
    }
  }

  /* ---------------- task cards ---------------- */

  var cards = {};   // taskId -> refs

  function buildCard(row) {
    var card = document.createElement('section');
    card.className = 'card task-card';

    var top = document.createElement('div');
    top.className = 'task-top';
    var kicker = document.createElement('p');
    kicker.className = 'kicker truncate';
    var num = document.createElement('b');
    var nameSpan = document.createElement('span');
    kicker.appendChild(num);
    kicker.appendChild(document.createTextNode('  '));
    kicker.appendChild(nameSpan);
    var liveTag = document.createElement('span');
    liveTag.className = 'task-live';
    liveTag.hidden = true;
    var liveDot = document.createElement('span');
    liveDot.className = 'dot';
    liveTag.appendChild(liveDot);
    liveTag.appendChild(document.createTextNode('LIVE'));
    top.appendChild(kicker);
    top.appendChild(liveTag);

    var total = document.createElement('p');
    total.className = 'display task-total';
    var caption = document.createElement('p');
    caption.className = 'kicker';
    var strip = dotStrip(SHARE_DOTS);
    strip.el.setAttribute('role', 'img');

    var foot = document.createElement('div');
    foot.className = 'task-foot';
    var share = document.createElement('div');
    share.className = 'share';
    var shareLabel = document.createElement('span');
    shareLabel.className = 'kicker';
    shareLabel.textContent = 'SHARE';
    var shareVal = document.createElement('span');
    shareVal.className = 'display share-val';
    share.appendChild(shareLabel);
    share.appendChild(shareVal);

    var acts = document.createElement('div');
    acts.className = 'task-acts';

    var renameBtn = document.createElement('button');
    renameBtn.type = 'button';
    renameBtn.className = 'icon-btn';
    renameBtn.appendChild(icon(PENCIL, 18));
    renameBtn.addEventListener('click', function () { askRename(row.task.id); });

    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'icon-btn warn';
    delBtn.appendChild(icon(TRASH, 18));
    delBtn.addEventListener('click', function () { askDelete(row.task.id); });

    var playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'play-btn';
    playBtn.addEventListener('click', function () { toggle(row.task.id); });

    acts.appendChild(renameBtn);
    acts.appendChild(delBtn);
    acts.appendChild(playBtn);
    foot.appendChild(share);
    foot.appendChild(acts);

    card.appendChild(top);
    card.appendChild(total);
    card.appendChild(caption);
    card.appendChild(strip.el);
    card.appendChild(foot);

    return {
      el: card, num: num, name: nameSpan, liveTag: liveTag, total: total,
      caption: caption, strip: strip, shareVal: shareVal,
      playBtn: playBtn, renameBtn: renameBtn, delBtn: delBtn, wasActive: null
    };
  }

  function paintCard(ref, row) {
    setText(ref.num, row.num);
    setText(ref.name, row.task.name.toUpperCase());
    setText(ref.total, clock(row.total));
    setText(ref.caption, (state.range === 'week' ? 'THIS WEEK' : 'TODAY') + ' · ' +
      row.count + (row.count === 1 ? ' SESSION' : ' SESSIONS'));

    var pct = Math.round(row.share * 100);
    setText(ref.shareVal, pct + '%');
    ref.strip.set(Math.round(row.share * SHARE_DOTS), row.active);
    ref.strip.el.setAttribute('aria-label', pct + ' percent of tracked time');

    if (ref.wasActive !== row.active) {
      ref.wasActive = row.active;
      ref.el.classList.toggle('is-active', row.active);
      ref.liveTag.hidden = !row.active;
      ref.playBtn.replaceChildren(solidIcon(row.active ? 'stop' : 'play', 20));
    }
    ref.playBtn.setAttribute('aria-label', (row.active ? 'Stop ' : 'Start ') + row.task.name);
    ref.renameBtn.setAttribute('aria-label', 'Rename ' + row.task.name);
    ref.delBtn.setAttribute('aria-label', 'Delete ' + row.task.name);
  }

  var emptyCard = null;

  function syncCards(rows) {
    var grid = $('grid'), anchor = document.querySelector('.form-card');
    var seen = {};

    rows.forEach(function (row) {
      seen[row.task.id] = true;
      var ref = cards[row.task.id];
      if (!ref) { ref = cards[row.task.id] = buildCard(row); }
      paintCard(ref, row);
      grid.insertBefore(ref.el, anchor);   // keeps DOM order matching the data
    });

    Object.keys(cards).forEach(function (id) {
      if (!seen[id]) { cards[id].el.remove(); delete cards[id]; }
    });

    if (!rows.length) {
      if (!emptyCard) {
        emptyCard = document.createElement('section');
        emptyCard.className = 'card no-tasks';
        var h = document.createElement('p');
        h.className = 'display card-head';
        h.textContent = 'NO TRACKS YET';
        var p = document.createElement('p');
        p.className = 'fine';
        p.textContent = 'Name your first task in NEW TASK, then press play to start its clock. Tasks and sessions stay on this device.';
        emptyCard.appendChild(h);
        emptyCard.appendChild(p);
      }
      grid.insertBefore(emptyCard, anchor);
    } else if (emptyCard) {
      emptyCard.remove();
    }
  }

  /* ---------------- summary bars ---------------- */

  var bars = {};

  function syncBars(rows) {
    var host = $('bars'), seen = {};

    rows.forEach(function (row) {
      seen[row.task.id] = true;
      var ref = bars[row.task.id];
      if (!ref) {
        var wrap = document.createElement('div');
        wrap.className = 'bar-row';
        var head = document.createElement('div');
        head.className = 'bar-head';
        var name = document.createElement('span');
        name.className = 'name truncate';
        var time = document.createElement('span');
        time.className = 'time';
        head.appendChild(name);
        head.appendChild(time);
        var strip = dotStrip(SUMMARY_DOTS);
        strip.el.setAttribute('role', 'img');
        wrap.appendChild(head);
        wrap.appendChild(strip.el);
        ref = bars[row.task.id] = { el: wrap, name: name, time: time, strip: strip };
      }
      setText(ref.name, row.num + '  ' + row.task.name);
      setText(ref.time, short(row.total));
      ref.strip.set(Math.round(row.peak * SUMMARY_DOTS), row.active);
      ref.strip.el.setAttribute('aria-label', row.task.name + ': ' + short(row.total));
      ref.el.classList.toggle('on', row.active);
      host.appendChild(ref.el);
    });

    Object.keys(bars).forEach(function (id) {
      if (!seen[id]) { bars[id].el.remove(); delete bars[id]; }
    });
  }

  /* ---------------- session log ---------------- */

  function renderLog(view) {
    var host = $('log'), names = {};
    state.tasks.forEach(function (t) { names[t.id] = t.name; });

    var rows = state.sessions.filter(function (s) { return s.start >= view.from; })
      .slice().reverse().slice(0, LOG_LIMIT);

    if (state.active && state.active.startedAt >= view.from) {
      rows.unshift({ taskId: state.active.taskId, start: state.active.startedAt, dur: view.live, running: true });
      rows = rows.slice(0, LOG_LIMIT);
    }

    host.replaceChildren();
    rows.forEach(function (s) {
      var li = document.createElement('li');
      var when = document.createElement('span');
      when.className = 'when';
      when.textContent = hm(s.start) + '–' + (s.running ? 'now' : hm(s.start + s.dur));
      var what = document.createElement('span');
      what.className = 'what';
      what.textContent = names[s.taskId] || 'Deleted task';
      var rule = document.createElement('span');
      rule.className = 'rule';
      var dur = document.createElement('span');
      dur.className = 'dur';
      dur.textContent = short(s.dur);
      li.appendChild(when); li.appendChild(what); li.appendChild(rule); li.appendChild(dur);
      host.appendChild(li);
    });

    $('log-empty').hidden = rows.length > 0;
  }

  /* ---------------- full paint ---------------- */

  function render() {
    var view = derive(), running = !!state.active;
    var activeTask = running ? state.tasks.filter(function (t) { return t.id === state.active.taskId; })[0] : null;

    setClass($('status-dot'), 'live', running);
    setText($('status-text'), activeTask ? 'Clock running · ' + activeTask.name : 'All clocks stopped');

    setText($('state-word'), running ? 'FOCUSING...' : 'IDLE');
    setText($('active-name'), activeTask ? activeTask.name : 'Pick a task below to start the clock');
    setText($('hero-digits'), clock(view.live));
    setClass($('hero-digits'), 'live', running);
    setText($('stat-started'), running ? hm(state.active.startedAt) : '--:--');
    setText($('stat-total'), view.activeRow ? short(view.activeRow.total) : '--');
    setText($('stat-count'), pad(state.tasks.length));

    $('stop-btn').hidden = !running;
    setText($('ring-label'), running ? 'STOP' : 'PICK A TASK');
    paintRing(running, view.live);

    setText($('range-title'), state.range === 'week' ? 'THIS WEEK' : 'TODAY');
    setText($('grand-total'), clock(view.grand));

    Array.prototype.forEach.call(document.querySelectorAll('#ranges button'), function (b) {
      b.setAttribute('aria-pressed', b.dataset.range === state.range ? 'true' : 'false');
    });

    syncBars(view.rows);
    syncCards(view.rows);
    renderLog(view);

    var n = state.tasks.length;
    setText($('new-num'), pad(n + 3));
    setText($('log-num'), pad(n + 4));
    setText($('data-num'), pad(n + 5));

    document.title = (running ? clock(view.live) + ' · ' : '') + 'Focus Ledger';
  }

  /* ---------------- dialogs ---------------- */

  var pendingId = null;

  function supportsDialog(dlg) { return dlg && typeof dlg.showModal === 'function'; }

  function askRename(id) {
    var task = state.tasks.filter(function (t) { return t.id === id; })[0];
    if (!task) return;
    var dlg = $('rename-dlg');
    if (!supportsDialog(dlg)) {
      var typed = window.prompt('Rename task', task.name);
      if (typed !== null) renameTask(id, typed);
      return;
    }
    pendingId = id;
    $('rename-input').value = task.name;
    dlg.showModal();
    $('rename-input').select();
  }

  function askDelete(id) {
    var task = state.tasks.filter(function (t) { return t.id === id; })[0];
    if (!task) return;
    var count = state.sessions.filter(function (s) { return s.taskId === id; }).length;
    var warning = 'Delete "' + task.name + '"' +
      (count ? ' and its ' + count + ' logged session' + (count === 1 ? '' : 's') : '') +
      '? This cannot be undone.';
    var dlg = $('delete-dlg');
    if (!supportsDialog(dlg)) {
      if (window.confirm(warning)) deleteTask(id);
      return;
    }
    pendingId = id;
    $('delete-text').textContent = warning;
    dlg.showModal();
  }

  /* ---------------- backup ---------------- */

  function message(text) {
    var el = $('data-msg');
    if (el) el.textContent = text;
  }

  function exportBackup() {
    var payload = JSON.stringify({
      schema: SCHEMA, exportedAt: new Date().toISOString(),
      tasks: state.tasks, sessions: state.sessions, active: state.active, range: state.range
    }, null, 2);
    var url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    var a = document.createElement('a');
    var d = new Date();
    a.href = url;
    a.download = 'focus-ledger-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    message('Backup saved to your downloads.');
  }

  function importBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(String(reader.result)); }
      catch (e) { message('That file is not valid JSON.'); return; }
      if (!data || !Array.isArray(data.tasks)) { message('That file is not a Focus Ledger backup.'); return; }
      if (!window.confirm('Replace everything on this device with the backup? Current tasks and sessions will be lost.')) {
        message('Import cancelled.');
        return;
      }
      adopt(data);
      save();
      render();
      message('Backup restored: ' + state.tasks.length + ' task' + (state.tasks.length === 1 ? '' : 's') + '.');
    };
    reader.onerror = function () { message('Could not read that file.'); };
    reader.readAsText(file);
  }

  /* ---------------- install prompt + service worker ---------------- */

  var installEvent = null;

  function wireInstall() {
    var btn = $('install-btn');
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      installEvent = e;
      btn.hidden = false;
    });
    btn.addEventListener('click', function () {
      if (!installEvent) { btn.hidden = true; return; }
      installEvent.prompt();
      installEvent.userChoice.then(function () { installEvent = null; btn.hidden = true; });
    });
    window.addEventListener('appinstalled', function () { installEvent = null; btn.hidden = true; });
  }

  function showToast(text, action) {
    var toast = $('toast');
    setText($('toast-text'), text);
    var btn = $('toast-btn');
    btn.onclick = action;
    toast.hidden = false;
  }

  function wireServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    // Only reload when WE asked a waiting worker to take over. The first install
    // claims the page too, and reloading then would interrupt whatever is on screen.
    var updateRequested = false;

    function takeOver(worker) {
      return function () {
        updateRequested = true;
        worker.postMessage({ type: 'skip-waiting' });
      };
    }

    navigator.serviceWorker.register('./sw.js').then(function (reg) {
      function watch(worker) {
        if (!worker) return;
        worker.addEventListener('statechange', function () {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            showToast('A new version is ready.', takeOver(worker));
          }
        });
      }
      if (reg.waiting && navigator.serviceWorker.controller) {
        showToast('A new version is ready.', takeOver(reg.waiting));
      }
      watch(reg.installing);
      reg.addEventListener('updatefound', function () { watch(reg.installing); });
    }).catch(function () { /* offline install simply stays on the cached copy */ });

    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!updateRequested || reloading) return;
      reloading = true;
      window.location.reload();
    });
  }

  /* ---------------- wiring ---------------- */

  function wire() {
    $('new-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('new-task');
      addTask(input.value);
      input.value = '';
      input.focus();
    });

    $('stop-btn').addEventListener('click', function () {
      if (state.active) toggle(state.active.taskId);
    });

    $('ranges').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-range]');
      if (!btn) return;
      state.range = btn.dataset.range;
      save();
      render();
    });

    $('rename-form').addEventListener('submit', function () {
      renameTask(pendingId, $('rename-input').value);
      pendingId = null;
    });

    $('delete-form').addEventListener('submit', function () {
      deleteTask(pendingId);
      pendingId = null;
    });

    Array.prototype.forEach.call(document.querySelectorAll('.dlg [data-close]'), function (btn) {
      btn.addEventListener('click', function () { btn.closest('dialog').close('cancel'); });
    });

    $('export-btn').addEventListener('click', exportBackup);
    $('import-btn').addEventListener('click', function () { $('import-file').click(); });
    $('import-file').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (file) importBackup(file);
      e.target.value = '';
    });

    // another tab or window changed the data
    window.addEventListener('storage', function (e) {
      if (e.key !== STORE_KEY || !e.newValue) return;
      try { adopt(JSON.parse(e.newValue)); render(); } catch (err) { /* ignore a bad write */ }
    });

    // iOS throttles timers in the background; catch up the moment we are back
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) render();
    });
    window.addEventListener('focus', render);
  }

  /* ---------------- go ---------------- */

  load();
  buildRing();
  wire();
  wireInstall();
  render();
  setInterval(function () { if (!document.hidden) render(); }, 250);
  wireServiceWorker();
})();
