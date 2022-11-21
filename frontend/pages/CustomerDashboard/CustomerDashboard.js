import React from 'react'
import {Header} from '../../components/Header/Header'
import {useNavigate} from 'react-router-dom'
import {Container} from '../../components/Container/Container'
import * as styles from './CustomerDashboard.module.scss'
import BalanceForm from '../../components/BalanceForm/BalanceForm';
import Guide from '../../components/Guide/Guide';

const CustomerDashboard = () => {
  const navigate = useNavigate()

  return <>
    <Header title={'BECOME A CUSTOMER'} onBack={() => navigate('/')}/>

    <Container>
      <h2 className={styles.title}>Customer Dashboard</h2>

      <BalanceForm/>

      <Guide/>
    </Container>
  </>
}

export default CustomerDashboard