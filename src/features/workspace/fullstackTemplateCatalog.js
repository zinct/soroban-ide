/**
 * Catalog of bundled fullstack example projects (contract + Vite frontend).
 * Used by the Examples modal and workspace template factories.
 */

export const FULLSTACK_TEMPLATE_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "payments", label: "Payments" },
  { id: "social", label: "Social Impact" },
  { id: "commerce", label: "Commerce" },
  { id: "savings", label: "Savings & Groups" },
];

/** Match App.tsx copy to a bundled template (used by preview + bundler). */
export const FULLSTACK_APP_MARKERS = [
  { id: "fullstack-workshop", needle: "On-chain integer state" },
  { id: "pay-escrow", needle: "Milestone payments" },
  { id: "tip-jar", needle: "Support this creator" },
  { id: "donation-vault", needle: "Transparent giving" },
  { id: "invoice-split", needle: "Share group expenses" },
  { id: "savings-circle", needle: "Save together" },
];

export const FULLSTACK_TEMPLATES = [
  {
    id: "fullstack-workshop",
    name: "Soroban Counter",
    tagline: "Learn Soroban reads, writes, and Freighter signing.",
    category: "payments",
    contractPath: "contracts/counter",
    previewWriteMethods: ["increment"],
    previewReadMethods: ["get"],
    stellarFeatures: ["Soroban smart contracts", "Freighter wallet", "Testnet RPC"],
    demoAction: "Increment the on-chain counter",
  },
  {
    id: "pay-escrow",
    name: "Pay Escrow",
    tagline: "Freelancer milestone escrow — fund and release on completion.",
    category: "payments",
    contractPath: "contracts/escrow",
    previewWriteMethods: ["fund", "release"],
    previewReadMethods: ["get"],
    stellarFeatures: ["Soroban escrow state", "USDC-ready flow", "Freighter signing"],
    demoAction: "Fund escrow, then release payment",
  },
  {
    id: "tip-jar",
    name: "Tip Jar",
    tagline: "Creator micropayments — tip jar totals on-chain.",
    category: "payments",
    contractPath: "contracts/tip_jar",
    previewWriteMethods: ["tip"],
    previewReadMethods: ["get_total", "get_tip_count"],
    stellarFeatures: ["Soroban micropayment ledger", "Fast testnet demo", "Freighter signing"],
    demoAction: "Send a tip and see the running total",
  },
  {
    id: "donation-vault",
    name: "Donation Vault",
    tagline: "Transparent NGO donations with public totals.",
    category: "social",
    contractPath: "contracts/donation_vault",
    previewWriteMethods: ["donate"],
    previewReadMethods: ["get_total", "get_donor_count"],
    stellarFeatures: ["Soroban donation tracking", "Public audit trail", "Freighter signing"],
    demoAction: "Record a donation and refresh totals",
  },
  {
    id: "invoice-split",
    name: "Split Bill",
    tagline: "Roommates split a bill — track who paid their share.",
    category: "commerce",
    contractPath: "contracts/invoice_split",
    previewWriteMethods: ["set_bill", "pay_share"],
    previewReadMethods: ["get_status"],
    stellarFeatures: ["Soroban coordination", "Split billing MVP", "Freighter signing"],
    demoAction: "Set bill total and pay a share",
  },
  {
    id: "savings-circle",
    name: "Savings Circle",
    tagline: "Community savings pool — contribute to a shared goal.",
    category: "savings",
    contractPath: "contracts/savings_circle",
    previewWriteMethods: ["contribute"],
    previewReadMethods: ["get_total", "get_contribution_count"],
    /** Other example write fns — reject deploy metadata that looks like the wrong template. */
    excludeFunctions: ["increment", "tip", "donate", "pay_share", "set_bill", "fund", "release", "get_status"],
    stellarFeatures: ["Soroban pooled savings", "Per-member balance", "Freighter auth"],
    demoAction: "Contribute to the circle and view pool total",
  },
];

export const getFullstackTemplate = (id) =>
  FULLSTACK_TEMPLATES.find((t) => t.id === id) || null;

/** Preview contract matching spec for a bundled fullstack template. */
export const getFullstackPreviewSpec = (templateId) => {
  const template = getFullstackTemplate(templateId);
  if (!template) return null;
  return {
    templateId: template.id,
    contractPath: template.contractPath,
    previewWriteMethods: template.previewWriteMethods || [],
    previewReadMethods: template.previewReadMethods || [],
    excludeFunctions: template.excludeFunctions || [],
  };
};

export const filterTemplatesByCategory = (categoryId) => {
  if (!categoryId || categoryId === "all") return FULLSTACK_TEMPLATES;
  return FULLSTACK_TEMPLATES.filter((t) => t.category === categoryId);
};
