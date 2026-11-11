window.__ModuleLoader__.load({ id: "dsh-science", factory: (require) => {
var module = { exports: {} };
var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// client-src/index.jsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react = __toESM(require("react"), 1);

// lib/dag.js
function normalizedBlockedBy(task) {
  const raw = task && Array.isArray(task.blockedBy) ? task.blockedBy : [];
  const self = task && typeof task.id === "string" ? task.id.trim() : null;
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!id || id === self || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
function normalizeTaskBoard(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  return list.filter((t) => t && typeof t === "object" && typeof t.id === "string").map((t) => ({ ...t, blockedBy: normalizedBlockedBy(t) }));
}
function dependencyClosure(startId, tasks) {
  const list = Array.isArray(tasks) ? tasks.filter((t) => t && typeof t.id === "string") : [];
  const byId = new Map(list.map((t) => [t.id, t]));
  const rev = /* @__PURE__ */ new Map();
  for (const t of list) {
    for (const dep of normalizedBlockedBy(t)) {
      if (!rev.has(dep)) rev.set(dep, []);
      rev.get(dep).push(t.id);
    }
  }
  const upstream = [];
  const downstream = [];
  const related = /* @__PURE__ */ new Set();
  if (!byId.has(startId)) return { upstream, downstream, related };
  related.add(startId);
  const walkUp = [startId];
  const seenUp = /* @__PURE__ */ new Set([startId]);
  for (let i = 0; i < walkUp.length; i++) {
    const t = byId.get(walkUp[i]);
    for (const dep of normalizedBlockedBy(t)) {
      if (!byId.has(dep) || seenUp.has(dep)) continue;
      seenUp.add(dep);
      upstream.push(dep);
      related.add(dep);
      walkUp.push(dep);
    }
  }
  const walkDown = [startId];
  const seenDown = /* @__PURE__ */ new Set([startId]);
  for (let i = 0; i < walkDown.length; i++) {
    for (const next of rev.get(walkDown[i]) || []) {
      if (seenDown.has(next)) continue;
      seenDown.add(next);
      downstream.push(next);
      related.add(next);
      walkDown.push(next);
    }
  }
  return { upstream, downstream, related };
}

// client-src/index.jsx
var import_jsx_runtime = require("react/jsx-runtime");
var inject = ["sidebarRightTabs", "slots", "resources"];
var VERSION = "0.11.0";
var STATE_URL = "/plugins/dsh-science/state";
var POLL_MS = 3e3;
var teamRuntime = { hasRecordedParents: false };
var MASCOT_BASE = "/plugins/dsh-science/assets/";
var LEAD_MASCOT = "lead.svg";
var mascotUrl = (file) => `${MASCOT_BASE}${file}?v=${VERSION}`;
var ROLE_MASCOT_FALLBACK = {
  "literature-scout": "scout.svg",
  "topic-designer": "designer.svg",
  simulator: "simulator.svg",
  trainer: "trainer.svg",
  "figure-expert": "figure.svg",
  writer: "writer.svg",
  reviewer: "reviewer.svg",
  analyst: "analyst.svg",
  presentation: "presentation.svg"
};
var C = {
  fg: "var(--dsw-alias-label-primary, inherit)",
  muted: "var(--dsw-alias-label-secondary, #888)",
  faint: "var(--dsw-alias-label-tertiary, #aaa)",
  accent: "var(--dsw-alias-state-business-primary, #1B6EC2)",
  ok: "var(--dsw-alias-state-success-primary, #009E73)",
  warn: "var(--dsw-alias-state-warn-primary, #E69F00)",
  err: "var(--dsw-alias-state-error-primary, #D55E00)",
  card: "var(--dsw-alias-bg-layer-1, rgba(127,127,127,0.08))",
  surface: "var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.18))",
  chip: "var(--dsw-alias-markdown-code-block, rgba(127,127,127,0.10))",
  border: "var(--dsw-alias-border-l1, rgba(127,127,127,0.25))",
  borderNode: "var(--dsw-alias-border-l4, rgba(127,127,127,0.4))",
  divider: "var(--dsw-alias-separator-primary, rgba(127,127,127,0.18))"
};
var STATUS_COLOR = {
  pending: C.warn,
  claimed: C.accent,
  in_progress: C.accent,
  completed: C.ok,
  failed: C.err,
  cancelled: C.faint,
  deleted: C.faint
};
var RESULT_STATUS_COLOR = {
  planned: C.muted,
  in_progress: C.accent,
  supported: C.ok,
  negative: C.err,
  dropped: C.faint
};
var RESULT_STATUS_LABEL = {
  planned: "\u8BA1\u5212",
  in_progress: "\u8FDB\u884C\u4E2D",
  supported: "\u5DF2\u652F\u6491",
  negative: "\u8D1F\u9762",
  dropped: "\u5DF2\u5F03"
};
var USED_AS_LABEL = {
  method: "\u65B9\u6CD5",
  concept: "\u6982\u5FF5",
  background: "\u80CC\u666F",
  evidence: "\u8BC1\u636E"
};
var SCREENING_LABEL = {
  include: "\u5FEB\u7B5B\xB7\u7EB3\u5165",
  exclude: "\u5FEB\u7B5B\xB7\u6392\u9664",
  maybe: "\u5FEB\u7B5B\xB7\u5F85\u5B9A"
};
var SCREENING_COLOR = {
  include: C.ok,
  exclude: C.err,
  maybe: C.warn
};
var LIVE_COLOR = {
  running: C.accent,
  idle: C.ok,
  "claimed/working": C.accent,
  offline: C.faint
};
var LIVE_LABEL = {
  running: "\u8FD0\u884C\u4E2D",
  idle: "\u7A7A\u95F2",
  "claimed/working": "\u5728\u529E",
  offline: "\u79BB\u7EBF"
};
var TERMINAL_STATUS = /* @__PURE__ */ new Set(["completed", "failed", "cancelled", "deleted"]);
function copyText(text) {
  try {
    navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
function fmtBytes(n) {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}
function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString();
}
function normPath(p) {
  return String(p || "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}
function pathInsideWorkspace(absPath, workspaceRoot) {
  if (!absPath || !workspaceRoot) return false;
  const p = normPath(absPath);
  const root = normPath(workspaceRoot);
  return p === root ? false : p.startsWith(`${root}/`);
}
function normalizeClientState(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const team = raw.team && typeof raw.team === "object" ? raw.team : { members: [], tasks: [] };
  return {
    ...raw,
    team: {
      ...team,
      members: (Array.isArray(team.members) ? team.members : []).filter(
        (m) => m && typeof m === "object" && typeof m.name === "string"
      ),
      tasks: normalizeTaskBoard(team.tasks)
    }
  };
}
function usePollState(intervalMs) {
  const [snap, setSnap] = (0, import_react.useState)({ data: null, error: null, loading: true, ts: 0 });
  const tickNow = (0, import_react.useCallback)(async (aliveObj) => {
    try {
      const res = await fetch(STATE_URL, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = normalizeClientState(await res.json());
      if (!aliveObj || aliveObj.alive) setSnap({ data, error: null, loading: false, ts: Date.now() });
    } catch (err) {
      if (!aliveObj || aliveObj.alive) setSnap((s) => ({ ...s, error: err, loading: false }));
    }
  }, []);
  (0, import_react.useEffect)(() => {
    const aliveObj = { alive: true };
    let timer = null;
    const loop = async () => {
      await tickNow(aliveObj);
      if (aliveObj.alive) timer = setTimeout(loop, intervalMs);
    };
    loop();
    return () => {
      aliveObj.alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [intervalMs, tickNow]);
  const refresh = (0, import_react.useCallback)(() => tickNow(null), [tickNow]);
  return { ...snap, refresh };
}
function DataGate({ state, children, fallback }) {
  if (state.loading && !state.data) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "\u52A0\u8F7D\u4E2D\u2026" });
  if (!state.data) {
    if (state.error) {
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "\u8FDE\u63A5\u6570\u636E\u901A\u9053\u5931\u8D25\uFF08web \u6863\u6848\u8BF7\u786E\u8BA4\u670D\u52A1\u5DF2\u542F\u52A8\uFF09\u3002" }),
        fallback
      ] });
    }
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "\u684C\u9762\u7248\u6570\u636E\u9762\u677F\u5F00\u53D1\u4E2D\uFF08\u539F\u751F\u56E2\u961F\u9762\u677F\u4E0E\u5168\u90E8\u56E2\u961F\u5DE5\u5177\u53EF\u7528\uFF09\u3002web \u6863\u6848\u4E0B\u6B64\u5904\u5C55\u793A\u5B9E\u65F6\u6570\u636E\u3002" }),
      fallback
    ] });
  }
  const content = typeof children === "function" ? children() : children;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    state.error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { style: { color: C.faint, fontSize: 10, margin: "0 0 4px" }, children: [
      "\u5237\u65B0\u5931\u8D25\uFF08",
      String(state.error && state.error.message),
      "\uFF09\uFF0C\u4EE5\u4E0B\u4E3A\u6700\u8FD1\u7F13\u5B58\u3002"
    ] }),
    content
  ] });
}
function Empty({ text, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { color: C.muted, fontSize: 12, margin: "4px 0", lineHeight: 1.6 }, children: children != null ? children : text });
}
function Dot({ color, pulse, size = 8 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "span",
    {
      style: {
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
        animation: pulse ? "dsh-sci-pulse 1.6s ease-in-out infinite" : void 0
      }
    }
  );
}
function MascotAvatar({ file, emoji, size = 26, overlay, style }) {
  const [failed, setFailed] = (0, import_react.useState)(false);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { position: "relative", display: "inline-flex", flexShrink: 0, width: size, height: size, ...style }, children: [
    failed || !file ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { width: "100%", textAlign: "center", fontSize: Math.round(size * 0.6), lineHeight: `${size}px` }, children: emoji || "\u{1F464}" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "img",
      {
        src: mascotUrl(file),
        alt: "",
        "aria-hidden": true,
        width: size,
        height: size,
        onError: () => setFailed(true),
        style: { display: "block", width: size, height: size }
      }
    ),
    overlay
  ] });
}
function ActionOverlay({ file, avatarSize = 26 }) {
  const [failed, setFailed] = (0, import_react.useState)(false);
  if (failed || !file) return null;
  const s = Math.max(10, Math.round(avatarSize * 0.48));
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "img",
    {
      src: mascotUrl(file),
      alt: "",
      "aria-hidden": true,
      onError: () => setFailed(true),
      style: { position: "absolute", right: -4, bottom: -3, width: s, height: s, filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.18))" }
    }
  );
}
function Panel({ title, children, extra }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { margin: "10px 0" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: `1px solid ${C.divider}`, paddingBottom: 3, marginBottom: 6 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", { style: { margin: 0, fontSize: 12, color: C.fg, letterSpacing: 0.3 }, children: title }),
      extra
    ] }),
    children
  ] });
}
function DepChip({ id }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
    display: "inline-block",
    padding: "0 6px",
    marginLeft: 4,
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: C.chip,
    fontSize: 10,
    lineHeight: "16px",
    color: C.muted,
    flexShrink: 0
  }, children: id });
}
function ResBadge({ id }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
    display: "inline-block",
    padding: "0 6px",
    marginLeft: 4,
    borderRadius: 8,
    border: `1px solid ${C.accent}`,
    fontSize: 10,
    lineHeight: "16px",
    color: C.accent,
    flexShrink: 0,
    fontFamily: "ui-monospace, monospace"
  }, children: id });
}
function CmdChip({ cmd }) {
  const [copied, setCopied] = (0, import_react.useState)(false);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "span",
    {
      onClick: () => {
        if (copyText(cmd)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }
      },
      title: `\u70B9\u51FB\u590D\u5236\u547D\u4EE4\uFF1A${cmd}`,
      style: {
        display: "inline-block",
        padding: "1px 8px",
        borderRadius: 9,
        border: `1px solid ${C.border}`,
        background: C.chip,
        fontSize: 10,
        lineHeight: "16px",
        color: C.muted,
        cursor: "pointer",
        fontFamily: "ui-monospace, monospace",
        flexShrink: 0
      },
      children: copied ? "\u5DF2\u590D\u5236 \u2713" : cmd
    }
  );
}
function ViewToggle({ view, graphValue, listValue, graphLabel, listLabel, onChange }) {
  const chip = (active) => ({
    padding: "1px 8px",
    borderRadius: 9,
    border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? C.accent : "transparent",
    color: active ? "#fff" : C.muted,
    fontSize: 10,
    lineHeight: "16px",
    cursor: "pointer",
    flexShrink: 0
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { display: "inline-flex", gap: 4 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => onChange(graphValue), style: chip(view === graphValue), children: graphLabel }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => onChange(listValue), style: chip(view === listValue), children: listLabel })
  ] });
}
function taskToneOf(status) {
  if (status === "claimed") return "claimed";
  if (status === "in_progress") return "running";
  if (status === "pending" || status == null) return "pending";
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return "cancelled";
}
var SEG_COLOR = {
  pending: C.warn,
  claimed: C.accent,
  running: C.accent,
  completed: C.ok,
  failed: C.err,
  cancelled: C.faint
};
function ProgressOverview({ tasks }) {
  const count = (st) => tasks.filter((t) => t.status === st).length;
  const pending = count("pending");
  const claimed = count("claimed");
  const running = count("in_progress");
  const completed = count("completed");
  const failed = count("failed");
  const cancelled = count("cancelled");
  const deleted = count("deleted");
  const tasksById = (0, import_react.useMemo)(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const blockedIds = tasks.filter((t) => (t.blockedBy || []).some((dep) => {
    const d = tasksById.get(dep);
    return d && !TERMINAL_STATUS.has(d.status);
  })).filter((t) => t.status === "pending" || t.status === "claimed").map((t) => t.id);
  const terminalAll = tasks.length > 0 && tasks.every((t) => TERMINAL_STATUS.has(t.status));
  let summaryText = "\u8FD8\u6CA1\u6709\u4EFB\u52A1\u2014\u2014\u8BA9\u961F\u957F sci_team_dispatch \u6D3E\u53D1\u7B2C\u4E00\u9879\u5DE5\u4F5C";
  let summaryTone = "running";
  if (tasks.length === 0) {
    summaryTone = "empty";
  } else if (terminalAll) {
    summaryText = `\u5168\u90E8\u7ED3\u675F\uFF1A\u5B8C\u6210 ${completed}${failed ? ` \xB7 \u5931\u8D25 ${failed}` : ""}${cancelled + deleted ? ` \xB7 \u53D6\u6D88/\u5220\u9664 ${cancelled + deleted}` : ""}`;
    summaryTone = failed > 0 ? "warning" : "completed";
  } else if (blockedIds.length > 0) {
    summaryText = `\u53D7\u963B ${blockedIds.slice(0, 2).join("\u3001")}${blockedIds.length > 2 ? ` \u7B49 ${blockedIds.length} \u9879\uFF08\u4F9D\u8D56\u672A\u5B8C\u6210\uFF09` : "\uFF08\u4F9D\u8D56\u672A\u5B8C\u6210\uFF09"}`;
    summaryTone = "warning";
  } else if (running > 0 || claimed > 0) {
    const act = tasks.filter((t) => t.status === "in_progress" || t.status === "claimed").map((t) => t.id);
    summaryText = `\u6267\u884C\u4E2D ${act.slice(0, 3).join("\u3001")}${act.length > 3 ? ` \u7B49 ${act.length} \u9879` : ""}`;
  } else if (pending > 0) {
    summaryText = `${pending} \u9879\u5F85\u9886\uFF08sci_team_dispatch \u6307\u6D3E\u6210\u5458\uFF09`;
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { margin: "8px 0 10px", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.card }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MascotAvatar, { file: LEAD_MASCOT, emoji: "\u{1F9D1}\u200D\u{1F52C}", size: 26 }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { style: { fontSize: 12, color: C.fg }, children: "\u79D1\u7814\u5C0F\u961F" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 10, color: C.muted }, children: "\u961F\u957F\u7EDF\u7B79 \xB7 \u6210\u5458\u6267\u884C" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        "aria-hidden": true,
        "data-progress-segments": "",
        style: {
          display: "flex",
          gap: 2,
          height: 6,
          borderRadius: 3,
          overflow: "hidden",
          background: tasks.length === 0 ? C.chip : "transparent"
        },
        children: tasks.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "data-state": taskToneOf(t.status), style: { flex: 1, background: SEG_COLOR[taskToneOf(t.status)] || C.faint } }, t.id))
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 7, fontSize: 12, color: C.fg }, "data-progress-legend": "", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { "data-state": "pending", style: { display: "inline-flex", alignItems: "center", gap: 4 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dot, { color: C.warn }),
        "\u5F85\u529E ",
        pending
      ] }),
      claimed > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { "data-state": "claimed", style: { display: "inline-flex", alignItems: "center", gap: 4 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dot, { color: C.accent }),
        "\u5DF2\u9886\u53D6 ",
        claimed
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { "data-state": "running", style: { display: "inline-flex", alignItems: "center", gap: 4 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dot, { color: C.accent }),
        "\u8FDB\u884C\u4E2D ",
        running
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { "data-state": "completed", style: { display: "inline-flex", alignItems: "center", gap: 4 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dot, { color: C.ok }),
        "\u5DF2\u5B8C\u6210 ",
        completed
      ] }),
      failed > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { "data-state": "failed", style: { display: "inline-flex", alignItems: "center", gap: 4 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dot, { color: C.err }),
        "\u5931\u8D25 ",
        failed
      ] }),
      cancelled > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { "data-state": "cancelled", style: { display: "inline-flex", alignItems: "center", gap: 4 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dot, { color: C.faint }),
        "\u5DF2\u53D6\u6D88 ",
        cancelled
      ] }),
      deleted > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { "data-state": "cancelled", style: { display: "inline-flex", alignItems: "center", gap: 4 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dot, { color: C.faint }),
        "\u5DF2\u5220\u9664 ",
        deleted
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        "data-progress-summary": "",
        "data-tone": summaryTone,
        style: { display: "flex", alignItems: "center", gap: 5, marginTop: 6, fontSize: 11, color: summaryTone === "warning" ? C.err : summaryTone === "completed" ? C.ok : C.muted },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dot, { color: summaryTone === "warning" ? C.err : summaryTone === "completed" ? C.ok : C.accent, size: 6 }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: summaryText })
        ]
      }
    )
  ] });
}
function mascotForMember(name, members, roles) {
  const m = (members || []).find((x) => x && x.name === name);
  if (!m) return null;
  const meta = (roles || {})[m.role];
  return meta && meta.mascot || ROLE_MASCOT_FALLBACK[m.role] || null;
}
function MemberStrip({ members, tasks, roles, memberLive, openMemberSession, memberOpenAvailable }) {
  const [expandedMember, setExpandedMember] = (0, import_react.useState)(null);
  const roleMetaOf = (m) => {
    const table = roles || {};
    if (m.role && table[m.role]) return table[m.role];
    return Object.values(table).find((r) => r && r.member === m.name) || {};
  };
  let openable = false;
  try {
    openable = typeof memberOpenAvailable === "function" ? !!memberOpenAvailable() : false;
  } catch {
    openable = false;
  }
  const expTaskList = expandedMember ? tasks.filter((t) => t.assignee === expandedMember) : [];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      "data-member-strip": "",
      style: { borderBottom: `1px solid ${C.divider}`, marginBottom: 8 },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", flexWrap: "wrap", gap: "4px 2px", padding: "2px 0 8px" }, children: members.map((m) => {
          const meta = roleMetaOf(m);
          const mascot = meta.mascot || ROLE_MASCOT_FALLBACK[m.role] || null;
          const live = memberLive && memberLive[m.name] || "offline";
          const owned = tasks.filter((t) => t.assignee === m.name && !TERMINAL_STATUS.has(t.status));
          const running = live === "running" || live === "claimed/working";
          const pose = running ? "working" : owned.length > 0 ? "thinking" : "idle";
          const offline = live === "offline";
          const poseLabel = pose === "working" ? "\u6B63\u5728\u6267\u884C" : pose === "thinking" ? "\u9886\u4E86\u4EFB\u52A1\u5F85\u5F00\u5DE5" : "\u6682\u65E0\u5728\u529E";
          const isExp = expandedMember === m.name;
          return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              "data-member-tile": "",
              "data-member-pose": pose,
              "data-live": live,
              onClick: openable ? () => {
                try {
                  openMemberSession(m);
                } catch {
                }
              } : void 0,
              title: `${m.name} \xB7 ${meta.label || m.label || ""} \xB7 ${LIVE_LABEL[live] || live} \xB7 ${poseLabel}\uFF08\u5728\u529E ${owned.length}\uFF09${openable ? " \xB7 \u70B9\u51FB\u5934\u50CF\u6253\u5F00\u4F1A\u8BDD" : ""}`,
              style: {
                width: 66,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
                padding: "3px 2px",
                borderRadius: 8,
                cursor: openable ? "pointer" : "default"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                  "span",
                  {
                    style: {
                      position: "relative",
                      display: "inline-flex",
                      filter: offline ? "grayscale(1)" : "none",
                      opacity: offline ? 0.55 : 1,
                      animation: running ? "dsh-sci-bob 1.4s ease-in-out infinite" : void 0
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        MascotAvatar,
                        {
                          file: mascot,
                          emoji: meta.icon,
                          size: 40,
                          overlay: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionOverlay, { file: pose === "working" ? "working.svg" : pose === "thinking" ? "thinking.svg" : null, avatarSize: 40 })
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "span",
                        {
                          style: {
                            position: "absolute",
                            right: -1,
                            top: -1,
                            width: 9,
                            height: 9,
                            borderRadius: "50%",
                            background: LIVE_COLOR[live] || C.faint,
                            border: "1.5px solid rgba(127,127,127,0.2)",
                            animation: running ? "dsh-sci-pulse 1.6s ease-in-out infinite" : void 0
                          }
                        }
                      )
                    ]
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { style: { fontSize: 10, color: C.fg, maxWidth: 62, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }, children: m.name }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 9, color: C.muted, maxWidth: 62, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }, title: meta.label || m.label || m.role || "", children: meta.label || m.label || m.role || "" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "span",
                  {
                    "data-member-state": "",
                    style: { fontSize: 9, color: LIVE_COLOR[live] || C.faint, lineHeight: "12px" },
                    title: `${LIVE_LABEL[live] || live} \xB7 ${poseLabel}`,
                    children: LIVE_LABEL[live] || live
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "span",
                  {
                    title: `\u5728\u529E\u4EFB\u52A1 ${owned.length} \u4E2A`,
                    style: {
                      minWidth: 16,
                      textAlign: "center",
                      padding: "0 4px",
                      borderRadius: 8,
                      fontSize: 9,
                      lineHeight: "14px",
                      color: owned.length > 0 ? "#fff" : C.muted,
                      background: owned.length > 0 ? running ? C.ok : C.accent : C.chip
                    },
                    children: owned.length
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "span",
                  {
                    "data-member-expand": isExp ? "open" : "closed",
                    onClick: (e) => {
                      e.stopPropagation();
                      setExpandedMember(isExp ? null : m.name);
                    },
                    title: isExp ? `\u6536\u8D77 ${m.name} \u7684\u4EFB\u52A1\u5217\u8868` : `\u5C55\u5F00 ${m.name} \u7684\u4EFB\u52A1\u5217\u8868\uFF08${tasks.filter((t) => t.assignee === m.name).length}\uFF09`,
                    style: { fontSize: 9, color: isExp ? C.accent : C.faint, cursor: "pointer", lineHeight: "12px", padding: "0 6px" },
                    children: isExp ? "\u25B4" : "\u25BE"
                  }
                )
              ]
            },
            m.name
          );
        }) }),
        expandedMember && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            "data-member-tasks": "",
            "data-member": expandedMember,
            style: { border: `1px solid ${C.divider}`, borderRadius: 8, background: C.chip, padding: "5px 8px", marginBottom: 8, fontSize: 11 },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { color: C.faint, marginBottom: 3 }, children: [
                expandedMember,
                " \u7684\u4EFB\u52A1\uFF08",
                expTaskList.length,
                "\uFF09\u2014\u2014\u70B9\u51FB\u6210\u5458\u5934\u50CF\u6253\u5F00\u4F1A\u8BDD"
              ] }),
              expTaskList.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "\u8BE5\u6210\u5458\u6682\u65E0\u4EFB\u52A1\u8BB0\u5F55\u3002" }),
              expTaskList.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "div",
                {
                  "data-member-task-row": t.id,
                  title: `${t.id} \xB7 ${t.subject || ""} \xB7 ${t.status}${t.result ? ` \xB7 \u56DE\u62A5\uFF1A${t.result}` : ""}`,
                  style: { display: "flex", alignItems: "center", gap: 5, padding: "2px 0", color: C.fg },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dot, { color: STATUS_COLOR[t.status] || C.faint, size: 6 }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DepChip, { id: t.id }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: t.subject || t.id }),
                    t.result && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { color: C.ok, fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 1 }, title: t.result, children: [
                      "\u21A9 ",
                      String(t.result).slice(0, 30)
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: C.faint, fontSize: 10, marginLeft: "auto", flexShrink: 0 }, children: fmtTime(t.updatedAt || t.createdAt) })
                  ]
                },
                t.id
              ))
            ]
          }
        )
      ]
    }
  );
}
var DAG_CAP = 18;
var DAG_NODE_W = 150;
var DAG_NODE_H = 50;
var DAG_COL_GAP = 54;
var DAG_ROW_GAP = 12;
var DAG_PAD_X = 10;
var DAG_HEAD_H = 24;
var DAG_COLS = [
  { label: "\u5F85\u529E", color: C.warn },
  { label: "\u8FDB\u884C\u4E2D", color: C.accent },
  { label: "\u5DF2\u5B8C\u6210", color: C.ok },
  { label: "\u5DF2\u7ED3\u675F", color: C.faint }
];
function statusColIndex(status) {
  if (status === "claimed" || status === "in_progress") return 1;
  if (status === "completed") return 2;
  if (status === "pending" || status == null) return 0;
  return 3;
}
var DAG_COL_QUOTAS = [6, 6, 4, 2];
var DAG_ENDED_RESERVE = 2;
function depDepthOf(tasksById, id, memo, stack) {
  if (memo.has(id)) return memo.get(id);
  if (stack.has(id)) return 0;
  stack.add(id);
  const t = tasksById.get(id);
  let d = 0;
  if (t && Array.isArray(t.blockedBy)) {
    for (const dep of t.blockedBy) {
      const dd = depDepthOf(tasksById, dep, memo, stack);
      if (dd + 1 > d) d = dd + 1;
    }
  }
  stack.delete(id);
  memo.set(id, d);
  return d;
}
function dagNumId(t) {
  const m = /(\d+)/.exec(String(t.id));
  return m ? parseInt(m[1], 10) : 0;
}
function dagEdgePath(a, b) {
  if (b.col > a.col) {
    const x12 = a.x + DAG_NODE_W;
    const y12 = a.y + DAG_NODE_H / 2;
    const x22 = b.x;
    const y22 = b.y + DAG_NODE_H / 2;
    const dx = Math.max(18, (x22 - x12) / 2);
    return `M${x12} ${y12}C${x12 + dx} ${y12},${x22 - dx} ${y22},${x22} ${y22}`;
  }
  if (b.col < a.col) {
    const x12 = a.x;
    const y12 = a.y + DAG_NODE_H / 2;
    const x22 = b.x + DAG_NODE_W;
    const y22 = b.y + DAG_NODE_H / 2;
    const dx = Math.max(18, (x12 - x22) / 2);
    return `M${x12} ${y12}C${x12 - dx} ${y12},${x22 + dx} ${y22},${x22} ${y22}`;
  }
  const x1 = a.x + DAG_NODE_W / 2;
  const y1 = a.y + DAG_NODE_H;
  const x2 = b.x + DAG_NODE_W / 2;
  const y2 = b.y;
  if (y2 >= y1) {
    const dy2 = Math.max(16, (y2 - y1) / 2);
    return `M${x1} ${y1}C${x1} ${y1 + dy2},${x2} ${y2 - dy2},${x2} ${y2}`;
  }
  const dy = Math.max(16, (y1 - y2) / 2);
  return `M${x1} ${y1}C${x1} ${y1 - dy},${x2} ${y2 + dy},${x2} ${y2}`;
}
function dependentsMapOf(tasks) {
  const map = /* @__PURE__ */ new Map();
  for (const t of tasks) {
    if (!t) continue;
    for (const dep of Array.isArray(t.blockedBy) ? t.blockedBy : []) {
      if (!map.has(dep)) map.set(dep, []);
      map.get(dep).push(t.id);
    }
  }
  return map;
}
function dagLayout(tasks, ensureId, cap) {
  const maxNodes = typeof cap === "number" ? cap : DAG_CAP;
  const tasksById = new Map(tasks.map((t) => [t.id, t]));
  const depthMemo = /* @__PURE__ */ new Map();
  const wrapped = tasks.map((t) => ({
    t,
    col: statusColIndex(t.status),
    depth: depDepthOf(tasksById, t.id, depthMemo, /* @__PURE__ */ new Set())
  }));
  const wrapById = new Map(wrapped.map((w) => [w.t.id, w]));
  const byCol = [[], [], [], []];
  for (const w of wrapped) byCol[w.col].push(w);
  byCol.forEach((list) => list.sort((a, b) => a.depth - b.depth || dagNumId(a.t) - dagNumId(b.t)));
  const colTotals = [0, 0, 0, 0];
  for (const w of wrapped) colTotals[w.col] += 1;
  const dependentsOf = dependentsMapOf(tasks);
  const chosen = [];
  const chosenSet = /* @__PURE__ */ new Set();
  const counts = [0, 0, 0, 0];
  const push = (w, ignoreQuota) => {
    if (!w || chosenSet.has(w.t.id) || chosen.length >= maxNodes) return;
    if (!ignoreQuota && counts[w.col] >= DAG_COL_QUOTAS[w.col]) return;
    chosen.push(w);
    chosenSet.add(w.t.id);
    counts[w.col] += 1;
  };
  const coreCap = Math.max(0, maxNodes - DAG_ENDED_RESERVE);
  const isActiveId = (id) => {
    const t = tasksById.get(id);
    return !!t && !TERMINAL_STATUS.has(t.status);
  };
  const seeds = wrapped.filter((w) => w.col === 0 || w.col === 1).sort((a, b) => a.depth - b.depth || dagNumId(a.t) - dagNumId(b.t)).map((w) => w.t.id);
  const queue = [];
  const queued = /* @__PURE__ */ new Set();
  for (const id of seeds) {
    queue.push(id);
    queued.add(id);
  }
  while (queue.length && chosen.length < coreCap) {
    const id = queue.shift();
    push(wrapById.get(id), true);
    const t = tasksById.get(id);
    if (!t) continue;
    const next = [];
    for (const dep of Array.isArray(t.blockedBy) ? t.blockedBy : []) {
      if (!queued.has(dep)) {
        queued.add(dep);
        next.push(dep);
      }
    }
    for (const depId of dependentsOf.get(id) || []) {
      if (!queued.has(depId)) {
        queued.add(depId);
        next.push(depId);
      }
    }
    next.sort((x, y) => (isActiveId(y) ? 1 : 0) - (isActiveId(x) ? 1 : 0));
    queue.push(...next);
  }
  for (const w of byCol[3]) {
    if (chosen.length >= maxNodes || counts[3] >= DAG_ENDED_RESERVE) break;
    push(w);
  }
  while (chosen.length < maxNodes) {
    let added = false;
    for (const c of [2, 3, 0, 1]) {
      if (chosen.length >= maxNodes) break;
      const w = byCol[c].find((x) => !chosenSet.has(x.t.id));
      if (w) {
        chosen.push(w);
        chosenSet.add(w.t.id);
        counts[c] += 1;
        added = true;
      }
    }
    if (!added) break;
  }
  if (ensureId && !chosenSet.has(ensureId)) {
    const w = wrapById.get(ensureId);
    if (w) {
      if (chosen.length >= maxNodes && chosen.length > 0) {
        const evicted = chosen.pop();
        chosenSet.delete(evicted.t.id);
        counts[evicted.col] -= 1;
      }
      chosen.push(w);
      chosenSet.add(w.t.id);
      counts[w.col] += 1;
    }
  }
  const colLists = [[], [], [], []];
  for (const w of chosen) colLists[w.col].push(w);
  const nodes = [];
  colLists.forEach((list, c) => {
    list.forEach((w, row) => {
      nodes.push({ w, col: c, x: DAG_PAD_X + c * (DAG_NODE_W + DAG_COL_GAP), y: DAG_HEAD_H + row * (DAG_NODE_H + DAG_ROW_GAP) });
    });
  });
  const posById = new Map(nodes.map((n) => [n.w.t.id, n]));
  const edges = [];
  const edgeSeen = /* @__PURE__ */ new Set();
  for (const n of nodes) {
    for (const dep of Array.isArray(n.w.t.blockedBy) ? n.w.t.blockedBy : []) {
      const key = `${dep}->${n.w.t.id}`;
      if (edgeSeen.has(key)) continue;
      edgeSeen.add(key);
      const s = posById.get(dep);
      if (!s) continue;
      const depTask = tasksById.get(dep);
      edges.push({ from: dep, to: n.w.t.id, d: dagEdgePath(s, n), active: depTask ? !TERMINAL_STATUS.has(depTask.status) : true });
    }
  }
  const rows = Math.max(1, ...colLists.map((l) => l.length));
  const width = DAG_PAD_X * 2 + DAG_COLS.length * DAG_NODE_W + (DAG_COLS.length - 1) * DAG_COL_GAP;
  const height = DAG_HEAD_H + rows * (DAG_NODE_H + DAG_ROW_GAP) - DAG_ROW_GAP + 6;
  return { nodes, edges, width, height, hidden: tasks.length - chosen.length, colCounts: colTotals, tasksById };
}
function TaskDetailCard({ t, tasksById, onJumpTask, chain }) {
  if (!t) return null;
  const deps = Array.isArray(t.blockedBy) ? t.blockedBy : [];
  const unfinishedDeps = deps.filter((dep) => {
    const depTask = tasksById.get(dep);
    return depTask ? !TERMINAL_STATUS.has(depTask.status) : false;
  });
  const blocked = unfinishedDeps.length > 0;
  const jumpable = typeof onJumpTask === "function";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      "data-task-detail": t.id,
      style: {
        border: `1px solid ${C.divider}`,
        borderRadius: 8,
        padding: "6px 10px",
        marginBottom: 4,
        background: C.chip,
        fontSize: 11,
        color: C.muted,
        lineHeight: 1.6
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { color: C.faint }, children: [
          t.id,
          " \xB7 \u72B6\u6001 ",
          t.status,
          " \xB7 \u8D1F\u8D23\u4EBA ",
          t.assignee || "\u5F85\u9886",
          t.resultId ? ` \xB7 \u5BF9\u9F50 ${t.resultId}` : ""
        ] }),
        deps.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginTop: 4, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: C.faint, flexShrink: 0 }, children: "\u4F9D\u8D56\uFF1A" }),
          deps.map((dep) => {
            const depTask = tasksById.get(dep);
            const depOpen = depTask ? !TERMINAL_STATUS.has(depTask.status) : true;
            return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "span",
              {
                "data-dep-chip": dep,
                onClick: (e) => {
                  e.stopPropagation();
                  if (jumpable) {
                    try {
                      onJumpTask(dep);
                    } catch {
                    }
                  }
                },
                title: depTask ? `${dep} \xB7 ${depTask.subject || ""} \xB7 ${depTask.status} \xB7 \u70B9\u51FB${jumpable ? "\u8DF3\u8F6C" : "\u67E5\u770B"}` : `${dep}\uFF08\u4E0D\u5728\u4EFB\u52A1\u677F\u4E0A\uFF09`,
                style: {
                  display: "inline-block",
                  padding: "0 6px",
                  borderRadius: 8,
                  border: `1px solid ${depOpen ? C.warn : C.border}`,
                  background: C.card,
                  fontSize: 10,
                  lineHeight: "16px",
                  color: depOpen ? C.warn : C.muted,
                  cursor: jumpable ? "pointer" : "default",
                  fontFamily: "ui-monospace, monospace"
                },
                children: [
                  dep,
                  depOpen ? " \u23F3" : " \u2713"
                ]
              },
              dep
            );
          })
        ] }),
        t.desc && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { whiteSpace: "pre-wrap", marginTop: 4, color: C.fg }, children: t.desc }),
        chain && chain.downstream.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            "data-task-downstream": chain.downstream.join(","),
            style: { marginTop: 3, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: C.faint, flexShrink: 0 }, children: "\u89E3\u9501\uFF1A" }),
              chain.downstream.map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "span",
                {
                  onClick: (e) => {
                    e.stopPropagation();
                    if (jumpable) {
                      try {
                        onJumpTask(id);
                      } catch {
                      }
                    }
                  },
                  title: jumpable ? `\u70B9\u51FB\u8DF3\u8F6C\u5230 ${id}` : id,
                  style: {
                    display: "inline-block",
                    padding: "0 6px",
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    background: C.card,
                    fontSize: 10,
                    lineHeight: "16px",
                    color: C.muted,
                    cursor: jumpable ? "pointer" : "default",
                    fontFamily: "ui-monospace, monospace"
                  },
                  children: id
                },
                id
              ))
            ]
          }
        ),
        t.result && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { whiteSpace: "pre-wrap", marginTop: 4 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { style: { color: C.ok }, children: "\u7ED3\u679C\uFF1A" }),
          t.result
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginTop: 4, color: C.faint }, children: [
          "\u521B\u5EFA ",
          fmtTime(t.createdAt) || "\u2014",
          t.claimedAt ? ` \xB7 \u9886\u53D6 ${fmtTime(t.claimedAt)}` : "",
          t.updatedAt ? ` \xB7 \u66F4\u65B0 ${fmtTime(t.updatedAt)}` : ""
        ] })
      ]
    }
  );
}
function TaskDag({ tasks, members, roles, focusTaskId, onClearFocus }) {
  const [sel, setSel] = (0, import_react.useState)(null);
  const [hoverId, setHoverId] = (0, import_react.useState)(null);
  const [expandedAll, setExpandedAll] = (0, import_react.useState)(false);
  const uidRef = (0, import_react.useRef)("");
  if (!uidRef.current) uidRef.current = `dshsci-${Math.random().toString(36).slice(2, 8)}`;
  const uid = uidRef.current;
  const focusId = sel || hoverId || null;
  const chain = (0, import_react.useMemo)(() => focusId ? dependencyClosure(focusId, tasks) : null, [focusId, tasks]);
  const related = chain ? chain.related : null;
  (0, import_react.useEffect)(() => {
    if (!sel) return void 0;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setSel(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sel]);
  const layout = (0, import_react.useMemo)(
    () => dagLayout(tasks, focusTaskId || sel || null, expandedAll ? Infinity : DAG_CAP),
    [tasks, focusTaskId, sel, expandedAll]
  );
  (0, import_react.useEffect)(() => {
    if (!hoverId) return;
    if (!layout.nodes.some((n) => n.w.t.id === hoverId)) setHoverId(null);
  }, [layout, hoverId]);
  const vpRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    try {
      const el = vpRef.current;
      if (el && layout.width) el.scrollLeft = Math.max(0, layout.width - el.clientWidth);
    } catch {
    }
  }, [expandedAll, layout.width]);
  (0, import_react.useEffect)(() => {
    if (!focusTaskId) return void 0;
    setSel(focusTaskId);
    const timer = setTimeout(() => {
      try {
        const el = document.querySelector(`[data-dag-node="${focusTaskId}"]`);
        if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      } catch {
      }
      if (typeof onClearFocus === "function") onClearFocus();
    }, 120);
    return () => clearTimeout(timer);
  }, [focusTaskId]);
  const memberByName = (0, import_react.useMemo)(() => new Map((members || []).map((m) => [m.name, m])), [members]);
  const ownerMascotOf = (assignee) => {
    const m = memberByName.get(assignee);
    if (!m) return null;
    const meta = (roles || {})[m.role];
    return meta && meta.mascot || ROLE_MASCOT_FALLBACK[m.role] || null;
  };
  const jumpToTask = (0, import_react.useCallback)((id) => {
    if (!id) return;
    setSel(id);
    const attempt = (n) => {
      setTimeout(() => {
        try {
          const el = document.querySelector(`[data-dag-node="${id}"]`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
            return;
          }
        } catch {
        }
        if (n === 0) {
          setExpandedAll(true);
          attempt(1);
        }
      }, 60);
    };
    attempt(0);
  }, []);
  const selTask = sel ? layout.tasksById.get(sel) : null;
  if (tasks.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { textAlign: "center", padding: "8px 6px 4px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MascotAvatar, { file: LEAD_MASCOT, emoji: "\u{1F9D1}\u200D\u{1F52C}", size: 44, style: { display: "inline-flex" } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "\u6682\u65E0\u4EFB\u52A1\u3002\u961F\u957F\u7528 sci_team_dispatch \u6D3E\u53D1\uFF0C\u6210\u5458\u4F1A\u81EA\u52A8\u88AB\u5524\u9192\u6267\u884C\u3002" })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        "data-dag-viewport": "",
        ref: vpRef,
        style: { maxHeight: 380, overflow: "auto", border: `1px solid ${C.divider}`, borderRadius: 8, background: C.card, position: "relative" },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { "data-dag-canvas": "", "data-dag-focus": focusId || void 0, style: { position: "relative", width: layout.width, height: layout.height }, children: [
          DAG_COLS.map((c, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              "data-dag-col": c.label,
              style: {
                position: "absolute",
                left: DAG_PAD_X + i * (DAG_NODE_W + DAG_COL_GAP),
                top: 4,
                width: DAG_NODE_W,
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 10,
                color: C.muted
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dot, { color: c.color, size: 6 }),
                c.label,
                " ",
                layout.colCounts[i]
              ]
            },
            c.label
          )),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "svg",
            {
              "data-dag-edges": "",
              width: layout.width,
              height: layout.height,
              style: { position: "absolute", left: 0, top: 0, pointerEvents: "none" },
              "aria-hidden": true,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("defs", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("marker", { id: `${uid}-arrow-a`, viewBox: "0 0 8 8", refX: "7", refY: "4", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M0 0 L8 4 L0 8 Z", style: { fill: C.accent } }) }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("marker", { id: `${uid}-arrow-f`, viewBox: "0 0 8 8", refX: "7", refY: "4", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M0 0 L8 4 L0 8 Z", style: { fill: C.faint } }) })
                ] }),
                layout.edges.map((e) => {
                  const hot = related !== null && related.has(e.from) && related.has(e.to);
                  const dimmed = related !== null && !hot;
                  const strong = hot || related === null && e.active;
                  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    "path",
                    {
                      "data-dag-edge": `${e.from}->${e.to}`,
                      "data-dag-hot": hot ? "true" : void 0,
                      d: e.d,
                      fill: "none",
                      style: { stroke: strong ? C.accent : C.faint, pointerEvents: "stroke" },
                      strokeWidth: strong ? 1.8 : 1,
                      strokeDasharray: e.active ? void 0 : "3 3",
                      opacity: dimmed ? 0.18 : strong ? 0.95 : 0.55,
                      markerEnd: strong ? `url(#${uid}-arrow-a)` : `url(#${uid}-arrow-f)`,
                      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("title", { children: `${e.from} \u2192 ${e.to} \u4F9D\u8D56` })
                    },
                    `${e.from}->${e.to}`
                  );
                })
              ]
            }
          ),
          layout.nodes.map(({ w, x, y, col }) => {
            const t = w.t;
            const isSel = sel === t.id;
            const isFocus = focusId === t.id;
            const dimmed = related !== null && !related.has(t.id);
            const running = t.status === "claimed" || t.status === "in_progress";
            const color = STATUS_COLOR[t.status] || C.faint;
            return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "div",
              {
                "data-dag-node": t.id,
                "data-status": t.status,
                "data-col": DAG_COLS[col].label,
                "data-dag-focus": isFocus ? "true" : void 0,
                "data-dag-dimmed": dimmed ? "true" : void 0,
                onClick: () => setSel(isSel ? null : t.id),
                onMouseEnter: () => setHoverId(t.id),
                onMouseLeave: () => setHoverId((cur) => cur === t.id ? null : cur),
                onFocus: () => setHoverId(t.id),
                onBlur: () => setHoverId((cur) => cur === t.id ? null : cur),
                tabIndex: 0,
                title: `${t.id} \xB7 ${t.subject || ""} \xB7 ${t.assignee || "\u5F85\u9886"} \xB7 \u60AC\u505C\u9AD8\u4EAE\u4F9D\u8D56\u94FE\uFF0C\u70B9\u51FB${isSel ? "\u6536\u8D77" : "\u5C55\u5F00"}\u8BE6\u60C5`,
                style: {
                  position: "absolute",
                  left: x,
                  top: y,
                  width: DAG_NODE_W,
                  height: DAG_NODE_H,
                  // F2：节点用更高层 surface（bg-layer-2）+ border-l4 边框（暗色 alpha 0.2 ≥ 0.18）
                  border: `1px solid ${isFocus ? C.accent : C.borderNode}`,
                  borderLeft: `3px solid ${color}`,
                  borderRadius: 8,
                  background: isSel ? C.chip : C.surface,
                  padding: "3px 6px",
                  cursor: "pointer",
                  outline: "none",
                  opacity: dimmed ? 0.32 : 1,
                  transition: "opacity 0.12s ease",
                  animation: running ? "dsh-sci-nodeglow 2.2s ease-in-out infinite" : void 0
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 4, height: 15 }, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 9, color: C.faint, fontFamily: "ui-monospace, monospace", flexShrink: 0 }, children: t.id }),
                    t.result && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { title: `\u6709\u56DE\u62A5\u6458\u8981\uFF1A${String(t.result).slice(0, 80)}`, style: { fontSize: 9, color: C.ok, flexShrink: 0 }, children: "\u21A9" }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 3, maxWidth: DAG_NODE_W - 46, overflow: "hidden" }, children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 9, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: t.assignee || "\u5F85\u9886" }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MascotAvatar, { file: ownerMascotOf(t.assignee), emoji: "\u{1F464}", size: 13 })
                    ] })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    "div",
                    {
                      style: {
                        fontSize: 11,
                        color: C.fg,
                        lineHeight: "13px",
                        height: 26,
                        marginTop: 1,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        wordBreak: "break-all"
                      },
                      children: t.subject || t.id
                    }
                  )
                ]
              },
              t.id
            );
          })
        ] })
      }
    ),
    layout.hidden > 0 ? (
      // F6：可点击展开全部隐藏节点（CAP 切至全量）
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { textAlign: "center", padding: "3px 0 0" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "button",
        {
          "data-dag-expand": "",
          onClick: () => setExpandedAll(true),
          title: "\u70B9\u51FB\u5C55\u5F00\u5168\u90E8\u4EFB\u52A1\u8282\u70B9",
          style: {
            fontSize: 10,
            color: C.accent,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "2px 8px",
            textDecoration: "underline"
          },
          children: [
            "+",
            layout.hidden,
            " \u66F4\u591A\uFF08\u70B9\u51FB\u5C55\u5F00\u5168\u90E8\uFF09"
          ]
        }
      ) })
    ) : expandedAll && tasks.length > DAG_CAP && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { textAlign: "center", padding: "3px 0 0" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "button",
      {
        "data-dag-collapse": "",
        onClick: () => setExpandedAll(false),
        title: "\u6536\u8D77\uFF0C\u56DE\u5230 18 \u8282\u70B9\u6982\u89C8",
        style: {
          fontSize: 10,
          color: C.muted,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "2px 8px",
          textDecoration: "underline"
        },
        children: [
          "\u6536\u8D77\uFF08\u5DF2\u5C55\u5F00\u5168\u90E8 ",
          tasks.length,
          " \u4E2A\u8282\u70B9\uFF09"
        ]
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { marginTop: 6 }, "data-task-detail-host": "", children: selTask ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TaskDetailCard, { t: selTask, tasksById: layout.tasksById, onJumpTask: jumpToTask, chain }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "\u60AC\u505C\u8282\u70B9\u9AD8\u4EAE\u4E0A\u4E0B\u6E38\u4F9D\u8D56\u94FE\uFF0C\u70B9\u51FB\u67E5\u770B\u8BE6\u60C5\uFF08\u63CF\u8FF0/\u7ED3\u679C/\u4F9D\u8D56/\u89E3\u9501\uFF09\uFF0CEsc \u6536\u8D77\uFF1B\u4F9D\u8D56\u4E0E\u89E3\u9501 chip \u53EF\u70B9\u51FB\u8DF3\u8F6C\uFF1B\u70B9\u51FB\u4E0A\u65B9\u6210\u5458\u5934\u50CF\u6253\u5F00\u4F1A\u8BDD\u3002" }) })
  ] });
}
function TaskBoard({ tasks, focusTaskId, onClearFocus }) {
  const [expanded, setExpanded] = (0, import_react.useState)(() => /* @__PURE__ */ new Set());
  const toggle = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  (0, import_react.useEffect)(() => {
    if (!focusTaskId) return void 0;
    setExpanded((prev) => {
      if (prev.has(focusTaskId)) return prev;
      const next = new Set(prev);
      next.add(focusTaskId);
      return next;
    });
    const timer = setTimeout(() => {
      try {
        const el = document.querySelector(`[data-task-row="${focusTaskId}"]`);
        if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
      }
      if (typeof onClearFocus === "function") onClearFocus();
    }, 120);
    return () => clearTimeout(timer);
  }, [focusTaskId]);
  if (tasks.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { textAlign: "center", padding: "8px 6px 4px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MascotAvatar, { file: LEAD_MASCOT, emoji: "\u{1F9D1}\u200D\u{1F52C}", size: 44, style: { display: "inline-flex" } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "\u6682\u65E0\u4EFB\u52A1\u3002\u961F\u957F\u7528 sci_team_dispatch \u6D3E\u53D1\uFF0C\u6210\u5458\u4F1A\u81EA\u52A8\u88AB\u5524\u9192\u6267\u884C\u3002" })
    ] });
  }
  const tasksById = new Map(tasks.map((t) => [t.id, t]));
  const jumpToTask = (id) => {
    if (!id || !tasksById.has(id)) return;
    setExpanded((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setTimeout(() => {
      try {
        const el = document.querySelector(`[data-task-row="${id}"]`);
        if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
      }
    }, 60);
  };
  const rows = [...tasks].sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)).slice(0, 20);
  if (focusTaskId) {
    const focusTask = tasks.find((t) => t && t.id === focusTaskId);
    if (focusTask && !rows.some((t) => t.id === focusTaskId)) rows.unshift(focusTask);
  }
  const hidden = tasks.length - rows.length;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    rows.map((t) => {
      const isOpen = expanded.has(t.id);
      const unfinishedDeps = (t.blockedBy || []).filter((dep) => {
        const depTask = tasksById.get(dep);
        return depTask ? !TERMINAL_STATUS.has(depTask.status) : false;
      });
      const blocked = unfinishedDeps.length > 0;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            "data-task-row": t.id,
            onClick: () => toggle(t.id),
            title: `${t.id} \xB7 \u70B9\u51FB${isOpen ? "\u6536\u8D77" : "\u5C55\u5F00"}\u8BE6\u60C5`,
            style: {
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 8px",
              marginBottom: 4,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              background: C.card,
              fontSize: 12,
              cursor: "pointer"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dot, { color: blocked ? C.faint : STATUS_COLOR[t.status] || C.faint, size: 7 }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DepChip, { id: t.id }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { style: { color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "0 1 auto" }, children: t.subject || t.id }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: C.muted, fontSize: 11, flexShrink: 0 }, children: t.assignee || "\u5F85\u9886" }),
              t.resultId && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResBadge, { id: t.resultId }),
              t.result && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "span",
                {
                  title: `\u56DE\u62A5\u6458\u8981\uFF1A${t.result}`,
                  style: { color: C.ok, fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 1, minWidth: 0 },
                  children: [
                    "\u21A9 ",
                    String(t.result).slice(0, 40)
                  ]
                }
              ),
              blocked && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DepChip, { id: "\u963B\u585E" }),
              (t.blockedBy || []).length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { display: "inline-flex", flexShrink: 0 }, children: (t.blockedBy || []).slice(0, 3).map((dep) => {
                const depTask = tasksById.get(dep);
                const depOpen = depTask ? !TERMINAL_STATUS.has(depTask.status) : true;
                return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                  "span",
                  {
                    "data-row-dep-chip": dep,
                    onClick: (e) => {
                      e.stopPropagation();
                      jumpToTask(dep);
                    },
                    title: `${dep}${depTask ? ` \xB7 ${depTask.status}` : ""} \xB7 \u70B9\u51FB\u8DF3\u8F6C\u8BE5\u4EFB\u52A1`,
                    style: {
                      display: "inline-block",
                      padding: "0 6px",
                      marginLeft: 4,
                      borderRadius: 8,
                      border: `1px solid ${depOpen ? C.warn : C.border}`,
                      fontSize: 10,
                      lineHeight: "16px",
                      color: depOpen ? C.warn : C.muted,
                      cursor: "pointer",
                      fontFamily: "ui-monospace, monospace",
                      flexShrink: 0
                    },
                    children: [
                      dep,
                      depOpen ? " \u23F3" : ""
                    ]
                  },
                  dep
                );
              }) }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: C.faint, fontSize: 10, marginLeft: "auto", flexShrink: 0 }, children: fmtTime(t.updatedAt || t.createdAt) }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: C.faint, fontSize: 10, flexShrink: 0 }, children: isOpen ? "\u25BE" : "\u25B8" })
            ]
          }
        ),
        isOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TaskDetailCard, { t, tasksById, onJumpTask: jumpToTask })
      ] }, t.id);
    }),
    hidden > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { textAlign: "center", fontSize: 11, color: C.faint, padding: "2px 0 6px" }, children: [
      "\u8FD8\u6709 ",
      hidden,
      " \u6761\u2026"
    ] })
  ] });
}
function CaptainInbox({ tasks, members, roles }) {
  const reports = (tasks || []).filter((t) => t && typeof t.result === "string" && t.result.trim() && t.status !== "deleted").sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)).slice(0, 8);
  if (reports.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { textAlign: "center", padding: "6px 4px 2px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MascotAvatar, { file: LEAD_MASCOT, emoji: "\u{1F9D1}\u200D\u{1F52C}", size: 36, style: { display: "inline-flex" } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "\u6536\u4EF6\u7BB1\u7A7A\u3002\u6210\u5458\u5B8C\u6210\u4EFB\u52A1\u5E76\u56DE\u62A5\u540E\uFF0C\u961F\u957F\u7528 sci_team_update_task \u8BB0\u5F55 result_note\uFF0C\u56DE\u62A5\u6458\u8981\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002" })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { "data-captain-inbox": "", children: reports.map((t) => {
    const mascot = mascotForMember(t.assignee, members, roles);
    const member = (members || []).find((x) => x && x.name === t.assignee);
    const emoji = member ? ((roles || {})[member.role] || {}).icon : void 0;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        "data-inbox-row": t.id,
        title: `${t.assignee || "\u5F85\u9886"} \xB7 ${t.subject || ""} \xB7 ${t.status} \xB7 ${t.result}`,
        style: {
          display: "flex",
          alignItems: "flex-start",
          gap: 6,
          padding: "4px 8px",
          marginBottom: 4,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          background: C.card,
          fontSize: 11
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MascotAvatar, { file: mascot, emoji, size: 20, style: { marginTop: 1 } }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { minWidth: 0, flex: 1 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 5 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { style: { color: C.fg, flexShrink: 0 }, children: t.assignee || "\u5F85\u9886" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DepChip, { id: t.id }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dot, { color: STATUS_COLOR[t.status] || C.faint, size: 6 }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: C.faint, fontSize: 10, marginLeft: "auto", flexShrink: 0 }, children: fmtTime(t.updatedAt || t.createdAt) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { color: C.fg, whiteSpace: "pre-wrap", marginTop: 2, lineHeight: 1.5 }, children: [
              String(t.result).slice(0, 160),
              String(t.result).length > 160 ? "\u2026" : ""
            ] })
          ] })
        ]
      },
      t.id
    );
  }) });
}
var SKILL_MANAGE_URL = "/plugins/dsh-science/skill-manage";
var SKILL_CATALOG_FALLBACK = {
  simulator: ["kdense-cantera", "academicforge-compute-env", "scimate-hpc-openfoam"],
  trainer: ["hf-llm-trainer", "orchestra-fine-tuning", "kdense-pytorch-lightning"],
  "literature-scout": ["kdense-bgpt-paper-search", "kdense-exa-search", "paper-search-pro"],
  writer: ["research-paper-writing", "ai-research-writing", "orchestra-paper-writing"],
  "figure-expert": ["academicforge-sci-viz", "paperbanana", "agent-figure-gallery"],
  reviewer: ["ars-paper-reviewer", "manuscript-review", "ai-peer-review"],
  analyst: ["kdense-eda", "hf-datasets", "kdense-dask"],
  "topic-designer": ["orchestra-ideation", "kdense-experimental-design", "academic-research-agent"],
  presentation: ["open-kimi-ppt", "thesis-defense-pptx", "beamer-academic"]
};
function SkillMenuDesktopFallback() {
  const roleLabels = ROLE_LABEL_FALLBACK;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { style: { margin: "6px 0", fontSize: 12 }, "data-skill-fallback": true, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { style: { cursor: "pointer", color: C.muted }, children: "\u89D2\u8272\u6280\u80FD\u5E93\u5B89\u88C5\u547D\u4EE4\uFF08\u684C\u9762\u7248\u964D\u7EA7\uFF09" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { color: C.faint, fontSize: 10, margin: "4px 0" }, children: "\u6BCF\u89D2\u8272 \u22643 \u4E2A\u7CBE\u9009\u5F00\u6E90 skill \u4ED3\u5E93\uFF1B\u70B9\u51FB chip \u590D\u5236\u547D\u4EE4\u540E\u53D1\u7ED9\u961F\u957F\u6267\u884C\u3002web \u6863\u6848\u4E0B\u53EF\u76F4\u63A5\u5728\u56E2\u961F tab \u52FE\u9009\u5B89\u88C5\u3002" }),
    Object.entries(SKILL_CATALOG_FALLBACK).map(([role, ids]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginBottom: 4 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 11, color: C.fg, marginRight: 6 }, children: roleLabels[role] || role }),
      ids.map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { display: "inline-block", marginRight: 4, marginBottom: 2 }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CmdChip, { cmd: `sci_skill_install role=${role} repo_id=${id}` }) }, id))
    ] }, role))
  ] });
}
var ROLE_LABEL_FALLBACK = {
  "literature-scout": "\u{1F4DA} \u6587\u732E\u8C03\u7814\u4E13\u5458",
  "topic-designer": "\u{1F4A1} \u8BFE\u9898\u8BBE\u8BA1\u4E13\u5BB6",
  simulator: "\u{1F5A5} \u8BA1\u7B97\u6A21\u62DF\u4E13\u5BB6",
  trainer: "\u{1F9E0} \u6A21\u578B\u8BAD\u7EC3\u4E13\u5BB6",
  "figure-expert": "\u{1F4CA} \u79D1\u7814\u7ED8\u56FE\u4E13\u5BB6",
  writer: "\u{1F4DD} \u6587\u7AE0\u64B0\u5199\u4E13\u5BB6",
  reviewer: "\u{1F50D} \u79D1\u7814\u5BA1\u67E5\u4E13\u5BB6",
  analyst: "\u{1F4C8} \u6570\u636E\u5206\u6790\u5E08",
  presentation: "\u{1F4FD} \u6C47\u62A5PPT\u4E13\u5BB6"
};
function SkillMenuSection({ skillMenu, roles, notify, refresh }) {
  const catalog = skillMenu && skillMenu.catalog || {};
  const installed = skillMenu && skillMenu.installed || {};
  const [busyRole, setBusyRole] = (0, import_react.useState)(null);
  const [customUrl, setCustomUrl] = (0, import_react.useState)({});
  const roleEntries = Object.entries(roles || {}).filter(([id]) => catalog[id]);
  const postManage = async (body, okMsg) => {
    const roleKey = body.role;
    setBusyRole(roleKey);
    try {
      const res = await fetch(SKILL_MANAGE_URL, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const result = await res.json().catch(() => null);
      if (!res.ok || !result || result.ok !== true) {
        throw new Error(result && result.error || `HTTP ${res.status}`);
      }
      notify(okMsg || "\u6280\u80FD\u5E93\u5DF2\u66F4\u65B0");
      if (typeof refresh === "function") refresh();
      return true;
    } catch (err) {
      notify(`\u6280\u80FD\u5E93\u64CD\u4F5C\u5931\u8D25\uFF1A${err && err.message || err}`);
      return false;
    } finally {
      setBusyRole(null);
    }
  };
  const installedOf = (role) => Array.isArray(installed[role]) ? installed[role] : [];
  if (roleEntries.length === 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    Panel,
    {
      title: "\u89D2\u8272\u6280\u80FD\u5E93",
      extra: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 10, color: C.faint }, children: "\u6BCF\u89D2\u8272 \u22643 \u7CBE\u9009\u4ED3\u5E93 \xB7 \u52FE\u9009\u5373\u5B89\u88C5\uFF08\u4EC5\u672C\u63D2\u4EF6\u5BF9\u5E94\u89D2\u8272\u53EF\u7528\uFF09" }),
      children: [
        roleEntries.map(([role, meta]) => {
          const inst = installedOf(role);
          const byCatalogId = (id) => inst.find((x) => x.catalogId === id || x.name === id);
          const urlDraft = customUrl[role] || { url: "", name: "" };
          const busy = busyRole === role;
          return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { "data-skill-role": role, style: { margin: "0 0 6px", border: `1px solid ${C.divider}`, borderRadius: 8, padding: "4px 8px" }, open: inst.length > 0, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", { style: { cursor: "pointer", fontSize: 12, color: C.fg }, children: [
              (meta && meta.icon ? `${meta.icon} ` : "") + (meta && meta.label || role),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "span",
                {
                  "data-skill-count": role,
                  style: { marginLeft: 8, fontSize: 10, color: inst.length > 0 ? C.ok : C.faint, border: `1px solid ${inst.length > 0 ? C.ok : C.border}`, borderRadius: 8, padding: "0 6px" },
                  children: [
                    inst.length,
                    " \u5DF2\u5B89\u88C5"
                  ]
                }
              )
            ] }),
            busy && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { fontSize: 10, color: C.accent, margin: "2px 0" }, children: "\u5904\u7406\u4E2D\uFF08git clone --depth 1\uFF0C\u6700\u957F\u7EA6 2 \u5206\u949F\uFF09\u2026" }),
            (catalog[role] || []).map((item) => {
              const entry = byCatalogId(item.id);
              const checked = !!entry;
              return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "label",
                {
                  "data-skill-item": item.id,
                  style: { display: "flex", alignItems: "flex-start", gap: 6, padding: "3px 0", cursor: busy ? "wait" : "pointer", fontSize: 11, color: C.fg },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "input",
                      {
                        type: "checkbox",
                        "data-skill-check": item.id,
                        checked,
                        disabled: busy,
                        onChange: () => {
                          if (checked) {
                            postManage({ action: "remove", role, name: entry.name }, `\u5DF2\u79FB\u9664 ${item.name}`);
                          } else {
                            postManage({ action: "install", role, repoId: item.id }, `\u5DF2\u5B89\u88C5 ${item.name}\uFF08\u540C\u89D2\u8272\u5DF2 spawn \u6210\u5458\u81EA\u52A8\u5524\u9192\uFF1B\u5426\u5219\u4E0B\u6B21 spawn \u751F\u6548\uFF09`);
                          }
                        },
                        style: { marginTop: 2, flexShrink: 0 }
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: item.name }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: C.faint, marginLeft: 6, fontFamily: "ui-monospace, monospace", fontSize: 10 }, children: item.license }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: C.muted }, children: item.description }),
                      checked && entry && entry.skillNames && entry.skillNames.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { color: C.ok }, children: [
                        "\uFF08\u6280\u80FD\uFF1A",
                        entry.skillNames.join("\u3001"),
                        "\uFF09"
                      ] })
                    ] })
                  ]
                },
                item.id
              );
            }),
            inst.filter((e) => !e.catalogId).length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { "data-skill-custom-list": role, style: { margin: "4px 0", borderTop: `1px dashed ${C.border}`, paddingTop: 4 }, children: inst.filter((e) => !e.catalogId).map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { "data-skill-custom-entry": e.name, style: { display: "flex", alignItems: "center", gap: 6, fontSize: 11, padding: "2px 0" }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { color: C.muted, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: [
                e.name,
                e.warn ? "\uFF08\u26A0 \u65E0 SKILL.md\uFF09" : ""
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "button",
                {
                  "data-skill-custom-remove": e.name,
                  disabled: busy,
                  onClick: () => postManage({ action: "remove", role, name: e.name }, `\u5DF2\u79FB\u9664 ${e.name}`),
                  style: { fontSize: 10, padding: "1px 8px", border: `1px solid ${C.border}`, borderRadius: 6, background: "transparent", color: C.muted, cursor: busy ? "not-allowed" : "pointer" },
                  children: "\u79FB\u9664"
                }
              )
            ] }, e.name)) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 4, marginTop: 4, alignItems: "center", flexWrap: "wrap" }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "input",
                {
                  "data-skill-custom-url": role,
                  type: "text",
                  placeholder: "https://github.com/owner/repo\uFF08\u81EA\u5B9A\u4E49 skill \u4ED3\u5E93\uFF09",
                  value: urlDraft.url,
                  disabled: busy,
                  onChange: (e) => setCustomUrl((m) => ({ ...m, [role]: { ...urlDraft, url: e.target.value } })),
                  style: { flex: 1, minWidth: 160, fontSize: 11, padding: "2px 6px", border: `1px solid ${C.border}`, borderRadius: 6, background: "transparent", color: C.fg }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "input",
                {
                  "data-skill-custom-name": role,
                  type: "text",
                  placeholder: "\u76EE\u5F55\u540D(\u53EF\u9009)",
                  value: urlDraft.name,
                  disabled: busy,
                  onChange: (e) => setCustomUrl((m) => ({ ...m, [role]: { ...urlDraft, name: e.target.value } })),
                  style: { width: 90, fontSize: 11, padding: "2px 6px", border: `1px solid ${C.border}`, borderRadius: 6, background: "transparent", color: C.fg }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "button",
                {
                  "data-skill-custom-install": role,
                  disabled: busy || !urlDraft.url.trim(),
                  onClick: () => {
                    const body = { action: "install", role, repoUrl: urlDraft.url.trim() };
                    if (urlDraft.name.trim()) body.name = urlDraft.name.trim();
                    postManage(body, "\u81EA\u5B9A\u4E49\u6280\u80FD\u5DF2\u5B89\u88C5\uFF08\u6210\u5458 spawn \u540E\u751F\u6548\uFF09");
                  },
                  style: { fontSize: 11, padding: "2px 10px", border: `1px solid ${C.accent}`, borderRadius: 6, background: "transparent", color: C.accent, cursor: busy || !urlDraft.url.trim() ? "not-allowed" : "pointer" },
                  children: "\u5B89\u88C5"
                }
              )
            ] })
          ] }, role);
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { fontSize: 10, color: C.faint, margin: "2px 0 0" }, children: "\u5B89\u88C5\u5373 git clone --depth 1 \u5230 role-skills/<\u89D2\u8272>/ \u5E76\u751F\u6210 INDEX.md\uFF1B\u53EA\u6709\u8BE5\u89D2\u8272\u6210\u5458 spawn \u63D0\u793A\u8BCD\u643A\u5E26\u7D22\u5F15\uFF08\u8DE8\u89D2\u8272\u9694\u79BB\uFF09\u3002\u540C\u89D2\u8272\u5DF2 spawn \u7684\u6210\u5458\u4F1A\u81EA\u52A8\u6536\u5230\u65B0\u6280\u80FD\u8DEF\u5F84\uFF0CWeb UI \u5B89\u88C5\uFF08\u65E0 agent\uFF09\u5219\u4E0B\u6B21 spawn \u751F\u6548\u3002" })
      ]
    }
  );
}
function TeamTab({ data, openMemberSession, memberOpenAvailable, focusTaskId, onClearFocusTask, refresh }) {
  const [view, setView] = (0, import_react.useState)("dag");
  const [toast, setToast] = (0, import_react.useState)(null);
  const toastTimer = (0, import_react.useRef)(null);
  const notify = (msg) => {
    setToast(String(msg));
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };
  (0, import_react.useEffect)(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);
  const team = data.team || { members: [], tasks: [] };
  const members = Array.isArray(team.members) ? team.members.filter((m) => m && typeof m.name === "string") : [];
  const tasks = normalizeTaskBoard(team.tasks);
  const onOpenMember = (m) => {
    try {
      if (typeof openMemberSession !== "function") throw new Error("\u6210\u5458\u4F1A\u8BDD\u8DF3\u8F6C\u4E0D\u53EF\u7528");
      openMemberSession(m);
    } catch (err) {
      notify(`\u65E0\u6CD5\u6253\u5F00\u6210\u5458\u4F1A\u8BDD\uFF1A${err && err.message || err}`);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProgressOverview, { tasks }),
    members.length === 0 ? (
      // 空队伍：lead 鲸鱼娘 + 一键建队引导（原花名册空态）
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, { title: "\u56E2\u961F\uFF080\uFF09", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { textAlign: "center", padding: "10px 6px 6px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MascotAvatar, { file: LEAD_MASCOT, emoji: "\u{1F9D1}\u200D\u{1F52C}", size: 64, style: { display: "inline-flex" } }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "\u961F\u4F0D\u8FD8\u6CA1\u6709\u6210\u5458\u3002\u5524\u9192\u4F60\u7684\u79D1\u7814\u56E2\u961F\uFF1A\u8BA9\u961F\u957F\u8C03\u7528 sci_team_spawn_all\uFF08\u4E00\u952E\u5EFA\u5168\u961F\uFF09\u6216 sci_team_spawn \u6309\u9700\u751F\u6210\u3002" })
      ] }) })
    ) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      Panel,
      {
        title: `\u4EFB\u52A1\u6D41 DAG\uFF08${tasks.length}\uFF09`,
        extra: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          ViewToggle,
          {
            view,
            graphValue: "dag",
            listValue: "list",
            graphLabel: "\u4EFB\u52A1\u6D41\u56FE",
            listLabel: "\u5217\u8868\u89C6\u56FE",
            onChange: setView
          }
        ),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            MemberStrip,
            {
              members,
              tasks,
              roles: data.roles,
              memberLive: data.memberLive,
              openMemberSession: onOpenMember,
              memberOpenAvailable
            }
          ),
          view === "dag" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            TaskDag,
            {
              tasks,
              members,
              roles: data.roles,
              focusTaskId,
              onClearFocus: onClearFocusTask
            }
          ) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TaskBoard, { tasks, focusTaskId, onClearFocus: onClearFocusTask })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, { title: "\u6536\u4EF6\u7BB1", extra: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 10, color: C.faint }, children: "\u6210\u5458\u56DE\u62A5\u6458\u8981\uFF08\u6700\u8FD1 8 \u6761\uFF09" }), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CaptainInbox, { tasks, members, roles: data.roles }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SkillMenuSection, { skillMenu: data.skillMenu, roles: data.roles, notify, refresh }),
    toast && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "fixed",
          left: "50%",
          bottom: 24,
          transform: "translateX(-50%)",
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: "6px 14px",
          fontSize: 12,
          color: C.fg,
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          zIndex: 9999,
          maxWidth: "80%"
        },
        children: toast
      }
    )
  ] });
}
function CoreCard({ core }) {
  const c = core || {};
  const hasCore = !!(c.title || c.claim);
  if (!hasCore) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { textAlign: "center", padding: "12px 8px 8px", border: `1px dashed ${C.border}`, borderRadius: 8, marginBottom: 8 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MascotAvatar, { file: LEAD_MASCOT, emoji: "\u{1F9D1}\u200D\u{1F52C}", size: 48, style: { display: "inline-flex" } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "\u6587\u7AE0\u84DD\u56FE\u8FD8\u6CA1\u6709\u6838\u5FC3\u3002\u8BA9\u961F\u957F\u7528 sci_blueprint_set \u4E0E\u4F60\u786E\u8BA4\u6807\u9898\u3001\u6838\u5FC3\u4E3B\u5F20\u4E0E\u521B\u65B0\u70B9\uFF0C\u4E4B\u540E\u7684\u4EFB\u52A1\u4E0E\u56FE\u8868\u90FD\u4F1A\u56F4\u7ED5\u5B83\u7EC4\u7EC7\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { paddingBottom: 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CmdChip, { cmd: "sci_blueprint_set" }) })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", background: C.card, marginBottom: 8 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MascotAvatar, { file: LEAD_MASCOT, emoji: "\u{1F9D1}\u200D\u{1F52C}", size: 28 }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 15, fontWeight: 700, color: C.fg, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis" }, children: c.title || "\uFF08\u672A\u547D\u540D\uFF09" }),
      c.confirmed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "span",
        {
          "data-core-confirmed": "true",
          title: "\u6838\u5FC3\u5DF2\u786E\u8BA4\uFF08\u7528\u6237\u540C\u610F\u540E\u7684\u6587\u7AE0\u627F\u8BFA\uFF1B\u4FEE\u6539\u4F1A\u6253\u56DE\u5F85\u786E\u8BA4\uFF09",
          style: { fontSize: 10, color: C.ok, border: `1px solid ${C.ok}`, borderRadius: 8, padding: "0 6px", lineHeight: "16px", flexShrink: 0 },
          children: "\u{1F512} \u5DF2\u786E\u8BA4"
        }
      ) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "span",
        {
          "data-core-confirmed": "false",
          title: "\u6838\u5FC3\u5F85\u786E\u8BA4\uFF1A\u5411\u7528\u6237\u590D\u8FF0\u5E76\u83B7\u540C\u610F\u540E\uFF0C\u961F\u957F\u8C03\u7528 sci_blueprint_confirm kind=core",
          style: { fontSize: 10, color: C.warn, border: `1px solid ${C.warn}`, borderRadius: 8, padding: "0 6px", lineHeight: "16px", flexShrink: 0 },
          children: "\u23F3 \u5F85\u786E\u8BA4"
        }
      )
    ] }),
    c.claim && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 12, color: C.fg, marginTop: 6, lineHeight: 1.6 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { style: { color: C.accent }, children: "\u4E3B\u5F20" }),
      " \xB7 ",
      c.claim
    ] }),
    c.innovation && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.6 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { style: { color: C.fg }, children: "\u521B\u65B0" }),
      " \xB7 ",
      c.innovation
    ] }),
    c.venue && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 11, color: C.muted, marginTop: 3 }, children: [
      "\u76EE\u6807\u671F\u520A\uFF1A",
      c.venue
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 10, color: C.faint, marginTop: 6, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }, children: [
      !c.confirmed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u786E\u8BA4\u6838\u5FC3\uFF1A" }),
      !c.confirmed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CmdChip, { cmd: "/sci_blueprint_confirm core" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u4FEE\u6539\u6838\u5FC3\uFF1A" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CmdChip, { cmd: "sci_blueprint_set" })
    ] })
  ] });
}
var REVIEW_SEV_LABEL = { pass: "\u5BA1\u2713", warn: "\u5BA1!", fail: "\u5BA1\u2717", none: "\u672A\u5BA1" };
var REVIEW_SEV_COLOR = { pass: "ok", warn: "warn", fail: "err", none: "faint" };
function ReviewBadge({ review }) {
  const sev = review && review.severity ? review.severity : "none";
  const color = C[REVIEW_SEV_COLOR[sev] || "faint"] || C.faint;
  const tip = sev === "none" ? "\u8BE5\u4E3B\u5F20\u5C1A\u65E0\u5BA1\u67E5\u8BB0\u5F55\uFF08check=blueprint-claim\uFF09\u2014\u2014\u7528 /sci-review \u6216 sci_review_send scope=evidence \u8865\u5BA1" : `\u6700\u8FD1\u5BA1\u67E5\uFF08${review.runId || "\u672A\u8BB0\u5F55"}\uFF09\uFF1A${sev}${review.message ? ` \xB7 ${review.message}` : ""}`;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "span",
    {
      "data-result-review": sev,
      title: tip,
      style: { fontSize: 10, color, border: `1px solid ${color}`, borderRadius: 8, padding: "0 5px", lineHeight: "15px", flexShrink: 0 },
      children: REVIEW_SEV_LABEL[sev] || sev
    }
  );
}
function ResultRow({ r, tasksById, onOpenTask, onOpenFigure, review }) {
  const [open, setOpen] = (0, import_react.useState)(false);
  const status = r.status || "planned";
  const tasks = [...resultTaskIdsOf(r, tasksById)];
  const figures = Array.isArray(r.figures) ? r.figures : [];
  const confirmed = r.confirmed === true;
  const refs = Array.isArray(r.references) ? r.references : [];
  const unverified = refs.filter((x) => x && !x.verified).length;
  const screening = r.screening || null;
  const refGroups = [];
  for (const usedAs of Object.keys(USED_AS_LABEL)) {
    const group = refs.filter((x) => (x && x.usedAs) === usedAs);
    if (group.length > 0) refGroups.push([usedAs, group]);
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        "data-result-row": r.id,
        onClick: () => setOpen(!open),
        title: `${r.id} \xB7 \u70B9\u51FB${open ? "\u6536\u8D77" : "\u5C55\u5F00"}\u8BE6\u60C5`,
        style: {
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 8px",
          marginBottom: 4,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          background: C.card,
          fontSize: 12,
          cursor: "pointer"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dot, { color: RESULT_STATUS_COLOR[status] || C.faint, size: 7 }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { style: { color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "0 1 auto" }, children: r.title || r.id }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DepChip, { id: RESULT_STATUS_LABEL[status] || status }),
          confirmed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "span",
            {
              "data-result-confirmed": "true",
              title: "\u5DF2\u786E\u8BA4\uFF1A\u7528\u6237\u540C\u610F\u540E\u7684\u5B50\u4E3B\u5F20\uFF08\u4FEE\u6539\u4F1A\u6253\u56DE\u5F85\u786E\u8BA4\uFF09",
              style: { fontSize: 10, color: C.ok, flexShrink: 0 },
              children: "\u{1F512}"
            }
          ) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "span",
            {
              "data-result-confirmed": "false",
              title: "\u5F85\u786E\u8BA4\uFF1A\u7528\u6237\u540C\u610F\u524D\u4E0D\u80FD\u6D3E\u53D1\u652F\u6491\u4EFB\u52A1\uFF08dispatch \u4F1A\u62D2\u7EDD\uFF09",
              style: { fontSize: 10, color: C.warn, border: `1px solid ${C.warn}`, borderRadius: 8, padding: "0 5px", lineHeight: "15px", flexShrink: 0 },
              children: "\u5F85\u786E\u8BA4"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { color: C.muted, fontSize: 11, flexShrink: 0 }, children: [
            tasks.length,
            " \u4EFB\u52A1"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { color: C.muted, fontSize: 11, flexShrink: 0 }, children: [
            figures.length,
            " \u56FE"
          ] }),
          refs.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "span",
            {
              "data-result-refs": "",
              title: `\u53C2\u8003\u6587\u732E ${refs.length} \u6761${unverified > 0 ? `\uFF08${unverified} \u6761\u672A\u6838\u5BF9\uFF09` : "\uFF08\u5168\u90E8\u5DF2\u6838\u5BF9\uFF09"}`,
              style: { fontSize: 10, color: unverified > 0 ? C.warn : C.ok, flexShrink: 0 },
              children: [
                "\u{1F4DA}",
                refs.length,
                unverified > 0 ? "?" : ""
              ]
            }
          ),
          screening && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "span",
            {
              "data-result-screening": screening.decision,
              title: `\u5FEB\u7B5B\uFF1A${screening.decision}${screening.note ? ` \xB7 ${screening.note}` : ""}`,
              style: { fontSize: 10, color: SCREENING_COLOR[screening.decision] || C.faint, border: `1px solid ${SCREENING_COLOR[screening.decision] || C.faint}`, borderRadius: 8, padding: "0 5px", lineHeight: "15px", flexShrink: 0 },
              children: SCREENING_LABEL[screening.decision] || screening.decision
            }
          ),
          review && r.claim && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReviewBadge, { review }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: C.faint, fontSize: 10, marginLeft: "auto", flexShrink: 0 }, children: open ? "\u25BE" : "\u25B8" })
        ]
      }
    ),
    open && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          border: `1px solid ${C.divider}`,
          borderRadius: 8,
          padding: "6px 10px",
          marginBottom: 4,
          background: C.chip,
          fontSize: 11,
          color: C.muted,
          lineHeight: 1.6
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { color: C.faint }, children: [
            r.id,
            " \xB7 ",
            RESULT_STATUS_LABEL[status] || status
          ] }),
          r.claim && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { whiteSpace: "pre-wrap", marginTop: 4, color: C.fg }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { style: { color: C.accent }, children: "\u4E3B\u5F20\uFF1A" }),
            r.claim
          ] }),
          tasks.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginTop: 4, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { flexShrink: 0 }, children: "\u652F\u6491\u4EFB\u52A1\uFF1A" }),
            tasks.map((tid) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "span",
              {
                onClick: (e) => {
                  e.stopPropagation();
                  try {
                    if (typeof onOpenTask === "function") onOpenTask(tid);
                  } catch {
                  }
                },
                title: "\u70B9\u51FB\u524D\u5F80\u56E2\u961F\u4EFB\u52A1\u677F\u67E5\u770B\u8BE6\u60C5",
                style: {
                  display: "inline-block",
                  padding: "0 6px",
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  background: C.card,
                  fontSize: 10,
                  lineHeight: "16px",
                  color: C.muted,
                  cursor: "pointer",
                  fontFamily: "ui-monospace, monospace"
                },
                children: [
                  tid,
                  " \u2192"
                ]
              },
              tid
            ))
          ] }),
          figures.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginTop: 4, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { flexShrink: 0 }, children: "\u56FE\u8868\u8BC1\u636E\uFF1A" }),
            figures.map((fid) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "span",
              {
                onClick: (e) => {
                  e.stopPropagation();
                  try {
                    if (typeof onOpenFigure === "function") onOpenFigure(fid);
                  } catch {
                  }
                },
                title: "\u70B9\u51FB\u524D\u5F80\u4EA7\u7269 tab \u56FE\u5E93\u67E5\u770B",
                style: {
                  display: "inline-block",
                  padding: "0 6px",
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  background: C.card,
                  fontSize: 10,
                  lineHeight: "16px",
                  color: C.muted,
                  cursor: "pointer",
                  fontFamily: "ui-monospace, monospace"
                },
                children: [
                  fid,
                  " \u2192"
                ]
              },
              fid
            ))
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { "data-result-references": r.id, style: { marginTop: 5, borderTop: `1px dashed ${C.divider}`, paddingTop: 4 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { flexShrink: 0, color: C.fg }, children: [
                "\u53C2\u8003\u6587\u732E\uFF08",
                refs.length,
                unverified > 0 ? `\uFF0C${unverified} \u672A\u6838\u5BF9` : "",
                "\uFF09\uFF1A"
              ] }),
              refs.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: C.faint }, children: "\u65E0\u2014\u2014\u7528 sci_result_reference_add \u4E3A\u6240\u7528\u65B9\u6CD5/\u6982\u5FF5\u767B\u8BB0" })
            ] }),
            refGroups.map(([usedAs, group]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginTop: 3, display: "flex", alignItems: "flex-start", gap: 4, flexWrap: "wrap" }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { flexShrink: 0, color: C.accent, fontSize: 10, minWidth: 34 }, children: USED_AS_LABEL[usedAs] }),
              group.map((ref, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "span",
                {
                  "data-ref-verified": ref.verified ? "true" : "false",
                  title: `${ref.verified ? "\u2713 \u5DF2\u6838\u5BF9\uFF08Crossref\uFF09" : "\u26A0 \u672A\u6838\u5BF9"}${ref.doi ? ` \xB7 doi:${ref.doi}` : ""} \xB7 ${ref.title || ""}${ref.verifyError ? ` \xB7 ${ref.verifyError}` : ""}`,
                  style: {
                    display: "inline-block",
                    padding: "0 6px",
                    borderRadius: 8,
                    border: `1px solid ${ref.verified ? C.ok : C.warn}`,
                    background: C.card,
                    fontSize: 10,
                    lineHeight: "16px",
                    color: ref.verified ? C.ok : C.warn,
                    maxWidth: 200,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  },
                  children: [
                    ref.verified ? "\u2713" : "\u26A0",
                    " ",
                    ref.doi ? `doi:${ref.doi}` : ref.title || "\uFF08\u65E0\u6807\u9898\uFF09"
                  ]
                },
                `${ref.doi || ref.title}:${i}`
              ))
            ] }, usedAs)),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginTop: 4, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 10, color: C.faint }, children: "\u6DFB\u52A0\u6587\u732E\uFF1A" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CmdChip, { cmd: `sci_result_reference_add result_id=${r.id} used_as=method` }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CmdChip, { cmd: `sci_result_reference_add result_id=${r.id} used_as=evidence` })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginTop: 4, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }, children: [
            !confirmed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 10, color: C.warn }, children: "\u786E\u8BA4\u8BE5 result\uFF1A" }),
            !confirmed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CmdChip, { cmd: `/sci_blueprint_confirm ${r.id}` }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 10, color: C.faint }, children: "\u5FEB\u7B5B\uFF1A" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CmdChip, { cmd: `sci_result_screening result_id=${r.id} decision=include` })
          ] }),
          r.notes && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { whiteSpace: "pre-wrap", marginTop: 4 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { style: { color: status === "negative" ? C.err : C.ok }, children: "notes\uFF1A" }),
            r.notes
          ] })
        ]
      }
    )
  ] });
}
function ResultsList({ results, tasksById, onOpenTask, onOpenFigure, reviewById }) {
  if (results.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "\u8FD8\u6CA1\u6709 Results\u3002\u8BA9\u961F\u957F\u7528 sci_result_add \u6DFB\u52A0\u652F\u6491\u6838\u5FC3\u7684\u5B50\u4E3B\u5F20\uFF08\u5EFA\u8BAE 3-5 \u4E2A\uFF0C\u6BCF\u4E2A\u4E00\u53E5\u53EF\u68C0\u9A8C\u7684 claim\uFF09\u3002" });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: results.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResultRow, { r, tasksById, onOpenTask, onOpenFigure, review: reviewById ? reviewById.get(r.id) : null }, r.id)) });
}
var FG_PAD = 12;
var FG_CORE_W = 240;
var FG_CORE_H = 64;
var FG_RES_W = 190;
var FG_RES_H = 62;
var FG_LEAF_W = 168;
var FG_LEAF_H = 24;
var FG_RES_GAP = 34;
var FG_LEAF_GAP = 6;
var FG_LEAF_INDENT = 22;
var FG_CORE_GAP = 44;
var FG_LEAF_CAP = 8;
function resultTaskIdsOf(r, tasksById) {
  const ids = new Set(Array.isArray(r && r.tasks) ? r.tasks : []);
  if (r && r.id && tasksById) {
    for (const t of tasksById.values()) {
      if (t && t.resultId === r.id) ids.add(t.id);
    }
  }
  return ids;
}
function frameworkLayout(bp, tasksById, figById) {
  const allResults = Array.isArray(bp.results) ? bp.results : [];
  const results = allResults.slice(0, 8);
  const hiddenResults = allResults.length - results.length;
  const canvasW = Math.max(
    FG_CORE_W + FG_PAD * 2,
    (results.length + (hiddenResults > 0 ? 1 : 0)) * (FG_RES_W + FG_RES_GAP) - FG_RES_GAP + FG_PAD * 2
  );
  const core = { x: Math.round((canvasW - FG_CORE_W) / 2), y: FG_PAD, w: FG_CORE_W, h: FG_CORE_H };
  const resY = core.y + FG_CORE_H + FG_CORE_GAP;
  const resNodes = [];
  const leafNodes = [];
  const overflowNodes = [];
  const edges = [];
  let maxBottom = resY + FG_RES_H;
  results.forEach((r, i) => {
    const x = FG_PAD + i * (FG_RES_W + FG_RES_GAP);
    const taskIds = resultTaskIdsOf(r, tasksById);
    resNodes.push({ r, x, y: resY, taskCount: taskIds.size });
    const leaves = [];
    for (const tid of taskIds) leaves.push({ kind: "task", id: tid });
    for (const fid of Array.isArray(r.figures) ? r.figures : []) leaves.push({ kind: "figure", id: fid });
    const shown = leaves.slice(0, FG_LEAF_CAP);
    const overflow = leaves.length - shown.length;
    let ly = resY + FG_RES_H + 16;
    for (const leaf of shown) {
      leaf.x = x + FG_LEAF_INDENT;
      leaf.y = ly;
      leaf.parentId = r.id;
      if (leaf.kind === "task") {
        const t = tasksById.get(leaf.id);
        leaf.status = t ? t.status : null;
        leaf.title = t && (t.subject || t.id) || leaf.id;
        leaf.assignee = t ? t.assignee : "";
      } else {
        const f = figById.get(leaf.id);
        leaf.title = f && f.title || leaf.id;
        leaf.fig = f || null;
      }
      leafNodes.push(leaf);
      ly += FG_LEAF_H + FG_LEAF_GAP;
    }
    if (overflow > 0) {
      overflowNodes.push({ parentId: r.id, x: x + FG_LEAF_INDENT, y: ly, count: overflow });
      ly += FG_LEAF_H + FG_LEAF_GAP;
    }
    maxBottom = Math.max(maxBottom, ly);
    const coreCx = core.x + core.w / 2;
    const coreBy = core.y + core.h;
    const tx = x + FG_RES_W / 2;
    const ty = resY;
    edges.push({
      d: `M${coreCx} ${coreBy}C${coreCx} ${coreBy + FG_CORE_GAP / 2},${tx} ${ty - FG_CORE_GAP / 2},${tx} ${ty}`,
      kind: "core-result",
      to: r.id
    });
    const kids = leafNodes.filter((l) => l.parentId === r.id);
    if (kids.length > 0) {
      const trunkX = x + 10;
      const topY = resY + FG_RES_H;
      const lastY = kids[kids.length - 1].y + FG_LEAF_H / 2;
      edges.push({ d: `M${trunkX} ${topY}L${trunkX} ${lastY}`, kind: "trunk", to: r.id });
      for (const k of kids) {
        edges.push({ d: `M${trunkX} ${k.y + FG_LEAF_H / 2}L${k.x} ${k.y + FG_LEAF_H / 2}`, kind: "stub", to: k.id });
      }
    }
  });
  return {
    canvasW,
    canvasH: maxBottom + FG_PAD,
    core,
    resNodes,
    leafNodes,
    overflowNodes,
    edges,
    resultCount: results.length,
    resultTotal: allResults.length,
    hiddenResults,
    // F7：results 超 8 的汇总节点（排在末位 result 之后）
    resultOverflow: hiddenResults > 0 ? { x: FG_PAD + results.length * (FG_RES_W + FG_RES_GAP), y: resY } : null
  };
}
function FrameworkDetail({ sel, bp, tasksById, figById, workspaceRoot, onOpenTask, onOpenFigure }) {
  if (!sel) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "\u70B9\u51FB\u56FE\u4E2D\u8282\u70B9\u67E5\u770B\u8BE6\u60C5\uFF08result \u4E3B\u5F20 / \u4EFB\u52A1\u63CF\u8FF0 / \u56FE\u8868\u9884\u89C8\uFF09\u3002" });
  if (sel.kind === "core") {
    const c = bp.core || {};
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { "data-framework-detail": "core", style: { border: `1px solid ${C.divider}`, borderRadius: 8, padding: "6px 10px", background: C.chip, fontSize: 11, color: C.muted, lineHeight: 1.6 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { color: C.fg, fontWeight: 700 }, children: c.title || "\uFF08\u672A\u547D\u540D\uFF09" }),
      c.claim && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginTop: 3, color: C.fg }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { style: { color: C.accent }, children: "\u4E3B\u5F20\uFF1A" }),
        c.claim
      ] }),
      c.innovation && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginTop: 3 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { style: { color: C.fg }, children: "\u521B\u65B0\uFF1A" }),
        c.innovation
      ] }),
      c.venue && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginTop: 3 }, children: [
        "\u76EE\u6807\u671F\u520A\uFF1A",
        c.venue
      ] })
    ] });
  }
  if (sel.kind === "result") {
    const r = (bp.results || []).find((x) => x && x.id === sel.id);
    if (!r) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "\u8BE5 result \u5DF2\u4E0D\u5B58\u5728\uFF08\u84DD\u56FE\u5DF2\u66F4\u65B0\uFF09\u3002" });
    const status = r.status || "planned";
    const tasks = [...resultTaskIdsOf(r, tasksById)];
    const figures = Array.isArray(r.figures) ? r.figures : [];
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { "data-framework-detail": r.id, style: { border: `1px solid ${C.divider}`, borderRadius: 8, padding: "6px 10px", background: C.chip, fontSize: 11, color: C.muted, lineHeight: 1.6 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { color: C.faint }, children: [
          r.id,
          " \xB7 ",
          RESULT_STATUS_LABEL[status] || status
        ] }),
        r.confirmed === true ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 10, color: C.ok }, children: "\u{1F512} \u5DF2\u786E\u8BA4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 10, color: C.warn, border: `1px solid ${C.warn}`, borderRadius: 8, padding: "0 5px", lineHeight: "15px" }, children: "\u5F85\u786E\u8BA4" }),
        Array.isArray(r.references) && r.references.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: 10, color: r.references.some((x) => x && !x.verified) ? C.warn : C.ok }, children: [
          "\u{1F4DA} ",
          r.references.length,
          " \u6761\u6587\u732E",
          r.references.some((x) => x && !x.verified) ? "\uFF08\u542B\u672A\u6838\u5BF9\uFF09" : ""
        ] }),
        r.screening && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 10, color: SCREENING_COLOR[r.screening.decision] || C.faint }, children: SCREENING_LABEL[r.screening.decision] || r.screening.decision })
      ] }),
      r.claim && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { whiteSpace: "pre-wrap", marginTop: 4, color: C.fg }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { style: { color: C.accent }, children: "\u4E3B\u5F20\uFF1A" }),
        r.claim
      ] }),
      tasks.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginTop: 4, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { flexShrink: 0 }, children: "\u652F\u6491\u4EFB\u52A1\uFF1A" }),
        tasks.map((tid) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "span",
          {
            onClick: (e) => {
              e.stopPropagation();
              try {
                if (typeof onOpenTask === "function") onOpenTask(tid);
              } catch {
              }
            },
            title: "\u70B9\u51FB\u524D\u5F80\u56E2\u961F\u4EFB\u52A1\u6D41\u67E5\u770B",
            style: { display: "inline-block", padding: "0 6px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, fontSize: 10, lineHeight: "16px", color: C.muted, cursor: "pointer", fontFamily: "ui-monospace, monospace" },
            children: [
              tid,
              " \u2192"
            ]
          },
          tid
        ))
      ] }),
      figures.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginTop: 4, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { flexShrink: 0 }, children: "\u56FE\u8868\u8BC1\u636E\uFF1A" }),
        figures.map((fid) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "span",
          {
            onClick: (e) => {
              e.stopPropagation();
              try {
                if (typeof onOpenFigure === "function") onOpenFigure(fid);
              } catch {
              }
            },
            title: "\u70B9\u51FB\u524D\u5F80\u4EA7\u7269 tab \u56FE\u5E93\u67E5\u770B",
            style: { display: "inline-block", padding: "0 6px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, fontSize: 10, lineHeight: "16px", color: C.muted, cursor: "pointer", fontFamily: "ui-monospace, monospace" },
            children: [
              fid,
              " \u2192"
            ]
          },
          fid
        ))
      ] }),
      r.notes && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { whiteSpace: "pre-wrap", marginTop: 4 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { style: { color: status === "negative" ? C.err : C.ok }, children: "notes\uFF1A" }),
        r.notes
      ] }),
      r.confirmed !== true && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginTop: 4, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 10, color: C.warn }, children: "\u786E\u8BA4\u8BE5 result\uFF1A" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CmdChip, { cmd: `/sci_blueprint_confirm ${r.id}` })
      ] })
    ] });
  }
  if (sel.kind === "task") {
    const t = tasksById.get(sel.id);
    if (!t) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Empty, { children: [
      "\u4EFB\u52A1 ",
      sel.id,
      " \u4E0D\u5728\u4EFB\u52A1\u677F\u4E0A\uFF08\u53EF\u80FD\u5DF2\u88AB\u5220\u9664\uFF09\u3002"
    ] });
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { "data-framework-detail": t.id, style: { border: `1px solid ${C.divider}`, borderRadius: 8, padding: "6px 10px", background: C.chip, fontSize: 11, color: C.muted, lineHeight: 1.6 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { color: C.faint }, children: [
        t.id,
        " \xB7 \u72B6\u6001 ",
        t.status,
        " \xB7 \u8D1F\u8D23\u4EBA ",
        t.assignee || "\u5F85\u9886",
        t.resultId ? ` \xB7 \u5BF9\u9F50 ${t.resultId}` : ""
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { color: C.fg, marginTop: 3, fontWeight: 700 }, children: t.subject || t.id }),
      t.desc && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { whiteSpace: "pre-wrap", marginTop: 4, color: C.fg }, children: t.desc }),
      t.result && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { whiteSpace: "pre-wrap", marginTop: 4 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { style: { color: C.ok }, children: "\u7ED3\u679C\uFF1A" }),
        t.result
      ] })
    ] });
  }
  const f = figById.get(sel.id);
  if (!f) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Empty, { children: [
    "\u56FE\u8868 ",
    sel.id,
    " \u672A\u767B\u8BB0\uFF08\u6216\u5DF2\u6E05\u7406\uFF09\u3002"
  ] });
  const inside = pathInsideWorkspace(f.path, workspaceRoot);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { "data-framework-detail": f.id, style: { border: `1px solid ${C.divider}`, borderRadius: 8, padding: "6px 10px", background: C.chip, fontSize: 11, color: C.muted, lineHeight: 1.6 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { color: C.fg, fontWeight: 700 }, children: f.title }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginTop: 2 }, children: [
      f.id,
      " \xB7 ",
      f.sha256_12,
      " \xB7 ",
      fmtBytes(f.bytes),
      " \xB7 ",
      fmtTime(f.registeredAt)
    ] }),
    inside && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "img",
      {
        src: `/plugins/dsh-science/file?path=${encodeURIComponent(f.path)}`,
        alt: f.title,
        style: { display: "block", maxWidth: "100%", maxHeight: 180, marginTop: 6, borderRadius: 6, border: `1px solid ${C.divider}` }
      }
    ),
    !inside && f.path && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: f.path, children: f.path })
  ] });
}
function FrameworkGraph({ bp, tasksById, figById, workspaceRoot, onOpenTask, onOpenFigure }) {
  const [sel, setSel] = (0, import_react.useState)(null);
  const layout = (0, import_react.useMemo)(() => frameworkLayout(bp || {}, tasksById, figById), [bp, tasksById, figById]);
  const viewportRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const target = (layout.canvasW - vp.clientWidth) / 2;
    if (target > 0) vp.scrollLeft = target;
  }, [layout.canvasW]);
  if (layout.resultCount === 0 && !(bp && bp.core && (bp.core.title || bp.core.claim))) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "\u8FD8\u6CA1\u6709\u6587\u7AE0\u6846\u67B6\u3002\u8BA9\u961F\u957F\u7528 sci_blueprint_set \u786E\u7ACB\u6838\u5FC3\u3001sci_result_add \u6DFB\u52A0 Results\uFF0C\u8FD9\u91CC\u4F1A\u957F\u51FA\u6846\u67B6\u56FE\u3002" });
  }
  const nodeBase = {
    position: "absolute",
    cursor: "pointer",
    boxSizing: "border-box"
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        "data-framework-viewport": "",
        ref: viewportRef,
        style: { maxHeight: 420, overflow: "auto", border: `1px solid ${C.divider}`, borderRadius: 8, background: C.card, position: "relative" },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { "data-framework-canvas": "", style: { position: "relative", width: layout.canvasW, height: layout.canvasH }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "svg",
            {
              "data-framework-edges": "",
              width: layout.canvasW,
              height: layout.canvasH,
              style: { position: "absolute", left: 0, top: 0, pointerEvents: "none" },
              "aria-hidden": true,
              children: layout.edges.map((e, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "path",
                {
                  "data-framework-edge": `${e.kind}:${e.to}`,
                  d: e.d,
                  fill: "none",
                  style: { stroke: e.kind === "core-result" ? C.accent : C.faint },
                  strokeWidth: e.kind === "core-result" ? 1.5 : 1,
                  opacity: e.kind === "core-result" ? 0.8 : 0.6
                },
                i
              ))
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              "data-framework-node": "core",
              onClick: () => setSel({ kind: "core" }),
              title: "\u6838\u5FC3 \xB7 \u70B9\u51FB\u67E5\u770B\u5B8C\u6574\u4E3B\u5F20",
              style: {
                ...nodeBase,
                left: layout.core.x,
                top: layout.core.y,
                width: layout.core.w,
                height: layout.core.h,
                border: `1.5px solid ${sel && sel.kind === "core" ? C.accent : C.border}`,
                borderRadius: 10,
                background: C.chip,
                padding: "5px 8px"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 5 }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MascotAvatar, { file: LEAD_MASCOT, emoji: "\u{1F9D1}\u200D\u{1F52C}", size: 18 }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 9, color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 8, padding: "0 5px", lineHeight: "14px", flexShrink: 0 }, children: "\u6838\u5FC3" }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 11, fontWeight: 700, color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: bp.core && bp.core.title || "\uFF08\u672A\u547D\u540D\uFF09" })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "div",
                  {
                    style: {
                      fontSize: 10,
                      color: C.muted,
                      lineHeight: "13px",
                      marginTop: 3,
                      height: 26,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      wordBreak: "break-all"
                    },
                    children: bp.core && bp.core.claim || "\uFF08\u8FD8\u6CA1\u6709\u6838\u5FC3\u4E3B\u5F20\uFF09"
                  }
                )
              ]
            }
          ),
          layout.resNodes.map(({ r, x, y, taskCount }) => {
            const status = r.status || "planned";
            const rc = RESULT_STATUS_COLOR[status] || C.faint;
            const isSel = sel && sel.kind === "result" && sel.id === r.id;
            const figCount = Array.isArray(r.figures) ? r.figures.length : 0;
            return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "div",
              {
                "data-framework-node": r.id,
                "data-result-status": status,
                "data-result-confirmed": r.confirmed === true ? "true" : "false",
                onClick: () => setSel({ kind: "result", id: r.id }),
                title: `${r.id} \xB7 ${RESULT_STATUS_LABEL[status] || status} \xB7 ${r.confirmed === true ? "\u5DF2\u786E\u8BA4" : "\u5F85\u786E\u8BA4\uFF08dispatch \u524D\u9700\u786E\u8BA4\uFF09"} \xB7 \u70B9\u51FB\u67E5\u770B claim/notes`,
                style: {
                  ...nodeBase,
                  left: x,
                  top: y,
                  width: FG_RES_W,
                  height: FG_RES_H,
                  border: `1.5px solid ${isSel ? C.accent : rc}`,
                  borderRadius: 10,
                  background: C.surface,
                  padding: "4px 7px"
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dot, { color: rc, size: 6 }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 9, fontFamily: "ui-monospace, monospace", color: rc, flexShrink: 0 }, children: r.id }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 8, flexShrink: 0 }, title: r.confirmed === true ? "\u5DF2\u786E\u8BA4" : "\u5F85\u786E\u8BA4", children: r.confirmed === true ? "\u{1F512}" : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: C.warn }, children: "\u5F85\u786E\u8BA4" }) }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: 9, color: C.muted, marginLeft: "auto", flexShrink: 0 }, children: [
                      taskCount,
                      " \u4EFB\u52A1 \xB7 ",
                      figCount,
                      " \u56FE"
                    ] })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    "div",
                    {
                      style: {
                        fontSize: 10,
                        fontWeight: 700,
                        color: C.fg,
                        lineHeight: "12px",
                        marginTop: 2,
                        height: 24,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        wordBreak: "break-all"
                      },
                      children: r.title || r.id
                    }
                  )
                ]
              },
              r.id
            );
          }),
          layout.leafNodes.map((leaf) => {
            const isSel = sel && sel.kind === leaf.kind && sel.id === leaf.id;
            if (leaf.kind === "task") {
              const color = STATUS_COLOR[leaf.status] || C.faint;
              return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "div",
                {
                  "data-framework-node": leaf.id,
                  "data-leaf-kind": "task",
                  "data-status": leaf.status || "unknown",
                  onClick: () => setSel({ kind: "task", id: leaf.id }),
                  title: `\u4EFB\u52A1 ${leaf.id} \xB7 ${leaf.title} \xB7 \u72B6\u6001 ${leaf.status || "\u672A\u77E5"} \xB7 \u70B9\u51FB\u67E5\u770B\u63CF\u8FF0`,
                  style: {
                    ...nodeBase,
                    left: leaf.x,
                    top: leaf.y,
                    width: FG_LEAF_W,
                    height: FG_LEAF_H,
                    // F2：任务叶节点 surface + border-l4（深色主题可辨）
                    border: `1px solid ${isSel ? C.accent : C.borderNode}`,
                    borderRadius: 7,
                    background: C.surface,
                    padding: "2px 6px",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    overflow: "hidden"
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dot, { color, size: 6 }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 10, color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: leaf.title })
                  ]
                },
                `task:${leaf.id}`
              );
            }
            return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "div",
              {
                "data-framework-node": leaf.id,
                "data-leaf-kind": "figure",
                onClick: () => setSel({ kind: "figure", id: leaf.id }),
                title: `\u56FE\u8868 ${leaf.id} \xB7 ${leaf.title} \xB7 \u70B9\u51FB\u9884\u89C8`,
                style: {
                  ...nodeBase,
                  left: leaf.x,
                  top: leaf.y,
                  width: FG_LEAF_W,
                  height: FG_LEAF_H,
                  border: `1px solid ${isSel ? C.accent : C.borderNode}`,
                  borderRadius: 7,
                  background: C.chip,
                  padding: "2px 6px",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  overflow: "hidden"
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 10, flexShrink: 0 }, children: "\u{1F5BC}" }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 10, color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: leaf.title })
                ]
              },
              `fig:${leaf.id}`
            );
          }),
          layout.overflowNodes.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              "data-framework-overflow": o.parentId,
              onClick: () => setSel({ kind: "result", id: o.parentId }),
              title: `${o.parentId} \u8FD8\u6709 ${o.count} \u4E2A\u53F6\u5B50\uFF0C\u70B9\u51FB\u5C55\u5F00\u8BE5 result \u8BE6\u60C5`,
              style: {
                ...nodeBase,
                left: o.x,
                top: o.y,
                width: FG_LEAF_W,
                height: FG_LEAF_H,
                border: `1px dashed ${C.border}`,
                borderRadius: 7,
                padding: "2px 6px",
                display: "flex",
                alignItems: "center",
                fontSize: 10,
                color: C.faint
              },
              children: [
                "+",
                o.count,
                " \u66F4\u591A\u53F6\uFF08\u70B9\u51FB\u5C55\u5F00\uFF09"
              ]
            },
            `ovf:${o.parentId}`
          )),
          layout.resultOverflow && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              "data-framework-results-overflow": "",
              title: `\u8FD8\u6709 ${layout.hiddenResults} \u4E2A result \u672A\u5728\u56FE\u4E2D\u5C55\u5F00\uFF08\u4E0A\u9650 8\uFF09\uFF1A${(bp.results || []).slice(8).map((r) => r && r.id).filter(Boolean).join("\u3001") || "\u2014"}\u3002\u5207\u6362\u300C\u5217\u8868\u89C6\u56FE\u300D\u53EF\u770B\u5168\u90E8`,
              style: {
                ...nodeBase,
                left: layout.resultOverflow.x,
                top: layout.resultOverflow.y,
                width: FG_RES_W,
                height: FG_RES_H,
                border: `1px dashed ${C.borderNode}`,
                borderRadius: 10,
                padding: "4px 7px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                fontSize: 10,
                color: C.muted
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", { style: { fontSize: 11, color: C.fg }, children: [
                  "+",
                  layout.hiddenResults,
                  " \u66F4\u591A result"
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u8D85\u51FA\u753B\u5E03\u4E0A\u9650 8\uFF0C\u5217\u8868\u89C6\u56FE\u53EF\u770B\u5168\u90E8" })
              ]
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { marginTop: 6 }, "data-framework-detail-host": "", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      FrameworkDetail,
      {
        sel,
        bp: bp || {},
        tasksById,
        figById,
        workspaceRoot,
        onOpenTask,
        onOpenFigure
      }
    ) })
  ] });
}
function CoverageSection({ coverage, resultsCount }) {
  const cov = coverage || {};
  const warnings = Array.isArray(cov.warnings) ? cov.warnings : [];
  const negative = typeof cov.negativeCount === "number" ? cov.negativeCount : 0;
  const supported = typeof cov.supportedCount === "number" ? cov.supportedCount : 0;
  const dropped = typeof cov.droppedCount === "number" ? cov.droppedCount : 0;
  const total = typeof cov.total === "number" ? cov.total : typeof resultsCount === "number" ? resultsCount : 0;
  if (warnings.length === 0) {
    if (total === 0) {
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "\u5C1A\u65E0 result\u2014\u2014\u5148 sci_result_add \u6DFB\u52A0 Results\uFF0C\u8986\u76D6\u68C0\u67E5\u624D\u6709\u5BF9\u8C61\u3002" });
    }
    if (supported === 0) {
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Empty, { children: [
        "\u65E0\u53EF\u652F\u6491\u7684 result\uFF08negative ",
        negative,
        " \xB7 dropped ",
        dropped,
        " \u5DF2\u9000\u51FA\u652F\u6491\u94FE\uFF09\u2014\u2014\u6587\u7AE0\u5C1A\u65E0 supported \u8BC1\u636E\u3002"
      ] });
    }
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Empty, { children: [
      "\u8986\u76D6\u5B8C\u6574\uFF1A\u5728\u7814 result \u90FD\u6709\u4EFB\u52A1\u4E0E\u56FE\u8868\uFF0C\u4EFB\u52A1\u5168\u90E8\u5BF9\u9F50\u5230 result\uFF08supported ",
      supported,
      " \xB7 negative ",
      negative,
      "\uFF09\u3002"
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { border: `1px solid ${cov.falsificationRisk ? C.err : C.border}`, borderRadius: 8, padding: "6px 10px", background: C.card }, children: [
    warnings.map((w, i) => {
      const isRisk = String(w).indexOf("\u26A0") === 0;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            fontSize: 11,
            lineHeight: 1.6,
            marginTop: i === 0 ? 0 : 3,
            color: isRisk ? C.err : C.warn,
            fontWeight: isRisk ? 700 : 400
          },
          children: w
        },
        i
      );
    }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 10, color: C.faint, marginTop: 4 }, children: [
      "supported ",
      supported,
      " \xB7 negative ",
      negative,
      " \xB7 \u8BE6\u60C5\u547D\u4EE4\uFF1A",
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CmdChip, { cmd: "sci_blueprint_overview" })
    ] })
  ] });
}
function ReviewCoverageSection({ rc }) {
  const counts = rc && rc.counts || {};
  const total = typeof counts.total === "number" ? counts.total : 0;
  const reviewed = typeof counts.reviewed === "number" ? counts.reviewed : 0;
  const warnings = Array.isArray(rc && rc.warnings) ? rc.warnings : [];
  const rows = [rc && rc.core, ...rc && Array.isArray(rc.results) ? rc.results : []].filter((v) => v && v.claim);
  if (total === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "\u5C1A\u65E0\u5E26 claim \u7684\u4E3B\u5F20\u2014\u2014\u5148 sci_blueprint_set / sci_result_add \u5EFA\u7ACB\u53EF\u6838\u5BF9\u7684\u4E3B\u5F20\u3002" });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { border: `1px solid ${counts.fail > 0 ? C.err : C.border}`, borderRadius: 8, padding: "6px 10px", background: C.card }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 11, color: C.fg, marginBottom: 4 }, children: [
      "\u5DF2\u5BA1 ",
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", { children: [
        reviewed,
        "/",
        total
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { color: C.faint }, children: [
        "\uFF08pass ",
        counts.pass || 0,
        " \xB7 warn ",
        counts.warn || 0,
        " \xB7 fail ",
        counts.fail || 0,
        "\uFF09"
      ] })
    ] }),
    rows.map((v) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { "data-review-cov-row": v.id, style: { fontSize: 11, lineHeight: 1.6, color: v.severity === "fail" ? C.err : v.severity === "warn" ? C.warn : v.severity === "pass" ? C.ok : C.faint }, children: [
      v.id,
      "\uFF1A",
      v.severity || "\u672A\u5BA1",
      v.runId ? `\uFF08${v.runId}\uFF09` : "",
      v.message ? ` \u2014 ${v.message}` : ""
    ] }, v.id)),
    warnings.map((w, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 10, color: C.warn, marginTop: 4 }, children: [
      "\u26A0 ",
      w
    ] }, `w${i}`)),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 10, color: C.faint, marginTop: 4 }, children: [
      "\u4E3B\u5F20\u7EA7\u5BA1\u67E5\u6765\u6E90\uFF1Asci_review_send scope=evidence \u6216 /sci-review \xB7 \u8BE6\u60C5\u547D\u4EE4\uFF1A",
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CmdChip, { cmd: "sci_blueprint_overview" })
    ] })
  ] });
}
function BlueprintTab({ data, onOpenTask, onOpenFigure }) {
  const [view, setView] = (0, import_react.useState)("graph");
  const bp = data && data.blueprint || {};
  const core = bp.core || {};
  const results = Array.isArray(bp.results) ? bp.results : [];
  const updatedAt = bp.updatedAt ? ` \xB7 \u66F4\u65B0\u4E8E ${fmtTime(bp.updatedAt)}` : "";
  const bpError = data && data.blueprintError || null;
  const tasksById = (0, import_react.useMemo)(() => new Map((data && data.team && data.team.tasks || []).map((t) => [t.id, t])), [data]);
  const figById = (0, import_react.useMemo)(() => new Map((data && data.figures || []).map((f) => [f.id, f])), [data]);
  const reviewCov = bp.reviewCoverage || null;
  const reviewById = (0, import_react.useMemo)(() => {
    const m = /* @__PURE__ */ new Map();
    if (reviewCov) {
      for (const v of [...reviewCov.core ? [reviewCov.core] : [], ...Array.isArray(reviewCov.results) ? reviewCov.results : []]) {
        if (v && v.id) m.set(v.id, v);
      }
    }
    return m;
  }, [reviewCov]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    bpError && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          border: `1px solid ${C.err}`,
          borderRadius: 8,
          padding: "8px 10px",
          marginBottom: 8,
          background: C.card
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, fontWeight: 700, color: C.err }, children: "\u26A0 \u84DD\u56FE\u6587\u4EF6\u635F\u574F\uFF0C\u5DF2\u9694\u79BB\uFF08\u5907\u4EFD\u4FDD\u7559\uFF09\uFF0C\u8BF7\u7528 sci_blueprint_set \u91CD\u5EFA" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 10, color: C.muted, marginTop: 3 }, children: String(bpError) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { marginTop: 5 }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CmdChip, { cmd: "sci_blueprint_set" }) })
        ]
      }
    ),
    view === "graph" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      Panel,
      {
        title: "\u6587\u7AE0\u6846\u67B6\u56FE",
        extra: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          ViewToggle,
          {
            view,
            graphValue: "graph",
            listValue: "list",
            graphLabel: "\u6846\u67B6\u56FE",
            listLabel: "\u5217\u8868\u89C6\u56FE",
            onChange: setView
          }
        ),
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          FrameworkGraph,
          {
            bp,
            tasksById,
            figById,
            workspaceRoot: data.workspaceRoot,
            onOpenTask,
            onOpenFigure
          }
        )
      }
    ) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        Panel,
        {
          title: "\u6838\u5FC3",
          extra: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            ViewToggle,
            {
              view,
              graphValue: "graph",
              listValue: "list",
              graphLabel: "\u6846\u67B6\u56FE",
              listLabel: "\u5217\u8868\u89C6\u56FE",
              onChange: setView
            }
          ),
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CoreCard, { core })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, { title: `Results\uFF08${results.length}\uFF09`, extra: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: 10, color: C.faint }, children: [
        "\u652F\u6491\u6838\u5FC3\u7684\u5B50\u4E3B\u5F20",
        updatedAt
      ] }), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResultsList, { results, tasksById, onOpenTask, onOpenFigure, reviewById }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, { title: "\u8986\u76D6\u68C0\u67E5", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CoverageSection, { coverage: bp.coverage, resultsCount: results.length }) }),
    reviewCov && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, { title: "\u4E3B\u5F20\u5BA1\u67E5\u8986\u76D6", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReviewCoverageSection, { rc: reviewCov }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 10, color: C.muted, marginTop: 6, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }, children: [
      "\u547D\u4EE4\uFF1A",
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CmdChip, { cmd: "sci_result_add" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CmdChip, { cmd: "sci_blueprint_overview" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CmdChip, { cmd: "sci_blueprint_export" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\uFF08\u5BFC\u51FA research/blueprint-report.md\uFF09" })
    ] })
  ] });
}
function FiguresSection({ figures, workspaceRoot, focusFigureId, onClearFocus }) {
  const [flash, setFlash] = (0, import_react.useState)(null);
  (0, import_react.useEffect)(() => {
    if (!focusFigureId) return void 0;
    const timer = setTimeout(() => {
      try {
        const el = document.querySelector(`[data-fig-card="${focusFigureId}"]`);
        if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
      }
      setFlash(focusFigureId);
      setTimeout(() => setFlash((cur) => cur === focusFigureId ? null : cur), 1600);
      if (typeof onClearFocus === "function") onClearFocus();
    }, 120);
    return () => clearTimeout(timer);
  }, [focusFigureId]);
  if (!figures || figures.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "\u6682\u65E0\u767B\u8BB0\u56FE\u8868\u3002\u8BA9\u6210\u5458\u7ED8\u56FE\u540E\u8C03\u7528 sci_figure_register \u767B\u8BB0\uFF0C\u8FD9\u91CC\u4F1A\u51FA\u73B0\u9884\u89C8\u3002" });
  }
  const openInNewTab = (f) => {
    try {
      if (f && f.path) window.open(`/plugins/dsh-science/file?path=${encodeURIComponent(f.path)}`, "_blank");
    } catch {
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: figures.map((f) => {
    const inside = pathInsideWorkspace(f.path, workspaceRoot);
    const prev = f.prevId ? figures.find((x) => x && x.id === f.prevId) : null;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        "data-fig-card": f.id,
        "data-fig-version": f.version || 1,
        onClick: () => openInNewTab(f),
        title: f.path ? `\u70B9\u51FB\u5728\u65B0\u6807\u7B7E\u9875\u67E5\u770B\uFF1A${f.path}` : void 0,
        style: {
          border: `1px solid ${flash === f.id ? C.accent : C.border}`,
          borderRadius: 8,
          padding: "6px 10px",
          marginBottom: 6,
          background: flash === f.id ? C.chip : C.card,
          cursor: f.path ? "pointer" : "default"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 6 }, children: [
            f.resultId && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResBadge, { id: f.resultId }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 13, fontWeight: 600, color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: f.title }),
            (f.version || 1) > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { title: `\u7B2C ${f.version} \u7248\uFF08\u540C\u56FE\u91CD\u7ED8\u7684\u7248\u672C\u94FE\uFF09`, style: { fontSize: 10, color: C.accent, flexShrink: 0 }, children: [
              "v",
              f.version
            ] }),
            f.prevId && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "span",
              {
                "data-fig-prev": f.prevId,
                onClick: (e) => {
                  e.stopPropagation();
                  try {
                    if (prev && prev.path) window.open(`/plugins/dsh-science/file?path=${encodeURIComponent(prev.path)}`, "_blank");
                  } catch {
                  }
                },
                title: prev ? `\u5BF9\u6BD4\u4E0A\u4E00\u7248\u672C v${(f.version || 1) - 1}\uFF08sha ${f.prevSha || "?"}\uFF0C${prev.title}\uFF09\u2014\u2014\u70B9\u51FB\u65B0\u6807\u7B7E\u9875\u6253\u5F00` : `\u4E0A\u4E00\u7248\u672C ${f.prevId}\uFF08sha ${f.prevSha || "?"}\uFF09\u6863\u6848\u4E0D\u5728\u5F53\u524D\u5217\u8868\uFF08\u53EF\u80FD\u5DF2\u6E05\u7406\uFF09`,
                style: {
                  fontSize: 10,
                  color: prev ? C.accent : C.faint,
                  flexShrink: 0,
                  cursor: "pointer",
                  border: `1px solid ${prev ? C.accent : C.border}`,
                  borderRadius: 8,
                  padding: "0 6px",
                  lineHeight: "16px"
                },
                children: [
                  "\u21A9 v",
                  (f.version || 1) - 1
                ]
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 11, color: C.muted, margin: "2px 0" }, children: [
            f.id,
            " \xB7 ",
            f.sha256_12,
            " \xB7 ",
            fmtBytes(f.bytes),
            " \xB7 ",
            fmtTime(f.registeredAt)
          ] }),
          f.codePath && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 10, color: C.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: [
            "code: ",
            f.codePath
          ] }),
          inside && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "img",
            {
              src: `/plugins/dsh-science/file?path=${encodeURIComponent(f.path)}`,
              alt: f.title,
              style: { display: "block", maxWidth: "100%", maxHeight: 180, marginTop: 6, borderRadius: 6, border: `1px solid ${C.divider}` }
            }
          ),
          !inside && f.path && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 10, color: C.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: f.path, children: f.path })
        ]
      },
      f.id
    );
  }) });
}
function FilesSection({ files, workspaceRoot }) {
  const [copied, setCopied] = (0, import_react.useState)(null);
  if (!files || files.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "\u5DE5\u4F5C\u533A\u6587\u4EF6\u6811\u4E3A\u7A7A\uFF08\u6216 web \u670D\u52A1\u5668\u672A\u8FD0\u884C\u5728\u5DE5\u4F5C\u533A\u76EE\u5F55\uFF09\u3002" });
  }
  const rows = [...files].sort((a, b) => String(a.path).localeCompare(String(b.path)));
  const onClickRow = (f) => {
    const abs = `${workspaceRoot}/${String(f.path).replace(/\//g, "/")}`;
    if (copyText(abs)) {
      setCopied(f.path);
      setTimeout(() => setCopied((cur) => cur === f.path ? null : cur), 1200);
    }
  };
  const downloadFile = (f) => {
    try {
      window.open(`/plugins/dsh-science/file?path=${encodeURIComponent(f.path)}`, "_blank");
    } catch {
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { border: `1px solid ${C.border}`, borderRadius: 8, padding: "4px 0", maxHeight: 260, overflowY: "auto" }, children: rows.map((f) => {
    const depth = String(f.path).split("/").length - 1;
    const name = String(f.path).split("/").pop();
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        onClick: () => {
          if (!f.dir) onClickRow(f);
        },
        title: f.dir ? name : `\u70B9\u51FB\u590D\u5236\u7EDD\u5BF9\u8DEF\u5F84\uFF1A${workspaceRoot}/${f.path}`,
        style: {
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 10px 3px",
          paddingLeft: 10 + depth * 14,
          fontSize: 12,
          lineHeight: 1.5,
          cursor: f.dir ? "default" : "pointer",
          color: C.fg
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 11, flexShrink: 0 }, children: f.dir ? "\u{1F4C1}" : "\u{1F4C4}" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontWeight: f.dir ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: copied === f.path ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: C.ok }, children: "\u2713 \u5DF2\u590D\u5236" }) : name }),
          !f.dir && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "span",
            {
              onClick: (e) => {
                e.stopPropagation();
                downloadFile(f);
              },
              title: "\u5728\u65B0\u6807\u7B7E\u9875\u6253\u5F00/\u4E0B\u8F7D",
              style: { flexShrink: 0, cursor: "pointer", fontSize: 11, padding: "0 3px", color: C.muted },
              children: "\u2B07"
            }
          ),
          !f.dir && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: C.faint, fontSize: 10, marginLeft: "auto", flexShrink: 0 }, children: fmtBytes(f.size) })
        ]
      },
      f.path
    );
  }) });
}
function RemoteSection({ sshHosts, sshJobs }) {
  const hosts = sshHosts || [];
  const jobs = (sshJobs || []).slice(0, 5);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, { title: "SSH \u4E3B\u673A", children: [
      hosts.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "\u6682\u65E0\u4E3B\u673A\u3002\u547D\u4EE4 sci_ssh_profiles \u53EF\u6DFB\u52A0\uFF0Csci_ssh_probe \u63A2\u6D4B\u3002" }),
      hosts.map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 12, padding: "4px 0", borderBottom: `1px solid ${C.divider}`, color: C.fg }, children: [
        "\u{1F5A5} ",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: h.name || h.key }),
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { color: C.muted }, children: [
          h.host,
          " \xB7 ",
          h.auth,
          h.probedAt ? " \xB7 \u5DF2\u63A2\u6D4B" : ""
        ] }),
        h.os && h.os !== "(\u7A7A)" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 10, color: C.faint, paddingLeft: 18 }, children: h.os })
      ] }, h.name || h.key))
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, { title: "\u8FDC\u7A0B\u4F5C\u4E1A\uFF08\u6700\u8FD1\uFF09", children: [
      jobs.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "\u6682\u65E0\u4F5C\u4E1A\u3002sci_job_submit \u63D0\u4EA4\uFF0C\u7ED3\u679C\u7ECF sci_job_harvest \u6536\u56DE\u3002" }),
      jobs.map((j) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 11, color: C.muted, padding: "3px 0" }, children: [
        j.name || j.id || j.key,
        " \xB7 ",
        j.mode || j.profile || "",
        " \xB7 ",
        fmtTime(j.submittedAt)
      ] }, j.id || j.key))
    ] })
  ] });
}
var REVIEW_STATUS_COLOR = {
  done: C.ok,
  failed: C.err,
  "parse-failed": C.warn
};
function ReviewsSection({ reviews }) {
  const [expanded, setExpanded] = (0, import_react.useState)(() => /* @__PURE__ */ new Set());
  const [details, setDetails] = (0, import_react.useState)(() => /* @__PURE__ */ new Map());
  const [loading, setLoading] = (0, import_react.useState)(() => /* @__PURE__ */ new Set());
  const [errors, setErrors] = (0, import_react.useState)(() => /* @__PURE__ */ new Map());
  const inflight = (0, import_react.useRef)(/* @__PURE__ */ new Set());
  const aliveRef = (0, import_react.useRef)(true);
  (0, import_react.useEffect)(() => () => {
    aliveRef.current = false;
  }, []);
  const loadDetail = async (id) => {
    if (inflight.current.has(id)) return;
    inflight.current.add(id);
    setLoading((prev) => new Set(prev).add(id));
    setErrors((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    try {
      const res = await fetch(`/plugins/dsh-science/review?run=${encodeURIComponent(id)}`, { credentials: "same-origin" });
      let body = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      if (!aliveRef.current) return;
      if (!res.ok) throw new Error(body && body.error || `HTTP ${res.status}`);
      if (!body || !body.run) throw new Error("\u54CD\u5E94\u7F3A\u5C11 run \u6570\u636E\uFF08\u670D\u52A1\u5668\u53EF\u80FD\u4E0D\u652F\u6301 /review\uFF09");
      setDetails((prev) => new Map(prev).set(id, body.run));
    } catch (err) {
      if (aliveRef.current) setErrors((prev) => new Map(prev).set(id, err && err.message || String(err)));
    } finally {
      inflight.current.delete(id);
      if (aliveRef.current) {
        setLoading((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }
  };
  const toggle = (id) => {
    const opening = !expanded.has(id);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (opening && !details.has(id) && !loading.has(id)) loadDetail(id);
  };
  if (!reviews || reviews.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "\u6682\u65E0\u5BA1\u67E5\u8BB0\u5F55\u3002\u7528 /sci-review \u5BA1\u67E5\u6700\u8FD1\u4E00\u8F6E\u56DE\u590D\uFF0C\u6216\u8BA9\u961F\u957F sci_review_send \u6D3E\u7ED9 reviewer\u3002" });
  }
  const rows = [...reviews].sort((a, b) => (b.finishedAt || b.startedAt || 0) - (a.finishedAt || a.startedAt || 0));
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: rows.map((r) => {
    const id = r.id || r.key;
    const summaryFindings = Array.isArray(r.findings) ? r.findings : [];
    const counts = r.counts || {
      fail: summaryFindings.filter((f) => f && f.severity === "fail").length,
      warn: summaryFindings.filter((f) => f && f.severity === "warn").length
    };
    const detail = details.get(id);
    const findings = detail && Array.isArray(detail.findings) ? detail.findings : null;
    const meta = detail || r;
    const isOpen = expanded.has(id);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "div",
        {
          "data-review-row": id,
          onClick: () => toggle(id),
          title: `${id} \xB7 \u70B9\u51FB${isOpen ? "\u6536\u8D77" : "\u5C55\u5F00"}findings`,
          style: {
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 8px",
            marginBottom: 4,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            background: C.card,
            fontSize: 12,
            cursor: "pointer"
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dot, { color: REVIEW_STATUS_COLOR[r.status] || C.faint, size: 7 }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { style: { color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "0 1 auto" }, children: id }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { color: C.muted, fontSize: 11, flexShrink: 0 }, children: [
              "turn ",
              typeof r.turn === "number" ? r.turn : "\u2014"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { color: C.muted, fontSize: 11, flexShrink: 0 }, children: [
              "fail ",
              counts.fail,
              " \xB7 warn ",
              counts.warn
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: C.faint, fontSize: 10, marginLeft: "auto", flexShrink: 0 }, children: fmtTime(r.finishedAt || r.startedAt) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: C.faint, fontSize: 10, flexShrink: 0 }, children: isOpen ? "\u25BE" : "\u25B8" })
          ]
        }
      ),
      isOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "div",
        {
          "data-review-detail": id,
          style: {
            border: `1px solid ${C.divider}`,
            borderRadius: 8,
            padding: "6px 10px",
            marginBottom: 4,
            background: C.chip,
            fontSize: 11,
            color: C.muted,
            lineHeight: 1.6
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { color: C.faint }, children: [
              id,
              " \xB7 ",
              meta.status,
              " \xB7 \u89E6\u53D1 ",
              meta.trigger || "review",
              " \xB7 turn ",
              typeof meta.turn === "number" ? meta.turn : "\u2014",
              meta.sessionId ? ` \xB7 \u4F1A\u8BDD ${String(meta.sessionId).slice(0, 12)}` : ""
            ] }),
            loading.has(id) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { "data-review-loading": "1", style: { marginTop: 4 }, children: "\u52A0\u8F7D findings\u2026" }),
            errors.has(id) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { "data-review-error": "1", style: { marginTop: 4, color: C.err }, children: [
              "findings \u52A0\u8F7D\u5931\u8D25\uFF1A",
              errors.get(id),
              "\uFF08\u6536\u8D77\u540E\u91CD\u65B0\u5C55\u5F00\u53EF\u91CD\u8BD5\uFF09"
            ] }),
            findings && findings.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginTop: 4 }, children: [
              "\uFF08\u65E0 findings",
              detail && detail.status === "parse-failed" || r.status === "parse-failed" ? "\u2014\u2014\u5BA1\u67E5\u5668\u8F93\u51FA\u672A\u89E3\u6790\u4E3A JSON\uFF0C\u672C\u6B21\u4E0D\u6784\u6210\u7ED3\u8BBA" : "",
              "\uFF09"
            ] }),
            findings && findings.map((f, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { whiteSpace: "pre-wrap", marginTop: 4 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", { style: { color: f && f.severity === "fail" ? C.err : f && f.severity === "warn" ? C.warn : C.ok }, children: [
                "[",
                String(f && f.severity || "?").toUpperCase(),
                "]"
              ] }),
              " ",
              "(",
              f && f.check || "?",
              ") ",
              f && f.message || "",
              f && f.evidence ? ` | \u8BC1\u636E: ${String(f.evidence).slice(0, 160)}` : ""
            ] }, i))
          ]
        }
      )
    ] }, id);
  }) });
}
function ArtifactsTab({ data, focusFigureId, onClearFocusFigure }) {
  const figs = Array.isArray(data.figures) ? data.figures : [];
  const files = Array.isArray(data.files) ? data.files : [];
  const reviews = Array.isArray(data.reviews) ? data.reviews : [];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, { title: `\u56FE\u8868\uFF08${figs.length}\uFF09`, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FiguresSection, { figures: figs, workspaceRoot: data.workspaceRoot, focusFigureId, onClearFocus: onClearFocusFigure }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, { title: `\u6587\u4EF6\uFF08${files.length}\uFF09`, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilesSection, { files, workspaceRoot: data.workspaceRoot }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RemoteSection, { sshHosts: data.sshHosts, sshJobs: data.sshJobs }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, { title: `\u5BA1\u67E5\uFF08${reviews.length}\uFF09`, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReviewsSection, { reviews }) })
  ] });
}
var SafeBody = class extends import_react.default.Component {
  constructor(p) {
    super(p);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  render() {
    if (this.state.err) {
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: 10, fontSize: 12, color: C.err }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "\u5DE5\u4F5C\u53F0\u6E32\u67D3\u51FA\u9519" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { style: { whiteSpace: "pre-wrap", fontSize: 11 }, children: String(this.state.err && this.state.err.message || this.state.err) })
      ] });
    }
    return this.props.children;
  }
};
function WorkbenchBody({ openMemberSession, memberOpenAvailable }) {
  const [tab, setTab] = (0, import_react.useState)("team");
  const [focusTaskId, setFocusTaskId] = (0, import_react.useState)(null);
  const [focusFigureId, setFocusFigureId] = (0, import_react.useState)(null);
  const state = usePollState(POLL_MS);
  const goTeam = (taskId) => {
    if (taskId) setFocusTaskId(taskId);
    setTab("team");
  };
  const goArtifacts = (figureId) => {
    if (figureId) setFocusFigureId(figureId);
    setTab("artifacts");
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: 10, fontSize: 13 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: "@keyframes dsh-sci-pulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }@keyframes dsh-sci-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2.5px) } }@keyframes dsh-sci-nodeglow { 0%,100% { box-shadow: 0 0 0 0 rgba(27,110,194,0) } 50% { box-shadow: 0 0 6px 1px rgba(27,110,194,0.4) } }[data-task-row],[data-fig-card],[data-result-row],[data-review-row],[data-inbox-row],[data-member-tile],[data-dag-node],[data-dep-chip],[data-row-dep-chip],[data-fig-prev]{transition:background-color 120ms ease,border-color 120ms ease,opacity 120ms ease,color 120ms ease}[data-task-row]:hover{background:var(--dsw-alias-markdown-code-block, rgba(127,127,127,0.10))!important;border-color:var(--dsw-alias-border-l4, rgba(127,127,127,0.4))!important}[data-result-row]:hover{background:var(--dsw-alias-markdown-code-block, rgba(127,127,127,0.10))!important;border-color:var(--dsw-alias-border-l4, rgba(127,127,127,0.4))!important}[data-review-row]:hover{background:var(--dsw-alias-markdown-code-block, rgba(127,127,127,0.10))!important;border-color:var(--dsw-alias-border-l4, rgba(127,127,127,0.4))!important}[data-fig-card]:hover{border-color:var(--dsw-alias-border-l4, rgba(127,127,127,0.4))!important}[data-inbox-row]:hover{background:var(--dsw-alias-markdown-code-block, rgba(127,127,127,0.10))!important}[data-member-tile]:hover{background:var(--dsw-alias-button-ghost-active-fill, rgba(127,127,127,0.14))}[data-dag-node]{transition:border-color 140ms ease,background 140ms ease,box-shadow 220ms ease}[data-dag-node]:hover{border-color:var(--dsw-alias-state-business-primary, #1B6EC2)!important}[data-dep-chip]:hover,[data-row-dep-chip]:hover{border-color:var(--dsw-alias-state-business-primary, #1B6EC2)!important;color:var(--dsw-alias-state-business-primary, #1B6EC2)!important}" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { style: { fontSize: 14 }, children: "\u{1F9EA} \u79D1\u7814\u5DE5\u4F5C\u53F0" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: 10, color: C.muted }, children: [
        "v",
        VERSION
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", gap: 4, margin: "4px 0 2px" }, children: [
      ["team", "\u56E2\u961F"],
      ["paper", "\u6587\u7AE0\u6846\u67B6"],
      ["artifacts", "\u4EA7\u7269"]
    ].map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "button",
      {
        "data-tab": id,
        onClick: () => setTab(id),
        style: {
          flex: 1,
          padding: "5px 0",
          fontSize: 12,
          border: `1px solid ${tab === id ? C.accent : C.border}`,
          borderRadius: 6,
          background: tab === id ? C.accent : "transparent",
          color: tab === id ? "#fff" : C.fg,
          cursor: "pointer"
        },
        children: label
      },
      id
    )) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeBody, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DataGate, { state, fallback: tab === "team" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SkillMenuDesktopFallback, {}) : null, children: () => tab === "team" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      TeamTab,
      {
        data: state.data,
        openMemberSession,
        memberOpenAvailable,
        focusTaskId,
        onClearFocusTask: () => setFocusTaskId(null),
        refresh: state.refresh
      }
    ) : tab === "paper" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BlueprintTab, { data: state.data, onOpenTask: goTeam, onOpenFigure: goArtifacts }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArtifactsTab, { data: state.data, focusFigureId, onClearFocusFigure: () => setFocusFigureId(null) }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 10, color: C.muted, marginTop: 8, borderTop: `1px solid ${C.divider}`, paddingTop: 6 }, children: "\u6280\u80FD\u7531\u56E2\u961F\u6210\u5458\u81EA\u4E3B\u4F7F\u7528 \xB7 \u6570\u636E\u6BCF 3 \u79D2\u5237\u65B0" })
  ] });
}
function apply(ctx) {
  let mount = null;
  try {
    mount = window.__DSH_SCIENCE_CLIENT_MOUNT__ || null;
    if (!mount) window.__DSH_SCIENCE_CLIENT_MOUNT__ = mount = { tab: false, body: false };
    if (mount.tab && mount.body) {
      console.warn("[dsh-science] apply() re-invoked on an already-mounted page; keeping first registration (double-mount guard)");
      return;
    }
    window.__DSH_SCIENCE_CLIENT_MOUNTED = true;
    window.__DSH_SCIENCE_CLIENT_APPLIED = true;
  } catch {
    mount = null;
  }
  function service(name) {
    try {
      return ctx.get(name);
    } catch {
      return void 0;
    }
  }
  function currentSessionIdOf() {
    try {
      const list = service("sessions") && service("sessions").list;
      if (!list || typeof list.getSnapshot !== "function") return void 0;
      const snap = list.getSnapshot();
      if (!snap) return void 0;
      const row = Object.values(snap.byId || {}).find(
        (r) => r && r.retainedBy && (r.retainedBy.mainView ?? 0) > 0
      );
      if (row && row.id) return row.id;
      if (typeof snap.current === "string") return snap.current;
      return void 0;
    } catch {
      return void 0;
    }
  }
  function openMemberSession(member) {
    const ws = service("uiWorkspace");
    if (!ws || typeof ws.openSession !== "function") {
      throw new Error("\u5F53\u524D\u5BBF\u4E3B\u4E0D\u652F\u6301\u6253\u5F00\u6210\u5458\u4F1A\u8BDD\uFF08uiWorkspace \u7F3A\u5931\uFF09");
    }
    const childId = member && member.childId;
    if (!childId) throw new Error("\u8BE5\u6210\u5458\u672A\u8BB0\u5F55 childId\uFF08\u8F83\u8001\u7684\u4EFB\u52A1\u677F\u6570\u636E\uFF0C\u91CD\u65B0\u751F\u6210\u6210\u5458\u540E\u53EF\u7528\uFF09");
    const recorded = member && member.parentSessionId;
    const parentId = recorded || currentSessionIdOf();
    if (!parentId) throw new Error(recorded ? "\u8BE5\u6210\u5458\u8BB0\u5F55\u7684\u7236\u4F1A\u8BDD\u4E3A\u7A7A" : "\u65E0\u6CD5\u786E\u5B9A\u5F53\u524D\u4E3B\u4F1A\u8BDD\uFF08\u8BE5\u6210\u5458\u4E5F\u672A\u8BB0\u5F55 parentSessionId\uFF09");
    ws.openSession({ parentSessionId: parentId, childSessionId: childId, mode: "continuable" });
  }
  function memberOpenAvailable() {
    try {
      const ws = service("uiWorkspace");
      if (!ws || typeof ws.openSession !== "function") return false;
      return !!currentSessionIdOf() || teamRuntime.hasRecordedParents;
    } catch {
      return false;
    }
  }
  try {
    if (!mount || !mount.tab) {
      ctx.effect(
        () => {
          const dispose = ctx.sidebarRightTabs.register({
            id: "dsh-science/workbench",
            kind: "workbench",
            title: () => "\u79D1\u7814\u5DE5\u4F5C\u53F0",
            guide: [
              {
                id: "workbench",
                order: 10,
                title: () => "\u79D1\u7814\u5DE5\u4F5C\u53F0",
                description: () => "\u4EFB\u52A1\u6D41 DAG\uFF08\u6210\u5458\u59FF\u6001/\u4F9D\u8D56\u8DF3\u8F6C/\u6536\u4EF6\u7BB1\uFF09\xB7 \u6587\u7AE0\u6846\u67B6\uFF08\u786E\u8BA4/\u53C2\u8003\u6587\u732E/\u5FEB\u7B5B\uFF09\xB7 \u4EA7\u7269\uFF08\u56FE\u8868\u7248\u672C\u94FE/\u6587\u4EF6/\u8FDC\u7A0B/\u5BA1\u67E5\uFF09\uFF08dsh-science\uFF09"
              }
            ]
          });
          if (mount) mount.tab = true;
          return () => {
            if (mount) mount.tab = false;
            if (typeof dispose === "function") dispose();
          };
        },
        "dsh-science workbench tab type"
      );
    }
    if (!mount || !mount.body) {
      ctx.effect(
        () => {
          const dispose = ctx.slots.inject(
            "sidebar.right.pane.tab",
            () => ctx.slots.register(
              {
                name: "sidebar.right.pane.tab",
                key: "dsh-science/workbench",
                inject: () => ({ openMemberSession, memberOpenAvailable })
              },
              WorkbenchBody
            )
          );
          if (mount) mount.body = true;
          return () => {
            if (mount) mount.body = false;
            if (typeof dispose === "function") dispose();
          };
        },
        "dsh-science workbench tab body"
      );
    }
  } catch (err) {
    console.error("[dsh-science] sidebar tab registration failed:", err);
  }
}
return module.exports; } });
