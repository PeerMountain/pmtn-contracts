import hre from "hardhat";
import { Config } from "../config";

const trustContractAddress = Config.TRUST_NFT_CONTRACT_ADDRESS;

async function main() {
  try {
    const trustContract = await hre.ethers.getContractFactory("TrustContract");
    const trustContractInstance = await hre.upgrades.upgradeProxy(
      trustContractAddress,
      trustContract
    );

    await trustContractInstance.deployed();

    console.log(
      "Trust Contract successfully upgraded at",
      trustContractInstance.address,
      "address"
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
