"""NationDex Extras Index — Streamlit frontend."""

from __future__ import annotations

import base64
import html as html_lib
from pathlib import Path
from textwrap import dedent

import importlib

import streamlit as st

import resolver

importlib.reload(resolver)
ExtraMetadata = resolver.ExtraMetadata

PAGE_TITLE = "NationDex Extras Index"
PAGE_ICON = "📦"
_STYLES_PATH = Path(__file__).parent / ".streamlit" / "styles.css"
_LOGO_PATH = Path(__file__).parent / ".streamlit" / "logo.png"


def _inject_styles() -> None:
    css = _STYLES_PATH.read_text(encoding="utf-8")
    st.markdown(f"<style>{css}</style>", unsafe_allow_html=True)


def _render_html(fragment: str) -> None:
    st.markdown(dedent(fragment).strip(), unsafe_allow_html=True)


@st.cache_data(show_spinner=False)
def _logo_data_uri() -> str:
    encoded = base64.b64encode(_LOGO_PATH.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


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


_ICON_GITHUB = (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-.88.28-1.83 0-2.71-.88-.32-3.37 1.05-3.37 1.05A11.95 11.95 0 0 0 12 4c-.95 0-1.9.1-2.8.3-1.76-1.17-3.37-1.05-3.37-1.05-.88.32-1.16 1.83 0 2.71-.73 1.02-1.08 2.25-1 3.5 0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path>'
    '<path d="M9 18c-4.51 2-5-2-7-2"></path>'
    "</svg>"
)
_ICON_EXTERNAL = (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    '<path d="M15 3h6v6"></path>'
    '<path d="M10 14 21 3"></path>'
    '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>'
    "</svg>"
)
_ICON_LINK = (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>'
    '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>'
    "</svg>"
)


def _link_icon(label: str) -> str:
    normalized = label.lower()
    if normalized in {"repository", "repo", "github"}:
        return _ICON_GITHUB
    if normalized in {"homepage", "home", "website", "documentation", "docs"}:
        return _ICON_EXTERNAL
    return _ICON_LINK


def _link_button(href: str, label: str) -> str:
    safe_href = html_lib.escape(href)
    safe_label = html_lib.escape(label)
    return (
        f'<a class="nd-icon-link" href="{safe_href}" target="_blank" '
        f'rel="noopener noreferrer" title="{safe_label}" aria-label="{safe_label}">'
        f"{_link_icon(label)}</a>"
    )


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
    logo_uri = html_lib.escape(_logo_data_uri(), quote=True)
    _render_html(
        f"""
        <div class="nd-header">
            <div class="nd-header-brand">
                <img class="nd-logo" src="{logo_uri}" alt="NationDex logo" />
                <div class="nd-header-text">
                    <p class="nd-title">NationDex / Extras Index</p>
                    <p class="nd-subtitle">Community extras for Project NationDex 2026</p>
                </div>
            </div>
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
        links.append(_link_button(extra["repo"], "Repository"))
        seen_urls.add(extra["repo"].rstrip("/").removesuffix(".git"))
    for label, url in (extra.get("urls") or {}).items():
        if not url:
            continue
        normalized = url.rstrip("/").removesuffix(".git").replace("git+", "")
        if normalized in seen_urls:
            continue
        seen_urls.add(normalized)
        links.append(_link_button(url, label))
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
    st.markdown("Add your package to `data/extras.json` and open a pull request.")

    st.markdown("**1 · Fork this repository**")
    st.markdown("Fork the index repo on GitHub and clone your fork locally.")

    st.markdown("**2 · Add your extra to data/extras.json**")
    st.markdown("Append an entry with your package id, repository URL, and branch.")
    st.code(SUBMIT_EXAMPLE, language="json")
    st.caption(
        "Include a `package.json` at the repo root with name, version, and description."
    )

    st.markdown("**3 · Open a pull request**")
    st.markdown(
        "Push your change and open a PR. Once merged, the index picks up your extra automatically."
    )


@st.cache_data(ttl=3600, show_spinner=False)
def _load_resolved_extras(extras_path: str) -> list[ExtraMetadata]:
    importlib.reload(resolver)
    return resolver.resolve_all_extras()


def main() -> None:
    st.set_page_config(page_title=PAGE_TITLE, page_icon=PAGE_ICON, layout="centered")
    _inject_styles()
    _render_header()

    with st.spinner("Loading extras…"):
        extras = _load_resolved_extras(str(resolver.EXTRAS_FILE))

    packages_tab, submit_tab = st.tabs(["Extras", "Submit"])

    with packages_tab:
        _render_packages_tab(extras)

    with submit_tab:
        _render_submit_tab()


if __name__ == "__main__":
    main()
