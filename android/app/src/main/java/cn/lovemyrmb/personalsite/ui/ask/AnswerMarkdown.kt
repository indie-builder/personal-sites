package cn.lovemyrmb.personalsite.ui.ask

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import cn.lovemyrmb.personalsite.ui.theme.SiteTheme
import cn.lovemyrmb.personalsite.ui.theme.SiteText
import cn.lovemyrmb.personalsite.ui.theme.SiteSpace
import org.commonmark.node.*
import org.commonmark.node.Text as MarkdownText
import org.commonmark.node.Paragraph as MarkdownParagraph
import org.commonmark.ext.gfm.tables.*
import org.commonmark.ext.gfm.strikethrough.*
import org.commonmark.parser.Parser

internal val answerParser: Parser = Parser.builder().extensions(listOf(TablesExtension.create(), StrikethroughExtension.create())).build()

private fun Node.children(): List<Node> = buildList {
    var child = firstChild
    while (child != null) { add(child); child = child.next }
}

@Composable
internal fun AnswerMarkdown(text: String, sourceCount: Int, onSource: (Int) -> Unit) {
    val document = remember(text) { answerParser.parse(text) }
    SelectionContainer { MarkdownBlocks(document.children(), sourceCount, onSource) }
}

@Composable
private fun MarkdownBlocks(nodes: List<Node>, count: Int, onSource: (Int) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(SiteSpace.related)) {
        nodes.forEach { node ->
            when (node) {
                is Heading -> Text(inlineText(node, count, onSource), style = if (node.level <= 2) SiteText.title else SiteText.listTitle,
                    color = SiteTheme.colors.ink, modifier = Modifier.padding(top = SiteSpace.compact))
                is MarkdownParagraph -> Text(inlineText(node, count, onSource), style = SiteText.body, color = SiteTheme.colors.ink)
                is BulletList, is OrderedList -> Column(verticalArrangement = Arrangement.spacedBy(SiteSpace.compact)) {
                    node.children().forEachIndexed { index, item ->
                        Row(horizontalArrangement = Arrangement.spacedBy(SiteSpace.compact)) {
                            Text(if (node is OrderedList) "${node.markerStartNumber + index}." else "•", style = SiteText.body, color = SiteTheme.colors.muted)
                            Box(Modifier.weight(1f)) { MarkdownBlocks(item.children(), count, onSource) }
                        }
                    }
                }
                is FencedCodeBlock -> CodeBlock(node.literal, node.info)
                is IndentedCodeBlock -> CodeBlock(node.literal, "")
                is BlockQuote -> Column(Modifier.fillMaxWidth().background(SiteTheme.colors.line).padding(SiteSpace.related)) { MarkdownBlocks(node.children(), count, onSource) }
                is ThematicBreak -> HorizontalDivider(color = SiteTheme.colors.line)
                is TableBlock -> Column(Modifier.horizontalScroll(rememberScrollState())) {
                    node.children().flatMap { it.children() }.forEach { row ->
                        Row {
                            row.children().forEach { cell ->
                                Text(inlineText(cell, count, onSource), style = if ((cell as? TableCell)?.isHeader == true) SiteText.label else SiteText.summary,
                                    color = SiteTheme.colors.ink, modifier = Modifier.width(160.dp).padding(SiteSpace.related))
                            }
                        }
                        HorizontalDivider(color = SiteTheme.colors.line)
                    }
                }
                is HtmlBlock -> Text(node.literal, style = SiteText.body, color = SiteTheme.colors.muted)
                else -> if (node.firstChild != null) MarkdownBlocks(node.children(), count, onSource)
            }
        }
    }
}

@Composable
private fun CodeBlock(code: String, language: String) {
    Column(Modifier.fillMaxWidth().background(SiteTheme.colors.line).padding(SiteSpace.related), verticalArrangement = Arrangement.spacedBy(SiteSpace.compact)) {
        if (language.isNotBlank()) Text(language, style = SiteText.meta, color = SiteTheme.colors.muted)
        Text(code.trimEnd('\n'), style = SiteText.body, color = SiteTheme.colors.ink, softWrap = false,
            modifier = Modifier.horizontalScroll(rememberScrollState()))
    }
}

@Composable
private fun inlineText(node: Node, count: Int, onSource: (Int) -> Unit): AnnotatedString {
    val ink = SiteTheme.colors.ink
    val background = SiteTheme.colors.line
    return buildAnnotatedString {
        fun visit(current: Node) {
            when (current) {
                is MarkdownText -> {
                    val start = length
                    append(current.literal)
                    Regex("【(\\d+)】|\\[(\\d+)\\]").findAll(current.literal).forEach { match ->
                        val index = (match.groupValues[1].ifEmpty { match.groupValues[2] }.toIntOrNull() ?: 0) - 1
                        if (index in 0 until count) addLink(LinkAnnotation.Clickable("source:$index", TextLinkStyles(SpanStyle(color = ink, textDecoration = TextDecoration.Underline))) { onSource(index) }, start + match.range.first, start + match.range.last + 1)
                    }
                }
                is StrongEmphasis -> withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { current.children().forEach(::visit) }
                is Emphasis -> withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { current.children().forEach(::visit) }
                is Strikethrough -> withStyle(SpanStyle(textDecoration = TextDecoration.LineThrough)) { current.children().forEach(::visit) }
                is Code -> withStyle(SpanStyle(background = background)) { append(current.literal) }
                is SoftLineBreak -> append(" ")
                is HardLineBreak -> append("\n")
                is HtmlInline -> append(current.literal)
                else -> current.children().forEach(::visit)
            }
        }
        node.children().forEach(::visit)
    }
}
