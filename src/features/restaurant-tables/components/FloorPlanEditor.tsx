'use client';

// =====================================================
// TIS TIS PLATFORM - Floor Plan Editor
// Visual drag & drop editor for restaurant table layout
// =====================================================

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  Move,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Layers,
  MousePointer2,
  Settings,
  Lock,
  Unlock,
  Users,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/shared/utils';
import type { RestaurantTable, TableStatus, TableZone } from '../types';
import { STATUS_CONFIG, ZONE_CONFIG } from '../types';

// ======================
// CONSTANTS
// ======================

const GRID_SIZE = 20;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const TABLE_SIZE = 60;

const STATUS_COLORS: Record<TableStatus, string> = {
  available: '#10b981',  // emerald
  occupied: '#3b82f6',   // blue
  reserved: '#f59e0b',   // amber
  unavailable: '#94a3b8', // slate
  maintenance: '#ef4444', // red
};

const ZONE_COLORS: Record<TableZone, string> = {
  main: '#64748b',
  terrace: '#f59e0b',
  private: '#8b5cf6',
  bar: '#f43f5e',
  vip: '#eab308',
  outdoor: '#22c55e',
  garden: '#10b981',
  rooftop: '#0ea5e9',
};

// ======================
// TYPES
// ======================

interface FloorPlanEditorProps {
  tables: RestaurantTable[];
  isLoading?: boolean;
  onUpdatePosition: (tableId: string, x: number, y: number) => Promise<void>;
  onSelectTable?: (table: RestaurantTable) => void;
  onAddTable?: () => void;
  onEditTable?: (table: RestaurantTable) => void;
  onChangeStatus?: (table: RestaurantTable, status: TableStatus) => void;
  onRefresh?: () => void;
}

interface Position {
  x: number;
  y: number;
}

interface DragState {
  tableId: string;
  startPos: Position;
  currentPos: Position;
  offset: Position;
}

// ======================
// HELPER FUNCTIONS
// ======================

function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

function getTableShape(table: RestaurantTable): 'circle' | 'square' | 'rectangle' {
  if (table.max_capacity <= 2) return 'circle';
  if (table.max_capacity <= 4) return 'square';
  return 'rectangle';
}

// ======================
// TABLE NODE COMPONENT
// ======================

function TableNode({
  table,
  isSelected,
  isDragging,
  dragPosition,
  zoom,
  showLabels,
  colorBy,
  onSelect,
  onDragStart,
}: {
  table: RestaurantTable;
  isSelected: boolean;
  isDragging: boolean;
  dragPosition?: Position;
  zoom: number;
  showLabels: boolean;
  colorBy: 'status' | 'zone';
  onSelect: () => void;
  onDragStart: (e: React.MouseEvent) => void;
}) {
  const shape = getTableShape(table);
  const color = colorBy === 'status' ? STATUS_COLORS[table.status] : ZONE_COLORS[table.zone];
  const statusConfig = STATUS_CONFIG[table.status];

  // Use drag position if available (during drag OR during async save), otherwise use saved position
  const x = dragPosition ? dragPosition.x : (table.position_x ?? 100);
  const y = dragPosition ? dragPosition.y : (table.position_y ?? 100);

  const width = shape === 'rectangle' ? TABLE_SIZE * 1.5 : TABLE_SIZE;
  const height = TABLE_SIZE;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onMouseDown={onDragStart}
      style={{
        cursor: isDragging ? 'grabbing' : 'grab',
        // Apply visual feedback during drag
        filter: isDragging ? 'drop-shadow(0 8px 16px rgba(0,0,0,0.2))' : undefined,
        opacity: isDragging ? 0.9 : 1,
      }}
      className="select-none"
    >
      {/* Drag transform wrapper for scale effect */}
      <g style={{
        transform: isDragging ? 'scale(1.05)' : 'scale(1)',
        transformOrigin: `${width / 2}px ${height / 2}px`,
        transition: isDragging ? 'none' : 'transform 0.15s ease-out',
      }}>
      {/* Table shape */}
      {shape === 'circle' ? (
        <circle
          cx={TABLE_SIZE / 2}
          cy={TABLE_SIZE / 2}
          r={TABLE_SIZE / 2 - 2}
          fill={color}
          fillOpacity={isDragging ? 0.35 : 0.2}
          stroke={color}
          strokeWidth={isDragging ? 3 : (isSelected ? 3 : 2)}
          className={isDragging ? '' : 'transition-all'}
        />
      ) : (
        <rect
          width={width - 4}
          height={height - 4}
          x={2}
          y={2}
          rx={shape === 'square' ? 8 : 12}
          fill={color}
          fillOpacity={isDragging ? 0.35 : 0.2}
          stroke={color}
          strokeWidth={isDragging ? 3 : (isSelected ? 3 : 2)}
          className={isDragging ? '' : 'transition-all'}
        />
      )}

      {/* Selection ring */}
      {isSelected && (
        <circle
          cx={width / 2}
          cy={height / 2}
          r={Math.max(width, height) / 2 + 8}
          fill="none"
          stroke="#6366f1"
          strokeWidth={2}
          strokeDasharray="4 4"
          className="animate-pulse"
        />
      )}

      {/* Table number */}
      <text
        x={width / 2}
        y={height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={14}
        fontWeight="bold"
        className="pointer-events-none"
      >
        {table.table_number}
      </text>

      {/* Capacity indicator */}
      <g transform={`translate(${width - 12}, -8)`}>
        <circle cx={8} cy={8} r={10} fill="white" stroke={color} strokeWidth={1.5} />
        <text
          x={8}
          y={8}
          textAnchor="middle"
          dominantBaseline="central"
          fill={color}
          fontSize={10}
          fontWeight="bold"
          className="pointer-events-none"
        >
          {table.max_capacity}
        </text>
      </g>

      {/* Labels */}
      {showLabels && (
        <g transform={`translate(${width / 2}, ${height + 12})`}>
          <text
            x={0}
            y={0}
            textAnchor="middle"
            fill="#64748b"
            fontSize={10}
            className="pointer-events-none"
          >
            {ZONE_CONFIG[table.zone].label}
          </text>
          <text
            x={0}
            y={14}
            textAnchor="middle"
            fill={statusConfig.color.replace('text-', '#').replace('-700', '')}
            fontSize={9}
            fontWeight="500"
            className="pointer-events-none"
          >
            {statusConfig.label}
          </text>
        </g>
      )}

      {/* Inactive overlay */}
      {!table.is_active && (
        <>
          <rect
            width={width}
            height={height}
            fill="white"
            fillOpacity={0.7}
            rx={shape === 'circle' ? TABLE_SIZE / 2 : 8}
          />
          <line
            x1={0}
            y1={0}
            x2={width}
            y2={height}
            stroke="#ef4444"
            strokeWidth={2}
            strokeOpacity={0.5}
          />
        </>
      )}
      </g>{/* Close drag transform wrapper */}
    </g>
  );
}

// ======================
// MINI MAP COMPONENT
// ======================

function MiniMap({
  tables,
  viewBox,
  containerSize,
  zoom,
}: {
  tables: RestaurantTable[];
  viewBox: Position;
  containerSize: { width: number; height: number };
  zoom: number;
}) {
  const MAP_SIZE = 150;
  const scale = 0.1;

  return (
    <div className="absolute bottom-4 right-4 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
      <svg width={MAP_SIZE} height={MAP_SIZE} className="bg-slate-50">
        {/* Tables */}
        {tables.map(table => {
          const x = (table.position_x ?? 100) * scale;
          const y = (table.position_y ?? 100) * scale;
          return (
            <circle
              key={table.id}
              cx={x}
              cy={y}
              r={3}
              fill={STATUS_COLORS[table.status]}
            />
          );
        })}

        {/* Viewport indicator */}
        <rect
          x={-viewBox.x * scale / zoom}
          y={-viewBox.y * scale / zoom}
          width={containerSize.width * scale / zoom}
          height={containerSize.height * scale / zoom}
          fill="none"
          stroke="#6366f1"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      </svg>
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function FloorPlanEditor({
  tables,
  isLoading = false,
  onUpdatePosition,
  onSelectTable,
  onAddTable,
  onEditTable,
  onChangeStatus,
  onRefresh,
}: FloorPlanEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Position>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Position>({ x: 0, y: 0 });

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [dragPosition, setDragPosition] = useState<Position | null>(null);
  // Track which table is being updated (to maintain position during async save)
  const [updatingTableId, setUpdatingTableId] = useState<string | null>(null);

  const [showGrid, setShowGrid] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [colorBy, setColorBy] = useState<'status' | 'zone'>('status');
  const [isLocked, setIsLocked] = useState(false);

  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [hasChanges, setHasChanges] = useState(false);

  // Get selected table
  const selectedTable = useMemo(
    () => tables.find(t => t.id === selectedTableId),
    [tables, selectedTableId]
  );

  // Container size observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Get SVG coordinates from mouse event
  const getSvgPoint = useCallback((e: React.MouseEvent): Position => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };

    const rect = svg.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    };
  }, [pan, zoom]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom(z => Math.min(z + 0.2, MAX_ZOOM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(z => Math.max(z - 0.2, MIN_ZOOM));
  }, []);

  const handleResetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Pan handlers
  const handlePanStart = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handlePanMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  }, [isPanning, panStart]);

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Table drag handlers
  const handleTableDragStart = useCallback((tableId: string, e: React.MouseEvent) => {
    if (isLocked) return;
    e.stopPropagation();

    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    const point = getSvgPoint(e);
    const tableX = table.position_x ?? 100;
    const tableY = table.position_y ?? 100;

    setDraggingTableId(tableId);
    setDragOffset({
      x: point.x - tableX,
      y: point.y - tableY,
    });
    // Initialize drag position with current table position
    setDragPosition({ x: tableX, y: tableY });
    setSelectedTableId(tableId);
  }, [tables, isLocked, getSvgPoint]);

  const handleTableDragMove = useCallback((e: React.MouseEvent) => {
    if (!draggingTableId) return;

    const point = getSvgPoint(e);
    const newX = snapToGrid(point.x - dragOffset.x, showGrid ? GRID_SIZE : 1);
    const newY = snapToGrid(point.y - dragOffset.y, showGrid ? GRID_SIZE : 1);

    // Update drag position in real-time for visual feedback
    setDragPosition({
      x: Math.max(0, newX),
      y: Math.max(0, newY),
    });
  }, [draggingTableId, dragOffset, showGrid, getSvgPoint]);

  const handleTableDragEnd = useCallback(async (e: React.MouseEvent) => {
    // FIX: Capture values and clear drag state IMMEDIATELY
    const tableId = draggingTableId;
    const finalPosition = dragPosition;

    // Clear dragging state (stops following cursor)
    setDraggingTableId(null);

    if (!tableId || !finalPosition) {
      setDragPosition(null);
      setUpdatingTableId(null);
      return;
    }

    const table = tables.find(t => t.id === tableId);
    if (!table) {
      setDragPosition(null);
      setUpdatingTableId(null);
      return;
    }

    const newX = finalPosition.x;
    const newY = finalPosition.y;

    // Only update if position changed
    if (newX !== table.position_x || newY !== table.position_y) {
      // Mark table as updating to maintain visual position during async save
      setUpdatingTableId(tableId);

      try {
        await onUpdatePosition(tableId, newX, newY);
        setHasChanges(true);
      } catch (error) {
        console.error('Error updating position:', error);
      }
    }

    // Clear states AFTER async update completes
    setDragPosition(null);
    setUpdatingTableId(null);
  }, [draggingTableId, dragPosition, tables, onUpdatePosition]);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.min(Math.max(z + delta, MIN_ZOOM), MAX_ZOOM));
  }, []);

  // Background click - deselect
  const handleBackgroundClick = useCallback(() => {
    setSelectedTableId(null);
    onSelectTable?.(null as any);
  }, [onSelectTable]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[500px] bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          <p className="text-slate-500">Cargando plano...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (tables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
        <div className="p-4 bg-slate-100 rounded-full mb-4">
          <Grid3X3 className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">
          Sin mesas configuradas
        </h3>
        <p className="text-slate-500 text-center mb-6 max-w-md">
          Agrega mesas para comenzar a diseñar el plano de tu restaurante
        </p>
        {onAddTable && (
          <button
            onClick={onAddTable}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Agregar Mesa
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
            <button
              onClick={handleZoomOut}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Alejar"
            >
              <ZoomOut className="w-4 h-4 text-slate-600" />
            </button>
            <span className="px-2 text-sm font-medium text-slate-700 min-w-[50px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Acercar"
            >
              <ZoomIn className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          <button
            onClick={handleResetView}
            className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            title="Restablecer vista"
          >
            <RotateCcw className="w-4 h-4 text-slate-600" />
          </button>

          <div className="h-6 w-px bg-slate-200 mx-1" />

          {/* View options */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={cn(
              'p-2 border rounded-xl transition-colors',
              showGrid
                ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
            title={showGrid ? 'Ocultar cuadrícula' : 'Mostrar cuadrícula'}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowLabels(!showLabels)}
            className={cn(
              'p-2 border rounded-xl transition-colors',
              showLabels
                ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
            title={showLabels ? 'Ocultar etiquetas' : 'Mostrar etiquetas'}
          >
            {showLabels ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setIsLocked(!isLocked)}
            className={cn(
              'p-2 border rounded-xl transition-colors',
              isLocked
                ? 'bg-red-50 border-red-200 text-red-600'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
            title={isLocked ? 'Desbloquear edición' : 'Bloquear edición'}
          >
            {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </button>

          <div className="h-6 w-px bg-slate-200 mx-1" />

          {/* Color mode */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
            <button
              onClick={() => setColorBy('status')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                colorBy === 'status'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              Por estado
            </button>
            <button
              onClick={() => setColorBy('zone')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                colorBy === 'zone'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              Por zona
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Actualizar
            </button>
          )}

          {onAddTable && (
            <button
              onClick={onAddTable}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Agregar Mesa
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap text-xs">
        {colorBy === 'status' ? (
          <>
            <span className="text-slate-500 font-medium">Estado:</span>
            {Object.entries(STATUS_COLORS).map(([status, color]) => (
              <div key={status} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-slate-600">{STATUS_CONFIG[status as TableStatus].label}</span>
              </div>
            ))}
          </>
        ) : (
          <>
            <span className="text-slate-500 font-medium">Zona:</span>
            {Object.entries(ZONE_COLORS).map(([zone, color]) => (
              <div key={zone} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-slate-600">{ZONE_CONFIG[zone as TableZone].label}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative bg-white rounded-xl border border-slate-200 overflow-hidden"
        style={{ height: '500px' }}
        onWheel={handleWheel}
      >
        <svg
          ref={svgRef}
          className={cn(
            'w-full h-full',
            isPanning ? 'cursor-grabbing' : 'cursor-default'
          )}
          onMouseDown={handlePanStart}
          onMouseMove={(e) => {
            handlePanMove(e);
            handleTableDragMove(e);
          }}
          onMouseUp={(e) => {
            handlePanEnd();
            handleTableDragEnd(e);
          }}
          onMouseLeave={() => {
            handlePanEnd();
            setDraggingTableId(null);
            setDragPosition(null);
            setUpdatingTableId(null);
          }}
          onClick={handleBackgroundClick}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Grid */}
            {showGrid && (
              <g>
                <defs>
                  <pattern
                    id="grid"
                    width={GRID_SIZE}
                    height={GRID_SIZE}
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`}
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth={0.5}
                    />
                  </pattern>
                </defs>
                <rect
                  x={-1000}
                  y={-1000}
                  width={3000}
                  height={3000}
                  fill="url(#grid)"
                />
              </g>
            )}

            {/* Tables */}
            {tables.map(table => {
              // Show drag position during drag OR during async update
              const isBeingDragged = draggingTableId === table.id;
              const isBeingUpdated = updatingTableId === table.id;
              const showDragPosition = (isBeingDragged || isBeingUpdated) && dragPosition;

              return (
                <TableNode
                  key={table.id}
                  table={table}
                  isSelected={selectedTableId === table.id}
                  isDragging={isBeingDragged}
                  dragPosition={showDragPosition ? dragPosition : undefined}
                  zoom={zoom}
                  showLabels={showLabels}
                  colorBy={colorBy}
                  onSelect={() => {
                    setSelectedTableId(table.id);
                    onSelectTable?.(table);
                  }}
                  onDragStart={(e) => handleTableDragStart(table.id, e)}
                />
              );
            })}
          </g>
        </svg>

        {/* Mini map */}
        <MiniMap
          tables={tables}
          viewBox={pan}
          containerSize={containerSize}
          zoom={zoom}
        />

        {/* Instructions */}
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-slate-500 border border-slate-200">
          <span className="font-medium">Tip:</span> Arrastra mesas para posicionarlas. Shift+Click para mover el plano.
        </div>
      </div>

      {/* Selected table info */}
      {selectedTable && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg"
                style={{
                  backgroundColor: STATUS_COLORS[selectedTable.status] + '20',
                  color: STATUS_COLORS[selectedTable.status],
                }}
              >
                {selectedTable.table_number}
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">
                  Mesa {selectedTable.table_number}
                  {selectedTable.name && ` - ${selectedTable.name}`}
                </h4>
                <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {selectedTable.min_capacity}-{selectedTable.max_capacity} personas
                  </span>
                  <span>{ZONE_CONFIG[selectedTable.zone].label}</span>
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                    STATUS_CONFIG[selectedTable.status].bgColor,
                    STATUS_CONFIG[selectedTable.status].color
                  )}>
                    {STATUS_CONFIG[selectedTable.status].label}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onChangeStatus && (
                <select
                  value={selectedTable.status}
                  onChange={(e) => onChangeStatus(selectedTable, e.target.value as TableStatus)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                    <option key={status} value={status}>{config.label}</option>
                  ))}
                </select>
              )}

              {onEditTable && (
                <button
                  onClick={() => onEditTable(selectedTable)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-200 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Editar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FloorPlanEditor;
