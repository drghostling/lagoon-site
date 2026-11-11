/* Lagoon site: the menu bar tint and the island demo. No tracking, no network requests. */
(() => {
  'use strict';
  const d = document;

  /* The menu bar takes its tint from what is under it, as it does on macOS. */
  const bar = d.querySelector('.menubar');
  const darks = [...d.querySelectorAll('[data-dark]')];
  if (bar && darks.length) {
    let queued = false;
    const paint = () => {
      queued = false;
      const y = bar.getBoundingClientRect().height / 2;
      const dark = darks.some(el => {
        const r = el.getBoundingClientRect();
        return r.top <= y && r.bottom > y;
      });
      bar.classList.toggle('light', !dark);
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(paint); } };
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue);
    paint();
  }

  /* ---------- the island ---------- */
  const island = d.getElementById('island');
  if (!island) return;
  const inner = island.querySelector('.i-inner');
  const list = d.getElementById('i-list');
  const label = d.getElementById('i-label');
  const recBtn = d.getElementById('rec');
  const live = d.getElementById('demo-live');
  const chips = [...island.querySelectorAll('.chip[data-min]')];

  const svg = (body, cls) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"${cls ? ` class="${cls}"` : ''}>${body}</svg>`;
  const line = 'fill="none" stroke="currentColor" stroke-linecap="round"';
  const I = {
    timer: svg(`<path d="M12 3.6a8.4 8.4 0 1 1-5.94 2.46" ${line} stroke-width="2.3"/><path d="M12 3.6v3.1M12 12 8.7 8.7" ${line} stroke-width="2.3"/>`, 'glyph'),
    wave: svg(`<path d="M3 9.6v4.8M6.2 6.6v10.8M9.4 8.6v6.8M12.6 3.6v16.8M15.8 7.2v9.6M19 5.6v12.8M22 10v4" ${line} stroke-width="2"/>`, 'glyph'),
    ok: svg('<circle cx="12" cy="12" r="11" fill="#34C759"/><path d="M7.2 12.4l3.2 3.2 6.6-6.8" fill="none" stroke="#0B2912" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>', 'glyph'),
    pause: svg('<rect x="6.2" y="4.5" width="4" height="15" rx="1.2" fill="currentColor"/><rect x="13.8" y="4.5" width="4" height="15" rx="1.2" fill="currentColor"/>'),
    play: svg('<path d="M8 5.2v13.6a1 1 0 0 0 1.53.85l10.6-6.8a1 1 0 0 0 0-1.7L9.53 4.35A1 1 0 0 0 8 5.2z" fill="currentColor"/>'),
    close: svg(`<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" ${line} stroke-width="2.6"/>`),
    stop: svg('<rect x="5.5" y="5.5" width="13" height="13" rx="2.6" fill="currentColor"/>'),
    mic: svg(`<rect x="8.6" y="2.6" width="6.8" height="11.6" rx="3.4" fill="currentColor"/><path d="M5.2 11.2a6.8 6.8 0 0 0 13.6 0M12 18v3.4" ${line} stroke-width="2.2"/>`),
    copy: svg(`<rect x="8.5" y="7.5" width="10.5" height="13" rx="2.4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5.5 16.2V6a2.5 2.5 0 0 1 2.5-2.5h7.2" ${line} stroke-width="2"/>`),
    folder: svg('<path d="M3.2 7.6a2.4 2.4 0 0 1 2.4-2.4h3.7l2.1 2.2h7a2.4 2.4 0 0 1 2.4 2.4v7.6a2.4 2.4 0 0 1-2.4 2.4H5.6a2.4 2.4 0 0 1-2.4-2.4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M3.2 10.4h17.6" stroke="currentColor" stroke-width="2"/>')
  };

  // The sentence from the App Store screenshot: English with Turkish in the middle.
  const WORDS = "I finished the slides for tomorrow, rakamlar çok iyi görünüyor, but let's check the customer feedback too.".split(' ');
  const MAX_TIMERS = 2;
  const timers = [];
  let rec = null;
  const group = d.createElement('div');
  group.className = 'group';

  const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const say = msg => { live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 40); };

  // The island grows and shrinks with its content, like the real one.
  if ('ResizeObserver' in window) {
    // Layout size, not the on-screen box: the island is scaled while it drops in.
    new ResizeObserver(([entry]) => {
      const box = entry.borderBoxSize && entry.borderBoxSize[0];
      island.style.setProperty('--ih', (box ? box.blockSize : inner.offsetHeight) + 'px');
    }).observe(inner);
  }

  function head() {
    const n = timers.length;
    label.textContent = rec
      ? (n ? `Rec +${n}` : 'Recording')
      : (n ? `${n} ${n === 1 ? 'timer' : 'timers'}` : 'Lagoon');
  }

  /* timers */
  function remaining(t) {
    if (t.paused || t.left === 0) return t.left;
    return Math.max(0, Math.ceil((t.end - Date.now()) / 1000));
  }

  function drawTimer(t) {
    t.left = remaining(t);
    const state = t.left === 0 ? 'done' : t.paused ? 'paused' : 'run';
    const text = mmss(t.left) + (state === 'done' ? ' · done' : state === 'paused' ? ' · paused' : '');
    if (t.sub.textContent !== text) t.sub.textContent = text;
    t.fill.style.setProperty('--p', ((t.total - t.left) / t.total * 100).toFixed(2) + '%');
    if (state !== t.state) {
      t.state = state;
      t.toggle.innerHTML = state === 'run' ? I.pause : I.play;
      t.toggle.setAttribute('aria-label', `${state === 'run' ? 'Pause' : state === 'paused' ? 'Resume' : 'Restart'} ${t.title}`);
      if (state === 'done') say(`${t.title} is done`);
    }
  }

  function addTimer(min, title) {
    if (timers.length >= MAX_TIMERS) removeTimer(timers[0]);
    const t = { title, total: min * 60, left: min * 60, end: Date.now() + min * 60000, paused: false, state: '' };
    t.el = d.createElement('div');
    t.el.className = 't-row';
    t.el.innerHTML = `<div class="t-main">${I.timer}<div><div class="t-title"></div><div class="t-sub"></div></div>` +
      `<div class="btns"><button type="button" class="ib"></button><button type="button" class="ib">${I.close}</button></div></div>` +
      '<div class="t-bar" aria-hidden="true"><i></i></div>';
    t.el.querySelector('.t-title').textContent = title;
    t.sub = t.el.querySelector('.t-sub');
    [t.toggle, t.close] = t.el.querySelectorAll('.ib');
    t.fill = t.el.querySelector('.t-bar i');
    t.close.setAttribute('aria-label', `Close ${title}`);
    t.toggle.addEventListener('click', () => toggleTimer(t));
    t.close.addEventListener('click', () => { removeTimer(t); say(`${title} closed`); });
    timers.push(t);
    group.appendChild(t.el);
    if (!group.isConnected) list.appendChild(group);
    drawTimer(t);
    head();
  }

  function toggleTimer(t) {
    t.left = remaining(t);
    if (t.left === 0) { t.left = t.total; t.paused = false; t.end = Date.now() + t.total * 1000; }
    else if (t.paused) { t.paused = false; t.end = Date.now() + t.left * 1000; }
    else { t.paused = true; }
    drawTimer(t);
  }

  function removeTimer(t) {
    const i = timers.indexOf(t);
    if (i < 0) return;
    const hadFocus = t.el.contains(d.activeElement);
    timers.splice(i, 1);
    t.el.remove();
    if (!timers.length) group.remove();
    head();
    if (hadFocus) (timers.length ? timers[Math.min(i, timers.length - 1)].toggle : chips[0]).focus();
  }

  /* recording */
  function drawRec() {
    if (!rec || rec.flashing) return;
    const n = rec.shown;
    rec.sub.textContent = rec.state === 'saved'
      ? `${mmss(rec.secs)} · ${n} ${n === 1 ? 'word' : 'words'}`
      : `${mmss(rec.secs)} · ${rec.state === 'paused' ? 'Paused' : 'Listening'}`;
  }

  function drawRecChip() {
    const on = !!rec && rec.state !== 'saved';
    recBtn.classList.toggle('on', on);
    recBtn.innerHTML = on ? `${I.stop}<span>Stop</span>` : `${I.mic}<span>Record</span>`;
  }

  function flash(msg) {
    const r = rec;
    r.flashing = true;
    r.sub.textContent = msg;
    say(msg);
    clearTimeout(r.flash);
    r.flash = setTimeout(() => { r.flashing = false; if (rec === r) drawRec(); }, 1800);
  }

  function typeNext() {
    if (!rec || rec.state !== 'rec') return;
    if (rec.shown < WORDS.length) {
      const w = WORDS[rec.shown++];
      rec.text.textContent = WORDS.slice(0, rec.shown).join(' ');
      rec.typing = setTimeout(typeNext, 150 + w.length * 24 + (/[,.]$/.test(w) ? 260 : 0));
    } else {
      rec.typing = setTimeout(() => stopRec(false), 1500);
    }
  }

  function startRec() {
    if (rec) dropRec();
    rec = { secs: 0, shown: 0, state: 'rec' };
    const el = rec.el = d.createElement('div');
    el.className = 'r-card';
    el.innerHTML = `<div class="r-main"><span class="r-icon">${I.wave}</span><div><div class="t-title">Recording</div><div class="t-sub"></div></div>` +
      `<div class="wave" aria-hidden="true">${'<i></i>'.repeat(12)}</div><div class="btns">` +
      `<button type="button" class="ib" data-a="pause" aria-label="Pause recording">${I.pause}</button>` +
      `<button type="button" class="ib" data-a="stop" aria-label="Stop recording"><span class="red">${I.stop}</span></button></div></div>` +
      '<p class="r-text"></p>';
    rec.sub = el.querySelector('.t-sub');
    rec.icon = el.querySelector('.r-icon');
    rec.btns = el.querySelector('.btns');
    rec.text = el.querySelector('.r-text');
    rec.wave = el.querySelector('.wave');
    rec.btns.addEventListener('click', onRecButton);
    list.prepend(el);
    drawRec();
    head();
    drawRecChip();
    say('Recording');
    rec.typing = setTimeout(typeNext, 650);
  }

  function pauseRec() {
    if (rec.state === 'rec') { rec.state = 'paused'; clearTimeout(rec.typing); }
    else { rec.state = 'rec'; rec.typing = setTimeout(typeNext, 400); }
    const b = rec.btns.querySelector('[data-a=pause]');
    b.innerHTML = rec.state === 'paused' ? I.play : I.pause;
    b.setAttribute('aria-label', rec.state === 'paused' ? 'Resume recording' : 'Pause recording');
    rec.el.classList.toggle('paused', rec.state === 'paused');
    drawRec();
  }

  function stopRec(fromCard) {
    if (!rec || rec.state === 'saved') return;
    clearTimeout(rec.typing);
    const hadFocus = rec.el.contains(d.activeElement);
    rec.state = 'saved';
    rec.el.classList.remove('paused');
    rec.el.classList.add('saved');
    rec.icon.innerHTML = I.ok;
    rec.wave.remove();
    rec.btns.innerHTML =
      `<button type="button" class="ib" data-a="copy" aria-label="Copy the transcript">${I.copy}</button>` +
      `<button type="button" class="ib" data-a="folder" aria-label="Show the recording’s folder">${I.folder}</button>` +
      `<button type="button" class="ib" data-a="close" aria-label="Close the recording">${I.close}</button>`;
    drawRec();
    head();
    drawRecChip();
    if (hadFocus || fromCard) rec.btns.querySelector('[data-a=copy]').focus();
    say(`Recording saved, ${rec.shown} ${rec.shown === 1 ? 'word' : 'words'}`);
  }

  function dropRec() {
    if (!rec) return;
    clearTimeout(rec.typing);
    clearTimeout(rec.flash);
    const hadFocus = rec.el.contains(d.activeElement);
    rec.el.remove();
    rec = null;
    head();
    drawRecChip();
    if (hadFocus) recBtn.focus();
  }

  function copyRec() {
    const text = rec.text.textContent.trim();
    if (!text) { flash('Nothing to copy yet'); return; }
    if (!navigator.clipboard) { flash('Copy isn’t available here'); return; }
    navigator.clipboard.writeText(text).then(() => flash('Copied'), () => flash('Copy isn’t available here'));
  }

  function onRecButton(e) {
    const b = e.target.closest('button');
    if (!b || !rec) return;
    const a = b.dataset.a;
    if (a === 'pause') pauseRec();
    else if (a === 'stop') stopRec(true);
    else if (a === 'copy') copyRec();
    else if (a === 'folder') flash('Opens Documents/Lagoon');
    else if (a === 'close') dropRec();
  }

  const toggleRec = () => (rec && rec.state !== 'saved' ? stopRec(false) : startRec());

  /* wiring */
  chips.forEach(c => c.addEventListener('click', () => {
    const m = Number(c.dataset.min);
    addTimer(m, 'Timer');
    say(`${m} minute timer started`);
  }));
  recBtn.addEventListener('click', toggleRec);
  addEventListener('keydown', e => {
    if (e.ctrlKey && e.altKey && !e.metaKey && e.code === 'KeyR') { e.preventDefault(); toggleRec(); }
  });

  setInterval(() => { for (const t of timers) if (!t.paused && t.left > 0) drawTimer(t); }, 250);
  setInterval(() => { if (rec && rec.state === 'rec') { rec.secs++; drawRec(); } }, 1000);

  // Replace the static first frame with live parts.
  list.replaceChildren();
  addTimer(25, 'Focus');
  drawRecChip();
})();
