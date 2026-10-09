from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


OUTPUT_DIR = Path(r"C:\Users\adama\Documents\QURBI\output\pdf")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"


def styles():
    return {
        "title": ParagraphStyle(
            "title",
            fontName=FONT_BOLD,
            fontSize=18,
            leading=22,
            alignment=TA_CENTER,
            textColor=colors.black,
            spaceAfter=5 * mm,
        ),
        "subtitle": ParagraphStyle(
            "subtitle",
            fontName=FONT_REGULAR,
            fontSize=10,
            leading=13,
            alignment=TA_CENTER,
            textColor=colors.black,
            spaceAfter=8 * mm,
        ),
        "body": ParagraphStyle(
            "body",
            fontName=FONT_REGULAR,
            fontSize=11,
            leading=14,
            textColor=colors.black,
        ),
        "bold": ParagraphStyle(
            "bold",
            fontName=FONT_BOLD,
            fontSize=11,
            leading=14,
            textColor=colors.black,
        ),
        "note": ParagraphStyle(
            "note",
            fontName=FONT_BOLD,
            fontSize=10,
            leading=13,
            alignment=TA_CENTER,
            textColor=colors.black,
        ),
    }


def make_pdf(filename, title, subtitle, rows, note):
    file_path = OUTPUT_DIR / filename
    doc = SimpleDocTemplate(
        str(file_path),
        pagesize=A4,
        rightMargin=22 * mm,
        leftMargin=22 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        title=title,
        author="QURBI",
    )
    s = styles()
    story = [
        Paragraph("QURBI", s["title"]),
        Paragraph(title, s["title"]),
        Paragraph(subtitle, s["subtitle"]),
    ]

    data = []
    for label, value in rows:
        data.append([Paragraph(label, s["bold"]), Paragraph(value, s["body"])])

    table = Table(data, colWidths=[58 * mm, 95 * mm], hAlign="CENTER")
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.8, colors.black),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 4 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * mm),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F2F2F2")),
            ]
        )
    )
    story.extend([table, Spacer(1, 10 * mm), Paragraph(note, s["note"])])
    doc.build(story)
    return file_path


def main():
    bulk = make_pdf(
        "QURBI_Bulk_OCR_Demo.pdf",
        "BULK LIVESTOCK RECORD",
        "Demo document for Bulk OCR - upload this file by itself",
        [
            ("Document type", "Bulk livestock record"),
            ("Reference number", "QURBI-BULK-2026-001"),
            ("Species", "Cow"),
            ("Breed", "Brahman"),
            ("Male count", "4"),
            ("Female count", "8"),
            ("Total animals", "12"),
            ("State", "Selangor"),
            ("Farm name", "QURBI Demo Farm"),
            ("Record date", "09 October 2026"),
        ],
        "FOR BULK OCR TESTING ONLY - DO NOT COMBINE WITH ANOTHER SPECIES",
    )

    individual = make_pdf(
        "QURBI_Individual_OCR_Demo.pdf",
        "LIVESTOCK BIRTH CERTIFICATE",
        "Demo document for Individual OCR - upload this file by itself",
        [
            ("Document type", "Livestock birth certificate"),
            ("Certificate number", "QURBI-CERT-2026-0142"),
            ("Animal ID / Tag", "GT-BOER-0142"),
            ("Species", "Goat"),
            ("Breed", "Boer"),
            ("Gender", "Female"),
            ("Birth date", "15 March 2026"),
            ("Colour", "White and brown"),
            ("State", "Selangor"),
            ("Veterinary officer", "Dr Nur Aisyah Rahman"),
        ],
        "FOR INDIVIDUAL OCR TESTING ONLY",
    )

    print(bulk)
    print(individual)


if __name__ == "__main__":
    main()
