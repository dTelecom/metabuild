import React, {useEffect, useState} from 'react'
import Input from '../Input/Input'
import {Button} from '../Button/Button'
import {appStore} from '../../stores/appStore'
import * as styles from './BalanceForm.module.scss'
import {observer} from 'mobx-react';
import Big from 'big.js';
import {BOATLOAD_OF_GAS} from '../../App';
import {Modal, ModalContent, ModalOverlay, useDisclosure,} from '@chakra-ui/react'
import {CloseIcon} from '../../assets';

const BalanceForm = () => {
  const {currentUser, contract} = appStore
  const [value, setValue] = useState('0')
  const {isOpen, onOpen, onClose} = useDisclosure()
  const [topUpBalance, setTopUpBalance] = useState('1')

  useEffect(() => {
    if (currentUser) {
      contract.get_client({account: currentUser.accountId}).then(client => {
        console.log(client)
        if (client) {
          setValue(Big(client.deposited_amount).div(10 ** 24))
        }
      });
    }
  }, [currentUser])

  const withdraw = () => {
    contract.withdraw_balance(
      {},
      BOATLOAD_OF_GAS,
      Big('0').times(10 ** 24).toFixed()
    ).then(() => {
      contract.get_client({account: currentUser.accountId}).then(c => {
        console.log(c)
      });
    });
  };


  const onTopUp = (e) => {
    e.preventDefault();

    contract.add_balance(
      {},
      BOATLOAD_OF_GAS,
      Big(topUpBalance || '0').times(10 ** 24).toFixed()
    ).then(() => {
      contract.get_client({account: currentUser.accountId}).then(c => {
        setClient(c);
        console.log(c)
        fieldset.disabled = false;
      });
    });
  };

  return (
    <>
      <div className={styles.container}>
        <Input
          label={'Balance'}
          value={value}
          onChange={undefined}
          disabled={!currentUser}
          inputDisabled
        />

        <div className={styles.buttonContainer}>
          <Button
            text={'Withdraw'}
            onClick={withdraw}
            disabled={currentUser?.balance <= 0 || !currentUser}
          />
          <Button
            text={'Top-up'}
            onClick={onOpen}
            disabled={!currentUser}
          />
        </div>
      </div>

      <Modal
        isCentered
        isOpen={isOpen}
        onClose={onClose}
      >
        <ModalOverlay
          bg="rgba(0,0,0,0.5)"
          backdropFilter="blur(5px)"
        />
        <ModalContent>
          <div className={styles.modalContent}>
            <div className={styles.modalContainer}>
              <button
                className={styles.closeButton}
                onClick={onClose}
              >
                <img
                  src={CloseIcon}
                  alt="Close"
                />
              </button>
              <h3>Top-up balance</h3>

              <Input
                value={topUpBalance}
                onChange={(val) => {
                  setTopUpBalance(val)
                }}
                postfix={' NEAR'}
              />

              <div className={styles.modalButtonContainer}>
                <Button
                  text={'Pay'}
                  onClick={onTopUp}
                  disabled={!currentUser}
                />
              </div>
            </div>
          </div>
        </ModalContent>

      </Modal>
    </>
  )
}

export default observer(BalanceForm)