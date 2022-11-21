import React from 'react';
import App from './App';
import getConfig from './config.js';
import * as nearAPI from 'near-api-js';
import {createRoot} from 'react-dom/client';
import {StrictMode} from 'react';
import {BrowserRouter} from 'react-router-dom';
import {appStore} from './stores/appStore';

// Initializing contract
async function initContract() {
  // get network configuration values from config.js
  // based on the network ID we pass to getConfig()
  const nearConfig = getConfig(process.env.NEAR_ENV || 'mainnet');

  // create a keyStore for signing transactions using the user's key
  // which is located in the browser local storage after user logs in
  const keyStore = new nearAPI.keyStores.BrowserLocalStorageKeyStore();

  // Initializing connection to the NEAR testnet
  const near = await nearAPI.connect({keyStore, ...nearConfig});

  // Initialize wallet connection
  const walletConnection = new nearAPI.WalletConnection(near);

  // Load in user's account data
  let currentUser;
  if (walletConnection.getAccountId()) {
    currentUser = {
      // Gets the accountId as a string
      accountId: walletConnection.getAccountId(),
      // Gets the user's token balance
      balance: (await walletConnection.account().state()).amount,
    };
  }

  // Initializing our contract APIs by contract name and configuration
  const contract = await new nearAPI.Contract(
    // User's accountId as a string
    walletConnection.account(),
    // accountId of the contract we will be loading
    // NOTE: All contracts on NEAR are deployed to an account and
    // accounts can only have one contract deployed to them.
    nearConfig.contractName,
    {
      // View methods are read-only – they don't modify the state, but usually return some value
      viewMethods: [
        'get_client',
        'get_node',
        'get_total_earned',
        'get_total_conferences',
        'get_total_minutes',
        'get_total_nodes',
        'get_total_clients'
      ],
      // Change methods can modify the state, but you don't receive the returned value when called
      changeMethods: ['add_balance', 'withdraw_balance', 'add_node', 'remove_node'],
      // Sender is the account ID to initialize transactions.
      // getAccountId() will return empty string if user is still unauthorized
      sender: walletConnection.getAccountId(),
    }
  );

  return {contract, currentUser, nearConfig, walletConnection};
}

const rootElement = document.getElementById('root');
const root = createRoot(rootElement);

window.nearInitPromise = initContract().then(
  ({contract, currentUser, nearConfig, walletConnection}) => {
    appStore.setWallet(walletConnection)
    appStore.setContract(contract)
    appStore.setCurrentUser(currentUser)
    appStore.setNearConfig(nearConfig)
    void appStore.loadStats()

    root.render(
      <StrictMode>
        <BrowserRouter>
          <App
            contract={contract}
            currentUser={currentUser}
            nearConfig={nearConfig}
            wallet={walletConnection}
          />
        </BrowserRouter>
      </StrictMode>
    );
  }
)
