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

const DEPOSIT_AMOUNT = "1000000000000000";
const GAS_PRICE_RSk = "65";

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

describe("CashierContract", async () => {
  let cashierContract: any;
  let cashierContractv2: any;
  let trustContract: any;

  let cashierInstance: any;
  let cashierv2Instance: any;
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
    nft_perpetuity: false,
    nft_price: 1000000000,
    nft_expiration: expiredDate,
    nft_provider: attestation_provider.address,
  };

  const notExpiredNFTSettings = {
    nft_type: "0x1234",
    nft_perpetuity: false,
    nft_price: 1000000000,
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

  const nftSettingsTypesArray = [
    "bytes2",
    "bool",
    "uint256",
    "uint256",
    "address",
  ];

  const attestationDataTypesArray = ["bytes32", "string", "bytes32", "bytes2"];

  const encodedAttestationDataTypes = [
    "address",
    "bytes32",
    "string",
    "bytes32",
    "bytes2",
  ];
  const encodedNftSettingsTypes = [
    "address",
    "bool",
    "uint256",
    "bytes2",
    "uint256",
  ];

  const encodedAttestationData = ethers.utils.defaultAbiCoder.encode(
    encodedAttestationDataTypes,
    [
      notExpiredNFTSettings.nft_provider,
      attestationData.hash_key_array,
      attestationData.token_uri,
      attestationData.hashed_data,
      notExpiredNFTSettings.nft_type,
    ]
  );

  const encodedExpiredNftSettings = ethers.utils.defaultAbiCoder.encode(
    encodedNftSettingsTypes,
    [
      expiredNFTSettings.nft_provider,
      expiredNFTSettings.nft_perpetuity,
      expiredNFTSettings.nft_price,
      expiredNFTSettings.nft_type,
      expiredNFTSettings.nft_expiration,
    ]
  );

  const encodedNotExpiredNftSettings = ethers.utils.defaultAbiCoder.encode(
    encodedNftSettingsTypes,
    [
      notExpiredNFTSettings.nft_provider,
      notExpiredNFTSettings.nft_perpetuity,
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
      expiredNFTSettings.nft_perpetuity,
      expiredNFTSettings.nft_price,
      expiredNFTSettings.nft_expiration,
      expiredNFTSettings.nft_provider,
    ])
  );

  const notExpiredNftHash = await ethers.utils.keccak256(
    ethers.utils.solidityPack(nftSettingsTypesArray, [
      notExpiredNFTSettings.nft_type,
      notExpiredNFTSettings.nft_perpetuity,
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

  const notExpiredNftHashSigned = await attestation_provider.signMessage(
    ethers.utils.arrayify(notExpiredNftHash)
  );

  const attestationDataHashSigned = await attestation_provider.signMessage(
    ethers.utils.arrayify(attestationDataHash)
  );

  before("get factories and deploy", async () => {
    // get factories
    cashierContract = await ethers.getContractFactory("CashierContractV1");
    cashierContractv2 = await ethers.getContractFactory("CashierContractV2");
    trustContract = await ethers.getContractFactory("TrustContract");

    cashierInstance = await hre.upgrades.deployProxy(cashierContract, {
      kind: "uups",
    });
    trustInstance = await hre.upgrades.deployProxy(
      trustContract,
      [cashierInstance.address],
      { kind: "uups" }
    );
  });

  it("it deploys cashier contract", async () => {
    expect(cashierInstance.address).to.not.be.null;
  });

  it("it deploys trust contract", async () => {
    expect(trustInstance.address).to.not.be.null;
  });

  it("cashier Contract can be upgraded", async () => {
    cashierv2Instance = await hre.upgrades.upgradeProxy(
      cashierInstance,
      cashierContractv2
    );

    expect(cashierv2Instance).to.not.be.null;
  });

  it("owner of cashierContract can transfer it", async () => {
    const previousOwner = await cashierv2Instance.owner();
    const transferOwnership = await cashierv2Instance.transferOwnership(
      governance_contract.address
    );
    const transferOwnershipReturn = await transferOwnership.wait();
    const newOwner = await cashierv2Instance.owner();

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

  it("Governance Contract only can set TrustToken Contract address", async () => {
    await cashierv2Instance
      .connect(governance_contract)
      .setTrustTokenAddress(trustInstance.address);
    const trustTokenAddress = await cashierv2Instance._trust_contract();
    return expect(trustTokenAddress).to.be.equal(trustInstance.address);
  });

  it("Cashier Contract takes 1% margin from any deposit", async () => {
    const depositAmount = BN.from(DEPOSIT_AMOUNT);
    const margin = depositAmount.div(100);
    const ccBalance = await cashierv2Instance.balanceOf(
      cashierv2Instance.address
    );
    const aliceBalance = await cashierv2Instance
      .connect(alice)
      .balanceOf(alice.address, {
        from: alice.address,
      });

    const deposit = await cashierv2Instance
      .connect(alice)
      .deposit({ value: depositAmount });

    const depositReturn = await deposit.wait();

    logEvents("deposit", depositReturn.events);
    logGas(
      "deposit",
      depositReturn.gasUsed,
      "Deposition " + DEPOSIT_AMOUNT + " rBTC"
    );

    const newCCBalance = await cashierv2Instance.balanceOf(
      cashierv2Instance.address
    );
    const newAliceBalance = await cashierv2Instance.balanceOf(alice.address);

    await expect(newCCBalance).to.be.equal(ccBalance.add(margin));
    return await expect(newAliceBalance).to.be.equal(
      aliceBalance.add(depositAmount).sub(margin)
    );
  });

  it("User can retrieve the balance of a treasury account", async () => {
    const balance = await cashierv2Instance.balanceOf(alice.address);

    return await expect(balance).to.be.gte(BN.from("0"));
  });

  it("User can withdraw from his own treasury account", async () => {
    const withdrawAmount = BN.from(DEPOSIT_AMOUNT).div(BN.from(20));
    const aliceBalance = await cashierv2Instance.balanceOf(alice.address);

    const withdraw = await cashierv2Instance
      .connect(alice)
      .withdraw(withdrawAmount);
    const withdrawReturn = await withdraw.wait();

    logGas(
      "withdraw",
      withdrawReturn.gasUsed,
      "withdrawing " + withdrawAmount.toString() + " rBTC"
    );
    logEvents("withdraw", withdrawReturn.events);

    await expect(await cashierv2Instance.balanceOf(alice.address)).to.be.equal(
      aliceBalance.sub(withdrawAmount)
    );
  });

  it("Cashier Contract can verify signed Attestation Data", async () => {
    const verifyAttestationData = await cashierv2Instance.verifyAttestationData(
      attestation_provider.address,
      attestationData.hash_key_array,
      attestationData.token_uri,
      attestationData.hashed_data,
      notExpiredNFTSettings.nft_type,
      attestationDataHashSigned
    );

    return expect(verifyAttestationData).to.be.true;
  });

  it("Cashier Contract can verify signed NFT Settings", async () => {
    const verifyNFTSettings = await cashierv2Instance.verifyNFTSettings(
      notExpiredNFTSettings.nft_type,
      notExpiredNFTSettings.nft_perpetuity,
      notExpiredNFTSettings.nft_price,
      notExpiredNFTSettings.nft_expiration,
      attestation_provider.address,
      notExpiredNftHashSigned
    );

    return expect(verifyNFTSettings).to.be.true;
  });

  it("Cashier Contract can split NFT Setting Bytes to correctly verify provider and NFT's price", async () => {
    const response = await cashierv2Instance.splitNftSettings(
      encodedNotExpiredNftSettings,
      encodedNotExpiredSigned
    );
    expect(response.nftPrice).to.be.equal(
      BN.from(notExpiredNFTSettings.nft_price)
    );
    return expect(response.provider).to.be.equal(
      notExpiredNFTSettings.nft_provider
    );
  });

  it("Cashier Contract can split Attestation Data Bytes to correctly verify who is the signer", async () => {
    const response = await cashierv2Instance.splitAttestationData(
      encodedAttestationData,
      encodedAttestationDataSigned
    );

    expect(response).to.be.true;
  });

  it("Trust Token can only be minted by Cashier Contract", async () => {
    const purchase = await cashierv2Instance
      .connect(alice)
      .purchase(
        alice.address,
        encodedNotExpiredNftSettings,
        encodedNotExpiredSigned,
        encodedAttestationData,
        encodedAttestationDataSigned
      );
    const purchaseReturn = await purchase.wait();

    expect(
      cashierv2Instance
        .connect(alice)
        .purchase(
          alice.address,
          encodedExpiredNftSettings,
          encodedExpiredSigned,
          encodedAttestationData,
          encodedAttestationDataSigned
        )
    ).to.eventually.be.rejected;

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

  it("Alice can transfer her token to Bob", async () => {
    const token = tokens.find((t: any) => t.owner === alice.address);
    if (token) {
      const transferFrom = await trustInstance
        .connect(alice)
        .transferFrom(alice.address, bob.address, token.id);

      const transferFromReturn = await transferFrom.wait();

      logEvents("transferFrom", transferFromReturn.events);
      logGas("transferFrom", transferFromReturn.gasUsed);

      expect(
        trustInstance
          .connect(alice)
          .transferFrom(alice.address, bob.address, token.id)
      ).to.eventually.be.rejected;
      return expect(trustInstance.ownerOf(token.id)).to.eventually.be.equal(
        bob.address
      );
    } else {
      return true;
    }
  });
});
