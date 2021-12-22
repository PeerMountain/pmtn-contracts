import hre from "hardhat";

const cashierContractAddress = "0x7b7Ec4C333fC5E3D0B4001fC818491A7AE59a407";
const trustContractAddress = "0x053965Ca43f024d701AA4bF5c39db8aAcfCCF1A0";

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
