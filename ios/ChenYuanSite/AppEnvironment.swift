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
        let defaults = UserDefaults.standard
        if let stored = defaults.string(forKey: key), !stored.isEmpty {
            return stored
        }
        var bytes = [UInt8](repeating: 0, count: 18)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        var encoded = Data(bytes).base64EncodedString()
        encoded = encoded
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
        if let padding = encoded.firstIndex(of: "=") {
            encoded = String(encoded[..<padding])
        }
        defaults.set(encoded, forKey: key)
        return encoded
    }
}
