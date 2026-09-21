import Foundation

nonisolated struct PortfolioProduct: Decodable, Identifiable, Sendable {
    let id: String
    let name: String
    let summary: String
    let description: String
    let date: String
    let dateLabel: String
    let cover: String
}

nonisolated struct PortfolioCategory: Decodable, Identifiable, Sendable {
    let id: String
    let name: String
    let count: Int
}

nonisolated struct PortfolioMedia: Decodable, Identifiable, Sendable {
    let id: String
    let kind: String
    let url: String
    let poster: String
    let width: Int
    let height: Int
    var aspect: CGFloat { width > 0 && height > 0 ? CGFloat(width) / CGFloat(height) : 4 / 3 }
}

nonisolated struct PortfolioItem: Decodable, Identifiable, Sendable {
    let id: String
    let title: String
    let category: String
    let topic: String
    let author: String
    let text: String
    let sourceURL: String
    let thumbnail: String
    let media: [PortfolioMedia]
}

nonisolated struct PortfolioPage: Decodable, Sendable {
    let items: [PortfolioItem]
    let total: Int
    let hasMore: Bool
    let categories: [PortfolioCategory]
    let topics: [PortfolioCategory]
    let attribution: String
}

nonisolated struct PortfolioToolCategory: Decodable, Identifiable, Sendable {
    let id: String
    let name: String
    let tools: [PortfolioTool]
}

nonisolated struct PortfolioTool: Decodable, Sendable {
    let name: String
    let url: String
    let icon: String
}

nonisolated struct PortfolioSite: Decodable, Sendable {
    let video: String
    let poster: String
    let website: String
    let description: String
}

nonisolated struct PortfolioProducts: Decodable, Sendable { let items: [PortfolioProduct] }
nonisolated struct PortfolioDetail: Decodable, Sendable { let item: PortfolioItem }
nonisolated struct PortfolioTools: Decodable, Sendable { let categories: [PortfolioToolCategory] }

/// Public portfolio API owned by personal-design; no bundled content or HTML scraping.
nonisolated struct PortfolioAPI: Sendable {
    static let productionURL = URL(string: "https://portfolio.default-coder.lovemyrmb.cn/")!
    let baseURL: URL
    private let session: URLSession

    init(baseURL: URL? = nil, session: URLSession = .site(request: 15, resource: 60)) {
        if let baseURL { self.baseURL = baseURL }
        else {
            #if DEBUG
            self.baseURL = ProcessInfo.processInfo.environment["PORTFOLIO_BASE_URL"].flatMap(URL.init(string:)) ?? Self.productionURL
            #else
            self.baseURL = Self.productionURL
            #endif
        }
        self.session = session
    }

    func get<T: Decodable & Sendable>(_ path: [String] = [], query: [String: String] = [:]) async throws -> T {
        var url = baseURL.appendingPathComponent("api/portfolio")
        for component in path { url.appendPathComponent(component) }
        var parts = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        parts.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
        let (data, response) = try await session.data(from: parts.url!)
        guard let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
