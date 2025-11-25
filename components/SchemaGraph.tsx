
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { SchemaData, Table, GraphNode, GraphLink, LayoutType } from '../types';

interface SchemaGraphProps {
  data: SchemaData;
  onSelectTable: (table: Table) => void;
  selectedTable: Table | null;
  layout: LayoutType;
  searchTerm: string;
}

export const SchemaGraph: React.FC<SchemaGraphProps> = ({ data, onSelectTable, selectedTable, layout, searchTerm }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  
  // Tooltip State
  const [tooltip, setTooltip] = useState<{ show: boolean, x: number, y: number, content: string | null }>({
    show: false,
    x: 0,
    y: 0,
    content: null
  });

  // Use 'any' for D3 references to avoid type resolution crashes in restricted environments
  const simulationRef = useRef<any>(null);
  const zoomBehaviorRef = useRef<any>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const gRef = useRef<any>(null);

  // Handle Resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    window.addEventListener('resize', updateDimensions);
    updateDimensions();

    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Initialize Graph Data & SVG Structure
  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    // Create root group for Zoom
    const g = svg.append("g");
    gRef.current = g;

    // Define arrow marker
    svg.append("defs").selectAll("marker")
      .data(["end"])
      .enter().append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 28) // Offset to account for node radius/rect
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#6b7280");

    // Initialize Data
    // We create shallow copies to prevent d3 from mutating the original props unnecessarily deeply if strict mode runs twice
    nodesRef.current = data.tables.map(t => ({
      id: t.id,
      type: 'table',
      data: t,
      level: 0
    }));

    // Map relationships and include column data
    linksRef.current = data.relationships.map(r => ({
      source: r.source,
      target: r.target,
      column: r.column
    })).filter(l => 
      nodesRef.current.find(n => n.id === l.source) && nodesRef.current.find(n => n.id === l.target)
    );

    // Draw Elements
    const linkGroupWrapper = g.append("g").attr("class", "links");

    // We use a group for each link to hold both the visible line and the invisible hit area
    const linkGroups = linkGroupWrapper.selectAll("g.link-group")
      .data(linksRef.current)
      .enter().append("g")
      .attr("class", "link-group");

    // 1. Visible relationship lines
    linkGroups.append("line")
      .attr("class", "visible-link transition-colors duration-200")
      .attr("stroke", "#4b5563")
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrow)");

    // 2. Invisible wide lines for easier hover detection (drawn on top of visible line)
    linkGroups.append("line")
      .attr("class", "hit-area")
      .attr("stroke", "transparent")
      .attr("stroke-width", 15)
      .style("cursor", "pointer")
      .on("mouseenter", function(event: any, d: any) {
        setTooltip({
          show: true,
          x: event.pageX,
          y: event.pageY,
          content: d.column ? `FK: ${d.column}` : 'Relationship'
        });
        // Highlight the sibling visible-link
        d3.select(event.currentTarget.parentNode as Element).select(".visible-link")
          .attr("stroke", "#f59e0b")
          .attr("stroke-width", 2.5);
      })
      .on("mousemove", (event: any) => {
        setTooltip(prev => ({
          ...prev,
          x: event.pageX,
          y: event.pageY
        }));
      })
      .on("mouseleave", function(event: any) {
        setTooltip(prev => ({ ...prev, show: false }));
        d3.select(event.currentTarget.parentNode as Element).select(".visible-link")
          .attr("stroke", "#4b5563")
          .attr("stroke-width", 1.5);
      });

    // Nodes
    const nodeGroups = g.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodesRef.current)
      .enter().append("g")
      .attr("cursor", "pointer")
      .attr("class", "transition-opacity duration-300")
      .on("click", (event: any, d: any) => {
        onSelectTable(d.data);
        event.stopPropagation();
      });

    // Node Rect
    nodeGroups.append("rect")
      .attr("width", 120)
      .attr("height", 40)
      .attr("x", -60)
      .attr("y", -20)
      .attr("rx", 6)
      .attr("ry", 6)
      .attr("fill", "#1f2937")
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 2)
      .attr("class", "node-rect transition-all duration-200 hover:fill-gray-800");

    // Node Label
    nodeGroups.append("text")
      .attr("dy", 5)
      .attr("text-anchor", "middle")
      .text((d: any) => d.id)
      .attr("fill", "#e5e7eb")
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .style("pointer-events", "none");

    // Setup Zoom
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event: any) => {
        g.attr("transform", event.transform);
      });
    
    svg.call(zoom as any);
    zoomBehaviorRef.current = zoom;

    // Center initial view
    const initialTransform = d3.zoomIdentity
      .translate(dimensions.width / 2, dimensions.height / 2)
      .scale(0.8)
      .translate(-dimensions.width / 2, -dimensions.height / 2);
    svg.call(zoom.transform as any, initialTransform);

  }, [data, dimensions.width, dimensions.height]);

  // Handle Layout & Simulation
  useEffect(() => {
    if (!nodesRef.current.length) return;

    const width = dimensions.width;
    const height = dimensions.height;
    const nodes = nodesRef.current;
    const links = linksRef.current;

    if (simulationRef.current) simulationRef.current.stop();

    const simulation = d3.forceSimulation(nodes as any)
      .force("collide", d3.forceCollide(70));

    // Reset fixed positions
    nodes.forEach(d => {
      d.fx = null;
      d.fy = null;
    });

    // Configure Layouts
    if (layout === 'FORCE') {
      simulation
        .force("link", d3.forceLink(links).id((d: any) => d.id).distance(180))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(width / 2, height / 2));
      
      simulation.alpha(1).restart();

    } else if (layout === 'TREE') {
       // Determine hierarchy levels
      const idToNode = new Map<string, GraphNode>();
      nodes.forEach(n => {
        n.level = 0;
        idToNode.set(n.id, n);
      });

      for (let i = 0; i < nodes.length; i++) {
        let changed = false;
        links.forEach(l => {
          const s = idToNode.get((typeof l.source === 'object') ? (l.source as GraphNode).id : l.source as string);
          const t = idToNode.get((typeof l.target === 'object') ? (l.target as GraphNode).id : l.target as string);
          if (s && t && (s.level ?? 0) <= (t.level ?? 0)) {
               s.level = (t.level ?? 0) + 1;
               changed = true;
          }
        });
        if (!changed) break;
      }
      
      const maxLevel = Math.max(...nodes.map(n => n.level || 0));
      const levelHeight = 150;
      
      simulation
        .force("link", d3.forceLink(links).id((d: any) => d.id).distance(100).strength(0.5))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("collide", d3.forceCollide(80))
        .force("x", d3.forceX(width / 2).strength(0.05))
        .force("y", d3.forceY((d: any) => {
           const totalHeight = maxLevel * levelHeight;
           const startY = (height - totalHeight) / 2;
           return startY + ((d.level || 0) * levelHeight);
        }).strength(0.8));

      simulation.alpha(1).restart();

    } else if (layout === 'GRID') {
      const cols = Math.ceil(Math.sqrt(nodes.length));
      const spacingX = 180;
      const spacingY = 100;
      
      simulation
        .force("x", d3.forceX((d: any, i: number) => {
          const col = i % cols;
          return (col - cols / 2) * spacingX + width / 2;
        }).strength(1))
        .force("y", d3.forceY((d: any, i: number) => {
          const row = Math.floor(i / cols);
          return (row - cols / 2) * spacingY + height / 2;
        }).strength(1));
        
      simulation.alpha(1).restart();

    } else if (layout === 'CIRCLE') {
      const radius = Math.min(width, height) / 2 - 50;
      const angleStep = (2 * Math.PI) / nodes.length;

      simulation
        .force("x", d3.forceX((d: any, i: number) => width / 2 + radius * Math.cos(i * angleStep)).strength(1))
        .force("y", d3.forceY((d: any, i: number) => height / 2 + radius * Math.sin(i * angleStep)).strength(1));

      simulation.alpha(1).restart();
    }

    // Tick Handler
    simulation.on("tick", () => {
      if (!gRef.current) return;

      // Update the wrapper group for each link
      gRef.current.selectAll(".link-group")
        .selectAll("line") // Updates both visible-link and hit-area inside the group
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      gRef.current.selectAll(".nodes > g")
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Drag behavior
    const drag = d3.drag()
      .on("start", (event: any, d: any) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event: any, d: any) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event: any, d: any) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    if (gRef.current) {
      gRef.current.selectAll(".nodes > g").call(drag as any);
    }

    simulationRef.current = simulation;
    return () => { simulation.stop(); };
  }, [layout, dimensions.width, dimensions.height]);

  // Handle Search & Selection
  useEffect(() => {
    if (!gRef.current) return;

    const term = searchTerm.toLowerCase();
    const matchedNodeIds = new Set<string>();
    const highlightedNodeIds = new Set<string>();
    const highlightedLinkIndices = new Set<number>();

    // Identify matches
    nodesRef.current.forEach(n => {
      let isMatch = false;
      if (selectedTable && n.id === selectedTable.id) isMatch = true;
      if (term) {
        if (n.id.toLowerCase().includes(term) || n.data.columns.some(c => c.name.toLowerCase().includes(term))) {
          isMatch = true;
        }
      }
      if (isMatch) matchedNodeIds.add(n.id);
    });

    // Identify neighbors
    const isNodeId = (obj: any): string => (typeof obj === 'object' && obj.id) ? obj.id : obj as string;
    
    linksRef.current.forEach((link, index) => {
      const sourceId = isNodeId(link.source);
      const targetId = isNodeId(link.target);
      const sourceMatched = matchedNodeIds.has(sourceId);
      const targetMatched = matchedNodeIds.has(targetId);

      if (sourceMatched || targetMatched) {
        highlightedLinkIndices.add(index);
        highlightedNodeIds.add(sourceId);
        highlightedNodeIds.add(targetId);
      }
    });

    matchedNodeIds.forEach(id => highlightedNodeIds.add(id));
    const isDefaultState = !term && !selectedTable;

    // Apply Filters
    gRef.current.selectAll(".nodes > g")
      .style("opacity", (d: any) => isDefaultState || highlightedNodeIds.has(d.id) ? 1 : 0.1);

    // Filter link groups
    gRef.current.selectAll(".link-group")
      .style("opacity", (d: any, i: number) => isDefaultState || highlightedLinkIndices.has(i) ? 1 : 0.05)
      .select(".visible-link")
      .attr("stroke", "#4b5563"); // Reset color

    gRef.current.selectAll(".node-rect")
       .attr("stroke", (d: any) => {
         if (selectedTable && d.id === selectedTable.id) return "#8b5cf6";
         if (term && (d.id.toLowerCase().includes(term) || d.data.columns.some((c: any) => c.name.toLowerCase().includes(term)))) return "#f59e0b";
         return "#3b82f6";
       })
       .attr("stroke-width", (d: any) => {
        if (selectedTable && d.id === selectedTable.id) return 4;
        if (term && (d.id.toLowerCase().includes(term) || d.data.columns.some((c: any) => c.name.toLowerCase().includes(term)))) return 3;
        return 2;
       });

  }, [searchTerm, selectedTable]);

  // Zoom Controls
  const handleZoomIn = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 1.2);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 0.8);
    }
  };

  const handleResetZoom = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(750).call(
        zoomBehaviorRef.current.transform,
        d3.zoomIdentity.translate(dimensions.width / 2, dimensions.height / 2).scale(0.8).translate(-dimensions.width / 2, -dimensions.height / 2)
      );
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-gray-900 overflow-hidden relative shadow-inner">
      <svg ref={svgRef} className="w-full h-full block" />
      
      {/* Tooltip */}
      {tooltip.show && tooltip.content && (
        <div 
          className="fixed z-50 pointer-events-none bg-gray-900/90 text-white text-xs px-3 py-2 rounded border border-gray-600 shadow-xl backdrop-blur-sm transform -translate-x-1/2 -translate-y-full mt-[-10px]"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.content}
          <div className="absolute left-1/2 bottom-[-4px] transform -translate-x-1/2 w-2 h-2 bg-gray-900 border-r border-b border-gray-600 rotate-45"></div>
        </div>
      )}

      {/* Helper Legend */}
      <div className="absolute bottom-4 left-4 text-xs text-gray-500 pointer-events-none bg-black/50 p-2 rounded backdrop-blur-sm border border-gray-700">
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-gray-400">Controls</span>
          <span>Scroll to Zoom • Drag Background to Pan</span>
          <span>Drag Nodes to Move • Hover Links for FKs</span>
          <div className="flex gap-2 mt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500"></span> Selected</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Match</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Table</span>
          </div>
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
         <button 
           onClick={handleZoomIn}
           className="bg-gray-800 text-gray-300 p-2 rounded-md border border-gray-700 hover:bg-gray-700 hover:text-white hover:border-gray-500 transition-all shadow-lg"
           title="Zoom In"
         >
           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
           </svg>
         </button>
         <button 
           onClick={handleZoomOut}
           className="bg-gray-800 text-gray-300 p-2 rounded-md border border-gray-700 hover:bg-gray-700 hover:text-white hover:border-gray-500 transition-all shadow-lg"
           title="Zoom Out"
         >
           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
           </svg>
         </button>
         <button 
           onClick={handleResetZoom}
           className="bg-gray-800 text-gray-300 p-2 rounded-md border border-gray-700 hover:bg-gray-700 hover:text-white hover:border-gray-500 transition-all shadow-lg"
           title="Reset View"
         >
           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
           </svg>
         </button>
      </div>
    </div>
  );
};
