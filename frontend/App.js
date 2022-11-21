import 'regenerator-runtime/runtime';
import React, {useState, useEffect} from 'react';
import PropTypes from 'prop-types';
import Big from 'big.js';
import {Route, Routes} from 'react-router-dom';
import Home from '../frontend/pages/Home/Home';
import CustomerDashboard from '../frontend/pages/CustomerDashboard/CustomerDashboard';
import NodeDashboard from '../frontend/pages/NodeDashboard/NodeDashboard';

export const BOATLOAD_OF_GAS = Big(3).times(10 ** 13).toFixed();

const App = () => {
  return (
    <Routes>
      <Route index element={<Home/>}/>
      <Route path="customer-dashboard" element={<CustomerDashboard/>}/>
      <Route path="node-dashboard" element={<NodeDashboard/>}/>
    </Routes>
  );
};

App.propTypes = {
  contract: PropTypes.shape({
    add_balance: PropTypes.func.isRequired,
    withdraw_balance: PropTypes.func.isRequired,
    get_client: PropTypes.func.isRequired,
    add_node: PropTypes.func.isRequired,
    remove_node: PropTypes.func.isRequired,
    get_node: PropTypes.func.isRequired,
    get_total_earned: PropTypes.func.isRequired,
    get_total_conferences: PropTypes.func.isRequired,
    get_total_minutes: PropTypes.func.isRequired,
    get_total_nodes: PropTypes.func.isRequired,
    get_total_clients: PropTypes.func.isRequired,
  }).isRequired,
  currentUser: PropTypes.shape({
    accountId: PropTypes.string.isRequired,
    balance: PropTypes.string.isRequired
  }),
  nearConfig: PropTypes.shape({
    contractName: PropTypes.string.isRequired
  }).isRequired,
  wallet: PropTypes.shape({
    requestSignIn: PropTypes.func.isRequired,
    signOut: PropTypes.func.isRequired
  }).isRequired
};

export default App;
