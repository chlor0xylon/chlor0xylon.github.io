import { type Properties, h as _h } from "hastscript";
import type { Code, Root, RootContent } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

type LineKind = "caption" | "command" | "comment" | "blank";
type MathBlockKind = "inline" | "display";

type Line = {
	depth: number;
	kind: LineKind;
	text: string;
};

type HastBackedNode = RootContent & {
	children: RootContent[];
	data: {
		hName: string;
		hProperties: Properties;
	};
	type: "algorithm";
};

type MathBlock = {
	depth: number;
	kind: MathBlockKind;
	text: string;
};

function h(el: string, attrs: Properties = {}, children: RootContent[] = []): RootContent {
	const { properties, tagName } = _h(el, attrs);
	return {
		children,
		data: { hName: tagName, hProperties: properties },
		type: "algorithm",
	} as HastBackedNode;
}

function normalize(line: string) {
	return line.replace(/\t/g, "  ");
}

function parseLines(source: string): Line[] {
	const out: Line[] = [];
	let captionUsed = false;
	for (const raw of source.split(/\r?\n/)) {
		if (!raw.trim()) continue;
		const depth = Math.floor((raw.match(/^\s*/)?.[0].length ?? 0) / 2);
		const trimmed = raw.trim();
		const kind =
			!captionUsed && /^(algorithm\b|procedure\b|function\b)/i.test(trimmed)
				? ((captionUsed = true), "caption")
				: trimmed.startsWith("//")
					? "comment"
					: "command";
		out.push({ depth, kind, text: trimmed });
	}
	return out;
}

function parseCaption(text: string) {
	const match = text.match(/^(algorithm|alg\.?|procedure|function)\s*(?:(\d+)\s*)?[:.-]?\s*(.+)?$/i);
	if (!match) return "";
	const name = match[1].toLowerCase();
	const number = match[2]?.trim();
	const title = match[3]?.trim() ?? "";
	const displayName = name.startsWith("alg") ? "Algorithm" : name[0].toUpperCase() + name.slice(1);
	const prefix = number ? `${displayName} ${number}` : displayName;
	return title ? `${prefix}: ${title}` : prefix;
}

function parseMathBlock(source: string): Array<Line | MathBlock> {
	const lines = source.replace(/\t/g, "  ").split(/\r?\n/);
	const out: Array<Line | MathBlock> = [];
	let captionUsed = false;
	let inDisplayMath = false;
	let displayDepth = 0;
	let displayLines: string[] = [];

	const flushDisplay = () => {
		out.push({ depth: displayDepth, kind: "display", text: displayLines.join("\n") });
		displayLines = [];
		inDisplayMath = false;
	};

	for (const raw of lines) {
		if (inDisplayMath) {
			if (raw.trim() === "$$") {
				flushDisplay();
				continue;
			}
			displayLines.push(raw);
			continue;
		}

		if (!raw.trim()) continue;
		const depth = Math.floor((raw.match(/^\s*/)?.[0].length ?? 0) / 2);
		const trimmed = raw.trim();
		if (trimmed === "$$") {
			inDisplayMath = true;
			displayDepth = depth;
			continue;
		}

		const kind =
			!captionUsed && /^(algorithm\b|procedure\b|function\b)/i.test(trimmed)
				? ((captionUsed = true), "caption")
				: trimmed.startsWith("//")
					? "comment"
					: "command";
		out.push({ depth, kind, text: trimmed });
	}

	return out;
}

function commandLabel(text: string) {
	const head = text.split(/\s+/)[0] ?? "";
	const lower = head.toLowerCase();
	if (lower === "require" || lower === "input" || lower === "ensure" || lower === "output") return "Require";
	if (lower === "state" || lower === "statex" || lower === "call") return "State";
	if (lower === "for") return "For";
	if (lower === "while") return "While";
	if (lower === "if") return "If";
	if (lower === "else") return "Else";
	if (lower === "repeat") return "Repeat";
	if (lower === "until") return "Until";
	if (lower === "return") return "Return";
	if (lower === "procedure") return "Procedure";
	if (lower === "function") return "Function";
	if (lower.startsWith("end")) return "End";
	return "";
}

function splitTextWithMath(text: string): RootContent[] {
	const nodes: RootContent[] = [];
	const re = /\$([^$\n]+)\$/g;
	let last = 0;
	for (let match = re.exec(text); match; match = re.exec(text)) {
		if (match.index > last) {
			nodes.push({ type: "text", value: text.slice(last, match.index) } as RootContent);
		}
		nodes.push(
			h(
				"code",
				{ class: "language-math math-inline" },
				[{ type: "text", value: match[1] } as RootContent],
			),
		);
		last = match.index + match[0].length;
	}
	if (last < text.length) nodes.push({ type: "text", value: text.slice(last) } as RootContent);
	return nodes;
}

function renderMathBlock(text: string, depth: number): RootContent {
	return h(
		"div",
		{ class: "algorithm-math", style: `--algorithm-depth:${depth};` },
		[
			h("code", { class: "language-math math-display" }, [
				{ type: "text", value: text } as RootContent,
			]),
		],
	);
}

function renderLine(line: Line): RootContent {
	if (line.kind === "blank") return h("div", { class: "algorithm-blank" });
	if (line.kind === "comment") {
		return h("div", { class: "algorithm-line algorithm-line-comment", style: `--algorithm-depth:${line.depth};` }, [
			h("span", { class: "algorithm-keyword" }, [{ type: "text", value: "//" } as RootContent]),
			{ type: "text", value: ` ${line.text.slice(2).trim()}` } as RootContent,
		]);
	}

	const label = commandLabel(line.text);
	const body = label ? line.text.slice(label.length).trim() : line.text;
	const children: RootContent[] = [];

	if (label) {
		children.push(h("span", { class: "algorithm-keyword" }, [{ type: "text", value: label } as RootContent]));
		if (body) children.push(...splitTextWithMath(` ${body}`));
	} else {
		children.push(...splitTextWithMath(line.text));
	}

	return h("div", { class: `algorithm-line algorithm-line-${line.kind}`, style: `--algorithm-depth:${line.depth};` }, children);
}

export const remarkAlgorithm: Plugin<[], Root> = () => (tree) => {
	visit(tree, "code", (node: Code, index, parent) => {
		if (!parent || index === undefined) return;
		const lang = node.lang?.toLowerCase();
		if (lang !== "algorithm" && lang !== "algo") return;

		const lines = parseMathBlock(normalize(node.value));
		if (!lines.length) return;

		let caption = "";
		const body: Array<Line | MathBlock> = [];
		for (const line of lines) {
			if (!caption && line.kind === "caption") {
				caption = parseCaption(line.text) || line.text;
				continue;
			}
			body.push(line);
		}

		const children: RootContent[] = [];
		if (caption) {
			children.push(h("figcaption", { class: "algorithm-caption" }, [{ type: "text", value: caption } as RootContent]));
		}
		children.push(
			h(
				"div",
				{ class: "algorithm-body" },
				body.map((line) =>
					line.kind === "display" ? renderMathBlock(line.text, line.depth) : renderLine(line as Line),
				),
			),
		);

		parent.children[index] = h("figure", { class: "algorithm-box" }, children);
	});
};
