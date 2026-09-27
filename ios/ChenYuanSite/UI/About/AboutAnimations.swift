import SwiftUI

// 与 Web ProfileIntroduction 的问候语与 2600ms 停顿、72ms 逐字节奏一致。
private let greetings = [
    "你好，", "Hello,", "Hola,", "こんにちは、", "안녕하세요,", "Bonjour,", "नमस्ते,", "Ciao,", "Olá,", "Hallo,", "Merhaba,", "Привет,", "مرحبًا،", "สวัสดีครับ,",
]

/// 打字机问候：为全部脚本预留最大字体度量，避免切换时布局跳动。
struct ProfileGreeting: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var greeting = greetings[0]
    @State private var visible = false

    var body: some View {
        ZStack(alignment: .leading) {
            ForEach(greetings, id: \.self) { text in
                Text(text).font(SiteText.title).opacity(0).lineLimit(1).fixedSize(horizontal: false, vertical: true)
            }
            Text(greeting).font(SiteText.title).foregroundStyle(SiteTheme.ink).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("你好")
        .onAppear { visible = true }
        .onDisappear { visible = false }
        .task(id: visible) {
            // 减弱动态时保持静态问候（对齐安卓 areAnimatorsEnabled 分支）。
            guard visible, !reduceMotion else { return }
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
private let laneCount = 6
private let pillHeight: CGFloat = 22
private let pillGap: CGFloat = 112

/// 六条泳道：词条按下标取模分组（与安卓 lanes 一致）。
private let marqueeLanes: [[String]] = {
    (0..<laneCount).map { lane in technicalTerms.enumerated().filter { $0.offset % laneCount == lane }.map { $0.element } }
}()

/// 六条泳道的词条跑马灯 + 点阵背景：可见时才推进动画。
struct TechnicalTerms: View {
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var visible = false
    @State private var startDate = Date()
    @State private var layout = MarqueeLayout()

    private static let fadeWidth: CGFloat = 18

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 60.0, paused: !visible || reduceMotion)) { context in
            // 减弱动态时冻结在初始相位（对齐安卓 areAnimatorsEnabled 分支）。
            let elapsed: Float = reduceMotion ? 0 : Float(context.date.timeIntervalSince(startDate))
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
        var top: [CGFloat] = []

        func rebuild(size: CGSize, context: GraphicsContext) {
            canvasSize = size
            let step: CGFloat = 9
            let radius: CGFloat = 0.65
            var dots = Path()
            var x: CGFloat = 0
            while x <= size.width + step {
                var y: CGFloat = 0
                while y <= size.height + step {
                    dots.addEllipse(in: CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2))
                    y += step
                }
                x += step
            }
            self.dots = dots

            resolved = marqueeLanes.map { $0.map { context.resolve(Text($0).font(.system(size: 12))) } }
            widths = resolved.map { $0.map { $0.measure(in: CGSize(width: 600, height: 40)).width + 16 } }
            lengths = widths.map { $0.reduce(0, +) + pillGap * CGFloat($0.count) }
            top = (0..<laneCount).map { CGFloat($0) * (size.height - pillHeight) / CGFloat(laneCount - 1) }
        }
    }

    private func draw(context: GraphicsContext, size: CGSize, elapsed: Float) {
        if layout.canvasSize != size || layout.colorScheme != colorScheme {
            layout.rebuild(size: size, context: context)
            layout.colorScheme = colorScheme
        }
        context.fill(layout.dots, with: .color(SiteTheme.ink.opacity(0.12)))

        let pill = RoundedRectangle(cornerRadius: 3, style: .continuous)
        for (lane, words) in marqueeLanes.enumerated() {
            let widths = layout.widths[lane]
            let length = layout.lengths[lane]
            let rawPhase: Float = (elapsed + Float(lane) * 1.7) / laneDurations[lane]
            let phaseOffset = CGFloat(rawPhase - rawPhase.rounded(.down))

            var cursor: CGFloat = -phaseOffset * length
            var drawn = 0
            while cursor < size.width, drawn < 96 {
                drawn += 1
                for (index, _) in words.enumerated() {
                    defer { cursor += widths[index] + pillGap }
                    guard cursor + widths[index] > 0, cursor < size.width else { continue }
                    let top = layout.top[lane]
                    let rect = CGRect(x: cursor, y: top, width: widths[index], height: pillHeight)
                    let pillPath = pill.path(in: rect)
                    context.fill(pillPath, with: .color(SiteTheme.background.opacity(0.96)))
                    context.stroke(pillPath, with: .color(SiteTheme.ink.opacity(0.25)), lineWidth: 0.7)
                    // ResolvedText 可跨帧复用（环境一致），绘制不重复排版。
                    context.draw(layout.resolved[lane][index], at: CGPoint(x: cursor + widths[index] / 2, y: top + pillHeight / 2))
                }
            }
        }

        // 左右边缘用背景色渐隐（与安卓的 fade 一致，同时盖住点阵）。
        for leading: Bool in [true, false] {
            let x = leading ? CGFloat(0) : size.width - Self.fadeWidth
            context.fill(
                Path(CGRect(x: x, y: 0, width: Self.fadeWidth, height: size.height)),
                with: .linearGradient(
                    Gradient(colors: leading ? [SiteTheme.background, SiteTheme.background.opacity(0)] : [SiteTheme.background.opacity(0), SiteTheme.background]),
                    startPoint: CGPoint(x: x, y: 0),
                    endPoint: leading ? CGPoint(x: Self.fadeWidth, y: 0) : CGPoint(x: size.width, y: 0),
                ),
            )
        }
    }
}
