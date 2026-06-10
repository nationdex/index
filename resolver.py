"""Resolve extra metadata from GitHub repositories."""

from __future__ import annotations

import json
import re
import tomllib
from pathlib import Path
from typing import Any, TypedDict, cast
import requests

REPO_ROOT = Path(__file__).parent
EXTRAS_FILE = REPO_ROOT / "extras.json"
REQUEST_TIMEOUT = 15

GITHUB_RE = re.compile(r"github\.com[:/](?P<owner>[^/]+)/(?P<repo>[^/.\s]+)")


class ExtraMetadata(TypedDict, total=False):
    id: str
    repo: str
    branch: str
    error: str | None
    name: str
    version: str
    description: str
    license: str | dict[str, str]
    authors: list[str | dict[str, str]]
    urls: dict[str, str]
    dependencies: list[str]
    kind: str
    path: str
    install_url: str
    display_name: str


def load_extras() -> list[dict[str, str]]:
    with open(EXTRAS_FILE, encoding="utf-8") as f:
        data = json.load(f)
    return data.get("extras", [])


def parse_github_repo(repo_url: str) -> tuple[str, str] | None:
    match = GITHUB_RE.search(repo_url)
    if not match:
        return None
    return match.group("owner"), match.group("repo").removesuffix(".git")


def fetch_raw_file(owner: str, repo: str, branch: str, filename: str) -> bytes | None:
    url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{filename}"
    try:
        response = requests.get(url, timeout=REQUEST_TIMEOUT)
    except requests.RequestException:
        return None
    if response.status_code != 200:
        return None
    return response.content


def _format_name(name: str, fallback_id: str) -> str:
    return name or fallback_id


def _build_install_url(
    repo_url: str, branch: str, version: str, owner: str, repo: str
) -> str:
    base = repo_url.rstrip("/")
    if base.endswith(".git"):
        base = base[:-4]
    if version:
        for tag in (f"v{version}", version):
            tags_url = (
                f"https://api.github.com/repos/{owner}/{repo}/git/refs/tags/{tag}"
            )
            try:
                response = requests.get(tags_url, timeout=REQUEST_TIMEOUT)
                if response.status_code == 200:
                    return f"git+{base}.git@{tag}"
            except requests.RequestException:
                pass
    return f"git+{base}.git#{branch}"


def _parse_pyproject(content: bytes) -> dict[str, Any]:
    data = tomllib.loads(content.decode())
    project = data.get("project", {})
    return {
        "name": project.get("name", ""),
        "version": project.get("version", ""),
        "description": project.get("description", ""),
        "license": project.get("license", ""),
        "authors": project.get("authors", []),
        "urls": project.get("urls", {}),
        "dependencies": project.get("dependencies", []),
        "kind": "python",
        "path": project.get("name", ""),
    }


def _parse_package_json(content: bytes) -> dict[str, Any]:
    data = json.loads(content)
    authors: list[Any] = []
    if author := data.get("author"):
        authors = [author]
    elif data.get("authors"):
        authors = data["authors"]

    urls: dict[str, str] = {}
    if homepage := data.get("homepage"):
        urls["Homepage"] = homepage
    if repository := data.get("repository"):
        if isinstance(repository, dict):
            urls["Repository"] = repository.get("url", "")
        else:
            urls["Repository"] = str(repository)

    return {
        "name": data.get("name", ""),
        "version": data.get("version", ""),
        "description": data.get("description", ""),
        "license": data.get("license", ""),
        "authors": authors,
        "urls": urls,
        "dependencies": list(data.get("dependencies", {}).keys()),
        "kind": "forgescript",
        "path": "dist",
    }


def resolve_extra(entry: dict[str, str]) -> ExtraMetadata:
    extra_id = entry["id"]
    repo_url = entry["repo"]
    branch = entry.get("branch", "main")

    parsed = parse_github_repo(repo_url)
    metadata: dict[str, Any] = {
        "id": extra_id,
        "repo": repo_url,
        "branch": branch,
        "error": None,
    }

    if parsed is None:
        metadata["error"] = "Invalid GitHub repository URL."
        return cast(ExtraMetadata, metadata)

    owner, repo = parsed
    pyproject = fetch_raw_file(owner, repo, branch, "pyproject.toml")
    if pyproject:
        metadata.update(_parse_pyproject(pyproject))
    else:
        package_json = fetch_raw_file(owner, repo, branch, "package.json")
        if package_json:
            metadata.update(_parse_package_json(package_json))
        else:
            metadata["error"] = "No pyproject.toml or package.json found in repository."
            metadata["name"] = extra_id
            metadata["kind"] = "unknown"
            metadata["path"] = extra_id

    version = metadata.get("version", "")
    metadata["install_url"] = _build_install_url(repo_url, branch, version, owner, repo)
    metadata["display_name"] = _format_name(str(metadata.get("name", "")), extra_id)
    return cast(ExtraMetadata, metadata)


def resolve_all_extras() -> list[ExtraMetadata]:
    return [resolve_extra(entry) for entry in load_extras()]
