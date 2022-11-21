import React from 'react'
import * as styles from './Input.module.scss'
import classNames from 'classnames';

const Input = ({label, value, onChange, disabled, postfix = '', inputDisabled}) => {
  return (
    <div className={classNames(styles.container, disabled && styles.disabled)}>
      {label && <p className={styles.label}>{label}</p>}
      <input
        className={styles.input}
        value={value + postfix}
        onChange={(e) => onChange(
          postfix ? e.target.value.replace(/[^0-9.]+/g, '') : e.target.value
        )}
        disabled={inputDisabled}
      />
    </div>
  )
}

export default Input