# DOCX Viewer - SuperDoc Integration

A browser-based DOCX editor powered by SuperDoc with **direct local file editing** using the File System Access API.

## ✨ Key Features

- 📝 Full DOCX rendering in the browser
- 💾 **Direct file editing** - changes save to original file on disk
- ✅ Tracked changes with accept/decline UI
- 🤖 AI integration via Cursor MCP server
- 🔄 Auto-save and auto-reload
- 🔒 100% local processing (documents never leave your machine)

## 🚀 Quick Start

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Open in browser:**
   Visit http://localhost:5173/

3. **Open a DOCX file:**
   Click "Open DOCX File" button and select your document

4. **Edit and save:**
   - Changes auto-save every 30 seconds
   - Or click "Save" button to save immediately
   - File updates are written directly to your original file

## 🎯 The Workflow

### Direct Local File Editing

1. Click "Open DOCX File"
2. Browser shows native file picker
3. Select your DOCX file (e.g., the Cureator contract)
4. File opens in editor
5. Make changes → auto-saved to disk
6. Original file is updated directly

### With Cursor AI Integration

1. Open file in browser editor (as above)
2. In Cursor chat, ask for changes:
   ```
   Use SuperDoc MCP to open "/Users/thijssondag/Documents/Grants/.../contract.docx"
   
   Please suggest changing "Party A" to "WeGuide Health" in section 2
   ```
3. Cursor makes the change via MCP (as tracked change)
4. Browser automatically detects file change and reloads
5. You see the tracked change with accept/decline buttons
6. Click "Accept" or "Decline"
7. Changes save back to disk

## 🔑 Browser Requirements

**Required:** Chrome or Edge (Chromium-based browsers)

**Why?** This app uses the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) for direct local file editing. This API is currently only supported in Chromium browsers.

**Not supported:**
- Firefox (API not implemented yet)
- Safari (API not implemented yet)
- Mobile browsers

## ⚙️ Features

### Auto-Save
- Enabled by default (toggle with checkbox)
- Saves every 30 seconds
- Or click "Save" button manually

### Auto-Reload
- Detects when file is modified externally
- Automatically reloads the document
- Perfect for seeing Cursor MCP changes in real-time

### Tracked Changes Mode
- All edits shown as tracked changes
- Accept/decline buttons for each change
- Perfect for contract review workflow

## 📁 Document Modes

The editor runs in **suggesting mode** by default, which shows all edits as tracked changes that can be accepted or declined.

To change the mode, edit `src/App.jsx` and modify the `documentMode` prop:

- `"suggesting"` - Tracked changes mode (default, perfect for review)
- `"editing"` - Direct editing mode (changes applied immediately)
- `"viewing"` - Read-only mode

## 🛠️ Project Structure

```
docx-viewer/
├── src/
│   ├── App.jsx       # Main app with File System Access API
│   └── main.jsx      # React entry point
├── index.html        # HTML template
├── package.json      # Dependencies
└── vite.config.js    # Vite configuration
```

## 📦 Dependencies

- `@superdoc-dev/react` - SuperDoc React editor component
- `superdoc` - Core SuperDoc library
- `react` & `react-dom` - React framework
- `vite` - Build tool and dev server

## 🔧 Troubleshooting

### "File System Access API not supported"

**Solution:** Use Chrome or Edge browser. Firefox and Safari don't support this API yet.

### File not saving

1. Check browser console for errors
2. Verify you have write permissions to the file
3. Make sure the file isn't open in another program with exclusive lock

### Changes from MCP not appearing

1. Wait 2 seconds for auto-reload to detect changes
2. Or manually click "Open Another" and reopen the file
3. Check that Cursor MCP actually saved the file

### Port already in use

If port 5173 is taken, Vite will automatically try the next available port (5174, 5175, etc.)

## 📚 Documentation

For detailed workflows and examples, see:
- `.cursor/skills/superdoc/SKILL.md` - Complete SuperDoc integration guide
- https://docs.superdoc.dev - Official SuperDoc documentation
- https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API - File System Access API docs

## 🔒 Security & Privacy

- All document processing happens locally on your machine
- No data is sent to external servers
- Documents never leave your computer
- Browser handles file permissions securely
- You control which files the app can access

## 💡 Tips

1. **Keep the browser tab open** while working with Cursor - you'll see changes appear automatically
2. **Use Chrome/Edge** for best experience
3. **Enable auto-save** to avoid losing changes
4. **Grant file permissions** when browser asks - needed for reading/writing
5. **Use "suggesting" mode** for contract review (tracked changes)
