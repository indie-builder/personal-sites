import Foundation
import Testing

@testable import ChenYuanSite

/// 视频播放状态机规格：点击播放立即进入 playing；条目加载失败（用
/// 不存在的本地文件模拟，无网络依赖）转入错误态；重试重新回放；
/// 暂停回到封面并取消失败观察（此后条目失败不再翻转界面状态）。
@Suite(.serialized)
@MainActor
struct VideoPlayerModelTests {
    private let model = VideoPlayerModel()

    private func missingFileURL() -> URL {
        URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("no-such-\(UUID().uuidString).mp4")
    }

    @Test func playEntersPlayingThenFailsForMissingFile() async {
        model.play(url: missingFileURL())
        if case .playing = model.phase {} else { Issue.record("点击播放后应立即进入 playing") }
        await waitUntil { self.isFailed() }
    }

    @Test func retryRestartsPlaybackAfterFailure() async {
        model.play(url: missingFileURL())
        await waitUntil { self.isFailed() }
        model.retry()
        if case .playing = model.phase {} else { Issue.record("重试后应重新进入 playing") }
        await waitUntil { self.isFailed() }
    }

    @Test func pauseReturnsToIdleAndStopsFailureObservation() async {
        model.play(url: missingFileURL())
        model.pause()
        if case .idle = model.phase {} else { Issue.record("暂停后应回到封面态") }
        // 状态观察已取消：条目随后失败也不应把界面拉回错误态。
        try? await Task.sleep(for: .milliseconds(400))
        if case .idle = model.phase {} else { Issue.record("取消观察后不应再进入错误态") }
    }

    private func isFailed() -> Bool {
        if case .failed = model.phase { return true }
        return false
    }

    /// 上限 15s：与 AskControllerTests 相同的收敛策略，防 CI 过载抖动。
    private func waitUntil(
        _ condition: @MainActor () -> Bool,
        timeout: Duration = .seconds(15),
    ) async {
        let deadline = ContinuousClock.now + timeout
        while !condition() {
            guard ContinuousClock.now < deadline else {
                Issue.record("等待播放状态变更超时")
                return
            }
            await Task.yield()
            try? await Task.sleep(for: .milliseconds(5))
        }
    }
}
