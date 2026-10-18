const preferenceKey = "chenyuan.reduced-motion";

// Native page lifecycle boundary; stored preference supplements WebView's system media query.
export function readReducedMotion(): boolean {
  try { return typeof wx.getStorageSync === "function" && wx.getStorageSync(preferenceKey) === true; }
  catch { return true; }
}

export function setReducedMotion(value: boolean): void {
  try { wx.setStorageSync(preferenceKey, value); }
  catch { wx.showToast({ title: "偏好未能保存，请重试", icon: "none" }); }
}
