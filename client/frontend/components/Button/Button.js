import React from 'react'
import styles from './Button.module.scss'

export const Button = ({text, onClick, disabled}) => {
  return (
    <button className={styles.button} onClick={disabled ? undefined : onClick} disabled={disabled}>
      {text}
    </button>
  )
}