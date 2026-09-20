import Testing

@testable import ChenYuanSite

/// 每日动态行导读预览的规格：标题前缀剔除、起始标点剔除、
/// 多段摘要的换行压平（列表两行预览不渲染空行，与站点 CSS 空白折叠一致）。
struct HomeRowTests {
    @Test func multilineSummaryFlattensNewlines() {
        let preview = aiNewsSummaryPreview(
            title: "爆料称OpenAI与Anthropic夸大AI安全事件",
            summary: "哎呀，哎呀。谁能想到呢？\n\nOpenAI 和 Anthropic 故意煽动对 AI 的恐慌。\n\n目的？监管俘获。",
        )
        #expect(preview == "哎呀，哎呀。谁能想到呢？ OpenAI 和 Anthropic 故意煽动对 AI 的恐慌。 目的？监管俘获。")
    }

    @Test func stripsTitlePrefixAndLeadingPunctuation() {
        let preview = aiNewsSummaryPreview(
            title: "标题在前",
            summary: "标题在前。这是正文。",
        )
        #expect(preview == "这是正文。")
    }

    @Test func blankSummaryStaysBlank() {
        #expect(aiNewsSummaryPreview(title: "标题", summary: "   \n  ") == "")
        #expect(aiNewsSummaryPreview(title: "标题", summary: "") == "")
    }

    @Test func summaryWithoutTitleKeepsWholeText() {
        let preview = aiNewsSummaryPreview(title: "另一篇", summary: "正文的介绍。")
        #expect(preview == "正文的介绍。")
    }

    @Test func crlfAndMixedWhitespaceCollapse() {
        #expect(aiNewsSummaryPreview(title: "t", summary: "a\r\nb") == "a b")
        #expect(aiNewsSummaryPreview(title: "t", summary: "a \n b") == "a b")
    }
}
