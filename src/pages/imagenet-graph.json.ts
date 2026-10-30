import type { APIRoute } from "astro";
import raw from "@/assets/figures/imagenet_hierarchy.json";

// The Graphviz layout is a top-down tree about 68:1 wide. It is turned into a left-to-right one
// (root on the left, leaves stacked vertically so labels read horizontally), and the rank axis is
// stretched (less than needed for a square) so the result is taller than wide.
const RANK_STRETCH = 30;

interface RawNode {
	_gvid: number;
	label: string;
	pos: string;
	fillcolor?: string;
	is_class?: string;
}

interface RawEdge {
	tail: number;
	head: number;
}

// Emitted at build time as a static JSON file: nodes as [id, label, x, y, color, isClass] and
// edges as [sourceId, targetId], where ids are Graphviz's `_gvid`.
export const GET: APIRoute = () => {
	const rootY = Math.max(...(raw.objects as RawNode[]).map((n) => Number(n.pos.split(",")[1])));
	const nodes = (raw.objects as RawNode[]).map((n) => {
		const [x, y] = n.pos.split(",").map(Number);
		// Graphviz's y grows upward and the root has the largest y, so y maps to depth directly.
		const depth = (rootY - y) * RANK_STRETCH;
		return [n._gvid, n.label, depth, x, n.fillcolor ?? "#999999", n.is_class === "True"];
	});
	const edges = (raw.edges as RawEdge[]).map((e) => [e.tail, e.head]);
	return new Response(JSON.stringify({ nodes, edges }), {
		headers: { "Content-Type": "application/json" },
	});
};
