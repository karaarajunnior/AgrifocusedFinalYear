import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Package, 
  TrendingUp, 
  DollarSign, 
  BarChart3,
  Activity,
  Shield,
  AlertTriangle,
  Link2,
  Bell
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import axios from 'axios';

interface DashboardData {
  overview: {
    totalUsers: number;
    unverifiedUsers: number;
    totalProducts: number;
    totalOrders: number;
    totalTransactions: number;
    failedTransactions: number;
    pendingOrders: number;
    totalRevenue: number;
  };
  systemHealth: {
    eventsLast24h: number;
  };
  userGrowth: Array<{
    createdAt: string;
    _count: number;
  }>;
  productCategories: Array<{
    category: string;
    _count: { category: number };
  }>;
  orderStats: Array<{
    status: string;
    _count: { status: number };
  }>;
  topFarmers: Array<{
    id: string;
    name: string;
    location: string;
    totalRevenue: number;
    totalSales: number;
  }>;
  recentActivity: Array<{
    id: string;
    event: string;
    timestamp: string;
    user: {
      name: string;
      role: string;
    };
  }>;
  recentTransactions: Array<{
    id: string;
    orderId: string;
    amount: number;
    blockHash: string | null;
    blockNumber: number | null;
    timestamp: string;
    order: {
      status: string;
      product: { name: string; category: string };
    };
  }>;
}

interface NotificationStats {
  overview: {
    last24hTotal: number;
    last24hFailed: number;
    last24hSuccess: number;
    last24hSuccessRate: number;
  };
  last7d: {
    byChannel: Array<{ channel: string; status: string; _count: number }>;
    byType: Array<{ type: string; status: string; _count: number }>;
  };
  recentFailures: Array<{
    id: string;
    type: string;
    channel: string;
    toMasked: string | null;
    status: string;
    error: string | null;
    providerSid: string | null;
    createdAt: string;
    user: { id: string; name: string; role: string };
  }>;
}

function AdminDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [apiLatencyMs, setApiLatencyMs] = useState<number | null>(null);
  const [apiUptimeSec, setApiUptimeSec] = useState<number | null>(null);
  const [pendingUsers, setPendingUsers] = useState<Array<{ id: string; name: string; email: string; role: string; createdAt: string }>>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [notificationStats, setNotificationStats] = useState<NotificationStats | null>(null);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    fetchApiHealth();
    fetchPendingUsers();
    fetchNotificationStats();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/analytics/dashboard');
      setDashboardData(response.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingUsers = async () => {
    setApprovalsLoading(true);
    try {
      const res = await api.get('/users', { params: { verified: 'false', limit: 10, page: 1 } });
      setPendingUsers(res.data.users || []);
    } catch (error) {
      console.error('Failed to fetch pending users:', error);
      setPendingUsers([]);
    } finally {
      setApprovalsLoading(false);
    }
  };

  const approveUser = async (id: string) => {
    try {
      await api.patch(`/users/${id}/verify`, { verified: true });
      toast.success('User approved');
      fetchDashboardData();
      fetchPendingUsers();
    } catch (error: unknown) {
      let message = 'Failed to approve user';
      if (axios.isAxiosError(error)) {
        const data = error.response?.data;
        if (data && typeof data === 'object') {
          const maybe = data as Record<string, unknown>;
          if (typeof maybe.error === 'string') message = maybe.error;
        }
      }
      toast.error(message);
    }
  };

  const fetchNotificationStats = async () => {
    setNotificationsLoading(true);
    try {
      const res = await api.get('/notifications/admin/stats');
      setNotificationStats(res.data);
    } catch (error) {
      console.error('Failed to fetch notification stats:', error);
      setNotificationStats(null);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const fetchApiHealth = async () => {
    try {
      const start = performance.now();
      const response = await api.get('/health');
      const end = performance.now();
      setApiLatencyMs(Math.round(end - start));
      setApiUptimeSec(typeof response.data?.uptime === 'number' ? Math.round(response.data.uptime) : null);
    } catch {
      // Non-fatal: admin dashboard should still load
      setApiLatencyMs(null);
      setApiUptimeSec(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to load dashboard</h2>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Admin Dashboard 👨‍💼
          </h1>
          <p className="text-gray-600 mt-2">
            Monitor and manage the AgriConnect platform
          </p>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData.overview.totalUsers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Package className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Products</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData.overview.totalProducts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData.overview.totalOrders}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Transactions</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData.overview.totalTransactions}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">₹{dashboardData.overview.totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'overview', name: 'Overview', icon: BarChart3 },
                { id: 'users', name: 'Users', icon: Users },
                { id: 'approvals', name: 'Approvals', icon: Shield },
                { id: 'notifications', name: 'Notifications', icon: Bell },
                { id: 'products', name: 'Products', icon: Package },
                { id: 'activity', name: 'Activity', icon: Activity },
                { id: 'blockchain', name: 'Blockchain', icon: Link2 }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="h-4 w-4 mr-2" />
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Product Categories */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Categories</h3>
                  <div className="space-y-3">
                    {dashboardData.productCategories.map((category) => (
                      <div key={category.category} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">
                          {category.category.charAt(0) + category.category.slice(1).toLowerCase()}
                        </span>
                        <span className="text-sm text-gray-600">{category._count.category} products</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Order Status */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Status Distribution</h3>
                  <div className="space-y-3">
                    {dashboardData.orderStats.map((stat) => (
                      <div key={stat.status} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">
                          {stat.status.charAt(0) + stat.status.slice(1).toLowerCase()}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          stat.status === 'DELIVERED' ? 'bg-green-100 text-green-800' :
                          stat.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {stat._count.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Farmers by Revenue</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Farmer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Location
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Sales
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Revenue
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {dashboardData.topFarmers.map((farmer) => (
                        <tr key={farmer.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{farmer.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{farmer.location || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{farmer.totalSales}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">₹{farmer.totalRevenue.toLocaleString()}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'approvals' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Pending approvals</h3>
                  <button
                    onClick={fetchPendingUsers}
                    className="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
                    disabled={approvalsLoading}
                  >
                    {approvalsLoading ? 'Refreshing…' : 'Refresh'}
                  </button>
                </div>

                {pendingUsers.length === 0 ? (
                  <p className="text-sm text-gray-600">No pending users right now.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            User
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Role
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Registered
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pendingUsers.map((u) => (
                          <tr key={u.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{u.name}</div>
                              <div className="text-xs text-gray-500">{u.email}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-gray-900">{u.role}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-gray-900">{new Date(u.createdAt).toLocaleDateString()}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <button
                                onClick={() => approveUser(u.id)}
                                className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                              >
                                Approve
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'notifications' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                  <button
                    onClick={fetchNotificationStats}
                    className="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
                    disabled={notificationsLoading}
                  >
                    {notificationsLoading ? 'Refreshing…' : 'Refresh'}
                  </button>
                </div>

                {!notificationStats ? (
                  <p className="text-sm text-gray-600">No notification stats available yet.</p>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Last 24h total</p>
                        <p className="text-2xl font-bold text-gray-900">{notificationStats.overview.last24hTotal}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Last 24h success</p>
                        <p className="text-2xl font-bold text-green-700">{notificationStats.overview.last24hSuccess}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Last 24h failed</p>
                        <p className="text-2xl font-bold text-red-700">{notificationStats.overview.last24hFailed}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Success rate</p>
                        <p className="text-2xl font-bold text-blue-700">
                          {Math.round(notificationStats.overview.last24hSuccessRate * 100)}%
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Recent failures</h4>
                      {notificationStats.recentFailures.length === 0 ? (
                        <p className="text-sm text-gray-600">No failures recorded.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Channel</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Error</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {notificationStats.recentFailures.map((f) => (
                                <tr key={f.id}>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{f.user.name}</div>
                                    <div className="text-xs text-gray-500">{f.user.role}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{f.type}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{f.channel}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{f.toMasked || '—'}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600">{f.error || '—'}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(f.createdAt).toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'products' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Analytics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Most Popular Category</h4>
                    <p className="text-2xl font-bold text-green-600">
                      {dashboardData.productCategories[0]?.category || 'N/A'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {dashboardData.productCategories[0]?._count.category || 0} products
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Average Products per Farmer</h4>
                    <p className="text-2xl font-bold text-blue-600">
                      {dashboardData.overview.totalProducts > 0 && dashboardData.topFarmers.length > 0
                        ? Math.round(dashboardData.overview.totalProducts / dashboardData.topFarmers.length)
                        : 0}
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Order Completion Rate</h4>
                    <p className="text-2xl font-bold text-purple-600">
                      {dashboardData.orderStats.length > 0
                        ? Math.round(
                            (dashboardData.orderStats.find(s => s.status === 'DELIVERED')?._count.status || 0) /
                            dashboardData.overview.totalOrders * 100
                          )
                        : 0}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'activity' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                <div className="space-y-4">
                  {dashboardData.recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {activity.user.name} ({activity.user.role.toLowerCase()})
                        </p>
                        <p className="text-sm text-gray-600">{activity.event}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(activity.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'blockchain' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Blockchain Transactions</h3>
                {dashboardData.recentTransactions.length === 0 ? (
                  <p className="text-sm text-gray-600">No transactions recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Product
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Block
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Hash
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Time
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {dashboardData.recentTransactions.map((tx) => (
                          <tr key={tx.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{tx.order.product.name}</div>
                              <div className="text-xs text-gray-500">{tx.order.product.category}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">₹{tx.amount.toLocaleString()}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{tx.blockNumber ?? '—'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-xs text-gray-600">
                                {tx.blockHash ? `${tx.blockHash.slice(0, 12)}...` : '—'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{new Date(tx.timestamp).toLocaleString()}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* System Health */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">System Health</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
                  <Shield className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Security</h3>
                <p className="text-sm text-gray-700">
                  {dashboardData.overview.unverifiedUsers} unverified users
                </p>
              </div>
              
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3">
                  <Activity className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Performance</h3>
                <p className="text-sm text-gray-700">
                  API {apiLatencyMs !== null ? `${apiLatencyMs}ms` : '—'} • uptime {apiUptimeSec !== null ? `${apiUptimeSec}s` : '—'}
                </p>
              </div>
              
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full mb-3">
                  <BarChart3 className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Analytics</h3>
                <p className="text-sm text-gray-700">
                  {dashboardData.systemHealth.eventsLast24h} events (24h)
                </p>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-full mb-3">
                  <Link2 className="h-6 w-6 text-yellow-700" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Blockchain</h3>
                <p className="text-sm text-gray-700">
                  {dashboardData.overview.totalTransactions} ok • {dashboardData.overview.failedTransactions} failed
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;