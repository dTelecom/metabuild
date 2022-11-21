use crate::*;

#[derive(BorshDeserialize, BorshSerialize, Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Client {
    pub deposited_amount: Balance,
    pub pk: PublicKey,
}

#[near_bindgen]
impl Contract {
    #[payable]
    pub fn add_balance(&mut self) {
        let deposit_amount: Balance = env::attached_deposit();
        let client = self.clients.get(&env::predecessor_account_id());

        let deposited: Balance = if client.is_none() == true {
            0
        } else {
            client.as_ref().unwrap().deposited_amount
        };

        let to_deposit: Balance = if client.is_none() == true {
            assert!(
                deposit_amount > STORAGE_COST,
                "Deposit more than {} yoctoNEAR",
                STORAGE_COST
            );
            deposit_amount - STORAGE_COST
        } else {
            deposit_amount
        };

        let pk: PublicKey = if client.is_none() == true {
            env::signer_account_pk()
        } else {
            client.as_ref().unwrap().pk.clone()
        };

        let new_client = Client {
            deposited_amount: deposited + to_deposit,
            pk: pk,
        };

        self.clients
            .insert(&env::predecessor_account_id(), &new_client);
    }

    pub fn get_client(&self, account: AccountId) -> Option<Client> {
        self.clients.get(&account)
    }

    pub fn withdraw_balance(&mut self) -> Promise {
        let mut client = expect_token_found(self.clients.get(&env::predecessor_account_id()));

        assert_ne!(client.deposited_amount, 0, "Low deposit");

        let current_calls: Vec<Call> = self
            .active_calls
            .values()
            .filter(|c| c.client_id == env::predecessor_account_id())
            .collect();
        require!(current_calls.len() == 0, "Deposit must be unused");

        let to_withdraw = client.deposited_amount;
        client.deposited_amount = 0;

        self.clients.insert(&env::predecessor_account_id(), &client);

        Promise::new(env::predecessor_account_id()).transfer(to_withdraw)
    }
}
