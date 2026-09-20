import SwiftUI
import Testing

@testable import ChenYuanSite

/// 回答行内渲染的规格：引用编号【n】/[n] 渲染为应用内链接
/// （chenyuan://source/n，由 MarkdownView 的 OpenURLAction 拦截），
/// 越界编号回退纯文本，行内码带底色样式。
struct InlineRendererTests {
    @Test func sourceRefRendersInAppLink() {
        let attributed = InlineRenderer.render([.sourceRef(0)], sourceCount: 2)
        #expect(String(attributed.characters) == "[1]")
        #expect(attributed.runs.compactMap(\.link) == [URL(string: "chenyuan://source/1")])

        // 越界编号回退纯文本。
        let fallback = InlineRenderer.render([.sourceRef(5)], sourceCount: 2)
        #expect(String(fallback.characters) == "[6]")
        #expect(fallback.runs.compactMap(\.link).isEmpty)
    }

    @Test func inlineCodeCarriesBackgroundStyle() {
        let attributed = InlineRenderer.render([.code("x")], sourceCount: 1)
        #expect(attributed.runs.contains { $0.swiftUI.backgroundColor != nil })
    }

    @Test func mixedInlinesConcatenateInOrder() {
        let attributed = InlineRenderer.render([.text("结论"), .sourceRef(1), .text("。")], sourceCount: 2)
        #expect(String(attributed.characters) == "结论[2]。")
    }
}
