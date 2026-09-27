import AVKit
import SwiftUI

/// 媒体宽高比：宽高缺失或非法时回退。
func mediaAspect(_ media: CurationMedia, fallback: CGFloat) -> CGFloat {
    guard let width = media.width, width > 0, let height = media.height, height > 0 else { return fallback }
    return CGFloat(width) / CGFloat(height)
}

// MARK: - 策展媒体

/// 策展媒体的展示：视频逐个播放卡，图片 1 张整宽、多张三列方格。
/// 媒体数组对本视图生命周期不可变（来自跳转载体），位置键即稳定身份。
struct CurationMediaSection: View {
    let media: [CurationMedia]
    let source: CurationSource

    @State private var selectedPhoto: CurationMedia?

    private var videos: [CurationMedia] { media.filter { $0.videoUrl != nil } }
    private var photos: [CurationMedia] { media.filter { $0.videoUrl == nil } }

    var body: some View {
        VStack(spacing: 10) {
            ForEach(Array(videos.enumerated()), id: \.offset) { _, video in
                VideoCard(media: video, source: source)
            }
            if photos.count == 1, let photo = photos.first {
                photoButton(photo, contentMode: .fit)
                    .aspectRatio(mediaAspect(photo, fallback: 4.0 / 3.0), contentMode: .fit)
                    .frame(maxWidth: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .background(SiteTheme.line)

            } else if photos.count > 1 {
                LazyVGrid(columns: [GridItem](repeating: .init(.flexible(), spacing: 6), count: 3), spacing: 6) {
                    ForEach(Array(photos.enumerated()), id: \.offset) { _, photo in
                        photoButton(photo)
                            .aspectRatio(1, contentMode: .fit)
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                            .background(SiteTheme.line)

                    }
                }
            }
        }
        .fullScreenCover(item: $selectedPhoto) { photo in
            PhotoReader(urlString: photo.url)
        }
    }

    private func photoButton(_ photo: CurationMedia, contentMode: ContentMode = .fill) -> some View {
        Button { selectedPhoto = photo } label: {
            RemoteImage(url: URL(string: photo.url), contentMode: contentMode)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("全屏查看图片")
        .accessibilityHint("支持双击和双指缩放")
        .accessibilityIdentifier("detail-photo")
    }
}

/// 视频卡片：默认展示封面 + 播放圆钮，点击后用 AVPlayer 原生播放；
/// 加载失败转入错误态可重试（状态机见 VideoPlayerModel）。
/// X 平台视频自动经 /api/x-media 代理（MediaURLs.video）。
private struct VideoCard: View {
    let media: CurationMedia
    let source: CurationSource

    @State private var playback = VideoPlayerModel()

    var body: some View {
        ZStack {
            switch playback.phase {
            case .idle:
                // 封面失败时重试入口靠底展示，与居中播放钮互不遮挡；
                // 不给封面施加整体 a11y 标签，避免把重试钮合成进单元素。
                RemoteImage(url: URL(string: media.posterURL), retryAlignment: .bottom)
                Button {
                    if let videoURL { playback.play(url: videoURL) }
                } label: {
                    ZStack {
                        Circle().fill(SiteTheme.glass)
                        Image(systemName: "play.fill").font(.system(size: 24)).foregroundStyle(SiteTheme.ink)
                    }
                    .frame(width: 52, height: 52)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("播放视频")
            case .playing(let player):
                VideoPlayer(player: player).clipShape(RoundedRectangle(cornerRadius: 8))
            case .failed:
                ErrorRetry(message: "视频暂时无法播放。") { playback.retry() }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .aspectRatio(mediaAspect(media, fallback: 16.0 / 9.0), contentMode: .fit)
        .frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .background(SiteTheme.line)
        .onDisappear { playback.pause() }
    }

    private var videoURL: URL? {
        media.videoUrl.flatMap { MediaURLs.video(platform: source.platform, videoURL: $0) }
    }
}
