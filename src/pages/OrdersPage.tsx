import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Package, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Truck, 
  Star,
  Eye,
  MessageCircle,
  Filter
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import api from '../services/api';
import { toast } from 'react-hot-toast';

interface Order {
  id: string;
  quantity: number;
  totalPrice: number;
  status: 'PENDING' | 'CONFIRMED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  deliveryDate: string;
  notes: string;
  createdAt: string;
  product: {
    name: string;
    images: string;
    category: string;
    unit: string;
  };
  buyer?: {
    name: string;
    phone: string;
    location: string;
  };
  farmer?: {
    name: string;
    phone: string;
    location: string;
  };
  transaction?: {
    status: string;
    blockHash: string;
    timestamp: string;
  };
  review?: {
    rating: number;
    comment: string;
  };
}

function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [reviewData, setReviewData] = useState({
    rating: 5,
    comment: ''
  });

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await api.get('/orders/my-orders');
      setOrders(response.data.orders);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      toast.success('Order status updated successfully');
      fetchOrders();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update order status');
    }
  };

  const submitReview = async () => {
    if (!selectedOrder) return;
    
    try {
      await api.post(`/orders/${selectedOrder.id}/review`, reviewData);
      toast.success('Review submitted successfully');
      setShowReviewModal(false);
      setSelectedOrder(null);
      setReviewData({ rating: 5, comment: '' });
      fetchOrders();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to submit review');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'CONFIRMED':
        return <CheckCircle className="h-5 w-5 text-blue-500" />;
      case 'IN_TRANSIT':
        return <Truck className="h-5 w-5 text-purple-500" />;
      case 'DELIVERED':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'CANCELLED':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Package className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'CONFIRMED':
        return 'bg-blue-100 text-blue-800';
      case 'IN_TRANSIT':
        return 'bg-purple-100 text-purple-800';
      case 'DELIVERED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredOrders = statusFilter 
    ? orders.filter(order => order.status === statusFilter)
    : orders;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {user?.role === 'FARMER' ? 'Sales Orders' : 'My Orders'} 📦
          </h1>
          <p className="text-gray-600 mt-2">
            {user?.role === 'FARMER' 
              ? 'Manage orders from your customers'
              : 'Track your orders and purchase history'
            }
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center space-x-2">
                <Filter className="h-5 w-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Filter by status:</span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setStatusFilter('')}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    statusFilter === '' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All ({orders.length})
                </button>
                
                {['PENDING', 'CONFIRMED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'].map((status) => {
                  const count = orders.filter(order => order.status === status).length;
                  if (count === 0) return null;
                  
                  return (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        statusFilter === status 
                          ? getStatusColor(status)
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {status.charAt(0) + status.slice(1).toLowerCase()} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              {statusFilter ? `No ${statusFilter.toLowerCase()} orders` : 'No orders yet'}
            </h3>
            <p className="text-gray-600">
              {user?.role === 'FARMER' 
                ? 'Orders from customers will appear here'
                : 'Start shopping to see your orders here'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(order.status)}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {order.product.name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Order #{order.id.slice(-8)}
                        </p>
                      </div>
                    </div>
                    
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                      {order.status.charAt(0) + order.status.slice(1).toLowerCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Quantity</p>
                      <p className="font-medium">{order.quantity} {order.product.unit}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-600">Total Price</p>
                      <p className="font-medium text-green-600">₹{order.totalPrice.toLocaleString()}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-600">Order Date</p>
                      <p className="font-medium">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-600">
                        {user?.role === 'FARMER' ? 'Customer' : 'Farmer'}
                      </p>
                      <p className="font-medium">
                        {user?.role === 'FARMER' ? order.buyer?.name : order.farmer?.name}
                      </p>
                    </div>
                  </div>

                  {order.notes && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Order Notes:</p>
                      <p className="text-sm">{order.notes}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3">
                    {user?.role === 'FARMER' && order.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => updateOrderStatus(order.id, 'CONFIRMED')}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          Confirm Order
                        </button>
                        <button
                          onClick={() => updateOrderStatus(order.id, 'CANCELLED')}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                        >
                          Cancel Order
                        </button>
                      </>
                    )}
                    
                    {user?.role === 'FARMER' && order.status === 'CONFIRMED' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'IN_TRANSIT')}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                      >
                        Mark as In Transit
                      </button>
                    )}
                    
                    {user?.role === 'FARMER' && order.status === 'IN_TRANSIT' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'DELIVERED')}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                      >
                        Mark as Delivered
                      </button>
                    )}
                    
                    {user?.role === 'BUYER' && order.status === 'DELIVERED' && !order.review && (
                      <button
                        onClick={() => {
                          setSelectedOrder(order);
                          setShowReviewModal(true);
                        }}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm flex items-center"
                      >
                        <Star className="h-4 w-4 mr-1" />
                        Write Review
                      </button>
                    )}
                    
                    {order.review && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Star className="h-4 w-4 text-yellow-400 fill-current mr-1" />
                        <span>Rated {order.review.rating}/5</span>
                      </div>
                    )}
                    
                    {order.transaction && (
                      <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm flex items-center">
                        <Eye className="h-4 w-4 mr-1" />
                        View Transaction
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {showReviewModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Write a Review</h2>
              
              <div className="mb-4">
                <h3 className="font-medium text-gray-900 mb-2">{selectedOrder.product.name}</h3>
                <p className="text-sm text-gray-600">
                  Order from {selectedOrder.farmer?.name}
                </p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rating
                  </label>
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setReviewData({ ...reviewData, rating: star })}
                        className="focus:outline-none"
                      >
                        <Star
                          className={`h-8 w-8 ${
                            star <= reviewData.rating
                              ? 'text-yellow-400 fill-current'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Comment (Optional)
                  </label>
                  <textarea
                    rows={4}
                    value={reviewData.comment}
                    onChange={(e) => setReviewData({ ...reviewData, comment: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Share your experience with this product..."
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowReviewModal(false);
                    setSelectedOrder(null);
                    setReviewData({ rating: 5, comment: '' });
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitReview}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Submit Review
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrdersPage;