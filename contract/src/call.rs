use crate::*;

#[derive(BorshDeserialize, BorshSerialize, Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Call {
    pub id: String,
    pub client_id: AccountId,
    pub node_id: AccountId,
    pub minutes: u128,
    pub created_at: u64,
    pub ended_at: u64,
    pub earned: u128,
}

#[near_bindgen]
impl Contract {
    pub fn create_call(&mut self, id: String, client_id: String, epoch: EpochHeight, sign: String) {
        assert!(
            env::epoch_height() - epoch < 2,
            "Wrong epoch {}",
            env::epoch_height()
        );

        let signature =
            ed25519_dalek::Signature::from_bytes(&bs58::decode(sign).into_vec().unwrap()).unwrap();

        let mut node = expect_token_found(self.nodes.get(&env::predecessor_account_id()));

        require!(node.staked_amount == STAKE_AMOUNT, "Not enough staked");

        let previous_active = self.active_calls.get(&id);
        assert!(previous_active.is_none() == true, "Call exist");

        let previous_recent = self.get_recent_call(id.clone());
        assert!(previous_recent.is_none() == true, "Call exist");

        let client_account: AccountId = client_id.parse().unwrap();
        assert!("invalid.".parse::<AccountId>().is_err());

        let client = expect_token_found(self.clients.get(&client_account));

        require!(
            client.deposited_amount > MINUTE_PRICE * 2,
            "Not enough client balance"
        );

        let public_key = ed25519_dalek::PublicKey::from_bytes(&client.pk.as_bytes()[1..]).unwrap();

        let message = id.clone() + ":0:" + &epoch.to_string();
        let verified = public_key.verify(message.as_bytes(), &signature).is_ok();

        require!(verified == true, "Signature mismatch");

        let call = Call {
            id: id.clone(),
            client_id: client_account,
            node_id: env::predecessor_account_id(),
            minutes: 0,
            created_at: env::block_timestamp(),
            ended_at: 0,
            earned: 0,
        };

        self.active_calls.insert(&id, &call);

        node.unstaked_available_epoch_height += 3;
        self.nodes.insert(&env::predecessor_account_id(), &node);

        self.total_conferences = self.total_conferences + 1;
    }

    pub fn end_call(
        &mut self,
        id: String,
        client_id: String,
        minutes: u128,
        epoch: EpochHeight,
        sign: String,
    ) -> Promise {
        let signature =
            ed25519_dalek::Signature::from_bytes(&bs58::decode(sign).into_vec().unwrap()).unwrap();

        let mut call = expect_token_found(self.active_calls.get(&id));
        let mut node = expect_token_found(self.nodes.get(&env::predecessor_account_id()));

        let client_account: AccountId = client_id.parse().unwrap();
        assert!("invalid.".parse::<AccountId>().is_err());

        require!(call.client_id == client_account, "Client mismatch");
        require!(
            call.node_id == env::predecessor_account_id(),
            "Node mismatch"
        );

        let mut client = expect_token_found(self.clients.get(&client_account));

        let public_key = ed25519_dalek::PublicKey::from_bytes(&client.pk.as_bytes()[1..]).unwrap();

        let message = id.clone() + ":" + &minutes.to_string() + ":" + &epoch.to_string();
        let verified = public_key.verify(message.as_bytes(), &signature).is_ok();

        require!(verified == true, "Signature mismatch");

        call.minutes = minutes;
        call.ended_at = env::block_timestamp();

        let spent = call.minutes * MINUTE_PRICE;

        let to_spent: u128 = if client.deposited_amount >= spent {
            spent
        } else {
            client.deposited_amount
        };

        client.deposited_amount = client.deposited_amount - to_spent;

        let to_return: u128 = if to_spent >= GAS_COST { GAS_COST } else { 0 };

        self.clients.insert(&call.client_id, &client);
        self.active_calls.remove(&id);

        self.total_minutes = self.total_minutes + minutes;
        self.total_earned = self.total_earned + to_spent - to_return;

        let earned = to_spent - to_return;
        call.earned = earned;

        if earned > 0 {
            node.earned_amount += earned / 2;
            self.balance += earned / 2;
        }

        self.nodes.insert(&env::predecessor_account_id(), &node);

        let store_key = env::epoch_height() % 2;

        if store_key == 0 {
            if store_key != self.prev_storage_key {
                self.recent_calls_0.clear();
            }
            self.recent_calls_0.insert(&id, &call);
        }
        if store_key == 1 {
            if store_key != self.prev_storage_key {
                self.recent_calls_1.clear();
            }
            self.recent_calls_1.insert(&id, &call);
        }

        self.prev_storage_key = store_key;

        Promise::new(env::predecessor_account_id()).transfer(to_return)
    }

    pub fn end_active_call(&mut self, id: String, fine: Balance) {
        if self.owner != near_sdk::env::predecessor_account_id() {
            near_sdk::env::panic_str("Method method is private");
        }

        if fine > 0 {
            let call = expect_token_found(self.active_calls.get(&id));
            let mut node = expect_token_found(self.nodes.get(&call.node_id));
            let mut client = expect_token_found(self.clients.get(&call.client_id));
            node.staked_amount = node.staked_amount - fine;
            client.deposited_amount = client.deposited_amount + fine;
            self.nodes.insert(&call.node_id, &node);
            self.clients.insert(&call.client_id, &client);
        }

        self.active_calls.remove(&id);
    }

    pub fn fine_recent_call(&mut self, id: String, fine: Balance) {
        if self.owner != near_sdk::env::predecessor_account_id() {
            near_sdk::env::panic_str("Method method is private");
        }

        let call = self
            .get_recent_call(id)
            .unwrap_or_else(|| env::panic_str("Call not found"));

        let mut node = expect_token_found(self.nodes.get(&call.node_id));
        let mut client = expect_token_found(self.clients.get(&call.client_id));
        node.staked_amount = node.staked_amount - fine;
        client.deposited_amount = client.deposited_amount + fine;
        self.nodes.insert(&call.node_id, &node);
        self.clients.insert(&call.client_id, &client);
    }

    pub fn get_active_calls(&self) -> Vec<Call> {
        self.active_calls.values().collect()
    }

    pub fn get_active_call(&self, id: String) -> Option<Call> {
        self.active_calls.get(&id)
    }

    pub fn get_recent_calls_0(&self) -> Vec<Call> {
        self.recent_calls_0.values().collect()
    }

    pub fn get_recent_calls_1(&self) -> Vec<Call> {
        self.recent_calls_1.values().collect()
    }

    fn get_recent_call(&mut self, id: String) -> Option<Call> {
        let call0 = self.recent_calls_0.get(&id);
        if call0.is_none() == false {
            return call0;
        } else {
            let call1 = self.recent_calls_1.get(&id);
            if call1.is_none() == false {
                return call1;
            }
        }
        None
    }
}
