import React from 'react'
import styles from './Card.module.scss'

export const Card = ({card}) => {
  return (
    <div className={styles.container}>
      <span className={styles.title}>{card.name}</span>
      <span className={styles.text}>{card.data}</span>
      <img src={card.icon} alt={card.name + ' icon'}/>
    </div>
  )
}