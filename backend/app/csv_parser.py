from __future__ import annotations

import csv
import io

# Map German (and other common) column names to canonical keys
HEADER_MAP: dict[str, str] = {
    "isin": "isin",
    "wkn": "isin",
    "name": "name",
    "wertpapier": "name",
    "bezeichnung": "name",
    "quantity": "quantity",
    "stück": "quantity",
    "stueck": "quantity",
    "stk": "quantity",
    "anzahl": "quantity",
    "menge": "quantity",
    "purchase_price": "purchase_price",
    "kaufpreis": "purchase_price",
    "kurs": "purchase_price",
    "preis": "purchase_price",
    "price": "purchase_price",
    "einstandskurs": "purchase_price",
    "currency": "currency",
    "währung": "currency",
    "waehrung": "currency",
    "cur": "currency",
}

REQUIRED_FIELDS = {"name", "quantity", "purchase_price"}


def _detect_delimiter(sample: str) -> str:
    """Return ';' if semicolons outnumber commas in the first few lines, else ','."""
    semicolons = sample.count(";")
    commas = sample.count(",")
    return ";" if semicolons > commas else ","


def _normalize_header(raw: str) -> str | None:
    """Map a raw header string to a canonical field name, or None if unknown."""
    key = raw.strip().lower().replace(" ", "_")
    return HEADER_MAP.get(key)


def parse_csv(file_content: bytes) -> list[dict]:
    """Parse CSV bytes into a list of position dicts.

    Raises ValueError when the content cannot be parsed or required columns
    are missing.
    """
    try:
        text = file_content.decode("utf-8-sig")  # handles BOM from Excel exports
    except UnicodeDecodeError:
        try:
            text = file_content.decode("latin-1")
        except Exception:
            raise ValueError("Could not decode file. Please use UTF-8 or Latin-1 encoding.")

    text = text.strip()
    if not text:
        raise ValueError("The uploaded file is empty.")

    delimiter = _detect_delimiter(text)
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)

    if reader.fieldnames is None:
        raise ValueError("Could not detect CSV headers. Is the file a valid CSV?")

    # Build mapping: canonical_name -> original_header
    col_map: dict[str, str] = {}
    for raw_header in reader.fieldnames:
        canonical = _normalize_header(raw_header)
        if canonical and canonical not in col_map:
            col_map[canonical] = raw_header

    missing = REQUIRED_FIELDS - col_map.keys()
    if missing:
        raise ValueError(
            f"Missing required columns: {', '.join(sorted(missing))}. "
            f"Detected headers: {reader.fieldnames}"
        )

    positions: list[dict] = []
    for row_num, row in enumerate(reader, start=2):  # start=2 because row 1 is header
        try:
            name = row[col_map["name"]].strip()
            if not name:
                continue  # skip blank rows

            quantity_raw = row[col_map["quantity"]].strip().replace(",", ".")
            price_raw = row[col_map["purchase_price"]].strip().replace(",", ".")

            position: dict = {
                "name": name,
                "quantity": float(quantity_raw),
                "purchase_price": float(price_raw),
                "isin": row.get(col_map.get("isin", ""), "").strip() or None,
                "currency": row.get(col_map.get("currency", ""), "EUR").strip() or "EUR",
            }
            positions.append(position)
        except (ValueError, KeyError) as exc:
            raise ValueError(f"Error parsing row {row_num}: {exc}")

    if not positions:
        raise ValueError("No valid positions found in the CSV file.")

    return positions
