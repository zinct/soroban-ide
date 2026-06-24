#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Env, Symbol, symbol_short};

const BILL: Symbol = symbol_short!("BILL");
const PAID: Symbol = symbol_short!("PAID");

#[contracttype]
#[derive(Clone)]
pub struct SplitStatus {
    pub bill_total: u32,
    pub paid_total: u32,
}

#[contract]
pub struct InvoiceSplitContract;

#[contractimpl]
impl InvoiceSplitContract {
    /// Set the bill total to split among roommates.
    pub fn set_bill(env: Env, total: u32) -> u32 {
        env.storage().instance().set(&BILL, &total);
        env.storage().instance().extend_ttl(50, 100);
        total
    }

    /// Record a share payment toward the bill.
    pub fn pay_share(env: Env, amount: u32) -> u32 {
        if amount == 0 {
            return env.storage().instance().get(&PAID).unwrap_or(0);
        }
        let current: u32 = env.storage().instance().get(&PAID).unwrap_or(0);
        let next = current.saturating_add(amount);
        env.storage().instance().set(&PAID, &next);
        env.storage().instance().extend_ttl(50, 100);
        next
    }

    pub fn get_status(env: Env) -> SplitStatus {
        SplitStatus {
            bill_total: env.storage().instance().get(&BILL).unwrap_or(0),
            paid_total: env.storage().instance().get(&PAID).unwrap_or(0),
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn split_bill_flow() {
        let env = Env::default();
        let id = env.register(InvoiceSplitContract, ());
        let client = InvoiceSplitContractClient::new(&env, &id);

        assert_eq!(client.set_bill(&120), 120);
        assert_eq!(client.pay_share(&40), 40);
        assert_eq!(client.pay_share(&40), 80);
        let status = client.get_status();
        assert_eq!(status.bill_total, 120);
        assert_eq!(status.paid_total, 80);
    }
}
