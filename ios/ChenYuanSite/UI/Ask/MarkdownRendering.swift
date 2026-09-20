import SwiftUI

/// 回答渲染：块级布局 + 行内富文本；引用编号【n】/[n] 为应用内可点链接
/// （代码块内不解析），点击回调 onSource(n-1)，从不跳浏览器。
struct MarkdownView: View {
    let text: String
    let sourceCount: Int
    let onSource: (Int) -> Void

    @Environment(\.openURL) private var systemOpenURL

    /// remember(text) 语义（对齐安卓 AnswerMarkdown 的 remember(text) { parse }）：
    /// 解析结果按文本缓存，滚动、流式期间状态翻转等非文本重渲染不再重复整篇解析。
    @State private var parseCache = ParseCache()

    private final class ParseCache {
        var text: String?
        var blocks: [MarkdownBlock] = []
    }

    var body: some View {
        let blocks: [MarkdownBlock]
        if parseCache.text == text {
            blocks = parseCache.blocks
        } else {
            blocks = MarkdownParser.parse(text)
            parseCache.text = text
            parseCache.blocks = blocks
        }
        return BlockListView(blocks: blocks, sourceCount: sourceCount, onSource: onSource)
            .textSelection(.enabled)
            .tint(SiteTheme.ink)
            .environment(\.openURL, OpenURLAction { url in
                guard url.scheme == "chenyuan", url.host == "source", let number = Int(url.lastPathComponent) else {
                    systemOpenURL(url)
                    return .handled
                }
                onSource(number - 1)
                return .handled
            })
    }
}

/// 块级元素 → 纵向布局；列表条目与引用递归复用。
private struct BlockListView: View {
    let blocks: [MarkdownBlock]
    let sourceCount: Int
    let onSource: (Int) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: SiteSpace.related) {
            ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                blockView(block)
            }
        }
    }

    @ViewBuilder
    private func blockView(_ block: MarkdownBlock) -> some View {
        switch block {
        case let .heading(level, inlines):
            Text(InlineRenderer.render(inlines, sourceCount: sourceCount))
                .font(level <= 2 ? SiteText.title : SiteText.listTitle)
                .foregroundStyle(SiteTheme.ink)
                .padding(.top, SiteSpace.compact)
        case let .paragraph(inlines):
            Text(InlineRenderer.render(inlines, sourceCount: sourceCount)).siteBodyStyle()
        case let .list(ordered, start, items):
            VStack(alignment: .leading, spacing: SiteSpace.compact) {
                ForEach(Array(items.enumerated()), id: \.offset) { offset, item in
                    HStack(alignment: .firstTextBaseline, spacing: SiteSpace.compact) {
                        Text(ordered ? "\(start + offset)." : "•").siteBodyStyle(SiteTheme.muted)
                        BlockListView(blocks: item, sourceCount: sourceCount, onSource: onSource)
                    }
                }
            }
        case let .code(code, language):
            VStack(alignment: .leading, spacing: SiteSpace.compact) {
                if !language.isEmpty { Text(language).siteMetaStyle(SiteTheme.muted) }
                ScrollView(.horizontal, showsIndicators: false) {
                    Text(code.trimmingCharacters(in: CharacterSet(charactersIn: "\n")))
                        .siteBodyStyle()
                        .fixedSize(horizontal: true, vertical: false)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(SiteSpace.related)
            .background(SiteTheme.line)
        case let .quote(blocks):
            BlockListView(blocks: blocks, sourceCount: sourceCount, onSource: onSource)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(SiteSpace.related)
                .background(SiteTheme.line)
        case .thematicBreak:
            Divider().background(SiteTheme.line)
        case let .table(header, rows):
            ScrollView(.horizontal, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 0) {
                        ForEach(Array(header.enumerated()), id: \.offset) { _, cell in
                            cellView(cell, font: SiteText.label)
                        }
                    }
                    ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                        Divider().background(SiteTheme.line)
                        HStack(spacing: 0) {
                            ForEach(Array(row.enumerated()), id: \.offset) { _, cell in
                                cellView(cell, font: SiteText.summary)
                            }
                        }
                    }
                }
            }
        case let .html(literal):
            Text(literal).siteBodyStyle(SiteTheme.muted)
        }
    }

    private func cellView(_ cell: [MarkdownInline], font: Font) -> some View {
        Text(InlineRenderer.render(cell, sourceCount: sourceCount))
            .font(font)
            .foregroundStyle(SiteTheme.ink)
            .frame(width: 160, alignment: .leading)
            .padding(SiteSpace.related)
    }
}

/// 行内元素 → AttributedString：粗体/斜体/删除线/行内码底色；
/// 引用编号渲染为 chenyuan://source/N 链接，由 MarkdownView 的 OpenURLAction 拦截。
nonisolated enum InlineRenderer {
    static func render(_ inlines: [MarkdownInline], sourceCount: Int) -> AttributedString {
        var result = AttributedString()
        for inline in inlines {
            result += render(inline, sourceCount: sourceCount)
        }
        return result
    }

    private static func render(_ inline: MarkdownInline, sourceCount: Int) -> AttributedString {
        switch inline {
        case let .text(value), let .html(value):
            return AttributedString(value)
        case let .strong(children):
            var attributed = render(children, sourceCount: sourceCount)
            attributed.font = .system(size: 15, weight: .semibold)
            return attributed
        case let .emphasis(children):
            var attributed = render(children, sourceCount: sourceCount)
            attributed.font = .system(size: 15).italic()
            return attributed
        case let .strikethrough(children):
            var attributed = render(children, sourceCount: sourceCount)
            attributed.swiftUI.strikethroughStyle = Text.LineStyle.single
            return attributed
        case let .code(value):
            var attributed = AttributedString(value)
            attributed.font = .system(size: 14, design: .monospaced)
            attributed.swiftUI.backgroundColor = SiteTheme.line
            return attributed
        case .lineBreak:
            return AttributedString("\n")
        case let .sourceRef(index):
            guard (0..<sourceCount).contains(index) else { return AttributedString("[\(index + 1)]") }
            var attributed = AttributedString("[\(index + 1)]")
            attributed.link = URL(string: "chenyuan://source/\(index + 1)")
            attributed.swiftUI.underlineStyle = Text.LineStyle.single
            return attributed
        }
    }
}
