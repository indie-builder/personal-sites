package cn.lovemyrmb.personalsite.ui.ask

import org.commonmark.node.Code
import org.commonmark.node.Paragraph
import org.commonmark.node.Text
import org.junit.Assert.assertEquals
import org.junit.Test

class AnswerMarkdownTest {
    // commonmark 0.30.0 的回归：未闭合反引号串后，第二个代码段被当作普通文本（#458/#459）。
    @Test
    fun `code spans after an unclosed backtick run stay code`() {
        val paragraph = answerParser.parse("`` `a` `c`").firstChild as Paragraph
        val nodes = generateSequence(paragraph.firstChild) { it.next }.toList()

        assertEquals("`` ", (nodes.first() as Text).literal)
        assertEquals(listOf("a", "c"), nodes.filterIsInstance<Code>().map { it.literal })
    }
}
