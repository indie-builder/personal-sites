import Foundation
import Observation
import Security

/// 手写轻量 DI：一个容器持有 API 客户端与访客身份。
/// 站点公共 GET API 无需鉴权；ask 用独立长超时客户端。
@MainActor
@Observable
final class AppEnvironment {
    let api = SiteAPI()
    let askClient = AskClient()
    let entryHolder = EntryHolder()
    let homeModel: HomeModel
    let askController: AskController

    /// 问一问的匿名访客 id：客户端生成一次并持久化（[A-Za-z0-9_-]{16,128}）。
    let visitorId: String

    init() {
        visitorId = Self.loadOrCreateVisitorID()
        homeModel = HomeModel(api: api)
        askController = AskController(client: askClient, visitorId: visitorId)
    }

    private static func loadOrCreateVisitorID() -> String {
        let key = "visitor_id"
        if let stored = UserDefaults.standard.string(forKey: key), !stored.isEmpty { return stored }
        var bytes = [UInt8](repeating: 0, count: 18)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        // 18 字节 base64 恰 24 字符（无 padding），URL-safe 替换后即满足服务端格式。
        let id = Data(bytes).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
        UserDefaults.standard.set(id, forKey: key)
        return id
    }
}

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
