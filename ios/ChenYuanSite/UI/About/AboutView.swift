import SwiftUI

/// 个人介绍页：识别陈远、读他的工程实践、打开经历或外部笔记。
/// 身份与经历构成一个整体：右上外部链接、名字与头像、履历入口、
/// 自我介绍流入技术领域，无页脚动作。
struct AboutView: View {
    @Environment(\.openURL) private var openURL
    @State private var showCareer = false
    let bottomPadding: CGFloat
    let onScrollDelta: (CGFloat) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                identity
                ProfileGreeting()
                Spacer().frame(height: SiteSpace.paragraph)
                bio
                Spacer().frame(height: SiteSpace.section)
                TechnicalTerms()
                Spacer().frame(height: SiteSpace.section)
            }
            .padding(.horizontal, SiteSpace.page)
            .padding(.top, SiteSpace.related)
            .padding(.bottom, bottomPadding + SiteSpace.section)
        }
        .onScrollGeometryChange(for: CGFloat.self) { $0.contentOffset.y } action: { old, new in
            onScrollDelta(new - old)
        }
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $showCareer) {
            AboutSheet()
        }
    }

    private var identity: some View {
        VStack(spacing: SiteSpace.compact) {
            HStack(spacing: SiteSpace.paragraph) {
                Spacer()
                externalLink("GitHub", urlString: "https://github.com/indie-builder")
                externalLink("语雀", urlString: "https://www.yuque.com/defulat-coder")
            }
            HStack(alignment: .center, spacing: SiteSpace.paragraph) {
                VStack(alignment: .leading, spacing: SiteSpace.compact) {
                    Text("陈远")
                        .font(SiteText.identity)
                        .foregroundStyle(SiteTheme.ink)
                    Text("@indie-builder")
                        .siteSummaryStyle(SiteTheme.muted)
                }
                Spacer()
                Image("profile_avatar")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 104, height: 104)
                    .accessibilityLabel("陈远的头像插画")
            }
            Button {
                showCareer = true
            } label: {
                HStack(spacing: SiteSpace.related) {
                    Text("2014—至今")
                        .font(SiteText.label)
                        .foregroundStyle(SiteTheme.ink)
                    Text("个人经历")
                        .siteMetaStyle(SiteTheme.muted)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(SiteTheme.ink)
                }
                .padding(.vertical, SiteSpace.related)
                .frame(minHeight: 56)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("查看个人经历")
        }
    }

    private func externalLink(_ label: String, urlString: String) -> some View {
        Button {
            if let url = URL(string: urlString) { openURL(url) }
        } label: {
            HStack(spacing: 6) {
                Text(label)
                    .siteMetaStyle(SiteTheme.muted)
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(SiteTheme.muted)
            }
            .padding(.horizontal, SiteSpace.micro)
            .frame(minHeight: SiteSpace.touch)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("在浏览器打开\(label)")
    }

    private var bio: some View {
        VStack(alignment: .leading, spacing: SiteSpace.paragraph) {
            Text("十余年项目开发经验，横跨 Java、Python、TypeScript 与前端；从业务平台、云服务到企业 AI，一直在做需要长期负责的工程系统。")
                .siteBodyStyle(SiteTheme.muted)
            Text("现在关心 AI 如何进入真实工作，Web 如何成为新的创造界面，以及系统如何经得起长期使用。")
                .siteBodyStyle(SiteTheme.muted)
            Text("这里记录正在构建的东西，以及那些值得继续拆解的工程问题。")
                .siteBodyStyle(SiteTheme.muted)
        }
    }
}

// 与 Web ProfileIntroduction 的问候语与 2600ms 停顿、72ms 逐字节奏一致。
private let greetings = [
    "你好，", "Hello,", "Hola,", "こんにちは、", "안녕하세요,", "Bonjour,", "नमस्ते,", "Ciao,", "Olá,", "Hallo,", "Merhaba,", "Привет,", "مرحبًا،", "สวัสดีครับ,",
]

/// 打字机问候：为全部脚本预留最大字体度量，避免切换时布局跳动。
private struct ProfileGreeting: View {
    @State private var greeting = greetings[0]
    @State private var visible = false

    var body: some View {
        ZStack(alignment: .leading) {
            ForEach(greetings, id: \.self) { text in
                Text(text)
                    .font(SiteText.title)
                    .opacity(0)
                    .lineLimit(1)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Text(greeting)
                .font(SiteText.title)
                .foregroundStyle(SiteTheme.ink)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("你好")
        .onAppear { visible = true }
        .onDisappear { visible = false }
        .task(id: visible) {
            guard visible else { return }
            var index = 0
            greeting = greetings[0]
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(2600))
                guard !Task.isCancelled else { return }
                index = (index + 1) % greetings.count
                let next = greetings[index]
                for character in 1...next.count {
                    guard !Task.isCancelled else { return }
                    greeting = String(next.prefix(character))
                    try? await Task.sleep(for: .milliseconds(72))
                }
            }
        }
    }
}

// Web interactive-dot-field 的六条泳道，复用同一组公开技术词条。
private let technicalTerms = [
    "retry.policy", "human.in.loop", "agent.runtime", "tool.call()",
    "rag.retrieval", "sse.stream", "planner.agent", "memory.store",
    "function.calling", "eval.loop", "context.engine", "ship.systems",
    "React.js", "Next.js", "TypeScript", "Node.js", "Python", "Postgres",
    "Docker", "Kubernetes", "Tailwind CSS", "Git/GitHub", "JavaScript",
    "Sass", "Express.js", "Redux", "Java", "Spring", "Spring Boot",
    "Spring Cloud", "MyBatis", "MySQL", "Redis", "RabbitMQ", "Elasticsearch",
    "Maven", "Nginx",
]
private let laneDurations: [Float] = [63, 69, 60, 81, 72, 66]

/// 六条泳道：词条按下标取模分组（与安卓 lanes 一致）。
private let marqueeLanes: [[String]] = {
    (0..<6).map { lane in technicalTerms.enumerated().filter { $0.offset % 6 == lane }.map { $0.element } }
}()

/// 六条泳道的词条跑马灯 + 点阵背景：可见时才推进动画。
private struct TechnicalTerms: View {
    @Environment(\.colorScheme) private var colorScheme
    @State private var visible = false
    @State private var startDate = Date()
    @State private var layout = MarqueeLayout()

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 60.0, paused: !visible)) { context in
            let elapsed = Float(context.date.timeIntervalSince(startDate))
            Canvas { context, size in
                draw(context: context, size: size, elapsed: elapsed)
            }
        }
        .frame(height: 140)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("技术词条：" + technicalTerms.joined(separator: "、"))
        .onAppear {
            startDate = Date()
            visible = true
        }
        .onDisappear { visible = false }
    }

    /// 布局缓存：词条 resolve/measure 与点阵路径只在尺寸/外观变化时重建，
    /// 帧推进只做绘制（对齐安卓 drawWithCache 的缓存语义）。
    /// ResolvedText 会按 resolve 当时的 colorScheme 烘焙样式，故外观入失效键。
    private final class MarqueeLayout {
        var canvasSize = CGSize(width: -1, height: -1)
        var colorScheme: ColorScheme?
        var dots = Path()
        var resolved: [[GraphicsContext.ResolvedText]] = []
        var widths: [[CGFloat]] = []
        var lengths: [CGFloat] = []
        var pillHeight: CGFloat = 0
        var top: [CGFloat] = []

        func rebuild(size: CGSize, context: GraphicsContext) {
            canvasSize = size
            let step: CGFloat = 9
            let dotRadius: CGFloat = 0.65
            var dots = Path()
            var x: CGFloat = 0
            while x <= size.width + step {
                var y: CGFloat = 0
                while y <= size.height + step {
                    dots.addEllipse(
                        in: CGRect(x: x - dotRadius, y: y - dotRadius, width: dotRadius * 2, height: dotRadius * 2),
                    )
                    y += step
                }
                x += step
            }
            self.dots = dots

            let padding: CGFloat = 8
            let gap: CGFloat = 112
            let fontSize: CGFloat = 12
            resolved = marqueeLanes.map { words in words.map { context.resolve(Text($0).font(.system(size: fontSize))) } }
            widths = resolved.map { texts in texts.map { $0.measure(in: CGSize(width: 600, height: 40)).width + padding * 2 } }
            lengths = widths.map { row in row.reduce(0, +) + gap * CGFloat(row.count) }
            pillHeight = 22
            top = (0..<marqueeLanes.count).map { CGFloat($0) * (size.height - pillHeight) / CGFloat(marqueeLanes.count - 1) }
        }
    }

    private func draw(context: GraphicsContext, size: CGSize, elapsed: Float) {
        if layout.canvasSize != size || layout.colorScheme != colorScheme {
            layout.rebuild(size: size, context: context)
            layout.colorScheme = colorScheme
        }
        context.fill(layout.dots, with: .color(SiteTheme.ink.opacity(0.12)))

        let gap: CGFloat = 112
        let padding: CGFloat = 8

        for (lane, words) in marqueeLanes.enumerated() {
            let widths = layout.widths[lane]
            let length = layout.lengths[lane]
            let rawPhase: Float = (elapsed + Float(lane) * 1.7) / laneDurations[lane]
            let phaseOffset = CGFloat(rawPhase - rawPhase.rounded(.down))
            let top = layout.top[lane]
            let pill = RoundedRectangle(cornerRadius: 3, style: .continuous)

            var cursor: CGFloat = -phaseOffset * length
            var guardCounter = 0
            while cursor < size.width, guardCounter < 96 {
                guardCounter += 1
                for (index, _) in words.enumerated() {
                    let width = widths[index]
                    if cursor + width > 0, cursor < size.width {
                        let rect = CGRect(x: cursor, y: top, width: width, height: layout.pillHeight)
                        let pillPath = pill.path(in: rect)
                        context.fill(pillPath, with: .color(SiteTheme.background.opacity(0.96)))
                        context.stroke(pillPath, with: .color(SiteTheme.ink.opacity(0.25)), lineWidth: 0.7)
                        // ResolvedText 可跨帧复用（环境一致），绘制不重复排版。
                        context.draw(layout.resolved[lane][index], at: CGPoint(x: cursor + width / 2, y: top + layout.pillHeight / 2))
                    }
                    cursor += width + gap
                }
            }
        }

        // 左右边缘用背景色渐隐（与安卓的 fade 一致，同时盖住点阵）。
        let fadeWidth: CGFloat = 18
        context.fill(
            Path(CGRect(x: 0, y: 0, width: fadeWidth, height: size.height)),
            with: .linearGradient(
                Gradient(colors: [SiteTheme.background, SiteTheme.background.opacity(0)]),
                startPoint: CGPoint(x: 0, y: 0),
                endPoint: CGPoint(x: fadeWidth, y: 0),
            ),
        )
        context.fill(
            Path(CGRect(x: size.width - fadeWidth, y: 0, width: fadeWidth, height: size.height)),
            with: .linearGradient(
                Gradient(colors: [SiteTheme.background.opacity(0), SiteTheme.background]),
                startPoint: CGPoint(x: size.width - fadeWidth, y: 0),
                endPoint: CGPoint(x: size.width, y: 0),
            ),
        )
    }
}

/// 履历小票：与站点履历打印稿一致的四段经历（components/about-print.tsx），
/// 保留细线与条码，字体遵循全应用规范。
private struct AboutSheet: View {
    private struct ReceiptItem {
        let company: String
        let meta: String
        let years: String
    }

    private let receiptItems = [
        ReceiptItem(company: "PLUS数字科技", meta: "2014—2019 · Java · 服务运维", years: "5 年"),
        ReceiptItem(company: "红星美凯龙", meta: "2019—2023 · 业务 · 集团架构", years: "4 年"),
        ReceiptItem(company: "喜马拉雅", meta: "2023—2026 · 企业 AI 应用", years: "3 年"),
        ReceiptItem(company: "PayerMax", meta: "2026— · OPT · 端到端交付", years: "至今"),
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                Text("陈远 / CHEN YUAN")
                    .font(SiteText.title)
                    .foregroundStyle(SiteTheme.ink)
                Spacer().frame(height: SiteSpace.micro)
                Text("个人经历 · CAREER RECEIPT")
                    .siteMetaStyle(SiteTheme.quiet)
                Spacer().frame(height: SiteSpace.paragraph)
                Rectangle().fill(SiteTheme.ink).frame(height: 1)
                Spacer().frame(height: SiteSpace.paragraph)
                ForEach(Array(receiptItems.enumerated()), id: \.offset) { _, item in
                    HStack {
                        Text(item.company)
                            .font(SiteText.label)
                            .foregroundStyle(SiteTheme.ink)
                        Spacer()
                        Text(item.years)
                            .siteSummaryStyle(SiteTheme.ink)
                    }
                    Text(item.meta)
                        .siteMetaStyle(SiteTheme.muted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 2)
                        .padding(.bottom, SiteSpace.related)
                }
                Rectangle().fill(SiteTheme.ink).frame(height: 1)
                Spacer().frame(height: SiteSpace.paragraph)
                HStack {
                    Text("合计 TOTAL")
                        .siteSummaryStyle(SiteTheme.ink)
                    Spacer()
                    Text("12 年")
                        .font(SiteText.title)
                        .foregroundStyle(SiteTheme.ink)
                }
                Spacer().frame(height: SiteSpace.compact)
                Text("十二年 · 四段路 · 仍在增长")
                    .siteMetaStyle(SiteTheme.quiet)
                Spacer().frame(height: SiteSpace.paragraph)
                ReceiptBarcode()
                    .frame(height: 36)
                    .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, SiteSpace.page)
            .padding(.top, SiteSpace.section)
            .padding(.bottom, SiteSpace.section)
        }
        .presentationDetents([.medium, .large])
        .presentationBackground(SiteTheme.background)
    }
}

/// 装饰条码：确定性伪随机宽度的竖条，纯观感。
private struct ReceiptBarcode: View {
    var body: some View {
        Canvas { context, size in
            var x: CGFloat = 0
            var seed: UInt64 = 7
            while x < size.width {
                seed = seed &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
                let wide = (seed >> 33) & 3 > 1
                let barWidth = wide ? size.width / 90 : size.width / 220
                context.fill(
                    Path(CGRect(x: x, y: 0, width: barWidth, height: size.height)),
                    with: .color(SiteTheme.ink),
                )
                x += barWidth + size.width / 160
            }
        }
    }
}
