"""Reduce a status-report body to plain text or a small HTML subset."""

from html import escape
from html.parser import HTMLParser

_ALLOWED = {"p", "div", "br", "strong", "b", "em", "i", "ul", "ol", "li"}
_DROP = {"script", "style"}


class _ReportHtml(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.text: list[str] = []
        self.used_tag = False
        self._drop = 0

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if self._drop:
            if tag in _DROP:
                self._drop += 1
            return
        if tag in _DROP:
            self._drop = 1
            return
        if tag in _ALLOWED:
            self.used_tag = True
            self.parts.append(f"<{tag}>")

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in _DROP and self._drop:
            self._drop -= 1
            return
        if self._drop or tag == "br" or tag not in _ALLOWED:
            return
        self.parts.append(f"</{tag}>")

    def handle_data(self, data):
        if self._drop or not data:
            return
        self.text.append(data)
        self.parts.append(escape(data, quote=False))

    def handle_comment(self, data):
        return


def clean_report_body(value):
    if not isinstance(value, str):
        raise ValueError("Report body is required")
    parser = _ReportHtml()
    parser.feed(value)
    parser.close()
    if not "".join(parser.text).strip():
        raise ValueError("Report body is required")
    if parser.used_tag:
        return "".join(parser.parts).strip()
    return "".join(parser.text).strip()
