import React from 'react'
import * as styles from './Guide.module.scss'

const Guide = () => {
  const steps = [
    {
      text: 'SDK integration into\nthe client\'s product'
    },
    {
      text: 'Create balance in a smart-\ncontract with a crypto wallet'
    },
    {
      text: 'Top up this balance via wire\ntransfer/card payment/crypto'
    },
  ]

  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        <h2>Step-by-step guide</h2>

        <div className={styles.stepsContainer}>
          {steps.map((step, index) => (
            <div className={styles.step}>
              <div className={styles.stepNumber}>
                <div className={styles.stepNumberInner}>
                  {index + 1}
                </div>
              </div>
              <p className={styles.stepText}>{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Guide