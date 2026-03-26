"""Textextraktion aus PDF, Excel und CSV Dateien."""

import io
import csv

import pdfplumber
import openpyxl


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extrahiert Text aus allen Seiten eines PDFs."""
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages)


def extract_text_from_excel(file_bytes: bytes) -> str:
    """Liest alle Sheets einer Excel-Datei als Tab-separierten Text."""
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True)
    lines = []
    for sheet in wb.worksheets:
        for row in sheet.iter_rows(values_only=True):
            lines.append("\t".join(
                str(cell) if cell is not None else "" for cell in row
            ))
    wb.close()
    return "\n".join(lines)


def extract_text_from_csv(file_bytes: bytes) -> str:
    """Liest CSV-Inhalt als Text (utf-8-sig fuer deutsche Excel-Exporte)."""
    return file_bytes.decode("utf-8-sig")
