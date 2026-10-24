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

    constructor(address _nftAddress, address payable _seller, address _inspector, address _lender) {
        nftAddress = _nftAddress;
        seller = _seller;
        inspector = _inspector;
        lender = _lender;
    }
}