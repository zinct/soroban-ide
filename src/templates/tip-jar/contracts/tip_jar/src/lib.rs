#![no_std]

use soroban_sdk::{contract, contractimpl, Env, Symbol, symbol_short};

const TOTAL: Symbol = symbol_short!("TOTAL");
const TIPS: Symbol = symbol_short!("TIPS");

#[contract]
pub struct TipJarContract;

#[contractimpl]
impl TipJarContract {
    /// Record a tip (demo units). Returns the new running total.
    pub fn tip(env: Env, amount: u32) -> u32 {
        if amount == 0 {
            return env.storage().instance().get(&TOTAL).unwrap_or(0);
        }
        let current: u32 = env.storage().instance().get(&TOTAL).unwrap_or(0);
        let count: u32 = env.storage().instance().get(&TIPS).unwrap_or(0);
        let next = current.saturating_add(amount);
        env.storage().instance().set(&TOTAL, &next);
        env.storage().instance().set(&TIPS, &(count + 1));
        env.storage().instance().extend_ttl(50, 100);
        next
    }

    pub fn get_total(env: Env) -> u32 {
        env.storage().instance().get(&TOTAL).unwrap_or(0)
    }

    pub fn get_tip_count(env: Env) -> u32 {
        env.storage().instance().get(&TIPS).unwrap_or(0)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn tips_accumulate() {
        let env = Env::default();
        let id = env.register(TipJarContract, ());
        let client = TipJarContractClient::new(&env, &id);

        assert_eq!(client.get_total(), 0);
        assert_eq!(client.tip(&5), 5);
        assert_eq!(client.tip(&10), 15);
        assert_eq!(client.get_tip_count(), 2);
    }
}
