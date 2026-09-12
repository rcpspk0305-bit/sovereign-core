const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');

// Exercise the real component handlers with controlled hooks and API responses.
function launcher(runFlightMission) {
  const slots = [];
  let cursor = 0;
  const hook = (initial) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = initial;
    return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
  };
  const react = { ...React, useState: hook, useRef: (value) => hook({ current: value })[0], useEffect() {} };
  const filename = path.resolve(__dirname, '../src/components/chat/AgentChatLauncher.tsx');
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2021 },
  }).outputText;
  const mod = new Module(filename, module);
  mod.require = (name) => {
    if (name === 'react') return react;
    if (name === '@/lib/api-client') return { api: { runFlightMission }, normalizeError: (error) => ({ message: error.message }) };
    if (name === '@/lib/session-store') return { sessionStore: { setActiveBay() {} } };
    return new Proxy({ __esModule: true, default: () => null }, { get: (obj, key) => obj[key] || (() => null) });
  };
  mod._compile(compiled, filename);
  const render = () => { cursor = 0; return mod.exports.default({ onBackToLanding() {} }); };
  function nodes(tree) {
    if (!tree || typeof tree !== 'object') return [];
    return [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)];
  }
  const find = (label) => nodes(render()).find((node) => node.props?.['aria-label'] === label);
  const text = () => JSON.stringify(render());
  find('Mission prompt input').props.onChange({ target: { value: 'Multiply 17 by 23 using calculator.' } });
  return { find, text };
}

test('API failure remains a failure without fabricated output', async () => {
  const view = launcher(async () => { throw new Error('Backend unavailable'); });
  await view.find('Dispatch mission').props.onClick();
  assert.match(view.text(), /MISSION FAILED/);
  assert.match(view.text(), /Backend unavailable/);
  assert.doesNotMatch(view.text(), /SHA-256 VERIFIED|100% Deterministic|0.00% EGRESS/);
  assert.equal(view.find('Inspect in Flight Recorder').props.disabled, true);
});

test('recorded execution finishes and enables inspection without claiming verification', async () => {
  let calls = 0;
  const view = launcher(async (...args) => {
    calls++;
    assert.equal(args[2], 'NO_EGRESS');
    return { task_id: 'mission-test', model: 'local', status: 'completed', final_response: '391', tools_called: [{}], retrieved_sources: [], errors: [] };
  });
  const launch = view.find('Dispatch mission').props.onClick;
  await Promise.all([launch(), launch()]);
  assert.equal(calls, 1);
  assert.match(view.text(), /EXECUTION FINISHED/);
  assert.match(view.text(), /391/);
  assert.match(view.text(), /mission-test/);
  assert.match(view.text(), /EGRESS UNMEASURED/);
  assert.equal(view.find('Inspect in Flight Recorder').props.disabled, false);
});

test('HTTP-success response with failed record is displayed as failed', async () => {
  const view = launcher(async () => ({ task_id: 'failed-test', status: 'failed', tools_called: [], retrieved_sources: [], errors: [{ error_message: 'Tool rejected' }] }));
  await view.find('Dispatch mission').props.onClick();
  assert.match(view.text(), /MISSION FAILED/);
  assert.match(view.text(), /Tool rejected/);
  assert.equal(view.find('Inspect in Flight Recorder').props.disabled, false);
});
