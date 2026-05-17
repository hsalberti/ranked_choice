/* The 2028 Ballot - app.js
 *
 * Pure-browser ranked-choice toy ballot. Walks the user through ~25
 * pairwise matchups, runs an Elo-style update to produce a ranking,
 * and shares a Wordle-shaped summary + a URL that encodes the picks.
 *
 * The "what other voters chose" overlay is a deterministic, hash-seeded
 * estimate — there is no backend. Swap fetchPairStats() for a real
 * endpoint to make it live.
 */

(function () {
  const TOTAL_MATCHUPS = 25;
  const K = 36; // Elo K-factor
  const STORAGE_LOCAL_VOTES = 'ballot28.localvotes.v1';
  const STORAGE_EVENTS = 'ballot28.events.v1';
  // Flip to a real URL when /api/event ships (specs/roadmap.md Phase 1.5).
  const EVENT_FLUSH_URL = null;

  const C = window.CANDIDATES;
  const EC = window.EXTENDED_CANDIDATES || [];
  const byId = Object.fromEntries(C.map(c => [c.id, c]));
  const byIdExt = Object.fromEntries(EC.map(c => [c.id, c]));
  const byIdAll = { ...byId, ...byIdExt };
  const TOTAL_EXTENDED = EC.length;

  /* ---------- state ---------- */
  const ratings = Object.fromEntries(C.map(c => [c.id, 1500]));
  const wins = Object.fromEntries(C.map(c => [c.id, 0]));
  const appearances = Object.fromEntries(C.map(c => [c.id, 0]));
  let matchups = [];
  let cursor = 0;
  // Per-vote undo trail. Each entry captures enough state to reverse the
  // Elo update, local-vote tally, and cursor for the previous step.
  let voteHistory = [];

  // Extended-pool parallel state, used only after the user opts into
  // the "Keep ranking" round from the results screen.
  const extRatings = Object.fromEntries(EC.map(c => [c.id, 1500]));
  const extWins = Object.fromEntries(EC.map(c => [c.id, 0]));
  const extAppearances = Object.fromEntries(EC.map(c => [c.id, 0]));
  let extMatchups = [];
  let extCursor = 0;
  let mode = 'main'; // 'main' | 'extended'
  let extendedDone = false;

  /* ---------- pool accessors (mode-aware) ----------
   * The vote/elo/render functions below read & write through these so
   * extended mode shares the same screen and DOM without forking.
   */
  function pRatings() { return mode === 'extended' ? extRatings : ratings; }
  function pWins() { return mode === 'extended' ? extWins : wins; }
  function pAppearances() { return mode === 'extended' ? extAppearances : appearances; }
  function pMatchups() { return mode === 'extended' ? extMatchups : matchups; }
  function pCursor() { return mode === 'extended' ? extCursor : cursor; }
  function setCursor(n) { if (mode === 'extended') extCursor = n; else cursor = n; }
  function pPool() { return mode === 'extended' ? EC : C; }
  function pTotal() { return mode === 'extended' ? TOTAL_EXTENDED : TOTAL_MATCHUPS; }

  /* ---------- helpers ---------- */
  function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function hashStr(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  function pairKey(a, b) { return [a, b].sort().join('|'); }
  function partyEmoji(p) { return p === 'R' ? '🔴' : p === 'D' ? '🔵' : '⚪️'; }

  /* ---------- engagement tracking ----------
   * Queue tracked clicks (flip_open/close, link_twitter/wikipedia) to
   * localStorage so they survive a reload. Flushed to /api/event when
   * EVENT_FLUSH_URL is set; until then this is a no-op outbound.
   */
  function loadEvents() {
    try { return JSON.parse(localStorage.getItem(STORAGE_EVENTS) || '[]'); }
    catch { return []; }
  }
  function track(event_type, candidate_id, context) {
    if (!candidate_id) return;
    const q = loadEvents();
    q.push({ event_type, candidate_id, context, t: Date.now() });
    if (q.length > 500) q.splice(0, q.length - 500);
    try { localStorage.setItem(STORAGE_EVENTS, JSON.stringify(q)); } catch {}
    flushEvents();
  }
  function flushEvents() {
    if (!EVENT_FLUSH_URL) return;
    const q = loadEvents();
    if (!q.length) return;
    const batch = q.slice(0, 100);
    fetch(EVENT_FLUSH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    }).then(r => {
      if (!r.ok) return;
      const remaining = loadEvents().slice(batch.length);
      try { localStorage.setItem(STORAGE_EVENTS, JSON.stringify(remaining)); } catch {}
    }).catch(() => {});
  }

  function loadLocalVotes() {
    try { return JSON.parse(localStorage.getItem(STORAGE_LOCAL_VOTES) || '{}'); }
    catch { return {}; }
  }
  function saveLocalVote(aId, bId, pickedId) {
    const store = loadLocalVotes();
    const key = pairKey(aId, bId);
    const entry = store[key] || { [aId]: 0, [bId]: 0 };
    entry[aId] = entry[aId] || 0;
    entry[bId] = entry[bId] || 0;
    entry[pickedId] = (entry[pickedId] || 0) + 1;
    store[key] = entry;
    try { localStorage.setItem(STORAGE_LOCAL_VOTES, JSON.stringify(store)); } catch {}
  }
  function undoLocalVote(aId, bId, pickedId) {
    const store = loadLocalVotes();
    const key = pairKey(aId, bId);
    const entry = store[key];
    if (!entry) return;
    entry[pickedId] = Math.max(0, (entry[pickedId] || 0) - 1);
    store[key] = entry;
    try { localStorage.setItem(STORAGE_LOCAL_VOTES, JSON.stringify(store)); } catch {}
  }

  /* ---------- matchup generation ----------
   * Two shuffled lists paired up; rotate to remove self-pairs so each
   * candidate appears exactly twice.
   */
  function buildMatchups(pool, totalCount) {
    pool = pool || C;
    totalCount = totalCount || TOTAL_MATCHUPS;
    let a = shuffle(pool);
    let b = shuffle(pool);
    for (let i = 0; i < a.length; i++) {
      if (a[i].id === b[i].id) {
        const j = (i + 1) % a.length;
        [b[i], b[j]] = [b[j], b[i]];
        if (a[i].id === b[i].id) { // pathological 2-cycle, swap again
          const k = (i + 2) % a.length;
          [b[i], b[k]] = [b[k], b[i]];
        }
      }
    }
    return a.map((x, i) => ({ a: x, b: b[i] })).slice(0, totalCount);
  }

  /* ---------- Elo ---------- */
  function applyElo(winnerId, loserId) {
    const r = pRatings(), w = pWins(), n = pAppearances();
    const Rw = r[winnerId], Rl = r[loserId];
    const Ew = 1 / (1 + Math.pow(10, (Rl - Rw) / 400));
    r[winnerId] = Rw + K * (1 - Ew);
    r[loserId]  = Rl + K * (0 - (1 - Ew));
    w[winnerId]    += 1;
    n[winnerId] += 1;
    n[loserId]  += 1;
  }

  /* ---------- stats: simulated "crowd opinion" for a pair ---------- */
  function fetchPairStats(aId, bId, lastPick) {
    // deterministic base split derived from id hash, biased a bit toward
    // a plausible 35-65% spread; layered with the user's own local tally
    const key = pairKey(aId, bId);
    const seed = hashStr(key);
    const baseFraction = 0.35 + ((seed % 3000) / 3000) * 0.30; // 0.35..0.65 for whichever id sorts first
    const [first] = key.split('|');
    let pctA = (first === aId) ? baseFraction : 1 - baseFraction;
    let pctB = 1 - pctA;

    // simulated prior turnout in the 200-1200 range, also deterministic
    const baseTotal = 200 + (seed % 1000);
    let votesA = Math.round(pctA * baseTotal);
    let votesB = Math.round(pctB * baseTotal);

    // overlay any local tally so repeat users see their effect
    const local = loadLocalVotes()[key];
    if (local) { votesA += local[aId] || 0; votesB += local[bId] || 0; }
    if (lastPick === aId) votesA += 1; else if (lastPick === bId) votesB += 1;

    const tot = votesA + votesB;
    return {
      pctA: votesA / tot,
      pctB: votesB / tot,
      total: tot,
    };
  }

  /* ---------- rendering ---------- */
  const $ = sel => document.querySelector(sel);
  const screens = {
    start: $('#screen-start'),
    vote: $('#screen-vote'),
    results: $('#screen-results'),
  };
  function show(name) {
    Object.entries(screens).forEach(([k, el]) => el.classList.toggle('active', k === name));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function avatarHtml(c, size) {
    const sizeClass = size === 'sm' ? ' sm' : size === 'xs' ? ' xs' : '';
    return `<div class="avatar party-${c.party}${sizeClass}" aria-hidden="true">${initials(c.name)}</div>`;
  }

  function renderStartPreview() {
    const pool = shuffle(C).slice(0, 6);
    $('#start-preview').innerHTML = pool.map(c => avatarHtml(c, 'sm')).join('');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function backHtml(c) {
    const policy = (c.policy || []).map(p => `<li>${escapeHtml(p)}</li>`).join('');
    const tw = c.links && c.links.twitter ? c.links.twitter : null;
    const wk = c.links && c.links.wikipedia ? c.links.wikipedia : null;
    const twIcon = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M18.244 2H21.5l-7.5 8.572L23 22h-6.84l-5.36-7.01L4.5 22H1.244l8.04-9.19L1 2h7.014l4.85 6.41L18.244 2Zm-1.2 18h1.86L7.04 4H5.1l11.944 16Z"/></svg>`;
    const wkIcon = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M3 4h4.2l3.1 9.8L13.2 4h2l2.8 9.8L21 4h2L19 20h-2l-2.5-9.7L11.5 20h-2L4.5 4H3Z"/></svg>`;

    return `
      <div class="back-header">
        <div class="back-name">${escapeHtml(c.name)}</div>
      </div>
      ${c.bio_long ? `
      <div class="back-section">
        <div class="back-section-label">Bio</div>
        <p>${escapeHtml(c.bio_long)}</p>
      </div>` : ''}
      ${c.storyline ? `
      <div class="back-section">
        <div class="back-section-label">The 2028 storyline</div>
        <p>${escapeHtml(c.storyline)}</p>
      </div>` : ''}
      ${policy ? `
      <div class="back-section">
        <div class="back-section-label">Key positions</div>
        <ul class="back-policy">${policy}</ul>
      </div>` : ''}
      ${c.moment ? `
      <div class="back-section back-moment">
        <p>${escapeHtml(c.moment)}</p>
      </div>` : ''}
      <div class="back-links">
        ${tw
          ? `<a class="link-btn" href="${escapeHtml(tw)}" target="_blank" rel="noopener noreferrer" data-link="twitter" data-cid="${c.id}">${twIcon} Twitter / X</a>`
          : `<span class="link-btn" aria-disabled="true">${twIcon} No Twitter</span>`}
        ${wk
          ? `<a class="link-btn" href="${escapeHtml(wk)}" target="_blank" rel="noopener noreferrer" data-link="wikipedia" data-cid="${c.id}">${wkIcon} Wikipedia</a>`
          : ''}
      </div>
    `;
  }

  function renderCard(slot, c) {
    const el = $('#card-' + slot);
    el.innerHTML = `
      <div class="card-inner">
        <div class="card-face front">
          <button class="info-btn" type="button" data-action="flip" aria-label="More about ${escapeHtml(c.name)}">ⓘ</button>
          ${avatarHtml(c)}
          <div class="card-name">${escapeHtml(c.name)}</div>
          <div class="card-role">${escapeHtml(c.role)}</div>
          <span class="party-chip party-${c.party}"><span class="dot"></span>${partyLabel(c.party)}</span>
          <div class="card-hook">${escapeHtml(c.hook || '')}</div>
          <div class="tap-more">Tap to pick · ⓘ for more</div>
        </div>
        <div class="card-face back" aria-hidden="true">
          <button class="flip-back-btn" type="button" data-action="unflip" aria-label="Back to card">← Back</button>
          ${backHtml(c)}
        </div>
      </div>
    `;
    el.classList.remove('picked', 'dimmed', 'flipped');
    el.dataset.cid = c.id;
    el.setAttribute('aria-label', `Pick ${c.name}`);
  }

  function partyLabel(p) {
    return p === 'R' ? 'Republican' : p === 'D' ? 'Democrat' : 'Independent';
  }

  function renderProgress() {
    const pill = $('#progress');
    pill.hidden = false;
    const total = pTotal();
    const c = pCursor();
    const labelPrefix = mode === 'extended' ? 'Round 2 · ' : '';
    $('#progress-text').textContent = `${labelPrefix}${Math.min(c + 1, total)} / ${total}`;
    const pct = Math.min(100, (c / total) * 100);
    $('#progress-fill').style.width = pct + '%';
  }

  function renderMatchup() {
    const ms = pMatchups();
    const c = pCursor();
    if (c >= ms.length) return endOfRound();
    const m = ms[c];
    renderCard('a', m.a);
    renderCard('b', m.b);
    renderProgress();
  }

  function endOfRound() {
    if (mode === 'extended') {
      extendedDone = true;
      mode = 'main';
      $('#progress').hidden = true;
      show('results');
      renderExtendedRanking();
    } else {
      showResults();
    }
  }

  /* ---------- card flip ---------- */
  function setFlipped(slot, on) {
    const el = $('#card-' + slot);
    if (!el) return;
    const isFlipped = el.classList.contains('flipped');
    if (on === isFlipped) return;
    el.classList.toggle('flipped', !!on);
    const front = el.querySelector('.card-face.front');
    const back = el.querySelector('.card-face.back');
    if (front) front.setAttribute('aria-hidden', on ? 'true' : 'false');
    if (back) back.setAttribute('aria-hidden', on ? 'false' : 'true');
    if (el.dataset.cid) {
      track(on ? 'flip_open' : 'flip_close', el.dataset.cid, 'matchup');
    }
  }
  function unflipAll() {
    setFlipped('a', false);
    setFlipped('b', false);
  }

  /* ---------- voting ---------- */
  let advancing = false;
  function vote(pickedSlot) {
    if (advancing) return;
    // Reading mode: don't vote while flipped to back.
    const pickedCard = $('#card-' + pickedSlot);
    if (pickedCard && pickedCard.classList.contains('flipped')) return;
    unflipAll();
    const m = pMatchups()[pCursor()];
    const picked = pickedSlot === 'a' ? m.a : m.b;
    const lost   = pickedSlot === 'a' ? m.b : m.a;
    // Snapshot pre-vote rating before applyElo mutates it; used by goBack().
    const prevRatingPicked = pRatings()[picked.id];
    const prevRatingLost   = pRatings()[lost.id];
    applyElo(picked.id, lost.id);
    saveLocalVote(m.a.id, m.b.id, picked.id);
    voteHistory.push({
      type: 'vote',
      cursor: pCursor(),
      aId: m.a.id, bId: m.b.id,
      pickedId: picked.id, lostId: lost.id,
      prevRatingPicked, prevRatingLost,
    });
    renderBackBtn();

    // pick animation
    $('#card-' + pickedSlot).classList.add('picked');
    $('#card-' + (pickedSlot === 'a' ? 'b' : 'a')).classList.add('dimmed');

    advancing = true;
    showStatOverlay(m, picked.id, () => {
      setCursor(pCursor() + 1);
      advancing = false;
      if (pCursor() >= pMatchups().length) endOfRound();
      else renderMatchup();
    });
  }

  function skip() {
    if (advancing) return;
    voteHistory.push({ type: 'skip', cursor: pCursor() });
    setCursor(pCursor() + 1);
    if (pCursor() >= pMatchups().length) endOfRound();
    else renderMatchup();
    renderBackBtn();
  }

  function goBack() {
    // If the stat overlay is still showing from the just-cast vote,
    // cancel the pending advance — cursor hasn't moved yet.
    if (advancing) {
      clearTimeout(overlayTimer);
      $('#stat-overlay').classList.remove('show');
      advancing = false;
    }
    if (!voteHistory.length) return;
    const h = voteHistory.pop();
    if (h.type === 'vote') {
      const r = pRatings(), w = pWins(), n = pAppearances();
      r[h.pickedId] = h.prevRatingPicked;
      r[h.lostId]   = h.prevRatingLost;
      w[h.pickedId] = Math.max(0, (w[h.pickedId] || 0) - 1);
      n[h.pickedId] = Math.max(0, (n[h.pickedId] || 0) - 1);
      n[h.lostId]   = Math.max(0, (n[h.lostId]   || 0) - 1);
      undoLocalVote(h.aId, h.bId, h.pickedId);
    }
    setCursor(h.cursor);
    renderMatchup();
    renderBackBtn();
  }

  function renderBackBtn() {
    const btn = $('#back-btn');
    if (!btn) return;
    btn.hidden = voteHistory.length === 0;
  }

  /* ---------- stat overlay ---------- */
  let overlayTimer = null;
  function showStatOverlay(m, pickedId, after) {
    const stats = fetchPairStats(m.a.id, m.b.id, pickedId);
    const overlay = $('#stat-overlay');
    $('#stat-avatar-a').outerHTML = avatarHtml(m.a, 'xs').replace('class="avatar', 'id="stat-avatar-a" class="avatar');
    $('#stat-avatar-b').outerHTML = avatarHtml(m.b, 'xs').replace('class="avatar', 'id="stat-avatar-b" class="avatar');
    $('#stat-name-a').textContent = m.a.name.split(' ').slice(-1)[0];
    $('#stat-name-b').textContent = m.b.name.split(' ').slice(-1)[0];

    $('#stat-seg-a').className = 'seg party-' + m.a.party;
    $('#stat-seg-b').className = 'seg party-' + m.b.party;
    $('#stat-seg-a').style.width = '0%';
    $('#stat-seg-b').style.width = '0%';

    const pctA = Math.round(stats.pctA * 100);
    const pctB = 100 - pctA;
    $('#stat-pct-a').textContent = pctA + '%';
    $('#stat-pct-b').textContent = pctB + '%';

    const youSide = pickedId === m.a.id ? 'a' : 'b';
    const yourPct = youSide === 'a' ? pctA : pctB;
    const headline = yourPct >= 60 ? `You're with the majority — ${yourPct}% picked ${(youSide === 'a' ? m.a : m.b).name.split(' ').slice(-1)[0]}.`
                    : yourPct >= 50 ? `It's close — ${yourPct}% leaned your way.`
                    : yourPct >= 40 ? `Bit of a split — ${100 - yourPct}% went the other direction.`
                    : `You're in the minority — only ${yourPct}% picked them.`;
    $('#stat-headline').textContent = headline;

    overlay.classList.add('show');
    requestAnimationFrame(() => {
      $('#stat-seg-a').style.width = pctA + '%';
      $('#stat-seg-b').style.width = pctB + '%';
    });
    clearTimeout(overlayTimer);
    overlayTimer = setTimeout(() => {
      overlay.classList.remove('show');
      setTimeout(after, 180);
    }, 1450);
  }
  // tap overlay to advance faster
  document.addEventListener('click', (e) => {
    const o = $('#stat-overlay');
    if (o.classList.contains('show') && o.contains(e.target)) {
      clearTimeout(overlayTimer);
      o.classList.remove('show');
      setTimeout(() => {
        if (advancing) {
          advancing = false;
          setCursor(pCursor() + 1);
          if (pCursor() >= pMatchups().length) endOfRound();
          else renderMatchup();
        }
      }, 150);
    }
  });

  /* ---------- results ---------- */
  function rankedList() {
    return C.slice()
      .map(c => ({ c, r: ratings[c.id], w: wins[c.id], n: appearances[c.id] }))
      .sort((x, y) => y.r - x.r || y.w - x.w);
  }

  function extRankedList() {
    return EC.slice()
      .map(c => ({ c, r: extRatings[c.id], w: extWins[c.id], n: extAppearances[c.id] }))
      .sort((x, y) => y.r - x.r || y.w - x.w);
  }

  function showResults() {
    show('results');
    $('#progress').hidden = true;
    const ranked = rankedList();
    const top5 = ranked.slice(0, 5);

    $('#podium').innerHTML = top5.map((row, i) => `
      <div class="rank-row ${i === 0 ? 'top' : ''}" data-cid="${row.c.id}" role="button" tabindex="0" aria-label="More about ${escapeHtml(row.c.name)}">
        <div class="rank-num">${i + 1}</div>
        ${avatarHtml(row.c, i === 0 ? '' : 'sm')}
        <div class="rank-info">
          <div class="rank-name">
            <span>${escapeHtml(row.c.name)}</span>
            <span class="party-chip party-${row.c.party}"><span class="dot"></span>${row.c.party}</span>
          </div>
          <div class="rank-role">${escapeHtml(row.c.role)}</div>
        </div>
      </div>
    `).join('');

    $('#full-ranking').innerHTML = ranked.slice(5).map((row, i) => `
      <div class="rank-row" data-cid="${row.c.id}" role="button" tabindex="0" aria-label="More about ${escapeHtml(row.c.name)}">
        <div class="rank-num">${i + 6}</div>
        ${avatarHtml(row.c, 'sm')}
        <div class="rank-info">
          <div class="rank-name">
            <span>${escapeHtml(row.c.name)}</span>
            <span class="party-chip party-${row.c.party}"><span class="dot"></span>${row.c.party}</span>
          </div>
          <div class="rank-role">${escapeHtml(row.c.role)}</div>
        </div>
      </div>
    `).join('');
    $('#full-ranking').classList.remove('show');
    $('#toggle-full-btn').textContent = 'Show full ranking ↓';

    renderShare(top5);
    renderKeepRanking();
    renderExtendedRanking();
  }

  /* ---------- extended ranking ---------- */
  function renderKeepRanking() {
    const wrap = $('#keep-ranking');
    if (!wrap) return;
    if (EC.length === 0 || extendedDone) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    const btn = $('#keep-ranking-btn');
    btn.textContent = `Keep ranking — ${EC.length} more candidates ↓`;
  }

  function renderExtendedRanking() {
    const wrap = $('#extended-ranking');
    if (!wrap) return;
    if (!extendedDone) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    const list = extRankedList();
    $('#extended-rows').innerHTML = list.map((row, i) => `
      <div class="rank-row" data-cid="${row.c.id}" role="button" tabindex="0" aria-label="More about ${escapeHtml(row.c.name)}">
        <div class="rank-num">${i + 1}</div>
        ${avatarHtml(row.c, 'sm')}
        <div class="rank-info">
          <div class="rank-name">
            <span>${escapeHtml(row.c.name)}</span>
            <span class="party-chip party-${row.c.party}"><span class="dot"></span>${row.c.party}</span>
          </div>
          <div class="rank-role">${escapeHtml(row.c.role)}</div>
        </div>
      </div>
    `).join('');
    renderShare(rankedList().slice(0, 5));
  }

  function startExtended() {
    if (EC.length === 0) return;
    mode = 'extended';
    extCursor = 0;
    for (const id of Object.keys(extRatings)) extRatings[id] = 1500;
    for (const id of Object.keys(extWins)) extWins[id] = 0;
    for (const id of Object.keys(extAppearances)) extAppearances[id] = 0;
    extMatchups = buildMatchups(EC, EC.length);
    // History does not survive a mode switch (can't undo across rounds).
    voteHistory = [];
    show('vote');
    renderMatchup();
    renderBackBtn();
    // Hide stat overlay if it was lingering.
    $('#stat-overlay').classList.remove('show');
  }

  /* ---------- candidate detail sheet (results screen) ---------- */
  let sheetReturnFocus = null;
  function openDetailSheet(cid) {
    const c = byIdAll[cid];
    if (!c) return;
    const sheet = $('#detail-sheet');
    sheetReturnFocus = document.activeElement;
    $('#detail-sheet-avatar').outerHTML = avatarHtml(c, 'sm').replace('class="avatar', 'id="detail-sheet-avatar" class="avatar');
    $('#detail-sheet-name').textContent = c.name;
    $('#detail-sheet-role').textContent = c.role;
    $('#detail-sheet-body').innerHTML = backHtml(c);
    sheet.dataset.cid = cid;
    sheet.classList.add('show');
    sheet.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    track('flip_open', cid, 'results');
    // Initial focus on close button
    setTimeout(() => $('#detail-sheet-close').focus(), 30);
  }
  function closeDetailSheet() {
    const sheet = $('#detail-sheet');
    if (!sheet.classList.contains('show')) return;
    const cid = sheet.dataset.cid || null;
    sheet.classList.remove('show');
    sheet.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (cid) track('flip_close', cid, 'results');
    if (sheetReturnFocus && typeof sheetReturnFocus.focus === 'function') {
      sheetReturnFocus.focus();
      sheetReturnFocus = null;
    }
  }
  function focusableInSheet() {
    const sheet = $('#detail-sheet');
    return Array.from(
      sheet.querySelectorAll('button, a[href]')
    ).filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true');
  }
  // Delegate clicks for rank-rows and sheet
  document.addEventListener('click', (e) => {
    const sheet = $('#detail-sheet');
    if (sheet.classList.contains('show')) {
      const link = e.target.closest('a[data-link]');
      if (link) {
        track('link_' + link.dataset.link, link.dataset.cid, 'results');
        return;
      }
      if (e.target === sheet || e.target.closest('#detail-sheet-close')) {
        closeDetailSheet();
        return;
      }
      // Click inside panel but not a link → keep open.
      return;
    }
    const row = e.target.closest('.rank-row[data-cid]');
    if (row) {
      openDetailSheet(row.dataset.cid);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const row = e.target.closest && e.target.closest('.rank-row[data-cid]');
      if (row && document.activeElement === row) {
        e.preventDefault();
        openDetailSheet(row.dataset.cid);
      }
    }
  });

  function buildShareText(top5, url) {
    const grid = top5.map(r => partyEmoji(r.c.party)).join('');
    const top5Lines = top5.map((r, i) => `${i + 1}. ${partyEmoji(r.c.party)} ${r.c.name}`);
    const lines = [
      'The 2028 Ballot — my top 5',
      grid,
      '',
      ...top5Lines,
    ];
    if (extendedDone) {
      const extList = extRankedList();
      lines.push('');
      lines.push(`+ long tail (${extList.length})`);
      extList.forEach((r, i) => {
        lines.push(`${i + 1}. ${partyEmoji(r.c.party)} ${r.c.name}`);
      });
    }
    lines.push('');
    lines.push(`Rank yours: ${url}`);
    return lines.join('\n');
  }

  function shareUrl(top5) {
    const ids = top5.map(r => r.c.id).join(',');
    const u = new URL(window.location.href);
    u.searchParams.set('b', ids);
    if (extendedDone) {
      const extIds = extRankedList().map(r => r.c.id).join(',');
      if (extIds) u.searchParams.set('x', extIds);
    } else {
      u.searchParams.delete('x');
    }
    u.hash = '';
    return u.toString();
  }

  function renderShare(top5) {
    const url = shareUrl(top5);
    const txt = buildShareText(top5, url);
    $('#share-preview').textContent = txt;
    $('#share-btn').onclick = () => copy(txt);
    if (navigator.share) {
      const btn = $('#share-native-btn');
      btn.hidden = false;
      btn.onclick = () => navigator.share({ title: 'My 2028 Ballot', text: txt }).catch(() => {});
    }
  }

  function copy(text) {
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(ta);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(fallback);
    else fallback();
    toast('Copied — paste it anywhere');
  }

  /* ---------- toast ---------- */
  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  /* ---------- friend ballot intro ---------- */
  function readFriendBallot() {
    const u = new URL(window.location.href);
    const rawB = u.searchParams.get('b');
    const rawX = u.searchParams.get('x');
    if (!rawB) return null;
    const ids = rawB.split(',').map(s => s.trim()).filter(s => byId[s]).slice(0, 5);
    if (!ids.length) return null;
    const extIds = rawX ? rawX.split(',').map(s => s.trim()).filter(s => byIdExt[s]) : [];
    return {
      top5: ids.map(id => byId[id]),
      extended: extIds.map(id => byIdExt[id]),
    };
  }
  function renderFriendIntro() {
    const friend = readFriendBallot();
    if (!friend) return;
    const chip = (c, i) => `<span style="display:inline-flex;align-items:center;gap:6px;background:var(--surface-2);border-radius:99px;padding:4px 10px;font-size:13px;">${i+1}. ${partyEmoji(c.party)} ${escapeHtml(c.name)}</span>`;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px;margin:18px 0;box-shadow:var(--shadow);';
    const extBlock = friend.extended.length
      ? `<div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-muted);font-weight:600;margin:12px 0 6px;">Long tail (${friend.extended.length})</div>
         <div style="display:flex;gap:6px;flex-wrap:wrap;">
           ${friend.extended.map((c, i) => chip(c, i)).join('')}
         </div>`
      : '';
    wrap.innerHTML = `
      <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-muted);font-weight:600;margin-bottom:8px;">A friend's ballot</div>
      <div style="font-size:16px;font-weight:600;margin-bottom:10px;">They picked these — see if you agree.</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${friend.top5.map((c, i) => chip(c, i)).join('')}
      </div>
      ${extBlock}`;
    screens.start.querySelector('.hero').appendChild(wrap);
    $('#start-btn').textContent = 'Build my ballot →';
  }

  /* ---------- wiring ---------- */
  function start() {
    mode = 'main';
    extendedDone = false;
    matchups = buildMatchups();
    cursor = 0;
    for (const id of Object.keys(ratings)) ratings[id] = 1500;
    for (const id of Object.keys(wins)) wins[id] = 0;
    for (const id of Object.keys(appearances)) appearances[id] = 0;
    for (const id of Object.keys(extRatings)) extRatings[id] = 1500;
    for (const id of Object.keys(extWins)) extWins[id] = 0;
    for (const id of Object.keys(extAppearances)) extAppearances[id] = 0;
    extCursor = 0;
    voteHistory = [];
    const extWrap = $('#extended-ranking'); if (extWrap) extWrap.hidden = true;
    show('vote');
    renderMatchup();
    renderBackBtn();
  }

  $('#start-btn').addEventListener('click', start);
  $('#restart-btn').addEventListener('click', () => { show('start'); $('#progress').hidden = true; });
  // Wire keep-ranking CTA if present (rendered on results screen).
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'keep-ranking-btn') {
      startExtended();
    }
  });
  function wireCard(slot) {
    const el = $('#card-' + slot);
    el.addEventListener('click', (e) => {
      const flipBtn = e.target.closest('[data-action="flip"]');
      if (flipBtn) {
        e.preventDefault(); e.stopPropagation();
        setFlipped(slot, true);
        return;
      }
      const unflipBtn = e.target.closest('[data-action="unflip"]');
      if (unflipBtn) {
        e.preventDefault(); e.stopPropagation();
        setFlipped(slot, false);
        return;
      }
      const link = e.target.closest('a[data-link]');
      if (link) {
        track('link_' + link.dataset.link, link.dataset.cid, 'matchup');
        return;
      }
      if (el.classList.contains('flipped')) return;
      vote(slot);
    });
    el.addEventListener('keydown', (e) => {
      if (e.target !== el) return;
      if (e.key === 'Enter' || e.key === ' ') {
        if (el.classList.contains('flipped')) return;
        e.preventDefault();
        vote(slot);
      }
    });
  }
  wireCard('a');
  wireCard('b');
  $('#skip-btn').addEventListener('click', skip);
  $('#back-btn').addEventListener('click', goBack);
  $('#toggle-full-btn').addEventListener('click', () => {
    const el = $('#full-ranking');
    const open = el.classList.toggle('show');
    $('#toggle-full-btn').textContent = open ? 'Hide full ranking ↑' : 'Show full ranking ↓';
  });
  $('#about-link').addEventListener('click', (e) => {
    e.preventDefault();
    toast('Built for fun. No data leaves your phone.');
  });

  // keyboard
  window.addEventListener('keydown', (e) => {
    const sheet = $('#detail-sheet');
    const sheetOpen = sheet.classList.contains('show');
    // Escape closes detail sheet from anywhere.
    if (e.key === 'Escape' && sheetOpen) {
      e.preventDefault();
      closeDetailSheet();
      return;
    }
    // Tab cycles focus within the detail sheet when open.
    if (e.key === 'Tab' && sheetOpen) {
      const items = focusableInSheet();
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      } else if (!sheet.contains(document.activeElement)) {
        e.preventDefault(); first.focus();
      }
      return;
    }
    if (!screens.vote.classList.contains('active')) return;
    // Don't hijack typing in form fields if any are ever added.
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    // Swallow vote shortcuts whenever either card is in reading mode.
    const aFlipped = $('#card-a').classList.contains('flipped');
    const bFlipped = $('#card-b').classList.contains('flipped');
    if (aFlipped || bFlipped) {
      if (e.key === '1' || e.key === '2' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') return;
    }
    if (e.key === '1' || e.key === 'ArrowLeft')  vote('a');
    else if (e.key === '2' || e.key === 'ArrowRight') vote('b');
    else if (e.key === ' ' || e.key === 'Enter') {
      if (e.target && (e.target.id === 'card-a' || e.target.id === 'card-b')) return;
      e.preventDefault();
      skip();
    }
  });

  renderStartPreview();
  renderFriendIntro();
  flushEvents();
})();
