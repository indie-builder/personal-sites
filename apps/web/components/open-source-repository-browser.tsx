"use client";

import { Effect } from "effect";
import { io } from "@site/effect";

import { ChevronDown, ChevronRight, ExternalLink, FileCode2, Folder, FolderOpen, LoaderCircle } from "lucide-react";
import { useHasMounted } from "@/components/use-mounted";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import styles from "@/components/open-source.module.css";
import {
  buildGitHubRepositoryTree,
  type GitHubRepositoryTreeEntry,
  type GitHubRepositoryTreeNode,
} from "@/lib/github-repository-browser";

type RepositoryTreeResponse = {
  branch: string;
  entries: GitHubRepositoryTreeEntry[];
  repository: string;
  repositoryUrl: string;
  truncated: boolean;
};

type RepositoryFileResponse = {
  binary: boolean;
  branch: string;
  content: string | null;
  fileUrl: string;
  path: string;
};

type OpenSourceRepositoryBrowserProps = {
  /** 面板当前是否可见；不可见时清掉入场武装，隐藏期间提交的响应不再武装，hidden 往返即时呈现。 */
  active: boolean;
  repository: string;
  repositoryUrl: string;
  slug: string;
};

const MotionLoaderCircle = motion.create(LoaderCircle);

function RepositoryLoadingIcon() {
  const mounted = useHasMounted();
  const reduceMotion = useReducedMotion();
  const spinning = mounted && !reduceMotion;
  return (
    <MotionLoaderCircle
      animate={{ rotate: spinning ? [0, 360] : 0 }}
      aria-hidden="true"
      initial={false}
      transition={spinning ? { duration: 0.9, ease: "linear", repeat: Infinity } : { duration: 0 }}
    />
  );
}

function formatFileSize(size?: number) {
  if (size === undefined) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function fetchRepositoryJson<T>(operation: "repository.tree" | "repository.file", url: string, fallbackError: string) {
  return io(operation, async (signal) => {
    const response = await fetch(url, { signal });
    const result = (await response.json()) as T & { error?: string };
    if (!response.ok) throw new Error(result.error ?? fallbackError);
    return result;
  });
}

function RepositoryTreeRows({
  depth = 0,
  expanded,
  nodes,
  onOpenFile,
  onToggleDirectory,
  selectedPath,
}: {
  depth?: number;
  expanded: Set<string>;
  nodes: GitHubRepositoryTreeNode[];
  onOpenFile: (node: GitHubRepositoryTreeNode) => void;
  onToggleDirectory: (path: string) => void;
  selectedPath: string | null;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <ul className={styles.repositoryTree}>
      {nodes.map((node) => {
        const isDirectory = node.type === "tree";
        const isExpanded = expanded.has(node.path);
        return (
          <li key={node.path}>
            <button
              aria-current={!isDirectory && selectedPath === node.path ? "true" : undefined}
              aria-expanded={isDirectory ? isExpanded : undefined}
              className={styles.repositoryTreeItem}
              onClick={() => (isDirectory ? onToggleDirectory(node.path) : onOpenFile(node))}
              style={{ paddingLeft: `${0.7 + depth * 0.8}rem` }}
              type="button"
            >
              {isDirectory ? (
                isExpanded ? (
                  <ChevronDown aria-hidden="true" />
                ) : (
                  <ChevronRight aria-hidden="true" />
                )
              ) : (
                <FileCode2 aria-hidden="true" />
              )}
              {isDirectory ? isExpanded ? <FolderOpen aria-hidden="true" /> : <Folder aria-hidden="true" /> : null}
              <span>{node.name}</span>
              {!isDirectory && node.size !== undefined ? <small>{formatFileSize(node.size)}</small> : null}
            </button>
            {/* 目录展开/收起用高度动画过渡层级跳动，reduced-motion 下时长归零。 */}
            {isDirectory ? (
              <AnimatePresence initial={false}>
                {isExpanded ? (
                  <motion.div
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    initial={{ height: 0, opacity: 0 }}
                    key="children"
                    style={{ overflow: "hidden" }}
                    transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <RepositoryTreeRows
                      depth={depth + 1}
                      expanded={expanded}
                      nodes={node.children}
                      onOpenFile={onOpenFile}
                      onToggleDirectory={onToggleDirectory}
                      selectedPath={selectedPath}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function OpenSourceRepositoryBrowser({ active, repository, repositoryUrl, slug }: OpenSourceRepositoryBrowserProps) {
  const [tree, setTree] = useState<RepositoryTreeResponse | null>(null);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [file, setFile] = useState<RepositoryFileResponse | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  // @starting-style 入场只武装在新响应提交的同一次渲染，且提交时面板可见；隐藏即解除，
  // 隐藏期间到达的响应丢弃入场资格，hidden 往返不重播。visible 与 armed 放同一份状态：
  // 提交回调用函数式更新读最新可见性，避开闭包里请求发起时的旧 active。
  const [entrance, setEntrance] = useState({ armed: false, visible: active });
  if (entrance.visible !== active) {
    setEntrance(active ? { armed: entrance.armed, visible: true } : { armed: false, visible: false });
  }
  const requestVersion = useRef(0);

  const armEntranceIfVisible = () => {
    setEntrance((current) => (current.visible ? { ...current, armed: true } : current));
  };

  useEffect(() => {
    const controller = new AbortController();
    void Effect.runPromise(
      fetchRepositoryJson<RepositoryTreeResponse>(
        "repository.tree",
        `/api/open-source/${encodeURIComponent(slug)}/repository/tree`,
        "暂时无法读取原始仓库结构。",
      ),
      { signal: controller.signal },
    )
      .then((result) => {
        setTree(result);
        armEntranceIfVisible();
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setTreeError(error instanceof Error ? error.message : "暂时无法读取原始仓库结构。");
        armEntranceIfVisible();
      });
    return () => controller.abort();
  }, [slug]);

  const toggleDirectory = (path: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const openFile = async (node: GitHubRepositoryTreeNode) => {
    const currentVersion = requestVersion.current + 1;
    requestVersion.current = currentVersion;
    setSelectedPath(node.path);
    setFile(null);
    setFileError(null);
    setLoadingFile(true);
    try {
      const result = await Effect.runPromise(
        fetchRepositoryJson<RepositoryFileResponse>(
          "repository.file",
          `/api/open-source/${encodeURIComponent(slug)}/repository/file?path=${encodeURIComponent(node.path)}`,
          "暂时无法读取原始文件。",
        ),
      );
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

  const nodes = tree ? buildGitHubRepositoryTree(tree.entries) : [];

  return (
    <div className={styles.repositoryBrowser} data-entrance={entrance.armed ? "" : undefined}>
      <div className={styles.repositoryBrowserToolbar}>
        <div>
          <strong>{repository}</strong>
          {tree ? <span> · {tree.branch}</span> : null}
        </div>
        <a href={repositoryUrl} rel="noreferrer" target="_blank">
          在 GitHub 打开
          <ExternalLink aria-hidden="true" />
        </a>
      </div>
      {tree?.truncated ? (
        <p className={styles.repositoryBrowserNotice}>
          仓库文件较多，当前仅展示前 6,000 项；可在 GitHub 查看完整结构。
        </p>
      ) : null}
      {treeError ? <p className={styles.repositoryBrowserError}>{treeError}</p> : null}
      {!tree && !treeError ? (
        <p className={styles.repositoryBrowserLoading}>
          <RepositoryLoadingIcon /> 正在读取原始仓库结构…
        </p>
      ) : null}
      {tree ? (
        <div className={styles.repositoryBrowserContent}>
          <aside aria-label="原始仓库文件树" className={styles.repositoryTreePane}>
            <RepositoryTreeRows
              expanded={expanded}
              nodes={nodes}
              onOpenFile={openFile}
              onToggleDirectory={toggleDirectory}
              selectedPath={selectedPath}
            />
          </aside>
          <section aria-label="原始文件内容" className={styles.repositoryFilePane}>
            {loadingFile ? (
              <p className={styles.repositoryBrowserLoading}>
                <RepositoryLoadingIcon /> 正在读取 {selectedPath}…
              </p>
            ) : null}
            {!loadingFile && fileError ? <p className={styles.repositoryBrowserError}>{fileError}</p> : null}
            {!loadingFile && !fileError && !file ? (
              <p className={styles.repositoryFileEmpty}>从左侧文件树选择一个文本文件查看原始内容。</p>
            ) : null}
            {!loadingFile && file ? (
              <>
                <div className={styles.repositoryFileHeader}>
                  <code>{file.path}</code>
                  <a href={file.fileUrl} rel="noreferrer" target="_blank">
                    在 GitHub 查看
                  </a>
                </div>
                {file.binary ? (
                  <p className={styles.repositoryFileEmpty}>这是二进制文件，不能直接预览；可前往 GitHub 查看。</p>
                ) : (
                  <pre className={styles.repositoryFileContent}>
                    <code>{file.content}</code>
                  </pre>
                )}
              </>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
