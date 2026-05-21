import { useState, useEffect } from 'react';
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
  Bell,
  Globe,
  FileText,
  ShoppingBag,
  PlusCircle,
  Trash2
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { saveToCache, getFromCache } from '../utils/offlineCache';
import { useOfflineSync } from '../hooks/useOfflineSync';
import OfflineBadge from '../components/OfflineBadge';
import AdminVerificationRules from '../components/AdminVerificationRules';

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

interface ExportApplication {
  id: string;
  userId: string;
  businessName: string;
  tinNumber: string;
  permitNumber: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  createdAt: string;
  user: {
    name: string;
    email: string;
  };
  documents: Array<{
    name: string;
    path: string;
    type: string;
  }>;
}

interface AdminAgroInput {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  category: string;
  shop: { name: string; location: string };
}

interface AgroShop {
  id: string;
  name: string;
  email?: string;
  location: string;
}

interface AccountReviewUser {
  id: string;
  name: string;
  email: string;
  role: string;
  verified: boolean;
  accountStatus: 'ACTIVE' | 'REVIEW_REQUESTED' | 'DISABLED';
  lastSeenAt?: string | null;
  riskLevel: 'low' | 'medium' | 'high';
  riskReason: string;
  complianceFlags: string[];
  recommendedAction: string;
}

interface AccountReviewSummary {
  inactiveDays: number;
  reviews: AccountReviewUser[];
  counts: {
    total: number;
    highRisk: number;
    disabled: number;
    reviewRequested: number;
  };
}

function AdminDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [apiLatencyMs, setApiLatencyMs] = useState<number | null>(null);
  const [apiUptimeSec, setApiUptimeSec] = useState<number | null>(null);
  const [notificationStats, setNotificationStats] = useState<NotificationStats | null>(null);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [accountReviews, setAccountReviews] = useState<AccountReviewSummary | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [exportApps, setExportApps] = useState<ExportApplication[]>([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [agroInputs, setAgroInputs] = useState<AdminAgroInput[]>([]);
  const [agroShops, setAgroShops] = useState<AgroShop[]>([]);
  const [agroLoading, setAgroLoading] = useState(false);
  const [showAddInputModal, setShowAddInputModal] = useState(false);
  const [newInput, setNewInput] = useState({
    name: '',
    description: '',
    price: '',
    unit: 'kg',
    category: 'Fertilizer',
    shopId: ''
  });
  const [showAddShopModal, setShowAddShopModal] = useState(false);
  const [newShop, setNewShop] = useState({
    name: '',
    email: '',
    password: '',
    location: ''
  });
  const [agroView, setAgroView] = useState<'inputs' | 'shops'>('inputs');
  const [cacheTime, setCacheTime] = useState<string | undefined>();

  const { isOnline } = useOfflineSync(() => {
    fetchDashboardData();
    fetchNotificationStats();
    fetchAccountReviews();
  });

  useEffect(() => {
    fetchDashboardData();
    fetchApiHealth();
    fetchAccountReviews();
    fetchNotificationStats();
    fetchExportApplications();
    fetchAdminAgroData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/analytics/dashboard');
      setDashboardData(response.data);
      saveToCache('admin.dashboard', response.data);
      setCacheTime(undefined);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      if (axios.isAxiosError(error) && !error.response) {
        const cached = getFromCache<DashboardData>('admin.dashboard');
        if (cached) {
          setDashboardData(cached.data);
          setCacheTime(cached.timestamp);
        }
        toast.error('Offline: Showing cached data', { icon: 'ðŸ“¡' });
      } else {
        toast.error('Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchExportApplications = async () => {
    setExportLoading(true);
    try {
      const res = await api.get('/export/admin/applications');
      setExportApps(res.data.applications);
    } catch (e) {
      console.error('Failed to fetch export apps');
    } finally {
      setExportLoading(false);
    }
  };

  const fetchAdminAgroData = async () => {
    setAgroLoading(true);
    try {
      const [inputsRes, shopsRes] = await Promise.all([
        api.get('/inputs/admin/list'),
        api.get('/inputs/admin/shops')
      ]);
      setAgroInputs(inputsRes.data.inputs);
      setAgroShops(shopsRes.data.shops);
      if (shopsRes.data.shops.length > 0 && !newInput.shopId) {
        setNewInput(prev => ({ ...prev, shopId: shopsRes.data.shops[0].id }));
      }
    } catch (e) {
      console.error('Failed to fetch admin agro data');
    } finally {
      setAgroLoading(false);
    }
  };

  const handleCreateAgroShop = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/inputs/admin/shops', newShop);
      toast.success('Agro-shop registered!');
      setShowAddShopModal(false);
      setNewShop({ name: '', email: '', password: '', location: '' });
      fetchAdminAgroData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to register shop');
    }
  };

  const handleCreateAgroInput = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/inputs/admin/create', newInput);
      toast.success('Agro-input created!');
      setShowAddInputModal(false);
      setNewInput({ name: '', description: '', price: '', unit: 'kg', category: 'Fertilizer', shopId: agroShops[0]?.id || '' });
      fetchAdminAgroData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to create input');
    }
  };

  const handleDeleteAgroInput = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await api.delete(`/inputs/admin/${id}`);
      toast.success('Deleted successfully');
      fetchAdminAgroData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to delete');
    }
  };

  const handleReviewExport = async (id: string, status: 'APPROVED' | 'REJECTED', reason?: string) => {
    try {
      const payload: any = { status };
      if (reason) payload.rejectionReason = reason;

      await api.patch(`/export/admin/review/${id}`, payload);
      toast.success(`Application ${status.toLowerCase()}ed`);
      fetchExportApplications();
      fetchDashboardData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to update application');
    }
  };

  const fetchNotificationStats = async () => {
    setNotificationsLoading(true);
    try {
      const res = await api.get('/notifications/admin/stats');
      setNotificationStats(res.data);
      saveToCache('admin.notifications', res.data);
    } catch (error) {
      console.error('Failed to fetch notification stats:', error);
      if (axios.isAxiosError(error) && !error.response) {
        const cached = getFromCache<NotificationStats>('admin.notifications');
        if (cached) setNotificationStats(cached.data);
      } else {
        setNotificationStats(null);
      }
    } finally {
      setNotificationsLoading(false);
    }
  };

  const fetchAccountReviews = async () => {
    setReviewLoading(true);
    try {
      const res = await api.get('/users/account-review/alerts');
      setAccountReviews(res.data);
    } catch (error) {
      console.error('Failed to fetch account review alerts:', error);
      setAccountReviews(null);
    } finally {
      setReviewLoading(false);
    }
  };

  const updateAccountStatus = async (
    userId: string,
    status: 'ACTIVE' | 'REVIEW_REQUESTED' | 'DISABLED',
    reason?: string,
  ) => {
    try {
      await api.patch(`/users/${userId}/account-status`, { status, reason });
      toast.success(status === 'DISABLED' ? 'Account disabled for review' : 'Account kept active');
      fetchAccountReviews();
      fetchDashboardData();
    } catch (error: unknown) {
      let message = 'Failed to update account status';
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
        <div className="mb-12">
          <OfflineBadge isOffline={!isOnline} timestamp={cacheTime} />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">
                Administrative Control Center
              </h1>
              <p className="text-slate-500 mt-2 font-medium">
                System-wide monitoring and multi-sector management.
              </p>
            </div>
          </div>
        </div>


        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          <div className="glass-card p-8 group hover:translate-y-[-4px] transition-all">
            <div className="flex items-center">
              <div className="p-3 bg-blue-50 rounded-2xl text-blue-600 group-hover:scale-110 transition-transform">
                <Users className="h-6 w-6" />
              </div>
              <div className="ml-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Network</p>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">{dashboardData.overview.totalUsers}</h3>
              </div>
            </div>
          </div>

          <div className="glass-card p-8 group hover:translate-y-[-4px] transition-all">
            <div className="flex items-center">
              <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform">
                <Package className="h-6 w-6" />
              </div>
              <div className="ml-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Assets</p>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">{dashboardData.overview.totalProducts}</h3>
              </div>
            </div>
          </div>

          <div className="glass-card p-8 group hover:translate-y-[-4px] transition-all">
            <div className="flex items-center">
              <div className="p-3 bg-amber-50 rounded-2xl text-amber-600 group-hover:scale-110 transition-transform">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div className="ml-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Closed Orders</p>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">{dashboardData.overview.totalOrders}</h3>
              </div>
            </div>
          </div>

          <div className="glass-card p-8 group hover:translate-y-[-4px] transition-all">
            <div className="flex items-center">
              <div className="p-3 bg-purple-50 rounded-2xl text-purple-600 group-hover:scale-110 transition-transform">
                <Shield className="h-6 w-6" />
              </div>
              <div className="ml-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Validations</p>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">{dashboardData.overview.totalTransactions}</h3>
              </div>
            </div>
          </div>

          <div className="glass-card p-8 group hover:translate-y-[-4px] transition-all">
            <div className="flex items-center">
              <div className="p-3 bg-slate-900 rounded-2xl text-white group-hover:scale-110 transition-transform">
                <DollarSign className="h-6 w-6" />
              </div>
              <div className="ml-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">System Yield</p>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                  <span className="text-[10px] font-bold block mb-1 opacity-40">UGX</span>
                  {dashboardData.overview.totalRevenue.toLocaleString()}
                </h3>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="glass-card mb-12">
          <div className="border-b border-slate-100 overflow-x-auto">
            <nav className="flex space-x-8 px-10">
              {[
                { id: 'overview', name: 'Overview', icon: BarChart3 },
                { id: 'financials', name: 'Financials', icon: FileText },
                { id: 'users', name: 'Users', icon: Users },
                { id: 'approvals', name: 'Account Reviews', icon: Shield },
                { id: 'exports', name: 'Exports', icon: Globe },
                { id: 'notifications', name: 'Notifications', icon: Bell },
                { id: 'products', name: 'Products', icon: Package },
                { id: 'activity', name: 'Activity', icon: Activity },
                { id: 'blockchain', name: 'Blockchain', icon: Link2 },
                { id: 'agro', name: 'Agro-Inputs', icon: ShoppingBag },
                { id: 'verification', name: 'Private Rules', icon: Shield }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
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
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${stat.status === 'DELIVERED' ? 'bg-green-100 text-green-800' :
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

            {activeTab === 'financials' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Financial Statements</h3>
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center transition-colors shadow-sm"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Download Statement
                  </button>
                </div>

                <div className="bg-white rounded-xl shadow-sm border p-8 print:shadow-none print:border-none">
                  <div className="text-center mb-8 border-b pb-6">
                    <h2 className="text-2xl font-bold text-gray-900 uppercase tracking-widest mb-1">DAFIS Platform</h2>
                    <p className="text-gray-500">Consolidated Financial Statement</p>
                    <p className="text-sm text-gray-400 mt-2">Generated: {new Date().toLocaleDateString()}</p>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Revenue Overview</h4>
                      <div className="flex justify-between items-center py-3 border-b">
                        <span className="text-gray-700">Gross Merchandise Volume (GMV)</span>
                        <span className="font-semibold">UGX {dashboardData.overview.totalRevenue.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b">
                        <span className="text-gray-700">Platform Fees (Estimated 2.5%)</span>
                        <span className="font-semibold text-green-600">UGX {(dashboardData.overview.totalRevenue * 0.025).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b">
                        <span className="text-gray-700">Farmer Disbursements</span>
                        <span className="font-semibold text-gray-900">UGX {(dashboardData.overview.totalRevenue * 0.975).toLocaleString()}</span>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 mt-8">Transaction Metrics</h4>
                      <div className="flex justify-between items-center py-3 border-b">
                        <span className="text-gray-700">Total Successful Transactions</span>
                        <span className="font-semibold">{dashboardData.overview.totalTransactions}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b">
                        <span className="text-gray-700">Failed Transactions</span>
                        <span className="font-semibold text-red-600">{dashboardData.overview.failedTransactions || 0}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b">
                        <span className="text-gray-700">Average Order Value</span>
                        <span className="font-semibold">
                          UGX {dashboardData.overview.totalOrders > 0 
                                ? Math.round(dashboardData.overview.totalRevenue / dashboardData.overview.totalOrders).toLocaleString() 
                                : 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-12 pt-6 border-t text-center text-xs text-gray-400">
                    <p>This document is generated automatically by the DAFIS system.</p>
                    <p>Not rendering for tax purposes without an official seal.</p>
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
                            <div className="text-sm text-gray-900">UGX {farmer.totalRevenue.toLocaleString()}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'approvals' && (
              <div className="space-y-8">
                <div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Account review alerts</h3>
                      <p className="text-sm text-gray-600">
                        Automated checks flag accounts that need a final administrator decision.
                      </p>
                    </div>
                    <button
                      onClick={fetchAccountReviews}
                      className="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
                      disabled={reviewLoading}
                    >
                      {reviewLoading ? 'Checking...' : 'Check now'}
                    </button>
                  </div>

                  {(accountReviews?.reviews.length || 0) === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
                      No inactivity or compliance alerts need admin action.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {accountReviews?.reviews.map((review) => (
                        <div key={review.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-bold text-gray-900">{review.name}</h4>
                                <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-gray-700">
                                  {review.role}
                                </span>
                                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                                  {review.riskLevel} risk
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-gray-700">{review.email}</p>
                              <p className="mt-2 text-sm font-semibold text-amber-900">{review.recommendedAction}</p>
                              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
                                {[review.riskReason, ...review.complianceFlags].map((reason) => (
                                  <li key={reason}>{reason}</li>
                                ))}
                              </ul>
                              {review.lastSeenAt && (
                                <p className="mt-2 text-xs text-gray-500">
                                  Last activity: {new Date(review.lastSeenAt).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                              <button
                                onClick={() => updateAccountStatus(review.id, 'ACTIVE', 'Admin cleared automated review alert')}
                                className="rounded-lg border border-green-600 px-4 py-2 text-sm font-bold text-green-700 hover:bg-green-50"
                              >
                                Keep active
                              </button>
                              <button
                                onClick={() => {
                                  const suggestedReason = [review.riskReason, ...review.complianceFlags].join('; ');
                                  const reason = prompt('Reason for disabling this account?', suggestedReason);
                                  if (reason !== null) updateAccountStatus(review.id, 'DISABLED', reason || review.recommendedAction);
                                }}
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
                              >
                                Disable account
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                    {notificationsLoading ? 'Refreshingâ€¦' : 'Refresh'}
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
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{f.toMasked || 'â€”'}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600">{f.error || 'â€”'}</td>
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

            {activeTab === 'exports' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Export Verification Applications</h3>
                  <button
                    onClick={fetchExportApplications}
                    className="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
                    disabled={exportLoading}
                  >
                    {exportLoading ? 'Refreshingâ€¦' : 'Refresh'}
                  </button>
                </div>

                {exportApps.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed">
                    <Globe className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No pending export applications.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {exportApps.map((app) => (
                      <div key={app.id} className="bg-white border rounded-xl overflow-hidden shadow-sm">
                        <div className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h4 className="text-xl font-bold text-gray-900">{app.businessName}</h4>
                              <p className="text-sm text-gray-500">Submitted by {app.user.name} ({app.user.email})</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${app.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                              app.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                              {app.status}
                            </span>
                          </div>

                          <div className="grid md:grid-cols-3 gap-6 mb-6">
                            <div className="p-4 bg-gray-50 rounded-lg">
                              <p className="text-xs font-bold text-gray-400 uppercase mb-1">TIN Number</p>
                              <p className="font-mono font-bold text-gray-900">{app.tinNumber}</p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-lg">
                              <p className="text-xs font-bold text-gray-400 uppercase mb-1">Submission Date</p>
                              <p className="font-bold text-gray-900">{new Date(app.createdAt).toLocaleDateString()}</p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-lg md:col-span-1">
                              <p className="text-xs font-bold text-gray-400 uppercase mb-1">Supporting Docs</p>
                              <div className="flex flex-wrap gap-2">
                                {app.documents.map((doc: any, idx: number) => (
                                  <a
                                    key={idx}
                                    href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/uploads/documents/${doc.path ? doc.path.split(/[\\/]/).pop() : ''}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-2 py-1 bg-white border rounded text-xs font-medium text-blue-600 hover:bg-blue-50"
                                  >
                                    <FileText className="h-3 w-3 mr-1" />
                                    View Doc
                                  </a>
                                ))}
                              </div>
                            </div>
                          </div>

                          {app.status === 'PENDING' && (
                            <div className="flex gap-3 justify-end pt-4 border-t">
                              <button
                                onClick={() => {
                                  const reason = prompt('Enter rejection reason (optional):');
                                  handleReviewExport(app.id, 'REJECTED', reason || undefined);
                                }}
                                className="px-4 py-2 border-2 border-red-600 text-red-600 rounded-lg font-bold hover:bg-red-50 transition"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => handleReviewExport(app.id, 'APPROVED')}
                                className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition"
                              >
                                Approve Export License
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                              <div className="text-sm text-gray-900">â‚¹{tx.amount.toLocaleString()}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{tx.blockNumber ?? 'â€”'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-xs text-gray-600">
                                {tx.blockHash ? `${tx.blockHash.slice(0, 12)}...` : 'â€”'}
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
            {activeTab === 'agro' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setAgroView('inputs')}
                      className={`px-4 py-2 rounded-xl font-bold transition ${agroView === 'inputs' ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      Inputs
                    </button>
                    <button 
                      onClick={() => setAgroView('shops')}
                      className={`px-4 py-2 rounded-xl font-bold transition ${agroView === 'shops' ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      Agro-Shops
                    </button>
                  </div>
                  
                  {agroView === 'inputs' ? (
                    <button
                      onClick={() => setShowAddInputModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition shadow-lg shadow-green-600/20"
                    >
                      <PlusCircle className="h-5 w-5" /> Add New Input
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowAddShopModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-600/20"
                    >
                      <PlusCircle className="h-5 w-5" /> Register New Shop
                    </button>
                  )}
                </div>

                {agroLoading ? (
                  <div className="py-12 flex justify-center">
                    <LoadingSpinner />
                  </div>
                ) : (
                  <>
                    {agroView === 'inputs' ? (
                      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-widest">Item</th>
                              <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-widest">Category</th>
                              <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-widest">Price</th>
                              <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-widest">Shop</th>
                              <th className="px-6 py-4 text-right text-xs font-black text-gray-500 uppercase tracking-widest">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {agroInputs.map((input) => (
                              <tr key={input.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="text-sm font-bold text-gray-900">{input.name}</div>
                                  <div className="text-xs text-gray-500 truncate max-w-[200px]">{input.description}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black uppercase">
                                    {input.category}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm font-black text-green-600">
                                  UGX {input.price.toLocaleString()}
                                  <span className="text-[10px] text-gray-400 font-bold ml-1">/{input.unit}</span>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm font-medium text-gray-900">{input.shop.name}</div>
                                  <div className="text-xs text-gray-500">{input.shop.location}</div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <button
                                    onClick={() => handleDeleteAgroInput(input.id)}
                                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                    <Trash2 className="h-5 w-5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {agroInputs.length === 0 && (
                          <div className="py-20 text-center text-gray-400 font-medium">No agro-inputs found. Add one to get started.</div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-widest">Shop Name</th>
                              <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-widest">Email</th>
                              <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-widest">Location</th>
                              <th className="px-6 py-4 text-right text-xs font-black text-gray-500 uppercase tracking-widest">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {agroShops.map((shop) => (
                              <tr key={shop.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="text-sm font-bold text-gray-900">{shop.name}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm text-gray-600">{shop.email || 'N/A'}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm text-gray-900">{shop.location}</div>
                                </td>
                                <td className="px-6 py-4 text-right text-xs text-gray-400 font-bold">
                                  Registered Supplier
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {agroShops.length === 0 && (
                          <div className="py-20 text-center text-gray-400 font-medium">No shops found. Register your first supplier.</div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {activeTab === 'verification' && (
              <AdminVerificationRules />
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
                  API {apiLatencyMs !== null ? `${apiLatencyMs}ms` : 'â€”'} â€¢ uptime {apiUptimeSec !== null ? `${apiUptimeSec}s` : 'â€”'}
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

        {/* Add Input Modal */}
        {showAddInputModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="bg-green-600 px-8 py-6 text-white">
                <h3 className="text-2xl font-black">Add Agro Input</h3>
                <p className="text-green-100 text-sm mt-1">List a new product in the Agro-Input store.</p>
              </div>

              <form onSubmit={handleCreateAgroInput} className="p-8 space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  <div className="col-span-2">
                    <label className="block text-xs font-black text-gray-500 uppercase mb-2">Item Name</label>
                    <input
                      required
                      type="text"
                      className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-green-500 transition-all outline-none"
                      placeholder="e.g. NPK Fertilizer"
                      value={newInput.name}
                      onChange={e => setNewInput({ ...newInput, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase mb-2">Category</label>
                    <select
                      className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-green-500 transition-all outline-none appearance-none bg-white font-bold"
                      value={newInput.category}
                      onChange={e => setNewInput({ ...newInput, category: e.target.value })}
                    >
                      <option>Fertilizer</option>
                      <option>Seedling</option>
                      <option>Tools</option>
                      <option>Pesticide</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase mb-2">Unit</label>
                    <input
                      required
                      type="text"
                      className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-green-500 transition-all outline-none"
                      placeholder="e.g. 50kg bag"
                      value={newInput.unit}
                      onChange={e => setNewInput({ ...newInput, unit: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase mb-2">Price (UGX)</label>
                    <input
                      required
                      type="number"
                      className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-green-500 transition-all outline-none"
                      value={newInput.price}
                      onChange={e => setNewInput({ ...newInput, price: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase mb-2">Assign to Shop</label>
                    <select
                      required
                      className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-green-500 transition-all outline-none appearance-none bg-white font-bold text-green-700"
                      value={newInput.shopId}
                      onChange={e => setNewInput({ ...newInput, shopId: e.target.value })}
                    >
                      {agroShops.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.location})</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-black text-gray-500 uppercase mb-2">Description</label>
                    <textarea
                      className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-green-500 transition-all outline-none min-h-[100px]"
                      placeholder="Nutrient details, usage instructions..."
                      value={newInput.description}
                      onChange={e => setNewInput({ ...newInput, description: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddInputModal(false)}
                    className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] py-4 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition shadow-lg shadow-green-600/30"
                  >
                    Create Item
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Shop Modal */}
        {showAddShopModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="bg-blue-600 px-8 py-6 text-white">
                <h3 className="text-2xl font-black">Register Agro-Shop</h3>
                <p className="text-blue-100 text-sm mt-1">Create a new supplier account for the marketplace.</p>
              </div>

              <form onSubmit={handleCreateAgroShop} className="p-8 space-y-5">
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase mb-2">Shop Name</label>
                  <input
                    required
                    type="text"
                    className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-blue-500 transition-all outline-none"
                    placeholder="e.g. Jinja Agro Suppliers"
                    value={newShop.name}
                    onChange={e => setNewShop({ ...newShop, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase mb-2">Email Address</label>
                  <input
                    required
                    type="email"
                    className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-blue-500 transition-all outline-none"
                    placeholder="shop@example.com"
                    value={newShop.email}
                    onChange={e => setNewShop({ ...newShop, email: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase mb-2">Temp Password</label>
                    <input
                      required
                      type="password"
                      className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-blue-500 transition-all outline-none"
                      value={newShop.password}
                      onChange={e => setNewShop({ ...newShop, password: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase mb-2">District/City</label>
                    <input
                      required
                      type="text"
                      className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-blue-500 transition-all outline-none"
                      placeholder="e.g. Mbale"
                      value={newShop.location}
                      onChange={e => setNewShop({ ...newShop, location: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddShopModal(false)}
                    className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-600/20"
                  >
                    Register Shop
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;
