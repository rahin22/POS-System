import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../context/ApiContext';

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  product: {
    id: string;
    name: string;
  };
  modifiers: Array<{
    id: string;
    name: string;
    price: number;
  }>;
}

interface Order {
  id: string;
  orderNumber: number;
  status: 'received' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  type: 'dine-in' | 'takeaway' | 'delivery' | 'online';
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  createdAt: string;
  items: OrderItem[];
}

interface OrdersPageProps {
  currencySymbol: string;
}

const statusColors: Record<Order['status'], string> = {
  received: 'bg-blue-100 text-blue-800 border-blue-500',
  preparing: 'bg-orange-100 text-orange-800 border-orange-500',
  ready: 'bg-green-100 text-green-800 border-green-500',
  completed: 'bg-gray-100 text-gray-800 border-gray-500',
  cancelled: 'bg-red-100 text-red-800 border-red-500',
};

const statusLabels: Record<Order['status'], string> = {
  received: 'Received',
  preparing: 'Preparing',
  ready: 'Ready for Pickup',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const typeLabels: Record<Order['type'], string> = {
  'dine-in': 'Dine In',
  'takeaway': 'Takeaway',
  'delivery': 'Delivery',
  'online': 'Online',
};

export function OrdersPage({ currencySymbol }: OrdersPageProps) {
  const { fetchApi } = useApi();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState<Order['status'] | 'active' | 'all'>('active');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const formatPrice = (price: number) => `${currencySymbol}${price.toFixed(2)}`;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  };

  const getTimeSince = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ${diffMins % 60}m ago`;
  };

  const loadOrders = useCallback(async () => {
    try {
      let url = '/api/orders?';
      if (filterStatus === 'active') {
        url += 'status=received,preparing,ready';
      } else if (filterStatus !== 'all') {
        url += `status=${filterStatus}`;
      }
      
      const response = await fetchApi<{ success: boolean; data: { items: Order[] } }>(url);
      if (response.success) {
        setOrders(response.data.items);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [fetchApi, filterStatus]);

  useEffect(() => {
    loadOrders();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      const response = await fetchApi<{ success: boolean }>(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (response.success) {
        loadOrders();
        if (selectedOrder?.id === orderId) {
          setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const reprintReceipt = async (orderId: string) => {
    try {
      const response = await fetchApi<{ success: boolean }>(`/api/orders/${orderId}/reprint`, {
        method: 'POST',
        body: JSON.stringify({ type: 'customer' }),
      });
      
      if (response.success) {
        // Show success message (you could add a toast notification here)
        console.log('Receipt reprinted successfully');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const printKitchenDocket = async (orderId: string) => {
    try {
      const response = await fetchApi<{ success: boolean }>(`/api/orders/${orderId}/reprint`, {
        method: 'POST',
        body: JSON.stringify({ type: 'kitchen' }),
      });
      
      if (response.success) {
        console.log('Kitchen docket printed successfully');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getNextStatus = (currentStatus: Order['status']): Order['status'] | null => {
    const flow: Record<string, Order['status']> = {
      received: 'preparing',
      preparing: 'ready',
      ready: 'completed',
    };
    return flow[currentStatus] || null;
  };

  const activeStatuses: Order['status'][] = ['received', 'preparing', 'ready'];

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Kitchen Orders</h1>
          <button
            onClick={loadOrders}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mt-4 overflow-x-auto">
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              filterStatus === 'active'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Active Orders
          </button>
          {activeStatuses.map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                filterStatus === status
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {statusLabels[status]}
            </button>
          ))}
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              filterStatus === 'all'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Orders
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-b border-red-200 text-red-700 px-6 py-3">
          {error}
        </div>
      )}

      {/* Orders Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {orders.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-400 mb-4">
              <svg className="w-24 h-24 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-xl text-gray-500">No orders found</p>
            <p className="text-sm text-gray-400 mt-2">Orders will appear here as they come in</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className={`bg-white rounded-lg border-l-4 shadow-sm hover:shadow-md transition-shadow ${
                  order.status === 'received' ? 'border-blue-500' :
                  order.status === 'preparing' ? 'border-orange-500' :
                  order.status === 'ready' ? 'border-green-500' :
                  order.status === 'completed' ? 'border-gray-400' :
                  'border-red-500'
                }`}
              >
                <div className="p-6">
                  {/* Order Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-2xl font-bold text-gray-900">Order #{order.orderNumber}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                          order.status === 'received' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'preparing' ? 'bg-orange-100 text-orange-800' :
                          order.status === 'ready' ? 'bg-green-100 text-green-800' :
                          order.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {statusLabels[order.status]}
                        </span>
                        <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                          {typeLabels[order.type]}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        {order.customerName && (
                          <span className="font-medium">{order.customerName}</span>
                        )}
                        <span>{formatTime(order.createdAt)}</span>
                        <span className="text-gray-500">{getTimeSince(order.createdAt)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-gray-900">{formatPrice(order.total)}</div>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="mb-4 space-y-2">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-start gap-3 text-sm">
                        <span className="font-bold text-primary-600 min-w-[2rem]">{item.quantity}×</span>
                        <div className="flex-1">
                          <span className="font-medium text-gray-900">{item.product.name}</span>
                          {item.modifiers.length > 0 && (
                            <span className="text-gray-600 ml-2">
                              ({item.modifiers.map(m => m.name).join(', ')})
                            </span>
                          )}
                          {item.notes && (
                            <p className="text-orange-600 text-xs mt-1">Note: {item.notes}</p>
                          )}
                        </div>
                        <span className="text-gray-700 font-medium">{formatPrice(item.totalPrice)}</span>
                      </div>
                    ))}
                  </div>

                  {order.notes && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm font-medium text-yellow-900">Order Notes:</p>
                      <p className="text-sm text-yellow-800 mt-1">{order.notes}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => printKitchenDocket(order.id)}
                      className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 font-medium transition-colors"
                    >
                      Kitchen Docket
                    </button>
                    <button
                      onClick={() => reprintReceipt(order.id)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                    >
                      Receipt
                    </button>
                    {getNextStatus(order.status) && (
                      <button
                        onClick={() => updateOrderStatus(order.id, getNextStatus(order.status)!)}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors ml-auto"
                      >
                        Mark as {statusLabels[getNextStatus(order.status)!]}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-bold text-gray-900">Order #{selectedOrder.orderNumber}</h2>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                    selectedOrder.status === 'received' ? 'bg-blue-100 text-blue-800' :
                    selectedOrder.status === 'preparing' ? 'bg-orange-100 text-orange-800' :
                    selectedOrder.status === 'ready' ? 'bg-green-100 text-green-800' :
                    selectedOrder.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {statusLabels[selectedOrder.status]}
                  </span>
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                    {typeLabels[selectedOrder.type]}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="w-10 h-10 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
                {selectedOrder.customerName && (
                  <div>
                    <span className="font-medium text-gray-900">Customer:</span> {selectedOrder.customerName}
                  </div>
                )}
                {selectedOrder.customerPhone && (
                  <div>
                    <span className="font-medium text-gray-900">Phone:</span> {selectedOrder.customerPhone}
                  </div>
                )}
                <div>
                  <span className="font-medium text-gray-900">Time:</span> {formatTime(selectedOrder.createdAt)} ({getTimeSince(selectedOrder.createdAt)})
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div className="p-6">
              <h3 className="font-bold text-lg mb-4 text-gray-900">Order Items</h3>
              <div className="space-y-3">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                    <span className="text-xl font-bold text-primary-600 min-w-[2.5rem]">{item.quantity}×</span>
                    <div className="flex-1">
                      <p className="font-semibold text-lg text-gray-900">{item.product.name}</p>
                      {item.modifiers.length > 0 && (
                        <p className="text-sm text-gray-600 mt-1">
                          {item.modifiers.map(m => `${m.name} (+${formatPrice(m.price)})`).join(', ')}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-sm text-orange-600 mt-1 font-medium">Note: {item.notes}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">{formatPrice(item.unitPrice)} each</p>
                    </div>
                    <span className="font-bold text-lg text-gray-900">{formatPrice(item.totalPrice)}</span>
                  </div>
                ))}
              </div>

              {selectedOrder.notes && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm font-semibold text-yellow-900">Order Notes</p>
                  <p className="text-sm text-yellow-800 mt-1">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Totals */}
              <div className="mt-6 border-t border-gray-200 pt-4 space-y-2">
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal</span>
                  <span className="font-medium">{formatPrice(selectedOrder.subtotal)}</span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span className="font-medium">-{formatPrice(selectedOrder.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-700">
                  <span>GST (10%)</span>
                  <span className="font-medium">{formatPrice(selectedOrder.tax)}</span>
                </div>
                <div className="flex justify-between font-bold text-2xl text-gray-900 border-t border-gray-300 pt-3">
                  <span>Total</span>
                  <span>{formatPrice(selectedOrder.total)}</span>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <button
                  onClick={() => printKitchenDocket(selectedOrder.id)}
                  className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium transition-colors"
                >
                  Kitchen Docket
                </button>
                <button
                  onClick={() => reprintReceipt(selectedOrder.id)}
                  className="px-4 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Customer Receipt
                </button>
                <button
                  onClick={() => {
                    setSelectedOrder(null);
                    // TODO: Implement edit order functionality
                    alert('Edit order functionality coming soon');
                  }}
                  className="px-4 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  disabled={selectedOrder.status === 'completed' || selectedOrder.status === 'cancelled'}
                >
                  Edit Order
                </button>
              </div>
              
              <div>
                <h4 className="font-bold text-sm mb-3 text-gray-900">Update Status</h4>
                <div className="grid grid-cols-3 gap-2">
                  {activeStatuses.map((status) => (
                    <button
                      key={status}
                      onClick={() => updateOrderStatus(selectedOrder.id, status)}
                      disabled={selectedOrder.status === status}
                      className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                        selectedOrder.status === status
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : status === 'received' ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 border-2 border-blue-300' :
                            status === 'preparing' ? 'bg-orange-100 text-orange-800 hover:bg-orange-200 border-2 border-orange-300' :
                            'bg-green-100 text-green-800 hover:bg-green-200 border-2 border-green-300'
                      }`}
                    >
                      {statusLabels[status]}
                    </button>
                  ))}
                  <button
                    onClick={() => updateOrderStatus(selectedOrder.id, 'completed')}
                    disabled={selectedOrder.status === 'completed'}
                    className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                      selectedOrder.status === 'completed'
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    Complete
                  </button>
                  <button
                    onClick={() => updateOrderStatus(selectedOrder.id, 'cancelled')}
                    disabled={selectedOrder.status === 'cancelled' || selectedOrder.status === 'completed'}
                    className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                      selectedOrder.status === 'cancelled' || selectedOrder.status === 'completed'
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
