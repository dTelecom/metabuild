import React from 'react'
import * as styles from './Container.module.scss'

export const Container = ({children, style}) => {
  return <div className={styles.container} style={style}>
    <div className={styles.content}>
      {children}
    </div>
  </div>
}