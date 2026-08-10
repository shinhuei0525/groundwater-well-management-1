from __future__ import annotations

import json
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT / "data" / "wells.json"
PUBLIC_PATH = ROOT / "docs" / "data" / "wells.json"
PUBLIC_ATTACHMENTS = ROOT / "docs" / "data" / "attachments"


def has_pdf(well):
    return any("pdf" in str(item.get("mimeType", "")).lower() for item in well.get("attachments") or [])


def main():
    source_wells = json.loads(SOURCE_PATH.read_text(encoding="utf-8-sig"))
    public_wells = json.loads(PUBLIC_PATH.read_text(encoding="utf-8-sig"))
    source_by_number = {well["waterRightNo"]: well for well in source_wells}
    synchronized = []

    for well in public_wells:
        if has_pdf(well):
            continue
        source = source_by_number.get(well["waterRightNo"])
        source_pdf = next(
            (
                item
                for item in (source or {}).get("attachments") or []
                if "pdf" in str(item.get("mimeType", "")).lower()
            ),
            None,
        )
        if not source_pdf:
            continue
        source_file = Path(source_pdf["storedName"])
        target_name = f"{well['station']}-{well['waterRightNo']}-water-right-1.pdf"
        target_file = PUBLIC_ATTACHMENTS / target_name
        shutil.copy2(source_file, target_file)
        public_pdf = dict(source_pdf)
        public_pdf["storedName"] = target_name
        public_pdf["size"] = target_file.stat().st_size
        well.setdefault("attachments", []).append(public_pdf)
        synchronized.append(well["waterRightNo"])

    missing = [well["waterRightNo"] for well in public_wells if not has_pdf(well)]
    if missing:
        raise ValueError(f"仍缺少水權狀：{', '.join(missing)}")

    PUBLIC_PATH.write_text(json.dumps(public_wells, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"synchronized": synchronized, "pdfCount": len(public_wells)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
