import 'regenerator-runtime/runtime';
import React from 'react';
import {Route, Routes} from 'react-router-dom';
import Home from '../frontend/pages/Home/Home';
import Call from './pages/Call/Call';

const App = () => {
  return (
    <Routes>
      <Route index element={<Home/>}/>
      <Route path={'/call'} element={<Call/>}/>
      <Route path={'/join/:sid'} element={<Home isJoin/>}/>
      <Route path={'/call/:sid'} element={<Call/>}/>
    </Routes>
  );
};

export default App;
