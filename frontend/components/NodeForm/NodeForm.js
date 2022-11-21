import React, {useEffect, useMemo, useState} from 'react'
import Input from '../Input/Input'
import {Button} from '../Button/Button'
import {appStore} from '../../stores/appStore'
import * as styles from './NodeForm.module.scss'
import classNames from 'classnames';
import {observer} from 'mobx-react';
import Big from 'big.js';
import {BOATLOAD_OF_GAS} from '../../App';
import {Box} from '@chakra-ui/react'

const NodeForm = () => {
  const {currentUser, contract} = appStore
  const [value, setValue] = useState('')
  const [node, setNode] = useState(null)
  const [address, setAddress] = useState('')

  useEffect(() => {
      if (currentUser) {
        contract.get_node({account: currentUser.accountId}).then((node) => {
            console.log(node)
            if (node) {
              setNode(node)
              setValue(Big(node.staked_amount).div(10 ** 24))
              setAddress(node.address)
            } else {
              setValue('10')
            }
          }
        )
  }
  }, [currentUser])


  const onSubmitNode = () => {
    if (!address) {
      return
    }

    contract.add_node(
      {address},
      BOATLOAD_OF_GAS,
      Big(value || '0').times(10 ** 24).toFixed()
    ).then(() => {
      contract.get_balance({account: currentUser.accountId}).then(c => {
        console.log(c)
      });
    });
  };

  const removeNode = () => {
    contract.remove_node(
      {address},
      BOATLOAD_OF_GAS,
      Big('0').times(10 ** 24).toFixed()
    ).then(() => {
      contract.get_balance({account: currentUser.accountId}).then(c => {
        console.log(c)
      });
    });
  };

  const isAdd = useMemo(() => {
    return !node
  }, [node])


  const onButtonClick = () => {
    if (isAdd) {
      onSubmitNode();
    } else {
      removeNode();
    }
  }

  if (node === undefined) {
    return null;
  }

  return (
    <div className={styles.container}>
      <h3>{!isAdd ? 'Current Node' : 'Adding a Node'}</h3>
      <Input
        label={isAdd ? 'Enter staking amount' : 'Staked'}
        value={value}
        onChange={!isAdd ? undefined : setValue}
        postfix={' NEAR'}
        disabled={!currentUser}
      />

      <Box mt={'16px'}>
        <Input
          label={isAdd ? 'Enter IP address' : 'IP address'}
          value={address}
          onChange={!isAdd ? undefined : setAddress}
          disabled={!currentUser}
        />
      </Box>

      <div className={classNames(styles.buttonContainer, (!address) && styles.disabled)}>
        <Button
          text={isAdd ? 'ADD NODE' : 'DELETE NODE'}
          onClick={onButtonClick}
          disabled={!currentUser}
        />
        <p className={classNames(!currentUser && styles.disabled)}>{isAdd ? 'and stake NEAR' : 'and take NEAR'}</p>
      </div>
    </div>
  )
}

export default observer(NodeForm)