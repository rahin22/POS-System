import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface Order {
  id: string;
  orderNumber: number;
  type: string;
  status: string;
  total: number;
  paymentMethod?: string;
  paymentStatus: string;
  customerName?: string;
  createdAt: string;
  items: Array<{
    product: { name: string };
    quantity: number;
    totalPrice: number;
  }>;
}

export function OrdersPage() {
  const { fetchApi } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      const res = await fetchApi<{ success: boolean; data: { items: Order[] } }>(
        `/api/orders?date=${dateFilter}&limit=100&includeItems=true`
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

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    preparing: 'bg-orange-100 text-orange-800',
    ready: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Orders</h1>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="input w-auto"
        />
      </div>

      {isLoading ? (
        <div className="animate-pulse">Loading...</div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Type</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Time</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="font-medium">#{order.orderNumber}</td>
                  <td>{order.type.replace('_', ' ')}</td>
                  <td>{order.customerName || '-'}</td>
                  <td>{(order.items || []).reduce((sum, i) => sum + i.quantity, 0)}</td>
                  <td>${order.total.toFixed(2)}</td>
                  <td>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        order.paymentStatus === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {order.paymentMethod || 'N/A'} - {order.paymentStatus}
                    </span>
                  </td>
                  <td>
                    <select
                      value={order.status}
                      onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                      className={`px-2 py-1 rounded text-xs font-medium border-0 ${statusColors[order.status]}`}
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="preparing">Preparing</option>
                      <option value="ready">Ready</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td className="text-gray-500">
                    {new Date(order.createdAt).toLocaleTimeString()}
                  </td>
                  <td>
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {orders.length === 0 && (
            <p className="text-center text-gray-500 py-8">No orders for this date</p>
          )}
        </div>
      )}

      {selectedOrder && (
        <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  );
}

function OrderDetailModal({ order, onClose }: { order: Order; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Order #{order.orderNumber}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Type</p>
              <p className="font-medium">{order.type.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-gray-500">Status</p>
              <p className="font-medium capitalize">{order.status}</p>
            </div>
            <div>
              <p className="text-gray-500">Payment</p>
              <p className="font-medium capitalize">
                {order.paymentMethod || 'N/A'} - {order.paymentStatus}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Time</p>
              <p className="font-medium">
                {new Date(order.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          {order.customerName && (
            <div className="text-sm">
              <p className="text-gray-500">Customer</p>
              <p className="font-medium">{order.customerName}</p>
            </div>
          )}

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-2">Items</h3>
            <div className="space-y-2">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>
                    {item.quantity}x {item.product.name}
                  </span>
                  <span>${item.totalPrice.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4 flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>${order.total.toFixed(2)}</span>
          </div>
        </div>

        <button onClick={onClose} className="btn-secondary w-full mt-6">
          Close
        </button>
      </div>
    </div>
  );
}
