"""
scheduler.py — Round Robin OS scheduler with threading.

Each fault is a job. Each repair crew is a threading.Thread.
The dispatcher enforces time quanta with locks and logs every
context switch for the Gantt output.

Key metrics tracked per crew:
  • Arrival time
  • Start time
  • Completion time
  • Waiting time   = start - arrival
  • Turnaround time = completion - arrival
"""

import threading
import time

from priority_queue import PRIORITY_LABELS


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
        self.arrival_time = 0.0
        self.start_time = None
        self.completion_time = None

    @property
    def is_critical(self):
        return self.priority <= 2

    def __repr__(self):
        marker = "★" if self.is_critical else " "
        return f"{marker}F{self.job_id}({self.fault_node})"


class RoundRobinScheduler:
    """Round Robin dispatcher with configurable time quantum."""

    def __init__(self, quantum=2, num_crews=3):
        self.quantum = quantum
        self.num_crews = num_crews
        self.jobs = []
        self.gantt_log = []       # [(crew_id, job_repr, t_start, t_end)]
        self.metrics = []         # per-job metrics dicts
        self._lock = threading.Lock()
        self._current_time = 0

    def add_jobs(self, jobs):
        """Add a list of RepairJob instances."""
        for j in jobs:
            j.arrival_time = 0  # all arrive at time 0 in this demo
            self.jobs.append(j)

    def run(self):
        """Execute Round Robin scheduling (simulated with threads)."""
        queue = list(self.jobs)
        crew_idx = 0
        self._current_time = 0

        print("\n╔══════════════════════════════════════════════════╗")
        print("║      OS SCHEDULER — ROUND ROBIN DISPATCH        ║")
        print("╚══════════════════════════════════════════════════╝")
        print(f"  Crews: {self.num_crews}  |  Quantum: {self.quantum}"
              f"  |  Jobs: {len(queue)}")
        print()

        while queue:
            job = queue.pop(0)
            crew_id = (crew_idx % self.num_crews) + 1

            if job.start_time is None:
                job.start_time = self._current_time

            slice_time = min(self.quantum, job.remaining)
            t_start = self._current_time
            t_end = t_start + slice_time

            # Simulate crew thread doing work
            t = threading.Thread(
                target=self._crew_work,
                args=(crew_id, job, slice_time),
                name=f"Crew-{crew_id}",
            )
            t.start()
            t.join()   # sequential for deterministic Gantt

            self.gantt_log.append((crew_id, repr(job), t_start, t_end))

            job.remaining -= slice_time
            self._current_time = t_end

            if job.remaining > 0:
                queue.append(job)   # re-enqueue (preempted)
            else:
                job.completion_time = t_end
                wait = job.start_time - job.arrival_time
                turn = job.completion_time - job.arrival_time
                self.metrics.append({
                    "job": repr(job),
                    "fault_node": job.fault_node,
                    "priority": job.priority,
                    "arrival": job.arrival_time,
                    "start": job.start_time,
                    "completion": job.completion_time,
                    "waiting": wait,
                    "turnaround": turn,
                })

            crew_idx += 1

        self._print_gantt()
        self._print_metrics()

    def _crew_work(self, crew_id, job, duration):
        """Simulate repair work (runs inside a thread)."""
        with self._lock:
            marker = "★" if job.is_critical else " "
            print(f"  [{marker}] Crew {crew_id} → {job.fault_node}  "
                  f"[t={self._current_time}–"
                  f"{self._current_time + duration}]  "
                  f"(remaining after: {job.remaining - duration})")

    def _print_gantt(self):
        """Print ASCII Gantt chart."""
        print("\n  ┌─── GANTT CHART ──────────────────────────────┐")

        # Build per-crew timeline
        crew_rows = {}
        max_time = 0
        for crew_id, job_repr, t_s, t_e in self.gantt_log:
            crew_rows.setdefault(crew_id, []).append((job_repr, t_s, t_e))
            max_time = max(max_time, t_e)

        scale = 3   # chars per time unit
        for crew_id in sorted(crew_rows):
            bar = [" "] * (max_time * scale)
            for job_repr, t_s, t_e in crew_rows[crew_id]:
                char = "█" if "★" in job_repr else "▓"
                for i in range(t_s * scale, t_e * scale):
                    if i < len(bar):
                        bar[i] = char
            label = f"  Crew {crew_id}"
            print(f"  {label:<10s}│{''.join(bar)}│")

        # Time axis
        axis = "".join(f"{t:<{scale}d}" for t in range(max_time + 1))
        print(f"  {'':10s}└{'─' * (max_time * scale)}┘")
        print(f"  {'':10s} {axis}")

        # Legend
        print(f"\n  █ = critical/priority fault   ▓ = normal fault")
        print(f"  ★ = hospital / emergency node")
        print("  └─────────────────────────────────────────────┘")

    def _print_metrics(self):
        """Print per-job scheduling metrics table."""
        print("\n  ┌─── SCHEDULING METRICS ────────────────────────────────────┐")
        hdr = (f"  {'Job':<16s}{'Node':<8s}{'Pri':>4s}"
               f"{'Arrival':>9s}{'Start':>8s}{'Done':>8s}"
               f"{'Wait':>8s}{'TAT':>8s}")
        print(hdr)
        print("  " + "─" * 60)

        total_wait = 0
        total_tat = 0
        for m in self.metrics:
            pri_str = f"P{m['priority']}"
            print(f"  {m['job']:<16s}{m['fault_node']:<8s}{pri_str:>4s}"
                  f"{m['arrival']:>9.0f}{m['start']:>8.0f}"
                  f"{m['completion']:>8.0f}"
                  f"{m['waiting']:>8.0f}{m['turnaround']:>8.0f}")
            total_wait += m["waiting"]
            total_tat += m["turnaround"]

        n = len(self.metrics) or 1
        print("  " + "─" * 60)
        print(f"  {'AVERAGE':<28s}{'':>4s}{'':>9s}{'':>8s}"
              f"{total_wait / n:>8.1f}{total_tat / n:>8.1f}")
        print("  └─────────────────────────────────────────────────────────┘\n")
