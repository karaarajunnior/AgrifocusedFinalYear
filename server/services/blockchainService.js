import Web3 from "web3";
import crypto from "crypto";
import fs from 'fs'
 
class BlockchainService {
	constructor() {
		this.web3 = new Web3(
			process.env.BLOCKCHAIN_RPC_URL || "http://localhost:7545"
		);
		this.contractAddress = process.env.CONTRACT_ADDRESS;
		this.contractABI = null;
		this.contract = null;
		this.useSimulation = !this.contractAddress;
		this.simulatedBlocks = [];
		this.blockHeight = 0;
	}
	async init() {
				
 const contractJson = JSON.parse(fs.readFileSync(
   new URL("../../blockchain/build/contracts/AgriMarketplace.json", import.meta.url)
     ));
     this.contractABI = contractJson.abi;

		if (this.contractAddress) {
			this.contract = new this.web3.eth.Contract(
				this.contractABI,
				this.contractAddress
			);
			this.useSimulation = false;
		} else {
			this.useSimulation = true;
		}
	}

	// Generate a cryptographic hash for transactions
	generateTransactionHash(data) {
		return crypto
			.createHash("sha256")
			.update(JSON.stringify(data) + Date.now().toString())
			.digest("hex");
	}

	// Create a new block in simulated blockchain
	createBlock(transactions) {
		const previousHash =
			this.blockHeight > 0
				? this.simulatedBlocks[this.blockHeight - 1].hash
				: "0000000000000000000000000000000000000000000000000000000000000000";

		const block = {
			index: this.blockHeight,
			timestamp: new Date().toISOString(),
			transactions: transactions,
			previousHash: previousHash,
			nonce: Math.floor(Math.random() * 1000000),
			hash: "",
		};

		// Generate block hash
		block.hash = crypto
			.createHash("sha256")
			.update(JSON.stringify(block))
			.digest("hex");

		this.simulatedBlocks.push(block);
		this.blockHeight++;

		return block;
	}

	// Record product listing on blockchain
	async listProduct(productData, farmerAddress) {
		try {
			if (!this.useSimulation && this.contract) {
				// Real blockchain implementation
				const accounts = await this.web3.eth.getAccounts();
				const result = await this.contract.methods
					.listProduct(
						productData.name,
						productData.category,
						this.web3.utils.toWei(productData.price.toString(), "ether"),
						productData.quantity,
					)
					.send({ from: farmerAddress, gas: 300000 });

				return {
					success: true,
					transactionHash: result.transactionHash,
					blockNumber: result.blockNumber,
					gasUsed: result.gasUsed,
				};
			} else {
				// Simulated blockchain
				const transaction = {
					type: "PRODUCT_LISTING",
					productId: productData.id,
					farmer: farmerAddress,
					data: productData,
					hash: this.generateTransactionHash(productData),
					timestamp: new Date().toISOString(),
				};

				const block = this.createBlock([transaction]);

				return {
					success: true,
					transactionHash: transaction.hash,
					blockNumber: block.index,
					blockHash: block.hash,
					gasUsed: Math.random() * 50000 + 21000, // Simulated gas usage
				};
			}
		} catch (error) {
			console.error("Blockchain listing error:", error);
			throw new Error("Failed to record product on blockchain");
		}
	}

	// Record transaction on blockchain
	async recordTransaction(transactionData) {
		try {
			if (!this.useSimulation && this.contract) {
				// Real blockchain implementation
				const result = await this.contract.methods
					.purchaseProduct(transactionData.productId, transactionData.quantity)
					.send({
						from: transactionData.buyerAddress,
						value: this.web3.utils.toWei(
							transactionData.totalPrice.toString(),
							"ether",
						),
						gas: 300000,
					});

				return {
					success: true,
					transactionHash: result.transactionHash,
					blockNumber: result.blockNumber,
					gasUsed: result.gasUsed,
				};
			} else {
				// Simulated blockchain
				const transaction = {
					type: "PURCHASE",
					orderId: transactionData.orderId,
					productId: transactionData.productId,
					buyer: transactionData.buyerAddress,
					farmer: transactionData.farmerAddress,
					quantity: transactionData.quantity,
					totalPrice: transactionData.totalPrice,
					hash: this.generateTransactionHash(transactionData),
					timestamp: new Date().toISOString(),
				};

				const block = this.createBlock([transaction]);

				return {
					success: true,
					transactionHash: transaction.hash,
					blockNumber: block.index,
					blockHash: block.hash,
					gasUsed: Math.random() * 80000 + 21000,
				};
			}
		} catch (error) {
			console.error("Blockchain transaction error:", error);
			throw new Error("Failed to record transaction on blockchain");
		}
	}

	// Verify transaction integrity
	async verifyTransaction(transactionHash) {
		try {
			if (!this.useSimulation && this.contract) {
				// Real blockchain verification
				const receipt = await this.web3.eth.getTransactionReceipt(
					transactionHash,
				);
				return {
					verified: receipt !== null,
					blockNumber: receipt ? receipt.blockNumber : null,
					status: receipt ? receipt.status : null,
				};
			} else {
				// Simulated blockchain verification
				for (const block of this.simulatedBlocks) {
					for (const transaction of block.transactions) {
						if (transaction.hash === transactionHash) {
							return {
								verified: true,
								blockNumber: block.index,
								blockHash: block.hash,
								timestamp: transaction.timestamp,
							};
						}
					}
				}
				return { verified: false };
			}
		} catch (error) {
			console.error("Verification error:", error);
			return { verified: false, error: error.message };
		}
	}

	// Get blockchain statistics
	getBlockchainStats() {
		if (!this.useSimulation) {
			// Would implement real blockchain stats here
			return {
				totalBlocks: "N/A",
				totalTransactions: "N/A",
				networkHashRate: "N/A",
			};
		} else {
			const totalTransactions = this.simulatedBlocks.reduce(
				(sum, block) => sum + block.transactions.length,
				0,
			);

			return {
				totalBlocks: this.blockHeight,
				totalTransactions: totalTransactions,
				networkHashRate: `${Math.floor(Math.random() * 1000 + 500)} TH/s`,
				lastBlockTime:
					this.blockHeight > 0
						? this.simulatedBlocks[this.blockHeight - 1].timestamp
						: null,
			};
		}
	}

	// Get transaction history for an address
	async getTransactionHistory(address) {
		try {
			const history = [];

			for (const block of this.simulatedBlocks) {
				for (const transaction of block.transactions) {
					if (transaction.buyer === address || transaction.farmer === address) {
						history.push({
							...transaction,
							blockNumber: block.index,
							blockHash: block.hash,
						});
					}
				}
			}

			return history.sort(
				(a, b) => new Date(b.timestamp) - new Date(a.timestamp),
			);
		} catch (error) {
			console.error("Transaction history error:", error);
			return [];
		}
	}
}

const blockchainService = new BlockchainService();
await blockchainService.init();

export default blockchainService;