// import type { HardhatUserConfig } from 'hardhat/config';
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
import "@nomiclabs/hardhat-ethers";
// import "@nomiclabs/hardhat-ganache";

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.4",
  networks: {
    ganache: {
      url: "http://127.0.0.1:7545",
      custom_private_keys: [
        "afd943f60c58b1220591f727d8a0e714cda87059338ca8ebeb303c7904cfbd3f",
        "621b40205cfbdd8e367a10925b81a34c91068905633a6ef6882ff6d63805ba60",
        "00e86fb40427531fa0d4098ba5450d605787ba710cc273634c2748196b087fe6",
        "c80051a6f4189e95794409131dc19624aa59858b7d896dfe73251e29cabca89f",
        "1af52db8959d9432c5f87e1863461d55145215621a5c0b478bce5be4d499279d",
        "bcff25f41cd0dd40106f98e53fb6c54846b7b32811ca5adaf47ee4bff6219b22",
        "9c1a3a05cb7edee3b7c169da7154ddd8d1a5b714120f7d996c57929aa06be252",
        "bca2dce3ab7b166ec62b344a4c639f808d5c102b2be2a35e182a5192b6d7f799",
        "9f2aaebb59632acd4b418bb4a429e50a776ccdba4ef41dd93858c6b693c0130c",
        "d3ac71d456a900e21ea645bdc1ca8d50a28b017409b863a874814cb81e4e17b6",
      ],
    },
    rsk_testnet: {
      url: "https://public-node.testnet.rsk.co/",
      accounts: [
        "fc48b9a13841ced60421d44ff5a61bdba2414d68a528a8ac097e9d7c1b8c5ba7",
      ],
    },
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/9414e4243903416eb3f4a6001d8be86d",
      accounts: [
        "c26dbd3bc5175040c63fadcba732fcf2a1117c88db152d193760b31603a800bd",
      ],
    },
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 4000,
    },
  },
};
