import hre from "hardhat";

// deployed at rsk testnet: 0x053965Ca43f024d701AA4bF5c39db8aAcfCCF1A0
// trust token address rinkeby: 0xec5c94B5FF4d2A88e29bC1D2678a65347197f646
// trust token proxy

async function main() {
  try {
    if (hre.network.name === "rsk_testnet") {
      console.warn(
        "You are trying to deploy a contract to the RSK Testnet, which " +
          "only purpose is to test contracts on a real environment"
      );
    }

    const [deployer] = await hre.ethers.getSigners();

    console.log("Deploying Trust Contract with the account", deployer.address);
    console.log(
      "Deployer balance:",
      (await deployer.getBalance()).toString(),
      " rBTC"
    );

    const cashierContractAddress = "0x7b7Ec4C333fC5E3D0B4001fC818491A7AE59a407";

    const trustContract = await hre.ethers.getContractFactory("TrustContract");
    const trustInstance = await hre.upgrades.deployProxy(
      trustContract,
      [cashierContractAddress],
      { kind: "uups" }
    );

    await trustInstance.deployed();

    console.log("Trust Contract deployed at", trustInstance.address);
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
