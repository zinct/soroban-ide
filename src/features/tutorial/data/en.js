export const en = {
  soroban: {
    title: "Get to know Soroban 👋",
    intro: "So, simply put, Soroban is a next-generation smart contract platform built on the Stellar network. If you want to build fast and secure dApps, this is the place!",
    sections: [
      {
        sub: "Why Soroban?",
        text: "Stellar used to focus purely on payments, but with Soroban, it's become much more powerful. It's designed to handle complex logic without slowing down the network.",
      },
      {
        sub: "Technical Deep Dive (The Nerdy Stuff)",
        text: "For the developers out there, here's why Soroban is amazing:",
        list: ["**Powered by Rust:** Soroban doesn't use obscure languages. It uses **Rust**, a language famous for its memory safety and speed.", "**Wasm Runtime:** All your code compiles to **WebAssembly (Wasm)**. This means your smart contracts run with maximum performance inside a secure sandbox.", "**Conflict-Free:** Soroban features a smart concurrency system. If transactions don't interfere with each other, they can run in parallel—no more waiting in line.", "**No State Bloat:** Unlike other blockchains that get heavier over time, Soroban uses a novel state archival solution to keep the ledger slim and fast."],
      },
      {
        sub: "Native Integration",
        text: "This is the big one: Soroban is **native** to Stellar. No clunky bridges or extra layers needed. Your contracts get instant, seamless access to Stellar's assets.",
      },
    ],
    note: "In short: Soroban is the perfect mix of Stellar's speed and Rust's programmability.",
    links: [
      { label: "Soroban Official Docs", url: "https://developers.stellar.org/docs/build/smart-contracts/overview" },
      { label: "Stellar Developer Foundation", url: "https://stellar.org" },
    ],
  },
  variable: {
    title: "Variables and Type System",
    intro: "Rust is a strongly typed language. This ensures memory safety and high performance for your smart contracts.",
    sections: [
      {
        sub: "Variables (let vs let mut)",
        text: "By default, variables in Rust are immutable. Use the `mut` keyword to create a variable that can be changed.",
        code: `let x = 5; // Immutable
let mut y = 10; // Mutable
y = 15;`,
      },
      {
        sub: "Numeric Types (Integers)",
        text: "Soroban supports various integer sizes based on your precision and memory needs:",
        list: ["**u32 / i32:** 32-bit integers (u = unsigned/positive, i = signed/both).", "**u64 / i64:** 64-bit integers, commonly used for token amounts or IDs.", "**u128 / i128:** Used when you need massive numbers (like total token supply)."],
      },
      {
        sub: "Soroban Specific Types",
        text: "Besides standard Rust types, Soroban provides specialized types for blockchain interaction:",
        list: ["**Symbol:** A short string (max 32 chars) efficient for labels or function IDs.", "**Address:** Represents a Stellar account or contract address.", "**bool:** Standard boolean (`true` or `false`)."],
        code: `let owner: Address = env.current_contract_address();
let status: Symbol = Symbol::new(&env, "active");
let is_ready: bool = true;`,
      },
      {
        sub: "Data Collections (Vec & Map)",
        text: "Soroban provides optimized collections for ledger storage:",
        list: ["**Vec:** An ordered collection (like an array/list).", "**Map:** A key-value pair collection."],
        code: `let mut list: Vec<u32> = Vec::new(&env);
list.push_back(100);`,
      },
    ],
    note: "Choosing the right data type is crucial for saving transaction gas fees on the Stellar network.",
  },
  studio: {
    title: "Soroban Studio: Web-Based IDE",
    intro: "Soroban Studio is a cloud-based IDE designed to simplify your development workflow. Start building without complex local environment setups.",
    sections: [
      {
        sub: "What is Soroban Studio?",
        text: "We provide optimized tools for the Stellar ecosystem. Write code, compile contracts, and simulate transactions—all directly in your browser.",
      },
      {
        sub: "Key Features",
        text: "Designed for developer productivity:",
        list: ["**Advanced Code Editor:** Lightweight but powerful with Rust autocomplete and syntax highlighting.", "**Integrated Terminal:** Direct access to `stellar` and `cargo` commands. Building happens on high-speed servers.", "**One-Click Deployment:** Easily deploy to Testnet without manual RPC configuration.", "**GitHub Integration:** Sync and manage your source code via GitHub repositories."],
      },
      {
        sub: "Development Efficiency",
        text: "Setting up Rust can be a hurdle. Soroban Studio eliminates this so you can focus on what matters: **your contract logic.**",
      },
    ],
    note: "Build on Stellar with maximum efficiency through Soroban Studio.",
    links: [
      { label: "Soroban Studio Home", url: "https://soroban.studio" },
      { label: "GitHub Repository", url: "https://github.com/zinct/soroban-ide" },
    ],
  },
  contract: {
    title: "Soroban Smart Contract Anatomy",
    intro: "Developing smart contracts in Soroban requires understanding the basic structure of Rust code optimized for blockchain. Here are the core components.",
    sections: [
      {
        sub: "1. Environment & SDK Declaration",
        text: "Every Soroban contract starts with environment configuration for efficiency:",
        code: "#![no_std]\nuse soroban_sdk::{contract, contractimpl, Env};",
        list: ["**#![no_std]:** Tells Rust not to use the standard library, keeping the Wasm binary small and efficient.", "**soroban_sdk:** Core macros and types from the official Stellar SDK."],
      },
      {
        sub: "2. Contract Structure",
        text: "Define your contract's identity using a struct:",
        code: "#[contract]\npub struct NotesContract;",
        list: ["**#[contract]:** Marks the struct as the main entry point for your smart contract.", "**NotesContract:** The name of your contract, used during deployment and interaction."],
      },
      {
        sub: "3. Logic Implementation",
        text: "The implementation block is where business logic and public functions live:",
        code: "#[contractimpl]\nimpl NotesContract {\n    pub fn hello(env: Env, to: Symbol) -> Vec<Symbol> {\n        // Your logic here\n    }\n}",
        list: ["**#[contractimpl]:** Exports functions inside this block so users or other contracts can call them.", "**Env:** The environment object providing access to blockchain features like storage and logging."],
      },
    ],
    note: "Ensure all public functions are inside an implementation block marked with #[contractimpl].",
  },
  structure: {
    title: "Understanding Soroban Project Structure",
    intro: "Knowing your folders and files is fundamental to effectively managing your projects in Soroban Studio.",
    sections: [
      {
        sub: "Main Directories",
        text: "Typical Soroban projects have three main directories:",
        list: ["**contracts/**: Contains your Rust smart contract source code.", "**frontend/**: Optional directory for your web UI code.", "**target/**: Generated automatically during compilation; contains build binaries."],
      },
      {
        sub: "Key Config Files",
        text: "Critical files in your project:",
        list: ["**Cargo.toml:** Rust's manifest file defining dependencies and project info.", "**.gitignore:** Tells Git which files to ignore (like the `target` directory).", "**README.md:** Standard documentation describing the project goals."],
      },
    ],
    note: "Always keep your contract source code inside the 'contracts' directory for successful compilation.",
  },
  struct: {
    title: "Managing Complex Data with Structs",
    intro: "In smart contracts, we often group related info into a single logical entity. In Rust, we use **Structs**.",
    sections: [
      {
        sub: "The Struct Concept",
        text: "A Struct is a custom data type that lets you store multiple related values in one object, similar to 'Classes' or 'Objects' in other languages.",
        list: ["**Object Representation:** Used for entities like `User`, `Note`, or `Student`.", "**Fields:** Individual data points stored inside the Struct.", "**Data Organization:** Makes complex data management cleaner and more readable."],
      },
      {
        sub: "Implementation in Soroban",
        text: "To use Structs in Soroban, we add specific attributes for ledger storage:",
        code: "#[contracttype]\n#[derive(Clone, Debug)]\npub struct Note {\n    pub id: u64,\n    pub title: String,\n    pub content: String,\n}",
        list: ["**#[contracttype]:** Crucial attribute that allows the Struct to be used in function inputs/outputs and saved to blockchain storage.", "**#[derive(Clone, Debug)]:** Rust traits allowing objects to be cloned and printed for debugging.", "**Field Types:** In this example, we use `u64` for a unique ID and `String` for text content."],
      },
    ],
    note: "Use Structs whenever you have a set of related data to keep your code modular.",
  },
  function: {
    title: "Implementing Contract Functions",
    intro: "Functions are the heart of your business logic. Through them, users interact with the contract to perform actions or read data from the ledger.",
    sections: [
      {
        sub: "Role of Functions",
        text: "Functions bridge the user and the contract code. Key characteristics:",
        list: ["**Action Execution:** Logic for calculations or asset management.", "**User Interaction:** Users call public functions to interact with the contract.", "**Data Access:** Used for both reading and writing to the blockchain storage."],
      },
      {
        sub: "Parameters as User Input",
        text: "Parameters are the entry point for data provided by the user:",
        list: ["**Input Definition:** Each parameter (besides `env`) represents data the user must provide.", "**Type Safety:** Rust ensures inputs match your defined types (e.g., `u64` for numbers), preventing invalid data errors.", "**Auto Interface:** In Soroban Studio, these parameters automatically appear as input fields in the interaction UI."],
      },
      {
        sub: "Function Syntax Anatomy",
        text: "Correct syntax for inputs and return values is vital for communication:",
        code: `pub fn create_note(env: Env, id: u64, title: String) -> String {
    // 'id' and 'title' are Inputs
    
    // '->' indicates the Return value
    return String::from_str(&env, "Note added successfully");
}`,
        list: ["**Parameters (Input):** Written inside `()`. You must specify the name and type (e.g., `title: String`).", "**The `->` Symbol:** Marks the return value type.", "**`return` Keyword:** Sends data back to the function caller."],
      },
      {
        sub: "Structure and Implementation",
        text: "All public functions must be inside an implementation block marked with `#[contractimpl]`:",
        code: `#[contractimpl]
impl NotesContract {
    pub fn get_notes(env: Env) -> Vec<Note> { ... }
    pub fn create_note(env: Env, title: String, content: String) -> String { ... }
    pub fn delete_note(env: Env, id: u64) -> String { ... }
}`,
        list: ["**Env (Environment):** Always include `env` to access features like storage, logging, and block info.", "**Visibility:** The `pub` keyword ensures the function is accessible from outside the contract.", "**Return Types:** Functions can return collections (`Vec`), custom types (`Note`), or status strings."],
      },
    ],
    note: "Design your functions modularly with specific responsibilities for better contract security.",
  },
  storage: {
    title: "Persistent Data Management",
    intro: "Unlike regular variables, **Storage** is used to save data permanently on the Stellar blockchain. It's how your contract 'remembers' info across transactions.",
    sections: [
      {
        sub: "Key-Value Storage Concept",
        text: "Soroban uses a key-value model. Imagine storage as a giant filing cabinet where every piece of data has a specific label (key).",
        list: ["**Key:** A unique label (often a `Symbol`).", "**Value:** The data itself (numbers, strings, or complex Structs).", "**Access:** Accessed via the `env.storage()` object."],
      },
      {
        sub: "Core Operations: Get and Set",
        text: "The two primary operations you'll use for storage:",
        list: ["**Set:** Creates or updates existing data.", "**Get:** Retrieves data by its key. Usually returns an `Option`, so you must handle empty cases."],
        code: `// Simple read and write
let KEY = Symbol::new(&env, "SCORE");
env.storage().instance().set(&KEY, &100); // Set
let score: u32 = env.storage().instance().get(&KEY).unwrap_or(0); // Get`,
      },
      {
        sub: "Complete Logic Example",
        text: "How to combine Structs and Storage to build a persistent notes list:",
        code: `const NOTE_KEY: Symbol = Symbol::new(&env, "NOTE_DATA");

#[contractimpl]
impl NotesContract {
    pub fn create_note(env: Env, title: String, content: String) {
        // 1. Get existing list or create empty if new
        let mut notes: Vec<Note> = env.storage().instance()
            .get(&NOTE_KEY)
            .unwrap_or(Vec::new(&env));

        // 2. Create new Note object
        let new_note = Note {
            id: (notes.len() as u64) + 1,
            title,
            content,
        };

        // 3. Push to list
        notes.push_back(new_note);

        // 4. Save updated list back to storage
        env.storage().instance().set(&NOTE_KEY, &notes);
    }

    pub fn get_all_notes(env: Env) -> Vec<Note> {
        env.storage().instance()
            .get(&NOTE_KEY)
            .unwrap_or(Vec::new(&env))
    }
}`,
        list: ["**instance():** We use 'instance' storage, meaning data is tied permanently to this contract instance.", "**unwrap_or():** Safely provides a default value (like an empty list) if no data was saved yet.", "**Persistence:** Once `create_note` finishes, data is safely on the blockchain for future access."],
      },
    ],
    note: "Storing data on the blockchain incurs fees. Be efficient and only store what's necessary.",
  },
  wallet: {
    title: "Managing Digital Identity with Wallets",
    intro: "A wallet is a fundamental component of the blockchain ecosystem. It acts as both your digital asset vault and your unique identity on the Stellar network.",
    sections: [
      {
        sub: "What is a Stellar Wallet?",
        text: "On Stellar, a wallet is the tool you use to digitally sign transactions. Each wallet has a public address used as your identity.",
        list: ["**Login & Interact:** Use it to log into Web3 apps and approve contract function calls.", "**Blockchain Identity:** Your address is a public representative of your identity across the Stellar network."],
      },
      {
        sub: "Creation Methods",
        text: "Two primary ways to manage wallets on Stellar:",
        list: ["**Browser Extension (Freighter):** The fastest and most user-friendly way for interaction.", "**Terminal / CLI:** Preferred by developers for local account management via the command line."],
      },
      {
        sub: "Installing Freighter Wallet",
        text: "Freighter is the secure standard browser extension for the Stellar network. Available for Chrome, Firefox, and Brave.",
        image: "/tutorials/freighter.png",
        links: [{ label: "Download Freighter Wallet", url: "https://www.freighter.app/" }],
      },
      {
        sub: "CLI for Developers",
        text: "For managing identity directly from the terminal, the Soroban CLI provides handy commands:",
        codeLang: "sh",
        code: `# Generate a new 'alice' account on testnet
stellar keys generate --network testnet alice

# List your local accounts
stellar keys ls`,
        list: ["**stellar keys generate:** Automatically creates a public/private keypair and registers it on testnet.", "**Local Storage:** Accounts created via terminal are stored privately in your local development environment."],
      },
    ],
    note: "Never share your 'Secret Key' or 'Seed Phrase'. Anyone with access has full control over your assets.",
    links: [
      { label: "Download Freighter Wallet", url: "https://www.freighter.app/" },
      { label: "Freighter Documentation", url: "https://docs.freighter.app/" }
    ]
  },
  deploy: {
    title: "Contract Deployment to Testnet",
    intro: "The final step in the workflow is publishing your smart contract to the blockchain. We use **Testnet**, a free testing environment for developers.",
    sections: [
      {
        sub: "1. Prepare Wallet & Funds",
        text: "Before deploying, you need a wallet with a XLM balance on Testnet to pay for transaction fees.",
        codeLang: "sh",
        code: "stellar keys generate alice --network testnet --fund",
        list: ["**--fund:** Crucial parameter that automatically requests free test XLM from Stellar's Friendbot service.", "**alice:** Replace this with your desired local alias for the wallet."],
      },
      {
        sub: "2. Build Your Contract",
        text: "Ensure your code is error-free, then compile the Rust code into a WebAssembly (Wasm) binary.",
        codeLang: "sh",
        code: "stellar contract build",
        list: ["**Target:** The compiled `.wasm` file will be stored in `target/wasm32-unknown-unknown/release/`."],
      },
      {
        sub: "3. Deploy to the Network",
        text: "Use this command to send your Wasm binary to the Stellar Testnet:",
        codeLang: "sh",
        code: "stellar contract deploy --source-account alice --network testnet",
        list: ["**Contract ID:** On success, the terminal will display your unique Contract ID. Save this for future interaction."],
      },
      {
        sub: "Interacting via Stellar Laboratory",
        text: "Stellar Laboratory (Lab) is the official web tool for interacting with your contracts without extra code.",
        list: ["**Simulate:** Used for 'dry runs'. It returns the result of the function call without changing blockchain data or costing gas fees.", "**Simulate & Submit:** Use this for real changes (e.g., saving data). The Lab will simulate first, then submit the transaction to the network after your approval."],
      },
    ],
    note: "Any interaction that changes ledger data (Submit) requires a small XLM fee.",
  },
  errors: {
    title: "Error Handling in Smart Contracts",
    intro: "Production contracts need to handle failure cleanly. Soroban lets you return typed errors that callers can inspect, instead of crashing with panic!.",
    sections: [
      {
        sub: "panic! vs structured errors",
        text: "You can bail out of any contract function with `panic!`, but callers only see a generic 'contract trapped' message. Structured errors via `#[contracterror]` expose a specific code the caller can match on.",
      },
      {
        sub: "Defining a contract error enum",
        text: "Declare an error type with `#[contracterror]`. Give each variant a `u32` code — these are stable identifiers encoded into the transaction result.",
        code: `#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotFound = 1,
    AlreadyExists = 2,
    Unauthorized = 3,
}`,
        list: [
          "**#[contracterror]:** Makes this enum usable as the error half of `Result<T, Error>`.",
          "**#[repr(u32)]:** Error codes are always `u32`. Keep them stable — external clients may match on them.",
          "**Derived traits:** Copy/Clone/Eq/Ord are required so Soroban can serialize and compare error values.",
        ],
      },
      {
        sub: "Returning Result from contract functions",
        text: "Any function can return `Result<T, Error>` instead of `T`. Soroban surfaces the error code to the caller, along with any events emitted before the failure.",
        code: `#[contractimpl]
impl NotesContract {
    pub fn get_note(env: Env, id: u64) -> Result<Note, Error> {
        let notes: Vec<Note> = env.storage().instance()
            .get(&NOTE_KEY)
            .unwrap_or(Vec::new(&env));

        notes.iter()
            .find(|n| n.id == id)
            .ok_or(Error::NotFound)
    }
}`,
        list: [
          "**ok_or:** Converts `Option<T>` into `Result<T, Error>` with a specific error variant.",
          "**The ? operator:** Propagates errors up the call stack without boilerplate.",
        ],
      },
      {
        sub: "When to panic!",
        text: "Reserve `panic!` for programmer errors that should never occur at runtime (e.g., 'state is corrupted'). For any condition a caller might legitimately trigger — missing data, unauthorized caller, bad input — return a typed error.",
        code: `// Don't: callers get a generic trap with no context
let amount: u32 = env.storage().instance().get(&KEY).unwrap();

// Do: callers get Error::NotFound and can retry / show UI
let amount: u32 = env.storage().instance()
    .get(&KEY)
    .ok_or(Error::NotFound)?;`,
      },
    ],
    note: "Structured errors are the difference between a dApp that can show 'insufficient balance' to the user and one that just says 'transaction failed'.",
    links: [
      { label: "Errors — Stellar Docs", url: "https://developers.stellar.org/docs/build/smart-contracts/example-contracts/errors" },
    ],
  },
  auth: {
    title: "Authorization with require_auth",
    intro: "Soroban contracts don't trust their callers by default. If a function should only succeed when a specific account has consented, call `require_auth` — and Soroban handles signature verification for you.",
    sections: [
      {
        sub: "Why authorization is explicit",
        text: "Unlike a web backend that knows who's logged in, a smart contract only knows which account invoked it — and that account might be acting on behalf of someone else. `require_auth` makes consent a first-class concept in your contract.",
      },
      {
        sub: "The basic pattern: require_auth on an Address",
        text: "Call `require_auth` on whichever `Address` must consent to the call. The network will refuse to run your function unless the signature is valid.",
        code: `pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
    from.require_auth();

    // ...update balances
}`,
        list: [
          "**from.require_auth():** The 'from' account must sign the transaction for this to succeed.",
          "**No manual crypto:** Soroban verifies the signature automatically. You never touch private keys.",
        ],
      },
      {
        sub: "Scoping consent with require_auth_for_args",
        text: "Sometimes you want to sign for 'any call to this function'; other times only for specific parameter values. Use `require_auth_for_args` when the signer is consenting to particular arguments, not arbitrary ones.",
        code: `pub fn spend(env: Env, from: Address, amount: i128, memo: Symbol) {
    // Signer approves spending exactly this amount with this memo.
    from.require_auth_for_args((amount, memo).into_val(&env));

    // ...transfer logic
}`,
      },
      {
        sub: "Testing auth with mock_all_auths",
        text: "In unit tests you don't have real signers. Enable auto-approval so your tests can run any invocation without generating signatures.",
        code: `#[test]
fn test_transfer() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TokenContract, ());
    let client = TokenContractClient::new(&env, &contract_id);

    client.transfer(&alice, &bob, &100);
}`,
        list: [
          "**mock_all_auths:** Treats every `require_auth` in the env as satisfied.",
          "**mock_auths:** A stricter variant — only explicitly-listed (signer, function, args) tuples pass.",
        ],
      },
    ],
    note: "If a function touches anyone's balance, identity, or permissions — start with `require_auth`. It's the single most important line for contract safety.",
    links: [
      { label: "Authorization — Stellar Docs", url: "https://developers.stellar.org/docs/build/smart-contracts/example-contracts/auth" },
    ],
  },
  events: {
    title: "Events and Logs",
    intro: "Contracts don't push data to the frontend directly — transactions only return a single result value. To broadcast rich updates (balance changed, note added, transfer happened), contracts emit events that indexers, wallets, and frontends subscribe to.",
    sections: [
      {
        sub: "log! — for debugging",
        text: "Use `log!` to trace values during simulation and tests. Log output is visible in `stellar contract invoke --verbose` and in test output.",
        code: `let balance: i128 = env.storage().persistent()
    .get(&from)
    .unwrap_or(0);

log!(&env, "balance for {}: {}", from, balance);`,
      },
      {
        sub: "events().publish — for state changes",
        text: "Events are your contract's public output stream. Each event has a `topics` tuple (for filtering) and a `data` payload.",
        code: `env.events().publish(
    (symbol_short!("note"), symbol_short!("created"), author.clone()),
    note_id,
);`,
        list: [
          "**Topics (1st arg):** Up to 4 values used by listeners to filter. Convention: `[resource, action, principal]`.",
          "**Data (2nd arg):** The payload — any contract-serializable type (`Symbol`, `u64`, `Struct`, `Vec`, ...).",
          "**Clone addresses:** Events take ownership of topic values; use `.clone()` if you still need them after publishing.",
        ],
      },
      {
        sub: "Pattern: write then emit",
        text: "Emit an event after you've successfully mutated storage. If the mutation fails and the transaction reverts, the event is automatically dropped — listeners never see events for transactions that didn't commit.",
        code: `pub fn create_note(env: Env, author: Address, content: String) -> u64 {
    author.require_auth();

    let mut notes: Vec<Note> = env.storage().instance()
        .get(&NOTES_KEY)
        .unwrap_or(Vec::new(&env));

    let id = notes.len() as u64 + 1;
    notes.push_back(Note { id, author: author.clone(), content });
    env.storage().instance().set(&NOTES_KEY, &notes);

    env.events().publish(
        (symbol_short!("note"), symbol_short!("created")),
        id,
    );

    id
}`,
      },
      {
        sub: "Consuming events from the frontend",
        text: "Frontends use the Stellar RPC server's `getEvents` endpoint to subscribe. Filter by contract ID + topic to get just the events you care about.",
        codeLang: "sh",
        code: `stellar events \\
  --start-ledger 100 \\
  --contract-id CABCD... \\
  --topic-filter note,created`,
      },
    ],
    note: "Events are the bridge between contract state and user-facing UI. Design them the way you'd design REST endpoints: stable names, useful payloads.",
    links: [
      { label: "Events — Stellar Docs", url: "https://developers.stellar.org/docs/build/smart-contracts/example-contracts/events" },
    ],
  },
  crosscontract: {
    title: "Cross-Contract Calls",
    intro: "Composability is a superpower of smart contracts: your contract can call another contract as if it were a local function. Soroban makes this ergonomic and type-safe.",
    sections: [
      {
        sub: "Two ways to call another contract",
        text: "You can either use a generated `Client` type (type-safe, recommended) or raw `env.invoke_contract` (for dynamic targets).",
        list: [
          "**Generated Client:** Compile-time checked, autocompletes in the IDE, reads like a normal function call.",
          "**env.invoke_contract:** Useful when the target address is only known at runtime and you don't have the WASM at build time.",
        ],
      },
      {
        sub: "Calling with a generated client",
        text: "When you have the target contract's WASM available, use `contractimport!` to generate a strongly-typed client.",
        code: `mod token {
    soroban_sdk::contractimport!(
        file = "../token/target/wasm32-unknown-unknown/release/token.wasm",
    );
}

#[contractimpl]
impl SwapContract {
    pub fn deposit(env: Env, token_id: Address, from: Address, amount: i128) {
        from.require_auth();

        let client = token::Client::new(&env, &token_id);
        client.transfer(&from, &env.current_contract_address(), &amount);
    }
}`,
        list: [
          "**contractimport!:** Reads the target WASM at build time and generates a `Client` type matching its interface.",
          "**token::Client::new:** Binds the client to a specific on-chain address within the current `Env`.",
          "**Type safety:** `transfer`'s parameter types come from the token contract; you can't pass the wrong types.",
        ],
      },
      {
        sub: "Calling with env.invoke_contract",
        text: "When you don't have the target WASM (dynamic routing, plugin pattern), call it raw. You must hand-encode the arguments and know the return type.",
        code: `use soroban_sdk::IntoVal;

let result: i128 = env.invoke_contract(
    &token_id,
    &symbol_short!("balance"),
    (account,).into_val(&env),
);`,
        list: [
          "**Target:** An `Address` of an already-deployed contract.",
          "**Function name:** A `Symbol` identifying which function to call.",
          "**Arguments:** A tuple converted into the contract `Val` representation with `into_val`.",
        ],
      },
      {
        sub: "Authorization across calls",
        text: "When contract A calls contract B, B sees A as its caller — not the original user. If B needs the original user's signature (e.g. a token transfer), the user's `Address` must be passed through and re-auth'd. Soroban's auth framework supports this automatically via sub-authorizations.",
      },
    ],
    note: "Prefer generated clients whenever possible — they move bugs from runtime to compile time.",
    links: [
      { label: "Cross-Contract Calls — Stellar Docs", url: "https://developers.stellar.org/docs/build/smart-contracts/example-contracts/cross-contract-call" },
    ],
  },
  increment: {
    title: "Example: Counter Contract (Storage + TTL)",
    intro: "A complete walkthrough of a minimal counter contract. You'll see every piece of the storage lifecycle in one place: reading an entry with a default, writing it back, and extending its TTL so it doesn't get archived.",
    sections: [
      {
        sub: "The full contract",
        text: "This single file is a complete, deployable Soroban contract. It stores a `u32` counter under a `Symbol` key in Instance storage.",
        code: `#![no_std]
use soroban_sdk::{contract, contractimpl, log, symbol_short, Env, Symbol};

const COUNTER: Symbol = symbol_short!("COUNTER");

#[contract]
pub struct IncrementContract;

#[contractimpl]
impl IncrementContract {
    pub fn increment(env: Env) -> u32 {
        let mut count: u32 = env.storage().instance()
            .get(&COUNTER)
            .unwrap_or(0);

        log!(&env, "count: {}", count);

        count += 1;
        env.storage().instance().set(&COUNTER, &count);
        env.storage().instance().extend_ttl(50, 100);

        count
    }
}`,
      },
      {
        sub: "Symbol keys with symbol_short!",
        text: "Every storage entry is addressed by a key. For short, stable identifiers, use `symbol_short!` — it computes the `Symbol` at compile time with zero runtime cost.",
        code: `const COUNTER: Symbol = symbol_short!("COUNTER");`,
        list: [
          "**Symbol:** A short string (up to 32 chars, `a-zA-Z0-9_` only). Cheap to store and compare.",
          "**symbol_short!:** For symbols up to 9 characters — computed at compile time.",
          "**Symbol::new(&env, \"name\"):** For longer symbols or those built at runtime.",
        ],
      },
      {
        sub: "Reading storage with a default",
        text: "`get()` returns `Option<T>`. Pair it with `unwrap_or(default)` so the first call to the contract (before anything is stored) returns a sensible value instead of panicking.",
        code: `let mut count: u32 = env.storage().instance()
    .get(&COUNTER)
    .unwrap_or(0);`,
        list: [
          "**storage().instance():** Instance storage — data tied to the contract's lifetime.",
          "**unwrap_or(0):** First-time-access safety. Never assume keys exist.",
          "**Type inference:** The target type (`u32`) tells Soroban how to decode the stored value.",
        ],
      },
      {
        sub: "Writing and extending TTL",
        text: "Every storage entry on Soroban has a Time-To-Live. If its TTL expires, the entry is archived and must be restored (at a cost) before it can be read again. Call `extend_ttl` on every write to keep hot entries fresh.",
        code: `env.storage().instance().set(&COUNTER, &count);
env.storage().instance().extend_ttl(50, 100);`,
        list: [
          "**set(&key, &value):** Writes the new value, replacing any existing entry.",
          "**extend_ttl(threshold, extend_to):** If remaining TTL is less than `threshold` ledgers, extend to `extend_to` ledgers. Testnet ledgers close every ~5s, so 100 ≈ 500 seconds.",
          "**Three storage kinds:** Persistent (long-lived user data), Temporary (cheap, short-lived), Instance (lifetime of the contract itself).",
        ],
      },
      {
        sub: "log! for debugging",
        text: "`log!` writes to the contract's diagnostic log — visible during simulation, in `invoke --verbose`, and in tests. It's free in production execution and doesn't count as an event.",
        code: `log!(&env, "count: {}", count);`,
      },
      {
        sub: "Writing a unit test",
        text: "Soroban tests run in-memory with a mock `Env`. The generated `<Contract>Client` type gives you a typed, ergonomic way to call your functions.",
        code: `#[test]
fn test() {
    let env = Env::default();
    let contract_id = env.register(IncrementContract, ());
    let client = IncrementContractClient::new(&env, &contract_id);

    assert_eq!(client.increment(), 1);
    assert_eq!(client.increment(), 2);
    assert_eq!(client.increment(), 3);
}`,
        list: [
          "**Env::default():** A fresh simulated Soroban environment — sandboxed, fast, no network.",
          "**env.register:** Deploys the contract to the mock env. Returns its `Address`.",
          "**<Contract>Client:** Auto-generated by `#[contractimpl]` — one method per `pub fn`.",
        ],
      },
      {
        sub: "Building, deploying, invoking",
        text: "When you're ready to take the contract off your machine:",
        codeLang: "sh",
        code: `# 1. Compile to WASM
stellar contract build

# 2. Deploy to testnet
stellar contract deploy \\
  --wasm target/wasm32v1-none/release/soroban_increment_contract.wasm \\
  --alias increment_example \\
  --source-account alice \\
  --network testnet

# 3. Invoke the function
stellar contract invoke \\
  --id increment_example \\
  --source-account alice \\
  --network testnet \\
  -- \\
  increment`,
        list: [
          "**--alias:** Give the deployed contract a local nickname so future commands don't need the full ID.",
          "**-- increment:** Everything before `--` are CLI flags; everything after is passed to the contract's function.",
          "**First-time setup:** If `alice` is new, run `stellar keys generate alice --network testnet --fund` first.",
        ],
      },
    ],
    note: "This tiny contract touches every storage primitive you'll use in production: Symbol keys, Option-safe reads, writes, TTL management, logging, and tests.",
    links: [
      { label: "Source (soroban-examples)", url: "https://github.com/stellar/soroban-examples/tree/v23.0.0/increment" },
      { label: "State Archival — Stellar Docs", url: "https://developers.stellar.org/docs/build/smart-contracts/example-contracts/state-archival" },
    ],
  },
};
