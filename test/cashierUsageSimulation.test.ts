import hre from "hardhat";
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { Wallet } from "ethers";

import { hashMessage, _TypedDataEncoder } from "@ethersproject/hash";
const ethers = hre.ethers;
const { networks } = require("../hardhat.config");

chai.use(chaiAsPromised);
const expect = chai.expect;

const BN = ethers.BigNumber;

const CASHIER_PERC = "100000000000000000"; // 0.1 %
const ENGINE_PERC = "100000000000000000"; // 0.1 % 1 000 000 000 000 000 000
const DEPOSIT_AMOUNT = "1000000000000000000";
const GAS_PRICE_RSk = "65";

//   100 000 000 000 000 000
// 1 000 000 000 000 000 000

const loggingEvents = false;
const loggingGas = false;
const USDEUR = 0.86;
const rBTCEUR = 44750 * USDEUR;

const calculateRSK = (gasUsed: number) => {
  const gasPrice = ethers.utils.parseUnits(GAS_PRICE_RSk, "mwei");
  return parseFloat(ethers.utils.formatEther(gasPrice.mul(gasUsed)));
};

const logGas = (
  functionName: string,
  gasUsed: number,
  description?: string
) => {
  if (loggingGas) {
    const RSK = calculateRSK(gasUsed);
    const valueRSK = RSK * rBTCEUR;
    const rskStr = `rsk: ${RSK.toFixed(10)} rBTC (~${valueRSK.toFixed(2)}€)`;
    console.log(
      "\t",
      functionName,
      description ? description : "",
      "\n\tGas Used:",
      gasUsed.toString(),
      "|",
      rskStr
    );
  }
};

const logEvents = (functionName: string, logs: any[]) => {
  if (logs.length == 0) return;
  if (loggingEvents) {
    console.log("\tThe " + functionName + "'s function call emits:");
    logs.forEach((log: any) => {
      if (!log.event) return;
      console.log("\t-", log.event, "event -");
      switch (log.event) {
        case "TokenMinted":
          console.log("\t\tcustomer address", log.args.recipient);
          console.log("\t\ttokenId:", log.args.tokenId.toString());
          console.log("\t\ttokenUri:", log.args.tokenUri);
          break;
        case "AuthorityGranted":
          console.log("\t\tnew authority address", log.args.authority);
          console.log("\tauthority address:", log.args.sender);
          break;
        case "AuthorityRevoked":
          console.log("\t\trevoked authority address:", log.args.authority);
          console.log("\t\tauthority address:", log.args.sender);
          break;
        case "Transfer":
          console.log("\t\tfrom:", log.args.from);
          console.log("\t\tto:", log.args.to);
          console.log("\t\ttokenId:", log.args.tokenId.toString());
          break;
        case "Received":
          console.log("\t\treceived from:", log.args.from);
          console.log("\t\tamount:", log.args.amount.toString());
          break;
        case "Withdraw":
          console.log("\t\tfrom:", log.args.from);
          console.log("\t\tvalue:", log.args.value.toString());
          break;
        case "TransferCashier":
          console.log("\t\tfrom:", log.args.from);
          console.log("\t\tto:", log.args.to);
          console.log("\t\tvalue:", log.args.value.toString());
          break;
        case "Approval":
          console.log("\t\tfrom:", log.args.owner);
          console.log("\t\tto:", log.args.approved);
          console.log("\t\tvalue:", log.args.tokenId.toString());
          break;
        case "OwnershipTransferred":
          console.log("\t\tpreviousOwner:", log.args.previousOwner);
          console.log("\t\tnewOwner:", log.args.newOwner);
          break;
        case "Deposit":
          console.log("\t\tfrom:", log.args.from);
          console.log("\t\tvalue:", log.args.value.toString());
          break;
        case "NewTokenMinted":
          console.log("\t\tholder", log.args.holder);
          console.log("\t\ttokenId", log.args.tokenId.toString());
          console.log("\t\ttokenURI", log.args.tokenURI);
          break;
        case "Payment":
          console.log("\t\tpayer", log.args.payer);
          console.log("\t\treceiver", log.args.receiver);
          console.log("\t\tamount", log.args.amount.toString());
          console.log("\t\tnonce", log.args.nonce.toString());
          break;
        default:
          if (log.event) {
            console.log("- printing raw logs -");
            console.log("\t\t", log.args);
          }
          break;
      }
      console.log("\n");
    });
  }
};

const genDataToContract = async (
  signer: any,
  dataArray: any[],
  typesArray: any[]
) => {
  // typesArray;
  const message = await ethers.utils.keccak256(
    ethers.utils.solidityPack(typesArray, dataArray)
  );
  const signature = await signer.signMessage(ethers.utils.arrayify(message));

  return { message, signature };
};

describe("CashierContract", async () => {
  let dummyERC20Contract: any;
  let cashierContract: any;
  let cashierContractv4: any;
  let trustContract: any;

  let dummyERC2OInstance: any;
  let cashierInstance: any;
  let cashierv4Instance: any;
  let trustInstance: any;

  let wallets: Wallet[] = [];
  let tokens: any = [];
  let provider = new ethers.providers.JsonRpcProvider("http://localhost:7545");

  networks.ganache.custom_private_keys.forEach((pk: string) => {
    wallets.push(new ethers.Wallet(pk, provider));
  });

  const [
    alice,
    bob,
    attestation_engine,
    attestation_provider,
    governance_contract,
  ] = wallets;

  const weekInMilisec: number = 1000 * 60 * 60 * 24 * 7;
  const currentDate: number = new Date().getTime();

  const expiredDate: number = Math.floor((currentDate - weekInMilisec) / 1000);
  const notExpiredDate: number = Math.floor(
    (currentDate + weekInMilisec) / 1000
  );

  const expiredNFTSettings = {
    nft_type: "0x1234",
    nft_price: 1,
    nft_expiration: expiredDate,
    nft_provider: attestation_provider.address,
  };

  const notExpiredNFTSettings = {
    nft_type: "0x1234",
    nft_price: 1,
    nft_expiration: notExpiredDate,
    nft_provider: attestation_provider.address,
  };

  const attestationData = {
    hash_key_array:
      "0x10000006C350000022828531e543c61788be00d3ee000000000735233B600000",
    token_uri: "https://short.ly/abc",
    hashed_data:
      "0x6C3522828735233B60531e543c61788be00d3ee1031e543c61735233B6000000",
  };

  const nftSettingsTypesArray = ["bytes2", "uint256", "uint256", "address"];

  const attestationDataTypesArray = ["bytes32", "string", "bytes32", "bytes2"];

  const encodedAttestationDataTypes = [
    "address",
    "address",
    "bytes32",
    "string",
    "bytes32",
  ];
  const encodedNftSettingsTypes = ["address", "uint256", "bytes2", "uint256"];

  const encodedAttestationData = ethers.utils.defaultAbiCoder.encode(
    encodedAttestationDataTypes,
    [
      notExpiredNFTSettings.nft_provider,
      attestation_engine.address,
      attestationData.hash_key_array,
      attestationData.token_uri,
      attestationData.hashed_data,
    ]
  );

  const encodedExpiredNftSettings = ethers.utils.defaultAbiCoder.encode(
    encodedNftSettingsTypes,
    [
      expiredNFTSettings.nft_provider,
      expiredNFTSettings.nft_price,
      expiredNFTSettings.nft_type,
      expiredNFTSettings.nft_expiration,
    ]
  );

  const encodedNotExpiredNftSettings = ethers.utils.defaultAbiCoder.encode(
    encodedNftSettingsTypes,
    [
      notExpiredNFTSettings.nft_provider,
      notExpiredNFTSettings.nft_price,
      notExpiredNFTSettings.nft_type,
      notExpiredNFTSettings.nft_expiration,
    ]
  );

  const encodedNotExpiredSigned = await attestation_provider.signMessage(
    ethers.utils.arrayify(ethers.utils.keccak256(encodedNotExpiredNftSettings))
  );

  const encodedExpiredSigned = await attestation_provider.signMessage(
    ethers.utils.arrayify(ethers.utils.keccak256(encodedExpiredNftSettings))
  );

  const encodedAttestationDataSigned = await attestation_provider.signMessage(
    ethers.utils.arrayify(ethers.utils.keccak256(encodedAttestationData))
  );

  const expiredNftHash = await ethers.utils.keccak256(
    ethers.utils.solidityPack(nftSettingsTypesArray, [
      expiredNFTSettings.nft_type,
      expiredNFTSettings.nft_price,
      expiredNFTSettings.nft_expiration,
      expiredNFTSettings.nft_provider,
    ])
  );

  const notExpiredNftHash = await ethers.utils.keccak256(
    ethers.utils.solidityPack(nftSettingsTypesArray, [
      notExpiredNFTSettings.nft_type,
      notExpiredNFTSettings.nft_price,
      notExpiredNFTSettings.nft_expiration,
      notExpiredNFTSettings.nft_provider,
    ])
  );

  const attestationDataHash = await ethers.utils.keccak256(
    ethers.utils.solidityPack(attestationDataTypesArray, [
      attestationData.hash_key_array,
      attestationData.token_uri,
      attestationData.hashed_data,
      notExpiredNFTSettings.nft_type,
    ])
  );
  // console.log('engineEncodedValidData', engineEncodedValidData);
  // console.log('engineEncodedValidDataSigned', engineEncodedValidDataSigned);
  // console.log('encodedAttestationData', encodedAttestationData);
  // console.log('encodedAttestationDataSigned', encodedAttestationDataSigned);

  const notExpiredNftHashSigned = await attestation_provider.signMessage(
    ethers.utils.arrayify(notExpiredNftHash)
  );

  const attestationDataHashSigned = await attestation_provider.signMessage(
    ethers.utils.arrayify(attestationDataHash)
  );

  before("get factories and deploy", async () => {
    // get factories
    cashierContract = await ethers.getContractFactory("CashierContractV1");
    cashierContractv4 = await ethers.getContractFactory("CashierContractV4");
    trustContract = await ethers.getContractFactory("TrustContract");
    dummyERC20Contract = await ethers.getContractFactory("DummyERC20");

    cashierInstance = await hre.upgrades.deployProxy(cashierContract, {
      kind: "uups",
    });
    trustInstance = await hre.upgrades.deployProxy(
      trustContract,
      [cashierInstance.address],
      { kind: "uups" }
    );
    dummyERC2OInstance = await dummyERC20Contract.deploy();
  });

  it("it deploys cashier contract", async () => {
    expect(cashierInstance.address).to.not.be.null;
  });

  it("cashier Contract can be upgraded", async () => {
    cashierv4Instance = await hre.upgrades.upgradeProxy(
      cashierInstance,
      cashierContractv4
    );

    expect(cashierv4Instance).to.not.be.null;
  });

  it("it deploys trust contract", async () => {
    expect(trustInstance.address).to.not.be.null;
  });

  it("should deploy dummyERC20 contract", async () => {
    expect(dummyERC2OInstance.address).to.be.ownProperty;
  });

  it("alice and bob can mint tokens from dummy contract", async () => {
    const amountBought = BN.from(DEPOSIT_AMOUNT);
    await dummyERC2OInstance.connect(alice).mint(alice.address, amountBought);
    await dummyERC2OInstance.connect(bob).mint(bob.address, amountBought);
    const aliceBalance = await dummyERC2OInstance.balanceOf(alice.address);
    const bobBalance = await dummyERC2OInstance.balanceOf(bob.address);

    expect(aliceBalance).to.be.equals(amountBought);
    return expect(bobBalance).to.be.equals(amountBought);
  });

  it("alice and bob can set allowance to CashierContract", async () => {
    const aliceBalance = await dummyERC2OInstance.balanceOf(alice.address);
    const bobBalance = await dummyERC2OInstance.balanceOf(bob.address);

    await dummyERC2OInstance
      .connect(alice)
      .approve(cashierv4Instance.address, aliceBalance);
    await dummyERC2OInstance
      .connect(bob)
      .approve(cashierv4Instance.address, bobBalance);

    const allowanceAlice = await dummyERC2OInstance
      .connect(alice)
      .allowance(alice.address, cashierv4Instance.address);
    const allowanceBob = await dummyERC2OInstance
      .connect(bob)
      .allowance(bob.address, cashierv4Instance.address);

    expect(allowanceAlice).to.be.equal(aliceBalance);
    return expect(allowanceBob).to.be.equal(bobBalance);
  });

  it("owner of cashierContract can transfer it", async () => {
    const previousOwner = await cashierv4Instance.owner();
    const transferOwnership = await cashierv4Instance.transferOwnership(
      governance_contract.address
    );
    const transferOwnershipReturn = await transferOwnership.wait();
    const newOwner = await cashierv4Instance.owner();

    logEvents("transferOwnership", transferOwnershipReturn.events);

    expect(previousOwner).to.not.be.equal(newOwner);
    return expect(newOwner).to.be.equal(governance_contract.address);
  });

  it("owner of trustContract can transfer it", async () => {
    const previousOwner = await trustInstance.owner();
    const transferOwnership = await trustInstance.transferOwnership(
      governance_contract.address
    );
    const transferOwnershipReturn = await transferOwnership.wait();
    const newOwner = await trustInstance.owner();

    logEvents("transferOwnership", transferOwnershipReturn.events);

    expect(previousOwner).to.not.be.equal(newOwner);
    return expect(newOwner).to.be.equal(governance_contract.address);
  });

  it("Only Governance Contract can set the ERC20 Contract address", async () => {
    await cashierv4Instance
      .connect(governance_contract)
      .setERC20TokenAddress(dummyERC2OInstance.address);
    const dummyERC20address = await cashierv4Instance._erc20_contract();

    return expect(dummyERC20address).to.be.equal(dummyERC2OInstance.address);
  });

  it("Only Governance Contract can set TrustToken Contract address", async () => {
    await cashierv4Instance
      .connect(governance_contract)
      .setTrustTokenAddress(trustInstance.address);
    const trustTokenAddress = await cashierv4Instance._trust_contract();
    return expect(trustTokenAddress).to.be.equal(trustInstance.address);
  });

  it("Only Governance Contract can set Cashier Percentage Cut", async () => {
    const cashierCut = BN.from(CASHIER_PERC);
    await cashierv4Instance
      .connect(governance_contract)
      .setCashierCutPerc(cashierCut);

    const cashierCutPercOnContract = await cashierv4Instance.cashierCutPerc();
    await expect(cashierCutPercOnContract).to.be.equal(cashierCut);
  });

  it("Only Governance Contract can set Engine Percentage Cut", async () => {
    const engineCut = BN.from(ENGINE_PERC);
    await cashierv4Instance
      .connect(governance_contract)
      .setEngineCut(engineCut);

    const engineCutPercOnContract =
      await cashierv4Instance.attestationEngineCutPerc();
    await expect(engineCutPercOnContract).to.be.equal(engineCut);
  });

  it("Only Governance Contract can set PMTN Decimals", async () => {
    const _pmtnDecimals = BN.from(18);
    await cashierv4Instance
      .connect(governance_contract)
      .setPMTNDecimals(_pmtnDecimals);

    const pmtnDecimalsOnContract = await cashierv4Instance.pmtnDecimals();
    await expect(pmtnDecimalsOnContract).to.be.equal(_pmtnDecimals);
  });

  it("Cashier Contract takes margin from any deposit", async () => {
    const ccERC20Balance = await dummyERC2OInstance.balanceOf(
      cashierv4Instance.address
    );

    const depositAmount = BN.from(DEPOSIT_AMOUNT);
    const cashierPerc = BN.from(CASHIER_PERC);

    const margin = depositAmount.mul(cashierPerc).div(BN.from(10).pow(18));

    const ccBalance = await cashierv4Instance.balanceOf(
      cashierv4Instance.address
    );

    const aliceBalance = await cashierv4Instance
      .connect(alice)
      .balanceOf(alice.address, {
        from: alice.address,
      });

    const deposit = await cashierv4Instance
      .connect(alice)
      .deposit(depositAmount);

    const depositReturn = await deposit.wait();

    logEvents("deposit", depositReturn.events);
    logGas(
      "deposit",
      depositReturn.gasUsed,
      "Deposition " + depositAmount.toString() + " PMTN"
    );

    const newCCBalance = await cashierv4Instance.balanceOf(
      cashierv4Instance.address
    );
    const newAliceBalance = await cashierv4Instance.balanceOf(alice.address);

    const newCCerc20Balance = await dummyERC2OInstance.balanceOf(
      cashierv4Instance.address
    );

    await expect(newCCerc20Balance).to.be.equal(
      ccERC20Balance.add(depositAmount)
    );
    await expect(newCCBalance).to.be.equal(ccBalance.add(margin));
    return await expect(newAliceBalance).to.be.equal(
      aliceBalance.add(depositAmount).sub(margin)
    );
  });

  it("User can withdraw from his own treasury account", async () => {
    const aliceBalance = await cashierv4Instance.balanceOf(alice.address);
    const cashierBalance = await cashierv4Instance.balanceOf(
      cashierv4Instance.address
    );
    const cashierPerc = BN.from(CASHIER_PERC);
    const withdrawAmount = aliceBalance.div(BN.from(20));
    const margin = withdrawAmount.mul(cashierPerc).div(BN.from(10).pow(18));
    // BN.from(DEPOSIT_AMOUNT).div(BN.from(20));
    const withdraw = await cashierv4Instance
      .connect(alice)
      .withdraw(withdrawAmount);
    const withdrawReturn = await withdraw.wait();

    logGas(
      "withdraw",
      withdrawReturn.gasUsed,
      "withdrawing " + withdrawAmount.toString() + " PMTN"
    );
    logEvents("withdraw", withdrawReturn.events);

    await expect(await cashierv4Instance.balanceOf(alice.address)).to.be.equal(
      aliceBalance.sub(withdrawAmount)
    );
    await expect(
      await cashierv4Instance.balanceOf(cashierv4Instance.address)
    ).to.be.equal(cashierBalance.add(margin));
  });

  it("User can make a payment with a given data", async () => {
    const receiver = attestation_engine.address;
    let nonce = 0;
    const amount = BN.from(2000);
    const aliceBalance = await cashierv4Instance.balanceOf(alice.address);
    const cashierPerc = BN.from(CASHIER_PERC);
    const receiverBalance = await cashierv4Instance.balanceOf(receiver);
    const margin = amount.mul(cashierPerc).div(BN.from(10).pow(18));

    const cashierBalance = await cashierv4Instance.balanceOf(
      cashierv4Instance.address
    );
    console.log(
      "Cashier Balance before payments:",
      ethers.utils.formatEther(cashierBalance)
    );
    while (nonce < 100) {
      let paymentData = ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256"],
        [receiver, amount, nonce]
      );
      let paymentDataSigned = await attestation_engine.signMessage(
        ethers.utils.arrayify(ethers.utils.keccak256(paymentData))
      );

      let payment = await cashierv4Instance
        .connect(alice)
        .payment(paymentData, paymentDataSigned);

      // const paymentReturn = await payment.wait();
      nonce++;
    }
    const aliceNewBalance = await cashierv4Instance.balanceOf(alice.address);
    const receiverNewBalance = await cashierv4Instance.balanceOf(receiver);
    // logEvents("Payment", paymentReturn.events);
    // logGas("payment", paymentReturn.gasUsed);

    const newCashierBalance = await cashierv4Instance.balanceOf(
      cashierv4Instance.address
    );
    console.log(
      "Cashier Balance after ",
      nonce,
      "payments:",
      ethers.utils.formatEther(newCashierBalance)
    );

    expect(aliceNewBalance).to.be.equals(aliceBalance.sub(amount.mul(nonce)));
    return expect(receiverNewBalance).to.be.equals(
      receiverBalance.add(amount.mul(nonce)).sub(margin.mul(nonce))
    );
  });
});
