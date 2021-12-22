// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./CashierContract.sol";
import "./ITrustContract.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// TODO: add AttestationEngine inside Attestation Provider data provided in the purchase Function
contract CashierContractV2 is CashierContractV1 {
    using SafeMathUpgradeable for uint256;

    // variables
    mapping(address => uint256) private balances;
    address public trustContract;
    address public pmtnContract;
    uint256 public pmtnDecimals;
    uint256 public cashierPercentage;
    uint256 public enginePercentage;
    uint256 private proofOfWork;
    mapping(address => mapping(uint256 => bool)) private usedNonces;
    mapping(address => uint256) public lastNonce;
    mapping(address => mapping(uint256 => bool)) private nftNonces;

    event NewTokenMinted(
        address indexed holder,
        uint256 indexed tokenId,
        string tokenURI
    );
    event Payment(
        address payer,
        address indexed receiver,
        uint256 indexed amount,
        uint256 indexed nonce
    );

    /**
     *  @dev Verification of nonce provided by caller of public functions.
     *  The address is hashed with the nonce and is verified if this hash for leading zeros
     *
     *  @param nonce        Value of nonce
     *
     *  @return true if the value is valid, false otherwise.
     */
    function verifyPoW(uint256 nonce) public view returns (bool) {
        bytes32 data = keccak256(abi.encode(msg.sender, nonce));
        uint256 i;
        uint256 counter = 0;
        for (i = 0; i < proofOfWork; ++i) {
            if (data[i] == bytes32(0x0)) {
                counter++;
            }
        }
        return counter == proofOfWork;
    }

    /**
     *  @dev Returns last nonce used by address in messages signed
     *  and sent to Attestation Engine
     *
     *  @param add        Public address to retrieve data
     *
     *  @return last nonce used by address
     */
    function getLastNonce(address add) external view returns (uint256) {
        return lastNonce[add];
    }

    /**
     *  @dev Returns balance of given address
     *
     *  @param add        Public address to retrieve data
     *
     *  @return current balance
     */
    function balanceOf(address add) external view returns (uint256) {
        return balances[add];
    }

    /**
     *  @dev Returns proof of work required
     *
     *  @return number of minimum leading zeros
     */
    function getProofOfWork() external view returns (uint256) {
        return proofOfWork;
    }

    /**
     *  @dev Transfer funds from treasury account from customer
     *  to other address inside the message
     *
     *  @param pow        Nonce of caller
     *  @param customer   Address of message sender
     *  @param message    Message of customer
     *  @param signature  Signature of message created by customer
     *
     */
    function transfer(
        uint256 pow,
        address customer,
        bytes memory message,
        bytes memory signature
    ) external {
        require(verifyPoW(pow), "Invalid nonce");
        require(
            verifySignature(message, signature, customer),
            "Invalid message, signature or signer"
        );

        address recipient;
        uint256 amount;
        uint256 nonce;
        address contractAddress;

        (recipient, amount, nonce, contractAddress) = abi.decode(
            message,
            (address, uint256, uint256, address)
        );

        require(contractAddress == address(this), "Invalid address");
        require(!usedNonces[customer][nonce], "Already used nonce");
        usedNonces[customer][nonce] = true;
        lastNonce[customer] = nonce;

        uint256 margin = amount.mul(cashierPercentage).div(10**18);
        uint256 aeMargin = amount.mul(enginePercentage).div(10**18);

        _transfer(customer, recipient, amount.sub(margin).sub(aeMargin));
        _transfer(customer, msg.sender, aeMargin);
        _transfer(customer, address(this), margin);
    }

    /**
     *  @dev Transfer funds from treasury account from customer
     *  to other address inside the message
     *
     *  @param from     Address
     *  @param to       Address of message sender
     *  @param amount   Message of customer
     *
     */
    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal {
        require(from != address(0), "transfer from zero address");
        require(to != address(0), "transfer to zero address");

        balances[from] = balances[from].sub(
            amount,
            "transfer amount exceeds balance"
        );
        balances[to] = balances[to].add(amount);

        emit TransferCashier(from, to, amount);
    }

    /**
     *  @dev Deposit funds in customer treasury account
     *
     *  @param pow        Nonce of caller
     *  @param customer   Address of message sender
     *  @param message    Message of customer
     *  @param signature  Signature of message created by customer
     *
     */
    function deposit(
        uint256 pow,
        address customer,
        bytes memory message,
        bytes memory signature
    ) public {
        require(verifyPoW(pow), "Invalid nonce");
        require(
            verifySignature(message, signature, customer),
            "Invalid message, signature or signer"
        );

        uint256 amount;
        uint256 nonce;
        address contractAddress;

        (amount, nonce, contractAddress) = abi.decode(
            message,
            (uint256, uint256, address)
        );
        require(contractAddress == address(this), "Invalid address");
        require(!usedNonces[customer][nonce], "Already used nonce");
        usedNonces[customer][nonce] = true;
        lastNonce[customer] = nonce;

        _deposit(amount, customer);
    }

    /**
     *  @dev Deposit 'amount' to 'from' treasury account
     *
     *  @param amount   amount to be deposit
     *  @param from     user depositing
     *
     */
    function _deposit(uint256 amount, address from) internal {
        uint256 margin = amount.mul(cashierPercentage).div(10**18);
        uint256 aeMargin = amount.mul(enginePercentage).div(10**18);

        IERC20 dummyToken = IERC20(pmtnContract);

        bool success = dummyToken.transferFrom(from, address(this), amount);
        require(success, "Could not transfer ERC20 from caller");

        balances[address(this)] = balances[address(this)].add(margin);
        balances[msg.sender] = balances[msg.sender].add(aeMargin);
        balances[from] = balances[from].add(amount.sub(margin).sub(aeMargin));

        emit Deposit(from, amount.sub(margin).sub(aeMargin));
        emit Deposit(address(this), margin);
        emit Deposit(msg.sender, aeMargin);
    }

    /**
     *  @dev Withdraw funds in customer treasury account
     *
     *  @param pow        Nonce of caller
     *  @param customer   Address of message sender
     *  @param message    Message of customer
     *  @param signature  Signature of message created by customer
     *
     */
    function withdraw(
        uint256 pow,
        address customer,
        bytes memory message,
        bytes memory signature
    ) public {
        require(verifyPoW(pow), "Invalid nonce");
        require(
            verifySignature(message, signature, customer),
            "Invalid message, signature or signer"
        );

        uint256 amount;
        uint256 nonce;
        address contractAddress;
        (amount, nonce, contractAddress) = abi.decode(
            message,
            (uint256, uint256, address)
        );

        require(contractAddress == address(this), "Invalid address");
        require(!usedNonces[customer][nonce], "Already used nonce");
        usedNonces[customer][nonce] = true;
        lastNonce[customer] = nonce;

        _withdraw(amount, customer);
    }

    /**
     *  @dev Withdraw 'amount' from 'to' treasury account
     *
     *  @param amount   amount to be withdrawn
     *  @param to       user withdrawing
     *
     */
    function _withdraw(uint256 amount, address to) internal {
        balances[to] = balances[to].sub(amount, "not enough funds");
        uint256 margin = amount.mul(cashierPercentage).div(10**18);
        uint256 aeMargin = amount.mul(enginePercentage).div(10**18);
        uint256 withdrawAmount = amount.sub(margin).sub(aeMargin);

        balances[address(this)] = balances[address(this)].add(margin);
        balances[msg.sender] = balances[msg.sender].add(aeMargin);

        IERC20 dummyToken = IERC20(pmtnContract);

        bool success = dummyToken.transfer(to, withdrawAmount);
        require(success, "Could not transfer ERC20 from caller");

        emit Deposit(address(this), margin);
        emit Deposit(msg.sender, aeMargin);
        emit Withdraw(to, withdrawAmount);
    }

    /**
     *  @dev Make a payment of a given payment invoice
     *
     *  @param pow        Nonce of caller
     *  @param customer   Address of message sender
     *  @param message    Message of customer
     *  @param signature  Signature of message created by customer
     *
     */
    function payment(
        uint256 pow,
        address customer,
        bytes memory message,
        bytes memory signature
    ) external {
        require(verifyPoW(pow), "Invalid nonce");
        require(
            verifySignature(message, signature, customer),
            "Invalid message, signature or signer"
        );

        address to;
        uint256 amount;
        uint256 paymentNonce;
        uint256 nonce;
        address contractAddress;

        (to, amount, paymentNonce, nonce, contractAddress) = abi.decode(
            message,
            (address, uint256, uint256, uint256, address)
        );
        require(contractAddress == address(this), "Invalid address");
        require(!usedNonces[customer][nonce], "Already used customer nonce");
        require(!usedNonces[to][paymentNonce], "Already used paymentNonce");
        usedNonces[customer][nonce] = true;
        usedNonces[to][paymentNonce] = true;
        lastNonce[customer] = nonce;
        lastNonce[to] = paymentNonce;

        _payment(customer, to, amount, paymentNonce);
    }

    /**
     *  @dev Make a payment of a given payment invoice
     *
     *  @param from     payer user address
     *  @param to       paid user address
     *  @param amount   amount to be paid
     *  @param nonce    nonce of payment
     *
     */
    function _payment(
        address from,
        address to,
        uint256 amount,
        uint256 nonce
    ) internal {
        require(balances[from] > amount, "Caller doesn't have enough funds");

        uint256 cashierCut = amount.mul(cashierPercentage).div(
            10**pmtnDecimals
        );
        uint256 aeMargin = amount.mul(enginePercentage).div(10**18);
        _transfer(from, address(this), cashierCut);
        _transfer(from, msg.sender, aeMargin);
        _transfer(from, to, amount.sub(cashierCut).sub(aeMargin));

        emit Payment(from, to, amount.sub(cashierCut).sub(aeMargin), nonce);
        emit Deposit(msg.sender, aeMargin);
        emit Deposit(address(this), cashierCut);
    }

    /**
     *  @dev Set Trust Token contract address
     *
     *  @param tt_contract        Trust Contract address
     *
     * Requirements:
     * - only owner can call this function (Governance Contract)
     *
     */
    function setTrustTokenAddress(address tt_contract) external onlyOwner {
        trustContract = tt_contract;
    }

    /**
     *  @dev Set ERC20 Token contract address
     *
     *  @param erc20_contract     PMTN Contract address
     *
     * Requirements:
     * - only owner can call this function (Governance Contract)
     *
     */
    function setERC20TokenAddress(address erc20_contract) external onlyOwner {
        pmtnContract = erc20_contract;
    }

    /**
     *  @dev Set percentage of Cashier Contract
     *
     *  @param amount     percentage
     *
     * Requirements:
     * - only owner can call this function (Governance Contract)
     *
     */
    function setCashierPercentage(uint256 amount) external onlyOwner {
        cashierPercentage = amount;
    }

    /**
     *  @dev Set percentage of Attestation Engine
     *
     *  @param amount     percentage
     *
     * Requirements:
     * - only owner can call this function (Governance Contract)
     *
     */
    function setEnginePercentage(uint256 amount) external onlyOwner {
        enginePercentage = amount;
    }

    /**
     *  @dev Set decimals (similar to ERC20)
     *
     *  @param decimals     amount of decimals
     *
     * Requirements:
     * - only owner can call this function (Governance Contract)
     *
     */
    function setPMTNDecimals(uint256 decimals) external onlyOwner {
        pmtnDecimals = decimals;
    }

    /**
     *  @dev Set leading zeros for PoW
     *
     *  @param proof     amount of leading zeros
     *
     * Requirements:
     * - only owner can call this function (Governance Contract)
     *
     */
    function setLeadingZeros(uint256 proof) external onlyOwner {
        proofOfWork = proof;
    }

    /**
     *  @dev Split NFT Settings
     *
     *  @param nftSettings          message
     *  @param nftSettingsSigned    message signed
     *
     */
    function splitNftSettings(
        bytes memory nftSettings,
        bytes memory nftSettingsSigned
    ) public view returns (address, uint256) {
        address ap;
        uint256 price;
        bytes2 _nftType;
        uint256 expiration;

        (ap, price, _nftType, expiration) = abi.decode(
            nftSettings,
            (address, uint256, bytes2, uint256)
        );

        require(expiration > block.timestamp, "Expired NFT Settings");
        require(
            verifySignature(nftSettings, nftSettingsSigned, ap),
            "Bad NFT Settings"
        );

        return (ap, price);
    }

    /**
     *  @dev Split NFT Settings
     *
     *  @param ap                       Attestation Provider address
     *  @param attestationData          Attestation Data message
     *  @param attestationDataSigned    Attestation Data signed by Attestation Provider
     *
     */
    function splitAttestationData(
        address ap,
        bytes memory attestationData,
        bytes memory attestationDataSigned
    ) public pure returns (bool, address) {
        address provider;
        address engine;

        (provider, engine, , , ) = abi.decode(
            attestationData,
            (address, address, bytes32, string, bytes32)
        );

        require(provider == ap, "Invalid Attestation Provider Address");
        require(engine != address(0), "Invalid Attestation Engine");
        return (
            verifySignature(attestationData, attestationDataSigned, provider),
            engine
        );
    }

    /**
     *  @dev transfer NFT
     *
     *  @param pow        Nonce of caller
     *  @param customer   Address of message sender
     *  @param message    Message of customer
     *  @param signature  Signature of message created by customer
     *
     */
    function nftTransfer(
        uint256 pow,
        address customer,
        bytes memory message,
        bytes memory signature
    ) public {
        require(verifyPoW(pow), "Invalid nonce");
        require(
            verifySignature(message, signature, customer),
            "Invalid message, signature or signer"
        );

        address to;
        uint256 tokenId;
        uint256 nonce;
        address contractAddress;

        (to, tokenId, nonce, contractAddress) = abi.decode(
            message,
            (address, uint256, uint256, address)
        );
        ITrustContract trust = ITrustContract(trustContract);
        // return;
        trust.transferFromAE(customer, to, tokenId);
    }

    /**
     *  @dev transfer NFT
     *
     *  @param nonce      Nonce of caller
     *  @param customer   Address of message sender
     *  @param message    Message of customer
     *  @param signature  Signature of message created by customer
     *
     */
    function nftMint(
        uint256 nonce,
        address customer,
        bytes memory message,
        bytes memory signature
    ) public {
        require(verifyPoW(nonce), "Invalid nonce");
        require(
            verifySignature(message, signature, customer),
            "Invalide message, signature or signer"
        );

        address nftOwner;
        uint256 nftInvoice;
        bytes memory nftSettings;
        bytes memory nftSettingsSigned;
        bytes memory attestationData;
        bytes memory attestationDataSigned;

        (
            nftOwner,
            nftInvoice,
            nftSettings,
            nftSettingsSigned,
            attestationData,
            attestationDataSigned
        ) = abi.decode(message, (address, uint256, bytes, bytes, bytes, bytes));
        require(!nftNonces[msg.sender][nftInvoice], "Invoice already minted");
        nftNonces[msg.sender][nftInvoice] = true;
        _nftMint(
            nftOwner,
            nftSettings,
            nftSettingsSigned,
            attestationData,
            attestationDataSigned
        );
    }

    /**
     *  @dev transfer NFT
     *
     *  @param nftOwner                 Nonce of caller
     *  @param nftSettings              Address of message sender
     *  @param nftSettingsSigned        Message of customer
     *  @param attestationData          Signature of message created by customer
     *  @param attestationDataSigned    Attestation Data signed
     *
     */
    function _nftMint(
        address nftOwner,
        bytes memory nftSettings,
        bytes memory nftSettingsSigned,
        bytes memory attestationData,
        bytes memory attestationDataSigned
    ) internal {
        address provider;
        uint256 price;
        bool attestationDataSuccess;
        address engine;

        (provider, price) = splitNftSettings(nftSettings, nftSettingsSigned);
        (attestationDataSuccess, engine) = splitAttestationData(
            provider,
            attestationData,
            attestationDataSigned
        );
        require(attestationDataSuccess, "Bad Attestation data");

        ITrustContract trust = ITrustContract(trustContract);
        uint256 tokenId;
        string memory tokenURI;
        // return;
        (tokenId, tokenURI) = trust.mintToken(
            nftOwner,
            nftSettings,
            attestationData
        );
        emit NewTokenMinted(nftOwner, tokenId, tokenURI);
    }

    /**
     *  @dev Verify the validity of given message/signature/signer
     *
     *  @param messageToHash Message that was hashed and signed
     *  @param signature     Signature of message
     *  @param signer        Address of signer
     *
     */
    function verifySignature(
        bytes memory messageToHash,
        bytes memory signature,
        address signer
    ) public pure returns (bool) {
        bytes32 messageHash = keccak256(messageToHash);

        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );

        return recoverSigner(ethSignedMessageHash, signature) == signer;
    }

    /**
     *  @dev Recover signer of given message and signature
     *
     *  @param ethSignedMessageHash Message that was hashed and signed
     *  @param signature     Signature of message
     *
     */
    function recoverSigner(bytes32 ethSignedMessageHash, bytes memory signature)
        public
        pure
        returns (address)
    {
        (uint8 v, bytes32 r, bytes32 s) = splitSignature(signature);
        return ecrecover(ethSignedMessageHash, v, r, s);
    }

    /**
     *  @dev Split signature so it's possible to verify signer
     *
     *  @param sig Signature to be splitted
     *
     */
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

    receive() external payable {}
}
