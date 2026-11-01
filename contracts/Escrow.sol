// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Interface tối thiểu của ERC721 để Escrow có thể chuyển NFT.
interface IERC721 {
    function transferFrom(address _from, address _to, uint256 _tokenId) external;
}

contract Escrow {
    address public nftAddress;       // Địa chỉ contract RealEstate (ERC721)
    address public inspector;        // Người kiểm định bất động sản


    mapping(uint256 => bool) public isListed;          // NFT đã được niêm yết chưa
    mapping(uint256 => uint256) public purchasePrice;  // Giá bán
    mapping(uint256 => uint256) public escrowAmount;   // Tiền đặt cọc tối thiểu
    mapping(uint256 => address) public buyer;          // Người mua của NFT này
    mapping(uint256 => address payable) public sellerOf;

    mapping(uint256 => bool) public inspectionPassed;              // inspectionPassed[nftID] = true nếu inspection đã đạt
    mapping(uint256 => mapping(address => bool)) public approval;  // approval[nftID][address] = true nếu address đã approve giao dịch
    mapping(uint256 => uint256) public buyerDeposit;               // ETH buyer đã cọc cho từng NFT

    mapping(uint256 => bool) public paymentCompleted;
    mapping(uint256 => bool) public saleCompleted;
    mapping(uint256 => address) public completedBuyer;
    mapping(uint256 => address) public completedSeller;
    mapping(uint256 => uint8) public cancellationReason;

    event BuyerRefunded(
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 amount
    );
    event SellerPaid(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 amount
    );

    modifier onlyBuyer(uint256 _nftID) {
        require(msg.sender == buyer[_nftID], "Only buyer can call this method");
        _;
    }

    modifier onlyInspector() {
        require(msg.sender == inspector, "Only inspector can call this method");
        _;
    }

    constructor(address _nftAddress, address _inspector) {
        nftAddress = _nftAddress;
        inspector = _inspector;
    }

    function list(uint256 _nftID, uint256 _purchasePrice, uint256 _escrowAmount) public {
        require(!isListed[_nftID], "NFT is already listed");
        require(_escrowAmount <= _purchasePrice, "Escrow amount cannot exceed purchase price");

        // Chuyển NFT từ seller sang hợp đồng Escrow
        IERC721(nftAddress).transferFrom(msg.sender, address(this), _nftID);

        isListed[_nftID] = true;
        saleCompleted[_nftID] = false;
        paymentCompleted[_nftID] = false;
        cancellationReason[_nftID] = 0;
        completedBuyer[_nftID] = address(0);
        completedSeller[_nftID] = address(0);
        sellerOf[_nftID] = payable(msg.sender);
        purchasePrice[_nftID] = _purchasePrice;
        escrowAmount[_nftID] = _escrowAmount;
    }

    function depositEarnest(uint256 _nftID) public payable {
        require(isListed[_nftID], "NFT not listed");

        if (buyer[_nftID] == address(0)) {
            buyer[_nftID] = msg.sender;
        } else {
            require(msg.sender == buyer[_nftID], "Only buyer can call this method");
            require(
                approval[_nftID][sellerOf[_nftID]],
                "Seller must approve before additional deposit"
            );
        }

        require(msg.value > 0, "Deposit must be greater than zero");
        require(!paymentCompleted[_nftID], "Payment already completed");
        require(
            buyerDeposit[_nftID] + msg.value <= purchasePrice[_nftID],
            "Deposit exceeds purchase price"
        );
        buyerDeposit[_nftID] += msg.value;
        if (buyerDeposit[_nftID] == purchasePrice[_nftID]) {
            paymentCompleted[_nftID] = true;
        }
    }

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    
    function updateInspectionStatus(uint256 _nftID, bool _passed)
        public
        onlyInspector
    {
        require(isListed[_nftID], "NFT not listed");
        require(buyer[_nftID] != address(0), "No buyer yet");
        inspectionPassed[_nftID] = _passed;
    }

    // Phê duyệt giao dịch từ các bên liên quan
    function approveSale(uint256 _nftID) public {
        require(isListed[_nftID], "NFT not listed");
        require(buyer[_nftID] != address(0), "No buyer yet");
        require(msg.sender == sellerOf[_nftID], "Only seller can approve");
        require(
            buyerDeposit[_nftID] >= escrowAmount[_nftID],
            "Buyer deposit not confirmed"
        );
        approval[_nftID][msg.sender] = true;
    }

    function finalizeSale(uint256 _nftID) public {
        require(isListed[_nftID], "NFT not listed");
        require(buyer[_nftID] != address(0), "No buyer yet");
        require(msg.sender == inspector, "Only inspector can finalize");
        require(inspectionPassed[_nftID], "Inspection not passed");
        require(approval[_nftID][sellerOf[_nftID]], "Seller not approved");

        uint256 price = purchasePrice[_nftID];
        uint256 total = buyerDeposit[_nftID];
        require(total >= price, "Insufficient funds");

        address _buyer = buyer[_nftID];
        address payable _seller = sellerOf[_nftID];

        saleCompleted[_nftID] = true;
        completedBuyer[_nftID] = _buyer;
        completedSeller[_nftID] = _seller;

        // Cập nhật trạng thái TRƯỚC khi chuyển tiền / NFT
        _resetSale(_nftID);

        // Chuyển NFT cho buyer
        IERC721(nftAddress).transferFrom(address(this), _buyer, _nftID);

        // Chuyển đúng giá bán cho seller
        (bool okSeller, ) = _seller.call{value: price}("");
        require(okSeller, "Transfer to seller failed");
        emit SellerPaid(_nftID, _seller, price);

        // Tiền dư (nếu có) hoàn lại buyer
        uint256 excess = total - price;
        if (excess > 0) {
            (bool okBuyer, ) = payable(_buyer).call{value: excess}("");
            require(okBuyer, "Refund to buyer failed");
        }
    }

    // Hủy giao dịch khi inspection chưa đạt: hoàn tiền, trả NFT về seller
    function cancelSale(uint256 _nftID) public {
        require(isListed[_nftID], "NFT not listed");
        require(
            msg.sender == buyer[_nftID] ||
                msg.sender == sellerOf[_nftID] ||
                msg.sender == inspector,
            "Not authorized"
        );
        require(!inspectionPassed[_nftID], "Inspection already passed");
        require(!approval[_nftID][sellerOf[_nftID]], "Sale already approved");

        address _buyer = buyer[_nftID];
        uint256 buyerRefund = buyerDeposit[_nftID];
        address payable _seller = sellerOf[_nftID];

        if (msg.sender == _seller) {
            cancellationReason[_nftID] = 1;
        } else if (msg.sender == _buyer) {
            cancellationReason[_nftID] = 2;
        } else {
            cancellationReason[_nftID] = 3;
        }

        _resetSale(_nftID);

        // Trả NFT về seller
        IERC721(nftAddress).transferFrom(
            address(this),
            _seller,
            _nftID
        );

        // Hoàn tiền cho từng bên
        if (buyerRefund > 0) {
            (bool okBuyer, ) = payable(_buyer).call{value: buyerRefund}("");
            require(okBuyer, "Refund to buyer failed");
            emit BuyerRefunded(_nftID, _buyer, buyerRefund);
        }
    }

    // Xóa toàn bộ dữ liệu của một giao dịch
    function _resetSale(uint256 _nftID) private {
        delete isListed[_nftID];
        delete purchasePrice[_nftID];
        delete escrowAmount[_nftID];
        delete buyer[_nftID];
        delete inspectionPassed[_nftID];
        delete buyerDeposit[_nftID];
        delete paymentCompleted[_nftID];
        delete approval[_nftID][sellerOf[_nftID]];
        delete sellerOf[_nftID];
    }
}