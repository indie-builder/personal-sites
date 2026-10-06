import SwiftUI

/// 个人介绍页：识别陈远、读他的工程实践、打开经历或外部笔记。
/// 身份与经历构成一个整体：右上外部链接、名字与头像、履历入口、
/// 自我介绍流入技术领域，无页脚动作。
struct AboutView: View {
    @Environment(\.openURL) private var openURL
    @State private var showCareer = false
    let bottomPadding: CGFloat
    let onScrollDelta: (CGFloat) -> Void

    private let externalLinks = [
        ("GitHub", "https://github.com/indie-builder"),
        ("语雀", "https://www.yuque.com/defulat-coder"),
    ]
    private let bioParagraphs = [
        "十余年项目开发经验，横跨 Java、Python、TypeScript 与前端；从业务平台、云服务到企业 AI，一直在做需要长期负责的工程系统。",
        "现在关心 AI 如何进入真实工作，Web 如何成为新的创造界面，以及系统如何经得起长期使用。",
        "这里记录正在构建的东西，以及那些值得继续拆解的工程问题。",
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                identity
                ProfileGreeting()
                gap(SiteSpace.paragraph)
                bio
                gap(SiteSpace.section)
                TechnicalTerms()
                gap(SiteSpace.section)
            }
            .padding(.horizontal, SiteSpace.page)
            .padding(.top, SiteSpace.related)
            .padding(.bottom, bottomPadding + SiteSpace.section)
        }
        .onScrollGeometryChange(for: CGFloat.self) { $0.contentOffset.y } action: { old, new in
            onScrollDelta(new - old)
        }
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $showCareer) { AboutSheet() }
    }

    private var identity: some View {
        VStack(spacing: SiteSpace.compact) {
            HStack(spacing: SiteSpace.paragraph) {
                Spacer()
                ForEach(externalLinks, id: \.1) { externalLink($0.0, urlString: $0.1) }
            }
            HStack(alignment: .center, spacing: SiteSpace.paragraph) {
                VStack(alignment: .leading, spacing: SiteSpace.compact) {
                    Text("陈远").font(SiteText.identity).foregroundStyle(SiteTheme.ink)
                    Text("@indie-builder").siteSummaryStyle(SiteTheme.muted)
                }
                Spacer()
                Image("profile_avatar")
                    .resizable().scaledToFit()
                    .frame(width: 104, height: 104)
                    .accessibilityLabel("陈远的头像插画")
            }
            Button {
                showCareer = true
            } label: {
                HStack(spacing: SiteSpace.related) {
                    Text("2014—至今").font(SiteText.label).foregroundStyle(SiteTheme.ink)
                    Text("个人经历").siteMetaStyle(SiteTheme.muted)
                    Spacer()
                    Image(systemName: "chevron.right").font(.system(size: 13, weight: .medium)).foregroundStyle(SiteTheme.ink)
                }
                .padding(.vertical, SiteSpace.related)
                .frame(minHeight: 56)
                .contentShape(Rectangle())
            }
            .buttonStyle(SitePressStyle.row)
            .accessibilityLabel("查看个人经历")
        }
    }

    private func externalLink(_ label: String, urlString: String) -> some View {
        Button {
            if let url = URL(string: urlString) { openURL(url) }
        } label: {
            HStack(spacing: 6) {
                Text(label).siteMetaStyle(SiteTheme.muted)
                Image(systemName: "arrow.up.right").font(.system(size: 11, weight: .medium)).foregroundStyle(SiteTheme.muted)
            }
            .padding(.horizontal, SiteSpace.micro)
            .frame(minHeight: SiteSpace.touch)
            .contentShape(Rectangle())
        }
        .buttonStyle(SitePressStyle.compact)
        .accessibilityLabel("在浏览器打开\(label)")
    }

    private var bio: some View {
        VStack(alignment: .leading, spacing: SiteSpace.paragraph) {
            ForEach(bioParagraphs, id: \.self) { Text($0).siteBodyStyle(SiteTheme.muted) }
        }
    }
}

/// 履历小票：与站点履历打印稿一致的四段经历（components/about-print.tsx），
/// 保留细线与条码，字体遵循全应用规范。
private struct AboutSheet: View {
    private let receiptItems: [(company: String, meta: String, years: String)] = [
        ("PLUS数字科技", "2014—2019 · Java · 服务运维", "5 年"),
        ("红星美凯龙", "2019—2023 · 业务 · 集团架构", "4 年"),
        ("喜马拉雅", "2023—2026 · 企业 AI 应用", "3 年"),
        ("PayerMax", "2026— · OPT · 端到端交付", "至今"),
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                Text("陈远 / CHEN YUAN").font(SiteText.title).foregroundStyle(SiteTheme.ink)
                gap(SiteSpace.micro)
                Text("个人经历 · CAREER RECEIPT").siteMetaStyle(SiteTheme.quiet)
                gap(SiteSpace.paragraph)
                Rectangle().fill(SiteTheme.ink).frame(height: 1)
                gap(SiteSpace.paragraph)
                ForEach(receiptItems, id: \.company) { item in
                    HStack {
                        Text(item.company).font(SiteText.label).foregroundStyle(SiteTheme.ink)
                        Spacer()
                        Text(item.years).siteSummaryStyle(SiteTheme.ink)
                    }
                    Text(item.meta).siteMetaStyle(SiteTheme.muted).frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 2)
                        .padding(.bottom, SiteSpace.related)
                }
                Rectangle().fill(SiteTheme.ink).frame(height: 1)
                gap(SiteSpace.paragraph)
                HStack {
                    Text("合计 TOTAL").siteSummaryStyle(SiteTheme.ink)
                    Spacer()
                    Text("12 年").font(SiteText.title).foregroundStyle(SiteTheme.ink)
                }
                gap(SiteSpace.compact)
                Text("十二年 · 四段路 · 仍在增长").siteMetaStyle(SiteTheme.quiet)
                gap(SiteSpace.paragraph)
                ReceiptBarcode().frame(height: 36).frame(maxWidth: .infinity)
            }
            .padding(.horizontal, SiteSpace.page)
            .padding(.vertical, SiteSpace.section)
        }
        .presentationDetents([.medium, .large])
        .presentationBackground(SiteTheme.background)
    }
}

/// 装饰条码：确定性伪随机宽度的竖条，纯观感。
private struct ReceiptBarcode: View {
    var body: some View {
        Canvas { context, size in
            var x: CGFloat = 0
            var seed: UInt64 = 7
            while x < size.width {
                seed = seed &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
                let barWidth = (seed >> 33) & 3 > 1 ? size.width / 90 : size.width / 220
                context.fill(Path(CGRect(x: x, y: 0, width: barWidth, height: size.height)), with: .color(SiteTheme.ink))
                x += barWidth + size.width / 160
            }
        }
    }
}
