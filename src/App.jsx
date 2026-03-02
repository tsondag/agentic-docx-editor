import { useState, useRef, useEffect } from 'react';
import { SuperDocEditor } from '@superdoc-dev/react';
import '@superdoc-dev/react/style.css';
import './App.css'; // Custom styles for sticky toolbar

// IndexedDB helpers for persisting file handles
const DB_NAME = 'superdoc-editor';
const DB_VERSION = 1;
const STORE_NAME = 'fileHandles';
const HANDLE_KEY = 'lastOpenedFile';

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

const saveFileHandle = async (handle) => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(handle, HANDLE_KEY);
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (err) {
    console.error('Error saving file handle:', err);
  }
};

const loadFileHandle = async () => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(HANDLE_KEY);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error loading file handle:', err);
    return null;
  }
};

function App() {
  const [document, setDocument] = useState(null);
  const [fileHandle, setFileHandle] = useState(null);
  const [fileName, setFileName] = useState('');
  const [lastSaved, setLastSaved] = useState(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isRestoring, setIsRestoring] = useState(true); // Track if we're restoring from IndexedDB
  const [hasStoredFile, setHasStoredFile] = useState(false); // Track if we have a stored file to restore
  const [storedHandle, setStoredHandle] = useState(null); // Store the handle for one-click restoration
  const superdocRef = useRef(null);
  const fileCheckInterval = useRef(null);
  const autoSaveTimeout = useRef(null); // For debounced auto-save
  const lastSaveTime = useRef(null); // Track when we last saved to avoid reload loop

  // Check browser support
  const isFileSystemAccessSupported = 'showOpenFilePicker' in window;

  // Check if we have a stored file on mount (but don't auto-restore)
  useEffect(() => {
    const checkStoredFile = async () => {
      if (!isFileSystemAccessSupported) {
        console.log('File System Access API not supported');
        setIsRestoring(false);
        return;
      }

      try {
        console.log('Checking for stored file in IndexedDB...');
        const handle = await loadFileHandle();
        
        if (!handle) {
          console.log('No stored file handle found');
          setIsRestoring(false);
          return;
        }

        console.log('Found stored handle:', handle.name);
        
        // Check if we still have permission (without requesting)
        const permission = await handle.queryPermission({ mode: 'readwrite' });
        console.log('Permission status:', permission);
        
        // Store the handle for manual restoration
        setStoredHandle(handle);
        setHasStoredFile(true);
        
        // If permission is already granted (e.g., user selected "Allow on every visit"),
        // auto-restore the file
        if (permission === 'granted') {
          console.log('Permission already granted, auto-restoring...');
          await restoreStoredFile(handle);
        }
        
      } catch (err) {
        console.error('Error checking stored file:', err);
      } finally {
        setIsRestoring(false);
      }
    };

    checkStoredFile();
  }, []);

  // Restore a file from a stored handle (called after user click or if permission already granted)
  const restoreStoredFile = async (handle) => {
    try {
      setError(null);
      
      // Request permission (requires user gesture if not already granted)
      const permission = await handle.requestPermission({ mode: 'readwrite' });
      console.log('Permission after request:', permission);
      
      if (permission === 'granted') {
        setFileHandle(handle);
        setFileName(handle.name);
        const file = await handle.getFile();
        setDocument(file);
        startFileWatcher(handle);
        setHasStoredFile(false); // Hide the restore button
        console.log('✅ Successfully restored file:', handle.name);
      } else {
        setError('Permission denied. Please use "Open DOCX File" to select the file again.');
        // Clear the stored handle since permission was denied
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).delete(HANDLE_KEY);
        setHasStoredFile(false);
      }
    } catch (err) {
      console.error('Error restoring file:', err);
      setError(`Could not restore file: ${err.message}`);
    }
  };

  // Handle click on "Open Last Document" button
  const handleRestoreClick = () => {
    if (storedHandle) {
      restoreStoredFile(storedHandle);
    }
  };

  // Open file from local disk using File System Access API
  const handleOpenFile = async () => {
    try {
      setError(null);
      
      if (!isFileSystemAccessSupported) {
        setError('File System Access API not supported in this browser. Please use Chrome or Edge.');
        return;
      }

      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: 'Word Documents',
          accept: {
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
          }
        }],
        multiple: false
      });

      setFileHandle(handle);
      setFileName(handle.name);

      // Save handle to IndexedDB for persistence across refreshes
      console.log('Saving file handle to IndexedDB:', handle.name);
      await saveFileHandle(handle);
      console.log('✅ File handle saved to IndexedDB');

      // Read the file
      const file = await handle.getFile();
      setDocument(file);

      // Start watching for external changes (e.g., from MCP)
      startFileWatcher(handle);
      
      // Hide restore button if it was showing
      setHasStoredFile(false);

    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(`Error opening file: ${err.message}`);
        console.error('Error opening file:', err);
      }
    }
  };

  // Save changes back to disk
  const saveFile = async () => {
    if (!fileHandle || !superdocRef.current) return;

    try {
      setIsSaving(true);
      setError(null);

      // Export the document as a blob (without triggering download)
      // Using SuperDoc's export() method - see https://docs.superdoc.dev/core/superdoc/methods
      const blob = await superdocRef.current.export({ triggerDownload: false });
      
      if (!blob) {
        throw new Error('Failed to export document from editor');
      }

      // Write to the original file
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();

      // Track save time to prevent file watcher from reloading
      lastSaveTime.current = Date.now();

      setLastSaved(new Date());
      console.log('File saved successfully:', fileName);

    } catch (err) {
      setError(`Error saving file: ${err.message}`);
      console.error('Error saving file:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Watch for external file changes (from MCP or other editors)
  const startFileWatcher = (handle) => {
    // Clear existing interval
    if (fileCheckInterval.current) {
      clearInterval(fileCheckInterval.current);
    }

    let lastModified = null;

    fileCheckInterval.current = setInterval(async () => {
      try {
        const file = await handle.getFile();
        
        if (lastModified === null) {
          lastModified = file.lastModified;
          return;
        }

        // If file was modified externally, check if it wasn't us who saved it
        if (file.lastModified > lastModified) {
          const timeSinceOurSave = lastSaveTime.current ? Date.now() - lastSaveTime.current : Infinity;
          
          // If we saved within the last 3 seconds, ignore this change (it was our save)
          if (timeSinceOurSave < 3000) {
            console.log('File change detected but it was our own save, ignoring reload');
            lastModified = file.lastModified;
            return;
          }
          
          // Otherwise, it's an external change (from MCP or another editor)
          console.log('File modified externally (not by our save), reloading...');
          lastModified = file.lastModified;
          setDocument(file);
        }
      } catch (err) {
        console.error('Error checking file:', err);
      }
    }, 2000); // Check every 2 seconds
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (fileCheckInterval.current) {
        clearInterval(fileCheckInterval.current);
      }
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check if Cmd (Mac) or Ctrl (Windows/Linux) is pressed
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl+S: Save
      if (isCmdOrCtrl && e.key === 's') {
        e.preventDefault();
        if (fileHandle && superdocRef.current) {
          saveFile();
        }
        return;
      }

      // Cmd/Ctrl+O: Open file
      if (isCmdOrCtrl && e.key === 'o') {
        e.preventDefault();
        handleOpenFile();
        return;
      }

      // Note: Undo (Cmd/Ctrl+Z) and Redo (Cmd/Ctrl+Y or Cmd/Ctrl+Shift+Z) 
      // are handled natively by SuperDoc editor, so we don't need to override them
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fileHandle, superdocRef.current]);

  // Auto-save functionality - debounced (save 2 seconds after last change)
  const triggerAutoSave = () => {
    if (!autoSaveEnabled || !fileHandle || !superdocRef.current) return;

    // Clear existing timeout
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
    }

    // Set new timeout to save 2 seconds after last change
    autoSaveTimeout.current = setTimeout(() => {
      console.log('Auto-saving after content change...');
      saveFile();
    }, 2000); // 2 seconds debounce
  };

  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
    };
  }, []);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header - Sticky toolbar */}
      <div style={{ 
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        padding: '15px 20px', 
        borderBottom: '1px solid #ccc', 
        backgroundColor: '#f5f5f5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
            SuperDoc Editor
          </h1>
          
          {fileName && (
            <span style={{ fontSize: '14px', color: '#666' }}>
              📄 {fileName}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {!document ? (
            <>
              {isRestoring ? (
                <span style={{ fontSize: '14px', color: '#666' }}>
                  🔄 Loading...
                </span>
              ) : hasStoredFile && storedHandle ? (
                // Show "Open Last Document" button if we have a stored file
                <>
                  <button 
                    onClick={handleRestoreClick}
                    title={`Restore ${storedHandle.name}`}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    📂 Open Last Document
                  </button>
                  <span style={{ 
                    fontSize: '13px', 
                    color: '#666',
                    fontStyle: 'italic'
                  }}>
                    ({storedHandle.name})
                  </span>
                  <span style={{ fontSize: '13px', color: '#999', margin: '0 5px' }}>•</span>
                  <button 
                    onClick={handleOpenFile}
                    title={`Open Different File (${navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+O)`}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'transparent',
                      color: '#0066cc',
                      border: '1px solid #0066cc',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '400'
                    }}
                  >
                    Open Different File
                  </button>
                </>
              ) : (
                <button 
                  onClick={handleOpenFile}
                  title={`Open DOCX File (${navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+O)`}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#0066cc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  📂 Open DOCX File
                </button>
              )}
            </>
          ) : (
            <>
              <button 
                onClick={saveFile}
                disabled={isSaving}
                title={`Save (${navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+S)`}
                style={{
                  padding: '8px 16px',
                  backgroundColor: isSaving ? '#ccc' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  minWidth: '80px' // Prevent button size change
                }}
              >
                {isSaving ? '💾 Saving...' : '💾 Save'}
              </button>

              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={autoSaveEnabled}
                  onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                />
                Auto-save
              </label>

              {/* Always show last saved time (with fixed width to prevent layout shift) */}
              <span style={{ fontSize: '12px', color: '#666', minWidth: '140px' }}>
                {lastSaved ? (
                  <>Last saved: {lastSaved.toLocaleTimeString()}</>
                ) : (
                  <>Not saved yet</>
                )}
              </span>

              <button 
                onClick={handleOpenFile}
                title={`Open Another File (${navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+O)`}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Open Another
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div style={{ 
          position: 'sticky',
          top: '68px',
          zIndex: 999,
          padding: '10px 20px', 
          backgroundColor: '#f8d7da', 
          color: '#721c24',
          borderBottom: '1px solid #f5c6cb'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Info bar */}
      {document && (
        <div style={{ 
          position: 'sticky',
          top: error ? '114px' : '68px',
          zIndex: 999,
          padding: '8px 20px', 
          backgroundColor: '#d1ecf1', 
          color: '#0c5460',
          fontSize: '13px',
          borderBottom: '1px solid #bee5eb'
        }}>
          ℹ️ Changes are auto-saved to the original file. Edits from Cursor MCP will appear as tracked changes.
        </div>
      )}

      {/* Editor or placeholder */}
      {document ? (
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          <SuperDocEditor
            document={document}
            documentMode="suggesting"
            style={{ 
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
            onReady={(event) => {
              // onReady receives an event object with { superdoc: SuperDocInstance }
              superdocRef.current = event.superdoc;
              console.log('SuperDoc ready', event.superdoc);
            }}
            onEditorUpdate={(event) => {
              // Triggered when document content changes
              // Trigger debounced auto-save (2 seconds after last change)
              triggerAutoSave();
            }}
          />
        </div>
      ) : (
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center', 
          color: '#999',
          gap: '20px'
        }}>
          {!isFileSystemAccessSupported ? (
            <div style={{ textAlign: 'center', maxWidth: '500px' }}>
              <h2 style={{ color: '#dc3545', marginBottom: '10px' }}>⚠️ Browser Not Supported</h2>
              <p style={{ fontSize: '16px', lineHeight: '1.5' }}>
                The File System Access API is not supported in this browser.
              </p>
              <p style={{ fontSize: '14px', marginTop: '10px' }}>
                Please use <strong>Chrome</strong> or <strong>Edge</strong> to edit local DOCX files.
              </p>
            </div>
          ) : (
            <div style={{ textAlign: 'center', maxWidth: '600px' }}>
              <h2 style={{ marginBottom: '10px' }}>Welcome to SuperDoc Editor</h2>
              <p style={{ fontSize: '16px', lineHeight: '1.5', marginBottom: '15px' }}>
                Open a DOCX file to start editing. Your changes will be saved directly to the original file on your disk.
              </p>
              <div style={{ 
                fontSize: '14px', 
                color: '#666', 
                textAlign: 'left', 
                backgroundColor: '#f8f9fa',
                padding: '15px',
                borderRadius: '8px',
                marginTop: '20px'
              }}>
                <p style={{ margin: '0 0 10px 0', fontWeight: '600' }}>💡 How it works:</p>
                <ul style={{ margin: '0', paddingLeft: '20px' }}>
                  <li style={{ marginBottom: '8px' }}>Click "Open DOCX File" to select a document</li>
                  <li style={{ marginBottom: '8px' }}>Make your edits in the browser</li>
                  <li style={{ marginBottom: '8px' }}>Changes auto-save to your local file</li>
                  <li style={{ marginBottom: '8px' }}>When you return, click "Open Last Document" to resume editing</li>
                  <li style={{ marginBottom: '0' }}>Select "Allow on every visit" in Chrome for instant restoration</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
