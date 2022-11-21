import React from 'react'
import styles from './Input.module.scss'
import {FaceIcon} from '../../assets';

const Input = ({value, onChange}) => {
  return <div className={styles.inputContainer}>
    <img src={FaceIcon}/>
    <input
      className={styles.input}
      value={value}
      onChange={e => onChange(e.target.value)}
      type="text"
    />
  </div>
}

export default Input