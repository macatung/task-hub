/**
 * typeScriptAstResolver.ts
 *
 * Tier 1 Deterministic 3-Way TypeScript / JavaScript AST Merge Resolver.
 * Uses the native TypeScript compiler API to parse and reconcile:
 * 1. Module Imports (merges named specifiers, default imports, namespaces from identical or disjoint modules)
 * 2. Type/Interface Declarations (merges interface property additions and type aliases)
 * 3. Exports (merges barrel exports and named export clauses)
 * 4. Top-level Declarations (merges independent function, class, and variable statements)
 * 5. Validates syntax diagnostics on merged output.
 */

import ts from 'typescript';

export interface AstConflictNode {
  identifier: string;
  kind: string;
  baseCode?: string;
  oursCode?: string;
  theirsCode?: string;
  startLine?: number;
  endLine?: number;
  reason: string;
}

export interface TypeScriptMergeResult {
  success: boolean;
  mergedCode?: string;
  conflicts: AstConflictNode[];
  syntaxValid: boolean;
  syntaxErrors?: string[];
}

interface ParsedImportSpecifier {
  name: string;
  propertyName?: string; // e.g. for "foo as bar", propertyName is "foo", name is "bar"
  isTypeOnly?: boolean;
}

interface ParsedImport {
  moduleSpecifier: string;
  defaultImport?: string;
  namespaceImport?: string;
  namedImports: Map<string, ParsedImportSpecifier>;
  isTypeOnly: boolean;
  isSideEffect: boolean;
  rawText: string;
}

interface ParsedExport {
  moduleSpecifier?: string;
  isBarrel: boolean; // export * from '...'
  barrelAlias?: string; // export * as ns from '...'
  namedExports: Map<string, { name: string; propertyName?: string; isTypeOnly?: boolean }>;
  isDefault: boolean;
  rawText: string;
}

/**
 * Helper to get clean trimmed node text.
 */
function getNodeText(node: ts.Node, sourceFile: ts.SourceFile): string {
  return node.getText(sourceFile).trim();
}

/**
 * Parse import declarations from a SourceFile into structured records.
 */
function parseImports(sourceFile: ts.SourceFile): Map<string, ParsedImport[]> {
  const importsByModule = new Map<string, ParsedImport[]>();

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const moduleSpecifier = (statement.moduleSpecifier as ts.StringLiteral).text;
      const rawText = getNodeText(statement, sourceFile);
      const isTypeOnly = statement.importClause?.isTypeOnly ?? false;

      const parsed: ParsedImport = {
        moduleSpecifier,
        namedImports: new Map(),
        isTypeOnly,
        isSideEffect: !statement.importClause,
        rawText,
      };

      if (statement.importClause) {
        if (statement.importClause.name) {
          parsed.defaultImport = statement.importClause.name.text;
        }
        if (statement.importClause.namedBindings) {
          if (ts.isNamespaceImport(statement.importClause.namedBindings)) {
            parsed.namespaceImport = statement.importClause.namedBindings.name.text;
          } else if (ts.isNamedImports(statement.importClause.namedBindings)) {
            for (const elem of statement.importClause.namedBindings.elements) {
              const name = elem.name.text;
              const propertyName = elem.propertyName ? elem.propertyName.text : undefined;
              const isType = elem.isTypeOnly || isTypeOnly;
              parsed.namedImports.set(propertyName || name, {
                name,
                propertyName,
                isTypeOnly: isType,
              });
            }
          }
        }
      }

      if (!importsByModule.has(moduleSpecifier)) {
        importsByModule.set(moduleSpecifier, []);
      }
      importsByModule.get(moduleSpecifier)!.push(parsed);
    }
  }

  return importsByModule;
}

/**
 * 3-Way merge of import declarations grouped by module specifier.
 */
function mergeImports3Way(
  baseImports: Map<string, ParsedImport[]>,
  oursImports: Map<string, ParsedImport[]>,
  theirsImports: Map<string, ParsedImport[]>,
  conflicts: AstConflictNode[]
): string[] {
  const allModules = new Set([
    ...baseImports.keys(),
    ...oursImports.keys(),
    ...theirsImports.keys(),
  ]);

  const mergedImportStatements: string[] = [];

  for (const moduleSpec of allModules) {
    const baseList = baseImports.get(moduleSpec) || [];
    const oursList = oursImports.get(moduleSpec) || [];
    const theirsList = theirsImports.get(moduleSpec) || [];

    // If completely absent in ours and theirs (deleted in both or never existed)
    if (oursList.length === 0 && theirsList.length === 0) {
      continue;
    }

    // If added in ours only
    if (baseList.length === 0 && theirsList.length === 0) {
      for (const imp of oursList) mergedImportStatements.push(imp.rawText);
      continue;
    }

    // If added in theirs only
    if (baseList.length === 0 && oursList.length === 0) {
      for (const imp of theirsList) mergedImportStatements.push(imp.rawText);
      continue;
    }

    // If deleted in ours and unmodified in theirs
    if (oursList.length === 0 && baseList.length > 0 && theirsList.length > 0) {
      const theirsUnchanged = theirsList.length === baseList.length &&
        theirsList.every((t, i) => t.rawText === baseList[i]?.rawText);
      if (theirsUnchanged) {
        // Deleted cleanly
        continue;
      }
    }

    // If deleted in theirs and unmodified in ours
    if (theirsList.length === 0 && baseList.length > 0 && oursList.length > 0) {
      const oursUnchanged = oursList.length === baseList.length &&
        oursList.every((o, i) => o.rawText === baseList[i]?.rawText);
      if (oursUnchanged) {
        // Deleted cleanly
        continue;
      }
    }

    // If both exist or were modified/added in both: consolidate and merge specifiers
    const baseFirst = baseList[0];
    const oursFirst = oursList[0];
    const theirsFirst = theirsList[0];

    // Check side-effect imports
    if (oursFirst?.isSideEffect || theirsFirst?.isSideEffect) {
      if (oursFirst?.isSideEffect) mergedImportStatements.push(oursFirst.rawText);
      if (theirsFirst?.isSideEffect && theirsFirst.rawText !== oursFirst?.rawText) {
        mergedImportStatements.push(theirsFirst.rawText);
      }
      continue;
    }

    // Merge default imports
    let mergedDefault: string | undefined;
    const baseDefault = baseFirst?.defaultImport;
    const oursDefault = oursFirst?.defaultImport;
    const theirsDefault = theirsFirst?.defaultImport;

    if (oursDefault === theirsDefault) {
      mergedDefault = oursDefault;
    } else if (oursDefault && !theirsDefault) {
      if (baseDefault === theirsDefault) {
        mergedDefault = oursDefault;
      } else {
        mergedDefault = oursDefault;
      }
    } else if (!oursDefault && theirsDefault) {
      if (baseDefault === oursDefault) {
        mergedDefault = theirsDefault;
      } else {
        mergedDefault = theirsDefault;
      }
    } else if (oursDefault && theirsDefault) {
      if (oursDefault === baseDefault) {
        mergedDefault = theirsDefault;
      } else if (theirsDefault === baseDefault) {
        mergedDefault = oursDefault;
      } else {
        conflicts.push({
          identifier: `import-default:${moduleSpec}`,
          kind: 'ImportDeclaration',
          baseCode: baseDefault,
          oursCode: oursDefault,
          theirsCode: theirsDefault,
          reason: `Conflicting default imports for module '${moduleSpec}': '${oursDefault}' vs '${theirsDefault}'`,
        });
        mergedDefault = oursDefault;
      }
    }

    // Merge namespace imports (* as ns)
    let mergedNamespace: string | undefined;
    const baseNamespace = baseFirst?.namespaceImport;
    const oursNamespace = oursFirst?.namespaceImport;
    const theirsNamespace = theirsFirst?.namespaceImport;

    if (oursNamespace === theirsNamespace) {
      mergedNamespace = oursNamespace;
    } else if (oursNamespace && !theirsNamespace) {
      mergedNamespace = oursNamespace;
    } else if (!oursNamespace && theirsNamespace) {
      mergedNamespace = theirsNamespace;
    } else if (oursNamespace && theirsNamespace) {
      conflicts.push({
        identifier: `import-namespace:${moduleSpec}`,
        kind: 'ImportDeclaration',
        baseCode: baseNamespace,
        oursCode: oursNamespace,
        theirsCode: theirsNamespace,
        reason: `Conflicting namespace imports for module '${moduleSpec}': '* as ${oursNamespace}' vs '* as ${theirsNamespace}'`,
      });
      mergedNamespace = oursNamespace;
    }

    // Merge named imports
    const allNamedKeys = new Set<string>();
    for (const imp of baseList) for (const k of imp.namedImports.keys()) allNamedKeys.add(k);
    for (const imp of oursList) for (const k of imp.namedImports.keys()) allNamedKeys.add(k);
    for (const imp of theirsList) for (const k of imp.namedImports.keys()) allNamedKeys.add(k);

    const mergedNamedMap = new Map<string, ParsedImportSpecifier>();

    for (const key of allNamedKeys) {
      const inBase = baseList.find((i) => i.namedImports.has(key))?.namedImports.get(key);
      const inOurs = oursList.find((i) => i.namedImports.has(key))?.namedImports.get(key);
      const inTheirs = theirsList.find((i) => i.namedImports.has(key))?.namedImports.get(key);

      if (inOurs && !inTheirs) {
        if (!inBase) {
          // Added in ours
          mergedNamedMap.set(key, inOurs);
        } else {
          // Deleted in theirs
        }
      } else if (!inOurs && inTheirs) {
        if (!inBase) {
          // Added in theirs
          mergedNamedMap.set(key, inTheirs);
        } else {
          // Deleted in ours
        }
      } else if (inOurs && inTheirs) {
        // In both
        if (inOurs.name === inTheirs.name) {
          mergedNamedMap.set(key, {
            name: inOurs.name,
            propertyName: inOurs.propertyName,
            isTypeOnly: inOurs.isTypeOnly && inTheirs.isTypeOnly,
          });
        } else {
          // Conflicting alias
          conflicts.push({
            identifier: `import-specifier:${moduleSpec}:${key}`,
            kind: 'ImportDeclaration',
            baseCode: inBase?.name,
            oursCode: inOurs.name,
            theirsCode: inTheirs.name,
            reason: `Conflicting alias for '${key}' from '${moduleSpec}': '${inOurs.name}' vs '${inTheirs.name}'`,
          });
          mergedNamedMap.set(key, inOurs);
        }
      }
    }

    // Reconstruct import statement
    const isAllTypeOnly =
      (oursFirst?.isTypeOnly ?? false) &&
      (theirsFirst?.isTypeOnly ?? false) &&
      Array.from(mergedNamedMap.values()).every((s) => s.isTypeOnly);

    const parts: string[] = [];
    if (mergedDefault) {
      parts.push(mergedDefault);
    }
    if (mergedNamespace) {
      parts.push(`* as ${mergedNamespace}`);
    }
    if (mergedNamedMap.size > 0) {
      const namedStrings = Array.from(mergedNamedMap.values()).map((s) => {
        const prefix = !isAllTypeOnly && s.isTypeOnly ? 'type ' : '';
        return s.propertyName ? `${prefix}${s.propertyName} as ${s.name}` : `${prefix}${s.name}`;
      });
      parts.push(`{ ${namedStrings.join(', ')} }`);
    }

    if (parts.length > 0) {
      const typePrefix = isAllTypeOnly ? 'type ' : '';
      mergedImportStatements.push(`import ${typePrefix}${parts.join(', ')} from '${moduleSpec}';`);
    }
  }

  return mergedImportStatements;
}

/**
 * 3-Way merge for Interface Declarations.
 */
function mergeInterfaceDeclaration(
  baseNode: ts.InterfaceDeclaration | undefined,
  oursNode: ts.InterfaceDeclaration,
  theirsNode: ts.InterfaceDeclaration | undefined,
  sourceFileOurs: ts.SourceFile,
  sourceFileTheirs: ts.SourceFile | undefined,
  sourceFileBase: ts.SourceFile | undefined,
  conflicts: AstConflictNode[]
): string {
  const interfaceName = oursNode.name.text;
  if (!theirsNode) {
    return getNodeText(oursNode, sourceFileOurs);
  }

  // Collect members
  const getMemberKey = (member: ts.TypeElement, sf: ts.SourceFile) => {
    if (member.name) return member.name.getText(sf).trim();
    return member.getText(sf).trim();
  };

  const baseMembers = new Map<string, string>();
  if (baseNode && sourceFileBase) {
    for (const m of baseNode.members) {
      baseMembers.set(getMemberKey(m, sourceFileBase), getNodeText(m, sourceFileBase));
    }
  }

  const oursMembers = new Map<string, string>();
  for (const m of oursNode.members) {
    oursMembers.set(getMemberKey(m, sourceFileOurs), getNodeText(m, sourceFileOurs));
  }

  const theirsMembers = new Map<string, string>();
  for (const m of theirsNode.members) {
    theirsMembers.set(getMemberKey(m, sourceFileTheirs!), getNodeText(m, sourceFileTheirs!));
  }

  const allMemberKeys = new Set([...baseMembers.keys(), ...oursMembers.keys(), ...theirsMembers.keys()]);
  const mergedMembers: string[] = [];

  for (const key of allMemberKeys) {
    const inBase = baseMembers.get(key);
    const inOurs = oursMembers.get(key);
    const inTheirs = theirsMembers.get(key);

    if (inOurs && !inTheirs) {
      if (!inBase) {
        mergedMembers.push(inOurs);
      }
    } else if (!inOurs && inTheirs) {
      if (!inBase) {
        mergedMembers.push(inTheirs);
      }
    } else if (inOurs && inTheirs) {
      if (inOurs === inTheirs) {
        mergedMembers.push(inOurs);
      } else if (inOurs === inBase) {
        mergedMembers.push(inTheirs);
      } else if (inTheirs === inBase) {
        mergedMembers.push(inOurs);
      } else {
        conflicts.push({
          identifier: `${interfaceName}.${key}`,
          kind: 'InterfaceMember',
          baseCode: inBase,
          oursCode: inOurs,
          theirsCode: inTheirs,
          reason: `Conflicting member definition for '${key}' in interface '${interfaceName}'`,
        });
        mergedMembers.push(inOurs);
      }
    }
  }

  // Merge heritage clauses (extends Foo, Bar)
  const heritageTypes = new Set<string>();
  if (oursNode.heritageClauses) {
    for (const clause of oursNode.heritageClauses) {
      for (const type of clause.types) {
        heritageTypes.add(getNodeText(type, sourceFileOurs));
      }
    }
  }
  if (theirsNode.heritageClauses && sourceFileTheirs) {
    for (const clause of theirsNode.heritageClauses) {
      for (const type of clause.types) {
        heritageTypes.add(getNodeText(type, sourceFileTheirs));
      }
    }
  }

  const extendsClause = heritageTypes.size > 0 ? ` extends ${Array.from(heritageTypes).join(', ')}` : '';
  const exportPrefix = oursNode.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ? 'export ' : '';

  const body = mergedMembers.map((m) => `  ${m.endsWith(';') ? m : m + ';'}`).join('\n');
  return `${exportPrefix}interface ${interfaceName}${extendsClause} {\n${body}\n}`;
}

/**
 * 3-Way merge for Barrel and Named Export declarations.
 */
function mergeExports3Way(
  baseExports: ParsedExport[],
  oursExports: ParsedExport[],
  theirsExports: ParsedExport[],
  conflicts: AstConflictNode[]
): string[] {
  const mergedExports: string[] = [];
  const handledExportTexts = new Set<string>();

  // Collect barrel exports
  const barrelMap = new Map<string, { ours?: ParsedExport; theirs?: ParsedExport; base?: ParsedExport }>();

  for (const exp of baseExports.filter((e) => e.isBarrel && e.moduleSpecifier)) {
    barrelMap.set(exp.moduleSpecifier!, { base: exp });
  }
  for (const exp of oursExports.filter((e) => e.isBarrel && e.moduleSpecifier)) {
    const entry = barrelMap.get(exp.moduleSpecifier!) || {};
    entry.ours = exp;
    barrelMap.set(exp.moduleSpecifier!, entry);
  }
  for (const exp of theirsExports.filter((e) => e.isBarrel && e.moduleSpecifier)) {
    const entry = barrelMap.get(exp.moduleSpecifier!) || {};
    entry.theirs = exp;
    barrelMap.set(exp.moduleSpecifier!, entry);
  }

  for (const [spec, entry] of barrelMap) {
    if (entry.ours && !entry.theirs && !entry.base) {
      mergedExports.push(entry.ours.rawText);
      handledExportTexts.add(entry.ours.rawText);
    } else if (entry.theirs && !entry.ours && !entry.base) {
      mergedExports.push(entry.theirs.rawText);
      handledExportTexts.add(entry.theirs.rawText);
    } else if (entry.ours && entry.theirs) {
      mergedExports.push(entry.ours.rawText);
      handledExportTexts.add(entry.ours.rawText);
      handledExportTexts.add(entry.theirs.rawText);
    }
  }

  // Merge remaining export statements
  for (const exp of oursExports) {
    if (!handledExportTexts.has(exp.rawText)) {
      mergedExports.push(exp.rawText);
      handledExportTexts.add(exp.rawText);
    }
  }
  for (const exp of theirsExports) {
    if (!handledExportTexts.has(exp.rawText)) {
      mergedExports.push(exp.rawText);
      handledExportTexts.add(exp.rawText);
    }
  }

  return mergedExports;
}

/**
 * Get an identifier key for top-level statements.
 */
function getStatementIdentifier(statement: ts.Statement, sf: ts.SourceFile): { id: string; kind: string; name?: string } {
  if (ts.isFunctionDeclaration(statement) && statement.name) {
    return { id: `fn:${statement.name.text}`, kind: 'FunctionDeclaration', name: statement.name.text };
  }
  if (ts.isClassDeclaration(statement) && statement.name) {
    return { id: `class:${statement.name.text}`, kind: 'ClassDeclaration', name: statement.name.text };
  }
  if (ts.isInterfaceDeclaration(statement)) {
    return { id: `interface:${statement.name.text}`, kind: 'InterfaceDeclaration', name: statement.name.text };
  }
  if (ts.isTypeAliasDeclaration(statement)) {
    return { id: `type:${statement.name.text}`, kind: 'TypeAliasDeclaration', name: statement.name.text };
  }
  if (ts.isEnumDeclaration(statement)) {
    return { id: `enum:${statement.name.text}`, kind: 'EnumDeclaration', name: statement.name.text };
  }
  if (ts.isVariableStatement(statement)) {
    const names = statement.declarationList.declarations
      .map((d) => d.name.getText(sf))
      .join(',');
    return { id: `var:${names}`, kind: 'VariableStatement', name: names };
  }
  if (ts.isImportDeclaration(statement)) {
    const mod = (statement.moduleSpecifier as ts.StringLiteral).text;
    return { id: `import:${mod}`, kind: 'ImportDeclaration' };
  }
  if (ts.isExportDeclaration(statement) || ts.isExportAssignment(statement)) {
    return { id: `export:${statement.getText(sf).trim()}`, kind: 'ExportDeclaration' };
  }

  // Fallback statement ID based on normalized text hash/prefix
  const text = statement.getText(sf).trim();
  return { id: `stmt:${text.slice(0, 40)}`, kind: 'Statement' };
}

/**
 * Parse export declarations into structured records.
 */
function parseExports(sourceFile: ts.SourceFile): ParsedExport[] {
  const exportsList: ParsedExport[] = [];

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      const moduleSpecifier = statement.moduleSpecifier ? (statement.moduleSpecifier as ts.StringLiteral).text : undefined;
      const isBarrel = !statement.exportClause;
      const barrelAlias = statement.exportClause && ts.isNamespaceExport(statement.exportClause)
        ? statement.exportClause.name.text
        : undefined;

      const namedExports = new Map<string, { name: string; propertyName?: string; isTypeOnly?: boolean }>();
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const elem of statement.exportClause.elements) {
          namedExports.set(elem.name.text, {
            name: elem.name.text,
            propertyName: elem.propertyName?.text,
            isTypeOnly: elem.isTypeOnly || statement.isTypeOnly,
          });
        }
      }

      exportsList.push({
        moduleSpecifier,
        isBarrel,
        barrelAlias,
        namedExports,
        isDefault: false,
        rawText: getNodeText(statement, sourceFile),
      });
    } else if (ts.isExportAssignment(statement)) {
      exportsList.push({
        isBarrel: false,
        namedExports: new Map(),
        isDefault: true,
        rawText: getNodeText(statement, sourceFile),
      });
    }
  }

  return exportsList;
}

/**
 * Perform a 3-way AST merge on TypeScript / JavaScript source strings.
 */
export function mergeTypeScript3Way(
  baseSource: string = '',
  oursSource: string,
  theirsSource: string,
  fileName: string = 'file.ts'
): TypeScriptMergeResult {
  const conflicts: AstConflictNode[] = [];

  // Parse source files
  const sfBase = baseSource
    ? ts.createSourceFile(fileName, baseSource, ts.ScriptTarget.Latest, true, fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    : undefined;
  const sfOurs = ts.createSourceFile(fileName, oursSource, ts.ScriptTarget.Latest, true, fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const sfTheirs = ts.createSourceFile(fileName, theirsSource, ts.ScriptTarget.Latest, true, fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  // 1. Process and merge Imports
  const baseImports = sfBase ? parseImports(sfBase) : new Map<string, ParsedImport[]>();
  const oursImports = parseImports(sfOurs);
  const theirsImports = parseImports(sfTheirs);

  const mergedImportLines = mergeImports3Way(baseImports, oursImports, theirsImports, conflicts);

  // 2. Process and merge Exports
  const baseExports = sfBase ? parseExports(sfBase) : [];
  const oursExports = parseExports(sfOurs);
  const theirsExports = parseExports(sfTheirs);

  const mergedExportLines = mergeExports3Way(baseExports, oursExports, theirsExports, conflicts);

  // 3. Process Non-import/export Top-Level Statements
  const filterStatements = (sf: ts.SourceFile | undefined) => {
    if (!sf) return [];
    return sf.statements.filter((s) => !ts.isImportDeclaration(s) && !ts.isExportDeclaration(s) && !ts.isExportAssignment(s));
  };

  const baseStmts = filterStatements(sfBase);
  const oursStmts = filterStatements(sfOurs);
  const theirsStmts = filterStatements(sfTheirs);

  const baseStmtMap = new Map<string, { stmt: ts.Statement; text: string }>();
  if (sfBase) {
    for (const s of baseStmts) {
      const { id } = getStatementIdentifier(s, sfBase);
      baseStmtMap.set(id, { stmt: s, text: getNodeText(s, sfBase) });
    }
  }

  const oursStmtMap = new Map<string, { stmt: ts.Statement; text: string }>();
  for (const s of oursStmts) {
    const { id } = getStatementIdentifier(s, sfOurs);
    oursStmtMap.set(id, { stmt: s, text: getNodeText(s, sfOurs) });
  }

  const theirsStmtMap = new Map<string, { stmt: ts.Statement; text: string }>();
  for (const s of theirsStmts) {
    const { id } = getStatementIdentifier(s, sfTheirs);
    theirsStmtMap.set(id, { stmt: s, text: getNodeText(s, sfTheirs) });
  }

  const allStmtIds = new Set<string>();
  // Preserve order from base, then append new ones from ours and theirs
  if (sfBase) {
    for (const s of baseStmts) allStmtIds.add(getStatementIdentifier(s, sfBase).id);
  }
  for (const s of oursStmts) allStmtIds.add(getStatementIdentifier(s, sfOurs).id);
  for (const s of theirsStmts) allStmtIds.add(getStatementIdentifier(s, sfTheirs).id);

  const mergedBodyStatements: string[] = [];

  for (const id of allStmtIds) {
    const inBase = baseStmtMap.get(id);
    const inOurs = oursStmtMap.get(id);
    const inTheirs = theirsStmtMap.get(id);

    // Added in ours only
    if (inOurs && !inTheirs) {
      if (!inBase) {
        mergedBodyStatements.push(inOurs.text);
      }
      // if existed in base, but deleted in theirs and untouched in ours -> deleted
      continue;
    }

    // Added in theirs only
    if (!inOurs && inTheirs) {
      if (!inBase) {
        mergedBodyStatements.push(inTheirs.text);
      }
      // if existed in base, but deleted in ours and untouched in theirs -> deleted
      continue;
    }

    // Present in both ours and theirs
    if (inOurs && inTheirs) {
      if (inOurs.text === inTheirs.text) {
        mergedBodyStatements.push(inOurs.text);
      } else if (inBase && inOurs.text === inBase.text) {
        // Ours didn't change it, theirs changed it
        mergedBodyStatements.push(inTheirs.text);
      } else if (inBase && inTheirs.text === inBase.text) {
        // Theirs didn't change it, ours changed it
        mergedBodyStatements.push(inOurs.text);
      } else {
        // Both changed it differently!
        // Check if it's an interface that can be member-merged
        if (ts.isInterfaceDeclaration(inOurs.stmt) && ts.isInterfaceDeclaration(inTheirs.stmt)) {
          const mergedIf = mergeInterfaceDeclaration(
            inBase && ts.isInterfaceDeclaration(inBase.stmt) ? inBase.stmt : undefined,
            inOurs.stmt,
            inTheirs.stmt,
            sfOurs,
            sfTheirs,
            sfBase,
            conflicts
          );
          mergedBodyStatements.push(mergedIf);
        } else {
          // AST Node conflict
          const meta = getStatementIdentifier(inOurs.stmt, sfOurs);
          conflicts.push({
            identifier: meta.name || id,
            kind: meta.kind,
            baseCode: inBase?.text,
            oursCode: inOurs.text,
            theirsCode: inTheirs.text,
            reason: `Conflicting implementations for ${meta.kind} '${meta.name || id}'`,
          });
          // Default to ours for baseline code representation
          mergedBodyStatements.push(inOurs.text);
        }
      }
    }
  }

  // Assemble full merged source file text
  const sections: string[] = [];
  if (mergedImportLines.length > 0) {
    sections.push(mergedImportLines.join('\n'));
  }
  if (mergedBodyStatements.length > 0) {
    sections.push(mergedBodyStatements.join('\n\n'));
  }
  if (mergedExportLines.length > 0) {
    sections.push(mergedExportLines.join('\n'));
  }

  const mergedCode = sections.join('\n\n') + '\n';

  // Validate syntax on final merged code
  const testSf = ts.createSourceFile(fileName, mergedCode, ts.ScriptTarget.Latest, true, fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const parseDiagnostics = (testSf as any).parseDiagnostics || [];

  const syntaxErrors = parseDiagnostics.map((d: ts.Diagnostic) => {
    const msg = typeof d.messageText === 'string' ? d.messageText : d.messageText.messageText;
    return `Line ${d.start ? testSf.getLineAndCharacterOfPosition(d.start).line + 1 : 0}: ${msg}`;
  });

  return {
    success: conflicts.length === 0 && syntaxErrors.length === 0,
    mergedCode,
    conflicts,
    syntaxValid: syntaxErrors.length === 0,
    syntaxErrors: syntaxErrors.length > 0 ? syntaxErrors : undefined,
  };
}
