# GitHub Deployment Streamer

🚀 **Real-time deployment monitoring for GitHub Actions across all your repositories**

Monitor all your GitHub Actions workflows in one place with real-time streaming, chronological display, and clickable links to GitHub Actions pages.

## Features

- 📊 **Chronological Display**: View all deployment runs sorted by time (newest first)
- 🔄 **Real-time Streaming**: Auto-streams active workflow runs in real-time
- 🔗 **Clickable Links**: Direct links to GitHub Actions pages (Ctrl/Cmd+Click)
- 📈 **Smart Updates**: 
  - First run: Shows last 100 runs across all repos
  - Every 30 minutes: Shows only new runs from the last 30 minutes
- ⏱️ **Timestamped Logs**: Every event shows full YYYY-MM-DD HH:MM:SS timestamp
- 🎨 **Beautiful CLI**: Colorized output with nice formatting
- 🔐 **Secure**: Uses GitHub CLI (already logged in, no extra tokens needed)
- ⚡ **Fast**: Parallel repo scanning for quick results

## Installation

### Prerequisites
- Node.js 16+
- GitHub CLI (`gh`) - [Install here](https://cli.github.com)
- GitHub CLI authentication (`gh auth login`)

### Quick Start

```bash
git clone https://github.com/yourusername/github-deployment-streamer.git
cd github-deployment-streamer
npm install
node index.js
```

## Usage

### Run directly
```bash
node index.js
```

### Run with custom scan interval (default: 30 minutes)
```bash
node index.js --interval 15  # Scan every 15 minutes
```

### Run with verbose logging
```bash
node index.js --verbose
```

### Run in background (tmux)
```bash
tmux new-session -d -s gh-streamer -c "$(pwd)" "node index.js"
tmux attach -t gh-streamer
```

### Run in background (nohup)
```bash
nohup node index.js > gh-streamer.log 2>&1 &
```

## How It Works

1. **Startup Sequence**:
   - Checks GitHub CLI availability
   - Verifies GitHub authentication
   - Displays user details
   - Lists all repositories
   - Loads last 100 deployment runs

2. **Initial Display**:
   - Shows last 100 runs across all repos in chronological order
   - Displays status (✓ SUCCESS, ✗ FAILED, 🔄 IN PROGRESS, ⊘ CANCELLED)
   - Shows repo, run number, and run name
   - Each run has a clickable link to GitHub Actions page

3. **Automatic Streaming**:
   - Detects any in-progress runs
   - Automatically streams them in real-time
   - Shows status updates every 5 seconds

4. **Recurring Scans**:
   - After 30 minutes, scans again for new runs
   - Shows only NEW runs from the last 30-minute window
   - Never re-displays the same run twice
   - Continues forever (or until you stop it)

## Example Output

```
┌─────────────────────────────────────────────────────────┐
│                                                             │
│  🚀 GitHub Deployment Streamer                        │
│  Real-time deployment monitoring across all repos     │
│                                                             │
└─────────────────────────────────────────────────────────┘

[2026-02-27 18:01:28] > ✓ Loaded last 100 deployment runs

  ┌─ Deployment Runs ──────────────────────────────────────┐
  │
  │ [2026-02-27 17:08:48] ✗ FAILED vkumar-dev/repo#5 "Run Inference"
  │ [2026-02-27 16:35:50] ✓ SUCCESS vkumar-dev/repo#14 "Deploy to Pages"
  │ [2026-02-27 16:35:33] 🔄 IN PROGRESS vkumar-dev/repo#102 "Build"
  │
  └────────────────────────────────────────────────────────┘

[2026-02-27 18:01:30] > 🔴 1 active stream(s) found. Starting...
```

## Clickable Links

The run IDs are clickable in most modern terminals:
- **VS Code**: Ctrl+Click
- **iTerm2**: Cmd+Click
- **GNOME Terminal**: Ctrl+Click
- **Windows Terminal**: Ctrl+Click

Clicking opens the run directly on GitHub Actions.

## Configuration

The tool uses `.state.json` to track which runs have been displayed. This prevents showing the same run twice during recurring scans.

To reset and start fresh:
```bash
rm .state.json
node index.js
```

## Terminal Support

Works best with terminals that support OSC 8 hyperlinks:
- ✅ VS Code Integrated Terminal
- ✅ iTerm2
- ✅ GNOME Terminal
- ✅ Windows Terminal
- ✅ Kitty
- ✅ Most modern terminals

## CLI Options

```
-i, --interval <minutes>  Scan interval in minutes (default: 30)
--verbose                 Enable verbose logging
```

## Examples

### Monitor with 15-minute interval
```bash
node index.js --interval 15
```

### Run in tmux for persistent monitoring
```bash
tmux new-session -d -s deployments "cd ~/github/deployment-streamer && node index.js"
```

### View running session
```bash
tmux attach -t deployments
```

### Kill session
```bash
tmux kill-session -t deployments
```

## Development

Clone and install:
```bash
git clone https://github.com/yourusername/github-deployment-streamer.git
cd github-deployment-streamer
npm install
```

Run:
```bash
node index.js
```

## Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit PRs
- Improve documentation

## License

MIT - See LICENSE file

## Roadmap

- [ ] Filter by repo name
- [ ] Filter by status (show only failures)
- [ ] Export logs to file
- [ ] Web dashboard
- [ ] Slack/Discord notifications
- [ ] Custom refresh intervals per repo
- [ ] Run statistics and analytics

## Troubleshooting

### "GitHub CLI not found"
Install GitHub CLI: https://cli.github.com

### "Not authenticated with GitHub"
Run: `gh auth login`

### "No runs displayed"
- Check that your repos have GitHub Actions enabled
- Verify you have permission to view the repos
- Run with `--verbose` flag for debugging

### Clickable links not working
- Ensure your terminal supports OSC 8 hyperlinks
- Try a modern terminal like VS Code, iTerm2, or Windows Terminal

## Similar Tools

- [github-trending-repos](https://github.com/vkumar-dev/github-trending-repos)
- [gh-dash](https://github.com/dlvhdr/gh-dash)
- [actions-viewer](https://github.com/actions-viewer/viewer)

## Author

Created with ❤️ for GitHub users who want better deployment visibility.

## Support

If you find this tool helpful, please:
- ⭐ Star the repo
- 🐛 Report bugs
- 💡 Suggest features
- 📢 Share with others

---

Made with [Node.js](https://nodejs.org) and [GitHub CLI](https://cli.github.com)
