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
  depot:'#00d4ff',hospital:'#ff6b9d',water:'#4ea8ff',
  emergency:'#ffb84d',normal:'#00e5a0'
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
function bruteForce(graph, start, target, timeLimitMs = 2000) {
  const allPaths = [];
  let truncated = false;
  const deadline = performance.now() + timeLimitMs;
  function explore(node, path, visited) {
    if (performance.now() >= deadline) { truncated = true; return; }
    if (node === target) { allPaths.push([...path]); return; }
    for (const nb of graph.neighbors(node)) {
      if (!visited.has(nb) && !truncated) {
        visited.add(nb); path.push(nb);
        explore(nb, path, visited);
        path.pop(); visited.delete(nb);
      }
    }
  }
  explore(start, [start], new Set([start]));
  if (!allPaths.length) return { path:null, hops:-1, count:0, truncated };
  const shortest = allPaths.reduce((a,b) => a.length<=b.length?a:b);
  return { path:shortest, hops:shortest.length-1, count:allPaths.length, truncated };
}

// ── Round Robin Scheduler ─────────────────────────
function roundRobin(jobs, quantum, numCrews) {
  const queue = jobs.map(j => ({...j, remaining: j.repairTime, startTime:null, completionTime:null}));
  const log = [], metrics = [];
  let t = 0, idx = 0;
  const q = [...queue];
  while (q.length) {
    const job = q.shift();
    const crew = (idx % numCrews) + 1;
    if (job.startTime === null) job.startTime = t;
    const slice = Math.min(quantum, job.remaining);
    log.push({ crew, job: job.id, node: job.node, tStart: t, tEnd: t+slice, priority: job.priority });
    job.remaining -= slice;
    t += slice;
    if (job.remaining > 0) q.push(job);
    else {
      job.completionTime = t;
      metrics.push({
        id: job.id, node: job.node, priority: job.priority,
        arrival: 0, start: job.startTime, completion: t,
        waiting: job.startTime, turnaround: t
      });
    }
    idx++;
  }
  return { log, metrics, totalTime: t };
}
