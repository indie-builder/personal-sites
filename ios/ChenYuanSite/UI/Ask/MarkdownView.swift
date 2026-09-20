import SwiftUI

// MARK: - Markdown 解析

/// 行内元素：与安卓 AnswerMarkdown 的渲染范围对齐。
nonisolated enum MarkdownInline: Equatable {
    case text(String)
    case strong([MarkdownInline])
    case emphasis([MarkdownInline])
    case strikethrough([MarkdownInline])
    case code(String)
    case lineBreak
    case html(String)
    /// 回答中的引用编号【n】/[n]（代码块内不解析）。
    case sourceRef(Int)
}

nonisolated enum MarkdownBlock: Equatable {
    case heading(level: Int, inlines: [MarkdownInline])
    case paragraph([MarkdownInline])
    case list(ordered: Bool, start: Int, items: [[MarkdownBlock]])
    case code(code: String, language: String)
    case quote([MarkdownBlock])
    case thematicBreak
    case table(header: [[MarkdownInline]], rows: [[[MarkdownInline]]])
    case html(String)
}

/// 轻量 Markdown 块级/行内解析器：覆盖安卓端 commonmark + GFM 扩展所用到的
/// 语法范围（标题/段落/列表/代码/引用/分隔线/表格/删除线/行内码/HTML 纯文本）。
nonisolated enum MarkdownParser {
    static func parse(_ text: String) -> [MarkdownBlock] {
        var blocks: [MarkdownBlock] = []
        var lines = text.replacingOccurrences(of: "\r\n", with: "\n").components(separatedBy: "\n")
        // 结尾保证有一个空行，方便收尾 flush。
        lines.append("")
        var paragraph: [String] = []

        func flushParagraph() {
            guard !paragraph.isEmpty else { return }
            blocks.append(.paragraph(parseInline(joined(paragraph))))
            paragraph = []
        }

        var index = 0
        while index < lines.count {
            let line = lines[index]
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            if trimmed.isEmpty {
                flushParagraph()
                index += 1
            } else if let fence = fencedLanguage(trimmed) {
                flushParagraph()
                var code: [String] = []
                index += 1
                while index < lines.count {
                    let candidate = lines[index].trimmingCharacters(in: .whitespaces)
                    if candidate.hasPrefix("```") && candidate.allSatisfy({ $0 == "`" }) { break }
                    code.append(lines[index])
                    index += 1
                }
                index += 1
                blocks.append(.code(code: code.joined(separator: "\n"), language: fence))
            } else if let level = headingLevel(trimmed) {
                flushParagraph()
                let content = trimmed.drop(while: { $0 == "#" }).trimmingCharacters(in: .whitespaces)
                blocks.append(.heading(level: level, inlines: parseInline(content)))
                index += 1
            } else if isThematicBreak(trimmed) {
                flushParagraph()
                blocks.append(.thematicBreak)
                index += 1
            } else if trimmed.hasPrefix(">") {
                flushParagraph()
                var quoted: [String] = []
                while index < lines.count {
                    let candidate = lines[index]
                    let candidateTrimmed = candidate.trimmingCharacters(in: .whitespaces)
                    guard candidateTrimmed.hasPrefix(">") else { break }
                    var inner = String(candidateTrimmed.dropFirst())
                    if inner.hasPrefix(" ") { inner.removeFirst() }
                    quoted.append(inner)
                    index += 1
                }
                blocks.append(.quote(parse(joined(quoted))))
            } else if isListItem(trimmed) {
                flushParagraph()
                let (list, next) = parseList(lines: lines, from: index)
                blocks.append(list)
                index = next
            } else if trimmed.contains("|"), index + 1 < lines.count, isTableSeparator(lines[index + 1]) {
                flushParagraph()
                let (table, next) = parseTable(lines: lines, from: index)
                blocks.append(table)
                index = next
            } else if isHTMLBlock(trimmed) {
                flushParagraph()
                var html: [String] = []
                while index < lines.count {
                    let candidate = lines[index]
                    if candidate.trimmingCharacters(in: .whitespaces).isEmpty { break }
                    html.append(candidate.trimmingCharacters(in: .whitespaces))
                    index += 1
                }
                blocks.append(.html(html.joined(separator: "\n")))
            } else if isIndentedCode(line), paragraph.isEmpty {
                var code: [String] = []
                while index < lines.count, isIndentedCode(lines[index]) {
                    code.append(String(lines[index].dropFirst(4)))
                    index += 1
                }
                blocks.append(.code(code: code.joined(separator: "\n"), language: ""))
            } else {
                paragraph.append(trimmed)
                index += 1
            }
        }
        flushParagraph()
        return blocks
    }

    // MARK: 行内解析

    static func parseInline(_ text: String) -> [MarkdownInline] {
        var inlines: [MarkdownInline] = []
        var literal = ""

        func flush() {
            if !literal.isEmpty {
                inlines.append(.text(literal))
                literal = ""
            }
        }

        let characters = Array(text)
        var index = 0
        while index < characters.count {
            let char = characters[index]
            let rest = String(characters[index...])
            if char == "`", let close = (index + 1..<characters.count).first(where: { characters[$0] == "`" }) {
                flush()
                var code = String(characters[(index + 1)..<close])
                if code.count >= 2, code.hasPrefix(" "), code.hasSuffix(" ") {
                    code = String(code.dropFirst().dropLast())
                }
                inlines.append(.code(code))
                index = close + 1
            } else if rest.hasPrefix("~~") {
                if let range = rest.dropFirst(2).range(of: "~~") {
                    let inner = String(rest.dropFirst(2)[..<range.lowerBound])
                    flush()
                    inlines.append(.strikethrough(parseInline(inner)))
                    index += 2 + inner.count + 2
                } else {
                    literal.append(char)
                    index += 1
                }
            } else if rest.hasPrefix("**") || rest.hasPrefix("__") {
                let marker = String(rest.prefix(2))
                if let range = rest.dropFirst(2).range(of: marker) {
                    let inner = String(rest.dropFirst(2)[..<range.lowerBound])
                    flush()
                    inlines.append(.strong(parseInline(inner)))
                    index += 2 + inner.count + 2
                } else {
                    literal.append(char)
                    index += 1
                }
            } else if char == "*" || char == "_" {
                if let close = (index + 1..<characters.count).first(where: { characters[$0] == char }) {
                    let inner = String(characters[(index + 1)..<close])
                    if !inner.isEmpty {
                        flush()
                        inlines.append(.emphasis(parseInline(inner)))
                        index = close + 1
                    } else {
                        literal.append(char)
                        index += 1
                    }
                } else {
                    literal.append(char)
                    index += 1
                }
            } else if let reference = sourceReference(at: characters, index: index) {
                flush()
                inlines.append(.sourceRef(reference))
                index += referenceLength(at: characters, index: index)
            } else if char == "<", let close = (index + 1..<characters.count).first(where: { characters[$0] == ">" }),
                isTagStart(String(characters[(index + 1)..<close])) {
                flush()
                inlines.append(.html(String(characters[index...close])))
                index = close + 1
            } else if char == "\n" {
                // 段内换行：两个尾随空格为硬换行，否则软换行成空格。
                if literal.hasSuffix("  ") {
                    literal = String(literal.dropLast(2))
                    flush()
                    inlines.append(.lineBreak)
                } else {
                    flush()
                    inlines.append(.text(" "))
                }
                index += 1
            } else {
                literal.append(char)
                index += 1
            }
        }
        flush()
        return inlines
    }

    /// 【n】 或 [n] 的引用编号解析（1 起，返回 0 起索引）。
    static func sourceReference(at characters: [Character], index: Int) -> Int? {
        guard index < characters.count else { return nil }
        let open = characters[index]
        let close: Character = open == "【" ? "】" : (open == "[" ? "]" : "\0")
        guard close != "\0" else { return nil }
        var digits = ""
        var cursor = index + 1
        while cursor < characters.count, characters[cursor].isNumber, digits.count < 4 {
            digits.append(characters[cursor])
            cursor += 1
        }
        guard !digits.isEmpty, cursor < characters.count, characters[cursor] == close else { return nil }
        return (Int(digits) ?? 0) - 1
    }

    private static func referenceLength(at characters: [Character], index: Int) -> Int {
        guard index < characters.count else { return 1 }
        let open = characters[index]
        let close: Character = open == "【" ? "】" : "]"
        var cursor = index + 1
        while cursor < characters.count, characters[cursor].isNumber { cursor += 1 }
        return cursor < characters.count && characters[cursor] == close ? cursor - index + 1 : 1
    }

    // MARK: 语法谓词

    private static func joined(_ lines: [String]) -> String {
        lines.joined(separator: "\n")
    }

    private static func fencedLanguage(_ line: String) -> String? {
        guard line.hasPrefix("```") else { return nil }
        let language = String(line.dropFirst(3)).trimmingCharacters(in: .whitespaces)
        return language.allSatisfy { $0 == "`" } ? "" : language
    }

    private static func headingLevel(_ line: String) -> Int? {
        let level = line.prefix { $0 == "#" }.count
        guard (1...6).contains(level), line.count > level, line[line.index(line.startIndex, offsetBy: level)] == " " else {
            return nil
        }
        return level
    }

    private static func isThematicBreak(_ line: String) -> Bool {
        let compact = line.replacingOccurrences(of: " ", with: "")
        guard compact.count >= 3 else { return false }
        let unique = Set(compact)
        return unique.count == 1 && (unique == ["-"] || unique == ["*"] || unique == ["_"])
    }

    private static func isListItem(_ line: String) -> Bool {
        guard let first = line.first, "-*+".contains(first) || first.isNumber else { return false }
        if "-*+".contains(first) {
            let after = String(line.dropFirst())
            return after.hasPrefix(" ")
        }
        let marker = line.prefix { $0.isNumber }
        guard marker.count >= 1, marker.count <= 9 else { return false }
        let after = line.dropFirst(marker.count)
        return (after.hasPrefix(". ") || after.hasPrefix(") "))
    }

    private static func isTableSeparator(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        guard trimmed.contains("-") else { return false }
        let cells = splitTableRow(trimmed)
        return !cells.isEmpty && cells.allSatisfy { cell in
            guard cell.contains("-") else { return false }
            let stripped = cell.trimmingCharacters(in: CharacterSet(charactersIn: ":"))
            return !stripped.isEmpty && stripped.allSatisfy({ $0 == "-" })
        }
    }

    private static func isHTMLBlock(_ line: String) -> Bool {
        guard line.hasPrefix("<"), line.count > 1 else { return false }
        let next = line[line.index(after: line.startIndex)]
        return next.isLetter || next == "/" || next == "!"
    }

    private static func isIndentedCode(_ line: String) -> Bool {
        line.hasPrefix("    ") || line.hasPrefix("\t")
    }

    private static func isTagStart(_ content: String) -> Bool {
        guard let first = content.first else { return false }
        if first == "/" || first == "!" { return true }
        return first.isLetter
    }

    private static func splitTableRow(_ line: String) -> [String] {
        var trimmed = line.trimmingCharacters(in: .whitespaces)
        if trimmed.hasPrefix("|") { trimmed.removeFirst() }
        if trimmed.hasSuffix("|") { trimmed.removeLast() }
        return trimmed.components(separatedBy: "|").map { $0.trimmingCharacters(in: .whitespaces) }
    }

    // MARK: 列表与表格

    private static func parseList(lines: [String], from start: Int) -> (MarkdownBlock, Int) {
        let firstLine = lines[start].trimmingCharacters(in: .whitespaces)
        let ordered = firstLine.first!.isNumber
        let startNumber = ordered ? Int(firstLine.prefix { $0.isNumber }) ?? 1 : 1

        var items: [[MarkdownBlock]] = []
        var current: [String] = []

        func flushItem() {
            guard !current.isEmpty else { return }
            items.append(parse(current.joined(separator: "\n")))
            current = []
        }

        var index = start
        while index < lines.count {
            let line = lines[index]
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty {
                // 空行：若下一行仍是同类型条目则继续；换列表类型或非条目则结束。
                let next = index + 1
                let nextTrimmed = next < lines.count ? lines[next].trimmingCharacters(in: .whitespaces) : ""
                if next < lines.count, isListItem(nextTrimmed), listIsOrdered(nextTrimmed) == ordered {
                    current.append("")
                    index += 1
                } else {
                    break
                }
            } else if isListItem(trimmed) {
                guard listIsOrdered(trimmed) == ordered else { break }
                flushItem()
                current.append(String(trimmed.drop(while: { !$0.isWhitespace }).drop(while: { $0.isWhitespace })))
                index += 1
            } else if !current.isEmpty {
                // 懒续行：缩进的续行并入当前条目。
                current.append(trimmed)
                index += 1
            } else {
                break
            }
        }
        flushItem()
        return (.list(ordered: ordered, start: startNumber, items: items), index)
    }

    /// 条目行的类型：无序（- * +）返回 false，有序（数字 + . 或 )）返回 true。
    private static func listIsOrdered(_ line: String) -> Bool {
        guard let first = line.first else { return false }
        return !"-*+".contains(first)
    }

    private static func parseTable(lines: [String], from start: Int) -> (MarkdownBlock, Int) {
        let headerCells = splitTableRow(lines[start]).map { parseInline($0) }
        var index = start + 2
        var rows: [[[MarkdownInline]]] = []
        while index < lines.count {
            let line = lines[index]
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            guard trimmed.contains("|"), !trimmed.isEmpty else { break }
            rows.append(splitTableRow(trimmed).map { parseInline($0) })
            index += 1
        }
        return (.table(header: headerCells, rows: rows), index)
    }
}

// MARK: - 渲染

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
            Text(InlineRenderer.render(inlines, sourceCount: sourceCount))
                .siteBodyStyle()
        case let .list(ordered, start, items):
            VStack(alignment: .leading, spacing: SiteSpace.compact) {
                ForEach(Array(items.enumerated()), id: \.offset) { offset, item in
                    HStack(alignment: .firstTextBaseline, spacing: SiteSpace.compact) {
                        Text(ordered ? "\(start + offset)." : "•")
                            .siteBodyStyle(SiteTheme.muted)
                        BlockListView(blocks: item, sourceCount: sourceCount, onSource: onSource)
                    }
                }
            }
        case let .code(code, language):
            CodeBlockView(code: code, language: language)
        case let .quote(blocks):
            VStack(alignment: .leading, spacing: SiteSpace.related) {
                BlockListView(blocks: blocks, sourceCount: sourceCount, onSource: onSource)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(SiteSpace.related)
            .background(SiteTheme.line)
        case .thematicBreak:
            Divider().background(SiteTheme.line)
        case let .table(header, rows):
            TableView(header: header, rows: rows, sourceCount: sourceCount)
        case let .html(literal):
            Text(literal).siteBodyStyle(SiteTheme.muted)
        }
    }
}

private struct CodeBlockView: View {
    let code: String
    let language: String

    var body: some View {
        VStack(alignment: .leading, spacing: SiteSpace.compact) {
            if !language.isEmpty {
                Text(language)
                    .siteMetaStyle(SiteTheme.muted)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                Text(code.trimmingCharacters(in: CharacterSet(charactersIn: "\n")))
                    .siteBodyStyle()
                    .fixedSize(horizontal: true, vertical: false)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(SiteSpace.related)
        .background(SiteTheme.line)
    }
}

private struct TableView: View {
    let header: [[MarkdownInline]]
    let rows: [[[MarkdownInline]]]
    let sourceCount: Int

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 0) {
                    ForEach(Array(header.enumerated()), id: \.offset) { _, cell in
                        cellView(cell, style: SiteText.label)
                    }
                }
                ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                    Divider().background(SiteTheme.line)
                    HStack(spacing: 0) {
                        ForEach(Array(row.enumerated()), id: \.offset) { _, cell in
                            cellView(cell, style: SiteText.summary)
                        }
                    }
                }
            }
        }
    }

    private func cellView(_ cell: [MarkdownInline], style: Font) -> some View {
        Text(InlineRenderer.render(cell, sourceCount: sourceCount))
            .font(style)
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
        case let .text(value):
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
        case let .html(value):
            return AttributedString(value)
        case let .sourceRef(index):
            guard index >= 0, index < sourceCount else {
                return AttributedString("[\(index + 1)]")
            }
            var attributed = AttributedString("[\(index + 1)]")
            attributed.link = URL(string: "chenyuan://source/\(index + 1)")
            attributed.swiftUI.underlineStyle = Text.LineStyle.single
            return attributed
        }
    }
}
