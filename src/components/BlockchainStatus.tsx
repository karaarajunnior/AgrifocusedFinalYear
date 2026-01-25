import React, { useState, useEffect } from "react";
import {
	Shield,
	Link,
	Activity,
	Clock,
	CheckCircle as CheckCircle,
	AlertTriangle as AlertTriangle,
} from "lucide-react";
import api from "../services/api";
import LoadingSpinner from "./LoadingSpinner";

interface BlockchainStats {
	blockchain: {
		totalBlocks: number;
		totalTransactions: number;
		networkHashRate: string;
		lastBlockTime: string;
	};
	platform: {
		totalProducts: number;
		totalTransactions: number;
		totalUsers: number;
		activeContracts: number;
	};
}

interface Transaction {
	id: string;
	type: string;
	hash: string;
	blockNumber: number;
	timestamp: string;
	status: string;
}

function BlockchainStatus() {
	const [stats, setStats] = useState<BlockchainStats | null>(null);
	const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(
		[],
	);
	const [loading, setLoading] = useState(true);
	const [networkStatus, setNetworkStatus] = useState("healthy");

	useEffect(() => {
		fetchBlockchainData();
		const interval = setInterval(fetchBlockchainData, 30000); // Update every 30 seconds
		return () => clearInterval(interval);
	}, []);

	const fetchBlockchainData = async () => {
		try {
			const [statsRes, transactionsRes] = await Promise.all([
				api.get("/blockchain/stats"),
				api.get("/blockchain/transactions?limit=5"),
			]);

			setStats(statsRes.data);
			setRecentTransactions(transactionsRes.data.transactions || []);
			setNetworkStatus("healthy");
		} catch (error) {
			console.error("Failed to fetch blockchain data:", error);
			setNetworkStatus("error");
		} finally {
			setLoading(false);
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "healthy":
				return "text-green-600 bg-green-100";
			case "warning":
				return "text-yellow-600 bg-yellow-100";
			case "error":
				return "text-red-600 bg-red-100";
			default:
				return "text-gray-600 bg-gray-100";
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "healthy":
				return <CheckCircle className="h-4 w-4" />;
			case "warning":
				return <AlertTriangle className="h-4 w-4" />;
			case "error":
				return <AlertTriangle className="h-4 w-4" />;
			default:
				return <Activity className="h-4 w-4" />;
		}
	};

	if (loading) {
		return (
			<div className="bg-white rounded-lg shadow p-6">
				<div className="flex items-center justify-center h-32">
					<LoadingSpinner size="lg" />
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Network Status */}
			<div className="bg-white rounded-lg shadow">
				<div className="px-6 py-4 border-b border-gray-200">
					<div className="flex items-center justify-between">
						<h2 className="text-lg font-semibold text-gray-900 flex items-center">
							<Shield className="h-5 w-5 mr-2 text-blue-600" />
							Blockchain Network Status
						</h2>
						<div
							className={`flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
								networkStatus,
							)}`}>
							{getStatusIcon(networkStatus)}
							<span className="ml-1 capitalize">{networkStatus}</span>
						</div>
					</div>
				</div>

				<div className="p-6">
					{stats && (
						<div className="grid grid-cols-2 md:grid-cols-4 gap-6">
							<div className="text-center">
								<div className="text-2xl font-bold text-blue-600">
									{stats.blockchain.totalBlocks}
								</div>
								<div className="text-sm text-gray-600">Total Blocks</div>
							</div>

							<div className="text-center">
								<div className="text-2xl font-bold text-green-600">
									{stats.blockchain.totalTransactions}
								</div>
								<div className="text-sm text-gray-600">Transactions</div>
							</div>

							<div className="text-center">
								<div className="text-2xl font-bold text-purple-600">
									{stats.platform.activeContracts}
								</div>
								<div className="text-sm text-gray-600">Smart Contracts</div>
							</div>

							<div className="text-center">
								<div className="text-2xl font-bold text-orange-600">
									{stats.blockchain.networkHashRate}
								</div>
								<div className="text-sm text-gray-600">Hash Rate</div>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Recent Transactions */}
			<div className="bg-white rounded-lg shadow">
				<div className="px-6 py-4 border-b border-gray-200">
					<h3 className="text-lg font-semibold text-gray-900 flex items-center">
						<Activity className="h-5 w-5 mr-2 text-green-600" />
						Recent Blockchain Transactions
					</h3>
				</div>

				<div className="p-6">
					{recentTransactions.length > 0 ? (
						<div className="space-y-4">
							{recentTransactions.map((transaction) => (
								<div
									key={transaction.id}
									className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
									<div className="flex items-center space-x-4">
										<div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
											<Link className="h-5 w-5 text-blue-600" />
										</div>
										<div>
											<div className="font-medium text-gray-900">
												{transaction.type.replace("_", " ")}
											</div>
											<div className="text-sm text-gray-600">
												Block #{transaction.blockNumber}
											</div>
											<div className="text-xs text-gray-500 font-mono">
												{transaction.hash.substring(0, 16)}...
											</div>
										</div>
									</div>

									<div className="text-right">
										<div
											className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
												transaction.status === "COMPLETED"
													? "bg-green-100 text-green-800"
													: "bg-yellow-100 text-yellow-800"
											}`}>
											{transaction.status}
										</div>
										<div className="text-xs text-gray-500 mt-1 flex items-center">
											<Clock className="h-3 w-3 mr-1" />
											{new Date(transaction.timestamp).toLocaleTimeString()}
										</div>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="text-center py-8">
							<Link className="h-12 w-12 text-gray-400 mx-auto mb-4" />
							<h4 className="text-lg font-medium text-gray-900 mb-2">
								No Recent Transactions
							</h4>
							<p className="text-gray-600">
								Blockchain transactions will appear here as they occur
							</p>
						</div>
					)}
				</div>
			</div>

			{/* Blockchain Features */}
			<div className="bg-white rounded-lg shadow">
				<div className="px-6 py-4 border-b border-gray-200">
					<h3 className="text-lg font-semibold text-gray-900">
						Blockchain Features
					</h3>
				</div>

				<div className="p-6">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<div className="space-y-4">
							<div className="flex items-start space-x-3">
								<div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
									<Shield className="h-4 w-4 text-blue-600" />
								</div>
								<div>
									<h4 className="font-medium text-gray-900">
										Immutable Records
									</h4>
									<p className="text-sm text-gray-600">
										All transactions are permanently recorded and cannot be
										altered
									</p>
								</div>
							</div>

							<div className="flex items-start space-x-3">
								<div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
									<CheckCircle className="h-4 w-4 text-green-600" />
								</div>
								<div>
									<h4 className="font-medium text-gray-900">Smart Contracts</h4>
									<p className="text-sm text-gray-600">
										Automated execution of agreements between farmers and buyers
									</p>
								</div>
							</div>
						</div>

						<div className="space-y-4">
							<div className="flex items-start space-x-3">
								<div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
									<Activity className="h-4 w-4 text-purple-600" />
								</div>
								<div>
									<h4 className="font-medium text-gray-900">Transparency</h4>
									<p className="text-sm text-gray-600">
										Full visibility into all transactions and product history
									</p>
								</div>
							</div>

							<div className="flex items-start space-x-3">
								<div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
									<Link className="h-4 w-4 text-orange-600" />
								</div>
								<div>
									<h4 className="font-medium text-gray-900">
										Decentralization
									</h4>
									<p className="text-sm text-gray-600">
										No single point of failure or control in the network
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default BlockchainStatus;
