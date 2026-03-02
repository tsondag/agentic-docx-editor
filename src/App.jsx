import { useState, useRef, useEffect } from 'react';
import { SuperDocEditor } from '@superdoc-dev/react';
import '@superdoc-dev/react/style.css';

function App() {
  const [document, setDocument] = useState(null);
  const [fileHandle, setFileHandle] = useState(null);
  const [fileName, setFileName] = useState('');
  const [lastSaved, setLastSaved] = useState(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const superdocRef = useRef(null);
  const fileCheckInterval = useRef(null);

  // Check browser support
  const isFileSystemAccessSupported = 'showOpenFilePicker' in window;

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

  // Auto-save functionality
  useEffect(() => {
    if (!autoSaveEnabled || !fileHandle || !superdocRef.current) return;

    // Save every 30 seconds if there are changes
    const autoSaveInterval = setInterval(() => {
      saveFile();
    }, 30000);

    return () => clearInterval(autoSaveInterval);
  }, [autoSaveEnabled, fileHandle]);

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
                  fontWeight: '500'
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

              {lastSaved && (
                <span style={{ fontSize: '12px', color: '#666' }}>
                  Last saved: {lastSaved.toLocaleTimeString()}
                </span>
              )}

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
          borderBottom: '1px solid #bee5eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <span>
            ℹ️ Changes are auto-saved to the original file. Edits from Cursor MCP will appear as tracked changes.
          </span>
          <span style={{ fontSize: '12px', color: '#0c5460', opacity: 0.8 }}>
            ⌨️ Shortcuts: {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Z (Undo) • {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Y (Redo) • {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+S (Save) • {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+O (Open)
          </span>
        </div>
      )}

      {/* Editor or placeholder */}
      {document ? (
        <SuperDocEditor
          document={document}
          documentMode="suggesting"
          style={{ flex: 1 }}
          onReady={(superdoc) => {
            superdocRef.current = superdoc;
            console.log('SuperDoc ready');
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
