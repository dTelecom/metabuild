import React, {useRef} from 'react'
import styles from './Input.module.scss'
import {FaceIcon} from '../../assets';

const Input = ({value, onChange, placeholder}) => {
  const inputRef = useRef();

  return (
    <div
      className={styles.inputContainer}
      onClick={() => inputRef.current?.focus()}
    >
      <img src={FaceIcon}/>
      <input
        ref={inputRef}
        className={styles.input}
        value={value}
        onChange={e => onChange(e.target.value)}
        type="text"
        placeholder={placeholder}
      />
    </div>
  )
}

export default Input