import SwiftUI
import UIKit

/// 原生滚动缩放承载图片；全屏呈现不销毁详情列表的阅读位置。
struct PhotoReader: View {
    let urlString: String
    @Environment(\.dismiss) private var dismiss
    @State private var image: UIImage?
    @State private var failed = false
    @State private var attempt = 0

    var body: some View {
        NavigationStack {
            Group {
                if let image {
                    ZoomablePhoto(image: image)
                        .accessibilityLabel("图片，双指缩放或双击放大")
                } else if failed {
                    ErrorRetry(message: "图片暂时无法加载。") { attempt += 1 }
                } else {
                    ProgressView("正在加载图片…")
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(SiteTheme.background)
            .navigationTitle("查看图片")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") { dismiss() }
                        .accessibilityIdentifier("photo-close")
                }
            }
            .task(id: attempt) {
                failed = false
                guard let url = URL(string: urlString) else { failed = true; return }
                image = await ThumbnailDecoder.decode(url: url, maxPixelSize: 4096)
                failed = image == nil
            }
        }
    }
}

private struct ZoomablePhoto: UIViewRepresentable {
    let image: UIImage

    func makeUIView(context: Context) -> PhotoScrollView {
        let view = PhotoScrollView()
        view.photo.image = image
        return view
    }

    func updateUIView(_ view: PhotoScrollView, context: Context) {}
}

private final class PhotoScrollView: UIScrollView, UIScrollViewDelegate {
    let photo = UIImageView()
    private var previousSize = CGSize.zero

    override init(frame: CGRect) {
        super.init(frame: frame)
        delegate = self
        minimumZoomScale = 1
        maximumZoomScale = 5
        bouncesZoom = true
        showsHorizontalScrollIndicator = false
        showsVerticalScrollIndicator = false
        photo.contentMode = .scaleAspectFit
        addSubview(photo)
        let doubleTap = UITapGestureRecognizer(target: self, action: #selector(toggleZoom(_:)))
        doubleTap.numberOfTapsRequired = 2
        addGestureRecognizer(doubleTap)
        accessibilityCustomActions = [
            UIAccessibilityCustomAction(name: "放大图片", target: self, selector: #selector(accessibleZoomIn)),
            UIAccessibilityCustomAction(name: "还原图片", target: self, selector: #selector(accessibleZoomOut)),
        ]
        isAccessibilityElement = true
        accessibilityLabel = "图片"
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layoutSubviews() {
        super.layoutSubviews()
        if bounds.size != previousSize {
            previousSize = bounds.size
            setZoomScale(1, animated: false)
            photo.frame = CGRect(origin: .zero, size: bounds.size)
            contentSize = bounds.size
        }
    }

    func viewForZooming(in scrollView: UIScrollView) -> UIView? { photo }

    @objc private func toggleZoom(_ recognizer: UITapGestureRecognizer) {
        let animated = !UIAccessibility.isReduceMotionEnabled
        if zoomScale > 1 { setZoomScale(1, animated: animated) }
        else {
            let point = recognizer.location(in: photo)
            let size = CGSize(width: bounds.width / 3, height: bounds.height / 3)
            zoom(to: CGRect(x: point.x - size.width / 2, y: point.y - size.height / 2,
                            width: size.width, height: size.height), animated: animated)
        }
    }

    @objc private func accessibleZoomIn() -> Bool {
        setZoomScale(min(zoomScale + 1, maximumZoomScale), animated: !UIAccessibility.isReduceMotionEnabled)
        return true
    }

    @objc private func accessibleZoomOut() -> Bool {
        setZoomScale(1, animated: !UIAccessibility.isReduceMotionEnabled)
        return true
    }
}
