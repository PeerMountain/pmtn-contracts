import hre from "hardhat";
import { Config } from "../config";

const cashierContractAddress = Config.CASHIER_CONTRACT_ADDRESS;
const trustContractAddress = Config.TRUST_NFT_CONTRACT_ADDRESS;

async function main() {
  try {
    const [deployer] = await hre.ethers.getSigners();
    const cashierContract = await hre.ethers.getContractFactory(
      "CashierContractV2"
    );
    console.log("Cashier Contract Address:", cashierContractAddress);
    console.log("deployer:", deployer);
    const trustContract = await hre.ethers.getContractFactory("TrustContract");
    const cashierContractInstance = await cashierContract.attach(
      cashierContractAddress
    );
    const trustContractInstance = await trustContract.attach(
      trustContractAddress
    );

    await cashierContractInstance
      .connect(deployer)
      .transferOwnership("0x0CECeF6C199a8fdd67A901380f4bf907A6dC2A7F");

    await trustContractInstance
      .connect(deployer)
      .transferOwnership("0x0CECeF6C199a8fdd67A901380f4bf907A6dC2A7F");
  } catch (err) {
    console.log(err);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
