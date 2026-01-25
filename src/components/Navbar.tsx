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
<<<<<<< HEAD
=======
	SlidersHorizontal,
>>>>>>> 225243225361ddfd0eb3107de5c6df2f70ee111c
} from "lucide-react";

function Navbar() {
	const { user, logout } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const [isMenuOpen, setIsMenuOpen] = React.useState(false);

	const handleLogout = () => {
		logout();
		navigate("/");
		setIsMenuOpen(false);
	};

	const isActive = (path: string) => {
		return location.pathname === path;
	};

	return (
		<nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex justify-between items-center h-16">
					{/* Logo */}
					<Link to="/" className="flex items-center space-x-2">
						<Leaf className="h-8 w-8 text-green-600" />
						<span className="text-xl font-bold text-gray-900">AgriConnect</span>
					</Link>

					{/* Desktop Navigation */}
					<div className="hidden md:flex items-center space-x-6">
						<Link
							to="/marketplace"
							className={`text-sm font-medium transition-colors ${
								isActive("/marketplace")
									? "text-green-600"
									: "text-gray-600 hover:text-gray-900"
							}`}>
							Marketplace
						</Link>

						{user ? (
							<>
								<Link
									to="/dashboard"
									className={`flex items-center space-x-1 text-sm font-medium transition-colors ${
										isActive("/dashboard")
											? "text-green-600"
											: "text-gray-600 hover:text-gray-900"
									}`}>
									<BarChart3 className="h-4 w-4" />
									<span>Dashboard</span>
								</Link>

								<Link
									to="/orders"
									className={`flex items-center space-x-1 text-sm font-medium transition-colors ${
										isActive("/orders")
											? "text-green-600"
											: "text-gray-600 hover:text-gray-900"
									}`}>
									<Package className="h-4 w-4" />
									<span>Orders</span>
								</Link>

								{user.role === "FARMER" && (
									<Link
										to="/coops"
										className={`flex items-center space-x-1 text-sm font-medium transition-colors ${
											isActive("/coops")
												? "text-green-600"
												: "text-gray-600 hover:text-gray-900"
										}`}>
										<Users className="h-4 w-4" />
										<span>Co-ops</span>
									</Link>
								)}

<<<<<<< HEAD
=======
								{user.role === "ADMIN" && (
									<Link
										to="/form-builder"
										className={`flex items-center space-x-1 text-sm font-medium transition-colors ${
											isActive("/form-builder")
												? "text-green-600"
												: "text-gray-600 hover:text-gray-900"
										}`}>
										<SlidersHorizontal className="h-4 w-4" />
										<span>Forms</span>
									</Link>
								)}

>>>>>>> 225243225361ddfd0eb3107de5c6df2f70ee111c
								<Link
									to="/chat"
									className={`flex items-center space-x-1 text-sm font-medium transition-colors ${
										isActive("/chat")
											? "text-green-600"
											: "text-gray-600 hover:text-gray-900"
									}`}>
									<MessageSquare className="h-4 w-4" />
									<span>Chat</span>
								</Link>

								<div className="flex items-center space-x-4">
									<Link
										to="/profile"
										className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900">
										<User className="h-5 w-5" />
										<span>{user.name}</span>
									</Link>

									<button
										onClick={handleLogout}
										className="flex items-center space-x-1 text-sm text-gray-600 hover:text-red-600 transition-colors">
										<LogOut className="h-4 w-4" />
										<span>Logout</span>
									</button>
								</div>
							</>
						) : (
							<div className="flex items-center space-x-4">
								<Link
									to="/login"
									className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
									Login
								</Link>
								<Link
									to="/register"
									className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors">
									Get Started
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
						<div className="space-y-3">
							<Link
								to="/marketplace"
								className="block text-gray-600 hover:text-gray-900 font-medium"
								onClick={() => setIsMenuOpen(false)}>
								Marketplace
							</Link>

							{user ? (
								<>
									<Link
										to="/dashboard"
										className="block text-gray-600 hover:text-gray-900 font-medium"
										onClick={() => setIsMenuOpen(false)}>
										Dashboard
									</Link>

									<Link
										to="/orders"
										className="block text-gray-600 hover:text-gray-900 font-medium"
										onClick={() => setIsMenuOpen(false)}>
										Orders
									</Link>

									{user.role === "FARMER" && (
										<Link
											to="/coops"
											className="block text-gray-600 hover:text-gray-900 font-medium"
											onClick={() => setIsMenuOpen(false)}>
											Co-ops
										</Link>
									)}

<<<<<<< HEAD
=======
									{user.role === "ADMIN" && (
										<Link
											to="/form-builder"
											className="block text-gray-600 hover:text-gray-900 font-medium"
											onClick={() => setIsMenuOpen(false)}>
											Forms
										</Link>
									)}

>>>>>>> 225243225361ddfd0eb3107de5c6df2f70ee111c
									<Link
										to="/chat"
										className="block text-gray-600 hover:text-gray-900 font-medium"
										onClick={() => setIsMenuOpen(false)}>
										Chat
									</Link>

									<Link
										to="/profile"
										className="block text-gray-600 hover:text-gray-900 font-medium"
										onClick={() => setIsMenuOpen(false)}>
										Profile
									</Link>

									<button
										onClick={handleLogout}
										className="block w-full text-left text-red-600 hover:text-red-700 font-medium">
										Logout
									</button>
								</>
							) : (
								<>
									<Link
										to="/login"
										className="block text-gray-600 hover:text-gray-900 font-medium"
										onClick={() => setIsMenuOpen(false)}>
										Login
									</Link>
									<Link
										to="/register"
										className="block bg-green-600 text-white px-4 py-2 rounded-md font-medium hover:bg-green-700 text-center"
										onClick={() => setIsMenuOpen(false)}>
										Get Started
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
