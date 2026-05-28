package com.tvapps.launcher

import android.content.Context
import android.util.AttributeSet
import android.widget.LinearLayout

class FocusAwareLinearLayout @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : LinearLayout(context, attrs, defStyleAttr) {

    override fun focusSearch(focused: android.view.View, direction: Int): android.view.View? {
        if (direction == android.view.View.FOCUS_RIGHT) {
            val index = indexOfChild(focused)
            if (index >= 0 && index < childCount - 1) {
                for (i in index + 1 until childCount) {
                    val next = getChildAt(i)
                    if (next.isFocusable && next.visibility == android.view.View.VISIBLE) return next
                }
            }
            return focused // trava no último elemento, não deixa escapar
        }
        if (direction == android.view.View.FOCUS_LEFT) {
            val index = indexOfChild(focused)
            if (index > 0) {
                for (i in index - 1 downTo 0) {
                    val prev = getChildAt(i)
                    if (prev.isFocusable && prev.visibility == android.view.View.VISIBLE) return prev
                }
            }
            return focused // trava no primeiro elemento, não deixa escapar
        }
        return super.focusSearch(focused, direction)
    }
}
