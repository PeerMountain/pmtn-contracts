# PMO Contracts
[![PeerMountain](https://peermountain.com/wp-content/uploads/2021/07/admin-ajax-small.png)](https://peermountain.com/)
##### _Smart Contracts interactions_

### Smart Contracts

- [PeerMountain Tokens](#peermountain-tokens) (ERC20)  
- [TrustTokens](#trusttoken) (ERC721)
- [Cashier Contract](#cashier-contract)
- [Governance Contract](#governance-contract)

### PeerMountain Tokens

PeerMountain Tokens are used as governance and currency tokens at the Cashier Contract.
//TODO: add more information about deployed contract in ethereum mainnet (what infos?)

### TrustToken

Trust Token is the smart contract that generate all NFT. All non-view functions on this contract are only accessible by Cashier Contract calls, which adds a layer of control in the mintage of new non fungible tokens.

The NFT's can store an array of address hashed, the address of the attestation provider, the settings of the type of nft mint and an hashed data that can be used to validated the same data stored off-chain.

#### Data Stored

The relevant data stored in the Trust Token Smart Contract that are linked to the NFT are:
1. Key Arrays - The hashed value of public addresses stored as 32 bytes array
2. NFT Provider - Address of Attestation Provider
3. NFT Settings - The hashed value of NFT Settings stored as 32 bytes array
4. NFT Data - The hashed value of NFT Data provided by Attestation Provider
5. Token URI - URI to access off-chain data

All data stored as hashed must have the original data not hashed stored off-chain.

#### Events
- TokenMinted(address holder, uint256 tokenId, string tokenURI)
  - Emitted when new token is created
- Transfer(address from, address to, uint256 tokenId)
  - Emitted when a token is transfered between addresses

#### Functions
- mintToken()
    * Used to mint a new token for a given owner.
    * Must provide Address of Owner, NFT Settings and Attestation Data.
    * Parameters:
        * nftOwner - Address of owner of NFT
        * nftSettings - Hashed NFT Settings
        * attestationData - Hashed attestation data


- transferFromAE()
    * Used to transfer a token from one address to another.
    * Must provide the Address of previous owner, Address of new owner and token Id
    * Parameters:
        * from - Address from owner of tokenID to be transfer
        * to - Address of new owner of tokenID to be transfer
        * tokenId - ID of NFT token to be transfer
PS: Uses internal ERC721 _transfer() function


- burn()
    * Used to burn a token.
    * Must provide tokenId and the caller must be the current owner
    * Parameters
        * tokenId - Token Id to be burned


- getTokenData
    * Used to return data stored
    * Must provide tokenId. It's a view function.
    * Parameters
        * tokenId - Token Id to retrieve data

### Cashier Contract

Cashier Contract holds every users treasury account, using this contract the Attestation Engine will be able to execute all interactions the user wants to. From depositing PMTN and withdrawing to making payments for new NFTs or transfers of owned NFT. All functions of this contract must be called providing a proof of work, that is setup by the Governance Contract. 

To ensure that the data sent by the user to the Attestation Engine is not rigged, the message must be signed, and includes the address of the contract and an user nonce, to avoid replay attacks.

In this contract are only stored treasury account balance, nonces used by callers, proof of work difficult challenge, percentages cuts for Cashier Contract and Attestation Engine.

#### Data Stored

The relevant data stored in the Cashier Smart Contract that are linked to the user's treasury account:
1. Balance (address => uint256) - A mapping of user's balance
2. PMTN Contract (address) - Address of PeerMountain Token ERC20 contract
3. Cashier Percentage (uint256) - Percentage of Cashier Contract's cut for every transaction
4. Engine Percentage (uint256) - Percentage of Attestation Engine's cut for every transaction
5. Proof of Work (uint256) - Number of leading zeros required to nonce be usable in non-view functions call
6. Users Used Nonce (address => (uint256 => bool)) - Used nonce's by users
7. Last User Nonce (address => uint256) - Last used nonce from address
8. Invoices Nonce (address => (uint256 => bool)) - Invoice's nonce used

All data stored as hashed must have the original data not hashed stored off-chain.

#### Events
- NewTokenMinted(address holder, uint256 tokenId, string tokenURI)
  - Emitted when new token is created
- Payment(address payer, address receiver, uint256 amount, uint256 nonce)
  - Emitted when an invoice is paid
- event TransferCashier(address indexed from, address indexed to, uint256 value)
  - Emitted when any amount is transfered between users
- event Deposit(address indexed from, uint256 value)
  - Emitted when a user uses the Deposit function
- event Withdraw(address indexed from, uint256 value)
  - Emitted when a user uses the Withdraw function

##### Functions
- verifyPoW()
    * Verification of nonce provided by caller of public functions. The address is hashed with the nonce and is verified if this hash for leading zeros
    * Parameters
        * nonce - Nonce of Attestation Engine to be verified


- getLastNonce()
    * Returns last nonce used by address in messages signed.
    * Parameters
        * add - Address of nonce to be retrieved


- balanceOf()
    * Returns balance of given address
    * Parameters
        * add - Address of interest to retrieve balance


- getProofOfWork()
    * Returns proof of work required, which is the minimum number of leading zeros.


- transfer()
    * Transfer funds from treasury account from customer to other address inside the message
    * Parameters
        * pow - Nonce of Attestation Engine to be verified
        * customer - Address of signer of message
        * message - Message of customer
        * signature - Message signed by customer


- deposit
    * Deposit funds in customer treasury account
    * Parameters
        * pow - Nonce of Attestation Engine to be verified
        * customer - Address of signer of message
        * message - Message of customer
        * signature - Message signed by customer


- withdraw
    * Withdraw funds in customer treasury account
    * Parameters
        * pow - Nonce of Attestation Engine to be verified
        * customer - Address of signer of message
        * message - Message of customer
        * signature - Message signed by customer


- payment
    * Make a payment of a given payment invoice
    * Parameters
        * pow - Nonce of Attestation Engine to be verified
        * customer - Address of signer of message
        * message - Message of customer
        * signature - Message signed by customer


- setTrustTokenAddress
    * Set Trust Token contract address
    * Requirements: only owner can call this function (Governance Contract)
    * Parameters
        * tt_contract - Trust Contract Address


- setERC20TokenAddress
    * Set ERC20 Token contract address
    * Requirements: only owner can call this function (Governance Contract)
    * Parameters
        * erc20_contract - PMTN ERC20 Contract Address


- setCashierPercentage
    * Set percentage of Cashier Contract
    * Requirements: only owner can call this function (Governance Contract)
    * Parameters
        * amount - Percentage of Cashier Contract 


- setEnginePercentage
    * Set percentage of Attestation Engine
    * Requirements: only owner can call this function (Governance Contract)
    * Parameters
        * amount - Percentage of Attestation Engine 


- setPMTNDecimals
    * Set decimals (similar to ERC20) 
    * Requirements: only owner can call this function (Governance Contract)
    * Parameters
        * decimals - Amount of decimals 



- setLeadingZeros
    * Set leading zeros for Proof of Work
    * Requirements: only owner can call this function (Governance Contract)
    * Parameters
        * proof - Amount of leading zeros required to hashed nonce with address. 


- splitNftSettings
    * Split NFT Settings
    * Parameters
        * nftSettings - Bytes array of NFT Settings
        * nftSettingsSigned - NFT Settings signed by Attestation Provider


- splitAttestationData
    * Split Attestation Data
    * Parameters
        * ap - Attestation Provider address
        * attestationData - Bytes array of NFT Settings
        * attestationDataSigned - NFT Settings signed by Attestation Provider


- nftTransfer
    * Transfer NFT between to addresses
    * Parameters
        * pow - Nonce of Attestation Engine to be verified
        * customer - Address of signer of message
        * message - Message of customer
        * signature - Message signed by customer


- nftMint
    * Mint new NFT
    * Parameters
        * pow - Nonce of Attestation Engine to be verified
        * customer - Address of signer of message
        * message - Message of customer
        * signature - Message signed by customer


- verifySignature
    * Verify the validity of given message/signature/signer
    * Parameters
        * messageToHash - Message that has been hashed and signed
        * signature - Signature of message
        * signer - Address of signer of message


- recoverSigner
    * Recover signer of given message and signature
    * Parameters
        * ethSignedMessageHash - Message that has been hashed and signed
        * signature - Signature of message


- receive
    * fallback default function


### Governance Contract (**TBD**)

Through the Governance Contract the community will be able to decide the path of the project. Using a voting system  the users will be able to propose new changes such as: increase of fees, decrease of fees, distribution of profit, new proof of work difficult and others.

#### Functions

TBD




