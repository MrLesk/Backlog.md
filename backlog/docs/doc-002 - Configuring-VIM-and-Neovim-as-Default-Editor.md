---
id: doc-002
title: Configuring VIM and Neovim as Default Editor
type: other
created_date: '2025-11-18 06:05'
---

# Configuring VIM and Neovim as Default Editor

This guide explains how to configure VIM or Neovim as your default editor for Backlog.md, including troubleshooting common issues.

## Quick Start

### Option 1: Environment Variable (Recommended)

Set the `EDITOR` environment variable in your shell configuration:

```bash
# For VIM
export EDITOR=vim

# For Neovim
export EDITOR=nvim

# For Neovim with wait flag (recommended for git commits)
export EDITOR="nvim -c 'set noshowmode'"
```

Add this line to your shell configuration file:
- **Bash**: `~/.bashrc` or `~/.bash_profile`
- **Zsh**: `~/.zshrc`
- **Fish**: `~/.config/fish/config.fish`

After adding, reload your shell:
```bash
source ~/.zshrc  # or ~/.bashrc
```

### Option 2: Backlog.md Configuration

Set the editor directly in Backlog.md's config:

```bash
backlog config set defaultEditor "nvim"
```

This stores the setting in `backlog/config.yml` and validates that the editor is available.

### Option 3: During Initial Setup

When running `backlog init`, the configuration wizard will prompt:
```
Default editor command (leave blank to use system default): nvim
```

## Editor Priority

Backlog.md resolves the editor in this order:

1. **`EDITOR` environment variable** (highest priority)
2. **`config.defaultEditor`** from `backlog/config.yml`
3. **Platform default** (nano on macOS/Linux, notepad on Windows)

This means if you have `EDITOR=nvim` set, it will override any `defaultEditor` in your config.

## Recommended VIM/Neovim Configurations

### Basic VIM
```bash
export EDITOR=vim
```

### Neovim with Clean UI
```bash
export EDITOR="nvim -c 'set noshowmode'"
```

### Neovim with Additional Options
```bash
# Disable showing mode in command line (cleaner)
export EDITOR="nvim -c 'set noshowmode' -c 'set noruler'"

# Or create an alias
alias bv='EDITOR=nvim backlog'
```

### VIM with Specific Settings
```bash
# Start in insert mode for quick editing
export EDITOR="vim +startinsert"
```

## Troubleshooting

### Issue: Partial Screen Rendering

**Symptoms**: You can see part of the VIM interface but it's corrupted or only shows the bottom portion.

**Cause**: Prior to task-318, Backlog.md used Bun's `$` shell template which didn't properly inherit stdio streams. This prevented interactive editors from having full terminal control.

**Solution**:
- Ensure you're using Backlog.md version with task-318 fix (or later)
- The fix uses `Bun.spawn()` with explicit `stdio: "inherit"` configuration
- If still experiencing issues, try setting `TERM` explicitly:
  ```bash
  export TERM=xterm-256color
  ```

### Issue: Editor Opens But Doesn't Respond to Input

**Symptoms**: VIM/Neovim opens but keypresses don't register or the editor appears frozen.

**Cause**: Terminal not in raw mode or stdin not properly inherited.

**Solution**:
- Update to latest version of Backlog.md (includes stdio inheritance fix)
- Check if another process is holding the terminal
- Try using the full path to your editor:
  ```bash
  backlog config set defaultEditor "$(which nvim)"
  ```

### Issue: Colors Not Working Properly

**Symptoms**: Syntax highlighting missing or colors look wrong.

**Solution**:
```bash
# Set proper TERM value
export TERM=xterm-256color

# For Neovim, ensure true color support
export EDITOR="nvim -c 'set termguicolors'"
```

### Issue: Editor Exits Immediately

**Symptoms**: VIM/Neovim opens and closes instantly without letting you edit.

**Cause**: Editor command includes flags that exit immediately.

**Solution**:
- Check your editor configuration doesn't include `-c 'q'` or similar
- Verify the file path is valid
- Try with a minimal configuration:
  ```bash
  EDITOR=vim backlog task edit 123
  ```

## Best Practices

### 1. Use Full Editor Paths for Reliability

Instead of just `vim`, use the full path:
```bash
export EDITOR="$(which nvim)"
```

### 2. Configure VIM for Markdown Editing

Add to your `~/.vimrc` or `~/.config/nvim/init.vim`:

```vim
" Enable syntax highlighting for markdown
autocmd FileType markdown setlocal spell
autocmd FileType markdown setlocal textwidth=80
autocmd FileType markdown setlocal wrap
autocmd FileType markdown setlocal linebreak

" Better markdown navigation
autocmd FileType markdown nnoremap <buffer> <leader>p :MarkdownPreview<CR>
```

### 3. Set Up Markdown Plugins

Consider installing these plugins for better Markdown editing:
- **vim-markdown**: Enhanced markdown syntax
- **markdown-preview.nvim**: Live preview in browser
- **bullets.vim**: Automatic bullet list formatting

### 4. Quick Exit Commands

Remember these VIM commands for Backlog.md editing:
- `:wq` - Save and quit
- `:x` - Save and quit (only if changes made)
- `:q!` - Quit without saving
- `ZZ` - Save and quit (normal mode)
- `ZQ` - Quit without saving (normal mode)

### 5. Configure for Git Integration

If using VIM/Neovim for git commit messages too:
```bash
# In ~/.gitconfig
[core]
    editor = nvim -c 'set noshowmode'
```

## Testing Your Configuration

Verify your editor setup works:

```bash
# Check which editor will be used
backlog config get defaultEditor

# Test by viewing a task (press 'E' in the viewer to edit)
backlog task 1

# Test by editing directly
backlog task edit 1
```

## Advanced: Context-Aware Editor Selection

You can use different editors for different contexts:

```bash
# In your shell config
export EDITOR=nvim

# Create aliases for specific tools
alias bt='backlog task'
alias bv='EDITOR=vim backlog'  # Use vim specifically for backlog
alias bn='EDITOR=nano backlog'  # Or nano for quick edits
```

## Integration with TUI (Terminal User Interface)

When using Backlog.md's interactive board view (`backlog board`):

1. Press `E` to edit the selected task
2. The TUI properly suspends and hands control to your editor
3. After saving and exiting, you return to the TUI automatically

The implementation properly handles:
- Suspending the blessed screen
- Disabling raw mode
- Restoring terminal state after editing
- Re-entering the alternate screen buffer

## Technical Details

### How Editor Launching Works

From `src/utils/editor.ts`:

```typescript
// Bun.spawn with explicit stdio inheritance
const subprocess = Bun.spawn([command, ...args], {
    stdin: "inherit",   // Direct terminal access for input
    stdout: "inherit",  // Direct terminal access for output
    stderr: "inherit",  // Direct terminal access for errors
});
```

This ensures interactive editors like VIM/Neovim have full terminal control.

### Terminal State Management

When editing from the TUI (board view), Backlog.md:
1. Pauses the blessed screen program
2. Exits the alternate screen buffer
3. Launches the editor with inherited stdio
4. Restores the screen state after editing
5. Re-renders the TUI

## Getting Help

If you encounter issues not covered here:

1. Check the GitHub issues: https://github.com/samvincent/backlog.md/issues
2. Create a new issue with:
   - Your editor command (`echo $EDITOR`)
   - Backlog.md version (`backlog --version`)
   - Terminal type (`echo $TERM`)
   - Operating system and version
   - Description of the problem

## Related Configuration

- See `backlog config list` for all available settings
- Check `backlog config get defaultEditor` to see current value
- Use `backlog help config` for configuration command help

## Version History

- **task-318** (2025-11-18): Fixed stdio inheritance for interactive editors
  - Changed from Bun `$` shell template to `Bun.spawn()`
  - Added explicit `stdio: "inherit"` configuration
  - Resolved VIM/Neovim rendering and input issues
