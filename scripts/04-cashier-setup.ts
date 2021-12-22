import hre from "hardhat";

const cashierContractAddress = "0x7b7Ec4C333fC5E3D0B4001fC818491A7AE59a407";

async function main() {
  try {
    const [deployer] = await hre.ethers.getSigners();
    const cashierContract = await hre.ethers.getContractFactory(
      "CashierContractV2"
    );
    const instance = await cashierContract.attach(cashierContractAddress);

    // ganache rodrigo local blockchain
    // erc20 ganache address: 0xc103e4a0c1a06380a2b047898B1c6cdc442bDEb9
    // erc20 rsktestnet address: 0x4d26774771a9D7CA38Ae419b695deC042B25e98d
    // erc20 rinkeby address: 0xec5c94B5FF4d2A88e29bC1D2678a65347197f646
    // trustToken rsktestnet address: 0x053965Ca43f024d701AA4bF5c39db8aAcfCCF1A0
    // trustToken rinkeby address: 0xaB86A50856a77a4cF4B071ed3763A605E52031A3
    await instance
      .connect(deployer)
      .setERC20TokenAddress("0x4d26774771a9D7CA38Ae419b695deC042B25e98d");
    await instance
      .connect(deployer)
      .setTrustTokenAddress("0x053965Ca43f024d701AA4bF5c39db8aAcfCCF1A0");
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
