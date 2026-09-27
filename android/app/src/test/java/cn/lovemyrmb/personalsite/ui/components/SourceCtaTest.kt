package cn.lovemyrmb.personalsite.ui.components

import org.junit.Assert.assertEquals
import org.junit.Test

class SourceCtaTest {
    @Test fun hostLabelStripsWwwAndKeepsMalformedInputReadable() {
        assertEquals("example.com", hostOf("https://www.example.com/path"))
        assertEquals("bad input", hostOf("bad input"))
    }
}
