import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface DashboardStats {
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  totalProducts: number;
}

export function DashboardPage() {
  const { fetchApi } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    todayOrders: 0,
    todayRevenue: 0,
    pendingOrders: 0,
    totalProducts: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        
        const [ordersRes, productsRes] = await Promise.all([
          fetchApi<{ success: boolean; data: { items: any[]; total: number } }>(`/api/orders?date=${today}&limit=10`),
          fetchApi<{ success: boolean; data: any[] }>('/api/products'),
        ]);

        if (ordersRes.success) {
          const orders = ordersRes.data.items;
          const revenue = orders.reduce((sum: number, o: any) => sum + o.total, 0);
          const pending = orders.filter((o: any) => o.status === 'pending' || o.status === 'preparing').length;

          setStats({
            todayOrders: ordersRes.data.total,
            todayRevenue: revenue,
            pendingOrders: pending,
            totalProducts: productsRes.data?.length || 0,
          });

          setRecentOrders(orders.slice(0, 5));
        }
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [fetchApi]);

  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Today's Orders"
          value={stats.todayOrders.toString()}
          icon="📦"
          color="blue"
        />
        <StatCard
          title="Today's Revenue"
          value={`$${stats.todayRevenue.toFixed(2)}`}
          icon="💰"
          color="green"
        />
        <StatCard
          title="Pending Orders"
          value={stats.pendingOrders.toString()}
          icon="⏳"
          color="yellow"
        />
        <StatCard
          title="Total Products"
          value={stats.totalProducts.toString()}
          icon="🥙"
          color="purple"
        />
      </div>

      {/* Recent Orders */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Orders</h2>
        {recentOrders.length === 0 ? (
          <p className="text-gray-500">No orders today</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Type</th>
                <th>Status</th>
                <th>Total</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id}>
                  <td className="font-medium">#{order.orderNumber}</td>
                  <td>{order.type.replace('_', ' ')}</td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td>${order.total.toFixed(2)}</td>
                  <td className="text-gray-500">
                    {new Date(order.createdAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { 
  title: string; 
  value: string; 
  icon: string;
  color: 'blue' | 'green' | 'yellow' | 'purple';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="card">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${colorClasses[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    preparing: 'bg-orange-100 text-orange-800',
    ready: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100'}`}>
      {status}
    </span>
  );
}
