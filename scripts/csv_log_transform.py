#!/usr/bin/env python3
"""
csv_log_transform.py

Read a CSV file, rename headers according to a provided mapping (dictionary), and
log every record to a separate output CSV file with the transformed headers.

Header mapping is defined in this file via the `HEADER_MAPPING` variable.

Usage examples:

1) Basic run using in-file mapping:
   $ python scripts/csv_log_transform.py input.csv --output input.log.csv

2) Drop columns that are not present in the mapping:
   $ python scripts/csv_log_transform.py input.csv --drop-unmapped

3) Handle header name collisions after mapping by auto-suffixing duplicates:
   $ python scripts/csv_log_transform.py input.csv --allow-collisions-suffix

Notes:
- Set `HEADER_MAPPING` below, for example:
  HEADER_MAPPING = {
      "old_col_a": "new_col_a",
      "old_col_b": "new_col_b",
  }
- The script streams rows and does not load the entire file into memory.
- The input CSV dialect (delimiter/quote) is auto-detected when possible.
- Default encoding is 'utf-8-sig' to tolerate BOM-marked UTF-8 files.
- By default, unmapped headers are preserved unchanged; use --drop-unmapped to exclude them.
"""
from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path
from typing import Dict, List, Tuple, Optional

# Define your header mapping here. Keys are input CSV headers, values are output headers.
# Example:
# HEADER_MAPPING = {
#     "old_col_a": "new_col_a",
#     "old_col_b": "new_col_b",
# }
HEADER_MAPPING: Dict[str, str] = {}


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Read a CSV, rename headers using a mapping, and write all records "
            "to a new log CSV with transformed headers."
        )
    )
    parser.add_argument(
        "input",
        help="Path to the input CSV file",
    )
    parser.add_argument(
        "-o",
        "--output",
        help=(
            "Path to the output log CSV file. Default: '<input>.log.csv' (suffix appended)."
        ),
    )
    parser.add_argument(
        "--drop-unmapped",
        action="store_true",
        help=(
            "If set, columns not present in the mapping will be dropped instead of preserved."
        ),
    )
    parser.add_argument(
        "--allow-collisions-suffix",
        action="store_true",
        help=(
            "If set, when multiple input headers map to the same output name, "
            "auto-suffix duplicates like 'name_1', 'name_2' instead of erroring."
        ),
    )
    parser.add_argument(
        "--encoding",
        default="utf-8-sig",
        help=(
            "Text encoding for input and output files (default: 'utf-8-sig')."
        ),
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Reduce non-error output to a minimum.",
    )
    return parser.parse_args(argv)


def derive_default_output_path(input_path: str) -> str:
    p = Path(input_path)
    # Append .log.csv, preserving original extension if present
    if p.suffix:
        return str(p.with_suffix(p.suffix + ".log.csv"))
    return str(p) + ".log.csv"


def sniff_dialect_and_rewind(file_obj) -> csv.Dialect:
    sample = file_obj.read(64 * 1024)
    file_obj.seek(0)
    try:
        dialect = csv.Sniffer().sniff(sample)
    except csv.Error:
        dialect = csv.get_dialect("excel")
    return dialect


def dedupe_preserving_order(
    names: List[str], allow_suffix: bool
) -> Tuple[List[str], bool]:
    """
    Return a list of unique names, preserving order. If duplicates occur and
    allow_suffix is True, suffix duplicates as name_1, name_2, etc. If False, we
    leave names unchanged but signal that duplicates were found (caller should error).

    Returns: (unique_names, had_duplicates)
    """
    seen_counts: Dict[str, int] = {}
    unique: List[str] = []
    had_duplicates = False
    for name in names:
        count = seen_counts.get(name, 0)
        if count == 0:
            unique.append(name)
            seen_counts[name] = 1
        else:
            had_duplicates = True
            if allow_suffix:
                unique_name = f"{name}_{count}"
                # Ensure the suffixed name itself has not been used
                while unique_name in seen_counts:
                    count += 1
                    unique_name = f"{name}_{count}"
                unique.append(unique_name)
                seen_counts[name] = count + 1
                seen_counts[unique_name] = 1
            else:
                unique.append(name)  # Placeholder (will error at caller)
                seen_counts[name] = count + 1
    return unique, had_duplicates


def transform_and_log(
    input_csv_path: str,
    output_csv_path: str,
    mapping: Dict[str, str],
    drop_unmapped: bool,
    allow_collisions_suffix: bool,
    encoding: str,
    quiet: bool,
) -> int:
    input_path = Path(input_csv_path)
    output_path = Path(output_csv_path)

    if not input_path.exists():
        raise SystemExit(f"Input CSV not found: {input_csv_path}")

    # Ensure parent directory exists for output
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with input_path.open("r", encoding=encoding, newline="") as infile:
        dialect = sniff_dialect_and_rewind(infile)
        reader = csv.DictReader(infile, dialect=dialect)

        if reader.fieldnames is None:
            raise SystemExit(
                "Input CSV appears to have no header row. A header row is required."
            )

        original_fields: List[str] = reader.fieldnames

        # Determine output field names based on mapping and drop_unmapped
        output_name_candidates: List[str] = []
        kept_original_fields: List[str] = []

        for col in original_fields:
            if col in mapping:
                new_name = mapping[col]
                if not new_name:
                    raise SystemExit(
                        f"Mapped new name for column '{col}' is empty. Provide a non-empty name."
                    )
                output_name_candidates.append(new_name)
                kept_original_fields.append(col)
            else:
                if drop_unmapped:
                    continue
                output_name_candidates.append(col)
                kept_original_fields.append(col)

        unique_output_names, had_dupes = dedupe_preserving_order(
            output_name_candidates, allow_suffix=allow_collisions_suffix
        )

        if had_dupes and not allow_collisions_suffix:
            # Identify the colliding names for a clearer message
            name_counts: Dict[str, int] = {}
            collisions: List[str] = []
            for name in output_name_candidates:
                name_counts[name] = name_counts.get(name, 0) + 1
            for name, cnt in name_counts.items():
                if cnt > 1:
                    collisions.append(name)
            raise SystemExit(
                "Duplicate header names after mapping: "
                + ", ".join(collisions)
                + ". Use --allow-collisions-suffix to auto-suffix duplicates."
            )

        # Prepare pairs of (original_column, final_output_name)
        column_pairs: List[Tuple[str, str]] = list(
            zip(kept_original_fields, unique_output_names)
        )

        with output_path.open("w", encoding=encoding, newline="") as outfile:
            writer = csv.DictWriter(
                outfile, fieldnames=unique_output_names, dialect=dialect
            )
            writer.writeheader()

            row_count = 0
            for row in reader:
                out_row = {new: row.get(orig, "") for orig, new in column_pairs}
                writer.writerow(out_row)
                row_count += 1

    if not quiet:
        sys.stderr.write(
            f"Processed {row_count} rows from '{input_csv_path}'.\n"
        )
        sys.stderr.write(
            f"Wrote transformed log CSV to '{output_csv_path}'.\n"
        )
    return row_count


def main(argv: Optional[List[str]] = None) -> None:
    args = parse_args(argv)
    mapping = HEADER_MAPPING

    output = args.output or derive_default_output_path(args.input)

    try:
        transform_and_log(
            input_csv_path=args.input,
            output_csv_path=output,
            mapping=mapping,
            drop_unmapped=args.drop_unmapped,
            allow_collisions_suffix=args.allow_collisions_suffix,
            encoding=args.encoding,
            quiet=args.quiet,
        )
    except KeyboardInterrupt:
        sys.stderr.write("Interrupted.\n")
        sys.exit(130)


if __name__ == "__main__":
    main()
