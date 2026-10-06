#!/usr/bin/env bash
# ==============================================================================
# holy-canvas (hcvs) - Standalone Release Packager
# Builds self-contained standalone binary release archives (Linux, Windows, macOS)
# ==============================================================================

set -euo pipefail

NODE_VERSION="${HOLY_CANVAS_NODE_VERSION:-"v20.18.3"}"
OUTPUT_DIR="release"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${REPO_ROOT}"

echo "[INFO] Building holy-canvas typescript files..."
pnpm build

mkdir -p "${OUTPUT_DIR}"

# Prepare temporary application bundle (dist + package.json + production node_modules)
TMP_BUILD="$(mktemp -d)"
trap 'rm -rf "${TMP_BUILD}"' EXIT

echo "[INFO] Creating clean production bundle in temporary directory..."
mkdir -p "${TMP_BUILD}/app"
cp -r dist "${TMP_BUILD}/app/"
cp package.json "${TMP_BUILD}/app/"

(cd "${TMP_BUILD}/app" && pnpm install --prod --ignore-scripts)

TARGETS=(
    "linux-x64:tar.gz"
    "linux-arm64:tar.gz"
    "darwin-x64:tar.gz"
    "darwin-arm64:tar.gz"
    "win-x64:zip"
    "win-arm64:zip"
)

for ENTRY in "${TARGETS[@]}"; do
    PLATFORM="${ENTRY%%:*}"
    FORMAT="${ENTRY##*:}"

    ARCHIVE_NAME="holy-canvas-${PLATFORM}.${FORMAT}"
    echo "[INFO] Building ${ARCHIVE_NAME}..."

    TARGET_STAGE="$(mktemp -d)"
    mkdir -p "${TARGET_STAGE}/app" "${TARGET_STAGE}/bin" "${TARGET_STAGE}/runtime"

    cp -r "${TMP_BUILD}/app/"* "${TARGET_STAGE}/app/"

    if [[ "${PLATFORM}" == win* ]]; then
        ARCH="${PLATFORM#win-}"
        # Download Windows node.exe
        curl -fsSL "https://nodejs.org/dist/${NODE_VERSION}/win-${ARCH}/node.exe" -o "${TARGET_STAGE}/runtime/node.exe"

        # Launcher batch & powershell scripts
        cat > "${TARGET_STAGE}/bin/holy-canvas.cmd" << 'EOF'
@echo off
setlocal
set "ROOT_DIR=%~dp0.."
set "NODE_EXE=%ROOT_DIR%\runtime\node.exe"
if not exist "%NODE_EXE%" (set "NODE_EXE=node")
"%NODE_EXE%" "%ROOT_DIR%\app\dist\cli.js" %*
EOF
        cp "${TARGET_STAGE}/bin/holy-canvas.cmd" "${TARGET_STAGE}/bin/hcvs.cmd"

        (cd "${TARGET_STAGE}" && zip -qr "${REPO_ROOT}/${OUTPUT_DIR}/${ARCHIVE_NAME}" .)
    else
        # Download Unix node binary
        curl -fsSL "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-${PLATFORM}.tar.gz" | \
            tar -xz -C "${TARGET_STAGE}/runtime" --strip-components=1 node-${NODE_VERSION}-${PLATFORM}/bin/node

        # Launcher bash script
        cat > "${TARGET_STAGE}/bin/holy-canvas" << 'EOF'
#!/usr/bin/env bash
SELF_DIR="$(cd "$(dirname "$0")"/.. && pwd)"
NODE_BIN="${SELF_DIR}/runtime/bin/node"
if [ ! -x "${NODE_BIN}" ]; then NODE_BIN="$(command -v node || true)"; fi
exec "${NODE_BIN}" "${SELF_DIR}/app/dist/cli.js" "$@"
EOF
        chmod +x "${TARGET_STAGE}/bin/holy-canvas"
        ln -sf "holy-canvas" "${TARGET_STAGE}/bin/hcvs"

        tar -czf "${REPO_ROOT}/${OUTPUT_DIR}/${ARCHIVE_NAME}" -C "${TARGET_STAGE}" .
    fi

    rm -rf "${TARGET_STAGE}"
    echo "[SUCCESS] Generated ${OUTPUT_DIR}/${ARCHIVE_NAME}"
done

echo "[SUCCESS] All standalone packages generated in ${OUTPUT_DIR}/"
