import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
	User,
	LogOut,
	Menu,
	X,
	Leaf,
	BarChart3,
	Package,
	MessageSquare,
	Users,
	Truck,
	ShieldCheck,
	SlidersHorizontal,
	ShoppingBag,
	FileSignature,
	Search,
} from "lucide-react";
import { t } from "../utils/translation";
import { useLanguage } from "../contexts/LanguageContext";

function Navbar() {
	const { user, logout } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const [isMenuOpen, setIsMenuOpen] = React.useState(false);
	const { language, setLanguage } = useLanguage();

	const handleLogout = () => {
		logout();
		navigate("/");
		setIsMenuOpen(false);
	};

	const isActive = (path: string) => {
		return location.pathname === path;
	};

	return (
		<nav className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-50">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex justify-between items-center h-20">
					{/* Logo */}
					<Link to="/" className="flex items-center space-x-3 group">
						<div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-2 rounded-2xl shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
							<Leaf className="h-6 w-6 text-white" />
						</div>
						<span className="text-2xl font-black tracking-tight text-slate-900">DAFIS</span>
					</Link>

					{/* Language Toggle (Desktop Header) */}
					<div className="hidden md:flex items-center ml-4 mr-auto">
						<select 
                            value={language}
							onChange={(e) => setLanguage(e.target.value as any)}
							className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer appearance-none">
							<option value="en">English</option>
							<option value="ug">Luganda</option>
							<option value="ach">Acholi</option>
							<option value="teo">Ateso</option>
							<option value="lgg">Lugbara</option>
							<option value="nyn">Runyankole</option>
						</select>
					</div>

					{/* Desktop Navigation */}
					<div className="hidden md:flex items-center space-x-6">
						<Link
							to="/marketplace"
							className={`text-sm font-medium transition-colors ${isActive("/marketplace")
								? "text-green-600"
								: "text-gray-600 hover:text-gray-900"
								}`}>
							{t('marketplace')}
						</Link>

						{user ? (
							<>
								<Link
									to="/dashboard"
									className={`flex items-center space-x-1 text-sm font-medium transition-colors ${isActive("/dashboard")
										? "text-green-600"
										: "text-gray-600 hover:text-gray-900"
										}`}>
									<BarChart3 className="h-4 w-4" />
									<span>{t('dashboard')}</span>
								</Link>

								<Link
									to="/orders"
									className={`flex items-center space-x-1 text-sm font-medium transition-colors ${isActive("/orders")
										? "text-green-600"
										: "text-gray-600 hover:text-gray-900"
										}`}>
									<Package className="h-4 w-4" />
									<span>{t('orders')}</span>
								</Link>

								{(user.role === "FARMER" || user.role === "BUYER") && (
									<Link
										to="/logistics"
										className={`flex items-center space-x-1 text-sm font-medium transition-colors ${isActive("/logistics")
											? "text-green-600"
											: "text-gray-600 hover:text-gray-900"
											}`}>
										<Truck className="h-4 w-4" />
										<span>{t('logistics')}</span>
									</Link>
								)}

								{user.role === "FARMER" && (
									<Link
										to="/coops"
										className={`flex items-center space-x-1 text-sm font-medium transition-colors ${isActive("/coops")
											? "text-green-600"
											: "text-gray-600 hover:text-gray-900"
											}`}>
										<Users className="h-4 w-4" />
										<span>{t('coops')}</span>
									</Link>
								)}

								{user.role === "FARMER" && (
									<>
										<Link
											to="/export-verification"
											className={`flex items-center space-x-1 text-sm font-medium transition-colors ${isActive("/export-verification")
												? "text-green-600"
												: "text-gray-600 hover:text-gray-900"
												}`}>
											<ShieldCheck className="h-4 w-4" />
											<span>{t('export')}</span>
										</Link>

										<Link
											to="/agro-store"
											className={`flex items-center space-x-1 text-sm font-medium transition-colors ${isActive("/agro-store")
												? "text-green-600"
												: "text-gray-600 hover:text-gray-900"
												}`}>
											<ShoppingBag className="h-4 w-4" />
											<span>{t('inputs')}</span>
										</Link>

										<Link
											to="/contracts"
											className={`flex items-center space-x-1 text-sm font-medium transition-colors ${isActive("/contracts")
												? "text-green-600"
												: "text-gray-600 hover:text-gray-900"
												}`}>
											<FileSignature className="h-4 w-4" />
											<span>{t('contracts')}</span>
										</Link>
									</>
								)}


								{user.role === "ADMIN" && (
									<Link
										to="/form-builder"
										className={`flex items-center space-x-1 text-sm font-medium transition-colors ${isActive("/form-builder")
											? "text-green-600"
											: "text-gray-600 hover:text-gray-900"
											}`}>
										<SlidersHorizontal className="h-4 w-4" />
										<span>{t('forms')}</span>
									</Link>
								)}


								<Link
									to="/chat"
									className={`flex items-center space-x-1 text-sm font-medium transition-colors ${isActive("/chat")
										? "text-green-600"
										: "text-gray-600 hover:text-gray-900"
										}`}>
									<MessageSquare className="h-4 w-4" />
									<span>{t('chat')}</span>
								</Link>

								<div className="flex items-center space-x-6">
									<Link
										to="/profile"
										className="flex items-center space-x-2 text-sm font-bold text-slate-600 hover:text-emerald-600 transition-colors uppercase tracking-widest">
										<span>{t('account')}</span>
									</Link>

									<button
										onClick={handleLogout}
										className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-600 transition-all">
										{t('logout')}
									</button>
								</div>
							</>
						) : (
							<div className="flex items-center space-x-4">
								<Link
									to="/login"
									className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
									{t('login')}
								</Link>
								<Link
									to="/register"
									className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors">
									{t('get_started')}
								</Link>
							</div>
						)}
					</div>

					{/* Mobile menu button */}
					<div className="md:hidden">
						<button
							onClick={() => setIsMenuOpen(!isMenuOpen)}
							className="text-gray-600 hover:text-gray-900">
							{isMenuOpen ? (
								<X className="h-6 w-6" />
							) : (
								<Menu className="h-6 w-6" />
							)}
						</button>
					</div>
				</div>

				{/* Mobile menu */}
				{isMenuOpen && (
					<div className="md:hidden border-t border-gray-200 py-4">
						<div className="px-4 mb-4">
                            <select 
                                value={language}
                                onChange={(e) => {
                                    setLanguage(e.target.value as any);
                                    setIsMenuOpen(false);
                                }}
                                className="w-full text-center px-3 py-2 text-sm font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors uppercase tracking-widest focus:outline-none cursor-pointer appearance-none">
                                <option value="en">Switch Language: English</option>
                                <option value="ug">Switch Language: Luganda</option>
                                <option value="ach">Switch Language: Acholi</option>
                                <option value="teo">Switch Language: Ateso</option>
                                <option value="lgg">Switch Language: Lugbara</option>
                                <option value="nyn">Switch Language: Runyankole</option>
                            </select>
						</div>
						<div className="space-y-3">
							<Link
								to="/marketplace"
								className="block text-gray-600 hover:text-gray-900 font-medium"
								onClick={() => setIsMenuOpen(false)}>
								{t('marketplace')}
							</Link>

							{user ? (
								<>
									<Link
										to="/dashboard"
										className="block text-gray-600 hover:text-gray-900 font-medium"
										onClick={() => setIsMenuOpen(false)}>
										{t('dashboard')}
									</Link>

									<Link
										to="/orders"
										className="block text-gray-600 hover:text-gray-900 font-medium"
										onClick={() => setIsMenuOpen(false)}>
										{t('orders')}
									</Link>

									{(user.role === "FARMER" || user.role === "BUYER") && (
										<Link
											to="/logistics"
											className="block text-gray-600 hover:text-gray-900 font-medium"
											onClick={() => setIsMenuOpen(false)}>
											{t('logistics')}
										</Link>
									)}

									{user.role === "FARMER" && (
										<Link
											to="/coops"
											className="block text-gray-600 hover:text-gray-900 font-medium"
											onClick={() => setIsMenuOpen(false)}>
											{t('coops')}
										</Link>
									)}

									{user.role === "FARMER" && (
										<Link
											to="/export-verification"
											className="block text-gray-600 hover:text-gray-900 font-medium"
											onClick={() => setIsMenuOpen(false)}>
											{t('verify_for_export')}
										</Link>
									)}

									{user.role === "FARMER" && (
										<>
											<Link
												to="/agro-store"
												className="block text-gray-600 hover:text-gray-900 font-medium"
												onClick={() => setIsMenuOpen(false)}>
												{t('inputs')}
											</Link>
											<Link
												to="/contracts"
												className="block text-gray-600 hover:text-gray-900 font-medium"
												onClick={() => setIsMenuOpen(false)}>
												{t('contracts')}
											</Link>
										</>
									)}


									{user.role === "ADMIN" && (
										<Link
											to="/form-builder"
											className="block text-gray-600 hover:text-gray-900 font-medium"
											onClick={() => setIsMenuOpen(false)}>
											{t('forms')}
										</Link>
									)}


									<Link
										to="/chat"
										className="block text-gray-600 hover:text-gray-900 font-medium"
										onClick={() => setIsMenuOpen(false)}>
										{t('chat')}
									</Link>

									<Link
										to="/profile"
										className="block text-gray-600 hover:text-gray-900 font-medium"
										onClick={() => setIsMenuOpen(false)}>
										{t('profile')}
									</Link>

									<button
										onClick={handleLogout}
										className="block w-full text-left text-red-600 hover:text-red-700 font-medium">
										{t('logout')}
									</button>
								</>
							) : (
								<>
									<Link
										to="/login"
										className="block text-gray-600 hover:text-gray-900 font-medium"
										onClick={() => setIsMenuOpen(false)}>
										{t('login')}
									</Link>
									<Link
										to="/register"
										className="block bg-green-600 text-white px-4 py-2 rounded-md font-medium hover:bg-green-700 text-center"
										onClick={() => setIsMenuOpen(false)}>
										{t('get_started')}
									</Link>
								</>
							)}
						</div>
					</div>
				)}
			</div>
		</nav>
	);
}

export default Navbar;
