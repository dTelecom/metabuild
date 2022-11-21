import React from 'react'
import {Logo} from '../../assets'
import * as styles from './Header.module.scss'
import {observer} from 'mobx-react'
import classNames from 'classnames'

export const Header = observer(({children, centered}) => {

  return <div className={classNames(styles.container, centered && styles.containerCentered)}>
    <div className={styles.logoContainer}>
      <img
        src={Logo}
        alt={'dTelecom logo'}
      />
    </div>

    {children && (
      <div className={styles.controlContainer}>
        {children}
      </div>
    )}
  </div>
})