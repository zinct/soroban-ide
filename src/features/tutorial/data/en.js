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
};
