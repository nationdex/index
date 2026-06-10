"""NationDex Extras Index — Streamlit frontend."""

from __future__ import annotations

import streamlit as st

from resolver import ExtraMetadata, resolve_all_extras

PAGE_TITLE = "NationDex Extras Index"
PAGE_ICON = "📦"

CUSTOM_CSS = """
<style>
    #MainMenu, footer, header { visibility: hidden; }
    .block-container { padding-top: 2rem; padding-bottom: 3rem; max-width: 960px; }
    .nd-header { margin-bottom: 2rem; }
    .nd-title {
        font-size: 1.75rem;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: #f4f4f5;
        margin: 0;
    }
    .nd-subtitle { color: #a1a1aa; font-size: 0.95rem; margin-top: 0.35rem; }
    .nd-card {
        background: #1c1c1c;
        border: 1px solid #3f3f46;
        border-radius: 0.75rem;
        padding: 1.25rem 1.35rem;
        margin-bottom: 1rem;
    }
    .nd-card-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 0.75rem;
        flex-wrap: wrap;
    }
    .nd-card-title {
        font-size: 1.05rem;
        font-weight: 600;
        color: #f4f4f5;
        margin: 0;
    }
    .nd-version {
        font-size: 0.75rem;
        color: #a78bfa;
        background: rgba(167, 139, 250, 0.12);
        border: 1px solid rgba(167, 139, 250, 0.25);
        border-radius: 999px;
        padding: 0.1rem 0.55rem;
        white-space: nowrap;
    }
    .nd-description { color: #d4d4d8; font-size: 0.9rem; margin: 0.65rem 0 0.85rem; line-height: 1.55; }
    .nd-meta { color: #71717a; font-size: 0.8rem; margin-bottom: 0.75rem; }
    .nd-links a {
        color: #a1a1aa;
        text-decoration: none;
        font-size: 0.8rem;
        margin-right: 0.85rem;
    }
    .nd-links a:hover { color: #e4e4e7; }
    .nd-empty {
        color: #71717a;
        text-align: center;
        padding: 2.5rem 1rem;
        border: 1px dashed #3f3f46;
        border-radius: 0.75rem;
    }
    .nd-step-num {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.5rem;
        height: 1.5rem;
        border-radius: 999px;
        background: rgba(167, 139, 250, 0.15);
        color: #c4b5fd;
        font-size: 0.75rem;
        font-weight: 600;
        margin-right: 0.5rem;
    }
    .nd-step-title { font-weight: 600; color: #f4f4f5; margin-bottom: 0.35rem; }
    .nd-step-body { color: #a1a1aa; font-size: 0.9rem; line-height: 1.6; margin-bottom: 1.25rem; }
    div[data-testid="stTextInput"] input {
        background: #1c1c1c;
        border-color: #3f3f46;
        color: #f4f4f5;
    }
</style>
"""


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
    st.markdown(
        """
        <div class="nd-header">
            <p class="nd-title">NationDex / Extras Index</p>
            <p class="nd-subtitle">Community extras for Project NationDex 2026</p>
        </div>
        """,
        unsafe_allow_html=True,
    )


def _render_extra_card(extra: ExtraMetadata) -> None:
    version = extra.get("version", "")
    version_html = f'<span class="nd-version">v{version}</span>' if version else ""
    description = extra.get("description") or "No description provided."
    authors = _author_names(extra.get("authors"))
    license_text = _license_text(extra.get("license"))
    meta_parts = [part for part in (authors, license_text) if part]
    meta_html = " · ".join(meta_parts)

    links: list[str] = []
    seen_urls: set[str] = set()
    if extra.get("repo"):
        links.append(f'<a href="{extra["repo"]}" target="_blank">Repository</a>')
        seen_urls.add(extra["repo"].rstrip("/").removesuffix(".git"))
    for label, url in (extra.get("urls") or {}).items():
        if not url:
            continue
        normalized = url.rstrip("/").removesuffix(".git").replace("git+", "")
        if normalized in seen_urls:
            continue
        seen_urls.add(normalized)
        links.append(f'<a href="{url}" target="_blank">{label}</a>')
    links_html = "".join(links)

    st.markdown(
        f"""
        <div class="nd-card">
            <div class="nd-card-header">
                <p class="nd-card-title">{extra.get("display_name") or extra["id"]}</p>
                {version_html}
            </div>
            <p class="nd-description">{description}</p>
            {"<p class='nd-meta'>" + meta_html + "</p>" if meta_html else ""}
            {"<div class='nd-links'>" + links_html + "</div>" if links_html else ""}
        </div>
        """,
        unsafe_allow_html=True,
    )

    if extra.get("error"):
        st.warning(extra["error"])


def _render_packages_tab(extras: list[ExtraMetadata]) -> None:
    query = st.text_input("Search extras", placeholder="Search by name or description…", label_visibility="collapsed")
    filtered = [extra for extra in extras if _matches_query(extra, query.strip().lower())] if query.strip() else extras

    if not filtered:
        st.markdown(
            f'<div class="nd-empty">No extras match "{query}".</div>' if query.strip() else '<div class="nd-empty">No extras listed yet.</div>',
            unsafe_allow_html=True,
        )
        return

    st.caption(f"{len(filtered)} extra{'s' if len(filtered) != 1 else ''}")
    for extra in filtered:
        _render_extra_card(extra)


def _render_submit_tab() -> None:
    st.markdown("#### Submit an extra")
    st.markdown(
        '<p class="nd-step-body">Any NationDex-compatible extra can be listed here by adding an entry to <code>extras.json</code>.</p>',
        unsafe_allow_html=True,
    )

    st.markdown(
        """
        <p class="nd-step-title"><span class="nd-step-num">1</span>Fork this repository</p>
        <p class="nd-step-body">Fork the nationdex-index repo on GitHub and clone your fork locally.</p>
        <p class="nd-step-title"><span class="nd-step-num">2</span>Add your extra to extras.json</p>
        """,
        unsafe_allow_html=True,
    )

    st.code(
        """{
  "id": "your-extra-id",
  "repo": "https://github.com/you/your-repo",
  "branch": "main"
}""",
        language="json",
    )

    st.markdown(
        """
        <p class="nd-step-body">Your repository should include a <code>package.json</code> (ForgeScript extras) or <code>pyproject.toml</code> (Python extras) at the root with name, version, and description.</p>
        <p class="nd-step-title"><span class="nd-step-num">3</span>Open a pull request</p>
        <p class="nd-step-body">Push your change and open a PR. Once merged, the index will pick up your extra automatically.</p>
        """,
        unsafe_allow_html=True,
    )


@st.cache_data(ttl=3600, show_spinner=False)
def _load_resolved_extras() -> list[ExtraMetadata]:
    return resolve_all_extras()


def main() -> None:
    st.set_page_config(page_title=PAGE_TITLE, page_icon=PAGE_ICON, layout="centered")
    st.markdown(CUSTOM_CSS, unsafe_allow_html=True)
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
