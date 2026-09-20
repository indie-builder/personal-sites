import ImageIO
import SwiftUI
import UIKit

/// 开场：Web 原素材人物序列播放一次 + 电池五格充电，5 秒后 800ms 上滑揭幕。
/// 点击任意处跳过；减弱动态时直接跳过（对应安卓 areAnimatorsEnabled 分支）。
struct OpeningView: View {
    let onComplete: () -> Void

    @State private var frames: [CGImage] = []
    @State private var frameDurations: [Double] = []
    @State private var currentFrame = 0
    @State private var startedAt = Date()
    @State private var revealing = false

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Color.white
                VStack(spacing: 0) {
                    ZStack(alignment: .top) {
                        if !frames.isEmpty, let image = frames[safe: currentFrame] {
                            Image(image, scale: 1, label: Text("开场人物"))
                                .resizable()
                                .scaledToFit()
                                .frame(width: 180, height: 176)
                        }
                        BatteryIndicator(startedAt: startedAt)
                            .padding(.top, 3)
                    }
                }
                .frame(width: 180, height: 176)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .offset(y: revealing ? -proxy.size.height : 0)
            .contentShape(Rectangle())
            .onTapGesture { complete() }
        }
        .ignoresSafeArea()
        .task { await run() }
    }

    private func run() async {
        guard !UIAccessibility.isReduceMotionEnabled else {
            complete()
            return
        }
        // GIF 逐帧解码移出主线程：启动路径上同步解码全部帧会阻塞首帧。
        let decoded = await Task.detached(priority: .userInitiated) {
            Self.loadFrames()
        }.value
        frames = decoded.frames
        frameDurations = decoded.durations
        guard !frames.isEmpty else {
            complete()
            return
        }
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await playCharacterOnce() }
            group.addTask { await revealAfterDelay() }
        }
    }

    /// GIF 序列播放一次（对应安卓 repeatCount = 0）。
    private func playCharacterOnce() async {
        for (index, _) in frames.enumerated() {
            guard !Task.isCancelled else { return }
            currentFrame = index
            let duration = frameDurations.indices.contains(index) ? frameDurations[index] : 0.1
            try? await Task.sleep(for: .seconds(duration))
        }
    }

    private func revealAfterDelay() async {
        try? await Task.sleep(for: .seconds(5))
        guard !Task.isCancelled else { return }
        withAnimation(.timingCurve(0.76, 0, 0.24, 1, duration: 0.8)) {
            revealing = true
        }
        try? await Task.sleep(for: .seconds(0.8))
        complete()
    }

    private func complete() {
        onComplete()
    }

    /// GIF 序列一次性解码（对应安卓 repeatCount = 0）；在后台线程执行。
    private nonisolated static func loadFrames() -> (frames: [CGImage], durations: [Double]) {
        var frames: [CGImage] = []
        var durations: [Double] = []
        guard let url = Bundle.main.url(forResource: "opening_character", withExtension: "gif"),
            let source = CGImageSourceCreateWithURL(url as CFURL, nil)
        else { return (frames, durations) }
        let count = CGImageSourceGetCount(source)
        for index in 0..<count {
            if let image = CGImageSourceCreateImageAtIndex(source, index, nil) {
                frames.append(image)
            }
            var delay = 0.1
            if let properties = CGImageSourceCopyPropertiesAtIndex(source, index, nil) as? [CFString: Any],
                let gif = properties[kCGImagePropertyGIFDictionary] as? [CFString: Any],
                let value = gif[kCGImagePropertyGIFDelayTime] as? Double
            {
                delay = max(value, 0.02)
            }
            durations.append(delay)
        }
        return (frames, durations)
    }
}

/// 电池五格充电：0→4.7s 充满，颜色 红→黄→绿（与 Web/安卓一致）。
private struct BatteryIndicator: View {
    let startedAt: Date

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { timeline in
            Canvas { context, size in
                let t = Float(timeline.date.timeIntervalSince(startedAt))
                let progress = min(max(t / 4.7, 0), 1)
                let red = Color(red: 0xEF / 255, green: 0x44 / 255, blue: 0x44 / 255)
                let yellow = Color(red: 0xF2 / 255, green: 0xC9 / 255, blue: 0x4C / 255)
                let green = Color(red: 0x24 / 255, green: 0xCB / 255, blue: 0x71 / 255)
                let color: Color =
                    if progress < 0.18 {
                        red
                    } else if progress < 0.52 {
                        lerp(red, yellow, CGFloat((progress - 0.18) / 0.34))
                    } else {
                        lerp(yellow, green, CGFloat((progress - 0.52) / 0.48))
                    }
                let dark = Color(red: 0x16 / 255, green: 0x16 / 255, blue: 0x16 / 255)

                let bodyWidth = size.width - 3
                let corner: CGFloat = 5
                context.fill(
                    Path(roundedRect: CGRect(x: 0, y: 0, width: bodyWidth, height: size.height), cornerRadius: corner),
                    with: .color(.white),
                )
                context.stroke(
                    Path(roundedRect: CGRect(x: 0, y: 0, width: bodyWidth, height: size.height), cornerRadius: corner),
                    with: .color(dark),
                    lineWidth: 1.5,
                )
                context.fill(
                    Path(CGRect(x: bodyWidth, y: size.height * 0.3, width: 3, height: size.height * 0.4)),
                    with: .color(dark),
                )

                let inset: CGFloat = 3
                let gap: CGFloat = 2
                let barWidth = (bodyWidth - inset * 2 - gap * 4) / 5
                for index in 0..<5 {
                    let charge = min(max((t - (0.45 + Float(index) * 0.95)) / 0.18, 0), 1)
                    let height = (size.height - inset * 2) * CGFloat(0.55 + charge * 0.45)
                    let rect = CGRect(
                        x: inset + CGFloat(index) * (barWidth + gap),
                        y: (size.height - height) / 2,
                        width: barWidth,
                        height: height,
                    )
                    context.fill(
                        Path(roundedRect: rect, cornerRadius: 1.5),
                        with: .color(color.opacity(CGFloat(charge))),
                    )
                }
            }
        }
        .frame(width: 52, height: 18)
    }

    private func lerp(_ from: Color, _ to: Color, _ t: CGFloat) -> Color {
        var fromRed: CGFloat = 0, fromGreen: CGFloat = 0, fromBlue: CGFloat = 0, fromAlpha: CGFloat = 0
        var toRed: CGFloat = 0, toGreen: CGFloat = 0, toBlue: CGFloat = 0, toAlpha: CGFloat = 0
        UIColor(from).getRed(&fromRed, green: &fromGreen, blue: &fromBlue, alpha: &fromAlpha)
        UIColor(to).getRed(&toRed, green: &toGreen, blue: &toBlue, alpha: &toAlpha)
        return Color(
            red: fromRed + (toRed - fromRed) * t,
            green: fromGreen + (toGreen - fromGreen) * t,
            blue: fromBlue + (toBlue - fromBlue) * t,
        )
    }
}
