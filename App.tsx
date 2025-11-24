import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SchemaData, Table, AnalysisStatus, AnalysisReport, LayoutType } from './types';
import { parseSchema } from './services/schemaParser';
import { analyzeSchema } from './services/geminiService';
import { SchemaGraph } from './components/SchemaGraph';
import { Sidebar } from './components/Sidebar';
import { EXAMPLE_SCHEMA } from './constants';

const App: React.FC = () => {
  const [schemaData, setSchemaData] = useState<SchemaData | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Graph Controls
  const [layout, setLayout] = useState<LayoutType>('FORCE');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Focus Mode State
  const [isFocused, setIsFocused] = useState(false);

  // Initialize with example data
  useEffect(() => {
    const data = parseSchema(EXAMPLE_SCHEMA);
    setSchemaData(data);
  }, []);

  // Reset focus when table selection is cleared
  useEffect(() => {
    if (!selectedTable) {
      setIsFocused(false);
    }
  }, [selectedTable]);

  // Storage Functions
  const saveSchemaToStorage = () => {
    if (schemaData?.rawContent) {
      try {
        localStorage.setItem('schemaviz_content', schemaData.rawContent);
        alert('Schema saved successfully!');
      } catch (e) {
        alert('Failed to save schema.');
      }
    }
  };

  const loadSchemaFromStorage = () => {
    const content = localStorage.getItem('schemaviz_content');
    if (content) {
      const parsed = parseSchema(content);
      setSchemaData(parsed);
      setSelectedTable(null);
      setAnalysisStatus(AnalysisStatus.IDLE);
      setAnalysisReport(null);
      setIsFocused(false);
    } else {
      alert('No saved schema found.');
    }
  };

  // Compute Active Data (Filtered if Focused)
  const activeData = useMemo(() => {
    if (!schemaData) return null;
    
    if (isFocused && selectedTable) {
      const tableId = selectedTable.id;
      // Find all connected tables
      const connectedTableIds = new Set<string>([tableId]);
      
      const relevantRelationships = schemaData.relationships.filter(r => {
        const isConnected = r.source === tableId || r.target === tableId;
        if (isConnected) {
          connectedTableIds.add(r.source);
          connectedTableIds.add(r.target);
        }
        return isConnected;
      });

      const relevantTables = schemaData.tables.filter(t => connectedTableIds.has(t.id));

      return {
        ...schemaData,
        tables: relevantTables,
        relationships: relevantRelationships
      };
    }

    return schemaData;
  }, [schemaData, isFocused, selectedTable]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        const parsed = parseSchema(content);
        setSchemaData(parsed);
        setSelectedTable(null);
        setAnalysisStatus(AnalysisStatus.IDLE);
        setAnalysisReport(null);
        setIsFocused(false);
      }
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleAnalyze = useCallback(async () => {
    if (!schemaData) return;

    setAnalysisStatus(AnalysisStatus.LOADING);
    try {
      const report = await analyzeSchema(schemaData.rawContent);
      setAnalysisReport(report);
      setAnalysisStatus(AnalysisStatus.SUCCESS);
    } catch (error) {
      console.error(error);
      setAnalysisStatus(AnalysisStatus.ERROR);
    }
  }, [schemaData]);

  return (
    <div className="flex h-screen w-screen bg-gray-950 text-gray-100 overflow-hidden font-sans">
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        
        {/* Navbar */}
        <header className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900/80 backdrop-blur z-10 gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-purple-900/20">
              SV
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent hidden md:block">
              SchemaViz AI
            </h1>
          </div>

          {/* Controls Area */}
          <div className="flex-1 flex items-center justify-center gap-4 max-w-2xl">
            {/* Search */}
            <div className="relative w-full max-w-md group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-500 group-focus-within:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-1.5 border border-gray-700 rounded-md leading-5 bg-gray-800 text-gray-300 placeholder-gray-500 focus:outline-none focus:bg-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-all"
                placeholder="Search tables or columns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Layout Switcher */}
            <div className="flex items-center bg-gray-800 rounded-lg p-1 border border-gray-700 shrink-0">
              {(['FORCE', 'TREE', 'GRID', 'CIRCLE'] as LayoutType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setLayout(type)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all uppercase ${
                    layout === type ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
             {/* Save/Load Controls */}
             <div className="flex items-center gap-1 mr-2">
              <button 
                onClick={saveSchemaToStorage}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors"
                title="Save current schema"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
              </button>
              <button 
                onClick={loadSchemaFromStorage}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors"
                title="Load saved schema"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </button>
            </div>

            <label 
              className={`
                flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-all border
                ${isDragOver 
                  ? 'bg-blue-900/30 border-blue-500 text-blue-200' 
                  : 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500'
                }
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">{isDragOver ? 'Drop file' : 'New Schema'}</span>
              <input type="file" className="hidden" accept=".rb,.txt" onChange={handleFileChange} />
            </label>
          </div>
        </header>

        {/* Visualization Area */}
        <div className="flex-1 relative bg-gray-950 overflow-hidden">
          {activeData ? (
             <SchemaGraph 
               data={activeData} 
               onSelectTable={setSelectedTable} 
               selectedTable={selectedTable}
               layout={layout}
               searchTerm={searchTerm}
             />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
              <div className="p-4 bg-gray-900 rounded-full border border-gray-800">
                <svg className="w-12 h-12 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
              </div>
              <p className="text-lg font-medium">No Schema Loaded</p>
              <p className="text-sm max-w-md text-center text-gray-600">Upload a schema.rb file or load a saved one to visualize.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      <Sidebar 
        tables={schemaData?.tables || []}
        selectedTable={selectedTable}
        onSelectTable={setSelectedTable}
        analysisStatus={analysisStatus}
        analysisReport={analysisReport}
        onAnalyze={handleAnalyze}
        searchTerm={searchTerm}
        isFocused={isFocused}
        onToggleFocus={() => setIsFocused(!isFocused)}
      />
    </div>
  );
};

export default App;