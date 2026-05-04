import React, { useState, useCallback, useEffect, useRef } from "react";
import { ShieldCheck, ShieldX, AlertTriangle, CheckCircle, XCircle, Loader, ChevronDown, ChevronRight, Link2 } from "lucide-react";
import { useDeploy } from "../../context/DeployContext";
import { validateProject, collectProjectFiles } from "../../services/backendService";
import {
  buildDeployedContractChecks,
  mergeValidationWithDeployChecks,
  resolveDeployedLinkInput,
} from "./deployLinkValidation";

const DEPLOY_LINK_STORAGE = "soroban:validation_deploy_link";

const GROUPS = [
  { id: "repo",      label: "Repository",       prefixes: ["repo-"] },
  { id: "readme",    label: "README",            prefixes: ["readme-"] },
  { id: "contract",  label: "Contract Code",     prefixes: ["librs-", "contracts-"] },
  { id: "fullstack", label: "Full Stack",        prefixes: ["fullstack-"] },
];

const CheckRow = ({ check }) => {
  const [open, setOpen] = useState(false);
  const icon = check.status === "pass"
    ? <CheckCircle size={13} className="val-icon pass" />
    : check.status === "warn"
    ? <AlertTriangle size={13} className="val-icon warn" />
    : <XCircle size={13} className="val-icon fail" />;

  return (
    <div className={`val-check-row ${check.status}`}>
      <button className="val-check-header" onClick={() => setOpen(v => !v)}>
        {icon}
        <span className="val-check-label">{check.label}</span>
        {!check.required && <span className="val-optional">optional</span>}
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>
      {open && (
        <div className="val-check-detail">
          <p>{check.message}</p>
          {check.fix_hint && <p className="val-fix-hint">💡 {check.fix_hint}</p>}
          {check.evidence && <code className="val-evidence">{check.evidence}</code>}
        </div>
      )}
    </div>
  );
};

const CheckGroup = ({ group, checks }) => {
  const groupChecks = checks.filter(c =>
    group.prefixes.some(p => c.id.startsWith(p))
  );
  if (groupChecks.length === 0) return null;
  const [open, setOpen] = useState(true);
  const failCount = groupChecks.filter(c => c.status === "fail").length;
  const passCount = groupChecks.filter(c => c.status === "pass").length;

  return (
    <div className="val-group">
      <button className="val-group-header" onClick={() => setOpen(v => !v)}>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <span>{group.label}</span>
        <span className="val-group-counts">
          <span className="val-count pass">{passCount}✓</span>
          {failCount > 0 && <span className="val-count fail">{failCount}✗</span>}
        </span>
      </button>
      {open && (
        <div className="val-group-body">
          {groupChecks.map(c => <CheckRow key={c.id} check={c} />)}
        </div>
      )}
    </div>
  );
};

const ValidationPanel = ({ treeData, fileContents }) => {
  const { validationResult, setValidationResult } = useDeploy();
  const [category, setCategory] = useState("ec-level");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deployedContractLink, setDeployedContractLink] = useState(() => {
    try {
      return sessionStorage.getItem(DEPLOY_LINK_STORAGE) || "";
    } catch {
      return "";
    }
  });
  /** Mirrors the input; updated in onChange before React re-renders so Validate uses the latest paste. */
  const deployedLinkDraftRef = useRef("");
  deployedLinkDraftRef.current = deployedContractLink;

  useEffect(() => {
    try {
      sessionStorage.setItem(DEPLOY_LINK_STORAGE, deployedContractLink);
    } catch {
      /* ignore */
    }
  }, [deployedContractLink]);

  const handleValidate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const files = collectProjectFiles(treeData, fileContents);
      const { raw: deployLinkRaw, source: deployLinkSource } = resolveDeployedLinkInput(
        deployedLinkDraftRef.current || "",
        files
      );
      // Derive repo name from root folder name
      const repoName = treeData?.[0]?.name || "";
      let result = await validateProject(files, category, repoName, {
        deployed_contract_link: deployLinkRaw,
      });
      if (category === "ec-level") {
        const deployChecks = await buildDeployedContractChecks(deployLinkRaw, {
          linkSource: deployLinkSource,
        });
        result = mergeValidationWithDeployChecks(result, deployChecks);
      }
      setValidationResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [treeData, fileContents, category]);

  const checks = validationResult?.checks || [];
  const passCount = checks.filter(c => c.status === "pass").length;
  const failCount = checks.filter(c => c.required && c.status === "fail").length;
  const warnCount = checks.filter(c => c.status === "warn").length;

  return (
    <div className="val-panel">
      <div className="val-toolbar">
        <select
          className="val-select"
          value={category}
          onChange={e => setCategory(e.target.value)}
        >
          <option value="ec-level">EC Level</option>
          <option value="full-stack">Full Stack</option>
        </select>
        <button className="deploy-btn deploy-btn-primary" onClick={handleValidate} disabled={loading}>
          {loading ? <Loader size={12} className="spin" /> : <ShieldCheck size={12} />}
          {loading ? "Validating..." : "Validate"}
        </button>
      </div>

      {category === "ec-level" && (
        <div className="val-deploy-link">
          <label className="val-deploy-label" htmlFor="val-deploy-url">
            <Link2 size={12} aria-hidden />
            Deployed contract (optional override)
          </label>
          <input
            id="val-deploy-url"
            type="text"
            className="val-deploy-input"
            placeholder="Leave empty to use README.md links"
            value={deployedContractLink}
            onChange={e => {
              deployedLinkDraftRef.current = e.target.value;
              setDeployedContractLink(e.target.value);
            }}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="val-deploy-hint">
            By default we read contract / deploy-tx links (or a C… ID) from your README.md. Fill this only to override that (e.g. quick test with a different ID).
          </p>
        </div>
      )}

      {error && <div className="deploy-error">{error}</div>}

      {validationResult && (
        <>
          <div className="val-summary">
            <span className={`val-status-badge ${validationResult.status}`}>
              {validationResult.status === "valid"
                ? <><ShieldCheck size={14} /> Valid</>
                : <><ShieldX size={14} /> Invalid</>}
            </span>
            <span className="val-count pass">{passCount} passed</span>
            {failCount > 0 && <span className="val-count fail">{failCount} failed</span>}
            {warnCount > 0 && <span className="val-count warn">{warnCount} warnings</span>}
          </div>

          <div className="val-checks">
            {GROUPS.map(g => (
              <CheckGroup key={g.id} group={g} checks={checks} />
            ))}
          </div>

          {validationResult.remarks && (
            <div className="val-remarks">
              <div className="val-remarks-title">DevRel Remarks</div>
              <pre className="val-remarks-body">{validationResult.remarks}</pre>
            </div>
          )}
        </>
      )}

      {!validationResult && !loading && (
        <div className="deploy-hint" style={{ padding: "16px" }}>
          Select a category and click Validate to check your project against the Stellar submission guide.
        </div>
      )}
    </div>
  );
};

export default ValidationPanel;
