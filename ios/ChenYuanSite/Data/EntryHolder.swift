import Foundation
import Observation

/// 详情页的跳转载体：列表 → 详情通过内存持有（与站内行为一致，
/// 列表数据已含全文与媒体），进程重建后为空时详情页回退返回。
enum DetailEntry: Identifiable {
    case aiNews(String)
    case curation(Section, CurationItem)
    case openSource(OpenSourceListEntry)

    var section: Section {
        switch self {
        case .aiNews: .aiNews
        case .curation(let section, _): section
        case .openSource: .openSource
        }
    }

    var id: String {
        switch self {
        case .aiNews(let id): id
        case .curation(_, let item): item.id
        case .openSource(let entry): entry.slug
        }
    }
}

@MainActor
@Observable
final class EntryHolder {
    var pending: DetailEntry?
}
