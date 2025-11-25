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
    const data = parseSchema(EXAMPLE_SCHEMA, 'example.rb');
    setSchemaData(data);
  }, []);

  // Reset focus when table selection is cleared
  useEffect(() => {
    if (!selectedTable) {
      setIsFocused(false);
    }
  }, [selectedTable]);

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
    // Security: Limit file size to 5MB to prevent browser crash/DoS
    const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE_BYTES) {
      alert(`File is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Please upload a file smaller than 5MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        try {
          const parsed = parseSchema(content, file.name);
          setSchemaData(parsed);
          setSelectedTable(null);
          setAnalysisStatus(AnalysisStatus.IDLE);
          setAnalysisReport(null);
          setIsFocused(false);
        } catch (error) {
          console.error("Failed to parse schema:", error);
          alert("Failed to parse the provided file. It might be an unsupported format or contain syntax errors.");
        }
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
                aria-label="Search tables or columns"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Layout Switcher */}
            <div className="flex items-center bg-gray-800 rounded-lg p-1 border border-gray-700 shrink-0" role="radiogroup" aria-label="Graph Layout">
              {(['FORCE', 'TREE', 'GRID', 'CIRCLE'] as LayoutType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setLayout(type)}
                  role="radio"
                  aria-checked={layout === type}
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
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  // Trigger file input click if keyboard focused
                  e.currentTarget.querySelector('input')?.click();
                }
              }}
              role="button"
              aria-label="Upload schema file"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">{isDragOver ? 'Drop file' : 'Import Schema'}</span>
              <input type="file" className="hidden" accept=".rb,.sql,.prisma,.py,.txt" onChange={handleFileChange} />
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
              <p className="text-sm max-w-md text-center text-gray-600">
                Upload a schema file to visualize.
                <br/>
                Supported: <span className="text-gray-400">Rails (.rb), SQL (.sql), Prisma (.prisma), Django (.py)</span>
              </p>
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