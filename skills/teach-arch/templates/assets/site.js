/* teach-arch lesson driver: gating, save + check + auto-create flows, correction rendering. */
(function () {
  'use strict';

  var id = (location.pathname.match(/(\d{4})/) || [])[1] || '';
  var qGroups = [].slice.call(document.querySelectorAll('[data-practice="q"]'));
  var wTas = [].slice.call(document.querySelectorAll('[data-practice="w"]'));
  var tas = wTas;
  var btnCheck = document.getElementById('btn-check');
  var btnCreate = document.getElementById('btn-create');
  var statusEl = document.getElementById('practice-status');
  var extraEl = document.getElementById('correction-extra');
  if (!btnCheck || !btnCreate) return;

  /* ---------- http helpers ---------- */
  function post(url, data) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) {
        if (!r.ok) throw new Error(body.error || 'HTTP ' + r.status);
        return body;
      });
    });
  }
  function getJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function setStatus(msg) {
    statusEl.textContent = msg || '';
    statusEl.hidden = !msg;
  }

  /* ---------- gating: every MCQ answered AND every input textarea filled ---------- */
  function allFilled() {
    var mcqDone = qGroups.length === 0 || qGroups.every(function (g) {
      return !!g.querySelector('input[type="radio"]:checked');
    });
    var wDone = tas.length === 0 || tas.every(function (t) { return t.value.trim(); });
    return (qGroups.length + tas.length) > 0 && mcqDone && wDone;
  }
  function gating() {
    if (btnCheck.disabled) return;
    btnCheck.hidden = !allFilled();
  }

  function collect() {
    var fields = {};
    qGroups.forEach(function (g) {
      var n = g.getAttribute('data-n') || '';
      var checked = g.querySelector('input[type="radio"]:checked');
      fields['q' + n] = checked ? checked.value : '';
    });
    tas.forEach(function (t) {
      fields['w' + (t.dataset.n || '')] = t.value;
    });
    return { id: id, fields: fields };
  }

  /* ---------- run polling ---------- */
  function poll(action) {
    return new Promise(function (resolve, reject) {
      var t0 = Date.now();
      var timer = setInterval(function () {
        getJson('/api/state').then(function (st) {
          var s = st[action] || { status: 'idle' };
          if (s.status === 'done') { clearInterval(timer); resolve(); }
          else if (s.status === 'error') {
            clearInterval(timer);
            reject(new Error(s.tail || 'Agent run failed'));
          } else {
            setStatus('Agent working … ' + Math.round((Date.now() - t0) / 1000) + 's');
          }
        }).catch(function (e) { clearInterval(timer); reject(e); });
      }, 1500);
    });
  }

  function fetchCorrection() {
    return fetch('/api/correction?id=' + id).then(function (r) {
      if (!r.ok) throw new Error('Correction file not found');
      return r.text();
    });
  }

  function fail(e) {
    setStatus('Error: ' + (e.message || e) + ' — click retry.');
    btnCheck.disabled = false;
    btnCheck.textContent = '↻ Retry';
    delete btnCheck.dataset.busy;
    btnCreate.disabled = false;
  }

  /* ---------- flows ---------- */
  function runCheck() {
    if (btnCheck.disabled) return;
    btnCheck.disabled = true;
    btnCheck.dataset.busy = '1';
    btnCheck.textContent = '✓ Check answers';
    setStatus('Saving answers …');
    post('/api/practice', collect())
      .then(function () {
        setStatus('Starting correction …');
        return post('/api/check', { id: id });
      })
      .then(function () { return poll('check'); })
      .then(fetchCorrection)
      .then(function (md) {
        render(md);
        setStatus('Correction ready ✓');
        btnCreate.hidden = false;
        btnCheck.disabled = false;
        delete btnCheck.dataset.busy;
      })
      .catch(fail);
  }

  function runCreate() {
    if (btnCreate.disabled) return;
    btnCreate.disabled = true;
    btnCheck.disabled = true;
    setStatus('Creating next lesson …');
    post('/api/create', {})
      .then(function () { return poll('create'); })
      .then(function () { location.reload(); })
      .catch(fail);
  }

  /* ---------- correction rendering ----------
     Group identity comes from HTML comment anchors (<!-- group:q -->), never
     from prose. */
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  function tableHtml(rows) {
    var cells = rows.map(function (r) {
      return r.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); });
    });
    var head = cells[0];
    var body = cells.slice(2);
    return '<table><thead><tr>' + head.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      body.map(function (r) {
        return '<tr>' + r.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
  }
  function mdToHtml(src) {
    var lines = src.split(/\r?\n/);
    var out = [];
    var i = 0;
    while (i < lines.length) {
      var l = lines[i];
      if (!l.trim()) { i++; continue; }
      if (/^(-{3,}|\*{3,})\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
      if (/^#{3,}\s+/.test(l)) { out.push('<h5>' + inline(l.replace(/^#+\s+/, '')) + '</h5>'); i++; continue; }
      if (/^>\s?/.test(l)) {
        var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, '')); i++; }
        out.push('<blockquote>' + mdToHtml(q.join('\n')) + '</blockquote>');
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(l) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
        var rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(lines[i]); i++; }
        out.push(tableHtml(rows));
        continue;
      }
      if (/^\s*[-*]\s+/.test(l)) {
        var ul = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
          ul.push('<li>' + inline(lines[i].replace(/^\s*[-*]\s+/, '')) + '</li>'); i++;
        }
        out.push('<ul>' + ul.join('') + '</ul>');
        continue;
      }
      if (/^\s*\d+\.\s+/.test(l)) {
        var ol = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          ol.push('<li>' + inline(lines[i].replace(/^\s*\d+\.\s+/, '')) + '</li>'); i++;
        }
        out.push('<ol>' + ol.join('') + '</ol>');
        continue;
      }
      var para = [l];
      i++;
      while (i < lines.length && lines[i].trim() &&
        !/^(#{3,}\s|>\s?|\s*[-*]\s|\s*\d+\.\s|\s*\|)/.test(lines[i]) &&
        !/^(-{3,}|\*{3,})\s*$/.test(lines[i])) {
        para.push(lines[i]); i++;
      }
      out.push('<p>' + para.map(inline).join('<br>') + '</p>');
    }
    return out.join('\n');
  }
  function splitSections(md) {
    var out = [];
    var cur = { title: '', group: null, lines: [] };
    var pending = null;   /* anchor binds to the NEXT heading only */
    out.push(cur);
    md.split(/\r?\n/).forEach(function (l) {
      var anchor = l.match(/^\s*<!--\s*group:([qw])\s*-->\s*$/i);
      if (anchor) {
        pending = anchor[1].toLowerCase();
        return;
      }
      if (/^##\s+/.test(l)) {
        cur = { title: l.replace(/^##\s+/, '').trim(), group: pending, lines: [] };
        pending = null;
        out.push(cur);
      } else {
        cur.lines.push(l);
      }
    });
    return out.filter(function (s) { return s.title || s.lines.join('').trim(); });
  }
  function splitItems(lines) {
    var lead = [];
    var items = [];
    var cur = null;
    lines.forEach(function (l) {
      var m = l.match(/^\s*(?:[-*]\s*)?\*\*(\d+)\.\*\*/);
      if (m) {
        cur = { n: parseInt(m[1], 10), lines: [l] };
        items.push(cur);
      } else if (cur) {
        cur.lines.push(l);
      } else {
        lead.push(l);
      }
    });
    return { lead: lead.join('\n').trim(), items: items };
  }
  function splitTableItems(lines) {
    var rows = lines.filter(function (l) { return /^\s*\|.*\|\s*$/.test(l); });
    if (rows.length < 3) return null;
    var body = rows.slice(2).map(function (r) {
      return r.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); });
    });
    var items = [];
    body.forEach(function (cells) {
      var n = parseInt(String(cells[0] || '').replace(/[^0-9]/g, ''), 10);
      if (!n) return;
      items.push({ n: n, lines: [cells.slice(1).filter(Boolean).join(' — ')] });
    });
    return items.length ? items : null;
  }
  function practiceEl(group, n) {
    if (group === 'q') {
      return qGroups.filter(function (g) { return g.getAttribute('data-n') === String(n); })[0];
    }
    return tas.filter(function (t) {
      return t.dataset.practice === 'w' && String(t.dataset.n || '1') === String(n || '1');
    })[0] || tas[0];
  }
  function ensureBox(el) {
    var next = el.nextElementSibling;
    if (next && next.classList && next.classList.contains('correction')) return next;
    var d = document.createElement('div');
    d.className = 'correction';
    el.insertAdjacentElement('afterend', d);
    return d;
  }
  function render(md) {
    [].forEach.call(document.querySelectorAll('.correction'), function (d) { d.remove(); });
    extraEl.innerHTML = '';
    splitSections(md).forEach(function (sec) {
      var group = sec.group;
      var titleHtml = sec.title ? '<h4 class="corr-title">' + esc(sec.title) + '</h4>' : '';
      if (group === 'w' || group === 'q') {
        var parts = splitItems(sec.lines);
        var items = parts.items;
        var lead = parts.lead;
        if (!items.length) {
          var tableItems = splitTableItems(sec.lines);
          if (tableItems) { items = tableItems; lead = ''; }
        }
        var matched = items.filter(function (it) { return practiceEl(group, it.n); });
        if (matched.length) {
          matched.forEach(function (it, idx) {
            var box = ensureBox(practiceEl(group, it.n));
            if (idx === 0) {
              box.innerHTML += titleHtml;
              if (lead) box.innerHTML += mdToHtml(lead);
            }
            box.innerHTML += mdToHtml(it.lines.join('\n'));
          });
          return;
        }
        var fallback = group === 'q' ? qGroups[0] : tas[0];
        if (fallback && sec.lines.join('').trim()) {
          ensureBox(fallback).innerHTML += titleHtml + mdToHtml(sec.lines.join('\n'));
          return;
        }
      }
      extraEl.insertAdjacentHTML('beforeend', titleHtml + mdToHtml(sec.lines.join('\n')));
    });
  }

  /* ---------- boot ---------- */
  function init() {
    gating();
    qGroups.forEach(function (g) {
      [].forEach.call(g.querySelectorAll('input[type="radio"]'), function (r) {
        r.addEventListener('change', gating);
      });
    });
    tas.forEach(function (t) { t.addEventListener('input', gating); });
    btnCheck.addEventListener('click', runCheck);
    btnCreate.addEventListener('click', runCreate);

    fetch('/api/correction?id=' + id).then(function (r) {
      if (r.ok) return r.text();
    }).then(function (md) {
      if (md) { render(md); btnCreate.hidden = false; }
    }).catch(function () {});

    // resume runs that were started before a reload
    getJson('/api/state').then(function (st) {
      if (st.check && st.check.status === 'running') {
        btnCheck.hidden = false;
        btnCheck.disabled = true;
        poll('check').then(fetchCorrection).then(function (md) {
          render(md);
          setStatus('Correction ready ✓');
          btnCreate.hidden = false;
          btnCheck.disabled = false;
        }).catch(fail);
      }
      if (st.create && st.create.status === 'running') {
        btnCreate.hidden = false;
        btnCreate.disabled = true;
        poll('create').then(function () { location.reload(); }).catch(fail);
      }
    }).catch(function () {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
