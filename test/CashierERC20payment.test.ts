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
const LEADING_ZEROS = 1;

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

const getEncodedAndSigned = async (
  dataTypesArray: any[],
  dataArray: any[],
  signer: any
) => {
  const message = ethers.utils.defaultAbiCoder.encode(
    dataTypesArray,
    dataArray
  );
  const signature = await signer.signMessage(
    ethers.utils.arrayify(ethers.utils.keccak256(message))
  );
  return { message, signature, signer };
};

const calcProofOfWork = async (address, max_attempts) => {
  let proofOfWork = BN.from(1);
  max_attempts = BN.from(max_attempts);
  do {
    const nonceCalculationTypes = ["address", "uint256"];
    const nonceCalculation = ethers.utils.defaultAbiCoder.encode(
      nonceCalculationTypes,
      [address, proofOfWork]
    );
    const keccakNonceCalculation = ethers.utils.keccak256(nonceCalculation);
    const arrayifyKeccak = ethers.utils.arrayify(keccakNonceCalculation);

    let leadingZeros = 0;
    for (let i = 0; i < arrayifyKeccak.length; i++) {
      if (arrayifyKeccak[i] === 0) {
        leadingZeros++;
      } else {
        break;
      }
    }
    if (leadingZeros >= LEADING_ZEROS) {
      console.log(
        "Valid nonce with enough leading zeros:",
        proofOfWork.toString()
      );
      // UNCOMMENT IF YOU WANT TO SEE MORE THAN ONE VALID NONCE
      break;
    }
    proofOfWork = proofOfWork.add(BN.from(1));
  } while (proofOfWork.eq(max_attempts) === false);

  return proofOfWork;
};

describe("CashierContract", async () => {
  let dummyERC20Contract: any;
  let cashierContract: any;
  let cashierContractV2: any;
  let trustContract: any;

  let dummyERC2OInstance: any;
  let cashierInstance: any;
  let cashierV2Instance: any;
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

  console.log(
    "Calculating nonce for difficult: " +
      LEADING_ZEROS +
      ".\n Remember, the more leading zeros longer will be the process to find the nonce"
  );
  const attestationEngineNonce = await calcProofOfWork(
    attestation_engine.address,
    1000000
  );
  console.log("Nonce found:", attestationEngineNonce.toString());

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

  before("get factories and deploy", async () => {
    // get factories
    cashierContract = await ethers.getContractFactory("CashierContractV1");
    cashierContractV2 = await ethers.getContractFactory("CashierContractV2");
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
    cashierV2Instance = await hre.upgrades.upgradeProxy(
      cashierInstance,
      cashierContractV2
    );

    expect(cashierV2Instance).to.not.be.null;
  });

  it("it deploys trust contract", async () => {
    expect(trustInstance.address).to.not.be.null;
  });

  it("should deploy dummyERC20 contract", async () => {
    expect(dummyERC2OInstance.address).to.be.ownProperty;
  });

  it("alice can mint tokens from dummy contract", async () => {
    const amountBought = BN.from(DEPOSIT_AMOUNT);
    await dummyERC2OInstance.connect(alice).mint(alice.address, amountBought);
    const aliceBalance = await dummyERC2OInstance.balanceOf(alice.address);

    expect(aliceBalance).to.be.equals(amountBought);
  });

  it("alice can set allowance to CashierContract", async () => {
    const aliceBalance = await dummyERC2OInstance.balanceOf(alice.address);
    const cashierAllowanceAmount = aliceBalance.div(1);

    await dummyERC2OInstance
      .connect(alice)
      .approve(cashierV2Instance.address, cashierAllowanceAmount);

    const allowance = await dummyERC2OInstance
      .connect(alice)
      .allowance(alice.address, cashierV2Instance.address);

    expect(allowance).to.be.equal(cashierAllowanceAmount);
  });

  it("owner of cashierContract can transfer it", async () => {
    const previousOwner = await cashierV2Instance.owner();
    const transferOwnership = await cashierV2Instance.transferOwnership(
      governance_contract.address
    );
    const transferOwnershipReturn = await transferOwnership.wait();
    const newOwner = await cashierV2Instance.owner();

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

  it("only Governance Contract can set the ERC20 Contract address", async () => {
    await cashierV2Instance
      .connect(governance_contract)
      .setERC20TokenAddress(dummyERC2OInstance.address);
    const dummyERC20address = await cashierV2Instance.pmtnContract();

    return expect(dummyERC20address).to.be.equal(dummyERC2OInstance.address);
  });

  it("only Governance Contract can set TrustToken Contract address", async () => {
    await cashierV2Instance
      .connect(governance_contract)
      .setTrustTokenAddress(trustInstance.address);
    const trustTokenAddress = await cashierV2Instance.trustContract();
    return expect(trustTokenAddress).to.be.equal(trustInstance.address);
  });

  it("only Governance Contract can set Cashier Percentage Cut", async () => {
    const cashierCut = BN.from(CASHIER_PERC);
    await cashierV2Instance
      .connect(governance_contract)
      .setCashierPercentage(cashierCut);

    const cashierCutPercOnContract =
      await cashierV2Instance.cashierPercentage();
    await expect(cashierCutPercOnContract).to.be.equal(cashierCut);
  });

  it("only Governance Contract can set Engine Percentage Cut", async () => {
    const engineCut = BN.from(ENGINE_PERC);
    await cashierV2Instance
      .connect(governance_contract)
      .setEnginePercentage(engineCut);

    const engineCutPercOnContract = await cashierV2Instance.enginePercentage();
    await expect(engineCutPercOnContract).to.be.equal(engineCut);
  });

  it("only Governance Contract can set PMTN Decimals", async () => {
    const _pmtnDecimals = BN.from(18);
    await cashierV2Instance
      .connect(governance_contract)
      .setPMTNDecimals(_pmtnDecimals);

    const pmtnDecimalsOnContract = await cashierV2Instance.pmtnDecimals();
    await expect(pmtnDecimalsOnContract).to.be.equal(_pmtnDecimals);
  });

  it("only Governance Contract can set minimum leading zeros for nonce", async () => {
    const leadingZeros = BN.from(1);
    await cashierV2Instance
      .connect(governance_contract)
      .setLeadingZeros(leadingZeros);

    const _leadingZeroOnContract = await cashierV2Instance.getProofOfWork();
    await expect(_leadingZeroOnContract).to.be.equal(leadingZeros);
  });

  it("Cashier Contract and Attestation Engine takes margin from any deposit", async () => {
    const ccERC20Balance = await dummyERC2OInstance.balanceOf(
      cashierV2Instance.address
    );

    const depositAmount = BN.from(DEPOSIT_AMOUNT);
    const cashierPerc = BN.from(CASHIER_PERC);
    const oraclePerc = BN.from(ENGINE_PERC);
    // console.log("cashierPerc", ethers.utils.formatUnits(cashierPerc), "%");
    const cashierMargin = depositAmount
      .mul(cashierPerc)
      .div(BN.from(10).pow(18));
    const oracleMargin = depositAmount.mul(oraclePerc).div(BN.from(10).pow(18));
    // console.log("finalValue", ethers.utils.formatUnits(cashierMargin), "eth");
    // return true;
    // charging 1% of the depositing amount to cover Cashier costs

    const ccBalance = await cashierV2Instance.balanceOf(
      cashierV2Instance.address
    );
    const aeBalance = await cashierV2Instance.balanceOf(
      attestation_engine.address
    );
    const aliceBalance = await cashierV2Instance.balanceOf(alice.address);

    const aliceNonce = BN.from(
      await cashierV2Instance.getLastNonce(alice.address)
    );

    const depositFromAlice = await getEncodedAndSigned(
      ["uint256", "uint256", "address"],
      [depositAmount, aliceNonce.add(1), cashierV2Instance.address],
      alice
    );

    const deposit = await cashierV2Instance
      .connect(attestation_engine)
      .deposit(
        attestationEngineNonce,
        alice.address,
        depositFromAlice.message,
        depositFromAlice.signature
      );

    const depositReturn = await deposit.wait();

    logEvents("deposit", depositReturn.events);
    logGas(
      "deposit",
      depositReturn.gasUsed,
      "Deposition " + depositAmount.toString() + " PMTN"
    );

    const newCCBalance = await cashierV2Instance.balanceOf(
      cashierV2Instance.address
    );
    const newAliceBalance = await cashierV2Instance.balanceOf(alice.address);
    const newAEBalance = await cashierV2Instance.balanceOf(
      attestation_engine.address
    );

    const newCCerc20Balance = await dummyERC2OInstance.balanceOf(
      cashierV2Instance.address
    );

    await expect(newCCerc20Balance).to.be.equal(
      ccERC20Balance.add(depositAmount)
    );
    await expect(newCCBalance).to.be.equal(ccBalance.add(cashierMargin));
    await expect(newAEBalance).to.be.equal(aeBalance.add(oracleMargin));
    return await expect(newAliceBalance).to.be.equal(
      aliceBalance.add(depositAmount).sub(cashierMargin).sub(oracleMargin)
    );
  });

  it("User can retrieve the balance of a treasury account", async () => {
    const depositAmount = BN.from(DEPOSIT_AMOUNT);
    const cashierPerc = BN.from(CASHIER_PERC);
    const enginePerc = BN.from(ENGINE_PERC);
    const cashierMargin = depositAmount
      .mul(cashierPerc)
      .div(BN.from(10).pow(18));
    const engineMargin = depositAmount.mul(enginePerc).div(BN.from(10).pow(18));

    const balance = await cashierV2Instance.balanceOf(alice.address);

    return await expect(balance).to.be.equal(
      depositAmount.sub(cashierMargin).sub(engineMargin)
    );
  });

  it("User can withdraw from his own treasury account", async () => {
    const aliceBalance = await cashierV2Instance.balanceOf(alice.address);
    const cashierBalance = await cashierV2Instance.balanceOf(
      cashierV2Instance.address
    );
    const engineBalance = await cashierV2Instance.balanceOf(
      attestation_engine.address
    );
    const cashierPerc = BN.from(CASHIER_PERC);
    const enginePerc = BN.from(ENGINE_PERC);
    const withdrawAmount = aliceBalance.div(BN.from(20));
    const cashierMargin = withdrawAmount
      .mul(cashierPerc)
      .div(BN.from(10).pow(18));
    const engineMargin = withdrawAmount
      .mul(enginePerc)
      .div(BN.from(10).pow(18));

    const aliceNonce = BN.from(
      await cashierV2Instance.getLastNonce(alice.address)
    );

    const withdrawFromAlice = await getEncodedAndSigned(
      ["uint256", "uint256", "address"],
      [withdrawAmount, aliceNonce.add(1), cashierV2Instance.address],
      alice
    );

    const withdraw = await cashierV2Instance
      .connect(attestation_engine)
      .withdraw(
        attestationEngineNonce,
        alice.address,
        withdrawFromAlice.message,
        withdrawFromAlice.signature
      );
    const withdrawReturn = await withdraw.wait();

    logGas(
      "withdraw",
      withdrawReturn.gasUsed,
      "withdrawing " + withdrawAmount.toString() + " PMTN"
    );
    logEvents("withdraw", withdrawReturn.events);

    await expect(await cashierV2Instance.balanceOf(alice.address)).to.be.equal(
      aliceBalance.sub(withdrawAmount)
    );
    await expect(
      await cashierV2Instance.balanceOf(cashierV2Instance.address)
    ).to.be.equal(cashierBalance.add(cashierMargin));

    return await expect(
      await cashierV2Instance.balanceOf(attestation_engine.address)
    ).to.be.equal(engineBalance.add(engineMargin));
  });

  it("Cashier Contract can verify signed Attestation Data", async () => {
    const verifyAttestationData = await cashierV2Instance.verifySignature(
      encodedAttestationData,
      encodedAttestationDataSigned,
      attestation_provider.address
    );

    return expect(verifyAttestationData).to.be.true;
  });

  it("Cashier Contract can verify signed NFT Settings", async () => {
    const verifyNFTSettings = await cashierV2Instance.verifySignature(
      encodedNotExpiredNftSettings,
      encodedNotExpiredSigned,
      attestation_provider.address
    );

    return expect(verifyNFTSettings).to.be.true;
  });

  it("Cashier Contract can split NFT Setting Bytes to correctly verify provider and NFT's price", async () => {
    const response = await cashierV2Instance.splitNftSettings(
      encodedNotExpiredNftSettings,
      encodedNotExpiredSigned
    );
    expect(response[1]).to.be.equal(BN.from(notExpiredNFTSettings.nft_price));
    return expect(response[0]).to.be.equal(notExpiredNFTSettings.nft_provider);
  });

  it("Cashier Contract can split Attestation Data Bytes to correctly verify who is the signer", async () => {
    const response = await cashierV2Instance.splitAttestationData(
      attestation_provider.address,
      encodedAttestationData,
      encodedAttestationDataSigned
    );

    expect(response[0]).to.be.true;
    return expect(ethers.utils.isAddress(response[1])).to.be.true;
  });

  it("Customer can pay", async () => {
    const aliceBalance = await cashierV2Instance.balanceOf(alice.address);
    const providerBalance = await cashierV2Instance.balanceOf(
      attestation_provider.address
    );
    const engineBalance = await cashierV2Instance.balanceOf(
      attestation_engine.address
    );
    const cashierBalance = await cashierV2Instance.balanceOf(
      cashierV2Instance.address
    );

    const cashierPerc = await cashierV2Instance.cashierPercentage();
    const enginePerc = await cashierV2Instance.enginePercentage();
    const nftPrice = aliceBalance.div(10);
    const cashierCut = nftPrice.mul(cashierPerc).div(BN.from(10).pow(18));
    const engineCut = nftPrice.mul(enginePerc).div(BN.from(10).pow(18));

    const aliceNonce = BN.from(
      await cashierV2Instance.getLastNonce(alice.address)
    );

    const paymentDataFromAlice = await getEncodedAndSigned(
      ["address", "uint256", "uint256", "uint256", "address"],
      [
        attestation_provider.address,
        nftPrice,
        1,
        aliceNonce.add(1),
        cashierV2Instance.address,
      ],
      alice
    );

    const payment = await cashierV2Instance
      .connect(attestation_engine)
      .payment(
        attestationEngineNonce,
        alice.address,
        paymentDataFromAlice.message,
        paymentDataFromAlice.signature
      );

    payment.wait();

    const newAliceBalance = await cashierV2Instance.balanceOf(alice.address);
    const newProviderBalance = await cashierV2Instance.balanceOf(
      attestation_provider.address
    );
    const newEngineBalance = await cashierV2Instance.balanceOf(
      attestation_engine.address
    );
    const newCashierBalance = await cashierV2Instance.balanceOf(
      cashierV2Instance.address
    );

    expect(newAliceBalance).to.be.equal(aliceBalance.sub(nftPrice));
    expect(newProviderBalance).to.be.equal(
      providerBalance.add(nftPrice).sub(engineCut).sub(cashierCut)
    );
    expect(newEngineBalance).to.be.equal(engineBalance.add(engineCut));
    return expect(newCashierBalance).to.be.equal(
      cashierBalance.add(cashierCut)
    );
  });

  it("Trust Token can only be minted by Cashier Contract", async () => {
    const apMintNft = await getEncodedAndSigned(
      ["address", "uint256", "bytes", "bytes", "bytes", "bytes"],
      [
        alice.address,
        BN.from(1),
        encodedNotExpiredNftSettings,
        encodedNotExpiredSigned,
        encodedAttestationData,
        encodedAttestationDataSigned,
      ],
      attestation_provider
    );

    const purchase = await cashierV2Instance
      .connect(attestation_engine)
      .nftMint(
        attestationEngineNonce,
        attestation_provider.address,
        apMintNft.message,
        apMintNft.signature
      );
    const purchaseReturn = await purchase.wait();

    expect(
      trustInstance
        .connect(alice)
        .mintToken(
          alice.address,
          encodedNotExpiredNftSettings,
          encodedAttestationData
        )
    ).to.eventually.be.rejected;

    expect(
      trustInstance
        .connect(attestation_provider)
        .mintToken(
          alice.address,
          encodedNotExpiredNftSettings,
          encodedAttestationData
        )
    ).to.eventually.be.rejected;

    expect(
      trustInstance
        .connect(attestation_engine)
        .mintToken(
          alice.address,
          encodedNotExpiredNftSettings,
          encodedAttestationData
        )
    ).to.eventually.be.rejected;

    logGas(
      "purchase",
      purchaseReturn.gasUsed,
      "Purchasing NFT with new method"
    );
    logEvents("purchase", purchaseReturn.events);

    const tokenMintLog = purchaseReturn.events.find(
      (e: any) => e.event === "NewTokenMinted"
    );

    tokens.push({
      id: tokenMintLog.args.tokenId,
      owner: tokenMintLog.args.holder,
      tokenUri: tokenMintLog.args.tokenURI,
    });

    const token = tokens[0];

    expect(trustInstance.ownerOf(token.id)).to.eventually.be.equal(token.owner);
  });

  it("already paid invoice can not be used twice", async () => {
    const apMintNft = await getEncodedAndSigned(
      ["address", "uint256", "bytes", "bytes", "bytes", "bytes"],
      [
        alice.address,
        BN.from(1),
        encodedNotExpiredNftSettings,
        encodedNotExpiredSigned,
        encodedAttestationData,
        encodedAttestationDataSigned,
      ],
      attestation_provider
    );

    expect(
      cashierV2Instance
        .connect(attestation_engine)
        .nftMint(
          attestationEngineNonce,
          attestation_provider.address,
          apMintNft.message,
          apMintNft.signature
        )
    ).to.eventually.be.rejected;
  });

  it("Alice can transfer her token to Bob", async () => {
    const token = tokens.find((t: any) => t.owner === alice.address);
    if (token) {
      const aliceNonce = BN.from(
        await cashierV2Instance.getLastNonce(alice.address)
      );
      const aliceTransferFrom = await getEncodedAndSigned(
        ["address", "uint256", "uint256", "address"],
        [bob.address, token.id, aliceNonce.add(1), cashierV2Instance.address],
        alice
      );

      const transferFrom = await cashierV2Instance
        .connect(attestation_engine)
        .nftTransfer(
          attestationEngineNonce,
          alice.address,
          aliceTransferFrom.message,
          aliceTransferFrom.signature
        );
      await transferFrom.wait();
      return expect(trustInstance.ownerOf(token.id)).to.eventually.be.equal(
        bob.address
      );
    } else {
      return true;
    }
  });
});
