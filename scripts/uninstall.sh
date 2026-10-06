#!/usr/bin/env bash
# ==============================================================================
# holy-canvas (hcvs) - Uninstaller for Linux & macOS
# ==============================================================================

set -euo pipefail

INSTALL_DIR="${HOLY_CANVAS_HOME:-"$HOME/.holy-canvas"}"
BIN_DIR="${HOLY_CANVAS_BIN:-"$HOME/.local/bin"}"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

printf "${CYAN}[INFO]${NC} Uninstalling holy-canvas...\n"

# Remove application directory
if [ -d "${INSTALL_DIR}" ]; then
    rm -rf "${INSTALL_DIR}"
    printf "${GREEN}[SUCCESS]${NC} Removed %s\n" "${INSTALL_DIR}"
fi

# Remove binary symlinks
for BINARY in holy-canvas hcvs; do
    if [ -e "${BIN_DIR}/${BINARY}" ] || [ -L "${BIN_DIR}/${BINARY}" ]; then
        rm -f "${BIN_DIR}/${BINARY}"
        printf "${GREEN}[SUCCESS]${NC} Removed %s/%s\n" "${BIN_DIR}" "${BINARY}"
    fi
done

# Clean up PATH entries in rc files
for RC in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
    if [ -f "${RC}" ]; then
        if grep -q "holy-canvas" "${RC}" 2>/dev/null; then
            sed -i.bak '/# holy-canvas/d' "${RC}" 2>/dev/null || true
            sed -i.bak "\|${BIN_DIR}|d" "${RC}" 2>/dev/null || true
            rm -f "${RC}.bak"
        fi
    fi
done

printf "\n${GREEN}holy-canvas (hcvs) has been successfully uninstalled.${NC}\n"
