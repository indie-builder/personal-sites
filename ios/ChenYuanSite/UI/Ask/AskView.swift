import SwiftUI

/// 推荐问题与其检索范围成对声明，避免按文案字符串反推范围（docs/ask-experience.md：推荐问题会选对应范围）。
private let recommendedQuestions: [(question: String, scope: AskScope)] = [
    ("介绍一下陈远", .profile),
    ("最近关注哪些 AI 技术？", .aiNews),
    ("有哪些值得了解的开源项目？", .openSource),
]

/// 全屏原生问答：SSE 流式回答、引用编号应用内阅读、停止/重试/新对话。
struct AskView: View {
    @Environment(AppEnvironment.self) private var env
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    @State private var input = ""
    @State private var searchScope: AskScope = .all
    @State private var followLatest = true
    @State private var canScrollForward = false
    @State private var isScrolling = false
    @State private var selectedSource: SelectedSource?
    @State private var confirmReset = false
    @FocusState private var inputFocused: Bool

    struct SelectedSource: Equatable {
        let messageID: Int
        let index: Int
    }

    private var controller: AskController { env.askController }

    var body: some View {
        Group {
            if let selectedSource, let message = controller.messages.first(where: { $0.id == selectedSource.messageID }),
                let source = message.sources[safe: selectedSource.index] {
                SourceReader(source: source, number: selectedSource.index + 1) {
                    self.selectedSource = nil
                }
            } else {
                conversation
            }
        }
        .background(SiteTheme.background)
        .onDisappear { controller.cancel() }
    }

    private var conversation: some View {
        VStack(spacing: 0) {
            header
            messageList
            composer
        }
    }

    private var header: some View {
        HStack(spacing: SiteSpace.compact) {
            Button {
                dismiss()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(SiteTheme.ink)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("返回")
            VStack(alignment: .leading, spacing: 0) {
                Text("问一问")
                    .font(SiteText.title)
                    .foregroundStyle(SiteTheme.ink)
                Text("基于站内资料 · 引用可在应用内阅读")
                    .siteMetaStyle(SiteTheme.muted)
            }
            Spacer()
            Button("新对话") {
                if !controller.messages.isEmpty || !input.isEmpty {
                    confirmReset = true
                }
            }
            .font(SiteText.meta)
            .foregroundStyle(SiteTheme.ink)
            .buttonStyle(.plain)
            .padding(.trailing, SiteSpace.compact)
        }
        .padding(.horizontal, SiteSpace.compact)
    }

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: SiteSpace.section) {
                    if controller.messages.isEmpty {
                        emptyState
                    }
                    ForEach(controller.messages) { message in
                        messageView(message)
                    }
                    Spacer().frame(height: SiteSpace.touch)
                        .id("conversation-end")
                }
                .padding(.horizontal, SiteSpace.page)
                .padding(.vertical, SiteSpace.paragraph)
            }
            .scrollDismissesKeyboard(.interactively)
            // 与安卓一致：仅在用户滚动过程中依据「能否继续下滚」决定是否跟随最新。
            .onScrollPhaseChange { _, newPhase in
                isScrolling = newPhase != .idle
            }
            .onScrollGeometryChange(for: Bool.self) { geometry in
                let viewportBottom = geometry.contentOffset.y + geometry.containerSize.height
                let contentBottom = geometry.contentSize.height + geometry.contentInsets.top + geometry.contentInsets.bottom
                return contentBottom - viewportBottom > 8
            } action: { _, newValue in
                canScrollForward = newValue
                if isScrolling { followLatest = !newValue }
            }
            .overlay(alignment: .bottom) {
                if !followLatest {
                    Button {
                        followLatest = true
                        withAnimation(.easeOut(duration: 0.25)) {
                            proxy.scrollTo("conversation-end", anchor: .bottom)
                        }
                    } label: {
                        Image(systemName: "arrow.down")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundStyle(SiteTheme.ink)
                            .frame(width: 40, height: 40)
                            .background(SiteTheme.glass)
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("回到最新回复")
                    .padding(.bottom, SiteSpace.compact)
                }
            }
            .onChange(of: controller.messages.count) { _, _ in scrollToLatest(proxy) }
            .onChange(of: controller.messages.last?.text) { _, _ in scrollToLatest(proxy) }
            .onChange(of: selectedSource) { _, _ in
                if selectedSource == nil { scrollToLatest(proxy) }
            }
        }
    }

    private func scrollToLatest(_ proxy: ScrollViewProxy) {
        guard followLatest, !controller.messages.isEmpty, selectedSource == nil else { return }
        proxy.scrollTo("conversation-end", anchor: .bottom)
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: SiteSpace.paragraph) {
            Text("有什么想了解的？")
                .font(SiteText.pageTitle)
                .foregroundStyle(SiteTheme.ink)
                .padding(.top, 40)
            Text("关于陈远、每日关注或开源内容，都可以从这里开始。")
                .siteBodyStyle(SiteTheme.muted)
            ForEach(recommendedQuestions, id: \.question) { recommendation in
                Button {
                    input = recommendation.question
                    searchScope = recommendation.scope
                    inputFocused = true
                } label: {
                    Text(recommendation.question)
                        .font(SiteText.body)
                        .foregroundStyle(SiteTheme.ink)
                        .padding(.horizontal, SiteSpace.paragraph)
                        .padding(.vertical, 8)
                        .overlay(
                            RoundedRectangle(cornerRadius: 24)
                                .strokeBorder(SiteTheme.line, lineWidth: 1),
                        )
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder
    private func messageView(_ message: AskMessage) -> some View {
        if message.role == .question {
            HStack {
                Spacer()
                Text(message.text)
                    .siteBodyStyle()
                    .padding(.horizontal, SiteSpace.paragraph)
                    .padding(.vertical, SiteSpace.related)
                    .background(SiteTheme.line)
                    .clipShape(RoundedRectangle(cornerRadius: 20))
                    .frame(maxWidth: 300, alignment: .trailing)
            }
        } else {
            answerView(message)
        }
    }

    private func answerView(_ message: AskMessage) -> some View {
        let index = controller.messages.firstIndex(where: { $0.id == message.id }) ?? 0
        let isLast = index == controller.messages.count - 1
        return VStack(alignment: .leading, spacing: SiteSpace.related) {
            if !message.text.isEmpty {
                MarkdownView(text: message.text, sourceCount: message.sources.count) { sourceIndex in
                    openSource(message, sourceIndex)
                }
            } else {
                Text(placeholderText(for: message.status))
                    .siteBodyStyle(SiteTheme.muted)
            }
            if message.status == .stopped, !message.text.isEmpty {
                Text("已停止生成").siteMetaStyle(SiteTheme.muted)
            }
            if !message.sources.isEmpty {
                Text(message.text.isEmpty ? "检索到的资料" : "参考资料 · 点击查看依据")
                    .siteMetaStyle(SiteTheme.muted)
                ForEach(Array(message.sources.enumerated()), id: \.element.id) { number, source in
                    Button {
                        openSource(message, number)
                    } label: {
                        HStack(alignment: .firstTextBaseline, spacing: SiteSpace.related) {
                            Text("\(number + 1)")
                                .font(SiteText.label)
                                .foregroundStyle(SiteTheme.ink)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(source.title.isEmpty ? "引用资料 \(number + 1)" : source.title)
                                    .siteSummaryStyle(SiteTheme.ink)
                                    .multilineTextAlignment(.leading)
                                if let section = source.section, !section.isEmpty {
                                    Text(section).siteMetaStyle(SiteTheme.muted)
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .frame(minHeight: SiteSpace.touch - SiteSpace.compact)
                    .padding(.vertical, SiteSpace.compact / 2)
                }
            }
            if isLast, let error = controller.error {
                Text(error)
                    .siteSummaryStyle(.red)
            }
            HStack(spacing: SiteSpace.compact) {
                if !message.text.isEmpty {
                    CopyButton(text: message.text)
                }
                if isLast, !controller.streaming {
                    Button {
                        followLatest = true
                        controller.retryLast()
                    } label: {
                        Image(systemName: "arrow.counterclockwise")
                            .font(.system(size: 15))
                            .foregroundStyle(SiteTheme.muted)
                            .frame(width: SiteSpace.touch, height: SiteSpace.touch)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(message.status == .error ? "重试回答" : "重新生成回答")
                }
            }
        }
    }

    private func placeholderText(for status: AskMessage.Status) -> String {
        switch status {
        case .streaming: "正在查阅资料…"
        case .error: "这次未能完成回答"
        case .stopped: "已停止生成"
        case .complete: "暂无可显示的回答"
        }
    }

    private var composer: some View {
        let trimmedLength = input.trimmingCharacters(in: .whitespacesAndNewlines).count
        let validInput = (2...1000).contains(trimmedLength)
        return VStack(spacing: SiteSpace.compact) {
            TextField(
                "输入你的问题…",
                text: $input,
                axis: .vertical,
            )
            .font(SiteText.body)
            .lineSpacing(SiteText.bodyLineSpacing)
            .lineLimit(1...6)
            .padding(SiteSpace.compact)
            .focused($inputFocused)
            .tint(SiteTheme.ink)
            HStack(spacing: SiteSpace.compact) {
                Menu {
                    ForEach(AskScope.allCases) { scope in
                        Button(scope.label) { searchScope = scope }
                    }
                } label: {
                    HStack(spacing: 2) {
                        Text(searchScope.label)
                            .font(SiteText.meta)
                        Image(systemName: "chevron.down")
                            .font(.system(size: 10, weight: .medium))
                    }
                    .foregroundStyle(SiteTheme.ink)
                    .padding(.vertical, 6)
                    .contentShape(Rectangle())
                }
                .disabled(controller.streaming)
                .padding(.leading, SiteSpace.compact)
                if trimmedLength > 1000 {
                    Text("最多 1000 字")
                        .siteMetaStyle(.red)
                } else if trimmedLength > 0, trimmedLength < 2 {
                    Text("至少 2 个字")
                        .siteMetaStyle(.red)
                }
                Spacer()
                Button {
                    if controller.streaming {
                        controller.cancel()
                    } else {
                        send(validInput: validInput)
                    }
                } label: {
                    Image(systemName: controller.streaming ? "stop.fill" : "arrow.up")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(
                            controller.streaming || validInput ? SiteTheme.background : SiteTheme.muted,
                        )
                        .frame(width: SiteSpace.touch, height: SiteSpace.touch)
                        .background(
                            Circle().fill(
                                controller.streaming || validInput ? SiteTheme.ink : SiteTheme.line,
                            ),
                        )
                }
                .buttonStyle(.plain)
                .disabled(!(controller.streaming || validInput))
                .accessibilityLabel(controller.streaming ? "停止生成" : "发送")
            }
        }
        .padding(SiteSpace.compact)
        .background(RoundedRectangle(cornerRadius: 24).fill(SiteTheme.line))
        .padding(.horizontal, SiteSpace.paragraph)
        .padding(.vertical, SiteSpace.compact)
    }

    private func send(validInput: Bool) {
        guard validInput, !controller.streaming else { return }
        followLatest = true
        controller.send(input, scope: searchScope)
        input = ""
        inputFocused = false
    }

    private func openSource(_ message: AskMessage, _ index: Int) {
        inputFocused = false
        selectedSource = SelectedSource(messageID: message.id, index: index)
    }
}

/// 复制回答按钮：点击后 1.6s 显示已复制（与安卓一致）。
private struct CopyButton: View {
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
private struct SourceReader: View {
    let source: AskSource
    let number: Int
    let onBack: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                Button(action: onBack) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundStyle(SiteTheme.ink)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("返回对话")
                Text("引用 \(number)")
                    .font(SiteText.title)
                    .foregroundStyle(SiteTheme.ink)
                Spacer()
            }
            ScrollView {
                VStack(alignment: .leading, spacing: SiteSpace.paragraph) {
                    Text(source.title.isEmpty ? "引用资料" : source.title)
                        .font(SiteText.pageTitle)
                        .foregroundStyle(SiteTheme.ink)
                        .lineSpacing(SiteText.bodyLineSpacing)
                    Text(
                        [source.section, source.publishedAt]
                            .compactMap { $0 }
                            .filter { !$0.isEmpty }
                            .joined(separator: " · "),
                    )
                    .siteMetaStyle(SiteTheme.muted)
                    Text("本次检索返回的资料片段")
                        .font(SiteText.label)
                        .foregroundStyle(SiteTheme.muted)
                    Text(source.content.isEmpty ? "该引用没有返回可阅读的正文。" : source.content)
                        .siteBodyStyle()
                }
                .padding(SiteSpace.page)
                .frame(maxWidth: .infinity, alignment: .leading)
                .textSelection(.enabled)
            }
        }
    }
}

extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
