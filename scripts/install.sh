#!/usr/bin/env bash
# ==============================================================================
# holy-canvas (hcvs) - Standalone Installer for Linux & macOS
# Installs holy-canvas without requiring a pre-installed Node.js runtime.
#
# Usage (Online):
#   curl -fsSL https://raw.githubusercontent.com/filename24/holy-canvas/stable/scripts/install.sh | bash
#
# Usage (Local repository):
#   ./scripts/install.sh
# ==============================================================================

set -euo pipefail

# Configuration
REPO="${HOLY_CANVAS_REPO:-"filename24/holy-canvas"}"
INSTALL_DIR="${HOLY_CANVAS_HOME:-"$HOME/.holy-canvas"}"
BIN_DIR="${HOLY_CANVAS_BIN:-"$HOME/.local/bin"}"
NODE_VERSION="${HOLY_CANVAS_NODE_VERSION:-"v20.18.3"}"
BRANCH="${HOLY_CANVAS_BRANCH:-"stable"}"

# Text styles
BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log_info() {
    printf "${CYAN}[INFO]${NC} %s\n" "$1"
}

log_success() {
    printf "${GREEN}[SUCCESS]${NC} %s\n" "$1"
}

log_warn() {
    printf "${YELLOW}[WARN]${NC} %s\n" "$1"
}

log_error() {
    printf "${RED}[ERROR]${NC} %s\n" "$1" >&2
}

# Banner
print_banner() {
    printf "\n"
    printf "  ${BOLD}${CYAN}  __         __                       __                   ${NC}\n"
    printf "  ${BOLD}${CYAN} / /  ___   / /__ __ ____ ____ ____ _ / /  __ __ ___ ____  ${NC}\n"
    printf "  ${BOLD}${CYAN}/ _ \/ _ \ / // // //___// __// _ \`// _ \/ // /(_-</___/  ${NC}\n"
    printf "  ${BOLD}${CYAN}/_//_/\___//_/ \_, /     \__/ \_,_//_//_/\_,_//___/      ${NC}\n"
    printf "  ${BOLD}${CYAN}              /___/                                        ${NC}\n"
    printf "  ${BOLD}Canvas LMS Terminal Client (hcvs) Standalone Installer${NC}\n"
    printf "  ${CYAN}Zero Node.js dependency required${NC}\n\n"
}

print_banner

# 1. Detect OS
OS_RAW="$(uname -s)"
case "${OS_RAW}" in
    Linux*)     OS="linux" ;;
    Darwin*)   OS="darwin" ;;
    CYGWIN*|MINGW*|MSYS*)
        log_error "Windows environment detected. Please run the PowerShell installer instead:"
        printf "  irm https://raw.githubusercontent.com/%s/main/scripts/install.ps1 | iex\n\n" "$REPO"
        exit 1
        ;;
    *)
        log_error "Unsupported Operating System: ${OS_RAW}"
        exit 1
        ;;
esac

# 2. Detect Architecture
ARCH_RAW="$(uname -m)"
case "${ARCH_RAW}" in
    x86_64|amd64)   ARCH="x64" ;;
    aarch64|arm64)  ARCH="arm64" ;;
    *)
        log_error "Unsupported CPU architecture: ${ARCH_RAW}"
        exit 1
        ;;
esac

log_info "Detected Platform: ${OS}-${ARCH}"

# 3. Create target directory structure
APP_DIR="${INSTALL_DIR}/app"
RUNTIME_DIR="${INSTALL_DIR}/runtime"
mkdir -p "${INSTALL_DIR}" "${APP_DIR}" "${RUNTIME_DIR}/bin" "${BIN_DIR}"

# 4. Check & Install Isolated Portable Node Runtime if not present
NODE_BIN="${RUNTIME_DIR}/bin/node"

if [ ! -x "${NODE_BIN}" ]; then
    log_info "Setting up isolated portable Node.js runtime (${NODE_VERSION}) in ${RUNTIME_DIR}..."
    NODE_TARBALL="node-${NODE_VERSION}-${OS}-${ARCH}.tar.gz"
    NODE_URL="https://nodejs.org/dist/${NODE_VERSION}/${NODE_TARBALL}"

    TMP_DIR="$(mktemp -d)"
    trap 'rm -rf "${TMP_DIR}"' EXIT

    log_info "Downloading portable runtime from ${NODE_URL}..."
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "${NODE_URL}" -o "${TMP_DIR}/${NODE_TARBALL}"
    elif command -v wget >/dev/null 2>&1; then
        wget -qO "${TMP_DIR}/${NODE_TARBALL}" "${NODE_URL}"
    else
        log_error "Neither curl nor wget was found on the system. Please install curl or wget."
        exit 1
    fi

    log_info "Extracting runtime..."
    tar -xzf "${TMP_DIR}/${NODE_TARBALL}" -C "${RUNTIME_DIR}" --strip-components=1
    chmod +x "${RUNTIME_DIR}/bin/node"
    log_success "Portable Node runtime ready (completely isolated, no global changes)."
fi

# 5. Install Application Files
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" >/dev/null 2>&1 && pwd || echo "")"
IS_LOCAL=0

# Check if running locally inside the holy-canvas source repository
if [ -n "${SCRIPT_DIR}" ] && [ -f "${SCRIPT_DIR}/../package.json" ] && [ -d "${SCRIPT_DIR}/../dist" ]; then
    REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
    if grep -q '"name": "holy-canvas"' "${REPO_ROOT}/package.json" 2>/dev/null; then
        IS_LOCAL=1
    fi
fi

if [ "${IS_LOCAL}" -eq 1 ]; then
    log_info "Installing from local repository at ${REPO_ROOT}..."
    cp -r "${REPO_ROOT}/dist" "${APP_DIR}/"
    cp "${REPO_ROOT}/package.json" "${APP_DIR}/"

    log_info "Installing standalone production dependencies using portable runtime..."
    "${RUNTIME_DIR}/bin/npm" install --prefix "${APP_DIR}" --omit=dev --legacy-peer-deps --no-audit --no-fund --loglevel=error
else
    # Remote install: Check for pre-built release package first
    RELEASE_URL="https://github.com/${REPO}/releases/latest/download/holy-canvas-${OS}-${ARCH}.tar.gz"
    DOWNLOADED=0

    TMP_ARCHIVE="$(mktemp)"
    log_info "Checking for pre-built release package..."
    if command -v curl >/dev/null 2>&1; then
        if curl -fsSL -I "${RELEASE_URL}" >/dev/null 2>&1; then
            log_info "Downloading pre-built release from ${RELEASE_URL}..."
            curl -fsSL "${RELEASE_URL}" -o "${TMP_ARCHIVE}"
            tar -xzf "${TMP_ARCHIVE}" -C "${INSTALL_DIR}"
            DOWNLOADED=1
        fi
    fi

    if [ "${DOWNLOADED}" -eq 0 ]; then
        # Fallback: Download repository archive and build with portable runtime
        log_info "Fetching latest code from GitHub (${REPO})..."
        REPO_TAR_URL="https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz"
        TMP_SRC_DIR="$(mktemp -d)"
        
        if command -v curl >/dev/null 2>&1; then
            curl -fsSL "${REPO_TAR_URL}" | tar -xz -C "${TMP_SRC_DIR}" --strip-components=1
        elif command -v wget >/dev/null 2>&1; then
            wget -qO- "${REPO_TAR_URL}" | tar -xz -C "${TMP_SRC_DIR}" --strip-components=1
        fi

        log_info "Deploying application files..."
        cp -r "${TMP_SRC_DIR}/dist" "${APP_DIR}/"
        cp "${TMP_SRC_DIR}/package.json" "${APP_DIR}/"

        log_info "Installing production dependencies with portable runtime..."
        "${RUNTIME_DIR}/bin/npm" install --prefix "${APP_DIR}" --omit=dev --legacy-peer-deps --no-audit --no-fund --loglevel=error
        rm -rf "${TMP_SRC_DIR}"
    fi
    rm -f "${TMP_ARCHIVE}"
fi

# 6. Generate Launcher Scripts
LAUNCHER_WRAPPER="${INSTALL_DIR}/bin/holy-canvas"
mkdir -p "${INSTALL_DIR}/bin"

cat > "${LAUNCHER_WRAPPER}" << 'EOF'
#!/usr/bin/env bash
SELF_DIR="$(cd "$(dirname "$0")"/.. && pwd)"
NODE_BIN="${SELF_DIR}/runtime/bin/node"
CLI_SCRIPT="${SELF_DIR}/app/dist/cli.js"

if [ ! -x "${NODE_BIN}" ]; then
    NODE_BIN="$(command -v node 2>/dev/null || true)"
fi

if [ -z "${NODE_BIN}" ] || [ ! -x "${NODE_BIN}" ]; then
    echo "Error: Node.js runtime not found at ${SELF_DIR}/runtime/bin/node" >&2
    exit 1
fi

exec "${NODE_BIN}" "${CLI_SCRIPT}" "$@"
EOF

chmod +x "${LAUNCHER_WRAPPER}"

# Create secondary binary alias 'hcvs' in INSTALL_DIR/bin
ln -sf "holy-canvas" "${INSTALL_DIR}/bin/hcvs"

# Create symlinks or wrappers in user BIN_DIR (~/.local/bin) if different from INSTALL_DIR/bin
if [ "${BIN_DIR}" != "${INSTALL_DIR}/bin" ]; then
    mkdir -p "${BIN_DIR}"
    ln -sf "${LAUNCHER_WRAPPER}" "${BIN_DIR}/holy-canvas"
    ln -sf "${LAUNCHER_WRAPPER}" "${BIN_DIR}/hcvs"
fi

# 7. Configure PATH if necessary
PATH_UPDATED=0
case ":${PATH}:" in
    *":${BIN_DIR}:"*) ;;
    *)
        log_info "Adding ${BIN_DIR} to PATH..."
        SHELL_NAME="$(basename "${SHELL:-bash}")"
        PROFILE_FILE=""
        if [ "${SHELL_NAME}" = "zsh" ]; then
            PROFILE_FILE="${HOME}/.zshrc"
        elif [ "${SHELL_NAME}" = "bash" ]; then
            if [ -f "${HOME}/.bashrc" ]; then
                PROFILE_FILE="${HOME}/.bashrc"
            else
                PROFILE_FILE="${HOME}/.bash_profile"
            fi
        else
            PROFILE_FILE="${HOME}/.profile"
        fi

        if [ -n "${PROFILE_FILE}" ] && [ -f "${PROFILE_FILE}" ]; then
            if ! grep -q "${BIN_DIR}" "${PROFILE_FILE}" 2>/dev/null; then
                printf '\n# holy-canvas (hcvs)\nexport PATH="%s:$PATH"\n' "${BIN_DIR}" >> "${PROFILE_FILE}"
                PATH_UPDATED=1
                log_info "Updated PATH in ${PROFILE_FILE}"
            fi
        fi
        ;;
esac

# 8. Verify Installation
log_info "Verifying installation..."
INSTALLED_VERSION="$("${BIN_DIR}/holy-canvas" --version 2>/dev/null || echo "failed")"

if [ "${INSTALLED_VERSION}" = "failed" ]; then
    log_warn "Verification check could not run holy-canvas. Check permissions on ${BIN_DIR}."
else
    log_success "holy-canvas v${INSTALLED_VERSION} successfully installed!"
fi

# 9. Finished banner & usage guide
printf "\n"
printf "======================================================================\n"
printf "${BOLD}${GREEN}holy-canvas (alias: hcvs) is ready!${NC}\n"
printf "======================================================================\n\n"
printf "Installed location: %s\n" "${INSTALL_DIR}"
printf "Binary commands:    %s/holy-canvas, %s/hcvs\n\n" "${BIN_DIR}" "${BIN_DIR}"

if [ "${PATH_UPDATED}" -eq 1 ]; then
    printf "${YELLOW}NOTE:${NC} To make the command available in your current terminal, run:\n"
    printf "  ${BOLD}source %s${NC}  or  ${BOLD}export PATH=\"%s:\$PATH\"${NC}\n\n" "${PROFILE_FILE}" "${BIN_DIR}"
fi

printf "${BOLD}Quick Start:${NC}\n"
printf "  1. Run setup to connect your Canvas account:\n"
printf "     ${CYAN}hcvs setup${NC}  or  ${CYAN}holy-canvas setup${NC}\n\n"
printf "  2. Launch interactive terminal interface (TUI):\n"
printf "     ${CYAN}hcvs${NC}\n\n"
printf "  3. Or use direct CLI commands:\n"
printf "     ${CYAN}hcvs courses${NC}\n"
printf "     ${CYAN}hcvs grades${NC}\n"
printf "     ${CYAN}hcvs quizzes${NC}\n"
printf "     ${CYAN}hcvs files --all --sync${NC}\n\n"
printf "To uninstall:\n"
printf "  curl -fsSL https://raw.githubusercontent.com/%s/stable/scripts/uninstall.sh | bash\n\n" "$REPO"
