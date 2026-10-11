/* eslint-disable */
'use client';

import { useState, useEffect } from 'react';

export default function StatusPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'slow'>('loading');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setStatus('loading');
    setError(null);
    setData(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      setStatus('slow');
    }, 4000);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
      const response = await fetch(`${baseUrl}/api/v1/health`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setData(result);
      setStatus('success');
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name !== 'AbortError') {
        setError(err.message || 'An unknown error occurred');
        setStatus('error');
      }
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-4 text-center">Diagnostic: Backend Status</h1>
        
        <div className="mb-6 h-32 flex items-center justify-center border rounded bg-gray-50">
          {status === 'loading' && <p className="text-gray-500 animate-pulse">Checking backend health...</p>}
          
          {status === 'slow' && (
            <p className="text-yellow-600 text-center px-4">
              Waking up the server, this can take about a minute...
            </p>
          )}

          {status === 'success' && data && (
            <div className="text-green-700 w-full px-4">
              <p className="font-semibold mb-2 text-center">Backend is online! ✅</p>
              <pre className="text-xs bg-green-50 p-2 rounded overflow-x-auto">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          )}

          {status === 'error' && (
            <div className="text-red-600 text-center px-4">
              <p className="font-semibold">Backend is unreachable ❌</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}
        </div>

        <button 
          onClick={fetchHealth}
          disabled={status === 'loading' || status === 'slow'}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded transition-colors"
        >
          {status === 'loading' || status === 'slow' ? 'Checking...' : 'Retry Connection'}
        </button>
      </div>
    </div>
  );
}
