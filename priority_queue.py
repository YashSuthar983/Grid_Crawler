"""
priority_queue.py — Heap-based priority dispatch for faults.

Faults at critical nodes (hospitals, water plants) get higher priority
and jump the scheduling queue via a min-heap.

Priority levels:
  1 — Hospital (highest)
  2 — Water / emergency
  3 — Depot / hub
  4 — Normal substation (lowest)

Tuple format: (priority, arrival_time, fault_dict)
Ties broken by arrival time (FCFS within same priority).
"""

import heapq

PRIORITY_MAP = {
    "hospital": 1,
    "water": 2,
    "emergency": 2,
    "depot": 3,
    "hub": 3,
    "normal": 4,
}

PRIORITY_LABELS = {
    1: "★ CRITICAL — hospital",
    2: "★ HIGH — water/emergency",
    3: "  MEDIUM — depot/hub",
    4: "  NORMAL — substation",
}


class FaultPriorityQueue:
    """Min-heap priority queue for fault events."""

    def __init__(self):
        self._heap = []
        self._counter = 0.0

    def push(self, fault, node_config=None):
        """Push a fault dict onto the priority queue."""
        if node_config is None:
            node_config = {}
        ntype = node_config.get(fault["node"], "normal")
        priority = PRIORITY_MAP.get(ntype, 4)
        fault["priority"] = priority
        fault["type"] = ntype
        self._counter += 1
        heapq.heappush(self._heap, (priority, self._counter, fault))

    def pop(self):
        """Pop the highest-priority fault."""
        _, _, fault = heapq.heappop(self._heap)
        return fault

    def is_empty(self):
        return len(self._heap) == 0

    def __len__(self):
        return len(self._heap)

    def drain(self):
        """Pop all faults in priority order."""
        result = []
        while not self.is_empty():
            result.append(self.pop())
        return result

    def print_queue(self):
        """Pretty-print the current queue (non-destructive)."""
        print("\n┌──────────────────────────────────────────────┐")
        print("│         PRIORITY QUEUE — current state       │")
        print("├──────────────────────────────────────────────┤")
        if not self._heap:
            print("│  (empty)                                     │")
        for pri, arr, fault in sorted(self._heap):
            label = PRIORITY_LABELS.get(pri, f"  PRIORITY {pri}")
            print(f"│  P{pri}  {fault['node']:<8s} {label:<28s} │")
        print("└──────────────────────────────────────────────┘\n")
