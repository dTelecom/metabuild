import React from 'react'
import {observer} from 'mobx-react';
import {ExitIcon, WalletIcon} from '../../assets';
import {appStore} from '../../stores/appStore';
import * as styles from './ProfileBadge.module.scss'

const ProfileBadge = ({signOut}) => {
  const {currentUser} = appStore

  const shortAccountId = currentUser.accountId.length > 12 ? currentUser.accountId.slice(0, 6) + '...' + currentUser.accountId.slice(-4) : currentUser.accountId

  return (
    <div className={styles.badge}>
      <div className={styles.accountBadge}>
        <img src={WalletIcon} alt={'wallet icon'}/>
        <span>{shortAccountId}</span>
      </div>

      <button onClick={signOut} className={styles.logOutButton}>
        <img src={ExitIcon} alt={'log out button'}/>
      </button>
    </div>
  )
}

export default observer(ProfileBadge)