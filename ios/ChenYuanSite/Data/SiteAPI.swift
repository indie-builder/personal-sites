import Foundation

/// 站点公共 GET API。全部公开读，无需鉴权；分页契约 { hasMore, items }。
/// 类型为 nonisolated：网络与 JSON 解析不占用主线程。
nonisolated struct SiteAPI: Sendable {
    static let baseURL = URL(string: "https://default-coder.lovemyrmb.cn/")!

    private let session: URLSession
    private let decoder = JSONDecoder()

    init(session: URLSession = Self.makeSession()) {
        self.session = session
    }

    private static func makeSession() -> URLSession {
        let configuration = URLSessionConfiguration.default
        // 与安卓 feed 客户端一致：连接/读取空闲超时 10-15s。
        configuration.timeoutIntervalForRequest = 15
        configuration.timeoutIntervalForResource = 60
        configuration.waitsForConnectivity = false
        return URLSession(configuration: configuration)
    }

    func aiNews(offset: Int, limit: Int) async throws -> FeedPage<AiNewsListItem> {
        try await page(Section.aiNews.path, offset: offset, limit: limit)
    }

    func curation(offset: Int, limit: Int) async throws -> FeedPage<CurationItem> {
        try await page(Section.curation.path, offset: offset, limit: limit)
    }

    func design(offset: Int, limit: Int) async throws -> FeedPage<CurationItem> {
        try await page(Section.design.path, offset: offset, limit: limit)
    }

    func douyin(offset: Int, limit: Int) async throws -> FeedPage<CurationItem> {
        try await page(Section.douyin.path, offset: offset, limit: limit)
    }

    func openSource(offset: Int, limit: Int) async throws -> FeedPage<OpenSourceListEntry> {
        try await page(Section.openSource.path, offset: offset, limit: limit)
    }

    func aiNewsDetail(id: String) async throws -> AiNewsItem {
        let response: AiNewsDetailResponse = try await get(path: "api/ai-news/\(id)")
        return response.item
    }

    private func page<T: Decodable>(_ path: String, offset: Int, limit: Int) async throws -> FeedPage<T> {
        var components = URLComponents(url: Self.baseURL, resolvingAgainstBaseURL: false)!
        components.path += path
        components.queryItems = [
            URLQueryItem(name: "offset", value: String(offset)),
            URLQueryItem(name: "limit", value: String(limit)),
        ]
        return try await get(url: components.url!)
    }

    private func get<T: Decodable>(path: String) async throws -> T {
        var components = URLComponents(url: Self.baseURL, resolvingAgainstBaseURL: false)!
        components.path += path
        return try await get(url: components.url!)
    }

    private func get<T: Decodable>(url: URL) async throws -> T {
        let (data, response) = try await session.data(from: url)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw SiteAPIError.badStatus((response as? HTTPURLResponse)?.statusCode ?? -1)
        }
        return try decoder.decode(T.self, from: data)
    }
}

nonisolated enum SiteAPIError: Error {
    case badStatus(Int)
}

/// 站内媒体 URL 语义：X 平台视频必须走 /api/x-media 代理，其余直连。
nonisolated enum MediaURLs {
    static func video(platform: String, videoURL: String) -> URL? {
        guard let url = URL(string: videoURL) else { return nil }
        guard platform == "x" else { return url }
        var components = URLComponents(url: SiteAPI.baseURL, resolvingAgainstBaseURL: false)!
        components.path += "api/x-media"
        components.queryItems = [URLQueryItem(name: "url", value: videoURL)]
        return components.url
    }

    static func sitePage(_ path: String) -> URL {
        var components = URLComponents(url: SiteAPI.baseURL, resolvingAgainstBaseURL: false)!
        components.path += path
        return components.url!
    }
}
