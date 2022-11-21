import {makeAutoObservable} from 'mobx'

class AppStore {
  wallet = undefined
  currentUser = undefined
  contract = undefined
  nearConfig = undefined
  stats = undefined

  constructor() {
    makeAutoObservable(this)
  }

  setWallet = (wallet) => {
    this.wallet = wallet
  }

  setContract = (contract) => {
    this.contract = contract
  }

  setCurrentUser = (currentUser) => {
    this.currentUser = currentUser
  }

  setNearConfig = (nearConfig) => {
    this.nearConfig = nearConfig
  }

  loadStats = async () => {
    if (this.contract) {
      this.stats = {
        minutes: await this.contract.get_total_minutes(),
        conferences: await this.contract.get_total_conferences(),
        clients: await this.contract.get_total_clients(),
        nodes: await this.contract.get_total_nodes(),
        income: await this.contract.get_total_earned()
      }
    }
  }
}

export const appStore = new AppStore()