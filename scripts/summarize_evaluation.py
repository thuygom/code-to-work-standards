#!/usr/bin/env python3
"""Summarize recorded unique work cases without inventing unmeasured results."""
import argparse
import csv
from collections import defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
RUN_FIELDS = ("evaluation_round", "case_id", "variant", "output_type", "status", "attempts",
              "supported_claims", "total_claims", "required_correct", "required_total",
              "review_seconds", "edit_seconds", "elapsed_seconds", "cost", "currency")
CASE_FIELDS = ("case_id", "source_type", "output_type", "split", "reference")

def read_csv(path, fields):
    with Path(path).open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        if not set(fields).issubset(reader.fieldnames or []):
            raise ValueError(f"Missing CSV columns: {path}")
        return [{k: (v or "").strip() for k, v in row.items()} for row in reader]

def number(value, integer=False):
    if value == "":
        return None
    try:
        result = Decimal(value)
    except InvalidOperation as exc:
        raise ValueError(f"Invalid number: {value}") from exc
    if not result.is_finite() or result < 0 or (integer and result != result.to_integral_value()):
        raise ValueError(f"Expected a finite non-negative {'integer' if integer else 'number'}: {value}")
    return result

def percentage(a, b):
    return "N/A" if not b else f"{a / b * 100:.1f}% ({a}/{b})"

def summarize(cases, runs, include_synthetic=False):
    registry = {}
    for case in cases:
        key = case["case_id"]
        if not key or key in registry:
            raise ValueError(f"Empty or duplicate case_id: {key}")
        if case["source_type"] not in ("real", "synthetic"):
            raise ValueError(f"Invalid source_type: {key}")
        if case["split"] not in ("development", "holdout", "example_only"):
            raise ValueError(f"Invalid split: {key}")
        if case["output_type"] not in ("N1", "N2", "B1", "B2"):
            raise ValueError(f"Invalid output_type: {key}")
        registry[key] = case
    seen, groups = set(), defaultdict(list)
    for row in runs:
        key = (row["evaluation_round"], row["case_id"], row["variant"])
        if not all(key) or key in seen:
            raise ValueError(f"Empty or duplicate round/case/variant: {key}")
        seen.add(key)
        case = registry.get(row["case_id"])
        if not case or case["output_type"] != row["output_type"]:
            raise ValueError(f"Unknown case or mismatched output_type: {key}")
        if row["variant"] not in ("baseline", "proposed"):
            raise ValueError(f"Invalid variant: {key}")
        if row["status"] not in ("completed", "held", "failed", "pending"):
            raise ValueError(f"Invalid status: {key}")
        for field in RUN_FIELDS[5:14]:
            row[field] = number(row[field], field in RUN_FIELDS[5:10])
        if row["attempts"] is None or (row["status"] != "pending" and row["attempts"] < 1):
            raise ValueError(f"Invalid attempt count: {key}")
        for numerator, denominator in (("supported_claims", "total_claims"), ("required_correct", "required_total")):
            a, b = row[numerator], row[denominator]
            if (a is None) != (b is None) or (a is not None and a > b):
                raise ValueError(f"Invalid {numerator}/{denominator}: {key}")
        if row["cost"] is not None and not row["currency"]:
            raise ValueError(f"Currency required for measured cost: {key}")
        if case["split"] == "example_only" or (case["source_type"] == "synthetic" and not include_synthetic):
            continue
        group = (row["evaluation_round"], row["output_type"], row["variant"], case["split"], case["source_type"])
        groups[group].append(row)
    return groups

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", type=Path, default=ROOT / "evaluation/cases.csv")
    parser.add_argument("--runs", type=Path, default=ROOT / "evaluation/runs.csv")
    parser.add_argument("--include-synthetic", action="store_true")
    args = parser.parse_args()
    try:
        groups = summarize(read_csv(args.cases, CASE_FIELDS), read_csv(args.runs, RUN_FIELDS), args.include_synthetic)
    except (OSError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    if not groups:
        print("실측 집계 대상 0건 — 아직 평가하지 않았거나 해당 조건의 기록이 없습니다. 성공률·개선율은 N/A입니다.")
        return 0
    for key, rows in sorted(groups.items()):
        print("\n" + " | ".join(key))
        n = len(rows)
        completed = sum(row["status"] == "completed" for row in rows)
        print(f"기록된 고유 사례 {n}건; 완료 {percentage(completed, n)}; 재시도 포함 시도 {sum(r['attempts'] for r in rows)}회")
        print("상태: " + ", ".join(f"{s}={sum(r['status'] == s for r in rows)}" for s in ("completed", "held", "failed", "pending")))
        for a, b in (("supported_claims", "total_claims"), ("required_correct", "required_total")):
            measured = [r for r in rows if r[a] is not None]
            print(f"{a}: {percentage(sum(r[a] for r in measured), sum(r[b] for r in measured))}; 측정 {len(measured)}/{n}건")
        for metric in ("review_seconds", "edit_seconds", "elapsed_seconds"):
            values = [r[metric] for r in rows if r[metric] is not None]
            mean = f"{sum(values) / len(values):.1f}s" if values else "N/A"
            print(f"{metric}: 측정 사례 평균 {mean}; 측정 {len(values)}/{n}건")
        currencies = {r["currency"] for r in rows}
        if all(r["cost"] is not None for r in rows) and len(currencies) == 1:
            total = sum(r["cost"] for r in rows)
            per_completed = str(total / completed) if completed else "N/A"
            print(f"전체 시도 비용 {total} {next(iter(currencies))}; 완료당 비용 {per_completed}")
        else:
            print("전체·완료당 비용 N/A — 비용 누락 또는 통화 혼합")
    print("\n누락 없이 접수 사례를 pending부터 등록했는지는 평가 담당자가 확인해야 합니다. 집계는 현업 수용의 대체물이 아닙니다.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
