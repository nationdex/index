"""NationDex Extras Index — Streamlit frontend."""

from __future__ import annotations

import html as html_lib
from pathlib import Path
from textwrap import dedent

import streamlit as st

from resolver import ExtraMetadata, resolve_all_extras

PAGE_TITLE = "NationDex Extras Index"
PAGE_ICON = "📦"
_STYLES_PATH = Path(__file__).parent / ".streamlit" / "styles.css"


def _inject_styles() -> None:
    css = _STYLES_PATH.read_text(encoding="utf-8")
    st.markdown(f"<style>{css}</style>", unsafe_allow_html=True)


def _render_html(fragment: str) -> None:
    st.markdown(dedent(fragment).strip(), unsafe_allow_html=True)


SUBMIT_EXAMPLE = """{
  "id": "berklikesfemboys",
  "repo": "https://github.com/Berk404/berklikesfemboys",
  "branch": "main"
}"""


def _license_text(license_value: str | dict[str, str] | None) -> str:
    if not license_value:
        return ""
    if isinstance(license_value, str):
        return license_value
    return str(license_value.get("text", ""))


def _author_names(authors: list[str | dict[str, str]] | None) -> str:
    if not authors:
        return ""
    names: list[str] = []
    for author in authors:
        if isinstance(author, str):
            names.append(author)
        elif isinstance(author, dict) and (name := author.get("name")):
            names.append(str(name))
    return ", ".join(names)


def _matches_query(extra: ExtraMetadata, query: str) -> bool:
    haystack = " ".join(
        [
            extra.get("display_name", ""),
            extra.get("name", ""),
            extra.get("description", ""),
            extra.get("id", ""),
        ]
    ).lower()
    return query in haystack


def _render_header() -> None:
    _render_html(
        """
        <div class="nd-header">
            <p class="nd-title">NationDex / Extras Index</p>
            <p class="nd-subtitle">Community extras for Project NationDex 2026</p>
        </div>
        """
    )


def _render_extra_card(extra: ExtraMetadata) -> None:
    title = html_lib.escape(extra.get("display_name") or extra["id"])
    version = extra.get("version", "")
    version_html = (
        f'<span class="nd-version">v{html_lib.escape(version)}</span>'
        if version
        else ""
    )
    description = html_lib.escape(
        extra.get("description") or "No description provided."
    )
    authors = _author_names(extra.get("authors"))
    license_text = _license_text(extra.get("license"))
    meta_parts = [part for part in (authors, license_text) if part]
    meta_html = html_lib.escape(" · ".join(meta_parts))

    links: list[str] = []
    seen_urls: set[str] = set()
    if extra.get("repo"):
        repo = html_lib.escape(extra["repo"])
        links.append(f'<a href="{repo}" target="_blank">Repository</a>')
        seen_urls.add(extra["repo"].rstrip("/").removesuffix(".git"))
    for label, url in (extra.get("urls") or {}).items():
        if not url:
            continue
        normalized = url.rstrip("/").removesuffix(".git").replace("git+", "")
        if normalized in seen_urls:
            continue
        seen_urls.add(normalized)
        links.append(
            f'<a href="{html_lib.escape(url)}" target="_blank">{html_lib.escape(label)}</a>'
        )
    links_html = "".join(links)

    _render_html(
        f"""
        <div class="nd-card">
            <div class="nd-card-header">
                <p class="nd-card-title">{title}</p>
                {version_html}
            </div>
            <p class="nd-description">{description}</p>
            {"<p class='nd-meta'>" + meta_html + "</p>" if meta_html else ""}
            {"<div class='nd-links'>" + links_html + "</div>" if links_html else ""}
        </div>
        """
    )

    if extra.get("error"):
        st.warning(extra["error"])


def _render_packages_tab(extras: list[ExtraMetadata]) -> None:
    query = st.text_input(
        "Search extras",
        placeholder="Search by name or description…",
        label_visibility="collapsed",
    )
    filtered = (
        [extra for extra in extras if _matches_query(extra, query.strip().lower())]
        if query.strip()
        else extras
    )

    if not filtered:
        message = (
            f'No extras match "{html_lib.escape(query)}".'
            if query.strip()
            else "No extras listed yet."
        )
        _render_html(f'<p class="nd-empty">{message}</p>')
        return

    st.caption(f"{len(filtered)} extra{'s' if len(filtered) != 1 else ''}")
    for extra in filtered:
        _render_extra_card(extra)


def _render_submit_tab() -> None:
    st.markdown("### Submit an extra")
    st.markdown("Add your package to `extras.json` and open a pull request.")
    st.divider()

    st.markdown("**1 · Fork this repository**")
    st.markdown("Fork the index repo on GitHub and clone your fork locally.")

    st.markdown("**2 · Add your extra to extras.json**")
    st.markdown("Append an entry with your package id, repository URL, and branch.")
    st.code(SUBMIT_EXAMPLE, language="json")
    st.caption(
        "Include a `package.json` at the repo root with name, version, and description."
    )

    st.divider()

    st.markdown("**3 · Open a pull request**")
    st.markdown(
        "Push your change and open a PR. Once merged, the index picks up your extra automatically."
    )


@st.cache_data(ttl=3600, show_spinner=False)
def _load_resolved_extras() -> list[ExtraMetadata]:
    return resolve_all_extras()


def main() -> None:
    st.set_page_config(page_title=PAGE_TITLE, page_icon=PAGE_ICON, layout="centered")
    _inject_styles()
    _render_header()

    with st.spinner("Loading extras…"):
        extras = _load_resolved_extras()

    packages_tab, submit_tab = st.tabs(["Extras", "Submit"])

    with packages_tab:
        _render_packages_tab(extras)

    with submit_tab:
        _render_submit_tab()


if __name__ == "__main__":
    main()
