/* global console */
import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const baseline = '9c1b206debf25be97cb16b832daf09e287a32803';
execFileSync('git', ['cat-file', '-e', baseline], { stdio: 'ignore' });
const printer = ts.createPrinter({ removeComments: true });
let verified = 0,
  components = 0;
const calls = (name, source) => {
  const ast = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
    result = new Map();
  const imported = new Set(['fetch']);
  for (const statement of ast.statements) {
    if (ts.isImportDeclaration(statement) && statement.moduleSpecifier.text.startsWith('../api/')) {
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings))
        for (const entry of bindings.elements) if (!entry.isTypeOnly) imported.add(entry.name.text);
    }
  }
  const root = (expression) =>
    ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)
      ? root(expression.expression)
      : ts.isIdentifier(expression)
        ? expression.text
        : '';
  function visit(node) {
    if (ts.isCallExpression(node) && imported.has(root(node.expression))) {
      const contract = printer.printNode(ts.EmitHint.Unspecified, node, ast);
      result.set(contract, (result.get(contract) || 0) + 1);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return result;
};
for (const name of readdirSync('apps/web/src/components').filter(
  (name) => name.endsWith('.tsx') && !name.includes('.test.'),
)) {
  const path = 'apps/web/src/components/' + name;
  let source;
  try {
    source = execFileSync('git', ['show', baseline + ':' + path], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    continue;
  }
  components++;
  const before = calls(name, source),
    after = calls(name, readFileSync(path, 'utf8'));
  for (const [contract, count] of before) {
    if (after.get(contract) !== count)
      throw new Error(name + ': changed API call or payload: ' + contract);
    verified += count;
  }
}
if (components !== 25) throw new Error('Expected all 25 baseline UI components to be present.');
console.log(
  `Verified ${verified} existing API calls and payloads across ${components} components against ${baseline.slice(0, 7)}.`,
);
