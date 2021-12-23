import hre from "hardhat";
import { Config } from "../config";

const cashierContractAddress = Config.CASHIER_CONTRACT_ADDRESS;

async function main() {
  try {
    const [deployer] = await hre.ethers.getSigners();
    const cashierContract = await hre.ethers.getContractFactory(
      "CashierContractV2"
    );
    const instance = await cashierContract.attach(cashierContractAddress);

    await instance
      .connect(deployer)
      .setCashierPercentage(hre.ethers.BigNumber.from("100000000000000000"));
    await instance
      .connect(deployer)
      .setEnginePercentage(hre.ethers.BigNumber.from("100000000000000000"));
    await instance.connect(deployer).setLeadingZeros(2);

    const cashierPercentage = await instance.cashierPercentage();
    const enginePercentage = await instance.enginePercentage();
    const proofOfWork = await instance.getProofOfWork();

    console.log(
      "Cashier Contract percentage is set to ",
      hre.ethers.utils.formatUnits(cashierPercentage),
      "%"
    );
    console.log(
      "Attestation Engine percentage is set to ",
      hre.ethers.utils.formatUnits(enginePercentage),
      "%"
    );
    console.log(
      "Proof of Work required to call Cashier Contract is set to",
      proofOfWork.toString(),
      "leading zeros"
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
