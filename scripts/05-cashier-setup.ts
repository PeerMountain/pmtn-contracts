import hre from "hardhat";
import { Config } from "../config";

const cashierContractAddress = Config.CASHIER_CONTRACT_ADDRESS;
const trustContractAddress = Config.TRUST_NFT_CONTRACT_ADDRESS;
const pmtnContractAddress = Config.PMTN_CONTRACT_ADDRESS;

async function main() {
  try {
    const [deployer] = await hre.ethers.getSigners();
    const cashierContract = await hre.ethers.getContractFactory(
      "CashierContractV2"
    );
    const instance = await cashierContract.attach(cashierContractAddress);

    await instance.connect(deployer).setERC20TokenAddress(pmtnContractAddress);
    await instance.connect(deployer).setTrustTokenAddress(trustContractAddress);
    await instance.connect(deployer).setPMTNDecimals(18);

    const erc20AddressOnContract = await instance.pmtnContract();
    const trustAddressOnContract = await instance.trustContract();
    const pmtnDecimals = await instance.pmtnDecimals();

    console.log(
      "Updated Address of test PMTN Token to",
      erc20AddressOnContract
    );
    console.log(
      "Updated Address of test Trust Token to",
      trustAddressOnContract
    );
    console.log(
      "Decimals used to calc percentage is set to",
      pmtnDecimals.toString()
    );
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
