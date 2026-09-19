import SwiftUI

/// 站点黑白灰单色体系（DESIGN.md 令牌），深浅色跟随系统：
/// 亮色 ink #1c1c1e / surface #ffffff / muted #656568 / line #eeeeee；
/// 暗色背景 #181818 / 前景 #f4f4f4。无卡片、无重阴影，层级靠细线、留白与字重。
enum SiteTheme {
    nonisolated static let background = dynamic(light: 0xFFFFFF, dark: 0x181818)
    nonisolated static let ink = dynamic(light: 0x1C1C1E, dark: 0xF4F4F4)
    nonisolated static let muted = dynamic(light: 0x656568, dark: 0xA1A1A4)
    nonisolated static let quiet = dynamic(light: 0x767676, dark: 0x8E8E93)
    nonisolated static let line = dynamic(light: 0xEEEEEE, dark: 0x2A2A2C)
    /// 玻璃底色：亮色白 80% 透明，暗色 #181818 70% 透明（对应安卓 glass 令牌）。
    nonisolated static let glass = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0x18 / 255, green: 0x18 / 255, blue: 0x18 / 255, alpha: 0.70)
            : UIColor(red: 1, green: 1, blue: 1, alpha: 0.80)
    })

    private nonisolated static func dynamic(light: UInt32, dark: UInt32) -> Color {
        Color(uiColor: UIColor { trait in
            UIColor(hex: trait.userInterfaceStyle == .dark ? dark : light)
        })
    }
}

private extension UIColor {
    nonisolated convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1,
        )
    }
}

/// 站点排版阶梯的 App 侧映射（SiteText）：标题 600 字重，正文 15，辅助 12。
/// iOS 无独立 lineHeight 概念，用 lineSpacing 逼近安卓的行高比。
enum SiteText {
    static let identity = Font.system(size: 32, weight: .medium)
    static let pageTitle = Font.system(size: 22, weight: .semibold)
    static let title = Font.system(size: 16, weight: .medium)
    static let listTitle = Font.system(size: 15, weight: .medium)
    static let body = Font.system(size: 15)
    static let summary = Font.system(size: 13)
    static let meta = Font.system(size: 12)
    static let eyebrow = Font.system(size: 12, weight: .medium)
    static let label = Font.system(size: 14, weight: .medium)
    static let tab = Font.system(size: 14)
    static let tabSelected = Font.system(size: 14, weight: .semibold)

    // 行距修正：安卓 15/26 ≈ +6，13/21 ≈ +3，12/18 ≈ +2。
    static let bodyLineSpacing: CGFloat = 6
    static let summaryLineSpacing: CGFloat = 3
    static let metaLineSpacing: CGFloat = 2
}

/// 间距令牌（SiteSpace）。
enum SiteSpace {
    static let micro: CGFloat = 4
    static let compact: CGFloat = 8
    static let related: CGFloat = 12
    static let paragraph: CGFloat = 16
    static let item: CGFloat = 20
    static let page: CGFloat = 24
    static let section: CGFloat = 24
    static let touch: CGFloat = 48
}

// 全站通用文本修饰：一处定义行距，避免每个 Text 手写。
extension View {
    func siteBodyStyle(_ color: Color = SiteTheme.ink) -> some View {
        font(SiteText.body).lineSpacing(SiteText.bodyLineSpacing).foregroundStyle(color)
    }

    func siteSummaryStyle(_ color: Color = SiteTheme.muted) -> some View {
        font(SiteText.summary).lineSpacing(SiteText.summaryLineSpacing).foregroundStyle(color)
    }

    func siteMetaStyle(_ color: Color = SiteTheme.quiet) -> some View {
        font(SiteText.meta).lineSpacing(SiteText.metaLineSpacing).foregroundStyle(color)
    }
}
