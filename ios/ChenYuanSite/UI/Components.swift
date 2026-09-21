import ImageIO
import SwiftUI

// MARK: - 降采样缩略图

/// 列表缩略图：ImageIO 按目标像素降采样解码。AsyncImage 会把源图全尺寸
/// 解码进内存（2048px 源图在 104pt 缩略位上解码内存放大约 27 倍），
/// 且 LazyVStack 行复用时反复解码；此处以 NSCache 按地址+尺寸缓存结果。
/// 大图展示位（详情页整宽照片、视频封面）不适用——全分辨率是有意保留。
struct DownsampledThumbnail: View {
    let urlString: String
    let targetSize: CGSize

    @State private var image: UIImage?

    var body: some View {
        ZStack {
            if let image { Image(uiImage: image).resizable().scaledToFill() }
            else { SiteTheme.line }
        }
        .task(id: urlString) {
            image = await Self.decodedImage(urlString: urlString, targetSize: targetSize)
        }
    }

    /// NSCache 自身线程安全（含逐出策略），故以 nonisolated(unsafe) 脱离
    /// MainActor 隔离供后台解码任务直接读写。条数上限防长会话深滚动线性累积。
    nonisolated(unsafe) private static let cache: NSCache<NSString, UIImage> = {
        let cache = NSCache<NSString, UIImage>()
        cache.countLimit = 200
        return cache
    }()

    /// 解码走独立加载路径（不经 URLSession 共享缓存、不可随行取消）：
    /// 每 URL 每进程至多完整解码一次（NSCache 兜底），滚动复用不重复解码。
    nonisolated private static func decodedImage(urlString: String, targetSize: CGSize) async -> UIImage? {
        // ×4：长宽比失配的源图（如 16:9 源填充 4:3 槽位）在 @3x 下仍够清晰。
        let maxPixel = Int(max(targetSize.width, targetSize.height) * 4)
        let key = "\(urlString)#\(maxPixel)" as NSString
        if let cached = cache.object(forKey: key) { return cached }
        guard let url = URL(string: urlString) else { return nil }
        let decoded = await ThumbnailDecoder.decode(url: url, maxPixelSize: maxPixel)
        if let decoded { cache.setObject(decoded, forKey: key) }
        return decoded
    }
}

/// ImageIO 缩略图解码：按 maxPixelSize 降采样（见 DownsampledThumbnail）。
nonisolated enum ThumbnailDecoder {
    nonisolated static func decode(url: URL, maxPixelSize: Int) async -> UIImage? {
        await Task.detached(priority: .utility) { () -> UIImage? in
            guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
            let options = [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceShouldCacheImmediately: true,
                kCGImageSourceThumbnailMaxPixelSize: maxPixelSize,
            ] as CFDictionary
            guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options) else { return nil }
            return UIImage(cgImage: cgImage)
        }.value
    }
}

// MARK: - 共享小部件

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
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

/// 方形图标按钮（复制 / 重试 / 回到底部等）。
struct IconButton: View {
    let systemName: String
    var pointSize: CGFloat = 15
    var side: CGFloat = SiteSpace.touch
    var tint: Color = SiteTheme.muted
    let accessibilityLabel: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: pointSize))
                .foregroundStyle(tint)
                .frame(width: side, height: side)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
    }
}

/// 网络图占位统一为 line 底色；fill 需要外层裁切与宽高比。
struct RemoteImage: View {
    let url: URL?
    var contentMode: ContentMode = .fill

    var body: some View {
        AsyncImage(url: url) { phase in
            if let image = phase.image { image.resizable().aspectRatio(nil, contentMode: contentMode) }
            else if phase.error != nil {
                ContentUnavailableView("图片未加载", systemImage: "photo")
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
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
            .buttonStyle(.plain)
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
            .buttonStyle(.plain)
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
