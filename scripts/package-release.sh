#!/usr/bin/env bash
# ==============================================================================
# holy-canvas (hcvs) - Standalone Release Packager (Powered by Bun)
# Compiles self-contained standalone binary releases for Linux, Windows, macOS
# ==============================================================================

set -euo pipefail

OUTPUT_DIR="release"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${REPO_ROOT}"

BUN_BIN="$(command -v bun || true)"
if [ -z "${BUN_BIN}" ] && [ -x "$HOME/.bun/bin/bun" ]; then
    BUN_BIN="$HOME/.bun/bin/bun"
fi

if [ -z "${BUN_BIN}" ]; then
    echo "[INFO] Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    BUN_BIN="$HOME/.bun/bin/bun"
fi

echo "[INFO] Using Bun binary at: ${BUN_BIN}"
"${BUN_BIN}" --version

mkdir -p "${OUTPUT_DIR}"

# 1. Compile standalone native executables for all platforms using Bun
echo "[INFO] Compiling standalone cross-platform executables with Bun..."
"${BUN_BIN}" run scripts/build.ts --compile

# 2. Package Windows release archives (.zip) containing holy-canvas.exe and hcvs.exe
echo "[INFO] Packaging Windows zip archives..."
for ARCH in x64 arm64; do
    ARCHIVE_NAME="holy-canvas-win-${ARCH}.zip"
    rm -f "${OUTPUT_DIR}/${ARCHIVE_NAME}"
    WIN_STAGE="$(mktemp -d)"
    mkdir -p "${WIN_STAGE}/bin"
    cp "${OUTPUT_DIR}/holy-canvas-win-${ARCH}.exe" "${WIN_STAGE}/bin/holy-canvas.exe"
    cp "${OUTPUT_DIR}/holy-canvas-win-${ARCH}.exe" "${WIN_STAGE}/bin/hcvs.exe"
    (cd "${WIN_STAGE}" && zip -qr "${REPO_ROOT}/${OUTPUT_DIR}/${ARCHIVE_NAME}" .)
    rm -rf "${WIN_STAGE}"
    echo "[SUCCESS] Generated ${OUTPUT_DIR}/${ARCHIVE_NAME}"
done

# 3. Package Unix release archives (.tar.gz) containing holy-canvas and hcvs
echo "[INFO] Packaging Unix tar.gz archives..."
for PLAT in linux-x64 linux-arm64 darwin-x64 darwin-arm64; do
    ARCHIVE_NAME="holy-canvas-${PLAT}.tar.gz"
    rm -f "${OUTPUT_DIR}/${ARCHIVE_NAME}"
    UNIX_STAGE="$(mktemp -d)"
    mkdir -p "${UNIX_STAGE}/bin"
    cp "${OUTPUT_DIR}/holy-canvas-${PLAT}" "${UNIX_STAGE}/bin/holy-canvas"
    chmod +x "${UNIX_STAGE}/bin/holy-canvas"
    (cd "${UNIX_STAGE}/bin" && ln -sf holy-canvas hcvs)
    tar -czf "${REPO_ROOT}/${OUTPUT_DIR}/${ARCHIVE_NAME}" -C "${UNIX_STAGE}" .
    rm -rf "${UNIX_STAGE}"
    echo "[SUCCESS] Generated ${OUTPUT_DIR}/${ARCHIVE_NAME}"
done

echo "[SUCCESS] All standalone releases compiled and packaged successfully in ${OUTPUT_DIR}/"
ls -lh "${OUTPUT_DIR}/"
