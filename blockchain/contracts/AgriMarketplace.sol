// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
contract AgriMarketplace {
    struct Product {
        uint256 id;
        string name;
        string category;
        uint256 price;
        uint256 quantity;
        address farmer;
        bool isActive;
        uint256 timestamp;
    }
    
    struct Transaction {
        uint256 id;
        uint256 productId;
        address buyer;
        address farmer;
        uint256 quantity;
        uint256 totalPrice;
        uint256 timestamp;
        bool isCompleted;
    }

    // Off-chain payment proof (Airtel / bank transfer / etc.) for non-repudiation.
    // The proof is accepted only if BOTH buyer and farmer signatures are valid.
    struct PaymentProof {
        bytes32 orderHash;     // hash of off-chain order id (bytes32)
        bytes32 detailsHash;   // hash of off-chain payment details (bytes32)
        address buyer;
        address farmer;
        uint256 timestamp;
    }
    
    mapping(uint256 => Product) public products;
    mapping(uint256 => Transaction) public transactions;
    mapping(bytes32 => PaymentProof) public paymentProofs;
    mapping(address => bool) public verifiedFarmers;
    mapping(address => uint256[]) public farmerProducts;
    mapping(address => uint256[]) public buyerTransactions;
    
    uint256 public productCounter;
    uint256 public transactionCounter;
    
    address public owner;
    
    event ProductListed(uint256 indexed productId, address indexed farmer, string name, uint256 price);
    event ProductPurchased(uint256 indexed transactionId, uint256 indexed productId, address indexed buyer, uint256 quantity);
    event FarmerVerified(address indexed farmer);
    event TransactionCompleted(uint256 indexed transactionId);
    event PaymentProofRecorded(bytes32 indexed orderHash, address indexed buyer, address indexed farmer, bytes32 detailsHash);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier onlyVerifiedFarmer() {
        require(verifiedFarmers[msg.sender], "Only verified farmers can list products");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }

    function _splitSig(bytes memory sig) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "Invalid signature length");
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) {
            v += 27;
        }
        require(v == 27 || v == 28, "Invalid signature v");
    }

    function _toEthSignedMessageHash(bytes32 messageHash) internal pure returns (bytes32) {
        // EIP-191 personal_sign prefix
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
    }

    function _recover(bytes32 messageHash, bytes memory sig) internal pure returns (address) {
        (bytes32 r, bytes32 s, uint8 v) = _splitSig(sig);
        return ecrecover(_toEthSignedMessageHash(messageHash), v, r, s);
    }

    // messageHash MUST be: keccak256(abi.encodePacked(orderHash, detailsHash))
    function recordPaymentProof(
        bytes32 orderHash,
        bytes32 detailsHash,
        address buyer,
        address farmer,
        bytes calldata buyerSig,
        bytes calldata farmerSig
    ) public {
        require(paymentProofs[orderHash].timestamp == 0, "Proof already recorded");
        require(buyer != address(0) && farmer != address(0), "Invalid addresses");

        bytes32 messageHash = keccak256(abi.encodePacked(orderHash, detailsHash));

        address recoveredBuyer = _recover(messageHash, buyerSig);
        address recoveredFarmer = _recover(messageHash, farmerSig);

        require(recoveredBuyer == buyer, "Buyer signature invalid");
        require(recoveredFarmer == farmer, "Farmer signature invalid");

        paymentProofs[orderHash] = PaymentProof({
            orderHash: orderHash,
            detailsHash: detailsHash,
            buyer: buyer,
            farmer: farmer,
            timestamp: block.timestamp
        });

        emit PaymentProofRecorded(orderHash, buyer, farmer, detailsHash);
    }
    
    function verifyFarmer(address farmer) public onlyOwner {
        verifiedFarmers[farmer] = true;
        emit FarmerVerified(farmer);
    }
    
    function listProduct(
        string memory _name,
        string memory _category,
        uint256 _price,
        uint256 _quantity
    ) public onlyVerifiedFarmer {
        productCounter++;
        
        products[productCounter] = Product({
            id: productCounter,
            name: _name,
            category: _category,
            price: _price,
            quantity: _quantity,
            farmer: msg.sender,
            isActive: true,
            timestamp: block.timestamp
        });
        
        farmerProducts[msg.sender].push(productCounter);
        
        emit ProductListed(productCounter, msg.sender, _name, _price);
    }
    
    function purchaseProduct(uint256 _productId, uint256 _quantity) public payable {
        Product storage product = products[_productId];
        
        require(product.isActive, "Product is not active");
        require(product.quantity >= _quantity, "Insufficient quantity available");
        require(msg.value >= product.price * _quantity, "Insufficient payment");
        
        transactionCounter++;
        
        transactions[transactionCounter] = Transaction({
            id: transactionCounter,
            productId: _productId,
            buyer: msg.sender,
            farmer: product.farmer,
            quantity: _quantity,
            totalPrice: product.price * _quantity,
            timestamp: block.timestamp,
            isCompleted: false
        });
        
        product.quantity -= _quantity;
        if (product.quantity == 0) {
            product.isActive = false;
        }
        
        buyerTransactions[msg.sender].push(transactionCounter);
        
        // Transfer payment to farmer (minus platform fee)
        uint256 platformFee = (msg.value * 2) / 100; // 2% platform fee
        uint256 farmerPayment = msg.value - platformFee;
        
        payable(product.farmer).transfer(farmerPayment);
        payable(owner).transfer(platformFee);
        
        emit ProductPurchased(transactionCounter, _productId, msg.sender, _quantity);
    }
    
    function completeTransaction(uint256 _transactionId) public {
        Transaction storage transaction = transactions[_transactionId];
        
        require(
            msg.sender == transaction.buyer || msg.sender == transaction.farmer,
            "Only buyer or farmer can complete transaction"
        );
        
        transaction.isCompleted = true;
        
        emit TransactionCompleted(_transactionId);
    }
    
    function getProduct(uint256 _productId) public view returns (Product memory) {
        return products[_productId];
    }
    
    function getTransaction(uint256 _transactionId) public view returns (Transaction memory) {
        return transactions[_transactionId];
    }
    
    function getFarmerProducts(address _farmer) public view returns (uint256[] memory) {
        return farmerProducts[_farmer];
    }
    
    function getBuyerTransactions(address _buyer) public view returns (uint256[] memory) {
        return buyerTransactions[_buyer];
    }
    
    function getAllActiveProducts() public view returns (Product[] memory) {
        uint256 activeCount = 0;
        
        // Count active products
        for (uint256 i = 1; i <= productCounter; i++) {
            if (products[i].isActive) {
                activeCount++;
            }
        }
        
        Product[] memory activeProducts = new Product[](activeCount);
        uint256 index = 0;
        
        // Fill array with active products
        for (uint256 i = 1; i <= productCounter; i++) {
            if (products[i].isActive) {
                activeProducts[index] = products[i];
                index++;
            }
        }
        
        return activeProducts;
    }
}