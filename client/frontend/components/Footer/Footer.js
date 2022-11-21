import React from 'react'
import {Flex} from '@chakra-ui/react';
import {dTelecomLogo} from '../../assets';
import * as styles from './Footer.module.scss'

const Footer = () => {
  return (
    <Flex className={styles.container}
          justifyContent={'center'}>
      <p className={styles.text}>Powered by</p><img  src={dTelecomLogo}/>
    </Flex>
  )
}

export default Footer