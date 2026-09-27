import SwiftUI
import UIKit

/// 推荐问题与其检索范围成对声明，避免按文案字符串反推范围（docs/ask-experience.md：推荐问题会选对应范围）。
private let recommendedQuestions: [(question: String, scope: AskScope)] = [
    ("介绍一下陈远", .profile),
    ("最近关注哪些 AI 技术？", .aiNews),
    ("有哪些值得了解的开源项目？", .openSource),
]

struct AskEmptyState: View {
    let onSelect: (String, AskScope) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: SiteSpace.paragraph) {
            Text("有什么想了解的？").font(SiteText.pageTitle).foregroundStyle(SiteTheme.ink).padding(.top, 40)
            Text("关于陈远、每日关注或开源内容，都可以从这里开始。").siteBodyStyle(SiteTheme.muted)
            ForEach(recommendedQuestions, id: \.question) { recommendation in
                Button {
                    onSelect(recommendation.question, recommendation.scope)
                } label: {
                    Text(recommendation.question)
                        .font(SiteText.body)
                        .foregroundStyle(SiteTheme.ink)
                        .padding(.horizontal, SiteSpace.paragraph)
                        .padding(.vertical, 8)
                        .frame(minHeight: 48)
                        .overlay(RoundedRectangle(cornerRadius: 24).strokeBorder(SiteTheme.line, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

/// 复制回答按钮：点击后 1.6s 显示已复制（与安卓一致）。
struct CopyButton: View {
    let text: String

    @State private var copied = false

    var body: some View {
        Button {
            UIPasteboard.general.string = text
            copied = true
        } label: {
            Image(systemName: copied ? "checkmark" : "doc.on.doc")
                .font(.system(size: 15))
                .foregroundStyle(SiteTheme.muted)
                .frame(width: SiteSpace.touch, height: SiteSpace.touch)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(copied ? "已复制" : "复制回答")
        .task(id: copied) {
            guard copied else { return }
            try? await Task.sleep(for: .seconds(1.6))
            copied = false
        }
    }
}

/// 引用阅读：标题/栏目/日期/检索原文，应用内返回，从不跳浏览器。
struct SourceReader: View {
    let source: AskSource
    let number: Int
    let onBack: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                BackButton(label: "返回对话") { onBack() }
                Text("引用 \(number)").font(SiteText.title).foregroundStyle(SiteTheme.ink)
                Spacer()
            }
            ScrollView {
                VStack(alignment: .leading, spacing: SiteSpace.paragraph) {
                    Text(source.title.isEmpty ? "引用资料" : source.title)
                        .font(SiteText.pageTitle)
                        .foregroundStyle(SiteTheme.ink)
                        .lineSpacing(SiteText.bodyLineSpacing)
                    Text(metaLine(source.section, source.publishedAt)).siteMetaStyle(SiteTheme.muted)
                    Text("本次检索返回的资料片段").font(SiteText.label).foregroundStyle(SiteTheme.muted)
                    Text(source.content.isEmpty ? "该引用没有返回可阅读的正文。" : source.content).siteBodyStyle()
                }
                .padding(SiteSpace.page)
                .frame(maxWidth: .infinity, alignment: .leading)
                .textSelection(.enabled)
            }
        }
    }
}
