extern crate hex;

use ed25519_dalek::Verifier;

use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::UnorderedMap;
use near_sdk::json_types::{U128, U64};
use near_sdk::serde::Serialize;
use near_sdk::{env, near_bindgen, require, AccountId, Balance, EpochHeight, Promise, PublicKey};

mod call;
mod client;
mod node;

use crate::call::*;
use crate::client::*;
use crate::node::*;

type WrappedCounter = U128;
type WrappedLength = U64;

// 0.001 NEAR
pub const STORAGE_COST: u128 = 1_000_000_000_000_000_000_000;

// 0.001 NEAR ~ 0.002 USD
pub const MINUTE_PRICE: u128 = 1_000_000_000_000_000_000_000;

// 0.003 NEAR
pub const GAS_COST: u128 = 3_000_000_000_000_000_000_000;

// 10 NEAR
pub const STAKE_AMOUNT: u128 = 10_000_000_000_000_000_000_000_000;

fn expect_token_found<T>(option: Option<T>) -> T {
    option.unwrap_or_else(|| env::panic_str("Value not found"))
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize)]
pub struct Contract {
    pub clients: UnorderedMap<AccountId, Client>,
    pub nodes: UnorderedMap<AccountId, Node>,
    pub active_calls: UnorderedMap<String, Call>,
    pub recent_calls_0: UnorderedMap<String, Call>,
    pub recent_calls_1: UnorderedMap<String, Call>,
    pub balance: Balance,
    pub owner: AccountId,
    pub total_earned: Balance,
    pub total_conferences: u128,
    pub total_minutes: u128,
    pub prev_storage_key: EpochHeight,
}

impl Default for Contract {
    fn default() -> Self {
        Self {
            clients: UnorderedMap::new(b"c"),
            nodes: UnorderedMap::new(b"n"),
            active_calls: UnorderedMap::new(b"a"),
            recent_calls_0: UnorderedMap::new(b"f"),
            recent_calls_1: UnorderedMap::new(b"s"),
            balance: 0,
            owner: "dtelecom.near".parse().unwrap(),
            total_earned: 0,
            total_conferences: 0,
            total_minutes: 0,
            prev_storage_key: 0,
        }
    }
}

#[near_bindgen]
impl Contract {
    #[init]
    #[private]
    pub fn init(owner: AccountId) -> Self {
        Self {
            clients: UnorderedMap::new(b"c"),
            nodes: UnorderedMap::new(b"n"),
            active_calls: UnorderedMap::new(b"a"),
            recent_calls_0: UnorderedMap::new(b"f"),
            recent_calls_1: UnorderedMap::new(b"s"),
            balance: 0,
            owner: owner,
            total_earned: 0,
            total_conferences: 0,
            total_minutes: 0,
            prev_storage_key: 0,
        }
    }

    pub fn withdraw(&mut self) -> Promise {
        if self.owner != near_sdk::env::predecessor_account_id() {
            near_sdk::env::panic_str("Method method is private");
        }

        require!(self.balance > 0, "Low balance");

        let to_transfer = self.balance;
        self.balance = 0;
        Promise::new(self.owner.clone()).transfer(to_transfer)
    }

    pub fn get_total_earned(&self) -> WrappedCounter {
        near_sdk::json_types::U128(self.total_earned)
    }

    pub fn get_total_conferences(&self) -> WrappedCounter {
        near_sdk::json_types::U128(self.total_conferences)
    }

    pub fn get_total_minutes(&self) -> WrappedCounter {
        near_sdk::json_types::U128(self.total_minutes)
    }

    pub fn get_total_nodes(&self) -> WrappedLength {
        near_sdk::json_types::U64(self.nodes.len())
    }

    pub fn get_total_clients(&self) -> WrappedLength {
        near_sdk::json_types::U64(self.clients.len())
    }

    pub fn get_epoch_height(&self) -> EpochHeight {
        env::epoch_height()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::Keypair;
    use ed25519_dalek::Signer;
    use hex::FromHex;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    const NEAR: u128 = 1000000000000000000000000;

    #[test]
    fn balance_flow() {
        let mut contract = Contract::init("dtelecom".parse().unwrap());

        set_context("client_a", 1 * NEAR, 1);

        contract.add_balance();
        let client_a = contract.get_client("client_a".parse().unwrap()).unwrap();
        assert_eq!(client_a.deposited_amount, 1 * NEAR - STORAGE_COST);

        contract.withdraw_balance();
        let client_a2 = contract.get_client("client_a".parse().unwrap()).unwrap();
        assert_eq!(client_a2.deposited_amount, 0);

        contract.add_balance();
        let client_a = contract.get_client("client_a".parse().unwrap()).unwrap();
        assert_eq!(client_a.deposited_amount, 1 * NEAR);
    }

    #[test]
    #[should_panic]
    fn balance_panic() {
        let mut contract = Contract::init("dtelecom".parse().unwrap());

        set_context("client_b", 1 * NEAR, 1);
        contract.withdraw_balance();
    }

    #[test]
    fn node_flow() {
        let mut contract = Contract::init("dtelecom".parse().unwrap());

        set_context("mainer_a", 10 * NEAR, 1);
        contract.add_node("https://example.com/".to_string());
        let node = &contract.get_nodes()[0];
        assert_eq!(node.staked_amount, 10 * NEAR);
        assert_eq!(node.address, "https://example.com/");

        contract.remove_node();
        let nodes = contract.get_nodes();
        assert_eq!(nodes.len(), 0);

        contract.add_node("https://example2.com/".to_string());
        let node2 = &contract.get_nodes()[0];
        assert_eq!(node2.staked_amount, 10 * NEAR);
        assert_eq!(node2.address, "https://example2.com/");
    }

    #[test]
    #[should_panic]
    fn node_flow_panic() {
        let mut contract = Contract::init("dtelecom".parse().unwrap());

        set_context("mainer_a", 10 * NEAR, 1);
        contract.add_node("https://example.com/".to_string());

        set_context("mainer_b", 10 * NEAR, 1);
        contract.add_node("https://example.com/".to_string());
    }

    #[test]
    #[should_panic]
    fn node_panic() {
        let mut contract = Contract::init("dtelecom".parse().unwrap());

        set_context("mainer_a", 1 * NEAR, 1);
        contract.remove_node();
    }

    #[test]
    fn call_flow() {
        let mut contract = Contract::init("dtelecom".parse().unwrap());

        let keypair: Keypair = prepare_keypair();

        set_context("client_a", 1 * NEAR, 1);
        contract.add_balance();

        set_context("mainer_a", 10 * NEAR, 1);
        contract.add_node("https://example.com/".to_string());

        let signature1 = keypair.sign(b"123:0:1");
        contract.create_call(
            "123".to_string(),
            "client_a".to_string(),
            1,
            bs58::encode(signature1).into_string(),
        );

        let calls1 = contract.get_active_calls();
        assert_eq!(calls1.len(), 1);

        let call_started = &calls1[0];
        assert_eq!(call_started.id, "123");
        assert_eq!(call_started.client_id, "client_a".parse().unwrap());
        assert_eq!(call_started.node_id, "mainer_a".parse().unwrap());

        let signature2 = keypair.sign(b"123:100:1");
        contract.end_call(
            "123".to_string(),
            "client_a".to_string(),
            100,
            1,
            bs58::encode(signature2).into_string(),
        );
        let calls2 = contract.get_active_calls();
        assert_eq!(calls2.len(), 0);

        assert_eq!(contract.balance, 485_000_000_000_000_000_000_00);

        let client = contract.get_client("client_a".parse().unwrap()).unwrap();
        assert_eq!(client.deposited_amount, 8_990_000_000_000_000_000_000_00);

        let node = contract.get_node("mainer_a".parse().unwrap()).unwrap();

        assert_eq!(node.earned_amount, 485_000_000_000_000_000_000_00);

        set_context("mainer_a", 0 * NEAR, 4);
        contract.remove_node();

        set_context("client_a", 0 * NEAR, 4);
        contract.withdraw_balance();
    }

    #[test]
    fn call_flow_end_active() {
        let mut contract = Contract::init("dtelecom".parse().unwrap());

        let keypair: Keypair = prepare_keypair();

        set_context("client_a", 1 * NEAR, 1);
        contract.add_balance();

        set_context("mainer_a", 10 * NEAR, 1);
        contract.add_node("https://example.com/".to_string());

        let signature1 = keypair.sign(b"123:0:1");
        contract.create_call(
            "123".to_string(),
            "client_a".to_string(),
            1,
            bs58::encode(signature1).into_string(),
        );

        set_context("dtelecom", 0 * NEAR, 1);
        contract.end_active_call("123".to_string(), 0);

        let calls = contract.get_active_calls();
        assert_eq!(calls.len(), 0);
    }

    #[test]
    fn call_recent_rotate() {
        let mut contract = Contract::init("dtelecom".parse().unwrap());

        let keypair: Keypair = prepare_keypair();

        set_context("client_a", 1 * NEAR, 1);
        contract.add_balance();

        set_context("mainer_a", 10 * NEAR, 1);
        contract.add_node("https://example.com/".to_string());

        let signature1 = keypair.sign(b"123:0:1");
        contract.create_call(
            "123".to_string(),
            "client_a".to_string(),
            1,
            bs58::encode(signature1).into_string(),
        );

        let signature2 = keypair.sign(b"123:100:1");
        contract.end_call(
            "123".to_string(),
            "client_a".to_string(),
            100,
            1,
            bs58::encode(signature2).into_string(),
        );

        let calls0 = contract.get_recent_calls_0();
        assert_eq!(calls0.len(), 0);

        let calls1 = contract.get_recent_calls_1();
        assert_eq!(calls1.len(), 1);

        set_context("mainer_a", 10 * NEAR, 2);

        let signature3 = keypair.sign(b"1234:0:2");
        contract.create_call(
            "1234".to_string(),
            "client_a".to_string(),
            2,
            bs58::encode(signature3).into_string(),
        );

        let signature4 = keypair.sign(b"1234:100:2");
        contract.end_call(
            "1234".to_string(),
            "client_a".to_string(),
            100,
            2,
            bs58::encode(signature4).into_string(),
        );

        let calls0_1 = contract.get_recent_calls_0();
        assert_eq!(calls0_1.len(), 1);

        let calls1_1 = contract.get_recent_calls_1();
        assert_eq!(calls1_1.len(), 1);

        set_context("mainer_a", 10 * NEAR, 3);

        let signature4 = keypair.sign(b"12345:0:3");
        contract.create_call(
            "12345".to_string(),
            "client_a".to_string(),
            3,
            bs58::encode(signature4).into_string(),
        );

        let signature5 = keypair.sign(b"12345:100:3");
        contract.end_call(
            "12345".to_string(),
            "client_a".to_string(),
            100,
            3,
            bs58::encode(signature5).into_string(),
        );

        let calls0_2 = contract.get_recent_calls_0();
        assert_eq!(calls0_2.len(), 1);

        let calls1_2 = contract.get_recent_calls_1();
        assert_eq!(calls1_2.len(), 1);

        let call = &contract.get_recent_calls_1()[0];
        assert_eq!(call.id, "12345");
    }

    #[test]
    #[should_panic]
    fn create_call_panic_no_client() {
        let mut contract = Contract::init("dtelecom".parse().unwrap());

        let keypair: Keypair = prepare_keypair();

        set_context("mainer_a", 10 * NEAR, 1);
        contract.add_node("https://example.com/".to_string());

        let signature = keypair.sign(b"123:0:1");
        contract.create_call(
            "123".to_string(),
            "client_a".to_string(),
            1,
            bs58::encode(signature).into_string(),
        );
    }

    #[test]
    #[should_panic]
    fn create_call_panic_no_node() {
        let mut contract = Contract::init("dtelecom".parse().unwrap());

        let keypair: Keypair = prepare_keypair();

        set_context("client_a", 1 * NEAR, 1);
        contract.add_balance();

        set_context("mainer_a", 10 * NEAR, 1);

        let signature = keypair.sign(b"123:0:1");
        contract.create_call(
            "123".to_string(),
            "client_a".to_string(),
            1,
            bs58::encode(signature).into_string(),
        );
    }

    #[test]
    #[should_panic]
    fn call_double_spend() {
        let mut contract = Contract::init("dtelecom".parse().unwrap());

        let keypair: Keypair = prepare_keypair();

        set_context("client_a", 1 * NEAR, 1);
        contract.add_balance();

        set_context("mainer_a", 10 * NEAR, 1);
        contract.add_node("https://example.com/".to_string());

        let signature1 = keypair.sign(b"123:0:1");
        contract.create_call(
            "123".to_string(),
            "client_a".to_string(),
            1,
            bs58::encode(signature1).into_string(),
        );

        let signature2 = keypair.sign(b"123:100:1");
        contract.end_call(
            "123".to_string(),
            "client_a".to_string(),
            100,
            1,
            bs58::encode(signature2).into_string(),
        );
        assert_eq!(contract.balance, 485_000_000_000_000_000_000_00);

        contract.create_call(
            "123".to_string(),
            "client_a".to_string(),
            1,
            bs58::encode(signature1).into_string(),
        );
    }

    #[test]
    fn call_fine() {
        let mut contract = Contract::init("dtelecom".parse().unwrap());

        let keypair: Keypair = prepare_keypair();

        set_context("client_a", 1 * NEAR, 1);
        contract.add_balance();

        set_context("mainer_a", 10 * NEAR, 1);
        contract.add_node("https://example.com/".to_string());

        let signature1 = keypair.sign(b"123:0:1");
        contract.create_call(
            "123".to_string(),
            "client_a".to_string(),
            1,
            bs58::encode(signature1).into_string(),
        );

        let signature2 = keypair.sign(b"123:100:1");
        contract.end_call(
            "123".to_string(),
            "client_a".to_string(),
            100,
            1,
            bs58::encode(signature2).into_string(),
        );

        set_context("dtelecom", 0 * NEAR, 1);
        contract.fine_recent_call("123".to_string(), 1_000_000_000_000_000_000_000_000);

        let node = contract.get_node("mainer_a".parse().unwrap()).unwrap();

        assert_eq!(node.staked_amount, 9_000_000_000_000_000_000_000_000);
    }

    fn prepare_keypair() -> Keypair {
        let secret_key: &[u8] = b"833fe62409237b9d62ec77587520911e9a759cec1d19755b7da901b96dca3d42";
        let public_key: &[u8] = b"ec172b93ad5e563bf4932c70e1245034c35467ef2efd4d64ebf819683467e2bf";
        let sec_bytes: Vec<u8> = FromHex::from_hex(secret_key).unwrap();
        let pub_bytes: Vec<u8> = FromHex::from_hex(public_key).unwrap();

        let mut bytes: [u8; 64] = [0u8; 64];
        bytes[..32].copy_from_slice(&sec_bytes[..]);
        bytes[32..].copy_from_slice(&pub_bytes[..]);
        Keypair::from_bytes(&bytes).unwrap()
    }

    fn set_context(predecessor: &str, amount: Balance, epoch: EpochHeight) {
        let mut builder = VMContextBuilder::new();

        let pk: &[u8] = b"ec172b93ad5e563bf4932c70e1245034c35467ef2efd4d64ebf819683467e2bf";
        let pub_bytes: Vec<u8> = FromHex::from_hex(pk).unwrap();

        let spk = "ed25519:".to_owned() + &bs58::encode(pub_bytes).into_string();

        let public_key: PublicKey = spk.parse().unwrap();

        builder.current_account_id(predecessor.parse().unwrap());
        builder.predecessor_account_id(predecessor.parse().unwrap());
        builder.attached_deposit(amount);
        builder.signer_account_id(predecessor.parse().unwrap());
        builder.signer_account_pk(public_key);
        builder.epoch_height(epoch);

        testing_env!(builder.build());
    }
}
