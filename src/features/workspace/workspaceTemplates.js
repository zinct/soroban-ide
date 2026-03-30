/**
 * Workspace templates and factory functions.
 * Creates initial project structures for different workspace types.
 */

import { uniqueId } from './workspaceUtils';

/* ─── Default Soroban project ─── */

const DEFAULT_TEMPLATES = {
  'main.rs': `fn main() {
    println!("Hello, Soroban Studio!");
}
`,
  'lib.rs': `pub fn greet() -> &'static str {
    "Soroban Studio"
}
`,
  'main_test.rs': `#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        assert_eq!(greet(), "Soroban Studio");
    }
}
`,
  'Cargo.toml': `[package]
name = "soroban-studio"
version = "0.1.0"
edition = "2021"

[dependencies]
`,
  'README.md': `# Soroban Studio

VS Code inspired editor powered by Monaco.
`,
};

const BASE_WORKSPACE = [
  {
    id: 'root',
    name: 'soroban-studio',
    type: 'folder',
    children: [
      {
        id: 'src',
        name: 'src',
        type: 'folder',
        children: [
          { id: 'main_rs', name: 'main.rs', type: 'file', children: [] },
          { id: 'lib_rs', name: 'lib.rs', type: 'file', children: [] },
        ],
      },
      {
        id: 'tests',
        name: 'tests',
        type: 'folder',
        children: [
          { id: 'test_main', name: 'main_test.rs', type: 'file', children: [] },
        ],
      },
      { id: 'cargo', name: 'Cargo.toml', type: 'file', children: [] },
      { id: 'readme', name: 'README.md', type: 'file', children: [] },
    ],
  },
];

/* ─── Hello World Soroban project ─── */

const HELLO_WORLD_TEMPLATES = {
  'Cargo.toml': `[package]
name = "soroban-hello-world"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = "22.0"

[dev-dependencies]
soroban-sdk = { version = "22.0", features = ["testutils"] }
`,
  'lib.rs': `use soroban_sdk::{contract, contractimpl, symbol_short, vec, Env, Symbol, Vec};

#[contract]
pub struct HelloContract;

#[contractimpl]
impl HelloContract {
    pub fn hello(env: Env, to: Symbol) -> Vec<Symbol> {
        vec![&env, symbol_short!("Hello"), to]
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{symbol_short, vec, Env};

    #[test]
    fn test_hello() {
        let env = Env::default();
        let contract_id = env.register_contract(None, HelloContract);
        let client = HelloContractClient::new(&env, &contract_id);

        let result = client.hello(&symbol_short!("Soroban"));
        assert_eq!(result, vec![&env, symbol_short!("Hello"), symbol_short!("Soroban")]);
    }
}
`,
  Makefile: `.PHONY: build test fmt clean

build:
\tcargo build --target wasm32-unknown-unknown --release

test:
\tcargo test

fmt:
\tcargo fmt

clean:
\tcargo clean
`,
  'README.md': `# Soroban Hello World Smart Contract

This is a simple "Hello World" smart contract for the Soroban platform.

## Building

\`\`\`bash
make build
\`\`\`

## Testing

\`\`\`bash
make test
\`\`\`
`,
};

/* ─── Factory functions ─── */

export const createDefaultWorkspace = () => {
  const tree = JSON.parse(JSON.stringify(BASE_WORKSPACE));
  const contents = {};

  const buildContents = (nodes) => {
    nodes.forEach((node) => {
      if (node.type === 'file') {
        contents[node.id] = DEFAULT_TEMPLATES[node.name] ?? `// ${node.name}\n`;
      }
      if (node.children?.length) buildContents(node.children);
    });
  };

  buildContents(tree);
  return { tree, contents };
};

export const createHelloWorldWorkspace = () => {
  const libRsId = uniqueId();
  const cargoTomlId = uniqueId();
  const makefileId = uniqueId();
  const readmeId = uniqueId();

  const tree = [
    {
      id: uniqueId(),
      name: 'soroban-hello-world',
      type: 'folder',
      children: [
        { id: libRsId, name: 'lib.rs', type: 'file', children: [] },
        { id: cargoTomlId, name: 'Cargo.toml', type: 'file', children: [] },
        { id: makefileId, name: 'Makefile', type: 'file', children: [] },
        { id: readmeId, name: 'README.md', type: 'file', children: [] },
      ],
    },
  ];

  const contents = {
    [libRsId]: HELLO_WORLD_TEMPLATES['lib.rs'],
    [cargoTomlId]: HELLO_WORLD_TEMPLATES['Cargo.toml'],
    [makefileId]: HELLO_WORLD_TEMPLATES['Makefile'],
    [readmeId]: HELLO_WORLD_TEMPLATES['README.md'],
  };

  return { tree, contents };
};

export const createBlankWorkspace = () => {
  const readmeId = uniqueId();

  const tree = [
    {
      id: uniqueId(),
      name: 'blank-project',
      type: 'folder',
      children: [
        { id: readmeId, name: 'README.md', type: 'file', children: [] },
      ],
    },
  ];

  const contents = {
    [readmeId]: '# Blank Project\n\nStart building your project here.\n',
  };

  return { tree, contents };
};

export { DEFAULT_TEMPLATES };
