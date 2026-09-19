import Foundation
import Testing

@testable import ChenYuanSite

/// Markdown 解析器规格：与安卓 AnswerMarkdown 的渲染范围对齐。
struct MarkdownParserTests {
    @Test func headingsAndParagraphs() {
        let blocks = MarkdownParser.parse("# 标题一\n\n正文段落\n第二行")
        #expect(blocks == [
            .heading(level: 1, inlines: [.text("标题一")]),
            .paragraph([.text("正文段落"), .text(" "), .text("第二行")]),
        ])
    }

    @Test func bulletAndOrderedList() {
        let blocks = MarkdownParser.parse("- 甲\n- 乙\n\n1. 第一\n2. 第二")
        #expect(blocks == [
            .list(ordered: false, start: 1, items: [[.paragraph([.text("甲")])], [.paragraph([.text("乙")])]]),
            .list(ordered: true, start: 1, items: [[.paragraph([.text("第一")])], [.paragraph([.text("第二")])]]),
        ])
    }

    @Test func orderedListStartNumber() {
        let blocks = MarkdownParser.parse("3. 三\n4. 四")
        guard case let .list(ordered, start, items)? = blocks.first else {
            Issue.record("期望列表块")
            return
        }
        #expect(ordered)
        #expect(start == 3)
        #expect(items.count == 2)
    }

    @Test func fencedCodeWithLanguage() {
        let blocks = MarkdownParser.parse("```swift\nlet x = 1\n```")
        #expect(blocks == [.code(code: "let x = 1", language: "swift")])
    }

    @Test func blockQuoteNestsBlocks() {
        let blocks = MarkdownParser.parse("> 引用文字")
        #expect(blocks == [.quote([.paragraph([.text("引用文字")])])])
    }

    @Test func tableParsesHeaderAndRows() {
        let blocks = MarkdownParser.parse("| A | B |\n| --- | --- |\n| 1 | 2 |")
        guard case let .table(header, rows)? = blocks.first else {
            Issue.record("期望表格块")
            return
        }
        #expect(header.count == 2)
        #expect(rows.count == 1)
        #expect(rows[0].count == 2)
    }

    @Test func thematicBreak() {
        #expect(MarkdownParser.parse("---") == [.thematicBreak])
    }

    @Test func inlineStyles() {
        let inlines = MarkdownParser.parseInline("**粗** *斜* ~~删~~ `码`")
        #expect(inlines == [
            .strong([.text("粗")]),
            .text(" "),
            .emphasis([.text("斜")]),
            .text(" "),
            .strikethrough([.text("删")]),
            .text(" "),
            .code("码"),
        ])
    }

    @Test func sourceReferencesParseOneBased() {
        let inlines = MarkdownParser.parseInline("看【1】和[2]")
        #expect(inlines == [.text("看"), .sourceRef(0), .text("和"), .sourceRef(1)])
    }

    @Test func noReferencesInsideCode() {
        let inlines = MarkdownParser.parseInline("`【1】`")
        #expect(inlines == [.code("【1】")])
    }

    @Test func htmlInlineAndBlockStayLiteral() {
        #expect(MarkdownParser.parseInline("前<br>后") == [.text("前"), .html("<br>"), .text("后")])
        #expect(MarkdownParser.parse("<div>html</div>") == [.html("<div>html</div>")])
    }
}
