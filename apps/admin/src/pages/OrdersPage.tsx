import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

interface OrderItem {
  product: { name: string };
  quantity: number;
  totalPrice: number;
  modifiers?: Array<{ name: string; price: number }>;
  notes?: string;
}

interface Order {
  id: string;
  orderNumber: number;
  type: string;
  status: string;
  total: number;
  paymentMethod?: string;
  paymentStatus: string;
  customerName?: string;
  customerPhone?: string;
  tableNumber?: string;
  notes?: string;
  createdAt: string;
  items: OrderItem[];
}

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
type TypeFilter = 'all' | 'dine_in' | 'takeaway' | 'delivery';
type PaymentFilter = 'all' | 'paid' | 'pending';

export function OrdersPage() {
  const { fetchApi } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [dateFilter, setDateFilter] = useState(
    new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'time' | 'total' | 'orderNumber'>('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      const res = await fetchApi<{ success: boolean; data: { items: Order[] } }>(
        `/api/orders?date=${dateFilter}&limit=500&includeItems=true&includeArchived=true`
      );
      if (res.success) setOrders(res.data.items);
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [fetchApi, dateFilter]);

  const handleUpdateStatus = async (orderId: string, status: string) => {
    try {
      await fetchApi(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setOrders(orders.map((o) => (o.id === orderId ? { ...o, status } : o)));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status });
      }
    } catch (error) {
      alert('Failed to update status');
    }
  };

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    let result = [...orders];

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(o => o.status === statusFilter);
    }

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter(o => o.type === typeFilter);
    }

    // Payment filter
    if (paymentFilter !== 'all') {
      result = result.filter(o => o.paymentStatus === paymentFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(o => 
        o.orderNumber.toString().includes(query) ||
        o.customerName?.toLowerCase().includes(query) ||
        o.items?.some(i => i.product.name.toLowerCase().includes(query))
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'time') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === 'total') {
        comparison = a.total - b.total;
      } else if (sortBy === 'orderNumber') {
        comparison = a.orderNumber - b.orderNumber;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [orders, statusFilter, typeFilter, paymentFilter, searchQuery, sortBy, sortOrder]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const validOrders = orders.filter(o => o.status !== 'cancelled');
    const totalRevenue = validOrders.reduce((sum, o) => sum + o.total, 0);
    const pending = orders.filter(o => ['pending', 'received', 'confirmed', 'preparing'].includes(o.status)).length;
    const completed = orders.filter(o => o.status === 'completed').length;
    const cancelled = orders.filter(o => o.status === 'cancelled').length;
    
    return { totalOrders: orders.length, totalRevenue, pending, completed, cancelled };
  }, [orders]);

  const statusColors: Record<string, string> = {
    received: 'bg-blue-100 text-blue-800',
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    preparing: 'bg-orange-100 text-orange-800',
    ready: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  const typeIcons: Record<string, string> = {
    dine_in: '🍽️',
    takeaway: '🥡',
    delivery: '🚗',
  };

  const handleSort = (field: 'time' | 'total' | 'orderNumber') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ field }: { field: 'time' | 'total' | 'orderNumber' }) => {
    if (sortBy !== field) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-primary-600 ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Australia/Sydney'
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-AU', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long',
      timeZone: 'Australia/Sydney'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Orders</h1>
          <p className="text-sm text-gray-500">{formatDate(dateFilter)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              const d = new Date(dateFilter);
              d.setDate(d.getDate() - 1);
              setDateFilter(d.toISOString().split('T')[0]);
            }}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            ← Prev
          </button>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="input w-auto"
          />
          <button
            onClick={() => {
              const d = new Date(dateFilter);
              d.setDate(d.getDate() + 1);
              setDateFilter(d.toISOString().split('T')[0]);
            }}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Next →
          </button>
          <button
            onClick={() => setDateFilter(new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }))}
            className="btn-secondary"
          >
            Today
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-800">{stats.totalOrders}</p>
          <p className="text-xs text-gray-500">Total Orders</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-green-600">${stats.totalRevenue.toFixed(2)}</p>
          <p className="text-xs text-gray-500">Revenue</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
          <p className="text-xs text-gray-500">In Progress</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.completed}</p>
          <p className="text-xs text-gray-500">Completed</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
          <p className="text-xs text-gray-500">Cancelled</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search orders, customers, items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input w-full"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="input w-auto"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="preparing">Preparing</option>
            <option value="ready">Ready</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            className="input w-auto"
          >
            <option value="all">All Types</option>
            <option value="dine_in">🍽️ Dine In</option>
            <option value="takeaway">🥡 Takeaway</option>
            <option value="delivery">🚗 Delivery</option>
          </select>

          {/* Payment Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}
            className="input w-auto"
          >
            <option value="all">All Payments</option>
            <option value="paid">✅ Paid</option>
            <option value="pending">⏳ Unpaid</option>
          </select>

          {/* Clear Filters */}
          {(statusFilter !== 'all' || typeFilter !== 'all' || paymentFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setTypeFilter('all');
                setPaymentFilter('all');
                setSearchQuery('');
              }}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Orders Table */}
      {isLoading ? (
        <div className="card p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <span className="ml-3 text-gray-500">Loading orders...</span>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th 
                    className="cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('orderNumber')}
                  >
                    Order # <SortIcon field="orderNumber" />
                  </th>
                  <th>Type</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th 
                    className="cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('total')}
                  >
                    Total <SortIcon field="total" />
                  </th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th 
                    className="cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('time')}
                  >
                    Time <SortIcon field="time" />
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr 
                    key={order.id} 
                    className={`hover:bg-gray-50 transition-colors ${
                      order.status === 'cancelled' ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="font-medium">
                      <span className="text-primary-600">#{order.orderNumber}</span>
                    </td>
                    <td>
                      <span className="flex items-center gap-2">
                        <span>{typeIcons[order.type] || '📋'}</span>
                        <span className="capitalize text-sm">{order.type.replace('_', ' ')}</span>
                      </span>
                    </td>
                    <td>
                      <div>
                        <p className="font-medium">{order.customerName || '-'}</p>
                        {order.tableNumber && (
                          <p className="text-xs text-gray-500">Table {order.tableNumber}</p>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="bg-gray-100 px-2 py-1 rounded text-sm font-medium">
                          {(order.items || []).reduce((sum, i) => sum + i.quantity, 0)}
                        </span>
                        <span className="text-xs text-gray-500 truncate max-w-[120px]">
                          {order.items?.slice(0, 2).map(i => i.product.name).join(', ')}
                          {(order.items?.length || 0) > 2 && '...'}
                        </span>
                      </div>
                    </td>
                    <td className="font-semibold">${order.total.toFixed(2)}</td>
                    <td>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          order.paymentStatus === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {order.paymentMethod === 'cash' ? '💵' : order.paymentMethod === 'card' ? '💳' : '📱'}{' '}
                        {order.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                    <td>
                      <select
                        value={order.status}
                        onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                        className={`px-2 py-1 rounded text-xs font-medium border-0 cursor-pointer ${statusColors[order.status]}`}
                      >
                        <option value="received">Received</option>
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="preparing">Preparing</option>
                        <option value="ready">Ready</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="text-gray-500 text-sm">
                      {formatTime(order.createdAt)}
                    </td>
                    <td>
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="btn-secondary text-sm py-1 px-3"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <p className="text-4xl mb-2">📭</p>
              <p className="text-gray-500">
                {orders.length === 0 
                  ? 'No orders for this date' 
                  : 'No orders match your filters'}
              </p>
              {orders.length > 0 && (
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setTypeFilter('all');
                    setPaymentFilter('all');
                    setSearchQuery('');
                  }}
                  className="text-primary-600 hover:text-primary-700 mt-2"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {filteredOrders.length > 0 && (
            <div className="p-4 bg-gray-50 border-t flex justify-between items-center text-sm text-gray-500">
              <span>
                Showing {filteredOrders.length} of {orders.length} orders
              </span>
              <span>
                Filtered Total: <span className="font-semibold text-gray-800">
                  ${filteredOrders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + o.total, 0).toFixed(2)}
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {selectedOrder && (
        <OrderDetailModal 
          order={selectedOrder} 
          onClose={() => setSelectedOrder(null)}
          onUpdateStatus={handleUpdateStatus}
          statusColors={statusColors}
        />
      )}
    </div>
  );
}

function OrderDetailModal({ 
  order, 
  onClose, 
  onUpdateStatus,
  statusColors 
}: { 
  order: Order; 
  onClose: () => void;
  onUpdateStatus: (orderId: string, status: string) => Promise<void>;
  statusColors: Record<string, string>;
}) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = async (status: string) => {
    setIsUpdating(true);
    try {
      await onUpdateStatus(order.id, status);
    } finally {
      setIsUpdating(false);
    }
  };

  const typeIcons: Record<string, string> = {
    dine_in: '🍽️',
    takeaway: '🥡',
    delivery: '🚗',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-gray-50">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">Order #{order.orderNumber}</h2>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[order.status]}`}>
                  {order.status}
                </span>
              </div>
              <p className="text-gray-500 mt-1">
                {new Date(order.createdAt).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Order Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase">Type</p>
              <p className="font-medium flex items-center gap-2 mt-1">
                {typeIcons[order.type] || '📋'}
                <span className="capitalize">{order.type.replace('_', ' ')}</span>
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase">Payment</p>
              <p className="font-medium mt-1">
                {order.paymentMethod === 'cash' ? '💵 Cash' : order.paymentMethod === 'card' ? '💳 Card' : order.paymentMethod || 'N/A'}
              </p>
              <p className={`text-xs ${order.paymentStatus === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                {order.paymentStatus === 'paid' ? '✓ Paid' : '⏳ Pending'}
              </p>
            </div>
            {order.customerName && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase">Customer</p>
                <p className="font-medium mt-1">{order.customerName}</p>
                {order.customerPhone && (
                  <p className="text-xs text-gray-500">{order.customerPhone}</p>
                )}
              </div>
            )}
            {order.tableNumber && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase">Table</p>
                <p className="font-medium text-xl mt-1">{order.tableNumber}</p>
              </div>
            )}
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-xs text-yellow-700 uppercase font-medium mb-1">📝 Order Notes</p>
              <p className="text-yellow-800">{order.notes}</p>
            </div>
          )}

          {/* Items */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">Items ({order.items?.length || 0})</h3>
            <div className="space-y-3">
              {order.items?.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-primary-100 text-primary-800 px-2 py-0.5 rounded text-sm font-medium">
                        {item.quantity}x
                      </span>
                      <span className="font-medium">{item.product.name}</span>
                    </div>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="mt-1 ml-8 text-sm text-gray-500">
                        {item.modifiers.map((m, i) => (
                          <span key={i}>
                            + {m.name} {m.price > 0 && `($${m.price.toFixed(2)})`}
                            {i < item.modifiers!.length - 1 && ', '}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.notes && (
                      <p className="mt-1 ml-8 text-sm text-yellow-700 italic">"{item.notes}"</p>
                    )}
                  </div>
                  <span className="font-semibold">${item.totalPrice.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center text-xl font-bold">
              <span>Total</span>
              <span className="text-primary-600">${order.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer with status actions */}
        <div className="p-6 border-t bg-gray-50">
          <p className="text-xs text-gray-500 uppercase mb-3">Update Status</p>
          <div className="flex flex-wrap gap-2">
            {['received', 'preparing', 'ready', 'completed', 'cancelled'].map((status) => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                disabled={isUpdating || order.status === status}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  order.status === status
                    ? `${statusColors[status]} ring-2 ring-offset-2 ring-gray-400`
                    : 'bg-white border hover:bg-gray-50'
                } ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {status === 'received' && '📥 '}
                {status === 'preparing' && '👨‍🍳 '}
                {status === 'ready' && '✅ '}
                {status === 'completed' && '🎉 '}
                {status === 'cancelled' && '❌ '}
                <span className="capitalize">{status}</span>
              </button>
            ))}
          </div>
          <button onClick={onClose} className="btn-secondary w-full mt-4">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
