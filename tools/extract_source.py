#!/usr/bin/env python3
"""
Source extraction utility for the Pramāṇa Wiki.

Extracts text from PDFs, ePUBs, and markdown files into clean markdown
in raw/extracted/. Handles encoding issues and flags scanned pages.

Usage:
    python extract_source.py <path-to-file>
    python extract_source.py raw/pdfs/example.pdf
"""

import argparse
import re
import shutil
import sys
import unicodedata
from pathlib import Path

# Tibetan Unicode range: U+0F00 to U+0FFF
TIBETAN_RANGE = re.compile(r"[\u0F00-\u0FFF]")
# Minimum characters per page to consider it "has text"
MIN_TEXT_CHARS = 50


def normalise_unicode(text: str) -> str:
    """Normalise to NFC and fix common encoding issues."""
    return unicodedata.normalize("NFC", text)


def detect_and_decode(raw_bytes: bytes) -> str:
    """Detect encoding and decode bytes to string."""
    import chardet

    detection = chardet.detect(raw_bytes)
    encoding = detection.get("encoding", "utf-8") or "utf-8"
    try:
        text = raw_bytes.decode(encoding)
    except (UnicodeDecodeError, LookupError):
        text = raw_bytes.decode("utf-8", errors="replace")
    return normalise_unicode(text)


def has_tibetan(text: str) -> bool:
    """Check if text contains Tibetan script characters."""
    return bool(TIBETAN_RANGE.search(text))


def extract_pdf(filepath: Path, output_dir: Path) -> Path:
    """Extract text from a PDF file using PyMuPDF."""
    import pymupdf

    doc = pymupdf.open(str(filepath))
    pages = []
    scan_flagged = []

    for i, page in enumerate(doc):
        text = page.get_text("text")
        text = normalise_unicode(text) if text else ""

        if len(text.strip()) < MIN_TEXT_CHARS:
            scan_flagged.append(i + 1)
            pages.append(
                f"## Page {i + 1}\n\n"
                f"**[SCANNED PAGE — low text content, requires visual reading]**\n\n"
                f"{text.strip()}\n"
            )
        else:
            pages.append(f"## Page {i + 1}\n\n{text.strip()}\n")

    doc.close()

    # Build output
    stem = filepath.stem
    output_path = output_dir / f"{stem}.md"

    header_lines = [
        f"# Extracted: {filepath.name}",
        f"",
        f"- **Source**: `{filepath}`",
        f"- **Pages**: {len(pages)}",
        f"- **Contains Tibetan**: {'yes' if any(has_tibetan(p) for p in pages) else 'no'}",
    ]

    if scan_flagged:
        header_lines.append(
            f"- **Scanned pages** (need visual reading): {', '.join(str(p) for p in scan_flagged)}"
        )

    header_lines.append("")

    content = "\n".join(header_lines) + "\n" + "\n---\n\n".join(pages)

    output_path.write_text(content, encoding="utf-8")
    print(f"Extracted {len(pages)} pages to {output_path}")
    if scan_flagged:
        print(
            f"WARNING: {len(scan_flagged)} scanned page(s) flagged: {scan_flagged}"
        )
    return output_path


def extract_epub(filepath: Path, output_dir: Path) -> Path:
    """Extract text from an ePUB file using ebooklib + BeautifulSoup."""
    import ebooklib
    import warnings
    from bs4 import BeautifulSoup
    from bs4 import XMLParsedAsHTMLWarning
    from ebooklib import epub

    # Some EPUB "HTML" documents are XHTML/XML-ish; BeautifulSoup warns, but for
    # our plain-text extraction this is fine.
    warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

    def _collapse_spaces(s: str) -> str:
        return re.sub(r"[ \t\f\v]+", " ", s).strip()

    def _block_text(tag) -> str:
        """
        Extract text from a (block) tag without injecting newlines between inline
        elements like <em>, which BS4's get_text(separator=...) does.
        """
        # get_text() with no separator keeps the document's own spacing, so
        # inline <span>s don't grow spaces before punctuation ("Monks ,").
        text = tag.get_text()
        text = normalise_unicode(text)
        return _collapse_spaces(re.sub(r"\s+", " ", text))

    def _html_to_blocks(body) -> list[str]:
        """
        Convert HTML body to "markdown-ish" blocks.

        We insert blank lines only between block-level elements, avoiding the
        pathological behaviour where inline emphasis creates paragraph breaks.
        """
        # Remove non-content elements
        for junk in body.find_all(["script", "style", "noscript"]):
            junk.decompose()

        blocks: list[str] = []

        def _classes(tag) -> set[str]:
            c = tag.get("class") or []
            return set(c) if isinstance(c, list) else set(c.split())

        # Prefer semantic block elements when present.
        block_names = {
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "p",
            "li",
            "blockquote",
            "pre",
            "dt",
            "dd",
        }

        # Milestone markers (84000 epubs: <div class="gtr">14.10</div>) become a
        # bracketed prefix on the next block, giving stable citation anchors.
        pending_milestone = ""

        def _is_verse_group(tag) -> bool:
            return getattr(tag, "name", None) == "div" and "line-group" in _classes(tag)

        for el in body.descendants:
            name = getattr(el, "name", None)
            if name == "div" and "gtr" in _classes(el):
                t = _block_text(el)
                if t:
                    pending_milestone = f"[{t}] "
                continue
            is_verse = _is_verse_group(el)
            if name not in block_names and not is_verse:
                continue

            # Skip nested blocks if an ancestor is also a block (avoid duplicates)
            parent = el.parent
            while parent is not None and getattr(parent, "name", None) != "body":
                if getattr(parent, "name", None) in block_names or _is_verse_group(parent):
                    break
                parent = parent.parent
            else:
                # no block ancestor found (other than body)
                parent = None

            if parent is not None:
                continue

            if is_verse:
                # One block per stanza, one line per <div class="line">.
                lines = [_block_text(d) for d in el.find_all("div", class_="line")]
                lines = [ln for ln in lines if ln]
                if lines:
                    blocks.append(pending_milestone + "\n".join(lines))
                    pending_milestone = ""
                continue

            t = _block_text(el)
            if not t:
                continue
            if not (name and name.startswith("h") and len(name) == 2):
                t = pending_milestone + t
                pending_milestone = ""

            if el.name and el.name.startswith("h") and len(el.name) == 2:
                level = int(el.name[1])
                level = min(max(level, 1), 6)
                blocks.append(f"{'#' * level} {t}")
            elif el.name == "li":
                blocks.append(f"- {t}")
            else:
                blocks.append(t)

        # Fallback: if we somehow found nothing, just extract the whole body
        if not blocks:
            t = _block_text(body)
            if t:
                blocks = [t]

        # De-dupe consecutive identical blocks (common in some EPUBs)
        deduped: list[str] = []
        for b in blocks:
            if not deduped or deduped[-1] != b:
                deduped.append(b)
        return deduped

    book = epub.read_epub(str(filepath), options={"ignore_ncx": True})
    chapters = []

    for item in book.get_items():
        if item.get_type() == ebooklib.ITEM_DOCUMENT:
            raw = item.get_content()
            text = detect_and_decode(raw)
            soup = BeautifulSoup(text, "lxml")

            # Extract text, preserving some structure
            body = soup.find("body")
            if body:
                blocks = _html_to_blocks(body)
                chapter_text = "\n\n".join(blocks)
                if chapter_text.strip():
                    title_tag = soup.find(["h1", "h2", "h3"])
                    title = title_tag.get_text(strip=True) if title_tag else f"Section {len(chapters) + 1}"
                    chapters.append(f"## {title}\n\n{chapter_text}")

    stem = filepath.stem
    output_path = output_dir / f"{stem}.md"

    header = (
        f"# Extracted: {filepath.name}\n\n"
        f"- **Source**: `{filepath}`\n"
        f"- **Sections**: {len(chapters)}\n"
        f"- **Contains Tibetan**: {'yes' if any(has_tibetan(c) for c in chapters) else 'no'}\n\n"
    )

    content = header + "\n---\n\n".join(chapters)
    output_path.write_text(content, encoding="utf-8")
    print(f"Extracted {len(chapters)} sections to {output_path}")
    return output_path


def extract_markdown(filepath: Path, output_dir: Path) -> Path:
    """Copy and normalise a markdown file."""
    raw = filepath.read_bytes()
    text = detect_and_decode(raw)

    stem = filepath.stem
    output_path = output_dir / f"{stem}.md"

    header = (
        f"# Extracted: {filepath.name}\n\n"
        f"- **Source**: `{filepath}`\n"
        f"- **Contains Tibetan**: {'yes' if has_tibetan(text) else 'no'}\n\n"
        f"---\n\n"
    )

    output_path.write_text(header + text, encoding="utf-8")
    print(f"Copied and normalised to {output_path}")
    return output_path


def main():
    parser = argparse.ArgumentParser(
        description="Extract text from raw for the Pramāṇa Wiki"
    )
    parser.add_argument("filepath", type=Path, help="Path to the source file")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Output directory (default: raw/extracted/)",
    )
    args = parser.parse_args()

    filepath = args.filepath.resolve()
    if not filepath.exists():
        print(f"Error: file not found: {filepath}", file=sys.stderr)
        sys.exit(1)

    # Determine output directory
    if args.output_dir:
        output_dir = args.output_dir.resolve()
    else:
        # Walk up to find the vault root (where CLAUDE.md lives)
        check = filepath.parent
        vault_root = None
        for _ in range(10):
            if (check / "CLAUDE.md").exists():
                vault_root = check
                break
            check = check.parent
        if vault_root is None:
            vault_root = Path.cwd()
        output_dir = vault_root / "raw" / "extracted"

    output_dir.mkdir(parents=True, exist_ok=True)

    suffix = filepath.suffix.lower()
    if suffix == ".pdf":
        extract_pdf(filepath, output_dir)
    elif suffix == ".epub":
        extract_epub(filepath, output_dir)
    elif suffix in (".md", ".markdown", ".txt"):
        extract_markdown(filepath, output_dir)
    else:
        print(f"Error: unsupported file type: {suffix}", file=sys.stderr)
        print("Supported: .pdf, .epub, .md, .markdown, .txt", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
