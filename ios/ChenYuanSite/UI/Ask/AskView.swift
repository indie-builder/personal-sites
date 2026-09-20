import SwiftUI

/// 推荐问题与其检索范围成对声明，避免按文案字符串反推范围（docs/ask-experience.md：推荐问题会选对应范围）。
private let recommendedQuestions: [(question: String, scope: AskScope)] = [
    ("介绍一下陈远", .profile),
    ("最近关注哪些 AI 技术？", .aiNews),
    ("有哪些值得了解的开源项目？", .openSource),
]

/// 全屏原生问答：SSE 流式回答、引用编号应用内阅读、停止/重试/新对话。
/// demoResetPrompt 是 -ask-reset 演示参数的触发信号（见 RootView）。
struct AskView: View {
    var demoResetPrompt = false

    @Environment(AppEnvironment.self) private var env
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    @State private var input = ""
    @State private var searchScope: AskScope = .all
    @State private var followLatest = true
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
                SourceReader(source: source, number: selectedSource.index + 1) { self.selectedSource = nil }
            } else {
                VStack(spacing: 0) {
                    header
                    messageList
                    composer
                }
            }
        }
        .background(SiteTheme.background)
        .alert("开始新对话？", isPresented: $confirmReset) {
            Button("取消", role: .cancel) {}
            Button("新对话", role: .destructive) {
                controller.newConversation()
                input = ""
                followLatest = true
            }
        } message: {
            Text("当前对话和输入草稿将清空。")
        }
        // 演示信号挂在 body 顶层：引用阅读页打开时也能触发确认弹窗。
        .onChange(of: demoResetPrompt) { _, prompted in
            if prompted { confirmReset = true }
        }
        .onDisappear { controller.cancel() }
    }

    private var header: some View {
        HStack(spacing: SiteSpace.compact) {
            BackButton { dismiss() }
            VStack(alignment: .leading, spacing: 0) {
                Text("问一问").font(SiteText.title).foregroundStyle(SiteTheme.ink)
                Text("基于站内资料 · 引用可在应用内阅读").siteMetaStyle(SiteTheme.muted)
            }
            Spacer()
            Button("新对话") {
                if !controller.messages.isEmpty || !input.isEmpty { confirmReset = true }
            }
            .font(SiteText.meta).foregroundStyle(SiteTheme.ink).buttonStyle(.plain).padding(.trailing, SiteSpace.compact)
        }
        .padding(.horizontal, SiteSpace.compact)
    }

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: SiteSpace.section) {
                    if controller.messages.isEmpty { emptyState }
                    ForEach(controller.messages) { messageView($0) }
                    Spacer().frame(height: SiteSpace.touch).id("conversation-end")
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
            } action: { _, canScrollForward in
                if isScrolling { followLatest = !canScrollForward }
            }
            .overlay(alignment: .bottom) {
                if !followLatest {
                    Button {
                        followLatest = true
                        withAnimation(.easeOut(duration: 0.25)) { proxy.scrollTo("conversation-end", anchor: .bottom) }
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
            Text("有什么想了解的？").font(SiteText.pageTitle).foregroundStyle(SiteTheme.ink).padding(.top, 40)
            Text("关于陈远、每日关注或开源内容，都可以从这里开始。").siteBodyStyle(SiteTheme.muted)
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
                        .overlay(RoundedRectangle(cornerRadius: 24).strokeBorder(SiteTheme.line, lineWidth: 1))
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
                    .textSelection(.enabled)
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
        let isLast = controller.messages.last?.id == message.id
        return VStack(alignment: .leading, spacing: SiteSpace.related) {
            if !message.text.isEmpty {
                MarkdownView(text: message.text, sourceCount: message.sources.count) { openSource(message, $0) }
            } else {
                Text(placeholderText(for: message.status)).siteBodyStyle(SiteTheme.muted)
            }
            if message.status == .stopped, !message.text.isEmpty {
                Text("已停止生成").siteMetaStyle(SiteTheme.muted)
            }
            if !message.sources.isEmpty {
                Text(message.text.isEmpty ? "检索到的资料" : "参考资料 · 点击查看依据").siteMetaStyle(SiteTheme.muted)
                sourceList(message)
            }
            if isLast, let error = controller.error {
                Text(error).siteSummaryStyle(.red)
            }
            HStack(spacing: SiteSpace.compact) {
                if !message.text.isEmpty { CopyButton(text: message.text) }
                if isLast, !controller.streaming {
                    IconButton(
                        systemName: "arrow.counterclockwise",
                        accessibilityLabel: message.status == .error ? "重试回答" : "重新生成回答",
                    ) {
                        followLatest = true
                        controller.retryLast()
                    }
                }
            }
        }
    }

    /// 引用列表：按位置标识（对齐安卓 forEachIndexed）：服务端 id 重复时不会产生
    /// 重复 ForEach 身份；编号即列表序号，与正文【n】一致。
    private func sourceList(_ message: AskMessage) -> some View {
        ForEach(Array(message.sources.enumerated()), id: \.offset) { number, source in
            Button {
                openSource(message, number)
            } label: {
                HStack(alignment: .firstTextBaseline, spacing: SiteSpace.related) {
                    Text("\(number + 1)").font(SiteText.label).foregroundStyle(SiteTheme.ink)
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
            TextField("输入你的问题…", text: $input, axis: .vertical)
                .font(SiteText.body)
                .lineSpacing(SiteText.bodyLineSpacing)
                .lineLimit(1...6)
                .padding(SiteSpace.compact)
                .focused($inputFocused)
                .tint(SiteTheme.ink)
            HStack(spacing: SiteSpace.compact) {
                scopeMenu
                if trimmedLength > 1000 {
                    Text("最多 1000 字").siteMetaStyle(.red)
                } else if trimmedLength > 0, trimmedLength < 2 {
                    Text("至少 2 个字").siteMetaStyle(.red)
                }
                Spacer()
                sendButton(validInput: validInput)
            }
        }
        .padding(SiteSpace.compact)
        .background(RoundedRectangle(cornerRadius: 24).fill(SiteTheme.line))
        .padding(.horizontal, SiteSpace.paragraph)
        .padding(.vertical, SiteSpace.compact)
    }

    private var scopeMenu: some View {
        Menu {
            ForEach(AskScope.allCases) { scope in
                Button(scope.label) { searchScope = scope }
            }
        } label: {
            HStack(spacing: 2) {
                Text(searchScope.label).font(SiteText.meta)
                Image(systemName: "chevron.down").font(.system(size: 10, weight: .medium))
            }
            .foregroundStyle(SiteTheme.ink)
            .padding(.vertical, 6)
            .contentShape(Rectangle())
        }
        .disabled(controller.streaming)
        .padding(.leading, SiteSpace.compact)
    }

    private func sendButton(validInput: Bool) -> some View {
        let active = controller.streaming || validInput
        return Button {
            if controller.streaming { controller.cancel() } else { send(validInput: validInput) }
        } label: {
            Image(systemName: controller.streaming ? "stop.fill" : "arrow.up")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(active ? SiteTheme.background : SiteTheme.muted)
                .frame(width: SiteSpace.touch, height: SiteSpace.touch)
                .background(Circle().fill(active ? SiteTheme.ink : SiteTheme.line))
        }
        .buttonStyle(.plain)
        .disabled(!active)
        .accessibilityLabel(controller.streaming ? "停止生成" : "发送")
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
