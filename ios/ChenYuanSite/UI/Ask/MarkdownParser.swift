import Foundation

// MARK: - Markdown 模型

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

// MARK: - 解析

/// 轻量 Markdown 块级/行内解析器：覆盖安卓端 commonmark + GFM 扩展所用到的
/// 语法范围（标题/段落/列表/代码/引用/分隔线/表格/删除线/行内码/HTML 纯文本）。
nonisolated enum MarkdownParser {
    static func parse(_ text: String) -> [MarkdownBlock] {
        var blocks: [MarkdownBlock] = []
        // 结尾保证有一个空行，方便收尾 flush。
        let lines = text.replacingOccurrences(of: "\r\n", with: "\n").components(separatedBy: "\n") + [""]
        var paragraph: [String] = []

        func flushParagraph() {
            guard !paragraph.isEmpty else { return }
            blocks.append(.paragraph(parseInline(paragraph.joined(separator: "\n"))))
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
                while index < lines.count, !lines[index].trimmingCharacters(in: .whitespaces).isFenceClose {
                    code.append(lines[index])
                    index += 1
                }
                index += 1
                blocks.append(.code(code: code.joined(separator: "\n"), language: fence))
            } else if let level = headingLevel(trimmed) {
                flushParagraph()
                blocks.append(.heading(level: level, inlines: parseInline(trimmed.drop(while: { $0 == "#" }).trimmingCharacters(in: .whitespaces))))
                index += 1
            } else if isThematicBreak(trimmed) {
                flushParagraph()
                blocks.append(.thematicBreak)
                index += 1
            } else if trimmed.hasPrefix(">") {
                flushParagraph()
                var quoted: [String] = []
                while index < lines.count, lines[index].trimmingCharacters(in: .whitespaces).hasPrefix(">") {
                    var inner = String(lines[index].trimmingCharacters(in: .whitespaces).dropFirst())
                    if inner.hasPrefix(" ") { inner.removeFirst() }
                    quoted.append(inner)
                    index += 1
                }
                blocks.append(.quote(parse(quoted.joined(separator: "\n"))))
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
                while index < lines.count, !lines[index].trimmingCharacters(in: .whitespaces).isEmpty {
                    html.append(lines[index].trimmingCharacters(in: .whitespaces))
                    index += 1
                }
                blocks.append(.html(html.joined(separator: "\n")))
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
        let characters = Array(text)
        var index = 0

        func flush() {
            if !literal.isEmpty {
                inlines.append(.text(literal))
                literal = ""
            }
        }

        while index < characters.count {
            let char = characters[index]
            // 成对标记（~~ ** __ * _，先长后短避免 ** 被拆成两个 *）。
            if let marker = enclosedMarker(at: index, in: characters) {
                flush()
                let inner = parseInline(marker.content)
                switch marker.name {
                case "~~": inlines.append(.strikethrough(inner))
                case "**", "__": inlines.append(.strong(inner))
                default: inlines.append(.emphasis(inner))
                }
                index = marker.end
            } else if char == "`", let close = (index + 1..<characters.count).first(where: { characters[$0] == "`" }) {
                flush()
                var code = String(characters[(index + 1)..<close])
                if code.count >= 2, code.hasPrefix(" "), code.hasSuffix(" ") { code = String(code.dropFirst().dropLast()) }
                inlines.append(.code(code))
                index = close + 1
            } else if let reference = sourceReference(characters, at: index) {
                flush()
                inlines.append(.sourceRef(reference.index))
                index += reference.length
            } else if char == "<", let close = (index + 1..<characters.count).first(where: { characters[$0] == ">" }),
                isTagStart(String(characters[(index + 1)..<close]))
            {
                flush()
                inlines.append(.html(String(characters[index...close])))
                index = close + 1
            } else if char == "\n" {
                // 段内换行：两个尾随空格为硬换行，否则软换行成空格。
                let hard = literal.hasSuffix("  ")
                if hard { literal = String(literal.dropLast(2)) }
                flush()
                inlines.append(hard ? .lineBreak : .text(" "))
                index += 1
            } else {
                literal.append(char)
                index += 1
            }
        }
        flush()
        return inlines
    }

    /// 从 index 起的成对行内标记（~~…~~、**…**、__…__、*…*、_…_）：
    /// 返回名称、内容与整体结束下标；无闭合或内容为空时视为普通文本
    /// （跳过该标记尝试，交由后续分支按字面量处理）。
    private static func enclosedMarker(at index: Int, in chars: [Character]) -> (name: String, content: String, end: Int)? {
        for name in ["~~", "**", "__", "*", "_"] {
            let marker = Array(name)
            guard index + marker.count <= chars.count, Array(chars[index..<index + marker.count]) == marker else { continue }
            let bodyStart = index + marker.count
            if let close = firstOccurrence(of: marker, in: chars, from: bodyStart) {
                let content = String(chars[bodyStart..<close])
                if !content.isEmpty { return (name, content, close + marker.count) }
            }
        }
        return nil
    }

    private static func firstOccurrence(of needle: [Character], in chars: [Character], from start: Int) -> Int? {
        var index = start
        while index + needle.count <= chars.count {
            if Array(chars[index..<index + needle.count]) == needle { return index }
            index += 1
        }
        return nil
    }

    /// 【n】/[n] 的引用编号：返回（0 起索引，整体字符长度）。
    static func sourceReference(_ chars: [Character], at index: Int) -> (index: Int, length: Int)? {
        guard index < chars.count else { return nil }
        let close: Character
        switch chars[index] {
        case "【": close = "】"
        case "[": close = "]"
        default: return nil
        }
        var end = index + 1
        while end < chars.count, chars[end].isNumber, end - index <= 4 {
            end += 1
        }
        guard end > index + 1, end < chars.count, chars[end] == close else { return nil }
        return ((Int(String(chars[(index + 1)..<end])) ?? 1) - 1, end - index + 1)
    }

    // MARK: 语法谓词

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
        let unique = Set(compact)
        return compact.count >= 3 && unique.count == 1 && (unique == ["-"] || unique == ["*"] || unique == ["_"])
    }

    private static func isListItem(_ line: String) -> Bool {
        guard let first = line.first, "-*+".contains(first) || first.isNumber else { return false }
        if "-*+".contains(first) {
            return String(line.dropFirst()).hasPrefix(" ")
        }
        let marker = line.prefix { $0.isNumber }
        return (1...9).contains(marker.count) && (line.dropFirst(marker.count).hasPrefix(". ") || line.dropFirst(marker.count).hasPrefix(") "))
    }

    private static func isTableSeparator(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        guard trimmed.contains("-") else { return false }
        let cells = splitTableRow(trimmed)
        return !cells.isEmpty && cells.allSatisfy { cell in
            let stripped = cell.trimmingCharacters(in: CharacterSet(charactersIn: ":"))
            return cell.contains("-") && !stripped.isEmpty && stripped.allSatisfy({ $0 == "-" })
        }
    }

    private static func isHTMLBlock(_ line: String) -> Bool {
        guard line.hasPrefix("<"), let next = line.dropFirst().first else { return false }
        return next.isLetter || next == "/" || next == "!"
    }

    private static func isTagStart(_ content: String) -> Bool {
        guard let first = content.first else { return false }
        return first == "/" || first == "!" || first.isLetter
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
            let trimmed = lines[index].trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty {
                // 空行：若下一行仍是同类型条目则继续；换列表类型或非条目则结束。
                let next = index + 1
                let nextTrimmed = next < lines.count ? lines[next].trimmingCharacters(in: .whitespaces) : ""
                let sameList = next < lines.count && isListItem(nextTrimmed) && nextTrimmed.first!.isNumber == ordered
                if sameList {
                    current.append("")
                    index += 1
                } else {
                    break
                }
            } else if isListItem(trimmed) {
                guard trimmed.first!.isNumber == ordered else { break }
                flushItem()
                current.append(String(trimmed.drop(while: { !$0.isWhitespace })))
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

    private static func parseTable(lines: [String], from start: Int) -> (MarkdownBlock, Int) {
        let headerCells = splitTableRow(lines[start]).map { parseInline($0) }
        var index = start + 2
        var rows: [[[MarkdownInline]]] = []
        while index < lines.count {
            let trimmed = lines[index].trimmingCharacters(in: .whitespaces)
            guard trimmed.contains("|"), !trimmed.isEmpty else { break }
            rows.append(splitTableRow(trimmed).map { parseInline($0) })
            index += 1
        }
        return (.table(header: headerCells, rows: rows), index)
    }
}

nonisolated private extension String {
    /// 围栏代码块（```）的闭合行：全为反引号。
    var isFenceClose: Bool {
        hasPrefix("```") && allSatisfy({ $0 == "`" })
    }
}
