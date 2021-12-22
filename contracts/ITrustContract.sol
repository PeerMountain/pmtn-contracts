// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ITrustContract {
    event TokenMinted(
        address indexed recipient,
        uint256 indexed tokenId,
        string indexed tokenURI
    );
    event AuthorityGranted(address authority, address sender);
    event AuthorityRevoked(address authority, address sender);

    function mintToken(
        address nftOwner,
        bytes memory nftSettings,
        bytes memory attestationData
    ) external returns (uint256, string memory);

    function transferFromAE(
        address from,
        address to,
        uint256 tokenId
    ) external;

    /**
        @dev Burn a PMO Token with `tokenId` id that has expired.

        @param tokenId     PMO Token id

        Requirements:
        - Only the holder of token address can call this function
     */
    function burn(uint256 tokenId) external;

    /**
        @dev Returns `tokenId` data

        @param tokenId NFT Token Id
    */
    function getTokenData(uint256 tokenId)
        external
        view
        returns (
            bytes32 keys,
            bytes32 settings,
            address provider,
            bytes32 data
        );
}
