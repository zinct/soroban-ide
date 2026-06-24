#![no_std]

use soroban_sdk::{contract, contractimpl, Env, Symbol, symbol_short};

const TOTAL: Symbol = symbol_short!("TOTAL");
const DONORS: Symbol = symbol_short!("DNRS");

#[contract]
pub struct DonationVaultContract;

#[contractimpl]
impl DonationVaultContract {
    /// Record a donation (demo units). Returns the new public total.
    pub fn donate(env: Env, amount: u32) -> u32 {
        if amount == 0 {
            return env.storage().instance().get(&TOTAL).unwrap_or(0);
        }
        let current: u32 = env.storage().instance().get(&TOTAL).unwrap_or(0);
        let donors: u32 = env.storage().instance().get(&DONORS).unwrap_or(0);
        let next = current.saturating_add(amount);
        env.storage().instance().set(&TOTAL, &next);
        env.storage().instance().set(&DONORS, &(donors + 1));
        env.storage().instance().extend_ttl(50, 100);
        next
    }

    pub fn get_total(env: Env) -> u32 {
        env.storage().instance().get(&TOTAL).unwrap_or(0)
    }

    pub fn get_donor_count(env: Env) -> u32 {
        env.storage().instance().get(&DONORS).unwrap_or(0)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn donations_track_totals() {
        let env = Env::default();
        let id = env.register(DonationVaultContract, ());
        let client = DonationVaultContractClient::new(&env, &id);

        assert_eq!(client.get_total(), 0);
        assert_eq!(client.donate(&25), 25);
        assert_eq!(client.donate(&75), 100);
        assert_eq!(client.get_donor_count(), 2);
    }
}
