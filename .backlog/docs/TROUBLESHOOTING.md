# Troubleshooting Guide

This guide covers common issues and solutions when using the Backlog.md web interface.

## Web Server Issues

### Port Already in Use

**Problem**: Error message "Port 3000 is already in use"

**Solutions**:
1. **Automatic fallback**: The server automatically tries ports 3001, 3002, etc.
2. **Manual port**: Use `--port` flag to specify a different port:
   ```bash
   backlog serve --port 8080
   ```
3. **Find and stop conflicting process**:
   ```bash
   # macOS/Linux
   lsof -ti:3000 | xargs kill -9
   
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```

### Browser Doesn't Open Automatically

**Problem**: Server starts but browser doesn't open

**Solutions**:
1. **Manual navigation**: Open your browser and go to the URL shown in the terminal
2. **Check browser settings**: Ensure your system has a default browser set
3. **Disable auto-open**: Use `--no-open` flag and open manually:
   ```bash
   backlog serve --no-open
   ```

### Server Won't Start

**Problem**: Server fails to start with various errors

**Common causes and solutions**:

1. **Permission denied (ports < 1024)**:
   ```bash
   # Use a higher port number
   backlog serve --port 3000
   ```

2. **Project not initialized**:
   ```bash
   # Initialize backlog project first
   backlog init
   ```

3. **File permission issues**:
   ```bash
   # Check directory permissions
   ls -la .backlog/
   chmod 755 .backlog/
   ```

## Web Interface Loading Issues

### Blank Page or Loading Forever

**Problem**: Web interface shows blank page or loading spinner

**Diagnostic steps**:
1. **Check browser console**: Open Developer Tools (F12) and look for errors
2. **Verify server status**: Ensure the server is running and accessible
3. **Test API directly**: Visit `http://localhost:3000/health` to verify the API

**Solutions**:
1. **Refresh the page**: Sometimes a simple refresh resolves loading issues
2. **Clear browser cache**: Hard refresh with Ctrl+F5 (Cmd+Shift+R on Mac)
3. **Try different browser**: Test with Chrome, Firefox, or Safari
4. **Rebuild assets**: 
   ```bash
   bun run build
   ```

### Assets Not Loading (404 Errors)

**Problem**: CSS/JS files return 404 errors

**Cause**: Web assets not properly embedded in the executable

**Solutions**:
1. **Rebuild with assets**:
   ```bash
   cd src/web && bun run build
   bun scripts/generate-embedded-assets.ts
   bun run build:cli
   ```

2. **Verify embedded assets**:
   ```bash
   # Check if embedded assets module exists
   ls -la src/server/embedded-assets.ts
   ```

3. **Development mode**: Use development mode to bypass asset embedding:
   ```bash
   NODE_ENV=development bun src/cli.ts serve
   ```

### Drag and Drop Not Working

**Problem**: Cannot drag tasks between columns

**Common causes**:
1. **Touch device**: Ensure you're using a mouse or supported touch gestures
2. **Browser compatibility**: Try a different browser
3. **JavaScript errors**: Check browser console for errors

**Solutions**:
1. **Use task detail form**: Click on a task to edit its status manually
2. **Keyboard navigation**: Use Tab and Enter keys to navigate
3. **Refresh the page**: Sometimes interaction state gets corrupted

## API Connection Issues

### Network Errors

**Problem**: API requests fail with network errors

**Diagnostic steps**:
1. **Test server directly**:
   ```bash
   curl http://localhost:3000/health
   ```

2. **Check server logs**: Look at the terminal where you started the server

3. **Verify port**: Ensure you're connecting to the correct port

**Solutions**:
1. **CORS issues (development)**:
   - Ensure both dev server and CLI server are running
   - Check that API calls use the correct base URL

2. **Firewall blocking**: 
   - Check firewall settings
   - Try binding to different address:
     ```bash
     backlog serve --host 0.0.0.0
     ```

### Slow API Responses

**Problem**: Web interface feels sluggish

**Diagnostic steps**:
1. **Check system resources**: High CPU/memory usage
2. **Large repository**: Very large `.backlog/` directory
3. **Network latency**: If using remote host

**Solutions**:
1. **Optimize repository**:
   ```bash
   # Archive old tasks
   backlog task archive <old-task-ids>
   
   # Clean up drafts
   backlog draft archive <draft-ids>
   ```

2. **Close other applications**: Free up system resources

3. **Local development**: Use local server instead of remote

## Development Issues

### Build Failures

**Problem**: `bun run build` fails with errors

**Common solutions**:
1. **Clean dependencies**:
   ```bash
   rm -rf node_modules src/web/node_modules
   bun install
   cd src/web && bun install
   ```

2. **Check Node version**: Ensure compatible Node.js version (18+)

3. **Clear build cache**:
   ```bash
   cd src/web
   rm -rf dist/ .vite/
   bun run build
   ```

### TypeScript Errors

**Problem**: TypeScript compilation errors

**Solutions**:
1. **Update types**:
   ```bash
   bun install @types/node @types/react @types/react-dom
   ```

2. **Check configuration**:
   ```bash
   # Verify tsconfig.json is valid
   cd src/web
   bunx tsc --noEmit
   ```

3. **Restart language server**: In VS Code, reload the window

### Hot Reload Not Working (Development)

**Problem**: Changes don't appear automatically in development

**Solutions**:
1. **Check dev server**: Ensure Vite dev server is running on port 5173
2. **Browser cache**: Hard refresh with Ctrl+F5
3. **File watchers**: Increase file watcher limits on Linux:
   ```bash
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

## Performance Issues

### High Memory Usage

**Problem**: Server uses excessive memory

**Causes and solutions**:
1. **Large embedded assets**: Optimize build output
2. **Memory leaks**: Restart server periodically
3. **Large task files**: Break down very large task descriptions

### Slow Task Loading

**Problem**: Tasks take long time to load

**Solutions**:
1. **Reduce task count**: Archive completed tasks
2. **Optimize task files**: Keep descriptions concise
3. **Database optimization**: Consider using database in future versions

## Browser-Specific Issues

### Safari Issues

**Common problems**:
- **WebKit prefix requirements**: Some CSS features need prefixes
- **Module loading**: ES6 modules may have compatibility issues

**Solutions**:
- Update to latest Safari version
- Use Chrome/Firefox for development

### Mobile Browser Issues

**Common problems**:
- **Touch scrolling**: Momentum scrolling may interfere with drag
- **Viewport scaling**: Interface may appear too small/large

**Solutions**:
- Use responsive design breakpoints
- Test on actual devices, not just browser dev tools

## Getting Help

### Diagnostic Information

When reporting issues, include:

1. **System information**:
   ```bash
   backlog --version
   bun --version
   uname -a  # Linux/Mac
   ```

2. **Browser information**: Version and type

3. **Error messages**: Full error text from console/terminal

4. **Steps to reproduce**: Exact steps that trigger the issue

### Log Files

Enable debug logging:
```bash
NODE_ENV=development backlog serve
```

Check browser console (F12) for client-side errors.

### Community Support

- GitHub Issues: Report bugs and feature requests
- Documentation: Check latest docs for updates
- Stack Overflow: Tag questions with `backlog-md`

### Common Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `NODE_ENV` | Enable development mode | `development` |
| `DEBUG` | Enable debug logging | `backlog:*` |
| `BACKLOG_PORT` | Default port override | `8080` |

## Preventive Measures

### Regular Maintenance

1. **Update dependencies**:
   ```bash
   bun update
   cd src/web && bun update
   ```

2. **Clean builds**: Occasionally clean and rebuild:
   ```bash
   bun run build
   ```

3. **Archive old tasks**: Keep active task count manageable

### Best Practices

1. **Use stable network**: Avoid flaky WiFi for development
2. **Keep descriptions reasonable**: Very large task descriptions slow performance
3. **Regular backups**: Git repository serves as backup
4. **Monitor resources**: Watch CPU/memory usage during development

This troubleshooting guide covers the most common issues. For persistent problems, check the GitHub repository for known issues and solutions.