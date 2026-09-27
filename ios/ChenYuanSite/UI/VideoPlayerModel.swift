import AVFoundation
import Observation

// MARK: - 视频播放状态

/// 详情页与作品集共用的视频播放状态机：点击播放 → 原生播放器；
/// 条目加载失败（弱网、死链）→ 错误态，可重试回放同一地址。
/// 播放前激活 .playback 音频类别：视频声音不受静音键影响；
/// 最后一个播放者让出时释放会话并通知其他 App（如音乐）恢复播放。
@MainActor
@Observable
final class VideoPlayerModel {
    enum Phase {
        case idle
        case playing(AVPlayer)
        case failed
    }

    private(set) var phase: Phase = .idle
    private var statusObservation: NSKeyValueObservation?
    private var observingPlayer: AVPlayer?
    private var observingItemID: ObjectIdentifier?
    private var lastURL: URL?

    /// 音频会话全应用共享一份：计数在播的视频卡，最后一个让出者才释放，
    /// 避免同页多卡中一张滚出视图时误停其他卡的会话。仅主线程访问；
    /// internal 供测试断言收支（测试用例开头清零）。
    static var playingCount = 0

    /// 开始播放：立即进入 playing（原生控制条自会缓冲）；
    /// 条目状态落定（就绪或失败）即结束观察；失败则转入错误态并让出会话。
    func play(url: URL) {
        if case .playing(let previous) = phase { previous.pause() } else { Self.playingCount += 1 }
        lastURL = url
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .moviePlayback)
        try? session.setActive(true)
        statusObservation?.invalidate()
        let item = AVPlayerItem(url: url)
        let player = AVPlayer(playerItem: item)
        observingPlayer = player
        observingItemID = ObjectIdentifier(item)
        // KVO 回调发生在媒体的任意线程：只携带基础值跳回主线程判定；
        // 条目以 ObjectIdentifier 标识（Sendable），迟到的旧回调可被识别丢弃。
        statusObservation = item.observe(\.status, options: [.initial, .new]) { [weak self] observed, _ in
            let status = observed.status
            let itemID = ObjectIdentifier(observed)
            Task { @MainActor [weak self] in self?.handleStatus(status, itemID: itemID) }
        }
        phase = .playing(player)
        player.play()
    }

    /// 失败重试：同一地址重新走播放路径。
    func retry() {
        guard let lastURL else { return }
        play(url: lastURL)
    }

    /// 暂停并回到封面（离开卡片时调用）：停止状态观察并让出音频会话。
    func pause() {
        statusObservation?.invalidate()
        statusObservation = nil
        observingItemID = nil
        if case .playing(let player) = phase {
            player.pause()
            releasePlaybackSlot()
        }
        phase = .idle
    }

    /// 条目状态回调：一次落定即结束观察；迟到的旧回调
    /// （条目已被替换或已回封面）在身份守卫处直接丢弃——
    /// 不覆盖新状态、不重复让出槽位、不触碰新条目的观察。
    private func handleStatus(_ status: AVPlayerItem.Status, itemID: ObjectIdentifier) {
        switch status {
        case .unknown: return
        case .readyToPlay, .failed: break
        @unknown default: return
        }
        guard case .playing(let current) = phase, current === observingPlayer, itemID == observingItemID else { return }
        statusObservation?.invalidate()
        statusObservation = nil
        if status == .failed {
            phase = .failed
            releasePlaybackSlot()
        }
    }

    private func releasePlaybackSlot() {
        Self.playingCount -= 1
        if Self.playingCount == 0 {
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
    }
}
