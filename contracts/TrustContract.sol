// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./ITrustContract.sol";

contract TrustContract is
    ITrustContract,
    Initializable,
    ERC721URIStorageUpgradeable,
    UUPSUpgradeable,
    OwnableUpgradeable
{
    using CountersUpgradeable for CountersUpgradeable.Counter;
    CountersUpgradeable.Counter private _token_ids;
    using SafeMathUpgradeable for uint256;

    address public cashier_address;

    // complex structs mappings
    mapping(uint256 => bytes32) private _keys_arrays;
    mapping(uint256 => address) private _nft_provider;
    mapping(uint256 => bytes32) private _nft_settings;
    mapping(uint256 => bytes32) private _nft_data;

    function initialize(address cashierAddress) public initializer {
        __ERC721_init("Trust Token", "TT");
        __Ownable_init_unchained();
        cashier_address = cashierAddress;
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {}

    /**** Authorization aspect and authorities management *****/
    modifier authorized() {
        require(cashier_address == msg.sender, "Unauthorized function call.");
        _;
    }

    // ERC721 FUNCTIONS START

    /**
     *  @dev Oracle mint token to `recipient`.
     *
     *  @param nftOwner        Address to whom the NFT will be minted
     *  @param nftSettings     Perpetuity boolean flag
     *  @param attestationData Account address
     *
     *  Requirements:
     *  - Only authorized address can call this function (implicit modifier requirement)
     *
     *  Emits { TokenMinted } event.
     */

    function mintToken(
        address nftOwner,
        bytes memory nftSettings,
        bytes memory attestationData
    ) external override authorized returns (uint256, string memory) {
        _token_ids.increment();
        uint256 tokenId = _token_ids.current();
        _mint(nftOwner, tokenId);

        address nftProvider;
        bytes32 keysArray;
        string memory _tokenURI;
        bytes32 nftData;

        (nftProvider, , keysArray, _tokenURI, nftData) = abi.decode(
            attestationData,
            (address, address, bytes32, string, bytes32)
        );
        _setTokenURI(tokenId, _tokenURI);
        _keys_arrays[tokenId] = keysArray;
        _nft_settings[tokenId] = keccak256(nftSettings);
        _nft_provider[tokenId] = nftProvider;
        _nft_data[tokenId] = nftData;
        emit TokenMinted(nftOwner, tokenId, _tokenURI);
        return (tokenId, _tokenURI);
    }

    function transferFromAE(
        address from,
        address to,
        uint256 tokenId
    ) external override authorized {
        _transfer(from, to, tokenId);
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override {}

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override {}

    // MOVE GOVERNANCE TO OTHER CONTRACT
    // struct voteStruct {
    //     address voter;
    //     bool vote;
    // }

    // mapping(address => voteStruct) priceAuthorization

    // function approvePMONewPrice(bool vote) external authorized {
    //     // 1. address vote
    //     // 2. update mapping priceAuthorization
    //     // 3. check if enough votes to update
    //     // 4. update price
    // }

    // IMPORTANT: we are considering that expiration is in block.timestamp format.
    // It's a timestamp limit of the validation, after the timestamp became invalid
    /**
     *  @dev Burn a PMO Token with `tokenId` id that has expired.
     *
     *  @param tokenId     PMO Token id
     *
     *  Requirements:
     *  - Only the holder of token address can call this function
     */
    function burn(uint256 tokenId) external override {
        require(
            ERC721Upgradeable.ownerOf(tokenId) == msg.sender,
            "Can't burn this token."
        );
        _burn(tokenId);
    }

    // GET TOKENS INFORMATION FUNCTIONS

    /**
     *  @dev Returns `tokenId` data
     *
     *  @param tokenId NFT Token Id
     */
    function getTokenData(uint256 tokenId)
        external
        view
        override
        returns (
            bytes32 keys,
            bytes32 settings,
            address provider,
            bytes32 data
        )
    {
        return (
            _keys_arrays[tokenId],
            _nft_settings[tokenId],
            _nft_provider[tokenId],
            _nft_data[tokenId]
        );
    }
}
