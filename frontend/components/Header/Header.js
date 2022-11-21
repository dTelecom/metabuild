import React from 'react'
import {ArrowLeftIcon, Logo} from '../../assets'
import * as styles from './Header.module.scss'
import {ConnectWalletButton} from '../ConnectWalletButton/ConnectWalletButton'
import {observer} from 'mobx-react'
import {appStore} from '../../stores/appStore'
import ProfileBadge from '../ProfileBadge/ProfileBadge';
import classNames from 'classnames';

export const Header = observer(({onBack, title}) => {
  const {wallet, nearConfig, contract, currentUser} = appStore

  const signIn = () => {
    wallet.requestSignIn(
      {contractId: nearConfig.contractName, methodNames: [contract.add_balance.name]}, //contract requesting access
      'dTelecom', //optional name
      null, //optional URL to redirect to if the sign in was successful
      null //optional URL to redirect to if the sign in was NOT successful
    )
  }

  const signOut = () => {
    wallet.signOut()
    appStore.setCurrentUser(undefined)
  }

  return <div className={classNames(styles.container, title && styles.containerWithTitle)}>
    <div className={styles.logoContainer}>
      <img
        src={Logo}
        alt={'dTelecom logo'}
      />
    </div>

    {title && (
      <div className={classNames(styles.backContainer, styles.backContainerDesktop)}>
        <button className={styles.backButton}>
          <img
            onClick={onBack}
            src={ArrowLeftIcon}
            alt={'back button'}
          />
        </button>

        <p className={styles.backTitle}>{title}</p>
      </div>
    )}

    <div className={styles.controlContainer}>
      {currentUser ? (
        <ProfileBadge signOut={signOut}/>
      ) : (
        <ConnectWalletButton onClick={signIn}/>
      )}
    </div>

    {title && (
      <div className={classNames(styles.backContainer, styles.backContainerMobile)}>
        <button className={styles.backButton}>
          <img
            onClick={onBack}
            src={ArrowLeftIcon}
            alt={'back button'}
          />
        </button>

        <p className={styles.backTitle}>{title}</p>
      </div>
    )}
  </div>
})