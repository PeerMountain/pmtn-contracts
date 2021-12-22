import hre from "hardhat";

// to deploy on ganache
// $ hh run scripts/cashier-deploy.ts--network ganache

async function main() {
  try {
    const cashierContract = await hre.ethers.getContractFactory(
      "CashierContractV1"
    );
    const cashierContractInstance = await hre.upgrades.deployProxy(
      cashierContract,
      { kind: "uups" }
    );
    await cashierContractInstance.deployed();

    console.log(
      "Cashier Contract deployed to",
      cashierContractInstance.address
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
