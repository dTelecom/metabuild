import React, {useEffect, useRef} from 'react'
import {Container} from '../../components/Container/Container';
import {Header} from '../../components/Header/Header';
import {Card} from '../../components/Card/Card';
import {Button} from '../../components/Button/Button';
import * as styles from './Home.module.scss'
import {ClientsIcon, ClockIcon, ConferenceIcon, HomeBg, IncomeIcon, NodesIcon} from '../../assets';
import {appStore} from '../../stores/appStore';
import {observer} from 'mobx-react';
import {useNavigate} from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate()
  const {loadStats, stats} = appStore

  useEffect(() => {
    const interval = setInterval(() => loadStats(), 5000);

    return () => clearInterval(interval);
  })

  const cards = [
    {
      name: 'Minutes',
      data: stats?.minutes || 0,
      icon: ClockIcon,
    },
    {
      name: 'Conferences',
      data: stats?.conferences || 0,
      icon: ConferenceIcon,
    },
    {
      name: 'Clients',
      data: stats?.clients || 0,
      icon: ClientsIcon,
    },
    {
      name: 'Nodes',
      data: stats?.nodes || 0,
      icon: NodesIcon,
    },
    {
      name: 'Miners income (NEAR)',
      data: String(stats?.income ? (stats.income) / (10 ** 24) : 0).slice(0, 5),
      icon: IncomeIcon,
    },
  ]

  return <>
    <Header/>
    <Container
      style={{
        backgroundImage: `url(${HomeBg})`,
        backgroundPosition: 'bottom right',
        backgroundSize: '596px auto',
        backgroundRepeat: 'no-repeat',
        minHeight: 'calc(100vh - 88px)',
      }}
    >
      <h1 className={styles.title}>{'Building the Web3\nCPaaS together'}</h1>
      <h2 className={styles.subtitle}>WebRTC Statistics</h2>
      <p className={styles.greyText}>(video conferencing)</p>

      <div className={styles.cardsContainer}>
        {cards.map(card => <Card
          key={card.name}
          card={card}
        />)}
      </div>

      <h2 className={styles.subtitle}>Get Started</h2>

      <div className={styles.buttonsContainer}>
        <Button
          onClick={() => navigate('/customer-dashboard')}
          text={'Become a Customer'}
        />
        <Button
          onClick={() => navigate('/node-dashboard')}
          text={'Run a Node'}
        />
      </div>

    </Container>
  </>
}

export default observer(Home)