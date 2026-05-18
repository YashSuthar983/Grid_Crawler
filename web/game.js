// ── Game UI & Rendering ───────────────────────────
const canvas = document.getElementById('grid-canvas');
const ctx = canvas.getContext('2d');
const graph = new GridGraph();

// ── State ─────────────────────────────────────────
const state = {
  score: 0, level: 1, health: 100,
  faults: new Set(), selected: null,
  bfsResult: null, dfsResult: null,
  animating: false, particles: [],
  bfsAnim: { active:false, step:0, levels:[], path:[] },
  dfsAnim: { active:false, step:0, steps:[], visited: new Set() },
  ganttData: null, dispatched: new Set()
};

// ── Node screen positions ─────────────────────────
let nodePos = {};
function calcPositions() {
  const ratio = window.devicePixelRatio || 1;
  const W = canvas.width / ratio, H = canvas.height / ratio;
  const padX = Math.max(42, Math.min(86, W * 0.08));
  const padY = Math.max(46, Math.min(76, H * 0.12));
  const gapX = (W - padX*2) / 9, gapY = (H - padY*2) / 5;
  graph.nodes.forEach(id => {
    const p = graph.positions[id];
    nodePos[id] = { x: padX + p.col * gapX, y: padY + p.row * gapY };
  });
}

// ── Resize ────────────────────────────────────────
function resize() {
  const wrap = document.getElementById('canvas-wrap') || document.body;
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, wrap.clientWidth);
  const height = Math.max(1, wrap.clientHeight);
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  calcPositions();
}
window.addEventListener('resize', resize);
resize();

// ── Color helpers ─────────────────────────────────
function nodeColor(id) {
  if (state.faults.has(id)) return '#ff4d6a';
  if (state.bfsAnim.active && state.bfsAnim.path.includes(id)) return '#a78bfa';
  if (state.dfsAnim.active && state.dfsAnim.visited.has(id)) return '#34d399';
  return TYPE_COLORS[NODE_CONFIG[id] || 'normal'] || '#00e5a0';
}
function nodeRadius(id) {
  const base = (NODE_CONFIG[id]==='depot') ? 14 : 10;
  if (state.selected === id) return base + 3 + Math.sin(performance.now()/150)*2;
  if (state.faults.has(id)) return base + 2 + Math.sin(performance.now()/200)*2;
  return base;
}
function nodeGlow(id) {
  if (state.faults.has(id)) return 18 + Math.sin(performance.now()/200)*5;
  if (state.selected === id) return 15 + Math.sin(performance.now()/150)*4;
  if (state.bfsAnim.active && state.bfsAnim.path.includes(id)) return 12;
  return 6;
}

// ── Drawing ───────────────────────────────────────
function drawEdge(a, b, color, width) {
  const p1 = nodePos[a], p2 = nodePos[b];
  if (!p1 || !p2) return;
  ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}

function drawNode(id) {
  const p = nodePos[id]; if (!p) return;
  const r = nodeRadius(id), col = nodeColor(id), glow = nodeGlow(id);
  // Glow
  ctx.beginPath(); ctx.arc(p.x, p.y, r+glow, 0, Math.PI*2);
  const g = ctx.createRadialGradient(p.x, p.y, r, p.x, p.y, r+glow);
  g.addColorStop(0, col+'66'); g.addColorStop(1, 'transparent');
  ctx.fillStyle = g; ctx.fill();
  // Body
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2);
  ctx.fillStyle = col+'22'; ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = state.selected === id ? 3 : 2; ctx.stroke();
  
  // Label & Inner Dot
  const t = NODE_CONFIG[id];
  if (t && t !== 'normal') {
    ctx.beginPath(); ctx.arc(p.x, p.y, r/2.5, 0, Math.PI*2);
    ctx.fillStyle = col+'88'; ctx.fill();
    ctx.fillStyle = '#ffffff';
  } else {
    ctx.fillStyle = '#f8fafc';
  }
  ctx.font = '700 9px JetBrains Mono, monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(id.replace('S0','S').replace('S',''), p.x, p.y);
  
  // Type icon
  if (t && t !== 'normal') {
    const icons = {depot:'P',hospital:'H',water:'W',emergency:'E'};
    ctx.font = '700 10px JetBrains Mono, monospace';
    ctx.fillText(icons[t]||'', p.x, p.y - r - 10);
  }
  if (state.faults.has(id)) {
    ctx.font = '700 14px JetBrains Mono, monospace';
    ctx.fillText('!', p.x + r + 6, p.y - r);
  }
}

// ── Particles (power flow) ────────────────────────
function spawnParticles() {
  if (state.particles.length > 60) return;
  const edges = [];
  const processed = new Set();
  graph.nodes.forEach(n => {
    graph.neighbors(n).forEach(nb => {
      const key = [n,nb].sort().join('-');
      if (!processed.has(key) && !state.faults.has(n) && !state.faults.has(nb)) {
        processed.add(key); edges.push([n, nb]);
      }
    });
  });
  if (!edges.length) return;
  const [a, b] = edges[Math.floor(Math.random() * edges.length)];
  state.particles.push({ a, b, t: 0, speed: 0.005 + Math.random()*0.008 });
}

function drawParticles() {
  state.particles.forEach((p, i) => {
    const p1 = nodePos[p.a], p2 = nodePos[p.b];
    if (!p1 || !p2) return;
    const x = p1.x + (p2.x - p1.x) * p.t;
    const y = p1.y + (p2.y - p1.y) * p.t;
    ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI*2);
    ctx.fillStyle = `rgba(32,199,164,${0.62 - p.t*0.42})`;
    ctx.fill();
    p.t += p.speed;
  });
  state.particles = state.particles.filter(p => p.t < 1);
}

// ── BFS Animation ─────────────────────────────────
function animBFS() {
  if (!state.bfsAnim.active) return;
  const a = state.bfsAnim;
  const speed = parseInt(document.getElementById('input-speed').value) || 5;
  if (a._timer === undefined) a._timer = 0;
  a._timer++;
  if (a._timer % Math.max(1, 12 - speed) !== 0) return;
  if (a.step < a.levels.length) {
    a.levels[a.step].forEach(n => a.visited.add(n));
    a.step++;
  } else {
    a.active = false;
    a.path = state.bfsResult ? state.bfsResult.path || [] : [];
    showHUD(false);
    if (state.bfsResult && state.bfsResult.path) {
      addLog('bfs', `BFS: ${state.bfsResult.path.join(' → ')} (${state.bfsResult.hops} hops)`);
      addScore(50, 'BFS Path Found');
    }
    updateButtons();
  }
}

// ── DFS Animation ─────────────────────────────────
function animDFS() {
  if (!state.dfsAnim.active) return;
  const a = state.dfsAnim;
  const speed = parseInt(document.getElementById('input-speed').value) || 5;
  if (a._timer === undefined) a._timer = 0;
  a._timer++;
  if (a._timer % Math.max(1, 14 - speed) !== 0) return;
  if (a.step < a.steps.length) {
    const s = a.steps[a.step];
    if (s.action === 'visit') a.visited.add(s.node);
    a.step++;
  } else {
    a.active = false;
    showHUD(false);
    if (state.dfsResult) {
      addLog('dfs', `DFS: ${state.dfsResult.order.length} nodes in zone, ${state.dfsResult.critical.length} critical`);
      addScore(30, 'Zone Mapped');
    }
    updateButtons();
  }
}

// ── Main render loop ──────────────────────────────
function render() {
  const W = canvas.width / devicePixelRatio;
  const H = canvas.height / devicePixelRatio;
  ctx.clearRect(0, 0, W, H);

  // Background grid pattern
  ctx.strokeStyle = 'rgba(255,255,255,0.015)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // Edges
  const drawn = new Set();
  graph.nodes.forEach(n => {
    graph.neighbors(n).forEach(nb => {
      const key = [n,nb].sort().join('-');
      if (drawn.has(key)) return;
      drawn.add(key);
      let col = 'rgba(255,255,255,0.07)', w = 1;
      if (state.bfsAnim.path.includes(n) && state.bfsAnim.path.includes(nb)) {
        const pi = state.bfsAnim.path.indexOf(n), pj = state.bfsAnim.path.indexOf(nb);
        if (Math.abs(pi-pj) === 1) { col = '#a78bfa88'; w = 3; }
      }
      if (state.faults.has(n) || state.faults.has(nb)) { col = 'rgba(232,93,117,0.18)'; }
      drawEdge(n, nb, col, w);
    });
  });

  // Particles
  if (Math.random() < 0.15) spawnParticles();
  drawParticles();

  // BFS wave highlight
  if (state.bfsAnim.active && state.bfsAnim.visited) {
    state.bfsAnim.visited.forEach(n => {
      const p = nodePos[n]; if (!p) return;
      ctx.beginPath(); ctx.arc(p.x, p.y, 18, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(90,169,230,0.13)'; ctx.fill();
    });
  }

  // Nodes
  graph.nodes.forEach(drawNode);

  // Animations
  animBFS();
  animDFS();

  requestAnimationFrame(render);
}

// ── UI Helpers ────────────────────────────────────
function $(id) { return document.getElementById(id); }

function showHUD(show, icon, text) {
  const hud = $('algo-hud');
  if (!show) { hud.classList.add('hidden'); return; }
  hud.classList.remove('hidden');
  $('algo-hud-icon').textContent = icon || 'B';
  $('algo-hud-text').textContent = text || '';
}

function toast(msg, type='score') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  $('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

function addScore(pts, reason) {
  state.score += pts;
  $('score-val').textContent = state.score;
  toast(`+${pts}  ${reason}`);
  addLog('score', `+${pts} — ${reason}`);
  // Level up every 200 pts
  const newLevel = Math.floor(state.score / 200) + 1;
  if (newLevel > state.level) {
    state.level = newLevel;
    $('level-val').textContent = state.level;
    toast(`Level ${state.level}!`, 'info');
  }
}

function updateHealth() {
  const total = graph.nodes.length;
  const healthy = total - state.faults.size;
  state.health = Math.round((healthy / total) * 100);
  $('health-val').textContent = state.health + '%';
  $('health-fill').style.width = state.health + '%';
  $('health-fill').style.background = state.health < 85
    ? 'linear-gradient(90deg, #e85d75, #f0a541)'
    : 'linear-gradient(90deg, #34c779, #20c7a4)';
  $('fault-count').textContent = state.faults.size;
  $('open-faults-val').textContent = state.faults.size;
  $('system-status').textContent = state.faults.size
    ? (state.dispatched.size ? 'Dispatching' : 'Fault Active')
    : 'Stable';
}

function addLog(type, msg) {
  const el = $('log-content');
  const t = new Date().toLocaleTimeString();
  el.innerHTML = `<div class="log-entry"><span class="log-time">[${t}]</span> <span class="log-${type}">${msg}</span></div>` + el.innerHTML;
}

function updateButtons() {
  const hasFault = state.faults.size > 0;
  const hasSel = state.selected && state.faults.has(state.selected);
  $('btn-bfs').disabled = !hasSel || state.animating;
  $('btn-dfs').disabled = !hasSel || state.animating;
  $('btn-dispatch').disabled = !hasFault || state.animating;
  updateSelectionChip();
}

function resetAlgorithmVisuals() {
  state.bfsAnim = { active:false, step:0, levels:[], path:[], visited: new Set() };
  state.dfsAnim = { active:false, step:0, steps:[], visited: new Set() };
  state.bfsResult = null;
  state.dfsResult = null;
}

function selectNode(id) {
  state.selected = id;
  resetAlgorithmVisuals();
  updateNodeInfo(id);
  updateButtons();
}

function updateSelectionChip() {
  const chip = $('selection-chip');
  if (!chip) return;
  if (!state.selected) {
    chip.innerHTML = '<span class="status-dot muted" aria-hidden="true"></span>No node selected';
    return;
  }
  const type = NODE_CONFIG[state.selected] || 'normal';
  const isFault = state.faults.has(state.selected);
  chip.innerHTML = `<span class="status-dot ${isFault ? 'danger' : 'ok'}" aria-hidden="true"></span>${state.selected} · ${type} · ${isFault ? 'Fault' : 'Healthy'}`;
}

function updateNodeInfo(id) {
  if (!id) {
    $('node-info-content').innerHTML = '<p class="placeholder-text">Select a node on the grid.</p>';
    return;
  }
  const t = NODE_CONFIG[id] || 'normal';
  const pri = PRIORITY_MAP[t] || 4;
  const isFault = state.faults.has(id);
  const col = TYPE_COLORS[t] || '#00e5a0';
  $('node-info-content').innerHTML = `
    <div class="info-row"><span class="info-label">Node</span><span class="info-value" style="color:${col}">${id}</span></div>
    <div class="info-row"><span class="info-label">Type</span><span class="info-value">${t}</span></div>
    <div class="info-row"><span class="info-label">Priority</span><span class="info-value">P${pri}</span></div>
    <div class="info-row"><span class="info-label">Status</span><span class="info-value" style="color:${isFault?'#e85d75':'#20c7a4'}">${isFault?'Fault':'Healthy'}</span></div>
    <div class="info-row"><span class="info-label">Neighbors</span><span class="info-value">${graph.neighbors(id).length}</span></div>`;
}

function updatePQ() {
  const faults = [...state.faults].filter(f => !state.dispatched.has(f));
  if (!faults.length) { $('pq-list').innerHTML = '<p class="placeholder-text">No faults queued</p>'; return; }
  const sorted = faults.map(f => ({
    node: f, type: NODE_CONFIG[f]||'normal', priority: PRIORITY_MAP[NODE_CONFIG[f]||'normal']||4
  })).sort((a,b) => a.priority - b.priority);
  $('pq-list').innerHTML = sorted.map(f =>
    `<div class="pq-item p${f.priority}"><span class="pq-priority">P${f.priority}</span><span class="pq-node">${f.node}</span><span class="pq-type">${f.type}</span></div>`
  ).join('');
}

// ── Canvas click ──────────────────────────────────
canvas.addEventListener('click', e => {
  if (state.animating) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  let closest = null, minD = 25;
  graph.nodes.forEach(id => {
    const p = nodePos[id]; if (!p) return;
    const d = Math.hypot(p.x - mx, p.y - my);
    if (d < minD) { minD = d; closest = id; }
  });
  selectNode(closest);
});

// ── Button handlers ───────────────────────────────
$('btn-fault').addEventListener('click', () => {
  const healthy = graph.nodes.filter(n => !state.faults.has(n) && NODE_CONFIG[n] !== 'depot');
  if (!healthy.length) return;
  const node = healthy[Math.floor(Math.random() * healthy.length)];
  state.faults.add(node);
  selectNode(node);
  updateHealth(); updatePQ(); updateButtons();
  addLog('fault', `Fault at ${node} (${NODE_CONFIG[node]||'normal'})`);
  toast(`Fault opened: ${node}`, 'danger');
});

$('btn-bfs').addEventListener('click', () => {
  if (!state.selected || state.animating) return;
  const depot = 'S01';
  state.bfsResult = bfs(graph, depot, state.selected);
  if (!state.bfsResult.path) { toast('No path found!', 'danger'); return; }
  state.bfsAnim = { active:true, step:0, levels: state.bfsResult.levels, path:[], visited: new Set(), _timer:0 };
  state.animating = true;
  showHUD(true, 'B', `Running BFS: ${depot} → ${state.selected}`);
  updateButtons();
  // Wait for anim to finish
  const check = setInterval(() => {
    if (!state.bfsAnim.active) { state.animating = false; updateButtons(); clearInterval(check); }
  }, 100);
});

$('btn-dfs').addEventListener('click', () => {
  if (!state.selected || state.animating) return;
  state.dfsResult = dfs(graph, state.selected);
  state.dfsAnim = { active:true, step:0, steps: state.dfsResult.steps, visited: new Set(), _timer:0 };
  state.animating = true;
  showHUD(true, 'D', `Running DFS from ${state.selected}`);
  updateButtons();
  const check = setInterval(() => {
    if (!state.dfsAnim.active) { state.animating = false; updateButtons(); clearInterval(check); }
  }, 100);
});

$('btn-dispatch').addEventListener('click', () => {
  const faultList = [...state.faults].filter(f => !state.dispatched.has(f));
  if (!faultList.length) return;
  const quantum = parseInt($('input-quantum').value) || 2;
  const crews = parseInt($('input-crews').value) || 3;
  const jobs = faultList
    .map((f,i) => ({ id:i+1, node:f, type: NODE_CONFIG[f]||'normal', priority: PRIORITY_MAP[NODE_CONFIG[f]||'normal']||4, repairTime: 2 + Math.floor(Math.random()*5) }))
    .sort((a,b) => a.priority - b.priority);
  const result = roundRobin(jobs, quantum, crews);
  state.ganttData = result;
  faultList.forEach(f => state.dispatched.add(f));
  updateHealth(); updatePQ(); updateButtons();

  // Render Gantt
  renderGantt(result, crews);
  addLog('sched', `Dispatched ${jobs.length} faults → ${crews} crews (Q=${quantum})`);
  addScore(jobs.length * 40, 'Crews Dispatched');

  // Animate fault removal
  setTimeout(() => {
    faultList.forEach(f => state.faults.delete(f));
    state.dispatched.clear();
    updateHealth(); updatePQ(); updateNodeInfo(state.selected); updateButtons();
    toast('All faults repaired', 'info');
  }, 1500);

  // Switch to Gantt tab
  switchTab('gantt');
});

$('btn-compare').addEventListener('click', () => {
  const depot = 'S01', target = state.selected || [...state.faults][0] || 'S07';
  addLog('bfs', `Running BFS vs Brute Force: ${depot} → ${target}`);

  const t0b = performance.now();
  const bfsR = bfs(graph, depot, target);
  const tBFS = performance.now() - t0b;

  const t0bf = performance.now();
  const bfR = bruteForce(graph, depot, target, 2000);
  const tBF = performance.now() - t0bf;

  const speedup = tBF / Math.max(tBFS, 0.001);

  $('perf-content').innerHTML = `
    <table class="perf-table">
      <tr><th>Metric</th><th>BFS</th><th>Brute Force</th></tr>
      <tr><td>Query</td><td colspan="2">${depot} → ${target}</td></tr>
      <tr><td>Shortest Path</td><td>${bfsR.path?bfsR.path.join('→'):'N/A'}</td><td>${bfR.path?bfR.path.join('→'):'N/A'}</td></tr>
      <tr><td>Hop Count</td><td>${bfsR.hops}</td><td>${bfR.hops}</td></tr>
      <tr><td>Paths Explored</td><td class="perf-fast">1 (first hit)</td><td class="perf-slow">${bfR.count.toLocaleString()}${bfR.truncated?' (timeout)':''}</td></tr>
      <tr><td>Complexity</td><td class="perf-fast">O(V+E)</td><td class="perf-slow">O(V!)</td></tr>
      <tr><td>Wall-Clock</td><td class="perf-fast">${tBFS<1?tBFS.toFixed(1)+'μs':(tBFS).toFixed(2)+'ms'}</td><td class="perf-slow">${tBF.toFixed(2)}ms</td></tr>
      <tr><td>Speedup</td><td colspan="2"><span class="perf-speedup">${speedup.toFixed(0)}× faster</span></td></tr>
    </table>`;
  switchTab('perf');
  addScore(20, 'Performance Compared');
});

$('btn-reset').addEventListener('click', () => {
  state.faults.clear(); state.dispatched.clear();
  state.selected = null; state.score = 0; state.level = 1;
  resetAlgorithmVisuals();
  state.ganttData = null; state.animating = false;
  $('score-val').textContent = '0'; $('level-val').textContent = '1';
  updateHealth(); updatePQ(); updateButtons(); updateNodeInfo(null);
  $('gantt-chart').innerHTML = '<p class="placeholder-text">Dispatch crews to see the Gantt chart</p>';
  $('perf-content').innerHTML = '<p class="placeholder-text">Run BFS vs Brute Force comparison</p>';
  $('log-content').innerHTML = '';
  showHUD(false);
  addLog('score', 'Grid reset');
});

// ── Gantt rendering ───────────────────────────────
function renderGantt(result, numCrews) {
  const scale = 30; // px per time unit
  const crewColors = ['crew1','crew2','crew3','crew4','crew5','crew6'];
  let html = '';
  for (let c = 1; c <= numCrews; c++) {
    const blocks = result.log.filter(l => l.crew === c);
    let trackHTML = '';
    let lastEnd = 0;
    blocks.forEach(b => {
      if (b.tStart > lastEnd) {
        trackHTML += `<div class="gantt-block wait" style="width:${(b.tStart-lastEnd)*scale}px">wait</div>`;
      }
      const isCrit = b.priority <= 2;
      trackHTML += `<div class="gantt-block ${crewColors[c-1]}" style="width:${(b.tEnd-b.tStart)*scale}px">${isCrit?'★':''}F${b.job}</div>`;
      lastEnd = b.tEnd;
    });
    html += `<div class="gantt-row"><span class="gantt-label">Crew ${c}</span><div class="gantt-track">${trackHTML}</div></div>`;
  }
  // Time axis
  html += `<div class="gantt-axis">`;
  for (let t = 0; t <= result.totalTime; t++) html += `<span style="min-width:${scale}px">${t}</span>`;
  html += '</div>';
  // Metrics
  const avgWait = result.metrics.reduce((s,m) => s+m.waiting, 0) / result.metrics.length;
  const avgTAT = result.metrics.reduce((s,m) => s+m.turnaround, 0) / result.metrics.length;
  html += `<div class="gantt-metrics">
    <div class="gantt-metric"><div class="gm-label">Avg Wait</div><div class="gm-value">${avgWait.toFixed(1)}</div></div>
    <div class="gantt-metric"><div class="gm-label">Avg TAT</div><div class="gm-value">${avgTAT.toFixed(1)}</div></div>
    <div class="gantt-metric"><div class="gm-label">Total Time</div><div class="gm-value">${result.totalTime}</div></div>
    <div class="gantt-metric"><div class="gm-label">Jobs</div><div class="gm-value">${result.metrics.length}</div></div>
  </div>`;
  $('gantt-chart').innerHTML = html;
}

// ── Bottom tabs ───────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.dock-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.pane').forEach(p => p.classList.toggle('active', p.id === 'pane-'+name));
}
document.querySelectorAll('.dock-tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

$('dock-toggle').addEventListener('click', () => {
  const dock = $('dock');
  const collapsed = dock.classList.toggle('collapsed');
  $('dock-toggle').textContent = collapsed ? '⌃' : '⌄';
  $('dock-toggle').setAttribute('aria-expanded', String(!collapsed));
});

// ── Start ─────────────────────────────────────────
updateHealth();
updatePQ();
updateButtons();
render();
addLog('score', '⚡ Grid Fault Manager initialized — 60 nodes, 124 edges');
