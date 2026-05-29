import type { Element, Root, Text } from "hast";
import { visit } from "unist-util-visit";

const URL_RE = /https?:\/\/[^\s<>"')]+/g;

function isElement(node: unknown): node is Element {
	return Boolean(node && typeof node === "object" && "type" in node && node.type === "element");
}

function classList(node: Element): string[] {
	const className = node.properties?.className;
	if (Array.isArray(className)) return className.map(String);
	if (typeof className === "string") return className.split(/\s+/);
	return [];
}

function isCitationReference(node: Element): boolean {
	if (node.tagName === "div" && node.properties?.id === "refs") return true;
	return classList(node).some((name) => name === "references" || name === "csl-entry");
}

function linkifyTextNode(node: Text) {
	const value = node.value;
	const matches = [...value.matchAll(URL_RE)];
	if (!matches.length) return null;

	const children: Array<Text | Element> = [];
	let cursor = 0;

	for (const match of matches) {
		const url = match[0];
		const index = match.index ?? 0;

		if (index > cursor) {
			children.push({ type: "text", value: value.slice(cursor, index) });
		}

		children.push({
			type: "element",
			tagName: "a",
			properties: { href: url },
			children: [{ type: "text", value: url }],
		});

		cursor = index + url.length;
	}

	if (cursor < value.length) {
		children.push({ type: "text", value: value.slice(cursor) });
	}

	return children;
}

export function rehypeLinkCitationUrls() {
	return (tree: Root) => {
		visit(tree, "element", (node) => {
			if (!isCitationReference(node)) return;

			visit(node, "text", (textNode, index, parent) => {
				if (typeof index !== "number" || !isElement(parent) || parent.tagName === "a") {
					return;
				}

				const replacement = linkifyTextNode(textNode);
				if (!replacement) return;

				parent.children.splice(index, 1, ...replacement);
				return index + replacement.length;
			});
		});
	};
}
