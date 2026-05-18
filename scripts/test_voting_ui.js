// Headless smoke test for the new skip / back / two-CTA behavior.
// Uses Chrome DevTools Protocol via the same ws session pattern as drive.js.
const fs = require('fs');
const WebSocket = require(require('path').resolve(__dirname, 'node_modules', 'ws'));

const URL = process.argv[2] || 'http://127.0.0.1:8765/index.html';

(async () => {
  const ver = await fetch('http://127.0.0.1:9223/json/version').then(r => r.json());
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  });
  await new Promise(r => ws.once('open', r));
  const root = (method, params={}) => new Promise((resolve, reject) => {
    const i = ++id; pending.set(i, { resolve, reject });
    ws.send(JSON.stringify({ id: i, method, params }));
  });

  const targets = await fetch('http://127.0.0.1:9223/json').then(r => r.json());
  const target = targets.find(t => t.type === 'page');
  const { sessionId } = await root('Target.attachToTarget', { targetId: target.id, flatten: true });
  const send = (method, params={}) => new Promise((resolve, reject) => {
    const i = ++id; pending.set(i, { resolve, reject });
    ws.send(JSON.stringify({ sessionId, id: i, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: URL });
  await new Promise(r => {
    const h = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.method === 'Page.loadEventFired') { ws.off('message', h); r(); }
    };
    ws.on('message', h);
  });
  await new Promise(r => setTimeout(r, 400));

  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + (r.exceptionDetails.exception?.description || ''));
    return r.result.value;
  };

  const results = [];
  const assert = (name, ok, info) => { results.push({ name, ok, info }); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (info ? '  — ' + info : '')); };

  // --- Test 1: Skip vote 1 changes the displayed pair ---
  await evalJs("document.getElementById('start-btn').click()");
  await new Promise(r => setTimeout(r, 300));
  const pair1 = await evalJs(`[document.querySelector('#card-a').dataset.cid, document.querySelector('#card-b').dataset.cid].sort().join(':')`);
  assert('vote 1 is fixed Vance/Newsom opener', pair1 === 'newsom:vance', `got ${pair1}`);

  await evalJs("document.getElementById('skip-btn').click()");
  await new Promise(r => setTimeout(r, 300));
  const pair2 = await evalJs(`[document.querySelector('#card-a').dataset.cid, document.querySelector('#card-b').dataset.cid].sort().join(':')`);
  assert('skip on vote 1 advances to a DIFFERENT pair', pair2 !== pair1, `got ${pair2}`);

  // --- Test 2: Skip until tier 1 effectively ends (skip all pairs) ---
  // Instead of skipping every pair (slow), just vote through tier 1 to exit.
  // Use the deterministic .pick by clicking card-a each time.
  let safety = 0;
  while (safety++ < 50) {
    const onVote = await evalJs(`document.getElementById('screen-vote').classList.contains('active')`);
    if (!onVote) break;
    await evalJs(`document.getElementById('card-a').click()`);
    await new Promise(r => setTimeout(r, 1700)); // REVEAL_MS=1500 + buffer
  }
  const onResults = await evalJs(`document.getElementById('screen-results').classList.contains('active')`);
  assert('tier 1 completes and lands on results', onResults, `safety iters=${safety}`);

  // --- Test 3: Both CTAs visible on results ---
  const rankMoreVisible = await evalJs(`!document.getElementById('rank-more-btn').hidden`);
  const calibVisible    = await evalJs(`!document.getElementById('keep-calibrating-btn').hidden`);
  assert('Rank More button visible on results', rankMoreVisible);
  assert('Keep Calibrating button visible on results', calibVisible);

  // --- Test 4: Back button visible at start of tier 2 (additional voting), Back returns to results ---
  await evalJs(`document.getElementById('rank-more-btn').click()`);
  await new Promise(r => setTimeout(r, 300));
  const onVote2 = await evalJs(`document.getElementById('screen-vote').classList.contains('active')`);
  assert('Rank More enters tier 2 voting', onVote2);
  const backVisible = await evalJs(`!document.getElementById('back-btn').hidden`);
  assert('Back visible at tier 2 vote 0 (additional voting)', backVisible);

  await evalJs(`document.getElementById('back-btn').click()`);
  await new Promise(r => setTimeout(r, 300));
  const onResultsAgain = await evalJs(`document.getElementById('screen-results').classList.contains('active')`);
  assert('Back at tier 2 vote 0 returns to results', onResultsAgain);

  // --- Test 5: Keep Calibrating re-opens voting and Back returns to results ---
  // First return to results (we just navigated back to it)
  await evalJs(`document.getElementById('keep-calibrating-btn').click()`);
  await new Promise(r => setTimeout(r, 300));
  const onVote3 = await evalJs(`document.getElementById('screen-vote').classList.contains('active')`);
  assert('Keep Calibrating opens voting again', onVote3);
  const backVisible2 = await evalJs(`!document.getElementById('back-btn').hidden`);
  assert('Back visible after Keep Calibrating', backVisible2);
  await evalJs(`document.getElementById('back-btn').click()`);
  await new Promise(r => setTimeout(r, 300));
  const onResults3 = await evalJs(`document.getElementById('screen-results').classList.contains('active')`);
  assert('Back from Keep Calibrating returns to results', onResults3);

  ws.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
