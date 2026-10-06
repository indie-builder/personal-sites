import Foundation
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
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            SiteTheme.line
            if let image {
                Image(uiImage: image).resizable().scaledToFill()
                    .transition(.opacity)
            }
        }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.15), value: image != nil)
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
