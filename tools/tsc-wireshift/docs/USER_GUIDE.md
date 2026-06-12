# ðŸ›¡ï¸ TSC Wireshift User Guide

**TSC Wireshift** is a powerful web security testing tool that helps you intercept, analyze, and modify HTTP/HTTPS traffic in real-time. This guide walks you through getting started and using its core features effectively.

---

## ðŸ“š Table of Contents

- [âš™ï¸ Installation](#installation)
- [ðŸš€ Getting Started](#getting-started)
- [ðŸ” Features](#features)
  - [ðŸ§° Proxy Interceptor](#proxy-interceptor)
  - [ðŸ•¸ï¸ HTTP History](#http-history)
  - [ðŸ§¾ Interception Rules](#interception-rules)
  - [ðŸ“¤ Request Resender](#request-resender)
  - [ðŸŽ¯ Fuzzer](#fuzzer)
  - [ðŸ§  LLM Analyzer](#llm-analyzer)
  - [ðŸ“¡ Listener](#listener)
  - [ðŸ”’ Scope Management](#scope-management)
  - [ðŸ—ºï¸ Site Map](#site-map)
  - [ðŸ”Œ Plugins](#plugins)
- [ðŸ› ï¸ Troubleshooting](#troubleshooting)
- [â¬†ï¸ Updates](#updates)
- [ðŸ’¾ Data Management](#data-management)
- [ðŸ” Privacy and Security](#privacy-and-security)
- [ðŸ“„ License](#license)

---

## âš™ï¸ Installation

1. Download the latest release for your platform from the [Releases Page](https://github.com/al-sultani/tsc-wireshift/releases).
2. Follow the installation instructions based on your OS:

   - ðŸªŸ **Windows**: Run the `.msi` installer. Then, launch the `.exe` file by selecting `Run as administrator`  
   - ðŸŽ **macOS**: Open the `.dmg` and drag TSC Wireshift to **Applications**  
   - ðŸ§ **Linux**: Use your package manager:
     ```bash
     # For Debian/Ubuntu
     sudo dpkg -i tsc-wireshift_*.deb
     ```

---

## ðŸš€ Getting Started

### ðŸ”§ Initial Setup

1. Launch **TSC Wireshift**
2. Configure your browser to use TSC Wireshift as a proxy:
   - **Host**: `127.0.0.1`
   - **Port**: `8080` (default; can be customized)
   - **Protocol**: HTTP/HTTPS

### ðŸ” SSL Certificate Installation

1. Open `http://tsc-wireshift/` after launching the app
2. Click **"Download Certificate"** and follow instructions:
   - ðŸªŸ **Windows**: Installed automatically
   - ðŸŽ **macOS**: Open in **Keychain Access** and mark it trusted
   - ðŸ§ **Linux**: Follow your distro's certificate guide
3. Restart your browser to apply the certificate

---

## ðŸ” Features

### ðŸ§° Proxy Interceptor

Control and modify traffic in real time:

- âœ… Toggle interception
- âœï¸ Edit headers, parameters, and body
- ðŸ” Forward or ðŸš« drop requests
- ðŸ“¤ Send requests to Resender, Fuzzer, or LLM Analyzer
- ðŸ” Filter and search efficiently

---

### ðŸ•¸ï¸ HTTP History

View and analyze intercepted requests:

- ðŸ“„ Full request/response view
- ðŸ”Ž Advanced filters
- ðŸ“¤ Export capabilities
- ðŸ“† Timeline of requests
- ðŸ§  Response analysis tools

---

### ðŸ§¾ Interception Rules

Two types of rules help you manage traffic:

1. ðŸ§² **Capture/Ignore Rules** â€“ Decide if requests should be intercepted or ignored  
2. âœ‚ï¸ **Match and Replace Rules** â€“ Modify request/response content dynamically

**To create a rule:**

1. Go to **Rules** tab  
2. Click **"New Rule"**  
3. Configure conditions:
   - ðŸ”— URL patterns  
   - âš™ï¸ HTTP methods  
   - ðŸ·ï¸ Header matchers  
   - ðŸ§¬ Body content matchers  
4. (Optional) Define match/replace logic

---

### ðŸ“¤ Request Resender

Manually test request variations:

- ðŸ“ Edit and resend requests
- ðŸ’¾ Save as templates
- ðŸ” Search request and response content

---

### ðŸŽ¯ Fuzzer

Fuzz endpoints for vulnerabilities:

1. Pick a request  
2. ðŸ–±ï¸ Right-click to insert fuzz points  
3. Choose payloads:
   - ðŸ“š Built-in lists
   - ðŸ§¾ Custom wordlists
4. ðŸ”„ Start, pause, and resume fuzzing

---

### ðŸ§  LLM Analyzer

Leverage AI (ChatGPT 4.5) for smarter testing:

- ðŸ§© Pattern-based insights
- ðŸ” Security recommendations
- ðŸ§ª (Coming soon) Custom prompts 

---

### ðŸ“¡ Listener

Client for [Interactsh](https://github.com/projectdiscovery/interactsh) â€“ **not** for raw traffic monitoring.

- ðŸ“¬ Receive out-of-band (OOB) interactions
- ðŸ”— Link callbacks to payloads
- ðŸ“„ Log DNS/HTTP responses
- ðŸ§© Build custom response handlers
- ðŸ‘ï¸ Monitor OOB activity in real time

---

### ðŸ”’ Scope Management

Keep testing targeted:

- ðŸ“Œ Define regex-based scope filters
- ðŸ›‘ Block traffic outside defined scope

---

### ðŸ—ºï¸ Site Map

Visualize the target structure:

- ðŸ§± Group paths by domain and folder
- ðŸ‘ï¸ Interactive site exploration

---

### ðŸ”Œ Plugins

Extend TSC Wireshift with custom plugins (ðŸš§ WIP):

- âš™ï¸ Integrate custom tools
- ðŸ”„ Add response processors
- ðŸ“ˆ Build custom analysis modules
- ðŸ§© Extend UI and API

---

### âš™ï¸ Settings 

Configure TSC Wireshift to match your needs:

- ðŸ“ **Project Settings**
  - Rename your project for better organization
  - Customize proxy port (default: 8080)
  - Set project-specific scope rules

- ðŸ¤– **AI Integration**
  - Configure ChatGPT API endpoint
  - Securely store your API key
  - Test connection and validate setup

- ðŸŒ **Interactsh Configuration**
  - Set custom Interactsh server host
  - Configure port settings
  - Enable/disable OOB detection features

- ðŸŽ¨ **Appearance**
  - Toggle between Dark and Light themes
  - Customize UI element sizes
  - Adjust font settings for better readability

---

## ðŸ› ï¸ Troubleshooting

### ðŸ” Certificate Issues

- Reinstall and ensure it's trusted
- Check browser security settings
- Restart the browser

### ðŸ”Œ Connection Issues

- Double-check proxy settings
- Confirm TSC Wireshift is running
- Make sure port 8080 is not blocked

### ðŸ–¥ï¸ UI/Performance Issues

- ðŸ§¹ UI glitch? Go to **TSC Wireshift â†’ Refresh** from the top menu

---

## â¬†ï¸ Updates

> ðŸ”„ Auto-update is on the roadmap!

---

## ðŸ’¾ Data Management

Project data is stored locally:

- ðŸªŸ `%APPDATA%\TSC Wireshift\projects\`
- ðŸŽ `~/Library/Application Support/TSC Wireshift/projects/`
- ðŸ§ `~/.local/share/TSC Wireshift/projects/`

---

## ðŸ” Privacy and Security

- ðŸ”’ All data is processed **locally**
- ðŸš« No data is sent to external servers

