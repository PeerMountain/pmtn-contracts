import hre from "hardhat";
// to deploy on ganache
// $ hh run scripts/cashier-upgrade.ts --network ganache

// cashier contract address ganache: 0x6089C44b15B008FBBf6190446802e0080936F0c7
// cashier contract address rsktestnet: 0x7b7Ec4C333fC5E3D0B4001fC818491A7AE59a407
// cashier contract address rinkeby: 0x3125DC95cf4f3c65c6ab6727CBe766cBdA380D98
const cashierContractAddress = "0x7b7Ec4C333fC5E3D0B4001fC818491A7AE59a407";

async function main() {
  try {
    const cashierContractv2 = await hre.ethers.getContractFactory(
      "CashierContractV2"
    );
    const cashierContractv2Instance = await hre.upgrades.upgradeProxy(
      cashierContractAddress,
      cashierContractv2
    );
    await cashierContractv2Instance.deployed();

    console.log(
      "Cashier Contract upgraded to",
      cashierContractv2Instance.address
    );
  } catch (err) {
    console.error(err);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
