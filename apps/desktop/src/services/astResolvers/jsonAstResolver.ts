/**
 * jsonAstResolver.ts
 *
 * Tier 1 Deterministic 3-Way JSON Merge Resolver.
 * Resolves non-conflicting additions, modifications, and deletions in JSON files
 * such as package.json (dependencies, devDependencies, scripts), tsconfig.json,
 * and nested application configurations without formatting corruption.
 */

export interface JsonConflict {
  path: string;
  baseValue: any;
  oursValue: any;
  theirsValue: any;
  reason: string;
}

export interface JsonMergeOptions {
  indent?: number | string;
  arrayMergeStrategy?: 'smart-union' | 'strict';
}

export interface JsonMergeResult {
  success: boolean;
  mergedJson?: string;
  mergedValue?: any;
  conflicts: JsonConflict[];
}

/**
 * Detect the indentation style of a JSON string (default 2 spaces).
 */
export function detectJsonIndent(jsonString: string): number | string {
  const match = jsonString.match(/^[ \t]+(?=")/m);
  if (match) {
    if (match[0].startsWith('\t')) {
      return '\t';
    }
    return match[0].length;
  }
  return 2;
}

/**
 * Deep value equality check for primitives, arrays, and objects.
 */
function isDeepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!isDeepEqual(a[key], b[key])) return false;
  }

  return true;
}

/**
 * 3-Way merge for Array values.
 * Performs a smart-union preserving order and removals from base.
 */
function mergeArrays3Way(
  baseArr: any[] | undefined,
  oursArr: any[],
  theirsArr: any[],
  currentPath: string,
  conflicts: JsonConflict[],
  strategy: 'smart-union' | 'strict'
): any[] {
  const base = Array.isArray(baseArr) ? baseArr : [];

  if (isDeepEqual(oursArr, theirsArr)) {
    return oursArr;
  }
  if (isDeepEqual(oursArr, base)) {
    return theirsArr;
  }
  if (isDeepEqual(theirsArr, base)) {
    return oursArr;
  }

  if (strategy === 'strict') {
    conflicts.push({
      path: currentPath,
      baseValue: base,
      oursValue: oursArr,
      theirsValue: theirsArr,
      reason: 'Conflicting array modifications in strict merge mode',
    });
    return oursArr;
  }

  // Smart union for primitive arrays (e.g. keywords, tsconfig include/exclude)
  const isPrimitiveArray = (arr: any[]) =>
    arr.every((item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean');

  if (isPrimitiveArray(base) && isPrimitiveArray(oursArr) && isPrimitiveArray(theirsArr)) {
    const result: any[] = [];
    const baseSet = new Set(base);
    const oursSet = new Set(oursArr);
    const theirsSet = new Set(theirsArr);

    // Items from base: keep only if neither branch deleted it
    for (const item of base) {
      const deletedInOurs = !oursSet.has(item);
      const deletedInTheirs = !theirsSet.has(item);

      if (deletedInOurs && deletedInTheirs) {
        // deleted in both
        continue;
      } else if (deletedInOurs && theirsSet.has(item)) {
        // deleted in ours, untouched in theirs -> delete
        continue;
      } else if (deletedInTheirs && oursSet.has(item)) {
        // deleted in theirs, untouched in ours -> delete
        continue;
      } else {
        if (!result.includes(item)) {
          result.push(item);
        }
      }
    }

    // Items added in ours
    for (const item of oursArr) {
      if (!baseSet.has(item) && !result.includes(item)) {
        result.push(item);
      }
    }

    // Items added in theirs
    for (const item of theirsArr) {
      if (!baseSet.has(item) && !result.includes(item)) {
        result.push(item);
      }
    }

    return result;
  }

  // Complex array - if items have distinct identity (e.g. { name: '...' } or { id: '...' })
  const result: any[] = [];
  const handledTheirsIndices = new Set<number>();

  for (const oursItem of oursArr) {
    const matchingTheirsIndex = theirsArr.findIndex((t, idx) => !handledTheirsIndices.has(idx) && isDeepEqual(oursItem, t));
    if (matchingTheirsIndex !== -1) {
      handledTheirsIndices.add(matchingTheirsIndex);
      result.push(oursItem);
    } else {
      result.push(oursItem);
    }
  }

  for (let idx = 0; idx < theirsArr.length; idx++) {
    if (!handledTheirsIndices.has(idx)) {
      result.push(theirsArr[idx]);
    }
  }

  return result;
}

/**
 * Recursive 3-way object tree merger.
 */
function mergeValues3Way(
  base: any,
  ours: any,
  theirs: any,
  currentPath: string,
  conflicts: JsonConflict[],
  strategy: 'smart-union' | 'strict'
): any {
  // If identical values
  if (isDeepEqual(ours, theirs)) {
    return ours;
  }

  // If ours is untouched relative to base
  if (isDeepEqual(ours, base)) {
    return theirs;
  }

  // If theirs is untouched relative to base
  if (isDeepEqual(theirs, base)) {
    return ours;
  }

  // If both are objects (and not arrays/null)
  if (
    typeof ours === 'object' &&
    ours !== null &&
    !Array.isArray(ours) &&
    typeof theirs === 'object' &&
    theirs !== null &&
    !Array.isArray(theirs)
  ) {
    const baseObj = typeof base === 'object' && base !== null && !Array.isArray(base) ? base : {};
    const resultObj: Record<string, any> = {};

    // Collect all keys across base, ours, and theirs
    const allKeys = new Set([...Object.keys(baseObj), ...Object.keys(ours), ...Object.keys(theirs)]);

    for (const key of allKeys) {
      const propPath = currentPath ? `${currentPath}.${key}` : key;
      const inBase = Object.prototype.hasOwnProperty.call(baseObj, key);
      const inOurs = Object.prototype.hasOwnProperty.call(ours, key);
      const inTheirs = Object.prototype.hasOwnProperty.call(theirs, key);

      if (inOurs && !inTheirs) {
        if (!inBase) {
          // Added in ours only -> keep
          resultObj[key] = ours[key];
        } else {
          // Deleted in theirs
          if (isDeepEqual(ours[key], baseObj[key])) {
            // Unchanged in ours, deleted in theirs -> delete
            continue;
          } else {
            // Modified in ours, deleted in theirs -> Conflict!
            conflicts.push({
              path: propPath,
              baseValue: baseObj[key],
              oursValue: ours[key],
              theirsValue: undefined,
              reason: 'Modified in ours but deleted in theirs',
            });
            resultObj[key] = ours[key];
          }
        }
      } else if (!inOurs && inTheirs) {
        if (!inBase) {
          // Added in theirs only -> keep
          resultObj[key] = theirs[key];
        } else {
          // Deleted in ours
          if (isDeepEqual(theirs[key], baseObj[key])) {
            // Unchanged in theirs, deleted in ours -> delete
            continue;
          } else {
            // Modified in theirs, deleted in ours -> Conflict!
            conflicts.push({
              path: propPath,
              baseValue: baseObj[key],
              oursValue: undefined,
              theirsValue: theirs[key],
              reason: 'Modified in theirs but deleted in ours',
            });
            resultObj[key] = theirs[key];
          }
        }
      } else if (inOurs && inTheirs) {
        if (!inBase) {
          // Added in both
          if (isDeepEqual(ours[key], theirs[key])) {
            resultObj[key] = ours[key];
          } else if (typeof ours[key] === 'object' && typeof theirs[key] === 'object' && ours[key] !== null && theirs[key] !== null) {
            resultObj[key] = mergeValues3Way(undefined, ours[key], theirs[key], propPath, conflicts, strategy);
          } else {
            conflicts.push({
              path: propPath,
              baseValue: undefined,
              oursValue: ours[key],
              theirsValue: theirs[key],
              reason: 'Added differently in both branches',
            });
            resultObj[key] = ours[key];
          }
        } else {
          // Existed in base, present in both
          resultObj[key] = mergeValues3Way(baseObj[key], ours[key], theirs[key], propPath, conflicts, strategy);
        }
      }
    }

    return resultObj;
  }

  // If both are arrays
  if (Array.isArray(ours) && Array.isArray(theirs)) {
    return mergeArrays3Way(Array.isArray(base) ? base : undefined, ours, theirs, currentPath, conflicts, strategy);
  }

  // Primitive conflict (or mismatched types)
  conflicts.push({
    path: currentPath,
    baseValue: base,
    oursValue: ours,
    theirsValue: theirs,
    reason: `Incompatible primitive values: base="${base}", ours="${ours}", theirs="${theirs}"`,
  });

  // Default to ours when conflicted
  return ours;
}

/**
 * Perform a 3-way AST merge on JSON content strings or parsed objects.
 */
export function mergeJson3Way(
  baseContent: string | Record<string, any> | undefined | null,
  oursContent: string | Record<string, any>,
  theirsContent: string | Record<string, any>,
  options: JsonMergeOptions = {}
): JsonMergeResult {
  const strategy = options.arrayMergeStrategy || 'smart-union';
  let baseObj: any = {};
  let oursObj: any = {};
  let theirsObj: any = {};
  let detectedIndent: number | string = options.indent || 2;
  let hasTrailingNewline = true;

  try {
    if (typeof oursContent === 'string') {
      detectedIndent = options.indent ?? detectJsonIndent(oursContent);
      hasTrailingNewline = oursContent.endsWith('\n');
      oursObj = oursContent.trim() ? JSON.parse(oursContent) : {};
    } else {
      oursObj = oursContent;
    }

    if (typeof theirsContent === 'string') {
      theirsObj = theirsContent.trim() ? JSON.parse(theirsContent) : {};
    } else {
      theirsObj = theirsContent;
    }

    if (typeof baseContent === 'string') {
      baseObj = baseContent.trim() ? JSON.parse(baseContent) : {};
    } else if (baseContent) {
      baseObj = baseContent;
    } else {
      baseObj = {};
    }
  } catch (parseError: any) {
    return {
      success: false,
      conflicts: [
        {
          path: '',
          baseValue: baseContent,
          oursValue: oursContent,
          theirsValue: theirsContent,
          reason: `JSON parse error during merge: ${parseError.message}`,
        },
      ],
    };
  }

  const conflicts: JsonConflict[] = [];
  const mergedValue = mergeValues3Way(baseObj, oursObj, theirsObj, '', conflicts, strategy);

  const formattedJson = JSON.stringify(mergedValue, null, detectedIndent) + (hasTrailingNewline ? '\n' : '');

  return {
    success: conflicts.length === 0,
    mergedJson: formattedJson,
    mergedValue,
    conflicts,
  };
}
