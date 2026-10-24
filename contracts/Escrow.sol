// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Interface tối thiểu của ERC721 để Escrow có thể chuyển NFT.
interface IERC721 {
    function transferFrom(address _from, address _to, uint256 _tokenId) external;
}

contract Escrow {
    address public nftAddress;       // Địa chỉ contract RealEstate (ERC721)
    address payable public seller;   // Người bán (payable để nhận tiền)
    address public inspector;        // Người kiểm định bất động sản
    address public lender;           // Bên cho vay (ngân hàng)


    mapping(uint256 => bool) public isListed;          // NFT đã được niêm yết chưa
    mapping(uint256 => uint256) public purchasePrice;  // Giá bán
    mapping(uint256 => uint256) public escrowAmount;   // Tiền đặt cọc tối thiểu
    mapping(uint256 => address) public buyer;          // Người mua của NFT này

    mapping(uint256 => bool) public inspectionPassed;              // inspectionPassed[nftID] = true nếu inspection đã đạt
    mapping(uint256 => mapping(address => bool)) public approval;  // approval[nftID][address] = true nếu address đã approve giao dịch
    mapping(uint256 => uint256) public buyerDeposit;               // ETH buyer đã cọc cho từng NFT
    mapping(uint256 => uint256) public lenderDeposit;              // ETH lender đã gửi cho từng NFT

    modifier onlyBuyer(uint256 _nftID) {
        require(msg.sender == buyer[_nftID], "Only buyer can call this method");
        _;
    }

    modifier onlySeller() {
        require(msg.sender == seller, "Only seller can call this method");
        _;
    }

    modifier onlyInspector() {
        require(msg.sender == inspector, "Only inspector can call this method");
        _;
    }

    modifier onlyLender() {
        require(msg.sender == lender, "Only lender can call this method");
        _;
    }

    constructor(address _nftAddress, address payable _seller, address _inspector, address _lender) {
        nftAddress = _nftAddress;
        seller = _seller;
        inspector = _inspector;
        lender = _lender;
    }

    function list(uint256 _nftID, address _buyer, uint256 _purchasePrice, uint256 _escrowAmount) public onlySeller {
        require(!isListed[_nftID], "NFT is already listed");
        require(_buyer != address(0), "Buyer address cannot be zero");
        require(_escrowAmount <= _purchasePrice, "Escrow amount cannot exceed purchase price");

        // Chuyển NFT từ seller sang hợp đồng Escrow
        IERC721(nftAddress).transferFrom(msg.sender, address(this), _nftID);

        isListed[_nftID] = true;
        buyer[_nftID] = _buyer;
        purchasePrice[_nftID] = _purchasePrice;
        escrowAmount[_nftID] = _escrowAmount;
    }

    function depositEarnest(uint256 _nftID) public payable onlyBuyer(_nftID) {
        require(isListed[_nftID], "NFT not listed");
        buyerDeposit[_nftID] += msg.value;
        require(
            buyerDeposit[_nftID] >= escrowAmount[_nftID],
            "Deposit below escrow amount"
        );
    }

    // Lender nạp tiền vay cho đúng NFT (thay cho việc gửi thẳng vào contract)
    function depositLoan(uint256 _nftID) public payable onlyLender {
        require(isListed[_nftID], "NFT not listed");
        lenderDeposit[_nftID] += msg.value;
    }

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    
    function updateInspectionStatus(uint256 _nftID, bool _passed)
        public
        onlyInspector
    {
        require(isListed[_nftID], "NFT not listed");
        inspectionPassed[_nftID] = _passed;
    }

    // Phê duyệt giao dịch từ các bên liên quan
    function approveSale(uint256 _nftID) public {
        require(isListed[_nftID], "NFT not listed");
        require(
            msg.sender == buyer[_nftID] ||
                msg.sender == seller ||
                msg.sender == lender,
            "Not a party of this sale"
        );
        approval[_nftID][msg.sender] = true;
    }

    function finalizeSale(uint256 _nftID) public {
        require(isListed[_nftID], "NFT not listed");
        require(inspectionPassed[_nftID], "Inspection not passed");
        require(approval[_nftID][buyer[_nftID]], "Buyer not approved");
        require(approval[_nftID][seller], "Seller not approved");
        require(approval[_nftID][lender], "Lender not approved");

        uint256 price = purchasePrice[_nftID];
        uint256 total = buyerDeposit[_nftID] + lenderDeposit[_nftID];
        require(total >= price, "Insufficient funds");

        address _buyer = buyer[_nftID];

        // Cập nhật trạng thái TRƯỚC khi chuyển tiền / NFT
        _resetSale(_nftID, _buyer);

        // Chuyển NFT cho buyer
        IERC721(nftAddress).transferFrom(address(this), _buyer, _nftID);

        // Chuyển đúng giá bán cho seller
        (bool okSeller, ) = seller.call{value: price}("");
        require(okSeller, "Transfer to seller failed");

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
                msg.sender == seller ||
                msg.sender == inspector,
            "Not authorized"
        );
        require(!inspectionPassed[_nftID], "Inspection already passed");

        address _buyer = buyer[_nftID];
        uint256 buyerRefund = buyerDeposit[_nftID];
        uint256 lenderRefund = lenderDeposit[_nftID];

        _resetSale(_nftID, _buyer);

        // Trả NFT về seller
        IERC721(nftAddress).transferFrom(address(this), seller, _nftID);

        // Hoàn tiền cho từng bên
        if (buyerRefund > 0) {
            (bool okBuyer, ) = payable(_buyer).call{value: buyerRefund}("");
            require(okBuyer, "Refund to buyer failed");
        }
        if (lenderRefund > 0) {
            (bool okLender, ) = payable(lender).call{value: lenderRefund}("");
            require(okLender, "Refund to lender failed");
        }
    }

    // Xóa toàn bộ dữ liệu của một giao dịch
    function _resetSale(uint256 _nftID, address _buyer) private {
        delete isListed[_nftID];
        delete purchasePrice[_nftID];
        delete escrowAmount[_nftID];
        delete buyer[_nftID];
        delete inspectionPassed[_nftID];
        delete buyerDeposit[_nftID];
        delete lenderDeposit[_nftID];
        delete approval[_nftID][_buyer];
        delete approval[_nftID][seller];
        delete approval[_nftID][lender];
    }
}