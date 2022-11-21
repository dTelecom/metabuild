function getConfig(env) {
  switch (env) {
    case 'mainnet':
      return {
        networkId: 'mainnet',
        nodeUrl: 'https://rpc.mainnet.near.org',
        contractName: 'webrtc.dtelecom.near',
        walletUrl: 'https://wallet.near.org',
        helperUrl: 'https://helper.mainnet.near.org'
      };
    case 'local':
      return {
        networkId: process.env.NEAR_CLI_LOCALNET_NETWORK_ID || 'local',
        nodeUrl: process.env.NEAR_NODE_URL || 'http://localhost:3030',
        keyPath: process.env.NEAR_CLI_LOCALNET_KEY_PATH || `${process.env.HOME}/.near/validator_key.json`,
        walletUrl: process.env.NEAR_WALLET_URL || 'http://localhost:4000/wallet',
        contractName: process.env.CONTRACT_NAME || 'main.dtelecom.test.near',
      };
    default:
      throw Error(`Unconfigured environment '${env}'. Can be configured in src/config.js.`);
  }
}

module.exports = getConfig;
