import Foundation

/// 站点公共 GET API。全部公开读，无需鉴权；分页契约 { hasMore, items }。
/// 类型为 nonisolated：网络与 JSON 解析不占用主线程。
nonisolated struct SiteAPI: Sendable {
    static let baseURL = URL(string: "https://default-coder.lovemyrmb.cn/")!

    private let session: URLSession
    private let decoder = JSONDecoder()

    /// 与安卓 feed 客户端一致：连接/读取空闲超时 15/60s。
    init(session: URLSession = .site(request: 15, resource: 60)) {
        self.session = session
    }

    /// 栏目分页：{path}?offset=&limit=。
    func feed<T: Decodable>(_ section: Section, offset: Int) async throws -> FeedPage<T> {
        let page: FeedPage<T> = try await get(url: Self.url(section.path, ["offset": "\(offset)", "limit": "\(section.pageSize)"]))
        return page
    }

    func aiNewsDetail(id: String) async throws -> AiNewsItem {
        let response: AiNewsDetailResponse = try await get(url: Self.url("api/ai-news/\(id)"))
        return response.item
    }

    private func get<T: Decodable>(url: URL) async throws -> T {
        let (data, response) = try await session.data(from: url)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw SiteAPIError.badStatus((response as? HTTPURLResponse)?.statusCode ?? -1)
        }
        return try decoder.decode(T.self, from: data)
    }

    /// baseURL + path（可带 query 参数）。
    nonisolated static func url(_ path: String, _ query: [String: String] = [:]) -> URL {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        components.path += path
        if !query.isEmpty {
            components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        return components.url!
    }
}

nonisolated enum SiteAPIError: Error {
    case badStatus(Int)
}

/// 站内媒体 URL 语义：X 平台视频必须走 /api/x-media 代理，其余直连。
nonisolated enum MediaURLs {
    static func video(platform: String, videoURL: String) -> URL? {
        guard let url = URL(string: videoURL) else { return nil }
        return platform == "x" ? SiteAPI.url("api/x-media", ["url": videoURL]) : url
    }
}

/// 站点客户端共用的 URLSession 构造。
nonisolated extension URLSession {
    static func site(request: TimeInterval, resource: TimeInterval) -> URLSession {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = request
        configuration.timeoutIntervalForResource = resource
        return URLSession(configuration: configuration)
    }
}
