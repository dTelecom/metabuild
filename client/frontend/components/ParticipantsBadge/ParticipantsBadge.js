import React from 'react'
import {ParticipantsIcon} from '../../assets'
import * as styles from './ParticipantsBadge.module.scss'
import classNames from 'classnames'

const ParticipantsBadge = ({count, isCall}) => {
  return (
    <div className={classNames(styles.container, isCall && styles.isCall)}>
      <img src={ParticipantsIcon} />
      {count}
    </div>
  )
}

export default ParticipantsBadge