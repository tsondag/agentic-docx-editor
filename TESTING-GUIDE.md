# Testing Guide: Save Queue Improvements

## Quick Test Procedure

### Setup
1. Open the SuperDoc editor in Chrome or Edge
2. Open a DOCX file
3. Open browser DevTools (F12) → Console tab

---

## Test 1: Rapid Manual Saves (Primary Test)
**Purpose**: Verify race condition is fixed

**Steps:**
1. Open a document
2. Make a small edit (type a letter)
3. Press Cmd/Ctrl+S **rapidly 10 times** (as fast as possible)
4. Watch the console

**Expected Results:**
✅ Console shows:
```
Saving file (9 more in queue)...
✅ File saved successfully: [filename]
Saving file (8 more in queue)...
✅ File saved successfully: [filename]
...
```
✅ No permission errors
✅ Button shows "💾 Saving... (X queued)"
✅ All saves complete successfully

**Before Fix:**
❌ Would show: "Error saving file: The requested file could not be read..."
❌ Multiple saves would fail

---

## Test 2: Auto-Save Debouncing
**Purpose**: Verify auto-save intelligently cancels pending saves

**Steps:**
1. Enable auto-save checkbox
2. Type "Hello" very slowly (1 letter per second)
3. Watch console

**Expected Results:**
✅ Console shows multiple:
```
⏸️ Cancelled pending auto-save (user still typing)
⏸️ Cancelled pending auto-save (user still typing)
...
```
✅ After 2 seconds of inactivity:
```
⏰ Auto-save triggered after 2s of inactivity
Saving file (0 more in queue)...
✅ File saved successfully
```
✅ Only ONE save happens (not 5 separate saves)

---

## Test 3: Mixed Manual + Auto-Save
**Purpose**: Verify manual and auto-save work together

**Steps:**
1. Enable auto-save
2. Type "Test"
3. Immediately press Cmd/Ctrl+S (before auto-save fires)
4. Type "123"
5. Wait 2 seconds

**Expected Results:**
✅ First manual save processes immediately
✅ Second auto-save queues and processes after first completes
✅ Console shows:
```
Saving file (0 more in queue)...
✅ File saved successfully
⏰ Auto-save triggered after 2s of inactivity
Saving file (0 more in queue)...
✅ File saved successfully
```
✅ No errors, saves happen sequentially

---

## Test 4: Queue Buildup and Processing
**Purpose**: Verify queue handles many rapid saves

**Steps:**
1. Type rapidly for 10 seconds (trigger many auto-saves)
2. Press Cmd/Ctrl+S 5 times quickly
3. Watch the button and console

**Expected Results:**
✅ Button shows: "💾 Saving... (5 queued)" or similar
✅ Queue size decreases as saves complete
✅ Console shows queue processing:
```
Saving file (4 more in queue)...
✅ File saved successfully
Saving file (3 more in queue)...
✅ File saved successfully
...
```
✅ Eventually: "💾 Save" (queue empty)

---

## Test 5: Error Recovery (Optional)
**Purpose**: Verify queue continues after error

**Steps:**
1. Save file normally (works)
2. Close the document in file explorer/Finder (simulate permission loss)
3. Make edit in browser
4. Try to save

**Expected Results:**
✅ Error shown in red bar at top
✅ Console shows: "❌ Error saving file: [error message]"
✅ App doesn't crash
✅ Queue continues (if multiple saves were queued)

---

## Console Logs Reference

### Good Logs (Success):
```
⏸️ Cancelled pending auto-save (user still typing)
⏰ Auto-save triggered after 2s of inactivity
Saving file (2 more in queue)...
✅ File saved successfully: document.docx
```

### Error Logs (Problem):
```
❌ Error saving file: [error message]
```

### Warning Logs (Information):
```
Cannot save: no file handle or editor reference
```

---

## Performance Checks

### Good Performance Indicators:
- ✅ UI remains responsive during saves
- ✅ Typing doesn't lag
- ✅ Queue processes quickly (< 1 second per save typically)
- ✅ Memory doesn't increase dramatically with many saves

### Red Flags:
- ❌ UI freezes during saves
- ❌ Queue size keeps growing without decreasing
- ❌ Browser becomes slow or unresponsive

---

## Browser Support

**Supported:**
- ✅ Chrome (recommended)
- ✅ Edge (recommended)

**Not Supported:**
- ❌ Firefox (File System Access API not available)
- ❌ Safari (File System Access API not available)

---

## Troubleshooting

### Problem: Still getting permission errors
**Solution:** 
- Clear browser cache
- Close and reopen the file
- Check file isn't open in another app (Word, etc.)

### Problem: Saves are very slow
**Solution:**
- Check file size (very large files take longer)
- Check disk speed (SSD vs HDD)
- Close other apps using disk

### Problem: Queue size keeps growing
**Solution:**
- Check console for errors
- Verify saves are completing (look for ✅)
- May need to adjust auto-save delay (increase from 2s to 5s)

---

## Success Criteria

**The fix is working correctly if:**
1. ✅ No permission errors when saving rapidly
2. ✅ All saves complete successfully
3. ✅ Queue processes in FIFO order
4. ✅ UI shows accurate queue status
5. ✅ Console logs show proper sequencing
6. ✅ User can edit continuously without waiting

---

## Report Issues

If you encounter problems, capture:
1. Console logs (screenshot or copy/paste)
2. Steps to reproduce
3. Browser version (Chrome/Edge)
4. Operating system
5. File size of document being edited
6. How many rapid saves triggered the issue
