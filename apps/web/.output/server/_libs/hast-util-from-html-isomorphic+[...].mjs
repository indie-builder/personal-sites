import { visit } from "./@openuidev/react-ui+[...].mjs";
import { fromHtml } from "./hast-util-from-html+[...].mjs";
//#region ../../node_modules/.bun/unist-util-remove-position@5.0.0/node_modules/unist-util-remove-position/lib/index.js
/**
* @typedef {import('unist').Node} Node
*/
/**
* @typedef Options
*   Configuration.
* @property {boolean | null | undefined} [force=false]
*   Whether to use `delete` to remove `position` fields.
*
*   The default is to set them to `undefined`.
*/
/**
* Remove the `position` field from a tree.
*
* @param {Node} tree
*   Tree to clean.
* @param {Options | null | undefined} [options={force: false}]
*   Configuration (default: `{force: false}`).
* @returns {undefined}
*   Nothing.
*/
function removePosition(tree, options) {
	const force = (options || {}).force || false;
	visit(tree, remove);
	/**
	* @param {Node} node
	*/
	function remove(node) {
		if (force) delete node.position;
		else node.position = void 0;
	}
}
//#endregion
//#region ../../node_modules/.bun/hast-util-from-html-isomorphic@2.0.0/node_modules/hast-util-from-html-isomorphic/lib/index.js
/**
* @typedef {import('hast').Root} Root
*
* @typedef {Pick<import('hast-util-from-html').Options, 'fragment'>} Options
*/
/**
* Turn HTML into a syntax tree, using browser APIs when available, so it has
* a smaller bundle size there.
*
* @param {string} value
*   Serialized HTML to parse.
* @param {Options | null | undefined} [options]
*   Configuration (optional).
* @returns {Root}
*   Tree.
*/
function fromHtmlIsomorphic(value, options) {
	const tree = fromHtml(value, options);
	removePosition(tree, { force: true });
	delete tree.data;
	return tree;
}
//#endregion
export { fromHtmlIsomorphic };
