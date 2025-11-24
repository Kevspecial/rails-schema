import React from 'react';
import { Table, AnalysisStatus, AnalysisReport } from '../types';
import { Button } from './Button';

interface SidebarProps {
  tables: Table[];
  selectedTable: Table | null;
  onSelectTable: (table: Table) => void;
  analysisStatus: AnalysisStatus;
  analysisReport: AnalysisReport | null;
  onAnalyze: () => void;
  searchTerm: string;
  isFocused: boolean;
  onToggleFocus: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  tables,
  selectedTable, 
  onSelectTable,
  analysisStatus, 
  analysisReport, 
  onAnalyze,
  searchTerm,
  isFocused,
  onToggleFocus
}) => {
  // Filter tables for the list view
  const filteredTables = tables.filter(t => 
    t.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-96 bg-gray-900 border-l border-gray-800 h-full flex flex-col shadow-xl z-20 transition-all duration-300">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-md flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white">Explorer</h2>
        <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded-full border border-gray-700">
          {filteredTables.length} / {tables.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Table List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs uppercase tracking-wider text-gray-500 font-bold">
              Database Tables
            </h3>
          </div>
          <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden max-h-48 overflow-y-auto">
            {filteredTables.length > 0 ? (
              <ul className="divide-y divide-gray-700/50">
                {filteredTables.map(table => (
                  <li 
                    key={table.id}
                    className={`px-3 py-2 text-sm cursor-pointer transition-colors flex items-center justify-between group
                      ${selectedTable?.id === table.id 
                        ? 'bg-blue-900/20 text-blue-300 border-l-2 border-blue-500' 
                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200 border-l-2 border-transparent'
                      }`}
                    onClick={() => onSelectTable(table)}
                  >
                    <span className="font-mono truncate w-full">{table.id}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-center text-gray-500 text-xs italic">
                {searchTerm ? 'No matches found' : 'No tables available'}
              </div>
            )}
          </div>
        </div>

        {/* Selected Table Details */}
        {selectedTable ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300 border-t border-gray-800 pt-6">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <h3 className="text-lg font-bold text-blue-400 font-mono break-all">{selectedTable.id}</h3>
                <span className="text-xs text-gray-500">Selected Table</span>
              </div>
              
              <button
                onClick={onToggleFocus}
                className={`p-2 rounded-md transition-all border ${
                  isFocused 
                    ? 'bg-blue-600 border-blue-500 text-white' 
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
                title={isFocused ? "Show full graph" : "Isolate this table"}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isFocused ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  )}
                  {!isFocused && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />}
                </svg>
              </button>
            </div>
            
            <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-700/50 text-gray-400">
                    <tr>
                      <th className="px-3 py-2 font-medium w-1/3">Column</th>
                      <th className="px-3 py-2 font-medium w-1/4">Type</th>
                      <th className="px-3 py-2 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {selectedTable.columns.map((col, idx) => (
                      <tr key={idx} className="hover:bg-gray-700/30 transition-colors">
                        <td className="px-3 py-2 text-gray-200 font-mono font-medium truncate max-w-[100px]" title={col.name}>{col.name}</td>
                        <td className="px-3 py-2 text-yellow-500 font-mono text-xs whitespace-nowrap">{col.type}</td>
                        <td className="px-3 py-2 text-gray-400 font-mono text-xs break-all leading-tight">
                          {col.details || <span className="text-gray-600 opacity-50">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selectedTable.columns.length === 0 && (
                 <p className="p-4 text-gray-500 text-center italic">No columns defined</p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 border-t border-gray-800 mt-2">
            <p className="text-gray-500 text-sm">Select a table to view details.</p>
          </div>
        )}

        {/* AI Analysis Section */}
        <div className="pt-6 border-t border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-md font-semibold text-white flex items-center gap-2">
              <span className="bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">Gemini Intelligence</span>
            </h3>
          </div>

          {analysisStatus === AnalysisStatus.IDLE && (
            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
              <p className="text-sm text-gray-400 mb-4">
                Analyze your schema structure for missing indexes, potential N+1 query risks, and naming inconsistencies.
              </p>
              <Button onClick={onAnalyze} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 border-none">
                Start Analysis
              </Button>
            </div>
          )}

          {analysisStatus === AnalysisStatus.LOADING && (
            <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700 flex flex-col items-center text-center space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
              <p className="text-sm text-gray-300 animate-pulse">Gemini is studying your schema...</p>
            </div>
          )}

          {analysisStatus === AnalysisStatus.ERROR && (
            <div className="bg-red-900/20 p-4 rounded-lg border border-red-800">
              <p className="text-red-400 text-sm mb-3">Analysis failed. Please check your API key or try again.</p>
              <Button variant="secondary" onClick={onAnalyze} size="sm" className="w-full">Retry</Button>
            </div>
          )}

          {analysisStatus === AnalysisStatus.SUCCESS && analysisReport && (
            <div className="space-y-4 animate-in zoom-in-95 duration-300">
              <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                <h4 className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-2">Summary</h4>
                <p className="text-sm text-gray-300 leading-relaxed">{analysisReport.summary}</p>
              </div>

              {analysisReport.potentialIssues?.length > 0 && (
                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                  <h4 className="text-xs uppercase tracking-wider text-amber-500 font-bold mb-2">Potential Issues</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {analysisReport.potentialIssues.map((issue, i) => (
                      <li key={i} className="text-sm text-gray-300">{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {analysisReport.suggestions?.length > 0 && (
                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                  <h4 className="text-xs uppercase tracking-wider text-green-500 font-bold mb-2">Suggestions</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {analysisReport.suggestions.map((sug, i) => (
                      <li key={i} className="text-sm text-gray-300">{sug}</li>
                    ))}
                  </ul>
                </div>
              )}
               <Button variant="secondary" onClick={onAnalyze} className="w-full text-xs">Re-analyze</Button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};