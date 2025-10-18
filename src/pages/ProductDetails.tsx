import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowLeft, 
  MapPin, 
  User, 
  Star, 
  ShoppingCart, 
  Phone, 
  Calendar,
  Package,
  Leaf,
  Shield,
  TrendingUp
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import api from '../services/api';
import { toast } from 'react-hot-toast';

interface ProductDetails {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  quantity: number;
  unit: string;
  location: string;
  organic: boolean;
  harvestDate: string;
  expiryDate: string;
  createdAt: string;
  avgRating: number;
  farmer: {
    id: string;
    name: string;
    location: string;
    phone: string;
    verified: boolean;
    createdAt: string;
  };
  reviews: Array<{
    id: string;
    rating: number;
    comment: string;
    createdAt: string;
    user: {
      name: string;
      avatar: string;
    };
  }>;
  priceHistory: Array<{
    price: number;
    date: string;
  }>;
}

function ProductDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');

  useEffect(() => {
    if (id) {
      fetchProduct();
    }
  }, [id]);

  const fetchProduct = async () => {
    try {
      const response = await api.get(`/products/${id}`);
      setProduct(response.data);
    } catch (error: any) {
      console.error('Failed to fetch product:', error);
      if (error.response?.status === 404) {
        toast.error('Product not found');
        navigate('/marketplace');
      } else {
        toast.error('Failed to load product details');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOrder = async () => {
    if (!user) {
      toast.error('Please login to place an order');
      navigate('/login');
      return;
    }
    
    if (user.role !== 'BUYER') {
      toast.error('Only buyers can place orders');
      return;
    }

    try {
      await api.post('/orders', {
        productId: id,
        quantity: orderQuantity,
        notes: orderNotes
      });
      
      toast.success('Order placed successfully!');
      setShowOrderModal(false);
      navigate('/orders');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to place order');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Product not found</h2>
          <button
            onClick={() => navigate('/marketplace')}
            className="text-green-600 hover:text-green-700 font-medium"
          >
            ← Back to Marketplace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Product Image */}
          <div className="bg-white rounded-lg shadow">
            <div className="h-96 bg-gradient-to-br from-green-100 to-green-200 rounded-t-lg flex items-center justify-center">
              <Leaf className="h-32 w-32 text-green-600" />
            </div>
            
            {/* Product Badges */}
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                {product.organic && (
                  <span className="bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full">
                    🌱 Organic
                  </span>
                )}
                {product.farmer.verified && (
                  <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
                    ✓ Verified Farmer
                  </span>
                )}
                <span className="bg-gray-100 text-gray-800 text-sm font-medium px-3 py-1 rounded-full">
                  {product.category}
                </span>
              </div>
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
              <div className="flex items-center space-x-4">
                <span className="text-3xl font-bold text-green-600">
                  ₹{product.price}
                </span>
                <span className="text-gray-600">per {product.unit}</span>
                {product.avgRating > 0 && (
                  <div className="flex items-center">
                    <Star className="h-5 w-5 text-yellow-400 fill-current" />
                    <span className="ml-1 font-medium">{product.avgRating.toFixed(1)}</span>
                    <span className="text-gray-500 ml-1">({product.reviews.length} reviews)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            {product.description && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
                <p className="text-gray-700 leading-relaxed">{product.description}</p>
              </div>
            )}

            {/* Product Details */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Product Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center">
                  <Package className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">Available:</span>
                  <span className="ml-1 font-medium">{product.quantity} {product.unit}</span>
                </div>
                
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">Location:</span>
                  <span className="ml-1 font-medium">{product.location}</span>
                </div>
                
                {product.harvestDate && (
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">Harvested:</span>
                    <span className="ml-1 font-medium">
                      {new Date(product.harvestDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
                
                {product.expiryDate && (
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">Best Before:</span>
                    <span className="ml-1 font-medium">
                      {new Date(product.expiryDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Farmer Info */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Farmer Information</h3>
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <User className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center">
                    <h4 className="font-medium text-gray-900">{product.farmer.name}</h4>
                    {product.farmer.verified && (
                      <Shield className="h-4 w-4 text-blue-500 ml-2" title="Verified Farmer" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600 flex items-center mt-1">
                    <MapPin className="h-4 w-4 mr-1" />
                    {product.farmer.location}
                  </p>
                  {product.farmer.phone && (
                    <p className="text-sm text-gray-600 flex items-center mt-1">
                      <Phone className="h-4 w-4 mr-1" />
                      {product.farmer.phone}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Farming since {new Date(product.farmer.createdAt).getFullYear()}
                  </p>
                </div>
              </div>
            </div>

            {/* Order Section */}
            {user && user.role === 'BUYER' && product.quantity > 0 && (
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Place Order</h3>
                <div className="flex items-center space-x-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity ({product.unit})
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={product.quantity}
                      value={orderQuantity}
                      onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 1)}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-gray-600 mb-1">Total Price</div>
                    <div className="text-xl font-bold text-green-600">
                      ₹{(product.price * orderQuantity).toLocaleString()}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowOrderModal(true)}
                  className="w-full mt-4 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Place Order
                </button>
              </div>
            )}

            {/* Out of Stock */}
            {product.quantity === 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-medium">This product is currently out of stock.</p>
              </div>
            )}
          </div>
        </div>

        {/* Reviews Section */}
        {product.reviews.length > 0 && (
          <div className="mt-12 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Customer Reviews</h2>
            </div>
            <div className="p-6">
              <div className="space-y-6">
                {product.reviews.map((review) => (
                  <div key={review.id} className="border-b border-gray-200 pb-6 last:border-b-0">
                    <div className="flex items-start space-x-4">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-gray-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-medium text-gray-900">{review.user.name}</h4>
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < review.rating
                                    ? 'text-yellow-400 fill-current'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm text-gray-500">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {review.comment && (
                          <p className="text-gray-700">{review.comment}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Price History */}
        {product.priceHistory.length > 1 && (
          <div className="mt-8 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Price History
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-2">
                {product.priceHistory.slice(0, 5).map((entry, index) => (
                  <div key={index} className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-600">
                      {new Date(entry.date).toLocaleDateString()}
                    </span>
                    <span className="font-medium">₹{entry.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Confirm Order</h2>
              
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900">{product.name}</h3>
                  <p className="text-sm text-gray-600">
                    {orderQuantity} {product.unit} × ₹{product.price} = ₹{(product.price * orderQuantity).toLocaleString()}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Order Notes (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Any special instructions or requirements..."
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleOrder}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Confirm Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductDetails;