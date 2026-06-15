# ðŸ‘¨â€ðŸ’» TSC Wireshift Developer Guide

Welcome to the **TSC Wireshift** developer documentation! This guide will help you understand the project architecture, set up your development environment, and start contributing effectively.

---

## ðŸ“š Table of Contents

- [ðŸ§± Architecture Overview](#architecture-overview)
- [ðŸ› ï¸ Development Setup](#development-setup)
- [ðŸ“ Project Structure](#project-structure)
- [ðŸ—ï¸ Building](#building)
- [ðŸ§ª Testing](#testing)
- [ðŸ¤ Contributing](#contributing)
- [ðŸ”Œ Plugin Development](#plugin-development)

---

## ðŸ§± Architecture Overview

TSC Wireshift is built with modern, cross-platform technologies:

- ðŸŒ **Frontend**: React + TypeScript  
- âš™ï¸ **Backend**: Go  
- ðŸ–¥ï¸ **Cross-platform UI**: [Wails](https://wails.io/)  
- ðŸ’¾ **Database**: SQLite

### ðŸ”© Key Components

```
TSC Wireshift
â”œâ”€â”€ Frontend (React)
â”‚   â”œâ”€â”€ Proxy Interceptor
â”‚   â”œâ”€â”€ Request/Response Editor
â”‚   â”œâ”€â”€ History Viewer
â”‚   â””â”€â”€ Analysis Tools
â”œâ”€â”€ Backend (Go)
â”‚   â”œâ”€â”€ Proxy Server
â”‚   â”œâ”€â”€ Certificate Manager
â”‚   â”œâ”€â”€ Database
â”‚   â””â”€â”€ Plugin System
â””â”€â”€ Core Services
    â”œâ”€â”€ Traffic Interception
    â”œâ”€â”€ Request Processing
    â””â”€â”€ Security Analysis
```

---

## ðŸ› ï¸ Development Setup

### âœ… Prerequisites

Make sure you have the following installed:

- ðŸ¹ Go 1.21+
- ðŸŸ¢ Node.js 18+
- ðŸ“¦ npm or yarn
- ðŸ› ï¸ Wails CLI
- ðŸ”— Git

### ðŸš€ Installation Steps

1. Clone the repo:
```bash
git clone https://github.com/al-sultani/tsc-wireshift.git
cd tsc-wireshift
```

2. Install Wails CLI (if not already installed):
```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

3. Install frontend dependencies:
```bash
cd frontend
npm install
```

4. Install backend dependencies:
```bash
go mod download
```

---

### ðŸ§ª Development Environment

Run the full-stack development environment:

```bash
wails dev
```

Or, for frontend-only development:

```bash
cd frontend
npm run dev
```

---

## ðŸ“ Project Structure

```
tsc-wireshift/
â”œâ”€â”€ frontend/                 # React frontend code
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ components/      # Reusable UI components
â”‚   â”‚   â”œâ”€â”€ features/        # Feature-specific views
â”‚   â”‚   â”œâ”€â”€ contexts/        # React context providers
â”‚   â”‚   â”œâ”€â”€ hooks/           # Custom React hooks
â”‚   â”‚   â””â”€â”€ styles/          # CSS & styling
â”œâ”€â”€ internal/                # Go internal packages
â”œâ”€â”€ build/                   # Build artifacts
â””â”€â”€ wails.json               # Wails project config
```

---

## ðŸ—ï¸ Building

### ðŸ§ª Development Build

```bash
wails dev
```

### ðŸš€ Production Build

```bash
wails build
```

You can also target specific platforms:

- ðŸªŸ Windows:  
  ```bash
  wails build -platform windows/amd64
  ```

- ðŸŽ macOS:  
  ```bash
  wails build -platform darwin/universal
  ```

- ðŸ§ Linux:  
  ```bash
  wails build -platform linux/amd64
  ```

---

## ðŸ§ª Testing

ðŸ§ª *Coming soon!* Unit tests and integration tests are being integrated into the CI pipeline.

---

## ðŸ¤ Contributing

We welcome contributions! ðŸš€  
To contribute:

1. Fork the repo and clone your fork
2. Create a new branch for your feature or fix
3. Follow existing code style conventions
4. Submit a pull request (PR)

Please see `CONTRIBUTING.md` (coming soon) for detailed guidelines.

---

## ðŸ”Œ Plugin Development

Plugin support is currently **Work in Progress** âš ï¸  
Soon youâ€™ll be able to:

- Extend the core with custom tools
- Add request/response processors
- Inject UI panels
- Register analysis engines

Stay tuned for documentation and APIs!

---

Thanks for helping improve **TSC Wireshift**! ðŸ’™  
For questions, feel free to reach out via [GitHub Discussions](https://github.com/al-sultani/tsc-wireshift/discussions) or [Discord](https://discord.gg/tsc-wireshift).
