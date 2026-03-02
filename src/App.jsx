import { useState, useRef, useEffect } from 'react';
import { SuperDocEditor } from '@superdoc-dev/react';
import '@superdoc-dev/react/style.css';

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
  const superdocRef = useRef(null);
  const fileCheckInterval = useRef(null);
  const autoSaveTimeout = useRef(null); // For debounced auto-save

  // Check browser support
  const isFileSystemAccessSupported = 'showOpenFilePicker' in window;

  // Restore previously opened file on mount
  useEffect(() => {
    const restoreFile = async () => {
      if (!isFileSystemAccessSupported) {
        console.log('File System Access API not supported');
        setIsRestoring(false);
        return;
      }

      try {
        console.log('Attempting to restore file from IndexedDB...');
        const handle = await loadFileHandle();
        
        if (!handle) {
          console.log('No stored file handle found');
          setIsRestoring(false);
          return;
        }

        console.log('Found stored handle:', handle.name);

        // Verify we still have permission
        let permission = await handle.queryPermission({ mode: 'readwrite' });
        console.log('Initial permission status:', permission);
        
        // If permission is prompt, try to request it (works on page reload in Chrome)
        if (permission === 'prompt') {
          console.log('Permission prompt, requesting...');
          permission = await handle.requestPermission({ mode: 'readwrite' });
          console.log('Permission after request:', permission);
        }
        
        if (permission === 'granted') {
          // Permission granted, restore the file
          setFileHandle(handle);
          setFileName(handle.name);
          const file = await handle.getFile();
          setDocument(file);
          startFileWatcher(handle);
          console.log('✅ Successfully restored file:', handle.name);
        } else {
          // Permission not granted, clear the stored handle
          console.log('❌ Permission not granted, clearing stored handle');
          const db = await openDB();
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          transaction.objectStore(STORE_NAME).delete(HANDLE_KEY);
        }
      } catch (err) {
        console.error('Error restoring file:', err);
      } finally {
        setIsRestoring(false);
      }
    };

    restoreFile();
  }, []);

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

        // If file was modified externally, reload it
        if (file.lastModified > lastModified) {
          console.log('File modified externally, reloading...');
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
                  🔄 Restoring previous file...
                </span>
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
        <SuperDocEditor
          document={document}
          documentMode="suggesting"
          style={{ flex: 1 }}
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
            <div style={{ textAlign: 'center', maxWidth: '500px' }}>
              <h2 style={{ marginBottom: '10px' }}>Welcome to SuperDoc Editor</h2>
              <p style={{ fontSize: '16px', lineHeight: '1.5' }}>
                Click "Open DOCX File" to select a document from your computer.
              </p>
              <p style={{ fontSize: '14px', marginTop: '10px', color: '#666' }}>
                Your changes will be saved directly to the original file on your disk.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
