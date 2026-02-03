import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface DashboardStats {
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  totalProducts: number;
  averageOrderValue: number;
  completedOrders: number;
  cancelledOrders: number;
  ordersByType: Record<string, number>;
  ordersByHour: Record<string, number>;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  paymentMethods: Record<string, { count: number; total: number }>;
}

interface WeeklyData {
  date: string;
  orders: number;
  revenue: number;
}

export function DashboardPage() {
  const { fetchApi } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    todayOrders: 0,
    todayRevenue: 0,
    pendingOrders: 0,
    totalProducts: 0,
    averageOrderValue: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    ordersByType: {},
    ordersByHour: {},
    topProducts: [],
    paymentMethods: {},
  });
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get today's date in Sydney timezone
        const sydneyDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
        
        // Get dates for last 7 days
        const last7Days: string[] = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          last7Days.push(date.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }));
        }
        
        const [allOrdersRes, productsRes, ...weeklyOrdersRes] = await Promise.all([
          // Get all orders for today
          fetchApi<{ success: boolean; data: { items: any[]; total: number } }>(`/api/orders?date=${sydneyDate}&limit=500&includeItems=true`),
          fetchApi<{ success: boolean; data: any[] }>('/api/products'),
          // Get orders for last 7 days
          ...last7Days.map(date => 
            fetchApi<{ success: boolean; data: { items: any[]; total: number } }>(`/api/orders?date=${date}&limit=500&includeArchived=true`)
          ),
        ]);

        if (allOrdersRes.success) {
          const allOrders = allOrdersRes.data.items;
          const validOrders = allOrders.filter((o: any) => o.status !== 'cancelled');
          
          // Calculate revenue
          const revenue = validOrders.reduce((sum: number, o: any) => sum + o.total, 0);
          const pending = allOrders.filter((o: any) => o.status === 'received' || o.status === 'preparing').length;
          const completed = allOrders.filter((o: any) => o.status === 'completed').length;
          const cancelled = allOrders.filter((o: any) => o.status === 'cancelled').length;
          const avgOrderValue = validOrders.length > 0 ? revenue / validOrders.length : 0;

          // Orders by type
          const ordersByType: Record<string, number> = {};
          validOrders.forEach((o: any) => {
            const type = o.type.replace('_', ' ');
            ordersByType[type] = (ordersByType[type] || 0) + 1;
          });

          // Orders by hour
          const ordersByHour: Record<string, number> = {};
          validOrders.forEach((o: any) => {
            const hour = new Date(o.createdAt).toLocaleTimeString('en-AU', { 
              hour: '2-digit', 
              hour12: true,
              timeZone: 'Australia/Sydney' 
            });
            ordersByHour[hour] = (ordersByHour[hour] || 0) + 1;
          });

          // Top products
          const productCounts: Record<string, { name: string; quantity: number; revenue: number }> = {};
          validOrders.forEach((o: any) => {
            o.items?.forEach((item: any) => {
              const name = item.product?.name || 'Unknown';
              if (!productCounts[name]) {
                productCounts[name] = { name, quantity: 0, revenue: 0 };
              }
              productCounts[name].quantity += item.quantity;
              productCounts[name].revenue += item.totalPrice;
            });
          });
          const topProducts = Object.values(productCounts)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5);

          // Payment methods
          const paymentMethods: Record<string, { count: number; total: number }> = {};
          validOrders.forEach((o: any) => {
            const method = o.paymentMethod || 'Unknown';
            if (!paymentMethods[method]) {
              paymentMethods[method] = { count: 0, total: 0 };
            }
            paymentMethods[method].count += 1;
            paymentMethods[method].total += o.total;
          });

          setStats({
            todayOrders: allOrdersRes.data.total,
            todayRevenue: revenue,
            pendingOrders: pending,
            totalProducts: productsRes.data?.length || 0,
            averageOrderValue: avgOrderValue,
            completedOrders: completed,
            cancelledOrders: cancelled,
            ordersByType,
            ordersByHour,
            topProducts,
            paymentMethods,
          });

          setRecentOrders(allOrders.slice(0, 10));
        }

        // Process weekly data
        const weekly: WeeklyData[] = last7Days.map((date, index) => {
          const res = weeklyOrdersRes[index] as { success: boolean; data: { items: any[]; total: number } };
          if (res?.success) {
            const orders = res.data.items.filter((o: any) => o.status !== 'cancelled');
            const revenue = orders.reduce((sum: number, o: any) => sum + o.total, 0);
            return {
              date,
              orders: res.data.total,
              revenue,
            };
          }
          return { date, orders: 0, revenue: 0 };
        });
        setWeeklyData(weekly);

      } catch (error) {
        console.error('Failed to load dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [fetchApi]);

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const maxWeeklyRevenue = Math.max(...weeklyData.map(d => d.revenue), 1);
  const maxWeeklyOrders = Math.max(...weeklyData.map(d => d.orders), 1);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-AU', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            timeZone: 'Australia/Sydney'
          })}
        </p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Today's Revenue"
          value={formatCurrency(stats.todayRevenue)}
          icon="💰"
          color="green"
          subtitle={`${stats.todayOrders} orders`}
        />
        <StatCard
          title="Avg Order Value"
          value={formatCurrency(stats.averageOrderValue)}
          icon="📊"
          color="blue"
          subtitle={stats.todayOrders > 0 ? 'per order' : 'No orders yet'}
        />
        <StatCard
          title="Pending"
          value={stats.pendingOrders.toString()}
          icon="⏳"
          color="yellow"
          subtitle="orders in queue"
        />
        <StatCard
          title="Completed"
          value={stats.completedOrders.toString()}
          icon="✅"
          color="purple"
          subtitle={stats.cancelledOrders > 0 ? `${stats.cancelledOrders} cancelled` : 'today'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Revenue Chart */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Last 7 Days Revenue</h2>
          <div className="flex items-end gap-2 h-40">
            {weeklyData.map((day, index) => (
              <div key={day.date} className="flex-1 flex flex-col items-center">
                <div className="w-full flex flex-col items-center">
                  <span className="text-xs text-gray-500 mb-1">{formatCurrency(day.revenue)}</span>
                  <div 
                    className={`w-full rounded-t transition-all ${
                      index === weeklyData.length - 1 ? 'bg-primary-500' : 'bg-primary-200'
                    }`}
                    style={{ height: `${(day.revenue / maxWeeklyRevenue) * 100}px`, minHeight: '4px' }}
                  />
                </div>
                <span className="text-xs text-gray-600 mt-2">{formatDate(day.date)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Orders Chart */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Last 7 Days Orders</h2>
          <div className="flex items-end gap-2 h-40">
            {weeklyData.map((day, index) => (
              <div key={day.date} className="flex-1 flex flex-col items-center">
                <div className="w-full flex flex-col items-center">
                  <span className="text-xs text-gray-500 mb-1">{day.orders}</span>
                  <div 
                    className={`w-full rounded-t transition-all ${
                      index === weeklyData.length - 1 ? 'bg-blue-500' : 'bg-blue-200'
                    }`}
                    style={{ height: `${(day.orders / maxWeeklyOrders) * 100}px`, minHeight: '4px' }}
                  />
                </div>
                <span className="text-xs text-gray-600 mt-2">{formatDate(day.date)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Order Types */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Orders by Type</h2>
          {Object.keys(stats.ordersByType).length === 0 ? (
            <p className="text-gray-500 text-sm">No orders today</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(stats.ordersByType).map(([type, count]) => {
                const percentage = stats.todayOrders > 0 ? (count / stats.todayOrders) * 100 : 0;
                return (
                  <div key={type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize">{type}</span>
                      <span className="text-gray-500">{count} ({percentage.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-primary-500 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment Methods */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Payment Methods</h2>
          {Object.keys(stats.paymentMethods).length === 0 ? (
            <p className="text-gray-500 text-sm">No orders today</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(stats.paymentMethods).map(([method, data]) => (
                <div key={method} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {method === 'cash' ? '💵' : method === 'card' ? '💳' : '📱'}
                    </span>
                    <span className="capitalize">{method}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(data.total)}</p>
                    <p className="text-xs text-gray-500">{data.count} orders</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Products */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Top Products Today</h2>
          {stats.topProducts.length === 0 ? (
            <p className="text-gray-500 text-sm">No orders today</p>
          ) : (
            <div className="space-y-3">
              {stats.topProducts.map((product, index) => (
                <div key={product.name} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    index === 0 ? 'bg-yellow-100 text-yellow-800' :
                    index === 1 ? 'bg-gray-100 text-gray-800' :
                    index === 2 ? 'bg-orange-100 text-orange-800' :
                    'bg-gray-50 text-gray-600'
                  }`}>
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.quantity} sold</p>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(product.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Busiest Hours */}
      {Object.keys(stats.ordersByHour).length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Orders by Hour</h2>
          <div className="flex items-end gap-1 h-24 overflow-x-auto pb-2">
            {Object.entries(stats.ordersByHour)
              .sort(([a], [b]) => {
                const hourA = parseInt(a);
                const hourB = parseInt(b);
                return hourA - hourB;
              })
              .map(([hour, count]) => {
                const maxCount = Math.max(...Object.values(stats.ordersByHour));
                return (
                  <div key={hour} className="flex flex-col items-center min-w-[40px]">
                    <span className="text-xs text-gray-500 mb-1">{count}</span>
                    <div 
                      className="w-8 bg-primary-400 rounded-t"
                      style={{ height: `${(count / maxCount) * 60}px`, minHeight: '4px' }}
                    />
                    <span className="text-xs text-gray-600 mt-1 whitespace-nowrap">{hour}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Orders</h2>
        {recentOrders.length === 0 ? (
          <p className="text-gray-500">No orders today</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Type</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="font-medium">#{order.orderNumber}</td>
                    <td className="capitalize">{order.type.replace('_', ' ')}</td>
                    <td className="text-gray-500">{order.items?.length || order._count?.items || 0} items</td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="capitalize">{order.paymentMethod || '-'}</td>
                    <td className="font-medium">{formatCurrency(order.total)}</td>
                    <td className="text-gray-500">
                      {new Date(order.createdAt).toLocaleTimeString('en-AU', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Australia/Sydney'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color, subtitle }: { 
  title: string; 
  value: string; 
  icon: string;
  color: 'blue' | 'green' | 'yellow' | 'purple';
  subtitle?: string;
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
  };

  return (
    <div className={`card border-l-4 ${colorClasses[color].split(' ')[2]}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${colorClasses[color]}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{title}</p>
          <p className="text-xl font-bold text-gray-800 truncate">{value}</p>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusColors: Record<string, string> = {
    received: 'bg-blue-100 text-blue-800',
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
