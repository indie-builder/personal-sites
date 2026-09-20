import SwiftUI

@main
struct ChenYuanSiteApp: App {
    @State private var environment = AppEnvironment()
    /// -skip-opening 启动参数：无触控环境（UI 测试/截图）跳过开场动画。
    @State private var showOpening = !ProcessInfo.processInfo.arguments.contains("-skip-opening")

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(environment)
                .overlay {
                    if showOpening {
                        OpeningView {
                            showOpening = false
                        }
                    }
                }
        }
    }
}
