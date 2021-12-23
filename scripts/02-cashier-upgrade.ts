import hre from "hardhat";
import { Config } from "../config";
// to deploy on ganache
// $ hh run scripts/cashier-upgrade.ts --network ganache

const cashierContractAddress = Config.CASHIER_CONTRACT_ADDRESS;

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
