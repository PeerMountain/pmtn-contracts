// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";


contract CashierContractV1 is ContextUpgradeable, UUPSUpgradeable, OwnableUpgradeable {
    using SafeMathUpgradeable for uint256;

    // variables

    // events
    event TransferCashier(
        address indexed from,
        address indexed to,
        uint256 value
    );
    event Deposit(address indexed from, uint256 value);
    event Withdraw(address indexed from, uint256 value);

    function initialize() public initializer {
        __Context_init_unchained();
        __Ownable_init_unchained();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
