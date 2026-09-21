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

    init() {
        // 槽位计数是进程级静态：每用例从零开始，收支断言不受用例顺序影响。
        VideoPlayerModel.playingCount = 0
    }

    private func missingFileURL() -> URL {
        URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("no-such-\(UUID().uuidString).mp4")
    }

    @Test func playEntersPlayingThenFailsForMissingFile() async {
        model.play(url: missingFileURL())
        #expect(VideoPlayerModel.playingCount == 1)
        if case .playing = model.phase {} else { Issue.record("点击播放后应立即进入 playing") }
        await waitUntil { self.isFailed(model) }
        #expect(VideoPlayerModel.playingCount == 0)
    }

    @Test func retryRestartsPlaybackAfterFailure() async {
        model.play(url: missingFileURL())
        await waitUntil { self.isFailed(model) }
        model.retry()
        #expect(VideoPlayerModel.playingCount == 1)
        if case .playing = model.phase {} else { Issue.record("重试后应重新进入 playing") }
        await waitUntil { self.isFailed(model) }
        #expect(VideoPlayerModel.playingCount == 0)
    }

    @Test func pauseReturnsToIdleAndStopsFailureObservation() async {
        model.play(url: missingFileURL())
        model.pause()
        if case .idle = model.phase {} else { Issue.record("暂停后应回到封面态") }
        #expect(VideoPlayerModel.playingCount == 0)
        // 状态观察已取消：条目随后失败也不应把界面拉回错误态。
        try? await Task.sleep(for: .milliseconds(400))
        if case .idle = model.phase {} else { Issue.record("取消观察后不应再进入错误态") }
    }

    /// 双卡并发：各持一个槽位，失败路径各只释放一次、计数归零；
    /// 之后的 pause 是空操作（已失败），不得把计数扣成负数。
    /// （“一张让出时另一张仍持有”的中间态依赖失败回调到达顺序，
    /// 用确定失败桩无法确定断言，该性质由单卡的 play→failed 与
    /// play→pause 用例分别覆盖。）
    @Test func crossCardsCountDownToZeroFromEitherPath() async {
        let first = VideoPlayerModel()
        let second = VideoPlayerModel()
        first.play(url: missingFileURL())
        second.play(url: missingFileURL())
        #expect(VideoPlayerModel.playingCount == 2)
        await waitUntil { self.isFailed(first) && self.isFailed(second) }
        #expect(VideoPlayerModel.playingCount == 0)
        first.pause()
        second.pause()
        try? await Task.sleep(for: .milliseconds(600))
        #expect(VideoPlayerModel.playingCount == 0)
    }

    /// 失败已让出槽位后再 pause：不得重复 −1。
    @Test func pauseAfterFailureKeepsCountAtZero() async {
        model.play(url: missingFileURL())
        await waitUntil { self.isFailed(model) }
        model.pause()
        #expect(VideoPlayerModel.playingCount == 0)
    }

    private func isFailed(_ candidate: VideoPlayerModel) -> Bool {
        if case .failed = candidate.phase { return true }
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
