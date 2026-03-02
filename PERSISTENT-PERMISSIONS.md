# How to Enable Persistent File Access

## Problem
After refreshing the page, you have to re-select your DOCX file even though we save the file handle to IndexedDB.

## Solution: Enable Persistent Permissions in Chrome

Chrome 122+ supports **persistent permissions** that allow the browser to remember file access even after page refresh.

### Quick Steps

1. **Open your file** in the editor (first time)

2. **Look for the permission prompt** - Chrome will show:
   ```
   [Your Site] wants to:
   - View files in [folder name]
   
   [ ] Don't allow
   [ ] Allow on every visit  ← SELECT THIS!
   [ ] Allow this time only
   ```

3. **Select "Allow on every visit"**

4. **Refresh the page** - Your file should now automatically reopen! ✅

### If You Already Granted Permission

If you've already opened a file but didn't select "Allow on every visit":

1. **Click the lock icon** 🔒 in the address bar
2. **Click "Site settings"**
3. Find **"File system"** permissions
4. Change to **"Allow on every visit"** (if available)

OR

5. Clear site data and start fresh:
   - Open Chrome DevTools (F12)
   - Go to **Application** tab
   - Select **Storage** → **Clear site data**
   - Reload and open your file again
   - This time select "Allow on every visit"

### Checking if It Worked

Open the browser console (F12) and look for:
```
✅ Successfully restored file: [your-filename.docx]
File system permission state: granted
```

If you see this, persistence is working! 🎉

### Why It Might Not Work

**Common reasons persistence fails:**

1. **Incognito Mode** - IndexedDB is cleared when you close the window
2. **"Allow this time only"** - Selected temporary permission instead
3. **Closed all tabs** - Chrome may clear permissions when all tabs close
4. **Browser restart** - May need to click once to restore permission
5. **Chrome < 122** - Persistent permissions not supported

### Enable Flags (Chrome 120-121)

If you're on Chrome 120 or 121, enable these flags:

1. Go to `chrome://flags`
2. Enable: `#file-system-access-persistent-permission`
3. Enable: `#one-time-permission`
4. Restart Chrome

### How It Works Technically

1. You open a file → Browser shows permission dialog
2. You select "Allow on every visit" → Chrome stores persistent permission
3. We save `FileSystemFileHandle` to IndexedDB
4. On page load → We retrieve handle from IndexedDB
5. Check permission with `queryPermission()`
6. If `'granted'` or `'prompt'` → Restore file automatically
7. File reopens without re-selecting! ✅

### Debugging

Open console (F12) and check for these logs:

**Good (Working):**
```
Attempting to restore file from IndexedDB...
Found stored handle: your-file.docx
Initial permission status: granted
✅ Successfully restored file: your-file.docx
```

**Not Working:**
```
Attempting to restore file from IndexedDB...
Found stored handle: your-file.docx
Initial permission status: prompt
Permission after request: denied
❌ Permission not granted, clearing stored handle
```

If you see "denied", you need to enable persistent permissions as described above.

### Links

- [Chrome Blog: Persistent Permissions](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api)
- [File System Access API Docs](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
