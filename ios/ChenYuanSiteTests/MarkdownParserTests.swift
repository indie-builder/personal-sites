import Foundation
import Testing

@testable import ChenYuanSite

/// Markdown 解析器规格：与安卓 AnswerMarkdown 的渲染范围对齐。
struct MarkdownParserTests {
    @Test func headingsAndParagraphs() {
        #expect(MarkdownParser.parse("# 标题一\n\n正文段落\n第二行") == [
            .heading(level: 1, inlines: [.text("标题一")]),
            .paragraph([.text("正文段落"), .text(" "), .text("第二行")]),
        ])
    }

    @Test func bulletAndOrderedList() {
        #expect(MarkdownParser.parse("- 甲\n- 乙\n\n1. 第一\n2. 第二") == [
            .list(ordered: false, start: 1, items: [[.paragraph([.text("甲")])], [.paragraph([.text("乙")])]]),
            .list(ordered: true, start: 1, items: [[.paragraph([.text("第一")])], [.paragraph([.text("第二")])]]),
        ])
        // 有序列表保留起始编号。
        guard case let .list(true, start, items)? = MarkdownParser.parse("3. 三\n4. 四").first else {
            Issue.record("期望列表块")
            return
        }
        #expect(start == 3)
        #expect(items.count == 2)
    }

    @Test func fencedCodeQuoteAndRule() {
        #expect(MarkdownParser.parse("```swift\nlet x = 1\n```") == [.code(code: "let x = 1", language: "swift")])
        #expect(MarkdownParser.parse("> 引用文字") == [.quote([.paragraph([.text("引用文字")])])])
        #expect(MarkdownParser.parse("---") == [.thematicBreak])
    }

    @Test func tableParsesHeaderAndRows() {
        guard case let .table(header, rows)? = MarkdownParser.parse("| A | B |\n| --- | --- |\n| 1 | 2 |").first else {
            Issue.record("期望表格块")
            return
        }
        #expect(header.count == 2)
        #expect(rows == [[[.text("1")], [.text("2")]]])
    }

    @Test func inlineStyles() {
        #expect(MarkdownParser.parseInline("**粗** *斜* ~~删~~ `码`") == [
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
        #expect(MarkdownParser.parseInline("看【1】和[2]") == [.text("看"), .sourceRef(0), .text("和"), .sourceRef(1)])
        // 代码块内不解析引用编号。
        #expect(MarkdownParser.parseInline("`【1】`") == [.code("【1】")])
    }

    @Test func htmlInlineAndBlockStayLiteral() {
        #expect(MarkdownParser.parseInline("前<br>后") == [.text("前"), .html("<br>"), .text("后")])
        #expect(MarkdownParser.parse("<div>html</div>") == [.html("<div>html</div>")])
    }
}
