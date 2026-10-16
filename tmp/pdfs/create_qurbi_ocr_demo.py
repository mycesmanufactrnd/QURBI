from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "qurbi-ocr-demo-documents.pdf"

PAGE_W, PAGE_H = A4
INK = colors.HexColor("#352B25")
MUTED = colors.HexColor("#756A62")
CREAM = colors.HexColor("#F7F2EB")
PAPER = colors.HexColor("#FFFDFC")
ACCENT = colors.HexColor("#654F40")
GOLD = colors.HexColor("#C99655")
GREEN = colors.HexColor("#39735B")
RED = colors.HexColor("#B13A36")
LINE = colors.HexColor("#DED3C7")


def rounded_box(c, x, y, w, h, fill=PAPER, stroke=LINE, radius=4 * mm, width=0.8):
    c.setLineWidth(width)
    c.setStrokeColor(stroke)
    c.setFillColor(fill)
    c.roundRect(x, y, w, h, radius, stroke=1, fill=1)


def paragraph(c, text, x, y_top, width, font="Helvetica", size=9, color=INK, leading=None, align=TA_LEFT):
    style = ParagraphStyle(
        "inline",
        fontName=font,
        fontSize=size,
        leading=leading or size * 1.35,
        textColor=color,
        alignment=align,
        spaceAfter=0,
        spaceBefore=0,
    )
    item = Paragraph(text, style)
    _, height = item.wrap(width, PAGE_H)
    item.drawOn(c, x, y_top - height)
    return height


def header(c, document_code, title, subtitle):
    c.setFillColor(CREAM)
    c.rect(0, PAGE_H - 42 * mm, PAGE_W, 42 * mm, stroke=0, fill=1)

    c.setFillColor(ACCENT)
    c.roundRect(18 * mm, PAGE_H - 29 * mm, 15 * mm, 15 * mm, 4 * mm, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 13)
    c.drawCentredString(25.5 * mm, PAGE_H - 23.6 * mm, "Q")

    c.setFillColor(MUTED)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(38 * mm, PAGE_H - 17.8 * mm, "QURBI OCR DEMONSTRATION")
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 17)
    c.drawString(38 * mm, PAGE_H - 25 * mm, title)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8.5)
    c.drawString(38 * mm, PAGE_H - 31 * mm, subtitle)

    badge_w = stringWidth(document_code, "Helvetica-Bold", 7) + 10 * mm
    c.setFillColor(colors.HexColor("#E9DED1"))
    c.roundRect(PAGE_W - 18 * mm - badge_w, PAGE_H - 25 * mm, badge_w, 8 * mm, 4 * mm, stroke=0, fill=1)
    c.setFillColor(ACCENT)
    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(PAGE_W - 18 * mm - badge_w / 2, PAGE_H - 22.2 * mm, document_code)


def watermark(c):
    c.saveState()
    c.setFillAlpha(0.055)
    c.setFillColor(RED)
    c.translate(PAGE_W / 2, PAGE_H / 2)
    c.rotate(32)
    c.setFont("Helvetica-Bold", 42)
    c.drawCentredString(0, 0, "DEMO - NOT VALID")
    c.restoreState()


def footer(c, page_no):
    c.setStrokeColor(LINE)
    c.line(18 * mm, 17 * mm, PAGE_W - 18 * mm, 17 * mm)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7)
    c.drawString(18 * mm, 11.5 * mm, "Synthetic data for QURBI OCR testing only. Not an official veterinary document.")
    c.drawRightString(PAGE_W - 18 * mm, 11.5 * mm, f"DEMO {page_no} / 3")


def section_title(c, title, y):
    c.setFillColor(ACCENT)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(22 * mm, y, title.upper())
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.4)
    c.line(22 * mm, y - 2.5 * mm, 47 * mm, y - 2.5 * mm)


def fields_grid(c, fields, x, y_top, width, columns=2, row_h=22 * mm):
    gap = 4 * mm
    cell_w = (width - (columns - 1) * gap) / columns
    for index, (label, value) in enumerate(fields):
        row = index // columns
        col = index % columns
        cx = x + col * (cell_w + gap)
        cy = y_top - (row + 1) * row_h
        rounded_box(c, cx, cy, cell_w, row_h - 3 * mm, fill=colors.white)
        c.setFillColor(MUTED)
        c.setFont("Helvetica-Bold", 7)
        c.drawString(cx + 4 * mm, cy + row_h - 9 * mm, label.upper())
        paragraph(c, value, cx + 4 * mm, cy + row_h - 12 * mm, cell_w - 8 * mm, "Helvetica-Bold", 10, INK, 12)
    return y_top - ((len(fields) + columns - 1) // columns) * row_h


def status_row(c, x, y, label, detail, ok=True):
    rounded_box(c, x, y, 166 * mm, 15 * mm, fill=colors.HexColor("#F7FAF8" if ok else "#FFF8F1"))
    c.setFillColor(GREEN if ok else GOLD)
    c.circle(x + 7 * mm, y + 7.5 * mm, 2.5 * mm, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 5.5)
    c.drawCentredString(x + 7 * mm, y + 5.6 * mm, "OK" if ok else "!")
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(x + 13 * mm, y + 8.7 * mm, label)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7.5)
    c.drawString(x + 13 * mm, y + 4.4 * mm, detail)


def page_health(c):
    header(c, "SAMPLE SKV-01", "Veterinary Health Certificate", "Synthetic herd health record for bulk OCR testing")
    watermark(c)

    section_title(c, "Certificate information", PAGE_H - 53 * mm)
    y = fields_grid(c, [
        ("Certificate No", "DEMO-SKV-2026-001"),
        ("Issue Date", "08/10/2026"),
        ("Farm Name", "Ladang Demo Qurbi"),
        ("State", "Selangor"),
    ], 22 * mm, PAGE_H - 60 * mm, 166 * mm)

    section_title(c, "Livestock details", y - 2 * mm)
    y = fields_grid(c, [
        ("Species", "Cow"),
        ("Breed", "Brahman"),
        ("Male", "4"),
        ("Female", "6"),
        ("Animal ID", "COW-SEL-1001"),
        ("Total Animals", "10"),
    ], 22 * mm, y - 9 * mm, 166 * mm)

    section_title(c, "Veterinary assessment", y - 1 * mm)
    status_row(c, 22 * mm, y - 23 * mm, "Clinical inspection completed", "No visible signs of infectious disease at the time of examination.")
    status_row(c, 22 * mm, y - 42 * mm, "Fit for movement", "Demo assessment only - this statement has no legal validity.")

    rounded_box(c, 22 * mm, y - 77 * mm, 166 * mm, 25 * mm, fill=colors.white)
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(27 * mm, y - 60 * mm, "VETERINARY OFFICER")
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(27 * mm, y - 67 * mm, "Dr Demo Ahmad")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7.5)
    c.drawString(27 * mm, y - 72 * mm, "QURBI Demo Veterinary Unit")
    c.setStrokeColor(MUTED)
    c.line(130 * mm, y - 69 * mm, 178 * mm, y - 69 * mm)
    c.drawCentredString(154 * mm, y - 74 * mm, "Demo signature area")
    footer(c, 1)


def page_birth(c):
    header(c, "SAMPLE BIRTH-02", "Livestock Birth Certificate", "Synthetic individual animal record for OCR testing")
    watermark(c)

    section_title(c, "Birth registration", PAGE_H - 53 * mm)
    y = fields_grid(c, [
        ("Certificate No", "DEMO-BC-2026-002"),
        ("Registration Date", "08/10/2026"),
        ("Animal ID", "GOAT-SEL-2045"),
        ("State", "Selangor"),
    ], 22 * mm, PAGE_H - 60 * mm, 166 * mm)

    section_title(c, "Animal details", y - 2 * mm)
    y = fields_grid(c, [
        ("Species", "Goat"),
        ("Breed", "Boer"),
        ("Gender", "Female"),
        ("Date of Birth", "08/09/2026"),
        ("Colour", "Brown and white"),
        ("Birth Weight", "3.8 kg"),
    ], 22 * mm, y - 9 * mm, 166 * mm)

    section_title(c, "Parentage and farm", y - 1 * mm)
    y = fields_grid(c, [
        ("Sire", "BOER-S-0092"),
        ("Dam", "BOER-D-0178"),
        ("Farm Name", "Ladang Demo Qurbi"),
        ("Premise ID", "DEMO-PREM-008"),
    ], 22 * mm, y - 8 * mm, 166 * mm)

    rounded_box(c, 22 * mm, y - 32 * mm, 166 * mm, 24 * mm, fill=colors.HexColor("#FFF8F1"), stroke=colors.HexColor("#E7C99E"))
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(27 * mm, y - 17 * mm, "OCR TEST NOTE")
    paragraph(c, "This sample contains a single female animal. QURBI should detect the species, breed, gender, birth date, state and animal ID.", 27 * mm, y - 20 * mm, 150 * mm, size=8, color=INK, leading=10)
    footer(c, 2)


def page_bulk(c):
    header(c, "SAMPLE BULK-03", "Livestock Details", "Synthetic herd inventory for bulk insertion testing")
    watermark(c)

    section_title(c, "Herd summary", PAGE_H - 53 * mm)
    y = fields_grid(c, [
        ("Record No", "DEMO-HERD-2026-003"),
        ("Record Date", "08/10/2026"),
        ("Farm Name", "Ladang Selatan Demo"),
        ("State", "Johor"),
    ], 22 * mm, PAGE_H - 60 * mm, 166 * mm)

    section_title(c, "Breed group 1", y - 2 * mm)
    y = fields_grid(c, [
        ("Species", "Cow"),
        ("Breed", "Simmental"),
        ("Male", "3"),
        ("Female", "7"),
    ], 22 * mm, y - 9 * mm, 166 * mm)

    rounded_box(c, 22 * mm, y - 41 * mm, 166 * mm, 31 * mm, fill=colors.white)
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(27 * mm, y - 20 * mm, "GROUP TOTAL")
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(27 * mm, y - 32 * mm, "10 animals")
    c.setFillColor(GREEN)
    c.roundRect(137 * mm, y - 31 * mm, 40 * mm, 11 * mm, 5.5 * mm, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(157 * mm, y - 27.4 * mm, "READY TO IMPORT")

    section_title(c, "Demo instructions", y - 53 * mm)
    instructions = [
        "Upload this page alone when testing Bulk OCR.",
        "Do not mix the Goat birth sample into a Cow bulk listing.",
        "Check that QURBI identifies Cow and Simmental.",
        "Confirm that Male 3 and Female 7 are inserted into the breed breakdown.",
    ]
    for index, text in enumerate(instructions, start=1):
        iy = y - (65 + (index - 1) * 13) * mm
        c.setFillColor(ACCENT)
        c.circle(27 * mm, iy + 2 * mm, 3.6 * mm, stroke=0, fill=1)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 7)
        c.drawCentredString(27 * mm, iy - 0.4 * mm, str(index))
        c.setFillColor(INK)
        c.setFont("Helvetica", 8.5)
        c.drawString(35 * mm, iy, text)
    footer(c, 3)


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=A4, pageCompression=1)
    c.setTitle("QURBI OCR Demo Documents")
    c.setAuthor("QURBI Demo")
    c.setSubject("Synthetic veterinary and livestock documents for OCR testing")
    for draw_page in (page_health, page_birth, page_bulk):
        c.setFillColor(PAPER)
        c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
        draw_page(c)
        c.showPage()
    c.save()
    print(OUTPUT)


if __name__ == "__main__":
    build()
