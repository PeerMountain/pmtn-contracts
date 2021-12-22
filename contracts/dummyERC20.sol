// SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DummyERC20 is ERC20 {
  constructor() ERC20('Test PMTN', 'tPMTN') {

  }

  function mint(address buyer, uint256 amount) public {
    _mint(buyer, amount);
  }
}