export const fil = {
  soroban: {
    title: "Alamin ang Soroban 👋",
    intro: "Sa madaling salita, ang Soroban ay isang next-generation smart contract platform na binuo sa Stellar network. Kung gusto mong gumawa ng mabilis at secure na dApps, ito ang para sa iyo!",
    sections: [
      {
        sub: "Bakit Soroban?",
        text: "Ang Stellar dati ay nakatuon lamang sa payments, ngunit sa Soroban, naging mas makapangyarihan ito. Dinisenyo ito para humawak ng complex logic nang hindi bumabagal ang network.",
      },
      {
        sub: "Teknikal na Detalye",
        text: "Para sa mga developers, narito kung bakit maganda ang Soroban:",
        list: ["**Gamit ang Rust:** Ginagamit ng Soroban ang **Rust**, isang language na sikat sa memory safety at bilis.", "**Wasm Runtime:** Ang lahat ng code mo ay nako-compile sa **WebAssembly (Wasm)**.", "**Walang State Bloat:** Gumagamit ang Soroban ng state archival solution para manatiling mabilis ang network.", "**Native Integration:** Ang Soroban ay **native** sa Stellar. Hindi na kailangan ng mga clunky bridges."],
      },
    ],
    note: "Sa madaling sabi: Ang Soroban ay ang perpektong mix ng bilis ng Stellar at programmability ng Rust.",
  },
  variable: {
    title: "Mga Variable at Type System",
    intro: "Ang Rust ay isang strongly typed language. Sinisiguro nito ang memory safety at high performance para sa iyong mga smart contract.",
    sections: [
      {
        sub: "Variables (let vs let mut)",
        text: "By default, ang mga variable sa Rust ay immutable. Gamitin ang `mut` keyword para makagawa ng variable na pwedeng mabago.",
        code: "let x = 5; // Immutable\nlet mut y = 10; // Mutable\ny = 15;",
      },
      {
        sub: "Numeric Types",
        text: "Sinusuportahan ng Soroban ang iba't ibang laki ng integers:",
        list: ["**u32 / i32:** 32-bit integers.", "**u64 / i64:** Karaniwang ginagamit para sa token amounts.", "**u128 / i128:** Para sa malalaking numero."],
      },
    ],
    note: "Mahalaga ang pagpili ng tamang data type para makatipid sa gas fees sa Stellar network.",
  },
  studio: {
    title: "Soroban Studio: Web-Based IDE",
    intro: "Ang Soroban Studio ay isang cloud-based IDE na idinisenyo para padaliin ang iyong development workflow. Magsimulang bumuo nang walang kumplikadong local setup.",
    sections: [
      {
        sub: "Ano ang Soroban Studio?",
        text: "Nagbibigay kami ng mga optimized tools para sa Stellar ecosystem. Sumulat ng code, i-compile ang mga contract, at i-simulate ang mga transaction direktang sa iyong browser.",
      },
      {
        sub: "Pangunahing Tampok",
        text: "Idinisenyo para sa produktibidad ng developer:",
        list: ["**Advanced Code Editor:** Magaan ngunit makapangyarihan na may Rust autocomplete.", "**Integrated Terminal:** Direktang access sa mga command ng `stellar` at `cargo`.", "**One-Click Deployment:** Madaling i-deploy sa Testnet.", "**GitHub Integration:** I-sync ang iyong source code sa pamamagitan ng GitHub."],
      },
    ],
    note: "Bumuo sa Stellar nang may maximum efficiency sa pamamagitan ng Soroban Studio.",
  },
  contract: {
    title: "Anatomiya ng Soroban Smart Contract",
    intro: "Ang pagbuo ng mga smart contract sa Soroban ay nangangailangan ng pag-unawa sa pangunahing istruktura ng Rust code na optimized para sa blockchain.",
    sections: [
      {
        sub: "1. Environment at SDK Declaration",
        text: "Ang bawat Soroban contract ay nagsisimula sa configuration ng environment:",
        code: "#![no_std]\nuse soroban_sdk::{contract, contractimpl, Env};",
        list: ["**#![no_std]:** Sinasabi sa Rust na huwag gamitin ang standard library para manatiling maliit ang Wasm binary.", "**soroban_sdk:** Core macros at types mula sa opisyal na Stellar SDK."],
      },
      {
        sub: "2. Contract Structure",
        text: "I-define ang identity ng iyong contract gamit ang isang struct:",
        code: "#[contract]\npub struct NotesContract;",
      },
    ],
    note: "Siguraduhin na ang lahat ng pampublikong function ay nasa loob ng isang implementation block na may markang #[contractimpl].",
  },
  structure: {
    title: "Pag-unawa sa Soroban Project Structure",
    intro: "Ang pag-alam sa iyong mga folder at file ay pundasyon sa epektibong pamamahala ng iyong mga proyekto.",
    sections: [
      {
        sub: "Pangunahing Direktoryo",
        text: "Ang mga tipikal na Soroban project ay may tatlong pangunahing direktoryo:",
        list: ["**contracts/**: Naglalaman ng iyong Rust smart contract source code.", "**frontend/**: Opsyonal na direktoryo para sa iyong web UI code.", "**target/**: Awtomatikong nabubuo habang nagko-compile."],
      },
    ],
    note: "Laging itago ang iyong contract source code sa loob ng 'contracts' directory para sa matagumpay na compilation.",
  },
  struct: {
    title: "Pamamahala ng Complex Data gamit ang Structs",
    intro: "Sa mga smart contract, madalas nating pinapangkat ang magkakaugnay na impormasyon. Sa Rust, gumagamit tayo ng **Structs**.",
    sections: [
      {
        sub: "Ang Konsepto ng Struct",
        text: "Ang Struct ay isang custom data type na nagbibigay-daan sa iyo na mag-imbak ng maraming kaugnay na value sa isang object.",
      },
      {
        sub: "Implementasyon sa Soroban",
        text: "Para gumamit ng Structs sa Soroban, nagdaragdag tayo ng mga partikular na attribute:",
        code: "#[contracttype]\n#[derive(Clone, Debug)]\npub struct Note {\n    pub id: u64,\n    pub title: String,\n    pub content: String,\n}",
      },
    ],
    note: "Gumamit ng Structs tuwing mayroon kang set ng kaugnay na data para mapanatiling modular ang iyong code.",
  },
  function: {
    title: "Pagpapatupad ng mga Contract Function",
    intro: "Ang mga function ay ang puso ng iyong business logic. Sa pamamagitan ng mga ito, nakikipag-ugnayan ang mga user sa contract.",
    sections: [
      {
        sub: "Papel ng mga Function",
        text: "Ang mga function ang tulay sa pagitan ng user at ng contract code.",
      },
      {
        sub: "Parameters bilang User Input",
        text: "Ang mga parameter ang entry point para sa data na ibinibigay ng user.",
      },
    ],
    note: "Idisenyo ang iyong mga function nang modular na may mga partikular na responsibilidad para sa mas mahusay na seguridad.",
  },
  storage: {
    title: "Persistent Data Management",
    intro: "Hindi katulad ng mga regular na variable, ang **Storage** ay ginagamit para i-save ang data nang permanente sa Stellar blockchain.",
    sections: [
      {
        sub: "Key-Value Storage Concept",
        text: "Gumagamit ang Soroban ng key-value model. Isipin ang storage bilang isang malaking filing cabinet.",
        list: ["**Key:** Isang natatanging label (madalas ay `Symbol`).", "**Value:** Ang mismong data.", "**Access:** Na-a-access sa pamamagitan ng `env.storage()` object."],
      },
      {
        sub: "Pangunahing Operasyon: Get at Set",
        code: `// Simpleng pag-read at write
let KEY = Symbol::new(&env, "SCORE");
env.storage().instance().set(&KEY, &100); // Set
let score: u32 = env.storage().instance().get(&KEY).unwrap_or(0); // Get`,
      },
    ],
    note: "Ang pag-iimbak ng data sa blockchain ay may bayad. Maging matipid at i-store lamang ang kailangan.",
  },
  wallet: {
    title: "Pamamahala ng Digital Identity gamit ang mga Wallet",
    intro: "Ang wallet ay isang pangunahing bahagi ng blockchain ecosystem. Ito ay nagsisilbing iyong digital vault at pagkakakilanlan sa Stellar network.",
    sections: [
      {
        sub: "Ano ang isang Stellar Wallet?",
        text: "Sa Stellar, ang wallet ang tool na ginagamit mo para digital na pirmahan ang mga transaction.",
      },
      {
        sub: "Pag-install ng Freighter Wallet",
        text: "Ang Freighter ay ang secure na standard browser extension para sa Stellar network.",
        image: "/tutorials/freighter.png",
        links: [{ label: "I-download ang Freighter Wallet", url: "https://www.freighter.app/" }],
      },
    ],
    note: "Huwag kailanman ibahagi ang iyong 'Secret Key'. Ang sinumang may access dito ay may buong kontrol sa iyong mga asset.",
  },
  deploy: {
    title: "Contract Deployment sa Testnet",
    intro: "Ang huling hakbang sa workflow ay ang pag-publish ng iyong smart contract sa blockchain.",
    sections: [
      {
        sub: "1. Ihanda ang Wallet at Pondo",
        text: "Bago i-deploy, kailangan mo ng wallet na may XLM balance sa Testnet.",
        code: "stellar keys generate alice --network testnet --fund",
      },
      {
        sub: "2. I-build ang iyong Contract",
        code: "stellar contract build",
      },
      {
        sub: "3. I-deploy sa Network",
        code: "stellar contract deploy --source-account alice --network testnet",
      },
    ],
    note: "Anumang interaction na nagpapalit ng ledger data ay nangangailangan ng maliit na XLM fee.",
  },
};
