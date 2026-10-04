package cn.lovemyrmb.personalsite.data

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CurationMediaTest {
    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }

    @Test fun mixedMediaKeepsPlaybackUrlsPostersAndDimensions() {
        val item = json.decodeFromString<CurationItem>("""{
            "id":"fixture",
            "media":[
                {"type":"photo","url":"photo.jpg","width":800,"height":600},
                {"type":"animated_gif","url":"fallback.jpg","previewUrl":"poster.jpg","videoUrl":"video.mp4"}
            ]
        }""")
        assertNull(item.media[0].videoUrl)
        assertEquals("photo.jpg", item.media[0].posterUrl)
        assertEquals(800, item.media[0].width)
        assertEquals(600, item.media[0].height)
        assertEquals("video.mp4", item.media[1].videoUrl)
        assertEquals("poster.jpg", item.media[1].posterUrl)
        assertNull(item.media[1].width)
        assertNull(item.media[1].height)
    }

    @Test fun unusedTypeDoesNotRejectOtherwiseReadableMedia() {
        val media = json.decodeFromString<CurationMedia>("""{"type":{"unused":true},"url":"photo.jpg"}""")
        assertEquals("photo.jpg", media.url)
        assertNull(media.videoUrl)
    }
}
