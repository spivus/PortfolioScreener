import { useState, useEffect } from 'react';
import './App.css';
import FileUpload from './components/FileUpload';
import PortfolioTable from './components/PortfolioTable';
import { uploadCSV, getPortfolio, deletePortfolio } from './api';
import type { PortfolioPosition } from './types';

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleUpload() {
    if (!selectedFile) return;

    setLoading(true);
    setMessage(null);

    try {
      const result = await uploadCSV(selectedFile);
      setPositions(result);
      setSelectedFile(null);
      setMessage({ type: 'success', text: `${result.length} Position(en) erfolgreich importiert.` });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Ein unbekannter Fehler ist aufgetreten.',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);
    setMessage(null);

    try {
      await deletePortfolio();
      setPositions([]);
      setMessage({ type: 'success', text: 'Portfolio wurde geloescht.' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Ein unbekannter Fehler ist aufgetreten.',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadPortfolio() {
    try {
      const result = await getPortfolio();
      setPositions(result);
    } catch {
      // silently ignore on initial load
    }
  }

  // Load portfolio on first render
  useEffect(() => {
    handleLoadPortfolio();
  }, []);

  return (
    <div className="app">
      <h1>Portfolio Screener</h1>

      <FileUpload onFileSelected={setSelectedFile} selectedFile={selectedFile} />

      <div className="actions">
        <button
          className="btn btn--primary"
          disabled={!selectedFile || loading}
          onClick={handleUpload}
        >
          {loading ? 'Wird hochgeladen...' : 'Hochladen'}
        </button>
      </div>

      {message && (
        <div className={`message message--${message.type}`}>
          {message.text}
        </div>
      )}

      {positions.length > 0 && (
        <>
          <PortfolioTable positions={positions} />
          <div className="actions">
            <button
              className="btn btn--danger"
              onClick={handleDelete}
              disabled={loading}
            >
              Portfolio l&ouml;schen
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
