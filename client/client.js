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
var import_react10 = __toESM(require("react"), 1);

// client-src/workbench/ResearchWorkbench.jsx
var import_react8 = __toESM(require("react"), 1);

// client-src/workbench/workflow-actions.js
var ACTION_SKILLS = Object.freeze({
  explore: "sci-hypothesis",
  literature: "sci-research",
  draw: "sci-figures",
  write: "sci-writing",
  slides: "sci-slides"
});
var textOf = (value) => typeof value === "string" ? value.trim() : "";
var resultListOf = (paperState) => Array.isArray(paperState?.results) ? paperState.results : [];
function resultById(paperState, id) {
  return resultListOf(paperState).find((result) => result && result.id === id) || null;
}
function resultLabel(result) {
  const title = textOf(result?.title) || textOf(result?.claim) || "\u672A\u547D\u540D\u7ED3\u679C";
  return `${title}\uFF08${result?.id || "\u65E0\u7F16\u53F7"}\uFF09`;
}
function resultConfirmationGate(coreConfirmed, resultConfirmed) {
  if (coreConfirmed !== true) return "core";
  if (resultConfirmed !== true) return "result";
  return null;
}
function block(code, message, recovery, field = null) {
  return { ok: false, error: { code, message, recovery, field } };
}
function request(action, text, targetId = null) {
  return { ok: true, request: { action, text, targetId, mode: "queue" } };
}
function skillRequest(skill, instructions, extra) {
  const suffix = extra ? `

\u8865\u5145\u8981\u6C42\uFF1A${extra}` : "";
  return `${ACTION_SKILLS[skill] ? `/${ACTION_SKILLS[skill]}` : `/${skill}`}

${instructions}${suffix}`;
}
function buildWorkflowRequest({ action, paperState = {}, targetId = null, userInput = {} } = {}) {
  const input = userInput && typeof userInput === "object" ? userInput : {};
  const core = paperState?.core || {};
  const results = resultListOf(paperState);
  const target = targetId ? resultById(paperState, targetId) : null;
  if (targetId && !target && targetId !== "core") {
    return block("missing-result", "\u627E\u4E0D\u5230\u6240\u9009\u7814\u7A76\u7ED3\u679C\uFF0C\u9875\u9762\u72B6\u6001\u53EF\u80FD\u5DF2\u66F4\u65B0\u3002", "\u5237\u65B0\u5DE5\u4F5C\u53F0\u540E\u91CD\u65B0\u9009\u62E9\u7814\u7A76\u7ED3\u679C\u3002");
  }
  switch (action) {
    case "explore": {
      const question = textOf(input.question);
      if (!question) return block("missing-input", "\u8BF7\u5148\u5199\u4E0B\u60F3\u63A2\u7D22\u7684\u7814\u7A76\u95EE\u9898\u3002", "\u8865\u5145\u7814\u7A76\u95EE\u9898\u540E\u518D\u5F00\u59CB\u63A2\u7D22\u3002", "question");
      const details = [
        `\u7814\u7A76\u95EE\u9898\uFF1A${question}`,
        textOf(input.scope) && `\u7814\u7A76\u8303\u56F4\uFF1A${textOf(input.scope)}`,
        textOf(input.existingData) && `\u5DF2\u6709\u6570\u636E\uFF1A${textOf(input.existingData)}`,
        textOf(input.constraints) && `\u7B97\u529B\u4E0E\u65F6\u95F4\u7EA6\u675F\uFF1A${textOf(input.constraints)}`
      ].filter(Boolean).join("\n");
      return request(action, skillRequest("explore", `\u8BF7\u6309\u79D1\u7814\u63A2\u7D22\u6D41\u7A0B\u5904\u7406\u4EE5\u4E0B\u95EE\u9898\u3002\u5148\u6838\u5BF9\u5DF2\u6709\u8BC1\u636E\u3001\u5173\u952E\u5047\u8BBE\u548C\u53EF\u884C\u8303\u56F4\uFF0C\u518D\u63D0\u51FA\u53EF\u68C0\u9A8C\u7684\u7814\u7A76\u65B9\u5411\uFF1B\u4E0D\u8981\u628A\u5047\u8BBE\u5199\u6210\u7814\u7A76\u7ED3\u8BBA\u3002

${details}`, textOf(input.notes)));
    }
    case "import_results": {
      const source = textOf(input.source);
      if (!source) return block("missing-input", "\u8BF7\u8BF4\u660E\u8981\u5BFC\u5165\u7684\u5DF2\u6709\u7ED3\u679C\u6765\u81EA\u54EA\u91CC\u3002", "\u5199\u5165\u6587\u4EF6\u8DEF\u5F84\u3001\u4F1A\u8BDD\u6750\u6599\u6216\u7ED3\u679C\u6458\u8981\uFF0C\u518D\u63D0\u4EA4\u7ED9\u5F53\u524D\u5BF9\u8BDD\u3002", "source");
      return request(action, `\u8BF7\u68C0\u67E5\u5E76\u6574\u7406\u6211\u5DF2\u6709\u7684\u79D1\u7814\u7ED3\u679C\uFF0C\u4E0D\u8981\u8865\u9020\u7F3A\u5931\u6570\u636E\u3002

\u7ED3\u679C\u6765\u6E90\u6216\u6458\u8981\uFF1A${source}${textOf(input.notes) ? `

\u8865\u5145\u8BF4\u660E\uFF1A${textOf(input.notes)}` : ""}

\u5148\u5217\u51FA\u53EF\u8FFD\u6EAF\u7684\u7ED3\u679C\u3001\u6765\u6E90\u548C\u4E0D\u786E\u5B9A\u9879\uFF0C\u518D\u63D0\u51FA\u6587\u7AE0\u7ED3\u6784\u8349\u6848\uFF1B\u672A\u7ECF\u6211\u786E\u8BA4\uFF0C\u4E0D\u8981\u6D3E\u53D1\u6B63\u5F0F\u6267\u884C\u4EFB\u52A1\u3002`);
    }
    case "literature": {
      const question = textOf(input.question) || textOf(core.claim) || textOf(core.title);
      if (!question) return block("missing-input", "\u8FD8\u6CA1\u6709\u53EF\u7528\u4E8E\u6587\u732E\u63A2\u7D22\u7684\u7814\u7A76\u95EE\u9898\u3002", "\u5148\u5F00\u59CB\u63A2\u7D22\uFF0C\u6216\u8865\u5145\u4E00\u53E5\u5F53\u524D\u7814\u7A76\u95EE\u9898\u3002", "question");
      const existing = results.map(resultLabel).join("\uFF1B");
      const text = skillRequest("literature", `\u56F4\u7ED5\u4EE5\u4E0B\u7814\u7A76\u95EE\u9898\u6269\u5C55\u6587\u732E\u63A2\u7D22\uFF0C\u5E76\u533A\u5206\u5DF2\u77E5\u8BC1\u636E\u3001\u4E89\u8BAE\u548C\u672A\u89E3\u51B3\u95EE\u9898\u3002\u4E0D\u8981\u628A\u6458\u8981\u6216\u6A21\u578B\u63A8\u65AD\u5199\u6210\u5DF2\u9A8C\u8BC1\u7ED3\u679C\u3002

\u7814\u7A76\u95EE\u9898\uFF1A${question}${existing ? `

\u5F53\u524D\u6587\u7AE0\u7ED3\u679C\uFF1A${existing}` : ""}`, textOf(input.notes));
      return request(action, text);
    }
    case "generate_structure": {
      const question = textOf(input.question) || textOf(core.claim) || textOf(core.title);
      if (!question && results.length === 0) return block("missing-context", "\u5F53\u524D\u6CA1\u6709\u7814\u7A76\u95EE\u9898\u6216\u5DF2\u6709\u7ED3\u679C\u53EF\u4F9B\u7EC4\u7EC7\u3002", "\u5148\u5F00\u59CB\u63A2\u7D22\uFF0C\u6216\u5BFC\u5165\u4E00\u9879\u5DF2\u6709\u7ED3\u679C\u3002");
      const context = question ? `\u7814\u7A76\u95EE\u9898\u6216\u6838\u5FC3\u7ED3\u8BBA\u5019\u9009\uFF1A${question}` : `\u5DF2\u6709\u7814\u7A76\u7ED3\u679C\uFF1A${results.map(resultLabel).join("\uFF1B")}`;
      return request(action, `\u8BF7\u57FA\u4E8E\u5F53\u524D\u4F1A\u8BDD\u8BC1\u636E\u4E0E\u4E0B\u5217\u7814\u7A76\u80CC\u666F\u5EFA\u7ACB\u6587\u7AE0\u7ED3\u6784\u8349\u6848\uFF1A\u63D0\u51FA\u6838\u5FC3\u7ED3\u8BBA\u5019\u9009\uFF0C\u5E76\u62C6\u5206\u4E3A 3\u20135 \u4E2A\u53EF\u72EC\u7ACB\u6838\u9A8C\u7684 Result\u3002\u6BCF\u9879\u5199\u6E05\u7814\u7A76\u95EE\u9898\u3001\u8BC1\u636E\u9700\u6C42\u3001\u53CD\u8BC1\u6761\u4EF6\u548C\u5EFA\u8BAE\u5448\u73B0\u65B9\u5F0F\u3002\u53EA\u751F\u6210\u5F85\u786E\u8BA4\u8349\u6848\uFF0C\u4E0D\u8981\u81EA\u52A8\u786E\u8BA4\u6216\u6D3E\u53D1\u4EFB\u52A1\u3002

${context}${textOf(input.notes) ? `

\u8865\u5145\u8981\u6C42\uFF1A${textOf(input.notes)}` : ""}`);
    }
    case "optimize_structure": {
      const guidance = textOf(input.guidance);
      if (!guidance) return block("missing-input", "\u8BF7\u8BF4\u660E\u5E0C\u671B\u5982\u4F55\u8C03\u6574\u7ED3\u6784\u6216\u7814\u7A76\u7ED3\u679C\u3002", "\u5199\u4E0B\u4FEE\u6539\u4F9D\u636E\u540E\u518D\u63D0\u4EA4\u3002", "guidance");
      const targetText = target ? `\u76EE\u6807\u7814\u7A76\u7ED3\u679C\uFF1A${resultLabel(target)}
\u5F53\u524D\u4E3B\u5F20\uFF1A${textOf(target.claim) || "\u672A\u586B\u5199"}` : "\u76EE\u6807\uFF1A\u6574\u4F53\u6587\u7AE0\u7ED3\u6784\u4E0E Result \u4E4B\u95F4\u7684\u5173\u7CFB";
      return request(action, `\u8BF7\u6309\u65B0\u7684\u7814\u7A76\u4E8B\u5B9E\u4FEE\u6539\u8BBA\u6587\u7ED3\u6784\u3002\u4FDD\u7559\u53EF\u8FFD\u6EAF\u8BC1\u636E\uFF0C\u4E0D\u628A\u4FEE\u6539\u5EFA\u8BAE\u76F4\u63A5\u5F53\u6210\u5DF2\u786E\u8BA4\u5185\u5BB9\u3002

${targetText}

\u4FEE\u6539\u8BF4\u660E\uFF1A${guidance}${textOf(input.notes) ? `

\u8865\u5145\u8981\u6C42\uFF1A${textOf(input.notes)}` : ""}`, target?.id || null);
    }
    case "confirm": {
      const confirmCore = targetId === "core" || !targetId;
      if (confirmCore && !textOf(core.claim)) return block("missing-core", "\u6838\u5FC3\u7814\u7A76\u7ED3\u8BBA\u8FD8\u6CA1\u6709\u586B\u5199\u3002", "\u5148\u751F\u6210\u6587\u7AE0\u7ED3\u6784\u6216\u8865\u5145\u6838\u5FC3\u7ED3\u8BBA\uFF0C\u518D\u8BF7\u6C42\u786E\u8BA4\u3002");
      if (!confirmCore && !target) return block("missing-result", "\u627E\u4E0D\u5230\u5F85\u786E\u8BA4\u7684\u7814\u7A76\u7ED3\u679C\u3002", "\u5237\u65B0\u5DE5\u4F5C\u53F0\u540E\u91CD\u65B0\u9009\u62E9\u3002");
      if (confirmCore && core.confirmed) return block("already-confirmed", "\u6838\u5FC3\u7814\u7A76\u7ED3\u8BBA\u7684\u5F53\u524D\u4FEE\u8BA2\u5DF2\u7ECF\u786E\u8BA4\u3002", "\u5982\u9700\u4FEE\u6539\uFF0C\u8BF7\u5148\u63D0\u4EA4\u7ED3\u6784\u4FEE\u6539\uFF1B\u4FEE\u6539\u540E\u7684\u5185\u5BB9\u9700\u8981\u91CD\u65B0\u786E\u8BA4\u3002");
      if (target?.confirmed) return block("already-confirmed", "\u8BE5\u7814\u7A76\u7ED3\u679C\u7684\u5F53\u524D\u4FEE\u8BA2\u5DF2\u7ECF\u786E\u8BA4\u3002", "\u5982\u9700\u4FEE\u6539\uFF0C\u8BF7\u5148\u63D0\u4EA4\u7ED3\u6784\u4FEE\u6539\uFF1B\u4FEE\u6539\u540E\u7684\u5185\u5BB9\u9700\u8981\u91CD\u65B0\u786E\u8BA4\u3002");
      const subject = confirmCore ? `\u6838\u5FC3\u7814\u7A76\u7ED3\u8BBA\u201C${textOf(core.title) || textOf(core.claim)}\u201D` : `\u7814\u7A76\u7ED3\u679C\u201C${resultLabel(target)}\u201D`;
      return request(action, `\u8BF7\u8C03\u7528\u8BBA\u6587\u84DD\u56FE\u786E\u8BA4\u5DE5\u5177\uFF0C\u4E3A${subject}\u53D1\u8D77 DSH \u539F\u751F\u5BA1\u6279\u5361\u3002\u5BA1\u6279\u901A\u8FC7\u524D\u4FDD\u6301\u5F85\u786E\u8BA4\u72B6\u6001\uFF0C\u4E0D\u8981\u7EE7\u7EED\u521B\u5EFA\u6B63\u5F0F\u6267\u884C\u4EFB\u52A1\u3002${textOf(input.notes) ? `

\u9700\u8981\u4E00\u5E76\u8BF4\u660E\uFF1A${textOf(input.notes)}` : ""}`, confirmCore ? "core" : target.id);
    }
    case "refine_tasks": {
      if (!target) return block("missing-result", "\u8BF7\u5148\u9009\u62E9\u8981\u7EC6\u5316\u7684\u7814\u7A76\u7ED3\u679C\u3002", "\u4ECE\u8BBA\u6587\u4E3B\u7EBF\u9009\u62E9\u4E00\u4E2A\u7814\u7A76\u7ED3\u679C\u540E\u518D\u8BD5\u3002");
      const gate = resultConfirmationGate(core.confirmed, target.confirmed);
      if (gate === "core") return block("unconfirmed-core", "\u6838\u5FC3\u7814\u7A76\u7ED3\u8BBA\u5C1A\u672A\u786E\u8BA4\uFF0C\u4E0D\u80FD\u521B\u5EFA\u6B63\u5F0F\u6267\u884C\u4EFB\u52A1\u3002", "\u5148\u68C0\u67E5\u6838\u5FC3\u7ED3\u8BBA\u5E76\u5B8C\u6210\u786E\u8BA4\uFF1B\u5982\u9700\u4FEE\u6539\uFF0C\u5148\u4F18\u5316\u6587\u7AE0\u7ED3\u6784\u3002");
      if (gate === "result") return block("unconfirmed-result", `\u201C${resultLabel(target)}\u201D\u5C1A\u672A\u786E\u8BA4\uFF0C\u4E0D\u80FD\u521B\u5EFA\u6B63\u5F0F\u6267\u884C\u4EFB\u52A1\u3002`, "\u5148\u68C0\u67E5\u7814\u7A76\u7ED3\u679C\u5E76\u5B8C\u6210\u786E\u8BA4\uFF1B\u5982\u9700\u4FEE\u6539\uFF0C\u5148\u4F18\u5316\u7ED3\u6784\u3002");
      const text = `\u8BF7\u4E3A\u5DF2\u786E\u8BA4\u7684\u7814\u7A76\u7ED3\u679C\u7EC6\u5316\u6267\u884C\u4EFB\u52A1\u3001\u4F9D\u8D56\u5173\u7CFB\u548C\u53EF\u6838\u9A8C\u7684\u5B8C\u6210\u5224\u636E\u3002\u4FDD\u6301\u7ED3\u679C\u4E0E\u4EFB\u52A1\u53CC\u5411\u5173\u8054\uFF1B\u672A\u89E3\u51B3\u4F9D\u8D56\u987B\u6807\u660E\uFF0C\u4E0D\u8981\u628A\u6D3E\u5355\u89C6\u4E3A\u5B8C\u6210\u3002

\u7814\u7A76\u7ED3\u679C\uFF1A${resultLabel(target)}
\u4E3B\u5F20\uFF1A${textOf(target.claim) || "\u672A\u586B\u5199"}${textOf(input.notes) ? `

\u8865\u5145\u8981\u6C42\uFF1A${textOf(input.notes)}` : ""}`;
      return request(action, text, target.id);
    }
    case "draw": {
      if (!target) return block("missing-result", "\u8FD8\u6CA1\u6709\u53EF\u5173\u8054\u7684\u7814\u7A76\u7ED3\u679C\u3002", "\u5148\u5EFA\u7ACB\u6216\u5BFC\u5165\u7ED3\u679C\uFF0C\u518D\u4ECE\u8BE5\u7ED3\u679C\u5F00\u59CB\u7ED8\u56FE\u3002");
      const gate = resultConfirmationGate(core.confirmed, target.confirmed);
      if (gate === "core") return block("unconfirmed-core", "\u6838\u5FC3\u7814\u7A76\u7ED3\u8BBA\u5C1A\u672A\u786E\u8BA4\uFF0C\u4E0D\u80FD\u542F\u52A8\u6B63\u5F0F\u7ED8\u56FE\u4EFB\u52A1\u3002", "\u5148\u68C0\u67E5\u6838\u5FC3\u7ED3\u8BBA\u5E76\u5B8C\u6210\u786E\u8BA4\uFF1B\u5982\u9700\u4FEE\u6539\uFF0C\u5148\u4F18\u5316\u6587\u7AE0\u7ED3\u6784\u3002");
      if (gate === "result") return block("unconfirmed-result", `\u201C${resultLabel(target)}\u201D\u5C1A\u672A\u786E\u8BA4\uFF0C\u4E0D\u80FD\u542F\u52A8\u6B63\u5F0F\u7ED8\u56FE\u4EFB\u52A1\u3002`, "\u5148\u786E\u8BA4\u7ED3\u679C\u4E3B\u5F20\uFF0C\u6216\u7EE7\u7EED\u4FEE\u6539\u6587\u7AE0\u7ED3\u6784\u3002");
      const text = skillRequest("draw", `\u4E3A\u5DF2\u786E\u8BA4\u7684\u7814\u7A76\u7ED3\u679C\u5236\u5B9A\u53EF\u8FFD\u6EAF\u56FE\u4EF6\u8BA1\u5212\u3002\u5148\u786E\u8BA4\u56FE\u8981\u56DE\u7B54\u7684\u95EE\u9898\u3001\u6570\u636E\u6765\u6E90\u3001\u7EDF\u8BA1\u65B9\u6CD5\u548C\u76EE\u6807\u671F\u520A\uFF1B\u9700\u8981\u8F93\u51FA\u6295\u7A3F\u5019\u9009\u56FE\u65F6\u4FDD\u7559\u6E90\u6570\u636E\u3001\u7ED8\u56FE\u4EE3\u7801\u3001\u7269\u7406\u5C3A\u5BF8\u4E0E\u4EBA\u5DE5\u7EC8\u5BA1\u8981\u6C42\u3002\u4E0D\u8981\u58F0\u79F0\u81EA\u52A8\u8FBE\u5230\u671F\u520A\u6807\u51C6\u3002

\u7814\u7A76\u7ED3\u679C\uFF1A${resultLabel(target)}
\u4E3B\u5F20\uFF1A${textOf(target.claim) || "\u672A\u586B\u5199"}
\u76EE\u6807\u671F\u520A\uFF1A${textOf(input.journal) || textOf(paperState?.venue) || "\u5F85\u9009\u62E9"}
\u56FE\u4EF6\u8981\u6C42\uFF1A${textOf(input.requirements) || "\u8BF7\u5148\u63D0\u51FA\u56FE\u4EF6\u65B9\u6848\u4F9B\u786E\u8BA4\u3002"}`, textOf(input.notes));
      return request(action, text, target.id);
    }
    case "write": {
      const outline = results.map(resultLabel).join("\uFF1B") || "\u5F53\u524D\u5C1A\u65E0\u7814\u7A76\u7ED3\u679C";
      return request(action, skillRequest("write", `\u6839\u636E\u8BBA\u6587\u4E3B\u7EBF\u8D77\u8349\u6216\u4FEE\u6539\u7A3F\u4EF6\u3002\u53EA\u628A\u5DF2\u786E\u8BA4\u4E14\u6709\u8BC1\u636E\u652F\u6301\u7684\u7ED3\u679C\u5199\u6210\u7814\u7A76\u7ED3\u8BBA\uFF1B\u672A\u786E\u8BA4\u6216\u9634\u6027\u7ED3\u679C\u8981\u51C6\u786E\u6807\u6CE8\u3002

\u6838\u5FC3\u7ED3\u8BBA\uFF1A${textOf(core.claim) || "\u5C1A\u672A\u786E\u8BA4"}
\u73B0\u6709\u7ED3\u679C\uFF1A${outline}
\u76EE\u6807\u671F\u520A\uFF1A${textOf(input.journal) || textOf(paperState?.venue) || "\u5F85\u9009\u62E9"}
\u5199\u4F5C\u8BED\u8A00\uFF1A${textOf(input.language) || "\u4E2D\u6587"}`, textOf(input.notes)));
    }
    case "slides": {
      if (results.length === 0) return block("no-results", "\u76EE\u524D\u6CA1\u6709\u53EF\u7528\u4E8E\u6C47\u62A5\u7684\u7814\u7A76\u7ED3\u679C\u3002", "\u5148\u751F\u6210\u6216\u5BFC\u5165\u7814\u7A76\u7ED3\u679C\uFF0C\u518D\u5236\u4F5C\u6C47\u62A5\u6750\u6599\u3002");
      const confirmed = results.filter((result) => result.confirmed === true).map(resultLabel);
      const unconfirmed = results.filter((result) => result.confirmed !== true).map(resultLabel);
      const text = skillRequest("slides", `\u57FA\u4E8E\u5DF2\u6709\u79D1\u7814\u8BC1\u636E\u5236\u4F5C\u6C47\u62A5 PPT\u3002\u53EA\u4F7F\u7528\u4E0B\u5217\u5DF2\u6709\u7ED3\u679C\uFF0C\u4E0D\u521B\u9020\u65B0\u5B9E\u9A8C\u7ED3\u679C\u3001\u6570\u5B57\u6216\u56FE\u8868\u3002\u672A\u786E\u8BA4\u7ED3\u679C\u5E94\u660E\u786E\u6807\u4E3A\u5F85\u9A8C\u8BC1\uFF0C\u4E0D\u4F5C\u4E3A\u5DF2\u8BC1\u5B9E\u7ED3\u8BBA\u3002

\u5DF2\u786E\u8BA4\u7ED3\u679C\uFF1A${confirmed.join("\uFF1B") || "\u65E0"}
\u5F85\u786E\u8BA4\u7ED3\u679C\uFF1A${unconfirmed.join("\uFF1B") || "\u65E0"}
\u9875\u6570\uFF1A${textOf(input.pages) || "\u6309\u6C47\u62A5\u65F6\u957F\u5EFA\u8BAE"}
\u98CE\u683C\uFF1A${textOf(input.style) || "\u6E05\u6670\u3001\u514B\u5236\u3001\u4FBF\u4E8E\u53E3\u5934\u8BB2\u89E3"}`, textOf(input.notes));
      return request(action, text);
    }
    default:
      return block("unknown-action", "\u65E0\u6CD5\u8BC6\u522B\u8FD9\u4E2A\u5DE5\u4F5C\u6D41\u52A8\u4F5C\u3002", "\u5237\u65B0\u5DE5\u4F5C\u53F0\u540E\u91CD\u8BD5\u3002");
  }
}
function errorMessageOf(value) {
  if (typeof value === "string") return value;
  if (value && typeof value.message === "string") return value.message;
  if (value && typeof value.code === "string") return value.code;
  return "";
}
function submissionError(message, detail = "") {
  const normalized = String(message || "").toLowerCase();
  if (normalized.includes("model") || normalized.includes("\u6A21\u578B")) {
    return { ok: false, step: "\u63D0\u4EA4\u5230\u5F53\u524D\u4F1A\u8BDD", accepted: false, message: "\u5F53\u524D\u4F1A\u8BDD\u5C1A\u672A\u914D\u7F6E\u53EF\u7528\u6A21\u578B\u3002", recovery: "\u5148\u5728\u6A21\u578B\u8BBE\u7F6E\u4E2D\u9009\u62E9\u53EF\u7528\u6A21\u578B\uFF0C\u518D\u91CD\u65B0\u63D0\u4EA4\u3002", detail };
  }
  return { ok: false, step: "\u63D0\u4EA4\u5230\u5F53\u524D\u4F1A\u8BDD", accepted: false, message: "DSH \u6CA1\u6709\u63A5\u6536\u8FD9\u9879\u8BF7\u6C42\u3002", recovery: "\u68C0\u67E5\u4F1A\u8BDD\u8FDE\u63A5\u540E\u5B89\u5168\u91CD\u8BD5\uFF1B\u8FD9\u6B21\u8BF7\u6C42\u5C1A\u672A\u8FDB\u5165\u7814\u7A76\u6D41\u7A0B\u3002", detail };
}
async function submitWorkflowRequest({ session, request: workflowRequest, signal } = {}) {
  if (!session) {
    return { ok: false, step: "\u9009\u62E9\u5F53\u524D\u4F1A\u8BDD", accepted: false, message: "\u5F53\u524D\u6CA1\u6709\u53EF\u63A5\u6536\u4EFB\u52A1\u7684\u4F1A\u8BDD\u3002", recovery: "\u8BF7\u5148\u5728 DSH \u4E2D\u65B0\u5EFA\u6216\u6253\u5F00\u4E00\u4E2A\u9879\u76EE\u4F1A\u8BDD\uFF0C\u518D\u91CD\u65B0\u63D0\u4EA4\u3002" };
  }
  const text = textOf(workflowRequest?.text);
  const mode = workflowRequest?.mode === "steer" ? "steer" : "queue";
  if (!text) return { ok: false, step: "\u51C6\u5907\u8BF7\u6C42", accepted: false, message: "\u8BF7\u6C42\u5185\u5BB9\u4E3A\u7A7A\uFF0C\u5C1A\u672A\u63D0\u4EA4\u3002", recovery: "\u5173\u95ED\u8868\u5355\u540E\u91CD\u65B0\u586B\u5199\uFF0C\u518D\u8BD5\u4E00\u6B21\u3002" };
  if (typeof session.beginSubmission !== "function" || typeof session.prompt !== "function") {
    return { ok: false, step: "\u8FDE\u63A5\u5F53\u524D\u4F1A\u8BDD", accepted: false, message: "\u5F53\u524D DSH \u4F1A\u8BDD\u4E0D\u652F\u6301\u5DE5\u4F5C\u53F0\u63D0\u4EA4\u3002", recovery: "\u8FD4\u56DE\u5BF9\u8BDD\u9875\u786E\u8BA4\u4F1A\u8BDD\u5DF2\u6253\u5F00\uFF0C\u7136\u540E\u5237\u65B0\u5DE5\u4F5C\u53F0\u3002" };
  }
  let content;
  try {
    content = [{ type: "text", text }];
  } catch (error) {
    return submissionError("request serialization failed", errorMessageOf(error));
  }
  let submission;
  try {
    submission = session.beginSubmission({ text, mode, attachments: [] });
  } catch (error) {
    return submissionError(errorMessageOf(error), errorMessageOf(error));
  }
  if (!submission || !submission.requestId || typeof submission.abandon !== "function") {
    return submissionError("invalid submission handle", "DSH \u672A\u8FD4\u56DE\u6709\u6548\u7684\u672C\u5730\u63D0\u4EA4\u6807\u8BC6\u3002");
  }
  try {
    const result = await session.prompt(content, mode, signal, submission.requestId);
    if (result?.ok === false) {
      return submissionError(errorMessageOf(result.error) || errorMessageOf(result), errorMessageOf(result.error));
    }
    if (result?.failed || result?.error) {
      return submissionError(errorMessageOf(result.error) || errorMessageOf(result), errorMessageOf(result.error));
    }
    if (result?.ok === true && result.value?.accepted !== true) {
      return submissionError("host did not accept prompt", "DSH \u672A\u8FD4\u56DE accepted=true\u3002");
    }
    if (result?.accepted === false || result == null) {
      return submissionError("host did not accept prompt", "DSH \u672A\u786E\u8BA4\u63A5\u6536\u8FD9\u9879\u8BF7\u6C42\u3002");
    }
    return { ok: true, step: "\u63D0\u4EA4\u5230\u5F53\u524D\u4F1A\u8BDD", accepted: true, message: "\u8BF7\u6C42\u5DF2\u63D0\u4EA4\u5230\u5F53\u524D\u5BF9\u8BDD\u3002" };
  } catch (error) {
    try {
      submission.abandon();
    } catch {
    }
    return submissionError(errorMessageOf(error), errorMessageOf(error));
  }
}

// client-src/workbench/styles.js
var import_react = __toESM(require("react"), 1);
var WORKBENCH_CSS = `
.sci-workbench{--sci-fg:var(--dsw-alias-label-primary,inherit);--sci-muted:var(--dsw-alias-label-secondary,#737b88);--sci-faint:var(--dsw-alias-label-tertiary,#9299a4);--sci-accent:var(--dsw-alias-state-business-primary,#3568c8);--sci-good:var(--dsw-alias-state-success-primary,#16836b);--sci-warn:var(--dsw-alias-state-warn-primary,#b77912);--sci-bad:var(--dsw-alias-state-error-primary,#c34236);--sci-bg:var(--dsw-alias-bg-layer-0,transparent);--sci-card:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.06));--sci-raised:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.11));--sci-border:var(--dsw-alias-border-l1,rgba(127,127,127,.2));--sci-line:var(--dsw-alias-separator-primary,rgba(127,127,127,.14));box-sizing:border-box;color:var(--sci-fg);font-family:inherit;font-size:14px;line-height:1.55;min-height:100%;background:var(--sci-bg)}
.sci-workbench *{box-sizing:border-box}.sci-wb-shell{min-height:100%;padding:24px clamp(16px,3vw,40px) 40px}.sci-wb-content{max-width:1400px;margin:0 auto}.sci-wb-header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:0 auto 22px;max-width:1400px}.sci-wb-brand{display:flex;align-items:center;gap:12px;min-width:0}.sci-wb-mark{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:color-mix(in srgb,var(--sci-accent) 12%,transparent);color:var(--sci-accent)}.sci-wb-brand h1{font-size:21px;line-height:1.2;margin:0;font-weight:650;letter-spacing:-.02em}.sci-wb-subtitle{font-size:13px;color:var(--sci-muted);margin-top:4px}.sci-wb-head-actions{display:flex;align-items:center;gap:10px}.sci-wb-nav{display:flex;gap:4px;padding:4px;border:1px solid var(--sci-border);border-radius:12px;background:var(--sci-card);margin-bottom:18px;overflow:auto}.sci-wb-nav button{border:0;background:transparent;color:var(--sci-muted);font:inherit;font-weight:550;padding:9px 15px;border-radius:9px;white-space:nowrap;cursor:pointer}.sci-wb-nav button[aria-current=true]{background:var(--sci-raised);color:var(--sci-fg);box-shadow:0 1px 2px rgba(0,0,0,.06)}
.sci-wb-content,.sci-stack,.sci-grid,.sci-grid>*{min-width:0}.sci-stack{grid-template-columns:minmax(0,1fr)}
.sci-panel{border:1px solid var(--sci-border);border-radius:14px;background:var(--sci-card);padding:20px}.sci-panel + .sci-panel{margin-top:16px}.sci-panel-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}.sci-panel-heading h2,.sci-panel-heading h3{margin:0;font-size:17px;line-height:1.3}.sci-panel-heading p{margin:4px 0 0;color:var(--sci-muted);font-size:13px}.sci-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px}.sci-col-8{grid-column:span 8}.sci-col-4{grid-column:span 4}.sci-col-6{grid-column:span 6}.sci-col-12{grid-column:span 12}.sci-stack{display:grid;gap:16px}.sci-muted{color:var(--sci-muted)}.sci-small{font-size:12px;color:var(--sci-muted)}.sci-kicker{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--sci-muted);font-weight:650}.sci-title{font-size:24px;line-height:1.25;letter-spacing:-.02em;margin:0 0 6px}.sci-copy{font-size:14px;color:var(--sci-muted);margin:0}.sci-rule{border:0;border-top:1px solid var(--sci-line);margin:16px 0}.sci-button{display:inline-flex;justify-content:center;align-items:center;gap:8px;min-height:38px;padding:8px 13px;border:1px solid var(--sci-border);border-radius:9px;background:transparent;color:var(--sci-fg);font:inherit;font-weight:560;cursor:pointer;transition:background .16s,border-color .16s,transform .16s}.sci-button:hover:not(:disabled){background:var(--sci-raised);border-color:color-mix(in srgb,var(--sci-accent) 35%,var(--sci-border))}.sci-button:focus-visible,.sci-wb-nav button:focus-visible,.sci-field input:focus-visible,.sci-field textarea:focus-visible,.sci-field select:focus-visible{outline:2px solid var(--sci-accent);outline-offset:2px}.sci-button:active:not(:disabled){transform:translateY(1px)}.sci-button:disabled{opacity:.55;cursor:not-allowed}.sci-button-primary{background:var(--sci-accent);border-color:var(--sci-accent);color:white}.sci-button-primary:hover:not(:disabled){background:color-mix(in srgb,var(--sci-accent) 87%,#111);border-color:var(--sci-accent);color:white}.sci-button-quiet{border-color:transparent}.sci-button-small{min-height:32px;padding:5px 9px;font-size:13px}.sci-badge{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--sci-border);border-radius:999px;padding:3px 9px;font-size:12px;white-space:nowrap;color:var(--sci-muted);background:var(--sci-card)}.sci-badge-good{color:var(--sci-good);border-color:color-mix(in srgb,var(--sci-good) 30%,var(--sci-border));background:color-mix(in srgb,var(--sci-good) 8%,transparent)}.sci-badge-warn{color:var(--sci-warn);border-color:color-mix(in srgb,var(--sci-warn) 30%,var(--sci-border));background:color-mix(in srgb,var(--sci-warn) 8%,transparent)}.sci-badge-bad{color:var(--sci-bad);border-color:color-mix(in srgb,var(--sci-bad) 30%,var(--sci-border));background:color-mix(in srgb,var(--sci-bad) 8%,transparent)}.sci-stat-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.sci-stat{padding:14px;border:1px solid var(--sci-border);border-radius:12px;background:var(--sci-card)}.sci-stat strong{display:block;font-size:22px;line-height:1.2;font-weight:650}.sci-stat span{display:block;color:var(--sci-muted);font-size:12px;margin-top:5px}.sci-stage-track{display:grid;grid-template-columns:repeat(6,minmax(135px,1fr));gap:0;overflow:auto;padding:2px 0 6px}.sci-stage{position:relative;min-width:135px;padding:4px 14px 8px 0}.sci-stage:not(:last-child):after{content:"";position:absolute;height:2px;left:26px;right:6px;top:14px;background:var(--sci-border)}.sci-stage[data-state=completed]:after{background:color-mix(in srgb,var(--sci-good) 65%,var(--sci-border))}.sci-stage-dot{position:relative;z-index:1;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--sci-border);background:var(--sci-card);color:var(--sci-muted);font-size:12px}.sci-stage[data-state=current] .sci-stage-dot{background:var(--sci-accent);border-color:var(--sci-accent);color:#fff;box-shadow:0 0 0 4px color-mix(in srgb,var(--sci-accent) 13%,transparent)}.sci-stage[data-state=completed] .sci-stage-dot{color:var(--sci-good);border-color:var(--sci-good)}.sci-stage-label{font-size:12px;margin-top:8px;color:var(--sci-muted)}.sci-stage[data-state=current] .sci-stage-label{font-weight:650;color:var(--sci-fg)}
.sci-hero{padding:24px;border:1px solid color-mix(in srgb,var(--sci-accent) 24%,var(--sci-border));border-radius:16px;background:color-mix(in srgb,var(--sci-accent) 5%,var(--sci-card))}.sci-empty{min-height:180px;display:grid;place-items:center;text-align:center;padding:28px}.sci-empty h2,.sci-empty h3{margin:0 0 8px}.sci-empty p{max-width:620px;margin:0 auto 16px;color:var(--sci-muted)}.sci-step-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:20px}.sci-step{border:1px solid var(--sci-border);border-radius:11px;padding:12px;background:var(--sci-card);text-align:left}.sci-step b{display:block;font-size:13px}.sci-step span{font-size:12px;color:var(--sci-muted)}.sci-field{display:grid;gap:6px;margin:12px 0}.sci-field label{font-size:13px;font-weight:600}.sci-field input,.sci-field textarea,.sci-field select{width:100%;padding:10px 11px;border:1px solid var(--sci-border);border-radius:9px;background:var(--sci-bg);color:var(--sci-fg);font:inherit;resize:vertical}.sci-field textarea{min-height:88px}.sci-form-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}.sci-modal-backdrop{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:20px;background:rgba(12,17,27,.46)}.sci-modal{width:min(620px,100%);max-height:min(90vh,900px);overflow:auto;padding:22px;border-radius:16px;border:1px solid var(--sci-border);background:var(--dsw-alias-bg-layer-0,#fff);box-shadow:0 20px 70px rgba(0,0,0,.24)}.sci-modal h2{margin:0;font-size:20px}.sci-error-box{padding:12px;border:1px solid color-mix(in srgb,var(--sci-bad) 35%,var(--sci-border));border-radius:10px;background:color-mix(in srgb,var(--sci-bad) 6%,transparent);color:var(--sci-fg);margin-top:12px}.sci-success-box{padding:12px;border:1px solid color-mix(in srgb,var(--sci-good) 35%,var(--sci-border));border-radius:10px;background:color-mix(in srgb,var(--sci-good) 6%,transparent);margin:12px 0}.sci-result-card{border:1px solid var(--sci-border);border-radius:13px;background:var(--sci-card);padding:17px}.sci-result-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.sci-result-card h3{font-size:16px;margin:0 0 5px}.sci-result-claim{color:var(--sci-muted);margin:8px 0 14px}.sci-readiness{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.sci-readiness-item{border:1px solid var(--sci-border);border-radius:9px;padding:8px;font-size:12px}.sci-readiness-item b{display:block;font-weight:600}.sci-result-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.sci-note-list{padding-left:20px;margin:8px 0;color:var(--sci-muted)}.sci-note-list li{margin:4px 0}.sci-members{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}.sci-member{border:1px solid var(--sci-border);border-radius:11px;padding:13px}.sci-member h3{font-size:14px;margin:0}.sci-member p{font-size:12px;color:var(--sci-muted);margin:5px 0 0}.sci-task-graph{position:relative;overflow:auto;min-height:150px}.sci-task-canvas{position:relative;min-height:180px}.sci-task-node{position:absolute;width:188px;min-height:72px;padding:10px;border:1px solid var(--sci-border);border-radius:10px;background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.08));color:var(--sci-fg);text-align:left;z-index:1}.sci-task-node:hover{border-color:var(--sci-accent)}.sci-task-node strong{display:block;font-size:13px}.sci-task-node span{display:block;font-size:11px;color:var(--sci-muted);margin-top:4px}.sci-task-lines{position:absolute;inset:0;pointer-events:none;overflow:visible}.sci-task-line{stroke:var(--sci-muted);stroke-width:1.5;fill:none;opacity:.7}.sci-task-list{display:grid;gap:8px}.sci-task-row{display:grid;grid-template-columns:minmax(200px,2fr) minmax(100px,1fr) auto;gap:12px;align-items:center;border-bottom:1px solid var(--sci-line);padding:10px 0}.sci-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}.sci-figure{border:1px solid var(--sci-border);border-radius:12px;overflow:hidden;background:var(--sci-card);cursor:pointer}.sci-figure img{width:100%;height:180px;object-fit:contain;background:var(--sci-raised);display:block}.sci-figure-copy{padding:11px}.sci-figure-copy strong{display:block;font-size:13px}.sci-figure-copy span{display:block;color:var(--sci-muted);font-size:12px;margin-top:4px}.sci-group{margin-top:24px}.sci-group h3{font-size:15px;margin:0 0 10px}.sci-file-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:9px}.sci-file{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--sci-border);border-radius:10px;padding:11px}.sci-file strong{font-size:13px;display:block;word-break:break-word}.sci-expert-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}.sci-expert-card{border:1px solid var(--sci-border);border-radius:12px;background:var(--sci-card);padding:16px}.sci-expert-card h3{font-size:15px;margin:0}.sci-expert-card p{font-size:13px;color:var(--sci-muted);margin:8px 0}.sci-risk{font-size:12px;padding:9px;border-radius:9px;background:var(--sci-raised);margin-top:10px}.sci-toast{position:fixed;right:22px;bottom:22px;z-index:9000;max-width:420px;padding:12px 16px;border:1px solid var(--sci-border);border-radius:11px;background:var(--dsw-alias-bg-layer-2,#fff);box-shadow:0 8px 30px rgba(0,0,0,.15)}.sci-quick{padding:16px}.sci-quick .sci-panel{padding:15px}.sci-quick .sci-title{font-size:18px}
.sci-tool-list{display:grid;gap:8px;margin-top:10px}.sci-tool-row{display:grid;gap:3px;border-top:1px solid var(--sci-line);padding:8px 0;font-size:12px;color:var(--sci-muted)}.sci-tool-row b{font-size:13px;color:var(--sci-fg)}
@media(max-width:900px){.sci-col-8,.sci-col-4,.sci-col-6{grid-column:span 12}.sci-wb-header{align-items:flex-start}.sci-stat-row{grid-template-columns:repeat(2,1fr)}}@media(max-width:640px){.sci-wb-shell{padding:16px 12px 28px}.sci-wb-header{flex-direction:column}.sci-wb-head-actions{width:100%;flex-wrap:wrap}.sci-wb-nav button{padding:8px 11px}.sci-panel{padding:15px}.sci-stage-track{grid-template-columns:repeat(6,120px)}.sci-step-row{grid-template-columns:1fr}.sci-readiness{grid-template-columns:repeat(2,1fr)}.sci-task-row{grid-template-columns:1fr}.sci-stat strong{font-size:19px}}
@media(prefers-reduced-motion:reduce){.sci-workbench *, .sci-workbench *:before,.sci-workbench *:after{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
`;
function WorkbenchStyles() {
  return import_react.default.createElement("style", { id: "dsh-science-workbench-styles" }, WORKBENCH_CSS);
}

// client-src/workbench/components/ui.jsx
var import_react2 = __toESM(require("react"), 1);
var import_jsx_runtime = require("react/jsx-runtime");
function Button({ children, primary = false, small = false, quiet = false, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { ...props, className: ["sci-button", primary && "sci-button-primary", small && "sci-button-small", quiet && "sci-button-quiet", props.className].filter(Boolean).join(" "), children });
}
function Panel({ title, subtitle, action, children, className = "" }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: `sci-panel ${className}`, children: [
    (title || subtitle || action) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "sci-panel-heading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        title && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: title }),
        subtitle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: subtitle })
      ] }),
      action
    ] }),
    children
  ] });
}
function Badge({ children, tone = "default" }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `sci-badge ${tone === "good" ? "sci-badge-good" : tone === "warn" ? "sci-badge-warn" : tone === "bad" ? "sci-badge-bad" : ""}`, children });
}
function EmptyState({ title, children, action, secondary }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "sci-empty", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: title }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "sci-result-actions", style: { justifyContent: "center" }, children: [
      action,
      secondary
    ] })
  ] }) });
}
function Field({ label, name, value, onChange, required = false, placeholder = "", rows = 0, type = "text" }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "sci-field", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { htmlFor: `sci-field-${name}`, children: [
      label,
      required ? " *" : ""
    ] }),
    rows ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { id: `sci-field-${name}`, value: value || "", onChange: (event) => onChange(name, event.target.value), placeholder, rows, required }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { id: `sci-field-${name}`, type, value: value || "", onChange: (event) => onChange(name, event.target.value), placeholder, required })
  ] });
}
var ACTION_META = {
  explore: { title: "\u5F00\u59CB\u63A2\u7D22", fields: [["question", "\u7814\u7A76\u95EE\u9898", true, "\u4F8B\u5982\uFF1A\u67D0\u86CB\u767D\u53D8\u4F53\u5982\u4F55\u5F71\u54CD\u7EC6\u80DE\u5E94\u6FC0\u53CD\u5E94\uFF1F", 3], ["scope", "\u7814\u7A76\u8303\u56F4", false, "\u7269\u79CD\u3001\u6A21\u578B\u6216\u65F6\u95F4\u8303\u56F4", 2], ["existingData", "\u5DF2\u6709\u6570\u636E", false, "\u5DF2\u6709\u6837\u672C\u3001\u6570\u636E\u7C7B\u578B\u6216\u89C2\u5BDF", 2], ["constraints", "\u7B97\u529B\u4E0E\u65F6\u95F4\u7EA6\u675F", false, "\u4F8B\u5982\uFF1A\u5355\u5361 24 GB\uFF0C\u4E09\u5468\u5185\u5B8C\u6210", 2], ["notes", "\u8865\u5145\u8981\u6C42", false, "", 2]] },
  import_results: { title: "\u5BFC\u5165\u5DF2\u6709\u7ED3\u679C", fields: [["source", "\u7ED3\u679C\u6765\u6E90\u6216\u6458\u8981", true, "\u7C98\u8D34\u7ED3\u679C\u6458\u8981\uFF0C\u6216\u8BF4\u660E\u5DE5\u4F5C\u533A\u6587\u4EF6\u8DEF\u5F84", 4], ["notes", "\u8865\u5145\u8BF4\u660E", false, "\u5E0C\u671B\u4FDD\u7559\u7684\u80CC\u666F\u6216\u8FB9\u754C", 2]] },
  literature: { title: "\u6269\u5C55\u6587\u732E\u63A2\u7D22", fields: [["question", "\u7814\u7A76\u95EE\u9898", false, "\u53EF\u4F7F\u7528\u5F53\u524D\u8BBA\u6587\u4E3B\u7EBF", 3], ["notes", "\u8865\u5145\u8981\u6C42", false, "\u65F6\u95F4\u8303\u56F4\u3001\u6570\u636E\u5E93\u6216\u6587\u732E\u7C7B\u578B", 2]] },
  generate_structure: { title: "\u751F\u6210\u6587\u7AE0\u7ED3\u6784", fields: [["notes", "\u8865\u5145\u8981\u6C42", false, "\u4F8B\u5982\uFF1A\u4F18\u5148\u7EC4\u7EC7\u73B0\u6709\u7684\u9634\u6027\u7ED3\u679C", 3]] },
  optimize_structure: { title: "\u4F18\u5316\u6587\u7AE0\u7ED3\u6784", fields: [["guidance", "\u8C03\u6574\u4F9D\u636E", true, "\u5199\u660E\u65B0\u8BC1\u636E\u3001\u903B\u8F91\u95EE\u9898\u6216\u5E0C\u671B\u8C03\u6574\u7684\u90E8\u5206", 4], ["notes", "\u8865\u5145\u8981\u6C42", false, "", 2]] },
  confirm: { title: "\u8BF7\u6C42\u786E\u8BA4\u7814\u7A76\u7ED3\u8BBA", fields: [["notes", "\u9700\u8981\u8BF4\u660E\u7684\u4F9D\u636E", false, "\u8865\u5145\u786E\u8BA4\u65F6\u9700\u8981\u5C55\u793A\u7684\u80CC\u666F", 3]] },
  refine_tasks: { title: "\u7EC6\u5316\u6267\u884C\u4EFB\u52A1", fields: [["notes", "\u6267\u884C\u7EA6\u675F", false, "\u8D44\u6E90\u3001\u671F\u9650\u3001\u65B9\u6CD5\u6216\u5B8C\u6210\u5224\u636E", 3]] },
  draw: { title: "\u5F00\u59CB\u7ED8\u56FE", fields: [["journal", "\u76EE\u6807\u671F\u520A", false, "\u671F\u520A\u540D\u79F0\u6216\u6682\u672A\u786E\u5B9A", 0], ["requirements", "\u56FE\u4EF6\u8981\u6C42", false, "\u56FE\u8981\u56DE\u7B54\u7684\u95EE\u9898\u3001\u73B0\u6709\u6570\u636E\u3001\u7EDF\u8BA1\u65B9\u6CD5\u548C\u683C\u5F0F", 4], ["notes", "\u8865\u5145\u8981\u6C42", false, "", 2]] },
  write: { title: "\u64B0\u5199\u8BBA\u6587", fields: [["journal", "\u76EE\u6807\u671F\u520A", false, "\u671F\u520A\u540D\u79F0\u6216\u6682\u672A\u786E\u5B9A", 0], ["language", "\u5199\u4F5C\u8BED\u8A00", false, "\u4E2D\u6587\u6216 English", 0], ["notes", "\u8865\u5145\u8981\u6C42", false, "\u9700\u8981\u4F18\u5148\u8D77\u8349\u7684\u90E8\u5206\u6216\u683C\u5F0F\u8981\u6C42", 4]] },
  slides: { title: "\u5236\u4F5C\u6C47\u62A5 PPT", fields: [["pages", "\u9875\u6570\u6216\u6C47\u62A5\u65F6\u957F", false, "\u4F8B\u5982\uFF1A12 \u9875 / 15 \u5206\u949F", 0], ["style", "\u8868\u8FBE\u98CE\u683C", false, "\u6E05\u6670\u3001\u514B\u5236\u3001\u4FBF\u4E8E\u53E3\u5934\u8BB2\u89E3", 2], ["notes", "\u8865\u5145\u8981\u6C42", false, "", 2]] }
};
function ActionDialog({ action, target, onClose, onSubmit, busy = false, error = null, onOpenConversation, onCopyDiagnostic }) {
  const meta = ACTION_META[action] || ACTION_META.explore;
  const [values, setValues] = (0, import_react2.useState)({});
  const modalRef = (0, import_react2.useRef)(null);
  (0, import_react2.useEffect)(() => {
    modalRef.current?.querySelector("textarea,input")?.focus();
  }, []);
  const change = (name, value) => setValues((current) => ({ ...current, [name]: value }));
  const onKeyDown = (event) => {
    if (event.key === "Escape" && !busy) onClose();
    if (event.key === "Tab" && modalRef.current) {
      const items = [...modalRef.current.querySelectorAll("button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)")];
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "sci-modal-backdrop", onMouseDown: (event) => {
    if (event.target === event.currentTarget && !busy) onClose();
  }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "sci-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "sci-dialog-title", ref: modalRef, onKeyDown, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "sci-panel-heading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { id: "sci-dialog-title", children: meta.title }),
        target && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
          "\u5173\u8054\u7814\u7A76\u7ED3\u679C\uFF1A",
          target.title
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { quiet: true, small: true, "aria-label": "\u5173\u95ED", onClick: onClose, disabled: busy, children: "\u5173\u95ED" })
    ] }),
    meta.fields.map(([name, label, required, placeholder, rows]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { name, label, required, placeholder, rows, value: values[name], onChange: change }, name)),
    error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "sci-error-box", role: "alert", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: error.message || "\u8BF7\u6C42\u672A\u63D0\u4EA4" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: error.recovery }),
      error.detail && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: "\u9519\u8BEF\u8BE6\u60C5" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: error.detail })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "sci-result-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { small: true, onClick: () => onSubmit(values), disabled: busy, children: "\u91CD\u65B0\u63D0\u4EA4" }),
        onOpenConversation && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { small: true, onClick: onOpenConversation, children: "\u6253\u5F00\u5BF9\u8BDD" }),
        onCopyDiagnostic && error.detail && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { small: true, onClick: () => onCopyDiagnostic(error), children: "\u590D\u5236\u8BCA\u65AD\u4FE1\u606F" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "sci-form-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { onClick: onClose, disabled: busy, children: "\u53D6\u6D88" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { primary: true, onClick: () => onSubmit(values), disabled: busy, children: busy ? "\u6B63\u5728\u63D0\u4EA4\u2026" : "\u63D0\u4EA4\u5230\u5F53\u524D\u5BF9\u8BDD" })
    ] })
  ] }) });
}
function StageTrack({ stages = [] }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "sci-stage-track", "aria-label": "\u8BBA\u6587\u9636\u6BB5", children: stages.map((stage, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "sci-stage", "data-state": stage.state, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "sci-stage-dot", children: stage.state === "completed" ? "\u2713" : index + 1 }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "sci-stage-label", children: stage.label })
  ] }, stage.id)) });
}
function StatusMessage({ tone = "default", children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: tone === "error" ? "sci-error-box" : tone === "success" ? "sci-success-box" : "sci-panel", role: tone === "error" ? "alert" : void 0, children });
}

// client-src/workbench/PaperSpinePage.jsx
var import_react3 = __toESM(require("react"), 1);
var import_jsx_runtime2 = require("react/jsx-runtime");
var READINESS_LABELS = [["scientific", "\u79D1\u5B66\u8BC1\u636E"], ["manuscript", "\u7A3F\u4EF6\u5C31\u7EEA"], ["submission", "\u6295\u7A3F\u5C31\u7EEA"]];
function readinessText(value) {
  if (!value) return "\u5F85\u6838\u5BF9";
  if (value.state === "ready" || value.state === "completed") return "\u5DF2\u5177\u5907";
  if (value.state === "in_progress") return "\u8FDB\u884C\u4E2D";
  return "\u5F85\u5B8C\u5584";
}
function ResultCard({ result, onAction }) {
  const [expanded, setExpanded] = (0, import_react3.useState)(false);
  const gate = resultConfirmationGate(result.coreConfirmed, result.confirmed);
  const gatesOpen = gate === null;
  const unconfirmedReason = gate === "core" ? "\u6838\u5FC3\u7814\u7A76\u7ED3\u8BBA\u5C1A\u672A\u786E\u8BA4\uFF1B\u5148\u786E\u8BA4\u6838\u5FC3\u7ED3\u8BBA\u540E\uFF0C\u624D\u80FD\u7EC6\u5316\u6B63\u5F0F\u4EFB\u52A1\u6216\u542F\u52A8\u6B63\u5F0F\u7ED8\u56FE\u3002" : `\u201C${result.title}\u201D\u5C1A\u672A\u786E\u8BA4\uFF1B\u5148\u786E\u8BA4\u8BE5\u7814\u7A76\u7ED3\u679C\u540E\uFF0C\u624D\u80FD\u7EC6\u5316\u6B63\u5F0F\u4EFB\u52A1\u6216\u542F\u52A8\u6B63\u5F0F\u7ED8\u56FE\u3002`;
  const run = (action) => onAction(action, result.id);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("article", { className: "sci-result-card", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "sci-result-top", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { children: result.title }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "sci-small", children: [
          result.statusLabel,
          " \xB7 ",
          result.confirmed ? "\u5F53\u524D\u4FEE\u8BA2\u5DF2\u786E\u8BA4" : "\u5F85\u786E\u8BA4"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Badge, { tone: result.confirmed ? "good" : "warn", children: result.confirmed ? "\u5DF2\u786E\u8BA4" : "\u5F85\u786E\u8BA4" })
    ] }),
    result.claim && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "sci-result-claim", children: result.claim }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "sci-readiness", style: { gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }, children: READINESS_LABELS.map(([key, label]) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "sci-readiness-item", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("b", { children: label }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: readinessText(result.readiness?.[key]) })
    ] }, key)) }),
    result.requiredItems.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("b", { className: "sci-small", children: "\u5FC5\u987B\u5904\u7406" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { className: "sci-note-list", children: result.requiredItems.map((item) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("li", { children: item }, item)) })
    ] }),
    result.recommendedItems.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("b", { className: "sci-small", children: "\u5EFA\u8BAE\u5904\u7406" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { className: "sci-note-list", children: result.recommendedItems.map((item) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("li", { children: item }, item)) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "sci-result-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { small: true, onClick: () => setExpanded((value) => !value), "aria-expanded": expanded, children: expanded ? "\u6536\u8D77\u8BE6\u60C5" : "\u67E5\u770B\u8BE6\u60C5" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { small: true, onClick: () => run("optimize_structure"), children: "\u4F18\u5316\u7ED3\u6784" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { small: true, disabled: !gatesOpen, title: !gatesOpen ? unconfirmedReason : void 0, onClick: () => run("refine_tasks"), children: "\u7EC6\u5316\u4EFB\u52A1" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { small: true, disabled: !gatesOpen, title: !gatesOpen ? unconfirmedReason : void 0, onClick: () => run("draw"), children: "\u5F00\u59CB\u7ED8\u56FE" }),
      !result.confirmed && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { small: true, primary: true, onClick: () => run("confirm"), children: "\u786E\u8BA4\u5E76\u7EE7\u7EED" })
    ] }),
    !gatesOpen && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "sci-small", role: "note", style: { marginTop: 8 }, children: unconfirmedReason }),
    expanded && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "sci-small", style: { marginTop: 14 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("b", { children: "Result \u7F16\u53F7\uFF1A" }),
        result.id,
        "\u3000",
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("b", { children: "\u4FEE\u8BA2\uFF1A" }),
        result.revision || 1
      ] }),
      result.purpose && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("b", { children: "\u76EE\u7684\uFF1A" }),
        result.purpose
      ] }),
      result.direction && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("b", { children: "\u7ED3\u679C\u65B9\u5411\uFF1A" }),
        result.direction
      ] }),
      result.notes && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("b", { children: "\u5907\u6CE8\uFF1A" }),
        result.notes
      ] }),
      result.evidence?.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("b", { children: "\u8BC1\u636E\u8BB0\u5F55\uFF1A" }),
        result.evidence.map((row, index) => row?.title || row?.source || row?.sourceLocator || `\u8BC1\u636E ${index + 1}`).join("\uFF1B")
      ] }),
      result.references?.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("b", { children: "\u53C2\u8003\u6587\u732E\uFF1A" }),
        result.references.map((row) => row?.title || row?.doi || row?.id || "\u672A\u547D\u540D\u6587\u732E").join("\uFF1B")
      ] })
    ] })
  ] });
}
function PaperSpinePage({ view, raw, onAction, onOpenConversation, onNavigate }) {
  const paper = view.paper;
  const hasSpine = Boolean(paper.core.claim || paper.results.length || paper.core.title);
  const nextStep = paper.nextStep;
  const nextAction = () => nextStep.action ? onAction(nextStep.action, nextStep.targetId || null) : nextStep.page && onNavigate(nextStep.page);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "sci-stack", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Panel, { className: "sci-panel", title: "\u7814\u7A76\u9636\u6BB5", subtitle: `\u5F53\u524D\u9636\u6BB5\uFF1A${paper.stageLabel}${paper.venue ? ` \xB7 \u76EE\u6807\u671F\u520A\uFF1A${paper.venue}` : ""}`, action: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { small: true, onClick: onOpenConversation, children: "\u6253\u5F00\u5BF9\u8BDD" }), children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(StageTrack, { stages: paper.stages }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "sci-small", children: [
        paper.totalResults ? `${paper.totalResults} \u9879\u7814\u7A76\u7ED3\u679C \xB7 ${paper.supportedResults} \u9879\u6807\u8BB0\u4E3A\u201C\u5DF2\u83B7\u5F97\u652F\u6301\u201D` : "\u5C1A\u672A\u767B\u8BB0\u7814\u7A76\u7ED3\u679C",
        paper.updatedAt ? ` \xB7 \u6700\u8FD1\u66F4\u65B0 ${new Date(paper.updatedAt).toLocaleString()}` : ""
      ] })
    ] }),
    !hasSpine ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Panel, { className: "sci-hero", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(EmptyState, { title: "\u5F00\u59CB\u4E00\u9879\u7814\u7A76", children: "\u4ECE\u4E00\u4E2A\u7814\u7A76\u95EE\u9898\u5F00\u59CB\uFF0C\u4E5F\u53EF\u4EE5\u5148\u6574\u7406\u5DF2\u7ECF\u5B8C\u6210\u7684\u7ED3\u679C\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "sci-button sci-button-primary", onClick: () => onAction("explore"), children: "\u5F00\u59CB\u63A2\u7D22" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { onClick: () => onAction("import_results"), children: "\u5BFC\u5165\u5DF2\u6709\u7ED3\u679C" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "sci-step-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "sci-step", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("b", { children: "1. \u63A2\u7D22\u95EE\u9898" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u6F84\u6E05\u95EE\u9898\u3001\u5DF2\u6709\u8BC1\u636E\u4E0E\u53EF\u884C\u8303\u56F4" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "sci-step", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("b", { children: "2. \u7EC4\u7EC7\u7ED3\u679C" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u5F62\u6210\u53EF\u6838\u9A8C\u7684\u6587\u7AE0\u7ED3\u6784" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "sci-step", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("b", { children: "3. \u6267\u884C\u4E0E\u5199\u4F5C" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u786E\u8BA4\u540E\u7EC6\u5316\u4EFB\u52A1\u3001\u5206\u6790\u548C\u5448\u73B0" })
        ] })
      ] })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "sci-grid", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "sci-col-8 sci-stack", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Panel, { title: "\u6838\u5FC3\u7814\u7A76\u7ED3\u8BBA", subtitle: paper.core.confirmed ? "\u5F53\u524D\u4FEE\u8BA2\u5DF2\u786E\u8BA4" : "\u5019\u9009\u7ED3\u8BBA\u4ECD\u5F85\u786E\u8BA4", action: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Badge, { tone: paper.core.confirmed ? "good" : "warn", children: paper.core.confirmed ? "\u5DF2\u786E\u8BA4" : "\u5F85\u786E\u8BA4" }), children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { className: "sci-title", children: paper.core.title || "\u5C1A\u672A\u547D\u540D" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "sci-copy", children: paper.core.claim || "\u5F53\u524D\u8FD8\u6CA1\u6709\u6838\u5FC3\u7ED3\u8BBA\u5019\u9009\u3002\u4F60\u53EF\u4EE5\u5148\u751F\u6210\u6587\u7AE0\u7ED3\u6784\u3002" }),
          paper.core.innovation && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "sci-small", style: { marginTop: 10 }, children: [
            "\u521B\u65B0\u70B9\uFF1A",
            paper.core.innovation
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "sci-result-actions", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { primary: true, onClick: () => onAction(paper.results.length ? "optimize_structure" : "generate_structure", "core"), children: paper.results.length ? "\u4F18\u5316\u7ED3\u6784" : "\u751F\u6210\u6587\u7AE0\u7ED3\u6784" }),
            !paper.core.confirmed && paper.core.claim && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { onClick: () => onAction("confirm", "core"), children: "\u786E\u8BA4\u5E76\u7EE7\u7EED" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Panel, { title: `\u6587\u7AE0\u7ED3\u6784 \xB7 ${paper.totalResults} \u9879\u7814\u7A76\u7ED3\u679C`, subtitle: "\u6BCF\u9879\u7ED3\u679C\u90FD\u4FDD\u7559\u771F\u5B9E\u72B6\u6001\u3001\u8BC1\u636E\u7F3A\u53E3\u548C\u786E\u8BA4\u95F8\u95E8\u3002", children: paper.results.length ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "sci-stack", children: paper.results.map((result) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ResultCard, { result: { ...result, coreConfirmed: paper.core.confirmed }, onAction }, result.id)) }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "sci-small", children: "\u8FD8\u6CA1\u6709\u7814\u7A76\u7ED3\u679C\u8349\u6848\u3002\u751F\u6210\u6587\u7AE0\u7ED3\u6784\u540E\uFF0C\u5019\u9009\u7ED3\u679C\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002" }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("aside", { className: "sci-col-4 sci-stack", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Panel, { title: "\u4E0B\u4E00\u6B65\u5EFA\u8BAE", subtitle: "\u6839\u636E\u5F53\u524D\u4FDD\u5B58\u72B6\u6001\u751F\u6210", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { style: { fontSize: 16, margin: "0 0 8px" }, children: nextStep.label }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { primary: true, onClick: nextAction, children: "\u7EE7\u7EED\u4E0B\u4E00\u6B65" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Panel, { title: "\u8FD1\u671F\u6D3B\u52A8", children: view.team.activity.length ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "sci-stack", children: view.team.activity.slice(0, 4).map((row) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "sci-small", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("b", { children: row.summary }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
            row.at ? new Date(row.at).toLocaleString() : "\u65F6\u95F4\u672A\u8BB0\u5F55",
            " \xB7 ",
            row.status
          ] })
        ] }, row.id)) }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "sci-small", children: "\u6682\u65E0\u4EFB\u52A1\u56DE\u62A5\u8BB0\u5F55\u3002" }) }),
        view.team.blockedTasks.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Panel, { title: "\u5F53\u524D\u963B\u585E", subtitle: `${view.team.blockedTasks.length} \u9879\u4EFB\u52A1\u6709\u672A\u5B8C\u6210\u4F9D\u8D56`, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { className: "sci-note-list", children: view.team.blockedTasks.slice(0, 5).map((task) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { children: [
            task.subject || task.id,
            "\uFF1A",
            task.blockers.join("\uFF1B")
          ] }, task.id)) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { small: true, onClick: () => onNavigate("team"), children: "\u67E5\u770B\u56E2\u961F\u8FDB\u5C55" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "sci-result-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { small: true, onClick: () => onAction("literature"), children: "\u6269\u5C55\u6587\u732E\u63A2\u7D22" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { small: true, onClick: () => onAction("write"), children: "\u64B0\u5199\u8BBA\u6587" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { small: true, onClick: () => onNavigate("artifacts"), children: "\u67E5\u770B\u56FE\u8868\u4E0E\u6210\u679C" })
    ] })
  ] });
}

// client-src/workbench/TeamProgressPage.jsx
var import_react4 = __toESM(require("react"), 1);
var import_jsx_runtime3 = require("react/jsx-runtime");
function graphLayout(tasks) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const depthCache = /* @__PURE__ */ new Map();
  const depthOf = (task, visiting = /* @__PURE__ */ new Set()) => {
    if (depthCache.has(task.id)) return depthCache.get(task.id);
    if (visiting.has(task.id)) return 0;
    const nextVisiting = new Set(visiting).add(task.id);
    const dependencies = Array.isArray(task.blockedBy) ? task.blockedBy.map((id) => byId.get(id)).filter(Boolean) : [];
    const depth = dependencies.length ? Math.min(6, 1 + Math.max(...dependencies.map((dep) => depthOf(dep, nextVisiting)))) : 0;
    depthCache.set(task.id, depth);
    return depth;
  };
  const columns = [];
  for (const task of tasks) {
    const depth = depthOf(task);
    columns[depth] ||= [];
    columns[depth].push(task);
  }
  columns.forEach((column) => column?.sort((a, b) => String(a.id).localeCompare(String(b.id), void 0, { numeric: true })));
  const position = /* @__PURE__ */ new Map();
  columns.forEach((column, col) => column?.forEach((task, row) => position.set(task.id, { x: col * 228, y: row * 96 })));
  const width = Math.max(228, columns.length * 228);
  const height = Math.max(180, ...columns.map((col) => col?.length * 96 || 0));
  return { columns, position, width, height, byId };
}
var STATE_TONE = { completed: "good", failed: "bad", blocked: "warn", in_progress: "default", claimed: "default", pending: "default" };
function TeamProgressPage({ view, openMemberSession, memberOpenAvailable }) {
  const [mode, setMode] = (0, import_react4.useState)("graph");
  const [memberError, setMemberError] = (0, import_react4.useState)(null);
  const tasks = view.team.tasks;
  const layout = (0, import_react4.useMemo)(() => graphLayout(tasks), [tasks]);
  const openMember = async (member) => {
    try {
      await openMemberSession(member);
      setMemberError(null);
    } catch (error) {
      setMemberError({ member, message: error?.message || "\u65E0\u6CD5\u6253\u5F00\u8BE5\u6210\u5458\u4F1A\u8BDD\u3002" });
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "sci-stack", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "sci-stat-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "sci-stat", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: view.team.counts.running }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: "\u8FD0\u884C\u4E2D" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "sci-stat", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: view.team.counts.waiting }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: "\u7B49\u5F85\u4E2D" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "sci-stat", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: view.team.counts.completed }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: "\u5DF2\u5B8C\u6210" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "sci-stat", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: view.team.counts.blocked }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: "\u53D7\u963B" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Panel, { title: "\u7814\u7A76\u56E2\u961F", subtitle: "\u6210\u5458\u72B6\u6001\u548C\u5F53\u524D\u8D1F\u8D23\u7684\u4EFB\u52A1\u3002\u70B9\u51FB\u6210\u5458\u53EF\u67E5\u770B\u5BF9\u5E94\u4F1A\u8BDD\u3002", children: [
      memberError && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(StatusMessage, { tone: "error", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("b", { children: [
          memberError.member.name || "\u6210\u5458",
          "\u4F1A\u8BDD\u672A\u80FD\u6253\u5F00\u3002"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { children: memberError.message }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "sci-result-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { small: true, onClick: () => openMember(memberError.member), children: "\u91CD\u8BD5" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { small: true, onClick: () => setMemberError(null), children: "\u5173\u95ED\u63D0\u793A" })
        ] })
      ] }),
      view.team.members.length ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "sci-members", children: view.team.members.map((member) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "sci-member", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "sci-result-top", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h3", { children: view.experts.roles?.[member.role]?.label || member.role || member.name }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Badge, { tone: member.liveStatusTone, children: member.liveStatusLabel })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { children: member.currentTasks.length ? member.currentTasks.map((task) => task.subject || task.id).join("\uFF1B") : "\u5F53\u524D\u6CA1\u6709\u8FDB\u884C\u4E2D\u7684\u4EFB\u52A1" }),
        member.lastReport && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("b", { children: "\u6700\u8FD1\u56DE\u62A5\uFF1A" }),
          member.lastReport
        ] }),
        memberOpenAvailable && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "sci-result-actions", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { small: true, onClick: () => openMember(member), children: "\u6253\u5F00\u6210\u5458\u4F1A\u8BDD" }) })
      ] }, member.name)) }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(EmptyState, { title: "\u56E2\u961F\u5C1A\u672A\u542F\u52A8", children: "\u5F00\u59CB\u7EC6\u5316\u5DF2\u786E\u8BA4\u7684\u7814\u7A76\u7ED3\u679C\u540E\uFF0C\u56E2\u961F\u4EFB\u52A1\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Panel, { title: "\u6267\u884C\u4EFB\u52A1", subtitle: "\u4F9D\u8D56\u7EBF\u4ECE\u4E0A\u6E38\u4EFB\u52A1\u6307\u5411\u7B49\u5F85\u5B83\u5B8C\u6210\u7684\u4EFB\u52A1\u3002", action: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "sci-result-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { small: true, onClick: () => setMode("graph"), "aria-pressed": mode === "graph", children: "\u4F9D\u8D56\u56FE" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { small: true, onClick: () => setMode("list"), "aria-pressed": mode === "list", children: "\u5217\u8868" })
    ] }), children: tasks.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "sci-small", children: "\u8FD8\u6CA1\u6709\u8BB0\u5F55\u7684\u6267\u884C\u4EFB\u52A1\u3002" }) : mode === "list" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "sci-task-list", children: tasks.map((task) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "sci-task-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("b", { children: task.subject || task.id }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "sci-small", children: task.description || task.resultIds.join("\u3001") || "\u672A\u5173\u8054\u7814\u7A76\u7ED3\u679C" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { children: task.assignee || "\u672A\u5206\u914D" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Badge, { tone: STATE_TONE[task.status], children: task.label }),
      task.blockers.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "sci-small", children: [
        "\u963B\u585E\uFF1A",
        task.blockers.join("\uFF1B")
      ] })
    ] }, task.id)) }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "sci-task-graph", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "sci-task-canvas", style: { width: layout.width, height: layout.height }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { className: "sci-task-lines", width: layout.width, height: layout.height, viewBox: `0 0 ${layout.width} ${layout.height}`, "aria-hidden": "true", children: [
        tasks.flatMap((task) => (task.blockedBy || []).map((id) => {
          const from = layout.position.get(id), to = layout.position.get(task.id);
          if (!from || !to) return null;
          const startX = from.x + 188, startY = from.y + 36, endX = to.x, endY = to.y + 36, bend = Math.max(22, (endX - startX) / 2);
          return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { className: "sci-task-line", d: `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`, markerEnd: "url(#sci-arrow)" }, `${id}-${task.id}`);
        })),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("marker", { id: "sci-arrow", markerWidth: "7", markerHeight: "7", refX: "6", refY: "3.5", orient: "auto", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M0,0 L7,3.5 L0,7", fill: "none", stroke: "currentColor" }) }) })
      ] }),
      tasks.map((task) => {
        const point = layout.position.get(task.id);
        return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "sci-task-node", style: { left: point.x, top: point.y }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: task.subject || task.id }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { children: [
            task.assignee || "\u672A\u5206\u914D",
            " \xB7 ",
            task.label
          ] }),
          task.resultIds.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: task.resultIds.join("\u3001") })
        ] }, task.id);
      })
    ] }) }) }),
    view.team.blockedTasks.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Panel, { title: "\u53D7\u963B\u4E8B\u9879", subtitle: "\u53EA\u5217\u51FA\u660E\u786E\u7684\u672A\u5B8C\u6210\u4F9D\u8D56\u6216\u88AB\u6807\u8BB0\u4E3A\u963B\u585E\u7684\u4EFB\u52A1\u3002", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "sci-task-list", children: view.team.blockedTasks.map((task) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "sci-task-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("b", { children: task.subject || task.id }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "sci-small", children: task.blockers.join("\uFF1B") }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Badge, { tone: "warn", children: "\u53D7\u963B" })
    ] }, task.id)) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Panel, { title: "\u6700\u8FD1\u56DE\u62A5", children: view.team.activity.length ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "sci-task-list", children: view.team.activity.map((item) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "sci-task-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("b", { children: item.summary }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "sci-small", children: item.resultIds.length ? `\u5173\u8054\u7ED3\u679C\uFF1A${item.resultIds.join("\u3001")}` : "\u672A\u5173\u8054\u7ED3\u679C" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "sci-small", children: item.at ? new Date(item.at).toLocaleString() : "\u65F6\u95F4\u672A\u8BB0\u5F55" })
    ] }, item.id)) }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "sci-small", children: "\u6682\u65E0\u6210\u5458\u56DE\u62A5\u3002" }) })
  ] });
}

// client-src/workbench/ArtifactsPage.jsx
var import_react5 = __toESM(require("react"), 1);

// client-src/workbench/bounded-list.js
function visibleItems(items, expanded = false, limit = 5) {
  const rows = Array.isArray(items) ? items : [];
  const safeLimit = Number.isFinite(limit) && limit >= 0 ? Math.floor(limit) : 5;
  return expanded ? rows : rows.slice(0, safeLimit);
}

// client-src/workbench/ArtifactsPage.jsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var ARTIFACT_PREVIEW_LIMIT = 5;
function timestampLabel(value) {
  const time = Number(value || 0);
  return Number.isFinite(time) && time > 0 ? new Date(time).toLocaleString() : "\u65F6\u95F4\u672A\u8BB0\u5F55";
}
function retryUrl(url, attempt) {
  if (!url || !attempt) return url;
  return `${url}${url.includes("?") ? "&" : "?"}previewAttempt=${attempt}`;
}
function ImagePreview({ figure, compact = false }) {
  const [failed, setFailed] = (0, import_react5.useState)(false);
  const [attempt, setAttempt] = (0, import_react5.useState)(0);
  const retry = () => {
    setFailed(false);
    setAttempt((value) => value + 1);
  };
  if (!figure.previewable || !figure.url || failed) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "sci-image-fallback sci-empty", role: failed ? "alert" : "status", style: { minHeight: compact ? 180 : 260 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("b", { children: failed ? "\u56FE\u7247\u672A\u80FD\u52A0\u8F7D" : "\u6B64\u6587\u4EF6\u4E0D\u9002\u5408\u5185\u5D4C\u9884\u89C8" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "sci-small", children: failed ? "\u6587\u4EF6\u53EF\u80FD\u4E0D\u5B58\u5728\u3001\u683C\u5F0F\u4E0D\u53D7\u6D4F\u89C8\u5668\u652F\u6301\uFF0C\u6216\u5F53\u524D\u5DE5\u4F5C\u533A\u65E0\u6CD5\u8BFB\u53D6\u3002" : figure.path?.split(".").pop()?.toUpperCase() || "\u6587\u4EF6" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "sci-result-actions", children: [
        figure.previewable && figure.url && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { small: true, onClick: retry, children: "\u91CD\u65B0\u52A0\u8F7D" }),
        figure.url && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("a", { className: "sci-button sci-button-small", href: figure.url, target: "_blank", rel: "noreferrer", children: "\u6253\u5F00\u539F\u6587\u4EF6" })
      ] })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "img",
    {
      className: compact ? "sci-figure-image-compact" : "sci-figure-image-large",
      src: retryUrl(figure.url, attempt),
      alt: figure.title,
      loading: compact ? "lazy" : void 0,
      onError: () => setFailed(true),
      style: compact ? { width: "100%", height: 180, objectFit: "contain", background: "var(--sci-raised)", display: "block" } : { maxWidth: "100%", maxHeight: "70vh", display: "block", margin: "0 auto", objectFit: "contain" }
    },
    attempt
  );
}
function FigureCard({ figure, previous, onOpen, onCompare }) {
  const audit = figure.audit?.overallStatus || figure.audit?.status;
  const manual = audit === "approved" ? "\u4EBA\u5DE5\u7EC8\u5BA1\u5DF2\u6279\u51C6" : audit === "ready-for-manual-review" ? "\u7B49\u5F85\u4EBA\u5DE5\u7EC8\u5BA1" : audit ? `\u524D\u68C0\u72B6\u6001\uFF1A${audit}` : "\u5C1A\u65E0\u524D\u68C0\u8BB0\u5F55";
  const dimensions = figure.width && figure.height ? `${figure.width} \xD7 ${figure.height}${figure.unit ? ` ${figure.unit}` : ""}` : figure.dimensions || "\u5C3A\u5BF8\u672A\u8BB0\u5F55";
  const previousLabel = figure.previousVersionRelation === "recorded" ? "\u4E0A\u4E00\u767B\u8BB0\u7248\u672C" : "\u53EF\u80FD\u7684\u4E0A\u4E00\u6761\u540C\u540D\u8BB0\u5F55\uFF08\u63A8\u6D4B\uFF09";
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("article", { className: "sci-figure", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "sci-figure-preview", role: "group", "aria-label": `\u56FE\u4EF6\u9884\u89C8\uFF1A${figure.title}`, style: { width: "100%", padding: 0, color: "inherit", textAlign: "left", font: "inherit" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ImagePreview, { figure, compact: true }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "sci-figure-copy", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: figure.title }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { children: [
          figure.resultId || "\u672A\u5173\u8054\u7814\u7A76\u7ED3\u679C",
          " \xB7 ",
          figure.version ? `\u7248\u672C ${figure.version}` : "\u7248\u672C\u672A\u8BB0\u5F55"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { children: [
          dimensions,
          " \xB7 ",
          manual
        ] })
      ] })
    ] }),
    previous && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "sci-figure-history", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { children: [
        previousLabel,
        "\uFF1A",
        previous.version ? `\u7248\u672C ${previous.version}` : previous.title
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: timestampLabel(previous.registeredAt || previous.createdAt) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "sci-result-actions sci-figure-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { small: true, onClick: () => onOpen(figure), children: "\u653E\u5927\u67E5\u770B" }),
      previous && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { small: true, onClick: () => onCompare({ current: figure, previous }), children: figure.previousVersionRelation === "recorded" ? "\u5BF9\u6BD4\u4E0A\u4E00\u7248\u672C" : "\u5BF9\u6BD4\u4E0A\u4E00\u6761\u8BB0\u5F55" }),
      figure.url && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("a", { className: "sci-button sci-button-small", href: figure.url, target: "_blank", rel: "noreferrer", children: "\u6253\u5F00\u6587\u4EF6" })
    ] })
  ] });
}
function FileGroup({ group }) {
  const [expanded, setExpanded] = (0, import_react5.useState)(false);
  const items = visibleItems(group.items, expanded, ARTIFACT_PREVIEW_LIMIT);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "sci-group", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("h3", { children: [
      group.label,
      " ",
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "sci-small", children: [
        "\u5171 ",
        group.items.length,
        " \u9879"
      ] })
    ] }),
    group.items.length ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "sci-file-list", children: items.map((file) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "sci-file", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: file.path.split(/[\\/]/).pop() || file.path }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "sci-small", children: file.path })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("a", { className: "sci-button sci-button-small", href: file.url, target: "_blank", rel: "noreferrer", children: "\u6253\u5F00" })
      ] }, file.path)) }),
      group.items.length > ARTIFACT_PREVIEW_LIMIT && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "sci-button sci-button-small", "aria-expanded": expanded, onClick: () => setExpanded((value) => !value), children: expanded ? "\u6536\u8D77" : `\u67E5\u770B\u5168\u90E8 ${group.items.length} \u9879` })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "sci-small", children: [
      "\u6682\u65E0",
      group.label,
      "\u3002"
    ] })
  ] });
}
function ReviewGroup({ reviews }) {
  const [expanded, setExpanded] = (0, import_react5.useState)(false);
  const items = visibleItems(reviews, expanded, ARTIFACT_PREVIEW_LIMIT);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "sci-group", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("h3", { children: [
      "\u5BA1\u67E5\u8BB0\u5F55 ",
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "sci-small", children: [
        "\u5171 ",
        reviews.length,
        " \u6761"
      ] })
    ] }),
    reviews.length ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "sci-task-list", children: items.map((review) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "sci-task-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("b", { children: review.resultTitle || review.scope || review.runId || "\u4E3B\u5F20\u5BA1\u67E5" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "sci-small", children: review.message || review.summary || "\u6458\u8981\u672A\u63D0\u4F9B" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Badge, { tone: review.severity === "fail" ? "bad" : review.severity === "warn" ? "warn" : "default", children: review.severity || "\u72B6\u6001\u5F85\u6838\u5BF9" })
      ] }, review.runId || review.id || JSON.stringify(review))) }),
      reviews.length > ARTIFACT_PREVIEW_LIMIT && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "sci-button sci-button-small", "aria-expanded": expanded, onClick: () => setExpanded((value) => !value), children: expanded ? "\u6536\u8D77" : `\u67E5\u770B\u5168\u90E8 ${reviews.length} \u6761` })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "sci-small", children: "\u6682\u65E0\u5BA1\u67E5\u8BB0\u5F55\u3002" })
  ] });
}
function FigureDialog({ figure, onClose }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "sci-modal-backdrop", role: "presentation", onMouseDown: (event) => {
    if (event.target === event.currentTarget) onClose();
  }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: "sci-modal", role: "dialog", "aria-modal": "true", "aria-label": `\u56FE\u4EF6\u9884\u89C8\uFF1A${figure.title}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "sci-panel-heading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h2", { children: figure.title }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: figure.resultId || "\u672A\u5173\u8054\u7814\u7A76\u7ED3\u679C" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { onClick: onClose, children: "\u5173\u95ED" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ImagePreview, { figure }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "sci-small", style: { marginTop: 12 }, children: [
      figure.version ? `\u767B\u8BB0\u7248\u672C ${figure.version}` : "\u767B\u8BB0\u7248\u672C\u672A\u8BB0\u5F55",
      " \xB7 ",
      timestampLabel(figure.registeredAt || figure.createdAt),
      " \xB7 ",
      figure.path || "\u6587\u4EF6\u8DEF\u5F84\u672A\u8BB0\u5F55"
    ] })
  ] }) });
}
function FigureCompareDialog({ comparison, onClose }) {
  const { current, previous } = comparison;
  const inferred = current.previousVersionRelation !== "recorded";
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "sci-modal-backdrop", role: "presentation", onMouseDown: (event) => {
    if (event.target === event.currentTarget) onClose();
  }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: "sci-modal sci-modal-wide", role: "dialog", "aria-modal": "true", "aria-label": `\u56FE\u4EF6\u7248\u672C\u5BF9\u6BD4\uFF1A${current.title}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "sci-panel-heading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h2", { children: "\u56FE\u4EF6\u7248\u672C\u5BF9\u6BD4" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: inferred ? "\u4E0A\u4E00\u6761\u8BB0\u5F55\u6309\u540C\u4E00\u7814\u7A76\u7ED3\u679C\u3001\u540C\u540D\u6587\u4EF6\u548C\u65F6\u95F4\u987A\u5E8F\u63A8\u6D4B\uFF1B\u540E\u7AEF\u672A\u8BB0\u5F55\u7248\u672C\u5173\u7CFB\u3002" : "\u4E0A\u4E00\u7248\u672C\u6765\u81EA\u540E\u7AEF\u767B\u8BB0\u7684 prevId \u7248\u672C\u94FE\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { onClick: onClose, children: "\u5173\u95ED" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "sci-compare-grid", style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 18 }, children: [previous, current].map((figure, index) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("article", { className: "sci-compare-item", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h3", { children: index === 0 ? inferred ? "\u8F83\u65E9\u7684\u540C\u540D\u8BB0\u5F55\uFF08\u63A8\u6D4B\uFF09" : "\u4E0A\u4E00\u767B\u8BB0\u7248\u672C" : "\u5F53\u524D\u8BB0\u5F55" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "sci-small", children: [
        figure.version ? `\u7248\u672C ${figure.version}` : "\u7248\u672C\u672A\u8BB0\u5F55",
        " \xB7 ",
        timestampLabel(figure.registeredAt || figure.createdAt)
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ImagePreview, { figure }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "sci-small", children: figure.path || "\u6587\u4EF6\u8DEF\u5F84\u672A\u8BB0\u5F55" })
    ] }, figure.id || figure.path)) })
  ] }) });
}
function ArtifactsPage({ view, onAction }) {
  const [preview, setPreview] = (0, import_react5.useState)(null);
  const [comparison, setComparison] = (0, import_react5.useState)(null);
  const figures = view.artifacts.figures;
  const figureById = new Map(figures.filter((figure) => figure.id).map((figure) => [figure.id, figure]));
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "sci-stack", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Panel, { title: "\u56FE\u8868", subtitle: "\u56FE\u4EF6\u4F1A\u5728\u6D4F\u89C8\u5668\u5B9E\u9645\u52A0\u8F7D\u6210\u529F\u540E\u663E\u793A\uFF1B\u52A0\u8F7D\u5931\u8D25\u65F6\u53EF\u91CD\u8BD5\u6216\u76F4\u63A5\u6253\u5F00\u6587\u4EF6\u3002\u767B\u8BB0\u8FC7\u7248\u672C\u5173\u7CFB\u7684\u56FE\u4EF6\u53EF\u5E76\u6392\u6BD4\u8F83\u3002", action: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { primary: true, onClick: () => onAction("draw", view.paper.results.find((item) => item.confirmed)?.id || null), disabled: !view.paper.results.some((item) => item.confirmed && view.paper.core.confirmed), title: !view.paper.results.some((item) => item.confirmed && view.paper.core.confirmed) ? "\u5148\u786E\u8BA4\u6838\u5FC3\u7ED3\u8BBA\u548C\u4E00\u9879\u7814\u7A76\u7ED3\u679C\uFF0C\u518D\u5EFA\u7ACB\u6B63\u5F0F\u7ED8\u56FE\u8BA1\u5212\u3002" : void 0, children: "\u57FA\u4E8E\u73B0\u6709\u7ED3\u679C\u5F00\u59CB\u7ED8\u56FE" }), children: figures.length ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "sci-gallery", children: figures.map((figure) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(FigureCard, { figure, previous: figureById.get(figure.previousVersionId), onOpen: setPreview, onCompare: setComparison }, figure.id || figure.path)) }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(EmptyState, { title: "\u8FD8\u6CA1\u6709\u767B\u8BB0\u56FE\u4EF6", children: "\u57FA\u4E8E\u5DF2\u786E\u8BA4\u7684\u6838\u5FC3\u7ED3\u8BBA\u548C\u7814\u7A76\u7ED3\u679C\u5EFA\u7ACB\u7ED8\u56FE\u8BA1\u5212\u540E\uFF0C\u56FE\u4EF6\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Panel, { title: "\u5176\u4ED6\u6210\u679C", subtitle: "\u6309\u7528\u9014\u5206\u7EC4\u6D4F\u89C8\u5DE5\u4F5C\u533A\u6587\u4EF6\u3002", children: [
      view.artifacts.groups.filter((group) => group.id !== "figures").map((group) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(FileGroup, { group }, group.id)),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ReviewGroup, { reviews: view.artifacts.reviews })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "sci-result-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { onClick: () => onAction("write"), children: "\u64B0\u5199\u8BBA\u6587" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { onClick: () => onAction("slides"), children: "\u5236\u4F5C\u6C47\u62A5 PPT" })
    ] }),
    preview && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(FigureDialog, { figure: preview, onClose: () => setPreview(null) }, preview.id || preview.path),
    comparison && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(FigureCompareDialog, { comparison, onClose: () => setComparison(null) }, `${comparison.previous.id}:${comparison.current.id}`)
  ] });
}

// client-src/workbench/ExpertSetupPage.jsx
var import_react6 = __toESM(require("react"), 1);
var import_jsx_runtime5 = require("react/jsx-runtime");
var tool = (name, category) => ({
  name,
  category,
  environment: "\u672C\u673A\u8FD0\u884C\u4F9D\u8D56\u672A\u63A2\u6D4B\uFF1B\u9700\u6309\u5DE5\u5177\u5B98\u65B9\u6587\u6863\u6838\u5BF9\u3002",
  status: "\u672C\u673A\u5B89\u88C5\u72B6\u6001\u4E0E\u7248\u672C\u672A\u68C0\u6D4B\u3002"
});
var ROLE_INFO = {
  simulator: { title: "\u8BA1\u7B97\u6A21\u62DF\u4E13\u5BB6", purpose: "\u5206\u5B50\u52A8\u529B\u5B66\u3001\u5206\u5B50\u5BF9\u63A5\u4E0E\u86CB\u767D\u590D\u5408\u7269\u5EFA\u6A21\u3002", tools: [tool("GROMACS", "\u5206\u5B50\u52A8\u529B\u5B66\u8F6F\u4EF6"), tool("OpenMM", "\u5206\u5B50\u52A8\u529B\u5B66\u6846\u67B6"), tool("NAMD", "\u5206\u5B50\u52A8\u529B\u5B66\u8F6F\u4EF6"), tool("Boltz", "\u86CB\u767D\u8D28\u7ED3\u6784/\u590D\u5408\u7269\u9884\u6D4B"), tool("AutoDock Vina", "\u5206\u5B50\u5BF9\u63A5\u8F6F\u4EF6"), tool("ORCA", "\u91CF\u5B50\u5316\u5B66\u8F6F\u4EF6"), tool("Quantum ESPRESSO", "\u7B2C\u4E00\u6027\u539F\u7406\u8BA1\u7B97\u8F6F\u4EF6")] },
  trainer: { title: "\u6A21\u578B\u8BAD\u7EC3\u4E13\u5BB6", purpose: "\u86CB\u767D\u8D28\u8BED\u8A00\u6A21\u578B\u3001\u53EF\u590D\u73B0\u8BAD\u7EC3\u4E0E\u53C2\u6570\u9AD8\u6548\u5FAE\u8C03\u3002", tools: [tool("ESM / ESMC", "\u86CB\u767D\u8D28\u8BED\u8A00\u6A21\u578B"), tool("ProtT5", "\u86CB\u767D\u8D28\u8BED\u8A00\u6A21\u578B"), tool("PyTorch Lightning", "\u6DF1\u5EA6\u5B66\u4E60\u8BAD\u7EC3\u6846\u67B6"), tool("Hugging Face / PEFT", "\u6A21\u578B\u4E0E\u53C2\u6570\u9AD8\u6548\u5FAE\u8C03\u5DE5\u5177")] },
  "figure-expert": { title: "\u79D1\u7814\u7ED8\u56FE\u4E13\u5BB6", purpose: "\u7EC4\u5B66\u7EDF\u8BA1\u56FE\u3001\u7ED3\u6784\u4E0E\u4E92\u4F5C\u56FE\u3001\u673A\u5236\u793A\u610F\u56FE\u548C\u6295\u7A3F\u524D\u68C0\u67E5\u3002", tools: [tool("Matplotlib / Seaborn / Plotly", "\u6570\u636E\u53EF\u89C6\u5316\u5E93"), tool("\u7ED3\u6784\u89C6\u56FE\u4E0E\u4E92\u4F5C\u56FE", "\u7ED3\u6784\u5206\u6790\u4E0E\u7ED8\u56FE\u5DE5\u5177"), tool("\u53EF\u7F16\u8F91 SVG / PDF", "\u77E2\u91CF\u56FE\u683C\u5F0F")] },
  analyst: { title: "\u6570\u636E\u5206\u6790\u5E08", purpose: "NGS\u3001\u5355\u7EC6\u80DE\u3001\u7A7A\u95F4\u7EC4\u5B66\u3001\u86CB\u767D\u8D28\u7EC4\u548C\u5E38\u89C4\u751F\u7269\u7EDF\u8BA1\u3002", tools: [tool("FastQC / MultiQC", "\u6D4B\u5E8F\u8D28\u63A7\u5DE5\u5177"), tool("DESeq2 / edgeR", "\u5DEE\u5F02\u8868\u8FBE\u5206\u6790\u5305"), tool("Scanpy / Seurat", "\u5355\u7EC6\u80DE\u5206\u6790\u5DE5\u5177"), tool("R / Python", "\u7EDF\u8BA1\u4E0E\u811A\u672C\u8BED\u8A00")] },
  "literature-scout": { title: "\u6587\u732E\u8C03\u7814\u4E13\u5458", purpose: "\u7CFB\u7EDF\u68C0\u7D22\u3001\u7B5B\u9009\u548C\u6838\u5BF9\u7814\u7A76\u8BC1\u636E\u3002", tools: [tool("PubMed / Europe PMC", "\u6587\u732E\u6570\u636E\u5E93"), tool("Crossref / DOI \u6821\u9A8C", "\u4E66\u76EE\u4E0E\u6807\u8BC6\u7B26\u670D\u52A1"), tool("\u7CFB\u7EDF\u7EFC\u8FF0\u8BB0\u5F55", "\u8BC1\u636E\u6574\u7406\u65B9\u6CD5")] },
  "topic-designer": { title: "\u8BFE\u9898\u8BBE\u8BA1\u4E13\u5BB6", purpose: "\u7814\u7A76\u95EE\u9898\u3001\u5B9E\u9A8C\u8BBE\u8BA1\u3001\u5173\u952E\u5BF9\u7167\u548C\u53EF\u68C0\u9A8C\u5047\u8BBE\u3002", tools: [tool("\u7814\u7A76\u8BBE\u8BA1\u4E0E\u529F\u6548\u5206\u6790", "\u7EDF\u8BA1\u8BBE\u8BA1\u65B9\u6CD5"), tool("\u56E0\u679C\u56FE\u4E0E\u53CD\u8BC1\u6761\u4EF6", "\u56E0\u679C\u63A8\u7406\u65B9\u6CD5"), tool("\u5B9E\u9A8C\u53EF\u884C\u6027\u8BC4\u4F30", "\u65B9\u6848\u8BC4\u4F30\u65B9\u6CD5")] },
  writer: { title: "\u6587\u7AE0\u64B0\u5199\u4E13\u5BB6", purpose: "\u56F4\u7ED5\u5DF2\u786E\u8BA4\u7ED3\u679C\u7EC4\u7EC7\u7A3F\u4EF6\uFF0C\u4E0D\u8865\u9020\u8BC1\u636E\u3002", tools: [tool("\u8BBA\u6587\u7ED3\u6784\u4E0E\u671F\u520A\u683C\u5F0F", "\u5199\u4F5C\u89C4\u8303"), tool("\u5F15\u6587\u548C\u56FE\u8868\u5B9A\u4F4D", "\u7A3F\u4EF6\u7EC4\u7EC7\u65B9\u6CD5"), tool("\u4E2D\u82F1\u6587\u7A3F\u4EF6", "\u5B66\u672F\u5199\u4F5C")] },
  reviewer: { title: "\u79D1\u7814\u5BA1\u67E5\u4E13\u5BB6", purpose: "\u68C0\u67E5\u4E3B\u5F20\u3001\u8BC1\u636E\u3001\u7EDF\u8BA1\u548C\u62A5\u544A\u89C4\u8303\u4E4B\u95F4\u7684\u4E00\u81F4\u6027\u3002", tools: [tool("\u8BC1\u636E\u94FE\u5BA1\u67E5", "\u8BC1\u636E\u6838\u67E5\u65B9\u6CD5"), tool("\u504F\u501A\u4E0E\u5C40\u9650\u6027\u6838\u67E5", "\u7814\u7A76\u8D28\u91CF\u8BC4\u4F30"), tool("\u6295\u7A3F\u524D\u6E05\u5355", "\u62A5\u544A\u89C4\u8303\u68C0\u67E5")] },
  presentation: { title: "\u6C47\u62A5 PPT \u4E13\u5BB6", purpose: "\u5C06\u5DF2\u786E\u8BA4\u7ED3\u679C\u6574\u7406\u6210\u53EF\u8BB2\u8FF0\u7684\u5B66\u672F\u6C47\u62A5\u3002", tools: [tool("\u4F1A\u8BAE\u6C47\u62A5\u7ED3\u6784", "\u6C47\u62A5\u8BBE\u8BA1"), tool("\u7ED3\u679C\u56FE\u8868\u7F16\u6392", "\u79D1\u5B66\u4F20\u64AD"), tool("\u7B54\u8FA9\u53D9\u4E8B", "\u6C47\u62A5\u8BBE\u8BA1")] }
};
function installedFor(installed, role, catalogId) {
  return (installed?.[role] || []).find((item) => item.catalogId === catalogId || item.name === catalogId);
}
function ExpertSetupPage({ view, refresh }) {
  const [busy, setBusy] = (0, import_react6.useState)(null);
  const [notice, setNotice] = (0, import_react6.useState)(null);
  const skillMenu = view.experts.skillMenu || {};
  const catalog = skillMenu.catalog || {};
  const installed = skillMenu.installed || {};
  const roles = Object.keys(ROLE_INFO);
  const candidateCards = (0, import_react6.useMemo)(() => roles.flatMap((role) => (catalog[role] || []).map((entry) => ({ ...entry, role }))), [catalog]);
  const catalogEntryKeys = new Set(candidateCards.map((entry) => `${entry.role}:${entry.id}`));
  const customInstalled = roles.flatMap((role) => (installed[role] || []).map((entry) => ({ ...entry, role, id: entry.name }))).filter((entry) => !catalogEntryKeys.has(`${entry.role}:${entry.catalogId || entry.name}`));
  const manageSkill = async (entry, action) => {
    const key = `${entry.role}:${entry.id}`;
    setBusy(key);
    setNotice(null);
    try {
      const payloadBody = action === "remove" ? { action, role: entry.role, name: entry.id } : { action, role: entry.role, repoId: entry.id };
      const response = await fetch("/plugins/dsh-science/skill-manage", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(payloadBody) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) throw new Error(payload.error || `HTTP ${response.status}`);
      setNotice({ tone: "success", text: action === "install" ? `${entry.name} \u5DF2\u5B89\u88C5\u3002` : `${entry.name} \u5DF2\u79FB\u9664\u3002` });
      await refresh();
    } catch (error) {
      setNotice({ tone: "error", text: `\u64CD\u4F5C\u5931\u8D25\uFF1A${error.message}` });
    } finally {
      setBusy(null);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sci-stack", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Panel, { title: "\u4E13\u5BB6\u80FD\u529B", subtitle: "\u5185\u7F6E\u80FD\u529B\u53EF\u76F4\u63A5\u4F7F\u7528\uFF1B\u5DE5\u5177\u5019\u9009\u9700\u8981\u5148\u5728\u5F53\u524D\u73AF\u5883\u5B89\u88C5\u5E76\u9A8C\u8BC1\uFF0C\u4E0D\u4EE3\u8868\u5DF2\u96C6\u6210\u3002", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "sci-expert-grid", children: roles.map((role) => {
      const info = ROLE_INFO[role];
      const member = view.experts.roles?.[role];
      const installedCount = (installed[role] || []).length;
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("article", { className: "sci-expert-card", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sci-result-top", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h3", { children: member?.label || info.title }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children: info.purpose })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(Badge, { children: [
            installedCount,
            " \u9879\u6269\u5C55\u5DF2\u5B89\u88C5"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "sci-tool-list", "aria-label": `${info.title}\u73AF\u5883\u5DE5\u5177\u5019\u9009`, children: info.tools.map((item) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sci-tool-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: item.name }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            "\u7C7B\u522B\uFF1A",
            item.category
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            "\u73AF\u5883/\u4F9D\u8D56\uFF1A",
            item.environment
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            "\u72B6\u6001/\u7248\u672C\uFF1A",
            item.status
          ] })
        ] }, item.name)) })
      ] }, role);
    }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(Panel, { title: "\u53EF\u9009\u6280\u80FD\u589E\u5F3A", subtitle: "\u6280\u80FD\u53EA\u63D0\u4F9B\u64CD\u4F5C\u8BF4\u660E\u3002\u8FD0\u884C\u4F9D\u8D56\u3001\u6A21\u578B\u6743\u91CD\u3001\u5916\u90E8 API \u548C\u6570\u636E\u8BB8\u53EF\u4ECD\u9700\u5355\u72EC\u6838\u5BF9\u3002", children: [
      notice && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(StatusMessage, { tone: notice.tone === "error" ? "error" : "success", children: notice.text }),
      candidateCards.length ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "sci-expert-grid", children: candidateCards.map((entry) => {
        const installedEntry = installedFor(installed, entry.role, entry.id);
        const canInstall = entry.installable === true && Boolean(entry.gitRef);
        return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("article", { className: "sci-expert-card", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sci-result-top", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h3", { children: entry.name }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children: entry.description })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Badge, { tone: installedEntry ? "good" : canInstall ? "default" : "warn", children: installedEntry ? "\u5DF2\u5B89\u88C5" : canInstall ? "\u53EF\u5B89\u88C5\u6280\u80FD" : "\u73AF\u5883\u5DE5\u5177 / \u5F85\u6838\u9A8C" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sci-small", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "\u89D2\u8272\uFF1A" }),
            ROLE_INFO[entry.role]?.title || entry.role
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sci-small", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "\u8FD0\u884C\u73AF\u5883\u4E0E\u4F9D\u8D56\uFF1A" }),
            entry.environment || "\u672A\u8BB0\u5F55\uFF0C\u9700\u6838\u5BF9\u4ED3\u5E93\u8BF4\u660E\u3002"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sci-small", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "\u6765\u6E90\u4ED3\u5E93\uFF1A" }),
            entry.repo ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("a", { href: entry.repo, target: "_blank", rel: "noreferrer", children: entry.repo }) : "\u672A\u8BB0\u5F55"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sci-small", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "\u8BB8\u53EF\u8BC1\uFF1A" }),
            entry.license || "\u672A\u6838\u9A8C"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sci-small", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "SKILL.md\uFF1A" }),
            entry.hasSkillMd ? `\u5DF2\u6838\u9A8C \xB7 ${entry.subdir ? `${entry.subdir}/SKILL.md` : "SKILL.md"}` : "\u672A\u6838\u9A8C\u6216\u672A\u53D1\u73B0"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sci-small", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "\u5B89\u88C5\u72B6\u6001\uFF1A" }),
            installedEntry ? `\u5DF2\u5B89\u88C5${installedEntry.dir ? ` \xB7 ${installedEntry.dir}` : ""}` : "\u5C1A\u672A\u5B89\u88C5"
          ] }),
          entry.gitRef && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sci-small", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "\u56FA\u5B9A\u7248\u672C\uFF1A" }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("code", { children: entry.gitRef })
          ] }),
          !entry.gitRef && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "sci-risk", children: "\u5F53\u524D\u6CA1\u6709\u5DF2\u6838\u5B9E\u7684\u56FA\u5B9A\u63D0\u4EA4\uFF0C\u5B89\u88C5\u5165\u53E3\u6682\u4E0D\u53EF\u7528\u3002" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sci-risk", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "\u4F7F\u7528\u98CE\u9669\uFF1A" }),
            entry.risk || "\u98CE\u9669\u4FE1\u606F\u672A\u8BB0\u5F55\uFF1B\u5B89\u88C5\u524D\u9700\u81EA\u884C\u6838\u5BF9\u4F9D\u8D56\u3001\u6570\u636E\u5916\u4F20\u548C\u8BB8\u53EF\u8FB9\u754C\u3002"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "sci-result-actions", children: installedEntry ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Button, { small: true, onClick: () => manageSkill(entry, "remove"), disabled: busy === `${entry.role}:${entry.id}`, children: "\u79FB\u9664\u6269\u5C55" }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Button, { small: true, primary: true, onClick: () => manageSkill(entry, "install"), disabled: !canInstall || busy === `${entry.role}:${entry.id}`, children: busy === `${entry.role}:${entry.id}` ? "\u5904\u7406\u4E2D\u2026" : canInstall ? "\u5B89\u88C5\u5230\u8BE5\u4E13\u5BB6" : "\u6682\u4E0D\u53EF\u5B89\u88C5" }) })
        ] }, `${entry.role}:${entry.id}`);
      }) }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "sci-small", children: "\u76EE\u524D\u6CA1\u6709\u56FA\u5B9A\u7248\u672C\u4E14\u53EF\u76F4\u63A5\u5B89\u88C5\u7684\u6280\u80FD\u6761\u76EE\u3002\u73AF\u5883\u5DE5\u5177\u5019\u9009\u4ECD\u53EF\u7531\u8BA1\u7B97\u4E13\u5BB6\u6309\u5B98\u65B9\u6587\u6863\u914D\u7F6E\u3002" })
    ] }),
    customInstalled.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Panel, { title: "\u5DF2\u5B89\u88C5\u7684\u81EA\u5B9A\u4E49\u6280\u80FD", subtitle: "\u81EA\u5B9A\u4E49\u4ED3\u5E93\u4E0D\u4F1A\u81EA\u52A8\u83B7\u5F97\u4F9D\u8D56\u6216\u98CE\u9669\u80CC\u4E66\uFF1B\u8BF7\u6309\u4ED3\u5E93\u6765\u6E90\u9010\u9879\u6838\u5BF9\u3002", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "sci-expert-grid", children: customInstalled.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("article", { className: "sci-expert-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sci-result-top", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h3", { children: entry.name }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children: ROLE_INFO[entry.role]?.title || entry.role })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Badge, { tone: "good", children: "\u5DF2\u5B89\u88C5" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sci-small", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "\u8FD0\u884C\u73AF\u5883\u4E0E\u4F9D\u8D56\uFF1A" }),
        entry.environment || "\u672A\u8BB0\u5F55"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sci-small", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "\u6765\u6E90\u4ED3\u5E93\uFF1A" }),
        entry.repo ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("a", { href: entry.repo, target: "_blank", rel: "noreferrer", children: entry.repo }) : "\u672A\u8BB0\u5F55"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sci-small", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "\u8BB8\u53EF\u8BC1\uFF1A" }),
        entry.license || "\u672A\u6838\u9A8C"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sci-small", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "SKILL.md\uFF1A" }),
        entry.hasSkillMd ? `\u5DF2\u53D1\u73B0 \xB7 ${(entry.skillMdPaths || []).join("\uFF1B") || entry.dir}` : "\u672A\u53D1\u73B0\uFF1B\u76EE\u5F55\u53EA\u767B\u8BB0\u4E86\u8DEF\u5F84"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sci-small", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "\u5B89\u88C5\u4F4D\u7F6E\uFF1A" }),
        entry.dir || "\u672A\u8BB0\u5F55"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sci-risk", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "\u4F7F\u7528\u98CE\u9669\uFF1A" }),
        entry.risk || "\u5C1A\u672A\u6838\u9A8C\uFF1B\u4F7F\u7528\u524D\u9700\u68C0\u67E5\u4ED3\u5E93\u8BF4\u660E\u3001\u6267\u884C\u547D\u4EE4\u3001\u4F9D\u8D56\u8BB8\u53EF\u548C\u6570\u636E\u5916\u4F20\u8FB9\u754C\u3002"
      ] }),
      entry.warn && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "sci-risk", children: "\u5B89\u88C5\u8BB0\u5F55\u6807\u8BB0\uFF1A\u672A\u53D1\u73B0\u6807\u51C6 SKILL.md\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "sci-result-actions", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Button, { small: true, onClick: () => manageSkill(entry, "remove"), disabled: busy === `${entry.role}:${entry.id}`, children: busy === `${entry.role}:${entry.id}` ? "\u5904\u7406\u4E2D\u2026" : "\u79FB\u9664\u6269\u5C55" }) })
    ] }, `${entry.role}:${entry.id}`)) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Panel, { title: "\u72EC\u7ACB\u96C6\u6210\u4E0E\u6570\u636E\u8FB9\u754C", subtitle: "\u4EE5\u4E0B\u80FD\u529B\u9700\u8981\u5355\u72EC\u5B89\u88C5\u6216\u5916\u90E8\u670D\u52A1\uFF0C\u4E0D\u4F1A\u4F5C\u4E3A\u672C\u5730\u6280\u80FD\u4F2A\u88C5\u6210\u4E00\u952E\u529F\u80FD\u3002", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "sci-expert-grid", children: (skillMenu.integrations || []).map((integration) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("article", { className: "sci-expert-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h3", { children: integration.name }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children: integration.description }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Badge, { tone: integration.tone || "default", children: integration.status }),
      integration.environment && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sci-small", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "\u73AF\u5883/\u4F9D\u8D56\uFF1A" }),
        integration.environment
      ] }),
      integration.license && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sci-small", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "\u8BB8\u53EF\uFF1A" }),
        integration.license
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sci-small", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "\u6765\u6E90\uFF1A" }),
        integration.repo || integration.sourceUrl ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("a", { href: integration.repo || integration.sourceUrl, target: "_blank", rel: "noreferrer", children: integration.repo || integration.sourceUrl }) : integration.sourcePath ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("code", { children: integration.sourcePath }) : "\u672A\u8BB0\u5F55"
      ] }),
      integration.installCommand && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sci-small", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("b", { children: "\u5B89\u88C5\u547D\u4EE4\uFF1A" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("code", { children: integration.installCommand })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "sci-result-actions", children: integration.actionUrl ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("a", { className: "sci-button sci-button-small", href: integration.actionUrl, target: "_blank", rel: "noreferrer", children: integration.actionLabel || "\u6253\u5F00\u6765\u6E90" }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "sci-small", children: integration.actionLabel || "\u5F53\u524D\u672A\u914D\u7F6E\u53EF\u6267\u884C\u8FDE\u63A5" }) })
    ] }, integration.id)) }) })
  ] });
}

// client-src/workbench/use-workbench-state.js
var import_react7 = require("react");

// client-src/workbench/state-view.js
var STAGES = Object.freeze([
  { id: "explore", label: "\u7814\u7A76\u63A2\u7D22" },
  { id: "frame", label: "\u6587\u7AE0\u7ED3\u6784" },
  { id: "execute", label: "\u4EFB\u52A1\u7EC6\u5316" },
  { id: "synthesize", label: "\u5206\u6790\u4E0E\u7ED8\u56FE" },
  { id: "draft", label: "\u8BBA\u6587\u5199\u4F5C" },
  { id: "audit", label: "\u6C47\u62A5\u4E0E\u6295\u7A3F" }
]);
var LIVE_STATUSES = /* @__PURE__ */ new Set(["claimed", "in_progress", "running", "working"]);
var DONE_STATUSES = /* @__PURE__ */ new Set(["completed", "done"]);
var HIDDEN_STATUSES = /* @__PURE__ */ new Set(["deleted", "cancelled"]);
var IMAGE_EXTENSIONS = /* @__PURE__ */ new Set(["png", "jpg", "jpeg", "webp", "svg"]);
var asArray = (value) => Array.isArray(value) ? value : [];
var asText = (value) => typeof value === "string" ? value : "";
var nonEmpty = (value) => asText(value).trim();
function listOf(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}
function stageStateOf(stage, currentStage) {
  const stageIndex = STAGES.findIndex((item) => item.id === stage.id);
  const currentIndex = Math.max(0, STAGES.findIndex((item) => item.id === currentStage));
  if (stageIndex < currentIndex) return "completed";
  if (stageIndex === currentIndex) return "current";
  return "upcoming";
}
function statusLabel(status) {
  const labels = {
    pending: "\u7B49\u5F85\u4E2D",
    claimed: "\u5DF2\u9886\u53D6",
    in_progress: "\u8FDB\u884C\u4E2D",
    working: "\u5DE5\u4F5C\u4E2D",
    running: "\u8FD0\u884C\u4E2D",
    completed: "\u5DF2\u5B8C\u6210",
    failed: "\u5931\u8D25",
    blocked: "\u53D7\u963B",
    cancelled: "\u5DF2\u53D6\u6D88"
  };
  return labels[status] || "\u72B6\u6001\u5F85\u66F4\u65B0";
}
function taskResultIds(task) {
  const ids = [];
  if (typeof task?.resultId === "string" && task.resultId) ids.push(task.resultId);
  for (const id of asArray(task?.resultIds)) if (typeof id === "string" && id && !ids.includes(id)) ids.push(id);
  return ids;
}
function readinessForResult(blueprint, result) {
  const row = asArray(blueprint?.paperSpine?.results).find((item) => item && item.id === result.id);
  if (row?.readiness && typeof row.readiness === "object") return row.readiness;
  const evidence = asArray(result.evidence).filter((item) => item && item.state === "verified").length;
  const claims = asArray(result.claims).length;
  const manuscript = nonEmpty(result.manuscriptRole) && result.manuscriptRole !== "excluded";
  return {
    scientific: { state: evidence > 0 ? "in_progress" : "blocked", blockers: evidence > 0 ? [] : ["\u5C1A\u65E0\u53EF\u6838\u9A8C\u8BC1\u636E"] },
    manuscript: { state: manuscript && claims > 0 ? "in_progress" : "blocked", blockers: manuscript && claims > 0 ? [] : ["\u5C1A\u65E0\u5199\u4F5C\u6750\u6599"] },
    submission: { state: "blocked", blockers: ["\u6295\u7A3F\u51C6\u5907\u4FE1\u606F\u5C1A\u672A\u6838\u5BF9"] }
  };
}
function memberLiveLabel(status) {
  const labels = {
    claimed: "\u5DF2\u9886\u53D6",
    working: "\u5DE5\u4F5C\u4E2D",
    running: "\u6B63\u5728\u8FD0\u884C",
    idle: "\u7A7A\u95F2",
    offline: "\u79BB\u7EBF",
    "claimed/working": "\u5DF2\u9886\u53D6 \xB7 \u5DE5\u4F5C\u72B6\u6001\u5F85\u786E\u8BA4"
  };
  return labels[status] || "\u72B6\u6001\u5F85\u66F4\u65B0";
}
function memberLiveTone(status) {
  if (status === "running" || status === "working") return "good";
  if (status === "claimed" || status === "claimed/working") return "warn";
  if (status === "offline") return "bad";
  return "default";
}
function taskBlockers(task, taskById) {
  const blockers = [];
  if (task.status === "blocked") blockers.push(nonEmpty(task.blockedReason) || "\u4EFB\u52A1\u5DF2\u6807\u8BB0\u4E3A\u53D7\u963B");
  for (const id of asArray(task.blockedBy)) {
    const dependency = taskById.get(id);
    if (!dependency || !DONE_STATUSES.has(dependency.status)) {
      blockers.push(dependency ? `\u7B49\u5F85\u201C${dependency.subject || dependency.id}\u201D\u5B8C\u6210` : `\u4F9D\u8D56\u4EFB\u52A1 ${id} \u4E0D\u5728\u5F53\u524D\u4EFB\u52A1\u677F`);
    }
  }
  return [...new Set(blockers)];
}
function nextStepOf(paper, team) {
  if (!paper.core.claim && paper.results.length === 0) return { label: "\u5F00\u59CB\u63A2\u7D22\u7814\u7A76\u95EE\u9898", action: "explore" };
  if (paper.core.claim && !paper.core.confirmed) return { label: "\u786E\u8BA4\u6838\u5FC3\u7814\u7A76\u7ED3\u8BBA", action: "confirm", targetId: "core" };
  const unconfirmed = paper.results.find((result) => !result.confirmed);
  if (unconfirmed) return { label: "\u68C0\u67E5\u5E76\u786E\u8BA4\u6587\u7AE0\u7ED3\u6784", action: "confirm", targetId: unconfirmed.id };
  const withoutTasks = paper.results.find((result) => result.confirmed && result.taskCount === 0 && !["dropped"].includes(result.status));
  if (withoutTasks) return { label: "\u7EC6\u5316\u6267\u884C\u4EFB\u52A1", action: "refine_tasks", targetId: withoutTasks.id };
  if (team.counts.running > 0 || team.counts.waiting > 0 || team.counts.blocked > 0) return { label: "\u67E5\u770B\u56E2\u961F\u6267\u884C\u8FDB\u5C55", page: "team" };
  if (paper.results.length > 0) return { label: "\u6839\u636E\u5DF2\u786E\u8BA4\u7ED3\u679C\u7EE7\u7EED\u5199\u4F5C", action: "write" };
  return { label: "\u751F\u6210\u6587\u7AE0\u7ED3\u6784\u8349\u6848", action: "generate_structure" };
}
function fileCategory(path) {
  const text = asText(path).toLowerCase();
  const ext = text.split(".").pop() || "";
  if (IMAGE_EXTENSIONS.has(ext) || ["pdf", "tif", "tiff", "eps"].includes(ext) || /figure|plot|chart|图/.test(text)) return "figures";
  if (["doc", "docx", "md", "tex", "rtf"].includes(ext) || /manuscript|paper|draft|论文/.test(text)) return "manuscript";
  if (["ppt", "pptx", "key"].includes(ext) || /slide|presentation|汇报|答辩/.test(text)) return "presentation";
  if (["csv", "tsv", "parquet", "rds", "rdata", "ipynb", "py", "r", "m", "jl", "json"].includes(ext) || /data|code|analysis|result|数据|代码/.test(text)) return "data-code";
  return "other";
}
function fileUrl(path) {
  return `/plugins/dsh-science/file?path=${encodeURIComponent(path)}`;
}
function stateViewOf(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || snapshot.error) {
    return { available: false, error: asText(snapshot?.error) || "\u5F53\u524D\u65E0\u6CD5\u8BFB\u53D6\u79D1\u7814\u5DE5\u4F5C\u53F0\u72B6\u6001\u3002" };
  }
  const blueprint = snapshot.blueprint && typeof snapshot.blueprint === "object" ? snapshot.blueprint : {};
  const teamState = snapshot.team && typeof snapshot.team === "object" ? snapshot.team : {};
  const rawResults = asArray(blueprint.results);
  const rawTasks = asArray(teamState.tasks).filter((task) => task && !HIDDEN_STATUSES.has(task.status));
  const taskById = new Map(rawTasks.filter((task) => task.id).map((task) => [task.id, task]));
  const figures = listOf(snapshot.figures);
  const files = asArray(snapshot.files);
  const tasks = rawTasks.map((task) => {
    const blockers = taskBlockers(task, taskById);
    return {
      ...task,
      label: statusLabel(task.status),
      resultIds: taskResultIds(task),
      blockers,
      isBlocked: blockers.length > 0,
      isRunning: LIVE_STATUSES.has(task.status),
      isComplete: DONE_STATUSES.has(task.status)
    };
  });
  const resultRows = rawResults.filter((result) => result && typeof result === "object").map((result) => {
    const linkedTasks = tasks.filter((task) => taskResultIds(task).includes(result.id) || asArray(result.tasks).includes(task.id));
    const linkedFigures = figures.filter((figure) => figure && (figure.resultId === result.id || asArray(figure.resultIds).includes(result.id) || asArray(result.figures).includes(figure.id)));
    const readiness = readinessForResult(blueprint, result);
    const required = Object.values(readiness).filter((item) => item && item.state === "blocked").flatMap((item) => asArray(item.blockers));
    const recommended = Object.values(readiness).filter((item) => item && item.state === "in_progress").flatMap((item) => asArray(item.blockers));
    return {
      ...result,
      title: nonEmpty(result.title) || nonEmpty(result.claim) || "\u672A\u547D\u540D\u7814\u7A76\u7ED3\u679C",
      statusLabel: { planned: "\u8BA1\u5212\u4E2D", in_progress: "\u8FDB\u884C\u4E2D", supported: "\u5DF2\u83B7\u5F97\u652F\u6301", negative: "\u4E0E\u9884\u671F\u4E0D\u7B26", dropped: "\u4E0D\u7EB3\u5165\u6B63\u6587" }[result.status] || "\u72B6\u6001\u5F85\u6838\u5BF9",
      confirmed: result.confirmed === true,
      readiness,
      taskCount: linkedTasks.length,
      completedTaskCount: linkedTasks.filter((task) => task.isComplete).length,
      runningTaskCount: linkedTasks.filter((task) => task.isRunning).length,
      figures: linkedFigures,
      requiredItems: [...new Set(required)],
      recommendedItems: [...new Set(recommended)],
      tasks: linkedTasks
    };
  });
  const activeTasks = tasks.filter((task) => !task.isComplete);
  const counts = {
    running: tasks.filter((task) => task.isRunning && !task.isBlocked).length,
    waiting: tasks.filter((task) => task.status === "pending" && !task.isBlocked).length,
    completed: tasks.filter((task) => task.isComplete).length,
    blocked: tasks.filter((task) => task.isBlocked).length
  };
  const members = asArray(teamState.members).map((member) => {
    const liveStatus = snapshot.memberLive?.[member.name] || "offline";
    return {
      ...member,
      liveStatus,
      liveStatusLabel: memberLiveLabel(liveStatus),
      liveStatusTone: memberLiveTone(liveStatus),
      currentTasks: tasks.filter((task) => task.assignee === member.name && !task.isComplete),
      lastReport: nonEmpty(member.lastReport) || nonEmpty(member.lastSummary) || ""
    };
  });
  const blockedTasks = tasks.filter((task) => task.isBlocked);
  const activity = tasks.filter((task) => nonEmpty(task.report) || nonEmpty(task.resultSummary) || nonEmpty(task.updatedAt) || nonEmpty(task.completedAt)).sort((a, b) => Number(b.updatedAt || b.completedAt || 0) - Number(a.updatedAt || a.completedAt || 0)).slice(0, 8).map((task) => ({
    id: task.id,
    summary: nonEmpty(task.report) || nonEmpty(task.resultSummary) || task.subject || task.id,
    resultIds: task.resultIds,
    at: task.updatedAt || task.completedAt || task.createdAt || null,
    status: task.status
  }));
  const paper = {
    title: nonEmpty(blueprint.core?.title) || "\u672A\u547D\u540D\u7814\u7A76\u9879\u76EE",
    stage: STAGES.some((stage) => stage.id === blueprint.stage) ? blueprint.stage : "explore",
    stageLabel: STAGES.find((stage) => stage.id === blueprint.stage)?.label || "\u7814\u7A76\u63A2\u7D22",
    stageUpdatedAt: Number(blueprint.stageUpdatedAt || 0),
    stages: STAGES.map((stage) => ({ ...stage, state: stageStateOf(stage, blueprint.stage || "explore") })),
    venue: nonEmpty(blueprint.core?.venue),
    core: {
      title: nonEmpty(blueprint.core?.title),
      claim: nonEmpty(blueprint.core?.claim),
      innovation: nonEmpty(blueprint.core?.innovation),
      confirmed: blueprint.core?.confirmed === true,
      revision: blueprint.core?.revision || 1
    },
    narrative: nonEmpty(blueprint.narrative),
    results: resultRows,
    supportedResults: resultRows.filter((result) => result.status === "supported").length,
    totalResults: resultRows.length,
    updatedAt: blueprint.updatedAt || snapshot.ts || null,
    error: nonEmpty(snapshot.blueprintError)
  };
  const artifacts = files.map((file) => {
    const path = asText(file.path);
    const category = fileCategory(path);
    const ext = path.split(".").pop()?.toLowerCase() || "";
    return {
      ...file,
      path,
      category,
      url: path ? fileUrl(path) : null,
      previewable: category === "figures" && IMAGE_EXTENSIONS.has(ext)
    };
  });
  const figureRecords = figures.map((figure) => {
    const path = nonEmpty(figure.file) || nonEmpty(figure.path) || nonEmpty(figure.filePath) || nonEmpty(figure.outputPath);
    const ext = path.split(".").pop()?.toLowerCase() || "";
    return {
      ...figure,
      path,
      url: path ? fileUrl(path) : null,
      previewable: IMAGE_EXTENSIONS.has(ext),
      title: nonEmpty(figure.title) || nonEmpty(figure.name) || nonEmpty(path.split(/[\\/]/).pop()) || figure.id || "\u672A\u547D\u540D\u56FE\u4EF6"
    };
  });
  const figureById = new Map(figureRecords.filter((figure) => figure.id).map((figure) => [figure.id, figure]));
  const figureFamilyKey = (figure) => {
    const familyId = nonEmpty(figure.figureId) || nonEmpty(figure.familyId);
    if (familyId) return `id:${familyId}`;
    const stem = figure.path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "").trim().toLowerCase();
    const resultId = nonEmpty(figure.resultId);
    return stem && resultId ? `result:${resultId}:stem:${stem}` : "";
  };
  for (const figure of figureRecords) {
    const explicitPreviousId = nonEmpty(figure.prevId) || nonEmpty(figure.previousVersionId);
    if (explicitPreviousId && figureById.has(explicitPreviousId)) {
      figure.previousVersionId = explicitPreviousId;
      figure.previousVersionRelation = "recorded";
      continue;
    }
    const timestamp = Number(figure.registeredAt || figure.createdAt || 0);
    const family = figureFamilyKey(figure);
    if (!family || !Number.isFinite(timestamp) || timestamp <= 0) continue;
    const previous = figureRecords.filter((candidate) => candidate !== figure && figureFamilyKey(candidate) === family).filter((candidate) => {
      const candidateTime = Number(candidate.registeredAt || candidate.createdAt || 0);
      return Number.isFinite(candidateTime) && candidateTime > 0 && candidateTime < timestamp;
    }).sort((a, b) => Number(b.registeredAt || b.createdAt || 0) - Number(a.registeredAt || a.createdAt || 0))[0];
    if (previous?.id) {
      figure.previousVersionId = previous.id;
      figure.previousVersionRelation = "inferred";
    }
  }
  const team = {
    members,
    tasks,
    activeTasks,
    counts,
    blockedTasks,
    activity,
    updatedAt: snapshot.ts || null
  };
  paper.nextStep = nextStepOf(paper, team);
  return {
    available: true,
    generatedAt: snapshot.generatedAt || null,
    paper,
    team,
    artifacts: {
      figures: figureRecords,
      plans: asArray(snapshot.figurePlans),
      files: artifacts,
      reviews: asArray(snapshot.reviews),
      workspaceRoot: asText(snapshot.workspaceRoot),
      groups: [
        { id: "figures", label: "\u56FE\u8868", items: artifacts.filter((item) => item.category === "figures") },
        { id: "manuscript", label: "\u8BBA\u6587\u6587\u7A3F", items: artifacts.filter((item) => item.category === "manuscript") },
        { id: "presentation", label: "\u6C47\u62A5\u6750\u6599", items: artifacts.filter((item) => item.category === "presentation") },
        { id: "data-code", label: "\u6570\u636E\u4E0E\u4EE3\u7801", items: artifacts.filter((item) => item.category === "data-code") },
        { id: "other", label: "\u5176\u4ED6\u6587\u4EF6", items: artifacts.filter((item) => item.category === "other") }
      ]
    },
    experts: {
      roles: snapshot.roles && typeof snapshot.roles === "object" ? snapshot.roles : {},
      skillMenu: snapshot.skillMenu && typeof snapshot.skillMenu === "object" ? snapshot.skillMenu : { catalog: {}, installed: {}, integrations: [] }
    }
  };
}

// client-src/workbench/use-workbench-state.js
var STATE_URL = "/plugins/dsh-science/state";
function useWorkbenchState(pollMs = 5e3) {
  const [record, setRecord] = (0, import_react7.useState)({ loading: true, raw: null, view: null, error: null });
  const refresh = (0, import_react7.useCallback)(async () => {
    try {
      const response = await fetch(STATE_URL, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const raw = await response.json();
      const view = stateViewOf(raw);
      if (!view.available) throw new Error(view.error);
      setRecord({ loading: false, raw, view, error: null });
      return view;
    } catch (error) {
      setRecord((current) => ({ loading: false, raw: current.raw, view: current.view, error: error.message || "\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6\u5DE5\u4F5C\u53F0\u72B6\u6001\u3002" }));
      return null;
    }
  }, []);
  (0, import_react7.useEffect)(() => {
    let active = true;
    const run = async () => {
      if (active) await refresh();
    };
    void run();
    const timer = setInterval(run, pollMs);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [pollMs, refresh]);
  return { ...record, refresh };
}

// client-src/workbench/ResearchWorkbench.jsx
var import_jsx_runtime6 = require("react/jsx-runtime");
var NAV = [
  { id: "paper", label: "\u8BBA\u6587\u4E3B\u7EBF" },
  { id: "team", label: "\u56E2\u961F\u8FDB\u5C55" },
  { id: "artifacts", label: "\u56FE\u8868\u4E0E\u6210\u679C" },
  { id: "experts", label: "\u4E13\u5BB6\u914D\u7F6E" }
];
function WorkbenchMark() {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "sci-wb-mark", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("svg", { width: "22", height: "22", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.7", strokeLinecap: "round", strokeLinejoin: "round", children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d: "M9 3h6M10 3v6.2l-5.3 9.1A2.5 2.5 0 0 0 6.9 22h10.2a2.5 2.5 0 0 0 2.2-3.7L14 9.2V3" }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d: "M8 15h8M9.4 12.5h5.2" })
  ] }) });
}
function ResearchWorkbench({ services }) {
  const state = useWorkbenchState();
  const [page, setPage] = (0, import_react8.useState)("paper");
  const [dialog, setDialog] = (0, import_react8.useState)(null);
  const [busy, setBusy] = (0, import_react8.useState)(false);
  const [error, setError] = (0, import_react8.useState)(null);
  const [toast, setToast] = (0, import_react8.useState)("");
  const openAction = (action, targetId = null) => {
    setError(null);
    setDialog({ action, targetId });
  };
  const openConversation = () => services?.openConversation?.();
  const submitAction = async (values) => {
    if (!dialog || busy || !state.raw) return;
    const built = buildWorkflowRequest({ action: dialog.action, paperState: state.raw.blueprint || {}, targetId: dialog.targetId, userInput: values });
    if (!built.ok) {
      setError(built.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = await services?.getCurrentSession?.();
      const result = await submitWorkflowRequest({ session, request: built.request });
      if (!result.ok) {
        setError(result);
        return;
      }
      setDialog(null);
      setToast("\u8BF7\u6C42\u5DF2\u63D0\u4EA4\u5230\u5F53\u524D\u5BF9\u8BDD\uFF1B\u7814\u7A76\u72B6\u6001\u4F1A\u5728\u540E\u7AEF\u8BB0\u5F55\u66F4\u65B0\u540E\u5237\u65B0\u3002");
      window.setTimeout(() => setToast(""), 5200);
      await state.refresh();
    } catch (errorValue) {
      setError({ message: "\u65E0\u6CD5\u63D0\u4EA4\u5230\u5F53\u524D\u5BF9\u8BDD\u3002", recovery: "\u786E\u8BA4 DSH \u4F1A\u8BDD\u4ECD\u7136\u6253\u5F00\u540E\uFF0C\u53EF\u4EE5\u5B89\u5168\u91CD\u8BD5\u3002", detail: errorValue.message });
    } finally {
      setBusy(false);
    }
  };
  const copyDiagnostic = async (detail) => {
    try {
      await navigator.clipboard.writeText([detail.message, detail.recovery, detail.detail].filter(Boolean).join("\n"));
    } catch {
    }
  };
  const currentView = state.view;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "sci-workbench", children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(WorkbenchStyles, {}),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "sci-wb-shell", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("header", { className: "sci-wb-header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "sci-wb-brand", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(WorkbenchMark, {}),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h1", { children: "\u79D1\u7814\u5DE5\u4F5C\u53F0" }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "sci-wb-subtitle", children: currentView ? currentView.paper.title : "\u8BBA\u6587\u4E3B\u7EBF \xB7 \u56E2\u961F\u8FDB\u5C55 \xB7 \u79D1\u7814\u6210\u679C" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "sci-wb-head-actions", children: [
          currentView && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Badge, { children: currentView.paper.stageLabel }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { onClick: openConversation, children: "\u6253\u5F00\u5BF9\u8BDD" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("main", { className: "sci-wb-content", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("nav", { className: "sci-wb-nav", "aria-label": "\u79D1\u7814\u5DE5\u4F5C\u53F0\u9875\u9762", children: NAV.map((item) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", "aria-current": page === item.id ? "true" : void 0, onClick: () => setPage(item.id), children: item.label }, item.id)) }),
        state.loading && !currentView ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Panel, { children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "sci-empty", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h2", { children: "\u6B63\u5728\u8BFB\u53D6\u7814\u7A76\u72B6\u6001" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: "\u5DE5\u4F5C\u53F0\u4ECE\u5F53\u524D DSH \u9879\u76EE\u8BFB\u53D6\u8BBA\u6587\u84DD\u56FE\u3001\u56E2\u961F\u4EFB\u52A1\u548C\u5DF2\u767B\u8BB0\u6210\u679C\u3002" })
        ] }) }) }) : state.error && !currentView ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Panel, { title: "\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6\u5DE5\u4F5C\u53F0\u72B6\u6001", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(StatusMessage, { tone: "error", children: [
          state.error,
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "sci-result-actions", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { onClick: state.refresh, children: "\u91CD\u65B0\u8BFB\u53D6" }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { onClick: openConversation, children: "\u6253\u5F00\u5BF9\u8BDD" })
          ] })
        ] }) }) : currentView && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
          page === "paper" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(PaperSpinePage, { view: currentView, raw: state.raw, onAction: openAction, onOpenConversation: openConversation, onNavigate: setPage }),
          page === "team" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TeamProgressPage, { view: currentView, openMemberSession: services?.openMemberSession, memberOpenAvailable: services?.memberOpenAvailable?.(currentView) }),
          page === "artifacts" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ArtifactsPage, { view: currentView, onAction: openAction }),
          page === "experts" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ExpertSetupPage, { view: currentView, refresh: state.refresh }),
          state.error && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "sci-small", style: { marginTop: 14 }, role: "status", children: [
            "\u72B6\u6001\u5237\u65B0\u5931\u8D25\uFF0C\u6B63\u5728\u663E\u793A\u4E0A\u4E00\u6B21\u6210\u529F\u8BFB\u53D6\u7684\u6570\u636E\uFF1A",
            state.error
          ] })
        ] })
      ] })
    ] }),
    dialog && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ActionDialog, { action: dialog.action, target: dialog.targetId && currentView?.paper.results.find((result) => result.id === dialog.targetId), onClose: () => {
      if (!busy) {
        setDialog(null);
        setError(null);
      }
    }, onSubmit: submitAction, busy, error, onOpenConversation: openConversation, onCopyDiagnostic: copyDiagnostic }),
    toast && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "sci-toast", role: "status", children: [
      toast,
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "sci-result-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { small: true, onClick: openConversation, children: "\u6253\u5F00\u5BF9\u8BDD" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { small: true, onClick: () => setToast(""), children: "\u5173\u95ED" })
      ] })
    ] })
  ] });
}

// client-src/workbench/QuickWorkbench.jsx
var import_react9 = __toESM(require("react"), 1);
var import_jsx_runtime7 = require("react/jsx-runtime");
function QuickWorkbench({ services }) {
  const state = useWorkbenchState(8e3);
  const [busy, setBusy] = (0, import_react9.useState)(false);
  const [message, setMessage] = (0, import_react9.useState)("");
  const view = state.view;
  const submitNext = async () => {
    if (!view || busy) return;
    const step = view.paper.nextStep;
    if (!step.action) {
      setMessage("\u8BF7\u6253\u5F00\u5B8C\u6574\u5DE5\u4F5C\u53F0\u67E5\u770B\u5F53\u524D\u5EFA\u8BAE\u3002");
      return;
    }
    if (step.action === "explore") {
      setMessage("\u8BF7\u6253\u5F00\u5B8C\u6574\u5DE5\u4F5C\u53F0\u586B\u5199\u7814\u7A76\u95EE\u9898\u540E\u518D\u5F00\u59CB\u63A2\u7D22\u3002");
      services?.openWorkbench?.();
      return;
    }
    const built = buildWorkflowRequest({ action: step.action, paperState: state.raw?.blueprint || {}, targetId: step.targetId });
    if (!built.ok) {
      setMessage(built.error.message);
      services?.openWorkbench?.();
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const session = await services?.getCurrentSession?.();
      const result = await submitWorkflowRequest({ session, request: built.request });
      setMessage(result.ok ? "\u8BF7\u6C42\u5DF2\u63D0\u4EA4\u5230\u5F53\u524D\u5BF9\u8BDD\u3002" : `${result.message} ${result.recovery}`);
      if (result.ok) await state.refresh();
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "sci-workbench sci-quick", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(WorkbenchStyles, {}),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Panel, { title: "\u79D1\u7814\u5DE5\u4F5C\u53F0", subtitle: view ? `\u5F53\u524D\u9636\u6BB5\uFF1A${view.paper.stageLabel}` : "\u8BBA\u6587\u8FDB\u5EA6\u4E0E\u4E0B\u4E00\u6B65\u64CD\u4F5C", children: state.error && !view ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(StatusMessage, { tone: "error", children: [
      state.error,
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Button, { small: true, onClick: state.refresh, children: "\u91CD\u65B0\u8BFB\u53D6" })
    ] }) : view ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("h2", { className: "sci-title", children: view.paper.title }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "sci-small", children: [
        view.paper.totalResults,
        " \u9879\u7ED3\u679C \xB7 ",
        view.team.counts.running,
        " \u9879\u8FD0\u884C\u4E2D \xB7 ",
        view.team.counts.blocked,
        " \u9879\u53D7\u963B"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("hr", { className: "sci-rule" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("b", { children: view.paper.nextStep.label }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "sci-result-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Button, { primary: true, small: true, onClick: submitNext, disabled: busy, children: busy ? "\u6B63\u5728\u63D0\u4EA4\u2026" : "\u7EE7\u7EED\u4E0B\u4E00\u6B65" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Button, { small: true, onClick: () => services?.openWorkbench?.(), children: "\u6253\u5F00\u5B8C\u6574\u5DE5\u4F5C\u53F0" })
      ] }),
      message && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "sci-small", role: "status", children: message })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "sci-small", children: "\u6B63\u5728\u8BFB\u53D6\u72B6\u6001\u2026" }) })
  ] });
}

// client-src/workbench/host-adapter.js
var WORKBENCH_REQUIRED_SERVICES = Object.freeze([
  "slots",
  "sessions",
  "layout",
  "sidebarRightTabs",
  "uiWorkspace"
]);
function registerGuardedPart(mount, part, register) {
  const state = mount && typeof mount === "object" ? mount : {};
  if (state[part]) return () => {
  };
  const dispose = register();
  state[part] = true;
  return () => {
    state[part] = false;
    if (typeof dispose === "function") dispose();
  };
}

// client-src/index.jsx
var import_jsx_runtime8 = require("react/jsx-runtime");
var inject = [...WORKBENCH_REQUIRED_SERVICES];
var PANEL_ID = "dsh-science/workbench";
function service(ctx, name) {
  try {
    return ctx.get(name);
  } catch {
    return void 0;
  }
}
function currentSessionId(sessions) {
  try {
    const snapshot = sessions?.list?.getSnapshot?.();
    const main = Object.values(snapshot?.byId || {}).find((row) => row?.retainedBy && (row.retainedBy.mainView || 0) > 0);
    if (main?.id) return main.id;
    return typeof snapshot?.current === "string" ? snapshot.current : void 0;
  } catch {
    return void 0;
  }
}
function makeServices(ctx) {
  const getCurrentSession = () => {
    const sessions = service(ctx, "sessions") || ctx.sessions;
    const id = currentSessionId(sessions);
    if (!id || typeof sessions?.binding !== "function") return void 0;
    try {
      return sessions.binding(id)?.session;
    } catch {
      return void 0;
    }
  };
  const openConversation = () => {
    const layout = service(ctx, "layout") || ctx.layout;
    if (typeof layout?.selectPanel !== "function") throw new Error("\u5F53\u524D DSH \u4E0D\u652F\u6301\u5207\u6362\u5230\u5BF9\u8BDD\u9762\u677F\u3002");
    layout.selectPanel(null);
  };
  const openWorkbench = () => {
    const layout = service(ctx, "layout") || ctx.layout;
    layout?.selectPanel?.(PANEL_ID);
  };
  const openMemberSession = (member) => {
    const workspace = service(ctx, "uiWorkspace");
    if (typeof workspace?.openSession !== "function") throw new Error("\u5F53\u524D DSH \u4E0D\u652F\u6301\u6253\u5F00\u6210\u5458\u4F1A\u8BDD\u3002");
    if (!member?.childId) throw new Error("\u8BE5\u6210\u5458\u6CA1\u6709\u8BB0\u5F55\u53EF\u6253\u5F00\u7684\u4F1A\u8BDD\u3002");
    const sessions = service(ctx, "sessions") || ctx.sessions;
    const parentSessionId = member.parentSessionId || currentSessionId(sessions);
    if (!parentSessionId) throw new Error("\u65E0\u6CD5\u786E\u5B9A\u6210\u5458\u4F1A\u8BDD\u6240\u5C5E\u7684\u9879\u76EE\u4F1A\u8BDD\u3002");
    workspace.openSession({ parentSessionId, childSessionId: member.childId, mode: "continuable" });
  };
  const memberOpenAvailable = (view) => {
    const workspace = service(ctx, "uiWorkspace");
    const sessions = service(ctx, "sessions") || ctx.sessions;
    return typeof workspace?.openSession === "function" && Boolean(currentSessionId(sessions) || view?.team?.members?.some((member) => member.parentSessionId && member.childId));
  };
  return { getCurrentSession, openConversation, openWorkbench, openMemberSession, memberOpenAvailable };
}
function WorkbenchIcon({ size = 22, active = false }) {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.7", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", "data-active": active || void 0, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("path", { d: "M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z" }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("path", { d: "M8 8h8M8 12h5M8 16h3" })
  ] });
}
function apply(ctx) {
  let mount;
  try {
    mount = window.__DSH_SCIENCE_CLIENT_MOUNT__ || null;
    if (!mount) window.__DSH_SCIENCE_CLIENT_MOUNT__ = mount = { main: false, panelIcon: false, quick: false, tab: false };
  } catch {
    mount = { main: false, panelIcon: false, quick: false, tab: false };
  }
  const services = makeServices(ctx);
  ctx.effect(() => registerGuardedPart(mount, "main", () => ctx.slots.inject("main", () => ctx.slots.register({
    name: "main",
    key: PANEL_ID,
    inject: () => ({ services })
  }, ResearchWorkbench))), "dsh-science main workbench");
  ctx.effect(() => registerGuardedPart(mount, "panelIcon", () => ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
    name: "sidebar.panellist",
    id: PANEL_ID,
    order: 40,
    label: () => "\u79D1\u7814\u5DE5\u4F5C\u53F0"
  }, WorkbenchIcon))), "dsh-science global panel entry");
  const tabs = service(ctx, "sidebarRightTabs") || ctx.sidebarRightTabs;
  if (tabs && typeof tabs.register === "function") {
    ctx.effect(() => registerGuardedPart(mount, "tab", () => tabs.register({
      id: PANEL_ID,
      kind: "workbench",
      title: () => "\u79D1\u7814\u5DE5\u4F5C\u53F0",
      guide: [{ id: "workbench", order: 10, title: () => "\u79D1\u7814\u5DE5\u4F5C\u53F0", description: () => "\u663E\u793A\u7814\u7A76\u9636\u6BB5\u3001\u4E0B\u4E00\u6B65\u5EFA\u8BAE\u548C\u56E2\u961F\u8FD0\u884C\u72B6\u6001\u3002\u6253\u5F00\u5B8C\u6574\u5DE5\u4F5C\u53F0\u53EF\u67E5\u770B\u8BBA\u6587\u4E3B\u7EBF\u3001\u56E2\u961F\u8FDB\u5C55\u3001\u56FE\u8868\u6210\u679C\u4E0E\u4E13\u5BB6\u914D\u7F6E\u3002" }]
    })), "dsh-science right-rail tab");
    ctx.effect(() => registerGuardedPart(mount, "quick", () => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
      name: "sidebar.right.pane.tab",
      key: PANEL_ID,
      inject: () => ({ services })
    }, QuickWorkbench))), "dsh-science right-rail companion");
  }
}
return module.exports; } });
