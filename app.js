/* The 2028 Ballot - app.js
 *
 * Pure-browser ranked-choice toy ballot. Walks the user through pairwise
 * matchups, runs Glicko-2 to produce a ranking, and shares a Wordle-shaped
 * summary + a URL that encodes the picks.
 *
 * The post-vote reveal tints the winner's card in their party color and
 * shows the candidate's real ELO + global rank + pair-win statistics from
 * the backend (`GET /api/stats`). If the backend is unreachable, the card
 * still tints but no statistics are shown — we never fabricate.
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
  const STORAGE_EVENTS = 'ballot28.events.v1';
  const REVEAL_MS = 1500;

  // ---- API base URL --------------------------------------------------
  // Auto-detect: localhost dev → local wrangler dev on 8787,
  // anywhere else → the deployed Worker.
  // Set window.API_BASE_URL_OVERRIDE before this script loads to force it.
  const API_BASE_URL = (function () {
    if (typeof window.API_BASE_URL_OVERRIDE === 'string') return window.API_BASE_URL_OVERRIDE;
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '') return 'http://127.0.0.1:8787';
    // Deployed Worker. Update this line if the Worker is renamed/redeployed.
    return 'https://ranked-choice-api.bardeus.workers.dev';
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

  // Turnstile token capture (optional).
  // Reads <meta name="turnstile-sitekey">; if present and the
  // Cloudflare script has loaded, every mutating request gets a fresh
  // token in the `t` field. Server-side runs pass-through when
  // TURNSTILE_SECRET is unset (local dev).
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

  /* ---------- pair stats for the post-vote reveal ----------
   * Real data only. If the backend is unreachable or the request fails,
   * returns null and the reveal renders without statistics — we never
   * substitute a seeded estimate.
   */
  function fetchStatsForReveal(aId, bId) {
    if (!API_REACHABLE) return Promise.resolve(null);
    const u = new URL(`${API_BASE_URL}/api/stats`);
    u.searchParams.set('a', aId);
    u.searchParams.set('b', bId);
    return apiFetch(u.pathname + '?' + u.searchParams.toString(), {
      method: 'GET',
    }).then(r => r.ok ? r.json() : null).catch(() => null);
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
    // Tier 1, vote 1: fixed opener. DYNAMIC_OPENER is a stub for a
    // later phase (top-2-by-global-ELO); off for now.
    if (activeTier === 1 && voteHistory.length === 0 && !DYNAMIC_OPENER) {
      return orientMatchup(byIdAll.vance, byIdAll.newsom);
    }
    // Tier 1, vote 2: hand-picked same-party rival to the R1 winner.
    // R2_RIVAL only contains entries for fixed-opener winners; any
    // other R1 winner falls through to adaptive selection.
    if (activeTier === 1 && voteHistory.length === 1) {
      const rivalId = R2_RIVAL[voteHistory[0].pickedId];
      if (rivalId) {
        return orientMatchup(byIdAll[voteHistory[0].pickedId], byIdAll[rivalId]);
      }
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

  /* ---------- rendering ---------- */
  const $ = sel => document.querySelector(sel);
  const screens = {
    start: $('#screen-start'),
    vote: $('#screen-vote'),
    results: $('#screen-results'),
    stats: $('#screen-stats'),
    tiers: $('#screen-tiers'),
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
    const sizeClass = size === 'sm' ? ' sm'
      : size === 'xs' ? ' xs'
      : size === 'lg' ? ' lg'
      : '';
    const photo = (window.CANDIDATE_PHOTOS || {})[c.id];
    const inner = photo
      ? `<img src="${photo}" alt="" loading="lazy" onerror="this.remove();this.parentNode.textContent='${initials(c.name)}'">`
      : initials(c.name);
    return `<div class="avatar party-${c.party}${sizeClass}${photo ? ' has-photo' : ''}" aria-hidden="true">${inner}</div>`;
  }

  // Returns 25 candidates: all of Tier 1, then the first of Tier 2, capped at 25.
  function rosterPreviewSet() {
    return [...TIER[1], ...TIER[2]].slice(0, 25);
  }

  // Builds an output sequence by picking, at each position, a random
  // candidate from the parties that won't create a 3-in-a-row. Falls
  // back to a plain shuffle if the constraint is infeasible (cap 6
  // attempts).
  function shufflePartyMixed(arr) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const buckets = {};
      for (const c of arr) (buckets[c.party] = buckets[c.party] || []).push(c);
      for (const p of Object.keys(buckets)) buckets[p] = shuffle(buckets[p]);
      const out = [];
      let ok = true;
      while (out.length < arr.length) {
        const blocked = out.length >= 2 && out[out.length - 1].party === out[out.length - 2].party
          ? out[out.length - 1].party : null;
        const choices = Object.keys(buckets).filter(p => buckets[p].length > 0 && p !== blocked);
        if (choices.length === 0) { ok = false; break; }
        // If one party would overflow the remaining slots (count > ceil(rest/2)),
        // we must pick it. Otherwise pick weighted-randomly by remaining count
        // so rare parties (Independents) don't get stranded at the end.
        const remaining = arr.length - out.length;
        const forced = choices.find(p => buckets[p].length * 2 > remaining + 1);
        let pick;
        if (forced) {
          pick = forced;
        } else {
          const total = choices.reduce((s, p) => s + buckets[p].length, 0);
          let r = Math.random() * total;
          pick = choices[0];
          for (const p of choices) { r -= buckets[p].length; if (r <= 0) { pick = p; break; } }
        }
        out.push(buckets[pick].pop());
      }
      if (ok) return out;
    }
    return shuffle(arr);
  }

  function renderStartPreview() {
    const pool = shufflePartyMixed(rosterPreviewSet());
    $('#start-preview').innerHTML = pool.map(c => avatarHtml(c, 'lg')).join('');
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
          <div class="reveal-panel" aria-hidden="true"></div>
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
    // All-tier votes hit the backend (drives crowd ELO + pair_aggregates).
    postRemoteVote(m.a.id, m.b.id, picked.id);
    voteHistory.push({
      aId: m.a.id, bId: m.b.id,
      pickedId: picked.id, lostId: lost.id,
      prev,
    });
    votesThisTier += 1;
    totalVoteCount += 1;
    renderBackBtn();

    // Pick sound (suppressed by user mute toggle).
    if (window.Sounds) window.Sounds.pickClick();

    advancing = true;
    revealVote(m, pickedSlot);
  }

  function skip() {
    if (advancing) return;
    // Skip: drop the current matchup without applying a Glicko update,
    // and ask the engine for a different one. Doesn't count toward votesThisTier.
    renderMatchup();
    renderBackBtn();
  }

  function goBack() {
    // If a reveal is still showing from the just-cast vote, cancel the
    // pending advance — we haven't picked the next matchup yet.
    if (advancing) {
      clearRevealState();
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
    totalVoteCount = Math.max(0, totalVoteCount - 1);
    // Re-display the matchup the user came from. renderCard() resets
    // the .picked / .dimmed / .party-* classes from the prior reveal.
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

  /* ---------- in-card reveal ----------
   * After a vote, the winning card tints to its party color (chrome
   * only — portrait stays full color) and the losing card dims. Two
   * data lines populate via /api/stats: ELO + rank, and pair-win
   * percentage. Real data only; null response leaves the lines empty.
   * Advances after REVEAL_MS or on tap-anywhere-on-cards.
   */
  let advanceTimer = null;
  let revealContext = null; // { aId, bId, pickedId } — guards async stats response
  function clearRevealState() {
    clearTimeout(advanceTimer);
    advanceTimer = null;
    revealContext = null;
    for (const slot of ['a', 'b']) {
      const card = $('#card-' + slot);
      if (!card) continue;
      card.classList.remove('picked', 'dimmed', 'party-D', 'party-R', 'party-I');
      const panel = card.querySelector('.reveal-panel');
      if (panel) panel.innerHTML = '';
    }
  }
  function lastName(name) { return name.split(' ').slice(-1)[0]; }
  function formatNumber(n) { return Number(n).toLocaleString('en-US'); }
  function revealVote(m, pickedSlot) {
    const picked = pickedSlot === 'a' ? m.a : m.b;
    const lostSlot = pickedSlot === 'a' ? 'b' : 'a';
    const lost = pickedSlot === 'a' ? m.b : m.a;
    revealContext = { aId: m.a.id, bId: m.b.id, pickedId: picked.id };

    // Apply visual reveal classes. Reuses the existing .picked / .dimmed
    // pair animation classes; adds .party-<P> on the winner for tint.
    const pickedCard = $('#card-' + pickedSlot);
    const lostCard   = $('#card-' + lostSlot);
    pickedCard.classList.add('picked', 'party-' + picked.party);
    lostCard.classList.add('dimmed');

    // Render with no stats first so layout settles immediately, then
    // overlay real data once /api/stats returns.
    renderRevealPanels(m, pickedSlot, null);
    fetchStatsForReveal(m.a.id, m.b.id).then(stats => {
      // Guard: user may have advanced past this matchup already.
      if (!revealContext) return;
      if (revealContext.aId !== m.a.id || revealContext.bId !== m.b.id) return;
      renderRevealPanels(m, pickedSlot, stats);
    });

    // Resolved chime fires once the reveal has been on-screen briefly.
    if (window.Sounds) {
      setTimeout(() => {
        if (revealContext) window.Sounds.resolvedChime();
      }, 350);
    }

    clearTimeout(advanceTimer);
    advanceTimer = setTimeout(advanceFromReveal, REVEAL_MS);
  }
  function advanceFromReveal() {
    if (!advancing) return;
    clearRevealState();
    advancing = false;
    renderMatchup();
  }
  function renderRevealPanels(m, pickedSlot, stats) {
    const pickedId = pickedSlot === 'a' ? m.a.id : m.b.id;
    for (const slot of ['a', 'b']) {
      const c = slot === 'a' ? m.a : m.b;
      const isWinner = c.id === pickedId;
      const panel = $('#card-' + slot + ' .reveal-panel');
      if (!panel) continue;
      if (!stats) { panel.innerHTML = ''; continue; }
      panel.innerHTML = revealPanelHtml(c, isWinner, stats, m);
    }
  }
  function revealPanelHtml(c, isWinner, stats, m) {
    const elo = stats.elo ? stats.elo[c.id] : null;
    const rank = stats.rank ? stats.rank[c.id] : null;
    // Line 1: ELO + rank (or UNRANKED if below floor).
    let line1;
    if (elo == null) {
      line1 = 'UNRANKED';
    } else if (rank == null) {
      line1 = `${elo} ELO · UNRANKED`;
    } else {
      line1 = `${elo} ELO · Rank #${rank}`;
    }
    // Line 2: pair-win statistic on the winner card only.
    let line2 = '';
    if (isWinner) {
      const scope = stats.scope || 'GLOBAL';
      const useCountry = scope !== 'GLOBAL';
      const counts = useCountry ? (stats.local || {}) : (stats.global || {});
      const totalSource = useCountry ? (stats.total && stats.total.local) : (stats.total && stats.total.global);
      const total = Number(totalSource || 0);
      const opponent = c.id === m.a.id ? m.b : m.a;
      if (total < 10) {
        line2 = `Early matchup — ${total} ${total === 1 ? 'vote' : 'votes'} so far`;
      } else {
        const winnerVotes = Number(counts[c.id] || 0);
        const pct = Math.round((winnerVotes / total) * 100);
        const suffix = useCountry ? ` in ${scope}` : '';
        line2 = `Won against ${lastName(opponent.name)} ${pct}% of ${formatNumber(total)} votes${suffix}`;
      }
    }
    return `
      <div class="reveal-line reveal-elo">${escapeHtml(line1)}</div>
      ${line2 ? `<div class="reveal-line reveal-pair">${escapeHtml(line2)}</div>` : ''}
    `;
  }

  // Tap anywhere on either card during the reveal advances immediately.
  document.addEventListener('click', (e) => {
    if (!advancing) return;
    const card = e.target.closest && e.target.closest('#card-a, #card-b');
    if (!card) return;
    advanceFromReveal();
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
    // Reset the inline tier-list slot so a fresh results paint re-lazy-mounts.
    const slot = document.getElementById('tier-list-slot');
    if (slot) { slot.dataset.mounted = ''; slot.innerHTML = ''; }
    getGlobalElo(); // warm the cache; non-blocking
    lazyMountInlineTierList();
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
    clearRevealState();
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

  /* ---------- tier list ----------
   * Visual tier-list (TierMaker-style) reachable in two places:
   *   1. Inline, lazily mounted under #screen-results on first scroll
   *      into view (#tier-list-slot in index.html).
   *   2. Standalone screen #screen-tiers reachable at #/tiers (Phase B).
   *
   * Ranking source is either the cached Global crowd Elo (via /api/elo)
   * or this session's in-memory Glicko ratings ("Mine"). Tiers are cut
   * by position via lib/tier_cut.js — viewers at the same size + source
   * see identical groupings.
   *
   * Bucket sums per size: 15 → 2/3/4/6; 25 → 2/3/5/7/8; 40 → 2/3/5/7/8/15.
   */
  const TIER_ELO_CACHE_MS = 5 * 60 * 1000;
  const eloCache = { fetchedAt: 0, data: null, inflight: null };
  const TIER_STORAGE_SIZE = 'tierList.rosterSize';
  const TIER_STORAGE_SOURCE = 'tierList.source';
  const TIER_MINE_FLOOR = 5;
  // Session-cumulative vote count (totalled across tier transitions, where
  // `votesThisTier` resets). Mine source is gated on this reaching FLOOR.
  let totalVoteCount = 0;
  // Tier-list scope is shared by inline + standalone hosts. Updates re-paint
  // every mounted host the next time renderTierList is called.
  const tierScope = { size: 15, source: 'global' };
  function loadTierScope() {
    try {
      const rawSize = localStorage.getItem(TIER_STORAGE_SIZE);
      const n = parseInt(rawSize, 10);
      if (n === 15 || n === 25 || n === 40) tierScope.size = n;
    } catch {}
    try {
      const rawSrc = localStorage.getItem(TIER_STORAGE_SOURCE);
      if (rawSrc === 'global' || rawSrc === 'mine') tierScope.source = rawSrc;
    } catch {}
  }
  function saveTierScope() {
    try {
      localStorage.setItem(TIER_STORAGE_SIZE, String(tierScope.size));
      localStorage.setItem(TIER_STORAGE_SOURCE, tierScope.source);
    } catch {}
  }
  loadTierScope();
  function isMineEnabled() { return totalVoteCount >= TIER_MINE_FLOOR; }
  function getGlobalElo() {
    if (eloCache.inflight) return eloCache.inflight;
    const fresh = eloCache.data && (Date.now() - eloCache.fetchedAt) < TIER_ELO_CACHE_MS;
    if (fresh) return Promise.resolve(eloCache.data);
    if (!API_REACHABLE) return Promise.resolve(null);
    eloCache.inflight = apiFetch('/api/elo?country=GLOBAL&limit=50', { method: 'GET' })
      .then(r => r && r.ok ? r.json() : null)
      .then(json => {
        eloCache.inflight = null;
        if (Array.isArray(json)) {
          eloCache.data = json;
          eloCache.fetchedAt = Date.now();
          return json;
        }
        return null;
      })
      .catch(() => { eloCache.inflight = null; return null; });
    return eloCache.inflight;
  }

  // Build a deterministic full-roster ranking of exactly POOL.length entries.
  // Primary order = the API response (already sorted by elo desc); any POOL
  // member missing from the response is appended in stable alphabetical id
  // order so the same viewer-independent fill happens everywhere.
  function rankForGlobal(apiRows) {
    const seen = new Set();
    const out = [];
    if (Array.isArray(apiRows)) {
      for (const row of apiRows) {
        if (!byIdAll[row.id] || seen.has(row.id)) continue;
        out.push(byIdAll[row.id]);
        seen.add(row.id);
      }
    }
    const rest = POOL.filter(c => !seen.has(c.id)).sort((a, b) => a.id.localeCompare(b.id));
    return out.concat(rest);
  }

  function rankForMine() {
    return POOL.slice().sort((a, b) => (ratings[b.id] || 0) - (ratings[a.id] || 0));
  }

  const TIER_ORDER = ['S', 'A', 'B', 'C', 'D', 'F'];

  function tierAvatarHtml(c) {
    const photo = (window.CANDIDATE_PHOTOS || {})[c.id];
    const inner = photo
      ? `<img src="${photo}" alt="" loading="lazy" crossorigin="anonymous" onerror="this.remove();this.parentNode.textContent='${initials(c.name)}'">`
      : initials(c.name);
    return `<div class="avatar party-${c.party}${photo ? ' has-photo' : ''}" aria-hidden="true">${inner}</div>`;
  }

  function controlsHtml() {
    const sizes = [15, 25, 40].map(n => {
      const active = tierScope.size === n;
      return `<button class="tier-pill${active ? ' active' : ''}" type="button"
                data-tier-size="${n}" role="radio" aria-checked="${active}">${n}</button>`;
    }).join('');
    const mineEnabled = isMineEnabled();
    const sourceBtns = [
      `<button class="tier-pill${tierScope.source === 'global' ? ' active' : ''}"
         type="button" data-tier-source="global" role="radio"
         aria-checked="${tierScope.source === 'global'}">🌍 Global</button>`,
      `<button class="tier-pill${tierScope.source === 'mine' && mineEnabled ? ' active' : ''}"
         type="button" data-tier-source="mine" role="radio"
         aria-checked="${tierScope.source === 'mine' && mineEnabled}"
         ${mineEnabled ? '' : 'aria-disabled="true"'}>
         ${mineEnabled ? '👤 Mine' : 'Vote first'}
       </button>`,
    ].join('');
    let dismissed = false;
    try { dismissed = localStorage.getItem(EXPLAINER_DISMISS_KEY) === '1'; } catch {}
    return `
      <div class="tier-toggle-group" role="radiogroup" aria-label="Roster size">${sizes}</div>
      <div class="tier-toggle-group" role="radiogroup" aria-label="Ranking source">${sourceBtns}</div>
      <button class="tier-how-btn${dismissed ? '' : ' pulse'}" type="button" data-tier-how="1"
              aria-label="How is this calculated?">How?</button>
      <button class="tier-export-btn" type="button" data-tier-export="1"
              aria-label="Save tier list as image">💾 Save as image</button>
    `;
  }

  function renderTierList(rootEl, scope) {
    if (!rootEl || !window.TierCut) return;
    // `scope` arg is informational only — we always render the shared tierScope.
    const size = tierScope.size;
    const source = tierScope.source;
    rootEl.innerHTML = `
      <div class="tier-list-header">
        <div class="tier-list-title">
          <div class="label">Tier list</div>
          <h3 id="tier-list-heading">Loading…</h3>
        </div>
        <div class="tier-list-controls">${controlsHtml()}</div>
      </div>
      <div class="tier-list-rows" aria-live="polite">
        <div class="tier-list-loading">Loading global rankings…</div>
      </div>
    `;
    const heading = rootEl.querySelector('#tier-list-heading');
    const rowsHost = rootEl.querySelector('.tier-list-rows');

    const paint = (rankedFull) => {
      if (!rankedFull || rankedFull.length < size) {
        heading.textContent = source === 'mine' ? 'Your tier list' : 'Global tier list';
        rowsHost.innerHTML = `<div class="tier-list-empty">Not enough data yet — keep voting and check back.</div>`;
        return;
      }
      heading.textContent = source === 'mine'
        ? `Your tier list · Top ${size}`
        : `Global tier list · Top ${size}`;
      const cut = window.TierCut.cutTiers(rankedFull.slice(0, size), size);
      const rowsHtml = TIER_ORDER
        .filter(t => Array.isArray(cut[t]) && cut[t].length > 0)
        .map(t => {
          const avatars = cut[t].map(c => `
            <button class="tier-avatar" type="button" data-cid="${c.id}"
                    aria-label="${escapeHtml(c.name)} — ${t} tier">
              ${tierAvatarHtml(c)}
              <span class="tier-avatar-name">${escapeHtml(c.name.split(' ').slice(-1)[0])}</span>
            </button>
          `).join('');
          return `
            <div class="tier-row" data-tier="${t}">
              <div class="tier-label tier-label-${t}">${t}</div>
              <div class="tier-row-avatars">${avatars}</div>
            </div>
          `;
        }).join('');
      rowsHost.innerHTML = rowsHtml;
    };

    if (source === 'mine') {
      paint(rankForMine());
    } else {
      getGlobalElo().then(rows => paint(rankForGlobal(rows)));
    }
  }

  // Re-paint every currently-mounted tier-list host. Called when toggles
  // flip so the inline and standalone surfaces stay in sync.
  function repaintAllTierHosts() {
    const inline = document.getElementById('tier-list-slot');
    if (inline && inline.dataset.mounted === '1') renderTierList(inline, tierScope);
    const standalone = document.getElementById('tier-list-standalone');
    if (standalone) renderTierList(standalone, tierScope);
  }

  /* ---------- PNG export ----------
   * Renders the current tier list into an offscreen 1200×630 canvas
   * (Open Graph aspect ratio) and triggers a download. No external libs;
   * uses crossOrigin-anonymous on avatar images so the canvas is not
   * tainted. All avatars in this project are first-party static assets,
   * so no CORS issue in practice.
   */
  const TIER_BAND_COLORS = {
    S: '#ff5252', A: '#ff9b3a', B: '#ffd54a',
    C: '#6fcc6f', D: '#5b9bff', F: '#bcbcc4',
  };
  function loadAvatarImage(c) {
    const url = (window.CANDIDATE_PHOTOS || {})[c.id];
    if (!url) return Promise.resolve(null);
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }
  function buildRankedForScope() {
    if (tierScope.source === 'mine') {
      return Promise.resolve(rankForMine());
    }
    return getGlobalElo().then(rows => rankForGlobal(rows));
  }
  function exportTierListPng() {
    const W = 1200, H = 630;
    const size = tierScope.size;
    const source = tierScope.source;
    return buildRankedForScope().then(rankedFull => {
      if (!rankedFull || rankedFull.length < size) {
        toast('Not enough data to export yet.');
        return null;
      }
      const cut = window.TierCut.cutTiers(rankedFull.slice(0, size), size);
      const rows = TIER_ORDER.filter(t => Array.isArray(cut[t]) && cut[t].length > 0);
      // Pre-load all avatar images.
      const flat = rows.flatMap(t => cut[t]);
      return Promise.all(flat.map(loadAvatarImage)).then(imgs => {
        const imgById = {};
        flat.forEach((c, i) => { imgById[c.id] = imgs[i]; });

        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#0b0b0d';
        ctx.fillRect(0, 0, W, H);

        // Title strip
        ctx.fillStyle = '#f5f5f7';
        ctx.font = "700 30px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
        ctx.textBaseline = 'top';
        const title = source === 'mine'
          ? `Your tier list · Top ${size}`
          : `Global tier list · Top ${size}`;
        ctx.fillText(title, 32, 26);
        ctx.font = "500 16px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
        ctx.fillStyle = '#9a9aa3';
        ctx.fillText('The 2028 Ballot', 32, 64);

        // Rows region: 32px left padding, starts at y=110
        const rowsTop = 110;
        const rowsBottom = H - 40;
        const labelW = 70;
        const rowGap = 10;
        const padX = 32;
        const innerW = W - padX * 2;
        const rowH = Math.max(60, Math.floor((rowsBottom - rowsTop - rowGap * (rows.length - 1)) / rows.length));
        // Each row body holds N avatars laid out horizontally with shared spacing.
        rows.forEach((t, ri) => {
          const y = rowsTop + ri * (rowH + rowGap);
          // Label cell
          ctx.fillStyle = TIER_BAND_COLORS[t] || '#bcbcc4';
          ctx.fillRect(padX, y, labelW, rowH);
          ctx.fillStyle = '#1a1a1d';
          ctx.font = "800 32px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
          ctx.textBaseline = 'middle';
          const labelW2 = ctx.measureText(t).width;
          ctx.fillText(t, padX + (labelW - labelW2) / 2, y + rowH / 2);
          // Body cell
          const bodyX = padX + labelW + 6;
          const bodyW = innerW - labelW - 6;
          ctx.fillStyle = '#161618';
          ctx.fillRect(bodyX, y, bodyW, rowH);
          // Avatars
          const items = cut[t];
          const aSize = Math.min(rowH - 12, Math.floor((bodyW - 16) / items.length) - 6);
          const aSlot = aSize + 6;
          let ax = bodyX + 12;
          const ay = y + (rowH - aSize) / 2;
          items.forEach(c => {
            const img = imgById[c.id];
            // Avatar circle background (party tint)
            const partyTint = c.party === 'R' ? '#3a1414' : c.party === 'D' ? '#0e2541' : '#2a2a2e';
            ctx.beginPath();
            ctx.arc(ax + aSize / 2, ay + aSize / 2, aSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.fillStyle = partyTint;
            ctx.fill();
            if (img) {
              ctx.save();
              ctx.beginPath();
              ctx.arc(ax + aSize / 2, ay + aSize / 2, aSize / 2, 0, Math.PI * 2);
              ctx.clip();
              ctx.drawImage(img, ax, ay, aSize, aSize);
              ctx.restore();
            } else {
              ctx.fillStyle = '#f5f5f7';
              ctx.font = `700 ${Math.floor(aSize * 0.36)}px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif`;
              ctx.textBaseline = 'middle';
              const txt = initials(c.name);
              const tw = ctx.measureText(txt).width;
              ctx.fillText(txt, ax + (aSize - tw) / 2, ay + aSize / 2);
            }
            ax += aSlot;
          });
        });

        // Watermark (user confirmed in design open-question — keep it).
        ctx.fillStyle = 'rgba(245, 245, 247, 0.55)';
        ctx.font = "500 14px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
        ctx.textBaseline = 'alphabetic';
        const wm = '2028ballot.almaintel.com';
        const wmW = ctx.measureText(wm).width;
        ctx.fillText(wm, W - padX - wmW, H - 18);

        return new Promise(resolve => {
          canvas.toBlob(blob => {
            if (!blob) { toast('Could not save image.'); resolve(null); return; }
            const filename = `2028ballot-tier-${source}-${size}.png`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            toast('Saved — check your downloads');
            resolve(blob);
          }, 'image/png');
        });
      });
    });
  }
  // Expose for the smoke-test (and possible future debug surfaces).
  if (typeof window !== 'undefined') window.__tierExport = exportTierListPng;

  function lazyMountInlineTierList() {
    const slot = document.getElementById('tier-list-slot');
    if (!slot) return;
    if (slot.dataset.mounted === '1') return;
    if (!('IntersectionObserver' in window)) {
      // Fallback for ancient browsers: render immediately.
      renderTierList(slot, { size: 15, source: 'global' });
      slot.dataset.mounted = '1';
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && slot.dataset.mounted !== '1') {
          renderTierList(slot, { size: 15, source: 'global' });
          slot.dataset.mounted = '1';
          io.disconnect();
        }
      }
    }, { rootMargin: '120px 0px' });
    io.observe(slot);
  }

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
    totalVoteCount = 0;
    startTier(1);
  }

  $('#start-btn').addEventListener('click', start);
  $('#restart-btn').addEventListener('click', () => { show('start'); $('#progress').hidden = true; });
  // Mute toggle (persisted by lib/sounds.js).
  (function wireMuteToggle() {
    const btn = $('#mute-btn');
    if (!btn || !window.Sounds) return;
    function paint() {
      const m = window.Sounds.isMuted();
      btn.querySelector('.mute-icon').textContent = m ? '🔇' : '🔊';
      btn.setAttribute('aria-pressed', m ? 'true' : 'false');
      btn.setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound');
    }
    paint();
    btn.addEventListener('click', () => {
      window.Sounds.setMuted(!window.Sounds.isMuted());
      paint();
    });
  })();
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

  // Rewrite og:image to the per-ballot OG render when a deep link with
  // `?b=<id>` opens. Static crawlers see the fallback meta tag; JS-side
  // previewers (Discord/Slack) pick up this rewrite.
  (function updateOgImage() {
    const u = new URL(window.location.href);
    const b = u.searchParams.get('b');
    if (!b || b.includes(',') || !/^[0-9a-z]{4,32}$/.test(b)) return;
    const tag = document.querySelector('meta[property="og:image"]');
    if (tag) tag.setAttribute('content', `${API_BASE_URL}/api/og/${b}`);
  })();

  /* ---------- tier-list interactivity ---------- */
  document.addEventListener('click', (e) => {
    // Size pill
    const sizeBtn = e.target.closest('[data-tier-size]');
    if (sizeBtn) {
      const n = parseInt(sizeBtn.dataset.tierSize, 10);
      if (n === 15 || n === 25 || n === 40) {
        tierScope.size = n;
        saveTierScope();
        repaintAllTierHosts();
      }
      return;
    }
    // Source pill
    const srcBtn = e.target.closest('[data-tier-source]');
    if (srcBtn) {
      const wanted = srcBtn.dataset.tierSource;
      if (wanted === 'mine' && !isMineEnabled()) {
        toast(`Vote at least ${TIER_MINE_FLOOR} times to see your personal tier list`);
        return;
      }
      if (wanted === 'global' || wanted === 'mine') {
        tierScope.source = wanted;
        saveTierScope();
        repaintAllTierHosts();
      }
      return;
    }
    // "How?" link → civic explainer (Phase C)
    const howBtn = e.target.closest('[data-tier-how]');
    if (howBtn) {
      openExplainer('how-elo');
      return;
    }
    // "Save as image" → PNG export (Phase C)
    const exportBtn = e.target.closest('[data-tier-export]');
    if (exportBtn) {
      exportTierListPng(tierScope).catch(() => toast('Could not save image — try again.'));
      return;
    }
    // Candidate avatar in any tier row → detail sheet
    const tierAv = e.target.closest('.tier-avatar[data-cid]');
    if (tierAv) {
      openDetailSheet(tierAv.dataset.cid);
      return;
    }
  });

  // Keyboard: Space / Enter on a focused tier-avatar opens the detail sheet.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const av = e.target.closest && e.target.closest('.tier-avatar[data-cid]');
    if (av && document.activeElement === av) {
      e.preventDefault();
      openDetailSheet(av.dataset.cid);
    }
  });

  // Back button on the standalone tier-list screen.
  const tiersBackBtn = $('#tiers-back-btn');
  if (tiersBackBtn) tiersBackBtn.addEventListener('click', () => {
    if (history.length > 1) history.back();
    else { location.hash = ''; show('results'); }
  });

  /* ---------- hash router ----------
   * Tiny: maps #/tiers → show('tiers') + paint. Other hashes are ignored
   * (existing screen-button navigation remains the entry point for them).
   */
  function applyRoute() {
    const h = location.hash || '';
    if (h === '#/tiers') {
      show('tiers');
      const host = $('#tier-list-standalone');
      if (host) renderTierList(host, tierScope);
    }
    // No else: leave the active screen alone for other hash values.
  }
  window.addEventListener('hashchange', applyRoute);

  /* ---------- civic explainer (Phase C) ----------
   * Reusable panel with two anchored sections (#how-elo, #why-rcv).
   * openExplainer(section?) reveals the panel and scrolls to a section.
   */
  const EXPLAINER_DISMISS_KEY = 'civicExplainer.dismissedTip';
  const EXPLAINER_COPY_HOW_ELO = `
    <h4>How tiers are computed</h4>
    <p>Every time someone picks a candidate in a head-to-head matchup, we update each candidate's <strong>Elo rating</strong>
       — the same math chess uses. Picking a lower-rated underdog gives them a bigger boost; picking the
       favorite barely moves the needle. Over thousands of votes, ratings settle into a stable ordering.</p>
    <p>The <strong>tier list</strong> just slices that ordering into named rows by position. Top 2 are S tier,
       next 3 are A, and so on. The cut is by rank, not by Elo gap, so two friends viewing the same size +
       source see identical groupings — perfect for arguing about who's really C tier.</p>
    <p><em>Mine</em> uses the same Elo math, but with only the matchups you personally voted on — a smaller
       sample, but it's your taste, not the crowd's.</p>
    <p style="margin-top:18px;">
      <button class="cta secondary" type="button" id="explainer-share-btn">🔗 Share this with a friend</button>
    </p>
  `;
  const EXPLAINER_COPY_WHY_RCV = `
    <h4>Why ranked choice?</h4>
    <p>In a normal "pick one" vote, the winner only needs 50% + 1 of the votes — so a candidate liked by half
       and disliked by the other half can edge out someone more broadly acceptable.</p>
    <p><strong>Ranked-choice voting</strong> (also called <em>instant-runoff</em>) asks voters to rank candidates
       in order of preference. If no one wins outright, the lowest-ranked candidate is eliminated and their
       voters' second choices are counted instead. The process repeats until one candidate has a majority.</p>
    <p>The effect: a candidate broadly acceptable to most voters tends to beat a candidate intensely loved
       by a narrow group. In practice that often means fewer "spoiler" effects, more centrist outcomes, and
       a winner who reflects what most people are okay with — not just what 50% + 1 demanded.</p>
    <p>Real-world examples: <em>Maine</em> and <em>Alaska</em> use it statewide; dozens of US cities (incl.
       New York City for primaries) use it too. Ireland and Australia have used variants for decades.</p>
    <p>This site is a toy version: head-to-head matchups feed an Elo rating, which orders candidates the way
       an RCV system would order them in spirit, without asking you to rank 40 names at once.</p>
  `;
  function paintExplainerSections() {
    const a = document.getElementById('how-elo');
    const b = document.getElementById('why-rcv');
    if (a && !a.dataset.painted) { a.innerHTML = EXPLAINER_COPY_HOW_ELO; a.dataset.painted = '1'; }
    if (b && !b.dataset.painted) { b.innerHTML = EXPLAINER_COPY_WHY_RCV; b.dataset.painted = '1'; }
  }
  let explainerReturnFocus = null;
  function openExplainer(section) {
    paintExplainerSections();
    const panel = document.getElementById('civic-explainer');
    if (!panel) return;
    explainerReturnFocus = document.activeElement;
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      panel.classList.add('show');
      const scroll = document.getElementById('explainer-scroll');
      if (!scroll) return;
      if (section && (section === 'how-elo' || section === 'why-rcv')) {
        const target = document.getElementById(section);
        if (target) scroll.scrollTop = target.offsetTop - 6;
      } else {
        scroll.scrollTop = 0;
      }
      const closeBtn = document.getElementById('explainer-close');
      if (closeBtn) closeBtn.focus();
    });
    try {
      if (!localStorage.getItem(EXPLAINER_DISMISS_KEY)) {
        localStorage.setItem(EXPLAINER_DISMISS_KEY, '1');
        // Repaint hosts so the pulse hint goes away on the trigger.
        repaintAllTierHosts();
      }
    } catch {}
  }
  function closeExplainer() {
    const panel = document.getElementById('civic-explainer');
    if (!panel || panel.hidden) return;
    panel.classList.remove('show');
    panel.setAttribute('aria-hidden', 'true');
    // After the close transition (kept simple — immediate).
    panel.hidden = true;
    document.body.style.overflow = '';
    if (explainerReturnFocus && typeof explainerReturnFocus.focus === 'function') {
      explainerReturnFocus.focus();
      explainerReturnFocus = null;
    }
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-explainer-close]') || e.target.id === 'explainer-close') {
      e.preventDefault();
      closeExplainer();
      return;
    }
    if (e.target.id === 'explainer-share-btn') {
      const url = `${location.origin}${location.pathname}#/tiers`;
      copy(url);
      toast('Link copied — share it with a friend');
      return;
    }
    // (i) icon next to "Your top 5" → why-rcv
    if (e.target.closest('[data-explainer-open="why-rcv"]')) {
      openExplainer('why-rcv');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const panel = document.getElementById('civic-explainer');
      if (panel && !panel.hidden) {
        e.preventDefault();
        closeExplainer();
      }
    }
  });

  renderStartPreview();
  renderFriendIntro();
  flushEvents();
  applyRoute();

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
