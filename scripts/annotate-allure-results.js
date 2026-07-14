#!/usr/bin/env node
/**
 * Post-processes allure-results/*-result.json after a test run:
 *
 * - Adds `epic`/`layer` labels ("API Tests"/"UI Tests") derived from the spec's
 *   file path, and a `feature` label derived from the spec filename, for any
 *   result that doesn't already carry one (SecurityReporter sets its own
 *   epic/feature/severity/tag for OWASP-tagged checks — this only fills the gap
 *   for everything else) so the Allure "Behaviors" graph splits API vs UI.
 * - Rewrites the declared type of any attachment Allure's viewer can't render
 *   inline (notably `text/markdown` — e.g. Playwright's own auto-attached
 *   `error-context` files) to `text/plain`, which Allure *does* render inline,
 *   so nothing in the report requires a download click to read.
 * - Writes categories.json (Security Findings / Environment issues bucketed
 *   ahead of Allure's default Product/Test defects) and environment.properties.
 *
 * Run via `npm run allure:generate` (this runs first, then `allure generate`).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(__dirname, '..', 'allure-results');

function titleCase(slug) {
  return slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function hasLabel(labels, name) {
  return labels.some((l) => l.name === name);
}

// MIME types Allure2's built-in attachment viewer doesn't recognize, so it falls
// back to a download-only link. Rewriting to `text/plain` keeps the content
// readable inline (Allure has no inline Markdown renderer to fall back to).
const INLINE_TEXT_FALLBACK = new Set(['text/markdown', 'text/x-markdown']);

function rewriteAttachmentTypes(node) {
  if (Array.isArray(node)) {
    let changed = false;
    for (const item of node) changed = rewriteAttachmentTypes(item) || changed;
    return changed;
  }
  if (!node || typeof node !== 'object') return false;

  let changed = false;
  if (Array.isArray(node.attachments)) {
    for (const attachment of node.attachments) {
      if (INLINE_TEXT_FALLBACK.has(attachment.type)) {
        attachment.type = 'text/plain';
        changed = true;
      }
    }
  }
  for (const value of Object.values(node)) {
    changed = rewriteAttachmentTypes(value) || changed;
  }
  return changed;
}

// package label looks like "ui_api_bank.api.login.spec.ts" or "ui_api_bank.ui.specs.login.spec.ts"
function deriveEpicFeatureLayer(packageValue) {
  const parts = packageValue.split('.');
  const layer = parts.includes('api') ? 'api' : parts.includes('ui') ? 'ui' : null;
  const specIdx = parts.lastIndexOf('spec');
  const nameSegment = specIdx > 0 ? parts[specIdx - 1] : parts[parts.length - 2];

  return {
    epic: layer === 'api' ? 'API Tests' : layer === 'ui' ? 'UI Tests' : null,
    feature: nameSegment ? titleCase(nameSegment) : null,
    layer,
  };
}

function annotateResultFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let changed = rewriteAttachmentTypes(data);

  const packageLabel = Array.isArray(data.labels) ? data.labels.find((l) => l.name === 'package') : null;
  if (packageLabel) {
    const { epic, feature, layer } = deriveEpicFeatureLayer(packageLabel.value);

    if (epic && !hasLabel(data.labels, 'epic')) {
      data.labels.push({ name: 'epic', value: epic });
      changed = true;
    }
    if (feature && !hasLabel(data.labels, 'feature')) {
      data.labels.push({ name: 'feature', value: feature });
      changed = true;
    }
    if (layer && !hasLabel(data.labels, 'layer')) {
      data.labels.push({ name: 'layer', value: layer });
      changed = true;
    }
  }

  if (changed) fs.writeFileSync(filePath, JSON.stringify(data));
  return changed;
}

function writeCategories() {
  const categories = [
    {
      name: 'Security Findings',
      matchedStatuses: ['failed', 'broken'],
      messageRegex: '.*(Recommended fixes:|OWASP|vulnerability|SecurityReporter).*',
    },
    {
      name: 'Environment / Connectivity Issues',
      matchedStatuses: ['failed', 'broken'],
      messageRegex: '.*(ECONNREFUSED|ENOTFOUND|ETIMEDOUT|Timeout .*exceeded).*',
    },
    { name: 'Ignored Tests', matchedStatuses: ['skipped'] },
    // Fall-through buckets — mirror Allure's own defaults so nothing is left uncategorized.
    { name: 'Product Defects', matchedStatuses: ['failed'] },
    { name: 'Test Defects', matchedStatuses: ['broken'] },
  ];

  fs.writeFileSync(path.join(RESULTS_DIR, 'categories.json'), JSON.stringify(categories, null, 2));
}

function writeEnvironment() {
  const lines = [
    `Base_URL=${process.env.BASE_URL || 'http://localhost:5001'}`,
    `Node_Version=${process.version}`,
    `OS=${process.platform}`,
    `CI=${process.env.CI ? 'true' : 'false'}`,
  ];

  fs.writeFileSync(path.join(RESULTS_DIR, 'environment.properties'), lines.join('\n') + '\n');
}

function main() {
  if (!fs.existsSync(RESULTS_DIR)) {
    console.error(`No allure-results/ directory at ${RESULTS_DIR} — run tests before generating the report.`);
    process.exit(1);
  }

  const resultFiles = fs
    .readdirSync(RESULTS_DIR)
    .filter((f) => f.endsWith('-result.json') || f.endsWith('-container.json'));
  const annotated = resultFiles.filter((f) => annotateResultFile(path.join(RESULTS_DIR, f))).length;

  writeCategories();
  writeEnvironment();

  console.log(
    `Annotated ${annotated}/${resultFiles.length} Allure result(s) with epic/feature/layer labels; wrote categories.json and environment.properties.`
  );
}

main();
