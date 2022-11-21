import React from 'react';
import App from './App';
import {StrictMode} from 'react';
import {BrowserRouter} from 'react-router-dom';
import * as ReactDOM from 'react-dom';

const rootElement = document.getElementById('root');

ReactDOM.render(
  (
    <StrictMode>
      <BrowserRouter>
        <App/>
      </BrowserRouter>
    </StrictMode>
  ),
  rootElement
);


