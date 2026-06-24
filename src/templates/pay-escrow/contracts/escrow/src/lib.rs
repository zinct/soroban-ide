#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Env, Symbol, symbol_short};

const FUNDED: Symbol = symbol_short!("FUNDED");
// u32 flag (0/1) — avoid legacy bool storage under older keys
const RELEASED: Symbol = symbol_short!("ISRLS");

#[contracttype]
#[derive(Clone)]
pub struct EscrowStatus {
    pub funded: u32,
    pub released: bool,
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    fn is_released(env: &Env) -> bool {
        env.storage().instance().get(&RELEASED).unwrap_or(0u32) != 0
    }

    /// Add funds to the escrow (demo units — wire USDC in production).
    pub fn fund(env: Env, amount: u32) -> u32 {
        let current: u32 = env.storage().instance().get(&FUNDED).unwrap_or(0);
        if amount == 0 || Self::is_released(&env) {
            return current;
        }
        let next = current.saturating_add(amount);
        env.storage().instance().set(&FUNDED, &next);
        env.storage().instance().extend_ttl(50, 100);
        next
    }

    /// Mark escrow as released and return the funded total.
    pub fn release(env: Env) -> u32 {
        let funded: u32 = env.storage().instance().get(&FUNDED).unwrap_or(0);
        if !Self::is_released(&env) {
            env.storage().instance().set(&RELEASED, &1u32);
            env.storage().instance().extend_ttl(50, 100);
        }
        funded
    }

    /// Read escrow state (free simulation).
    pub fn get(env: Env) -> EscrowStatus {
        EscrowStatus {
            funded: env.storage().instance().get(&FUNDED).unwrap_or(0),
            released: Self::is_released(&env),
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn escrow_flow() {
        let env = Env::default();
        let id = env.register(EscrowContract, ());
        let client = EscrowContractClient::new(&env, &id);

        assert_eq!(client.get().funded, 0);
        assert_eq!(client.fund(&100), 100);
        assert_eq!(client.fund(&50), 150);
        assert_eq!(client.release(), 150);
        assert!(client.get().released);
        assert_eq!(client.fund(&10), 150);
    }
}
