#!/bin/bash

# ============================================================================
# First2Fetch Development Environment Manager
# ============================================================================
# A unified script to manage Supabase, Edge Functions, and Desktop App
#
# Usage:
#   ./dev.sh [command]
#
# Commands:
#   start       - Start everything (Supabase + Edge Functions + Desktop App)
#   stop        - Stop everything
#   restart     - Restart everything
#
#   app         - Start only the desktop app (assumes Supabase is running)
#   app:stop    - Stop only the desktop app
#   app:restart - Restart only the desktop app
#
#   edge        - Start only edge functions (assumes Supabase is running)
#   edge:stop   - Stop only edge functions
#   edge:restart- Restart only edge functions
#
#   quick       - Start edge functions + desktop app (assumes Supabase running)
#   quick:stop  - Stop edge functions + desktop app
#   quick:restart - Restart edge functions + desktop app
#
#   supabase    - Start only Supabase
#   supabase:stop - Stop Supabase
#   supabase:restart - Restart Supabase
#
#   status      - Show status of all services
#   help        - Show this help message
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/apps/backend"
DESKTOP_DIR="$SCRIPT_DIR/apps/desktopProbe"

# PID files for tracking background processes
PID_DIR="$SCRIPT_DIR/.dev-pids"
EDGE_PID_FILE="$PID_DIR/edge.pid"
DESKTOP_PID_FILE="$PID_DIR/desktop.pid"

# ============================================================================
# Helper Functions
# ============================================================================

print_header() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  ${BOLD}$1${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

ensure_pid_dir() {
    mkdir -p "$PID_DIR"
}

# ============================================================================
# Service Status Checks
# ============================================================================

is_supabase_running() {
    cd "$BACKEND_DIR"
    if npx supabase status &>/dev/null; then
        return 0
    else
        return 1
    fi
}

is_edge_running() {
    if [ -f "$EDGE_PID_FILE" ]; then
        local pid=$(cat "$EDGE_PID_FILE")
        if ps -p "$pid" &>/dev/null; then
            return 0
        fi
    fi
    # Also check if there's any supabase functions serve process running
    if pgrep -f "supabase functions serve" &>/dev/null; then
        return 0
    fi
    return 1
}

is_desktop_running() {
    if [ -f "$DESKTOP_PID_FILE" ]; then
        local pid=$(cat "$DESKTOP_PID_FILE")
        if ps -p "$pid" &>/dev/null; then
            return 0
        fi
    fi
    # Also check if there's any electron process for this app running
    if pgrep -f "electron.*first2fetch" &>/dev/null || pgrep -f "Electron.*First" &>/dev/null; then
        return 0
    fi
    return 1
}

# ============================================================================
# Supabase Management
# ============================================================================

start_supabase() {
    print_step "Checking Supabase status..."
    
    if is_supabase_running; then
        print_success "Supabase is already running"
        return 0
    fi
    
    print_step "Starting Supabase (this may take a moment)..."
    cd "$BACKEND_DIR"
    npx supabase start
    
    if is_supabase_running; then
        print_success "Supabase started successfully"
        echo ""
        print_info "Supabase Studio: http://127.0.0.1:54323"
        print_info "API URL: http://127.0.0.1:54321"
        print_info "DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    else
        print_error "Failed to start Supabase"
        return 1
    fi
}

stop_supabase() {
    print_step "Stopping Supabase..."
    cd "$BACKEND_DIR"
    
    if ! is_supabase_running; then
        print_warning "Supabase is not running"
        return 0
    fi
    
    npx supabase stop
    print_success "Supabase stopped"
}

# ============================================================================
# Edge Functions Management
# ============================================================================

start_edge() {
    ensure_pid_dir
    
    if ! is_supabase_running; then
        print_error "Supabase is not running. Start it first with: ./dev.sh supabase"
        return 1
    fi
    
    if is_edge_running; then
        print_warning "Edge functions already running"
        return 0
    fi
    
    print_step "Starting Edge Functions..."
    cd "$BACKEND_DIR"
    
    # Start edge functions in background
    npx supabase functions serve &
    local pid=$!
    echo "$pid" > "$EDGE_PID_FILE"
    
    # Wait a moment for it to start
    sleep 2
    
    if ps -p "$pid" &>/dev/null; then
        print_success "Edge Functions started (PID: $pid)"
        print_info "Edge Functions URL: http://127.0.0.1:54321/functions/v1/"
    else
        print_error "Failed to start Edge Functions"
        rm -f "$EDGE_PID_FILE"
        return 1
    fi
}

stop_edge() {
    print_step "Stopping Edge Functions..."
    
    if [ -f "$EDGE_PID_FILE" ]; then
        local pid=$(cat "$EDGE_PID_FILE")
        if ps -p "$pid" &>/dev/null; then
            kill "$pid" 2>/dev/null || true
        fi
        rm -f "$EDGE_PID_FILE"
    fi
    
    # Also kill any other edge function processes
    pkill -f "supabase functions serve" 2>/dev/null || true
    
    print_success "Edge Functions stopped"
}

# ============================================================================
# Desktop App Management
# ============================================================================

start_desktop() {
    ensure_pid_dir
    
    if ! is_supabase_running; then
        print_warning "Supabase is not running. The app may not work correctly."
        print_info "Start Supabase with: ./dev.sh supabase"
    fi
    
    if is_desktop_running; then
        print_warning "Desktop app already running"
        return 0
    fi
    
    print_step "Starting Desktop App..."
    cd "$DESKTOP_DIR"
    
    # Start desktop app in background
    pnpm start &
    local pid=$!
    echo "$pid" > "$DESKTOP_PID_FILE"
    
    print_success "Desktop App starting (PID: $pid)"
    print_info "The app window should open shortly..."
}

stop_desktop() {
    print_step "Stopping Desktop App..."
    
    if [ -f "$DESKTOP_PID_FILE" ]; then
        local pid=$(cat "$DESKTOP_PID_FILE")
        if ps -p "$pid" &>/dev/null; then
            kill "$pid" 2>/dev/null || true
        fi
        rm -f "$DESKTOP_PID_FILE"
    fi
    
    # Also kill any electron processes for this app
    pkill -f "electron-forge start" 2>/dev/null || true
    pkill -f "Electron.*First" 2>/dev/null || true
    
    # Give processes time to clean up
    sleep 1
    
    print_success "Desktop App stopped"
}

# ============================================================================
# Combined Operations
# ============================================================================

start_all() {
    print_header "Starting Full Development Environment"
    
    start_supabase
    echo ""
    start_edge
    echo ""
    start_desktop
    
    echo ""
    print_header "All Services Started"
    show_status
}

stop_all() {
    print_header "Stopping All Services"
    
    stop_desktop
    stop_edge
    stop_supabase
    
    print_success "All services stopped"
}

restart_all() {
    print_header "Restarting All Services"
    stop_all
    echo ""
    start_all
}

# Quick mode - just edge functions and desktop app
start_quick() {
    print_header "Quick Start (Edge Functions + Desktop App)"
    
    if ! is_supabase_running; then
        print_error "Supabase is not running!"
        print_info "Start Supabase first with: ./dev.sh supabase"
        print_info "Or start everything with: ./dev.sh start"
        return 1
    fi
    
    print_success "Supabase is running"
    echo ""
    start_edge
    echo ""
    start_desktop
    
    echo ""
    print_header "Quick Start Complete"
}

stop_quick() {
    print_header "Stopping Edge Functions + Desktop App"
    stop_desktop
    stop_edge
    print_success "Edge Functions and Desktop App stopped"
}

restart_quick() {
    print_header "Restarting Edge Functions + Desktop App"
    stop_quick
    echo ""
    start_quick
}

# ============================================================================
# Status Display
# ============================================================================

show_status() {
    print_header "Service Status"
    
    echo -e "  ${BOLD}Service${NC}              ${BOLD}Status${NC}"
    echo "  ─────────────────────────────────────"
    
    # Supabase
    if is_supabase_running; then
        echo -e "  Supabase           ${GREEN}● Running${NC}"
    else
        echo -e "  Supabase           ${RED}○ Stopped${NC}"
    fi
    
    # Edge Functions
    if is_edge_running; then
        local pid=""
        if [ -f "$EDGE_PID_FILE" ]; then
            pid=" (PID: $(cat "$EDGE_PID_FILE"))"
        fi
        echo -e "  Edge Functions     ${GREEN}● Running${NC}$pid"
    else
        echo -e "  Edge Functions     ${RED}○ Stopped${NC}"
    fi
    
    # Desktop App
    if is_desktop_running; then
        local pid=""
        if [ -f "$DESKTOP_PID_FILE" ]; then
            pid=" (PID: $(cat "$DESKTOP_PID_FILE"))"
        fi
        echo -e "  Desktop App        ${GREEN}● Running${NC}$pid"
    else
        echo -e "  Desktop App        ${RED}○ Stopped${NC}"
    fi
    
    echo ""
    
    if is_supabase_running; then
        echo -e "  ${BOLD}URLs${NC}"
        echo "  ─────────────────────────────────────"
        echo -e "  Supabase Studio:   ${CYAN}http://127.0.0.1:54323${NC}"
        echo -e "  API URL:           ${CYAN}http://127.0.0.1:54321${NC}"
        echo -e "  Inbucket (Email):  ${CYAN}http://127.0.0.1:54324${NC}"
        echo ""
    fi
}

# ============================================================================
# Help
# ============================================================================

show_help() {
    echo ""
    echo -e "${BOLD}First2Fetch Development Environment Manager${NC}"
    echo ""
    echo -e "${BOLD}Usage:${NC}"
    echo "  ./dev.sh [command]"
    echo ""
    echo -e "${BOLD}Full Environment:${NC}"
    echo "  start           Start everything (Supabase + Edge Functions + App)"
    echo "  stop            Stop everything"
    echo "  restart         Restart everything"
    echo ""
    echo -e "${BOLD}Quick Mode (for testing - assumes Supabase is running):${NC}"
    echo "  quick           Start Edge Functions + Desktop App only"
    echo "  quick:stop      Stop Edge Functions + Desktop App"
    echo "  quick:restart   Restart Edge Functions + Desktop App"
    echo ""
    echo -e "${BOLD}Individual Services:${NC}"
    echo "  supabase        Start Supabase only"
    echo "  supabase:stop   Stop Supabase"
    echo "  supabase:restart Restart Supabase"
    echo ""
    echo "  edge            Start Edge Functions only"
    echo "  edge:stop       Stop Edge Functions"
    echo "  edge:restart    Restart Edge Functions"
    echo ""
    echo "  app             Start Desktop App only"
    echo "  app:stop        Stop Desktop App"
    echo "  app:restart     Restart Desktop App"
    echo ""
    echo -e "${BOLD}Other:${NC}"
    echo "  status          Show status of all services"
    echo "  help            Show this help message"
    echo ""
    echo -e "${BOLD}Examples:${NC}"
    echo "  ./dev.sh start          # First time setup - start everything"
    echo "  ./dev.sh quick:restart  # Quick restart for testing (keeps Supabase)"
    echo "  ./dev.sh edge:restart   # Restart only edge functions"
    echo "  ./dev.sh status         # Check what's running"
    echo ""
}

# ============================================================================
# Main Entry Point
# ============================================================================

main() {
    case "${1:-help}" in
        # Full environment
        start)
            start_all
            ;;
        stop)
            stop_all
            ;;
        restart)
            restart_all
            ;;
        
        # Quick mode (edge + app only)
        quick)
            start_quick
            ;;
        quick:stop)
            stop_quick
            ;;
        quick:restart)
            restart_quick
            ;;
        
        # Supabase
        supabase)
            start_supabase
            ;;
        supabase:stop)
            stop_supabase
            ;;
        supabase:restart)
            stop_supabase
            start_supabase
            ;;
        
        # Edge functions
        edge)
            start_edge
            ;;
        edge:stop)
            stop_edge
            ;;
        edge:restart)
            stop_edge
            start_edge
            ;;
        
        # Desktop app
        app)
            start_desktop
            ;;
        app:stop)
            stop_desktop
            ;;
        app:restart)
            stop_desktop
            start_desktop
            ;;
        
        # Other
        status)
            show_status
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"


