#!/usr/bin/env python3
"""Validate extras.json entries for the NationDex index."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any, TypedDict, cast

REPO_ROOT = Path(__file__).parent.parent
EXTRAS_FILE = REPO_ROOT / "data" / "extras.json"
GITHUB_RE = re.compile(r"^https://github\.com/[^/]+/[^/]+$")


class ExtraEntry(TypedDict):
    id: str
    repo: str
    branch: str


def _parse_extra(index: int, raw: object) -> ExtraEntry | None:
    if not isinstance(raw, dict):
        print(f"extras[{index}]: entry must be an object", file=sys.stderr)
        return None

    data = cast(dict[str, Any], raw)
    id_val = data.get("id")
    repo_val = data.get("repo")
    branch_val = data.get("branch")

    if not isinstance(id_val, str) or not id_val.strip():
        print(f"extras[{index}]: missing or empty 'id'", file=sys.stderr)
        return None
    if not isinstance(repo_val, str) or not repo_val.strip():
        print(f"extras[{index}]: missing or empty 'repo'", file=sys.stderr)
        return None
    if not isinstance(branch_val, str) or not branch_val.strip():
        print(f"extras[{index}]: missing or empty 'branch'", file=sys.stderr)
        return None

    return {
        "id": id_val.strip(),
        "repo": repo_val.strip(),
        "branch": branch_val.strip(),
    }


def main() -> int:
    data = json.loads(EXTRAS_FILE.read_text(encoding="utf-8"))
    extras = data.get("extras")
    if not isinstance(extras, list):
        print("extras.json: 'extras' must be a list", file=sys.stderr)
        return 1

    seen_ids: set[str] = set()
    for index, raw in enumerate(extras):
        entry = _parse_extra(index, raw)
        if entry is None:
            return 1

        if entry["id"] in seen_ids:
            print(f"extras[{index}]: duplicate id '{entry['id']}'", file=sys.stderr)
            return 1
        seen_ids.add(entry["id"])

        repo = entry["repo"].removesuffix(".git")
        if not GITHUB_RE.match(repo):
            print(
                f"extras[{index}]: invalid repo URL '{entry['repo']}'", file=sys.stderr
            )
            return 1

    print(f"Validated {len(extras)} extra(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
