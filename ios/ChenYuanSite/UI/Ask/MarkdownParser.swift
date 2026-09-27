import Foundation

// MARK: - Markdown 模型

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

/// 轻量 Markdown 块级解析器；行内语法交给 MarkdownInlineParser。
/// 覆盖标题、段落、列表、代码、引用、分隔线、表格和 HTML 纯文本。
nonisolated enum MarkdownParser {
    static func parse(_ text: String) -> [MarkdownBlock] {
        var blocks: [MarkdownBlock] = []
        // 结尾保证有一个空行，方便收尾 flush。
        let lines = text.replacingOccurrences(of: "\r\n", with: "\n").components(separatedBy: "\n") + [""]
        var paragraph: [String] = []

        func flushParagraph() {
            guard !paragraph.isEmpty else { return }
            blocks.append(.paragraph(MarkdownInlineParser.parse(paragraph.joined(separator: "\n"))))
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
                blocks.append(.heading(level: level, inlines: MarkdownInlineParser.parse(trimmed.drop(while: { $0 == "#" }).trimmingCharacters(in: .whitespaces))))
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
        let headerCells = splitTableRow(lines[start]).map { MarkdownInlineParser.parse($0) }
        var index = start + 2
        var rows: [[[MarkdownInline]]] = []
        while index < lines.count {
            let trimmed = lines[index].trimmingCharacters(in: .whitespaces)
            guard trimmed.contains("|"), !trimmed.isEmpty else { break }
            rows.append(splitTableRow(trimmed).map { MarkdownInlineParser.parse($0) })
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
