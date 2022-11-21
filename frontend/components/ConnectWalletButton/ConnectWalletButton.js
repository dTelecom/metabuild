import React from 'react'
import {ConnectWalletIcon} from '../../assets';
import * as styles from './ConnectWalletButton.module.scss'

export const ConnectWalletButton = ({onClick}) => {
  return <button onClick={onClick} className={styles.connectWalletButtonOuter}>
    <div className={styles.connectWalletButtonInner}>
      Connect Wallet<img src={ConnectWalletIcon} alt="connect wallet icon"/>
    </div>
  </button>
}