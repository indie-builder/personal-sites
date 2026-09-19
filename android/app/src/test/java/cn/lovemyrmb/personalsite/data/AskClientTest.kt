package cn.lovemyrmb.personalsite.data

import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import okhttp3.Response
import okhttp3.Protocol
import okhttp3.ResponseBody.Companion.toResponseBody
import okhttp3.MediaType.Companion.toMediaType

class AskClientTest {
    private val json = Json { ignoreUnknownKeys = true }
    private val parser = AskClient(OkHttpClient(), json)

    @Test fun sourcesRetainBodyIdentityAndNullableSectionInOrder() {
        val event = parser.parseFrame("sources", """{"sources":[{"id":"profile:1","sourceId":"profile","title":"个人资料","content":"真实引用正文","scope":"profile","section":null,"publishedAt":null,"sourceUrl":"/"},{"id":"news:2","title":"新闻","content":"第二段","section":"AI"}]}""") as AskEvent.Sources
        assertEquals(2, event.items.size)
        assertEquals("真实引用正文", event.items[0].content)
        assertEquals("profile:1", event.items[0].id)
        assertNull(event.items[0].section)
        assertEquals("第二段", event.items[1].content)
    }

    @Test fun invalidSourceCannotSilentlyShiftCitationNumbers() {
        assertTrue(parser.parseFrame("sources", """{"sources":[{"title":"one"},false,{"title":"three"}]}""") is AskEvent.Error)
    }

    @Test fun serverErrorIsNotFollowedBySyntheticDone() {
        assertEquals(listOf(AskEvent.Delta("部分回答"), AskEvent.Error("暂时不可用")), collect("event: text\ndata: {\"delta\":\"部分回答\"}\n\nevent: error\ndata: {\"message\":\"暂时不可用\"}\n\n"))
    }

    @Test fun explicitDoneIsEmittedOnce() {
        assertEquals(listOf(AskEvent.Delta("回答"), AskEvent.Done), collect("event: text\ndata: {\"delta\":\"回答\"}\n\nevent: done\ndata: {}\n\n"))
    }

    @Test fun incompleteStreamIsAnError() {
        val events = collect("event: text\ndata: {\"delta\":\"未完成\"}\n\n")
        assertTrue(events.last() is AskEvent.Error)
        assertFalse(events.contains(AskEvent.Done))
    }

    private fun collect(body: String): List<AskEvent> {
        val latch = CountDownLatch(1)
        val events = mutableListOf<AskEvent>()
        val http = OkHttpClient.Builder().addInterceptor { chain ->
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                .body(body.toResponseBody("text/event-stream".toMediaType())).build()
        }.build()
        try {
            AskClient(http, json).ask("问题", "1234567890123456", "1234567890123456") {
                events.add(it)
                if (it is AskEvent.Done || it is AskEvent.Error) latch.countDown()
            }
            assertTrue(latch.await(5, TimeUnit.SECONDS))
            // Wait for the callback to exit, proving no EOF-generated second terminal event.
            http.dispatcher.executorService.shutdown()
            assertTrue(http.dispatcher.executorService.awaitTermination(5, TimeUnit.SECONDS))
            return events.toList()
        } finally { http.connectionPool.evictAll() }
    }
}
