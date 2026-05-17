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
  // Glicko-2 defaults (Glickman 2013).
  const RATING_INIT = 1500;
  const RD_INIT = 350;
  const SIGMA_INIT = 0.06;
  const CI90 = 1.645;
  // Per-tier stop-condition bounds.
  const TIER_LIMITS = {
    1: { floor: 10, cap: 18, topN: 5 },
    2: { floor: 6,  cap: 12, topN: 3 },
    3: { floor: 8,  cap: 15, topN: 3 },
  };
  const ADAPTIVE_P_CLOSE = 0.7; // 70% close-rated, 30% random after R2
  const DYNAMIC_OPENER = false; // v1: fixed Vance vs. Newsom opener
  const STORAGE_LOCAL_VOTES = 'ballot28.localvotes.v1';
  const STORAGE_EVENTS = 'ballot28.events.v1';

  // ---- API base URL --------------------------------------------------
  // Auto-detect: localhost dev → local wrangler dev on 8787,
  // anywhere else → the deployed Worker.
  // Set window.API_BASE_URL_OVERRIDE before this script loads to force it.
  const API_BASE_URL = (function () {
    if (typeof window.API_BASE_URL_OVERRIDE === 'string') return window.API_BASE_URL_OVERRIDE;
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '') return 'http://127.0.0.1:8787';
    // Deployed Worker. Update this line if the Worker is renamed/redeployed.
    return 'https://ranked-choice-api.alberti-rick.workers.dev';
  })();
  const EVENT_FLUSH_URL = `${API_BASE_URL}/api/event`;
  let API_REACHABLE = true; // flips to false after a network failure; we stop calling.
  let countryHint = null;   // populated by /api/health on boot.

  function apiFetch(path, init) {
    if (!API_REACHABLE) return Promise.reject(new Error('api_unreachable'));
    const opts = Object.assign({ credentials: 'omit', mode: 'cors' }, init || {});
    return fetch(API_BASE_URL + path, opts).catch(err => {
      // Once one request fails (CORS / network / cold deploy), stop trying for
      // the rest of this session so the UI never hangs. Manual reload re-enables.
      API_REACHABLE = false;
      throw err;
    });
  }

  // ---- Phase 5: Turnstile token capture ------------------------------
  // Optional. The frontend reads a <meta name="turnstile-sitekey"> tag.
  // If present AND Cloudflare's Turnstile script has loaded, every
  // mutating request gets a fresh token in the `t` field. If not set,
  // the server gate runs in pass-through (TURNSTILE_SECRET unset).
  const turnstileSiteKey = (() => {
    const tag = document.querySelector('meta[name="turnstile-sitekey"]');
    return tag ? tag.getAttribute('content') : null;
  })();
  let turnstileWidgetId = null;
  window.onTurnstileLoad = function () {
    if (!turnstileSiteKey || !window.turnstile) return;
    let host = document.getElementById('turnstile-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'turnstile-host';
      host.style.cssText = 'position:fixed;bottom:8px;right:8px;z-index:9999;';
      document.body.appendChild(host);
    }
    turnstileWidgetId = window.turnstile.render(host, {
      sitekey: turnstileSiteKey,
      size: 'invisible',
      'refresh-expired': 'auto',
    });
  };
  function getTurnstileToken() {
    if (!turnstileSiteKey || !window.turnstile || turnstileWidgetId === null) {
      return Promise.resolve(null);
    }
    return new Promise(resolve => {
      window.turnstile.execute(turnstileWidgetId, {
        callback: token => resolve(token || null),
        'error-callback': () => resolve(null),
      });
    });
  }
  // Adds a `t` field to an existing JSON body string. Idempotent.
  function withTurnstile(body) {
    return getTurnstileToken().then(token => {
      if (!token) return body;
      try {
        const parsed = JSON.parse(body);
        parsed.t = token;
        return JSON.stringify(parsed);
      } catch {
        return body;
      }
    });
  }

  // Unified candidate pool, partitioned by `tier` (set in candidates.js).
  // The legacy `CANDIDATES` / `EXTENDED_CANDIDATES` arrays are retained
  // so external scripts (admin tooling, fetch_portraits, etc.) keep
  // working — but the runtime engine treats them as one pool.
  const C  = window.CANDIDATES;
  const EC = window.EXTENDED_CANDIDATES || [];
  const POOL = [...C, ...EC];
  const byIdAll = Object.fromEntries(POOL.map(c => [c.id, c]));
  // Back-compat for any old call site (friend-ballot inline parse, etc.).
  const byId    = byIdAll;
  const byIdExt = byIdAll;
  const TIER = {
    1: POOL.filter(c => c.tier === 1),
    2: POOL.filter(c => c.tier === 2),
    3: POOL.filter(c => c.tier === 3),
  };
  const R2_RIVAL = window.R2_RIVAL || {};

  /* ---------- Glicko-2 state (single source of truth across tiers) ----------
   * Ratings, RD, sigma are PRESERVED across tier transitions — opting
   * into Tier 2/3 refines existing ratings rather than starting over.
   * `appearances` is per-tier and reset on tier start (coverage floor is
   * a tier-local property).
   */
  const ratings = Object.fromEntries(POOL.map(c => [c.id, RATING_INIT]));
  const rd      = Object.fromEntries(POOL.map(c => [c.id, RD_INIT]));
  const sigma   = Object.fromEntries(POOL.map(c => [c.id, SIGMA_INIT]));
  const wins    = Object.fromEntries(POOL.map(c => [c.id, 0]));

  let activeTier = 1;
  let appearances = {};       // id -> count this tier
  let votesThisTier = 0;
  let currentMatchup = null;  // { a, b } selected by pickNextMatchup
  let voteHistory = [];       // for undo within a tier
  let tierCompleted = { 1: false, 2: false, 3: false };

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
    if (!API_REACHABLE) return;
    const q = loadEvents();
    if (!q.length) return;
    const batch = q.slice(0, 100);
    const body = JSON.stringify({ events: batch.map(e => ({
      candidate_id: e.candidate_id,
      event_type: e.event_type,
      context: e.context,
    })) });
    withTurnstile(body).then(b => apiFetch('/api/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: b,
      keepalive: true,
    })).then(r => {
      if (!r || !r.ok) return;
      const remaining = loadEvents().slice(batch.length);
      try { localStorage.setItem(STORAGE_EVENTS, JSON.stringify(remaining)); } catch {}
    }).catch(() => {});
  }

  /* ---------- remote vote (best-effort, fire-and-forget) ---------- */
  function postRemoteVote(aId, bId, pickedId) {
    if (!API_REACHABLE) return;
    const body = JSON.stringify({ a: aId, b: bId, picked: pickedId });
    withTurnstile(body).then(b => apiFetch('/api/vote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: b,
      keepalive: true,
    })).catch(() => {});
  }

  /* ---------- remote pair stats (replaces seeded estimate when reachable) ---------- */
  function fetchRemotePairStats(aId, bId) {
    if (!API_REACHABLE) return Promise.resolve(null);
    const u = new URL(`${API_BASE_URL}/api/stats`);
    u.searchParams.set('a', aId);
    u.searchParams.set('b', bId);
    return apiFetch(u.pathname + '?' + u.searchParams.toString(), {
      method: 'GET',
    }).then(r => r.ok ? r.json() : null).catch(() => null);
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

  /* ---------- smart matchup engine ----------
   * Tier 1, vote 1:  fixed Vance vs. Newsom.
   * Tier 1, vote 2:  hand-picked rival to the R1 winner (Vance→Rubio, Newsom→AOC).
   * Otherwise:       70% close-rated pair, 30% random, with a coverage
   *                  floor (every active-tier candidate appears once
   *                  before any appears twice).
   * Card side (left vs. right) is randomized.
   */
  function orientMatchup(a, b) {
    return Math.random() < 0.5 ? { a, b } : { a: b, b: a };
  }

  function allowedPairs(pool) {
    const minN = Math.min(...pool.map(c => appearances[c.id] || 0));
    // Coverage floor: while some candidate is unseen, only pair-in those
    // that respect it (unseen-vs-unseen first; if only one unseen left,
    // pair it with someone — preferring same party for engagement).
    if (minN === 0) {
      const unseen = pool.filter(c => (appearances[c.id] || 0) === 0);
      const pairs = [];
      if (unseen.length >= 2) {
        for (let i = 0; i < unseen.length; i++) {
          for (let j = i + 1; j < unseen.length; j++) pairs.push([unseen[i], unseen[j]]);
        }
        return pairs;
      }
      // Exactly one unseen: pair it with another candidate, preferring same party.
      const u = unseen[0];
      const others = pool.filter(c => c.id !== u.id);
      const sameParty = others.filter(c => c.party === u.party);
      const partners = sameParty.length ? sameParty : others;
      for (const o of partners) pairs.push([u, o]);
      return pairs;
    }
    // Full coverage achieved: any pair allowed.
    const pairs = [];
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) pairs.push([pool[i], pool[j]]);
    }
    return pairs;
  }

  function pickClosestRated(pairs) {
    let best = pairs[0];
    let bestDelta = Infinity;
    for (const p of pairs) {
      const d = Math.abs(ratings[p[0].id] - ratings[p[1].id]);
      if (d < bestDelta) { bestDelta = d; best = p; }
    }
    return best;
  }

  function pickNextMatchup() {
    const pool = TIER[activeTier];
    // Tier 1, vote 1: fixed opener.
    if (activeTier === 1 && voteHistory.length === 0) {
      if (!DYNAMIC_OPENER && byIdAll.vance && byIdAll.newsom) {
        return orientMatchup(byIdAll.vance, byIdAll.newsom);
      }
      // DYNAMIC_OPENER branch is a future-phase stub; for now fall through.
    }
    // Tier 1, vote 2: hand-picked rival to the R1 winner.
    if (activeTier === 1 && voteHistory.length === 1) {
      const r1WinnerId = voteHistory[0].pickedId;
      const rivalId = R2_RIVAL[r1WinnerId];
      if (rivalId && byIdAll[rivalId]
          && byIdAll[rivalId].tier === 1
          && rivalId !== r1WinnerId) {
        return orientMatchup(byIdAll[r1WinnerId], byIdAll[rivalId]);
      }
      // No rival mapped (e.g., DYNAMIC_OPENER produced an unmapped winner): fall through to adaptive.
    }
    // Adaptive: 70% close-rated pair, 30% random — respecting coverage floor.
    const pairs = allowedPairs(pool);
    if (!pairs.length) {
      // Pool too small / pathological — pair the two highest-RD candidates.
      const sorted = pool.slice().sort((a, b) => rd[b.id] - rd[a.id]);
      return orientMatchup(sorted[0], sorted[1] || sorted[0]);
    }
    const close = Math.random() < ADAPTIVE_P_CLOSE;
    const pick = close ? pickClosestRated(pairs) : pairs[Math.floor(Math.random() * pairs.length)];
    return orientMatchup(pick[0], pick[1]);
  }

  /* ---------- Glicko-2 update ----------
   * One step per matchup, applied to BOTH players (each treats the
   * other as a single same-period opponent).
   */
  function applyGlicko(pickedId, lostId) {
    const G = window.Glicko2;
    const Pp = { rating: ratings[pickedId], rd: rd[pickedId], sigma: sigma[pickedId] };
    const Pl = { rating: ratings[lostId],   rd: rd[lostId],   sigma: sigma[lostId] };
    const newP = G.rateOne(Pp, [{ rating: Pl.rating, rd: Pl.rd }], [1]);
    const newL = G.rateOne(Pl, [{ rating: Pp.rating, rd: Pp.rd }], [0]);
    ratings[pickedId] = newP.rating; rd[pickedId] = newP.rd; sigma[pickedId] = newP.sigma;
    ratings[lostId]   = newL.rating; rd[lostId]   = newL.rd; sigma[lostId]   = newL.sigma;
    wins[pickedId]    = (wins[pickedId] || 0) + 1;
    appearances[pickedId] = (appearances[pickedId] || 0) + 1;
    appearances[lostId]   = (appearances[lostId]   || 0) + 1;
  }

  /* ---------- stop condition ----------
   * End the tier when (a) the top-N candidates have pairwise
   * non-overlapping 90% CIs (rating ± 1.645 × RD), OR (b) the
   * tier-specific vote cap is reached. A minimum vote floor prevents
   * premature termination from a streaky early run.
   */
  function tierShouldStop() {
    const limits = TIER_LIMITS[activeTier];
    if (votesThisTier >= limits.cap) return true;
    if (votesThisTier < limits.floor) return false;
    const sorted = TIER[activeTier].slice().sort((a, b) => ratings[b.id] - ratings[a.id]);
    const top = sorted.slice(0, limits.topN);
    for (let i = 0; i < top.length - 1; i++) {
      const hiNext = ratings[top[i + 1].id] + CI90 * rd[top[i + 1].id];
      const loThis = ratings[top[i].id]     - CI90 * rd[top[i].id];
      if (loThis <= hiNext) return false; // CIs overlap — not done yet
    }
    return true;
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
    stats: $('#screen-stats'),
  };
  function show(name) {
    Object.entries(screens).forEach(([k, el]) => el.classList.toggle('active', k === name));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function ageFromBorn(born, today = new Date()) {
    if (!born) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(born);
    if (!m) return null;
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    let age = today.getFullYear() - y;
    const monthDiff = (today.getMonth() + 1) - mo;
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d)) age -= 1;
    return age;
  }

  function avatarHtml(c, size) {
    const sizeClass = size === 'sm' ? ' sm' : size === 'xs' ? ' xs' : '';
    const photo = (window.CANDIDATE_PHOTOS || {})[c.id];
    const inner = photo
      ? `<img src="${photo}" alt="" loading="lazy" onerror="this.remove();this.parentNode.textContent='${initials(c.name)}'">`
      : initials(c.name);
    return `<div class="avatar party-${c.party}${sizeClass}${photo ? ' has-photo' : ''}" aria-hidden="true">${inner}</div>`;
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
    const resume = (c.resume || []).map(r => `<li>${escapeHtml(r)}</li>`).join('');
    const tw = c.links && c.links.twitter ? c.links.twitter : null;
    const wk = c.links && c.links.wikipedia ? c.links.wikipedia : null;
    const twIcon = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M18.244 2H21.5l-7.5 8.572L23 22h-6.84l-5.36-7.01L4.5 22H1.244l8.04-9.19L1 2h7.014l4.85 6.41L18.244 2Zm-1.2 18h1.86L7.04 4H5.1l11.944 16Z"/></svg>`;
    const wkIcon = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M3 4h4.2l3.1 9.8L13.2 4h2l2.8 9.8L21 4h2L19 20h-2l-2.5-9.7L11.5 20h-2L4.5 4H3Z"/></svg>`;

    return `
      <div class="back-header">
        <div class="back-name">${escapeHtml(c.name)}</div>
      </div>
      ${resume ? `
      <div class="back-section">
        <div class="back-section-label">Resume</div>
        <ul class="back-resume">${resume}</ul>
      </div>` : ''}
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
          ${(() => { const a = ageFromBorn(c.born); return a == null ? '' : `<div class="card-age">${a} years old.</div>`; })()}
          <span class="party-chip party-${c.party}"><span class="dot"></span>${partyLabel(c.party)}</span>
          <div class="card-hook">${escapeHtml(c.hook || '')}</div>
          ${Array.isArray(c.resume) && c.resume.length ? `
            <ul class="card-resume" aria-label="Career">
              ${c.resume.map(line => `<li>${escapeHtml(line)}</li>`).join('')}
            </ul>` : ''}
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
    const { cap } = TIER_LIMITS[activeTier];
    const labelPrefix = activeTier === 1 ? '' : (activeTier === 2 ? 'Round 2 · ' : 'Round 3 · ');
    const shown = Math.min(votesThisTier + 1, cap);
    $('#progress-text').textContent = `${labelPrefix}Vote ${shown} of up to ${cap}`;
    $('#progress-fill').style.width = Math.min(100, (votesThisTier / cap) * 100) + '%';
  }

  function renderMatchup() {
    if (tierShouldStop()) return endOfTier();
    currentMatchup = pickNextMatchup();
    renderCard('a', currentMatchup.a);
    renderCard('b', currentMatchup.b);
    renderProgress();
  }

  function endOfTier() {
    tierCompleted[activeTier] = true;
    $('#progress').hidden = true;
    show('results');
    showResults();
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
    const m = currentMatchup;
    if (!m) return;
    const picked = pickedSlot === 'a' ? m.a : m.b;
    const lost   = pickedSlot === 'a' ? m.b : m.a;
    // Snapshot pre-vote Glicko state for goBack().
    const prev = {
      pRating: ratings[picked.id], pRd: rd[picked.id], pSigma: sigma[picked.id],
      lRating: ratings[lost.id],   lRd: rd[lost.id],   lSigma: sigma[lost.id],
    };
    applyGlicko(picked.id, lost.id);
    saveLocalVote(m.a.id, m.b.id, picked.id);
    // Tier-1 votes are sent to the backend (drives crowd ELO + pair_aggregates).
    // Tier-2/3 stay local-only — they're refinement votes for the personal ballot.
    if (activeTier === 1) postRemoteVote(m.a.id, m.b.id, picked.id);
    voteHistory.push({
      aId: m.a.id, bId: m.b.id,
      pickedId: picked.id, lostId: lost.id,
      prev,
    });
    votesThisTier += 1;
    renderBackBtn();

    // pick animation
    $('#card-' + pickedSlot).classList.add('picked');
    $('#card-' + (pickedSlot === 'a' ? 'b' : 'a')).classList.add('dimmed');

    advancing = true;
    showStatOverlay(m, picked.id, () => {
      advancing = false;
      renderMatchup();
    });
  }

  function skip() {
    if (advancing) return;
    // Skip: drop the current matchup without applying a Glicko update,
    // and ask the engine for a different one. Doesn't count toward votesThisTier.
    renderMatchup();
    renderBackBtn();
  }

  function goBack() {
    // If the stat overlay is still showing from the just-cast vote, cancel
    // the pending advance — we haven't picked the next matchup yet.
    if (advancing) {
      clearTimeout(overlayTimer);
      $('#stat-overlay').classList.remove('show');
      advancing = false;
    }
    if (!voteHistory.length) return;
    const h = voteHistory.pop();
    ratings[h.pickedId] = h.prev.pRating;
    rd[h.pickedId]      = h.prev.pRd;
    sigma[h.pickedId]   = h.prev.pSigma;
    ratings[h.lostId]   = h.prev.lRating;
    rd[h.lostId]        = h.prev.lRd;
    sigma[h.lostId]     = h.prev.lSigma;
    wins[h.pickedId]    = Math.max(0, (wins[h.pickedId] || 0) - 1);
    appearances[h.pickedId] = Math.max(0, (appearances[h.pickedId] || 0) - 1);
    appearances[h.lostId]   = Math.max(0, (appearances[h.lostId]   || 0) - 1);
    votesThisTier = Math.max(0, votesThisTier - 1);
    undoLocalVote(h.aId, h.bId, h.pickedId);
    // Re-display the matchup the user came from.
    currentMatchup = { a: byIdAll[h.aId], b: byIdAll[h.bId] };
    renderCard('a', currentMatchup.a);
    renderCard('b', currentMatchup.b);
    renderProgress();
    renderBackBtn();
  }

  function renderBackBtn() {
    const btn = $('#back-btn');
    if (!btn) return;
    btn.hidden = voteHistory.length === 0;
  }

  /* ---------- stat overlay ---------- */
  let overlayTimer = null;
  let overlayContext = null; // { aId, bId, pickedId } — guards async remote update
  function showStatOverlay(m, pickedId, after) {
    const stats = fetchPairStats(m.a.id, m.b.id, pickedId);
    overlayContext = { aId: m.a.id, bId: m.b.id, pickedId };
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
      overlayContext = null;
      setTimeout(after, 180);
    }, 1450);

    // Best-effort: replace the seeded estimate with real backend stats
    // if they arrive while the overlay is still on screen. Tier 1 only
    // (Tier 2/3 votes are local refinements, not sent to the backend).
    if (activeTier === 1) {
      fetchRemotePairStats(m.a.id, m.b.id).then(real => {
        if (!real) return;
        if (!overlayContext) return; // overlay already dismissed
        if (overlayContext.aId !== m.a.id || overlayContext.bId !== m.b.id) return;
        // Local +1 in case our own POST /api/vote hasn't been counted yet.
        const localA = (real.local[m.a.id] || 0) + (pickedId === m.a.id ? 1 : 0);
        const localB = (real.local[m.b.id] || 0) + (pickedId === m.b.id ? 1 : 0);
        const tot = localA + localB;
        if (tot < 5) return; // too noisy, keep the seeded display
        const rPctA = Math.round((localA / tot) * 100);
        const rPctB = 100 - rPctA;
        $('#stat-pct-a').textContent = rPctA + '%';
        $('#stat-pct-b').textContent = rPctB + '%';
        $('#stat-seg-a').style.width = rPctA + '%';
        $('#stat-seg-b').style.width = rPctB + '%';
        const sf = document.querySelector('.stat-foot');
        if (sf) sf.textContent = `based on ${tot} votes in ${countryHint || real.country}`;
        const yourPctReal = pickedId === m.a.id ? rPctA : rPctB;
        const winnerName = (pickedId === m.a.id ? m.a : m.b).name.split(' ').slice(-1)[0];
        const hl = yourPctReal >= 60 ? `You're with the majority — ${yourPctReal}% picked ${winnerName}.`
                  : yourPctReal >= 50 ? `It's close — ${yourPctReal}% leaned your way.`
                  : yourPctReal >= 40 ? `Bit of a split — ${100 - yourPctReal}% went the other direction.`
                  : `You're in the minority — only ${yourPctReal}% picked them.`;
        $('#stat-headline').textContent = hl;
      });
    }
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
          renderMatchup();
        }
      }, 150);
    }
  });

  /* ---------- results ----------
   * One ranking across all tiers the user has opted into. Tier 1 is
   * always included; Tiers 2/3 are included only after the user opts in.
   * Ranking is by Glicko rating (carried across tiers), with wins as a
   * tiebreaker for the rare exact-rating tie.
   */
  function openedTiers() {
    const ts = [1];
    if (tierCompleted[2]) ts.push(2);
    if (tierCompleted[3]) ts.push(3);
    return ts;
  }
  function rankedList() {
    const ids = openedTiers().flatMap(t => TIER[t]);
    return ids.slice()
      .map(c => ({ c, r: ratings[c.id], w: wins[c.id], n: appearances[c.id] || 0 }))
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

    renderShare(top5);
    renderKeepRanking();

    // Persist the ballot server-side, then swap the share URL from
    // `?b=ids` to `?b=<ballot_id>` (shorter + fetchable).
    const extended = openedTiers().length > 1 ? ranked.slice(5).map(r => r.c.id) : null;
    submitBallot(top5, extended)
      .then(saved => {
        if (saved && saved.id) {
          serverBallotId = saved.id;
          renderShare(top5);
        }
      })
      .catch(() => {});
  }

  /* ---------- ballot persistence + leaderboard ---------- */
  let serverBallotId = null;
  function submitBallot(top5, extendedIds) {
    if (!API_REACHABLE) return Promise.resolve(null);
    const picks = top5.map(r => r.c.id);
    const body = { picks };
    if (Array.isArray(extendedIds) && extendedIds.length) {
      body.extended = extendedIds;
    }
    return withTurnstile(JSON.stringify(body)).then(b => apiFetch('/api/ballot', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: b,
    })).then(r => r && r.ok ? r.json() : null).catch(() => null);
  }

  function renderCountryLeaderboard() {
    const host = $('#country-leaderboard-rows');
    const wrap = $('#country-leaderboard');
    if (!host || !wrap) return;
    if (!API_REACHABLE) { wrap.hidden = true; return; }
    const country = countryHint || 'BR';
    apiFetch(`/api/leaderboard/${country}`, { method: 'GET' })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (!j || !Array.isArray(j.top5) || j.top5.length === 0 || j.n < 1) {
          wrap.hidden = true;
          return;
        }
        wrap.hidden = false;
        const label = $('#country-leaderboard-label');
        if (label) {
          label.textContent = `Top 5 in ${flagOf(country)} · ${j.n} ballot${j.n === 1 ? '' : 's'}`;
        }
        host.innerHTML = j.top5.map((row, i) => {
          const c = byIdAll[row.id];
          if (!c) return '';
          return `
            <div class="rank-row" data-cid="${row.id}" role="button" tabindex="0" aria-label="More about ${escapeHtml(c.name)}">
              <div class="rank-num">${i + 1}</div>
              ${avatarHtml(c, 'sm')}
              <div class="rank-info">
                <div class="rank-name">
                  <span>${escapeHtml(c.name)}</span>
                  <span class="party-chip party-${c.party}"><span class="dot"></span>${c.party}</span>
                </div>
                <div class="rank-role">${escapeHtml(c.role)}</div>
              </div>
            </div>`;
        }).join('');
      })
      .catch(() => { wrap.hidden = true; });
  }

  function renderCountryComparison(top5) {
    const wrap = $('#country-comparison');
    if (!wrap) return;
    if (!API_REACHABLE) { wrap.hidden = true; return; }
    const country = countryHint || 'BR';
    apiFetch(`/api/comparison/${country}`, { method: 'GET' })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (!j || !Array.isArray(j.country_top5) || j.country_total < 1) {
          wrap.hidden = true;
          return;
        }
        const ownIds = new Set(top5.map(r => r.c.id));
        const countryIds = new Set(j.country_top5.map(c => c.id));
        const overlap = [...ownIds].filter(id => countryIds.has(id));
        wrap.hidden = false;
        const note = $('#country-comparison-note');
        if (note) {
          note.textContent = `Agree with ${flagOf(country)} on ${overlap.length}/5 picks`
            + (overlap.length === 0 ? ' — total split.' : '.');
        }
      })
      .catch(() => { wrap.hidden = true; });
  }

  function flagOf(cc) {
    if (!/^[A-Z]{2}$/.test(cc)) return cc;
    const A = 0x1F1E6;
    return String.fromCodePoint(A + cc.charCodeAt(0) - 65, A + cc.charCodeAt(1) - 65);
  }

  function renderCountryBadge(country) {
    let badge = $('#country-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'country-badge';
      badge.className = 'country-badge';
      const meta = document.querySelector('.start-meta');
      if (meta && meta.parentNode) meta.parentNode.insertBefore(badge, meta.nextSibling);
    }
    badge.textContent = `Voting from ${flagOf(country)} ${country}`;
  }

  /* ---------- tier-progression CTA ----------
   * After Tier 1 → "Keep voting · N more" CTA (Tier 2 pool).
   * After Tier 2 → "Go deeper · N more" CTA (Tier 3 pool).
   * After Tier 3 → no CTA.
   */
  function renderKeepRanking() {
    const wrap = $('#keep-ranking');
    if (!wrap) return;
    const btn = $('#keep-ranking-btn');
    if (!btn) { wrap.hidden = true; return; }
    let nextTier = 0, count = 0, label = '';
    if (!tierCompleted[2] && TIER[2].length > 0) {
      nextTier = 2; count = TIER[2].length;
      label = `Keep voting · ${count} more ↓`;
    } else if (!tierCompleted[3] && TIER[3].length > 0) {
      nextTier = 3; count = TIER[3].length;
      label = `Go deeper · ${count} more ↓`;
    } else {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    btn.textContent = label;
    btn.dataset.nextTier = String(nextTier);
  }

  function startTier(tier) {
    if (!TIER[tier] || TIER[tier].length === 0) return;
    activeTier = tier;
    appearances = Object.fromEntries(TIER[tier].map(c => [c.id, 0]));
    votesThisTier = 0;
    currentMatchup = null;
    voteHistory = [];
    show('vote');
    renderMatchup();
    renderBackBtn();
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
    // Long-tail block: present only if the user opted into Tier 2/3 — the
    // ranked list below top-5 is then meaningful (vs. an unranked tail).
    if (openedTiers().length > 1) {
      const tail = rankedList().slice(5);
      if (tail.length) {
        lines.push('');
        lines.push(`+ long tail (${tail.length})`);
        tail.forEach((r, i) => {
          lines.push(`${i + 6}. ${partyEmoji(r.c.party)} ${r.c.name}`);
        });
      }
    }
    lines.push('');
    lines.push(`Rank yours: ${url}`);
    return lines.join('\n');
  }

  function shareUrl(top5) {
    const u = new URL(window.location.href);
    if (serverBallotId) {
      // Server-side ballot id: short URL; server already persisted any
      // extended ranking. Drop the x= param.
      u.searchParams.set('b', serverBallotId);
      u.searchParams.delete('x');
    } else {
      // Fallback inline format (API unreachable). Encodes Tier-2/3 picks
      // in x= only if the user opted in.
      const ids = top5.map(r => r.c.id).join(',');
      u.searchParams.set('b', ids);
      if (openedTiers().length > 1) {
        const extIds = rankedList().slice(5).map(r => r.c.id).join(',');
        if (extIds) u.searchParams.set('x', extIds);
        else u.searchParams.delete('x');
      } else {
        u.searchParams.delete('x');
      }
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
  function readFriendBallotInline() {
    const u = new URL(window.location.href);
    const rawB = u.searchParams.get('b');
    const rawX = u.searchParams.get('x');
    if (!rawB) return null;
    // If the param has no commas and looks like a server-side ballot id,
    // skip inline parsing and let the async fetcher handle it.
    if (!rawB.includes(',') && /^[0-9a-z]{4,32}$/.test(rawB)) return null;
    const ids = rawB.split(',').map(s => s.trim()).filter(s => byId[s]).slice(0, 5);
    if (!ids.length) return null;
    const extIds = rawX ? rawX.split(',').map(s => s.trim()).filter(s => byIdExt[s]) : [];
    return {
      top5: ids.map(id => byId[id]),
      extended: extIds.map(id => byIdExt[id]),
    };
  }
  function fetchFriendBallotById() {
    const u = new URL(window.location.href);
    const rawB = u.searchParams.get('b');
    if (!rawB || rawB.includes(',') || !/^[0-9a-z]{4,32}$/.test(rawB)) return Promise.resolve(null);
    return apiFetch(`/api/ballot/${rawB}`, { method: 'GET' })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (!j || !Array.isArray(j.picks)) return null;
        const top5 = j.picks.map(id => byId[id]).filter(Boolean);
        if (!top5.length) return null;
        const ext = Array.isArray(j.extended) ? j.extended.map(id => byIdExt[id]).filter(Boolean) : [];
        return { top5, extended: ext };
      })
      .catch(() => null);
  }
  function renderFriendIntro() {
    // Try inline first (legacy URLs); then fetch by id (current URLs).
    const inline = readFriendBallotInline();
    if (inline) return paintFriendIntro(inline);
    fetchFriendBallotById().then(f => { if (f) paintFriendIntro(f); });
  }
  function paintFriendIntro(friend) {
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

  /* ---------- stats screen (crowd ELO explorer) ----------
   * Reached only via the "See global stats →" CTA on the results
   * screen. Filters by country (visitor's + GLOBAL) and party. Rows tap
   * through to the candidate detail sheet.
   */
  const statsState = { country: 'GLOBAL', party: 'all', loading: false, error: false };

  function renderStatsCountryChips() {
    const host = $('#stats-country-chips');
    if (!host) return;
    const chips = [];
    if (countryHint && /^[A-Z]{2}$/.test(countryHint)) {
      const active = statsState.country === countryHint;
      chips.push(`<button class="filter-chip${active ? ' active' : ''}" data-country="${countryHint}" role="radio" aria-checked="${active}">${flagOf(countryHint)} ${countryHint}</button>`);
    }
    const globalActive = statsState.country === 'GLOBAL';
    chips.push(`<button class="filter-chip${globalActive ? ' active' : ''}" data-country="GLOBAL" role="radio" aria-checked="${globalActive}">🌍 Global</button>`);
    host.innerHTML = chips.join('');
  }

  function renderStatsPartyChips() {
    const host = $('#stats-party-chips');
    if (!host) return;
    host.querySelectorAll('.filter-chip').forEach(btn => {
      const on = btn.dataset.party === statsState.party;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-checked', String(on));
    });
  }

  function renderStatsList(rows, note) {
    const list = $('#stats-list');
    const empty = $('#stats-empty');
    if (!list) return;
    if (note) {
      list.innerHTML = `<div class="stats-note">${escapeHtml(note)}</div>`;
    } else {
      list.innerHTML = '';
    }
    if (statsState.error) {
      list.innerHTML += `<div class="stats-error">Couldn't load — <button class="stats-retry" id="stats-retry-btn">try again</button></div>`;
      if (empty) empty.hidden = true;
      return;
    }
    if (!rows || rows.length === 0) {
      if (empty) {
        empty.hidden = false;
        empty.textContent = 'No data yet for this scope.';
      }
      return;
    }
    if (empty) empty.hidden = true;
    const html = rows.map((row, i) => {
      const c = byIdAll[row.id];
      if (!c) return '';
      const n = Math.round(Number(row.n_ballots) || 0);
      const elo = Math.round(Number(row.elo) || 1500);
      return `<div class="stats-row" data-cid="${row.id}" role="button" tabindex="0" aria-label="More about ${escapeHtml(c.name)}">
        <div class="stats-rank">${i + 1}</div>
        ${avatarHtml(c, 'sm')}
        <div class="stats-info">
          <div class="stats-name">
            <span>${escapeHtml(c.name)}</span>
            <span class="party-chip party-${c.party}"><span class="dot"></span>${c.party}</span>
          </div>
          <div class="stats-meta">ELO ${elo} · ${n} ${n === 1 ? 'ballot' : 'ballots'}</div>
        </div>
      </div>`;
    }).join('');
    list.insertAdjacentHTML('beforeend', html);
  }

  function fetchEloList() {
    if (!API_REACHABLE) return Promise.resolve(null);
    const params = new URLSearchParams();
    params.set('country', statsState.country);
    if (statsState.party !== 'all') params.set('party', statsState.party);
    params.set('limit', '40');
    return apiFetch(`/api/elo?${params.toString()}`, { method: 'GET' })
      .then(r => r && r.ok ? r.json() : null)
      .catch(() => null);
  }

  function pickStatsScope() {
    // First open: prefer the visitor's country if we know it.
    if (statsState.country === 'GLOBAL' && countryHint && /^[A-Z]{2}$/.test(countryHint)) {
      statsState.country = countryHint;
    }
    renderStatsCountryChips();
    renderStatsPartyChips();
    statsState.error = false;
    const list = $('#stats-list');
    if (list) list.innerHTML = `<div class="stats-loading">Loading…</div>`;

    fetchEloList().then(json => {
      if (!json) {
        // Treat as soft-empty: API unreachable or 4xx without payload.
        renderStatsList([], null);
        return;
      }
      if (!Array.isArray(json)) {
        statsState.error = true;
        renderStatsList(null, null);
        return;
      }
      // Low-data fallback: if a specific country returns < 5 rows, switch
      // to GLOBAL with an explanatory note.
      if (statsState.country !== 'GLOBAL' && json.length < 5) {
        const previous = statsState.country;
        statsState.country = 'GLOBAL';
        renderStatsCountryChips();
        fetchEloList().then(j2 => {
          renderStatsList(Array.isArray(j2) ? j2 : [],
            `Not enough data in ${flagOf(previous)} ${previous} yet — showing Global.`);
        });
        return;
      }
      renderStatsList(json, null);
    });
  }

  // Filter chip + retry + row delegation on the stats screen.
  document.addEventListener('click', (e) => {
    const countryChip = e.target.closest('#stats-country-chips .filter-chip');
    if (countryChip) {
      statsState.country = countryChip.dataset.country;
      pickStatsScope();
      return;
    }
    const partyChip = e.target.closest('#stats-party-chips .filter-chip');
    if (partyChip) {
      statsState.party = partyChip.dataset.party;
      pickStatsScope();
      return;
    }
    if (e.target.id === 'stats-retry-btn') {
      pickStatsScope();
      return;
    }
    const statsRow = e.target.closest('.stats-row[data-cid]');
    if (statsRow) {
      openDetailSheet(statsRow.dataset.cid);
    }
  });

  /* ---------- wiring ---------- */
  function start() {
    // Fresh ballot: wipe ratings/RD/sigma/wins across all 40 candidates,
    // reset per-tier completion, and start Tier 1.
    for (const id of Object.keys(ratings)) ratings[id] = RATING_INIT;
    for (const id of Object.keys(rd))      rd[id]      = RD_INIT;
    for (const id of Object.keys(sigma))   sigma[id]   = SIGMA_INIT;
    for (const id of Object.keys(wins))    wins[id]    = 0;
    tierCompleted = { 1: false, 2: false, 3: false };
    serverBallotId = null;
    startTier(1);
  }

  $('#start-btn').addEventListener('click', start);
  $('#restart-btn').addEventListener('click', () => { show('start'); $('#progress').hidden = true; });
  // Tier-progression CTA on the results screen.
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'keep-ranking-btn') {
      const next = parseInt(e.target.dataset.nextTier || '0', 10);
      if (next === 2 || next === 3) startTier(next);
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
  $('#about-link').addEventListener('click', (e) => {
    e.preventDefault();
    toast('Built for fun. No data leaves your phone.');
  });
  // Stats screen wiring (button added in Phase D/E).
  const openStatsBtn = $('#open-stats-btn');
  if (openStatsBtn) openStatsBtn.addEventListener('click', () => {
    show('stats');
    pickStatsScope();
  });
  const statsBackBtn = $('#stats-back-btn');
  if (statsBackBtn) statsBackBtn.addEventListener('click', () => { show('results'); });
  // X-post button: opens twitter.com/intent/tweet with share text URL-encoded.
  const shareXBtn = $('#share-x-btn');
  if (shareXBtn) shareXBtn.addEventListener('click', () => {
    const text = $('#share-preview').textContent || '';
    const url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);
    window.open(url, '_blank', 'noopener,noreferrer');
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

  // Phase 6: update og:image to the per-ballot OG render when a deep
  // link with `?b=<id>` is opened. Social-platform crawlers don't run
  // JS so they'll see the static fallback, but Discord/Slack JS-side
  // previews pick up the rewrite.
  (function updateOgImage() {
    const u = new URL(window.location.href);
    const b = u.searchParams.get('b');
    if (!b || b.includes(',') || !/^[0-9a-z]{4,32}$/.test(b)) return;
    const tag = document.querySelector('meta[property="og:image"]');
    if (tag) tag.setAttribute('content', `${API_BASE_URL}/api/og/${b}`);
  })();

  renderStartPreview();
  renderFriendIntro();
  flushEvents();

  // Boot-time API check: warms the country hint used by the stat
  // overlay and surfaces "Voting from 🇧🇷" on the start screen.
  apiFetch('/api/health', { method: 'GET' })
    .then(r => r.ok ? r.json() : null)
    .then(j => {
      if (!j || !j.country) return;
      countryHint = j.country;
      renderCountryBadge(j.country);
    })
    .catch(() => {});
})();
