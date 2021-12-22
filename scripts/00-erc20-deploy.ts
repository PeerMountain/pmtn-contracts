import hre from "hardhat";

// deployed ERC20 address (testnet): 0x4d26774771a9D7CA38Ae419b695deC042B25e98d

async function main() {
  if (hre.network.name === "rsk_testnet") {
    console.warn(
      "You are trying to deploy a contract to the RSK TestNet, which" +
        " only purpose is to test contracts on real environment"
    );
  }

  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log(
    "Deployer balance:",
    (await deployer.getBalance()).toString(),
    "rBTC"
  );

  const erc20Contract = await hre.ethers.getContractFactory("DummyERC20");
  const erc20Instance = await erc20Contract.deploy();

  await erc20Instance.deployed();

  console.log("Test PMTN address:", erc20Instance.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
