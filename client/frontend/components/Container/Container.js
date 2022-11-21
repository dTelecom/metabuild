import React from 'react'
import * as styles from './Container.module.scss'
import classNames from 'classnames'

export const Container = ({children, style, contentStyle, containerClass, contentClass}) => {
  return <div className={classNames(styles.container, !!containerClass && containerClass)} style={style}>
    <div className={classNames(styles.content, !!contentClass && contentClass)} style={contentStyle}>
      {children}
    </div>
  </div>
}