import Foundation
import Testing

@testable import ChenYuanSite

/// 时间文案规格（与安卓 TimeText.kt 措辞一致）。
struct TimeLabelTests {
    private static let iso: (Int) -> String = { minutesAgo in
        let date = Date(timeIntervalSince1970: 1_700_000_000)
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: date.addingTimeInterval(TimeInterval(-minutesAgo * 60)))
    }

    private let now = Date(timeIntervalSince1970: 1_700_000_000)

    @Test func relativeLabels() {
        #expect(relativeTimeLabel(Self.iso(0), now: now) == "刚刚")
        #expect(relativeTimeLabel(Self.iso(5), now: now) == "5 分钟前")
        #expect(relativeTimeLabel(Self.iso(90), now: now) == "1 小时前")
        #expect(relativeTimeLabel(Self.iso(60 * 20), now: now) == "20 小时前")
        #expect(relativeTimeLabel(Self.iso(60 * 26), now: now) == "1 天前")
        #expect(relativeTimeLabel(Self.iso(60 * 24 * 10), now: now) == "10 天前")
        // 带毫秒的 ISO 形态同样可解析。
        #expect(relativeTimeLabel("2023-11-14T22:13:20.000Z", now: Date(timeIntervalSince1970: 1_700_000_000 + 60)) == "1 分钟前")
    }

    @Test func olderThanThirtyDaysFallsBackToDate() {
        let label = feedTimeLabel(Self.iso(60 * 24 * 31))
        #expect(label?.contains("月") == true)
        #expect(label?.contains("日") == true)
    }

    @Test func invalidOrFutureInputReturnsNil() {
        #expect(relativeTimeLabel(nil, now: now) == nil)
        #expect(relativeTimeLabel("not-a-date", now: now) == nil)
        #expect(feedTimeLabel("") == nil)
        // now 早于条目时间 10 分钟：面向未来的时间不产生相对文案。
        #expect(relativeTimeLabel("2023-11-14T22:13:20Z", now: Date(timeIntervalSince1970: 1_700_000_000 - 600)) == nil)
    }
}
