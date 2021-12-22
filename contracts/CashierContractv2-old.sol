// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./CashierContract.sol";
import "./ITrustContract.sol";

contract CashierContractV2Old is CashierContractV1 {
    using SafeMathUpgradeable for uint256;

    // variables
    mapping(address => uint256) _balances;
    address public _trust_contract;

    function balanceOf(address acc) external view returns (uint256) {
        return _balances[acc];
    }

    function transfer(address recipient, uint256 amount) external {
        _transfer(_msgSender(), recipient, amount);
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal {
        require(sender != address(0), "transfer from zero address");
        require(recipient != address(0), "transfer to zero address");

        _balances[sender] = _balances[sender].sub(
            amount,
            "transfer amount exceeds balance"
        );
        _balances[recipient] = _balances[recipient].add(amount);

        emit TransferCashier(sender, recipient, amount);
    }

    function deposit() public payable {
        uint256 margin = msg.value.div(100); // hardcoded percentage as margin

        _balances[address(this)] = _balances[address(this)].add(margin);
        _balances[msg.sender] = _balances[msg.sender].add(
            msg.value.sub(margin)
        );

        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external payable {
        _balances[msg.sender] = _balances[msg.sender].sub(
            amount,
            "not enough funds"
        );
        payable(msg.sender).transfer(amount);
        emit Withdraw(msg.sender, amount);
    }

    function setTrustTokenAddress(address tt_contract) external {
        _trust_contract = tt_contract;
    }

    function splitNftSettings(
        bytes memory nftSettings,
        bytes memory nftSettingsSigned
    ) public view returns (address provider, uint256 nftPrice) {
        address ap;
        bool perpetuity;
        uint256 price;
        bytes2 _nftType;
        uint256 expiration;

        (ap, perpetuity, price, _nftType, expiration) = abi.decode(
            nftSettings,
            (address, bool, uint256, bytes2, uint256)
        );

        require(expiration > block.timestamp, "Expired NFT Settings");
        require(
            _balances[msg.sender] > price,
            "Caller doesn't have enough funds"
        );
        require(
            verifyEncodedNftSettings(nftSettings, nftSettingsSigned, ap),
            "Bad NFT Settings"
        );

        return (ap, price);
    }

    function splitAttestationData(
        bytes memory attestationData,
        bytes memory attestationDataSigned
    ) public pure returns (bool) {
        address provider;

        (provider, , , , ) = abi.decode(
            attestationData,
            (address, bytes32, string, bytes32, bytes2)
        );

        return
            verifyEncodedAttestationData(
                attestationData,
                attestationDataSigned,
                provider
            );
    }

    event NewTokenMinted(address holder, uint256 tokenId, string tokenURI);

    function purchase(
        address nftOwner,
        bytes memory nftSettings,
        bytes memory nftSettingsSigned,
        bytes memory attestationData,
        bytes memory attestationDataSigned
    ) external {
        address provider;
        uint256 price;
        (provider, price) = splitNftSettings(nftSettings, nftSettingsSigned);

        require(
            splitAttestationData(attestationData, attestationDataSigned),
            "Bad Attestation data"
        );

        _transfer(msg.sender, provider, price);

        ITrustContract trust = ITrustContract(_trust_contract);
        uint256 tokenId;
        string memory tokenURI;
        (tokenId, tokenURI) = trust.mintToken(
            nftOwner,
            nftSettings,
            attestationData
        );
        emit NewTokenMinted(nftOwner, tokenId, tokenURI);
    }

    function verifyEncodedAttestationData(
        bytes memory attestationData,
        bytes memory signature,
        address signer
    ) public pure returns (bool) {
        bytes32 messageHash = keccak256(attestationData);

        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );

        return recoverSigner(ethSignedMessageHash, signature) == signer;
    }

    function verifyEncodedNftSettings(
        bytes memory nftSettings,
        bytes memory nftSettingsSigned,
        address provider
    ) public pure returns (bool) {
        bytes32 messageHash = keccak256(nftSettings);

        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );

        return
            recoverSigner(ethSignedMessageHash, nftSettingsSigned) == provider;
        // return recoverSigner(messageHash, nftSettingsSigned) == provider;
    }

    function verifyNFTSettings(
        bytes2 nft_type,
        bool nft_perpetuity,
        uint256 nft_price,
        uint256 nft_expiration,
        address nft_provider,
        bytes memory signature
    ) public pure returns (bool) {
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                nft_type,
                nft_perpetuity,
                nft_price,
                nft_expiration,
                nft_provider
            )
        );
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );

        return recoverSigner(ethSignedMessageHash, signature) == nft_provider;
    }

    function verifyAttestationData(
        address signer,
        bytes32 hash_key_array,
        string memory token_uri,
        bytes32 hashed_data,
        bytes2 nft_type,
        bytes memory signature
    ) public pure returns (bool) {
        bytes32 messageHash = keccak256(
            abi.encodePacked(hash_key_array, token_uri, hashed_data, nft_type)
        );
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );

        return recoverSigner(ethSignedMessageHash, signature) == signer;
    }

    function recoverSigner(bytes32 ethSignedMessageHash, bytes memory signature)
        public
        pure
        returns (address)
    {
        (uint8 v, bytes32 r, bytes32 s) = splitSignature(signature);
        return ecrecover(ethSignedMessageHash, v, r, s);
    }

    function splitSignature(bytes memory sig)
        public
        pure
        returns (
            uint8 v,
            bytes32 r,
            bytes32 s
        )
    {
        require(sig.length == 65, "invalid signature length");
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }

    receive() external payable {
        deposit();
    }
}
