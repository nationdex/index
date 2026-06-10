"""Entry point for the NationDex Extras Index."""

import subprocess
import sys
from pathlib import Path


def main() -> None:
    app_path = Path(__file__).parent / "app.py"
    raise SystemExit(
        subprocess.call(
            [sys.executable, "-m", "streamlit", "run", str(app_path), *sys.argv[1:]]
        )
    )


if __name__ == "__main__":
    main()
