import React from 'react'
import {Header} from '../../components/Header/Header'
import {useNavigate} from 'react-router-dom'
import {Container} from '../../components/Container/Container'
import * as styles from './NodeDashboard.module.scss'
import Guide from '../../components/Guide/Guide';
import NodeForm from '../../components/NodeForm/NodeForm';

const NodeDashboard = () => {
  const navigate = useNavigate()

  return <>
    <Header title={'RUN A NODE'} onBack={() => navigate('/')}/>

    <Container>
      <h2 className={styles.title}>Node Dashboard</h2>

      <NodeForm/>

      <Guide/>
    </Container>
  </>
}

export default NodeDashboard