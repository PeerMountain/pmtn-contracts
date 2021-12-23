require("dotenv").config();

export class Config {
  public static RSK_URL =
    process.env.RSK_URL || "https://public-node.testnet.rsk.co/";
  public static RSK_PRIVATE_KEY = process.env.RSK_PRIVATE_KEY || "";
  public static RINKEBY_PRIVATE_KEY = process.env.RINKEBY_PRIVATE_KEY || "";
  public static PMTN_CONTRACT_ADDRESS = process.env.PMTN_CONTRACT_ADDRESS || "";
  public static TRUST_NFT_CONTRACT_ADDRESS =
    process.env.TRUST_NFT_CONTRACT_ADDRESS || "";
  public static CASHIER_CONTRACT_ADDRESS =
    process.env.CASHIER_CONTRACT_ADDRESS || "";
}
