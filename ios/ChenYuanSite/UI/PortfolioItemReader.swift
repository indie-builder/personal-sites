import SwiftUI

/// Reading sheet leaves collection query, loaded pages and scroll position intact.
struct PortfolioItemReader: View {
    let collection: String
    let initialItem: PortfolioItem
    let siblings: [PortfolioItem]
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var currentID = ""
    @State private var detail: PortfolioItem?
    @State private var failed = false
    @State private var attempt = 0
    @State private var photo: PortfolioMedia?

    private var index: Int { siblings.firstIndex(where: { $0.id == currentID }) ?? 0 }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text(collection == "layouts" ? "布局参考" : "灵感集")
                    .font(SiteText.label).foregroundStyle(SiteTheme.muted)
                Spacer()
                Button("完成") { dismiss() }
                    .font(SiteText.label).foregroundStyle(SiteTheme.ink)
                    .frame(minWidth: 48, minHeight: 48)
            }
            .padding(.horizontal, 20)
            ScrollView {
                if let item = detail {
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(item.media) { media in
                            Group {
                                if media.kind == "video" {
                                    PortfolioVideo(urlString: media.url, poster: media.poster)
                                        .aspectRatio(media.aspect, contentMode: .fit)
                                } else {
                                    Button { photo = media } label: {
                                        RemoteImage(url: URL(string: media.url), contentMode: .fit)
                                            .aspectRatio(media.aspect, contentMode: .fit)
                                    }
                                    .buttonStyle(.plain).accessibilityLabel("放大图片")
                                }
                            }
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .padding(.bottom, 12)
                        }
                        if item.media.isEmpty {
                            ContentUnavailableView("暂无图片", systemImage: "photo")
                        }
                        Text(item.title).font(SiteText.pageTitle).foregroundStyle(SiteTheme.ink)
                            .padding(.top, 12)
                        Text(metaLine(item.author, item.category, item.topic)).siteMetaStyle()
                            .padding(.top, 8)
                        if !item.text.isEmpty {
                            Text(item.text).siteBodyStyle().textSelection(.enabled).padding(.top, 20)
                        }
                        if let url = URL(string: item.sourceURL), !item.sourceURL.isEmpty {
                            Divider().padding(.top, 24)
                            Button { openURL(url) } label: {
                                HStack {
                                    Text("查看原作").font(SiteText.label)
                                    Spacer()
                                    Text(hostOf(item.sourceURL)).font(SiteText.meta).foregroundStyle(SiteTheme.muted)
                                    Image(systemName: "arrow.up.right").font(.system(size: 12))
                                }
                                .foregroundStyle(SiteTheme.ink).frame(minHeight: 52).contentShape(Rectangle())
                            }
                            .buttonStyle(SitePressStyle.row)
                        }
                        if collection == "layouts" {
                            Text("nevertoday / 350-layout-compositions · CC BY 4.0")
                                .siteMetaStyle().padding(.top, 8)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 24)
                    .id(currentID)
                } else if failed {
                    ErrorRetry(message: "暂时无法读取详情。") { attempt += 1 }
                } else { ProgressView("正在读取详情…").padding(40) }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            Divider()
            HStack {
                Button { move(-1) } label: {
                    Label("上一件", systemImage: "chevron.left").frame(minHeight: 48)
                }.disabled(index == 0)
                Spacer()
                Text("第 \(index + 1) 件").siteMetaStyle().monospacedDigit()
                Spacer()
                Button { move(1) } label: {
                    HStack(spacing: 6) { Text("下一件"); Image(systemName: "chevron.right") }.frame(minHeight: 48)
                }.disabled(index + 1 >= siblings.count)
            }
            .font(SiteText.label).buttonStyle(SitePressStyle.compact).foregroundStyle(SiteTheme.ink)
            .padding(.horizontal, 20)
        }
        .background(SiteTheme.background)
            .fullScreenCover(item: $photo) { media in PhotoReader(urlString: media.url) }
            .task(id: "\(currentID)-\(attempt)") {
                let id = currentID.isEmpty ? initialItem.id : currentID
                if currentID.isEmpty { currentID = id; return }
                detail = nil
                failed = false
                do {
                    let response: PortfolioDetail = try await PortfolioAPI().get([collection, id])
                    guard !Task.isCancelled else { return }
                    detail = response.item
                } catch { if !Task.isCancelled { failed = true } }
            }
    }

    private func move(_ delta: Int) {
        guard let next = siblings[safe: index + delta] else { return }
        currentID = next.id
    }
}
