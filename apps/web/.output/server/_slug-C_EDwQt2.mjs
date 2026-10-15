import { __toESM } from "./_runtime.mjs";
import { runPromise } from "./_libs/effect.mjs";
import { io } from "./_ssr/open-source-DgxG6IN-.mjs";
import { require_react } from "./_libs/@floating-ui/react-dom+[...].mjs";
import { require_jsx_runtime } from "./_libs/@openuidev/react-headless+[...].mjs";
import { ArrowUpRight, ChevronDown, ChevronRight, ExternalLink, FileCodeCorner, Folder, FolderOpen, LoaderCircle } from "./_libs/lucide-react.mjs";
import { AnimatePresence, useReducedMotion } from "./_libs/framer-motion+[...].mjs";
import { motion } from "./_libs/motion.mjs";
import { Markdown, defaultUrlTransform, remarkGfm } from "./_libs/@openuidev/react-ui+[...].mjs";
import { DetailPage, DetailTopbar, Route$6, buildGitHubRepositoryTree, open_source_module_default, subscribeToNothing, useHasMounted } from "./_ssr/router-DuGGPPwl.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_slug-C_EDwQt2.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var MotionLoaderCircle = motion.create(LoaderCircle);
function RepositoryLoadingIcon() {
	const mounted = useHasMounted();
	const reduceMotion = useReducedMotion();
	const spinning = mounted && !reduceMotion;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MotionLoaderCircle, {
		animate: { rotate: spinning ? [0, 360] : 0 },
		"aria-hidden": "true",
		initial: false,
		transition: spinning ? {
			duration: .9,
			ease: "linear",
			repeat: Infinity
		} : { duration: 0 }
	});
}
function formatFileSize(size) {
	if (size === void 0) return "";
	if (size < 1024) return `${size} B`;
	if (size < 1048576) return `${Math.round(size / 1024)} KB`;
	return `${(size / 1048576).toFixed(1)} MB`;
}
function fetchRepositoryJson(operation, url, fallbackError) {
	return io(operation, async (signal) => {
		const response = await fetch(url, { signal });
		const result = await response.json();
		if (!response.ok) throw new Error(result.error ?? fallbackError);
		return result;
	});
}
function RepositoryTreeRows({ depth = 0, expanded, nodes, onOpenFile, onToggleDirectory, selectedPath }) {
	const reduceMotion = useReducedMotion();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: open_source_module_default.repositoryTree,
		children: nodes.map((node) => {
			const isDirectory = node.type === "tree";
			const isExpanded = expanded.has(node.path);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				"aria-current": !isDirectory && selectedPath === node.path ? "true" : void 0,
				"aria-expanded": isDirectory ? isExpanded : void 0,
				className: open_source_module_default.repositoryTreeItem,
				onClick: () => isDirectory ? onToggleDirectory(node.path) : onOpenFile(node),
				style: { paddingLeft: `${.7 + depth * .8}rem` },
				type: "button",
				children: [
					isDirectory ? isExpanded ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { "aria-hidden": "true" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { "aria-hidden": "true" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileCodeCorner, { "aria-hidden": "true" }),
					isDirectory ? isExpanded ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, { "aria-hidden": "true" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Folder, { "aria-hidden": "true" }) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: node.name }),
					!isDirectory && node.size !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: formatFileSize(node.size) }) : null
				]
			}), isDirectory ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnimatePresence, {
				initial: false,
				children: isExpanded ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.div, {
					animate: {
						height: "auto",
						opacity: 1
					},
					exit: {
						height: 0,
						opacity: 0
					},
					initial: {
						height: 0,
						opacity: 0
					},
					style: { overflow: "hidden" },
					transition: {
						duration: reduceMotion ? 0 : .24,
						ease: [
							.16,
							1,
							.3,
							1
						]
					},
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepositoryTreeRows, {
						depth: depth + 1,
						expanded,
						nodes: node.children,
						onOpenFile,
						onToggleDirectory,
						selectedPath
					})
				}, "children") : null
			}) : null] }, node.path);
		})
	});
}
function OpenSourceRepositoryBrowser({ active, repository, repositoryUrl, slug }) {
	const [tree, setTree] = (0, import_react.useState)(null);
	const [treeError, setTreeError] = (0, import_react.useState)(null);
	const [expanded, setExpanded] = (0, import_react.useState)(() => /* @__PURE__ */ new Set());
	const [selectedPath, setSelectedPath] = (0, import_react.useState)(null);
	const [file, setFile] = (0, import_react.useState)(null);
	const [fileError, setFileError] = (0, import_react.useState)(null);
	const [loadingFile, setLoadingFile] = (0, import_react.useState)(false);
	const [entrance, setEntrance] = (0, import_react.useState)({
		armed: false,
		visible: active
	});
	if (entrance.visible !== active) setEntrance(active ? {
		armed: entrance.armed,
		visible: true
	} : {
		armed: false,
		visible: false
	});
	const requestVersion = (0, import_react.useRef)(0);
	const armEntranceIfVisible = () => {
		setEntrance((current) => current.visible ? {
			...current,
			armed: true
		} : current);
	};
	(0, import_react.useEffect)(() => {
		const controller = new AbortController();
		runPromise(fetchRepositoryJson("repository.tree", `/api/open-source/${encodeURIComponent(slug)}/repository/tree`, "暂时无法读取原始仓库结构。"), { signal: controller.signal }).then((result) => {
			setTree(result);
			armEntranceIfVisible();
		}).catch((error) => {
			if (controller.signal.aborted) return;
			setTreeError(error instanceof Error ? error.message : "暂时无法读取原始仓库结构。");
			armEntranceIfVisible();
		});
		return () => controller.abort();
	}, [slug]);
	const toggleDirectory = (path) => {
		setExpanded((current) => {
			const next = new Set(current);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			return next;
		});
	};
	const openFile = async (node) => {
		const currentVersion = requestVersion.current + 1;
		requestVersion.current = currentVersion;
		setSelectedPath(node.path);
		setFile(null);
		setFileError(null);
		setLoadingFile(true);
		try {
			const result = await runPromise(fetchRepositoryJson("repository.file", `/api/open-source/${encodeURIComponent(slug)}/repository/file?path=${encodeURIComponent(node.path)}`, "暂时无法读取原始文件。"));
			if (requestVersion.current === currentVersion) {
				setFile(result);
				armEntranceIfVisible();
			}
		} catch (error) {
			if (requestVersion.current === currentVersion) {
				setFileError(error instanceof Error ? error.message : "暂时无法读取原始文件。");
				armEntranceIfVisible();
			}
		} finally {
			if (requestVersion.current === currentVersion) setLoadingFile(false);
		}
	};
	const nodes = (0, import_react.useMemo)(() => tree ? buildGitHubRepositoryTree(tree.entries) : [], [tree]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: open_source_module_default.repositoryBrowser,
		"data-entrance": entrance.armed ? "" : void 0,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: open_source_module_default.repositoryBrowserToolbar,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: repository }), tree ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [" · ", tree.branch] }) : null] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
					href: repositoryUrl,
					rel: "noreferrer",
					target: "_blank",
					children: ["在 GitHub 打开", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { "aria-hidden": "true" })]
				})]
			}),
			tree?.truncated ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: open_source_module_default.repositoryBrowserNotice,
				children: "仓库文件较多，当前仅展示前 6,000 项；可在 GitHub 查看完整结构。"
			}) : null,
			treeError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: open_source_module_default.repositoryBrowserError,
				role: "alert",
				children: treeError
			}) : null,
			!tree && !treeError ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: open_source_module_default.repositoryBrowserLoading,
				role: "status",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepositoryLoadingIcon, {}), " 正在读取原始仓库结构…"]
			}) : null,
			tree ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: open_source_module_default.repositoryBrowserContent,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("aside", {
					"aria-label": "原始仓库文件树",
					className: open_source_module_default.repositoryTreePane,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepositoryTreeRows, {
						expanded,
						nodes,
						onOpenFile: openFile,
						onToggleDirectory: toggleDirectory,
						selectedPath
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					"aria-label": "原始文件内容",
					className: open_source_module_default.repositoryFilePane,
					children: [
						loadingFile ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: open_source_module_default.repositoryBrowserLoading,
							role: "status",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RepositoryLoadingIcon, {}),
								" 正在读取 ",
								selectedPath,
								"…"
							]
						}) : null,
						!loadingFile && fileError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: open_source_module_default.repositoryBrowserError,
							role: "alert",
							children: fileError
						}) : null,
						!loadingFile && !fileError && !file ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: open_source_module_default.repositoryFileEmpty,
							children: "从左侧文件树选择一个文本文件查看原始内容。"
						}) : null,
						!loadingFile && file ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: open_source_module_default.repositoryFileHeader,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: file.path }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								href: file.fileUrl,
								rel: "noreferrer",
								target: "_blank",
								children: "在 GitHub 查看"
							})]
						}), file.binary ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: open_source_module_default.repositoryFileEmpty,
							children: "这是二进制文件，不能直接预览；可前往 GitHub 查看。"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
							className: open_source_module_default.repositoryFileContent,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: file.content })
						})] }) : null
					]
				})]
			}) : null
		]
	});
}
function OpenSourceDocumentView({ parsedHint, parsedPanel, repository, repositoryUrl, slug }) {
	const deepLinkedRepository = (0, import_react.useSyncExternalStore)(subscribeToNothing, () => new URLSearchParams(window.location.search).get("view") === "repository", () => false);
	const [selection, setSelection] = (0, import_react.useState)(null);
	const [repositoryOpened, setRepositoryOpened] = (0, import_react.useState)(false);
	const [instantEntrance, setInstantEntrance] = (0, import_react.useState)(false);
	const isRepository = (selection ?? (deepLinkedRepository ? "repository" : "parsed")) === "repository";
	const showRepository = repositoryOpened || isRepository;
	const selectView = (nextView, instant) => {
		setInstantEntrance(instant);
		setSelection(nextView);
		if (nextView === "repository") setRepositoryOpened(true);
		window.history.replaceState(null, "", nextView === "repository" ? `/open-source/${slug}?view=repository` : `/open-source/${slug}`);
	};
	const moveTab = (event, currentView) => {
		let nextView = null;
		if (event.key === "ArrowRight") nextView = currentView === "parsed" ? "repository" : "parsed";
		if (event.key === "ArrowLeft") nextView = currentView === "parsed" ? "repository" : "parsed";
		if (event.key === "Home") nextView = "parsed";
		if (event.key === "End") nextView = "repository";
		if (!nextView) return;
		event.preventDefault();
		selectView(nextView, true);
		document.getElementById(`${nextView}-document-tab`)?.focus();
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"aria-labelledby": "open-source-document-title",
		className: `curation-detail__section ${open_source_module_default.documentSection}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: open_source_module_default.documentHeader,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "curation-detail__eyebrow",
					id: "open-source-document-title",
					children: "仓库文档"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					"aria-label": "切换仓库文档版本",
					className: open_source_module_default.documentTabs,
					role: "tablist",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						"aria-controls": "parsed-document-panel",
						"aria-selected": !isRepository,
						className: open_source_module_default.documentTab,
						id: "parsed-document-tab",
						onKeyDown: (event) => moveTab(event, "parsed"),
						onClick: (event) => selectView("parsed", event.detail === 0),
						role: "tab",
						tabIndex: isRepository ? -1 : 0,
						type: "button",
						children: "中文阅读版"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						"aria-controls": "repository-document-panel",
						"aria-selected": isRepository,
						className: open_source_module_default.documentTab,
						id: "repository-document-tab",
						onKeyDown: (event) => moveTab(event, "repository"),
						onClick: (event) => selectView("repository", event.detail === 0),
						role: "tab",
						tabIndex: isRepository ? 0 : -1,
						type: "button",
						children: "仓库结构"
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: open_source_module_default.documentHint,
				children: isRepository ? "文件树与内容按需从原始 GitHub 仓库读取；仅已公开的收藏仓库可访问。" : parsedHint
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				"aria-labelledby": "parsed-document-tab",
				className: `article-markdown ${open_source_module_default.documentPanel}`,
				"data-instant": instantEntrance ? "" : void 0,
				hidden: isRepository,
				id: "parsed-document-panel",
				role: "tabpanel",
				children: parsedPanel
			}),
			showRepository ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				"aria-labelledby": "repository-document-tab",
				className: open_source_module_default.documentPanel,
				"data-instant": instantEntrance ? "" : void 0,
				hidden: !isRepository,
				id: "repository-document-panel",
				role: "tabpanel",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OpenSourceRepositoryBrowser, {
					active: isRepository,
					repository,
					repositoryUrl,
					slug
				})
			}) : null
		]
	});
}
var EXTERNAL_URL = /^(?:[a-z][a-z\d+.-]*:|\/\/)/iu;
function getGitHubReadmeLocation(sourceUrl, sourcePath) {
	const source = new URL(sourceUrl);
	if (source.hostname !== "github.com") return null;
	const pathSegments = source.pathname.split("/").filter(Boolean);
	const blobIndex = pathSegments.indexOf("blob");
	const owner = pathSegments[0];
	const repository = pathSegments[1];
	const branch = pathSegments[blobIndex + 1];
	if (!owner || !repository || blobIndex < 2 || !branch) return null;
	return {
		branch,
		directory: sourcePath.split("/").slice(0, -1).filter(Boolean),
		owner,
		repository,
		source
	};
}
/**
* GitHub README 中的相对链接原本以仓库文件为基准；在个人站内渲染时，
* 它们不能再相对当前页面解析，否则会跳到本站的无效路由。
*/
function resolveGitHubReadmeUrl(url, sourceUrl, sourcePath = "README.md") {
	if (!url || url.startsWith("#") || EXTERNAL_URL.test(url)) return url;
	try {
		if (url.startsWith("?") || url.startsWith("/")) return new URL(url, sourceUrl).toString();
		const location = getGitHubReadmeLocation(sourceUrl, sourcePath);
		if (!location) return url;
		const repositoryDocumentRoot = `${location.owner}/${location.repository}/blob/${location.branch}`;
		const directory = location.directory.join("/");
		const base = `${location.source.origin}/${repositoryDocumentRoot}/${directory ? `${directory}/` : ""}`;
		return new URL(url, base).toString();
	} catch {
		return url;
	}
}
/**
* Images embedded by a README must point to the raw asset rather than a
* GitHub `blob` page. The latter is HTML, so browsers wait for a request that
* cannot render as an image.
*/
function resolveGitHubReadmeAssetUrl(url, sourceUrl, sourcePath = "README.md") {
	if (!url || EXTERNAL_URL.test(url)) return url;
	try {
		const location = getGitHubReadmeLocation(sourceUrl, sourcePath);
		if (!location || url.startsWith("?") || url.startsWith("/")) return new URL(url, sourceUrl).toString();
		const directory = location.directory.length > 0 ? `${location.directory.join("/")}/` : "";
		const base = `https://raw.githubusercontent.com/${location.owner}/${location.repository}/${location.branch}/${directory}`;
		return new URL(url, base).toString();
	} catch {
		return url;
	}
}
/**
* Stable heading ids shared by indexed README citations and the rendered
* public Markdown. They intentionally favour readable Chinese/Latin slugs.
*/
function createMarkdownHeadingId(value, used = /* @__PURE__ */ new Map()) {
	const base = String(value ?? "").normalize("NFKD").toLowerCase().replace(/<[^>]*>/g, "").replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-") || "section";
	const count = used.get(base) ?? 0;
	used.set(base, count + 1);
	return count === 0 ? base : `${base}-${count + 1}`;
}
function markdownNodeText(node) {
	if (typeof node?.value === "string") return node.value;
	return node?.children?.map(markdownNodeText).join("") ?? "";
}
function createHeadingComponents() {
	const headingIds = /* @__PURE__ */ new Map();
	const heading = (tagName) => {
		const MarkdownHeading = ({ node, ...props }) => (0, import_react.createElement)(tagName, {
			...props,
			id: createMarkdownHeadingId(markdownNodeText(node), headingIds)
		});
		MarkdownHeading.displayName = `Markdown${tagName.toUpperCase()}`;
		return MarkdownHeading;
	};
	return {
		h1: heading("h1"),
		h2: heading("h2"),
		h3: heading("h3"),
		h4: heading("h4"),
		h5: heading("h5"),
		h6: heading("h6")
	};
}
function OpenSourceDocumentTabs({ parsedMarkdown, readingSource, readingSourcePath, repository, repositoryUrl, slug, sourceUrl }) {
	const headingComponents = createHeadingComponents();
	const parsedHint = readingSource === "official-zh-readme" ? `内容直接采用仓库维护的中文 README${readingSourcePath ? `（${readingSourcePath}）` : ""}，未经过模型翻译。` : "中文阅读版只翻译说明性文字；术语、代码、命令、链接与原有 Markdown 结构保持不变。";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OpenSourceDocumentView, {
		parsedHint,
		parsedPanel: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Markdown, {
			components: {
				...headingComponents,
				a: ({ children, href }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
					href: resolveGitHubReadmeUrl(href ?? "", sourceUrl, readingSourcePath ?? "README.md"),
					children
				}),
				img: ({ alt, src }) => {
					if (typeof src !== "string") return null;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						alt: alt ?? "",
						loading: "lazy",
						src: resolveGitHubReadmeAssetUrl(src, sourceUrl, readingSourcePath ?? "README.md")
					});
				}
			},
			remarkPlugins: [remarkGfm],
			skipHtml: true,
			urlTransform: defaultUrlTransform,
			children: parsedMarkdown
		}),
		repository,
		repositoryUrl,
		slug
	});
}
function OpenSourceEntryPage() {
	const { entry } = Route$6.useLoaderData();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DetailPage, {
		mainClassName: "curation-home curation-detail curation-open-source-detail",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
			className: "curation-detail__article curation-open-source__article",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DetailTopbar, {
					backHref: "/open-source",
					backLabel: "返回开源关注"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
					className: "curation-detail__header",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: entry.repository })
				}),
				entry.personalNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					"aria-label": "判读",
					className: "curation-detail__section curation-detail__note",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "curation-detail__eyebrow",
						children: "判读"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: entry.personalNote })]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OpenSourceDocumentTabs, {
					parsedMarkdown: entry.parsedMarkdown ?? "",
					readingSource: entry.readingSource ?? "model-translation",
					readingSourcePath: entry.readingSourcePath ?? null,
					repository: entry.repository,
					repositoryUrl: entry.repositoryUrl,
					slug: entry.slug,
					sourceUrl: entry.evidence.url
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
					"aria-label": "来源",
					className: "curation-detail__section curation-detail__source",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						className: "curation-detail__cta",
						href: entry.repositoryUrl,
						rel: "noreferrer",
						target: "_blank",
						children: ["在 GitHub 查看仓库", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpRight, { "aria-hidden": "true" })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "curation-detail__cta-host",
						children: new URL(entry.repositoryUrl).host
					})]
				})
			]
		})
	});
}
//#endregion
export { OpenSourceEntryPage as component };
