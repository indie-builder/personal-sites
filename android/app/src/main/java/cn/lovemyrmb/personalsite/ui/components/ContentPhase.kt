package cn.lovemyrmb.personalsite.ui.components

/** 加载/错误/内容三态的过渡键：Crossfade 只在相位切换时淡切，分页与刷新不触发。 */
internal enum class ContentPhase { INITIAL, ERROR, CONTENT }
