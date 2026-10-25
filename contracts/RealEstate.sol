// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract RealEstate is ERC721URIStorage { 
    uint256 private _lastTokenId; // NFT đầu tiên có id = 1

    constructor() ERC721("Real Estate", "REAL") {}

    function mint(string memory _tokenURI) public returns (uint256) {
        _lastTokenId++;
        uint256 newId = _lastTokenId;
        _safeMint(msg.sender, newId);
        _setTokenURI(newId, _tokenURI);

        return newId;
    }

    function totalSupply() public view returns (uint256) {
        return _lastTokenId;
    }
}