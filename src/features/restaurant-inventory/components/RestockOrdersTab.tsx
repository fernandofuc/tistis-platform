'use client';

// =====================================================
// TIS TIS PLATFORM - Restock Orders Tab
// Full management for restock orders with status workflow
// Integrated with low stock alerts and WhatsApp notifications
// Professional Apple/TIS TIS Style Design
// =====================================================

import { useState, useCallback, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Package,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Eye,
  CheckCircle2,
  Clock,
  Send,
  Truck,
  PackageCheck,
  XCircle,
  MessageCircle,
  FileText,
  Calendar,
  Building2,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import type {
  RestockOrder,
  RestockOrderStatus,
  LowStockAlert,
  InventorySupplier,
} from '../types';
import { RESTOCK_ORDER_STATUS_CONFIG } from '../types';
import {
  getRestockOrders,
  authorizeOrder,
  placeOrder,
  cancelOrder,
  receiveOrder,
  generateWhatsAppMessage,
  getWhatsAppUrl,
  getLowStockAlerts,
  scanInventoryForAlerts,
  dismissAlert,
} from '../services/restock.service';

// ======================
// TYPES
// ======================

interface RestockOrdersTabProps {
  branchId: string;
  suppliers: InventorySupplier[];
  onCreateOrder: (alertIds?: string[]) => void;
  onViewOrder: (order: RestockOrder) => void;
}

// ======================
// STATUS ICON COMPONENT
// ======================

function StatusIcon({ status }: { status: RestockOrderStatus }) {
  const config = RESTOCK_ORDER_STATUS_CONFIG[status];
  const iconClass = cn('w-4 h-4', config.color);

  switch (config.icon) {
    case 'FileEdit':
      return <FileText className={iconClass} />;
    case 'Clock':
      return <Clock className={iconClass} />;
    case 'CheckCircle2':
      return <CheckCircle2 className={iconClass} />;
    case 'Send':
      return <Send className={iconClass} />;
    case 'Truck':
      return <Truck className={iconClass} />;
    case 'PackageCheck':
      return <PackageCheck className={iconClass} />;
    case 'XCircle':
      return <XCircle className={iconClass} />;
    default:
      return <Package className={iconClass} />;
  }
}

// ======================
// STATS BAR
// ======================

interface StatsBarProps {
  orders: RestockOrder[];
  alerts: LowStockAlert[];
  isScanning: boolean;
  onScan: () => void;
}

function StatsBar({ orders, alerts, isScanning, onScan }: StatsBarProps) {
  const pending = orders.filter(o => ['draft', 'pending'].includes(o.status)).length;
  const inProgress = orders.filter(o => ['authorized', 'placed', 'partial'].includes(o.status)).length;
  const completed = orders.filter(o => o.status === 'received').length;
  const openAlerts = alerts.filter(a => ['open', 'acknowledged'].includes(a.status)).length;
  const criticalAlerts = alerts.filter(a => a.alert_type === 'critical' && a.status === 'open').length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <div className="bg-white rounded-xl p-4 border border-slate-200 hover:border-slate-300 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{pending}</p>
            <p className="text-xs text-slate-500">Pendientes</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 border border-slate-200 hover:border-slate-300 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
            <Truck className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{inProgress}</p>
            <p className="text-xs text-slate-500">En tránsito</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 border border-slate-200 hover:border-slate-300 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-50 to-green-100 flex items-center justify-center">
            <PackageCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{completed}</p>
            <p className="text-xs text-slate-500">Recibidas</p>
          </div>
        </div>
      </div>

      <button
        onClick={onScan}
        disabled={isScanning}
        className={cn(
          'bg-white rounded-xl p-4 border border-slate-200 transition-all text-left',
          openAlerts > 0
            ? 'border-amber-200 hover:border-amber-300 hover:shadow-lg hover:shadow-amber-100'
            : 'hover:border-slate-300'
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            criticalAlerts > 0
              ? 'bg-gradient-to-br from-red-50 to-red-100'
              : openAlerts > 0
                ? 'bg-gradient-to-br from-amber-50 to-amber-100'
                : 'bg-gradient-to-br from-slate-50 to-slate-100'
          )}>
            {isScanning ? (
              <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
            ) : (
              <AlertTriangle className={cn(
                'w-5 h-5',
                criticalAlerts > 0 ? 'text-red-600' : openAlerts > 0 ? 'text-amber-600' : 'text-slate-400'
              )} />
            )}
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{openAlerts}</p>
            <p className="text-xs text-slate-500">
              {criticalAlerts > 0 ? `${criticalAlerts} críticas` : 'Alertas'}
            </p>
          </div>
        </div>
      </button>

      <button
        onClick={onScan}
        disabled={isScanning}
        className="bg-gradient-to-br from-tis-coral to-orange-500 rounded-xl p-4 text-white hover:shadow-lg hover:shadow-tis-coral/30 transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
            <RefreshCw className={cn('w-5 h-5', isScanning && 'animate-spin')} />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">Escanear</p>
            <p className="text-xs opacity-80">Stock bajo</p>
          </div>
        </div>
      </button>
    </div>
  );
}

// ======================
// ALERTS PANEL
// ======================

interface AlertsPanelProps {
  alerts: LowStockAlert[];
  onCreateOrderFromAlerts: (alertIds: string[]) => void;
  onDismissAlert: (alertId: string) => void;
}

function AlertsPanel({ alerts, onCreateOrderFromAlerts, onDismissAlert }: AlertsPanelProps) {
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());

  const openAlerts = alerts.filter(a => ['open', 'acknowledged'].includes(a.status));

  if (openAlerts.length === 0) return null;

  const toggleAlert = (alertId: string) => {
    const newSelected = new Set(selectedAlerts);
    if (newSelected.has(alertId)) {
      newSelected.delete(alertId);
    } else {
      newSelected.add(alertId);
    }
    setSelectedAlerts(newSelected);
  };

  const selectAll = () => {
    if (selectedAlerts.size === openAlerts.length) {
      setSelectedAlerts(new Set());
    } else {
      setSelectedAlerts(new Set(openAlerts.map(a => a.id)));
    }
  };

  return (
    <div className="bg-gradient-to-r from-amber-50/80 via-orange-50/50 to-red-50/30 rounded-2xl p-5 border border-amber-200/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Alertas de Stock Bajo</h3>
            <p className="text-sm text-slate-500">
              {openAlerts.length} artículo{openAlerts.length !== 1 ? 's' : ''} necesita{openAlerts.length !== 1 ? 'n' : ''} reabastecimiento
            </p>
          </div>
        </div>

        {selectedAlerts.size > 0 && (
          <button
            onClick={() => onCreateOrderFromAlerts(Array.from(selectedAlerts))}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-all shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Crear orden ({selectedAlerts.size})
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={selectAll}
            className="text-xs font-medium text-slate-600 hover:text-tis-coral transition-colors"
          >
            {selectedAlerts.size === openAlerts.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
          {openAlerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => toggleAlert(alert.id)}
              className={cn(
                'flex items-center gap-3 p-3 bg-white rounded-xl border cursor-pointer transition-all',
                selectedAlerts.has(alert.id)
                  ? 'border-tis-coral ring-2 ring-tis-coral/20'
                  : 'border-slate-200 hover:border-slate-300'
              )}
            >
              <div className={cn(
                'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                selectedAlerts.has(alert.id)
                  ? 'bg-tis-coral border-tis-coral'
                  : 'border-slate-300'
              )}>
                {selectedAlerts.has(alert.id) && (
                  <CheckCircle2 className="w-3 h-3 text-white" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 text-sm truncate">
                  {alert.item?.name || 'Artículo'}
                </p>
                <p className="text-xs text-slate-500">
                  Stock: <span className={alert.alert_type === 'critical' ? 'text-red-600 font-medium' : 'text-amber-600'}>
                    {alert.current_stock}
                  </span> / Mín: {alert.minimum_stock}
                </p>
              </div>

              <span className={cn(
                'px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0',
                alert.alert_type === 'critical'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700'
              )}>
                {alert.alert_type === 'critical' ? 'Crítico' : 'Bajo'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ======================
// ORDER CARD
// ======================

interface OrderCardProps {
  order: RestockOrder;
  onView: () => void;
  onAuthorize: () => void;
  onPlace: () => void;
  onReceive: () => void;
  onCancel: () => void;
  onSendWhatsApp: () => void;
  actionLoading: boolean;
}

function OrderCard({
  order,
  onView,
  onAuthorize,
  onPlace,
  onReceive,
  onCancel,
  onSendWhatsApp,
  actionLoading
}: OrderCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const statusConfig = RESTOCK_ORDER_STATUS_CONFIG[order.status];

  const itemsCount = order.items?.length || 0;
  const supplierName = order.supplier?.name || 'Proveedor';
  const hasWhatsApp = !!order.supplier?.whatsapp;

  return (
    <div className={cn(
      'group relative bg-white rounded-2xl border transition-all duration-300',
      'border-slate-200 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50'
    )}>
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              statusConfig.bgColor
            )}>
              <StatusIcon status={order.status} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900">{order.order_number}</h3>
                <span className={cn(
                  'px-2 py-0.5 text-xs font-medium rounded-full',
                  statusConfig.bgColor,
                  statusConfig.color
                )}>
                  {statusConfig.label}
                </span>
              </div>
              <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Building2 className="w-3.5 h-3.5" />
                {supplierName}
              </p>
            </div>
          </div>

          {/* Actions Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-10 z-20 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-2 animate-in fade-in slide-in-from-top-2 duration-150">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onView();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Eye className="w-4 h-4 text-slate-500" />
                    Ver detalles
                  </button>

                  {order.status === 'pending' && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onAuthorize();
                      }}
                      disabled={actionLoading}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Autorizar orden
                    </button>
                  )}

                  {order.status === 'authorized' && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onPlace();
                      }}
                      disabled={actionLoading}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50"
                    >
                      <Send className="w-4 h-4" />
                      Marcar como enviada
                    </button>
                  )}

                  {['authorized', 'placed'].includes(order.status) && hasWhatsApp && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onSendWhatsApp();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-green-600 hover:bg-green-50"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Enviar por WhatsApp
                    </button>
                  )}

                  {['placed', 'partial'].includes(order.status) && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onReceive();
                      }}
                      disabled={actionLoading}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50"
                    >
                      <PackageCheck className="w-4 h-4" />
                      Marcar como recibida
                    </button>
                  )}

                  {['draft', 'pending', 'authorized'].includes(order.status) && (
                    <>
                      <hr className="my-2 border-slate-100" />
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          onCancel();
                        }}
                        disabled={actionLoading}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                      >
                        <XCircle className="w-4 h-4" />
                        Cancelar orden
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="space-y-2.5 mb-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Package className="w-4 h-4 text-slate-400" />
            <span>{itemsCount} artículo{itemsCount !== 1 ? 's' : ''}</span>
          </div>

          {order.expected_delivery_date && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>
                Entrega esperada: {new Date(order.expected_delivery_date).toLocaleDateString('es-MX', {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
            </div>
          )}

          {order.whatsapp_sent && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp enviado</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div className="text-sm text-slate-500">
            {new Date(order.created_at).toLocaleDateString('es-MX', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>

          {order.total_amount && order.total_amount > 0 && (
            <div className="font-semibold text-slate-900">
              ${order.total_amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Action Button */}
      {order.status === 'pending' && (
        <button
          onClick={onAuthorize}
          disabled={actionLoading}
          className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 py-3 bg-gradient-to-t from-emerald-50 to-transparent text-emerald-600 font-medium text-sm rounded-b-2xl hover:from-emerald-100 transition-all border-t border-emerald-100"
        >
          <CheckCircle2 className="w-4 h-4" />
          Autorizar
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function RestockOrdersTab({
  branchId,
  suppliers,
  onCreateOrder,
  onViewOrder,
}: RestockOrdersTabProps) {
  const [orders, setOrders] = useState<RestockOrder[]>([]);
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RestockOrderStatus | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [ordersData, alertsData] = await Promise.all([
        getRestockOrders({ branch_id: branchId }),
        getLowStockAlerts({ branch_id: branchId }),
      ]);
      setOrders(ordersData);
      setAlerts(alertsData);
    } catch (error) {
      console.error('Error loading restock data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    if (branchId) {
      loadData();
    }
  }, [branchId, loadData]);

  // Scan inventory
  const handleScan = useCallback(async () => {
    try {
      setIsScanning(true);
      await scanInventoryForAlerts(branchId);
      await loadData();
    } catch (error) {
      console.error('Error scanning inventory:', error);
    } finally {
      setIsScanning(false);
    }
  }, [branchId, loadData]);

  // Order actions
  const handleAuthorize = useCallback(async (orderId: string) => {
    try {
      setActionLoading(orderId);
      await authorizeOrder(orderId);
      await loadData();
    } catch (error) {
      console.error('Error authorizing order:', error);
    } finally {
      setActionLoading(null);
    }
  }, [loadData]);

  const handlePlace = useCallback(async (orderId: string) => {
    try {
      setActionLoading(orderId);
      await placeOrder(orderId);
      await loadData();
    } catch (error) {
      console.error('Error placing order:', error);
    } finally {
      setActionLoading(null);
    }
  }, [loadData]);

  const handleReceive = useCallback(async (orderId: string) => {
    try {
      setActionLoading(orderId);
      await receiveOrder(orderId);
      await loadData();
    } catch (error) {
      console.error('Error receiving order:', error);
    } finally {
      setActionLoading(null);
    }
  }, [loadData]);

  const handleCancel = useCallback(async (orderId: string) => {
    try {
      setActionLoading(orderId);
      await cancelOrder(orderId);
      await loadData();
    } catch (error) {
      console.error('Error canceling order:', error);
    } finally {
      setActionLoading(null);
    }
  }, [loadData]);

  const handleSendWhatsApp = useCallback((order: RestockOrder) => {
    if (!order.supplier?.whatsapp) return;

    const message = generateWhatsAppMessage(order);
    const url = getWhatsAppUrl(order.supplier.whatsapp, message);
    window.open(url, '_blank');
  }, []);

  const handleCreateOrderFromAlerts = useCallback((alertIds: string[]) => {
    onCreateOrder(alertIds);
  }, [onCreateOrder]);

  const handleDismissAlert = useCallback(async (alertId: string) => {
    try {
      await dismissAlert(alertId);
      await loadData();
    } catch (error) {
      console.error('Error dismissing alert:', error);
    }
  }, [loadData]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (search) {
        const searchLower = search.toLowerCase();
        if (
          !order.order_number.toLowerCase().includes(searchLower) &&
          !order.supplier?.name?.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }
      if (statusFilter !== 'all' && order.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [orders, search, statusFilter]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-slate-100 rounded-xl h-20 animate-pulse" />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div className="h-11 w-72 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-11 w-40 bg-slate-100 rounded-xl animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-slate-100 rounded-2xl h-56 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state (no orders ever)
  if (orders.length === 0 && alerts.length === 0) {
    return (
      <div className="space-y-6">
        <StatsBar
          orders={orders}
          alerts={alerts}
          isScanning={isScanning}
          onScan={handleScan}
        />

        <div className="text-center py-20">
          <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-tis-coral/20 via-orange-50 to-amber-50 flex items-center justify-center">
            <Package className="w-12 h-12 text-tis-coral" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">
            Sistema de Reabastecimiento
          </h3>
          <p className="text-slate-500 mb-8 max-w-md mx-auto leading-relaxed">
            Escanea tu inventario para detectar productos con stock bajo y crea órdenes
            de reabastecimiento automáticas para tus proveedores.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleScan}
              disabled={isScanning}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-tis-coral to-orange-500 text-white font-semibold rounded-xl hover:shadow-xl hover:shadow-tis-coral/30 transition-all"
            >
              <RefreshCw className={cn('w-5 h-5', isScanning && 'animate-spin')} />
              Escanear inventario
            </button>
            <button
              onClick={() => onCreateOrder()}
              className="inline-flex items-center gap-2 px-8 py-4 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-all"
            >
              <Plus className="w-5 h-5" />
              Crear orden manual
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <StatsBar
        orders={orders}
        alerts={alerts}
        isScanning={isScanning}
        onScan={handleScan}
      />

      {/* Alerts Panel */}
      <AlertsPanel
        alerts={alerts}
        onCreateOrderFromAlerts={handleCreateOrderFromAlerts}
        onDismissAlert={handleDismissAlert}
      />

      {/* Header with Search and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por número de orden o proveedor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-all"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 bg-white border rounded-xl text-sm font-medium transition-all',
                statusFilter !== 'all'
                  ? 'border-tis-coral text-tis-coral'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300'
              )}
            >
              <Filter className="w-4 h-4" />
              Filtrar
              <ChevronDown className={cn('w-4 h-4 transition-transform', showFilters && 'rotate-180')} />
            </button>

            {showFilters && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowFilters(false)} />
                <div className="absolute right-0 top-12 z-20 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 animate-in fade-in slide-in-from-top-2 duration-150">
                  <button
                    onClick={() => {
                      setStatusFilter('all');
                      setShowFilters(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-sm',
                      statusFilter === 'all' ? 'text-tis-coral bg-tis-coral/5' : 'text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    Todas las órdenes
                  </button>
                  {Object.entries(RESTOCK_ORDER_STATUS_CONFIG).map(([status, config]) => (
                    <button
                      key={status}
                      onClick={() => {
                        setStatusFilter(status as RestockOrderStatus);
                        setShowFilters(false);
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-sm',
                        statusFilter === status ? 'text-tis-coral bg-tis-coral/5' : 'text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      <span className={cn('w-2 h-2 rounded-full', config.bgColor)} />
                      {config.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <button
          onClick={() => onCreateOrder()}
          className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl"
        >
          <Plus className="w-5 h-5" />
          Nueva Orden
        </button>
      </div>

      {/* Orders Grid */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <Search className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-1">
            Sin resultados
          </h3>
          <p className="text-slate-500 mb-4">
            No se encontraron órdenes con los filtros actuales
          </p>
          <button
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
            }}
            className="text-sm font-medium text-tis-coral hover:underline"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredOrders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onView={() => onViewOrder(order)}
              onAuthorize={() => handleAuthorize(order.id)}
              onPlace={() => handlePlace(order.id)}
              onReceive={() => handleReceive(order.id)}
              onCancel={() => handleCancel(order.id)}
              onSendWhatsApp={() => handleSendWhatsApp(order)}
              actionLoading={actionLoading === order.id}
            />
          ))}

          {/* Add Card */}
          <button
            onClick={() => onCreateOrder()}
            className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 hover:border-tis-coral/30 hover:bg-tis-coral/5 transition-all min-h-[240px] group"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center group-hover:bg-tis-coral/10 transition-colors">
              <Plus className="w-8 h-8 text-slate-400 group-hover:text-tis-coral transition-colors" />
            </div>
            <div className="text-center">
              <span className="block text-sm font-semibold text-slate-600 group-hover:text-tis-coral transition-colors">
                Nueva orden
              </span>
              <span className="block text-xs text-slate-400 mt-1">
                Clic para crear
              </span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

export default RestockOrdersTab;
