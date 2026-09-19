import SwiftUI

@main
struct ChenYuanSiteApp: App {
    @State private var environment = AppEnvironment()
    @State private var showOpening = true

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
