#![no_std]

use soroban_sdk::{contract, contractimpl, Env, Symbol, symbol_short};

const POOL: Symbol = symbol_short!("POOL");
const MEMBERS: Symbol = symbol_short!("MBRS");

#[contract]
pub struct SavingsCircleContract;

#[contractimpl]
impl SavingsCircleContract {
    /// Contribute to the community savings pool (demo units).
    pub fn contribute(env: Env, amount: u32) -> u32 {
        if amount == 0 {
            return env.storage().instance().get(&POOL).unwrap_or(0);
        }
        let current: u32 = env.storage().instance().get(&POOL).unwrap_or(0);
        let members: u32 = env.storage().instance().get(&MEMBERS).unwrap_or(0);
        let next = current.saturating_add(amount);
        env.storage().instance().set(&POOL, &next);
        env.storage().instance().set(&MEMBERS, &(members + 1));
        env.storage().instance().extend_ttl(50, 100);
        next
    }

    pub fn get_total(env: Env) -> u32 {
        env.storage().instance().get(&POOL).unwrap_or(0)
    }

    pub fn get_contribution_count(env: Env) -> u32 {
        env.storage().instance().get(&MEMBERS).unwrap_or(0)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn pool_grows_with_contributions() {
        let env = Env::default();
        let id = env.register(SavingsCircleContract, ());
        let client = SavingsCircleContractClient::new(&env, &id);

        assert_eq!(client.get_total(), 0);
        assert_eq!(client.contribute(&20), 20);
        assert_eq!(client.contribute(&30), 50);
        assert_eq!(client.get_contribution_count(), 2);
    }
}
