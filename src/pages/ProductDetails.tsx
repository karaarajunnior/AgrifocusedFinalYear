import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { t } from '../utils/translation';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
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
  TrendingUp,
  MessageSquare,
  Navigation,
  UploadCloud,
  Sparkles,
  Image as ImageIcon
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import TrustBadge from "../components/TrustBadge";
import { useTrustScore } from "../hooks/useTrustScore";
import { QRCodeSVG } from 'qrcode.react';
import LocationLink from '../components/LocationLink';
import { getProductImageUrls } from '../utils/productImages';

interface ProductDetails {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  quantity: number;
  unit: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  organic: boolean;
  harvestDate: string;
  expiryDate: string;
  createdAt: string;
  avgRating: number;
  farmer: {
    id: string;
    name: string;
    location: string;
    latitude: number | null;
    longitude: number | null;
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
  images?: string | string[] | null;
}

interface QualityAnalysis {
  score: number;
  grade: string;
  freshness: string;
  sizeUniformity: string;
  visibleDefects: string;
  recommendations: string[];
  specifications: {
    imageSize: string;
    fileType: string;
    brightness: string;
    estimatedCategory: string;
  };
}

const TraceabilityJourney: React.FC<{
  origin: string;
  location: string;
  originLatitude?: number | null;
  originLongitude?: number | null;
  productLatitude?: number | null;
  productLongitude?: number | null;
}> = ({ origin, location, originLatitude, originLongitude, productLatitude, productLongitude }) => {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
                <Navigation className="h-24 w-24" />
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8">Product Journey Map</h3>
            <div className="relative flex justify-between items-center px-4">
                {/* Connecting Line */}
                <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -translate-y-1/2 z-0">
                    <div className="h-full bg-emerald-500 w-full animate-progress" />
                </div>
                
                {/* Points */}
                <div className="relative z-10 flex flex-col items-center group">
                    <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                        <Leaf className="h-6 w-6" />
                    </div>
                    <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('origin')}</p>
                    <LocationLink
                      location={origin || 'Local Farm'}
                      latitude={originLatitude}
                      longitude={originLongitude}
                      className="mt-1 flex items-center text-xs font-bold text-slate-900 hover:text-emerald-700"
                      iconClassName="h-3 w-3"
                    />
                    <div className="mt-2 p-2 bg-emerald-50 rounded-lg border border-emerald-100 flex flex-col items-center">
                        <span className="text-[8px] font-black text-emerald-800 uppercase leading-none mb-1">{t('exact_origin')}</span>
                        <span className="text-[7px] text-emerald-600 tabular-nums font-bold">
                          {originLatitude != null && originLongitude != null
                            ? `${originLatitude.toFixed(5)}, ${originLongitude.toFixed(5)}`
                            : 'Tap location to open map'}
                        </span>
                    </div>
                </div>

                <div className="relative z-10 flex flex-col items-center group">
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
                        <Package className="h-6 w-6" />
                    </div>
                    <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('processing')}</p>
                    <p className="text-xs font-bold text-slate-900">KAWA Verified</p>
                </div>

                <div className="relative z-10 flex flex-col items-center group">
                    <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-slate-900/20 group-hover:scale-110 transition-transform">
                        <MapPin className="h-6 w-6" />
                    </div>
                    <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('current')}</p>
                    <LocationLink
                      location={location}
                      latitude={productLatitude ?? originLatitude}
                      longitude={productLongitude ?? originLongitude}
                      className="mt-1 flex items-center text-xs font-bold text-slate-900 hover:text-emerald-700"
                      iconClassName="h-3 w-3"
                    />
                </div>
            </div>
        </div>
    );
};

function ProductDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const { trust: farmerTrust } = useTrustScore(product?.farmer?.id);
  const [trace, setTrace] = useState<{ batches: Array<{ id: string; batchCode: string; harvestedAt?: string | null; events: Array<{ id: string; type: string; note?: string | null; location?: string | null; createdAt: string }> }> } | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<QualityAnalysis | null>(null);
  const [analysisPreview, setAnalysisPreview] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => () => {
    if (analysisPreview) URL.revokeObjectURL(analysisPreview);
  }, [analysisPreview]);

  useEffect(() => {
    if (id) {
      fetchProduct();
    }
  }, [id]);

  const fetchProduct = async () => {
    try {
      const response = await api.get(`/products/${id}`);
      setProduct(response.data);
      // Traceability is public
      try {
        const t = await api.get(`/trace/product/${id}`);
        setTrace(t.data || null);
      } catch {
        setTrace(null);
      }
    } catch (error: unknown) {
      console.error('Failed to fetch product:', error);
      if (axios.isAxiosError(error) && error.response?.status === 404) {
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
    } catch (error: unknown) {
      let message = 'Failed to place order';
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

  const analyzeImage = async (file: File) => {
    setAnalyzing(true);
    setAnalysis(null);
    setPreviewFailed(false);
    setAnalysisPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    try {
      const form = new FormData();
      form.append('image', file);
      form.append('productName', product?.name || '');
      form.append('category', product?.category || '');
      const res = await api.post('/products/analyze-image', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAnalysis(res.data.analysis);
      toast.success('AI quality analysis complete');
    } catch (error) {
      toast.error('Failed to analyze product image');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyzeDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) await analyzeImage(file);
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

  const productImages = getProductImageUrls(product.images);

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
            <div className="h-96 bg-gradient-to-br from-green-100 to-green-200 rounded-t-lg flex items-center justify-center overflow-hidden">
              {productImages[0] ? (
                <img src={productImages[0]} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <Leaf className="h-32 w-32 text-green-600" />
              )}
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

          <div className="bg-white rounded-lg shadow p-6 border border-emerald-100">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              <h3 className="text-lg font-bold text-gray-900">AI Product Quality Check</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Buyers can drag a farmer photo or upload a fresh image to estimate visible quality, defects, and listing specifications.
            </p>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleAnalyzeDrop}
              className="border-2 border-dashed border-emerald-200 rounded-2xl p-6 text-center bg-emerald-50/50"
            >
              {!previewFailed && analysisPreview ? (
                <img
                  src={analysisPreview}
                  alt="Analysis preview"
                  className="mx-auto mb-4 max-h-40 rounded-xl object-cover"
                  onError={() => setPreviewFailed(true)}
                />
              ) : !previewFailed && productImages[0] ? (
                <img
                  src={productImages[0]}
                  alt="Farmer product"
                  className="mx-auto mb-4 max-h-40 rounded-xl object-cover"
                  onError={() => setPreviewFailed(true)}
                />
              ) : (
                <div className="mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-2xl bg-white border border-emerald-100">
                  <ImageIcon className="h-10 w-10 text-emerald-500" />
                </div>
              )}
              <p className="text-sm font-semibold text-gray-700">Drag and drop an image here</p>
              <label className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold cursor-pointer hover:bg-emerald-700">
                <UploadCloud className="h-4 w-4" />
                Upload image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && analyzeImage(e.target.files[0])}
                />
              </label>
            </div>
            {analyzing && <p className="mt-4 text-sm font-bold text-emerald-700">Analyzing visible quality...</p>}
            {analysis && (
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="p-4 rounded-xl bg-slate-50">
                  <p className="text-xs uppercase font-black text-slate-400">Score</p>
                  <p className="text-2xl font-black text-emerald-700">{analysis.score}/100 · {analysis.grade}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50">
                  <p className="text-xs uppercase font-black text-slate-400">Freshness</p>
                  <p className="font-bold">{analysis.freshness}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50">
                  <p className="text-xs uppercase font-black text-slate-400">Uniformity</p>
                  <p className="font-bold">{analysis.sizeUniformity}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50">
                  <p className="text-xs uppercase font-black text-slate-400">Visible defects</p>
                  <p className="font-bold">{analysis.visibleDefects}</p>
                </div>
                <div className="sm:col-span-2 p-4 rounded-xl bg-amber-50 border border-amber-100">
                  <p className="text-xs uppercase font-black text-amber-700 mb-2">AI recommendations</p>
                  <ul className="list-disc list-inside text-amber-900 space-y-1">
                    {analysis.recommendations.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
              <div className="flex items-center space-x-4">
                <span className="text-3xl font-bold text-green-600">
                  UGX {product.price}
                </span>
                <span className="text-gray-600">per {product.unit}</span>
                {farmerTrust ? <TrustBadge trust={farmerTrust} /> : null}
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
                
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-gray-600">Location:</span>
                  <LocationLink
                    location={product.location}
                    latitude={product.latitude ?? product.farmer.latitude}
                    longitude={product.longitude ?? product.farmer.longitude}
                    className="mt-1 flex items-center text-gray-800 hover:text-green-700"
                  />
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

            <TraceabilityJourney
              origin={product.farmer.location}
              location={product.location}
              originLatitude={product.farmer.latitude}
              originLongitude={product.farmer.longitude}
              productLatitude={product.latitude}
              productLongitude={product.longitude}
            />

            {/* Traceability */}
            {trace?.batches?.length ? (
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Traceability timeline</h3>
                <div className="space-y-4">
                  {trace.batches.slice(0, 2).map((b) => (
                    <div key={b.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-900">Batch: {b.batchCode}</div>
                        <button 
                          onClick={() => {
                            setSelectedBatchId(b.id);
                            setShowQRModal(true);
                          }}
                          className="text-[10px] bg-green-600 text-white px-2 py-1 rounded font-bold uppercase tracking-wider hover:bg-green-700 transition-colors"
                        >
                          Generate QR
                        </button>
                        <div className="text-xs text-gray-500">
                          {b.harvestedAt ? new Date(b.harvestedAt).toLocaleDateString() : "—"}
                        </div>
                      </div>
                      <div className="mt-2 space-y-2">
                        {b.events.slice(0, 6).map((e) => (
                          <div key={e.id} className="text-sm text-gray-700">
                            <span className="font-medium">{e.type}</span>
                            {e.location ? <span className="text-gray-500"> • {e.location}</span> : null}
                            <span className="text-gray-500"> • {new Date(e.createdAt).toLocaleString()}</span>
                            {e.note ? <div className="text-xs text-gray-600 mt-0.5">{e.note}</div> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Farmer Info */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Farmer Information</h3>
                {user && user.id !== product.farmer.id && (
                  <button
                    onClick={() => navigate(`/chat?userId=${product.farmer.id}`)}
                    className="text-sm bg-green-50 text-green-700 px-3 py-1.5 rounded-lg font-medium hover:bg-green-100 transition-colors flex items-center"
                  >
                    <MessageSquare className="h-4 w-4 mr-1.5" />
                    Message Farmer
                  </button>
                )}
              </div>
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <User className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center">
                    <h4 className="font-medium text-gray-900">{product.farmer.name}</h4>
                    {product.farmer.verified && (
                      <span title="Verified Farmer">
                        <Shield className="h-4 w-4 text-blue-500 ml-2" />
                      </span>
                    )}
                  </div>
                  <LocationLink
                    location={product.farmer.location}
                    latitude={product.farmer.latitude}
                    longitude={product.farmer.longitude}
                    className="mt-1 flex items-center text-sm text-gray-600 hover:text-green-700"
                  />
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
                      UGX {(product.price * orderQuantity).toLocaleString()}
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
                    <span className="font-medium">UGX {entry.price.toLocaleString()}</span>
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
                    {orderQuantity} {product.unit} × UGX {product.price} = UGX {(product.price * orderQuantity).toLocaleString()}
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

      {/* QR Traceability Modal */}
      {showQRModal && selectedBatchId && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
          <div className="bg-white rounded-[32px] max-w-sm w-full p-8 text-center shadow-2xl scale-in-center">
            <div className="mb-6">
              <div className="h-12 w-12 bg-green-100 rounded-2xl flex items-center justify-center text-green-600 mx-auto mb-4">
                <Shield className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight lowercase">traceability qr</h2>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Scan to verify origin</p>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-[24px] mb-6 flex items-center justify-center border-2 border-dashed border-gray-200">
              <QRCodeSVG 
                value={`${window.location.origin}/trace/${selectedBatchId}`} 
                size={200}
                includeMargin={true}
                level="H"
              />
            </div>

            <p className="text-sm text-gray-600 mb-8 font-medium italic">
              "This code links directly to the immutable DAFIS ledger for Batch #{trace?.batches.find(b => b.id === selectedBatchId)?.batchCode}"
            </p>

            <button
              onClick={() => setShowQRModal(false)}
              className="w-full py-4 bg-gray-900 text-white rounded-[20px] font-black text-sm tracking-widest uppercase hover:bg-black transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductDetails;