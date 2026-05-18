"""
brute_force.py — Depth-bounded brute-force path finder & BFS comparison.

Brute force here = exhaustive recursive enumeration of every simple path
from a depot to the fault, up to a depth bound, then pick the shortest.

Why a depth bound?
  A 60-node mesh has an astronomically large number of simple paths
  (super-exponential), so a *truly* unbounded enumeration never finishes.
  We bound the search depth to ``optimal_hops + slack``: this still
  explores exponentially many paths (so the cost blow-up vs BFS is real
  and visible) while being guaranteed to terminate and to contain the
  true shortest path.

    Brute-force complexity : O(b^d)   (b = branching factor, d = depth)
    BFS complexity         : O(V + E) (level-order, guaranteed shortest)

Measurement: time.perf_counter()
"""

import time

from graph import Graph
from bfs import bfs_shortest_path, bfs_nearest_depot

# Hard safety caps so the demo always stays responsive even on
# pathological graphs. The depth bound below is the primary limiter.
DEPTH_SLACK = 3          # explore paths up to optimal_hops + this
MAX_PATHS = 2_000_000    # abort if the path count explodes
TIME_LIMIT = 5.0         # seconds — final hard stop


def brute_force_all_paths(
    graph: Graph, start: str, target: str, max_depth: int
) -> tuple[list[list[str]], int, bool]:
    """
    Enumerate simple paths *start* → *target* with length ≤ ``max_depth``.

    Returns (paths_list, nodes_expanded, was_truncated).
    """
    all_paths: list[list[str]] = []
    expanded = 0
    truncated = False
    deadline = time.perf_counter() + TIME_LIMIT

    def _explore(node: str, path: list[str], visited: set[str]) -> None:
        nonlocal expanded, truncated
        if truncated:
            return
        if len(all_paths) >= MAX_PATHS or time.perf_counter() >= deadline:
            truncated = True
            return
        if node == target:
            all_paths.append(list(path))
            return
        if len(path) - 1 >= max_depth:        # depth bound (in hops)
            return
        for nb in graph.neighbors(node):
            if nb in visited:
                continue
            expanded += 1
            visited.add(nb)
            path.append(nb)
            _explore(nb, path, visited)
            path.pop()
            visited.discard(nb)

    _explore(start, [start], {start})
    return all_paths, expanded, truncated


def brute_force_shortest(
    graph: Graph, start: str, target: str, max_depth: int
) -> tuple[list[str] | None, int, int, int, bool]:
    """
    Find the shortest path by brute force (enumerate all, pick min).

    Returns
    -------
    (shortest_path, hop_count, paths_found, nodes_expanded, was_truncated)
    """
    paths, expanded, truncated = brute_force_all_paths(
        graph, start, target, max_depth
    )
    if not paths:
        return None, -1, 0, expanded, truncated
    shortest = min(paths, key=len)
    return shortest, len(shortest) - 1, len(paths), expanded, truncated


def compare_bfs_vs_brute(
    graph: Graph, depots: str | list[str], fault_node: str
) -> None:
    """
    Run BFS and depth-bounded brute force on the same depot→fault query
    and print a side-by-side comparison with timings.
    """
    depot_list = [depots] if isinstance(depots, str) else list(depots)

    # ── BFS timing (multi-source: nearest depot) ───────────────────
    t0 = time.perf_counter()
    depot_used, bfs_path, bfs_hops = bfs_nearest_depot(
        graph, depot_list, fault_node
    )
    t_bfs = time.perf_counter() - t0

    if depot_used is None:
        print("\n  ⚠  Bonus skipped: no depot can reach the fault node.\n")
        return

    # Depth bound for brute force: optimal + slack (guaranteed to
    # contain the true shortest path, still exponential to explore).
    max_depth = max(bfs_hops, 1) + DEPTH_SLACK

    # ── Brute-force timing (same depot, same target) ───────────────
    t0 = time.perf_counter()
    bf_path, bf_hops, bf_found, bf_expanded, bf_truncated = (
        brute_force_shortest(graph, depot_used, fault_node, max_depth)
    )
    t_bf = time.perf_counter() - t0

    # ── Pretty print ───────────────────────────────────────────────
    line = "═" * 62
    print(f"\n╔{line}╗")
    print("║        BONUS — BFS vs BRUTE FORCE COMPARISON                 ║")
    print(f"╠{line}╣")
    print(f"║  Query: {depot_used} → {fault_node} "
          f"(grid: {len(graph)} nodes, {graph.edge_count} edges)"
          .ljust(63) + "║")
    print(f"╠{line}╣")

    print(f"  {'Metric':<26s}{'BFS':>16s}{'Brute Force':>18s}")
    print("  " + "─" * 58)

    bfs_path_str = " → ".join(bfs_path) if bfs_path else "N/A"
    bf_path_str = " → ".join(bf_path) if bf_path else "N/A"

    print(f"  {'Hop count':<26s}{bfs_hops:>16d}{bf_hops:>18d}")
    print(f"  {'Nodes / paths explored':<26s}"
          f"{'V+E = ' + str(len(graph) + graph.edge_count):>16s}"
          f"{f'{bf_found:,} paths':>18s}")
    print(f"  {'Search expansions':<26s}{'1 sweep':>16s}"
          f"{f'{bf_expanded:,}':>18s}")
    print(f"  {'Depth bound':<26s}{'—':>16s}"
          f"{f'{max_depth} hops':>18s}")
    print(f"  {'Time complexity':<26s}{'O(V+E)':>16s}{'O(b^d)':>18s}")

    def _fmt_time(t: float) -> str:
        if t < 1e-3:
            return f"{t * 1e6:.1f} us"
        if t < 1.0:
            return f"{t * 1e3:.2f} ms"
        return f"{t:.3f} s"

    print(f"  {'Wall-clock time':<26s}"
          f"{_fmt_time(t_bfs):>16s}{_fmt_time(t_bf):>18s}")

    if t_bfs > 0:
        speedup = t_bf / max(t_bfs, 1e-9)
        print(f"  {'BFS speedup':<26s}{f'{speedup:,.0f}x faster':>16s}"
              f"{'—':>18s}")

    print("  " + "─" * 58)
    same = (bfs_hops == bf_hops)
    verdict = ("✓ Both find the same optimal hop count — but BFS does it "
               "in one\n    linear sweep while brute force pays an "
               "exponential cost.")
    if not same:
        verdict = ("Brute force was depth-limited; BFS hop count is the "
                   "authoritative optimum.")
    if bf_truncated:
        verdict += "\n    (brute force hit a safety cap; cost is a lower "
        verdict += "bound.)"
    print(f"  {verdict}")
    print(f"╚{line}╝")
    print()


# Kept for backward compatibility with any external callers / tests.
def _legacy_brute_force_shortest(graph, start, target):
    return brute_force_shortest(graph, start, target, max_depth=10)[:4]
