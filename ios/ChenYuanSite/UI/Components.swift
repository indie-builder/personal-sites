import SwiftUI

// MARK: - 共享小部件

/// 全站统一按压反馈：长文行用背景高亮（对应站点行按压），紧凑控件用 0.98 微缩。
/// 减弱动态时不位移，按压状态即时切换。
struct SitePressStyle: ButtonStyle {
    enum Variant { case row, compact }

    private let variant: Variant
    private init(_ variant: Variant) { self.variant = variant }

    static let row = SitePressStyle(.row)
    static let compact = SitePressStyle(.compact)

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background {
                if variant == .row, configuration.isPressed {
                    Rectangle().fill(SiteTheme.ink.opacity(0.06))
                }
            }
            .scaleEffect(configuration.isPressed && !reduceMotion && variant == .compact ? 0.98 : 1)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// 固定身份入口：头像与姓名作为整体，不随栏目横向滚动。
struct ProfileLink: View {
    var body: some View {
        NavigationLink(value: Route.about) {
            HStack(spacing: 6) {
                Image("profile_avatar")
                    .resizable().scaledToFill()
                    .frame(width: 28, height: 28)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                Text("陈远")
                    .font(SiteText.tabSelected)
                    .foregroundStyle(SiteTheme.ink)
            }
            .frame(minWidth: 44, minHeight: SiteSpace.touch)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("关于陈远")
        .accessibilityIdentifier("profile-link")
    }
}

/// 44pt 返回按钮（详情顶栏 / 问一问头部 / 引用阅读共用）。
struct BackButton: View {
    var label = "返回"
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "chevron.left")
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(SiteTheme.ink)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(SitePressStyle.compact)
        .accessibilityLabel(label)
    }
}

/// 方形图标按钮（复制 / 重试 / 回到底部等）。
struct IconButton: View {
    let systemName: String
    let accessibilityLabel: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 15))
                .foregroundStyle(SiteTheme.muted)
                .frame(width: SiteSpace.touch, height: SiteSpace.touch)
                .contentShape(Rectangle())
        }
        .buttonStyle(SitePressStyle.compact)
        .accessibilityLabel(accessibilityLabel)
    }
}

/// 网络图占位统一为 line 底色；fill 需要外层裁切与宽高比。
/// 加载失败给出「重试」入口（attempt 变更重建 AsyncImage 重新拉取）；
/// 微小展示位（如 24pt 工具图标，容不下 44pt 触控目标）传
/// showsRetry: false 只显示占位图标，随页面刷新恢复。
/// 视频封面等中央被其他控件占用的槽位传 retryAlignment: .bottom，
/// 让重试入口与中央控件互不遮挡。
struct RemoteImage: View {
    let url: URL?
    var contentMode: ContentMode = .fill
    var showsRetry = true
    var retryAlignment: Alignment = .center

    @State private var attempt = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        AsyncImage(url: url) { phase in
            Group {
                if let image = phase.image {
                    image.resizable().aspectRatio(nil, contentMode: contentMode)
                        .transition(.opacity)
                } else if phase.error != nil {
                    if showsRetry { retryView.transition(.opacity) } else { placeholderGlyph.transition(.opacity) }
                } else {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                        .transition(.opacity)
                }
            }
            .animation(reduceMotion ? nil : .easeOut(duration: 0.15), value: phase.image != nil)
        }
        .id(attempt)
    }

    private var retryView: some View {
        Button {
            attempt += 1
        } label: {
            VStack(spacing: 4) {
                Image(systemName: "arrow.clockwise").font(.system(size: 15, weight: .medium))
                Text("重试").font(SiteText.eyebrow)
            }
            .padding(SiteSpace.compact)
            .foregroundStyle(SiteTheme.muted)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: retryAlignment)
            .frame(minWidth: SiteSpace.touch, minHeight: SiteSpace.touch)
            .contentShape(Rectangle())
        }
        .buttonStyle(SitePressStyle.compact)
        .accessibilityLabel("图片加载失败，点击重试")
        .accessibilityIdentifier("image-retry")
    }

    private var placeholderGlyph: some View {
        Image(systemName: "photo").foregroundStyle(SiteTheme.muted)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// 加载失败的「消息 + 重试」组合：重试满足 48pt 触控高度与 Button 语义。
struct ErrorRetry: View {
    let message: String
    var onRetry: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            Text(message).siteSummaryStyle().multilineTextAlignment(.center)
            Button(action: onRetry) {
                Text("重试")
                    .font(SiteText.eyebrow)
                    .foregroundStyle(SiteTheme.ink)
                    .padding(.horizontal, SiteSpace.paragraph)
                    .padding(.vertical, SiteSpace.compact)
                    .frame(minHeight: SiteSpace.touch)
            }
            .buttonStyle(SitePressStyle.compact)
            .frame(minHeight: SiteSpace.touch)
            .accessibilityLabel("重新加载内容")
            .clipShape(RoundedRectangle(cornerRadius: 6))
        }
        .padding(32)
    }
}

/// 发丝分隔线（对应安卓 HorizontalRule：左右留 24 页边距）。
struct HorizontalRule: View {
    var body: some View {
        Rectangle().fill(SiteTheme.line).frame(height: 0.33).padding(.horizontal, SiteSpace.page)
    }
}

/// 站内详情页的「ink 底反白圆角外链按钮 + host 副标题」。
struct SourceCta: View {
    let label: String
    let host: String
    let action: () -> Void

    var body: some View {
        VStack(alignment: .center, spacing: 6) {
            Button(action: action) {
                HStack(spacing: 6) {
                    Text(label).font(SiteText.listTitle).foregroundStyle(SiteTheme.background)
                    Image(systemName: "arrow.up.right").font(.system(size: 14, weight: .medium)).foregroundStyle(SiteTheme.background)
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal, SiteSpace.page)
                .padding(.vertical, 14)
                .background(SiteTheme.ink)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(SitePressStyle.compact)
            Text(host).siteMetaStyle().frame(maxWidth: .infinity)
        }
    }
}

// MARK: - 文案辅助

/// 元信息行：非空片段以「 · 」相连（列表行 / 详情页眉通用）。
nonisolated func metaLine(_ parts: String?...) -> String {
    parts.compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
}

// MARK: - 时间文案（与安卓 TimeText.kt 一致的措辞）

/// ISO 时间 → 相对时间文案（与站点一致的措辞：刚刚/N分钟前/N小时前/N天前）。
nonisolated func relativeTimeLabel(_ iso: String?, now: Date = Date()) -> String? {
    guard let date = parseISO(iso) else { return nil }
    let minutes = Int(now.timeIntervalSince(date) / 60)
    guard minutes >= 0 else { return nil }
    if minutes < 1 { return "刚刚" }
    if minutes < 60 { return "\(minutes) 分钟前" }
    let hours = minutes / 60
    if hours < 24 { return "\(hours) 小时前" }
    let days = hours / 24
    if days < 30 { return "\(days) 天前" }
    return nil
}

/// 列表条目的时间标签：相对时间优先，超一个月回退「M月d日」；解析失败返回 nil。
nonisolated func feedTimeLabel(_ iso: String?) -> String? {
    guard let date = parseISO(iso) else { return nil }
    let label = relativeTimeLabel(iso)
    if label != nil { return label }
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "zh_CN")
    formatter.dateFormat = "M月d日"
    return formatter.string(from: date)
}

nonisolated private func parseISO(_ iso: String?) -> Date? {
    guard let iso, !iso.isEmpty else { return nil }
    // 兼容带毫秒与不带毫秒两种 ISO 形态。
    let withFraction = ISO8601DateFormatter()
    withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = withFraction.date(from: iso) { return date }
    return ISO8601DateFormatter().date(from: iso)
}

// MARK: - URL 展示辅助（对应安卓 DetailScreens 内部函数）

nonisolated func hostOf(_ url: String) -> String {
    guard let host = URL(string: url)?.host else { return String(url.prefix(40)) }
    return host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
}

nonisolated func originalActionLabel(_ url: String) -> String {
    switch hostOf(url) {
    case "x.com", "twitter.com": "在 X 查看原推"
    case "mp.weixin.qq.com": "在微信查看原文"
    case "github.com": "在 GitHub 查看"
    default: "查看原文"
    }
}

extension Array {
    /// 越界安全取值（问一问引用、开场帧等按下标取列表项的场景）。
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
