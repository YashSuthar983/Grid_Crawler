"""
bfs.py — BFS shortest-path engine.

Finds the minimum-hop path from a depot node to a fault node.
BFS is the correct choice because the grid is an unweighted graph:
  • BFS explores level by level and is guaranteed to find the shortest
    path (minimum hops) first.
  • DFS would NOT guarantee shortest path on an unweighted graph.

Data structure : collections.deque (FIFO queue)
Time complexity: O(V + E)
"""

from collections import deque

from graph import Graph


def bfs_shortest_path(
    graph: Graph, start: str, target: str
) -> tuple[list[str] | None, int]:
    """
    Return (path, hop_count) from *start* to *target* using BFS.

    Parameters
    ----------
    graph  : Graph object
    start  : depot / source node ID
    target : fault node ID

    Returns
    -------
    (path, hops) where *path* is a list of node IDs from start→target
                 and *hops* is len(path) - 1.
    If no path exists, returns (None, -1).
    """
    if start == target:
        return [start], 0

    visited = {start}
    parent = {start: None}
    queue = deque([start])

    while queue:
        node = queue.popleft()
        for nb in graph.neighbors(node):
            if nb in visited:
                continue
            visited.add(nb)
            parent[nb] = node
            if nb == target:
                # Reconstruct path
                path = []
                cur = target
                while cur is not None:
                    path.append(cur)
                    cur = parent[cur]
                path.reverse()
                return path, len(path) - 1
            queue.append(nb)

    return None, -1


def bfs_nearest_depot(
    graph: Graph, depots: list[str], target: str
) -> tuple[str | None, list[str] | None, int]:
    """
    Multi-source BFS: find the *nearest* depot to *target*.

    All depot nodes are seeded into the BFS frontier at level 0
    simultaneously. The first depot whose wavefront reaches *target*
    is therefore the closest one (minimum hops), still in O(V + E).

    Returns
    -------
    (depot_used, path, hops) where *path* runs depot → target.
    If no depot can reach the target, returns (None, None, -1).
    """
    depots = [d for d in depots if graph.has_node(d)]
    if not depots:
        return None, None, -1
    if target in depots:
        return target, [target], 0

    visited = set(depots)
    parent: dict[str, str | None] = {d: None for d in depots}
    origin: dict[str, str] = {d: d for d in depots}
    queue = deque(depots)

    while queue:
        node = queue.popleft()
        for nb in graph.neighbors(node):
            if nb in visited:
                continue
            visited.add(nb)
            parent[nb] = node
            origin[nb] = origin[node]
            if nb == target:
                path = []
                cur: str | None = target
                while cur is not None:
                    path.append(cur)
                    cur = parent[cur]
                path.reverse()
                return origin[target], path, len(path) - 1
            queue.append(nb)

    return None, None, -1


def bfs_print_result(
    graph: Graph,
    depots: str | list[str],
    fault_node: str,
) -> tuple[list[str] | None, int]:
    """
    Run BFS from the nearest depot and pretty-print the result.

    *depots* may be a single depot ID or a list of depot IDs; when a
    list is given, multi-source BFS picks the closest one.
    Returns (path, hops).
    """
    depot_list = [depots] if isinstance(depots, str) else list(depots)
    depot_used, path, hops = bfs_nearest_depot(graph, depot_list, fault_node)

    print("\n╔═══════════════════════════════════════════════════╗")
    print("║            BFS — SHORTEST PATH RESULT             ║")
    print("╚═══════════════════════════════════════════════════╝")
    print(f"  Fault node    : {fault_node}")
    print(f"  Depot options : {', '.join(depot_list)}")

    if path is None:
        print("  ⚠  No path exists between any depot and fault node.")
    else:
        print(f"  Nearest depot : {depot_used}")
        print(f"  Path          : {' → '.join(path)}")
        print(f"  Hop count     : {hops}")

    print()
    return path, hops
