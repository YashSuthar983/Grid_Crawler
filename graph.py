"""
graph.py — Graph model (adjacency list) and file loader.

Represents the power grid as an undirected, unweighted graph.
Each node is a substation ID (string), each edge is a transmission link.
"""

from collections import defaultdict


class Graph:
    """Undirected graph backed by an adjacency list (defaultdict of sets)."""

    def __init__(self):
        self._adj = defaultdict(set)

    # ── mutators ──────────────────────────────────────────────────────

    def add_edge(self, u: str, v: str) -> None:
        """Add an undirected edge between *u* and *v*."""
        self._adj[u].add(v)
        self._adj[v].add(u)

    def remove_node(self, node: str) -> None:
        """Remove *node* and all its incident edges."""
        neighbors = list(self._adj.pop(node, set()))
        for nb in neighbors:
            self._adj[nb].discard(node)

    # ── queries ───────────────────────────────────────────────────────

    def neighbors(self, node: str) -> list[str]:
        """Return sorted list of neighbours of *node*."""
        return sorted(self._adj[node])

    @property
    def nodes(self) -> list[str]:
        """All nodes in the graph, sorted."""
        return sorted(self._adj.keys())

    @property
    def edge_count(self) -> int:
        """Number of undirected edges."""
        return sum(len(nb) for nb in self._adj.values()) // 2

    def has_node(self, node: str) -> bool:
        return node in self._adj

    def __contains__(self, node: str) -> bool:
        return self.has_node(node)

    def __len__(self) -> int:
        return len(self._adj)

    def __repr__(self) -> str:
        return f"Graph(nodes={len(self)}, edges={self.edge_count})"

    # ── loader ────────────────────────────────────────────────────────

    @classmethod
    def from_file(cls, path: str) -> "Graph":
        """
        Load a graph from an adjacency file.

        Format (per line):
            node_a  node_b  [weight]   # weight is ignored (unweighted)
        Lines starting with '#' are comments.
        """
        g = cls()
        with open(path) as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split()
                if len(parts) >= 2:
                    g.add_edge(parts[0], parts[1])
        return g
