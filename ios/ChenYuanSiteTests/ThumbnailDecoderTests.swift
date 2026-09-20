import CoreGraphics
import ImageIO
import UIKit
import Testing

@testable import ChenYuanSite

/// 降采样缩略图解码的规格：大源图按 maxPixelSize 收敛到目标像素内，
/// 避免列表缩略位全尺寸解码大图（安卓 Coil 按视图尺寸解码的等价语义）。
@Suite(.serialized)
struct ThumbnailDecoderTests {
    /// 生成纯色大图写入临时文件，返回文件 URL（测试结束由临时目录回收）。
    private func makeLargeImageFile(width: Int, height: Int) throws -> URL {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: width, height: height))
        let image = renderer.image { context in
            UIColor.systemGray.setFill()
            context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        }
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("thumbnail-decoder-test-\(width)x\(height).jpg")
        guard let jpeg = image.jpegData(compressionQuality: 0.9) else {
            Issue.record("JPEG 编码失败")
            return url
        }
        try jpeg.write(to: url)
        return url
    }

    @Test func downsamplesLargeSourceToMaxPixelSize() async throws {
        let url = try makeLargeImageFile(width: 2048, height: 1536)
        let decoded = await ThumbnailDecoder.decode(url: url, maxPixelSize: 312)
        let image = try #require(decoded, "降采样解码不应失败")
        #expect(max(image.size.width * image.scale, image.size.height * image.scale) <= 312)
        #expect(max(image.size.width * image.scale, image.size.height * image.scale) > 0)
    }

    @Test func decodeFailureReturnsNil() async throws {
        let missing = FileManager.default.temporaryDirectory
            .appendingPathComponent("thumbnail-decoder-test-missing-\(UUID().uuidString).jpg")
        let decoded = await ThumbnailDecoder.decode(url: missing, maxPixelSize: 312)
        #expect(decoded == nil)
    }
}
