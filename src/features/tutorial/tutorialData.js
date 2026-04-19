export const tutorialData = {
  en: {
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
  },
  id: {
    soroban: {
      title: "Mengenal Soroban: Platform Smart Contract Stellar",
      intro: "Soroban adalah platform smart contract berperforma tinggi yang dirancang untuk memperluas kapabilitas Stellar sebagai jaringan pembayaran tanpa batas. Platform ini memungkinkan pengembang membangun aplikasi terdesentralisasi (dApps) yang aman, efisien, dan skalabel.",
      sections: [
        {
          sub: "Mengapa Memilih Soroban?",
          text: "Stellar kini tidak hanya berfokus pada pembayaran lintas batas, tetapi juga menawarkan lingkungan pemrograman yang canggih melalui Soroban. Platform ini didesain untuk mengeksekusi logika kompleks tanpa mengorbankan kecepatan atau biaya rendah yang menjadi ciri khas Stellar.",
        },
        {
          sub: "Pilar Teknis Utama",
          text: "Dua aspek teknis krusial yang menjadikan Soroban unggul bagi para pengembang adalah:",
          list: ["**Implementasi Rust:** Soroban dikembangkan menggunakan bahasa pemrograman **Rust**, yang menjamin keamanan memori (*memory safety*) serta performa eksekusi yang optimal.", "**Runtime WebAssembly (Wasm):** Seluruh kode dikompilasi ke dalam format **Wasm**, memungkinkan smart contract berjalan dalam lingkungan *sandbox* terisolasi yang aman dan berperforma tinggi.", "**Eksekusi Paralel:** Melalui sistem konkurensi yang cerdas, transaksi yang tidak saling berkaitan dapat diproses secara bersamaan (paralel) untuk meningkatkan throughput.", "**Manajemen State:** Soroban memperkenalkan solusi pengarsipan state inovatif untuk mencegah *ledger bloat*, memastikan skalabilitas jaringan dalam jangka panjang."],
        },
        {
          sub: "Integrasi Protokol Secara Native",
          text: "Soroban terintegrasi secara langsung ke dalam protokol inti Stellar. Hal ini membedakannya dari solusi layer-2, karena memungkinkan smart contract berinteraksi secara mulus dengan aset dan infrastruktur finansial Stellar yang sudah mapan.",
        },
      ],
      note: "Secara ringkas, Soroban menggabungkan keandalan jaringan Stellar dengan fleksibilitas pemrograman Rust yang modern.",
      links: [
        { label: "Dokumentasi Resmi Soroban", url: "https://developers.stellar.org/docs/build/smart-contracts/overview" },
        { label: "Stellar Developer Foundation", url: "https://stellar.org" },
      ],
    },
    variable: {
      title: "Variabel dan Sistem Tipe Data",
      intro: "Rust adalah bahasa yang sangat memperhatikan sistem tipe data (*strongly typed*). Hal ini menjamin keamanan memori dan performa tinggi pada smart contract Anda.",
      sections: [
        {
          sub: "Deklarasi Variabel (let vs let mut)",
          text: "Secara default, variabel di Rust bersifat imutabel (tidak dapat diubah). Gunakan keyword `mut` untuk membuat variabel yang nilainya bisa dimodifikasi.",
          code: `let x = 5; // Imutabel (tetap)
let mut y = 10; // Mutabel (bisa diubah)
y = 15;`,
        },
        {
          sub: "Tipe Data Numerik (Integers)",
          text: "Soroban mendukung berbagai ukuran angka, tergantung pada kebutuhan presisi dan memori Anda:",
          list: ["**u32 / i32:** Angka 32-bit (u = unsigned/positif, i = signed/positif-negatif).", "**u64 / i64:** Angka 64-bit, sering digunakan untuk menyimpan jumlah token atau ID.", "**u128 / i128:** Digunakan jika Anda membutuhkan angka yang sangat besar (seperti jumlah supply token)."],
        },
        {
          sub: "Tipe Data Khusus Soroban",
          text: "Selain tipe data dasar Rust, Soroban menyediakan tipe data khusus untuk berinteraksi dengan blockchain Stellar:",
          list: ["**Symbol:** String pendek (maks 32 karakter) yang sangat efisien untuk label atau ID fungsi.", "**Address:** Digunakan untuk merepresentasikan alamat akun Stellar atau alamat kontrak lain.", "**bool:** Tipe data benar (`true`) atau salah (`false`)."],
          code: `let owner: Address = env.current_contract_address();
let status: Symbol = Symbol::new(&env, "active");
let is_ready: bool = true;`,
        },
        {
          sub: "Koleksi Data (Vec & Map)",
          text: "Untuk menyimpan kumpulan data, Soroban menyediakan koleksi yang dioptimalkan untuk penyimpanan ledger:",
          list: ["**Vec:** Koleksi data yang berurutan (seperti array/list).", "**Map:** Koleksi data berbasis kunci dan nilai (*key-value pairs*)."],
          code: `let mut list_angka: Vec<u32> = Vec::new(&env);
list_angka.push_back(100);`,
        },
      ],
      note: "Memilih tipe data yang tepat sangat penting untuk menghemat biaya gas (fee) transaksi di jaringan Stellar.",
    },
    studio: {
      title: "Soroban Studio: Lingkungan Pengembangan Berbasis Web",
      intro: "Soroban Studio adalah lingkungan pengembangan terintegrasi (IDE) berbasis cloud yang didesain khusus untuk menyederhanakan alur kerja pengembang Soroban. Platform ini memungkinkan Anda untuk mulai membangun tanpa perlu melakukan konfigurasi lingkungan pengembangan lokal yang kompleks.",
      sections: [
        {
          sub: "Definisi Soroban Studio",
          text: "Soroban Studio menyediakan berbagai alat pengembangan yang dioptimalkan untuk ekosistem Stellar. Anda dapat menulis kode, mengompilasi kontrak, hingga melakukan simulasi transaksi, semuanya dilakukan langsung melalui peramban (browser) Anda.",
        },
        {
          sub: "Fitur Pengembangan Utama",
          text: "Platform ini menawarkan serangkaian fitur yang dirancang untuk produktivitas pengembang:",
          list: ["**Editor Kode Mutakhir:** Editor yang ringan namun bertenaga, dilengkapi dengan fitur pelengkapan otomatis (*autocomplete*) dan penonjolan sintaks (*syntax highlighting*) khusus untuk Rust.", "**Terminal Terintegrasi:** Akses langsung ke perintah `stellar` atau `cargo` tanpa perlu instalasi lokal. Kompilasi dilakukan pada server berkecepatan tinggi.", "**Deployment Satu Klik:** Memfasilitasi deployment kontrak ke Testnet dengan proses yang sangat sederhana, tanpa memerlukan konfigurasi RPC manual.", "**Sinkronisasi GitHub:** Kelola kode sumber Anda dengan mudah melalui integrasi repositori GitHub untuk kolaborasi dan manajemen versi yang lebih baik."],
        },
        {
          sub: "Efisiensi Pengembangan",
          text: "Setup lingkungan pengembangan Rust dan Soroban seringkali menjadi hambatan bagi pengembang baru. Soroban Studio mengeliminasi hambatan tersebut sehingga Anda dapat langsung fokus pada aspek yang paling krusial: **logika kode kontrak Anda.**",
        },
      ],
      note: "Mulailah membangun di ekosistem Stellar dengan efisiensi maksimal melalui Soroban Studio.",
      links: [
        { label: "Halaman Utama Soroban Studio", url: "https://soroban.studio" },
        { label: "Repositori GitHub", url: "https://github.com/zinct/soroban-ide" },
      ],
    },
    contract: {
      title: "Anatomi Dasar Smart Contract Soroban",
      intro: "Mengembangkan smart contract di Soroban memerlukan pemahaman tentang struktur dasar kode Rust yang dioptimalkan untuk blockchain. Berikut adalah komponen inti yang membentuk sebuah kontrak pada jaringan Stellar.",
      sections: [
        {
          sub: "1. Deklarasi Lingkungan dan SDK",
          text: "Setiap kontrak Soroban diawali dengan konfigurasi lingkungan untuk memastikan efisiensi eksekusi:",
          code: "#![no_std]\nuse soroban_sdk::{contract, contractimpl, Env};",
          list: ["**#![no_std]:** Atribut ini memberitahu Rust untuk tidak menggunakan standard library (std). Hal ini krusial agar ukuran biner Wasm tetap kecil dan efisien saat dijalankan di blockchain.", "**soroban_sdk:** Kita mengimpor makro dan tipe data inti dari SDK resmi Stellar untuk membangun fungsionalitas kontrak."],
        },
        {
          sub: "2. Definisi Struktur Kontrak",
          text: "Langkah selanjutnya adalah mendefinisikan identitas kontrak melalui sebuah struktur data (struct):",
          code: "#[contract]\npub struct NotesContract;",
          list: ["**#[contract]:** Makro ini menandai struktur data sebagai titik masuk (*entry point*) utama untuk smart contract Anda.", "**NotesContract:** Ini adalah nama kontrak Anda. Anda dapat merujuk pada nama ini saat melakukan deployment maupun interaksi antar kontrak."],
        },
        {
          sub: "3. Implementasi Logika (Contract Implementation)",
          text: "Blok implementasi adalah tempat di mana seluruh logika bisnis dan fungsi publik kontrak ditulis:",
          code: "#[contractimpl]\nimpl NotesContract {\n    pub fn hello(env: Env, to: Symbol) -> Vec<Symbol> {\n        // Logika fungsi di sini\n    }\n}",
          list: ["**#[contractimpl]:** Atribut ini memberitahu kompiler Soroban bahwa fungsi-fungsi di dalam blok `impl` ini harus diekspor dan tersedia untuk dipanggil oleh pengguna atau kontrak lain.", "**Env:** Objek lingkungan yang menyediakan akses ke fitur-fitur blockchain seperti penyimpanan (*storage*), log, dan informasi transaksi."],
        },
      ],
      note: "Pastikan setiap fungsi yang ingin diakses secara publik selalu berada di dalam blok implementasi yang ditandai dengan #[contractimpl].",
    },
    structure: {
      title: "Memahami Struktur Projek Soroban",
      intro: "Memahami struktur folder dan file merupakan langkah fundamental bagi pengembang dalam mengelola projek di Soroban Studio secara efektif.",
      sections: [
        {
          sub: "Direktori Utama",
          text: "Secara umum, terdapat tiga direktori utama yang perlu Anda perhatikan dalam setiap projek Soroban:",
          list: ["**contracts/**: Direktori ini berisi seluruh kode sumber smart contract berbasis Rust yang sedang Anda kembangkan.", "**frontend/**: Direktori opsional yang ditujukan untuk menyimpan kode antarmuka pengguna (web UI) aplikasi Anda.", "**target/**: Direktori ini dihasilkan secara otomatis saat proses kompilasi dan berisi file biner hasil build contract Anda."],
        },
        {
          sub: "File Konfigurasi Penting",
          text: "Terdapat beberapa file manifest dan konfigurasi yang memiliki peran krusial dalam projek:",
          list: ["**Cargo.toml:** File konfigurasi utama Rust yang mendefinisikan informasi projek serta daftar pustaka atau dependensi yang digunakan.", "**.gitignore:** File yang menentukan daftar file atau direktori yang harus diabaikan oleh sistem kontrol versi Git (seperti direktori `target`).", "**README.md:** File dokumentasi standar yang menjelaskan tujuan projek serta instruksi penggunaan bagi pengembang lain."],
        },
      ],
      note: "Pastikan seluruh kode sumber smart contract berada di dalam direktori 'contracts' agar dapat dikompilasi dengan benar oleh sistem.",
    },
    struct: {
      title: "Mengelola Data Kompleks dengan Struct",
      intro: "Dalam pengembangan smart contract, kita sering kali perlu mengelompokkan berbagai informasi terkait ke dalam satu entitas yang logis. Di Rust, hal ini dilakukan menggunakan **Struct**.",
      sections: [
        {
          sub: "Mengenal Konsep Struct",
          text: "Struct adalah tipe data kustom yang memungkinkan Anda menyimpan beberapa nilai terkait dalam satu objek. Jika Anda terbiasa dengan bahasa pemrograman lain, Struct memiliki kemiripan dengan 'Class' atau 'Object'.",
          list: ["**Representasi Objek:** Digunakan untuk merepresentasikan entitas nyata seperti `User`, `Note`, atau `Mahasiswa`.", "**Fields:** Setiap data individu yang disimpan di dalam Struct disebut sebagai *field*.", "**Koleksi Data:** Memungkinkan pengelolaan data yang kompleks menjadi lebih terstruktur dan mudah dibaca."],
        },
        {
          sub: "Implementasi Struct pada Soroban",
          text: "Untuk menggunakan Struct di dalam smart contract Soroban, kita perlu menambahkan beberapa atribut khusus agar kontrak dapat mengenali dan menyimpan data tersebut:",
          code: "#[contracttype]\n#[derive(Clone, Debug)]\npub struct Note {\n    pub id: u64,\n    pub title: String,\n    pub content: String,\n}",
          list: ["**#[contracttype]:** Ini adalah atribut paling krusial. Atribut ini memberitahu Soroban bahwa Struct ini dapat digunakan sebagai input/output fungsi dan dapat disimpan ke dalam storage blockchain (serialisasi).", "**#[derive(Clone, Debug)]:** Trait bantuan Rust yang memungkinkan objek disalin (clone) dan ditampilkan untuk keperluan debugging.", "**Tipe Data Field:** Pada contoh di atas, kita menggunakan `u64` untuk ID unik dan `String` untuk menyimpan teks judul serta isi catatan."],
        },
      ],
      note: "Gunakan Struct setiap kali Anda memiliki sekumpulan data yang saling berkaitan untuk menjaga kode tetap bersih dan modular.",
    },
    function: {
      title: "Mengimplementasikan Fungsi Kontrak",
      intro: "Fungsi adalah inti dari logika bisnis dalam smart contract. Melalui fungsi, pengguna dapat berinteraksi dengan kontrak untuk menjalankan aksi tertentu, mengambil data, atau melakukan perubahan status pada ledger.",
      sections: [
        {
          sub: "Peran Fungsi dalam Smart Contract",
          text: "Dalam ekosistem Soroban, fungsi bertindak sebagai jembatan antara pengguna dan kode kontrak Anda. Berikut adalah beberapa karakteristik utamanya:",
          list: ["**Eksekusi Aksi:** Fungsi digunakan untuk menjalankan logika spesifik, mulai dari kalkulasi sederhana hingga manajemen aset yang kompleks.", "**Interaksi Pengguna:** Pengguna berinteraksi dengan kontrak dengan cara memanggil fungsi-fungsi publik yang tersedia.", "**Akses Data:** Digunakan baik untuk mengambil (*read*) maupun mengubah (*write*) data yang tersimpan di dalam blockchain."],
        },
        {
          sub: "Parameter sebagai Input Pengguna",
          text: "Salah satu fungsi utama parameter dalam fungsi kontrak adalah sebagai pintu masuk data dari pengguna (*user input*):",
          list: ["**Definisi Input:** Setiap parameter (selain `env`) mewakili input yang harus diberikan oleh pengguna saat memanggil fungsi.", "**Type Safety:** Rust memastikan bahwa data yang dimasukkan oleh pengguna sesuai dengan tipe data yang Anda tentukan (misalnya `u64` untuk angka atau `String` untuk teks), sehingga mencegah error data yang tidak valid.", "**Interface Otomatis:** Di Soroban Studio, parameter-parameter ini akan otomatis muncul sebagai kolom input pada antarmuka interaksi kontrak."],
        },
        {
          sub: "Anatomi Sintaks Fungsi",
          text: "Memahami cara penulisan input dan hasil kembalian (*return value*) sangat penting agar kontrak dapat berkomunikasi dengan benar:",
          code: `pub fn tambah_catatan(env: Env, id: u64, judul: String) -> String {
    // Parameter 'id' dan 'judul' di atas adalah Input
    
    // Simbol '->' menunjukkan fungsi akan mengembalikan nilai (Return)
    return String::from_str(&env, "Catatan berhasil ditambahkan");
}`,
          list: ["**Parameter (Input):** Ditulis di dalam kurung `()`. Anda harus menentukan nama parameter dan tipe datanya (contoh: `judul: String`).", "**Simbol `->` (Return):** Simbol ini adalah penanda bahwa fungsi akan memberikan hasil balik. Diikuti dengan tipe data yang akan dikembalikan.", "**Keyword `return`:** Digunakan di akhir logika fungsi untuk mengirimkan data kembali ke pemanggil fungsi."],
        },
        {
          sub: "Struktur dan Implementasi",
          text: "Seluruh fungsi publik harus didefinisikan di dalam blok implementasi yang ditandai dengan atribut `#[contractimpl]`:",
          code: `#[contractimpl]
impl NotesContract {
    // Fungsi untuk mendapatkan semua catatan
    pub fn get_notes(env: Env) -> Vec<Note> { ... }

    // Fungsi untuk membuat catatan baru
    pub fn create_note(env: Env, title: String, content: String) -> String { ... }

    // Fungsi untuk menghapus catatan berdasarkan ID
    pub fn delete_note(env: Env, id: u64) -> String { ... }
}`,
          list: ["**Env (Environment):** Parameter `env` wajib disertakan pada hampir setiap fungsi untuk memberikan akses ke fitur blockchain seperti storage, logging, dan informasi transaksi.", "**Visibilitas:** Penggunaan keyword `pub` memastikan fungsi tersebut dapat diakses secara publik dari luar kontrak.", "**Tipe Pengembalian:** Fungsi dapat mengembalikan berbagai tipe data, seperti koleksi (`Vec`), tipe data kustom (`Note`), maupun string informasi status."],
        },
      ],
      note: "Rancanglah fungsi Anda secara modular dan pastikan setiap fungsi memiliki tanggung jawab yang spesifik untuk menjaga keamanan kontrak.",
    },
    storage: {
      title: "Manajemen Data Persisten dengan Storage",
      intro: "Berbeda dengan variabel biasa yang bersifat sementara, **Storage** digunakan untuk menyimpan data smart contract secara permanen di dalam blockchain Stellar. Ini adalah cara kontran Anda 'mengingat' informasi lintas transaksi.",
      sections: [
        {
          sub: "Konsep Key-Value Storage",
          text: "Soroban menggunakan model penyimpanan kunci-nilai (*key-value*). Bayangkan storage sebagai lemari arsip besar di mana setiap data disimpan dengan label (kunci) tertentu.",
          list: ["**Key (Kunci):** Label unik untuk mengidentifikasi data (seringkali menggunakan tipe `Symbol`).", "**Value (Nilai):** Data yang ingin disimpan (bisa berupa angka, string, atau bahkan Struct komplek).", "**Akses:** Data diakses melalui objek `env.storage()` yang tersedia di dalam environment kontrak."],
        },
        {
          sub: "Operasi Utama: Get dan Set",
          text: "Ada dua operasi dasar yang akan paling sering Anda gunakan untuk berinteraksi dengan storage:",
          list: ["**Set:** Digunakan untuk membuat baru atau memperbarui data yang sudah ada.", "**Get:** Digunakan untuk mengambil data berdasarkan kuncinya. Operasi ini biasanya mengembalikan `Option`, jadi kita perlu menangani kasus jika data tidak ditemukan."],
          code: `// Contoh sederhana menulis dan membaca angka
let KEY = Symbol::new(&env, "SCORE");
env.storage().instance().set(&KEY, &100); // Set
let score: u32 = env.storage().instance().get(&KEY).unwrap_or(0); // Get`,
        },
        {
          sub: "Contoh Penggunaan Lengkap",
          text: "Berikut adalah contoh bagaimana kita menggabungkan Struct dan Storage untuk membangun sistem penyimpanan daftar catatan (*notes list*) yang persisten:",
          code: `const NOTE_KEY: Symbol = Symbol::new(&env, "NOTE_DATA");

#[contractimpl]
impl NotesContract {
    // Fungsi untuk menambahkan catatan baru ke dalam list di storage
    pub fn create_note(env: Env, title: String, content: String) {
        // 1. Ambil list catatan yang sudah ada, atau buat list baru jika kosong
        let mut notes: Vec<Note> = env.storage().instance()
            .get(&NOTE_KEY)
            .unwrap_or(Vec::new(&env));

        // 2. Buat objek Note baru
        let new_note = Note {
            id: (notes.len() as u64) + 1,
            title,
            content,
        };

        // 3. Masukkan ke dalam list
        notes.push_back(new_note);

        // 4. Simpan kembali list yang sudah diperbarui ke storage
        env.storage().instance().set(&NOTE_KEY, &notes);
    }

    // Fungsi untuk mengambil seluruh catatan dari storage
    pub fn get_all_notes(env: Env) -> Vec<Note> {
        env.storage().instance()
            .get(&NOTE_KEY)
            .unwrap_or(Vec::new(&env))
    }
}`,
          list: ["**instance():** Kita menggunakan storage tipe `instance` yang berarti data ini menempel secara permanen pada instance kontrak tersebut.", "**unwrap_or():** Teknik aman di Rust untuk memberikan nilai default (seperti list kosong) jika data belum pernah disimpan sebelumnya.", "**Persistensi:** Setelah fungsi `create_note` selesai dieksekusi, data `notes` akan tersimpan aman di blockchain dan bisa diakses kapan saja."],
        },
      ],
      note: "Penyimpanan data di blockchain memerlukan biaya (fee). Pastikan Anda hanya menyimpan data yang benar-benar diperlukan untuk efisiensi biaya.",
    },
    wallet: {
      title: "Mengelola Identitas Digital dengan Wallet",
      intro: "Wallet adalah komponen fundamental dalam ekosistem blockchain. Ia tidak hanya berfungsi sebagai dompet aset digital, tetapi juga sebagai identitas unik Anda di jaringan Stellar yang memungkinkan Anda berinteraksi dengan aplikasi terdesentralisasi (dApps).",
      sections: [
        {
          sub: "Apa itu Wallet Stellar?",
          text: "Di jaringan Stellar, wallet adalah alat yang Anda gunakan untuk menandatangani transaksi secara digital. Setiap wallet memiliki alamat publik (*public address*) yang bertindak sebagai identitas Anda di blockchain.",
          list: ["**Login & Interaksi:** Digunakan untuk masuk ke aplikasi Web3 dan memberikan persetujuan saat menjalankan fungsi smart contract.", "**Blockchain Identity:** Alamat wallet Anda adalah representasi identitas yang bersifat publik dan global di seluruh jaringan Stellar."],
        },
        {
          sub: "Metode Pembuatan Wallet",
          text: "Ada dua cara utama yang umum digunakan untuk membuat dan mengelola wallet di Stellar:",
          list: ["**Browser Extension (Freighter):** Merupakan cara tercepat dan paling user-friendly bagi pengguna umum untuk berinteraksi dengan dApps.", "**Terminal / CLI:** Metode yang disukai oleh para pengembang untuk mengelola akun secara lokal melalui baris perintah."],
        },
        {
          sub: "Instalasi Freighter Wallet",
          text: "Freighter adalah ekstensi peramban (browser) standar yang aman untuk jaringan Stellar. Anda dapat menginstalnya di Google Chrome, Firefox, atau Brave.",
          image: "/tutorials/freighter.png",
          links: [{ label: "Download Freighter Wallet", url: "https://www.freighter.app/" }],
        },
        {
          sub: "Terminal untuk Developer (CLI)",
          text: "Bagi Anda yang ingin mengelola identitas langsung dari terminal, Soroban CLI menyediakan perintah yang sangat praktis:",
          codeLang: "sh",
          code: `# Membuat akun baru dengan nama 'alice' di jaringan testnet
stellar keys generate  --network testnet alice

# Melihat daftar akun yang tersimpan secara lokal
stellar keys ls`,
          list: ["**stellar keys generate:** Perintah ini akan secara otomatis membuatkan pasangan kunci (public & private) dan mendaftarkannya ke jaringan testnet.", "**Local Storage:** Akun yang dibuat melalui terminal tersimpan secara privat di lingkungan pengembangan lokal Anda."],
        },
      ],
      note: "Jangan pernah membagikan 'Secret Key' atau 'Seed Phrase' wallet Anda kepada siapapun. Siapa pun yang memiliki akses ke kunci tersebut memiliki kontrol penuh atas aset Anda.",
      links: [
        { label: "Download Freighter Wallet", url: "https://www.freighter.app/" },
        { label: "Freighter Documentation", url: "https://docs.freighter.app/" },
      ],
    },
    deploy: {
      title: "Deployment Kontrak ke Jaringan Testnet",
      intro: "Langkah terakhir dalam alur pengembangan adalah mempublikasikan smart contract Anda ke jaringan blockchain. Kita akan menggunakan jaringan **Testnet** yang merupakan lingkungan uji coba gratis bagi pengembang.",
      sections: [
        {
          sub: "1. Mempersiapkan Wallet & Saldo",
          text: "Sebelum melakukan deployment, Anda membutuhkan identitas (wallet) yang memiliki saldo XLM di jaringan Testnet untuk membayar biaya transaksi.",
          codeLang: "sh",
          code: "stellar keys generate alice --network testnet --fund",
          list: ["**--fund:** Parameter ini sangat penting karena ia akan otomatis meminta saldo gratis dari layanan Friendbot Stellar.", "**alice:** Ganti dengan nama unik sesuai keinginan Anda sebagai alias lokal untuk wallet tersebut."],
        },
        {
          sub: "2. Kompilasi Kontrak (Build)",
          text: "Pastikan kode kontrak Anda bersih dari error, lalu kompilasi kode Rust menjadi file biner WebAssembly (Wasm).",
          codeLang: "sh",
          code: "stellar contract build",
          list: ["**Target:** Hasil kompilasi berupa file `.wasm` akan disimpan di dalam direktori `target/wasm32-unknown-unknown/release/`."],
        },
        {
          sub: "3. Deployment ke Jaringan",
          text: "Gunakan perintah berikut untuk mengirimkan biner Wasm Anda ke blockchain Stellar Testnet:",
          codeLang: "sh",
          code: "stellar contract deploy --source-account alice --network testnet",
          list: ["**Contract ID:** Setelah berhasil, terminal akan menampilkan ID unik kontrak Anda. Simpan ID ini untuk berinteraksi dengan kontrak nantinya."],
        },
        {
          sub: "Interaksi via Stellar Laboratory",
          text: "Stellar Laboratory (Lab) adalah alat bantu web resmi untuk berinteraksi dengan smart contract Anda tanpa harus menulis kode tambahan.",
          list: ["**Simulate:** Digunakan untuk menjalankan fungsi kontrak sebagai 'uji coba' (*dry run*). Operasi ini hanya akan mengembalikan hasil eksekusi tanpa mengubah data di blockchain dan tanpa biaya gas.", "**Simulate & Submit:** Gunakan opsi ini jika Anda ingin melakukan perubahan nyata pada blockchain (misal: menyimpan data). Lab akan melakukan simulasi terlebih dahulu, lalu mengirimkan transaksi tersebut ke jaringan setelah Anda menyetujuinya."],
        },
      ],
      note: "Setiap interaksi yang mengubah status ekonomi atau data di blockchain (Submit) memerlukan biaya kecil dalam bentuk XLM sebagai fee jaringan.",
    },
  },
};
