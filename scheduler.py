"""
scheduler.py — Round Robin OS scheduler with real multithreading.

Model
-----
  • Each fault is a job with a repair-time burst.
  • Each repair crew is a parallel server. With C crews, up to C jobs
    are serviced *simultaneously* — no crew blocks another.
  • Round Robin: every job gets at most one time-quantum slice before
    going to the back of the ready queue (preemption / context switch).
  • Within each scheduling round the dispatched crews run as genuine
    ``threading.Thread`` workers that execute concurrently (joined at
    the end of the round so the simulated timeline stays consistent).

Per-job metrics
  • Arrival time
  • Start (first dispatch) time      → response time = start − arrival
  • Completion time
  • Turnaround time = completion − arrival
  • Waiting time    = turnaround − burst   (the correct RR formula)

Per-crew metrics
  • Busy time, idle time, utilisation %
"""

import threading
from collections import deque


class RepairJob:
    """A single fault-repair job for the scheduler."""

    def __init__(self, job_id, fault_node, repair_time, priority=4,
                 node_type="normal"):
        self.job_id = job_id
        self.fault_node = fault_node
        self.total_time = repair_time     # total repair units needed
        self.remaining = repair_time      # remaining units
        self.priority = priority
        self.node_type = node_type
        self.arrival_time = 0
        self.start_time = None
        self.completion_time = None

    @property
    def is_critical(self):
        return self.priority <= 2

    def __repr__(self):
        marker = "★" if self.is_critical else " "
        return f"{marker}F{self.job_id}({self.fault_node})"


class RoundRobinScheduler:
    """Round Robin dispatcher across C parallel crews."""

    def __init__(self, quantum=2, num_crews=3):
        self.quantum = quantum
        self.num_crews = num_crews
        self.jobs = []
        self.crew_gantt = {}      # crew_id -> [(repr, node, t_s, t_e, crit)]
        self.crew_busy = {}       # crew_id -> total busy units
        self.metrics = []         # per-job metrics dicts
        self._print_lock = threading.Lock()

    def add_jobs(self, jobs):
        """Add a list of RepairJob instances (all arrive at t=0)."""
        for j in jobs:
            j.arrival_time = 0
            self.jobs.append(j)

    # ── core simulation ───────────────────────────────────────────────

    def run(self):
        """Execute Round Robin scheduling across parallel crews."""
        print("\n╔═══════════════════════════════════════════════════╗")
        print("║       OS SCHEDULER — ROUND ROBIN DISPATCH         ║")
        print("╚═══════════════════════════════════════════════════╝")
        print(f"  Crews: {self.num_crews}  |  Quantum: {self.quantum}"
              f"  |  Jobs: {len(self.jobs)}")
        print("  (up to {0} crews work in parallel each round)\n"
              .format(self.num_crews))

        ready = deque(self.jobs)
        crews = {cid: {"free_at": 0, "job": None}
                 for cid in range(1, self.num_crews + 1)}
        self.crew_gantt = {cid: [] for cid in crews}
        self.crew_busy = {cid: 0 for cid in crews}

        t = 0
        completed = 0
        total = len(self.jobs)
        round_no = 0

        while completed < total:
            # 1. Release crews whose slice has finished at time t.
            for cid in sorted(crews):
                c = crews[cid]
                if c["job"] is not None and c["free_at"] <= t:
                    job = c["job"]
                    if job.remaining > 0:
                        ready.append(job)          # preempted → back of RR
                    else:
                        job.completion_time = t
                        completed += 1
                    c["job"] = None

            # 2. Assign idle crews to waiting jobs (RR order).
            dispatched = []
            for cid in sorted(crews):
                c = crews[cid]
                if c["job"] is None and ready:
                    job = ready.popleft()
                    if job.start_time is None:
                        job.start_time = t
                    sl = min(self.quantum, job.remaining)
                    job.remaining -= sl
                    c["job"] = job
                    c["free_at"] = t + sl
                    self.crew_gantt[cid].append(
                        (repr(job), job.fault_node, t, t + sl,
                         job.is_critical))
                    self.crew_busy[cid] += sl
                    dispatched.append((cid, job, sl, t))

            # 3. Run this round's crews as real concurrent threads.
            if dispatched:
                round_no += 1
                with self._print_lock:
                    print(f"  ── Round {round_no}  (t = {t}) "
                          f"──────────────────────────────")
                threads = []
                for cid, job, sl, ts in dispatched:
                    th = threading.Thread(
                        target=self._crew_work,
                        args=(cid, job, sl, ts),
                        name=f"Crew-{cid}",
                    )
                    threads.append(th)
                    th.start()
                for th in threads:
                    th.join()

            # 4. Advance simulated time to the next crew release.
            busy = [c["free_at"] for c in crews.values()
                    if c["job"] is not None]
            if busy:
                t = min(busy)
            elif ready:
                continue                           # crews freed, keep going
            else:
                break

        self._build_metrics()
        self._print_gantt(t)
        self._print_metrics(t)

    def _crew_work(self, crew_id, job, duration, t_start):
        """Simulate repair work (runs inside its own thread)."""
        with self._print_lock:
            marker = "★" if job.is_critical else " "
            done = "→ DONE" if job.remaining == 0 else \
                   f"(remaining {job.remaining})"
            print(f"   [{marker}] Crew {crew_id} repairing {job.fault_node}"
                  f"  t={t_start}→{t_start + duration}  {done}")

    # ── reporting ─────────────────────────────────────────────────────

    def _build_metrics(self):
        for job in sorted(self.jobs, key=lambda j: j.job_id):
            turn = job.completion_time - job.arrival_time
            wait = turn - job.total_time
            self.metrics.append({
                "job": repr(job),
                "fault_node": job.fault_node,
                "priority": job.priority,
                "arrival": job.arrival_time,
                "start": job.start_time,
                "completion": job.completion_time,
                "turnaround": turn,
                "waiting": wait,
            })

    def _print_gantt(self, end_time):
        """Print an ASCII Gantt chart (one row per crew)."""
        print("\n  ┌─── GANTT CHART (parallel crews) ─────────────────┐")
        scale = 3
        max_time = end_time
        for cid in sorted(self.crew_gantt):
            bar = [" "] * (max_time * scale)
            for _, _, t_s, t_e, crit in self.crew_gantt[cid]:
                char = "█" if crit else "▓"
                for i in range(t_s * scale, t_e * scale):
                    if i < len(bar):
                        bar[i] = char
            print(f"  Crew {cid:<5d}│{''.join(bar)}│")

        axis = "".join(f"{x:<{scale}d}" for x in range(max_time + 1))
        print(f"  {'':10s}└{'─' * (max_time * scale)}┘")
        print(f"  {'':10s} {axis}")
        print("\n  █ = critical/priority fault   ▓ = normal fault")
        print("  Overlapping bars across rows = crews working in parallel")
        print("  └──────────────────────────────────────────────────┘")

    def _print_metrics(self, end_time):
        """Print per-job and per-crew metrics tables."""
        print("\n  ┌─── PER-FAULT SCHEDULING METRICS ──────────────────────────┐")
        print(f"  {'Job':<14s}{'Node':<7s}{'Pri':>4s}"
              f"{'Arr':>5s}{'Start':>7s}{'Done':>6s}"
              f"{'TAT':>6s}{'Wait':>6s}")
        print("  " + "─" * 58)

        tot_wait = tot_tat = 0
        for m in self.metrics:
            pri = f"P{m['priority']}"
            print(f"  {m['job']:<14s}{m['fault_node']:<7s}{pri:>4s}"
                  f"{m['arrival']:>5d}{m['start']:>7d}"
                  f"{m['completion']:>6d}"
                  f"{m['turnaround']:>6d}{m['waiting']:>6d}")
            tot_wait += m["waiting"]
            tot_tat += m["turnaround"]

        n = len(self.metrics) or 1
        print("  " + "─" * 58)
        print(f"  {'AVERAGE':<25s}{'':>5s}{'':>7s}{'':>6s}"
              f"{tot_tat / n:>6.1f}{tot_wait / n:>6.1f}")
        print("  Wait = Turnaround − Burst  (standard Round Robin formula)")
        print("  └───────────────────────────────────────────────────────────┘")

        print("\n  ┌─── PER-CREW UTILISATION ──────────────────────────┐")
        for cid in sorted(self.crew_busy):
            busy = self.crew_busy[cid]
            idle = end_time - busy
            util = (busy / end_time * 100) if end_time else 0.0
            print(f"  Crew {cid}:  busy {busy:>3d}u   idle {idle:>3d}u"
                  f"   utilisation {util:5.1f}%")
        print("  └───────────────────────────────────────────────────┘\n")
