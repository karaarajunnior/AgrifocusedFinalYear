import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
	Plus,
	Package,
	TrendingUp,
	DollarSign,
	Eye,
	CreditCard as Edit,
	Trash2,
	Star,
	Brain,
	Zap,
	PhoneCall,
	MessageCircle,
	RefreshCw,
	MapPin,
} from "lucide-react";
import LoadingSpinner from "../components/LoadingSpinner";
import AIInsights from "../components/AIInsights";
import api from "../services/api";
import { toast } from "react-hot-toast";
import axios from "axios";
import SpeakButton from "../components/SpeakButton";
import { useLocalStorageState } from "../hooks/useLocalStorageState";
import {
	enqueueOfflineProductDraft,
	getOfflineProductQueue,
	removeOfflineProductDraft,
} from "../utils/offlineProductQueue";
import ClimateAlertsCard from "../components/ClimateAlertsCard";
import DynamicFieldsetForm from "../components/DynamicFieldsetForm";
import {
	PRODUCT_FORM_KEY,
	defaultProductFormDefinition,
	type FormDefinition,
} from "../utils/formDefinitions";

interface Product {
	id: string;
	name: string;
	category: string;
	price: number;
	quantity: number;
	unit: string;
	available: boolean;
	avgRating: number;
	totalOrders: number;
	totalReviews: number;
	createdAt: string;
}

interface Analytics {
	overview: {
		totalProducts: number;
		totalSales: number;
		totalRevenue: number;
		averageRating: number;
	};
	topProducts: any[];
	recentOrders: any[];
}

function FarmerDashboard() {
	const { user } = useAuth();

	const [products, setProducts] = useState<Product[]>([]);
	const [analytics, setAnalytics] = useState<Analytics | null>(null);
	const [loading, setLoading] = useState(true);
	const [showAddProduct, setShowAddProduct] = useState(false);
	const [showAIInsights, setShowAIInsights] = useState(false);
	const [selectedProductForAI, setSelectedProductForAI] =
		useState<Product | null>(null);

	const [simpleMode, setSimpleMode] = useLocalStorageState<boolean>(
		"agri.simpleMode.farmer",
		true,
	);

	const [offlineDraftCount, setOfflineDraftCount] = useState(0);
	const [addStep, setAddStep] = useState(0);
	const [submitting, setSubmitting] = useState(false);

	const [productFormDef, setProductFormDef] = useState<FormDefinition>(
		defaultProductFormDefinition(),
	);
	const [customFields, setCustomFields] = useState<Record<string, unknown>>({});

	const [newProduct, setNewProduct] = useState({
		name: "",
		description: "",
		category: "VEGETABLES",
		price: "",
		quantity: "",
		unit: "kg",
		location: user?.location || "",
		organic: false,
	});

	useEffect(() => {
		fetchData();
		setOfflineDraftCount(getOfflineProductQueue().length);

		try {
			const raw = localStorage.getItem(PRODUCT_FORM_KEY);
			setProductFormDef(raw ? JSON.parse(raw) : defaultProductFormDefinition());
		} catch {
			setProductFormDef(defaultProductFormDefinition());
		}
	}, []);

	const fetchData = async () => {
		try {
			const [p, a] = await Promise.all([
				api.get("/products/farmer/my-products"),
				api.get("/analytics/farmer"),
			]);
			setProducts(p.data.products);
			setAnalytics(a.data);
		} catch {
			toast.error("Failed to load dashboard data");
		} finally {
			setLoading(false);
		}
	};

	const isLastStep = () => addStep >= (simpleMode ? 2 : 3);

	const submitProduct = async () => {
		const payload = {
			name: newProduct.name.trim(),
			description: simpleMode ? "" : newProduct.description,
			category: newProduct.category,
			price: Number(newProduct.price),
			quantity: Number(newProduct.quantity),
			unit: newProduct.unit,
			location: newProduct.location || user?.location || "",
			organic: simpleMode ? false : newProduct.organic,
			customFields,
		};

		setSubmitting(true);
		try {
			await api.post("/products", payload);
			toast.success("Product added");
			setShowAddProduct(false);
			setAddStep(0);
			setCustomFields({});
			await fetchData();
		} catch (err) {
			if (axios.isAxiosError(err) && !err.response) {
				enqueueOfflineProductDraft(payload);
				toast.success("Saved offline");
			} else {
				toast.error("Failed to add product");
			}
		} finally {
			setSubmitting(false);
		}
	};

	const handleAddProduct = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!isLastStep()) return setAddStep((s) => s + 1);
		await submitProduct();
	};

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<LoadingSpinner size="lg" />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50 py-8">
			<div className="max-w-7xl mx-auto px-4">
				<button
					onClick={() => setShowAddProduct(true)}
					className="bg-green-600 text-white px-4 py-2 rounded-lg">
					Add Product
				</button>

				{showAddProduct && (
					<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
						<div className="bg-white rounded-lg w-full max-w-md p-6">
							<form onSubmit={handleAddProduct} className="space-y-4">
								{addStep === 0 && (
									<input
										className="w-full border p-3 rounded"
										placeholder="Product name"
										value={newProduct.name}
										onChange={(e) =>
											setNewProduct({ ...newProduct, name: e.target.value })
										}
									/>
								)}

								{addStep === 1 && (
									<input
										type="number"
										className="w-full border p-3 rounded"
										placeholder="Price"
										value={newProduct.price}
										onChange={(e) =>
											setNewProduct({ ...newProduct, price: e.target.value })
										}
									/>
								)}

								{addStep === 2 && (
									<input
										type="number"
										className="w-full border p-3 rounded"
										placeholder="Quantity"
										value={newProduct.quantity}
										onChange={(e) =>
											setNewProduct({
												...newProduct,
												quantity: e.target.value,
											})
										}
									/>
								)}

								{!simpleMode && addStep === 3 && (
									<div className="space-y-3">
										<textarea
											className="w-full border p-3 rounded"
											placeholder="Description"
											value={newProduct.description}
											onChange={(e) =>
												setNewProduct({
													...newProduct,
													description: e.target.value,
												})
											}
										/>

										<DynamicFieldsetForm
											fieldSets={productFormDef.fieldSets}
											values={customFields}
											onChange={setCustomFields}
										/>
									</div>
								)}

								<div className="flex justify-between pt-4">
									<button
										type="button"
										onClick={() => setShowAddProduct(false)}
										className="px-4 py-2 bg-gray-200 rounded">
										Cancel
									</button>
									<button
										type="submit"
										disabled={submitting}
										className="px-4 py-2 bg-green-600 text-white rounded">
										{isLastStep() ? "Submit" : "Next"}
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

export default FarmerDashboard;
