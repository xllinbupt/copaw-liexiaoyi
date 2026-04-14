#!/usr/bin/env python3
"""
Repository-level test runner for CoPaw.

This script provides one entry point for the backend pytest suite and the
frontend smoke checks that already exist in each subproject.

Examples:
    python scripts/run_workspace_checks.py
    python scripts/run_workspace_checks.py --backend
    python scripts/run_workspace_checks.py --frontend
    python scripts/run_workspace_checks.py --unit providers
    python scripts/run_workspace_checks.py --console --website
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


class Colors:
    """ANSI color codes for terminal output."""

    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    NC = "\033[0m"


def print_info(message: str) -> None:
    """Print an informational message."""
    print(f"{Colors.BLUE}[INFO]{Colors.NC} {message}", flush=True)


def print_success(message: str) -> None:
    """Print a success message."""
    print(f"{Colors.GREEN}[OK]{Colors.NC} {message}", flush=True)


def print_error(message: str) -> None:
    """Print an error message."""
    print(f"{Colors.RED}[ERR]{Colors.NC} {message}", flush=True)


def print_warning(message: str) -> None:
    """Print a warning message."""
    print(f"{Colors.YELLOW}[WARN]{Colors.NC} {message}", flush=True)


def resolve_command(command: str) -> str | None:
    """Resolve a command from PATH."""
    return shutil.which(command)


def run_command(
    cmd: list[str],
    cwd: Path,
    description: str,
) -> int:
    """Run a subprocess and return its exit code."""
    print_info(description)
    print_info(f"Command: {' '.join(cmd)}")

    try:
        result = subprocess.run(cmd, cwd=cwd, check=True)
        print_success(f"{description} completed")
        return result.returncode
    except subprocess.CalledProcessError as exc:
        print_error(f"{description} failed with exit code {exc.returncode}")
        return exc.returncode


def run_backend_checks(
    project_root: Path,
    args: argparse.Namespace,
) -> int:
    """Delegate backend pytest execution to the existing runner."""
    backend_cmd = [sys.executable, "scripts/run_tests.py"]

    if args.unit is not None:
        backend_cmd.append("--unit")
        if args.unit:
            backend_cmd.append(args.unit)
    elif args.integrated:
        backend_cmd.append("--integrated")
    else:
        backend_cmd.append("--all")

    if args.coverage:
        backend_cmd.append("--coverage")
    if args.parallel:
        backend_cmd.append("--parallel")

    return run_command(
        backend_cmd,
        cwd=project_root,
        description="Running backend pytest checks",
    )


def run_console_checks(project_root: Path) -> int:
    """Run console frontend checks."""
    console_dir = project_root / "console"
    npm = resolve_command("npm")
    if npm is None:
        print_error("npm is required to run console checks")
        return 1

    for cmd, description in (
        ([npm, "run", "lint"], "Running console lint"),
        ([npm, "run", "build"], "Running console build"),
    ):
        return_code = run_command(cmd, cwd=console_dir, description=description)
        if return_code != 0:
            return return_code

    return 0


def run_website_checks(project_root: Path) -> int:
    """Run website frontend checks."""
    website_dir = project_root / "website"
    package_manager = resolve_command("pnpm") or resolve_command("npm")
    if package_manager is None:
        print_error("pnpm or npm is required to run website checks")
        return 1

    build_cmd = [package_manager, "build"] if Path(package_manager).name.startswith(
        "pnpm",
    ) else [package_manager, "run", "build"]

    return run_command(
        build_cmd,
        cwd=website_dir,
        description="Running website build",
    )


def build_parser() -> argparse.ArgumentParser:
    """Build the CLI parser."""
    parser = argparse.ArgumentParser(
        description="Run CoPaw workspace checks",
    )
    parser.add_argument(
        "--backend",
        action="store_true",
        help="Run backend pytest checks",
    )
    parser.add_argument(
        "--frontend",
        action="store_true",
        help="Run both frontend checks",
    )
    parser.add_argument(
        "--console",
        action="store_true",
        help="Run console lint and build",
    )
    parser.add_argument(
        "--website",
        action="store_true",
        help="Run website build",
    )
    parser.add_argument(
        "-u",
        "--unit",
        nargs="?",
        const="",
        metavar="DIR",
        help="Run backend unit tests (optionally specify a subdirectory)",
    )
    parser.add_argument(
        "-i",
        "--integrated",
        action="store_true",
        help="Run backend integrated tests",
    )
    parser.add_argument(
        "-c",
        "--coverage",
        action="store_true",
        help="Enable backend coverage reporting",
    )
    parser.add_argument(
        "-p",
        "--parallel",
        action="store_true",
        help="Run backend pytest with xdist",
    )
    return parser


def main() -> int:
    """Main entry point."""
    parser = build_parser()
    args = parser.parse_args()

    script_path = Path(__file__).resolve()
    project_root = script_path.parents[1]

    wants_backend = (
        args.backend
        or args.unit is not None
        or args.integrated
    )
    wants_frontend = args.frontend or args.console or args.website

    if not wants_backend and not wants_frontend:
        wants_backend = True
        wants_frontend = True
        args.console = True
        args.website = True

    print()
    print_info("CoPaw Workspace Checks")
    print_info("======================")
    print()

    if wants_backend:
        backend_code = run_backend_checks(project_root, args)
        if backend_code != 0:
            return backend_code
        print()

    if args.frontend:
        args.console = True
        args.website = True

    if args.console:
        console_code = run_console_checks(project_root)
        if console_code != 0:
            return console_code
        print()

    if args.website:
        website_code = run_website_checks(project_root)
        if website_code != 0:
            return website_code
        print()

    print_success("Workspace checks completed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
