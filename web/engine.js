// ── Graph data & algorithm engine ─────────────────
const NODE_CONFIG = {
  S01:"depot",S05:"normal",S07:"hospital",S10:"normal",S12:"water",
  S15:"normal",S18:"normal",S20:"normal",S22:"hospital",S25:"normal",
  S28:"emergency",S30:"normal",S33:"normal",S35:"depot",S37:"normal",
  S40:"hospital",S42:"normal",S44:"water",S46:"normal",S48:"normal",
  S50:"normal",S52:"normal",S55:"hospital",S58:"normal",S60:"emergency"
};
const PRIORITY_MAP = {hospital:1,water:2,emergency:2,depot:3,hub:3,normal:4};
const TYPE_COLORS = {
  depot:'#20d5ea',hospital:'#ff6b9d',water:'#5aa9e6',
  emergency:'#f0a541',normal:'#20c7a4'
};
const EDGES_RAW = `S01-S02,S01-S11,S02-S03,S02-S12,S03-S04,S03-S13,S04-S05,S04-S14,S05-S06,S05-S15,
S06-S07,S06-S16,S07-S08,S07-S17,S08-S09,S08-S18,S09-S10,S09-S19,S10-S20,S11-S12,
S11-S21,S12-S13,S12-S22,S13-S14,S13-S23,S14-S15,S14-S24,S15-S16,S15-S25,S16-S17,
S16-S26,S17-S18,S17-S27,S18-S19,S18-S28,S19-S20,S19-S29,S20-S30,S21-S22,S21-S31,
S22-S23,S22-S32,S23-S24,S23-S33,S24-S25,S24-S34,S25-S26,S25-S35,S26-S27,S26-S36,
S27-S28,S27-S37,S28-S29,S28-S38,S29-S30,S29-S39,S30-S40,S31-S32,S31-S41,S32-S33,
S32-S42,S33-S34,S33-S43,S34-S35,S34-S44,S35-S36,S35-S45,S36-S37,S36-S46,S37-S38,
S37-S47,S38-S39,S38-S48,S39-S40,S39-S49,S40-S50,S41-S42,S41-S51,S42-S43,S42-S52,
S43-S44,S43-S53,S44-S45,S44-S54,S45-S46,S45-S55,S46-S47,S46-S56,S47-S48,S47-S57,
S48-S49,S48-S58,S49-S50,S49-S59,S50-S60,S51-S52,S52-S53,S53-S54,S54-S55,S55-S56,
S56-S57,S57-S58,S58-S59,S59-S60,S01-S12,S03-S14,S05-S16,S07-S18,S11-S22,S13-S24,
S15-S26,S17-S28,S21-S32,S23-S34,S25-S36,S27-S38,S31-S42,S33-S44,S35-S46,S37-S48,
S41-S52,S43-S54,S45-S56,S47-S58`;

class GridGraph {
  constructor() {
    this.adj = {};
    this.nodes = [];
    this.positions = {};
    this._build();
  }
  _build() {
    for (let i = 1; i <= 60; i++) {
      const id = 'S' + String(i).padStart(2,'0');
      this.nodes.push(id);
      this.adj[id] = new Set();
      const row = Math.floor((i-1)/10), col = (i-1)%10;
      this.positions[id] = { row, col };
    }
    EDGES_RAW.replace(/\s/g,'').split(',').forEach(e => {
      const [a,b] = e.split('-');
      if (a && b && this.adj[a] && this.adj[b]) {
        this.adj[a].add(b); this.adj[b].add(a);
      }
    });
  }
  neighbors(n) { return [...(this.adj[n]||[])].sort(); }
}

// ── BFS ───────────────────────────────────────────
function bfs(graph, start, target) {
  if (start === target) return { path:[start], hops:0, levels:[[start]] };
  const visited = new Set([start]), parent = { [start]: null };
  let queue = [start];
  const levels = [[start]];
  while (queue.length) {
    const next = [];
    for (const node of queue) {
      for (const nb of graph.neighbors(node)) {
        if (visited.has(nb)) continue;
        visited.add(nb); parent[nb] = node;
        next.push(nb);
        if (nb === target) {
          levels.push(next);
          const path = [];
          let c = target;
          while (c !== null) { path.unshift(c); c = parent[c]; }
          return { path, hops: path.length-1, levels };
        }
      }
    }
    if (next.length) levels.push(next);
    queue = next;
  }
  return { path: null, hops: -1, levels };
}

// ── Multi-source BFS: nearest depot ───────────────
// Seeds every depot at level 0 so the first wavefront to reach the
// target identifies the genuinely closest depot. Still O(V+E).
function nearestDepot(graph, depots, target) {
  depots = depots.filter(d => graph.adj[d]);
  if (!depots.length) return { depot:null, path:null, hops:-1, levels:[] };
  if (depots.includes(target))
    return { depot:target, path:[target], hops:0, levels:[[target]] };

  const visited = new Set(depots);
  const parent = {}, origin = {};
  depots.forEach(d => { parent[d] = null; origin[d] = d; });
  let queue = [...depots];
  const levels = [[...depots]];

  while (queue.length) {
    const next = [];
    for (const node of queue) {
      for (const nb of graph.neighbors(node)) {
        if (visited.has(nb)) continue;
        visited.add(nb);
        parent[nb] = node;
        origin[nb] = origin[node];
        next.push(nb);
        if (nb === target) {
          levels.push(next);
          const path = [];
          let c = target;
          while (c !== null) { path.unshift(c); c = parent[c]; }
          return { depot: origin[target], path,
                   hops: path.length - 1, levels };
        }
      }
    }
    if (next.length) levels.push(next);
    queue = next;
  }
  return { depot:null, path:null, hops:-1, levels };
}

// All depot node IDs from the config (falls back to S01).
function depotList() {
  const ds = Object.keys(NODE_CONFIG)
    .filter(n => NODE_CONFIG[n] === 'depot').sort();
  return ds.length ? ds : ['S01'];
}

// ── DFS ───────────────────────────────────────────
function dfs(graph, start) {
  const visited = new Set(), order = [], critical = [];
  const steps = []; // for animation
  function explore(n) {
    visited.add(n); order.push(n);
    steps.push({ node: n, action: 'visit' });
    const t = NODE_CONFIG[n] || 'normal';
    if (['hospital','water','emergency'].includes(t)) critical.push(n);
    for (const nb of graph.neighbors(n)) {
      if (!visited.has(nb)) explore(nb);
    }
    steps.push({ node: n, action: 'backtrack' });
  }
  explore(start);
  return { order, critical, steps };
}

// ── Brute Force ───────────────────────────────────
// Depth-bounded exhaustive search: enumerate every simple path up to
// maxDepth hops, then pick the shortest. The bound guarantees it
// terminates while still exploring exponentially many paths, so the
// cost gap vs BFS is real (O(b^d) vs O(V+E)).
function bruteForce(graph, start, target, maxDepth = 8, timeLimitMs = 4000) {
  const allPaths = [];
  let truncated = false, expanded = 0;
  const deadline = performance.now() + timeLimitMs;
  function explore(node, path, visited) {
    if (truncated) return;
    if (performance.now() >= deadline) { truncated = true; return; }
    if (node === target) { allPaths.push([...path]); return; }
    if (path.length - 1 >= maxDepth) return;        // depth bound (hops)
    for (const nb of graph.neighbors(node)) {
      if (visited.has(nb)) continue;
      expanded++;
      visited.add(nb); path.push(nb);
      explore(nb, path, visited);
      path.pop(); visited.delete(nb);
    }
  }
  explore(start, [start], new Set([start]));
  if (!allPaths.length)
    return { path:null, hops:-1, count:0, expanded, maxDepth, truncated };
  const shortest = allPaths.reduce((a,b) => a.length<=b.length?a:b);
  return { path:shortest, hops:shortest.length-1,
           count:allPaths.length, expanded, maxDepth, truncated };
}

// ── Round Robin Scheduler (parallel multi-crew) ───
// C crews are C parallel servers: up to C faults are repaired
// simultaneously each quantum, none blocking another. Waiting time
// uses the standard RR formula: wait = turnaround − burst.
function roundRobin(jobs, quantum, numCrews) {
  const work = jobs.map(j => ({
    ...j, total: j.repairTime, remaining: j.repairTime,
    startTime: null, completionTime: null,
  }));
  const ready = [...work];                       // priority-ordered queue
  const crews = {};
  for (let c = 1; c <= numCrews; c++)
    crews[c] = { freeAt: 0, job: null };
  const crewBusy = {};
  for (let c = 1; c <= numCrews; c++) crewBusy[c] = 0;

  const log = [];
  let t = 0, completed = 0;
  const total = work.length;

  while (completed < total) {
    // 1. Release crews whose slice finished at t.
    for (let c = 1; c <= numCrews; c++) {
      const cr = crews[c];
      if (cr.job && cr.freeAt <= t) {
        if (cr.job.remaining > 0) ready.push(cr.job);   // preempted
        else { cr.job.completionTime = t; completed++; }
        cr.job = null;
      }
    }
    // 2. Assign idle crews to waiting jobs (RR order).
    for (let c = 1; c <= numCrews; c++) {
      const cr = crews[c];
      if (!cr.job && ready.length) {
        const job = ready.shift();
        if (job.startTime === null) job.startTime = t;
        const slice = Math.min(quantum, job.remaining);
        job.remaining -= slice;
        cr.job = job;
        cr.freeAt = t + slice;
        crewBusy[c] += slice;
        log.push({ crew:c, job:job.id, node:job.node,
                   tStart:t, tEnd:t+slice, priority:job.priority });
      }
    }
    // 3. Advance to the next crew release.
    const busy = Object.values(crews)
      .filter(cr => cr.job).map(cr => cr.freeAt);
    if (busy.length) t = Math.min(...busy);
    else if (ready.length) continue;
    else break;
  }

  const metrics = work
    .sort((a,b) => a.id - b.id)
    .map(j => {
      const turnaround = j.completionTime - 0;
      return {
        id:j.id, node:j.node, priority:j.priority,
        arrival:0, start:j.startTime, completion:j.completionTime,
        turnaround, waiting: turnaround - j.total,
      };
    });
  const crewUtil = {};
  for (let c = 1; c <= numCrews; c++)
    crewUtil[c] = { busy: crewBusy[c], idle: t - crewBusy[c] };

  return { log, metrics, crewUtil, totalTime: t };
}
