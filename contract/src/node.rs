use crate::*;

#[derive(BorshDeserialize, BorshSerialize, Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Node {
    pub address: String,
    pub staked_amount: Balance,
    pub earned_amount: Balance,
    pub active: bool,
    pub unstaked_available_epoch_height: EpochHeight,
}

#[near_bindgen]
impl Contract {
    #[payable]
    pub fn add_node(&mut self, address: String) {
        let previous = self.nodes.get(&env::predecessor_account_id());
        assert!(previous.is_none() == true, "Node exist");

        let exist_nodes: Vec<Node> = self
            .nodes
            .values()
            .filter(|n| n.address == address)
            .collect();
        assert!(exist_nodes.len() == 0, "Adress exist");

        let deposit_amount: Balance = env::attached_deposit();
        assert!(
            deposit_amount == STAKE_AMOUNT,
            "Deposit exact {} yoctoNEAR",
            STAKE_AMOUNT
        );

        let node = Node {
            address: address,
            staked_amount: deposit_amount,
            earned_amount: 0,
            active: true,
            unstaked_available_epoch_height: 0,
        };

        self.nodes.insert(&env::predecessor_account_id(), &node);
    }

    pub fn remove_node(&mut self) -> Promise {
        let node = expect_token_found(self.nodes.get(&env::predecessor_account_id()));

        require!(
            node.unstaked_available_epoch_height < env::epoch_height(),
            "Node must be unused in recent calls"
        );

        let to_withdraw = node.staked_amount + node.earned_amount;

        self.nodes.remove(&env::predecessor_account_id());

        Promise::new(env::predecessor_account_id()).transfer(to_withdraw)
    }

    pub fn deactivate_node(&mut self) {
        let mut node = expect_token_found(self.nodes.get(&env::predecessor_account_id()));
        node.active = false;
        self.nodes.insert(&env::predecessor_account_id(), &node);
    }

    pub fn get_nodes(&self) -> Vec<Node> {
        self.nodes
            .values()
            .filter(|n| n.staked_amount == STAKE_AMOUNT)
            .filter(|n| n.active == true)
            .collect()
    }

    pub fn get_node(&self, account: AccountId) -> Option<Node> {
        self.nodes.get(&account)
    }
}
