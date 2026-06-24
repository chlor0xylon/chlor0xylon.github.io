import { visit } from "unist-util-visit";

type MdxAttribute = {
	type: "mdxJsxAttribute";
	name: string;
	value?: string | null;
};

type MdxElement = {
	type: string;
	name?: string;
	attributes?: MdxAttribute[];
	children?: Array<MdxElement | { type: string; value?: string }>;
};

function isMdxElement(node: unknown): node is MdxElement {
	return Boolean(
		node &&
		typeof node === "object" &&
		"type" in node &&
		typeof node.type === "string" &&
		node.type.startsWith("mdxJsx") &&
		"name" in node,
	);
}

function getAttribute(node: MdxElement, name: string) {
	return node.attributes?.find((attribute) => attribute.name === name)?.value;
}

function setAttribute(node: MdxElement, name: string, value: string) {
	const existing = node.attributes?.find((attribute) => attribute.name === name);
	if (existing) {
		existing.value = value;
		return;
	}

	node.attributes ??= [];
	node.attributes.push({ type: "mdxJsxAttribute", name, value });
}

function classList(node: MdxElement) {
	const className = getAttribute(node, "class") ?? getAttribute(node, "className");
	return typeof className === "string" ? className.split(/\s+/) : [];
}

function hasClass(node: MdxElement, className: string) {
	return classList(node).includes(className);
}

function findChildElement(node: MdxElement, predicate: (child: MdxElement) => boolean) {
	return node.children?.find(
		(child): child is MdxElement => isMdxElement(child) && predicate(child),
	);
}

function setChildrenText(node: MdxElement, value: string) {
	node.children = [{ type: "text", value }];
}

function normalizeTextAfterCaptionLabel(caption: MdxElement, labelNode: MdxElement) {
	const labelIndex = caption.children?.indexOf(labelNode) ?? -1;
	if (labelIndex === -1 || !caption.children) return;

	for (let index = labelIndex + 1; index < caption.children.length; index += 1) {
		const child = caption.children[index];
		if (isMdxElement(child)) return;
		if (child.type !== "text" || typeof child.value !== "string") continue;

		child.value = ` ${child.value.trimStart()}`;
		return;
	}
}

function ensureCaptionLabel(figure: MdxElement, label: string) {
	const caption = findChildElement(figure, (child) => child.name === "figcaption");
	if (!caption) return;

	const existingLabel = findChildElement(caption, (child) => hasClass(child, "label"));
	if (existingLabel) {
		setChildrenText(existingLabel, `${label}.`);
		normalizeTextAfterCaptionLabel(caption, existingLabel);
		return;
	}

	caption.children ??= [];
	caption.children.unshift(
		{
			type: "mdxJsxTextElement",
			name: "span",
			attributes: [{ type: "mdxJsxAttribute", name: "class", value: "label" }],
			children: [{ type: "text", value: `${label}.` }],
		},
		{ type: "text", value: " " },
	);
}

export function remarkFigureReferences() {
	return (tree: MdxElement) => {
		const figureNumbers = new Map<string, string>();
		let figureCount = 0;

		visit(tree, (node) => {
			if (!isMdxElement(node) || node.name !== "figure") return;

			const id = getAttribute(node, "id");
			if (typeof id !== "string") return;

			figureCount += 1;
			const label = `Figure ${figureCount}`;
			figureNumbers.set(id, label);
			ensureCaptionLabel(node, label);
		});

		visit(tree, (node) => {
			if (!isMdxElement(node) || node.name !== "a") return;

			const ref = getAttribute(node, "data-figure-ref");
			if (typeof ref !== "string") return;

			const label = figureNumbers.get(ref);
			if (!label) return;

			setAttribute(node, "href", `#${ref}`);
			setChildrenText(node, label);
		});
	};
}
