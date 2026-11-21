var __defProp = Object.defineProperty;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};

// node_modules/mdurl/index.mjs
var exports_mdurl = {};
__export(exports_mdurl, {
  decode: () => decode_default,
  encode: () => encode_default,
  format: () => format2,
  parse: () => parse_default
});

// node_modules/uc.micro/index.mjs
var exports_uc = {};
__export(exports_uc, {
  Any: () => regex_default,
  Cc: () => regex_default2,
  Cf: () => regex_default3,
  P: () => regex_default4,
  S: () => regex_default5,
  Z: () => regex_default6
});
// node_modules/diff/libesm/diff/base.js
class Diff {
  diff(oldStr, newStr, options = {}) {
    let callback;
    if (typeof options === "function") {
      callback = options;
      options = {};
    } else if ("callback" in options) {
      callback = options.callback;
    }
    const oldString = this.castInput(oldStr, options);
    const newString = this.castInput(newStr, options);
    const oldTokens = this.removeEmpty(this.tokenize(oldString, options));
    const newTokens = this.removeEmpty(this.tokenize(newString, options));
    return this.diffWithOptionsObj(oldTokens, newTokens, options, callback);
  }
  diffWithOptionsObj(oldTokens, newTokens, options, callback) {
    var _a;
    const done = (value) => {
      value = this.postProcess(value, options);
      if (callback) {
        setTimeout(function() {
          callback(value);
        }, 0);
        return;
      } else {
        return value;
      }
    };
    const newLen = newTokens.length, oldLen = oldTokens.length;
    let editLength = 1;
    let maxEditLength = newLen + oldLen;
    if (options.maxEditLength != null) {
      maxEditLength = Math.min(maxEditLength, options.maxEditLength);
    }
    const maxExecutionTime = (_a = options.timeout) !== null && _a !== undefined ? _a : Infinity;
    const abortAfterTimestamp = Date.now() + maxExecutionTime;
    const bestPath = [{ oldPos: -1, lastComponent: undefined }];
    let newPos = this.extractCommon(bestPath[0], newTokens, oldTokens, 0, options);
    if (bestPath[0].oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
      return done(this.buildValues(bestPath[0].lastComponent, newTokens, oldTokens));
    }
    let minDiagonalToConsider = -Infinity, maxDiagonalToConsider = Infinity;
    const execEditLength = () => {
      for (let diagonalPath = Math.max(minDiagonalToConsider, -editLength);diagonalPath <= Math.min(maxDiagonalToConsider, editLength); diagonalPath += 2) {
        let basePath;
        const removePath = bestPath[diagonalPath - 1], addPath = bestPath[diagonalPath + 1];
        if (removePath) {
          bestPath[diagonalPath - 1] = undefined;
        }
        let canAdd = false;
        if (addPath) {
          const addPathNewPos = addPath.oldPos - diagonalPath;
          canAdd = addPath && 0 <= addPathNewPos && addPathNewPos < newLen;
        }
        const canRemove = removePath && removePath.oldPos + 1 < oldLen;
        if (!canAdd && !canRemove) {
          bestPath[diagonalPath] = undefined;
          continue;
        }
        if (!canRemove || canAdd && removePath.oldPos < addPath.oldPos) {
          basePath = this.addToPath(addPath, true, false, 0, options);
        } else {
          basePath = this.addToPath(removePath, false, true, 1, options);
        }
        newPos = this.extractCommon(basePath, newTokens, oldTokens, diagonalPath, options);
        if (basePath.oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
          return done(this.buildValues(basePath.lastComponent, newTokens, oldTokens)) || true;
        } else {
          bestPath[diagonalPath] = basePath;
          if (basePath.oldPos + 1 >= oldLen) {
            maxDiagonalToConsider = Math.min(maxDiagonalToConsider, diagonalPath - 1);
          }
          if (newPos + 1 >= newLen) {
            minDiagonalToConsider = Math.max(minDiagonalToConsider, diagonalPath + 1);
          }
        }
      }
      editLength++;
    };
    if (callback) {
      (function exec() {
        setTimeout(function() {
          if (editLength > maxEditLength || Date.now() > abortAfterTimestamp) {
            return callback(undefined);
          }
          if (!execEditLength()) {
            exec();
          }
        }, 0);
      })();
    } else {
      while (editLength <= maxEditLength && Date.now() <= abortAfterTimestamp) {
        const ret = execEditLength();
        if (ret) {
          return ret;
        }
      }
    }
  }
  addToPath(path, added, removed, oldPosInc, options) {
    const last = path.lastComponent;
    if (last && !options.oneChangePerToken && last.added === added && last.removed === removed) {
      return {
        oldPos: path.oldPos + oldPosInc,
        lastComponent: { count: last.count + 1, added, removed, previousComponent: last.previousComponent }
      };
    } else {
      return {
        oldPos: path.oldPos + oldPosInc,
        lastComponent: { count: 1, added, removed, previousComponent: last }
      };
    }
  }
  extractCommon(basePath, newTokens, oldTokens, diagonalPath, options) {
    const newLen = newTokens.length, oldLen = oldTokens.length;
    let oldPos = basePath.oldPos, newPos = oldPos - diagonalPath, commonCount = 0;
    while (newPos + 1 < newLen && oldPos + 1 < oldLen && this.equals(oldTokens[oldPos + 1], newTokens[newPos + 1], options)) {
      newPos++;
      oldPos++;
      commonCount++;
      if (options.oneChangePerToken) {
        basePath.lastComponent = { count: 1, previousComponent: basePath.lastComponent, added: false, removed: false };
      }
    }
    if (commonCount && !options.oneChangePerToken) {
      basePath.lastComponent = { count: commonCount, previousComponent: basePath.lastComponent, added: false, removed: false };
    }
    basePath.oldPos = oldPos;
    return newPos;
  }
  equals(left, right, options) {
    if (options.comparator) {
      return options.comparator(left, right);
    } else {
      return left === right || !!options.ignoreCase && left.toLowerCase() === right.toLowerCase();
    }
  }
  removeEmpty(array) {
    const ret = [];
    for (let i = 0;i < array.length; i++) {
      if (array[i]) {
        ret.push(array[i]);
      }
    }
    return ret;
  }
  castInput(value, options) {
    return value;
  }
  tokenize(value, options) {
    return Array.from(value);
  }
  join(chars) {
    return chars.join("");
  }
  postProcess(changeObjects, options) {
    return changeObjects;
  }
  get useLongestToken() {
    return false;
  }
  buildValues(lastComponent, newTokens, oldTokens) {
    const components = [];
    let nextComponent;
    while (lastComponent) {
      components.push(lastComponent);
      nextComponent = lastComponent.previousComponent;
      delete lastComponent.previousComponent;
      lastComponent = nextComponent;
    }
    components.reverse();
    const componentLen = components.length;
    let componentPos = 0, newPos = 0, oldPos = 0;
    for (;componentPos < componentLen; componentPos++) {
      const component = components[componentPos];
      if (!component.removed) {
        if (!component.added && this.useLongestToken) {
          let value = newTokens.slice(newPos, newPos + component.count);
          value = value.map(function(value, i) {
            const oldValue = oldTokens[oldPos + i];
            return oldValue.length > value.length ? oldValue : value;
          });
          component.value = this.join(value);
        } else {
          component.value = this.join(newTokens.slice(newPos, newPos + component.count));
        }
        newPos += component.count;
        if (!component.added) {
          oldPos += component.count;
        }
      } else {
        component.value = this.join(oldTokens.slice(oldPos, oldPos + component.count));
        oldPos += component.count;
      }
    }
    return components;
  }
}

// node_modules/diff/libesm/util/string.js
function longestCommonPrefix(str1, str2) {
  let i;
  for (i = 0;i < str1.length && i < str2.length; i++) {
    if (str1[i] != str2[i]) {
      return str1.slice(0, i);
    }
  }
  return str1.slice(0, i);
}
function longestCommonSuffix(str1, str2) {
  let i;
  if (!str1 || !str2 || str1[str1.length - 1] != str2[str2.length - 1]) {
    return "";
  }
  for (i = 0;i < str1.length && i < str2.length; i++) {
    if (str1[str1.length - (i + 1)] != str2[str2.length - (i + 1)]) {
      return str1.slice(-i);
    }
  }
  return str1.slice(-i);
}
function replacePrefix(string, oldPrefix, newPrefix) {
  if (string.slice(0, oldPrefix.length) != oldPrefix) {
    throw Error(`string ${JSON.stringify(string)} doesn't start with prefix ${JSON.stringify(oldPrefix)}; this is a bug`);
  }
  return newPrefix + string.slice(oldPrefix.length);
}
function replaceSuffix(string, oldSuffix, newSuffix) {
  if (!oldSuffix) {
    return string + newSuffix;
  }
  if (string.slice(-oldSuffix.length) != oldSuffix) {
    throw Error(`string ${JSON.stringify(string)} doesn't end with suffix ${JSON.stringify(oldSuffix)}; this is a bug`);
  }
  return string.slice(0, -oldSuffix.length) + newSuffix;
}
function removePrefix(string, oldPrefix) {
  return replacePrefix(string, oldPrefix, "");
}
function removeSuffix(string, oldSuffix) {
  return replaceSuffix(string, oldSuffix, "");
}
function maximumOverlap(string1, string2) {
  return string2.slice(0, overlapCount(string1, string2));
}
function overlapCount(a, b) {
  let startA = 0;
  if (a.length > b.length) {
    startA = a.length - b.length;
  }
  let endB = b.length;
  if (a.length < b.length) {
    endB = a.length;
  }
  const map = Array(endB);
  let k = 0;
  map[0] = 0;
  for (let j = 1;j < endB; j++) {
    if (b[j] == b[k]) {
      map[j] = map[k];
    } else {
      map[j] = k;
    }
    while (k > 0 && b[j] != b[k]) {
      k = map[k];
    }
    if (b[j] == b[k]) {
      k++;
    }
  }
  k = 0;
  for (let i = startA;i < a.length; i++) {
    while (k > 0 && a[i] != b[k]) {
      k = map[k];
    }
    if (a[i] == b[k]) {
      k++;
    }
  }
  return k;
}
function segment(string, segmenter) {
  const parts = [];
  for (const segmentObj of Array.from(segmenter.segment(string))) {
    const segment = segmentObj.segment;
    if (parts.length && /\s/.test(parts[parts.length - 1]) && /\s/.test(segment)) {
      parts[parts.length - 1] += segment;
    } else {
      parts.push(segment);
    }
  }
  return parts;
}
function trailingWs(string, segmenter) {
  if (segmenter) {
    return leadingAndTrailingWs(string, segmenter)[1];
  }
  let i;
  for (i = string.length - 1;i >= 0; i--) {
    if (!string[i].match(/\s/)) {
      break;
    }
  }
  return string.substring(i + 1);
}
function leadingWs(string, segmenter) {
  if (segmenter) {
    return leadingAndTrailingWs(string, segmenter)[0];
  }
  const match = string.match(/^\s*/);
  return match ? match[0] : "";
}
function leadingAndTrailingWs(string, segmenter) {
  if (!segmenter) {
    return [leadingWs(string), trailingWs(string)];
  }
  if (segmenter.resolvedOptions().granularity != "word") {
    throw new Error('The segmenter passed must have a granularity of "word"');
  }
  const segments = segment(string, segmenter);
  const firstSeg = segments[0];
  const lastSeg = segments[segments.length - 1];
  const head = /\s/.test(firstSeg) ? firstSeg : "";
  const tail = /\s/.test(lastSeg) ? lastSeg : "";
  return [head, tail];
}

// node_modules/diff/libesm/diff/word.js
var extendedWordChars = "a-zA-Z0-9_\\u{AD}\\u{C0}-\\u{D6}\\u{D8}-\\u{F6}\\u{F8}-\\u{2C6}\\u{2C8}-\\u{2D7}\\u{2DE}-\\u{2FF}\\u{1E00}-\\u{1EFF}";
var tokenizeIncludingWhitespace = new RegExp(`[${extendedWordChars}]+|\\s+|[^${extendedWordChars}]`, "ug");

class WordDiff extends Diff {
  equals(left, right, options) {
    if (options.ignoreCase) {
      left = left.toLowerCase();
      right = right.toLowerCase();
    }
    return left.trim() === right.trim();
  }
  tokenize(value, options = {}) {
    let parts;
    if (options.intlSegmenter) {
      const segmenter = options.intlSegmenter;
      if (segmenter.resolvedOptions().granularity != "word") {
        throw new Error('The segmenter passed must have a granularity of "word"');
      }
      parts = segment(value, segmenter);
    } else {
      parts = value.match(tokenizeIncludingWhitespace) || [];
    }
    const tokens = [];
    let prevPart = null;
    parts.forEach((part) => {
      if (/\s/.test(part)) {
        if (prevPart == null) {
          tokens.push(part);
        } else {
          tokens.push(tokens.pop() + part);
        }
      } else if (prevPart != null && /\s/.test(prevPart)) {
        if (tokens[tokens.length - 1] == prevPart) {
          tokens.push(tokens.pop() + part);
        } else {
          tokens.push(prevPart + part);
        }
      } else {
        tokens.push(part);
      }
      prevPart = part;
    });
    return tokens;
  }
  join(tokens) {
    return tokens.map((token, i) => {
      if (i == 0) {
        return token;
      } else {
        return token.replace(/^\s+/, "");
      }
    }).join("");
  }
  postProcess(changes, options) {
    if (!changes || options.oneChangePerToken) {
      return changes;
    }
    let lastKeep = null;
    let insertion = null;
    let deletion = null;
    changes.forEach((change) => {
      if (change.added) {
        insertion = change;
      } else if (change.removed) {
        deletion = change;
      } else {
        if (insertion || deletion) {
          dedupeWhitespaceInChangeObjects(lastKeep, deletion, insertion, change, options.intlSegmenter);
        }
        lastKeep = change;
        insertion = null;
        deletion = null;
      }
    });
    if (insertion || deletion) {
      dedupeWhitespaceInChangeObjects(lastKeep, deletion, insertion, null, options.intlSegmenter);
    }
    return changes;
  }
}
var wordDiff = new WordDiff;
function dedupeWhitespaceInChangeObjects(startKeep, deletion, insertion, endKeep, segmenter) {
  if (deletion && insertion) {
    const [oldWsPrefix, oldWsSuffix] = leadingAndTrailingWs(deletion.value, segmenter);
    const [newWsPrefix, newWsSuffix] = leadingAndTrailingWs(insertion.value, segmenter);
    if (startKeep) {
      const commonWsPrefix = longestCommonPrefix(oldWsPrefix, newWsPrefix);
      startKeep.value = replaceSuffix(startKeep.value, newWsPrefix, commonWsPrefix);
      deletion.value = removePrefix(deletion.value, commonWsPrefix);
      insertion.value = removePrefix(insertion.value, commonWsPrefix);
    }
    if (endKeep) {
      const commonWsSuffix = longestCommonSuffix(oldWsSuffix, newWsSuffix);
      endKeep.value = replacePrefix(endKeep.value, newWsSuffix, commonWsSuffix);
      deletion.value = removeSuffix(deletion.value, commonWsSuffix);
      insertion.value = removeSuffix(insertion.value, commonWsSuffix);
    }
  } else if (insertion) {
    if (startKeep) {
      const ws = leadingWs(insertion.value, segmenter);
      insertion.value = insertion.value.substring(ws.length);
    }
    if (endKeep) {
      const ws = leadingWs(endKeep.value, segmenter);
      endKeep.value = endKeep.value.substring(ws.length);
    }
  } else if (startKeep && endKeep) {
    const newWsFull = leadingWs(endKeep.value, segmenter), [delWsStart, delWsEnd] = leadingAndTrailingWs(deletion.value, segmenter);
    const newWsStart = longestCommonPrefix(newWsFull, delWsStart);
    deletion.value = removePrefix(deletion.value, newWsStart);
    const newWsEnd = longestCommonSuffix(removePrefix(newWsFull, newWsStart), delWsEnd);
    deletion.value = removeSuffix(deletion.value, newWsEnd);
    endKeep.value = replacePrefix(endKeep.value, newWsFull, newWsEnd);
    startKeep.value = replaceSuffix(startKeep.value, newWsFull, newWsFull.slice(0, newWsFull.length - newWsEnd.length));
  } else if (endKeep) {
    const endKeepWsPrefix = leadingWs(endKeep.value, segmenter);
    const deletionWsSuffix = trailingWs(deletion.value, segmenter);
    const overlap = maximumOverlap(deletionWsSuffix, endKeepWsPrefix);
    deletion.value = removeSuffix(deletion.value, overlap);
  } else if (startKeep) {
    const startKeepWsSuffix = trailingWs(startKeep.value, segmenter);
    const deletionWsPrefix = leadingWs(deletion.value, segmenter);
    const overlap = maximumOverlap(startKeepWsSuffix, deletionWsPrefix);
    deletion.value = removePrefix(deletion.value, overlap);
  }
}

class WordsWithSpaceDiff extends Diff {
  tokenize(value) {
    const regex = new RegExp(`(\\r?\\n)|[${extendedWordChars}]+|[^\\S\\n\\r]+|[^${extendedWordChars}]`, "ug");
    return value.match(regex) || [];
  }
}
var wordsWithSpaceDiff = new WordsWithSpaceDiff;
function diffWordsWithSpace(oldStr, newStr, options) {
  return wordsWithSpaceDiff.diff(oldStr, newStr, options);
}

// node_modules/diff/libesm/diff/line.js
class LineDiff extends Diff {
  constructor() {
    super(...arguments);
    this.tokenize = tokenize;
  }
  equals(left, right, options) {
    if (options.ignoreWhitespace) {
      if (!options.newlineIsToken || !left.includes(`
`)) {
        left = left.trim();
      }
      if (!options.newlineIsToken || !right.includes(`
`)) {
        right = right.trim();
      }
    } else if (options.ignoreNewlineAtEof && !options.newlineIsToken) {
      if (left.endsWith(`
`)) {
        left = left.slice(0, -1);
      }
      if (right.endsWith(`
`)) {
        right = right.slice(0, -1);
      }
    }
    return super.equals(left, right, options);
  }
}
var lineDiff = new LineDiff;
function diffLines(oldStr, newStr, options) {
  return lineDiff.diff(oldStr, newStr, options);
}
function tokenize(value, options) {
  if (options.stripTrailingCr) {
    value = value.replace(/\r\n/g, `
`);
  }
  const retLines = [], linesAndNewlines = value.split(/(\n|\r\n)/);
  if (!linesAndNewlines[linesAndNewlines.length - 1]) {
    linesAndNewlines.pop();
  }
  for (let i = 0;i < linesAndNewlines.length; i++) {
    const line = linesAndNewlines[i];
    if (i % 2 && !options.newlineIsToken) {
      retLines[retLines.length - 1] += line;
    } else {
      retLines.push(line);
    }
  }
  return retLines;
}
// src/viewers/web/atoms/text.ts
function heading(label) {
  const row = document.createElement("h2");
  row.className = "section";
  row.textContent = label;
  return row;
}
function paragraph(className, text) {
  const row = document.createElement("p");
  row.className = className;
  row.textContent = text;
  return row;
}

// src/element-order.ts
function meaningRank(element) {
  if (element.kind === "actor")
    return 0;
  if (element.external)
    return 2;
  return 1;
}
function compareSemanticElements(left, right) {
  return meaningRank(left) - meaningRank(right) || (left.representationId < right.representationId ? -1 : left.representationId > right.representationId ? 1 : 0);
}

// src/viewers/tui/tree.ts
function initialTree() {
  return { expanded: new Set, collapsed: new Set };
}
function toggleExpansion(tree, row) {
  const expanded = new Set(tree.expanded);
  const collapsed = new Set(tree.collapsed);
  if (tree.collapsed.has(row.id)) {
    collapsed.delete(row.id);
    expanded.add(row.id);
  } else if (row.expanded) {
    expanded.delete(row.id);
    collapsed.add(row.id);
  } else {
    collapsed.delete(row.id);
    expanded.add(row.id);
  }
  return { ...tree, expanded, collapsed };
}
function ancestorsOf(id, byId) {
  const ancestors = new Set;
  let current = id === undefined ? undefined : byId.get(id);
  while (current && current.parent !== null) {
    const parent = byId.get(current.parent);
    if (!parent)
      break;
    ancestors.add(parent.representationId);
    current = parent;
  }
  return ancestors;
}
function rows(elements, selectionIds, tree, order) {
  const sorted = (items) => [...items].sort(order);
  const byId = new Map(elements.map((element) => [element.representationId, element]));
  const selectionPath = new Set(selectionIds.flatMap((id) => [...ancestorsOf(id, byId)]));
  const rows = [];
  function expandedFor(element) {
    if (element.children.length === 0)
      return false;
    if (selectionPath.has(element.representationId))
      return true;
    if (tree.collapsed.has(element.representationId))
      return false;
    return tree.expanded.has(element.representationId);
  }
  function push(element, depth) {
    const children = sorted(element.children.flatMap((id) => {
      const child = byId.get(id);
      return child === undefined ? [] : [child];
    }));
    const expanded = expandedFor(element);
    rows.push({
      id: element.representationId,
      title: element.title,
      kind: element.kind,
      external: element.external,
      depth,
      origin: element.origin,
      hasChildren: children.length > 0,
      expanded,
      count: children.length
    });
    if (!expanded)
      return;
    for (const child of children)
      push(child, depth + 1);
  }
  for (const root of sorted(elements.filter((element) => element.parent === null))) {
    push(root, 0);
  }
  return rows;
}
function semanticTreeRows(world, selectionIds, tree) {
  return rows(world.elements, selectionIds, tree, compareSemanticElements);
}

// src/viewers/web/comparison/tree.ts
var changeStatuses = ["added", "modified", "removed"];
var changeMarks = { added: "+", modified: "~", removed: "−" };
var changeLabels = { added: "Added", modified: "Modified", removed: "Removed" };
function isChange(status) {
  return status !== undefined && status !== "unchanged";
}
function comparisonTree(world, comparison, enabled = new Set(changeStatuses)) {
  const byId = new Map(world.elements.map((element) => [element.representationId, element]));
  const counts = new Map;
  const changed = new Set;
  const current = new Set;
  const former = new Set;
  for (const element of world.elements) {
    const change = comparison.components[element.id];
    if (change === undefined)
      continue;
    const parents = ancestorsOf(element.representationId, byId);
    for (const id of parents)
      (change.after === undefined ? former : current).add(id);
    if (!isChange(change.status) || !enabled.has(change.status))
      continue;
    changed.add(element.representationId);
    for (const id of parents) {
      const total = counts.get(id) ?? { added: 0, modified: 0, removed: 0 };
      total[change.status] += 1;
      counts.set(id, total);
    }
  }
  const included = new Set([...changed, ...counts.keys()]);
  const elements = world.elements.filter((element) => included.has(element.representationId)).map((element) => ({ ...element, children: element.children.filter((id) => included.has(id)) }));
  const filtered = { ...world, elements };
  const rows = semanticTreeRows(filtered, [], { expanded: included, collapsed: new Set });
  const relationships = world.relationships.filter((item) => {
    const status = comparison.relationships[item.id];
    return isChange(status) && enabled.has(status);
  });
  const order = [...rows.filter((row) => changed.has(row.id)).map((row) => row.id), ...relationships.map((item) => item.id)];
  return {
    world: filtered,
    elements: world.elements,
    rows,
    counts,
    relationships,
    order,
    former: new Set([...former].filter((id) => !current.has(id)))
  };
}
function nextChange(order, selected, direction) {
  if (order.length === 0)
    return;
  const index = selected === undefined ? -1 : order.indexOf(selected);
  return order[index < 0 ? direction > 0 ? 0 : order.length - 1 : (index + direction + order.length) % order.length];
}

// src/viewers/web/atoms/button.ts
function chromeButton(label, options = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "chrome-button";
  if (options.ariaLabel !== undefined)
    button.setAttribute("aria-label", options.ariaLabel);
  if (options.glyph !== undefined) {
    const glyph = document.createElement("span");
    glyph.className = "chrome-button-glyph";
    glyph.setAttribute("aria-hidden", "true");
    glyph.textContent = options.glyph;
    button.append(glyph);
  }
  button.append(label);
  return button;
}

// src/viewers/source/highlight.ts
var keywords = new Set([
  "as",
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "default",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "foreach",
  "from",
  "function",
  "get",
  "if",
  "implements",
  "import",
  "in",
  "interface",
  "internal",
  "is",
  "let",
  "namespace",
  "new",
  "null",
  "of",
  "override",
  "private",
  "protected",
  "public",
  "readonly",
  "return",
  "set",
  "static",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "type",
  "typeof",
  "undefined",
  "using",
  "var",
  "virtual",
  "void",
  "while",
  "yield"
]);
var tokenPattern = /\/\/.*|\/\*.*?\*\/|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b/g;
function tokenKind(token, rest) {
  if (token.startsWith("//") || token.startsWith("/*"))
    return "comment";
  if (/^['"`]/.test(token))
    return "string";
  if (/^\d/.test(token))
    return "number";
  if (keywords.has(token))
    return "keyword";
  if (/^[A-Z]/.test(token))
    return "type";
  return /^\s*\(/.test(rest) ? "function" : undefined;
}
function codeTokens(source) {
  const tokens = [];
  let offset = 0;
  for (const match of source.matchAll(tokenPattern)) {
    if (match.index > offset)
      tokens.push({ text: source.slice(offset, match.index) });
    offset = match.index + match[0].length;
    tokens.push({ text: match[0], kind: tokenKind(match[0], source.slice(offset)) });
  }
  if (offset < source.length)
    tokens.push({ text: source.slice(offset) });
  return tokens;
}

// src/viewers/web/source/highlight.ts
function highlightedLine(source) {
  const line = document.createDocumentFragment();
  for (const token of codeTokens(source)) {
    if (token.kind === undefined)
      line.append(token.text);
    else {
      const span = document.createElement("span");
      span.className = `syntax-${token.kind}`;
      span.textContent = token.text;
      line.append(span);
    }
  }
  return line;
}

// src/viewers/web/source/diff-view.ts
var statusMark = { added: "A", removed: "D", modified: "M", unchanged: "·" };
var statusLabel = { added: "Added", removed: "Removed", modified: "Modified", unchanged: "Unchanged" };
function fileDiffRow(file, onOpen, shared = false) {
  const row = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "diff-file-row";
  button.onclick = () => onOpen(file.file);
  const mark = document.createElement("span");
  mark.className = `diff-file-status ${file.status}`;
  mark.textContent = statusMark[file.status];
  mark.title = statusLabel[file.status];
  const name = document.createElement("span");
  name.className = "diff-file-name";
  name.textContent = file.file;
  const facts = document.createElement("span");
  facts.className = "diff-file-facts";
  if (shared) {
    const shared = document.createElement("span");
    shared.className = "diff-file-shared";
    shared.textContent = "Shared";
    facts.append(shared);
  }
  if (file.additions > 0)
    facts.append(Object.assign(document.createElement("span"), {
      className: "diff-file-additions",
      textContent: `+${file.additions}`
    }));
  if (file.deletions > 0)
    facts.append(Object.assign(document.createElement("span"), {
      className: "diff-file-deletions",
      textContent: `−${file.deletions}`
    }));
  button.append(mark, name, facts);
  row.append(button);
  return row;
}
function diffRow(line) {
  const row = document.createElement("div");
  row.className = `diff-line ${line.kind}`;
  const oldLine = document.createElement("span");
  oldLine.className = "diff-number";
  oldLine.textContent = line.oldLine === undefined ? "" : String(line.oldLine);
  const newLine = document.createElement("span");
  newLine.className = "diff-number";
  newLine.textContent = line.newLine === undefined ? "" : String(line.newLine);
  const sign = document.createElement("span");
  sign.className = "diff-sign";
  sign.textContent = line.kind === "added" ? "+" : line.kind === "removed" ? "−" : " ";
  const code = document.createElement("code");
  code.append(highlightedLine(line.text));
  row.append(oldLine, newLine, sign, code);
  return row;
}
function paintFileDiff(host, file, contextLabel, onBack, identity) {
  host.classList.add("file-open", "diff-open");
  host.querySelector("h1").textContent = file.file;
  const toolbar = host.querySelector(".tabs");
  toolbar.hidden = false;
  toolbar.classList.remove("controls");
  toolbar.classList.add("file-toolbar", "diff-toolbar");
  const back = chromeButton("Back", { glyph: "←" });
  back.addEventListener("click", onBack);
  const context = document.createElement("span");
  context.className = "file-context";
  context.textContent = `${contextLabel} · ${statusLabel[file.status]}`;
  const facts = document.createElement("span");
  facts.className = "file-facts";
  facts.textContent = `+${file.additions} −${file.deletions}`;
  toolbar.replaceChildren(back, context, facts);
  const body = host.querySelector(".body");
  const content = document.createElement("div");
  content.className = "diff-code";
  if (identity !== undefined)
    content.append(identity);
  for (const hunk of file.hunks) {
    const header = document.createElement("div");
    header.className = "diff-hunk";
    header.textContent = hunk.header;
    content.append(header, ...hunk.lines.map(diffRow));
  }
  if (file.hunks.length === 0) {
    const unchanged = document.createElement("p");
    unchanged.className = "diff-status";
    unchanged.textContent = "No changes";
    content.append(unchanged);
  }
  body.replaceChildren(content);
}
function leaveFileDiff(host) {
  host.classList.remove("file-open", "diff-open");
  host.querySelector(".tabs").classList.remove("file-toolbar", "diff-toolbar");
  host.querySelector(".tabs").classList.add("controls");
}

// src/viewers/web/comparison/details.ts
function changeBadge(status) {
  const badge = document.createElement("span");
  badge.className = "change-badge";
  badge.dataset.change = status;
  badge.textContent = status[0].toUpperCase() + status.slice(1);
  return badge;
}
function textChanges(before, after) {
  const parts = diffWordsWithSpace(before, after);
  const changed = parts.filter((part) => part.added || part.removed).reduce((total, part) => total + part.value.length, 0);
  const mode = before === after ? "same" : before === "" ? "added" : after === "" ? "removed" : changed / (before.length + after.length) >= 0.5 ? "rewrite" : "words";
  const spaced = parts.flatMap((part, index) => {
    const previous = parts[index - 1];
    return previous?.removed && part.added && !/\s$/.test(previous.value) && !/^\s/.test(part.value) ? [{ value: " ", added: false, removed: false, count: 0 }, part] : [part];
  });
  return { mode, parts: spaced };
}
function textVersion(label, value) {
  const section = document.createElement("div");
  const title = document.createElement("span");
  title.className = "comparison-text-label";
  title.textContent = label;
  section.append(title, paragraph("", value));
  return section;
}
function textVersions(className, mode, before, after) {
  const versions = document.createElement("div");
  versions.className = className;
  if (after !== "")
    versions.append(textVersion(mode === "added" ? "Added" : "Now", after));
  if (before !== "")
    versions.append(textVersion(mode === "removed" ? "Removed" : "Before", before));
  return versions;
}
function changedText(className, before, after, prose = false) {
  const text = paragraph(className, "");
  if (before === undefined || after === undefined || before === after) {
    text.textContent = after ?? before ?? "";
    return text;
  }
  const { mode, parts } = textChanges(before, after);
  if (prose && mode !== "words")
    return textVersions(className, mode, before, after);
  for (const part of parts) {
    if (!part.added && !part.removed) {
      text.append(part.value);
      continue;
    }
    const fragment = document.createElement(part.added ? "ins" : "del");
    fragment.textContent = part.value;
    text.append(fragment);
  }
  return text;
}
var fields = [
  ["title", "name", "what"],
  ["technology", "technology", "how"],
  ["parent", "parent", "what"],
  ["group", "group", "what"],
  ["origin", "status", "what"],
  ["draft", "draft", "what"]
];
function componentReasons(change) {
  const reasons = [];
  if (change?.status !== "modified" || change.before === undefined || change.after === undefined)
    return reasons;
  const { before, after } = change;
  if (before.description !== after.description || before.overview !== after.overview) {
    reasons.push({ key: "description", label: "description", tab: "what" });
  }
  for (const [key, label, tab] of fields)
    if (before[key] !== after[key])
      reasons.push({ key, label, tab });
  const ownership = (element) => JSON.stringify(element.code.map(({ scanner, file, symbol }) => [scanner, file, symbol]).sort());
  if (ownership(before) !== ownership(after))
    reasons.push({ key: "ownership", label: "ownership", tab: "how" });
  const files = change.files.filter((file) => file.status !== "unchanged");
  if (files.length > 0) {
    const added = files.reduce((sum, file) => sum + file.additions, 0);
    const removed = files.reduce((sum, file) => sum + file.deletions, 0);
    reasons.push({ key: "files", label: `${files.length} ${files.length === 1 ? "file" : "files"} +${added} −${removed}`, tab: "how" });
  }
  return reasons;
}
function comparisonDefaultTab(change) {
  const reasons = componentReasons(change);
  return reasons.length > 0 && reasons.every((reason) => reason.key === "ownership" || reason.key === "files") ? "how" : "what";
}
function comparisonReasons(change, comparison, world, onTab) {
  if (change.status !== "modified")
    return;
  const reasons = componentReasons(change);
  const id = (change.after ?? change.before).representationId;
  const count = world.relationships.filter((item) => (item.source === id || item.target === id) && isChange(comparison.relationships[item.id])).length;
  if (count > 0)
    reasons.push({ key: "relationships", label: `${count} ${count === 1 ? "relationship" : "relationships"}`, tab: "what" });
  const line = paragraph("comparison-reasons", "Changed: ");
  for (const [index, reason] of reasons.entries()) {
    if (index > 0)
      line.append(", ");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "link";
    button.textContent = reason.label;
    button.onclick = () => onTab(reason.tab);
    line.append(button);
  }
  return line;
}
function changedField(body, label, before, after) {
  if (before === after)
    return;
  const row = document.createElement("div");
  row.className = "comparison-field";
  const title = document.createElement("span");
  title.className = "comparison-field-label";
  title.textContent = label;
  const value = changedText("", before ?? "", after ?? "");
  row.append(title, value);
  body.append(row);
}
function comparisonOverview(body, change, world) {
  const { before, after } = change;
  const prose = (element, key) => element === undefined ? undefined : element[key] ?? "";
  for (const key of ["description", "overview"]) {
    if (before?.[key] || after?.[key])
      body.append(changedText(key, prose(before, key), prose(after, key), true));
  }
  if (before === undefined || after === undefined)
    return;
  const parentName = (id) => world.elements.find((item) => item.id === id)?.title ?? id ?? "";
  changedField(body, "Name", before.title, after.title);
  changedField(body, "Parent", parentName(before.parent), parentName(after.parent));
  changedField(body, "Group", before.group, after.group);
  changedField(body, "Status", before.origin, after.origin);
  changedField(body, "Draft", before.draft, after.draft);
}
function comparisonTechnology(body, change) {
  if (!change.before?.technology && !change.after?.technology)
    return;
  body.append(heading("Technology"), changedText("comparison-technology", change.before === undefined ? undefined : change.before.technology ?? "", change.after === undefined ? undefined : change.after.technology ?? ""));
}
function ownership(file, change) {
  if (change.before === undefined || change.after === undefined)
    return;
  const describe = (element) => element?.code.filter((code) => code.file === file).map((code) => `${code.scanner}${code.symbol === undefined ? "" : ` · ${code.symbol}`}`).sort().join(", ") ?? "";
  const before = describe(change.before);
  const after = describe(change.after);
  if (before === after)
    return;
  const row = changedText("comparison-ownership", before, after);
  row.prepend("Ownership: ");
  return row;
}
function comparisonFiles(body, change, onOpen) {
  if (change.files.length === 0)
    return;
  const list = document.createElement("ul");
  list.className = "comparison-files";
  for (const file of change.files) {
    const row = fileDiffRow(file, onOpen);
    const changedOwnership = ownership(file.file, change);
    if (changedOwnership !== undefined)
      row.append(changedOwnership);
    list.append(row);
  }
  body.append(heading("Files"), list);
}

// src/viewers/web/chrome/motion.ts
function reducedMotion() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function animateDisclosure(chevron, expanded) {
  if (reducedMotion())
    return;
  chevron.animate([
    { transform: `rotate(${expanded ? -45 : 45}deg)` },
    { transform: `rotate(${expanded ? 45 : -45}deg)` }
  ], { duration: 180, easing: "ease-out" });
}
function animateControl(control, kind) {
  if (reducedMotion())
    return;
  const mark = control.querySelector(".control-icon, .control-glyph") ?? control;
  for (const running of mark.getAnimations())
    running.cancel();
  mark.animate(kind === "fit" ? [{ transform: "scale(1)" }, { transform: "scale(0.72)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }] : [{ transform: "scale(1)" }, { transform: "scale(1.24)" }, { transform: "scale(1)" }], { duration: kind === "fit" ? 220 : 150, easing: "ease-out" });
}
function createThemeTransition(host) {
  const fade = document.createElement("div");
  fade.id = "theme-fade";
  host.append(fade);
  let active = false;
  return (apply) => {
    if (active)
      return;
    if (reducedMotion()) {
      apply();
      return;
    }
    active = true;
    const cover = fade.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 90,
      easing: "ease-in",
      fill: "forwards"
    });
    cover.finished.then(() => {
      apply();
      cover.cancel();
      const reveal = fade.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 140,
        easing: "ease-out"
      });
      reveal.finished.then(() => {
        active = false;
      });
    });
  };
}
function animateContent(host) {
  if (reducedMotion())
    return;
  const style = getComputedStyle(host);
  host.animate([{ opacity: 0, transform: "translateY(3px)" }, { opacity: 1, transform: "translateY(0)" }], {
    duration: Number.parseFloat(style.getPropertyValue("--chrome-motion")),
    easing: style.getPropertyValue("--chrome-ease").trim()
  });
}
function animateRow(row, entering, height) {
  if (reducedMotion()) {
    if (!entering)
      row.remove();
    return;
  }
  const style = getComputedStyle(row);
  const open = { height: `${height}px`, paddingTop: style.paddingTop, paddingBottom: style.paddingBottom, opacity: 1 };
  const closed = { height: "0px", paddingTop: "0px", paddingBottom: "0px", opacity: 0 };
  row.style.overflow = "hidden";
  row.style.boxSizing = "border-box";
  const animation = row.animate(entering ? [closed, open] : [open, closed], {
    duration: Number.parseFloat(style.getPropertyValue("--chrome-motion")),
    easing: style.getPropertyValue("--chrome-ease").trim()
  });
  animation.onfinish = () => {
    if (!entering)
      row.remove();
  };
}

// src/viewers/web/comparison/control.ts
function filterComparisonScene(scene, world, comparison, enabled) {
  if (comparison === undefined || enabled.has("removed"))
    return scene;
  const removed = new Set(Object.values(comparison.components).filter((change) => change.status === "removed").map((change) => change.before.representationId));
  for (const id of comparisonTree(world, comparison).former)
    removed.add(id);
  return {
    ...scene,
    buildings: scene.buildings.filter(({ building }) => !removed.has(building.representationId)),
    slabs: scene.slabs.filter(({ slab }) => !removed.has(slab.representationId)),
    islands: scene.islands.filter(({ island }) => island.element === null || !removed.has(island.element.representationId)),
    zones: scene.zones.filter(({ zone }) => zone.members.some((id) => !removed.has(id))),
    routes: scene.routes.flatMap((item) => {
      if (removed.has(item.route.source) || removed.has(item.route.target))
        return [];
      const ids = (item.route.relationshipIds ?? [item.route.id]).filter((id) => comparison.relationships[id] !== "removed");
      return ids.length === 0 ? [] : [{ ...item, route: { ...item.route, relationshipIds: ids } }];
    })
  };
}
function createComparisonControl(host, select, repaint) {
  let enabled = new Set(changeStatuses);
  let pair = "";
  let order = [];
  let selected;
  let world;
  let comparison;
  const bar = document.createElement("div");
  bar.id = "changes";
  bar.className = "floating-map-bar";
  bar.setAttribute("aria-label", "Comparison changes");
  const filters = document.createElement("div");
  filters.className = "change-filters";
  const buttons = changeStatuses.map((status) => {
    const button = chromeButton("");
    button.dataset.change = status;
    button.onclick = () => {
      if (enabled.has(status))
        enabled.delete(status);
      else
        enabled.add(status);
      repaint();
    };
    filters.append(button);
    return button;
  });
  const stepper = document.createElement("div");
  stepper.className = "change-stepper";
  const previous = chromeButton("", { glyph: "←", ariaLabel: "Previous change" });
  const next = chromeButton("", { glyph: "→", ariaLabel: "Next change" });
  const position = document.createElement("span");
  position.setAttribute("aria-live", "polite");
  const step = (direction) => {
    const id = nextChange(order, selected, direction);
    if (id !== undefined)
      select(id);
  };
  previous.onclick = () => step(-1);
  next.onclick = () => step(1);
  stepper.append(previous, position, next);
  bar.append(filters, stepper);
  host.append(bar);
  document.addEventListener("keydown", (event) => {
    if (bar.hidden || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey)
      return;
    if (event.target instanceof Element && event.target.closest("input, textarea, [contenteditable]"))
      return;
    const direction = event.key.toLowerCase() === "j" ? 1 : event.key.toLowerCase() === "k" ? -1 : 0;
    if (direction === 0)
      return;
    event.preventDefault();
    step(direction);
  });
  function paintPosition() {
    const index = selected === undefined ? -1 : order.indexOf(selected);
    const label = `${index < 0 ? "—" : index + 1} / ${order.length}`;
    if (position.textContent !== label) {
      position.textContent = label;
      animateContent(position);
    }
  }
  return {
    targets() {
      if (comparison === undefined)
        return [];
      return Object.values(comparison.components).filter((change) => isChange(change.status) && enabled.has(change.status)).map((change) => (change.after ?? change.before).representationId);
    },
    get enabled() {
      return enabled;
    },
    project(scene) {
      return filterComparisonScene(scene, world, comparison, enabled);
    },
    marks() {
      if (comparison === undefined)
        return;
      const visible = (status) => isChange(status) && !enabled.has(status) ? "unchanged" : status;
      return {
        ...comparison,
        components: Object.fromEntries(Object.entries(comparison.components).map(([id, change]) => [id, { ...change, status: visible(change.status) }])),
        relationships: Object.fromEntries(Object.entries(comparison.relationships).map(([id, status]) => [id, visible(status)]))
      };
    },
    update(nextWorld, nextComparison, destination, selection) {
      world = nextWorld;
      comparison = nextComparison;
      selected = selection;
      const nextPair = comparison === undefined ? "" : `${comparison.from?.id ?? ""}:${destination ?? ""}`;
      if (nextPair !== pair) {
        enabled = new Set(changeStatuses);
        pair = nextPair;
      }
      const statuses = comparison === undefined ? [] : [...Object.values(comparison.components).map((change) => change.status), ...Object.values(comparison.relationships)];
      bar.hidden = !statuses.some(isChange);
      order = comparison === undefined ? [] : comparisonTree(world, comparison, enabled).order;
      buttons.forEach((button, index) => {
        const status = changeStatuses[index];
        const count = statuses.filter((item) => item === status).length;
        button.hidden = count === 0;
        button.setAttribute("aria-pressed", String(enabled.has(status)));
        button.setAttribute("aria-label", `${changeLabels[status]}: ${count}`);
        button.title = changeLabels[status];
        button.textContent = `${changeMarks[status]} ${count}`;
      });
      paintPosition();
      previous.disabled = next.disabled = order.length === 0;
    }
  };
}

// src/viewers/web/atoms/settings-dialog.ts
function createSettingsDialog(id, title, content, options = {}) {
  const dialog = document.createElement("dialog");
  dialog.id = id;
  dialog.className = "settings-dialog";
  dialog.setAttribute("aria-labelledby", `${id}-title`);
  dialog.innerHTML = `<header><h1 id="${id}-title">${title}</h1><button class="chrome-button" type="button" data-close aria-label="Close ${title}">×</button></header>${content}`;
  document.body.append(dialog);
  let opener;
  function close() {
    options.onClose?.();
    dialog.close();
    if (opener?.tagName === "BUTTON")
      opener.setAttribute("aria-expanded", "false");
    if (opener && opener.getClientRects().length > 0)
      opener.focus();
    else
      document.getElementById("settings-toggle")?.focus();
  }
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener("keydown", (event) => event.stopPropagation());
  dialog.querySelector("[data-close]").addEventListener("click", close);
  return { dialog, close, open(button) {
    opener = button;
    dialog.showModal();
    if (button.tagName === "BUTTON")
      button.setAttribute("aria-expanded", "true");
  } };
}

// src/viewers/web/atoms/escape.ts
function escaped(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// src/viewers/web/scanners/name.ts
var names = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  csharp: "C#",
  php: "PHP"
};
function scannerName(id) {
  return names[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

// src/scanner/modules/package-name.ts
function isNpmPackageName(value) {
  return /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(value);
}

// src/plugins/settings-model.ts
function pluginUpgradeAction(plugin, upgrades) {
  const version = plugin.source ? upgrades?.[plugin.source]?.version : undefined;
  return version ? { action: "update", id: plugin.id, source: `${plugin.name}@${version}` } : undefined;
}
function pluginGroups(plugins, query = "") {
  const search = query.trim().toLocaleLowerCase();
  const matching = plugins.filter((plugin) => [plugin.id, plugin.name, plugin.source ?? "", ...plugin.kind === "scanner" ? plugin.technologies : []].some((value) => value.toLocaleLowerCase().includes(search)));
  const scanners = matching.filter((plugin) => plugin.kind === "scanner");
  return [
    { title: "Scanners · Installed", plugins: scanners.filter((scanner) => scanner.listed && scanner.status !== "missing") },
    { title: "Scanners · Missing on this computer", plugins: scanners.filter((scanner) => scanner.listed && scanner.status === "missing") },
    { title: "Scanners · Recommended", plugins: scanners.filter((scanner) => !scanner.listed) },
    { title: "Work sources", plugins: matching.filter((plugin) => plugin.kind === "workSource") }
  ].filter((group) => group.plugins.length);
}
function pluginSettingAction(plugin) {
  if (plugin.listed && plugin.status === "blocked")
    return { action: "retry" };
  if (plugin.listed)
    return plugin.status === "missing" ? { action: "restore", id: plugin.id } : undefined;
  return plugin.installSource ? { action: "install", id: plugin.id } : undefined;
}
function scannerMatchReason(scanner) {
  const folders = [...new Set(scanner.matches.map((file) => file.includes("/") ? file.slice(0, file.lastIndexOf("/") + 1) : "project root"))];
  if (!folders.length)
    return scanner.match === "unknown" ? "Project match unknown" : "No matching project files";
  return `Found in ${folders[0]}${folders.length > 1 ? ` and ${folders.length - 1} more folders` : ""}`;
}

// src/viewers/web/settings/plugins.ts
function rowActions(plugin, upgrades) {
  const id = escaped(plugin.id);
  const button = (action, title) => `<button class="chrome-button" type="button" data-action="${action}" data-id="${id}">${title}</button>`;
  const action = pluginUpgradeAction(plugin, upgrades) ?? pluginSettingAction(plugin);
  const primary = action ? button(action.action, action.action === "update" ? "Update" : action.action === "retry" ? "Retry" : "Install") : "";
  const npm = plugin.source && isNpmPackageName(plugin.source.slice(0, plugin.source.lastIndexOf("@")));
  const update = plugin.kind === "workSource" ? button("update", "Update") : npm ? button("version", "Choose version") : button("version", "Update");
  const retry = action?.action === "update" && plugin.status === "blocked" ? button("retry", "Retry scan") : "";
  const more = plugin.listed ? retry + update + button("remove", "Remove from project") : "";
  return { primary, more };
}
function detectionDetails(scanner) {
  if (!scanner.matches.length)
    return "";
  return `<input type="search" data-evidence-search aria-label="Search ${escaped(scannerName(scanner.id))} detection details" placeholder="Filter by path…">` + `<ul class="scanner-evidence">${scanner.matches.map((file) => `<li>${escaped(file)}</li>`).join("")}</ul><p data-no-matches hidden>No matching paths</p>`;
}
function detailLabel(plugin) {
  if (plugin.kind === "workSource")
    return "Plugin details";
  if (plugin.status === "blocked" || plugin.status === "missing" || !plugin.matches.length)
    return "Scanner details";
  const count = plugin.matches.length;
  return `${count} matching ${count === 1 ? "file" : "files"}`;
}
function settingRow(plugin, upgrades) {
  const { primary, more } = rowActions(plugin, upgrades);
  const upgrade = plugin.source ? upgrades?.[plugin.source] : undefined;
  const attention = plugin.status === "blocked" || plugin.status === "missing";
  const status = { blocked: "Needs attention", missing: "Needs attention", ready: "Installed", unchecked: "Installed", available: "" }[plugin.status];
  const badge = status ? `<span class="scanner-status${attention ? " attention" : ""}">${status}</span>` : "";
  const reason = plugin.kind === "workSource" || plugin.match === "matched" ? "" : `<p>${escaped(scannerMatchReason(plugin))}</p>`;
  const version = [plugin.version, upgrade?.version].filter(Boolean).join(" → ");
  const metadata = [version, plugin.official ? "Official" : "Third-party"].filter(Boolean).join(" · ");
  const updateError = upgrade?.error ? `<p>Could not check for updates. ${escaped(upgrade.error)}</p>` : "";
  const details = detailLabel(plugin);
  return `<section class="scanner-row" data-scanner-id="${escaped(plugin.id)}"><div class="scanner-header"><div class="scanner-heading"><strong>${escaped(plugin.kind === "scanner" ? scannerName(plugin.id) : plugin.name)}</strong><span class="scanner-version">${escaped(metadata)}</span></div>${badge}<div class="scanner-primary">${primary}</div></div>` + `<details><summary>${details}</summary><div class="scanner-body"><code class="scanner-package">${escaped(plugin.source ?? plugin.installSource ?? plugin.name)}</code>` + `${reason}${plugin.message ? `<p>${escaped(plugin.message)}</p>` : ""}${plugin.kind === "scanner" ? detectionDetails(plugin) : ""}${updateError}<div class="scanner-actions">${more}</div></div></details></section>`;
}
function filterEvidence(input) {
  const body = input.closest(".scanner-body");
  const query = input.value.trim().toLocaleLowerCase();
  const items = [...body.querySelectorAll(".scanner-evidence li")];
  for (const item of items)
    item.hidden = !item.textContent.toLocaleLowerCase().includes(query);
  body.querySelector("[data-no-matches]").hidden = items.some((item) => !item.hidden);
}
function settingGroup(group, showBulk, upgrades) {
  const missing = group.plugins.every((plugin) => plugin.status === "missing");
  const recommended = group.plugins.every((plugin) => !plugin.listed);
  const action = missing ? "install-missing" : recommended ? "install-recommended" : undefined;
  const installable = group.plugins.filter((plugin) => plugin.status === "missing" || plugin.installSource).length;
  const bulk = showBulk && action && installable > 1 ? `<button class="chrome-button" type="button" data-group="${action}">${missing ? "Install missing" : "Install all"}</button>` : "";
  return `<section class="scanner-group"><div class="scanner-group-heading"><h2>${group.title}<span class="scanner-count">${group.plugins.length}</span></h2>${bulk}</div>${group.plugins.map((plugin) => settingRow(plugin, upgrades)).join("")}</section>`;
}
function bindPluginSettings(data, host, onState) {
  host.innerHTML = '<p class="scanner-notice" hidden></p><label class="scanner-updates"><input type="checkbox" data-automatic-updates>Automatic updates</label><div class="scanner-tools"><input type="search" aria-label="Search plugins" placeholder="Search plugins"><button class="chrome-button" type="button" data-add>Add plugin</button></div>' + '<form hidden><label>Plugin source<input name="source" placeholder="package name, package@version, Git URL, or local path" required></label><button class="chrome-button" type="submit">Add</button><button class="chrome-button" type="button" data-cancel>Cancel</button></form>' + '<details class="scanner-error" hidden><summary></summary><pre></pre></details><button class="chrome-button" type="button" data-retry hidden>Retry installation</button><div data-rows></div>';
  const rows = host.querySelector("[data-rows]");
  const error = host.querySelector(".scanner-error");
  const form = host.querySelector("form");
  const source = form.querySelector("input");
  const search = host.querySelector('input[type="search"]');
  const notice = host.querySelector(".scanner-notice");
  const retry = host.querySelector("[data-retry]");
  const automatic = host.querySelector("[data-automatic-updates]");
  let updateId;
  let state;
  let upgrades;
  let busy;
  let failedAction;
  function showError(title, message) {
    error.hidden = !message;
    error.querySelector("summary").textContent = title;
    error.querySelector("pre").textContent = message;
  }
  function paintRows(next) {
    const expanded = new Set([...rows.querySelectorAll("details[open]")].map((item) => item.closest("[data-scanner-id]")?.dataset.scannerId));
    const focused = document.activeElement?.closest("[data-scanner-id]")?.dataset.scannerId;
    const focusedSelector = document.activeElement?.matches("[data-evidence-search]") ? "[data-evidence-search]" : "button";
    const filters = new Map([...rows.querySelectorAll("[data-evidence-search]")].map((input) => [input.closest("[data-scanner-id]").dataset.scannerId, input.value]));
    const groups = pluginGroups(next.plugins, search.value);
    rows.innerHTML = groups.length ? groups.map((group) => settingGroup(group, !search.value.trim(), upgrades)).join("") : "<p>No plugins match.</p>";
    for (const detail of rows.querySelectorAll("details"))
      detail.open = expanded.has(detail.closest("[data-scanner-id]")?.dataset.scannerId);
    for (const input of rows.querySelectorAll("[data-evidence-search]")) {
      input.value = filters.get(input.closest("[data-scanner-id]").dataset.scannerId) ?? "";
      filterEvidence(input);
    }
    if (focused)
      rows.querySelector(`[data-scanner-id="${CSS.escape(focused)}"] ${focusedSelector}`)?.focus();
  }
  function setBusy() {
    automatic.disabled = busy !== undefined;
    for (const button of host.querySelectorAll("button"))
      button.disabled = busy !== undefined;
    if (!busy || !("id" in busy))
      return;
    const button = rows.querySelector(`[data-scanner-id="${CSS.escape(busy.id)}"] .scanner-primary button`);
    if (!button)
      return;
    button.textContent = busy.action === "remove" ? "Removing…" : busy.action === "update" ? "Updating…" : "Installing…";
  }
  function paint(next) {
    state = next;
    automatic.checked = next.automaticUpdates;
    onState(next);
    const tone = next.notice.tone;
    notice.dataset.tone = tone;
    notice.textContent = tone === "warning" ? "Showing saved architecture. Install scanners to update it from code." : tone === "error" ? "Scanning needs attention. Showing saved architecture." : next.notice.message;
    notice.hidden = !notice.textContent;
    paintRows(next);
    setBusy();
    const diagnostic = tone === "error" && !next.plugins.some((plugin) => plugin.status === "blocked") ? next.notice.message : next.limits.join(`
`);
    if (!failedAction)
      showError("Scanner details", diagnostic);
  }
  async function read(checkUpdates = false) {
    try {
      const next = await data.readPluginSettings(checkUpdates);
      if (checkUpdates)
        upgrades = next.upgrades;
      paint(checkUpdates ? state ?? next : next);
    } catch (cause) {
      showError("Could not load plugins", String(cause));
      if (!checkUpdates)
        onState({ automaticUpdates: state?.automaticUpdates ?? true, plugins: [], notice: { tone: "error", message: String(cause) }, limits: [] });
    }
  }
  function focusAction(action) {
    if (action.action === "automatic-updates") {
      automatic.focus();
      return;
    }
    const next = "id" in action ? rows.querySelector(`[data-scanner-id="${CSS.escape(action.id)}"] .scanner-primary button`) : undefined;
    (next ?? search).focus();
  }
  async function change(action) {
    if (busy)
      return;
    busy = action;
    failedAction = undefined;
    retry.hidden = true;
    if (state)
      paint(state);
    try {
      paint(await data.changePluginSettings(action));
    } catch (cause) {
      showError("Plugin action failed", cause instanceof Error ? cause.message : String(cause));
      failedAction = action;
      retry.hidden = false;
    } finally {
      busy = undefined;
      if (state)
        paintRows(state);
      setBusy();
      focusAction(action);
    }
  }
  function sourceForm(id) {
    updateId = id;
    form.hidden = false;
    source.value = state?.plugins.find((plugin) => plugin.id === id)?.source ?? "";
    form.querySelector("button").textContent = id ? "Update" : "Add";
    source.focus();
  }
  automatic.addEventListener("change", () => {
    change({ action: "automatic-updates", enabled: automatic.checked });
  });
  host.querySelector("[data-add]").addEventListener("click", () => sourceForm());
  host.querySelector("[data-cancel]").addEventListener("click", () => {
    form.hidden = true;
  });
  retry.addEventListener("click", () => {
    if (failedAction)
      change(failedAction);
  });
  search.addEventListener("input", () => {
    if (state)
      paintRows(state);
    setBusy();
    rows.scrollTop = 0;
  });
  rows.addEventListener("input", (event) => {
    if (event.target instanceof HTMLInputElement && event.target.matches("[data-evidence-search]"))
      filterEvidence(event.target);
  });
  rows.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (!button)
      return;
    if (button.dataset.group) {
      change({ action: button.dataset.group });
      return;
    }
    const id = button.dataset.id, action = button.dataset.action;
    switch (action) {
      case "retry":
        change({ action });
        break;
      case "update": {
        const plugin = state?.plugins.find((item) => item.id === id);
        const update = plugin?.kind === "workSource" ? { action: "update", id } : plugin && pluginUpgradeAction(plugin, upgrades);
        if (update)
          change(update);
        break;
      }
      case "version":
        sourceForm(id);
        break;
      case "install":
      case "restore":
      case "remove":
        change({ action, id });
        break;
    }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    form.hidden = true;
    change(updateId ? { action: "update", id: updateId, source: source.value } : { action: "add", source: source.value });
  });
  data.onPluginSettings = paint;
  read();
  return { refresh: () => read(true), focus(id) {
    if (!id) {
      search.focus();
      return;
    }
    search.value = "";
    if (state)
      paintRows(state);
    setBusy();
    const row = rows.querySelector(`[data-scanner-id="${CSS.escape(id)}"]`);
    if (!row) {
      search.focus();
      return;
    }
    row.querySelector("details").open = true;
    row.scrollIntoView({ block: "nearest" });
    row.querySelector("summary").focus();
  } };
}

// src/viewers/web/atoms/popover.ts
function bindPopover(root, options = {}) {
  const dismiss = options.dismiss ?? (() => root.removeAttribute("open"));
  document.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof Node) || root.contains(target) || options.companion?.contains(target))
      return;
    dismiss();
  });
}

// src/viewers/web/settings/model.ts
function scannerWarning(settings) {
  if (settings?.notice.tone !== "warning" && settings?.notice.tone !== "error")
    return;
  const scanners = settings.plugins.filter((plugin) => plugin.kind === "scanner");
  const scanner = scanners.find((item) => item.status === "blocked") ?? scanners.find((item) => item.status === "missing") ?? scanners.find((item) => item.match === "matched" && item.status === "available");
  return { scannerId: scanner?.id };
}
function scannerRecommendationCount(settings) {
  return settings?.plugins.filter((plugin) => plugin.kind === "scanner" && !plugin.listed && plugin.match === "matched").length ?? 0;
}

// src/viewers/web/settings/control.ts
function showRecommendations(control, name, count) {
  const badge = control.querySelector(".scanner-recommendations");
  badge.hidden = count === 0;
  badge.textContent = String(count);
  const label = count ? `${name}, ${count} matching scanner recommendation${count === 1 ? "" : "s"}` : name;
  control.setAttribute("aria-label", label);
  control.title = label;
}
function createProjectSettings(data) {
  const toggle = document.getElementById("settings-toggle");
  const menu = document.getElementById("settings-menu");
  const theme = document.getElementById("theme");
  const plugins = document.getElementById("plugins-settings");
  const dismiss = () => {
    menu.open = false;
    theme.open = false;
  };
  bindPopover(menu, { dismiss });
  menu.addEventListener("toggle", () => {
    if (!menu.open)
      theme.open = false;
  });
  menu.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key !== "Escape")
      return;
    event.preventDefault();
    if (theme.open) {
      theme.open = false;
      theme.querySelector("summary").focus();
    } else {
      dismiss();
      toggle.focus();
    }
  });
  if (!data.readPluginSettings || !data.changePluginSettings)
    return;
  const warning = document.getElementById("scanner-warning");
  plugins.hidden = false;
  let target;
  const popup = createSettingsDialog("project-settings", "Settings", '<h2 id="plugins-title">Plugins</h2><section id="scanner-settings" aria-labelledby="plugins-title"></section>');
  const settings = bindPluginSettings(data, popup.dialog.querySelector("#scanner-settings"), (state) => {
    const count = scannerRecommendationCount(state);
    showRecommendations(toggle, "Settings", count);
    showRecommendations(plugins, "Plugins", count);
    target = scannerWarning(state);
    warning.hidden = !target;
    const label = target?.scannerId ? `${target.scannerId} needs attention` : "Scanning needs attention";
    warning.title = label;
    warning.setAttribute("aria-label", label);
  });
  function openPlugins(opener, scannerId) {
    dismiss();
    popup.open(opener);
    settings.focus(scannerId);
    settings.refresh();
  }
  plugins.addEventListener("click", () => openPlugins(toggle));
  warning.addEventListener("click", () => openPlugins(warning, target?.scannerId));
  const emptySetup = document.getElementById("empty-scanners");
  emptySetup.hidden = false;
  emptySetup.addEventListener("click", () => openPlugins(emptySetup));
}

// src/viewers/web/duplicates/model.ts
function duplicateGroups(findings, owner, match) {
  return findings.filter((finding) => (match === "" || finding.match === match) && (owner === "" || finding.instances.some((instance) => instance.owner === owner)));
}
function operationSource(source, instance) {
  return source.replace(/\r\n/g, `
`).split(`
`).slice(instance.startLine - 1, instance.endLine).join(`
`);
}
function compareOperations(left, right, starts) {
  const result = [[], []];
  const numbers = [...starts];
  for (const change of diffLines(left, right)) {
    const lines = change.value.split(`
`);
    if (lines.at(-1) === "")
      lines.pop();
    for (const side of [0, 1]) {
      if (side === 0 && change.added || side === 1 && change.removed)
        continue;
      for (const text of lines)
        result[side].push({ number: numbers[side]++, text, changed: !!(change.added || change.removed) });
    }
  }
  return result;
}
function comparisonReader() {
  let generation = 0;
  return {
    invalidate() {
      generation++;
    },
    async read(load, publish) {
      const request = ++generation;
      try {
        const value = await load();
        if (request === generation)
          publish(value);
      } catch (error) {
        if (request === generation)
          publish(error instanceof Error ? error : new Error(String(error)));
      }
    }
  };
}

// src/viewers/web/duplicates/view.ts
function node(tag, text = "", className = "") {
  const element = document.createElement(tag);
  element.textContent = text;
  element.className = className;
  return element;
}
function choice(label, entries, value, change) {
  const select = node("select");
  select.setAttribute("aria-label", label);
  for (const [id, title] of entries) {
    const option = node("option", title);
    option.value = id;
    select.append(option);
  }
  select.value = value;
  select.addEventListener("change", () => change(select.value));
  return select;
}
function sourceColumn(instance, owner, lines, open) {
  const column = node("section", "", "duplicate-source");
  column.append(node("h3", instance.name), node("p", `${instance.file}:${instance.startLine}`, "duplicate-location"));
  if (owner !== undefined)
    column.append(node("p", owner, "duplicate-owner"));
  const code = node("ol");
  for (const line of lines) {
    const row = node("li", "", line.changed ? "changed" : "");
    const text = node("code");
    text.append(highlightedLine(line.text));
    row.append(node("span", String(line.number), "duplicate-line-number"), text);
    code.append(row);
  }
  column.append(code);
  if (owner !== undefined) {
    const actions = node("div", "", "duplicate-actions");
    for (const [label, source] of [["Open source", true], ["Show on map", false]]) {
      const button = chromeButton(label);
      button.addEventListener("click", () => open(source));
      actions.append(button);
    }
    column.append(actions);
  }
  return column;
}

// src/viewers/web/duplicates/control.ts
function createDuplicatesControl(options) {
  const panel = options.host;
  const detail = node("section", "", "duplicate-detail");
  const reader = comparisonReader();
  let owner = "";
  let match = "";
  let selected;
  let pair = [0, 1];
  function component(instance) {
    return options.world().elements.find((element) => element.id === instance.owner && element.kind === "component");
  }
  function navigate(instance, source) {
    const element = component(instance);
    if (element === undefined)
      return;
    options.close();
    options.navigate(element.representationId, source ? instance.file : undefined, source ? instance.startLine : undefined);
  }
  async function read(instance) {
    const element = component(instance);
    if (element === undefined)
      throw new Error(`No component owns ${instance.file}`);
    const payload = await options.readSource(element.representationId, instance.file, options.revision());
    return operationSource(payload.source, instance);
  }
  function comparison(finding, row) {
    const section = node("section");
    const selectors = node("div", "", "duplicate-filters");
    const entries = finding.instances.map((instance, index) => [String(index), `${instance.name} · ${instance.file}:${instance.startLine}`]);
    for (const side of [0, 1]) {
      selectors.append(choice(side === 0 ? "Left occurrence" : "Right occurrence", entries, String(pair[side]), (value) => {
        pair[side] = Number(value);
        if (pair[0] === pair[1])
          pair[1 - side] = Number(entries.find(([id]) => Number(id) !== pair[side])[0]);
        showComparison(finding);
      }));
    }
    const left = finding.instances[pair[0]];
    const right = finding.instances[pair[1]];
    const body = node("div", "Loading source", "duplicate-comparison");
    section.append(selectors, body);
    reader.read(async () => Promise.all([read(left), read(right)]), (result) => {
      if (result instanceof Error)
        body.textContent = result.message;
      else {
        const lines = compareOperations(result[0], result[1], [left.startLine, right.startLine]);
        body.replaceChildren(sourceColumn(left, component(left)?.title, lines[0], (source) => navigate(left, source)), sourceColumn(right, component(right)?.title, lines[1], (source) => navigate(right, source)));
      }
      row?.scrollIntoView({ block: "start" });
    });
    return section;
  }
  function showComparison(finding, row) {
    reader.invalidate();
    detail.replaceChildren(comparison(finding, row));
  }
  function filters(findings) {
    const owners = new Set(findings.flatMap((finding) => finding.instances.flatMap((instance) => instance.owner === undefined ? [] : [instance.owner])));
    const entries = options.world().elements.filter((element) => owners.has(element.id)).map((element) => [element.id, element.title]);
    const row = node("div", "", "duplicate-filters");
    row.append(choice("Component", [["", "All components"], ...entries], owner, (value) => {
      owner = value;
      paint();
    }), choice("Match", [["", "All matches"], ["exact", "Same structure"], ["similar", "Similar"]], match, (value) => {
      match = value;
      paint();
    }));
    return row;
  }
  function candidate(finding) {
    const row = node("button", "", "duplicate-row");
    row.type = "button";
    row.setAttribute("aria-expanded", String(finding.id === selected));
    const arrow = node("span", "›", "duplicate-arrow");
    arrow.setAttribute("aria-hidden", "true");
    row.append(arrow, node("span", finding.title), node("span", finding.match === "exact" ? "Same structure" : "Similar"), node("span", `${finding.instances.length} copies`));
    row.addEventListener("click", () => {
      selected = selected === finding.id ? undefined : finding.id;
      pair = [0, 1];
      reader.invalidate();
      detail.remove();
      for (const button of panel.querySelectorAll(".duplicate-row"))
        button.setAttribute("aria-expanded", String(button === row && selected !== undefined));
      if (selected === undefined)
        return;
      row.after(detail);
      showComparison(finding, row);
      row.scrollIntoView({ block: "start" });
    });
    return row;
  }
  function groupList(groups) {
    const list = node("div", "", "duplicate-list");
    for (const finding of groups) {
      list.append(candidate(finding));
      if (finding.id === selected) {
        list.append(detail);
        showComparison(finding);
      }
    }
    return list;
  }
  function paint() {
    reader.invalidate();
    const findings = options.world().findings;
    const groups = duplicateGroups(findings ?? [], owner, match);
    if (!groups.some((finding) => finding.id === selected)) {
      selected = undefined;
      pair = [0, 1];
    }
    const list = groupList(groups);
    const toolbar = node("div", "", "duplicate-toolbar");
    const count = groups.length === findings?.length ? String(groups.length) : `${groups.length} of ${findings?.length ?? 0}`;
    const heading = node("h2", `Potential duplicates · ${count}`);
    heading.id = "duplicates-title";
    toolbar.append(heading, filters(findings ?? []));
    panel.replaceChildren(toolbar, list);
    if (groups.length === 0)
      list.append(node("p", findings === undefined ? "No duplicate findings available for this view." : "No matching duplicate groups."));
  }
  return {
    show() {
      panel.hidden = false;
      paint();
    },
    hide() {
      panel.hidden = true;
      reader.invalidate();
    },
    refresh() {
      reader.invalidate();
      owner = "";
      selected = undefined;
      pair = [0, 1];
      if (!panel.hidden)
        paint();
    }
  };
}

// src/viewers/web/review/control.ts
function createProjectReview(options) {
  const toggle = document.getElementById("duplicates-toggle");
  const popup = createSettingsDialog("project-review", "Project review", '<section id="duplicates-panel" aria-labelledby="duplicates-title"></section>', { onClose: () => duplicates.hide() });
  const duplicates = createDuplicatesControl({ ...options, host: popup.dialog.querySelector("#duplicates-panel"), close: popup.close });
  function paintIndicator() {
    const count = options.world().findings?.length ?? 0;
    toggle.dataset.findings = String(count > 0);
    toggle.title = count ? `Project review · ${count} duplicate ${count === 1 ? "group" : "groups"}` : "Project review";
  }
  toggle.addEventListener("click", () => {
    popup.open(toggle);
    duplicates.show();
  });
  paintIndicator();
  return { refresh() {
    duplicates.refresh();
    paintIndicator();
  } };
}

// src/source-index.ts
var indices = new WeakMap;
function sourceIndex(elements) {
  const existing = indices.get(elements);
  if (existing)
    return existing;
  const byId = new Map(elements.map((element) => [element.id, element]));
  const byFile = new Map;
  for (const element of elements) {
    for (const reference of element.code) {
      const owner = byFile.get(reference.file);
      if (owner !== undefined && owner !== element.id)
        throw new Error(`source file "${reference.file}" has more than one owner`);
      byFile.set(reference.file, element.id);
    }
  }
  const owner = (file) => {
    const id = byFile.get(file);
    return id === undefined ? undefined : byId.get(id);
  };
  const index = { byFile, owner, resolve: (reference) => byId.get(reference) ?? owner(reference) };
  indices.set(elements, index);
  return index;
}

// src/work/pins.ts
function monogram(assignee) {
  return assignee.replace(/^@/, "").slice(0, 2).toUpperCase();
}
function touchedElements(item, world) {
  const index = sourceIndex(world.elements);
  const ids = [
    ...[...item.modifiedFiles].reverse().map((file) => index.owner(file)?.representationId),
    ...item.references.map((reference) => index.resolve(reference)?.representationId)
  ];
  return [...new Set(ids.filter((id) => id !== undefined))];
}
function elementWorkGroups(work, elementId, world) {
  const grouped = { todo: [], progress: [], done: [] };
  const terminal = work.statuses.at(-1);
  for (const item of work.items) {
    if (!touchedElements(item, world).includes(elementId))
      continue;
    const stage = item.status === work.defaultStatus ? "todo" : item.status === terminal ? "done" : "progress";
    grouped[stage].push(item);
  }
  return ["todo", "progress", "done"].filter((stage) => grouped[stage].length > 0).map((stage) => ({ stage, items: grouped[stage] }));
}

// src/viewers/web/chrome/add.ts
function createAddControl(button, add) {
  const dialog = document.createElement("dialog");
  dialog.id = "add-dialog";
  dialog.className = "verb-dialog";
  dialog.innerHTML = "<form><h1>Add</h1>" + '<label>What<select name="thing"><option value="actor">Person</option><option value="external">External system</option><option value="draft">Draft</option></select></label>' + '<label>Name<input name="name" required></label>' + '<label class="technology" hidden>Technology<input name="technology"></label>' + '<label>Overview<textarea name="overview" required></textarea></label>' + '<p class="error" role="status"></p>' + '<div class="actions"><button type="button" data-cancel>Cancel</button><button type="submit">Add</button></div></form>';
  document.body.append(dialog);
  const form = dialog.querySelector("form");
  const thing = form.elements.namedItem("thing");
  const name = form.elements.namedItem("name");
  const technology = form.elements.namedItem("technology");
  const technologyField = form.querySelector(".technology");
  const overview = form.elements.namedItem("overview");
  const error = form.querySelector(".error");
  const submit = form.querySelector('button[type="submit"]');
  const showFields = () => {
    technologyField.hidden = thing.value !== "external";
  };
  thing.addEventListener("change", showFields);
  form.querySelector("[data-cancel]").addEventListener("click", () => dialog.close());
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    error.textContent = "";
    try {
      await add({
        thing: thing.value,
        name: name.value,
        overview: overview.value,
        ...thing.value === "external" && technology.value !== "" ? { technology: technology.value } : {}
      });
      dialog.close();
    } catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : String(cause);
    } finally {
      submit.disabled = false;
    }
  });
  button.addEventListener("click", () => {
    form.reset();
    error.textContent = "";
    showFields();
    dialog.showModal();
    name.focus();
  });
}

// src/empty-world.ts
function isEmptyWorld(world) {
  return world.elements.length === 0;
}
function hasComponents(world) {
  return world.elements.some((element) => element.kind === "component");
}
function awaitsCuration(world) {
  return hasComponents(world) && world.elements.every((element) => !element.description && element.overview.trim() === "");
}
var noComponentsTitle = "No component found!";
var noComponentsHint = "Run groma scanner setup to review project coverage.";
var firstScanTitle = "First scan";
var firstScanHint = "Ask your coding agent to curate this architecture.";

// src/viewers/web/chrome/empty.ts
function emptyMessage(world) {
  if (isEmptyWorld(world))
    return { title: "Your map starts here", hint: "Add code when you're ready. Set up scanners to bring it into your map." };
  return hasComponents(world) ? { title: firstScanTitle, hint: firstScanHint } : { title: noComponentsTitle, hint: noComponentsHint };
}
function needsNotice(world) {
  return !hasComponents(world) || awaitsCuration(world);
}
function welcomeCard(host) {
  if (host.hidden || host.classList.contains("has-architecture"))
    return;
  return host.querySelector(".empty-card").getBoundingClientRect();
}
function createEmptyState(host) {
  const title = host.querySelector(".project");
  const heading = host.querySelector("h1");
  const hint = host.querySelector(".hint");
  const prompt = host.querySelector(".curation-prompt");
  const copy = host.querySelector(".copy-prompt");
  let copyLabelTimeout;
  copy.addEventListener("click", async () => {
    clearTimeout(copyLabelTimeout);
    try {
      await navigator.clipboard.writeText(prompt.textContent);
      copy.textContent = "Copied";
      copyLabelTimeout = setTimeout(() => {
        copy.textContent = "Copy prompt";
      }, 2000);
    } catch {
      copy.textContent = "Copy failed";
    }
  });
  let dismissed = false;
  host.querySelector(".dismiss").addEventListener("click", () => {
    dismissed = true;
    host.hidden = true;
  });
  return {
    paint(world, project, historical) {
      const empty = isEmptyWorld(world);
      const message = emptyMessage(world);
      host.hidden = historical || !needsNotice(world) || dismissed && !empty;
      host.classList.toggle("has-architecture", !empty);
      host.classList.toggle("first-scan", awaitsCuration(world));
      title.textContent = project?.title ?? "";
      heading.textContent = message.title;
      hint.textContent = message.hint;
    }
  };
}

// src/viewers/web/chrome/map-debug.ts
var SAMPLE_MS = 500;
function framesPerSecond(frames, elapsedMs) {
  return Math.round(frames * 1000 / elapsedMs);
}
function mapDebugSnapshot(map, client) {
  return {
    generation: map.generation,
    timings: { ...map.timings, ...client },
    counts: {
      elements: map.world.elements.length,
      relationships: map.world.relationships.length,
      buildings: map.sheet.buildings.length,
      routes: map.sheet.routes.length,
      routePoints: map.sheet.routes.reduce((total, route) => total + route.points.length, 0),
      surfaces: map.sheet.islands.length + map.sheet.slabs.length + map.sheet.zones.length,
      sheetWidth: map.sheet.sheet.w,
      sheetHeight: map.sheet.sheet.d,
      sheetCells: map.sheet.sheet.w * map.sheet.sheet.d
    }
  };
}
function milliseconds(value) {
  return `${value < 100 ? value.toFixed(1) : Math.round(value)} ms`;
}
function mapDebugValues(snapshot) {
  return {
    total: milliseconds(snapshot.timings.totalMilliseconds),
    architecture: milliseconds(snapshot.timings.architectureLoadMilliseconds),
    placement: milliseconds(snapshot.timings.placementMilliseconds),
    routing: milliseconds(snapshot.timings.routingMilliseconds),
    projection: milliseconds(snapshot.timings.projectionMilliseconds),
    paint: milliseconds(snapshot.timings.paintMilliseconds),
    generation: String(snapshot.generation),
    elements: String(snapshot.counts.elements),
    relationships: String(snapshot.counts.relationships),
    buildings: String(snapshot.counts.buildings),
    surfaces: String(snapshot.counts.surfaces),
    routes: String(snapshot.counts.routes),
    routePoints: String(snapshot.counts.routePoints),
    sheet: `${snapshot.counts.sheetWidth.toFixed(1)} × ${snapshot.counts.sheetHeight.toFixed(1)}`,
    sheetCells: String(Math.round(snapshot.counts.sheetCells))
  };
}
function createMapDebugPanel(host, currentMap) {
  const panel = document.createElement("aside");
  panel.id = "map-debug";
  panel.setAttribute("aria-label", "Map debug");
  panel.hidden = true;
  panel.innerHTML = `
    <header><h1>Map debug</h1><output data-value="fps" aria-live="polite">-- FPS</output></header>
    <h2>Server</h2><dl>
      <dt>Map total</dt><dd data-value="total"></dd>
      <dt>Architecture</dt><dd data-value="architecture"></dd>
      <dt>Placement</dt><dd data-value="placement"></dd>
      <dt>Routing</dt><dd data-value="routing"></dd>
    </dl>
    <h2>Browser</h2><dl>
      <dt>Projection</dt><dd data-value="projection"></dd>
      <dt>SVG paint</dt><dd data-value="paint"></dd>
    </dl>
    <h2>Map</h2><dl>
      <dt>Generation</dt><dd data-value="generation"></dd>
      <dt>Elements</dt><dd data-value="elements"></dd>
      <dt>Relationships</dt><dd data-value="relationships"></dd>
      <dt>Buildings</dt><dd data-value="buildings"></dd>
      <dt>Surfaces</dt><dd data-value="surfaces"></dd>
      <dt>Routes</dt><dd data-value="routes"></dd>
      <dt>Route points</dt><dd data-value="routePoints"></dd>
      <dt>Sheet</dt><dd data-value="sheet"></dd>
      <dt>Cells</dt><dd data-value="sheetCells"></dd>
    </dl>`;
  host.append(panel);
  const value = (key) => panel.querySelector(`[data-value="${key}"]`);
  const fps = value("fps");
  const client = { projectionMilliseconds: 0, paintMilliseconds: 0 };
  let animation;
  let sampleStart;
  let frames = 0;
  const tick = (now) => {
    if (sampleStart === undefined)
      sampleStart = now;
    else {
      frames += 1;
      const elapsed = now - sampleStart;
      if (elapsed >= SAMPLE_MS) {
        fps.textContent = `${framesPerSecond(frames, elapsed)} FPS`;
        sampleStart = now;
        frames = 0;
      }
    }
    animation = requestAnimationFrame(tick);
  };
  const update = (snapshot) => {
    for (const [key, text] of Object.entries(mapDebugValues(snapshot)))
      value(key).textContent = text;
  };
  return {
    project(work) {
      const started = performance.now();
      const result = work();
      client.projectionMilliseconds = performance.now() - started;
      return result;
    },
    paint(work) {
      const started = performance.now();
      const result = work();
      client.paintMilliseconds = performance.now() - started;
      if (!panel.hidden)
        update(mapDebugSnapshot(currentMap(), client));
      return result;
    },
    toggle() {
      panel.hidden = !panel.hidden;
      if (panel.hidden) {
        if (animation !== undefined)
          cancelAnimationFrame(animation);
        animation = undefined;
        return;
      }
      update(mapDebugSnapshot(currentMap(), client));
      fps.textContent = "-- FPS";
      sampleStart = undefined;
      frames = 0;
      animation = requestAnimationFrame(tick);
    }
  };
}

// src/viewers/atoms/kind.ts
var glyphs = {
  actor: "●",
  system: "■",
  container: "▱",
  component: "▪"
};
var labels = {
  actor: "Actor",
  system: "System",
  container: "Container",
  component: "Component"
};
function kindGlyph(kind) {
  return glyphs[kind];
}
function kindLabel(kind, external = false) {
  const label = labels[kind];
  return external ? `External ${label.toLowerCase()}` : label;
}

// src/viewers/web/chrome/c4-filter.ts
var filters = [
  { filter: "actor", icon: '<circle cx="12" cy="12" r="7" fill="currentColor" stroke="none"/>' },
  { filter: "system", icon: '<rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" stroke="none"/>' },
  { filter: "container", icon: '<path d="M8 6h13l-5 12H3L8 6Z"/>' },
  { filter: "component", icon: '<rect x="8" y="8" width="8" height="8" rx="1.3" fill="currentColor" stroke="none"/>' },
  { filter: "relationship", icon: '<path d="M4 12h16m-5-5 5 5-5 5"/>' }
];
function readHiddenFilters(value) {
  const requested = value.split(",");
  return new Set(filters.map((item) => item.filter).filter((filter) => requested.includes(filter)));
}
function filterC4Scene(scene, hidden) {
  if (hidden.size === 0)
    return scene;
  const islands = scene.islands.filter(({ island }) => !hidden.has(island.kind === "actors" ? "actor" : "system"));
  const slabs = hidden.has("container") ? [] : scene.slabs;
  const buildings = scene.buildings.filter(({ building }) => !hidden.has(building.kind));
  const visible = new Set([
    ...islands.flatMap(({ island }) => island.element === null ? [] : [island.element.representationId]),
    ...slabs.map(({ slab }) => slab.representationId),
    ...buildings.map(({ building }) => building.representationId)
  ]);
  return {
    ...scene,
    islands,
    slabs,
    buildings,
    zones: scene.zones.filter(({ zone }) => zone.members.some((id) => visible.has(id))),
    routes: hidden.has("relationship") ? [] : scene.routes.filter(({ route }) => visible.has(route.source) && visible.has(route.target)),
    layerPlanes: scene.layerPlanes.filter((plane) => !hidden.has(plane.layer))
  };
}
function bindC4Filter(host, initial, onChange) {
  let hidden = new Set(initial);
  function paint() {
    for (const { filter } of filters) {
      host.querySelector(`[data-filter="${filter}"]`).setAttribute("aria-pressed", String(!hidden.has(filter)));
    }
  }
  for (const { filter } of filters) {
    const button = host.querySelector(`button[data-filter="${filter}"]`);
    button.addEventListener("click", () => {
      if (hidden.has(filter))
        hidden.delete(filter);
      else
        hidden.add(filter);
      button.setAttribute("aria-pressed", String(!hidden.has(filter)));
      onChange();
    });
  }
  paint();
  return {
    get hidden() {
      return hidden;
    },
    project: (scene) => filterC4Scene(scene, hidden),
    setHidden(next) {
      hidden = new Set(next);
      paint();
    }
  };
}

// src/viewers/web/chrome/map-view.ts
var MAP_CONTROLS_STORAGE_KEY = "groma.mapControls";
var views = [
  { value: "iso", label: "Iso", title: "Isometric", icon: '<path d="m12 3 9 5v8l-9 5-9-5V8l9-5ZM3 8l9 5 9-5m-9 5v8M12 3v10"/>' },
  { value: "2d", label: "2D", title: "2D overhead", icon: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 11h16m-9 0v9"/>' },
  { value: "layers", label: "Layers", title: "Layers (F2)", icon: '<path d="m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5"/>' }
];
function readMapControls(params, defaults) {
  const requested = params.get("view");
  return {
    mapView: views.find((view) => view.value === requested)?.value ?? defaults?.mapView ?? "iso",
    hiddenFilters: params.has("hide") ? readHiddenFilters(params.get("hide")) : new Set(defaults?.hiddenFilters)
  };
}
function mapControlEntries(controls) {
  return [["view", controls.mapView], ["hide", [...controls.hiddenFilters].join(",")]];
}
function readSavedMapControls(storage) {
  return readMapControls(new URLSearchParams(storage.getItem(MAP_CONTROLS_STORAGE_KEY) ?? ""));
}
function saveMapControls(controls, storage) {
  storage.setItem(MAP_CONTROLS_STORAGE_KEY, new URLSearchParams(mapControlEntries(controls)).toString());
}
function bindMapView(host, choose) {
  const tabs = [...host.querySelectorAll('[role="tab"]')];
  const indicator = host.querySelector(".view-indicator");
  let selectedView;
  function placeIndicator() {
    const tab = tabs.find((tab) => tab.getAttribute("aria-selected") === "true");
    if (!tab.offsetWidth)
      return;
    indicator.style.transform = `translateX(${tab.offsetLeft}px)`;
    indicator.style.width = `${tab.offsetWidth}px`;
  }
  new ResizeObserver(placeIndicator).observe(host);
  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener("click", () => choose(tab.dataset.view));
    tab.addEventListener("keydown", (event) => {
      const next = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
      if (next === undefined)
        return;
      event.preventDefault();
      event.stopPropagation();
      tabs[next].focus();
      tabs[next].click();
    });
  }
  return (view) => {
    if (view === selectedView)
      return;
    selectedView = view;
    for (const tab of tabs) {
      const selected = tab.dataset.view === view;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    placeIndicator();
  };
}

// src/viewers/web/chrome/frame.ts
function measureFrame(hosts, hudVisible) {
  return mapFrame(hosts.host.getBoundingClientRect(), hosts.headerHost.getBoundingClientRect(), hosts.hierarchyHost.getBoundingClientRect(), { left: hosts.detailsDock.offsetLeft, hidden: hosts.detailsHost.inert }, hudVisible, welcomeCard(hosts.emptyHost));
}
function mapFrame(map, header, hierarchy, details, hudVisible, welcome) {
  const safe = hudVisible ? {
    x: hierarchy.right - map.left + 12,
    y: header.bottom - map.top + 12,
    right: details.hidden ? map.width : details.left - map.left - 12,
    bottom: map.height - 12
  } : { x: 0, y: 0, right: map.width, bottom: map.height };
  const y = welcome === undefined ? safe.y : Math.max(safe.y, welcome.bottom - map.top + 12);
  return {
    x: safe.x,
    y,
    width: Math.max(safe.right - safe.x, 1),
    height: Math.max(safe.bottom - y, 1)
  };
}

// src/viewers/web/selection.ts
var noSelection = { kind: "none" };
function primarySystem(world) {
  return world.elements.filter((element) => element.kind === "system" && !element.external).sort(compareSemanticElements)[0];
}
function primarySelection(selection) {
  if (selection.kind === "task" || selection.kind === "flow")
    return selection.id;
  return selection.kind === "architecture" ? selection.ids.at(-1) : undefined;
}
function selectedArchitecture(selection) {
  return selection.kind === "architecture" ? selection.ids : [];
}
function ownsDetails(selection) {
  return selection.kind !== "none";
}
function selectArchitecture(selection, id, additive) {
  if (!additive || selection.kind !== "architecture")
    return { kind: "architecture", ids: [id] };
  if (!selection.ids.includes(id))
    return { kind: "architecture", ids: [...selection.ids, id] };
  const ids = selection.ids.filter((selected) => selected !== id);
  return ids.length === 0 ? noSelection : { kind: "architecture", ids };
}
function selectTask(id) {
  return { kind: "task", id };
}
function selectMapArchitecture(selection, id, additive, world) {
  const target = world.elements.find((element) => element.representationId === id);
  const selected = selectedArchitecture(selection);
  if (!additive && target?.kind === "system" && !target.external && world.elements.some((element) => element.kind === "component" && selected.includes(element.representationId))) {
    return noSelection;
  }
  return selectArchitecture(selection, id, additive);
}
function retainSelection(selection, known) {
  if (selection.kind === "none")
    return selection;
  if (selection.kind === "task" || selection.kind === "flow")
    return known(selection.id) ? selection : noSelection;
  const ids = selection.ids.filter(known);
  return ids.length === 0 ? noSelection : { kind: "architecture", ids };
}

// src/viewers/web/chrome/shortcuts.ts
var toggles = { F1: "hud", F2: "layers", F3: "debug" };
var mapKeys = {
  "+": "zoomIn",
  "=": "zoomIn",
  "-": "zoomOut",
  _: "zoomOut",
  "0": "fit",
  Escape: "deselect"
};
function shortcut(key, typing) {
  return toggles[key] ?? (typing ? undefined : mapKeys[key]);
}
function isTextField(target) {
  return target instanceof Element && !target.closest('input[type="radio"], input[type="checkbox"]') && target.closest("input, textarea, [contenteditable]") !== null;
}
function bindShortcuts(actions) {
  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey)
      return;
    const name = shortcut(event.key, isTextField(event.target));
    if (name === undefined)
      return;
    event.preventDefault();
    actions[name]();
  });
}

// src/viewers/web/chrome/shell.ts
function bindChromeActions(actions) {
  bindShortcuts(actions);
  document.getElementById("zoom-in").addEventListener("click", actions.zoomIn);
  document.getElementById("zoom-out").addEventListener("click", actions.zoomOut);
  document.getElementById("fit").addEventListener("click", actions.fit);
  document.getElementById("details-close").addEventListener("click", actions.deselect);
  bindPopover(document.getElementById("help"));
  bindPopover(document.getElementById("credits"));
}
function pageHosts() {
  const byId = (id) => document.getElementById(id);
  return {
    host: byId("map"),
    headerHost: byId("header"),
    hierarchyHost: byId("hierarchy"),
    treeHost: byId("tree"),
    flowsHost: byId("flows"),
    statsHost: byId("stats"),
    revisionBox: byId("revision"),
    searchRoot: byId("web-search"),
    detailsHost: byId("details"),
    detailsDock: byId("details-dock"),
    zoomHost: byId("zoom"),
    hierarchyContent: byId("hierarchy-content"),
    hierarchyToggle: byId("hierarchy-toggle"),
    emptyHost: byId("empty")
  };
}
function createDetailsExpansion() {
  let choice;
  return {
    expanded(fileOpen) {
      return choice ?? fileOpen;
    },
    toggle(fileOpen) {
      choice = !(choice ?? fileOpen);
    }
  };
}
function createWebShell(root, hierarchyContent, hierarchyToggle, details, map) {
  let hierarchyOpen = true;
  let previousSelection = { kind: "none" };
  const expansion = createDetailsExpansion();
  const expand = details.querySelector("#details-expand");
  const paintExpansion = () => {
    const expanded = expansion.expanded(details.classList.contains("file-open"));
    root.classList.toggle("details-expanded", expanded);
    expand.setAttribute("aria-expanded", String(expanded));
    expand.title = expanded ? "Collapse details" : "Expand details";
    expand.setAttribute("aria-label", expand.title);
  };
  expand.addEventListener("click", () => {
    expansion.toggle(details.classList.contains("file-open"));
    paintExpansion();
  });
  const paintHierarchy = () => {
    root.classList.toggle("hierarchy-collapsed", !hierarchyOpen);
    hierarchyContent.toggleAttribute("inert", !hierarchyOpen);
    hierarchyContent.setAttribute("aria-hidden", String(!hierarchyOpen));
    hierarchyToggle.setAttribute("aria-expanded", String(hierarchyOpen));
    hierarchyToggle.setAttribute("aria-label", hierarchyOpen ? "Collapse hierarchy" : "Expand hierarchy");
  };
  hierarchyToggle.addEventListener("click", () => {
    hierarchyOpen = !hierarchyOpen;
    paintHierarchy();
  });
  paintHierarchy();
  return {
    setHud(visible) {
      root.classList.toggle("hud-hidden", !visible);
    },
    paint(selection) {
      paintExpansion();
      if (selection.kind !== previousSelection.kind || primarySelection(selection) !== primarySelection(previousSelection)) {
        details.scrollTop = 0;
      }
      previousSelection = selection;
      const open = ownsDetails(selection);
      const ownedFocus = details.contains(document.activeElement);
      root.classList.toggle("details-hidden", !open);
      details.toggleAttribute("inert", !open);
      details.setAttribute("aria-hidden", String(!open));
      if (!open && ownedFocus)
        map.focus({ preventScroll: true });
    }
  };
}

// src/viewers/web/atoms/theme.ts
var webFontFamily = "'DejaVu Sans Mono', monospace";
function mixColour(paper, ink, share) {
  const channel = (colour, index) => Number.parseInt(colour.slice(index, index + 2), 16);
  const channels = [1, 3, 5].map((index) => Math.round(channel(paper, index) * (1 - share) + channel(ink, index) * share).toString(16).padStart(2, "0")).join("");
  return `#${channels}`;
}
var themeModes = ["auto", "light", "dark", "blueprint"];
function isThemeMode(value) {
  return themeModes.includes(value);
}
function resolveTheme(mode, prefersDark) {
  return mode === "auto" ? prefersDark ? "dark" : "light" : mode;
}
function themeLabel(mode) {
  return mode[0].toUpperCase() + mode.slice(1);
}

// src/viewers/web/chrome/theme-control.ts
var THEME_STORAGE_KEY = "groma.theme";
function readSavedTheme(storage) {
  const saved = storage.getItem(THEME_STORAGE_KEY);
  return isThemeMode(saved) ? saved : "auto";
}
function bindThemeControl(control, initial, onChange, storage = localStorage, preference = matchMedia("(prefers-color-scheme: dark)")) {
  const label = control.querySelector(".label");
  const transition = createThemeTransition(document.body);
  let mode = initial;
  const applyTheme = () => {
    const theme = resolveTheme(mode, preference.matches);
    control.dataset.themeMode = mode;
    label.textContent = themeLabel(mode);
    for (const option of control.querySelectorAll(".theme-option")) {
      option.setAttribute("aria-current", String(option.dataset.themeMode === mode));
    }
    if (theme === "light")
      delete document.documentElement.dataset.theme;
    else
      document.documentElement.dataset.theme = theme;
  };
  control.addEventListener("click", (event) => {
    const option = event.target instanceof Element ? event.target.closest(".theme-option[data-theme-mode]") : null;
    if (option === null || !control.contains(option))
      return;
    const selected = option.dataset.themeMode;
    if (!isThemeMode(selected))
      return;
    control.removeAttribute("open");
    control.querySelector("summary").focus();
    storage.setItem(THEME_STORAGE_KEY, selected);
    if (selected === mode) {
      onChange();
      return;
    }
    transition(() => {
      mode = selected;
      applyTheme();
      onChange();
    });
  });
  bindPopover(control);
  preference.addEventListener("change", () => {
    if (mode === "auto")
      transition(applyTheme);
  });
  applyTheme();
  return {
    get mode() {
      return mode;
    }
  };
}

// src/viewers/web/chrome/stats.ts
function c4Counts(world) {
  const counts = { system: 0, container: 0, component: 0 };
  for (const element of world.elements) {
    if (element.kind === "actor" || element.external)
      continue;
    counts[element.kind] += 1;
  }
  return counts;
}
function paintHeaderSummary(host, world, project) {
  host.replaceChildren();
  if (project === undefined)
    return;
  const name = document.createElement("span");
  name.className = "project-name";
  name.textContent = project.title;
  const counts = document.createElement("span");
  counts.className = "world-counts";
  const text = document.createElement("span");
  text.textContent = Object.entries(c4Counts(world)).map(([kind, count]) => `${count} ${kind}${count === 1 ? "" : "s"}`).join(" · ");
  counts.append(text);
  host.append(name, counts);
}

// src/viewers/web/payload.ts
var PUBLISHED_EVENT = "groma:published";
var PUBLISHED_VERSION_EVENT = "groma:published-version";

// src/viewers/web/data.ts
async function responseJson(path) {
  const response = await fetch(path);
  if (!response.ok)
    throw new Error(await response.text());
  return response.json();
}
async function send(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const message = response.headers.get("Content-Type")?.includes("application/json") ? (await response.json()).message : await response.text();
    throw new Error(message);
  }
}
function selected(path, values) {
  const query = new URLSearchParams;
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined)
      query.set(key, value);
  }
  return `${path}?${query}`;
}
var liveWriters = {
  readPluginSettings: (checkUpdates) => responseJson(checkUpdates ? "/plugin-settings?updates" : "/plugin-settings"),
  async changePluginSettings(action) {
    const response = await fetch("/plugin-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) });
    if (!response.ok)
      throw new Error(await response.text());
    return response.json();
  },
  draft: (input) => send("/draft", input),
  add: (input) => send("/add", input),
  remove: (input) => send("/remove", input),
  edit: (input) => send("/edit", input),
  accept: (input) => send("/accept", input)
};
function liveDataSource(readOnly) {
  return {
    ...readOnly ? {} : liveWriters,
    readRevisions() {
      return responseJson("/revisions.json");
    },
    readWorld(revision, from) {
      return responseJson(selected("/world.json", { revision, from }));
    },
    readCode(element, revision, from) {
      return responseJson(selected("/code.json", { element, revision, from }));
    },
    readSource(element, file, revision, from) {
      return responseJson(selected("/source.json", { element, file, revision, from }));
    },
    readTask(id) {
      return responseJson(selected("/task.json", { task: id }));
    },
    readTaskDiff(id) {
      return responseJson(selected("/task-diff.json", { task: id }));
    },
    subscribe(handlers) {
      const events = new EventSource("/events");
      events.addEventListener("plugin-settings", (event) => this.onPluginSettings?.(JSON.parse(event.data)));
      events.addEventListener("world", (event) => {
        handlers.world(JSON.parse(event.data));
      });
      events.addEventListener("work", (event) => {
        handlers.work(JSON.parse(event.data));
      });
      return { close: () => events.close() };
    }
  };
}
function publishedDataSource(boot) {
  let snapshot = boot;
  return {
    async readRevisions() {
      return snapshot.revisions;
    },
    async readWorld(revision, from) {
      return publishedView(snapshot, revision, from).payload;
    },
    async readCode(element, revision, from) {
      return publishedView(snapshot, revision, from).reads.code.find((item) => item.element === element)?.files ?? [];
    },
    async readSource(_element, file, revision, from) {
      const found = publishedView(snapshot, revision, from).reads.sources.find((item) => item.file === file);
      if (found === undefined)
        throw new Error("Source file not found");
      return found.source;
    },
    async readTask() {
      throw new Error("Tasks are unavailable in static Groma");
    },
    async readTaskDiff() {
      throw new Error("Tasks are unavailable in static Groma");
    },
    subscribe(handlers) {
      let checking = false;
      let loadingSnapshot = false;
      const load = (name, done) => {
        const script = document.createElement("script");
        script.src = new URL(name, document.baseURI).toString();
        const finish = () => {
          done();
          script.remove();
        };
        script.addEventListener("load", finish, { once: true });
        script.addEventListener("error", finish, { once: true });
        document.head.append(script);
      };
      const receive = (event) => {
        const next = event.detail;
        if (next.delivery.kind !== "published" || next.generation <= snapshot.generation)
          return;
        snapshot = next;
        handlers.world(next);
      };
      const receiveVersion = (event) => {
        const generation = event.detail;
        if (generation <= snapshot.generation || loadingSnapshot)
          return;
        loadingSnapshot = true;
        load(`snapshot.js?${generation}`, () => {
          loadingSnapshot = false;
        });
      };
      const poll = () => {
        if (checking)
          return;
        checking = true;
        load(`version.js?${Date.now()}`, () => {
          checking = false;
        });
      };
      window.addEventListener(PUBLISHED_EVENT, receive);
      window.addEventListener(PUBLISHED_VERSION_EVENT, receiveVersion);
      const timer = window.setInterval(poll, 1000);
      return {
        close() {
          window.clearInterval(timer);
          window.removeEventListener(PUBLISHED_EVENT, receive);
          window.removeEventListener(PUBLISHED_VERSION_EVENT, receiveVersion);
        }
      };
    }
  };
}
function publishedView(boot, revision, from) {
  if (boot.delivery.kind !== "published")
    throw new Error("Published snapshot unavailable");
  const view = boot.delivery.views.find(({ payload }) => payload.revision?.id === revision && (payload.comparison === undefined ? undefined : payload.comparison.from?.id ?? "") === from);
  if (view === undefined)
    throw new Error("This revision is not available in this static Groma");
  return view;
}
function openWebBoot(boot, url) {
  const params = new URLSearchParams(url.search);
  if (boot.delivery.kind === "live" || !params.has("revision") && !params.has("from"))
    return boot;
  const view = publishedView(boot, params.get("revision") ?? undefined, params.get("from") ?? undefined);
  return { ...view.payload, delivery: boot.delivery };
}
function createWebDataSource(boot) {
  return boot.delivery.kind === "live" ? liveDataSource(boot.delivery.readOnly === true) : publishedDataSource(boot);
}

// src/viewers/web/embedding.ts
function listenForEmbeddedViews(page, openView) {
  if (page.parent === page)
    return;
  page.addEventListener("message", (event) => {
    if (event.source !== page.parent)
      return;
    const view = event.data?.gromaView;
    if (typeof view === "string")
      openView(view);
  });
  page.parent.postMessage({ gromaReady: true }, "*");
}

// src/viewers/web/organisms/sidebar-row.ts
function disclosureChevron() {
  const chevron = document.createElement("span");
  chevron.className = "chevron";
  chevron.setAttribute("aria-hidden", "true");
  return chevron;
}
function replaceTreeChildren(host, ...children) {
  const selector = "[data-id][aria-expanded]";
  const previous = new Map([...host.querySelectorAll(selector)].map((row) => [row.dataset.id, row.getAttribute("aria-expanded")]));
  host.replaceChildren(...children);
  for (const row of host.querySelectorAll(selector)) {
    const before = previous.get(row.dataset.id);
    const after = row.getAttribute("aria-expanded");
    if (before !== undefined && before !== after) {
      animateDisclosure(row.querySelector(".chevron"), after === "true");
    }
  }
}
function sidebarBranches(followingSiblings) {
  return followingSiblings.map((follows, index) => {
    const branch = document.createElement("span");
    const current = index === followingSiblings.length - 1;
    branch.className = `branch${current ? " current" : ""}${follows ? "" : current ? " end" : " blank"}`;
    branch.setAttribute("aria-hidden", "true");
    return branch;
  });
}
function sidebarRow(title, kind, fold) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "row";
  if (fold)
    button.setAttribute("aria-expanded", String(fold.expanded));
  const twist = document.createElement("span");
  twist.className = "twist";
  twist.setAttribute("aria-hidden", "true");
  if (fold) {
    twist.classList.add("toggle");
    twist.append(disclosureChevron());
    twist.addEventListener("click", (event) => {
      event.stopPropagation();
      fold.toggle();
    });
  }
  const mark = document.createElement("span");
  mark.className = `mark kind-${kind}`;
  mark.setAttribute("aria-hidden", "true");
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = fold ? `${title} (${fold.count})` : title;
  button.append(twist, mark, name);
  return button;
}

// src/viewers/web/organisms/sidebar-section.ts
function sectionHeading(name, expanded, onToggle) {
  const heading = document.createElement("button");
  heading.type = "button";
  heading.className = "section tree-section";
  heading.dataset.id = `section:${name}`;
  const twist = document.createElement("span");
  twist.className = "twist";
  twist.append(disclosureChevron());
  heading.append(twist, document.createTextNode(name));
  heading.setAttribute("aria-expanded", String(expanded));
  heading.addEventListener("click", onToggle);
  return heading;
}

// src/viewers/web/flow/row.ts
function flowRow(row, active, onToggle) {
  const selected = active.some((flow) => flow.id === row.flow.id);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "flow-row";
  button.setAttribute("aria-pressed", String(selected));
  button.setAttribute("aria-label", row.title);
  button.title = row.title;
  button.classList.toggle("active", selected);
  const check = document.createElement("span");
  check.className = "flow-check";
  check.setAttribute("aria-hidden", "true");
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = row.title;
  button.append(check, name);
  button.addEventListener("click", () => onToggle(row.flow));
  return button;
}

// src/viewers/web/flow/list.ts
function groupedTitle(title, actorTitle) {
  const separator = title.indexOf(": ");
  if (separator < 0)
    return title;
  const prefix = title.slice(0, separator).toLowerCase();
  const actor = actorTitle.toLowerCase();
  return actor === prefix || actor.endsWith(` ${prefix}`) ? title.slice(separator + 2) : title;
}
function createFlowList() {
  let unfolded = true;
  const expandedActors = new Set;
  return function paintFlows(host, world, active, onToggle, options) {
    host.classList.add("flow-tree");
    const { title, visibleFlows } = options;
    const visibleIds = visibleFlows && new Set(visibleFlows.map((row) => row.flow.id));
    const flows = world.flows.filter((flow) => visibleIds === undefined || visibleIds.has(flow.id));
    const contextActor = world.elements.find((element) => element.kind === "actor" && element.id === options.contextId);
    const actors = world.elements.filter((element) => element.kind === "actor" && element.id !== contextActor?.id && (visibleIds === undefined || flows.some((flow) => flow.steps[0]?.source === element.id)));
    if (flows.length === 0 && actors.length === 0) {
      host.replaceChildren();
      return;
    }
    const heading = sectionHeading(title, unfolded, () => {
      unfolded = !unfolded;
      paintFlows(host, world, active, onToggle, options);
    });
    const list = document.createElement("div");
    list.hidden = !unfolded;
    const actorIds = new Set(actors.map((actor) => actor.id));
    const ungrouped = flows.filter((flow) => !actorIds.has(flow.steps[0].source));
    const actorRows = (actor, actorFlows, followingActor, expanded, toggle) => {
      const heading = sidebarRow(actor.title, "actor", { expanded, count: actorFlows.length, toggle });
      heading.dataset.id = actor.id;
      heading.classList.toggle("selected", options.selectedIds?.includes(actor.id) === true);
      heading.prepend(...sidebarBranches([followingActor]));
      const selectActor = options.onSelectActor;
      heading.addEventListener("click", selectActor === undefined ? toggle : (event) => selectActor(actor.id, event.shiftKey));
      const children = document.createElement("div");
      children.hidden = !expanded;
      for (const [flowIndex, flow] of actorFlows.entries()) {
        const row = flowRow({ flow: { id: flow.id }, title: groupedTitle(flow.title, actor.title) }, active, onToggle);
        row.classList.add("row");
        row.prepend(...sidebarBranches([followingActor, flowIndex < actorFlows.length - 1]));
        children.append(row);
      }
      return [heading, children];
    };
    for (const [actorIndex, actor] of actors.entries()) {
      const followingActor = actorIndex < actors.length - 1 || ungrouped.length > 0;
      const expanded = expandedActors.has(actor.id);
      const actorFlows = flows.filter((flow) => flow.steps[0]?.source === actor.id);
      const toggle = () => {
        if (expanded)
          expandedActors.delete(actor.id);
        else
          expandedActors.add(actor.id);
        paintFlows(host, world, active, onToggle, options);
      };
      list.append(...actorRows(actor, actorFlows, followingActor, expanded, toggle));
    }
    for (const [index, flow] of ungrouped.entries()) {
      const title = contextActor?.id === flow.steps[0].source ? groupedTitle(flow.title, contextActor.title) : flow.title;
      const row = flowRow({ flow: { id: flow.id }, title }, active, onToggle);
      row.classList.add("row");
      row.prepend(...sidebarBranches([index < ungrouped.length - 1]));
      list.append(row);
    }
    replaceTreeChildren(host, heading, list);
  };
}

// src/viewers/web/flow/state.ts
function flowSelection(active) {
  const flow = active.at(-1);
  return flow === undefined ? { kind: "none" } : { kind: "flow", id: flow.id };
}
function flowReturn(active, readingFlow, fileOpen) {
  if (fileOpen || active === undefined)
    return;
  if (readingFlow)
    return active.returnTo === undefined ? undefined : "origin";
  return "flow";
}
function toggleFlowActivation(active, clicked, returnTo) {
  return active.some((flow) => flow.id === clicked.id) ? active.filter((flow) => flow.id !== clicked.id) : [...active, { ...clicked, returnTo }];
}
function retainFlows(active, world) {
  return active.flatMap((flow) => {
    const record = world.flows.find((item) => item.id === flow.id);
    if (record === undefined)
      return [];
    return [{ ...flow, step: flow.step !== undefined && record.steps[flow.step] !== undefined ? flow.step : undefined }];
  });
}
function flowHighlight(active, world) {
  const ids = new Set(active.map((flow) => flow.id));
  const focused = active.at(-1);
  const flow = world.flows.find((flow) => flow.id === focused?.id);
  return {
    routes: new Set(world.flows.filter((flow) => ids.has(flow.id)).flatMap((flow) => flow.steps.map((step) => step.relationshipId))),
    focusedRoute: focused?.step === undefined ? undefined : flow?.steps[focused.step]?.relationshipId
  };
}
function flowFocus(active, world) {
  const { routes, focusedRoute } = flowHighlight(active, world);
  return focusedRoute === undefined ? [...routes] : [focusedRoute];
}

// src/viewers/web/flow/reader.ts
function button(label, action) {
  const control = document.createElement("button");
  control.type = "button";
  control.className = "link";
  control.textContent = label;
  control.addEventListener("click", action);
  return control;
}
function stepControl(label, action) {
  const control = chromeButton(label);
  control.addEventListener("click", action);
  return control;
}
function paintFlowDetails(host, flow, active, world, onStep, onInspect) {
  host.querySelector("h1").textContent = flow.title;
  host.querySelector(".meta").textContent = "Flow";
  host.querySelector(".tabs").replaceChildren();
  const body = host.querySelector(".body");
  body.replaceChildren();
  if (flow.description)
    body.append(paragraph("description", flow.description));
  for (const prose of flow.overview.split(`

`))
    body.append(paragraph("overview", prose));
  const controls = document.createElement("div");
  controls.className = "flow-controls";
  const previous = stepControl("Previous", () => onStep(Math.max(0, (active.step ?? 1) - 1)));
  previous.disabled = active.step === undefined || active.step === 0;
  const next = stepControl("Next", () => onStep((active.step ?? -1) + 1));
  next.disabled = active.step === flow.steps.length - 1;
  const clear = stepControl("Clear focus", () => onStep(undefined));
  clear.disabled = active.step === undefined;
  controls.append(previous, next, clear);
  body.append(controls);
  const names = new Map(world.elements.map((element) => [element.id, element.title]));
  const list = document.createElement("ol");
  flow.steps.forEach((step, index) => {
    const row = document.createElement("li");
    row.className = "flow-step";
    row.classList.toggle("active", active.step === index);
    const action = button(step.action, () => onStep(index));
    action.setAttribute("aria-current", active.step === index ? "step" : "false");
    const ends = document.createElement("div");
    ends.className = "flow-ends";
    ends.append(button(names.get(step.source) ?? step.source, () => onInspect(step.source)), "→", button(names.get(step.target) ?? step.target, () => onInspect(step.target)));
    row.append(action, ends);
    list.append(row);
  });
  body.append(list);
}
function paintFlowReturn(host, active, readingFlow, world, onSelect, onBack, fileOpen) {
  host.querySelector(".flow-back")?.remove();
  const target = flowReturn(active, readingFlow, fileOpen);
  if (target === undefined)
    return;
  const origin = world.elements.find((element) => element.representationId === active.returnTo);
  if (target === "origin" && origin === undefined)
    return;
  const back = chromeButton(target === "origin" ? `Back to ${origin.title}` : "Back to flow", { glyph: "←" });
  back.addEventListener("click", target === "origin" ? () => onSelect(origin.representationId) : onBack);
  back.classList.add("flow-back");
  host.querySelector(".meta").before(back);
}

// src/viewers/relationship-text.ts
function relationshipPairs(relationships, selectedId, parentOf) {
  const pairs = new Map;
  for (const relationship of relationships) {
    const ends = promotedPeer(relationship, selectedId, parentOf);
    if (ends === null)
      continue;
    const key = `${ends.outgoing}\x00${ends.peerId}`;
    const pair = pairs.get(key);
    if (pair === undefined)
      pairs.set(key, { ...ends, relationships: [relationship] });
    else
      pair.relationships.push(relationship);
  }
  return [...pairs.values()];
}
function pairDescriptions(pair) {
  return [...new Set(pair.relationships.map((relationship) => relationship.description))];
}
function parentOfElements(elements) {
  const byId = new Map;
  for (const element of elements)
    byId.set(element.representationId, element.parent);
  return (id) => byId.get(id) ?? null;
}
function ancestorIds(id, parentOf) {
  const ids = [id];
  const seen = new Set([id]);
  let current = parentOf(id);
  while (current !== null && !seen.has(current)) {
    ids.push(current);
    seen.add(current);
    current = parentOf(current);
  }
  return ids;
}
function showsRelationshipText(relationship, selectedId, parentOf = () => null) {
  if (selectedId === null)
    return false;
  const onSource = ancestorIds(relationship.source, parentOf).includes(selectedId);
  const onTarget = ancestorIds(relationship.target, parentOf).includes(selectedId);
  return onSource !== onTarget;
}
function promotedPeer(relationship, selectedId, parentOf) {
  if (!showsRelationshipText(relationship, selectedId, parentOf))
    return null;
  const sourceChain = ancestorIds(relationship.source, parentOf);
  const outgoing = sourceChain.includes(selectedId);
  const own = outgoing ? sourceChain : ancestorIds(relationship.target, parentOf);
  const other = outgoing ? ancestorIds(relationship.target, parentOf) : sourceChain;
  const depthFromRoot = own.length - 1 - own.indexOf(selectedId);
  const peerIndex = Math.max(0, other.length - 1 - depthFromRoot);
  return { outgoing, peerId: other[peerIndex] };
}

// src/sheet/grid.ts
var ROOF_SHADOW = 0.5;
function centredRect(envelope, footprint) {
  return {
    gx: envelope.gx + (envelope.w - footprint.w) / 2,
    gy: envelope.gy + (envelope.d - footprint.d) / 2,
    ...footprint
  };
}

// src/sheet/route/space.ts
var ROUTE_UNIT = 24;
var ROUTE_CLEARANCE = ROUTE_UNIT / 2;
var ROUTE_SPACING = ROUTE_UNIT / 8;
var BUNDLE_SPACING = ROUTE_UNIT / 3;
var LANE_GAP = ROUTE_UNIT * 0.75;

// src/sheet/measure.ts
var PLANE = ROUTE_UNIT;
var ROOF_FONT = 11;
var COMPONENT_FONT = 16;
var ROOF_ADVANCE = 0.62;
var ROOF_PAD = 6;
var SURFACE_PAD = 10;
var ROOF_LINE_HEIGHT = 13;
var PROJECT_FONT = 52;
var ISLAND_FONT = 48;
var ISLAND_SPACING = 0.14;
var CONTAINER_FONT = 36;
var GROUP_FONT = 28;
function textWidth(text, size = ROOF_FONT, spacing = 0) {
  return text.length * size * (ROOF_ADVANCE + spacing);
}
function buildingFont(element) {
  if (element.external)
    return ISLAND_FONT;
  return element.kind === "component" ? COMPONENT_FONT : ROOF_FONT;
}
function textPadding(size) {
  return Math.ceil(size * ROOF_PAD / ROOF_FONT);
}
function textLineHeight(size) {
  return Math.ceil(size * ROOF_LINE_HEIGHT / ROOF_FONT);
}
function labelHeight(size) {
  return 3 * SURFACE_PAD + size * 1.1;
}
function labelBand(size) {
  return Math.ceil(labelHeight(size * 3) / PLANE);
}
var curved = (shape) => shape.kind === "round" || shape.kind === "pill";
function roofBlock(lines, size = ROOF_FONT) {
  return {
    w: Math.max(...lines.map((line) => textWidth(line, size))) + 2 * textPadding(size),
    d: 2 * textPadding(size) + lines.length * textLineHeight(size)
  };
}

// src/viewers/web/iso/projection/blueprint.ts
var MAX_SCALE = 3;
var FRAME_MARGIN = 2.5;
var COMPASS_RADIUS = 1.1;
var COMPASS_LETTER = 0.44;
var PROJECT_META = "GROMA  /  ARCHITECTURE MAP";
var MAX_PLATE_LINE_CHARACTERS = 80;
var MAX_PLATE_OVERVIEW_LINES = 3;
var corners = (rect, project) => [
  project(rect.gx, rect.gy, 0),
  project(rect.gx + rect.w, rect.gy, 0),
  project(rect.gx + rect.w, rect.gy + rect.d, 0),
  project(rect.gx, rect.gy + rect.d, 0)
];
function scaleOf(sheet) {
  return Math.min(MAX_SCALE, Math.max(1, Math.min(sheet.w, sheet.d) / 16));
}
function calibrationTicks(frame, scale, project) {
  const count = (length) => Math.max(5, Math.min(14, Math.round(length / (2.2 * scale))));
  const ticks = [];
  const east = frame.gx + frame.w;
  const south = frame.gy + frame.d;
  const eastCount = count(frame.d);
  const southCount = count(frame.w);
  for (let index = 1;index <= eastCount; index += 1) {
    const gy = frame.gy + frame.d * index / (eastCount + 1);
    const depth = (index % 4 === 0 ? 0.3 : 0.18) * scale;
    ticks.push({ from: project(east, gy, 0), to: project(east - depth, gy, 0) });
  }
  for (let index = 1;index <= southCount; index += 1) {
    const gx = frame.gx + frame.w * index / (southCount + 1);
    const depth = (index % 4 === 0 ? 0.3 : 0.18) * scale;
    ticks.push({ from: project(gx, south, 0), to: project(gx, south - depth, 0) });
  }
  return ticks;
}
var compassInset = (scale) => (COMPASS_RADIUS + COMPASS_LETTER + 0.4) * scale;
function compassOf(frame, scale, project) {
  const inset = compassInset(scale);
  const at = { gx: frame.gx + inset, gy: frame.gy + frame.d - inset };
  const on = (dx, dy) => project(at.gx + dx, at.gy + dy, 0);
  const radius = COMPASS_RADIUS * scale;
  const notch = 0.18 * radius;
  const tip = radius + COMPASS_LETTER * scale;
  return {
    at,
    centre: on(0, 0),
    ring: Array.from({ length: 32 }, (_, index) => {
      const angle = index * Math.PI / 16;
      return on(radius * Math.cos(angle), radius * Math.sin(angle));
    }),
    star: [on(0, -radius), on(notch, -notch), on(radius, 0), on(notch, notch), on(0, radius), on(-notch, notch), on(-radius, 0), on(-notch, -notch)],
    north: [on(0, -radius), on(notch, -notch), on(0, 0), on(-notch, -notch)],
    letters: [
      { text: "N", at: on(0, -tip) },
      { text: "E", at: on(tip, 0) },
      { text: "S", at: on(0, tip) },
      { text: "W", at: on(-tip, 0) }
    ],
    fontSize: 12 * scale
  };
}
function wrapPlain(text, width, size) {
  const lines = [];
  const words = text.replace(/\s+/g, " ").trim().split(" ").flatMap((word) => chunksOf(word, width, size));
  for (const word of words) {
    const current = lines.at(-1);
    if (current === undefined || textWidth(`${current} ${word}`, size) > width)
      lines.push(word);
    else
      lines[lines.length - 1] = `${current} ${word}`;
  }
  return lines;
}
function chunksOf(text, width, size) {
  const characters = Math.max(1, Math.floor(width / textWidth("M", size)));
  return Array.from({ length: Math.ceil(text.length / characters) }, (_, index) => text.slice(index * characters, (index + 1) * characters));
}
function sameStyle(left, right) {
  return left !== undefined && left.styles.join(" ") === right.styles.join(" ");
}
function* plateTokens(spans, width, size) {
  for (const span of spans) {
    for (const token of span.text.match(/\S+|\s+/g) ?? []) {
      const chunks = /^\s+$/.test(token) ? [token] : chunksOf(token, width, size);
      for (const text of chunks)
        yield { text, styles: span.styles };
    }
  }
}
function wrapBlock(block, width, size) {
  const spans = block.marker === undefined ? block.spans : [{ text: `${block.marker} `, styles: [] }, ...block.spans];
  const lines = [[]];
  let lineText = "";
  let pendingSpace = false;
  for (const span of plateTokens(spans, width, size)) {
    if (/^\s+$/.test(span.text)) {
      pendingSpace = true;
      continue;
    }
    const separator = lineText === "" || !pendingSpace ? "" : " ";
    if (lineText !== "" && textWidth(`${lineText}${separator}${span.text}`, size) > width) {
      lines.push([]);
      lineText = "";
    }
    const text = `${lineText === "" ? "" : separator}${span.text}`;
    const line = lines.at(-1);
    if (sameStyle(line.at(-1), span))
      line.at(-1).text += text;
    else
      line.push({ text, styles: [...span.styles] });
    lineText += text;
    pendingSpace = false;
  }
  return lines;
}
function wrapMarkdown(blocks, width, size) {
  return blocks.flatMap((block, index) => [
    ...index === 0 ? [] : [[]],
    ...wrapBlock(block, width, size)
  ]);
}
function projectPlate(sheet, scale, profile, project) {
  const editSize = 0.82 * scale;
  const editInset = 0.16 * scale;
  const editReservationWidth = editSize + editInset * 2;
  const titleSize = PROJECT_FONT * 1.25;
  const titleLineHeight = titleSize * 1.2;
  const overviewSize = ISLAND_FONT;
  const overviewLineHeight = overviewSize * 1.25;
  const metaSize = 4.5 * scale;
  const contentInset = Math.max(0.25 * scale, textPadding(titleSize) / PLANE);
  const pencilGutter = 0.5 * scale;
  const horizontalPadding = contentInset + pencilGutter;
  const limitedWidth = (text, size) => textWidth(text.slice(0, MAX_PLATE_LINE_CHARACTERS), size);
  const overviewWidth = Math.max(...profile.overviewBlocks.map((block) => limitedWidth(`${block.marker === undefined ? "" : `${block.marker} `}${block.spans.map((span) => span.text).join("")}`, overviewSize)), 0);
  const contentWidth = Math.max(limitedWidth(profile.title, titleSize), overviewWidth, limitedWidth(PROJECT_META, metaSize));
  const width = editReservationWidth + horizontalPadding + contentWidth / PLANE;
  const titleLines = wrapPlain(profile.title, contentWidth, titleSize);
  const overviewLines = wrapMarkdown(profile.overviewBlocks, contentWidth, overviewSize).slice(0, MAX_PLATE_OVERVIEW_LINES);
  const titleTop = contentInset;
  const overviewTop = titleTop + titleLines.length * titleLineHeight / PLANE + 0.18 * scale;
  const metaTop = overviewTop + overviewLines.length * overviewLineHeight / PLANE + 0.2 * scale;
  const depth = Math.max(metaTop + 0.45 * scale, editSize + editInset * 2);
  const rect = {
    gx: sheet.gx + sheet.w + (FRAME_MARGIN - 0.4) * scale - width,
    gy: sheet.gy + sheet.d + 0.15 * scale,
    w: width,
    d: depth
  };
  const editRect = {
    gx: rect.gx + rect.w - editInset - editSize,
    gy: rect.gy + rect.d - editInset - editSize,
    w: editSize,
    d: editSize
  };
  const pencilLength = editRect.d * PLANE * 0.5;
  const pencilThickness = editRect.w * PLANE * 0.18;
  const pencilOrigin = project(editRect.gx + editRect.w / 2 - pencilThickness / PLANE / 2, editRect.gy + editRect.d / 2 - pencilLength / PLANE / 2, 0);
  return {
    rect,
    plate: {
      polygon: corners(rect, project),
      title: {
        origin: project(rect.gx + contentInset, rect.gy + titleTop, 0),
        lines: titleLines,
        fontSize: titleSize,
        lineHeight: titleLineHeight,
        maxWidth: contentWidth
      },
      overview: {
        origin: project(rect.gx + contentInset, rect.gy + overviewTop, 0),
        lines: overviewLines,
        fontSize: overviewSize,
        lineHeight: overviewLineHeight,
        maxWidth: contentWidth
      },
      meta: {
        origin: project(rect.gx + contentInset, rect.gy + metaTop, 0),
        lines: [PROJECT_META],
        fontSize: metaSize,
        lineHeight: metaSize,
        maxWidth: contentWidth
      },
      edit: {
        polygon: corners(editRect, project),
        pencil: { origin: pencilOrigin, length: pencilLength, thickness: pencilThickness }
      }
    }
  };
}
function projectBlueprint(sheet, profile, project) {
  const scale = scaleOf(sheet);
  const plate = profile === undefined ? undefined : projectPlate(sheet, scale, profile, project);
  const margin = FRAME_MARGIN * scale;
  const projectDepth = plate === undefined ? 0 : plate.rect.gy + plate.rect.d - sheet.gy - sheet.d;
  const south = plate === undefined ? margin : Math.max(margin, projectDepth + 0.4 * scale);
  const west = plate === undefined ? sheet.gx - margin : Math.min(sheet.gx - margin, plate.rect.gx - 2 * compassInset(scale));
  const frame = {
    gx: west,
    gy: sheet.gy - margin,
    w: sheet.gx + sheet.w + margin - west,
    d: sheet.d + margin + south
  };
  const framePoints = corners(frame, project);
  return {
    frame: framePoints,
    calibrationTicks: calibrationTicks(frame, scale, project),
    compass: compassOf(frame, scale, project),
    ...plate === undefined ? {} : { projectPlate: plate.plate }
  };
}

// src/viewers/web/iso/projection/project.ts
var CELL_X = 24;
var CELL_Y = 12;
var HEIGHT_UNIT = 12;
var DEFAULT_YAW = 45;
var DEFAULT_PITCH = 30;
var RAD = Math.PI / 180;
var WORLD_SCALE = CELL_X / Math.cos(DEFAULT_YAW * RAD);
var HEIGHT_SCALE = HEIGHT_UNIT / Math.cos(DEFAULT_PITCH * RAD);
var ARC_STEPS = 16;
var SLAB_HANG = 3;
var DEFAULT_PROJECTION = { yaw: DEFAULT_YAW, pitch: DEFAULT_PITCH };
function project(gx, gy, z, view = DEFAULT_PROJECTION) {
  if (view.yaw === DEFAULT_YAW && view.pitch === DEFAULT_PITCH) {
    return { x: (gx - gy) * CELL_X, y: (gx + gy) * CELL_Y - z * HEIGHT_UNIT };
  }
  const yaw = view.yaw * RAD;
  const pitch = view.pitch * RAD;
  const depth = gx * Math.sin(yaw) + gy * Math.cos(yaw);
  return {
    x: (gx * Math.cos(yaw) - gy * Math.sin(yaw)) * WORLD_SCALE,
    y: depth * WORLD_SCALE * Math.sin(pitch) - z * HEIGHT_SCALE * Math.cos(pitch)
  };
}
function planeAxes(view) {
  return {
    ground: [project(1 / CELL_X, 0, 0, view), project(0, 1 / CELL_X, 0, view)],
    left: [project(0, 1 / CELL_X, 0, view), project(0, 0, 1 / HEIGHT_UNIT, view)],
    right: [project(1 / CELL_X, 0, 0, view), project(0, 0, 1 / HEIGHT_UNIT, view)]
  };
}
function planeMatrix(plane, origin = { x: 0, y: 0 }, view = DEFAULT_PROJECTION) {
  const [u, v] = planeAxes(view)[plane];
  const fixed = (value) => String(Math.round(value * 100) / 100);
  return `matrix(${fixed(u.x)} ${fixed(u.y)} ${fixed(v.x)} ${fixed(v.y)} ${fixed(origin.x)} ${fixed(origin.y)})`;
}
function corners2(rect, z, view) {
  return [
    project(rect.gx, rect.gy, z, view),
    project(rect.gx + rect.w, rect.gy, z, view),
    project(rect.gx + rect.w, rect.gy + rect.d, z, view),
    project(rect.gx, rect.gy + rect.d, z, view)
  ];
}
function boxFaces(rect, z0, z1, view = DEFAULT_PROJECTION) {
  const [n0, e0, s0, w0] = corners2(rect, z0, view);
  const [n1, e1, s1, w1] = corners2(rect, z1, view);
  const yaw = view.yaw * RAD;
  const centre = project(rect.gx + rect.w / 2, rect.gy + rect.d / 2, (z0 + z1) / 2, view);
  const walls = [];
  if (Math.abs(Math.sin(yaw)) > 0.00000001) {
    walls.push(Math.sin(yaw) > 0 ? { plane: "left", points: [e0, s0, s1, e1] } : { plane: "left", points: [n0, w0, w1, n1] });
  }
  if (Math.abs(Math.cos(yaw)) > 0.00000001) {
    walls.push(Math.cos(yaw) > 0 ? { plane: "right", points: [w0, s0, s1, w1] } : { plane: "right", points: [n0, e0, e1, n1] });
  }
  const visible = walls.map((face) => ({
    ...face,
    side: face.points.reduce((sum, point) => sum + point.x, 0) / face.points.length < centre.x ? "left" : "right"
  })).sort((left, right) => left.side === right.side ? 0 : left.side === "left" ? -1 : 1);
  return [...visible, { side: "top", points: [n1, e1, s1, w1] }];
}
function depthKey(rect, view) {
  const yaw = view.yaw * RAD;
  const gx = Math.sin(yaw) >= 0 ? rect.gx + rect.w : rect.gx;
  const gy = Math.cos(yaw) >= 0 ? rect.gy + rect.d : rect.gy;
  return gx * Math.sin(yaw) + gy * Math.cos(yaw);
}
function paintOrder(items, view = DEFAULT_PROJECTION) {
  return [...items].sort((left, right) => depthKey(left.rect, view) - depthKey(right.rect, view) || left.rect.gx - right.rect.gx);
}
function stadium(rect) {
  const radius = Math.min(rect.w, rect.d) / 2;
  return {
    radius,
    west: rect.gx + radius,
    east: rect.gx + rect.w - radius,
    middle: rect.gy + rect.d / 2
  };
}
function roofOutline(rect) {
  const { radius, west, east, middle } = stadium(rect);
  const arc = (cx, from, to) => Array.from({ length: ARC_STEPS + 1 }, (_, step) => {
    const t = from + (to - from) * step / ARC_STEPS;
    return { gx: cx + radius * Math.cos(t), gy: middle + radius * Math.sin(t) };
  });
  return [...arc(east, -Math.PI / 2, Math.PI / 2), ...arc(west, Math.PI / 2, 3 * Math.PI / 2)];
}
function cross(left, right) {
  return left.x * right.y - left.y * right.x;
}
function rayEdgeDistance(origin, direction, start, end) {
  const edge = { x: end.x - start.x, y: end.y - start.y };
  const divisor = cross(direction, edge);
  if (Math.abs(divisor) < 0.000000001)
    return null;
  const offset = { x: start.x - origin.x, y: start.y - origin.y };
  const distance = cross(offset, edge) / divisor;
  const position = cross(offset, direction) / divisor;
  return distance > 0.000000001 && position >= -0.000000001 && position <= 1 + 0.000000001 ? distance : null;
}
function onVisibleBuilding(at, from, building) {
  if (building === undefined)
    return at;
  const direction = { x: at.x - from.x, y: at.y - from.y };
  const distances = [];
  for (const face of building.floors.flat()) {
    for (let index = 0;index < face.points.length; index += 1) {
      const distance = rayEdgeDistance(from, direction, face.points[index], face.points[(index + 1) % face.points.length]);
      if (distance !== null)
        distances.push(distance);
    }
  }
  const distance = Math.min(...distances);
  return Number.isFinite(distance) ? { x: from.x + direction.x * distance, y: from.y + direction.y * distance } : at;
}
function curvedFaces(outline, z0, z1, view) {
  const base = outline.map((point) => project(point.gx, point.gy, z0, view));
  const top = outline.map((point) => project(point.gx, point.gy, z1, view));
  const extreme = (better) => base.reduce((best, point, index) => better(point, base[best]) ? index : best, 0);
  const left = extreme((a, b) => a.x < b.x);
  const right = extreme((a, b) => a.x > b.x);
  const path = (step) => {
    const indices = [];
    for (let index = left;; index = (index + step + base.length) % base.length) {
      indices.push(index);
      if (index === right)
        return indices;
    }
  };
  const yaw = view.yaw * RAD;
  const depth = (index) => {
    const point = outline[index];
    return point.gx * Math.sin(yaw) + point.gy * Math.cos(yaw);
  };
  const paths = [path(-1), path(1)];
  const band = paths.reduce((front, candidate) => {
    const mean = (indices) => indices.reduce((sum, index) => sum + depth(index), 0) / indices.length;
    return mean(candidate) > mean(front) ? candidate : front;
  });
  return [
    {
      side: "left",
      plane: Math.abs(Math.sin(yaw)) > Math.abs(Math.cos(yaw)) ? "left" : "right",
      points: [...band.map((index) => base[index]), ...band.map((index) => top[index]).reverse()]
    },
    { side: "top", points: top }
  ];
}
function sameFootprint(left, right) {
  return left.gx === right.gx && left.gy === right.gy && left.w === right.w && left.d === right.d;
}
function buildingFloors(building, view) {
  if (curved(building.shape)) {
    return [curvedFaces(roofOutline(building.rect), 0, building.heightUnits, view)];
  }
  if (building.floors.length === 0)
    return [boxFaces(building.rect, 0, building.heightUnits, view)];
  const rects = building.floors.map((floor) => centredRect(building.rect, floor.footprint));
  const faces = [];
  let height = 0;
  for (const [index, floor] of building.floors.entries()) {
    const rect = rects[index];
    const nextHeight = height + floor.heightUnits;
    const floorFaces = boxFaces(rect, height, nextHeight, view);
    const next = rects[index + 1];
    if (next !== undefined && sameFootprint(rect, next))
      floorFaces.pop();
    faces.push(floorFaces);
    height = nextHeight;
  }
  return faces;
}
function roofText(building, view) {
  const { shape, heightUnits, lines } = building;
  const top = building.floors.at(-1);
  const roof = top === undefined ? building.rect : centredRect(building.rect, top.footprint);
  if (!curved(shape))
    return { origin: project(roof.gx, roof.gy, heightUnits, view), lines };
  const block = roofBlock(lines, buildingFont(building));
  return {
    origin: project(roof.gx + (roof.w - block.w / PLANE) / 2, roof.gy + (roof.d - block.d / PLANE) / 2, heightUnits, view),
    lines
  };
}
function surfaceBody(rect, size) {
  return { ...rect, d: rect.d - labelBand(size) };
}
function bandText(rect, lines, size, view, spacing = 0) {
  const width = Math.max(...lines.map((line) => textWidth(line, size, spacing)));
  const body = surfaceBody(rect, size);
  return {
    origin: project(rect.gx + (rect.w - width / PLANE) / 2, body.gy + body.d, 0, view),
    lines,
    width,
    band: { width: rect.w * PLANE, height: labelBand(size) * PLANE }
  };
}
function boundsOf(points) {
  if (points.length === 0)
    return { x: 0, y: 0, width: 1, height: 1 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { x: minX, y: minY, width: Math.max(maxX - minX, 1), height: Math.max(maxY - minY, 1) };
}
function projectScene(scene, profile, view = DEFAULT_PROJECTION) {
  const islands = scene.islands.map((island) => ({
    island,
    polygon: corners2(surfaceBody(island.rect, ISLAND_FONT), 0, view),
    text: bandText(island.rect, [island.name.toUpperCase()], ISLAND_FONT, view, ISLAND_SPACING)
  }));
  const zones = scene.zones.map((zone) => ({
    zone,
    polygon: corners2(surfaceBody(zone.rect, GROUP_FONT), 0, view),
    text: bandText(zone.rect, [zone.name], GROUP_FONT, view)
  }));
  const slabs = paintOrder(scene.slabs, view).map((slab) => ({
    slab,
    faces: boxFaces(surfaceBody(slab.rect, CONTAINER_FONT), -SLAB_HANG / HEIGHT_UNIT, 0, view),
    text: bandText(slab.rect, [slab.title], CONTAINER_FONT, view)
  }));
  const buildings = paintOrder(scene.buildings, view).map((building) => ({
    building,
    floors: buildingFloors(building, view),
    text: roofText(building, view)
  }));
  const visibleBuildings = new Map(buildings.map((building) => [building.building.representationId, building]));
  const routes = scene.routes.map((route) => {
    const cells = route.points;
    const end = cells.length - 1;
    const points = cells.map((point) => project(point.gx, point.gy, 0, view));
    points[0] = onVisibleBuilding(points[0], points[1], visibleBuildings.get(route.source));
    points[end] = onVisibleBuilding(points[end], points[end - 1], visibleBuildings.get(route.target));
    const last = cells[end];
    const before = cells[end - 1];
    const turn = last.gx > before.gx ? 0 : last.gy > before.gy ? 90 : last.gx < before.gx ? 180 : 270;
    return { route, points, arrow: { at: points[end], turn } };
  });
  const blueprint = projectBlueprint(scene.sheet, profile, (gx, gy, z) => project(gx, gy, z, view));
  return {
    ...blueprint,
    view,
    islands,
    zones,
    slabs,
    routes,
    buildings,
    bounds: boundsOf([
      ...blueprint.frame,
      ...[...scene.islands, ...scene.slabs, ...scene.zones].flatMap((item) => corners2(item.rect, 0, view)),
      ...buildings.flatMap((item) => item.floors.flatMap((floor) => floor.flatMap((face) => face.points)))
    ])
  };
}

// src/viewers/web/iso/camera/camera.ts
var ZOOM_MAX = 4;
var FOCUS_ZOOM_MAX = 1;
var FIT_MARGIN = 24;
var CONTEXT_MARGIN = 120;
var WHEEL_RATE = 0.0015;
var PINCH_RATE = 0.01;
function fittedCamera(bounds, viewport, maxZoom, margin) {
  const width = Math.max(viewport.width, 1);
  const height = Math.max(viewport.height, 1);
  const k = Math.min(maxZoom, (width - 2 * margin) / Math.max(bounds.width, 1), (height - 2 * margin) / Math.max(bounds.height, 1));
  return {
    k,
    x: (width - k * bounds.width) / 2 - k * bounds.x,
    y: (height - k * bounds.height) / 2 - k * bounds.y
  };
}
function fitCamera(bounds, viewport) {
  return fittedCamera(bounds, viewport, Infinity, FIT_MARGIN);
}
function bodyPoints(scene, wanted) {
  return [
    ...scene.islands.filter((item) => item.island.element !== null && wanted.has(item.island.element.representationId)).flatMap((item) => item.polygon),
    ...scene.slabs.filter((item) => wanted.has(item.slab.representationId)).flatMap((item) => item.faces.flatMap((face) => face.points)),
    ...scene.buildings.filter((item) => wanted.has(item.building.representationId)).flatMap((item) => item.floors.flatMap((floor) => floor.flatMap((face) => face.points)))
  ];
}
function fitPoints(points, viewport, maxZoom) {
  if (points.length === 0)
    return;
  const margin = Math.min(CONTEXT_MARGIN, viewport.width / 4, viewport.height / 4);
  return fittedCamera(boundsOf(points), viewport, maxZoom, margin);
}
function fitArchitecture(scene, world, ids, viewport) {
  const wanted = new Set(ids);
  const groups = scene.zones.filter((item) => item.zone.unidentifiedContainer && wanted.has(item.zone.key));
  for (const { zone } of groups)
    for (const member of zone.members)
      wanted.add(member);
  const routes = scene.routes.filter((item) => (item.route.relationshipIds ?? [item.route.id]).some((id) => wanted.has(id)));
  for (const { route } of routes) {
    wanted.add(route.source);
    wanted.add(route.target);
  }
  const parentOf = parentOfElements(world.elements);
  const bodies = new Set(world.elements.filter((element) => ancestorIds(element.representationId, parentOf).some((id) => wanted.has(id))).map((element) => element.representationId));
  return fitPoints([
    ...groups.flatMap((item) => item.polygon),
    ...bodyPoints(scene, bodies),
    ...routes.flatMap((item) => [...item.points, ...item.lifts.flatMap((lift) => [lift.from, lift.to])])
  ], viewport, FOCUS_ZOOM_MAX);
}
function fitHighlights(scene, ids, viewport, maxZoom) {
  const wanted = new Set(ids);
  return fitPoints([
    ...bodyPoints(scene, wanted),
    ...scene.routes.filter((item) => wanted.has(item.route.source)).flatMap((item) => item.points)
  ], viewport, maxZoom);
}
function zoomLimits(fit) {
  return { min: fit.k / 2, max: Math.max(ZOOM_MAX, fit.k) };
}
function zoomAbout(camera, factor, anchor, fit) {
  const limits = zoomLimits(fit);
  const k = Math.min(limits.max, Math.max(limits.min, camera.k * factor));
  const ratio = k / camera.k;
  return {
    k,
    x: anchor.x - (anchor.x - camera.x) * ratio,
    y: anchor.y - (anchor.y - camera.y) * ratio
  };
}
function pan(camera, dx, dy) {
  return { ...camera, x: camera.x + dx, y: camera.y + dy };
}
function wheelAction(event) {
  if (event.ctrlKey || event.metaKey) {
    return { kind: "zoom", factor: Math.exp(-event.deltaY * (event.ctrlKey ? PINCH_RATE : WHEEL_RATE)) };
  }
  return { kind: "pan", dx: -event.deltaX, dy: -event.deltaY };
}
function zoomReadout(camera, fit) {
  const percent = Math.round(camera.k / fit.k * 100);
  return percent === 100 ? "" : `${percent}%`;
}

// src/viewers/web/iso/painting/svg.ts
var NAMESPACE = "http://www.w3.org/2000/svg";
var STROKED = new Set(["polygon", "polyline", "path", "line", "ellipse"]);
function attributesOf(tag, attributes, className) {
  const result = {};
  for (const name in attributes)
    result[name] = String(attributes[name]);
  if (className !== "")
    result.class = className;
  if (STROKED.has(tag))
    result["vector-effect"] = "non-scaling-stroke";
  return result;
}
function node2(tag, attributes = {}, className = "", children = []) {
  return { tag, attributes: attributesOf(tag, attributes, className), children };
}
function mark(tag, attributes) {
  return { tag, attributes: Object.fromEntries(Object.entries(attributes).map(([name, value]) => [name, String(value)])), children: [] };
}
function svg(tag, attributes = {}, className = "") {
  const element = document.createElementNS(NAMESPACE, tag);
  for (const [name, value] of Object.entries(attributesOf(tag, attributes, className)))
    element.setAttribute(name, value);
  return element;
}
var drawn = new WeakMap;
function create(item) {
  const element = document.createElementNS(NAMESPACE, item.tag);
  for (const [name, value] of Object.entries(item.attributes))
    element.setAttribute(name, value);
  if (typeof item.children === "string")
    element.textContent = item.children;
  else
    for (const child of item.children)
      element.append(create(child));
  drawn.set(element, item);
  return element;
}
function tokens(value) {
  return value?.split(/\s+/).filter(Boolean) ?? [];
}
function writeAttributes(element, before, after) {
  if (after.class !== before.class) {
    element.classList.remove(...tokens(before.class));
    element.classList.add(...tokens(after.class));
  }
  for (const name in after) {
    if (name !== "class" && after[name] !== before[name])
      element.setAttribute(name, after[name]);
  }
  for (const name in before) {
    if (name !== "class" && !(name in after))
      element.removeAttribute(name);
  }
}
function update(element, item) {
  const before = drawn.get(element);
  writeAttributes(element, before.attributes, item.attributes);
  drawn.set(element, item);
  if (typeof item.children === "string") {
    if (item.children !== before.children)
      element.textContent = item.children;
    return false;
  }
  if (typeof before.children === "string")
    element.textContent = "";
  return patch(element, item.children);
}
function matchOf(item) {
  const key = item.attributes["data-id"] ?? item.attributes.id;
  return key === undefined ? `${item.tag} ${item.attributes.class ?? ""}` : `#${item.tag} ${key}`;
}
function reusableChildren(parent) {
  const reusable = new Map;
  for (const child of parent.children) {
    const item = drawn.get(child);
    if (item === undefined)
      continue;
    const match = matchOf(item);
    const group = reusable.get(match);
    if (group === undefined)
      reusable.set(match, [child]);
    else
      group.push(child);
  }
  return reusable;
}
function patch(parent, items) {
  const reusable = reusableChildren(parent);
  let changed = false;
  const elements = items.map((item) => {
    const element = reusable.get(matchOf(item))?.shift();
    if (element === undefined) {
      changed = true;
      return create(item);
    }
    if (update(element, item))
      changed = true;
    return element;
  });
  for (const unused of [...reusable.values()].flat()) {
    unused.remove();
    changed = true;
  }
  let cursor = parent.firstElementChild;
  for (const element of elements) {
    if (element === cursor)
      cursor = cursor.nextElementSibling;
    else
      parent.insertBefore(element, cursor);
  }
  return changed;
}
function round(value) {
  return Math.round(value * 100) / 100;
}
function pointsAttribute(points) {
  return points.map((point) => `${round(point.x)},${round(point.y)}`).join(" ");
}

// src/viewers/web/iso/painting/layer-planes.ts
function layerPlanesSvg(scene) {
  if (scene.layerPlanes.length === 0)
    return [];
  const risers = scene.layerPlanes.slice(1).flatMap((plane, index) => {
    const below = scene.layerPlanes[index];
    return plane.polygon.map((point, corner) => node2("line", {
      x1: below.polygon[corner].x,
      y1: below.polygon[corner].y,
      x2: point.x,
      y2: point.y
    }));
  });
  return [
    node2("g", {}, "layer-risers", risers),
    ...scene.layerPlanes.map((plane) => node2("g", { opacity: plane.opacity }, `layer-plane ${plane.layer}`, [
      node2("polygon", { points: pointsAttribute(plane.polygon) })
    ]))
  ];
}
function layerLabelsSvg(scene) {
  return scene.layerPlanes.map((plane) => node2("text", { x: plane.label.at.x, y: plane.label.at.y, opacity: plane.opacity }, "layer-label", plane.label.text));
}
var layerCss = `
  #map .layer-plane, #map .layer-risers, #map .layer-labels { pointer-events: none; }
  #map .layer-plane polygon {
    fill: color-mix(in srgb, var(--paper) 76%, transparent);
    stroke: color-mix(in srgb, var(--ink) 34%, transparent);
    stroke-width: calc(var(--stroke) * var(--weight, 1));
    stroke-dasharray: 5 5;
    vector-effect: non-scaling-stroke;
  }
  #map .layer-plane.container polygon { fill-opacity: 0.76; }
  #map .layer-plane.component polygon { fill-opacity: 0.58; }
  #map .layer-label {
    fill: var(--muted); stroke: var(--paper); paint-order: stroke;
    stroke-width: calc(3px / var(--camera-scale, 1));
    font-size: calc(11px / var(--camera-scale, 1)); font-weight: 700; letter-spacing: 0.18em;
  }
  #map .layer-risers line {
    stroke: color-mix(in srgb, var(--ink) 24%, transparent);
    stroke-width: calc(var(--stroke) * var(--weight, 1));
    stroke-dasharray: 2 5;
    vector-effect: non-scaling-stroke;
  }
  #map .route .lift { stroke-dasharray: 2 5; opacity: 0.52; }
  #map .route.hovered .lift, #map .route.endpoint .lift, #map .route.selected .lift,
  #map .route.touched .lift, #map .route.lit .lift { opacity: 1; }
`;

// src/viewers/web/iso/camera/layer.ts
var SETTLE_MS = 250;
function createCameraLayer(painter) {
  const element = document.createElement("div");
  element.className = "camera";
  element.style.transformOrigin = "0 0";
  element.style.willChange = "transform";
  let shown;
  let drawn;
  let stale = false;
  let scaled = false;
  let moving = false;
  let settleTimer;
  let movedAt = 0;
  const drawCamera = (view) => {
    painter.drawCamera(view);
    drawn = view;
    stale = false;
    element.style.transform = "translate(0px, 0px) scale(1)";
  };
  const showCached = (camera, from) => {
    const ratio = camera.k / from.k;
    element.style.transform = `translate(${camera.x - from.x * ratio}px, ${camera.y - from.y * ratio}px) scale(${ratio})`;
    if (ratio !== 1)
      scaled = true;
  };
  const rebuild = () => {
    element.style.willChange = "auto";
    element.offsetWidth;
    element.style.willChange = "transform";
  };
  const settle = () => {
    const wait = movedAt + SETTLE_MS - performance.now();
    if (wait > 0) {
      waitToSettle(wait);
      return;
    }
    settleTimer = undefined;
    moving = false;
    stale = false;
    if (shown !== undefined && (shown.camera.k !== drawn?.camera.k || shown.zoomRatio !== drawn?.zoomRatio))
      drawCamera(shown);
    if (scaled) {
      scaled = false;
      requestAnimationFrame(rebuild);
    }
    painter.settled();
  };
  const waitToSettle = (ms) => {
    settleTimer = setTimeout(() => requestAnimationFrame(settle), ms);
  };
  const markMoving = () => {
    if (!moving) {
      moving = true;
      painter.moveStarted();
    }
    movedAt = performance.now();
    if (settleTimer === undefined)
      waitToSettle(SETTLE_MS);
  };
  return {
    element,
    get drawn() {
      return drawn?.camera;
    },
    get shown() {
      return shown?.camera;
    },
    get moving() {
      return moving;
    },
    move(view) {
      const scaleChanged = view.camera.k !== shown?.camera.k || view.zoomRatio !== shown?.zoomRatio;
      if (!scaleChanged && view.camera.x === shown?.camera.x && view.camera.y === shown?.camera.y)
        return false;
      shown = view;
      markMoving();
      if (drawn === undefined || stale)
        drawCamera(view);
      else
        showCached(view.camera, drawn.camera);
      return scaleChanged;
    },
    approach(destination) {
      if (shown === undefined || drawn === undefined || destination.camera.k >= drawn.camera.k)
        return;
      drawCamera(destination);
      showCached(shown.camera, destination.camera);
      markMoving();
    },
    invalidate() {
      stale = true;
      markMoving();
    }
  };
}

// src/viewers/web/iso/painting/glow.ts
var glowCss = `
  #map .highlight-glow {
    position: absolute; left: 0; top: 0; pointer-events: none;
    will-change: opacity;
  }
  #map [data-glows-hidden] > .highlight-glow { opacity: 0; }
  #map .highlight-glow-pulse {
    width: 100%; height: 100%; opacity: 0.55;
    will-change: opacity;
    animation: map-highlight-glow 2600ms ease-in-out infinite;
  }
  @keyframes map-highlight-glow {
    0%, 100% { opacity: 0.1; }
    50% { opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    #map .highlight-glow-pulse { animation: none; }
  }
`;
function glowShapes(scene, id) {
  const source = scene.buildings.find((item) => item.building.representationId === id) ?? scene.slabs.find((item) => item.slab.representationId === id) ?? scene.islands.find((item) => item.island.element?.representationId === id);
  if (source === undefined)
    return;
  if ("floors" in source)
    return source.floors.flat().map((face) => face.points);
  if ("faces" in source)
    return source.faces.map((face) => face.points);
  return [source.polygon];
}
function highlightGlow(id, shapes) {
  const surface = document.createElement("div");
  surface.className = "highlight-glow";
  surface.setAttribute("aria-hidden", "true");
  const body = boundsOf(shapes.flat());
  const blur = 32;
  const margin = blur * 3;
  const bounds = { x: body.x - margin, y: body.y - margin, width: body.width + margin * 2, height: body.height + margin * 2 };
  const filter = `highlight-glow-${id}`;
  const drawing = svg("svg", { width: "100%", height: "100%", viewBox: `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}` });
  patch(drawing, [
    node2("defs", {}, "", [node2("filter", { id: filter, filterUnits: "userSpaceOnUse", ...bounds }, "", [
      node2("feGaussianBlur", { stdDeviation: blur })
    ])]),
    node2("g", { fill: "var(--highlight)", filter: `url(#${filter})` }, "", shapes.map((points) => node2("polygon", { points: pointsAttribute(points) })))
  ]);
  const pulse = document.createElement("div");
  pulse.className = "highlight-glow-pulse";
  pulse.append(drawing);
  surface.append(pulse);
  return {
    surface,
    move(camera) {
      surface.style.transform = `translate(${camera.x + bounds.x * camera.k}px, ${camera.y + bounds.y * camera.k}px)`;
      surface.style.width = `${bounds.width * camera.k}px`;
      surface.style.height = `${bounds.height * camera.k}px`;
    }
  };
}
function createGlows(layer, before) {
  const glows = new Map;
  const showGlow = (id, shapes, camera) => {
    const signature = shapes.map(pointsAttribute).join("|");
    const previous = glows.get(id);
    if (previous?.signature === signature)
      return;
    previous?.surface.remove();
    const glow = highlightGlow(id, shapes);
    layer.insertBefore(glow.surface, before);
    if (camera !== undefined)
      glow.move(camera);
    glows.set(id, { ...glow, signature });
  };
  return {
    show(scene, ids, camera) {
      const visible = new Set;
      for (const id of ids) {
        const shapes = glowShapes(scene, id);
        if (shapes === undefined)
          continue;
        visible.add(id);
        showGlow(id, shapes, camera);
      }
      for (const [id, glow] of glows) {
        if (visible.has(id))
          continue;
        glow.surface.remove();
        glows.delete(id);
      }
    },
    move(camera) {
      for (const glow of glows.values())
        glow.move(camera);
    },
    hide(hidden) {
      layer.toggleAttribute("data-glows-hidden", hidden);
    }
  };
}

// src/viewers/web/iso/painting/scale.ts
var LEVELS = ["island", "slab", "building", "route"];
var STROKE_RATIO = 1.4;
var TINT_RATIO = 1.8;
var BUILDING_STROKE = 1;
var ISLAND_TINT = 0.04;
var SIDE = { right: 1, left: 1.5 };
var FACADE_MARK = 1.1;
function depthOf(level) {
  return LEVELS.indexOf(level);
}
function strokeAt(depth) {
  return BUILDING_STROKE * STROKE_RATIO ** (depthOf("building") - depth);
}
function tintAt(depth) {
  return ISLAND_TINT * TINT_RATIO ** depth;
}
function emphasis(steps) {
  return STROKE_RATIO ** steps;
}
function weightAt(zoomRatio) {
  return Math.min(2, Math.max(0.75, Math.sqrt(zoomRatio)));
}
function facadeDetailsVisible(k) {
  return k * FACADE_MARK >= 1;
}
var SURFACE_TILE = 8;
function surfacePatternsVisible(k) {
  return k * SURFACE_TILE >= 2;
}

// src/viewers/web/iso/painting/style.ts
var ink = { stroke: "var(--map-hatch)", "stroke-width": 0.75 };
var dot = mark("circle", { cx: 4, cy: 4, r: 0.75, fill: "var(--map-hatch)" });
var cross2 = mark("path", { d: "M4 2V6M2 4H6", ...ink });
var line = mark("path", { d: "M0 3H6", ...ink });
function tile(id, plane, size, body, view) {
  if (view.pitch === 90 && plane !== "ground")
    return [];
  return [node2("pattern", {
    id,
    width: size,
    height: size,
    patternUnits: "userSpaceOnUse",
    patternTransform: planeMatrix(plane, undefined, view)
  }, "", body)];
}
function hash(value) {
  let result = 2166136261;
  for (let index = 0;index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}
function facadePatternId(fileType, plane) {
  return `facade-${hash(fileType).toString(36)}-${plane}`;
}
function facadePattern(fileType, plane, view = DEFAULT_PROJECTION) {
  const value = hash(fileType);
  const bits = (value ^ value >>> 9 ^ value >>> 18) & 511 || 1;
  const windows = Array.from({ length: 9 }, (_, index) => index).filter((index) => (bits & 1 << index) !== 0).map((index) => mark("rect", {
    x: 1 + index % 3 * 2.5,
    y: 1 + Math.floor(index / 3) * 2.5,
    width: FACADE_MARK,
    height: FACADE_MARK,
    fill: "var(--map-hatch)"
  }));
  return tile(facadePatternId(fileType, plane), plane, 8, windows, view);
}
function mapDefs(view = DEFAULT_PROJECTION) {
  return [
    ...tile("dots", "ground", SURFACE_TILE, [dot], view),
    ...tile("dots-left", "left", 8, [dot], view),
    ...tile("dots-right", "right", 8, [dot], view),
    ...tile("cross", "ground", SURFACE_TILE, [cross2], view),
    ...tile("cross-left", "left", 8, [cross2], view),
    ...tile("cross-right", "right", 8, [cross2], view),
    ...tile("lines-left", "left", 6, [line], view),
    ...tile("lines-right", "right", 6, [line], view),
    ...tile("grain", "ground", 12, [mark("circle", { cx: 6, cy: 6, r: 0.6, fill: "var(--map-hatch)" })], view),
    ...tile("hatch-ground", "ground", SURFACE_TILE, [mark("path", { d: `M0 ${SURFACE_TILE}L${SURFACE_TILE} 0`, ...ink })], view)
  ];
}
function paintTint(share, palette) {
  return palette === undefined ? `color-mix(in srgb, var(--ink) ${(share * 100).toFixed(1)}%, var(--paper))` : mixColour(palette.paper, palette.ink, share);
}
function stroke(level, palette, zoom) {
  const width = strokeAt(depthOf(level)).toFixed(2);
  return palette === undefined ? `--stroke: ${width}px;` : `stroke-width: ${Number(width) / zoom};`;
}
function surfaceColours(kind, depth, palette) {
  return `#map .${kind} .ground, #map .${kind} .top { fill: ${paintTint(tintAt(depth), palette)}; }
    #map .${kind} .right { fill: ${paintTint(tintAt(depth + SIDE.right), palette)}; }
    #map .${kind} .left { fill: ${paintTint(tintAt(depth + SIDE.left), palette)}; }`;
}
function patternAttributes(k) {
  return { "data-facades-hidden": !facadeDetailsVisible(k), "data-surface-patterns-hidden": !surfacePatternsVisible(k) };
}
function mapDrawingCss(palette, zoom = 1) {
  const paper = palette?.paper ?? "var(--paper)";
  const ink = palette?.ink ?? "var(--ink)";
  const muted = palette?.muted ?? "var(--muted)";
  const line = palette?.line ?? "var(--map-line)";
  const grid = palette === undefined ? "var(--map-grid)" : mixColour(palette.paper, palette.line, 0.12);
  const gridMajor = palette === undefined ? "var(--map-grid-major)" : mixColour(palette.paper, palette.line, 0.2);
  const width = palette === undefined ? "stroke-width: calc(var(--stroke) * var(--emphasis, 1) * var(--weight, 1));" : "";
  return `
  #map .sheet { pointer-events: none; ${stroke("island", palette, zoom)} }
  #map .calibration-tick, #map .compass, #map .project-plate { ${stroke("building", palette, zoom)} }
  /* zones lie inside slab groups and keep their own weight while the slab is hovered or selected */
  #map .zone { ${stroke("building", palette, zoom)} --emphasis: 1; }
  #map .island { ${stroke("island", palette, zoom)} }
  #map .slab { ${stroke("slab", palette, zoom)} }
  #map .building { ${stroke("building", palette, zoom)} }
  #map .route { ${stroke("route", palette, zoom)} }
  #map .frame, #map .calibration-tick,
  #map .compass .ring, #map .compass .star, #map .compass .north,
  #map .project-plate .plate, #map .project-plate .edit-frame,
  #map .project-plate .pencil path, #map .project-plate .pencil polygon,
  #map .ground, #map .face, #map .route-base, #map .route .line {
    stroke: ${line}; stroke-linejoin: round;
    ${width}
  }
  #map .frame, #map .calibration-tick,
  #map .compass .ring, #map .compass .star,
  #map .project-plate .edit-frame, #map .project-plate .pencil path { fill: none; }
  #map .frame { ${palette === undefined ? "--emphasis: 1.6;" : `stroke-width: ${strokeAt(0) * 1.6 / zoom};`} }
  #map .calibration-tick { stroke-linecap: square; }
  #map .compass { ${palette === undefined ? "--emphasis: 1.25;" : `stroke-width: ${strokeAt(2) * 1.25 / zoom};`} }
  #map .compass .north { fill: ${line}; }
  #map .compass .text { fill: ${ink}; font-weight: 600; }
  #map .project-plate .plate { fill: ${paper}; fill-opacity: 0.72; }
  #map .project-plate .project-title .text { font-weight: 650; letter-spacing: 0.06em; }
  #map .project-plate .project-overview .text { fill: ${muted}; }
  #map .project-plate .project-overview .md-strong { font-weight: 700; fill: ${ink}; }
  #map .project-plate .project-overview .md-emphasis { font-style: italic; }
  #map .project-plate .project-overview .md-code { font-family: ${webFontFamily}; fill: ${ink}; }
  #map .project-plate .project-overview .md-link { text-decoration: underline; text-underline-offset: 2px; }
  #map .project-plate .project-meta .text { fill: ${muted}; letter-spacing: 0.14em; }
  #map .project-edit { pointer-events: all; cursor: pointer; outline: none; }
  #map .project-edit .edit-frame { fill: transparent; pointer-events: all; }
  #map .project-edit .pencil path { stroke-linecap: square; }
  #map .project-edit .pencil .body { fill: ${paintTint(0.1, palette)}; }
  #map .project-edit .pencil .facet { fill: ${paintTint(0.18, palette)}; }
  #map .project-edit .pencil .eraser { fill: ${paintTint(0.28, palette)}; }
  #map .project-edit .pencil .ferrule { fill: ${paintTint(0.18, palette)}; }
  #map .project-edit .pencil .tip { fill: ${paintTint(0.12, palette)}; }
  #map .project-edit .pencil .lead { fill: ${ink}; }
  #map .project-edit .pencil .facet, #map .project-edit .pencil .eraser, #map .project-edit .pencil .ferrule,
  #map .project-edit .pencil .tip, #map .project-edit .pencil .lead { stroke: none; }
  #map .grid { fill: none; stroke: ${grid}; }
  #map .grid.major { stroke: ${gridMajor}; }
  ${surfaceColours("island", depthOf("island"), palette)}
  ${surfaceColours("system", depthOf("island") - 0.5, palette)}
  ${surfaceColours("slab", depthOf("slab"), palette)}
  ${surfaceColours("building", depthOf("building"), palette)}
  #map .actor .face { fill: ${paper}; }
  #map .zone .ground { fill: url(#hatch-ground); }
  #map .pattern { stroke: none; pointer-events: none; }
  #map .island.actors .pattern { fill: url(#dots); }
  #map .island.external .pattern { fill: url(#cross); }
  #map .slab .pattern { fill: url(#grain); }
  #map .building.component .pattern.left { fill: url(#lines-left); }
  #map .building.component .pattern.right { fill: url(#lines-right); }
  #map .building.actor .pattern.left { fill: url(#dots-left); }
  #map .building.actor .pattern.right { fill: url(#dots-right); }
  #map .building.external .pattern.left { fill: url(#cross-left); }
  #map .building.external .pattern.right { fill: url(#cross-right); }
  #map .camera[data-facades-hidden] .building .pattern { display: none; }
  #map .camera[data-surface-patterns-hidden] .island > .pattern,
  #map .camera[data-surface-patterns-hidden] .slab > .pattern { display: none; }
  #map .camera[data-surface-patterns-hidden] .zone > .ground { fill: transparent; }
  #map .label-hit { fill: transparent; stroke: none; pointer-events: all; }
  #map .label-leader {
    stroke: ${line}; ${width}
    vector-effect: non-scaling-stroke; pointer-events: none;
  }
  #map .ghost { opacity: 0.8; }
  #map .ghost .face, #map .ghost .ground { fill: none; pointer-events: all; }
  #map .ghost .pattern { display: none; }
  #map .ghost.draft .face, #map .ghost.draft .ground,
  #map .route-base.ghost.draft, #map .route.ghost.draft:not(.touched):not(.lit) .line { stroke-dasharray: ${4 / zoom} ${3 / zoom}; }
  #map .text { fill: ${ink}; pointer-events: none; }
  #map .island > .label .text, #map .slab > .label .text, #map .zone > .label .text { font-weight: 600; }
  #map .route-base, #map .route .line { fill: none; stroke-linecap: round; opacity: 0.9; }
  #map .route-base { pointer-events: none; }
  #map .route .line { opacity: 0; }
  #map .route .arrow { fill: ${line}; opacity: 0.9; }
  #map .route .hit { fill: none; stroke: transparent; stroke-width: 12; }
`;
}
var HOVERABLE = ".building, .slab, .island.system, .route, .project-edit";
var mapCss = `
  #map > .map-surface {
    position: absolute; inset: 0; cursor: grab;
    user-select: none; -webkit-user-select: none; touch-action: none; outline: none;
  }
  #map .field-surface, #map .camera { position: absolute; inset: 0; width: 100%; height: 100%; }
  #map .field-surface { pointer-events: none; }
  #map .paint-surface { position: absolute; inset: 0; pointer-events: none; }
  #map .scene { display: block; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
  #map .world { pointer-events: auto; }
  /* Chrome can drop animated routes after zooming beneath the forced camera cache. Keep only their own layer promoted during a flow. */
  #map .camera[data-tracing] { will-change: auto !important; }
  #map .camera[data-tracing] .route-surface { will-change: transform; }
  #map > .map-surface [data-id] { cursor: pointer; }
  #map > .map-surface:active, #map .drag-cover { cursor: grabbing; }
  #map .drag-cover { position: absolute; inset: 0; }
  ${mapDrawingCss()}
  #map .route.hovered, #map .route.endpoint, #map .route.touched { --emphasis: ${emphasis(1)}; }
  #map .route.hovered .line { stroke: var(--map-line); opacity: 1; }
  #map .route.hovered .arrow { fill: var(--map-line); opacity: 1; }
  #map .route.endpoint .line, #map .route.selected .line, #map .route.touched .line { stroke: var(--highlight); opacity: 1; }
  #map .route.endpoint .arrow, #map .route.selected .arrow, #map .route.touched .arrow { fill: var(--highlight); opacity: 1; }
  #map .route.touched .line { stroke-dasharray: none; }
  #map .route.lit { --emphasis: ${emphasis(2)}; }
  #map .route.lit .line { stroke: var(--highlight); opacity: 1; stroke-dasharray: 8 5; animation: map-flow 900ms linear infinite; }
  #map .route.lit .arrow { fill: var(--highlight); opacity: 1; }
  #map :is(.route, .building, .slab, .island).focused { --emphasis: ${emphasis(3)}; }
  @keyframes map-flow { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -13; } }
  @media (prefers-reduced-motion: reduce) {
    #map .route.lit .line { animation: none; }
  }
  ${glowCss}
  #map .camera[data-tracing] .route-base,
  #map .camera[data-tracing] .route:not(.lit) { display: none; }
  #map .camera[data-tracing] .building:not(.onpath):not(.selected):not(.touched):not(.neighbor),
  #map .camera[data-tracing] .slab:not(.onpath):not(.selected):not(.touched) { opacity: 0.3; }
  #map .project-edit.hovered .edit-frame, #map .project-edit:focus .edit-frame { fill: var(--ink); fill-opacity: 0.05; }
  #map .project-edit.hovered .pencil path, #map .project-edit:focus .pencil path,
  #map .project-edit.hovered .pencil .body, #map .project-edit:focus .pencil .body { stroke: var(--ink); }
  #map .building.hovered:not(.selected), #map .slab.hovered:not(.selected):not(.context),
  #map .island.system.hovered:not(.selected):not(.context), #map .context { --emphasis: ${emphasis(0.5)}; }
  #map .building.hovered:not(.selected) .face, #map .slab.hovered:not(.selected):not(.context) .face,
  #map .island.system.hovered:not(.selected):not(.context) > .ground { stroke: var(--map-line); }
  #map .selected, #map .touched,
  #map .building.lit, #map .slab.lit, #map .island.lit { --emphasis: ${emphasis(1)}; }
  #map .context .face, #map .island.context > .ground, #map .selected .face, #map :is(.island, .zone).selected > .ground,
  #map .touched .face, #map .island.touched > .ground,
  #map .building.lit .face, #map .slab.lit > .face, #map .island.lit > .ground { stroke: var(--highlight); }
  #map .selected > .label .text, #map .touched > .label .text,
  #map .building.lit > .label .text, #map .slab.lit > .label .text, #map .island.lit > .label .text {
    fill: var(--ink); font-weight: 600;
  }
  #map :is(.island, .slab, .zone):is(.selected, .touched, .lit, .context) > .surface-label .text { fill: var(--highlight); }
  #map :is(.island, .slab, .zone):is(.selected, .touched, .lit, .context) > .surface-label .label-leader { stroke: var(--highlight); }
  #map .building.neighbor:not(.selected):not(.touched):not(.lit) { --emphasis: ${emphasis(0.5)}; }
  #map .building.neighbor:not(.selected):not(.touched):not(.lit) .face { stroke: color-mix(in srgb, var(--highlight) 45%, var(--map-line)); }
  body:not([data-comparison]) #map .camera:has(.component-focus) .building.component:not(.component-focus):not(.neighbor) { opacity: 0.3; }
  body[data-comparison] #map .building:not([data-change]):not(.selected):not(.component-focus):not(.neighbor),
  body[data-comparison] #map .route:not([data-change]):not(.route-base):not(.selected):not(.endpoint):not(.lit) { opacity: .4; }
  body[data-comparison] #map .route-base { opacity: .4; }
  #map .building, #map .route { transition: opacity var(--chrome-motion) var(--chrome-ease); }
  @media (prefers-reduced-motion: reduce) { #map .building, #map .route { transition: none; } }
  #map [data-change="added"] { --change: var(--diff-added); }
  #map [data-change="modified"] { --change: var(--diff-modified); }
  #map [data-change="removed"] { --change: var(--diff-removed); }
  #map .building.component[data-change] .face.top { fill: color-mix(in srgb, var(--change) 25%, var(--paper)); }
  #map .building.component[data-change] .face.left { fill: color-mix(in srgb, var(--change) 18%, var(--paper)); }
  #map .building.component[data-change] .face.right { fill: color-mix(in srgb, var(--change) 11%, var(--paper)); }
  #map .building.component[data-change]:not(.selected):not(.lit):not(.component-focus) .face { stroke: var(--change); }
  #map .building.component[data-change] > .label .text { fill: var(--change); }
  #map .building.component:is(.selected, .lit) > .label .text { fill: var(--highlight-text); }
  #map .route[data-change]:not(.lit):not(.selected):not(.endpoint) .line { stroke: var(--change); opacity: 1; }
  #map .route[data-change]:not(.lit):not(.selected):not(.endpoint) .arrow { fill: var(--change); opacity: 1; }
  ${layerCss}
`;

// src/viewers/web/iso/painting/text.ts
var TITLE_STEPS = [
  { below: 0.25, size: 108, padding: 12 },
  { below: 0.5, size: 84, padding: 10 },
  { below: 1, size: 64, padding: 8 },
  { below: Infinity, size: 48, padding: 6 }
];
var TITLE_LINE_HEIGHT = 1.3;
function surfaceLabelStep(zoom) {
  return TITLE_STEPS.findIndex((step) => zoom < step.below);
}
function surfaceLabelLayout(text, size, zoom, view) {
  const step = TITLE_STEPS[surfaceLabelStep(zoom)];
  const length = (x, y) => {
    const axis = project(x / PLANE, y / PLANE, 0, view);
    return Math.hypot(round(axis.x), round(axis.y));
  };
  const paddingX = Math.min(step.padding / length(1, 0), text.band.width / 20);
  const paddingY = Math.min(step.padding / length(0, 1), text.band.height / 20);
  const fontSize = Math.min(step.size * size / CONTAINER_FONT, size * (text.band.width - 2 * paddingX) / text.width, (text.band.height - 3 * paddingY) / TITLE_LINE_HEIGHT);
  const width = text.width * fontSize / size;
  return {
    fontSize,
    x: (text.width - width) / 2 - paddingX,
    width: width + 2 * paddingX,
    height: 3 * paddingY + fontSize * TITLE_LINE_HEIGHT,
    leader: paddingY,
    baseline: 2 * paddingY + fontSize * 0.9
  };
}
function surfaceText(text, size, className, view) {
  const padding = textPadding(size);
  return node2("g", { transform: planeMatrix("ground", text.origin, view) }, className, text.lines.map((line, index) => node2("text", {
    x: padding,
    y: padding + size * 0.9 + index * textLineHeight(size),
    "font-size": size
  }, "text", line)));
}
function surfaceLabel(text, size, view, spacing = 0, zoom = 1) {
  const layout = surfaceLabelLayout(text, size, zoom, view);
  return node2("g", { transform: planeMatrix("ground", text.origin, view) }, "label surface-label", [
    node2("rect", { x: layout.x, width: layout.width, height: layout.height }, "label-hit"),
    node2("line", { x1: text.width / 2, x2: text.width / 2, y1: 0, y2: layout.leader }, "label-leader"),
    node2("text", {
      x: text.width / 2,
      y: layout.baseline,
      "text-anchor": "middle",
      "font-size": layout.fontSize,
      "letter-spacing": `${spacing}em`
    }, "text", text.lines[0])
  ]);
}

// src/viewers/web/iso/painting/buildings.ts
function classOf(projected) {
  const { building } = projected;
  const kind = building.kind === "actor" ? "actor" : building.external ? "external" : "component";
  const ghost = building.origin === "observed" ? "" : ` ghost ${building.origin}`;
  return `building ${kind}${ghost}`;
}
function facadeDefs(scene) {
  const fileTypes = new Set(scene.buildings.flatMap(({ building }) => building.floors.map((floor) => floor.facadeFileType)));
  return [...fileTypes].flatMap((fileType) => [...facadePattern(fileType, "left", scene.view), ...facadePattern(fileType, "right", scene.view)]);
}
function floorPattern(projected, floor, plane) {
  if (floor !== undefined)
    return facadePatternId(floor.facadeFileType, plane);
  if (projected.building.kind === "actor")
    return `dots-${plane}`;
  return `${projected.building.external ? "cross" : "lines"}-${plane}`;
}
function floorSvg(projected, faces, floor) {
  const body = faces.flatMap((face) => {
    const points = pointsAttribute(face.points);
    const shape = node2("polygon", { points }, `face ${face.side}`);
    if (face.side === "top")
      return [shape];
    const pattern = floorPattern(projected, floor, face.plane);
    return [shape, node2("polygon", { points, style: `fill:url(#${pattern})` }, `pattern ${face.side}`)];
  });
  return floor === undefined ? body : [node2("g", { "data-files": floor.files.join(`
`), "data-file-type": floor.facadeFileType }, "floor", body)];
}
function buildingsSvg(scene) {
  return scene.buildings.map((projected) => {
    const { building, floors, text } = projected;
    return node2("g", { "aria-label": building.title, "data-id": building.representationId }, classOf(projected), [
      ...floors.flatMap((faces, index) => floorSvg(projected, faces, building.floors[index])),
      surfaceText(text, buildingFont(building), "label", scene.view)
    ]);
  });
}

// src/viewers/web/iso/painting/ground.ts
function pathOf(segments) {
  return segments.map((segment) => `M${round(segment.from.x)} ${round(segment.from.y)}L${round(segment.to.x)} ${round(segment.to.y)}`).join("");
}
function compassGroup(compass, view) {
  return node2("g", {}, "compass", [
    node2("polygon", { points: pointsAttribute(compass.ring) }, "ring"),
    node2("polygon", { points: pointsAttribute(compass.star) }, "star"),
    node2("polygon", { points: pointsAttribute(compass.north) }, "north"),
    ...compass.letters.map((letter) => node2("g", { transform: planeMatrix("ground", letter.at, view) }, "", [
      node2("text", { "font-size": compass.fontSize, "text-anchor": "middle", "dominant-baseline": "middle" }, "text", letter.text)
    ]))
  ]);
}
function lineAttributes(text, plain, index) {
  return {
    y: text.fontSize * 0.9 + index * text.lineHeight,
    "font-size": text.fontSize,
    ...textWidth(plain, text.fontSize) > text.maxWidth ? { textLength: text.maxWidth, lengthAdjust: "spacingAndGlyphs" } : {}
  };
}
function plateText(text, className, view) {
  return node2("g", { transform: planeMatrix("ground", text.origin, view) }, className, text.lines.map((line, index) => node2("text", lineAttributes(text, line, index), "text", line)));
}
function richPlateText(text, view) {
  return node2("g", { transform: planeMatrix("ground", text.origin, view) }, "project-overview", text.lines.map((line, index) => node2("text", lineAttributes(text, line.map((run) => run.text).join(""), index), "text", line.map((run) => node2("tspan", {}, run.styles.map((style) => `md-${style}`).join(" "), run.text)))));
}
function pencilGroup(plate, view) {
  const { origin, length, thickness } = plate.edit.pencil;
  const eraser = thickness * 0.45;
  const ferrule = eraser + thickness * 0.25;
  const tip = length - thickness * 0.8;
  const lead = length - thickness * 0.2;
  return node2("g", { transform: planeMatrix("ground", origin, view) }, "pencil", [
    node2("polygon", { points: `0,0 ${thickness},0 ${thickness},${tip} ${thickness / 2},${length} 0,${tip}` }, "body"),
    node2("polygon", {
      points: `${thickness * 0.28},${ferrule} ${thickness * 0.72},${ferrule} ${thickness * 0.72},${tip} ${thickness * 0.28},${tip}`
    }, "facet"),
    node2("polygon", { points: `0,0 ${thickness},0 ${thickness},${eraser} 0,${eraser}` }, "eraser"),
    node2("polygon", { points: `0,${eraser} ${thickness},${eraser} ${thickness},${ferrule} 0,${ferrule}` }, "ferrule"),
    node2("polygon", { points: `0,${tip} ${thickness},${tip} ${thickness / 2},${length}` }, "tip"),
    node2("polygon", { points: `${thickness * 0.4},${lead} ${thickness * 0.6},${lead} ${thickness / 2},${length}` }, "lead"),
    node2("path", { d: `M0 ${eraser}H${thickness}M0 ${ferrule}H${thickness}M0 ${tip}H${thickness}` }, "seams")
  ]);
}
function projectPlateGroup(plate, view) {
  return node2("g", {}, "project-plate", [
    node2("polygon", { points: pointsAttribute(plate.polygon) }, "plate"),
    plateText(plate.title, "project-title", view),
    richPlateText(plate.overview, view),
    plateText(plate.meta, "project-meta", view),
    node2("g", { "data-project-edit": "", role: "button", tabindex: 0, "aria-label": "Edit project profile" }, "project-edit", [
      node2("polygon", { points: pointsAttribute(plate.edit.polygon) }, "edit-frame"),
      pencilGroup(plate, view)
    ])
  ]);
}
function sheetSvg(scene) {
  return [
    node2("polygon", { points: pointsAttribute(scene.frame) }, "frame"),
    node2("path", { d: pathOf(scene.calibrationTicks) }, "calibration-tick"),
    compassGroup(scene.compass, scene.view),
    ...scene.projectPlate === undefined ? [] : [projectPlateGroup(scene.projectPlate, scene.view)]
  ];
}
function zoneGroup(zone, view, zoom) {
  const attributes = zone.zone.unidentifiedContainer ? { "data-id": zone.zone.key, "aria-label": zone.zone.name } : {};
  return node2("g", attributes, "zone", [
    node2("polygon", { points: pointsAttribute(zone.polygon) }, "ground"),
    surfaceLabel(zone.text, GROUP_FONT, view, 0, zoom)
  ]);
}
function islandsSvg(scene, zoom = 1) {
  return [
    ...scene.islands.map(({ island, polygon, text }) => {
      const attributes = island.element === null ? {} : { "data-id": island.element.representationId, "aria-label": island.name };
      return node2("g", attributes, `island ${island.kind}`, [
        node2("polygon", { points: pointsAttribute(polygon) }, "ground"),
        ...island.kind === "system" ? [] : [node2("polygon", { points: pointsAttribute(polygon) }, "pattern")],
        surfaceLabel(text, ISLAND_FONT, scene.view, ISLAND_SPACING, zoom)
      ]);
    }),
    ...scene.zones.filter((zone) => scene.islands.some((item) => item.island.key === zone.zone.parent)).map((zone) => zoneGroup(zone, scene.view, zoom))
  ];
}
function slabsSvg(scene, zoom = 1) {
  return scene.slabs.map(({ slab, faces, text }) => {
    const ghost = slab.origin === "observed" ? "" : ` ghost ${slab.origin}`;
    const top = faces.find((face) => face.side === "top");
    return node2("g", { "aria-label": slab.title, "data-id": slab.representationId }, `slab${ghost}`, [
      ...faces.map((face) => node2("polygon", { points: pointsAttribute(face.points) }, `face ${face.side}`)),
      node2("polygon", { points: pointsAttribute(top.points) }, "pattern"),
      surfaceLabel(text, CONTAINER_FONT, scene.view, 0, zoom),
      ...scene.zones.filter((zone) => zone.zone.parent === slab.representationId).map((zone) => zoneGroup(zone, scene.view, zoom))
    ]);
  });
}

// src/viewers/web/iso/painting/routes.ts
function routesSvg(scene) {
  const basePathsByOrigin = new Map;
  const interactiveRoutes = scene.routes.map(({ route, points, arrow, lifts }) => {
    const originPaths = basePathsByOrigin.get(route.origin) ?? [];
    const liftPath = lifts.map(({ from, to }) => `M${pointsAttribute([from])}L${pointsAttribute([to])}`).join("");
    originPaths.push(`M${pointsAttribute(points)}`, liftPath);
    basePathsByOrigin.set(route.origin, originPaths);
    const ghost = route.origin === "observed" ? "" : ` ghost ${route.origin}`;
    return node2("g", { "data-id": route.id }, `route${ghost}`, [
      node2("polyline", { points: pointsAttribute(points) }, "line"),
      node2("path", { d: liftPath }, "line lift"),
      node2("g", { transform: `${planeMatrix("ground", arrow.at, scene.view)} rotate(${arrow.turn})` }, "arrow", [
        node2("path", { d: "M0 0L-8 5.25L-8 -5.25Z" })
      ]),
      node2("polyline", { points: pointsAttribute(points) }, "hit"),
      node2("title", {}, "", route.description)
    ]);
  });
  const base = [...basePathsByOrigin].map(([origin, lines]) => {
    const ghost = origin === "observed" ? "" : ` ghost ${origin}`;
    return node2("path", { d: lines.join("") }, `route route-base${ghost}`);
  });
  return [...base, ...interactiveRoutes];
}

// src/viewers/web/iso/grid.ts
var TILE_CELLS = 5;
var TILE_SIZE = TILE_CELLS * PLANE;
var MIN_ROW_PITCH_PX = 6;
var FULL_LINE_PITCH_PX = 24;
var row = (offset) => `M${offset} 0V${TILE_SIZE}M0 ${offset}H${TILE_SIZE}`;
var MAJOR_ROWS = row(0);
var MINOR_ROWS = Array.from({ length: TILE_CELLS - 1 }, (_, index) => row((index + 1) * PLANE)).join("");
function lineWidth(k, pitch) {
  return Math.min(1 / k, pitch / FULL_LINE_PITCH_PX);
}
function gridPattern(camera, view = DEFAULT_PROJECTION) {
  const minorHidden = camera.k * PLANE < MIN_ROW_PITCH_PX;
  return node2("pattern", {
    id: "grid",
    patternUnits: "userSpaceOnUse",
    width: TILE_SIZE,
    height: TILE_SIZE,
    patternTransform: `translate(${camera.x} ${camera.y}) scale(${camera.k}) ${planeMatrix("ground", undefined, view)}`
  }, "", [
    mark("path", { class: "grid", d: MINOR_ROWS, "stroke-width": lineWidth(camera.k, PLANE), ...minorHidden ? { display: "none" } : {} }),
    mark("path", { class: "grid major", d: MAJOR_ROWS, "stroke-width": lineWidth(camera.k, TILE_SIZE) })
  ]);
}
function createGrid() {
  const surface = svg("svg", { width: "100%", height: "100%", "aria-hidden": "true" }, "field-surface");
  const definitions = svg("defs");
  const field = svg("rect", { width: "100%", height: "100%", fill: "url(#grid)" });
  surface.append(definitions, field);
  return {
    surface,
    follow(camera, view) {
      const visible = camera.k * TILE_SIZE >= MIN_ROW_PITCH_PX;
      field.style.display = visible ? "" : "none";
      if (visible)
        patch(definitions, [gridPattern(camera, view)]);
    }
  };
}

// src/viewers/web/iso/painting/map.ts
var FOOT_INSET = 10;
function onSurface(points) {
  const west = points.reduce((best, point) => point.x < best.x ? point : best);
  return { x: west.x + FOOT_INSET, y: west.y };
}
function paintSurface(name, layers) {
  const surface = document.createElement("div");
  surface.className = `paint-surface ${name}`;
  const scene = svg("svg", { width: "100%", height: "100%", overflow: "visible" }, "scene");
  const world = svg("g", {}, "world");
  world.append(...layers);
  scene.append(world);
  surface.append(scene);
  return { surface, scene, world };
}
function highlightInputs(scene) {
  return {
    routes: scene.routes.map(({ route }) => ({ id: route.id, ids: route.relationshipIds ?? [route.id], source: route.source, target: route.target })),
    surfaces: [
      ...scene.buildings.map(({ building }) => [building.representationId, building.surface]),
      ...scene.slabs.map(({ slab }) => [slab.representationId, slab.island])
    ]
  };
}
function createMap(host) {
  const root = document.createElement("div");
  root.className = "map-surface";
  root.setAttribute("role", "img");
  root.setAttribute("aria-label", "Architecture map");
  root.tabIndex = 0;
  const grid = createGrid();
  const cameraLayer = createCameraLayer({
    drawCamera: (view) => drawCamera(view),
    moveStarted: () => glows.hide(true),
    settled: () => {
      if (dragCover.hidden)
        hover(pointer === undefined ? undefined : document.elementFromPoint(pointer.x, pointer.y));
      updateGlows();
      glows.hide(false);
    }
  });
  const layers = {
    sheet: svg("g", {}, "sheet"),
    islands: svg("g", {}, "islands"),
    slabs: svg("g", {}, "slabs"),
    routes: svg("g", {}, "routes"),
    items: svg("g", {}, "items"),
    layerLabels: svg("g", {}, "layer-labels")
  };
  const ground = paintSurface("ground-surface", [layers.sheet, layers.islands, layers.slabs]);
  const routeSurface = paintSurface("route-surface", [layers.routes]);
  const foreground = paintSurface("foreground-surface", [layers.items, layers.layerLabels]);
  const definitions = svg("defs");
  foreground.scene.prepend(definitions);
  const paintSurfaces = [ground, routeSurface, foreground];
  cameraLayer.element.append(...paintSurfaces.map(({ surface }) => surface));
  const glows = createGlows(cameraLayer.element, routeSurface.surface);
  const dragCover = document.createElement("div");
  dragCover.className = "drag-cover";
  dragCover.hidden = true;
  root.append(grid.surface, cameraLayer.element, dragCover);
  host.replaceChildren(root);
  let items = new Map;
  let painted;
  let routes = new Map;
  let labelStep = surfaceLabelStep(1);
  let surfaces = new Map;
  let highlighted = "";
  let hovered;
  let pointer;
  const updateGlows = () => {
    if (painted === undefined || cameraLayer.moving)
      return;
    const focused = [...items].filter(([, item]) => item.matches(".component-focus, :is(.building, .slab, .island).focused"));
    glows.show(painted, focused.map(([id]) => id), cameraLayer.drawn);
  };
  const hover = (target) => {
    if (cameraLayer.moving)
      return;
    const next = target instanceof Element ? target.closest(HOVERABLE) ?? undefined : undefined;
    if (next === hovered)
      return;
    hovered?.classList.remove("hovered");
    next?.classList.add("hovered");
    hovered = next;
  };
  const drawSurfaces = (scene, zoom) => {
    labelStep = surfaceLabelStep(zoom);
    return [patch(layers.islands, islandsSvg(scene, zoom)), patch(layers.slabs, slabsSvg(scene, zoom))].some(Boolean);
  };
  const draw = (scene, zoom) => [
    patch(definitions, [...mapDefs(scene.view), ...facadeDefs(scene)]),
    patch(layers.sheet, [...layerPlanesSvg(scene), ...sheetSvg(scene)]),
    drawSurfaces(scene, zoom),
    patch(layers.items, buildingsSvg(scene)),
    patch(layers.routes, routesSvg(scene)),
    patch(layers.layerLabels, layerLabelsSvg(scene))
  ].some(Boolean);
  const index = (inputs) => {
    items = new Map([layers.islands, layers.slabs, layers.items].flatMap((group) => [...group.querySelectorAll("[data-id]")].map((item) => [item.dataset.id, item])));
    const groups = new Map([...layers.routes.querySelectorAll("g.route")].map((group) => [group.dataset.id, group]));
    routes = new Map;
    for (const route of inputs.routes) {
      const entry = { group: groups.get(route.id), ids: route.ids, source: route.source, target: route.target };
      for (const id of route.ids)
        routes.set(id, entry);
    }
    surfaces = new Map(inputs.surfaces);
  };
  const drawCamera = ({ camera, zoomRatio }) => {
    if (painted !== undefined && surfaceLabelStep(camera.k) !== labelStep)
      drawSurfaces(painted, camera.k);
    glows.move(camera);
    for (const { world } of paintSurfaces) {
      world.setAttribute("transform", `translate(${camera.x} ${camera.y}) scale(${camera.k})`);
    }
    cameraLayer.element.style.setProperty("--weight", String(weightAt(zoomRatio)));
    cameraLayer.element.style.setProperty("--camera-scale", String(camera.k));
    for (const [name, set] of Object.entries(patternAttributes(camera.k)))
      cameraLayer.element.toggleAttribute(name, set);
  };
  root.addEventListener("pointermove", (event) => {
    pointer = { x: event.clientX, y: event.clientY };
    if (event.buttons === 0)
      hover(event.target);
  });
  root.addEventListener("pointerleave", () => {
    pointer = undefined;
    hover(undefined);
  });
  return {
    svg: root,
    dragging(active) {
      dragCover.hidden = !active;
    },
    move(camera, zoomRatio) {
      grid.follow(camera, painted?.view ?? DEFAULT_PROJECTION);
      return cameraLayer.move({ camera, zoomRatio });
    },
    approach(destination, zoomRatio) {
      cameraLayer.approach({ camera: destination, zoomRatio });
    },
    paint(scene) {
      painted = scene;
      const reshaped = draw(scene, cameraLayer.shown?.k ?? 1);
      cameraLayer.invalidate();
      const inputs = highlightInputs(scene);
      const key = JSON.stringify(inputs);
      if (!reshaped && key === highlighted)
        return false;
      highlighted = key;
      index(inputs);
      return true;
    },
    changes(comparison) {
      const apply = (node, status) => {
        if (status === undefined || status === "unchanged")
          node.removeAttribute("data-change");
        else
          node.setAttribute("data-change", status);
      };
      for (const [id, node] of items)
        apply(node, comparison?.components[id]?.status);
      for (const route of new Set(routes.values())) {
        const statuses = new Set(route.ids.map((id) => comparison?.relationships[id]).filter((status) => status !== undefined && status !== "unchanged"));
        apply(route.group, statuses.size > 1 ? "modified" : [...statuses][0]);
      }
    },
    select(ids) {
      const directItems = new Set;
      const selectedItems = new Set;
      const selectedRoutes = new Set;
      const contexts = new Set;
      for (const id of ids) {
        const route = routes.get(id);
        if (route !== undefined) {
          selectedRoutes.add(id);
          selectedItems.add(route.source).add(route.target);
        } else {
          directItems.add(id);
          selectedItems.add(id);
          const context = surfaces.get(id);
          if (context !== undefined)
            contexts.add(context);
        }
      }
      for (const [itemId, node] of items) {
        node.classList.toggle("selected", selectedItems.has(itemId));
        node.classList.toggle("context", contexts.has(itemId));
      }
      for (const node of new Set(routes.values())) {
        node.group.classList.toggle("selected", node.ids.some((id) => selectedRoutes.has(id)));
        node.group.classList.toggle("endpoint", directItems.has(node.source) || directItems.has(node.target));
      }
    },
    markNeighbors(selectedId, neighbors) {
      for (const [itemId, node] of items) {
        node.classList.toggle("component-focus", itemId === selectedId);
        node.classList.toggle("neighbor", itemId !== selectedId && neighbors.has(itemId));
      }
      updateGlows();
    },
    mark(ids) {
      for (const [itemId, node] of items)
        node.classList.toggle("touched", ids.has(itemId));
      for (const route of new Set(routes.values())) {
        route.group.classList.toggle("touched", ids.has(route.source));
      }
    },
    setLitRoutes(litRouteIds, onPath, focusedRouteId) {
      const tracing = litRouteIds.size > 0;
      const litEndpointIds = new Set;
      const focused = focusedRouteId === undefined ? undefined : routes.get(focusedRouteId);
      cameraLayer.element.toggleAttribute("data-tracing", tracing);
      for (const route of new Set(routes.values())) {
        const lit = route.ids.some((id) => litRouteIds.has(id));
        route.group.classList.toggle("lit", lit);
        route.group.classList.toggle("focused", lit && focusedRouteId !== undefined && route.ids.includes(focusedRouteId));
        if (lit)
          litEndpointIds.add(route.source).add(route.target);
      }
      for (const [itemId, node] of items) {
        node.classList.toggle("lit", litEndpointIds.has(itemId));
        node.classList.toggle("focused", litEndpointIds.has(itemId) && (itemId === focused?.source || itemId === focused?.target));
        node.classList.toggle("onpath", tracing && onPath(itemId));
      }
      updateGlows();
    },
    hitId(target) {
      if (!(target instanceof Element))
        return;
      return target.closest("[data-id]")?.dataset.id;
    },
    isSheet(target) {
      return target === root || target === cameraLayer.element;
    },
    isProjectEdit(target) {
      return target instanceof Element && target.closest("[data-project-edit]") !== null;
    },
    anchorOf(id) {
      const building = painted?.buildings.find((item) => item.building.representationId === id);
      if (building)
        return onSurface(building.floors.at(-1).find((face) => face.side === "top").points);
      const slab = painted?.slabs.find((item) => item.slab.representationId === id);
      if (slab)
        return onSurface(slab.faces.find((face) => face.side === "top").points);
      const island = painted?.islands.find((item) => item.island.element?.representationId === id);
      return island === undefined ? undefined : onSurface(island.polygon);
    }
  };
}

// src/viewers/flows.ts
function flowRouteIds(flow, world) {
  const steps = world.flows.find((item) => item.id === flow?.id)?.steps ?? [];
  return new Set((flow?.step === undefined ? steps : steps.slice(flow.step, flow.step + 1)).map((step) => step.relationshipId));
}
function elementOnPath(elementId, pathIds, world) {
  const parentOf = parentOfElements(world.elements);
  return world.relationships.some((relationship) => pathIds.has(relationship.id) && (ancestorIds(relationship.source, parentOf).includes(elementId) || ancestorIds(relationship.target, parentOf).includes(elementId)));
}
function flowsThrough(elementId, world) {
  return world.flows.filter((flow) => elementOnPath(elementId, flowRouteIds({ id: flow.id }, world), world));
}

// src/viewers/web/iso/highlights.ts
function componentNeighborhood(selection, world) {
  const id = selection.kind === "architecture" ? primarySelection(selection) : undefined;
  const selected = world.elements.find((element) => element.representationId === id && element.kind === "component");
  const peers = new Set(world.relationships.flatMap((edge) => {
    if (edge.source === selected?.representationId)
      return [edge.target];
    if (edge.target === selected?.representationId)
      return [edge.source];
    return [];
  }));
  const neighbors = new Set(world.elements.filter((element) => element.kind === "component" && peers.has(element.representationId)).map((element) => element.representationId));
  return { selected: selected?.representationId, neighbors };
}
function createMapHighlights(map) {
  return {
    paint(selection, world, flows, tasks) {
      const neighborhood = componentNeighborhood(selection, world);
      map.select(selectedArchitecture(selection));
      map.markNeighbors(neighborhood.selected, neighborhood.neighbors);
      map.mark(new Set(tasks.flatMap((item) => touchedElements(item, world))));
      const { routes, focusedRoute } = flowHighlight(flows, world);
      map.setLitRoutes(routes, (id) => elementOnPath(id, routes, world), focusedRoute);
    }
  };
}

// src/viewers/web/iso/camera/pointer.ts
var DRAG_THRESHOLD = 4;
var RELEASE_WINDOW_MS = 100;
function bindMapPointer(host, map, actions) {
  function inPane(x, y) {
    const rect = host.getBoundingClientRect();
    return { x: x - rect.left, y: y - rect.top };
  }
  host.addEventListener("wheel", (event) => {
    if (event.target instanceof Element && event.target.closest("#work"))
      return;
    event.preventDefault();
    const step = wheelAction(event);
    if (step.kind === "pan")
      actions.pan(step.dx, step.dy);
    else
      actions.zoom(step.factor, inPane(event.clientX, event.clientY));
  }, { passive: false });
  const pointers = new Map;
  let press = null;
  let trail = [];
  let pinched = false;
  map.svg.addEventListener("pointerdown", (event) => {
    if (event.button !== 0)
      return;
    if (pointers.size === 0) {
      actions.hold();
      trail = [];
      pinched = false;
    }
    const start = { x: event.clientX, y: event.clientY };
    pointers.set(event.pointerId, start);
    if (pointers.size > 1)
      pinched = true;
    press = pointers.size > 1 ? null : {
      id: event.pointerId,
      start,
      targetId: map.hitId(event.target),
      onSheet: map.isSheet(event.target),
      projectEdit: map.isProjectEdit(event.target),
      additive: event.shiftKey
    };
    map.svg.setPointerCapture(event.pointerId);
  });
  map.svg.addEventListener("pointermove", (event) => {
    const last = pointers.get(event.pointerId);
    if (last === undefined)
      return;
    const next = { x: event.clientX, y: event.clientY };
    if (press !== null && Math.hypot(next.x - press.start.x, next.y - press.start.y) <= DRAG_THRESHOLD)
      return;
    press = null;
    map.dragging(true);
    pointers.set(event.pointerId, next);
    const still = [...pointers].find(([id]) => id !== event.pointerId)?.[1];
    if (still !== undefined)
      pinch(last, next, still);
    else if (actions.orbiting() && !event.shiftKey)
      actions.orbit(next.x - last.x, next.y - last.y);
    else {
      actions.pan(next.x - last.x, next.y - last.y);
      trail.push({ ...next, time: event.timeStamp });
    }
  });
  function pinch(from, to, still) {
    const before = { x: (from.x + still.x) / 2, y: (from.y + still.y) / 2 };
    const after = { x: (to.x + still.x) / 2, y: (to.y + still.y) / 2 };
    const factor = Math.hypot(to.x - still.x, to.y - still.y) / Math.hypot(from.x - still.x, from.y - still.y);
    actions.pan(after.x - before.x, after.y - before.y);
    actions.zoom(factor, inPane(after.x, after.y));
  }
  function tap(pressed) {
    if (pressed.projectEdit)
      actions.editProject();
    else if (pressed.targetId !== undefined)
      actions.select(pressed.targetId, pressed.additive);
    else if (pressed.onSheet)
      actions.deselect();
  }
  function release(end) {
    const first = trail.find((sample) => end.time - sample.time <= RELEASE_WINDOW_MS);
    if (first === undefined || end.time <= first.time)
      return;
    actions.glide({ x: (end.x - first.x) / (end.time - first.time), y: (end.y - first.y) / (end.time - first.time) });
  }
  map.svg.addEventListener("pointerup", (event) => {
    if (!pointers.delete(event.pointerId))
      return;
    if (press?.id === event.pointerId)
      tap(press);
    else if (pointers.size === 0 && !pinched)
      release({ x: event.clientX, y: event.clientY, time: event.timeStamp });
    press = null;
    if (pointers.size === 0)
      map.dragging(false);
  });
  map.svg.addEventListener("pointercancel", (event) => {
    pointers.delete(event.pointerId);
    press = null;
    if (pointers.size === 0)
      map.dragging(false);
  });
}

// src/viewers/web/iso/camera/motion.ts
var CAMERA_DURATION_MS = 220;
var GLIDE_TIME_CONSTANT_MS = 500;
var GLIDE_STOP_SPEED = 0.02;
function createCameraMotion(initial) {
  let current = initial;
  let target = initial;
  let framingFrom = initial;
  let transition;
  let glide;
  const glideStep = (now, { from, velocity, started }) => {
    const duration = GLIDE_TIME_CONSTANT_MS * Math.log(Math.hypot(velocity.x, velocity.y) / GLIDE_STOP_SPEED);
    const elapsed = Math.max(0, Math.min(now - started, duration));
    const fullSpeedMs = GLIDE_TIME_CONSTANT_MS * (1 - Math.exp(-elapsed / GLIDE_TIME_CONSTANT_MS));
    current = pan(from, velocity.x * fullSpeedMs, velocity.y * fullSpeedMs);
    target = current;
    if (elapsed < duration)
      return true;
    glide = undefined;
    return false;
  };
  return {
    get current() {
      return current;
    },
    get target() {
      return target;
    },
    move(to, now, animate) {
      glide = undefined;
      target = to;
      transition = animate ? { from: current, started: now } : undefined;
      if (!animate)
        current = to;
    },
    frame(to, amount) {
      glide = undefined;
      if (amount === 0)
        framingFrom = current;
      target = to;
      transition = undefined;
      current = amount === 1 ? to : {
        k: framingFrom.k + (to.k - framingFrom.k) * amount,
        x: framingFrom.x + (to.x - framingFrom.x) * amount,
        y: framingFrom.y + (to.y - framingFrom.y) * amount
      };
    },
    glide(velocity, now) {
      transition = undefined;
      glide = { from: current, velocity, started: now };
    },
    step(now) {
      if (glide !== undefined)
        return glideStep(now, glide);
      if (transition === undefined)
        return false;
      const progress = Math.min(1, Math.max(0, (now - transition.started) / CAMERA_DURATION_MS));
      const amount = 1 - (1 - progress) ** 3;
      const { from } = transition;
      current = {
        k: from.k + (target.k - from.k) * amount,
        x: from.x + (target.x - from.x) * amount,
        y: from.y + (target.y - from.y) * amount
      };
      if (progress < 1)
        return true;
      current = target;
      transition = undefined;
      return false;
    }
  };
}
function createCameraAnimator(initial, paint, approach) {
  const motion = createCameraMotion(initial);
  let frame;
  const stopFrame = () => {
    if (frame !== undefined)
      cancelAnimationFrame(frame);
    frame = undefined;
  };
  const tick = (now) => {
    frame = undefined;
    const moving = motion.step(now);
    paint();
    if (moving)
      frame = requestAnimationFrame(tick);
  };
  const start = (to, animate) => {
    stopFrame();
    motion.move(to, performance.now(), animate);
    frame = requestAnimationFrame(tick);
  };
  const track = (to) => start(to, false);
  return {
    get current() {
      return motion.current;
    },
    get target() {
      return motion.target;
    },
    frame(to, amount) {
      stopFrame();
      motion.frame(to, amount);
      frame = requestAnimationFrame(tick);
    },
    navigate(to) {
      approach(to);
      start(to, !matchMedia("(prefers-reduced-motion: reduce)").matches);
    },
    track,
    hold: () => track(motion.current),
    glide(velocity) {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches)
        return;
      stopFrame();
      motion.glide(velocity, performance.now());
      frame = requestAnimationFrame(tick);
    }
  };
}

// src/viewers/web/iso/camera/session.ts
function createCameraSession(options) {
  const fitTo = (frame) => pan(fitCamera(options.bounds(), frame), frame.x, frame.y);
  const focused = (frame, fitted) => {
    const next = options.focus?.(frame, fitted);
    return next === undefined ? fitted : pan(next, frame.x, frame.y);
  };
  let fitted = fitTo(options.frame());
  let touched = false;
  const zoom = (view) => view.k / fitted.k;
  const animator = createCameraAnimator(focused(options.frame(), fitted), paint, (to) => options.approach(to, zoom(to)));
  function paint() {
    const current = animator.current;
    if (options.move(current, zoom(current)))
      options.readout.textContent = zoomReadout(current, fitted) || "100%";
  }
  const refit = () => {
    fitted = fitTo(options.frame());
    animator.navigate(focused(options.frame(), fitted));
    touched = false;
  };
  let last = options.frame();
  new ResizeObserver(() => {
    const next = options.frame();
    if (touched) {
      animator.navigate(pan(animator.target, next.x + next.width / 2 - last.x - last.width / 2, next.y + next.height / 2 - last.y - last.height / 2));
      fitted = fitTo(next);
    } else
      refit();
    last = next;
  }).observe(options.host);
  return {
    get current() {
      return animator.current;
    },
    get target() {
      return animator.target;
    },
    navigate: animator.navigate,
    track: animator.track,
    frame: animator.frame,
    hold: animator.hold,
    glide: animator.glide,
    get fitted() {
      return fitted;
    },
    get touched() {
      return touched;
    },
    set touched(value) {
      touched = value;
    },
    paint,
    refit,
    refitTo(frame) {
      fitted = fitTo(frame);
      return focused(frame, fitted);
    },
    zoomBy(factor) {
      const frame = options.frame();
      animator.navigate(zoomAbout(animator.target, factor, { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 }, fitted));
      touched = true;
    },
    zoomAt(factor, point) {
      animator.track(zoomAbout(animator.current, factor, point, fitted));
      touched = true;
    },
    panBy(dx, dy) {
      animator.track(pan(animator.current, dx, dy));
      touched = true;
    },
    focus(next, frame) {
      if (next === undefined)
        return;
      animator.navigate(pan(next, frame.x, frame.y));
      touched = true;
    }
  };
}

// src/viewers/web/iso/view-motion/orbit.ts
var NESTED_POSE = { ...DEFAULT_PROJECTION, separation: 0, flatten: 0 };
var OVERHEAD_POSE = { yaw: 0, pitch: 90, separation: 0, flatten: 1 };
var EXPLODED_POSE = { yaw: 57, pitch: 36, separation: 1, flatten: 0 };
var ORBIT_DURATION_MS = 650;
var PLAN_DURATION_MS = 850;
var MIN_PITCH = 18;
var MAX_PITCH = 58;
var YAW_PER_PIXEL = 0.28;
var PITCH_PER_PIXEL = 0.18;
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function wrapYaw(yaw) {
  return (yaw % 360 + 360) % 360;
}
function yawDelta(from, to) {
  return (to - from + 540) % 360 - 180;
}
function ease(progress) {
  const bounded = clamp(progress, 0, 1);
  return 1 - (1 - bounded) ** 3;
}
function interpolatePose(from, to, progress) {
  const t = clamp(progress, 0, 1);
  const amount = from.flatten === to.flatten ? ease(t) : t * t * t * (t * (t * 6 - 15) + 10);
  return {
    yaw: wrapYaw(from.yaw + yawDelta(from.yaw, to.yaw) * amount),
    pitch: from.pitch + (to.pitch - from.pitch) * amount,
    separation: from.separation + (to.separation - from.separation) * amount,
    flatten: from.flatten + (to.flatten - from.flatten) * amount
  };
}
function orbitPose(pose, dx, dy) {
  return {
    ...pose,
    yaw: wrapYaw(pose.yaw + dx * YAW_PER_PIXEL),
    pitch: clamp(pose.pitch - dy * PITCH_PER_PIXEL, MIN_PITCH, MAX_PITCH)
  };
}

// src/viewers/web/iso/projection/separation.ts
var ARCHITECTURE_LAYERS = [
  "system",
  "container",
  "component"
];
var MIN_GAP = 96;
function layerIndex(layer) {
  return ARCHITECTURE_LAYERS.indexOf(layer);
}
function layerGap(scene) {
  return Math.max(MIN_GAP, scene.bounds.width * 0.12, scene.bounds.height * 0.18);
}
function shift(point, lift) {
  return { x: point.x, y: point.y - lift };
}
function shiftText(text, lift) {
  return { ...text, origin: shift(text.origin, lift) };
}
function elementLayers(scene) {
  return new Map([
    ...scene.islands.flatMap(({ island }) => island.element === null ? [] : [[island.element.representationId, "system"]]),
    ...scene.slabs.map(({ slab }) => [slab.representationId, "container"]),
    ...scene.buildings.map(({ building }) => [
      building.representationId,
      building.kind === "component" ? "component" : "system"
    ])
  ]);
}
function sceneAtSeparation(scene, separation) {
  if (separation <= 0) {
    return {
      ...scene,
      routes: scene.routes.map((route) => ({ ...route, lifts: [] })),
      layerPlanes: []
    };
  }
  const gap = layerGap(scene) * Math.min(separation, 1);
  const liftOf = (layer) => layerIndex(layer) * gap;
  const layers = elementLayers(scene);
  const layerOf = (id) => layers.get(id) ?? "system";
  const layerPlanes = ARCHITECTURE_LAYERS.map((layer) => {
    const polygon = scene.frame.map((point) => shift(point, liftOf(layer)));
    const west = polygon.reduce((best, point) => point.x < best.x ? point : best);
    return {
      layer,
      polygon,
      label: { at: { x: west.x + 12, y: west.y - 10 }, text: layer.toUpperCase() },
      opacity: Math.min(separation, 1)
    };
  });
  const zones = scene.zones.map((item) => {
    const lift = layers.get(item.zone.parent) === "container" ? liftOf("container") : 0;
    return {
      ...item,
      polygon: item.polygon.map((point) => shift(point, lift)),
      text: shiftText(item.text, lift)
    };
  });
  const liftedSlabs = scene.slabs.map((item) => ({
    ...item,
    faces: item.faces.map((face) => ({
      ...face,
      points: face.points.map((point) => shift(point, liftOf("container")))
    })),
    text: shiftText(item.text, liftOf("container"))
  }));
  const buildings = scene.buildings.map((item) => {
    const lift = liftOf(layerOf(item.building.representationId));
    return {
      ...item,
      floors: item.floors.map((floor) => floor.map((face) => ({
        ...face,
        points: face.points.map((point) => shift(point, lift))
      }))),
      text: shiftText(item.text, lift)
    };
  });
  const routes = scene.routes.map((item) => {
    const ownLayers = [layerOf(item.route.source), layerOf(item.route.target)];
    const routeLayer = ownLayers.reduce((deepest, layer) => layerIndex(layer) > layerIndex(deepest) ? layer : deepest);
    const routeLift = liftOf(routeLayer);
    const points = item.points.map((point) => shift(point, routeLift));
    const endpoints = [item.points[0], item.points.at(-1)];
    const lifts = endpoints.flatMap((point, index) => {
      const ownLift = liftOf(ownLayers[index]);
      return ownLift === routeLift ? [] : [{ from: shift(point, ownLift), to: shift(point, routeLift) }];
    });
    return {
      ...item,
      points,
      arrow: { ...item.arrow, at: shift(item.arrow.at, routeLift) },
      lifts
    };
  });
  const { x, y, width, height } = scene.bounds;
  const points = [
    { x, y },
    { x: x + width, y: y + height },
    ...layerPlanes.flatMap((plane) => plane.polygon),
    ...layerPlanes.map((plane) => plane.label.at),
    ...zones.flatMap((item) => item.polygon),
    ...liftedSlabs.flatMap((item) => item.faces.flatMap((face) => face.points)),
    ...buildings.flatMap((item) => item.floors.flatMap((floor) => floor.flatMap((face) => face.points))),
    ...routes.flatMap((item) => [...item.points, ...item.lifts.flatMap((lift) => [lift.from, lift.to])])
  ];
  return {
    ...scene,
    zones,
    slabs: liftedSlabs,
    buildings,
    routes,
    layerPlanes,
    bounds: boundsOf(points)
  };
}

// src/viewers/web/iso/view-motion/morph.ts
var MORPH_DURATION_MS = 700;
var MORPH_FASTEST_MS = 160;
var MORPH_LIMIT = 500;
var SEED = 0.02;
var mix = (from, to, amount) => from + (to - from) * amount;
function mixRect(from, to, amount) {
  return { gx: mix(from.gx, to.gx, amount), gy: mix(from.gy, to.gy, amount), w: mix(from.w, to.w, amount), d: mix(from.d, to.d, amount) };
}
function sizedRect(rect, size) {
  return { gx: rect.gx + rect.w * (1 - size) / 2, gy: rect.gy + rect.d * (1 - size) / 2, w: rect.w * size, d: rect.d * size };
}
function sizedSurface(font) {
  const band = labelBand(font);
  return (item, size) => {
    const body = item.rect.d - band;
    return { ...item, rect: { gx: item.rect.gx + item.rect.w * (1 - size) / 2, gy: item.rect.gy + body * (1 - size) / 2, w: item.rect.w * size, d: band + body * size } };
  };
}
function blend(from, to, amount, keyOf, shared, sized) {
  const before = new Map(from.map((item) => [keyOf(item), item]));
  const after = new Set(to.map(keyOf));
  const result = to.map((item) => {
    const old = before.get(keyOf(item));
    return old === undefined ? sized(item, Math.max(amount, SEED)) : shared(old, item);
  });
  for (const item of from)
    if (!after.has(keyOf(item)))
      result.push(sized(item, Math.max(1 - amount, SEED)));
  return result;
}
function sizedBuilding(building, size) {
  return {
    ...building,
    rect: sizedRect(building.rect, size),
    heightUnits: building.heightUnits * size,
    floors: building.floors.map((floor) => ({
      ...floor,
      heightUnits: floor.heightUnits * size,
      footprint: { w: floor.footprint.w * size, d: floor.footprint.d * size }
    })),
    lines: size < 0.5 ? [""] : building.lines
  };
}
function blendBuilding(from, to, amount) {
  const sameFloors = from.floors.length === to.floors.length;
  return {
    ...to,
    rect: mixRect(from.rect, to.rect, amount),
    heightUnits: mix(from.heightUnits, to.heightUnits, amount),
    floors: sameFloors ? to.floors.map((floor, index) => ({
      ...floor,
      heightUnits: mix(from.floors[index].heightUnits, floor.heightUnits, amount),
      footprint: { w: mix(from.floors[index].footprint.w, floor.footprint.w, amount), d: mix(from.floors[index].footprint.d, floor.footprint.d, amount) }
    })) : amount < 0.5 ? from.floors : to.floors,
    lines: amount < 0.5 ? from.lines : to.lines
  };
}
function fractionsOf(points) {
  const distances = [0];
  for (let index = 1;index < points.length; index++) {
    const previous = points[index - 1], point = points[index];
    distances.push(distances[index - 1] + Math.hypot(point.gx - previous.gx, point.gy - previous.gy));
  }
  const length = distances.at(-1);
  return length === 0 ? points.map((_, index) => index / Math.max(1, points.length - 1)) : distances.map((distance) => distance / length);
}
function pointAt(points, fractions, fraction) {
  let index = 1;
  while (index < fractions.length - 1 && fractions[index] < fraction)
    index++;
  const start = points[index - 1], end = points[index];
  const span = fractions[index] - fractions[index - 1];
  const along = span === 0 ? 0 : (fraction - fractions[index - 1]) / span;
  return { gx: mix(start.gx, end.gx, along), gy: mix(start.gy, end.gy, along) };
}
function matchPoints(from, to) {
  const fromFractions = fractionsOf(from), toFractions = fractionsOf(to);
  const fractions = [...new Set([...fromFractions, ...toFractions])].sort((left, right) => left - right);
  return [fractions.map((fraction) => pointAt(from, fromFractions, fraction)), fractions.map((fraction) => pointAt(to, toFractions, fraction))];
}
function drawnPath(points, fraction) {
  const fractions = fractionsOf(points);
  const kept = points.filter((_, index) => index === 0 || fractions[index] < fraction);
  return [...kept, pointAt(points, fractions, fraction)];
}
function blendRoute(from, to, amount) {
  const [start, end] = matchPoints(from.points, to.points);
  return { ...to, points: start.map((point, index) => ({ gx: mix(point.gx, end[index].gx, amount), gy: mix(point.gy, end[index].gy, amount) })) };
}
function tweenSheet(from, to, amount) {
  if (amount <= 0)
    return from;
  if (amount >= 1)
    return to;
  const glide = (a, b) => ({ ...b, rect: mixRect(a.rect, b.rect, amount) });
  const frame = from.islands.length === 0 ? to.sheet : to.islands.length === 0 ? from.sheet : mixRect(from.sheet, to.sheet, amount);
  return {
    sheet: frame,
    islands: blend(from.islands, to.islands, amount, (island) => island.key, glide, sizedSurface(ISLAND_FONT)),
    zones: blend(from.zones, to.zones, amount, (zone) => zone.key, glide, sizedSurface(GROUP_FONT)),
    slabs: blend(from.slabs, to.slabs, amount, (slab) => slab.representationId, glide, sizedSurface(CONTAINER_FONT)),
    buildings: blend(from.buildings, to.buildings, amount, (building) => building.representationId, (a, b) => blendBuilding(a, b, amount), sizedBuilding),
    routes: blend(from.routes, to.routes, amount, (route) => route.id, (a, b) => blendRoute(a, b, amount), (route, size) => ({ ...route, points: drawnPath(route.points, size) }))
  };
}
function sameSheet(displayed, next) {
  return displayed === next || JSON.stringify(displayed) === JSON.stringify(next);
}

// src/viewers/web/iso/view-motion/presentation.ts
var EMPTY_SHEET = { sheet: { gx: 0, gy: 0, w: 0, d: 0 }, islands: [], zones: [], slabs: [], buildings: [], routes: [] };
function ease2(progress) {
  return 1 - (1 - Math.min(1, Math.max(0, progress))) ** 3;
}
function flattenRouteEnd(points, building, amount) {
  if (!building)
    return points;
  const [at, next] = points;
  const horizontal = at.gy === next.gy;
  const behind = horizontal ? at.gx < building.rect.gx : at.gy < building.rect.gy;
  if (!behind)
    return points;
  const shift = building.heightUnits * ROOF_SHADOW * amount;
  const end = { gx: at.gx + shift, gy: at.gy + shift };
  const along = horizontal ? "gy" : "gx";
  let join = 1;
  while (join + 2 < points.length && points[join + 1][along] > at[along] && points[join + 1][along] <= end[along])
    join += 2;
  const bend = { ...points[join], [along]: end[along] };
  return [end, bend, ...points.slice(join + 1)];
}
function flattenSheet(sheet, amount) {
  if (amount === 0)
    return sheet;
  const height = 1 - amount;
  const buildings = new Map(sheet.buildings.map((building) => [building.representationId, building]));
  return {
    ...sheet,
    routes: sheet.routes.map((route) => {
      const points = [...route.points];
      if (points.length === 2) {
        const middle = { gx: (points[0].gx + points[1].gx) / 2, gy: (points[0].gy + points[1].gy) / 2 };
        points.splice(1, 0, { ...middle }, { ...middle });
      }
      const fromSource = flattenRouteEnd(points, buildings.get(route.source), amount);
      const settled = flattenRouteEnd(fromSource.reverse(), buildings.get(route.target), amount).reverse();
      return { ...route, points: settled.filter((point, index) => index === 0 || point.gx !== settled[index - 1].gx || point.gy !== settled[index - 1].gy) };
    }),
    buildings: sheet.buildings.map((building) => ({
      ...building,
      heightUnits: building.heightUnits * height,
      floors: amount === 1 ? building.kind !== "component" ? [] : [{
        files: building.floors.flatMap((floor) => floor.files),
        facadeFileType: building.floors[0]?.facadeFileType ?? "",
        heightUnits: 0,
        footprint: { w: building.rect.w, d: building.rect.d }
      }] : building.floors.map((floor) => ({
        ...floor,
        heightUnits: floor.heightUnits * height,
        footprint: {
          w: floor.footprint.w + (building.rect.w - floor.footprint.w) * amount,
          d: floor.footprint.d + (building.rect.d - floor.footprint.d) * amount
        }
      }))
    }))
  };
}
function presentScene(sheet, profile, pose) {
  const projected = projectScene(flattenSheet(sheet, pose.flatten), profile, pose);
  projected.routes.forEach((item, index) => {
    item.route = sheet.routes[index];
  });
  if (pose.flatten === 1) {
    projected.slabs = projected.slabs.map((item) => ({ ...item, faces: item.faces.filter((face) => face.side === "top") }));
    projected.buildings = projected.buildings.map((item) => ({
      ...item,
      floors: item.floors.map((floor) => floor.filter((face) => face.side === "top"))
    }));
  }
  return sceneAtSeparation(projected, pose.separation);
}
function createMapMotion(initial = EMPTY_SHEET) {
  let view = "iso";
  let nested = "iso";
  let pose = NESTED_POSE;
  let framing = 1;
  let transition;
  let displayed = initial;
  let morph;
  function stepPose(now) {
    if (transition === undefined)
      return false;
    const progress = (now - transition.started) / transition.duration;
    pose = interpolatePose(transition.from, transition.to, progress);
    const flattening = transition.to.flatten - transition.from.flatten;
    framing = flattening === 0 ? 1 : (pose.flatten - transition.from.flatten) / flattening;
    if (progress < 1)
      return true;
    transition = undefined;
    return false;
  }
  function stepSheet(now) {
    if (morph === undefined)
      return false;
    const progress = (now - morph.started) / morph.duration;
    displayed = tweenSheet(morph.from, morph.to, ease2(progress));
    framing = ease2(progress);
    if (progress < 1)
      return true;
    displayed = morph.to;
    morph = undefined;
    return false;
  }
  function choose(next, now, animate) {
    if (next === view)
      return transition !== undefined;
    view = next;
    if (next !== "layers")
      nested = next;
    const target = next === "layers" ? EXPLODED_POSE : next === "2d" ? OVERHEAD_POSE : NESTED_POSE;
    if (!animate) {
      framing = 1;
      pose = target;
      transition = undefined;
      return false;
    }
    framing = pose.flatten !== target.flatten ? 0 : 1;
    transition = { from: pose, to: target, started: now, duration: pose.flatten !== target.flatten ? PLAN_DURATION_MS : ORBIT_DURATION_MS };
    return true;
  }
  return {
    get view() {
      return view;
    },
    get pose() {
      return pose;
    },
    get framing() {
      return framing;
    },
    get sheet() {
      return displayed;
    },
    get morphing() {
      return morph !== undefined;
    },
    choose,
    toggleLayers(now, animate) {
      return choose(view === "layers" ? nested : "layers", now, animate);
    },
    retarget(sheet, now, animate) {
      const large = sheet.buildings.length + sheet.slabs.length > MORPH_LIMIT;
      if (!animate || large || sameSheet(displayed, sheet)) {
        displayed = sheet;
        morph = undefined;
        return transition !== undefined;
      }
      const duration = morph === undefined ? MORPH_DURATION_MS : Math.max(MORPH_FASTEST_MS, Math.min(MORPH_DURATION_MS, now - morph.started));
      morph = { from: displayed, to: sheet, started: now, duration };
      framing = 0;
      return true;
    },
    step(now) {
      const posing = stepPose(now);
      return stepSheet(now) || posing;
    },
    orbit(dx, dy) {
      if (view !== "layers")
        return;
      transition = undefined;
      framing = 1;
      pose = orbitPose({ ...pose, separation: 1, flatten: 0 }, dx, dy);
    }
  };
}
function createMapAnimator(motion, repaint) {
  let frame;
  let animating = false;
  const stopAnimation = () => {
    if (!animating)
      return;
    if (frame !== undefined)
      cancelAnimationFrame(frame);
    frame = undefined;
    animating = false;
  };
  const animate = (now) => {
    frame = undefined;
    animating = motion.step(now);
    repaint(true);
    if (animating)
      frame = requestAnimationFrame(animate);
  };
  const change = (apply, paintNow = true) => {
    if (frame !== undefined)
      cancelAnimationFrame(frame);
    frame = undefined;
    animating = apply(performance.now(), !matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (paintNow)
      repaint(true);
    if (animating)
      frame = requestAnimationFrame(animate);
  };
  return {
    choose: (view) => {
      if (view !== motion.view)
        change((now, animate) => motion.choose(view, now, animate));
    },
    toggleLayers: () => change(motion.toggleLayers),
    retarget: (sheet) => change((now, animate) => motion.retarget(sheet, now, animate), false),
    orbit(dx, dy) {
      motion.orbit(dx, dy);
      if (!motion.morphing)
        stopAnimation();
      if (frame !== undefined)
        return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        repaint(false);
      });
    }
  };
}

// src/authoring-conflict.ts
function changedEdit(original, values) {
  const changed = Object.keys(values).filter((field) => values[field] !== original[field]);
  return {
    ...Object.fromEntries(changed.map((field) => [field, values[field]])),
    original: Object.fromEntries(changed.map((field) => [field, original[field] ?? ""]))
  };
}

// src/viewers/web/organisms/editable.ts
function message(cause) {
  return cause instanceof Error ? cause.message : String(cause);
}
function isEditing(host, key) {
  return host.querySelector(".edit-form")?.dataset.editKey === key;
}
function editButton(host, key, fields, save, read) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Edit";
  button.className = "edit-entry";
  button.addEventListener("click", () => {
    const form = document.createElement("form");
    form.className = "edit-form";
    form.dataset.editKey = key;
    for (const field of fields)
      form.append(editField(field));
    const error = document.createElement("p");
    error.className = "error";
    error.setAttribute("role", "status");
    const actions = document.createElement("div");
    actions.className = "actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Save";
    const close = () => {
      form.remove();
      read();
    };
    cancel.addEventListener("click", close);
    form.addEventListener("keydown", (event) => {
      if (event.key !== "Escape")
        return;
      event.preventDefault();
      event.stopPropagation();
      if (!submit.disabled)
        close();
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = new FormData(form);
      const { original, ...changes } = changedEdit(Object.fromEntries(fields.map((field) => [field.name, field.value])), Object.fromEntries(fields.map((field) => [field.name, String(values.get(field.name) ?? "")])));
      if (Object.keys(changes).length === 0) {
        close();
        return;
      }
      submit.disabled = cancel.disabled = true;
      error.textContent = "";
      try {
        await save(changes, original);
        close();
      } catch (cause) {
        error.textContent = message(cause);
      } finally {
        submit.disabled = cancel.disabled = false;
      }
    });
    actions.append(cancel, submit);
    form.append(error, actions);
    host.querySelector(".tabs").replaceChildren();
    host.querySelector(".body").replaceChildren(form);
    form.querySelector("input, textarea, select")?.focus();
  });
  return button;
}
function editField(field) {
  const label = document.createElement("label");
  label.textContent = field.label;
  const input = field.options !== undefined ? document.createElement("select") : field.multiline ? document.createElement("textarea") : document.createElement("input");
  if (input instanceof HTMLSelectElement) {
    for (const option of field.options ?? [])
      input.add(new Option(option.title, option.id));
  }
  input.name = field.name;
  input.value = field.value;
  input.required = field.required === true;
  label.append(input);
  return label;
}

// src/viewers/web/organisms/relationship-card.ts
function endpoint(end, label, onSelect, currentId) {
  const host = document.createElement("div");
  host.className = "relationship-end";
  const caption = document.createElement("div");
  caption.className = "relationship-caption";
  caption.textContent = label;
  const name = document.createElement("button");
  name.type = "button";
  name.className = "relationship-name";
  name.textContent = end.title;
  name.setAttribute("aria-label", `${label}: ${end.title}`);
  name.addEventListener("click", (event) => onSelect(end.representationId, event.shiftKey));
  if (end.representationId === currentId) {
    const badge = document.createElement("span");
    badge.className = "relationship-this";
    badge.textContent = "THIS";
    name.append(" ", badge);
  }
  const kind = document.createElement("div");
  kind.className = "relationship-kind";
  kind.textContent = kindLabel(end.kind, end.external);
  host.append(caption, name, kind);
  return host;
}
function card(source, target, descriptions, onSelect, currentId, action) {
  const host = document.createElement("div");
  host.className = "relationship-card";
  const center = document.createElement(action === undefined ? "div" : "button");
  center.className = "relationship-action";
  for (const description of descriptions) {
    const label = document.createElement("span");
    label.className = "relationship-label";
    label.textContent = description;
    center.append(label);
  }
  if (action !== undefined && center instanceof HTMLButtonElement) {
    center.type = "button";
    center.setAttribute("aria-label", action.label);
    if (action.expanded !== undefined)
      center.setAttribute("aria-expanded", String(action.expanded));
    center.addEventListener("click", action.run);
  }
  const arrow = document.createElement("span");
  arrow.className = "relationship-arrow";
  arrow.textContent = "⟶";
  arrow.setAttribute("aria-hidden", "true");
  center.append(arrow);
  host.append(endpoint(source, "Source", onSelect, currentId), center, endpoint(target, "Destination", onSelect, currentId));
  return host;
}
function relationshipCard(data, onSelect, currentId) {
  return card(data.source, data.target, [data.description], onSelect, currentId, currentId === undefined ? undefined : {
    label: `Open relationship: ${data.description}`,
    run: () => onSelect(data.id, false)
  });
}
function relationshipPairCard(pair, onSelect, currentId, expanded, onToggle) {
  if (pair.relationships.length === 1) {
    return relationshipCard({ ...pair.relationships[0], source: pair.source, target: pair.target }, onSelect, currentId);
  }
  const descriptions = pairDescriptions(pair);
  const head = card(pair.source, pair.target, descriptions, onSelect, currentId, {
    label: `Relationships: ${descriptions.join("; ")}`,
    run: onToggle,
    expanded
  });
  if (!expanded)
    return head;
  const list = document.createElement("ul");
  list.className = "relationships";
  for (const relationship of pair.relationships) {
    const item = document.createElement("li");
    item.append(relationshipCard(relationship, onSelect, currentId));
    list.append(item);
  }
  const host = document.createElement("div");
  host.append(head, list);
  return host;
}

// src/viewers/web/organisms/remove.ts
function paintRemoveControl(host, title, remove) {
  const box = document.createElement("div");
  box.className = "remove";
  const ask = document.createElement("button");
  ask.type = "button";
  ask.textContent = "Remove";
  const confirm = document.createElement("div");
  confirm.className = "confirm";
  confirm.hidden = true;
  const question = document.createElement("span");
  question.textContent = `Remove ${title}?`;
  const yes = document.createElement("button");
  yes.type = "button";
  yes.dataset.confirm = "";
  yes.textContent = "Remove";
  const keep = document.createElement("button");
  keep.type = "button";
  keep.textContent = "Keep";
  confirm.append(question, yes, keep);
  const error = document.createElement("p");
  error.className = "error";
  error.setAttribute("role", "status");
  box.append(ask, confirm, error);
  host.append(box);
  ask.addEventListener("click", () => {
    ask.hidden = true;
    confirm.hidden = false;
    yes.focus();
  });
  keep.addEventListener("click", () => {
    confirm.hidden = true;
    ask.hidden = false;
  });
  yes.addEventListener("click", async () => {
    yes.disabled = true;
    error.textContent = "";
    try {
      await remove();
    } catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : String(cause);
    } finally {
      yes.disabled = false;
    }
  });
}

// src/viewers/web/organisms/writes.ts
function paintAcceptControl(body, accept) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "accept";
  button.textContent = "Accept";
  const error = paragraph("error", "");
  error.setAttribute("role", "status");
  button.addEventListener("click", async () => {
    error.textContent = "";
    button.disabled = true;
    try {
      await accept();
    } catch (cause) {
      error.textContent = message(cause);
      button.disabled = false;
    }
  });
  const box = document.createElement("div");
  box.className = "selection-writes accept";
  box.append(button, error);
  body.append(box);
}
function paintSelectionControls(body, selection) {
  body.append(heading(`${selection.members.length} selected`));
  const box = document.createElement("div");
  box.className = "selection-writes";
  const group = document.createElement("form");
  group.className = "group-as";
  const name = document.createElement("input");
  name.name = "name";
  name.required = true;
  name.setAttribute("aria-label", "Group name");
  const groupButton = document.createElement("button");
  groupButton.type = "submit";
  groupButton.textContent = "Group as";
  group.append(name, groupButton);
  const combine = document.createElement("form");
  combine.className = "combine-into";
  const survivor = document.createElement("select");
  survivor.setAttribute("aria-label", "Survivor");
  for (const member of selection.members) {
    const option = document.createElement("option");
    option.value = member.id;
    option.textContent = member.title;
    survivor.append(option);
  }
  const combineButton = document.createElement("button");
  combineButton.type = "submit";
  combineButton.textContent = "Combine into";
  combine.append(survivor, combineButton);
  const error = paragraph("error", "");
  error.setAttribute("role", "status");
  const submit = (form, write) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.textContent = "";
      try {
        await write();
      } catch (cause) {
        error.textContent = message(cause);
      }
    });
  };
  submit(group, () => selection.onGroup(name.value));
  submit(combine, () => selection.onCombine(survivor.value));
  box.append(group, combine, error);
  body.append(box);
}

// src/viewers/web/organisms/relationship-details.ts
function paintRelationship(host, relationship, world, onSelect, writesFor) {
  if (isEditing(host, relationship.id))
    return;
  const related = world.relationships.filter((row) => row.source === relationship.source && row.target === relationship.target || row.source === relationship.target && row.target === relationship.source);
  const connections = related.flatMap((row) => row.connections ?? []);
  const byId = new Map(world.elements.map((item) => [item.representationId, item]));
  const body = host.querySelector(".body");
  body.replaceChildren();
  host.querySelector("h1").textContent = "Relationship";
  host.querySelector(".meta").textContent = "";
  host.querySelector(".tabs").replaceChildren();
  for (const row of related) {
    const count = new Set((row.connections ?? []).filter((connection) => !connection.authored).map((connection) => `${connection.source}\x00${connection.target}`)).size;
    if (count)
      body.append(paragraph("relationship-count", `${byId.get(row.source).title} → ${byId.get(row.target).title}: ${count} derived file interactions`));
  }
  body.append(relationshipCard({ ...relationship, source: byId.get(relationship.source), target: byId.get(relationship.target) }, onSelect));
  const connection = connections[0];
  if (!connection)
    return;
  const details = document.createElement("div");
  body.append(details);
  host.querySelector(".edit-entry")?.remove();
  const writes = writesFor(connection.source, connection.target);
  details.append(heading(connection.authored ? "Authored interaction" : "Derived interaction"));
  details.append(paragraph("description", connection.description), paragraph("technology", connection.technology));
  const editable = connection.authored || !connections.some((row) => row.authored && row.source === connection.source && row.target === connection.target);
  if (editable && writes.onEdit && writes.onRead)
    details.append(editButton(host, relationship.id, [
      { name: "description", label: "Description", value: connection.description, required: true },
      { name: "technology", label: "Technology", value: connection.technology, required: true }
    ], writes.onEdit, writes.onRead));
  if (!connection.authored || connection.status !== "draft")
    return;
  if (writes.onAccept)
    paintAcceptControl(details, writes.onAccept);
  if (writes.onRemove)
    paintRemoveControl(details, connection.description, writes.onRemove);
}

// node:path
function assertPath(path) {
  if (typeof path !== "string")
    throw TypeError("Path must be a string. Received " + JSON.stringify(path));
}
function normalizeStringPosix(path, allowAboveRoot) {
  var res = "", lastSegmentLength = 0, lastSlash = -1, dots = 0, code;
  for (var i = 0;i <= path.length; ++i) {
    if (i < path.length)
      code = path.charCodeAt(i);
    else if (code === 47)
      break;
    else
      code = 47;
    if (code === 47) {
      if (lastSlash === i - 1 || dots === 1)
        ;
      else if (lastSlash !== i - 1 && dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== 46 || res.charCodeAt(res.length - 2) !== 46) {
          if (res.length > 2) {
            var lastSlashIndex = res.lastIndexOf("/");
            if (lastSlashIndex !== res.length - 1) {
              if (lastSlashIndex === -1)
                res = "", lastSegmentLength = 0;
              else
                res = res.slice(0, lastSlashIndex), lastSegmentLength = res.length - 1 - res.lastIndexOf("/");
              lastSlash = i, dots = 0;
              continue;
            }
          } else if (res.length === 2 || res.length === 1) {
            res = "", lastSegmentLength = 0, lastSlash = i, dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          if (res.length > 0)
            res += "/..";
          else
            res = "..";
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0)
          res += "/" + path.slice(lastSlash + 1, i);
        else
          res = path.slice(lastSlash + 1, i);
        lastSegmentLength = i - lastSlash - 1;
      }
      lastSlash = i, dots = 0;
    } else if (code === 46 && dots !== -1)
      ++dots;
    else
      dots = -1;
  }
  return res;
}
function _format(sep, pathObject) {
  var dir = pathObject.dir || pathObject.root, base = pathObject.base || (pathObject.name || "") + (pathObject.ext || "");
  if (!dir)
    return base;
  if (dir === pathObject.root)
    return dir + base;
  return dir + sep + base;
}
function resolve() {
  var resolvedPath = "", resolvedAbsolute = false, cwd;
  for (var i = arguments.length - 1;i >= -1 && !resolvedAbsolute; i--) {
    var path;
    if (i >= 0)
      path = arguments[i];
    else {
      if (cwd === undefined)
        cwd = process.cwd();
      path = cwd;
    }
    if (assertPath(path), path.length === 0)
      continue;
    resolvedPath = path + "/" + resolvedPath, resolvedAbsolute = path.charCodeAt(0) === 47;
  }
  if (resolvedPath = normalizeStringPosix(resolvedPath, !resolvedAbsolute), resolvedAbsolute)
    if (resolvedPath.length > 0)
      return "/" + resolvedPath;
    else
      return "/";
  else if (resolvedPath.length > 0)
    return resolvedPath;
  else
    return ".";
}
function normalize(path) {
  if (assertPath(path), path.length === 0)
    return ".";
  var isAbsolute = path.charCodeAt(0) === 47, trailingSeparator = path.charCodeAt(path.length - 1) === 47;
  if (path = normalizeStringPosix(path, !isAbsolute), path.length === 0 && !isAbsolute)
    path = ".";
  if (path.length > 0 && trailingSeparator)
    path += "/";
  if (isAbsolute)
    return "/" + path;
  return path;
}
function isAbsolute(path) {
  return assertPath(path), path.length > 0 && path.charCodeAt(0) === 47;
}
function join() {
  if (arguments.length === 0)
    return ".";
  var joined;
  for (var i = 0;i < arguments.length; ++i) {
    var arg = arguments[i];
    if (assertPath(arg), arg.length > 0)
      if (joined === undefined)
        joined = arg;
      else
        joined += "/" + arg;
  }
  if (joined === undefined)
    return ".";
  return normalize(joined);
}
function relative(from, to) {
  if (assertPath(from), assertPath(to), from === to)
    return "";
  if (from = resolve(from), to = resolve(to), from === to)
    return "";
  var fromStart = 1;
  for (;fromStart < from.length; ++fromStart)
    if (from.charCodeAt(fromStart) !== 47)
      break;
  var fromEnd = from.length, fromLen = fromEnd - fromStart, toStart = 1;
  for (;toStart < to.length; ++toStart)
    if (to.charCodeAt(toStart) !== 47)
      break;
  var toEnd = to.length, toLen = toEnd - toStart, length = fromLen < toLen ? fromLen : toLen, lastCommonSep = -1, i = 0;
  for (;i <= length; ++i) {
    if (i === length) {
      if (toLen > length) {
        if (to.charCodeAt(toStart + i) === 47)
          return to.slice(toStart + i + 1);
        else if (i === 0)
          return to.slice(toStart + i);
      } else if (fromLen > length) {
        if (from.charCodeAt(fromStart + i) === 47)
          lastCommonSep = i;
        else if (i === 0)
          lastCommonSep = 0;
      }
      break;
    }
    var fromCode = from.charCodeAt(fromStart + i), toCode = to.charCodeAt(toStart + i);
    if (fromCode !== toCode)
      break;
    else if (fromCode === 47)
      lastCommonSep = i;
  }
  var out = "";
  for (i = fromStart + lastCommonSep + 1;i <= fromEnd; ++i)
    if (i === fromEnd || from.charCodeAt(i) === 47)
      if (out.length === 0)
        out += "..";
      else
        out += "/..";
  if (out.length > 0)
    return out + to.slice(toStart + lastCommonSep);
  else {
    if (toStart += lastCommonSep, to.charCodeAt(toStart) === 47)
      ++toStart;
    return to.slice(toStart);
  }
}
function _makeLong(path) {
  return path;
}
function dirname(path) {
  if (assertPath(path), path.length === 0)
    return ".";
  var code = path.charCodeAt(0), hasRoot = code === 47, end = -1, matchedSlash = true;
  for (var i = path.length - 1;i >= 1; --i)
    if (code = path.charCodeAt(i), code === 47) {
      if (!matchedSlash) {
        end = i;
        break;
      }
    } else
      matchedSlash = false;
  if (end === -1)
    return hasRoot ? "/" : ".";
  if (hasRoot && end === 1)
    return "//";
  return path.slice(0, end);
}
function basename(path, ext) {
  if (ext !== undefined && typeof ext !== "string")
    throw TypeError('"ext" argument must be a string');
  assertPath(path);
  var start = 0, end = -1, matchedSlash = true, i;
  if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
    if (ext.length === path.length && ext === path)
      return "";
    var extIdx = ext.length - 1, firstNonSlashEnd = -1;
    for (i = path.length - 1;i >= 0; --i) {
      var code = path.charCodeAt(i);
      if (code === 47) {
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else {
        if (firstNonSlashEnd === -1)
          matchedSlash = false, firstNonSlashEnd = i + 1;
        if (extIdx >= 0)
          if (code === ext.charCodeAt(extIdx)) {
            if (--extIdx === -1)
              end = i;
          } else
            extIdx = -1, end = firstNonSlashEnd;
      }
    }
    if (start === end)
      end = firstNonSlashEnd;
    else if (end === -1)
      end = path.length;
    return path.slice(start, end);
  } else {
    for (i = path.length - 1;i >= 0; --i)
      if (path.charCodeAt(i) === 47) {
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else if (end === -1)
        matchedSlash = false, end = i + 1;
    if (end === -1)
      return "";
    return path.slice(start, end);
  }
}
function extname(path) {
  assertPath(path);
  var startDot = -1, startPart = 0, end = -1, matchedSlash = true, preDotState = 0;
  for (var i = path.length - 1;i >= 0; --i) {
    var code = path.charCodeAt(i);
    if (code === 47) {
      if (!matchedSlash) {
        startPart = i + 1;
        break;
      }
      continue;
    }
    if (end === -1)
      matchedSlash = false, end = i + 1;
    if (code === 46) {
      if (startDot === -1)
        startDot = i;
      else if (preDotState !== 1)
        preDotState = 1;
    } else if (startDot !== -1)
      preDotState = -1;
  }
  if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1)
    return "";
  return path.slice(startDot, end);
}
function format(pathObject) {
  if (pathObject === null || typeof pathObject !== "object")
    throw TypeError('The "pathObject" argument must be of type Object. Received type ' + typeof pathObject);
  return _format("/", pathObject);
}
function parse(path) {
  assertPath(path);
  var ret = { root: "", dir: "", base: "", ext: "", name: "" };
  if (path.length === 0)
    return ret;
  var code = path.charCodeAt(0), isAbsolute = code === 47, start;
  if (isAbsolute)
    ret.root = "/", start = 1;
  else
    start = 0;
  var startDot = -1, startPart = 0, end = -1, matchedSlash = true, i = path.length - 1, preDotState = 0;
  for (;i >= start; --i) {
    if (code = path.charCodeAt(i), code === 47) {
      if (!matchedSlash) {
        startPart = i + 1;
        break;
      }
      continue;
    }
    if (end === -1)
      matchedSlash = false, end = i + 1;
    if (code === 46) {
      if (startDot === -1)
        startDot = i;
      else if (preDotState !== 1)
        preDotState = 1;
    } else if (startDot !== -1)
      preDotState = -1;
  }
  if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
    if (end !== -1)
      if (startPart === 0 && isAbsolute)
        ret.base = ret.name = path.slice(1, end);
      else
        ret.base = ret.name = path.slice(startPart, end);
  } else {
    if (startPart === 0 && isAbsolute)
      ret.name = path.slice(1, startDot), ret.base = path.slice(1, end);
    else
      ret.name = path.slice(startPart, startDot), ret.base = path.slice(startPart, end);
    ret.ext = path.slice(startDot, end);
  }
  if (startPart > 0)
    ret.dir = path.slice(0, startPart - 1);
  else if (isAbsolute)
    ret.dir = "/";
  return ret;
}
var sep = "/";
var delimiter = ":";
var posix = ((p) => (p.posix = p, p))({ resolve, normalize, isAbsolute, join, relative, _makeLong, dirname, basename, extname, format, parse, sep, delimiter, win32: null, posix: null });

// src/architecture-findings.ts
var {Worker} = (() => ({}));
var remembered = new Map;
function findingsForOwner(findings, ownerId) {
  return findings.filter((finding) => finding.instances.some((instance) => instance.owner === ownerId));
}
function holdsLine(instance, file, line) {
  return instance.file === file && instance.startLine <= line && line <= instance.endLine;
}
function endsInName(instance, name) {
  const bare = instance.name.replace(/\(.*\)$/, "");
  return bare.endsWith(name) && !/[\p{L}\p{N}_$]/u.test(bare.charAt(bare.length - name.length - 1));
}
function operationAt(findings, file, line, name) {
  const named = findings.flatMap((finding) => finding.instances.filter((instance) => holdsLine(instance, file, line) && endsInName(instance, name)).map((instance) => ({ finding, instance })));
  return named.length === 1 ? named[0] : undefined;
}
function copiesOfSymbol(findings, file, symbol) {
  return "kind" in symbol && symbol.kind === "type" ? undefined : copiesOf(findings, file, symbol.line, symbol.name);
}
function copiesOf(findings, file, line, name) {
  const found = operationAt(findings, file, line, name);
  if (found === undefined)
    return;
  const copies = found.finding.instances.filter((instance) => instance !== found.instance);
  return copies.length === 0 ? undefined : { similar: found.finding.match === "similar", copies };
}

// src/removable.ts
function removalBlocker(graph, id) {
  const element = graph.elements.find((candidate) => candidate.id === id);
  if (element === undefined)
    return `unknown id "${id}"`;
  if (element.origin === "observed" && element.kind !== "actor" && !element.external && element.code.length > 0) {
    return `${id} is found by the scanner; remove its code or combine it instead`;
  }
  const flows = graph.flows.filter((flow) => flow.steps.some((step) => step.source === id || step.target === id));
  if (flows.length > 0)
    return `cannot remove ${id}: used by flows ${flows.map((flow) => flow.id).join(", ")}`;
  if (element.children.length > 0) {
    return `cannot remove ${id}: it contains ${element.children.join(", ")}`;
  }
  const dependents = [...new Set(graph.relationships.filter((relationship) => relationship.target === id).map((relationship) => relationship.source))];
  if (dependents.length > 0) {
    return `cannot remove ${id}: ${dependents.join(", ")} relate to it`;
  }
  return;
}

// src/viewers/web/work/component-tasks.ts
var stageLabel = {
  todo: "To do",
  progress: "In progress",
  done: "Done"
};
function paintElementWork(body, groups, onTask) {
  for (const group of groups) {
    const heading = document.createElement("h2");
    heading.className = "section";
    heading.textContent = `${stageLabel[group.stage]} · ${group.items.length}`;
    const list = document.createElement("ul");
    list.className = "work-detail-list";
    for (const task of group.items) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "work-detail-task";
      button.setAttribute("aria-label", `Open ${task.id}: ${task.title}`);
      button.addEventListener("click", () => onTask(task.id));
      const id = document.createElement("span");
      id.className = "work-detail-id";
      id.textContent = task.id;
      const title = document.createElement("span");
      title.textContent = task.title;
      button.append(id, title);
      item.append(button);
      list.append(item);
    }
    body.append(heading, list);
  }
}

// src/viewers/web/organisms/code-lists.ts
function countFact(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}
function fileFacts(reference) {
  const facts = [];
  if (reference.lines !== undefined)
    facts.push(`${reference.lines} lines`);
  if (reference.dependencies !== undefined)
    facts.push(countFact(reference.dependencies, "dependency", "dependencies"));
  if (reference.dependents !== undefined)
    facts.push(countFact(reference.dependents, "dependent", "dependents"));
  if (reference.symbol !== undefined)
    facts.push(reference.symbol);
  facts.push(reference.scanner);
  return facts.join(" · ");
}
function groupedCode(references, structure) {
  const byFile = new Map(structure.map((file) => [file.file, file.declarations]));
  const seen = new Set;
  const groups = [];
  for (const reference of references) {
    if (seen.has(reference.file))
      continue;
    seen.add(reference.file);
    groups.push({
      file: reference.file,
      reference,
      declarations: byFile.get(reference.file) ?? []
    });
  }
  return groups;
}
function codeFacts(entry, visibility, line, kind) {
  return [entry ? "entry" : undefined, visibility, kind, `line ${line}`].filter((fact) => fact !== undefined).join(" · ");
}
var expandedCopiesKey;
function copiesKey(elementId, file, name, line) {
  return `${elementId}:${file}:${line}:${name}`;
}
function closeCopies(list) {
  for (const mark of list.querySelectorAll(".code-copies-mark"))
    mark.setAttribute("aria-expanded", "false");
  for (const panel of list.querySelectorAll(".code-copies"))
    panel.remove();
}
function warningIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2.2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const triangle = document.createElementNS("http://www.w3.org/2000/svg", "path");
  triangle.setAttribute("d", "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3");
  const stem = document.createElementNS("http://www.w3.org/2000/svg", "path");
  stem.setAttribute("d", "M12 9v4");
  const dot = document.createElementNS("http://www.w3.org/2000/svg", "path");
  dot.setAttribute("d", "M12 17h.01");
  svg.append(triangle, stem, dot);
  return svg;
}
function copiesPanel(copies, following, callable, context) {
  const list = document.createElement("ul");
  list.className = "code-copies";
  copies.copies.forEach((copy, index) => {
    list.append(copyItem(copy, [...following, index < copies.copies.length - 1], callable, context));
  });
  if (copies.similar) {
    const note = document.createElement("li");
    note.className = "ghost";
    note.textContent = "not identical";
    list.append(note);
  }
  return list;
}
function copyItem(copy, following, callable, context) {
  return codeEntry(copy.file, copy.name, copy.startLine, `${copy.file}:${copy.startLine}`, callable, following, undefined, context);
}
function copiesMark(key, copies, host, following, callable, context) {
  const mark = document.createElement("button");
  mark.type = "button";
  mark.className = "code-copies-mark";
  mark.append(warningIcon(), "possible duplicates");
  mark.setAttribute("aria-expanded", "false");
  mark.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = expandedCopiesKey !== key;
    expandedCopiesKey = open ? key : undefined;
    closeCopies(context.list);
    if (!open)
      return;
    host.append(copiesPanel(copies, following, callable, context));
    mark.setAttribute("aria-expanded", "true");
  });
  return mark;
}
function codeEntry(file, name, line, facts, callable, following, copies, context) {
  const host = document.createElement("li");
  const row = document.createElement("div");
  row.className = "code-entry";
  const tree = document.createElement("div");
  tree.className = "code-tree";
  tree.setAttribute("aria-hidden", "true");
  tree.append(...sidebarBranches(following));
  const main = document.createElement("div");
  main.className = "code-entry-main";
  const named = document.createElement("div");
  named.className = "code-entry-name";
  const link = document.createElement("button");
  link.type = "button";
  link.className = "link code-declaration";
  link.textContent = callable ? `${name}()` : name;
  link.setAttribute("aria-label", `Open ${name} in ${file} at line ${line}`);
  link.addEventListener("click", () => context.onSource(file, line));
  named.append(link);
  const key = copiesKey(context.elementId, file, name, line);
  if (copies !== undefined)
    named.append(copiesMark(key, copies, host, following, callable, context));
  const meta = document.createElement("span");
  meta.className = "ghost";
  meta.textContent = facts;
  main.append(named, meta);
  row.append(tree, main);
  host.append(row);
  if (copies !== undefined && expandedCopiesKey === key) {
    host.append(copiesPanel(copies, following, callable, context));
    host.querySelector(".code-copies-mark")?.setAttribute("aria-expanded", "true");
  }
  return host;
}
function memberItem(file, member, following, context) {
  const copies = copiesOfSymbol(context.findings, file, member);
  return codeEntry(file, member.name, member.line, codeFacts(member.entry, member.visibility, member.line), true, following, copies, context);
}
function declarationItem(file, declaration, follows, context) {
  const copies = copiesOfSymbol(context.findings, file, declaration);
  const host = codeEntry(file, declaration.name, declaration.line, codeFacts(declaration.entry, declaration.visibility, declaration.line, declaration.kind === "function" ? undefined : declaration.kind), declaration.kind === "function", [follows], copies, context);
  if (declaration.kind === "type" && declaration.members.length > 0) {
    const members = document.createElement("ul");
    members.className = "code-members";
    declaration.members.forEach((member, index) => {
      members.append(memberItem(file, member, [follows, index < declaration.members.length - 1], context));
    });
    host.append(members);
  }
  return host;
}
function fileRow(group, onSource) {
  const file = document.createElement("button");
  file.type = "button";
  file.className = "link source-file";
  file.textContent = group.file;
  file.setAttribute("aria-label", `Open source ${group.file}`);
  file.title = fileFacts(group.reference);
  file.addEventListener("click", () => onSource(group.file));
  return file;
}
function codeList(references, structure, findings, elementId, onSource) {
  const list = document.createElement("ul");
  list.className = "file-groups";
  const context = { findings, elementId, list, onSource };
  for (const group of groupedCode(references, structure)) {
    const item = document.createElement("li");
    item.className = "code-file";
    item.append(fileRow(group, onSource));
    if (group.declarations.length > 0) {
      const methods = document.createElement("ul");
      methods.className = "code-methods";
      group.declarations.forEach((declaration, index) => {
        methods.append(declarationItem(group.file, declaration, index < group.declarations.length - 1, context));
      });
      item.append(methods);
    }
    list.append(item);
  }
  return list;
}

// src/viewers/web/organisms/details.ts
function detailsTabAfterSelection(tab, previousId, nextId, defaultTab = "what") {
  return previousId === nextId ? tab : defaultTab;
}
function detailsTabAfterWork(tab, hasTasks) {
  return tab === "tasks" && !hasTasks ? "what" : tab;
}
function tabSections(tab) {
  return tab === "what" ? ["overview", "relationships", "flows", "children"] : ["technology", "code"];
}
function detailsTabs(inspected, workGroups, comparison) {
  const hasBuild = inspected.technology.length > 0 || inspected.files.length > 0 || (comparison?.files.length ?? 0) > 0 || Boolean(comparison?.before?.technology);
  return [
    "what",
    ...hasBuild ? ["how"] : [],
    ...workGroups.some((group) => group.items.length > 0) ? ["tasks"] : []
  ];
}
function isMatchedGhost(element) {
  return element.origin === "draft" && element.code.length > 0;
}
function inspectDetails(element, world) {
  const byId = new Map(world.elements.map((item) => [item.representationId, item]));
  const pairs = relationshipPairs(world.relationships, element.representationId, parentOfElements(world.elements));
  const relationships = pairs.map((pair) => {
    const peer = byId.get(pair.peerId);
    return {
      source: pair.outgoing ? element : peer,
      target: pair.outgoing ? peer : element,
      relationships: pair.relationships.map((relationship) => ({
        id: relationship.id,
        description: relationship.description,
        source: byId.get(relationship.source),
        target: byId.get(relationship.target)
      }))
    };
  });
  const children = [];
  for (const childId of element.children) {
    const child = byId.get(childId);
    children.push({
      id: childId,
      title: child?.title ?? childId,
      kind: child?.kind ?? "component",
      external: child?.external ?? false
    });
  }
  return {
    id: element.id,
    title: element.title,
    description: element.description ?? "",
    kindLabel: kindLabel(element.kind, element.external),
    origin: element.origin,
    overview: element.overview,
    relationships,
    flows: flowsThrough(element.representationId, world).map((flow) => ({
      flow: { id: flow.id },
      title: flow.title
    })),
    children,
    technology: element.technology ?? "",
    files: element.code,
    findings: findingsForOwner(world.findings ?? [], element.id),
    removable: removalBlocker(world, element.id) === undefined,
    matchedGhost: isMatchedGhost(element),
    movable: element.movable === true,
    parent: element.parent
  };
}
function inspectSelection(id, world, zones) {
  const element = world.elements.find((item) => item.representationId === id);
  if (element !== undefined)
    return inspectDetails(element, world);
  const group = zones.find((zone) => zone.unidentifiedContainer && zone.key === id);
  return group === undefined ? undefined : inspectUnidentifiedContainer(group, world);
}
function inspectUnidentifiedContainer(zone, world) {
  const members = new Set(zone.members);
  return {
    id: zone.key,
    title: zone.name,
    description: "",
    kindLabel: "Placement group",
    origin: "observed",
    overview: "Groma.md could not determine which container these components belong to. This group keeps them visible within their system; it does not represent an application or data store.",
    children: world.elements.filter((element) => members.has(element.representationId)).map((element) => ({
      id: element.representationId,
      title: element.title,
      kind: element.kind,
      external: element.external
    })),
    relationships: [],
    flows: [],
    technology: "",
    files: [],
    findings: [],
    removable: false,
    matchedGhost: false,
    movable: false,
    parent: zone.parent
  };
}
function marked(kind, external, text) {
  const row = document.createElement("span");
  if (kind !== null) {
    const mark = document.createElement("span");
    mark.className = "mark";
    mark.textContent = kindGlyph(kind);
    if (external)
      mark.classList.add("ghost");
    row.append(mark, " ");
  }
  row.append(text);
  return row;
}
var paintDetailFlows = createFlowList();
function paintTabs(tabsHost, availableTabs, shownTab, onTab) {
  tabsHost.replaceChildren();
  tabsHost.hidden = availableTabs.length === 1;
  tabsHost.setAttribute("aria-label", "Details view");
  const labels = { what: "What it does", how: "How it's built", tasks: "Tasks" };
  for (const key of availableTabs) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "tab");
    button.textContent = labels[key];
    button.setAttribute("aria-selected", String(key === shownTab));
    if (key === shownTab)
      button.classList.add("active");
    button.addEventListener("click", () => onTab(key));
    tabsHost.append(button);
  }
}
var openPair;
function paintRelationshipPairs(list, inspected, onSelect, comparison) {
  list.replaceChildren();
  for (const pair of inspected.relationships) {
    if (comparison !== undefined) {
      paintComparedRelationships(list, pair, inspected.id, onSelect, comparison);
      continue;
    }
    const key = [inspected.id, pair.source.representationId, pair.target.representationId].join("\x00");
    const item = document.createElement("li");
    item.append(relationshipPairCard(pair, onSelect, inspected.id, key === openPair, () => {
      openPair = key === openPair ? undefined : key;
      paintRelationshipPairs(list, inspected, onSelect);
    }));
    list.append(item);
  }
}
function paintComparedRelationships(list, pair, id, onSelect, comparison) {
  for (const relationship of pair.relationships) {
    const row = document.createElement("li");
    const card = relationshipCard(relationship, onSelect, id);
    const status = comparison.relationships[relationship.id];
    if (status !== undefined && status !== "unchanged")
      card.querySelector(".relationship-action").append(changeBadge(status));
    row.append(card);
    list.append(row);
  }
}
function paintDetails(host, inspected, options) {
  const { onSelect, onToggleFlow, activeFlows, tab, onTab, code, onSource, workGroups, onTask, onEdit, selection } = options;
  if (onEdit !== undefined && isEditing(host, inspected.id))
    return;
  const title = host.querySelector("h1");
  const meta = host.querySelector(".meta");
  const tabsHost = host.querySelector(".tabs");
  const body = host.querySelector(".body");
  title.replaceChildren();
  title.textContent = inspected.title;
  meta.textContent = `${inspected.kindLabel} · ${inspected.origin}`;
  const change = options.comparison?.components[inspected.id];
  if (change !== undefined) {
    meta.append(changeBadge(change.status));
    const reasons = comparisonReasons(change, options.comparison, options.world, onTab);
    if (reasons !== undefined)
      title.after(reasons);
  }
  const availableTabs = detailsTabs(inspected, workGroups, change);
  const shownTab = availableTabs.includes(tab) ? tab : "what";
  paintTabs(tabsHost, availableTabs, shownTab, onTab);
  body.replaceChildren();
  const sections = {
    overview: () => {
      if (change !== undefined) {
        comparisonOverview(body, change, options.world);
        return;
      }
      if (inspected.description !== "")
        body.append(paragraph("description", inspected.description));
      if (inspected.overview !== "")
        body.append(paragraph("overview", inspected.overview));
    },
    relationships: () => {
      if (inspected.relationships.length === 0)
        return;
      const list = document.createElement("ul");
      list.className = "relationships";
      body.append(heading("Relationships"), list);
      paintRelationshipPairs(list, inspected, onSelect, options.comparison);
    },
    flows: () => {
      if (inspected.flows.length === 0)
        return;
      const list = document.createElement("div");
      paintDetailFlows(list, options.world, activeFlows, onToggleFlow, {
        title: inspected.kindLabel === "Actor" ? "Flows from this actor" : `Flows through this ${inspected.kindLabel.toLowerCase()}`,
        visibleFlows: inspected.flows,
        contextId: inspected.id
      });
      body.append(list);
    },
    children: () => {
      if (inspected.children.length === 0)
        return;
      body.append(heading("Children"));
      const list = document.createElement("ul");
      for (const child of inspected.children) {
        const item = document.createElement("li");
        const link = document.createElement("button");
        link.type = "button";
        link.className = "link";
        link.append(marked(child.kind, child.external, child.title));
        link.addEventListener("click", (event) => onSelect(child.id, event.shiftKey));
        item.append(link);
        list.append(item);
      }
      body.append(list);
    },
    technology: () => {
      if (change !== undefined) {
        comparisonTechnology(body, change);
        return;
      }
      if (inspected.technology.length === 0)
        return;
      body.append(heading("Technology"));
      const list = document.createElement("ul");
      list.className = "chips";
      for (const part of inspected.technology.split(",").map((part) => part.trim()).filter(Boolean)) {
        const chip = document.createElement("li");
        chip.className = "chip";
        chip.textContent = part;
        list.append(chip);
      }
      body.append(list);
    },
    code: () => {
      if (change !== undefined) {
        comparisonFiles(body, change, onSource);
        return;
      }
      if (inspected.files.length === 0 && code.length === 0)
        return;
      body.append(heading("Code"), codeList(inspected.files, code, inspected.findings, inspected.id, onSource));
    }
  };
  if (shownTab === "what" && selection !== undefined)
    paintSelectionControls(body, selection);
  if (shownTab === "tasks")
    paintElementWork(body, workGroups, onTask);
  else
    for (const key of tabSections(shownTab))
      sections[key]();
  paintEditingControls(host, body, inspected, options, shownTab);
}
function paintEditingControls(host, body, inspected, options, tab) {
  const { onAccept, onEdit, onRead, onRemove } = options;
  if (tab === "what" && inspected.matchedGhost && onAccept !== undefined)
    paintAcceptControl(body, onAccept);
  if (onEdit !== undefined && onRead !== undefined)
    body.prepend(editButton(host, inspected.id, elementFields(inspected, options), onEdit, onRead));
  if (tab === "what" && inspected.removable && onRemove !== undefined)
    paintRemoveControl(body, inspected.title, onRemove);
}
function elementFields(inspected, options) {
  const fields = [
    { name: "title", label: "Title", value: inspected.title, required: true },
    { name: "description", label: "Description", value: inspected.description },
    { name: "overview", label: "Overview", value: inspected.overview, multiline: true },
    { name: "technology", label: "Technology", value: inspected.technology }
  ];
  if (inspected.movable)
    fields.push({
      name: "parent",
      label: "Parent",
      value: inspected.parent ?? "",
      options: options.parents ?? []
    });
  return fields;
}

// src/viewers/web/organisms/hierarchy.ts
var unfolded = true;
function hasLaterSibling(rows, index, depth) {
  for (const row of rows.slice(index + 1)) {
    if (row.depth < depth)
      return false;
    if (row.depth === depth)
      return true;
  }
  return false;
}
function hierarchyRow(row, selectedIds, onSelect, onToggle, followingSiblings, comparison, counts, former = false) {
  const button = sidebarRow(row.title, row.kind, row.hasChildren ? { expanded: row.expanded, count: row.count, toggle: () => onToggle(row) } : undefined);
  button.dataset.id = row.id;
  if (selectedIds.has(row.id))
    button.classList.add("selected");
  if (row.origin !== "observed")
    button.classList.add("ghost");
  const change = Object.values(comparison?.components ?? {}).find((item) => (item.after ?? item.before)?.representationId === row.id);
  if (change?.status === "removed" || former)
    button.classList.add("former");
  if (counts !== undefined) {
    button.querySelector(".name").textContent = row.title;
    for (const status of changeStatuses)
      if (counts[status] > 0)
        button.append(statusMark2(status, counts[status]));
  } else if (isChange(change?.status)) {
    const files = change.files.filter((file) => file.status !== "unchanged");
    if (files.length > 0) {
      const totals = files.reduce((sum, file) => ({ added: sum.added + file.additions, removed: sum.removed + file.deletions }), { added: 0, removed: 0 });
      const lines = document.createElement("span");
      lines.className = "change-lines";
      lines.textContent = `+${totals.added} −${totals.removed}`;
      button.append(lines);
    }
    button.append(statusMark2(change.status));
  }
  button.prepend(...sidebarBranches(followingSiblings));
  button.addEventListener("click", (event) => onSelect(row.id, event.shiftKey));
  return button;
}
function statusMark2(status, count) {
  const mark = document.createElement("span");
  mark.className = "change-mark";
  mark.dataset.change = status;
  mark.textContent = `${changeMarks[status]}${count ?? ""}`;
  mark.title = `${changeLabels[status]}${count === undefined ? "" : `: ${count}`}`;
  mark.setAttribute("aria-label", mark.title);
  return mark;
}
function replaceComparisonTree(host, heading, list, comparing) {
  host.querySelectorAll(".comparison-exiting").forEach((row) => {
    row.remove();
  });
  const oldRows = [...host.querySelectorAll(".row[data-id]")].map((row) => ({ row, id: row.dataset.id, height: row.getBoundingClientRect().height }));
  const nextRows = new Map([...list.querySelectorAll(".row[data-id]")].map((row) => [row.dataset.id, row]));
  replaceTreeChildren(host, heading, list);
  if (!comparing || oldRows.length === 0)
    return;
  const oldIds = new Set(oldRows.map((item) => item.id));
  for (const [index, item] of oldRows.entries()) {
    if (nextRows.has(item.id))
      continue;
    item.row.classList.add("comparison-exiting");
    item.row.inert = true;
    item.row.setAttribute("aria-hidden", "true");
    delete item.row.dataset.id;
    const following = oldRows.slice(index + 1).find((row) => nextRows.has(row.id));
    list.insertBefore(item.row, following === undefined ? null : nextRows.get(following.id));
    animateRow(item.row, false, item.height);
  }
  for (const [id, row] of nextRows)
    if (!oldIds.has(id))
      animateRow(row, true, row.getBoundingClientRect().height);
}
function paintHierarchy(host, rows, selectedIds, onSelect, onToggle, comparison, changes) {
  const list = document.createElement("div");
  let shownExternals = false;
  for (const [index, row] of rows.entries()) {
    if (row.depth === 0 && row.external && !shownExternals) {
      const label = document.createElement("div");
      label.className = "group external";
      label.textContent = "External systems";
      list.append(label);
      shownExternals = true;
    }
    const siblings = Array.from({ length: row.depth }, (_, depth) => hasLaterSibling(rows, index, depth + 1));
    const button = hierarchyRow(row, selectedIds, onSelect, onToggle, siblings, comparison, changes?.counts.get(row.id), changes?.former.has(row.id));
    list.append(button);
  }
  for (const relationship of changes?.relationships ?? []) {
    const source = changes?.elements.find((element) => element.representationId === relationship.source);
    const target = changes?.elements.find((element) => element.representationId === relationship.target);
    const button = chromeButton(`${source?.title ?? relationship.source} → ${target?.title ?? relationship.target}`);
    button.className = "row comparison-relationship";
    button.dataset.id = relationship.id;
    button.classList.toggle("selected", selectedIds.has(relationship.id));
    const status = comparison?.relationships[relationship.id];
    if (isChange(status))
      button.append(statusMark2(status));
    button.onclick = (event) => onSelect(relationship.id, event.shiftKey);
    list.append(button);
  }
  if (rows.length === 0 && changes?.relationships.length === 0) {
    const empty = document.createElement("p");
    empty.className = "comparison-empty";
    empty.textContent = "No changes";
    list.append(empty);
  }
  const heading = sectionHeading("Structure", unfolded, () => {
    unfolded = !unfolded;
    paintHierarchy(host, rows, selectedIds, onSelect, onToggle, comparison, changes);
  });
  list.hidden = !unfolded;
  replaceComparisonTree(host, heading, list, comparison !== undefined);
}
function createHierarchy(host, onSelect) {
  let tree = initialTree();
  let changesOnly = true;
  let lastSelection = "";
  const modes = document.createElement("div");
  modes.className = "comparison-modes controls";
  modes.setAttribute("aria-label", "Hierarchy view");
  const buttons = [chromeButton("Changes"), chromeButton("All")];
  modes.append(...buttons);
  document.getElementById("hierarchy-title").insertBefore(modes, document.getElementById("hierarchy-toggle"));
  const paint = (world, selectedIds, comparison, enabled) => {
    modes.hidden = comparison === undefined;
    document.getElementById("flows").hidden = comparison !== undefined && changesOnly;
    const changes = comparison === undefined ? undefined : comparisonTree(world, comparison, enabled);
    buttons.forEach((button, index) => {
      button.setAttribute("aria-pressed", String(changesOnly === (index === 0)));
      button.onclick = () => {
        changesOnly = index === 0;
        paint(world, selectedIds, comparison, enabled);
      };
    });
    const rows = changes !== undefined && changesOnly ? semanticTreeRows(changes.world, selectedIds, { expanded: new Set(changes.world.elements.map((element) => element.representationId)), collapsed: tree.collapsed }) : semanticTreeRows(world, selectedIds, tree).filter((row) => row.kind !== "actor");
    paintHierarchy(host, rows, new Set(selectedIds), onSelect, (row) => {
      tree = toggleExpansion(tree, row);
      paint(world, selectedIds, comparison, enabled);
    }, comparison, changesOnly ? changes : changes === undefined ? undefined : { ...changes, relationships: [] });
    const selected = selectedIds.at(-1) ?? "";
    if (selected !== lastSelection) {
      host.querySelector(".row.selected[data-id]")?.scrollIntoView({ block: "nearest" });
      lastSelection = selected;
    }
  };
  return {
    paint,
    reset() {
      tree = initialTree();
      changesOnly = true;
      lastSelection = "";
    }
  };
}

// src/viewers/web/atoms/marks.ts
var MARKS = {
  antigravity: '<svg viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg"><path fill="var(--ink)" d="M144.248 149.062C151.748 154.688 162.998 150.938 152.685 140.625C121.748 110.625 128.31 28.125 89.8727 28.125C51.4352 28.125 57.9977 110.625 27.0602 140.625C15.8102 151.875 27.9977 154.688 35.4977 149.062C64.5602 129.375 62.6852 94.6875 89.8727 94.6875C117.06 94.6875 115.185 129.375 144.248 149.062Z"/></svg>',
  claude: '<svg viewBox="0 0 256 257" xmlns="http://www.w3.org/2000/svg"><path fill="#D97757" d="M50.2278481,170.321013 L100.585316,142.063797 L101.427848,139.601013 L100.585316,138.24 L98.1225316,138.24 L89.6972152,137.721519 L60.921519,136.943797 L35.9696203,135.906835 L11.795443,134.610633 L5.70329114,133.31443 L0,125.796456 L0.583291139,122.037468 L5.70329114,118.602532 L13.0268354,119.250633 L29.2293671,120.352405 L53.5331646,122.037468 L71.161519,123.07443 L97.28,125.796456 L101.427848,125.796456 L102.011139,124.111392 L100.585316,123.07443 L99.4835443,122.037468 L74.3372152,104.992405 L47.116962,86.9751899 L32.8587342,76.6055696 L25.1463291,71.3559494 L21.2577215,66.4303797 L19.5726582,55.6718987 L26.5721519,47.9594937 L35.9696203,48.6075949 L38.3675949,49.2556962 L47.8946835,56.5792405 L68.2450633,72.3281013 L94.8172152,91.9007595 L98.7058228,95.1412658 L100.261266,94.0394937 L100.455696,93.2617722 L98.7058228,90.3453165 L84.2531646,64.2268354 L68.8283544,37.6546835 L61.958481,26.636962 L60.1437975,20.0263291 C59.4956962,17.3043038 59.0420253,15.0359494 59.0420253,12.2491139 L67.0136709,1.42582278 L71.4207595,-1.42108547e-14 L82.0496203,1.42582278 L86.521519,5.31443038 L93.1321519,20.4151899 L103.825823,44.2005063 L120.417215,76.5407595 L125.277975,86.1326582 L127.87038,95.0116456 L128.842532,97.7336709 L130.527595,97.7336709 L130.527595,96.1782278 L131.888608,77.9665823 L134.416203,55.6070886 L136.878987,26.8313924 L137.721519,18.7301266 L141.739747,9.00860759 L149.711392,3.75898734 L155.933165,6.74025316 L161.053165,14.0637975 L160.340253,18.7949367 L157.294177,38.5620253 L151.331646,69.5412658 L147.443038,90.2805063 L149.711392,90.2805063 L152.303797,87.6881013 L162.803038,73.7539241 L180.431392,51.718481 L188.208608,42.9691139 L197.282025,33.3124051 L203.114937,28.7108861 L214.132658,28.7108861 L222.233924,40.7655696 L218.604557,53.2091139 L207.262785,67.596962 L197.865316,79.7812658 L184.38481,97.9281013 L175.959494,112.44557 L176.737215,113.612152 L178.746329,113.417722 L209.207089,106.936709 L225.668861,103.955443 L245.306329,100.585316 L254.185316,104.733165 L255.157468,108.945823 L251.657722,117.56557 L230.659241,122.75038 L206.031392,127.675949 L169.348861,136.360506 L168.89519,136.684557 L169.413671,137.332658 L185.940253,138.888101 L193.004557,139.276962 L210.308861,139.276962 L242.519494,141.674937 L250.94481,147.248608 L256,154.053671 L255.157468,159.238481 L242.195443,165.849114 L224.696709,161.701266 L183.866329,151.979747 L169.867342,148.48 L167.923038,148.48 L167.923038,149.646582 L179.588861,161.053165 L200.976203,180.366582 L227.742785,205.253671 L229.103797,211.410633 L225.668861,216.271392 L222.039494,215.752911 L198.513418,198.059747 L189.44,190.088101 L168.89519,172.783797 L167.534177,172.783797 L167.534177,174.598481 L172.265316,181.533165 L197.282025,219.123038 L198.578228,230.659241 L196.763544,234.418228 L190.282532,236.686582 L183.153418,235.39038 L168.506329,214.84557 L153.40557,191.708354 L141.221266,170.969114 L139.730633,171.811646 L132.536709,249.259747 L129.166582,253.213165 L121.389367,256.19443 L114.908354,251.268861 L111.473418,243.297215 L114.908354,227.548354 L119.056203,207.003544 L122.426329,190.671392 L125.472405,170.385823 L127.287089,163.64557 L127.157468,163.191899 L125.666835,163.386329 L110.371646,184.38481 L87.1048101,215.817722 L68.6987342,235.52 L64.2916456,237.269873 L56.6440506,233.316456 L57.356962,226.252152 L61.6344304,219.96557 L87.1048101,187.560506 L102.46481,167.469367 L112.380759,155.868354 L112.315949,154.183291 L111.732658,154.183291 L44.0708861,198.124557 L32.0162025,199.68 L26.8313924,194.819241 L27.4794937,186.847595 L29.9422785,184.25519 L50.2926582,170.256203 L50.2278481,170.321013 Z"/></svg>',
  codex: '<svg viewBox="0 0 16.7 16.71" xmlns="http://www.w3.org/2000/svg"><path fill="var(--ink)" d="M5.05,5.67c.16-.1.33-.12.51-.08.18.05.32.15.41.31l1.27,2.11c.14.23.14.46,0,.69l-1.27,2.11c-.1.15-.24.24-.41.28s-.34.01-.49-.08c-.15-.09-.25-.22-.3-.4-.05-.17-.03-.34.05-.5l1.06-1.76-1.06-1.76c-.1-.16-.12-.33-.08-.51.05-.18.15-.32.31-.41M11.73,9.79c.19,0,.34.07.48.2.13.13.2.29.2.48s-.07.34-.2.48c-.13.13-.29.2-.48.2h-2.53c-.19,0-.34-.07-.48-.2-.13-.13-.2-.29-.2-.48s.07-.34.2-.48c.13-.13.29-.2.48-.2h2.53Z"/><path fill="var(--ink)" fill-rule="evenodd" d="M7.34,1.34c-.36,0-.7.06-1.04.17s-.65.28-.93.5c-.28.22-.52.47-.72.77s-.34.62-.44.96c-.07.25-.23.41-.48.48-.27.07-.53.18-.78.32-.25.14-.47.31-.67.51-.2.2-.37.42-.51.67s-.25.51-.32.78-.11.55-.11.84.04.56.11.84c.07.27.18.53.32.78.14.25.31.47.51.67.18.18.24.4.17.65-.07.27-.11.55-.11.84,0,.25.03.49.08.73.06.24.14.47.25.7.11.22.24.43.4.62s.33.36.53.51.41.28.63.38c.23.1.46.18.7.23.24.05.49.07.74.06.25,0,.49-.04.73-.11l.09-.02c.22-.03.4.04.56.19.2.2.42.37.67.51s.51.25.78.32.55.11.84.11.56-.04.84-.11.53-.18.78-.32c.25-.14.47-.31.67-.51s.37-.42.51-.67.25-.51.32-.78l.03-.08c.08-.2.23-.33.45-.39.34-.09.66-.24.96-.44s.55-.44.77-.72c.22-.28.38-.59.5-.93s.17-.68.17-1.04c0-.89-.36-1.7-.95-2.29-.18-.18-.24-.4-.17-.65.07-.27.11-.55.11-.84,0-.25-.03-.49-.08-.73-.06-.24-.14-.47-.25-.7-.11-.22-.24-.43-.4-.62-.16-.19-.33-.36-.53-.51-.2-.15-.41-.28-.63-.38-.23-.1-.46-.18-.7-.23s-.49-.07-.74-.06c-.25,0-.49.04-.73.11-.25.07-.47,0-.65-.17-.59-.59-1.29-.9-2.12-.94h-.17,0ZM7.34,0C8.47,0,9.5.41,10.3,1.09c.26-.05.54-.07.82-.07.33,0,.67.04.99.11.33.07.64.18.95.32.3.14.59.32.85.52.27.2.51.44.72.69.21.26.4.53.55.83.15.3.27.61.36.93.09.32.14.65.15.99.01.33,0,.67-.07,1,.24.28.44.59.61.92.16.33.29.68.37,1.04s.12.73.11,1.1c0,.37-.06.73-.15,1.09-.1.36-.23.7-.41,1.02s-.39.62-.64.89-.53.51-.84.72c-.31.2-.64.37-.98.49-.16.44-.38.85-.67,1.23-.29.38-.62.7-1.01.97-.39.27-.8.48-1.25.62s-.91.21-1.38.21c-1.12,0-2.11-.36-2.96-1.09-.26.05-.54.07-.82.07-.34,0-.67-.04-.99-.11-.33-.07-.64-.18-.95-.32-.3-.14-.59-.32-.85-.52s-.51-.44-.72-.69c-.21-.26-.4-.53-.55-.83s-.27-.61-.36-.93c-.09-.32-.14-.65-.15-.99s0-.67.07-1c-.68-.78-1.04-1.69-1.1-2.72v-.24c0-.47.06-.93.21-1.38.14-.45.35-.87.62-1.25.27-.39.59-.72.97-1.01.37-.29.78-.51,1.23-.67.16-.44.38-.85.67-1.23s.62-.7,1.01-.97.8-.48,1.25-.62C6.41.07,6.87,0,7.34,0"/></svg>'
};

// src/viewers/web/work/backlog-mark.ts
var BACKLOG_MARK = '<span class="backlog-mark" aria-hidden="true"></span>';

// src/viewers/web/work/badge.ts
var RING_RADIUS = 18;
var RING_LENGTH = 2 * Math.PI * RING_RADIUS;
var WORK_BADGE_FLIP_MS = 500;
var WORK_BADGE_HOLD_MS = 2500;
var WORK_BADGE_FADE_MS = 300;
var WORK_BADGE_FINISH_MS = WORK_BADGE_FLIP_MS + WORK_BADGE_HOLD_MS + WORK_BADGE_FADE_MS;
var workBadgeCss = `
  .badge { position: relative; width: 40px; height: 40px; perspective: 200px; }
  .badge .ring { position: absolute; inset: 0; transform: rotate(-90deg); }
  .badge .ring circle { fill: none; stroke-width: 3; }
  .badge .ring .track { stroke: var(--hairline); }
  .badge .ring .done { stroke: var(--pin); transition: stroke-dasharray 0.4s; }
  .badge .card { position: absolute; inset: 5px; transform-style: preserve-3d; transition: transform 0.5s; }
  .badge .face {
    position: absolute; inset: 0; border-radius: 50%; display: grid; place-items: center;
    backface-visibility: hidden; font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
  }
  .badge .face svg { width: 18px; height: 18px; }
  .badge .face.front { background: color-mix(in srgb, var(--paper) 78%, transparent); color: var(--ink); border: 1px solid var(--pin); }
  .badge .face.back { background: color-mix(in srgb, var(--accent) 85%, transparent); color: var(--on-colour); transform: rotateY(180deg); font-size: 14px; }
  .work-done .badge .card { transform: rotateY(180deg); }
  .work-finishing .badge .card { animation: work-badge-finish ${WORK_BADGE_FLIP_MS}ms ease var(--work-finish-delay, 0ms) both; }
  .work-disappearing { animation: work-badge-disappear ${WORK_BADGE_FINISH_MS}ms linear var(--work-finish-delay, 0ms) both; }
  @keyframes work-badge-disappear {
    0%, ${(WORK_BADGE_FLIP_MS + WORK_BADGE_HOLD_MS) / WORK_BADGE_FINISH_MS * 100}% { opacity: 1; }
    100% { opacity: 0; }
  }
  @keyframes work-badge-finish {
    from { transform: rotateY(0); }
    to { transform: rotateY(180deg); }
  }
`;
var WORK_BADGE = `<div class="badge"><svg class="ring" viewBox="0 0 40 40"><circle class="track" cx="20" cy="20" r="${RING_RADIUS}"/><circle class="done" cx="20" cy="20" r="${RING_RADIUS}"/></svg>` + '<div class="card"><div class="face front"></div><div class="face back">✓</div></div></div>';
function finishingWorkKeys(previous, next) {
  const wasDone = new Map(previous.map((pin) => [pin.key, pin.terminal]));
  return new Set(next.filter((pin) => pin.terminal && wasDone.get(pin.key) === false).map((pin) => pin.key));
}
function fillWorkBadge(host, pin, finishingAt) {
  const finishing = finishingAt !== undefined;
  if (finishing && !host.classList.contains("work-finishing")) {
    host.style.setProperty("--work-finish-delay", `${finishingAt - Date.now()}ms`);
  }
  host.classList.toggle("work-done", pin.terminal);
  host.classList.toggle("work-finishing", finishing);
  host.querySelector(".face.front").innerHTML = pin.assignee === null ? BACKLOG_MARK : MARKS[pin.assignee.replace(/^@/, "")] ?? monogram(pin.assignee);
  host.querySelector(".ring .done").style.strokeDasharray = `${(pin.total === 0 ? 0 : pin.done / pin.total) * RING_LENGTH} ${RING_LENGTH}`;
}

// src/viewers/web/work/pins.ts
var FAN_PITCH = 46;
var STEM = 22;
var TRAVEL_MS = 850;
function positionOf(pin, now, reducedMotion) {
  const travel = pin.travel;
  if (travel === undefined)
    return pin.anchor;
  const progress = Math.min(1, (now - travel.started) / TRAVEL_MS);
  if (progress === 1 || reducedMotion || pin.node.hidden) {
    pin.travel = undefined;
    return pin.anchor;
  }
  const eased = progress * progress * (3 - 2 * progress);
  return {
    x: pin.anchor.x + travel.offset.x * (1 - eased),
    y: pin.anchor.y + travel.offset.y * (1 - eased) - Math.sin(Math.PI * eased) * travel.lift
  };
}
var pinsCss = `
  #pins { position: absolute; inset: 0; transform-origin: 0 0; will-change: transform; pointer-events: none; }
  .pin {
    position: absolute; width: 0; height: 0; pointer-events: auto; --pin: var(--ink); filter: grayscale(1);
    will-change: translate;
  }
  .pin.active { filter: none; }
  .pin.arriving { animation: pin-arrive 700ms ease-out; }
  @keyframes pin-arrive {
    0% { transform: translateY(0); filter: grayscale(0); }
    50% { transform: translateY(-16px); filter: grayscale(0); }
    75% { transform: translateY(0); filter: grayscale(0); }
    100% { transform: translateY(0); filter: grayscale(1); }
  }
  .pin .foot { position: absolute; left: -2.5px; top: -2.5px; width: 5px; height: 5px; border-radius: 50%; background: color-mix(in srgb, var(--pin) 85%, transparent); }
  .pin .stem {
    position: absolute; left: -0.5px; bottom: 0; width: 1px; height: var(--stem); background: color-mix(in srgb, var(--pin) 85%, transparent);
    transform-origin: bottom center; transform: rotate(var(--lean)); transition: transform 0.3s, height 0.3s;
  }
  .pin .head {
    position: absolute; left: calc(var(--fan) - 20px); bottom: ${STEM}px; width: 40px; transition: left 0.3s;
    display: flex; flex-direction: column; align-items: center; cursor: pointer;
  }
  .pin.work-done .head:hover .card { transform: rotateY(0); }
  .pin .task {
    margin-top: 2px; padding: 1px 6px; border-radius: 3px; background: color-mix(in srgb, var(--pin) 85%, transparent); color: var(--on-colour);
    font-size: 9px; letter-spacing: 0.08em; white-space: nowrap;
  }
  .pin.work-draft .badge .face.front { border-style: dashed; }
  .pin.work-draft .task { border: 1px dashed color-mix(in srgb, var(--pin) 85%, transparent); background: transparent; color: var(--ink); }
  .pin.work-draft .stem { background: repeating-linear-gradient(to bottom, color-mix(in srgb, var(--pin) 85%, transparent) 0 4px, transparent 4px 7px); }
  .pin.active .badge { border-radius: 50%; box-shadow: 0 0 0 3px var(--highlight); }
  /* a 10 by 6 px triangle whose tip ends 3 px above the 3 px ring */
  .pin.selected .head::before {
    content: ''; position: absolute; top: -12px; left: calc(50% - 5px);
    border: 5px solid transparent; border-top: 6px solid var(--highlight);
  }
`;
var PIN = `<div class="foot"></div><div class="stem"></div><div class="head">${WORK_BADGE}<div class="task"></div></div>`;
function createPins(host, anchorOf, onToggle, tip) {
  const layer = document.createElement("div");
  layer.id = "pins";
  host.append(layer);
  const pinned = new Map;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let travelFrame;
  let pins = [];
  let enabledStatuses = [];
  const finishing = new Map;
  let camera;
  let painted = false;
  const place = (scaleChanged = true) => {
    if (camera === undefined)
      return;
    layer.style.transform = `translate(${camera.x}px, ${camera.y}px)`;
    if (!scaleChanged)
      return;
    const now = performance.now();
    for (const pin of pinned.values()) {
      const point = positionOf(pin, now, reducedMotion.matches);
      pin.node.style.translate = `${point.x * camera.k}px ${point.y * camera.k}px`;
    }
    if (travelFrame === undefined && [...pinned.values()].some((pin) => pin.travel !== undefined)) {
      travelFrame = requestAnimationFrame(() => {
        travelFrame = undefined;
        place();
      });
    }
  };
  const fanOut = () => {
    const shown = pins.filter((pin) => pinned.has(pin.key) && (enabledStatuses.includes(pin.status) || finishing.has(pin.key)));
    const visible = new Set(shown.map((pin) => pin.key));
    for (const [key, { node }] of pinned)
      node.hidden = !visible.has(key);
    const placed = new Map;
    for (const pin of shown) {
      const index = placed.get(pin.elementId) ?? 0;
      placed.set(pin.elementId, index + 1);
      const fan = -index * FAN_PITCH;
      const { node } = pinned.get(pin.key);
      node.classList.toggle("work-disappearing", finishing.has(pin.key) && !enabledStatuses.includes(pin.status));
      node.style.setProperty("--fan", `${fan}px`);
      node.style.setProperty("--lean", `${Math.atan2(fan, STEM)}rad`);
      node.style.setProperty("--stem", `${Math.hypot(fan, STEM)}px`);
    }
  };
  const updatePin = (pin, anchor) => {
    const previous = pinned.get(pin.key);
    let node = previous?.node;
    if (node === undefined) {
      node = document.createElement("div");
      node.className = painted ? "pin arriving" : "pin";
      node.innerHTML = PIN;
      node.querySelector(".head").addEventListener("click", () => onToggle(pin.taskId));
      tip.attach(node.querySelector(".head"));
      layer.append(node);
    }
    let travel = previous?.travel;
    if (previous !== undefined && previous.elementId !== pin.elementId) {
      travel = undefined;
      if (camera !== undefined && !node.hidden && !reducedMotion.matches) {
        const now = performance.now();
        const from = positionOf(previous, now, false);
        const offset = { x: from.x - anchor.x, y: from.y - anchor.y };
        travel = { offset, started: now, lift: Math.min(40 / camera.k, Math.hypot(offset.x, offset.y) * 0.15) };
        node.classList.remove("arriving");
      }
    }
    pinned.set(pin.key, { node, anchor, elementId: pin.elementId, travel });
    node.classList.toggle("work-draft", pin.draft);
    node.style.setProperty("--pin", pin.colour);
    node.querySelector(".head").dataset.tip = `${pin.assignee ?? "Unassigned"} · ${pin.title}`;
    if (finishing.has(pin.key))
      node.classList.remove("arriving");
    fillWorkBadge(node, pin, finishing.get(pin.key));
    node.querySelector(".task").textContent = pin.taskId;
  };
  return {
    paint(next) {
      const visible = new Set(pins.filter((pin) => pinned.has(pin.key) && enabledStatuses.includes(pin.status)).map((pin) => pin.key));
      const started = finishingWorkKeys(pins, next);
      for (const key of started) {
        if (visible.has(key))
          finishing.set(key, Date.now());
        else
          started.delete(key);
      }
      pins = next;
      const keep = new Set(pins.map((pin) => pin.key));
      for (const [key, { node }] of pinned) {
        if (keep.has(key))
          continue;
        node.remove();
        pinned.delete(key);
      }
      for (const pin of pins) {
        const anchor = anchorOf(pin.elementId);
        if (anchor === undefined)
          continue;
        updatePin(pin, anchor);
      }
      painted = true;
      fanOut();
      place();
      if (started.size > 0)
        setTimeout(() => {
          for (const key of started) {
            finishing.delete(key);
            pinned.get(key)?.node.classList.remove("work-finishing", "work-disappearing");
          }
          fanOut();
        }, WORK_BADGE_FINISH_MS);
    },
    place(current) {
      const scaleChanged = camera?.k !== current.k;
      camera = current;
      place(scaleChanged);
    },
    show(statuses) {
      enabledStatuses = statuses;
      fanOut();
    },
    activate(active, selected) {
      for (const pin of pins) {
        const node = pinned.get(pin.key)?.node;
        node?.classList.toggle("active", active.includes(pin.taskId));
        node?.classList.toggle("selected", pin.taskId === selected);
      }
    }
  };
}

// src/viewers/web/organisms/tip.ts
function createTip(host) {
  const bubble = document.createElement("div");
  bubble.id = "tip";
  bubble.hidden = true;
  host.append(bubble);
  return {
    attach(node) {
      node.addEventListener("mouseenter", () => {
        const box = node.getBoundingClientRect();
        const origin = host.getBoundingClientRect();
        bubble.textContent = node.dataset.tip ?? "";
        bubble.style.left = `${box.left + box.width / 2 - origin.left}px`;
        bubble.style.top = `${box.top - origin.top - 6}px`;
        bubble.hidden = false;
      });
      node.addEventListener("mouseleave", () => {
        bubble.hidden = true;
      });
    }
  };
}

// node_modules/markdown-exit/dist/chunk-CzXV76rE.js
var __defProp2 = Object.defineProperty;
var __exportAll = (all, symbols) => {
  let target = {};
  for (var name in all) {
    __defProp2(target, name, {
      get: all[name],
      enumerable: true
    });
  }
  if (symbols) {
    __defProp2(target, Symbol.toStringTag, { value: "Module" });
  }
  return target;
};

// node_modules/markdown-exit/node_modules/entities/dist/esm/decode-codepoint.js
var _a;
var decodeMap = new Map([
  [0, 65533],
  [128, 8364],
  [130, 8218],
  [131, 402],
  [132, 8222],
  [133, 8230],
  [134, 8224],
  [135, 8225],
  [136, 710],
  [137, 8240],
  [138, 352],
  [139, 8249],
  [140, 338],
  [142, 381],
  [145, 8216],
  [146, 8217],
  [147, 8220],
  [148, 8221],
  [149, 8226],
  [150, 8211],
  [151, 8212],
  [152, 732],
  [153, 8482],
  [154, 353],
  [155, 8250],
  [156, 339],
  [158, 382],
  [159, 376]
]);
var fromCodePoint = (_a = String.fromCodePoint) !== null && _a !== undefined ? _a : (codePoint) => {
  let output = "";
  if (codePoint > 65535) {
    codePoint -= 65536;
    output += String.fromCharCode(codePoint >>> 10 & 1023 | 55296);
    codePoint = 56320 | codePoint & 1023;
  }
  output += String.fromCharCode(codePoint);
  return output;
};
function replaceCodePoint(codePoint) {
  var _a;
  if (codePoint >= 55296 && codePoint <= 57343 || codePoint > 1114111) {
    return 65533;
  }
  return (_a = decodeMap.get(codePoint)) !== null && _a !== undefined ? _a : codePoint;
}

// node_modules/markdown-exit/node_modules/entities/dist/esm/internal/decode-shared.js
function decodeBase64(input) {
  const binary = typeof atob === "function" ? atob(input) : typeof Buffer.from === "function" ? Buffer.from(input, "base64").toString("binary") : new Buffer(input, "base64").toString("binary");
  const evenLength = binary.length & ~1;
  const out = new Uint16Array(evenLength / 2);
  for (let index = 0, outIndex = 0;index < evenLength; index += 2) {
    const lo = binary.charCodeAt(index);
    const hi = binary.charCodeAt(index + 1);
    out[outIndex++] = lo | hi << 8;
  }
  return out;
}

// node_modules/markdown-exit/node_modules/entities/dist/esm/generated/decode-data-html.js
var htmlDecodeTree = /* @__PURE__ */ decodeBase64("QR08ALkAAgH6AYsDNQR2BO0EPgXZBQEGLAbdBxMISQrvCmQLfQurDKQNLw4fD4YPpA+6D/IPAAAAAAAAAAAAAAAAKhBMEY8TmxUWF2EYLBkxGuAa3RsJHDscWR8YIC8jSCSIJcMl6ie3Ku8rEC0CLjoupS7kLgAIRU1hYmNmZ2xtbm9wcnN0dVQAWgBeAGUAaQBzAHcAfgCBAIQAhwCSAJoAoACsALMAbABpAGcAO4DGAMZAUAA7gCYAJkBjAHUAdABlADuAwQDBQHIiZXZlAAJhAAFpeW0AcgByAGMAO4DCAMJAEGRyAADgNdgE3XIAYQB2AGUAO4DAAMBA8CFoYZFj4SFjcgBhZAAAoFMqAAFncIsAjgBvAG4ABGFmAADgNdg43fAlbHlGdW5jdGlvbgCgYSBpAG4AZwA7gMUAxUAAAWNzpACoAHIAAOA12Jzc6SFnbgCgVCJpAGwAZABlADuAwwDDQG0AbAA7gMQAxEAABGFjZWZvcnN1xQDYANoA7QDxAPYA+QD8AAABY3LJAM8AayNzbGFzaAAAoBYidgHTANUAAKDnKmUAZAAAoAYjeQARZIABY3J0AOAA5QDrAGEidXNlAACgNSLuI291bGxpcwCgLCFhAJJjcgAA4DXYBd1wAGYAAOA12Dnd5SF2ZdhiYwDyAOoAbSJwZXEAAKBOIgAHSE9hY2RlZmhpbG9yc3UXARoBHwE6AVIBVQFiAWQBZgGCAakB6QHtAfIBYwB5ACdkUABZADuAqQCpQIABY3B5ACUBKAE1AfUhdGUGYWmg0iJ0KGFsRGlmZmVyZW50aWFsRAAAoEUhbCJleXMAAKAtIQACYWVpb0EBRAFKAU0B8iFvbgxhZABpAGwAO4DHAMdAcgBjAAhhbiJpbnQAAKAwIm8AdAAKYQABZG5ZAV0BaSJsbGEAuGB0I2VyRG90ALdg8gA5AWkAp2NyImNsZQAAAkRNUFRwAXQBeQF9AW8AdAAAoJkiaSJudXMAAKCWIuwhdXMAoJUiaSJtZXMAAKCXIm8AAAFjc4cBlAFrKndpc2VDb250b3VySW50ZWdyYWwAAKAyImUjQ3VybHkAAAFEUZwBpAFvJXVibGVRdW90ZQAAoB0gdSJvdGUAAKAZIAACbG5wdbABtgHNAdgBbwBuAGWgNyIAoHQqgAFnaXQAvAHBAcUB8iJ1ZW50AKBhIm4AdAAAoC8i7yV1ckludGVncmFsAKAuIgABZnLRAdMBAKACIe8iZHVjdACgECJuLnRlckNsb2Nrd2lzZUNvbnRvdXJJbnRlZ3JhbAAAoDMi7yFzcwCgLypjAHIAAOA12J7ccABDoNMiYQBwAACgTSKABURKU1phY2VmaW9zAAsCEgIVAhgCGwIsAjQCOQI9AnMCfwNvoEUh9CJyYWhkAKARKWMAeQACZGMAeQAFZGMAeQAPZIABZ3JzACECJQIoAuchZXIAoCEgcgAAoKEhaAB2AACg5CoAAWF5MAIzAvIhb24OYRRkbAB0oAciYQCUY3IAAOA12AfdAAFhZkECawIAAWNtRQJnAvIjaXRpY2FsAAJBREdUUAJUAl8CYwJjInV0ZQC0YG8AdAFZAloC2WJiJGxlQWN1dGUA3WJyImF2ZQBgYGkibGRlANxi7yFuZACgxCJmJWVyZW50aWFsRAAAoEYhcAR9AgAAAAAAAIECjgIAABoDZgAA4DXYO91EoagAhQKJAm8AdAAAoNwgcSJ1YWwAAKBQIuIhbGUAA0NETFJVVpkCqAK1Au8C/wIRA28AbgB0AG8AdQByAEkAbgB0AGUAZwByAGEA7ADEAW8AdAKvAgAAAACwAqhgbiNBcnJvdwAAoNMhAAFlb7kC0AJmAHQAgAFBUlQAwQLGAs0CciJyb3cAAKDQIekkZ2h0QXJyb3cAoNQhZQDlACsCbgBnAAABTFLWAugC5SFmdAABQVLcAuECciJyb3cAAKD4J+kkZ2h0QXJyb3cAoPon6SRnaHRBcnJvdwCg+SdpImdodAAAAUFU9gL7AnIicm93AACg0iFlAGUAAKCoInAAQQIGAwAAAAALA3Iicm93AACg0SFvJHduQXJyb3cAAKDVIWUlcnRpY2FsQmFyAACgJSJuAAADQUJMUlRhJAM2AzoDWgNxA3oDciJyb3cAAKGTIUJVLAMwA2EAcgAAoBMpcCNBcnJvdwAAoPUhciJldmUAEWPlIWZ00gJDAwAASwMAAFIDaSVnaHRWZWN0b3IAAKBQKWUkZVZlY3RvcgAAoF4p5SJjdG9yQqC9IWEAcgAAoFYpaSJnaHQA1AFiAwAAaQNlJGVWZWN0b3IAAKBfKeUiY3RvckKgwSFhAHIAAKBXKWUAZQBBoKQiciJyb3cAAKCnIXIAcgBvAPcAtAIAAWN0gwOHA3IAAOA12J/c8iFvaxBhAAhOVGFjZGZnbG1vcHFzdHV4owOlA6kDsAO/A8IDxgPNA9ID8gP9AwEEFAQeBCAEJQRHAEphSAA7gNAA0EBjAHUAdABlADuAyQDJQIABYWl5ALYDuQO+A/Ihb24aYXIAYwA7gMoAykAtZG8AdAAWYXIAAOA12AjdcgBhAHYAZQA7gMgAyEDlIm1lbnQAoAgiAAFhcNYD2QNjAHIAEmF0AHkAUwLhAwAAAADpA20lYWxsU3F1YXJlAACg+yVlJ3J5U21hbGxTcXVhcmUAAKCrJQABZ3D2A/kDbwBuABhhZgAA4DXYPN3zImlsb26VY3UAAAFhaQYEDgRsAFSgdSppImxkZQAAoEIi7CNpYnJpdW0AoMwhAAFjaRgEGwRyAACgMCFtAACgcyphAJdjbQBsADuAywDLQAABaXApBC0E8yF0cwCgAyLvJG5lbnRpYWxFAKBHIYACY2Zpb3MAPQQ/BEMEXQRyBHkAJGRyAADgNdgJ3WwibGVkAFMCTAQAAAAAVARtJWFsbFNxdWFyZQAAoPwlZSdyeVNtYWxsU3F1YXJlAACgqiVwA2UEAABpBAAAAABtBGYAAOA12D3dwSFsbACgACLyI2llcnRyZgCgMSFjAPIAcQQABkpUYWJjZGZnb3JzdIgEiwSOBJMElwSkBKcEqwStBLIE5QTqBGMAeQADZDuAPgA+QO0hbWFkoJMD3GNyImV2ZQAeYYABZWl5AJ0EoASjBOQhaWwiYXIAYwAcYRNkbwB0ACBhcgAA4DXYCt0AoNkicABmAADgNdg+3eUiYXRlcgADRUZHTFNUvwTIBM8E1QTZBOAEcSJ1YWwATKBlIuUhc3MAoNsidSRsbEVxdWFsAACgZyJyI2VhdGVyAACgoirlIXNzAKB3IuwkYW50RXF1YWwAoH4qaSJsZGUAAKBzImMAcgAA4DXYotwAoGsiAARBYWNmaW9zdfkE/QQFBQgFCwUTBSIFKwVSIkRjeQAqZAABY3QBBQQFZQBrAMdiXmDpIXJjJGFyAACgDCFsJWJlcnRTcGFjZQAAoAsh8AEYBQAAGwVmAACgDSHpJXpvbnRhbExpbmUAoAAlAAFjdCYFKAXyABIF8iFvayZhbQBwAEQBMQU5BW8AdwBuAEgAdQBtAPAAAAFxInVhbAAAoE8iAAdFSk9hY2RmZ21ub3N0dVMFVgVZBVwFYwVtBXAFcwV6BZAFtgXFBckFzQVjAHkAFWTsIWlnMmFjAHkAAWRjAHUAdABlADuAzQDNQAABaXlnBWwFcgBjADuAzgDOQBhkbwB0ADBhcgAAoBEhcgBhAHYAZQA7gMwAzEAAoREhYXB/BYsFAAFjZ4MFhQVyACphaSNuYXJ5SQAAoEghbABpAGUA8wD6AvQBlQUAAKUFZaAsIgABZ3KaBZ4F8iFhbACgKyLzI2VjdGlvbgCgwiJpI3NpYmxlAAABQ1SsBbEFbyJtbWEAAKBjIGkibWVzAACgYiCAAWdwdAC8Bb8FwwVvAG4ALmFmAADgNdhA3WEAmWNjAHIAAKAQIWkibGRlAChh6wHSBQAA1QVjAHkABmRsADuAzwDPQIACY2Zvc3UA4QXpBe0F8gX9BQABaXnlBegFcgBjADRhGWRyAADgNdgN3XAAZgAA4DXYQd3jAfcFAAD7BXIAAOA12KXc8iFjeQhk6yFjeQRkgANISmFjZm9zAAwGDwYSBhUGHQYhBiYGYwB5ACVkYwB5AAxk8CFwYZpjAAFleRkGHAbkIWlsNmEaZHIAAOA12A7dcABmAADgNdhC3WMAcgAA4DXYptyABUpUYWNlZmxtb3N0AD0GQAZDBl4GawZkB2gHcAd0B80H2gdjAHkACWQ7gDwAPECAAmNtbnByAEwGTwZSBlUGWwb1IXRlOWHiIWRhm2NnAACg6ifsI2FjZXRyZgCgEiFyAACgniGAAWFleQBkBmcGagbyIW9uPWHkIWlsO2EbZAABZnNvBjQHdAAABUFDREZSVFVWYXKABp4GpAbGBssG3AYDByEHwQIqBwABbnKEBowGZyVsZUJyYWNrZXQAAKDoJ/Ihb3cAoZAhQlKTBpcGYQByAACg5CHpJGdodEFycm93AKDGIWUjaWxpbmcAAKAII28A9QGqBgAAsgZiJWxlQnJhY2tldAAAoOYnbgDUAbcGAAC+BmUkZVZlY3RvcgAAoGEp5SJjdG9yQqDDIWEAcgAAoFkpbCJvb3IAAKAKI2kiZ2h0AAABQVbSBtcGciJyb3cAAKCUIeUiY3RvcgCgTikAAWVy4AbwBmUAAKGjIkFW5gbrBnIicm93AACgpCHlImN0b3IAoFopaSNhbmdsZQBCorIi+wYAAAAA/wZhAHIAAKDPKXEidWFsAACgtCJwAIABRFRWAAoHEQcYB+8kd25WZWN0b3IAoFEpZSRlVmVjdG9yAACgYCnlImN0b3JCoL8hYQByAACgWCnlImN0b3JCoLwhYQByAACgUilpAGcAaAB0AGEAcgByAG8A9wDMAnMAAANFRkdMU1Q/B0cHTgdUB1gHXwfxJXVhbEdyZWF0ZXIAoNoidSRsbEVxdWFsAACgZiJyI2VhdGVyAACgdiLlIXNzAKChKuwkYW50RXF1YWwAoH0qaSJsZGUAAKByInIAAOA12A/dZaDYIuYjdGFycm93AKDaIWkiZG90AD9hgAFucHcAege1B7kHZwAAAkxSbHKCB5QHmwerB+UhZnQAAUFSiAeNB3Iicm93AACg9SfpJGdodEFycm93AKD3J+kkZ2h0QXJyb3cAoPYn5SFmdAABYXLcAqEHaQBnAGgAdABhAHIAcgBvAPcA5wJpAGcAaAB0AGEAcgByAG8A9wDuAmYAAOA12EPdZQByAAABTFK/B8YHZSRmdEFycm93AACgmSHpJGdodEFycm93AKCYIYABY2h0ANMH1QfXB/IAWgYAoLAh8iFva0FhAKBqIgAEYWNlZmlvc3XpB+wH7gf/BwMICQgOCBEIcAAAoAUpeQAcZAABZGzyB/kHaSR1bVNwYWNlAACgXyBsI2ludHJmAACgMyFyAADgNdgQ3e4jdXNQbHVzAKATInAAZgAA4DXYRN1jAPIA/gecY4AESmFjZWZvc3R1ACEIJAgoCDUIgQiFCDsKQApHCmMAeQAKZGMidXRlAENhgAFhZXkALggxCDQI8iFvbkdh5CFpbEVhHWSAAWdzdwA7CGEIfQjhInRpdmWAAU1UVgBECEwIWQhlJWRpdW1TcGFjZQAAoAsgaABpAAABY25SCFMIawBTAHAAYQBjAOUASwhlAHIAeQBUAGgAaQDuAFQI9CFlZAABR0xnCHUIcgBlAGEAdABlAHIARwByAGUAYQB0AGUA8gDrBGUAcwBzAEwAZQBzAPMA2wdMImluZQAKYHIAAOA12BHdAAJCbnB0jAiRCJkInAhyImVhawAAoGAgwiZyZWFraW5nU3BhY2WgYGYAAKAVIUOq7CqzCMIIzQgAAOcIGwkAAAAAAAAtCQAAbwkAAIcJAACdCcAJGQoAADQKAAFvdbYIvAjuI2dydWVudACgYiJwIkNhcAAAoG0ibyh1YmxlVmVydGljYWxCYXIAAKAmIoABbHF4ANII1wjhCOUibWVudACgCSL1IWFsVKBgImkibGRlAADgQiI4A2kic3RzAACgBCJyI2VhdGVyAACjbyJFRkdMU1T1CPoIAgkJCQ0JFQlxInVhbAAAoHEidSRsbEVxdWFsAADgZyI4A3IjZWF0ZXIAAOBrIjgD5SFzcwCgeSLsJGFudEVxdWFsAOB+KjgDaSJsZGUAAKB1IvUhbXBEASAJJwnvI3duSHVtcADgTiI4A3EidWFsAADgTyI4A2UAAAFmczEJRgn0JFRyaWFuZ2xlQqLqIj0JAAAAAEIJYQByAADgzyk4A3EidWFsAACg7CJzAICibiJFR0xTVABRCVYJXAlhCWkJcSJ1YWwAAKBwInIjZWF0ZXIAAKB4IuUhc3MA4GoiOAPsJGFudEVxdWFsAOB9KjgDaSJsZGUAAKB0IuUic3RlZAABR0x1CX8J8iZlYXRlckdyZWF0ZXIA4KIqOAPlI3NzTGVzcwDgoSo4A/IjZWNlZGVzAKGAIkVTjwmVCXEidWFsAADgryo4A+wkYW50RXF1YWwAoOAiAAFlaaAJqQl2JmVyc2VFbGVtZW50AACgDCLnJWh0VHJpYW5nbGVCousitgkAAAAAuwlhAHIAAODQKTgDcSJ1YWwAAKDtIgABcXXDCeAJdSNhcmVTdQAAAWJwywnVCfMhZXRF4I8iOANxInVhbAAAoOIi5SJyc2V0ReCQIjgDcSJ1YWwAAKDjIoABYmNwAOYJ8AkNCvMhZXRF4IIi0iBxInVhbAAAoIgi4yJlZWRzgKGBIkVTVAD6CQAKBwpxInVhbAAA4LAqOAPsJGFudEVxdWFsAKDhImkibGRlAADgfyI4A+UicnNldEXggyLSIHEidWFsAACgiSJpImxkZQCAoUEiRUZUACIKJwouCnEidWFsAACgRCJ1JGxsRXF1YWwAAKBHImkibGRlAACgSSJlJXJ0aWNhbEJhcgAAoCQiYwByAADgNdip3GkAbABkAGUAO4DRANFAnWMAB0VhY2RmZ21vcHJzdHV2XgphCmgKcgp2CnoKgQqRCpYKqwqtCrsKyArNCuwhaWdSYWMAdQB0AGUAO4DTANNAAAFpeWwKcQpyAGMAO4DUANRAHmRiImxhYwBQYXIAAOA12BLdcgBhAHYAZQA7gNIA0kCAAWFlaQCHCooKjQpjAHIATGFnAGEAqWNjInJvbgCfY3AAZgAA4DXYRt3lI25DdXJseQABRFGeCqYKbyV1YmxlUXVvdGUAAKAcIHUib3RlAACgGCAAoFQqAAFjbLEKtQpyAADgNdiq3GEAcwBoADuA2ADYQGkAbAHACsUKZABlADuA1QDVQGUAcwAAoDcqbQBsADuA1gDWQGUAcgAAAUJQ0wrmCgABYXLXCtoKcgAAoD4gYQBjAAABZWvgCuIKAKDeI2UAdAAAoLQjYSVyZW50aGVzaXMAAKDcI4AEYWNmaGlsb3JzAP0KAwsFCwkLCwsMCxELIwtaC3IjdGlhbEQAAKACInkAH2RyAADgNdgT3WkApmOgY/Ujc01pbnVzsWAAAWlwFQsgC24AYwBhAHIAZQBwAGwAYQBuAOUACgVmAACgGSGAobsqZWlvACoLRQtJC+MiZWRlc4CheiJFU1QANAs5C0ALcSJ1YWwAAKCvKuwkYW50RXF1YWwAoHwiaSJsZGUAAKB+Im0AZQAAoDMgAAFkcE0LUQv1IWN0AKAPIm8jcnRpb24AYaA3ImwAAKAdIgABY2leC2ILcgAA4DXYq9yoYwACVWZvc2oLbwtzC3cLTwBUADuAIgAiQHIAAOA12BTdcABmAACgGiFjAHIAAOA12KzcAAZCRWFjZWZoaW9yc3WPC5MLlwupC7YL2AvbC90LhQyTDJoMowzhIXJyAKAQKUcAO4CuAK5AgAFjbnIAnQugC6ML9SF0ZVRhZwAAoOsncgB0oKAhbAAAoBYpgAFhZXkArwuyC7UL8iFvblhh5CFpbFZhIGR2oBwhZSJyc2UAAAFFVb8LzwsAAWxxwwvIC+UibWVudACgCyL1JGlsaWJyaXVtAKDLIXAmRXF1aWxpYnJpdW0AAKBvKXIAAKAcIW8AoWPnIWh0AARBQ0RGVFVWYewLCgwQDDIMNwxeDHwM9gIAAW5y8Av4C2clbGVCcmFja2V0AACg6SfyIW93AKGSIUJM/wsDDGEAcgAAoOUhZSRmdEFycm93AACgxCFlI2lsaW5nAACgCSNvAPUBFgwAAB4MYiVsZUJyYWNrZXQAAKDnJ24A1AEjDAAAKgxlJGVWZWN0b3IAAKBdKeUiY3RvckKgwiFhAHIAAKBVKWwib29yAACgCyMAAWVyOwxLDGUAAKGiIkFWQQxGDHIicm93AACgpiHlImN0b3IAoFspaSNhbmdsZQBCorMiVgwAAAAAWgxhAHIAAKDQKXEidWFsAACgtSJwAIABRFRWAGUMbAxzDO8kd25WZWN0b3IAoE8pZSRlVmVjdG9yAACgXCnlImN0b3JCoL4hYQByAACgVCnlImN0b3JCoMAhYQByAACgUykAAXB1iQyMDGYAAKAdIe4kZEltcGxpZXMAoHAp6SRnaHRhcnJvdwCg2yEAAWNongyhDHIAAKAbIQCgsSHsJGVEZWxheWVkAKD0KYAGSE9hY2ZoaW1vcXN0dQC/DMgMzAzQDOIM5gwKDQ0NFA0ZDU8NVA1YDQABQ2PDDMYMyCFjeSlkeQAoZEYiVGN5ACxkYyJ1dGUAWmEAorwqYWVpedgM2wzeDOEM8iFvbmBh5CFpbF5hcgBjAFxhIWRyAADgNdgW3e8hcnQAAkRMUlXvDPYM/QwEDW8kd25BcnJvdwAAoJMhZSRmdEFycm93AACgkCHpJGdodEFycm93AKCSIXAjQXJyb3cAAKCRIechbWGjY+EkbGxDaXJjbGUAoBgicABmAADgNdhK3XICHw0AAAAAIg10AACgGiLhIXJlgKGhJUlTVQAqDTINSg3uJXRlcnNlY3Rpb24AoJMidQAAAWJwNw1ADfMhZXRFoI8icSJ1YWwAAKCRIuUicnNldEWgkCJxInVhbAAAoJIibiJpb24AAKCUImMAcgAA4DXYrtxhAHIAAKDGIgACYmNtcF8Nag2ODZANc6DQImUAdABFoNAicSJ1YWwAAKCGIgABY2huDYkNZSJlZHMAgKF7IkVTVAB4DX0NhA1xInVhbAAAoLAq7CRhbnRFcXVhbACgfSJpImxkZQAAoH8iVABoAGEA9ADHCwCgESIAodEiZXOVDZ8NciJzZXQARaCDInEidWFsAACghyJlAHQAAKDRIoAFSFJTYWNmaGlvcnMAtQ27Db8NyA3ODdsN3w3+DRgOHQ4jDk8AUgBOADuA3gDeQMEhREUAoCIhAAFIY8MNxg1jAHkAC2R5ACZkAAFidcwNzQ0JYKRjgAFhZXkA1A3XDdoN8iFvbmRh5CFpbGJhImRyAADgNdgX3QABZWnjDe4N8gHoDQAA7Q3lImZvcmUAoDQiYQCYYwABY27yDfkNayNTcGFjZQAA4F8gCiDTInBhY2UAoAkg7CFkZYChPCJFRlQABw4MDhMOcSJ1YWwAAKBDInUkbGxFcXVhbAAAoEUiaSJsZGUAAKBIInAAZgAA4DXYS93pI3BsZURvdACg2yAAAWN0Jw4rDnIAAOA12K/c8iFva2Zh4QpFDlYOYA5qDgAAbg5yDgAAAAAAAAAAAAB5DnwOqA6zDgAADg8RDxYPGg8AAWNySA5ODnUAdABlADuA2gDaQHIAb6CfIeMhaXIAoEkpcgDjAVsOAABdDnkADmR2AGUAbGEAAWl5Yw5oDnIAYwA7gNsA20AjZGIibGFjAHBhcgAA4DXYGN1yAGEAdgBlADuA2QDZQOEhY3JqYQABZGl/Dp8OZQByAAABQlCFDpcOAAFhcokOiw5yAF9gYQBjAAABZWuRDpMOAKDfI2UAdAAAoLUjYSVyZW50aGVzaXMAAKDdI28AbgBQoMMi7CF1cwCgjiIAAWdwqw6uDm8AbgByYWYAAOA12EzdAARBREVUYWRwc78O0g7ZDuEOBQPqDvMOBw9yInJvdwDCoZEhyA4AAMwOYQByAACgEilvJHduQXJyb3cAAKDFIW8kd25BcnJvdwAAoJUhcSV1aWxpYnJpdW0AAKBuKWUAZQBBoKUiciJyb3cAAKClIW8AdwBuAGEAcgByAG8A9wAQA2UAcgAAAUxS+Q4AD2UkZnRBcnJvdwAAoJYh6SRnaHRBcnJvdwCglyFpAGyg0gNvAG4ApWPpIW5nbmFjAHIAAOA12LDcaSJsZGUAaGFtAGwAO4DcANxAgAREYmNkZWZvc3YALQ8xDzUPNw89D3IPdg97D4AP4SFzaACgqyJhAHIAAKDrKnkAEmThIXNobKCpIgCg5ioAAWVyQQ9DDwCgwSKAAWJ0eQBJD00Paw9hAHIAAKAWIGmgFiDjIWFsAAJCTFNUWA9cD18PZg9hAHIAAKAjIukhbmV8YGUkcGFyYXRvcgAAoFgnaSJsZGUAAKBAItQkaGluU3BhY2UAoAogcgAA4DXYGd1wAGYAAOA12E3dYwByAADgNdix3GQiYXNoAACgqiKAAmNlZm9zAI4PkQ+VD5kPng/pIXJjdGHkIWdlAKDAInIAAOA12BrdcABmAADgNdhO3WMAcgAA4DXYstwAAmZpb3OqD64Prw+0D3IAAOA12BvdnmNwAGYAAOA12E/dYwByAADgNdiz3IAEQUlVYWNmb3N1AMgPyw/OD9EP2A/gD+QP6Q/uD2MAeQAvZGMAeQAHZGMAeQAuZGMAdQB0AGUAO4DdAN1AAAFpedwP3w9yAGMAdmErZHIAAOA12BzdcABmAADgNdhQ3WMAcgAA4DXYtNxtAGwAeGEABEhhY2RlZm9z/g8BEAUQDRAQEB0QIBAkEGMAeQAWZGMidXRlAHlhAAFheQkQDBDyIW9ufWEXZG8AdAB7YfIBFRAAABwQbwBXAGkAZAB0AOgAVAhhAJZjcgAAoCghcABmAACgJCFjAHIAAOA12LXc4QtCEEkQTRAAAGcQbRByEAAAAAAAAAAAeRCKEJcQ8hD9EAAAGxEhETIROREAAD4RYwB1AHQAZQA7gOEA4UByImV2ZQADYYCiPiJFZGl1eQBWEFkQWxBgEGUQAOA+IjMDAKA/InIAYwA7gOIA4kB0AGUAO4C0ALRAMGRsAGkAZwA7gOYA5kByoGEgAOA12B7dcgBhAHYAZQA7gOAA4EAAAWVwfBCGEAABZnCAEIQQ8yF5bQCgNSHoAIMQaABhALFjAAFhcI0QWwAAAWNskRCTEHIAAWFnAACgPypkApwQAAAAALEQAKInImFkc3ajEKcQqRCuEG4AZAAAoFUqAKBcKmwib3BlAACgWCoAoFoqAKMgImVsbXJzersQvRDAEN0Q5RDtEACgpCllAACgICJzAGQAYaAhImEEzhDQENIQ1BDWENgQ2hDcEACgqCkAoKkpAKCqKQCgqykAoKwpAKCtKQCgrikAoK8pdAB2oB8iYgBkoL4iAKCdKQABcHTpEOwQaAAAoCIixWDhIXJyAKB8IwABZ3D1EPgQbwBuAAVhZgAA4DXYUt0Ao0giRWFlaW9wBxEJEQ0RDxESERQRAKBwKuMhaXIAoG8qAKBKImQAAKBLInMAJ2DyIW94ZaBIIvEADhFpAG4AZwA7gOUA5UCAAWN0eQAmESoRKxFyAADgNdi23CpgbQBwAGWgSCLxAPgBaQBsAGQAZQA7gOMA40BtAGwAO4DkAORAAAFjaUERRxFvAG4AaQBuAPQA6AFuAHQAAKARKgAITmFiY2RlZmlrbG5vcHJzdWQRaBGXEZ8RpxGrEdIR1hErEjASexKKEn0RThNbE3oTbwB0AACg7SoAAWNybBGJEWsAAAJjZXBzdBF4EX0RghHvIW5nAKBMInAjc2lsb24A9mNyImltZQAAoDUgaQBtAGWgPSJxAACgzSJ2AY0RkRFlAGUAAKC9ImUAZABnoAUjZQAAoAUjcgBrAHSgtSPiIXJrAKC2IwABb3mjEaYRbgDnAHcRMWTxIXVvAKAeIIACY21wcnQAtBG5Eb4RwRHFEeEhdXPloDUi5ABwInR5dgAAoLApcwDpAH0RbgBvAPUA6gCAAWFodwDLEcwRzhGyYwCgNiHlIWVuAKBsInIAAOA12B/dZwCAA2Nvc3R1dncA4xHyEQUSEhIhEiYSKRKAAWFpdQDpEesR7xHwAKMFcgBjAACg7yVwAACgwyKAAWRwdAD4EfwRABJvAHQAAKAAKuwhdXMAoAEqaSJtZXMAAKACKnECCxIAAAAADxLjIXVwAKAGKmEAcgAAoAUm8iNpYW5nbGUAAWR1GhIeEu8hd24AoL0lcAAAoLMlcCJsdXMAAKAEKmUA5QBCD+UAkg9hInJvdwAAoA0pgAFha28ANhJoEncSAAFjbjoSZRJrAIABbHN0AEESRxJNEm8jemVuZ2UAAKDrKXEAdQBhAHIA5QBcBPIjaWFuZ2xlgKG0JWRscgBYElwSYBLvIXduAKC+JeUhZnQAoMIlaSJnaHQAAKC4JWsAAKAjJLEBbRIAAHUSsgFxEgAAcxIAoJIlAKCRJTQAAKCTJWMAawAAoIglAAFlb38ShxJx4D0A5SD1IWl2AOBhIuUgdAAAoBAjAAJwdHd4kRKVEpsSnxJmAADgNdhT3XSgpSJvAG0AAKClIvQhaWUAoMgiAAZESFVWYmRobXB0dXayEsES0RLgEvcS+xIKExoTHxMjEygTNxMAAkxSbHK5ErsSvRK/EgCgVyUAoFQlAKBWJQCgUyUAolAlRFVkdckSyxLNEs8SAKBmJQCgaSUAoGQlAKBnJQACTFJsctgS2hLcEt4SAKBdJQCgWiUAoFwlAKBZJQCjUSVITFJobHLrEu0S7xLxEvMS9RIAoGwlAKBjJQCgYCUAoGslAKBiJQCgXyVvAHgAAKDJKQACTFJscgITBBMGEwgTAKBVJQCgUiUAoBAlAKAMJQCiACVEVWR1EhMUExYTGBMAoGUlAKBoJQCgLCUAoDQlaSJudXMAAKCfIuwhdXMAoJ4iaSJtZXMAAKCgIgACTFJsci8TMRMzEzUTAKBbJQCgWCUAoBglAKAUJQCjAiVITFJobHJCE0QTRhNIE0oTTBMAoGolAKBhJQCgXiUAoDwlAKAkJQCgHCUAAWV2UhNVE3YA5QD5AGIAYQByADuApgCmQAACY2Vpb2ITZhNqE24TcgAA4DXYt9xtAGkAAKBPIG0A5aA9IogRbAAAoVwAYmh0E3YTAKDFKfMhdWIAoMgnbAF+E4QTbABloCIgdAAAoCIgcAAAoU4iRWWJE4sTAKCuKvGgTyI8BeEMqRMAAN8TABQDFB8UAAAjFDQUAAAAAIUUAAAAAI0UAAAAANcU4xT3FPsUAACIFQAAlhWAAWNwcgCuE7ET1RP1IXRlB2GAoikiYWJjZHMAuxO/E8QTzhPSE24AZAAAoEQqciJjdXAAAKBJKgABYXXIE8sTcAAAoEsqcAAAoEcqbwB0AACgQCoA4CkiAP4AAWVv2RPcE3QAAKBBIO4ABAUAAmFlaXXlE+8T9RP4E/AB6hMAAO0TcwAAoE0qbwBuAA1hZABpAGwAO4DnAOdAcgBjAAlhcABzAHOgTCptAACgUCpvAHQAC2GAAWRtbgAIFA0UEhRpAGwAO4C4ALhAcCJ0eXYAAKCyKXQAAIGiADtlGBQZFKJAcgBkAG8A9ABiAXIAAOA12CDdgAFjZWkAKBQqFDIUeQBHZGMAawBtoBMn4SFyawCgEyfHY3IAAKPLJUVjZWZtcz8UQRRHFHcUfBSAFACgwykAocYCZWxGFEkUcQAAoFciZQBhAlAUAAAAAGAUciJyb3cAAAFsclYUWhTlIWZ0AKC6IWkiZ2h0AACguyGAAlJTYWNkAGgUaRRrFG8UcxSuYACgyCRzAHQAAKCbIukhcmMAoJoi4SFzaACgnSJuImludAAAoBAqaQBkAACg7yrjIWlyAKDCKfUhYnN1oGMmaQB0AACgYybsApMUmhS2FAAAwxRvAG4AZaA6APGgVCKrAG0CnxQAAAAAoxRhAHSgLABAYAChASJmbKcUqRTuABMNZQAAAW14rhSyFOUhbnQAoAEiZQDzANIB5wG6FAAAwBRkoEUibwB0AACgbSpuAPQAzAGAAWZyeQDIFMsUzhQA4DXYVN1vAOQA1wEAgakAO3MeAdMUcgAAoBchAAFhb9oU3hRyAHIAAKC1IXMAcwAAoBcnAAFjdeYU6hRyAADgNdi43AABYnDuFPIUZaDPKgCg0SploNAqAKDSKuQhb3QAoO8igANkZWxwcnZ3AAYVEBUbFSEVRBVlFYQV4SFycgABbHIMFQ4VAKA4KQCgNSlwAhYVAAAAABkVcgAAoN4iYwAAoN8i4SFycnCgtiEAoD0pgKIqImJjZG9zACsVMBU6FT4VQRVyImNhcAAAoEgqAAFhdTQVNxVwAACgRipwAACgSipvAHQAAKCNInIAAKBFKgDgKiIA/gACYWxydksVURVuFXMVcgByAG2gtyEAoDwpeQCAAWV2dwBYFWUVaRVxAHACXxUAAAAAYxVyAGUA4wAXFXUA4wAZFWUAZQAAoM4iZSJkZ2UAAKDPImUAbgA7gKQApEBlI2Fycm93AAABbHJ7FX8V5SFmdACgtiFpImdodAAAoLchZQDkAG0VAAFjaYsVkRVvAG4AaQBuAPQAkwFuAHQAAKAxImwiY3R5AACgLSOACUFIYWJjZGVmaGlqbG9yc3R1d3oAuBW7Fb8V1RXgFegV+RUKFhUWHxZUFlcWZRbFFtsW7xb7FgUXChdyAPIAtAJhAHIAAKBlKQACZ2xyc8YVyhXOFdAV5yFlcgCgICDlIXRoAKA4IfIA9QxoAHagECAAoKMiawHZFd4VYSJyb3cAAKAPKWEA4wBfAgABYXnkFecV8iFvbg9hNGQAoUYhYW/tFfQVAAFnciEC8RVyAACgyiF0InNlcQAAoHcqgAFnbG0A/xUCFgUWO4CwALBAdABhALRjcCJ0eXYAAKCxKQABaXIOFhIW8yFodACgfykA4DXYId1hAHIAAAFschsWHRYAoMMhAKDCIYACYWVnc3YAKBauAjYWOhY+Fm0AAKHEIm9zLhY0Fm4AZABzoMQi9SFpdACgZiZhIm1tYQDdY2kAbgAAoPIiAKH3AGlvQxZRFmQAZQAAgfcAO29KFksW90BuI3RpbWVzAACgxyJuAPgAUBZjAHkAUmRjAG8CXhYAAAAAYhZyAG4AAKAeI28AcAAAoA0jgAJscHR1dwBuFnEWdRaSFp4W7CFhciRgZgAA4DXYVd0AotkCZW1wc30WhBaJFo0WcQBkoFAibwB0AACgUSJpIm51cwAAoDgi7CF1cwCgFCLxInVhcmUAoKEiYgBsAGUAYgBhAHIAdwBlAGQAZwDlANcAbgCAAWFkaAClFqoWtBZyAHIAbwD3APUMbwB3AG4AYQByAHIAbwB3APMA8xVhI3Jwb29uAAABbHK8FsAWZQBmAPQAHBZpAGcAaAD0AB4WYgHJFs8WawBhAHIAbwD3AJILbwLUFgAAAADYFnIAbgAAoB8jbwBwAACgDCOAAWNvdADhFukW7BYAAXJ55RboFgDgNdi53FVkbAAAoPYp8iFvaxFhAAFkcvMW9xZvAHQAAKDxImkA5qC/JVsSAAFhaP8WAhdyAPIANQNhAPIA1wvhIm5nbGUAoKYpAAFjaQ4XEBd5AF9k5yJyYXJyAKD/JwAJRGFjZGVmZ2xtbm9wcXJzdHV4MRc4F0YXWxcyBF4XaRd5F40XrBe0F78X2RcVGCEYLRg1GEAYAAFEbzUXgRZvAPQA+BUAAWNzPBdCF3UAdABlADuA6QDpQPQhZXIAoG4qAAJhaW95TRdQF1YXWhfyIW9uG2FyAGOgViI7gOoA6kDsIW9uAKBVIk1kbwB0ABdhAAFEcmIXZhdvAHQAAKBSIgDgNdgi3XKhmipuF3QXYQB2AGUAO4DoAOhAZKCWKm8AdAAAoJgqgKGZKmlscwCAF4UXhxfuInRlcnMAoOcjAKATIWSglSpvAHQAAKCXKoABYXBzAJMXlheiF2MAcgATYXQAeQBzogUinxcAAAAAoRdlAHQAAKAFInAAMaADIDMBqRerFwCgBCAAoAUgAAFnc7AXsRdLYXAAAKACIAABZ3C4F7sXbwBuABlhZgAA4DXYVt2AAWFscwDFF8sXzxdyAHOg1SJsAACg4yl1AHMAAKBxKmkAAKG1A2x21RfYF28AbgC1Y/VjAAJjc3V24BfoF/0XEBgAAWlv5BdWF3IAYwAAoFYiaQLuFwAAAADwF+0ADQThIW50AAFnbPUX+Rd0AHIAAKCWKuUhc3MAoJUqgAFhZWkAAxgGGAoYbABzAD1gcwB0AACgXyJ2AESgYSJEAACgeCrwImFyc2wAoOUpAAFEYRkYHRhvAHQAAKBTInIAcgAAoHEpgAFjZGkAJxgqGO0XcgAAoC8hbwD0AIwCAAFhaDEYMhi3YzuA8ADwQAABbXI5GD0YbAA7gOsA60BvAACgrCCAAWNpcABGGEgYSxhsACFgcwD0ACwEAAFlb08YVxhjAHQAYQB0AGkAbwDuABoEbgBlAG4AdABpAGEAbADlADME4Ql1GAAAgRgAAIMYiBgAAAAAoRilGAAAqhgAALsYvhjRGAAA1xgnGWwAbABpAG4AZwBkAG8AdABzAGUA8QBlF3kARGRtImFsZQAAoEAmgAFpbHIAjRiRGJ0Y7CFpZwCgA/tpApcYAAAAAJoYZwAAoAD7aQBnAACgBPsA4DXYI93sIWlnAKAB++whaWcA4GYAagCAAWFsdACvGLIYthh0AACgbSZpAGcAAKAC+24AcwAAoLElbwBmAJJh8AHCGAAAxhhmAADgNdhX3QABYWvJGMwYbADsAGsEdqDUIgCg2SphI3J0aW50AACgDSoAAWFv2hgiGQABY3PeGB8ZsQPnGP0YBRkSGRUZAAAdGbID7xjyGPQY9xj5GAAA+xg7gL0AvUAAoFMhO4C8ALxAAKBVIQCgWSEAoFshswEBGQAAAxkAoFQhAKBWIbQCCxkOGQAAAAAQGTuAvgC+QACgVyEAoFwhNQAAoFghtgEZGQAAGxkAoFohAKBdITgAAKBeIWwAAKBEIHcAbgAAoCIjYwByAADgNdi73IAIRWFiY2RlZmdpamxub3JzdHYARhlKGVoZXhlmGWkZkhmWGZkZnRmgGa0ZxhnLGc8Z4BkjGmygZyIAoIwqgAFjbXAAUBlTGVgZ9SF0ZfVhbQBhAOSgswM6FgCghipyImV2ZQAfYQABaXliGWUZcgBjAB1hM2RvAHQAIWGAoWUibHFzAMYEcBl6GfGhZSLOBAAAdhlsAGEAbgD0AN8EgKF+KmNkbACBGYQZjBljAACgqSpvAHQAb6CAKmyggioAoIQqZeDbIgD+cwAAoJQqcgAA4DXYJN3noGsirATtIWVsAKA3IWMAeQBTZIChdyJFYWoApxmpGasZAKCSKgCgpSoAoKQqAAJFYWVztBm2Gb0ZwhkAoGkicABwoIoq8iFveACgiipxoIgq8aCIKrUZaQBtAACg5yJwAGYAAOA12FjdYQB2AOUAYwIAAWNp0xnWGXIAAKAKIW0AAKFzImVs3BneGQCgjioAoJAqAIM+ADtjZGxxco0E6xn0GfgZ/BkBGgABY2nvGfEZAKCnKnIAAKB6Km8AdAAAoNci0CFhcgCglSl1ImVzdAAAoHwqgAJhZGVscwAKGvQZFhrVBCAa8AEPGgAAFBpwAHIAbwD4AFkZcgAAoHgpcQAAAWxxxAQbGmwAZQBzAPMASRlpAO0A5AQAAWVuJxouGnIjdG5lcXEAAOBpIgD+xQAsGgAFQWFiY2Vma29zeUAaQxpmGmoabRqDGocalhrCGtMacgDyAMwCAAJpbG1yShpOGlAaVBpyAHMA8ABxD2YAvWBpAGwA9AASBQABZHJYGlsaYwB5AEpkAKGUIWN3YBpkGmkAcgAAoEgpAKCtIWEAcgAAoA8h6SFyYyVhgAFhbHIAcxp7Gn8a8iF0c3WgZSZpAHQAAKBlJuwhaXAAoCYg4yFvbgCguSJyAADgNdgl3XMAAAFld4wakRphInJvdwAAoCUpYSJyb3cAAKAmKYACYW1vcHIAnxqjGqcauhq+GnIAcgAAoP8h9CFodACgOyJrAAABbHKsGrMaZSRmdGFycm93AACgqSHpJGdodGFycm93AKCqIWYAAOA12Fnd4iFhcgCgFSCAAWNsdADIGswa0BpyAADgNdi93GEAcwDoAGka8iFvaydhAAFicNca2xr1IWxsAKBDIOghZW4AoBAg4Qr2GgAA/RoAAAgbExsaGwAAIRs7GwAAAAA+G2IbmRuVG6sbAACyG80b0htjAHUAdABlADuA7QDtQAChYyBpeQEbBhtyAGMAO4DuAO5AOGQAAWN4CxsNG3kANWRjAGwAO4ChAKFAAAFmcssCFhsA4DXYJt1yAGEAdgBlADuA7ADsQIChSCFpbm8AJxsyGzYbAAFpbisbLxtuAHQAAKAMKnQAAKAtIuYhaW4AoNwpdABhAACgKSHsIWlnM2GAAWFvcABDG1sbXhuAAWNndABJG0sbWRtyACthgAFlbHAAcQVRG1UbaQBuAOUAyAVhAHIA9AByBWgAMWFmAACgtyJlAGQAtWEAoggiY2ZvdGkbbRt1G3kb4SFyZQCgBSFpAG4AdKAeImkAZQAAoN0pZABvAPQAWxsAoisiY2VscIEbhRuPG5QbYQBsAACguiIAAWdyiRuNG2UAcgDzACMQ4wCCG2EicmhrAACgFyryIW9kAKA8KgACY2dwdJ8boRukG6gbeQBRZG8AbgAvYWYAAOA12FrdYQC5Y3UAZQBzAHQAO4C/AL9AAAFjabUbuRtyAADgNdi+3G4AAKIIIkVkc3bCG8QbyBvQAwCg+SJvAHQAAKD1Inag9CIAoPMiaaBiIOwhZGUpYesB1hsAANkbYwB5AFZkbAA7gO8A70AAA2NmbW9zdeYb7hvyG/Ub+hsFHAABaXnqG+0bcgBjADVhOWRyAADgNdgn3eEhdGg3YnAAZgAA4DXYW93jAf8bAAADHHIAAOA12L/c8iFjeVhk6yFjeVRkAARhY2ZnaGpvcxUcGhwiHCYcKhwtHDAcNRzwIXBhdqC6A/BjAAFleR4cIRzkIWlsN2E6ZHIAAOA12CjdciJlZW4AOGFjAHkARWRjAHkAXGRwAGYAAOA12FzdYwByAADgNdjA3IALQUJFSGFiY2RlZmdoamxtbm9wcnN0dXYAXhxtHHEcdRx5HN8cBx0dHTwd3B3tHfEdAR4EHh0eLB5FHrwewx7hHgkfPR9LH4ABYXJ0AGQcZxxpHHIA8gBvB/IAxQLhIWlsAKAbKeEhcnIAoA4pZ6BmIgCgiyphAHIAAKBiKWMJjRwAAJAcAACVHAAAAAAAAAAAAACZHJwcAACmHKgcrRwAANIc9SF0ZTph7SJwdHl2AKC0KXIAYQDuAFoG4iFkYbtjZwAAoegnZGyhHKMcAKCRKeUAiwYAoIUqdQBvADuAqwCrQHIAgKOQIWJmaGxwc3QAuhy/HMIcxBzHHMoczhxmoOQhcwAAoB8pcwAAoB0p6wCyGnAAAKCrIWwAAKA5KWkAbQAAoHMpbAAAoKIhAKGrKmFl1hzaHGkAbAAAoBkpc6CtKgDgrSoA/oABYWJyAOUc6RztHHIAcgAAoAwpcgBrAACgcicAAWFr8Rz4HGMAAAFla/Yc9xx7YFtgAAFlc/wc/hwAoIspbAAAAWR1Ax0FHQCgjykAoI0pAAJhZXV5Dh0RHRodHB3yIW9uPmEAAWRpFR0YHWkAbAA8YewAowbiAPccO2QAAmNxcnMkHScdLB05HWEAAKA2KXUAbwDyoBwgqhEAAWR1MB00HeghYXIAoGcpcyJoYXIAAKBLKWgAAKCyIQCiZCJmZ3FzRB1FB5Qdnh10AIACYWhscnQATh1WHWUdbB2NHXIicm93AHSgkCFhAOkAzxxhI3Jwb29uAAABZHVeHWId7yF3bgCgvSFwAACgvCHlJGZ0YXJyb3dzAKDHIWkiZ2h0AIABYWhzAHUdex2DHXIicm93APOglCGdBmEAcgBwAG8AbwBuAPMAzgtxAHUAaQBnAGEAcgByAG8A9wBlGugkcmVldGltZXMAoMsi8aFkIk0HAACaHWwAYQBuAPQAXgcAon0qY2Rnc6YdqR2xHbcdYwAAoKgqbwB0AG+gfypyoIEqAKCDKmXg2iIA/nMAAKCTKoACYWRlZ3MAwB3GHcod1h3ZHXAAcAByAG8A+ACmHG8AdAAAoNYicQAAAWdxzx3SHXQA8gBGB2cAdADyAHQcdADyAFMHaQDtAGMHgAFpbHIA4h3mHeod8yFodACgfClvAG8A8gDKBgDgNdgp3UWgdiIAoJEqYQH1Hf4dcgAAAWR1YB35HWygvCEAoGopbABrAACghCVjAHkAWWQAomoiYWNodAweDx4VHhkecgDyAGsdbwByAG4AZQDyAGAW4SFyZACgaylyAGkAAKD6JQABaW8hHiQe5CFvdEBh9SFzdGGgsCPjIWhlAKCwIwACRWFlczMeNR48HkEeAKBoInAAcKCJKvIhb3gAoIkqcaCHKvGghyo0HmkAbQAAoOYiAARhYm5vcHR3elIeXB5fHoUelh6mHqsetB4AAW5yVh5ZHmcAAKDsJ3IAAKD9IXIA6wCwBmcAgAFsbXIAZh52Hnse5SFmdAABYXKIB2weaQBnAGgAdABhAHIAcgBvAPcAkwfhInBzdG8AoPwnaQBnAGgAdABhAHIAcgBvAPcAmgdwI2Fycm93AAABbHKNHpEeZQBmAPQAxhxpImdodAAAoKwhgAFhZmwAnB6fHqIecgAAoIUpAOA12F3ddQBzAACgLSppIm1lcwAAoDQqYQGvHrMecwB0AACgFyLhAIoOZaHKJbkeRhLuIWdlAKDKJWEAcgBsoCgAdAAAoJMpgAJhY2htdADMHs8e1R7bHt0ecgDyAJ0GbwByAG4AZQDyANYWYQByAGSgyyEAoG0pAKAOIHIAaQAAoL8iAANhY2hpcXTrHu8e1QfzHv0eBh/xIXVvAKA5IHIAAOA12MHcbQDloXIi+h4AAPweAKCNKgCgjyoAAWJ19xwBH28AcqAYIACgGiDyIW9rQmEAhDwAO2NkaGlscXJCBhcfxh0gHyQfKB8sHzEfAAFjaRsfHR8AoKYqcgAAoHkqcgBlAOUAkx3tIWVzAKDJIuEhcnIAoHYpdSJlc3QAAKB7KgABUGk1HzkfYQByAACglillocMlAgdfEnIAAAFkdUIfRx9zImhhcgAAoEop6CFhcgCgZikAAWVuTx9WH3IjdG5lcXEAAOBoIgD+xQBUHwAHRGFjZGVmaGlsbm9wc3VuH3Ifoh+rH68ftx+7H74f5h/uH/MfBwj/HwsgxCFvdACgOiIAAmNscHJ5H30fiR+eH3IAO4CvAK9AAAFldIEfgx8AoEImZaAgJ3MAZQAAoCAnc6CmIXQAbwCAoaYhZGx1AJQfmB+cH28AdwDuAHkDZQBmAPQA6gbwAOkO6yFlcgCgriUAAW95ph+qH+0hbWEAoCkqPGThIXNoAKAUIOElc3VyZWRhbmdsZQCgISJyAADgNdgq3W8AAKAnIYABY2RuAMQfyR/bH3IAbwA7gLUAtUBhoiMi0B8AANMf1x9zAPQAKxFpAHIAAKDwKm8AdAA7gLcAt0B1AHMA4qESIh4TAADjH3WgOCIAoCoqYwHqH+0fcAAAoNsq8gB+GnAAbAB1APMACAgAAWRw9x/7H+UhbHMAoKciZgAA4DXYXt0AAWN0AyAHIHIAAOA12MLc8CFvcwCgPiJsobwDECAVIPQiaW1hcACguCJhAPAAEyAADEdMUlZhYmNkZWZnaGlqbG1vcHJzdHV2dzwgRyBmIG0geSCqILgg2iDeIBEhFSEyIUMhTSFQIZwhnyHSIQAiIyKLIrEivyIUIwABZ3RAIEMgAODZIjgD9uBrItIgBwmAAWVsdABNIF8gYiBmAHQAAAFhclMgWCByInJvdwAAoM0h6SRnaHRhcnJvdwCgziEA4NgiOAP24Goi0iBfCekkZ2h0YXJyb3cAoM8hAAFEZHEgdSDhIXNoAKCvIuEhc2gAoK4igAJiY25wdACCIIYgiSCNIKIgbABhAACgByL1IXRlRGFnAADgICLSIACiSSJFaW9wlSCYIJwgniAA4HAqOANkAADgSyI4A3MASWFyAG8A+AAyCnUAcgBhoG4mbADzoG4mmwjzAa8gAACzIHAAO4CgAKBAbQBwAOXgTiI4AyoJgAJhZW91eQDBIMogzSDWINkg8AHGIAAAyCAAoEMqbwBuAEhh5CFpbEZhbgBnAGSgRyJvAHQAAOBtKjgDcAAAoEIqPWThIXNoAKATIACjYCJBYWRxc3jpIO0g+SD+IAIhDCFyAHIAAKDXIXIAAAFocvIg9SBrAACgJClvoJch9wAGD28AdAAA4FAiOAN1AGkA9gC7CAABZWkGIQohYQByAACgKCntAN8I6SFzdPOgBCLlCHIAAOA12CvdAAJFZXN0/wgcISshLiHxoXEiIiEAABMJ8aFxIgAJAAAnIWwAYQBuAPQAEwlpAO0AGQlyoG8iAKBvIoABQWFwADghOyE/IXIA8gBeIHIAcgAAoK4hYQByAACg8ipzogsiSiEAAAAAxwtkoPwiAKD6ImMAeQBaZIADQUVhZGVzdABcIV8hYiFmIWkhkyGWIXIA8gBXIADgZiI4A3IAcgAAoJohcgAAoCUggKFwImZxcwBwIYQhjiF0AAABYXJ1IXohcgByAG8A9wBlIWkAZwBoAHQAYQByAHIAbwD3AD4h8aFwImAhAACKIWwAYQBuAPQAZwlz4H0qOAMAoG4iaQDtAG0JcqBuImkA5aDqIkUJaQDkADoKAAFwdKMhpyFmAADgNdhf3YCBrAA7aW4AriGvIcchrEBuAIChCSJFZHYAtyG6Ib8hAOD5IjgDbwB0AADg9SI4A+EB1gjEIcYhAKD3IgCg9iJpAHagDCLhAagJzyHRIQCg/iIAoP0igAFhb3IA2CHsIfEhcgCAoSYiYXN0AOAh5SHpIWwAbABlAOwAywhsAADg/SrlIADgAiI4A2wiaW50AACgFCrjoYAi9yEAAPohdQDlAJsJY+CvKjgDZaCAIvEAkwkAAkFhaXQHIgoiFyIeInIA8gBsIHIAcgAAoZshY3cRIhQiAOAzKTgDAOCdITgDZyRodGFycm93AACgmyFyAGkA5aDrIr4JgANjaGltcHF1AC8iPCJHIpwhTSJQIloigKGBImNlcgA2Iv0JOSJ1AOUABgoA4DXYw9zvIXJ0bQKdIQAAAABEImEAcgDhAOEhbQBloEEi8aBEIiYKYQDyAMsIcwB1AAABYnBWIlgi5QDUCeUA3wmAAWJjcABgInMieCKAoYQiRWVzAGci7glqIgDgxSo4A2UAdABl4IIi0iBxAPGgiCJoImMAZaCBIvEA/gmAoYUiRWVzAH8iFgqCIgDgxio4A2UAdABl4IMi0iBxAPGgiSKAIgACZ2lscpIilCKaIpwi7AAMCWwAZABlADuA8QDxQOcAWwlpI2FuZ2xlAAABbHKkIqoi5SFmdGWg6iLxAEUJaSJnaHQAZaDrIvEAvgltoL0DAKEjAGVzuCK8InIAbwAAoBYhcAAAoAcggARESGFkZ2lscnMAziLSItYi2iLeIugi7SICIw8j4SFzaACgrSLhIXJyAKAEKXAAAOBNItIg4SFzaACgrCIAAWV04iLlIgDgZSLSIADgPgDSIG4iZmluAACg3imAAUFldADzIvci+iJyAHIAAKACKQDgZCLSIHLgPADSIGkAZQAA4LQi0iAAAUF0BiMKI3IAcgAAoAMp8iFpZQDgtSLSIGkAbQAA4Dwi0iCAAUFhbgAaIx4jKiNyAHIAAKDWIXIAAAFociMjJiNrAACgIylvoJYh9wD/DuUhYXIAoCcpUxJqFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVCMAAF4jaSN/I4IjjSOeI8AUAAAAAKYjwCMAANoj3yMAAO8jHiQvJD8kRCQAAWNzVyNsFHUAdABlADuA8wDzQAABaXlhI2cjcgBjoJoiO4D0APRAPmSAAmFiaW9zAHEjdCN3I3EBeiNzAOgAdhTsIWFjUWF2AACgOCrvIWxkAKC8KewhaWdTYQABY3KFI4kjaQByAACgvykA4DXYLN1vA5QjAAAAAJYjAACcI24A22JhAHYAZQA7gPIA8kAAoMEpAAFibaEjjAphAHIAAKC1KQACYWNpdKwjryO6I70jcgDyAFkUAAFpcrMjtiNyAACgvinvIXNzAKC7KW4A5QDZCgCgwCmAAWFlaQDFI8gjyyNjAHIATWFnAGEAyWOAAWNkbgDRI9Qj1iPyIW9uv2MAoLYpdQDzAHgBcABmAADgNdhg3YABYWVsAOQj5yPrI3IAAKC3KXIAcAAAoLkpdQDzAHwBAKMoImFkaW9zdvkj/CMPJBMkFiQbJHIA8gBeFIChXSplZm0AAyQJJAwkcgBvoDQhZgAAoDQhO4CqAKpAO4C6ALpA5yFvZgCgtiJyAACgVipsIm9wZQAAoFcqAKBbKoABY2xvACMkJSQrJPIACCRhAHMAaAA7gPgA+EBsAACgmCJpAGwBMyQ4JGQAZQA7gPUA9UBlAHMAYaCXInMAAKA2Km0AbAA7gPYA9kDiIWFyAKA9I+EKXiQAAHokAAB8JJQkAACYJKkkAAAAALUkEQsAAPAkAAAAAAQleiUAAIMlcgCAoSUiYXN0AGUkbyQBCwCBtgA7bGokayS2QGwAZQDsABgDaQJ1JAAAAAB4JG0AAKDzKgCg/Sp5AD9kcgCAAmNpbXB0AIUkiCSLJJkSjyRuAHQAJWBvAGQALmBpAGwAAKAwIOUhbmsAoDEgcgAA4DXYLd2AAWltbwCdJKAkpCR2oMYD1WNtAGEA9AD+B24AZQAAoA4m9KHAA64kAAC0JGMjaGZvcmsAAKDUItZjAAFhdbgkxCRuAAABY2u9JMIkawBooA8hAKAOIfYAaRpzAACkKwBhYmNkZW1zdNMkIRPXJNsk4STjJOck6yTjIWlyAKAjKmkAcgAAoCIqAAFvdYsW3yQAoCUqAKByKm4AO4CxALFAaQBtAACgJip3AG8AAKAnKoABaXB1APUk+iT+JO4idGludACgFSpmAADgNdhh3W4AZAA7gKMAo0CApHoiRWFjZWlub3N1ABMlFSUYJRslTCVRJVklSSV1JQCgsypwAACgtyp1AOUAPwtjoK8qgKJ6ImFjZW5zACclLSU0JTYlSSVwAHAAcgBvAPgAFyV1AHIAbAB5AGUA8QA/C/EAOAuAAWFlcwA8JUElRSXwInByb3gAoLkqcQBxAACgtSppAG0AAKDoImkA7QBEC20AZQDzoDIgIguAAUVhcwBDJVclRSXwAEAlgAFkZnAATwtfJXElgAFhbHMAZSVpJW0l7CFhcgCgLiPpIW5lAKASI/UhcmYAoBMjdKAdIu8AWQvyIWVsAKCwIgABY2l9JYElcgAA4DXYxdzIY24iY3NwAACgCCAAA2Zpb3BzdZElKxuVJZolnyWkJXIAAOA12C7dcABmAADgNdhi3XIiaW1lAACgVyBjAHIAAOA12MbcgAFhZW8AqiW6JcAldAAAAWVpryW2JXIAbgBpAG8AbgDzABkFbgB0AACgFipzAHQAZaA/APEACRj0AG0LgApBQkhhYmNkZWZoaWxtbm9wcnN0dXgA4yXyJfYl+iVpJpAmpia9JtUm5ib4JlonaCdxJ3UnnietJ7EnyCfiJ+cngAFhcnQA6SXsJe4lcgDyAJkM8gD6AuEhaWwAoBwpYQByAPIA3BVhAHIAAKBkKYADY2RlbnFydAAGJhAmEyYYJiYmKyZaJgABZXUKJg0mAOA9IjEDdABlAFVhaQDjACAN7SJwdHl2AKCzKWcAgKHpJ2RlbAAgJiImJCYAoJIpAKClKeUA9wt1AG8AO4C7ALtAcgAApZIhYWJjZmhscHN0dz0mQCZFJkcmSiZMJk4mUSZVJlgmcAAAoHUpZqDlIXMAAKAgKQCgMylzAACgHinrALka8ACVHmwAAKBFKWkAbQAAoHQpbAAAoKMhAKCdIQABYWleJmImaQBsAACgGilvAG6gNiJhAGwA8wB2C4ABYWJyAG8mciZ2JnIA8gAvEnIAawAAoHMnAAFha3omgSZjAAABZWt/JoAmfWBdYAABZXOFJocmAKCMKWwAAAFkdYwmjiYAoI4pAKCQKQACYWV1eZcmmiajJqUm8iFvbllhAAFkaZ4moSZpAGwAV2HsAA8M4gCAJkBkAAJjbHFzrSawJrUmuiZhAACgNylkImhhcgAAoGkpdQBvAPKgHSCjAWgAAKCzIYABYWNnAMMm0iaUC2wAgKEcIWlwcwDLJs4migxuAOUAoAxhAHIA9ADaC3QAAKCtJYABaWxyANsm3ybjJvMhaHQAoH0pbwBvAPIANgwA4DXYL90AAWFv6ib1JnIAAAFkde8m8SYAoMEhbKDAIQCgbCl2oMED8WOAAWducwD+Jk4nUCdoAHQAAANhaGxyc3QKJxInISc1Jz0nRydyInJvdwB0oJIhYQDpAFYmYSNycG9vbgAAAWR1GiceJ28AdwDuAPAmcAAAoMAh5SFmdAABYWgnJy0ncgByAG8AdwDzAAkMYQByAHAAbwBvAG4A8wATBGklZ2h0YXJyb3dzAACgySFxAHUAaQBnAGEAcgByAG8A9wBZJugkcmVldGltZXMAoMwiZwDaYmkAbgBnAGQAbwB0AHMAZQDxABwYgAFhaG0AYCdjJ2YncgDyAAkMYQDyABMEAKAPIG8idXN0AGGgsSPjIWhlAKCxI+0haWQAoO4qAAJhYnB0fCeGJ4knmScAAW5ygCeDJ2cAAKDtJ3IAAKD+IXIA6wAcDIABYWZsAI8nkieVJ3IAAKCGKQDgNdhj3XUAcwAAoC4qaSJtZXMAAKA1KgABYXCiJ6gncgBnoCkAdAAAoJQp7yJsaW50AKASKmEAcgDyADwnAAJhY2hxuCe8J6EMwCfxIXVvAKA6IHIAAOA12MfcAAFidYAmxCdvAPKgGSCoAYABaGlyAM4n0ifWJ3IAZQDlAE0n7SFlcwCgyiJpAIChuSVlZmwAXAxjEt4n9CFyaQCgzinsInVoYXIAoGgpAKAeIWENBSgJKA0oSyhVKIYoAACLKLAoAAAAAOMo5ygAABApJCkxKW0pcSmHKaYpAACYKgAAAACxKmMidXRlAFthcQB1AO8ABR+ApHsiRWFjZWlucHN5ABwoHignKCooLygyKEEoRihJKACgtCrwASMoAAAlKACguCpvAG4AYWF1AOUAgw1koLAqaQBsAF9hcgBjAF1hgAFFYXMAOCg6KD0oAKC2KnAAAKC6KmkAbQAAoOki7yJsaW50AKATKmkA7QCIDUFkbwB0AGKixSKRFgAAAABTKACgZiqAA0FhY21zdHgAYChkKG8ocyh1KHkogihyAHIAAKDYIXIAAAFocmkoayjrAJAab6CYIfcAzAd0ADuApwCnQGkAO2D3IWFyAKApKW0AAAFpbn4ozQBuAHUA8wDOAHQAAKA2J3IA7+A12DDdIxkAAmFjb3mRKJUonSisKHIAcAAAoG8mAAFoeZkonChjAHkASWRIZHIAdABtAqUoAAAAAKgoaQDkAFsPYQByAGEA7ABsJDuArQCtQAABZ22zKLsobQBhAAChwwNmdroouijCY4CjPCJkZWdsbnByAMgozCjPKNMo1yjaKN4obwB0AACgairxoEMiCw5FoJ4qAKCgKkWgnSoAoJ8qZQAAoEYi7CF1cwCgJCrhIXJyAKByKWEAcgDyAPwMAAJhZWl07Sj8KAEpCCkAAWxz8Sj4KGwAcwBlAHQAbQDpAH8oaABwAACgMyrwImFyc2wAoOQpAAFkbFoPBSllAACgIyNloKoqc6CsKgDgrCoA/oABZmxwABUpGCkfKfQhY3lMZGKgLwBhoMQpcgAAoD8jZgAA4DXYZN1hAAABZHIoKRcDZQBzAHWgYCZpAHQAAKBgJoABY3N1ADYpRilhKQABYXU6KUApcABzoJMiAOCTIgD+cABzoJQiAOCUIgD+dQAAAWJwSylWKQChjyJlcz4NUCllAHQAZaCPIvEAPw0AoZAiZXNIDVspZQB0AGWgkCLxAEkNAKGhJWFmZilbBHIAZQFrKVwEAKChJWEAcgDyAAMNAAJjZW10dyl7KX8pgilyAADgNdjI3HQAbQDuAM4AaQDsAAYpYQByAOYAVw0AAWFyiimOKXIA5qAGJhESAAFhbpIpoylpImdodAAAAWVwmSmgKXAAcwBpAGwAbwDuANkXaADpAKAkcwCvYIACYmNtbnAArin8KY4NJSooKgCkgiJFZGVtbnByc7wpvinCKcgpzCnUKdgp3CkAoMUqbwB0AACgvSpkoIYibwB0AACgwyr1IWx0AKDBKgABRWXQKdIpAKDLKgCgiiLsIXVzAKC/KuEhcnIAoHkpgAFlaXUA4inxKfQpdAAAoYIiZW7oKewpcQDxoIYivSllAHEA8aCKItEpbQAAoMcqAAFicPgp+ikAoNUqAKDTKmMAgKJ7ImFjZW5zAAcqDSoUKhYqRihwAHAAcgBvAPgAIyh1AHIAbAB5AGUA8QCDDfEAfA2AAWFlcwAcKiIqPShwAHAAcgBvAPgAPChxAPEAOShnAACgaiYApoMiMTIzRWRlaGxtbnBzPCo/KkIqRSpHKlIqWCpjKmcqaypzKncqO4C5ALlAO4CyALJAO4CzALNAAKDGKgABb3NLKk4qdAAAoL4qdQBiAACg2CpkoIcibwB0AACgxCpzAAABb3VdKmAqbAAAoMknYgAAoNcq4SFycgCgeyn1IWx0AKDCKgABRWVvKnEqAKDMKgCgiyLsIXVzAKDAKoABZWl1AH0qjCqPKnQAAKGDImVugyqHKnEA8aCHIkYqZQBxAPGgiyJwKm0AAKDIKgABYnCTKpUqAKDUKgCg1iqAAUFhbgCdKqEqrCpyAHIAAKDZIXIAAAFocqYqqCrrAJUab6CZIfcAxQf3IWFyAKAqKWwAaQBnADuA3wDfQOELzyrZKtwq6SrsKvEqAAD1KjQrAAAAAAAAAAAAAEwrbCsAAHErvSsAAAAAAADRK3IC1CoAAAAA2CrnIWV0AKAWI8RjcgDrAOUKgAFhZXkA4SrkKucq8iFvbmVh5CFpbGNhQmRvAPQAIg5sInJlYwAAoBUjcgAA4DXYMd0AAmVpa2/7KhIrKCsuK/IBACsAAAkrZQAAATRm6g0EK28AcgDlAOsNYQBzorgDECsAAAAAEit5AG0A0WMAAWNuFislK2sAAAFhcxsrIStwAHAAcgBvAPgAFw5pAG0AAKA8InMA8AD9DQABYXMsKyEr8AAXDnIAbgA7gP4A/kDsATgrOyswG2QA5QBnAmUAcwCAgdcAO2JkAEMrRCtJK9dAYaCgInIAAKAxKgCgMCqAAWVwcwBRK1MraSvhAAkh4qKkIlsrXysAAAAAYytvAHQAAKA2I2kAcgAAoPEqb+A12GXdcgBrAACg2irhAHgociJpbWUAAKA0IIABYWlwAHYreSu3K2QA5QC+DYADYWRlbXBzdACFK6MrmiunK6wrsCuzK24iZ2xlAACitSVkbHFykCuUK5ornCvvIXduAKC/JeUhZnRloMMl8QACBwCgXCJpImdodABloLkl8QBdDG8AdAAAoOwlaSJudXMAAKA6KuwhdXMAoDkqYgAAoM0p6SFtZQCgOyrlInppdW0AoOIjgAFjaHQAwivKK80rAAFyecYrySsA4DXYydxGZGMAeQBbZPIhb2tnYQABaW/UK9creAD0ANERaCJlYWQAAAFsct4r5ytlAGYAdABhAHIAcgBvAPcAXQbpJGdodGFycm93AKCgIQAJQUhhYmNkZmdobG1vcHJzdHV3CiwNLBEsHSwnLDEsQCxLLFIsYix6LIQsjyzLLOgs7Sz/LAotcgDyAAkDYQByAACgYykAAWNyFSwbLHUAdABlADuA+gD6QPIACQ1yAOMBIywAACUseQBeZHYAZQBtYQABaXkrLDAscgBjADuA+wD7QENkgAFhYmgANyw6LD0scgDyANEO7CFhY3FhYQDyAOAOAAFpckQsSCzzIWh0AKB+KQDgNdgy3XIAYQB2AGUAO4D5APlAYQFWLF8scgAAAWxyWixcLACgvyEAoL4hbABrAACggCUAAWN0Zix2LG8CbCwAAAAAcyxyAG4AZaAcI3IAAKAcI28AcAAAoA8jcgBpAACg+CUAAWFsfiyBLGMAcgBrYTuAqACoQAABZ3CILIssbwBuAHNhZgAA4DXYZt0AA2FkaGxzdZksniynLLgsuyzFLHIAcgBvAPcACQ1vAHcAbgBhAHIAcgBvAPcA2A5hI3Jwb29uAAABbHKvLLMsZQBmAPQAWyxpAGcAaAD0AF0sdQDzAKYOaQAAocUDaGzBLMIs0mNvAG4AxWPwI2Fycm93cwCgyCGAAWNpdADRLOEs5CxvAtcsAAAAAN4scgBuAGWgHSNyAACgHSNvAHAAAKAOI24AZwBvYXIAaQAAoPklYwByAADgNdjK3IABZGlyAPMs9yz6LG8AdAAAoPAi7CFkZWlhaQBmoLUlAKC0JQABYW0DLQYtcgDyAMosbAA7gPwA/EDhIm5nbGUAoKcpgAdBQkRhY2RlZmxub3Byc3oAJy0qLTAtNC2bLZ0toS2/LcMtxy3TLdgt3C3gLfwtcgDyABADYQByAHag6CoAoOkqYQBzAOgA/gIAAW5yOC08LechcnQAoJwpgANla25wcnN0AJkpSC1NLVQtXi1iLYItYQBwAHAA4QAaHG8AdABoAGkAbgDnAKEXgAFoaXIAoSmzJFotbwBwAPQAdCVooJUh7wD4JgABaXVmLWotZwBtAOEAuygAAWJwbi14LXMjZXRuZXEAceCKIgD+AODLKgD+cyNldG5lcQBx4IsiAP4A4MwqAP4AAWhyhi2KLWUAdADhABIraSNhbmdsZQAAAWxyki2WLeUhZnQAoLIiaSJnaHQAAKCzInkAMmThIXNoAKCiIoABZWxyAKcttC24LWKiKCKuLQAAAACyLWEAcgAAoLsicQAAoFoi7CFpcACg7iIAAWJ0vC1eD2EA8gBfD3IAAOA12DPddAByAOkAlS1zAHUAAAFicM0t0C0A4IIi0iAA4IMi0iBwAGYAAOA12GfdcgBvAPAAWQt0AHIA6QCaLQABY3XkLegtcgAA4DXYy9wAAWJw7C30LW4AAAFFZXUt8S0A4IoiAP5uAAABRWV/LfktAOCLIgD+6SJnemFnAKCaKYADY2Vmb3BycwANLhAuJS4pLiMuLi40LukhcmN1YQABZGkULiEuAAFiZxguHC5hAHIAAKBfKmUAcaAnIgCgWSLlIXJwAKAYIXIAAOA12DTdcABmAADgNdho3WWgQCJhAHQA6ABqD2MAcgAA4DXYzNzjCuQRUC4AAFQuAABYLmIuAAAAAGMubS5wLnQuAAAAAIguki4AAJouJxIqEnQAcgDpAB0ScgAA4DXYNd0AAUFhWy5eLnIA8gDnAnIA8gCTB75jAAFBYWYuaS5yAPIA4AJyAPIAjAdhAPAAeh5pAHMAAKD7IoABZHB0APgReS6DLgABZmx9LoAuAOA12GnddQDzAP8RaQBtAOUABBIAAUFhiy6OLnIA8gDuAnIA8gCaBwABY3GVLgoScgAA4DXYzdwAAXB0nS6hLmwAdQDzACUScgDpACASAARhY2VmaW9zdbEuvC7ELsguzC7PLtQu2S5jAAABdXm2LrsudABlADuA/QD9QE9kAAFpecAuwy5yAGMAd2FLZG4AO4ClAKVAcgAA4DXYNt1jAHkAV2RwAGYAAOA12GrdYwByAADgNdjO3AABY23dLt8ueQBOZGwAO4D/AP9AAAVhY2RlZmhpb3N38y73Lv8uAi8MLxAvEy8YLx0vIi9jInV0ZQB6YQABYXn7Lv4u8iFvbn5hN2RvAHQAfGEAAWV0Bi8KL3QAcgDmAB8QYQC2Y3IAAOA12DfdYwB5ADZk5yJyYXJyAKDdIXAAZgAA4DXYa91jAHIAAOA12M/cAAFqbiYvKC8AoA0gagAAoAwg");

// node_modules/markdown-exit/node_modules/entities/dist/esm/internal/bin-trie-flags.js
var BinTrieFlags;
(function(BinTrieFlags) {
  BinTrieFlags[BinTrieFlags["VALUE_LENGTH"] = 49152] = "VALUE_LENGTH";
  BinTrieFlags[BinTrieFlags["FLAG13"] = 8192] = "FLAG13";
  BinTrieFlags[BinTrieFlags["BRANCH_LENGTH"] = 8064] = "BRANCH_LENGTH";
  BinTrieFlags[BinTrieFlags["JUMP_TABLE"] = 127] = "JUMP_TABLE";
})(BinTrieFlags || (BinTrieFlags = {}));

// node_modules/markdown-exit/node_modules/entities/dist/esm/decode.js
var CharCodes;
(function(CharCodes) {
  CharCodes[CharCodes["NUM"] = 35] = "NUM";
  CharCodes[CharCodes["SEMI"] = 59] = "SEMI";
  CharCodes[CharCodes["EQUALS"] = 61] = "EQUALS";
  CharCodes[CharCodes["ZERO"] = 48] = "ZERO";
  CharCodes[CharCodes["NINE"] = 57] = "NINE";
  CharCodes[CharCodes["LOWER_A"] = 97] = "LOWER_A";
  CharCodes[CharCodes["LOWER_F"] = 102] = "LOWER_F";
  CharCodes[CharCodes["LOWER_X"] = 120] = "LOWER_X";
  CharCodes[CharCodes["LOWER_Z"] = 122] = "LOWER_Z";
  CharCodes[CharCodes["UPPER_A"] = 65] = "UPPER_A";
  CharCodes[CharCodes["UPPER_F"] = 70] = "UPPER_F";
  CharCodes[CharCodes["UPPER_Z"] = 90] = "UPPER_Z";
})(CharCodes || (CharCodes = {}));
var TO_LOWER_BIT = 32;
function isNumber(code) {
  return code >= CharCodes.ZERO && code <= CharCodes.NINE;
}
function isHexadecimalCharacter(code) {
  return code >= CharCodes.UPPER_A && code <= CharCodes.UPPER_F || code >= CharCodes.LOWER_A && code <= CharCodes.LOWER_F;
}
function isAsciiAlphaNumeric(code) {
  return code >= CharCodes.UPPER_A && code <= CharCodes.UPPER_Z || code >= CharCodes.LOWER_A && code <= CharCodes.LOWER_Z || isNumber(code);
}
function isEntityInAttributeInvalidEnd(code) {
  return code === CharCodes.EQUALS || isAsciiAlphaNumeric(code);
}
var EntityDecoderState;
(function(EntityDecoderState) {
  EntityDecoderState[EntityDecoderState["EntityStart"] = 0] = "EntityStart";
  EntityDecoderState[EntityDecoderState["NumericStart"] = 1] = "NumericStart";
  EntityDecoderState[EntityDecoderState["NumericDecimal"] = 2] = "NumericDecimal";
  EntityDecoderState[EntityDecoderState["NumericHex"] = 3] = "NumericHex";
  EntityDecoderState[EntityDecoderState["NamedEntity"] = 4] = "NamedEntity";
})(EntityDecoderState || (EntityDecoderState = {}));
var DecodingMode;
(function(DecodingMode) {
  DecodingMode[DecodingMode["Legacy"] = 0] = "Legacy";
  DecodingMode[DecodingMode["Strict"] = 1] = "Strict";
  DecodingMode[DecodingMode["Attribute"] = 2] = "Attribute";
})(DecodingMode || (DecodingMode = {}));

class EntityDecoder {
  constructor(decodeTree, emitCodePoint, errors) {
    this.decodeTree = decodeTree;
    this.emitCodePoint = emitCodePoint;
    this.errors = errors;
    this.state = EntityDecoderState.EntityStart;
    this.consumed = 1;
    this.result = 0;
    this.treeIndex = 0;
    this.excess = 1;
    this.decodeMode = DecodingMode.Strict;
    this.runConsumed = 0;
  }
  startEntity(decodeMode) {
    this.decodeMode = decodeMode;
    this.state = EntityDecoderState.EntityStart;
    this.result = 0;
    this.treeIndex = 0;
    this.excess = 1;
    this.consumed = 1;
    this.runConsumed = 0;
  }
  write(input, offset) {
    switch (this.state) {
      case EntityDecoderState.EntityStart: {
        if (input.charCodeAt(offset) === CharCodes.NUM) {
          this.state = EntityDecoderState.NumericStart;
          this.consumed += 1;
          return this.stateNumericStart(input, offset + 1);
        }
        this.state = EntityDecoderState.NamedEntity;
        return this.stateNamedEntity(input, offset);
      }
      case EntityDecoderState.NumericStart: {
        return this.stateNumericStart(input, offset);
      }
      case EntityDecoderState.NumericDecimal: {
        return this.stateNumericDecimal(input, offset);
      }
      case EntityDecoderState.NumericHex: {
        return this.stateNumericHex(input, offset);
      }
      case EntityDecoderState.NamedEntity: {
        return this.stateNamedEntity(input, offset);
      }
    }
  }
  stateNumericStart(input, offset) {
    if (offset >= input.length) {
      return -1;
    }
    if ((input.charCodeAt(offset) | TO_LOWER_BIT) === CharCodes.LOWER_X) {
      this.state = EntityDecoderState.NumericHex;
      this.consumed += 1;
      return this.stateNumericHex(input, offset + 1);
    }
    this.state = EntityDecoderState.NumericDecimal;
    return this.stateNumericDecimal(input, offset);
  }
  stateNumericHex(input, offset) {
    while (offset < input.length) {
      const char = input.charCodeAt(offset);
      if (isNumber(char) || isHexadecimalCharacter(char)) {
        const digit = char <= CharCodes.NINE ? char - CharCodes.ZERO : (char | TO_LOWER_BIT) - CharCodes.LOWER_A + 10;
        this.result = this.result * 16 + digit;
        this.consumed++;
        offset++;
      } else {
        return this.emitNumericEntity(char, 3);
      }
    }
    return -1;
  }
  stateNumericDecimal(input, offset) {
    while (offset < input.length) {
      const char = input.charCodeAt(offset);
      if (isNumber(char)) {
        this.result = this.result * 10 + (char - CharCodes.ZERO);
        this.consumed++;
        offset++;
      } else {
        return this.emitNumericEntity(char, 2);
      }
    }
    return -1;
  }
  emitNumericEntity(lastCp, expectedLength) {
    var _a;
    if (this.consumed <= expectedLength) {
      (_a = this.errors) === null || _a === undefined || _a.absenceOfDigitsInNumericCharacterReference(this.consumed);
      return 0;
    }
    if (lastCp === CharCodes.SEMI) {
      this.consumed += 1;
    } else if (this.decodeMode === DecodingMode.Strict) {
      return 0;
    }
    this.emitCodePoint(replaceCodePoint(this.result), this.consumed);
    if (this.errors) {
      if (lastCp !== CharCodes.SEMI) {
        this.errors.missingSemicolonAfterCharacterReference();
      }
      this.errors.validateNumericCharacterReference(this.result);
    }
    return this.consumed;
  }
  stateNamedEntity(input, offset) {
    const { decodeTree } = this;
    let current = decodeTree[this.treeIndex];
    let valueLength = (current & BinTrieFlags.VALUE_LENGTH) >> 14;
    while (offset < input.length) {
      if (valueLength === 0 && (current & BinTrieFlags.FLAG13) !== 0) {
        const runLength = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
        if (this.runConsumed === 0) {
          const firstChar = current & BinTrieFlags.JUMP_TABLE;
          if (input.charCodeAt(offset) !== firstChar) {
            return this.result === 0 ? 0 : this.emitNotTerminatedNamedEntity();
          }
          offset++;
          this.excess++;
          this.runConsumed++;
        }
        while (this.runConsumed < runLength) {
          if (offset >= input.length) {
            return -1;
          }
          const charIndexInPacked = this.runConsumed - 1;
          const packedWord = decodeTree[this.treeIndex + 1 + (charIndexInPacked >> 1)];
          const expectedChar = charIndexInPacked % 2 === 0 ? packedWord & 255 : packedWord >> 8 & 255;
          if (input.charCodeAt(offset) !== expectedChar) {
            this.runConsumed = 0;
            return this.result === 0 ? 0 : this.emitNotTerminatedNamedEntity();
          }
          offset++;
          this.excess++;
          this.runConsumed++;
        }
        this.runConsumed = 0;
        this.treeIndex += 1 + (runLength >> 1);
        current = decodeTree[this.treeIndex];
        valueLength = (current & BinTrieFlags.VALUE_LENGTH) >> 14;
      }
      if (offset >= input.length)
        break;
      const char = input.charCodeAt(offset);
      if (char === CharCodes.SEMI && valueLength !== 0 && (current & BinTrieFlags.FLAG13) !== 0) {
        return this.emitNamedEntityData(this.treeIndex, valueLength, this.consumed + this.excess);
      }
      this.treeIndex = determineBranch(decodeTree, current, this.treeIndex + Math.max(1, valueLength), char);
      if (this.treeIndex < 0) {
        return this.result === 0 || this.decodeMode === DecodingMode.Attribute && (valueLength === 0 || isEntityInAttributeInvalidEnd(char)) ? 0 : this.emitNotTerminatedNamedEntity();
      }
      current = decodeTree[this.treeIndex];
      valueLength = (current & BinTrieFlags.VALUE_LENGTH) >> 14;
      if (valueLength !== 0) {
        if (char === CharCodes.SEMI) {
          return this.emitNamedEntityData(this.treeIndex, valueLength, this.consumed + this.excess);
        }
        if (this.decodeMode !== DecodingMode.Strict && (current & BinTrieFlags.FLAG13) === 0) {
          this.result = this.treeIndex;
          this.consumed += this.excess;
          this.excess = 0;
        }
      }
      offset++;
      this.excess++;
    }
    return -1;
  }
  emitNotTerminatedNamedEntity() {
    var _a;
    const { result, decodeTree } = this;
    const valueLength = (decodeTree[result] & BinTrieFlags.VALUE_LENGTH) >> 14;
    this.emitNamedEntityData(result, valueLength, this.consumed);
    (_a = this.errors) === null || _a === undefined || _a.missingSemicolonAfterCharacterReference();
    return this.consumed;
  }
  emitNamedEntityData(result, valueLength, consumed) {
    const { decodeTree } = this;
    this.emitCodePoint(valueLength === 1 ? decodeTree[result] & ~(BinTrieFlags.VALUE_LENGTH | BinTrieFlags.FLAG13) : decodeTree[result + 1], consumed);
    if (valueLength === 3) {
      this.emitCodePoint(decodeTree[result + 2], consumed);
    }
    return consumed;
  }
  end() {
    var _a;
    switch (this.state) {
      case EntityDecoderState.NamedEntity: {
        return this.result !== 0 && (this.decodeMode !== DecodingMode.Attribute || this.result === this.treeIndex) ? this.emitNotTerminatedNamedEntity() : 0;
      }
      case EntityDecoderState.NumericDecimal: {
        return this.emitNumericEntity(0, 2);
      }
      case EntityDecoderState.NumericHex: {
        return this.emitNumericEntity(0, 3);
      }
      case EntityDecoderState.NumericStart: {
        (_a = this.errors) === null || _a === undefined || _a.absenceOfDigitsInNumericCharacterReference(this.consumed);
        return 0;
      }
      case EntityDecoderState.EntityStart: {
        return 0;
      }
    }
  }
}
function getDecoder(decodeTree) {
  let returnValue = "";
  const decoder = new EntityDecoder(decodeTree, (data) => returnValue += fromCodePoint(data));
  return function decodeWithTrie(input, decodeMode) {
    let lastIndex = 0;
    let offset = 0;
    while ((offset = input.indexOf("&", offset)) >= 0) {
      returnValue += input.slice(lastIndex, offset);
      decoder.startEntity(decodeMode);
      const length = decoder.write(input, offset + 1);
      if (length < 0) {
        lastIndex = offset + decoder.end();
        break;
      }
      lastIndex = offset + length;
      offset = length === 0 ? lastIndex + 1 : lastIndex;
    }
    const result = returnValue + input.slice(lastIndex);
    returnValue = "";
    return result;
  };
}
function determineBranch(decodeTree, current, nodeIndex, char) {
  const branchCount = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
  const jumpOffset = current & BinTrieFlags.JUMP_TABLE;
  if (branchCount === 0) {
    return jumpOffset !== 0 && char === jumpOffset ? nodeIndex : -1;
  }
  if (jumpOffset) {
    const value = char - jumpOffset;
    return value < 0 || value >= branchCount ? -1 : decodeTree[nodeIndex + value] - 1;
  }
  const packedKeySlots = branchCount + 1 >> 1;
  let lo = 0;
  let hi = branchCount - 1;
  while (lo <= hi) {
    const mid = lo + hi >>> 1;
    const slot = mid >> 1;
    const packed = decodeTree[nodeIndex + slot];
    const midKey = packed >> (mid & 1) * 8 & 255;
    if (midKey < char) {
      lo = mid + 1;
    } else if (midKey > char) {
      hi = mid - 1;
    } else {
      return decodeTree[nodeIndex + packedKeySlots + mid];
    }
  }
  return -1;
}
var htmlDecoder = /* @__PURE__ */ getDecoder(htmlDecodeTree);
function decodeHTML(htmlString, mode = DecodingMode.Legacy) {
  return htmlDecoder(htmlString, mode);
}
function decodeHTMLStrict(htmlString) {
  return htmlDecoder(htmlString, DecodingMode.Strict);
}
// node_modules/markdown-exit/node_modules/entities/dist/esm/index.js
var EntityLevel;
(function(EntityLevel) {
  EntityLevel[EntityLevel["XML"] = 0] = "XML";
  EntityLevel[EntityLevel["HTML"] = 1] = "HTML";
})(EntityLevel || (EntityLevel = {}));
var EncodingMode;
(function(EncodingMode) {
  EncodingMode[EncodingMode["UTF8"] = 0] = "UTF8";
  EncodingMode[EncodingMode["ASCII"] = 1] = "ASCII";
  EncodingMode[EncodingMode["Extensive"] = 2] = "Extensive";
  EncodingMode[EncodingMode["Attribute"] = 3] = "Attribute";
  EncodingMode[EncodingMode["Text"] = 4] = "Text";
})(EncodingMode || (EncodingMode = {}));

// node_modules/mdurl/lib/decode.mjs
var decodeCache = {};
function getDecodeCache(exclude) {
  let cache = decodeCache[exclude];
  if (cache) {
    return cache;
  }
  cache = decodeCache[exclude] = [];
  for (let i = 0;i < 128; i++) {
    const ch = String.fromCharCode(i);
    cache.push(ch);
  }
  for (let i = 0;i < exclude.length; i++) {
    const ch = exclude.charCodeAt(i);
    cache[ch] = "%" + ("0" + ch.toString(16).toUpperCase()).slice(-2);
  }
  return cache;
}
function decode(string, exclude) {
  if (typeof exclude !== "string") {
    exclude = decode.defaultChars;
  }
  const cache = getDecodeCache(exclude);
  return string.replace(/(%[a-f0-9]{2})+/gi, function(seq) {
    let result = "";
    for (let i = 0, l = seq.length;i < l; i += 3) {
      const b1 = parseInt(seq.slice(i + 1, i + 3), 16);
      if (b1 < 128) {
        result += cache[b1];
        continue;
      }
      if ((b1 & 224) === 192 && i + 3 < l) {
        const b2 = parseInt(seq.slice(i + 4, i + 6), 16);
        if ((b2 & 192) === 128) {
          const chr = b1 << 6 & 1984 | b2 & 63;
          if (chr < 128) {
            result += "��";
          } else {
            result += String.fromCharCode(chr);
          }
          i += 3;
          continue;
        }
      }
      if ((b1 & 240) === 224 && i + 6 < l) {
        const b2 = parseInt(seq.slice(i + 4, i + 6), 16);
        const b3 = parseInt(seq.slice(i + 7, i + 9), 16);
        if ((b2 & 192) === 128 && (b3 & 192) === 128) {
          const chr = b1 << 12 & 61440 | b2 << 6 & 4032 | b3 & 63;
          if (chr < 2048 || chr >= 55296 && chr <= 57343) {
            result += "���";
          } else {
            result += String.fromCharCode(chr);
          }
          i += 6;
          continue;
        }
      }
      if ((b1 & 248) === 240 && i + 9 < l) {
        const b2 = parseInt(seq.slice(i + 4, i + 6), 16);
        const b3 = parseInt(seq.slice(i + 7, i + 9), 16);
        const b4 = parseInt(seq.slice(i + 10, i + 12), 16);
        if ((b2 & 192) === 128 && (b3 & 192) === 128 && (b4 & 192) === 128) {
          let chr = b1 << 18 & 1835008 | b2 << 12 & 258048 | b3 << 6 & 4032 | b4 & 63;
          if (chr < 65536 || chr > 1114111) {
            result += "����";
          } else {
            chr -= 65536;
            result += String.fromCharCode(55296 + (chr >> 10), 56320 + (chr & 1023));
          }
          i += 9;
          continue;
        }
      }
      result += "�";
    }
    return result;
  });
}
decode.defaultChars = ";/?:@&=+$,#";
decode.componentChars = "";
var decode_default = decode;

// node_modules/mdurl/lib/encode.mjs
var encodeCache = {};
function getEncodeCache(exclude) {
  let cache = encodeCache[exclude];
  if (cache) {
    return cache;
  }
  cache = encodeCache[exclude] = [];
  for (let i = 0;i < 128; i++) {
    const ch = String.fromCharCode(i);
    if (/^[0-9a-z]$/i.test(ch)) {
      cache.push(ch);
    } else {
      cache.push("%" + ("0" + i.toString(16).toUpperCase()).slice(-2));
    }
  }
  for (let i = 0;i < exclude.length; i++) {
    cache[exclude.charCodeAt(i)] = exclude[i];
  }
  return cache;
}
function encode(string, exclude, keepEscaped) {
  if (typeof exclude !== "string") {
    keepEscaped = exclude;
    exclude = encode.defaultChars;
  }
  if (typeof keepEscaped === "undefined") {
    keepEscaped = true;
  }
  const cache = getEncodeCache(exclude);
  let result = "";
  for (let i = 0, l = string.length;i < l; i++) {
    const code = string.charCodeAt(i);
    if (keepEscaped && code === 37 && i + 2 < l) {
      if (/^[0-9a-f]{2}$/i.test(string.slice(i + 1, i + 3))) {
        result += string.slice(i, i + 3);
        i += 2;
        continue;
      }
    }
    if (code < 128) {
      result += cache[code];
      continue;
    }
    if (code >= 55296 && code <= 57343) {
      if (code >= 55296 && code <= 56319 && i + 1 < l) {
        const nextCode = string.charCodeAt(i + 1);
        if (nextCode >= 56320 && nextCode <= 57343) {
          result += encodeURIComponent(string[i] + string[i + 1]);
          i++;
          continue;
        }
      }
      result += "%EF%BF%BD";
      continue;
    }
    result += encodeURIComponent(string[i]);
  }
  return result;
}
encode.defaultChars = ";/?:@&=+$,-_.!~*'()#";
encode.componentChars = "-_.!~*'()";
var encode_default = encode;

// node_modules/mdurl/lib/format.mjs
function format2(url) {
  let result = "";
  result += url.protocol || "";
  result += url.slashes ? "//" : "";
  result += url.auth ? url.auth + "@" : "";
  if (url.hostname && url.hostname.indexOf(":") !== -1) {
    result += "[" + url.hostname + "]";
  } else {
    result += url.hostname || "";
  }
  result += url.port ? ":" + url.port : "";
  result += url.pathname || "";
  result += url.search || "";
  result += url.hash || "";
  return result;
}

// node_modules/mdurl/lib/parse.mjs
function Url() {
  this.protocol = null;
  this.slashes = null;
  this.auth = null;
  this.port = null;
  this.hostname = null;
  this.hash = null;
  this.search = null;
  this.pathname = null;
}
var protocolPattern = /^([a-z0-9.+-]+:)/i;
var portPattern = /:[0-9]*$/;
var simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/;
var delims = ["<", ">", '"', "`", " ", "\r", `
`, "\t"];
var unwise = ["{", "}", "|", "\\", "^", "`"].concat(delims);
var autoEscape = ["'"].concat(unwise);
var nonHostChars = ["%", "/", "?", ";", "#"].concat(autoEscape);
var hostEndingChars = ["/", "?", "#"];
var hostnameMaxLen = 255;
var hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/;
var hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/;
var hostlessProtocol = {
  javascript: true,
  "javascript:": true
};
var slashedProtocol = {
  http: true,
  https: true,
  ftp: true,
  gopher: true,
  file: true,
  "http:": true,
  "https:": true,
  "ftp:": true,
  "gopher:": true,
  "file:": true
};
function urlParse(url, slashesDenoteHost) {
  if (url && url instanceof Url)
    return url;
  const u = new Url;
  u.parse(url, slashesDenoteHost);
  return u;
}
Url.prototype.parse = function(url, slashesDenoteHost) {
  let lowerProto, hec, slashes;
  let rest = url;
  rest = rest.trim();
  if (!slashesDenoteHost && url.split("#").length === 1) {
    const simplePath = simplePathPattern.exec(rest);
    if (simplePath) {
      this.pathname = simplePath[1];
      if (simplePath[2]) {
        this.search = simplePath[2];
      }
      return this;
    }
  }
  let proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    lowerProto = proto.toLowerCase();
    this.protocol = proto;
    rest = rest.substr(proto.length);
  }
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    slashes = rest.substr(0, 2) === "//";
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      this.slashes = true;
    }
  }
  if (!hostlessProtocol[proto] && (slashes || proto && !slashedProtocol[proto])) {
    let hostEnd = -1;
    for (let i = 0;i < hostEndingChars.length; i++) {
      hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) {
        hostEnd = hec;
      }
    }
    let auth, atSign;
    if (hostEnd === -1) {
      atSign = rest.lastIndexOf("@");
    } else {
      atSign = rest.lastIndexOf("@", hostEnd);
    }
    if (atSign !== -1) {
      auth = rest.slice(0, atSign);
      rest = rest.slice(atSign + 1);
      this.auth = auth;
    }
    hostEnd = -1;
    for (let i = 0;i < nonHostChars.length; i++) {
      hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) {
        hostEnd = hec;
      }
    }
    if (hostEnd === -1) {
      hostEnd = rest.length;
    }
    if (rest[hostEnd - 1] === ":") {
      hostEnd--;
    }
    const host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);
    this.parseHost(host);
    this.hostname = this.hostname || "";
    const ipv6Hostname = this.hostname[0] === "[" && this.hostname[this.hostname.length - 1] === "]";
    if (!ipv6Hostname) {
      const hostparts = this.hostname.split(/\./);
      for (let i = 0, l = hostparts.length;i < l; i++) {
        const part = hostparts[i];
        if (!part) {
          continue;
        }
        if (!part.match(hostnamePartPattern)) {
          let newpart = "";
          for (let j = 0, k = part.length;j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              newpart += "x";
            } else {
              newpart += part[j];
            }
          }
          if (!newpart.match(hostnamePartPattern)) {
            const validParts = hostparts.slice(0, i);
            const notHost = hostparts.slice(i + 1);
            const bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = notHost.join(".") + rest;
            }
            this.hostname = validParts.join(".");
            break;
          }
        }
      }
    }
    if (this.hostname.length > hostnameMaxLen) {
      this.hostname = "";
    }
    if (ipv6Hostname) {
      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
    }
  }
  const hash = rest.indexOf("#");
  if (hash !== -1) {
    this.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  const qm = rest.indexOf("?");
  if (qm !== -1) {
    this.search = rest.substr(qm);
    rest = rest.slice(0, qm);
  }
  if (rest) {
    this.pathname = rest;
  }
  if (slashedProtocol[lowerProto] && this.hostname && !this.pathname) {
    this.pathname = "";
  }
  return this;
};
Url.prototype.parseHost = function(host) {
  let port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ":") {
      this.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) {
    this.hostname = host;
  }
};
var parse_default = urlParse;

// node_modules/uc.micro/properties/Any/regex.mjs
var regex_default = /[\0-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;

// node_modules/uc.micro/categories/Cc/regex.mjs
var regex_default2 = /[\0-\x1F\x7F-\x9F]/;

// node_modules/uc.micro/categories/Cf/regex.mjs
var regex_default3 = /[\xAD\u0600-\u0605\u061C\u06DD\u070F\u0890\u0891\u08E2\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB]|\uD804[\uDCBD\uDCCD]|\uD80D[\uDC30-\uDC3F]|\uD82F[\uDCA0-\uDCA3]|\uD834[\uDD73-\uDD7A]|\uDB40[\uDC01\uDC20-\uDC7F]/;

// node_modules/uc.micro/categories/P/regex.mjs
var regex_default4 = /[!-#%-\*,-\/:;\?@\[-\]_\{\}\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061D-\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u09FD\u0A76\u0AF0\u0C77\u0C84\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1B7D\u1B7E\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E4F\u2E52-\u2E5D\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD803[\uDEAD\uDF55-\uDF59\uDF86-\uDF89]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC8\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9]|\uD805[\uDC4B-\uDC4F\uDC5A\uDC5B\uDC5D\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDE60-\uDE6C\uDEB9\uDF3C-\uDF3E]|\uD806[\uDC3B\uDD44-\uDD46\uDDE2\uDE3F-\uDE46\uDE9A-\uDE9C\uDE9E-\uDEA2\uDF00-\uDF09]|\uD807[\uDC41-\uDC45\uDC70\uDC71\uDEF7\uDEF8\uDF43-\uDF4F\uDFFF]|\uD809[\uDC70-\uDC74]|\uD80B[\uDFF1\uDFF2]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD81B[\uDE97-\uDE9A\uDFE2]|\uD82F\uDC9F|\uD836[\uDE87-\uDE8B]|\uD83A[\uDD5E\uDD5F]/;

// node_modules/uc.micro/categories/S/regex.mjs
var regex_default5 = /[\$\+<->\^`\|~\xA2-\xA6\xA8\xA9\xAC\xAE-\xB1\xB4\xB8\xD7\xF7\u02C2-\u02C5\u02D2-\u02DF\u02E5-\u02EB\u02ED\u02EF-\u02FF\u0375\u0384\u0385\u03F6\u0482\u058D-\u058F\u0606-\u0608\u060B\u060E\u060F\u06DE\u06E9\u06FD\u06FE\u07F6\u07FE\u07FF\u0888\u09F2\u09F3\u09FA\u09FB\u0AF1\u0B70\u0BF3-\u0BFA\u0C7F\u0D4F\u0D79\u0E3F\u0F01-\u0F03\u0F13\u0F15-\u0F17\u0F1A-\u0F1F\u0F34\u0F36\u0F38\u0FBE-\u0FC5\u0FC7-\u0FCC\u0FCE\u0FCF\u0FD5-\u0FD8\u109E\u109F\u1390-\u1399\u166D\u17DB\u1940\u19DE-\u19FF\u1B61-\u1B6A\u1B74-\u1B7C\u1FBD\u1FBF-\u1FC1\u1FCD-\u1FCF\u1FDD-\u1FDF\u1FED-\u1FEF\u1FFD\u1FFE\u2044\u2052\u207A-\u207C\u208A-\u208C\u20A0-\u20C0\u2100\u2101\u2103-\u2106\u2108\u2109\u2114\u2116-\u2118\u211E-\u2123\u2125\u2127\u2129\u212E\u213A\u213B\u2140-\u2144\u214A-\u214D\u214F\u218A\u218B\u2190-\u2307\u230C-\u2328\u232B-\u2426\u2440-\u244A\u249C-\u24E9\u2500-\u2767\u2794-\u27C4\u27C7-\u27E5\u27F0-\u2982\u2999-\u29D7\u29DC-\u29FB\u29FE-\u2B73\u2B76-\u2B95\u2B97-\u2BFF\u2CE5-\u2CEA\u2E50\u2E51\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u2FF0-\u2FFF\u3004\u3012\u3013\u3020\u3036\u3037\u303E\u303F\u309B\u309C\u3190\u3191\u3196-\u319F\u31C0-\u31E3\u31EF\u3200-\u321E\u322A-\u3247\u3250\u3260-\u327F\u328A-\u32B0\u32C0-\u33FF\u4DC0-\u4DFF\uA490-\uA4C6\uA700-\uA716\uA720\uA721\uA789\uA78A\uA828-\uA82B\uA836-\uA839\uAA77-\uAA79\uAB5B\uAB6A\uAB6B\uFB29\uFBB2-\uFBC2\uFD40-\uFD4F\uFDCF\uFDFC-\uFDFF\uFE62\uFE64-\uFE66\uFE69\uFF04\uFF0B\uFF1C-\uFF1E\uFF3E\uFF40\uFF5C\uFF5E\uFFE0-\uFFE6\uFFE8-\uFFEE\uFFFC\uFFFD]|\uD800[\uDD37-\uDD3F\uDD79-\uDD89\uDD8C-\uDD8E\uDD90-\uDD9C\uDDA0\uDDD0-\uDDFC]|\uD802[\uDC77\uDC78\uDEC8]|\uD805\uDF3F|\uD807[\uDFD5-\uDFF1]|\uD81A[\uDF3C-\uDF3F\uDF45]|\uD82F\uDC9C|\uD833[\uDF50-\uDFC3]|\uD834[\uDC00-\uDCF5\uDD00-\uDD26\uDD29-\uDD64\uDD6A-\uDD6C\uDD83\uDD84\uDD8C-\uDDA9\uDDAE-\uDDEA\uDE00-\uDE41\uDE45\uDF00-\uDF56]|\uD835[\uDEC1\uDEDB\uDEFB\uDF15\uDF35\uDF4F\uDF6F\uDF89\uDFA9\uDFC3]|\uD836[\uDC00-\uDDFF\uDE37-\uDE3A\uDE6D-\uDE74\uDE76-\uDE83\uDE85\uDE86]|\uD838[\uDD4F\uDEFF]|\uD83B[\uDCAC\uDCB0\uDD2E\uDEF0\uDEF1]|\uD83C[\uDC00-\uDC2B\uDC30-\uDC93\uDCA0-\uDCAE\uDCB1-\uDCBF\uDCC1-\uDCCF\uDCD1-\uDCF5\uDD0D-\uDDAD\uDDE6-\uDE02\uDE10-\uDE3B\uDE40-\uDE48\uDE50\uDE51\uDE60-\uDE65\uDF00-\uDFFF]|\uD83D[\uDC00-\uDED7\uDEDC-\uDEEC\uDEF0-\uDEFC\uDF00-\uDF76\uDF7B-\uDFD9\uDFE0-\uDFEB\uDFF0]|\uD83E[\uDC00-\uDC0B\uDC10-\uDC47\uDC50-\uDC59\uDC60-\uDC87\uDC90-\uDCAD\uDCB0\uDCB1\uDD00-\uDE53\uDE60-\uDE6D\uDE70-\uDE7C\uDE80-\uDE88\uDE90-\uDEBD\uDEBF-\uDEC5\uDECE-\uDEDB\uDEE0-\uDEE8\uDEF0-\uDEF8\uDF00-\uDF92\uDF94-\uDFCA]/;

// node_modules/uc.micro/categories/Z/regex.mjs
var regex_default6 = /[ \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/;

// node_modules/linkify-it/lib/re.mjs
function re_default(opts) {
  const re = {};
  opts = opts || {};
  re.src_Any = regex_default.source;
  re.src_Cc = regex_default2.source;
  re.src_Z = regex_default6.source;
  re.src_P = regex_default4.source;
  re.src_ZPCc = [re.src_Z, re.src_P, re.src_Cc].join("|");
  re.src_ZCc = [re.src_Z, re.src_Cc].join("|");
  const text_separators = "[><｜]";
  re.src_pseudo_letter = `(?:(?!${text_separators}|${re.src_ZPCc})${re.src_Any})`;
  re.src_ip4 = "(?:(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)";
  re.src_auth = `(?:(?:(?!${re.src_ZCc}|[@/\\[\\]()]).){1,50}@)?`;
  re.src_port = "(?::(?:6(?:[0-4]\\d{3}|5(?:[0-4]\\d{2}|5(?:[0-2]\\d|3[0-5])))|[1-5]?\\d{1,4}))?";
  re.src_host_terminator = `(?=$|${text_separators}|${re.src_ZPCc})` + `(?!${opts["---"] ? "-(?!--)|" : "-|"}_|:\\d|\\.-|\\.(?!$|${re.src_ZPCc}))`;
  re.src_path = "(?:" + "[/?#]" + "(?:" + `(?!${re.src_ZCc}|${text_separators}|[()[\\]{}.,"'?!\\-;]).|` + `\\[(?:(?!${re.src_ZCc}|\\]).)*\\]|` + `\\((?:(?!${re.src_ZCc}|[)]).)*\\)|` + `\\{(?:(?!${re.src_ZCc}|[}]).)*\\}|` + `\\"(?:(?!${re.src_ZCc}|["]).)+\\"|` + `\\'(?:(?!${re.src_ZCc}|[']).)+\\'|` + `\\'(?=${re.src_pseudo_letter}|[-])|` + "\\.{2,}[a-zA-Z0-9%/&]|" + `\\.(?!${re.src_ZCc}|[.]|$)|` + (opts["---"] ? "\\-(?!--(?:[^-]|$))(?:-*)|" : "\\-+|") + `,(?!${re.src_ZCc}|$)|` + `;(?!${re.src_ZCc}|$)|` + `\\!+(?!${re.src_ZCc}|[!]|$)|` + `\\?(?!${re.src_ZCc}|[?]|$)` + ")+" + "|\\/" + ")?";
  re.src_email_name = "[\\-;:&=\\+\\$,\\.a-zA-Z0-9_][\\-;:&=\\+\\$,\\\"\\.a-zA-Z0-9_]{0,63}";
  re.src_xn = "xn--[a-z0-9\\-]{1,59}";
  re.src_domain_root = "(?:" + re.src_xn + "|" + `${re.src_pseudo_letter}{1,63}` + ")";
  re.src_domain = "(?:" + re.src_xn + "|" + `(?:${re.src_pseudo_letter})` + "|" + `(?:${re.src_pseudo_letter}(?:-|${re.src_pseudo_letter}){0,61}${re.src_pseudo_letter})` + ")";
  re.src_host = "(?:" + `(?:(?:(?:${re.src_domain})\\.)*${re.src_domain})` + ")";
  re.tpl_host_fuzzy = "(?:" + re.src_ip4 + "|" + `(?:(?:(?:${re.src_domain})\\.)+(?:%TLDS%))` + ")";
  re.tpl_host_no_ip_fuzzy = `(?:(?:(?:${re.src_domain})\\.)+(?:%TLDS%))`;
  re.src_host_strict = re.src_host + re.src_host_terminator;
  re.tpl_host_fuzzy_strict = re.tpl_host_fuzzy + re.src_host_terminator;
  re.src_host_port_strict = re.src_host + re.src_port + re.src_host_terminator;
  re.tpl_host_port_fuzzy_strict = re.tpl_host_fuzzy + re.src_port + re.src_host_terminator;
  re.tpl_host_port_no_ip_fuzzy_strict = re.tpl_host_no_ip_fuzzy + re.src_port + re.src_host_terminator;
  re.tpl_host_fuzzy_test = `localhost|www\\.|\\.\\d{1,3}\\.|(?:\\.(?:%TLDS%)(?:${re.src_ZPCc}|>|$))`;
  re.tpl_email_fuzzy = `(^|${text_separators}|"|\\(|${re.src_ZCc})` + `(${re.src_email_name}@${re.tpl_host_fuzzy_strict})`;
  re.tpl_link_fuzzy = `(^|(?![.:/\\-_@])(?:[$+<=>^\`|｜]|${re.src_ZPCc}))` + `((?![$+<=>^\`|｜])${re.tpl_host_port_fuzzy_strict}${re.src_path})`;
  re.tpl_link_no_ip_fuzzy = `(^|(?![.:/\\-_@])(?:[$+<=>^\`|｜]|${re.src_ZPCc}))` + `((?![$+<=>^\`|｜])${re.tpl_host_port_no_ip_fuzzy_strict}${re.src_path})`;
  return re;
}

// node_modules/linkify-it/index.mjs
function assign(obj) {
  const sources = Array.prototype.slice.call(arguments, 1);
  sources.forEach(function(source) {
    if (!source) {
      return;
    }
    Object.keys(source).forEach(function(key) {
      obj[key] = source[key];
    });
  });
  return obj;
}
function _class(obj) {
  return Object.prototype.toString.call(obj);
}
function isString(obj) {
  return _class(obj) === "[object String]";
}
function isObject(obj) {
  return _class(obj) === "[object Object]";
}
function isRegExp(obj) {
  return _class(obj) === "[object RegExp]";
}
function isFunction(obj) {
  return _class(obj) === "[object Function]";
}
function escapeRE(str) {
  return str.replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
}
var defaultOptions = {
  fuzzyLink: true,
  fuzzyEmail: true,
  fuzzyIP: false
};
function isOptionsObj(obj) {
  return Object.keys(obj || {}).reduce(function(acc, k) {
    return acc || defaultOptions.hasOwnProperty(k);
  }, false);
}
var defaultSchemas = {
  "http:": {
    validate: function(text, pos, self) {
      const tail = text.slice(pos);
      if (!self.re.http) {
        self.re.http = new RegExp(`^\\/\\/${self.re.src_auth}${self.re.src_host_port_strict}${self.re.src_path}`, "i");
      }
      if (self.re.http.test(tail)) {
        return tail.match(self.re.http)[0].length;
      }
      return 0;
    }
  },
  "https:": "http:",
  "ftp:": "http:",
  "//": {
    validate: function(text, pos, self) {
      const tail = text.slice(pos);
      if (!self.re.no_http) {
        self.re.no_http = new RegExp("^" + self.re.src_auth + `(?:localhost|(?:(?:${self.re.src_domain})\\.)+${self.re.src_domain_root})` + self.re.src_port + self.re.src_host_terminator + self.re.src_path, "i");
      }
      if (self.re.no_http.test(tail)) {
        if (pos >= 3 && text[pos - 3] === ":") {
          return 0;
        }
        if (pos >= 3 && text[pos - 3] === "/") {
          return 0;
        }
        return tail.match(self.re.no_http)[0].length;
      }
      return 0;
    }
  },
  "mailto:": {
    validate: function(text, pos, self) {
      const tail = text.slice(pos);
      if (!self.re.mailto) {
        self.re.mailto = new RegExp(`^${self.re.src_email_name}@${self.re.src_host_strict}`, "i");
      }
      if (self.re.mailto.test(tail)) {
        return tail.match(self.re.mailto)[0].length;
      }
      return 0;
    }
  }
};
var tlds_2ch_src_re = "a[cdefgilmnoqrstuwxz]|b[abdefghijmnorstvwyz]|c[acdfghiklmnoruvwxyz]|d[ejkmoz]|e[cegrstu]|f[ijkmor]|g[abdefghilmnpqrstuwy]|h[kmnrtu]|i[delmnoqrst]|j[emop]|k[eghimnprwyz]|l[abcikrstuvy]|m[acdeghklmnopqrstuvwxyz]|n[acefgilopruz]|om|p[aefghklmnrstwy]|qa|r[eosuw]|s[abcdeghijklmnortuvxyz]|t[cdfghjklmnortvwz]|u[agksyz]|v[aceginu]|w[fs]|y[et]|z[amw]";
var tlds_default = "biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|рф".split("|");
function createValidator(re) {
  return function(text, pos) {
    const tail = text.slice(pos);
    if (re.test(tail)) {
      return tail.match(re)[0].length;
    }
    return 0;
  };
}
function createNormalizer() {
  return function(match, self) {
    self.normalize(match);
  };
}
function compile(self) {
  const re = self.re = re_default(self.__opts__);
  const tlds = self.__tlds__.slice();
  self.onCompile();
  if (!self.__tlds_replaced__) {
    tlds.push(tlds_2ch_src_re);
  }
  tlds.push(re.src_xn);
  re.src_tlds = tlds.join("|");
  function untpl(tpl) {
    return tpl.replace("%TLDS%", re.src_tlds);
  }
  re.email_fuzzy = RegExp(untpl(re.tpl_email_fuzzy), "i");
  re.email_fuzzy_global = RegExp(untpl(re.tpl_email_fuzzy), "ig");
  re.link_fuzzy = RegExp(untpl(re.tpl_link_fuzzy), "i");
  re.link_fuzzy_global = RegExp(untpl(re.tpl_link_fuzzy), "ig");
  re.link_no_ip_fuzzy = RegExp(untpl(re.tpl_link_no_ip_fuzzy), "i");
  re.link_no_ip_fuzzy_global = RegExp(untpl(re.tpl_link_no_ip_fuzzy), "ig");
  re.host_fuzzy_test = RegExp(untpl(re.tpl_host_fuzzy_test), "i");
  const aliases = [];
  self.__compiled__ = {};
  function schemaError(name, val) {
    throw new Error(`(LinkifyIt) Invalid schema "${name}": ${val}`);
  }
  Object.keys(self.__schemas__).forEach(function(name) {
    const val = self.__schemas__[name];
    if (val === null) {
      return;
    }
    const compiled = { validate: null, link: null };
    self.__compiled__[name] = compiled;
    if (isObject(val)) {
      if (isRegExp(val.validate)) {
        compiled.validate = createValidator(val.validate);
      } else if (isFunction(val.validate)) {
        compiled.validate = val.validate;
      } else {
        schemaError(name, val);
      }
      if (isFunction(val.normalize)) {
        compiled.normalize = val.normalize;
      } else if (!val.normalize) {
        compiled.normalize = createNormalizer();
      } else {
        schemaError(name, val);
      }
      return;
    }
    if (isString(val)) {
      aliases.push(name);
      return;
    }
    schemaError(name, val);
  });
  aliases.forEach(function(alias) {
    if (!self.__compiled__[self.__schemas__[alias]]) {
      return;
    }
    self.__compiled__[alias].validate = self.__compiled__[self.__schemas__[alias]].validate;
    self.__compiled__[alias].normalize = self.__compiled__[self.__schemas__[alias]].normalize;
  });
  self.__compiled__[""] = { validate: null, normalize: createNormalizer() };
  const slist = Object.keys(self.__compiled__).filter(function(name) {
    return name.length > 0 && self.__compiled__[name];
  }).map(escapeRE).join("|");
  self.re.schema_test = RegExp(`(^|(?!_)(?:[><｜]|${re.src_ZPCc}))(${slist})`, "i");
  self.re.schema_search = RegExp(`(^|(?!_)(?:[><｜]|${re.src_ZPCc}))(${slist})`, "ig");
  self.re.schema_at_start = RegExp(`^${self.re.schema_search.source}`, "i");
  self.re.pretest = RegExp(`(${self.re.schema_test.source})|(${self.re.host_fuzzy_test.source})|@`, "i");
}
function Match(text, schema, index, lastIndex) {
  const raw = text.slice(index, lastIndex);
  this.schema = schema.toLowerCase();
  this.index = index;
  this.lastIndex = lastIndex;
  this.raw = raw;
  this.text = raw;
  this.url = raw;
}
function LinkifyIt(schemas, options) {
  if (!(this instanceof LinkifyIt)) {
    return new LinkifyIt(schemas, options);
  }
  if (!options) {
    if (isOptionsObj(schemas)) {
      options = schemas;
      schemas = {};
    }
  }
  this.__opts__ = assign({}, defaultOptions, options);
  this.__schemas__ = assign({}, defaultSchemas, schemas);
  this.__compiled__ = {};
  this.__tlds__ = tlds_default;
  this.__tlds_replaced__ = false;
  this.re = {};
  compile(this);
}
LinkifyIt.prototype.add = function add(schema, definition) {
  this.__schemas__[schema] = definition;
  compile(this);
  return this;
};
LinkifyIt.prototype.set = function set(options) {
  this.__opts__ = assign(this.__opts__, options);
  return this;
};
LinkifyIt.prototype.test = function test(text) {
  if (!text.length) {
    return false;
  }
  let m, re;
  if (this.re.schema_test.test(text)) {
    re = this.re.schema_search;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      if (this.testSchemaAt(text, m[2], re.lastIndex)) {
        return true;
      }
    }
  }
  if (this.__opts__.fuzzyLink && this.__compiled__["http:"]) {
    if (text.search(this.re.host_fuzzy_test) >= 0) {
      if (text.match(this.__opts__.fuzzyIP ? this.re.link_fuzzy : this.re.link_no_ip_fuzzy) !== null) {
        return true;
      }
    }
  }
  if (this.__opts__.fuzzyEmail && this.__compiled__["mailto:"]) {
    if (text.indexOf("@") >= 0) {
      if (text.match(this.re.email_fuzzy) !== null) {
        return true;
      }
    }
  }
  return false;
};
LinkifyIt.prototype.pretest = function pretest(text) {
  return this.re.pretest.test(text);
};
LinkifyIt.prototype.testSchemaAt = function testSchemaAt(text, schema, pos) {
  if (!this.__compiled__[schema.toLowerCase()]) {
    return 0;
  }
  return this.__compiled__[schema.toLowerCase()].validate(text, pos, this);
};
LinkifyIt.prototype.match = function match(text) {
  const result = [];
  const type_schemed = [];
  const type_fuzzy_link = [];
  const type_fuzzy_email = [];
  let m, len, re;
  function choose(a, b) {
    if (!a) {
      return b;
    }
    if (!b) {
      return a;
    }
    if (a.index !== b.index) {
      return a.index < b.index ? a : b;
    }
    return a.lastIndex >= b.lastIndex ? a : b;
  }
  if (!text.length) {
    return null;
  }
  if (this.re.schema_test.test(text)) {
    re = this.re.schema_search;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      len = this.testSchemaAt(text, m[2], re.lastIndex);
      if (len) {
        type_schemed.push({
          schema: m[2],
          index: m.index + m[1].length,
          lastIndex: m.index + m[0].length + len
        });
      }
    }
  }
  if (this.__opts__.fuzzyLink && this.__compiled__["http:"]) {
    re = this.__opts__.fuzzyIP ? this.re.link_fuzzy_global : this.re.link_no_ip_fuzzy_global;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      type_fuzzy_link.push({
        schema: "",
        index: m.index + m[1].length,
        lastIndex: m.index + m[0].length
      });
    }
  }
  if (this.__opts__.fuzzyEmail && this.__compiled__["mailto:"]) {
    re = this.re.email_fuzzy_global;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      type_fuzzy_email.push({
        schema: "mailto:",
        index: m.index + m[1].length,
        lastIndex: m.index + m[0].length
      });
    }
  }
  const indexes = [0, 0, 0];
  let lastIndex = 0;
  for (;; ) {
    const candidates = [
      type_schemed[indexes[0]],
      type_fuzzy_email[indexes[1]],
      type_fuzzy_link[indexes[2]]
    ];
    const candidate = choose(choose(candidates[0], candidates[1]), candidates[2]);
    if (!candidate) {
      break;
    }
    if (candidate === candidates[0]) {
      indexes[0]++;
    } else if (candidate === candidates[1]) {
      indexes[1]++;
    } else {
      indexes[2]++;
    }
    if (candidate.index < lastIndex) {
      continue;
    }
    const match = new Match(text, candidate.schema, candidate.index, candidate.lastIndex);
    this.__compiled__[match.schema].normalize(match, this);
    result.push(match);
    lastIndex = candidate.lastIndex;
  }
  if (result.length) {
    return result;
  }
  return null;
};
LinkifyIt.prototype.matchAtStart = function matchAtStart(text) {
  if (!text.length)
    return null;
  const m = this.re.schema_at_start.exec(text);
  if (!m)
    return null;
  const len = this.testSchemaAt(text, m[2], m[0].length);
  if (!len)
    return null;
  const match = new Match(text, m[2], m.index + m[1].length, m.index + m[0].length + len);
  this.__compiled__[match.schema].normalize(match, this);
  return match;
};
LinkifyIt.prototype.tlds = function tlds(list, keepOld) {
  list = Array.isArray(list) ? list : [list];
  if (!keepOld) {
    this.__tlds__ = list.slice();
    this.__tlds_replaced__ = true;
    compile(this);
    return this;
  }
  this.__tlds__ = this.__tlds__.concat(list).sort().filter(function(el, idx, arr) {
    return el !== arr[idx - 1];
  }).reverse();
  compile(this);
  return this;
};
LinkifyIt.prototype.normalize = function normalize(match) {
  if (!match.schema) {
    match.url = `http://${match.url}`;
  }
  if (match.schema === "mailto:" && !/^mailto:/i.test(match.url)) {
    match.url = `mailto:${match.url}`;
  }
};
LinkifyIt.prototype.onCompile = function onCompile() {};
var linkify_it_default = LinkifyIt;

// node_modules/punycode.js/punycode.es6.js
var maxInt = 2147483647;
var base = 36;
var tMin = 1;
var tMax = 26;
var skew = 38;
var damp = 700;
var initialBias = 72;
var initialN = 128;
var delimiter2 = "-";
var regexPunycode = /^xn--/;
var regexNonASCII = /[^\0-\x7F]/;
var regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g;
var errors = {
  overflow: "Overflow: input needs wider integers to process",
  "not-basic": "Illegal input >= 0x80 (not a basic code point)",
  "invalid-input": "Invalid input"
};
var baseMinusTMin = base - tMin;
var floor = Math.floor;
var stringFromCharCode = String.fromCharCode;
function error(type) {
  throw new RangeError(errors[type]);
}
function map(array, callback) {
  const result = [];
  let length = array.length;
  while (length--) {
    result[length] = callback(array[length]);
  }
  return result;
}
function mapDomain(domain, callback) {
  const parts = domain.split("@");
  let result = "";
  if (parts.length > 1) {
    result = parts[0] + "@";
    domain = parts[1];
  }
  domain = domain.replace(regexSeparators, ".");
  const labels = domain.split(".");
  const encoded = map(labels, callback).join(".");
  return result + encoded;
}
function ucs2decode(string) {
  const output = [];
  let counter = 0;
  const length = string.length;
  while (counter < length) {
    const value = string.charCodeAt(counter++);
    if (value >= 55296 && value <= 56319 && counter < length) {
      const extra = string.charCodeAt(counter++);
      if ((extra & 64512) == 56320) {
        output.push(((value & 1023) << 10) + (extra & 1023) + 65536);
      } else {
        output.push(value);
        counter--;
      }
    } else {
      output.push(value);
    }
  }
  return output;
}
var ucs2encode = (codePoints) => String.fromCodePoint(...codePoints);
var basicToDigit = function(codePoint) {
  if (codePoint >= 48 && codePoint < 58) {
    return 26 + (codePoint - 48);
  }
  if (codePoint >= 65 && codePoint < 91) {
    return codePoint - 65;
  }
  if (codePoint >= 97 && codePoint < 123) {
    return codePoint - 97;
  }
  return base;
};
var digitToBasic = function(digit, flag) {
  return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
};
var adapt = function(delta, numPoints, firstTime) {
  let k = 0;
  delta = firstTime ? floor(delta / damp) : delta >> 1;
  delta += floor(delta / numPoints);
  for (;delta > baseMinusTMin * tMax >> 1; k += base) {
    delta = floor(delta / baseMinusTMin);
  }
  return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
};
var decode2 = function(input) {
  const output = [];
  const inputLength = input.length;
  let i = 0;
  let n = initialN;
  let bias = initialBias;
  let basic = input.lastIndexOf(delimiter2);
  if (basic < 0) {
    basic = 0;
  }
  for (let j = 0;j < basic; ++j) {
    if (input.charCodeAt(j) >= 128) {
      error("not-basic");
    }
    output.push(input.charCodeAt(j));
  }
  for (let index = basic > 0 ? basic + 1 : 0;index < inputLength; ) {
    const oldi = i;
    for (let w = 1, k = base;; k += base) {
      if (index >= inputLength) {
        error("invalid-input");
      }
      const digit = basicToDigit(input.charCodeAt(index++));
      if (digit >= base) {
        error("invalid-input");
      }
      if (digit > floor((maxInt - i) / w)) {
        error("overflow");
      }
      i += digit * w;
      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
      if (digit < t) {
        break;
      }
      const baseMinusT = base - t;
      if (w > floor(maxInt / baseMinusT)) {
        error("overflow");
      }
      w *= baseMinusT;
    }
    const out = output.length + 1;
    bias = adapt(i - oldi, out, oldi == 0);
    if (floor(i / out) > maxInt - n) {
      error("overflow");
    }
    n += floor(i / out);
    i %= out;
    output.splice(i++, 0, n);
  }
  return String.fromCodePoint(...output);
};
var encode2 = function(input) {
  const output = [];
  input = ucs2decode(input);
  const inputLength = input.length;
  let n = initialN;
  let delta = 0;
  let bias = initialBias;
  for (const currentValue of input) {
    if (currentValue < 128) {
      output.push(stringFromCharCode(currentValue));
    }
  }
  const basicLength = output.length;
  let handledCPCount = basicLength;
  if (basicLength) {
    output.push(delimiter2);
  }
  while (handledCPCount < inputLength) {
    let m = maxInt;
    for (const currentValue of input) {
      if (currentValue >= n && currentValue < m) {
        m = currentValue;
      }
    }
    const handledCPCountPlusOne = handledCPCount + 1;
    if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
      error("overflow");
    }
    delta += (m - n) * handledCPCountPlusOne;
    n = m;
    for (const currentValue of input) {
      if (currentValue < n && ++delta > maxInt) {
        error("overflow");
      }
      if (currentValue === n) {
        let q = delta;
        for (let k = base;; k += base) {
          const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
          if (q < t) {
            break;
          }
          const qMinusT = q - t;
          const baseMinusT = base - t;
          output.push(stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0)));
          q = floor(qMinusT / baseMinusT);
        }
        output.push(stringFromCharCode(digitToBasic(q, 0)));
        bias = adapt(delta, handledCPCountPlusOne, handledCPCount === basicLength);
        delta = 0;
        ++handledCPCount;
      }
    }
    ++delta;
    ++n;
  }
  return output.join("");
};
var toUnicode = function(input) {
  return mapDomain(input, function(string) {
    return regexPunycode.test(string) ? decode2(string.slice(4).toLowerCase()) : string;
  });
};
var toASCII = function(input) {
  return mapDomain(input, function(string) {
    return regexNonASCII.test(string) ? "xn--" + encode2(string) : string;
  });
};
var punycode = {
  version: "2.3.1",
  ucs2: {
    decode: ucs2decode,
    encode: ucs2encode
  },
  decode: decode2,
  encode: encode2,
  toASCII,
  toUnicode
};
var punycode_es6_default = punycode;

// node_modules/markdown-exit/dist/index.js
var utils_exports = /* @__PURE__ */ __exportAll({
  arrayReplaceAt: () => arrayReplaceAt,
  asciiTrim: () => asciiTrim,
  assign: () => assign2,
  escapeHtml: () => escapeHtml,
  escapeRE: () => escapeRE2,
  fromCodePoint: () => fromCodePoint2,
  has: () => has,
  isMdAsciiPunct: () => isMdAsciiPunct,
  isPromiseLike: () => isPromiseLike,
  isPunctChar: () => isPunctChar,
  isPunctCharCode: () => isPunctCharCode,
  isSpace: () => isSpace,
  isString: () => isString2,
  isValidEntityCode: () => isValidEntityCode,
  isWhiteSpace: () => isWhiteSpace,
  lib: () => lib,
  normalizeReference: () => normalizeReference,
  unescapeAll: () => unescapeAll,
  unescapeMd: () => unescapeMd
});
function isString2(obj) {
  return typeof obj === "string";
}
var _hasOwnProperty = Object.prototype.hasOwnProperty;
function has(object, key) {
  return _hasOwnProperty.call(object, key);
}
function assign2(target, ...sources) {
  for (const s of sources) {
    if (!s)
      continue;
    if (typeof s !== "object")
      throw new TypeError("source must be object");
    Object.assign(target, s);
  }
  return target;
}
function arrayReplaceAt(src, pos, newElements) {
  return src.slice(0, pos).concat(newElements, src.slice(pos + 1));
}
function isValidEntityCode(c) {
  if (c >= 55296 && c <= 57343)
    return false;
  if (c >= 64976 && c <= 65007)
    return false;
  if ((c & 65535) === 65535 || (c & 65535) === 65534)
    return false;
  if (c >= 0 && c <= 8)
    return false;
  if (c === 11)
    return false;
  if (c >= 14 && c <= 31)
    return false;
  if (c >= 127 && c <= 159)
    return false;
  if (c > 1114111)
    return false;
  return true;
}
function fromCodePoint2(c) {
  if (c > 65535) {
    c -= 65536;
    const surrogate1 = 55296 + (c >> 10);
    const surrogate2 = 56320 + (c & 1023);
    return String.fromCharCode(surrogate1, surrogate2);
  }
  return String.fromCharCode(c);
}
var UNESCAPE_MD_RE = /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g;
var UNESCAPE_ALL_RE = new RegExp(`${UNESCAPE_MD_RE.source}|${/&([a-z#][a-z0-9]{1,31});/gi.source}`, "gi");
var DIGITAL_ENTITY_TEST_RE = /^#(x[a-f0-9]{1,8}|\d{1,8})$/i;
function replaceEntityPattern(match, name) {
  if (name.charCodeAt(0) === 35 && DIGITAL_ENTITY_TEST_RE.test(name)) {
    const code$1 = name[1].toLowerCase() === "x" ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
    if (isValidEntityCode(code$1))
      return fromCodePoint2(code$1);
    return match;
  }
  const decoded = decodeHTML(match);
  if (decoded !== match)
    return decoded;
  return match;
}
function unescapeMd(str) {
  if (!str.includes("\\"))
    return str;
  return str.replace(UNESCAPE_MD_RE, "$1");
}
function unescapeAll(str) {
  if (!str.includes("\\") && !str.includes("&"))
    return str;
  return str.replace(UNESCAPE_ALL_RE, (match, escaped, entity$1) => {
    if (escaped)
      return escaped;
    return replaceEntityPattern(match, entity$1);
  });
}
var HTML_ESCAPE_TEST_RE = /[&<>"]/;
var HTML_ESCAPE_REPLACE_RE = /[&<>"]/g;
var HTML_REPLACEMENTS = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;"
};
function replaceUnsafeChar(ch) {
  return HTML_REPLACEMENTS[ch];
}
function escapeHtml(str) {
  if (HTML_ESCAPE_TEST_RE.test(str))
    return str.replace(HTML_ESCAPE_REPLACE_RE, replaceUnsafeChar);
  return str;
}
var REGEXP_ESCAPE_RE = /[.?*+^$[\]\\(){}|-]/g;
function escapeRE2(str) {
  return str.replace(REGEXP_ESCAPE_RE, "\\$&");
}
function isSpace(code$1) {
  switch (code$1) {
    case 9:
    case 32:
      return true;
  }
  return false;
}
function isWhiteSpace(code$1) {
  if (code$1 >= 8192 && code$1 <= 8202)
    return true;
  switch (code$1) {
    case 9:
    case 10:
    case 11:
    case 12:
    case 13:
    case 32:
    case 160:
    case 5760:
    case 8239:
    case 8287:
    case 12288:
      return true;
  }
  return false;
}
function isPunctChar(ch) {
  return regex_default4.test(ch) || regex_default5.test(ch);
}
function isPunctCharCode(code$1) {
  return isPunctChar(fromCodePoint2(code$1));
}
function isMdAsciiPunct(ch) {
  switch (ch) {
    case 33:
    case 34:
    case 35:
    case 36:
    case 37:
    case 38:
    case 39:
    case 40:
    case 41:
    case 42:
    case 43:
    case 44:
    case 45:
    case 46:
    case 47:
    case 58:
    case 59:
    case 60:
    case 61:
    case 62:
    case 63:
    case 64:
    case 91:
    case 92:
    case 93:
    case 94:
    case 95:
    case 96:
    case 123:
    case 124:
    case 125:
    case 126:
      return true;
    default:
      return false;
  }
}
function normalizeReference(str) {
  str = str.trim().replace(/\s+/g, " ");
  if ("ẞ".toLowerCase() === "Ṿ")
    str = str.replace(/ẞ/g, "ß");
  return str.toLowerCase().toUpperCase();
}
function isAsciiTrimmable(c) {
  return c === 32 || c === 9 || c === 10 || c === 13;
}
function asciiTrim(str) {
  let start = 0;
  for (;start < str.length; start++)
    if (!isAsciiTrimmable(str.charCodeAt(start)))
      break;
  let end = str.length - 1;
  for (;end >= start; end--)
    if (!isAsciiTrimmable(str.charCodeAt(end)))
      break;
  return str.slice(start, end + 1);
}
function isPromiseLike(v) {
  return typeof v?.then === "function";
}
var lib = {
  mdurl: exports_mdurl,
  ucmicro: exports_uc
};
var Token = class {
  type;
  tag;
  attrs = null;
  map = null;
  nesting;
  level = 0;
  children = null;
  content = "";
  markup = "";
  info = "";
  meta = null;
  block = false;
  hidden = false;
  constructor(type, tag, nesting) {
    this.type = type;
    this.tag = tag;
    this.nesting = nesting;
  }
  attrIndex(name) {
    if (!this.attrs)
      return -1;
    const attrs = this.attrs;
    for (let i = 0, len = attrs.length;i < len; i++)
      if (attrs[i][0] === name)
        return i;
    return -1;
  }
  attrPush(attrData) {
    if (this.attrs)
      this.attrs.push(attrData);
    else
      this.attrs = [attrData];
  }
  attrSet(name, value) {
    const idx = this.attrIndex(name);
    const attrData = [name, value];
    if (idx < 0)
      this.attrPush(attrData);
    else
      this.attrs[idx] = attrData;
  }
  attrGet(name) {
    const idx = this.attrIndex(name);
    let value = null;
    if (idx >= 0)
      value = this.attrs[idx][1];
    return value;
  }
  attrJoin(name, value) {
    const idx = this.attrIndex(name);
    if (idx < 0)
      this.attrPush([name, value]);
    else
      this.attrs[idx][1] = `${this.attrs[idx][1]} ${value}`;
  }
};
var StateBlock = class {
  src;
  md;
  env;
  tokens;
  bMarks = [];
  eMarks = [];
  tShift = [];
  sCount = [];
  bsCount = [];
  blkIndent = 0;
  line = 0;
  lineMax = 0;
  tight = false;
  ddIndent = -1;
  listIndent = -1;
  parentType = "root";
  level = 0;
  Token = Token;
  constructor(src, md, env, tokens) {
    this.src = src;
    this.md = md;
    this.env = env;
    this.tokens = tokens;
    const s = this.src;
    const len = s.length;
    for (let start = 0;start < len; ) {
      const lineEnd = s.indexOf(`
`, start);
      const end = lineEnd === -1 ? len : lineEnd;
      let indent = 0;
      let offset = 0;
      let pos = start;
      while (pos < end) {
        const ch = s.charCodeAt(pos);
        if (isSpace(ch)) {
          indent++;
          offset += ch === 9 ? 4 - offset % 4 : 1;
          pos++;
          continue;
        }
        break;
      }
      this.bMarks.push(start);
      this.eMarks.push(end);
      this.tShift.push(indent);
      this.sCount.push(offset);
      this.bsCount.push(0);
      start = end + 1;
    }
    this.bMarks.push(s.length);
    this.eMarks.push(s.length);
    this.tShift.push(0);
    this.sCount.push(0);
    this.bsCount.push(0);
    this.lineMax = this.bMarks.length - 1;
  }
  push(type, tag, nesting) {
    const token = new Token(type, tag, nesting);
    token.block = true;
    if (nesting < 0)
      this.level--;
    token.level = this.level;
    if (nesting > 0)
      this.level++;
    this.tokens.push(token);
    return token;
  }
  isEmpty(line) {
    return this.bMarks[line] + this.tShift[line] >= this.eMarks[line];
  }
  skipEmptyLines(from) {
    for (let max = this.lineMax;from < max; from++)
      if (this.bMarks[from] + this.tShift[from] < this.eMarks[from])
        break;
    return from;
  }
  skipSpaces(pos) {
    const src = this.src;
    for (let max = src.length;pos < max; pos++)
      if (!isSpace(src.charCodeAt(pos)))
        break;
    return pos;
  }
  skipSpacesBack(pos, min) {
    if (pos <= min)
      return pos;
    const src = this.src;
    while (pos > min)
      if (!isSpace(src.charCodeAt(--pos)))
        return pos + 1;
    return pos;
  }
  skipChars(pos, code$1) {
    const src = this.src;
    for (let max = src.length;pos < max; pos++)
      if (src.charCodeAt(pos) !== code$1)
        break;
    return pos;
  }
  skipCharsBack(pos, code$1, min) {
    if (pos <= min)
      return pos;
    const src = this.src;
    while (pos > min)
      if (code$1 !== src.charCodeAt(--pos))
        return pos + 1;
    return pos;
  }
  getLines(begin, end, indent, keepLastLF) {
    if (begin >= end)
      return "";
    const queue = new Array(end - begin);
    const src = this.src;
    for (let i = 0, line = begin;line < end; line++, i++) {
      let lineIndent = 0;
      const lineStart = this.bMarks[line];
      let first = lineStart;
      let last;
      if (line + 1 < end || keepLastLF)
        last = this.eMarks[line] + 1;
      else
        last = this.eMarks[line];
      while (first < last && lineIndent < indent) {
        const ch = src.charCodeAt(first);
        if (isSpace(ch))
          if (ch === 9)
            lineIndent += 4 - (lineIndent + this.bsCount[line]) % 4;
          else
            lineIndent++;
        else if (first - lineStart < this.tShift[line])
          lineIndent++;
        else
          break;
        first++;
      }
      if (lineIndent > indent)
        queue[i] = " ".repeat(lineIndent - indent) + this.src.slice(first, last);
      else
        queue[i] = this.src.slice(first, last);
    }
    return queue.join("");
  }
};
var StateCore = class {
  src;
  env;
  tokens = [];
  inlineMode = false;
  md;
  constructor(src, md, env) {
    this.src = src;
    this.env = env;
    this.md = md;
  }
  Token = Token;
};
var StateInline = class {
  src;
  env;
  md;
  tokens;
  tokens_meta;
  pos = 0;
  posMax;
  level = 0;
  pending = "";
  pendingLevel = 0;
  cache = {};
  delimiters = [];
  _prev_delimiters = [];
  backticks = {};
  backticksScanned = false;
  linkLevel = 0;
  constructor(src, md, env, outTokens) {
    this.src = src;
    this.env = env;
    this.md = md;
    this.tokens = outTokens;
    this.tokens_meta = new Array(outTokens.length);
    this.posMax = this.src.length;
  }
  pushPending() {
    const token = new Token("text", "", 0);
    token.content = this.pending;
    token.level = this.pendingLevel;
    this.tokens.push(token);
    this.pending = "";
    return token;
  }
  push(type, tag, nesting) {
    if (this.pending)
      this.pushPending();
    const token = new Token(type, tag, nesting);
    let token_meta = null;
    if (nesting < 0) {
      this.level--;
      this.delimiters = this._prev_delimiters.pop() ?? [];
    }
    token.level = this.level;
    if (nesting > 0) {
      this.level++;
      this._prev_delimiters.push(this.delimiters);
      this.delimiters = [];
      token_meta = { delimiters: this.delimiters };
    }
    this.pendingLevel = this.level;
    this.tokens.push(token);
    this.tokens_meta.push(token_meta);
    return token;
  }
  scanDelims(start, canSplitWord) {
    const src = this.src;
    const max = this.posMax;
    const marker = src.charCodeAt(start);
    let lastChar;
    if (start === 0)
      lastChar = 32;
    else if (start === 1) {
      lastChar = this.src.charCodeAt(0);
      if ((lastChar & 63488) === 55296)
        lastChar = 65533;
    } else {
      lastChar = this.src.charCodeAt(start - 1);
      if ((lastChar & 64512) === 56320) {
        const highSurr = this.src.charCodeAt(start - 2);
        lastChar = (highSurr & 64512) === 55296 ? 65536 + (highSurr - 55296 << 10) + (lastChar - 56320) : 65533;
      } else if ((lastChar & 64512) === 55296)
        lastChar = 65533;
    }
    let pos = start;
    while (pos < max && src.charCodeAt(pos) === marker)
      pos++;
    const count = pos - start;
    let nextChar = pos < max ? this.src.charCodeAt(pos) : 32;
    if ((nextChar & 64512) === 55296) {
      const lowSurr = this.src.charCodeAt(pos + 1);
      nextChar = (lowSurr & 64512) === 56320 ? 65536 + (nextChar - 55296 << 10) + (lowSurr - 56320) : 65533;
    } else if ((nextChar & 64512) === 56320)
      nextChar = 65533;
    const isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctCharCode(lastChar);
    const isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctCharCode(nextChar);
    const isLastWhiteSpace = isWhiteSpace(lastChar);
    const isNextWhiteSpace = isWhiteSpace(nextChar);
    const left_flanking = !isNextWhiteSpace && (!isNextPunctChar || isLastWhiteSpace || isLastPunctChar);
    const right_flanking = !isLastWhiteSpace && (!isLastPunctChar || isNextWhiteSpace || isNextPunctChar);
    return {
      can_open: left_flanking && (canSplitWord || !right_flanking || isLastPunctChar),
      can_close: right_flanking && (canSplitWord || !left_flanking || isNextPunctChar),
      length: count
    };
  }
  Token = Token;
};
var Ruler = class {
  __rules__ = [];
  __cache__ = null;
  __find__(name) {
    for (let i = 0;i < this.__rules__.length; i++)
      if (this.__rules__[i].name === name)
        return i;
    return -1;
  }
  __compile__() {
    const chains = new Set([""]);
    for (const rule of this.__rules__) {
      if (!rule.enabled)
        continue;
      for (const altName of rule.alt)
        chains.add(altName);
    }
    this.__cache__ = {};
    for (const chain of chains) {
      const fns = [];
      for (const rule of this.__rules__) {
        if (!rule.enabled)
          continue;
        if (chain && !rule.alt.includes(chain))
          continue;
        fns.push(rule.fn);
      }
      this.__cache__[chain] = fns;
    }
  }
  at(name, fn, options = {}) {
    const index = this.__find__(name);
    const opt = options || {};
    if (index === -1)
      throw new Error(`Parser rule not found: ${name}`);
    this.__rules__[index].fn = fn;
    this.__rules__[index].alt = opt.alt || [];
    this.__cache__ = null;
  }
  before(beforeName, ruleName, fn, options) {
    const index = this.__find__(beforeName);
    const opt = options || {};
    if (index === -1)
      throw new Error(`Parser rule not found: ${beforeName}`);
    this.__rules__.splice(index, 0, {
      name: ruleName,
      enabled: true,
      fn,
      alt: opt.alt || []
    });
    this.__cache__ = null;
  }
  after(afterName, ruleName, fn, options) {
    const index = this.__find__(afterName);
    const opt = options || {};
    if (index === -1)
      throw new Error(`Parser rule not found: ${afterName}`);
    this.__rules__.splice(index + 1, 0, {
      name: ruleName,
      enabled: true,
      fn,
      alt: opt.alt || []
    });
    this.__cache__ = null;
  }
  push(ruleName, fn, options) {
    const opt = options || {};
    this.__rules__.push({
      name: ruleName,
      enabled: true,
      fn,
      alt: opt.alt || []
    });
    this.__cache__ = null;
  }
  enable(list$1, ignoreInvalid) {
    if (!Array.isArray(list$1))
      list$1 = [list$1];
    const result = [];
    for (const name of list$1) {
      const idx = this.__find__(name);
      if (idx < 0) {
        if (ignoreInvalid)
          continue;
        throw new Error(`Rules manager: invalid rule name ${name}`);
      }
      this.__rules__[idx].enabled = true;
      result.push(name);
    }
    this.__cache__ = null;
    return result;
  }
  enableOnly(list$1, ignoreInvalid) {
    if (!Array.isArray(list$1))
      list$1 = [list$1];
    for (const rule of this.__rules__)
      rule.enabled = false;
    this.enable(list$1, ignoreInvalid);
  }
  disable(list$1, ignoreInvalid) {
    if (!Array.isArray(list$1))
      list$1 = [list$1];
    const result = [];
    for (const name of list$1) {
      const idx = this.__find__(name);
      if (idx < 0) {
        if (ignoreInvalid)
          continue;
        throw new Error(`Rules manager: invalid rule name ${name}`);
      }
      this.__rules__[idx].enabled = false;
      result.push(name);
    }
    this.__cache__ = null;
    return result;
  }
  getRules(chainName) {
    if (this.__cache__ === null)
      this.__compile__();
    return this.__cache__[chainName] || [];
  }
};
function blockquote(state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  const oldLineMax = state.lineMax;
  if (state.sCount[startLine] - state.blkIndent >= 4)
    return false;
  if (state.src.charCodeAt(pos) !== 62)
    return false;
  if (silent)
    return true;
  const oldBMarks = [];
  const oldBSCount = [];
  const oldSCount = [];
  const oldTShift = [];
  const terminatorRules = state.md.block.ruler.getRules("blockquote");
  const oldParentType = state.parentType;
  state.parentType = "blockquote";
  let lastLineEmpty = false;
  let nextLine;
  for (nextLine = startLine;nextLine < endLine; nextLine++) {
    const isOutdented = state.sCount[nextLine] < state.blkIndent;
    pos = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];
    if (pos >= max)
      break;
    if (state.src.charCodeAt(pos++) === 62 && !isOutdented) {
      let initial = state.sCount[nextLine] + 1;
      let spaceAfterMarker;
      let adjustTab;
      if (state.src.charCodeAt(pos) === 32) {
        pos++;
        initial++;
        adjustTab = false;
        spaceAfterMarker = true;
      } else if (state.src.charCodeAt(pos) === 9) {
        spaceAfterMarker = true;
        if ((state.bsCount[nextLine] + initial) % 4 === 3) {
          pos++;
          initial++;
          adjustTab = false;
        } else
          adjustTab = true;
      } else
        spaceAfterMarker = false;
      let offset = initial;
      oldBMarks.push(state.bMarks[nextLine]);
      state.bMarks[nextLine] = pos;
      while (pos < max) {
        const ch = state.src.charCodeAt(pos);
        if (isSpace(ch))
          if (ch === 9)
            offset += 4 - (offset + state.bsCount[nextLine] + (adjustTab ? 1 : 0)) % 4;
          else
            offset++;
        else
          break;
        pos++;
      }
      lastLineEmpty = pos >= max;
      oldBSCount.push(state.bsCount[nextLine]);
      state.bsCount[nextLine] = state.sCount[nextLine] + 1 + (spaceAfterMarker ? 1 : 0);
      oldSCount.push(state.sCount[nextLine]);
      state.sCount[nextLine] = offset - initial;
      oldTShift.push(state.tShift[nextLine]);
      state.tShift[nextLine] = pos - state.bMarks[nextLine];
      continue;
    }
    if (lastLineEmpty)
      break;
    let terminate = false;
    for (let i = 0, l = terminatorRules.length;i < l; i++)
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break;
      }
    if (terminate) {
      state.lineMax = nextLine;
      if (state.blkIndent !== 0) {
        oldBMarks.push(state.bMarks[nextLine]);
        oldBSCount.push(state.bsCount[nextLine]);
        oldTShift.push(state.tShift[nextLine]);
        oldSCount.push(state.sCount[nextLine]);
        state.sCount[nextLine] -= state.blkIndent;
      }
      break;
    }
    oldBMarks.push(state.bMarks[nextLine]);
    oldBSCount.push(state.bsCount[nextLine]);
    oldTShift.push(state.tShift[nextLine]);
    oldSCount.push(state.sCount[nextLine]);
    state.sCount[nextLine] = -1;
  }
  const oldIndent = state.blkIndent;
  state.blkIndent = 0;
  const token_o = state.push("blockquote_open", "blockquote", 1);
  token_o.markup = ">";
  const lines = [startLine, 0];
  token_o.map = lines;
  state.md.block.tokenize(state, startLine, nextLine);
  const token_c = state.push("blockquote_close", "blockquote", -1);
  token_c.markup = ">";
  state.lineMax = oldLineMax;
  state.parentType = oldParentType;
  lines[1] = state.line;
  for (let i = 0;i < oldTShift.length; i++) {
    state.bMarks[i + startLine] = oldBMarks[i];
    state.tShift[i + startLine] = oldTShift[i];
    state.sCount[i + startLine] = oldSCount[i];
    state.bsCount[i + startLine] = oldBSCount[i];
  }
  state.blkIndent = oldIndent;
  return true;
}
function code(state, startLine, endLine) {
  if (state.sCount[startLine] - state.blkIndent < 4)
    return false;
  let nextLine = startLine + 1;
  let last = nextLine;
  while (nextLine < endLine) {
    if (state.isEmpty(nextLine)) {
      nextLine++;
      continue;
    }
    if (state.sCount[nextLine] - state.blkIndent >= 4) {
      nextLine++;
      last = nextLine;
      continue;
    }
    break;
  }
  state.line = last;
  const token = state.push("code_block", "code", 0);
  token.content = `${state.getLines(startLine, last, 4 + state.blkIndent, false)}
`;
  token.map = [startLine, state.line];
  return true;
}
function fence(state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4)
    return false;
  if (pos + 3 > max)
    return false;
  const marker = state.src.charCodeAt(pos);
  if (marker !== 126 && marker !== 96)
    return false;
  let mem = pos;
  pos = state.skipChars(pos, marker);
  let len = pos - mem;
  if (len < 3)
    return false;
  const markup = state.src.slice(mem, pos);
  const params = state.src.slice(pos, max);
  if (marker === 96) {
    if (params.includes(String.fromCharCode(marker)))
      return false;
  }
  if (silent)
    return true;
  let nextLine = startLine;
  let haveEndMarker = false;
  for (;; ) {
    nextLine++;
    if (nextLine >= endLine)
      break;
    pos = mem = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];
    if (pos < max && state.sCount[nextLine] < state.blkIndent)
      break;
    if (state.src.charCodeAt(pos) !== marker)
      continue;
    if (state.sCount[nextLine] - state.blkIndent >= 4)
      continue;
    pos = state.skipChars(pos, marker);
    if (pos - mem < len)
      continue;
    pos = state.skipSpaces(pos);
    if (pos < max)
      continue;
    haveEndMarker = true;
    break;
  }
  len = state.sCount[startLine];
  state.line = nextLine + (haveEndMarker ? 1 : 0);
  const token = state.push("fence", "code", 0);
  token.info = params;
  token.content = state.getLines(startLine + 1, nextLine, len, true);
  token.markup = markup;
  token.map = [startLine, state.line];
  return true;
}
function heading2(state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4)
    return false;
  let ch = state.src.charCodeAt(pos);
  if (ch !== 35 || pos >= max)
    return false;
  let level = 1;
  ch = state.src.charCodeAt(++pos);
  while (ch === 35 && pos < max && level <= 6) {
    level++;
    ch = state.src.charCodeAt(++pos);
  }
  if (level > 6 || pos < max && !isSpace(ch))
    return false;
  if (silent)
    return true;
  max = state.skipSpacesBack(max, pos);
  const tmp = state.skipCharsBack(max, 35, pos);
  if (tmp > pos && isSpace(state.src.charCodeAt(tmp - 1)))
    max = tmp;
  state.line = startLine + 1;
  const token_o = state.push("heading_open", `h${String(level)}`, 1);
  token_o.markup = "########".slice(0, level);
  token_o.map = [startLine, state.line];
  const token_i = state.push("inline", "", 0);
  token_i.content = asciiTrim(state.src.slice(pos, max));
  token_i.map = [startLine, state.line];
  token_i.children = [];
  const token_c = state.push("heading_close", `h${String(level)}`, -1);
  token_c.markup = "########".slice(0, level);
  return true;
}
function hr(state, startLine, endLine, silent) {
  const max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4)
    return false;
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  const marker = state.src.charCodeAt(pos++);
  if (marker !== 42 && marker !== 45 && marker !== 95)
    return false;
  let cnt = 1;
  while (pos < max) {
    const ch = state.src.charCodeAt(pos++);
    if (ch !== marker && !isSpace(ch))
      return false;
    if (ch === marker)
      cnt++;
  }
  if (cnt < 3)
    return false;
  if (silent)
    return true;
  state.line = startLine + 1;
  const token = state.push("hr", "hr", 0);
  token.map = [startLine, state.line];
  token.markup = String.fromCharCode(marker).repeat(cnt);
  return true;
}
var html_blocks_default = [
  "address",
  "article",
  "aside",
  "base",
  "basefont",
  "blockquote",
  "body",
  "caption",
  "center",
  "col",
  "colgroup",
  "dd",
  "details",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "frame",
  "frameset",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hr",
  "html",
  "iframe",
  "legend",
  "li",
  "link",
  "main",
  "menu",
  "menuitem",
  "nav",
  "noframes",
  "ol",
  "optgroup",
  "option",
  "p",
  "param",
  "search",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "title",
  "tr",
  "track",
  "ul"
];
var open_tag = `<[A-Za-z][A-Za-z0-9\\-]*(?:\\s+[a-zA-Z_:][a-zA-Z0-9:._-]*(?:\\s*=\\s*(?:[^"'=<>\`\\x00-\\x20]+|'[^']*'|"[^"]*"))?)*\\s*\\/?>`;
var close_tag = "<\\/[A-Za-z][A-Za-z0-9\\-]*\\s*>";
var HTML_TAG_RE = /* @__PURE__ */ new RegExp(`^(?:${open_tag}|${close_tag}|<!---?>|<!--(?:[^-]|-[^-]|--[^>])*-->|<\\?[\\s\\S]*?\\?>|<![A-Za-z][^>]*>|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>)`);
var HTML_OPEN_CLOSE_TAG_RE = /* @__PURE__ */ new RegExp(`^(?:${open_tag}|${close_tag})`);
var HTML_SEQUENCES = [
  [
    /^<(script|pre|style|textarea)(?=(\s|>|$))/i,
    /<\/(script|pre|style|textarea)>/i,
    true
  ],
  [
    /^<!--/,
    /-->/,
    true
  ],
  [
    /^<\?/,
    /\?>/,
    true
  ],
  [
    /^<![A-Z]/,
    />/,
    true
  ],
  [
    /^<!\[CDATA\[/,
    /\]\]>/,
    true
  ],
  [
    new RegExp(`^</?(${html_blocks_default.join("|")})(?=(\\s|/?>|$))`, "i"),
    /^$/,
    true
  ],
  [
    /* @__PURE__ */ new RegExp(`${HTML_OPEN_CLOSE_TAG_RE.source}\\s*$`),
    /^$/,
    false
  ]
];
function html_block(state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4)
    return false;
  if (!state.md.options.html)
    return false;
  if (state.src.charCodeAt(pos) !== 60)
    return false;
  let lineText = state.src.slice(pos, max);
  let i = 0;
  for (;i < HTML_SEQUENCES.length; i++)
    if (HTML_SEQUENCES[i][0].test(lineText))
      break;
  if (i === HTML_SEQUENCES.length)
    return false;
  if (silent)
    return HTML_SEQUENCES[i][2];
  let nextLine = startLine + 1;
  const endsOnBlankLine = HTML_SEQUENCES[i][1].test("");
  if (!HTML_SEQUENCES[i][1].test(lineText))
    for (;nextLine < endLine; nextLine++) {
      if (state.sCount[nextLine] < state.blkIndent) {
        if (endsOnBlankLine || !state.isEmpty(nextLine))
          break;
      }
      pos = state.bMarks[nextLine] + state.tShift[nextLine];
      max = state.eMarks[nextLine];
      lineText = state.src.slice(pos, max);
      if (HTML_SEQUENCES[i][1].test(lineText)) {
        if (lineText.length !== 0)
          nextLine++;
        break;
      }
    }
  state.line = nextLine;
  const token = state.push("html_block", "", 0);
  token.map = [startLine, nextLine];
  token.content = state.getLines(startLine, nextLine, state.blkIndent, true);
  return true;
}
function lheading(state, startLine, endLine) {
  const terminatorRules = state.md.block.ruler.getRules("paragraph");
  if (state.sCount[startLine] - state.blkIndent >= 4)
    return false;
  const oldParentType = state.parentType;
  state.parentType = "paragraph";
  let level = 0;
  let marker;
  let nextLine = startLine + 1;
  for (;nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
    if (state.sCount[nextLine] - state.blkIndent > 3)
      continue;
    if (state.sCount[nextLine] >= state.blkIndent) {
      let pos = state.bMarks[nextLine] + state.tShift[nextLine];
      const max = state.eMarks[nextLine];
      if (pos < max) {
        marker = state.src.charCodeAt(pos);
        if (marker === 45 || marker === 61) {
          pos = state.skipChars(pos, marker);
          pos = state.skipSpaces(pos);
          if (pos >= max) {
            level = marker === 61 ? 1 : 2;
            break;
          }
        }
      }
    }
    if (state.sCount[nextLine] < 0)
      continue;
    let terminate = false;
    for (let i = 0, l = terminatorRules.length;i < l; i++)
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break;
      }
    if (terminate)
      break;
  }
  if (!level || marker === undefined) {
    state.parentType = oldParentType;
    return false;
  }
  const content = asciiTrim(state.getLines(startLine, nextLine, state.blkIndent, false));
  state.line = nextLine + 1;
  const token_o = state.push("heading_open", `h${String(level)}`, 1);
  token_o.markup = String.fromCharCode(marker);
  token_o.map = [startLine, state.line];
  const token_i = state.push("inline", "", 0);
  token_i.content = content;
  token_i.map = [startLine, state.line - 1];
  token_i.children = [];
  const token_c = state.push("heading_close", `h${String(level)}`, -1);
  token_c.markup = String.fromCharCode(marker);
  state.parentType = oldParentType;
  return true;
}
function skipBulletListMarker(state, startLine) {
  const max = state.eMarks[startLine];
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  const marker = state.src.charCodeAt(pos++);
  if (marker !== 42 && marker !== 45 && marker !== 43)
    return -1;
  if (pos < max) {
    if (!isSpace(state.src.charCodeAt(pos)))
      return -1;
  }
  return pos;
}
function skipOrderedListMarker(state, startLine) {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  let pos = start;
  if (pos + 1 >= max)
    return -1;
  let ch = state.src.charCodeAt(pos++);
  if (ch < 48 || ch > 57)
    return -1;
  for (;; ) {
    if (pos >= max)
      return -1;
    ch = state.src.charCodeAt(pos++);
    if (ch >= 48 && ch <= 57) {
      if (pos - start >= 10)
        return -1;
      continue;
    }
    if (ch === 41 || ch === 46)
      break;
    return -1;
  }
  if (pos < max) {
    ch = state.src.charCodeAt(pos);
    if (!isSpace(ch))
      return -1;
  }
  return pos;
}
function markTightParagraphs(state, idx) {
  const level = state.level + 2;
  for (let i = idx + 2, l = state.tokens.length - 2;i < l; i++)
    if (state.tokens[i].level === level && state.tokens[i].type === "paragraph_open") {
      state.tokens[i + 2].hidden = true;
      state.tokens[i].hidden = true;
      i += 2;
    }
}
function list(state, startLine, endLine, silent) {
  let max, pos, start, token;
  let nextLine = startLine;
  let tight = true;
  if (state.sCount[nextLine] - state.blkIndent >= 4)
    return false;
  if (state.listIndent >= 0 && state.sCount[nextLine] - state.listIndent >= 4 && state.sCount[nextLine] < state.blkIndent)
    return false;
  let isTerminatingParagraph = false;
  if (silent && state.parentType === "paragraph") {
    if (state.sCount[nextLine] >= state.blkIndent)
      isTerminatingParagraph = true;
  }
  let isOrdered;
  let markerValue;
  let posAfterMarker = skipOrderedListMarker(state, nextLine);
  if (posAfterMarker >= 0) {
    isOrdered = true;
    start = state.bMarks[nextLine] + state.tShift[nextLine];
    markerValue = Number(state.src.slice(start, posAfterMarker - 1));
    if (isTerminatingParagraph && markerValue !== 1)
      return false;
  } else {
    posAfterMarker = skipBulletListMarker(state, nextLine);
    if (posAfterMarker >= 0)
      isOrdered = false;
    else
      return false;
  }
  if (isTerminatingParagraph) {
    if (state.skipSpaces(posAfterMarker) >= state.eMarks[nextLine])
      return false;
  }
  if (silent)
    return true;
  const markerCharCode = state.src.charCodeAt(posAfterMarker - 1);
  const listTokIdx = state.tokens.length;
  if (isOrdered) {
    token = state.push("ordered_list_open", "ol", 1);
    if (markerValue !== 1)
      token.attrs = [["start", markerValue.toString()]];
  } else
    token = state.push("bullet_list_open", "ul", 1);
  const listLines = [nextLine, 0];
  token.map = listLines;
  token.markup = String.fromCharCode(markerCharCode);
  let prevEmptyEnd = false;
  const terminatorRules = state.md.block.ruler.getRules("list");
  const oldParentType = state.parentType;
  state.parentType = "list";
  while (nextLine < endLine) {
    pos = posAfterMarker;
    max = state.eMarks[nextLine];
    const initial = state.sCount[nextLine] + posAfterMarker - (state.bMarks[nextLine] + state.tShift[nextLine]);
    let offset = initial;
    while (pos < max) {
      const ch = state.src.charCodeAt(pos);
      if (ch === 9)
        offset += 4 - (offset + state.bsCount[nextLine]) % 4;
      else if (ch === 32)
        offset++;
      else
        break;
      pos++;
    }
    const contentStart = pos;
    let indentAfterMarker;
    if (contentStart >= max)
      indentAfterMarker = 1;
    else
      indentAfterMarker = offset - initial;
    if (indentAfterMarker > 4)
      indentAfterMarker = 1;
    const indent = initial + indentAfterMarker;
    token = state.push("list_item_open", "li", 1);
    token.markup = String.fromCharCode(markerCharCode);
    const itemLines = [nextLine, 0];
    token.map = itemLines;
    if (isOrdered)
      token.info = state.src.slice(start, posAfterMarker - 1);
    const oldTight = state.tight;
    const oldTShift = state.tShift[nextLine];
    const oldSCount = state.sCount[nextLine];
    const oldListIndent = state.listIndent;
    state.listIndent = state.blkIndent;
    state.blkIndent = indent;
    state.tight = true;
    state.tShift[nextLine] = contentStart - state.bMarks[nextLine];
    state.sCount[nextLine] = offset;
    if (contentStart >= max && state.isEmpty(nextLine + 1))
      state.line = Math.min(state.line + 2, endLine);
    else
      state.md.block.tokenize(state, nextLine, endLine, true);
    if (!state.tight || prevEmptyEnd)
      tight = false;
    prevEmptyEnd = state.line - nextLine > 1 && state.isEmpty(state.line - 1);
    state.blkIndent = state.listIndent;
    state.listIndent = oldListIndent;
    state.tShift[nextLine] = oldTShift;
    state.sCount[nextLine] = oldSCount;
    state.tight = oldTight;
    token = state.push("list_item_close", "li", -1);
    token.markup = String.fromCharCode(markerCharCode);
    nextLine = state.line;
    itemLines[1] = nextLine;
    if (nextLine >= endLine)
      break;
    if (state.sCount[nextLine] < state.blkIndent)
      break;
    if (state.sCount[nextLine] - state.blkIndent >= 4)
      break;
    let terminate = false;
    for (let i = 0, l = terminatorRules.length;i < l; i++)
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break;
      }
    if (terminate)
      break;
    if (isOrdered) {
      posAfterMarker = skipOrderedListMarker(state, nextLine);
      if (posAfterMarker < 0)
        break;
      start = state.bMarks[nextLine] + state.tShift[nextLine];
    } else {
      posAfterMarker = skipBulletListMarker(state, nextLine);
      if (posAfterMarker < 0)
        break;
    }
    if (markerCharCode !== state.src.charCodeAt(posAfterMarker - 1))
      break;
  }
  if (isOrdered)
    token = state.push("ordered_list_close", "ol", -1);
  else
    token = state.push("bullet_list_close", "ul", -1);
  token.markup = String.fromCharCode(markerCharCode);
  listLines[1] = nextLine;
  state.line = nextLine;
  state.parentType = oldParentType;
  if (tight)
    markTightParagraphs(state, listTokIdx);
  return true;
}
function paragraph2(state, startLine, endLine) {
  const terminatorRules = state.md.block.ruler.getRules("paragraph");
  const oldParentType = state.parentType;
  let nextLine = startLine + 1;
  state.parentType = "paragraph";
  for (;nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
    if (state.sCount[nextLine] - state.blkIndent > 3)
      continue;
    if (state.sCount[nextLine] < 0)
      continue;
    let terminate = false;
    for (let i = 0, l = terminatorRules.length;i < l; i++)
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break;
      }
    if (terminate)
      break;
  }
  const content = asciiTrim(state.getLines(startLine, nextLine, state.blkIndent, false));
  state.line = nextLine;
  const token_o = state.push("paragraph_open", "p", 1);
  token_o.map = [startLine, state.line];
  const token_i = state.push("inline", "", 0);
  token_i.content = content;
  token_i.map = [startLine, state.line];
  token_i.children = [];
  state.push("paragraph_close", "p", -1);
  state.parentType = oldParentType;
  return true;
}
function reference(state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  let nextLine = startLine + 1;
  if (state.sCount[startLine] - state.blkIndent >= 4)
    return false;
  if (state.src.charCodeAt(pos) !== 91)
    return false;
  function getNextLine(nextLine$1) {
    const endLine$1 = state.lineMax;
    if (nextLine$1 >= endLine$1 || state.isEmpty(nextLine$1))
      return null;
    let isContinuation = false;
    if (state.sCount[nextLine$1] - state.blkIndent > 3)
      isContinuation = true;
    if (state.sCount[nextLine$1] < 0)
      isContinuation = true;
    if (!isContinuation) {
      const terminatorRules = state.md.block.ruler.getRules("reference");
      const oldParentType = state.parentType;
      state.parentType = "reference";
      let terminate = false;
      for (let i = 0, l = terminatorRules.length;i < l; i++)
        if (terminatorRules[i](state, nextLine$1, endLine$1, true)) {
          terminate = true;
          break;
        }
      state.parentType = oldParentType;
      if (terminate)
        return null;
    }
    const pos$1 = state.bMarks[nextLine$1] + state.tShift[nextLine$1];
    const max$1 = state.eMarks[nextLine$1];
    return state.src.slice(pos$1, max$1 + 1);
  }
  let str = state.src.slice(pos, max + 1);
  max = str.length;
  let labelEnd = -1;
  for (pos = 1;pos < max; pos++) {
    const ch = str.charCodeAt(pos);
    if (ch === 91)
      return false;
    else if (ch === 93) {
      labelEnd = pos;
      break;
    } else if (ch === 10) {
      const lineContent = getNextLine(nextLine);
      if (lineContent !== null) {
        str += lineContent;
        max = str.length;
        nextLine++;
      }
    } else if (ch === 92) {
      pos++;
      if (pos < max && str.charCodeAt(pos) === 10) {
        const lineContent = getNextLine(nextLine);
        if (lineContent !== null) {
          str += lineContent;
          max = str.length;
          nextLine++;
        }
      }
    }
  }
  if (labelEnd < 0 || str.charCodeAt(labelEnd + 1) !== 58)
    return false;
  for (pos = labelEnd + 2;pos < max; pos++) {
    const ch = str.charCodeAt(pos);
    if (ch === 10) {
      const lineContent = getNextLine(nextLine);
      if (lineContent !== null) {
        str += lineContent;
        max = str.length;
        nextLine++;
      }
    } else if (isSpace(ch)) {} else
      break;
  }
  const destRes = state.md.helpers.parseLinkDestination(str, pos, max);
  if (!destRes.ok)
    return false;
  const href = state.md.normalizeLink(destRes.str);
  if (!state.md.validateLink(href))
    return false;
  pos = destRes.pos;
  const destEndPos = pos;
  const destEndLineNo = nextLine;
  const start = pos;
  for (;pos < max; pos++) {
    const ch = str.charCodeAt(pos);
    if (ch === 10) {
      const lineContent = getNextLine(nextLine);
      if (lineContent !== null) {
        str += lineContent;
        max = str.length;
        nextLine++;
      }
    } else if (isSpace(ch)) {} else
      break;
  }
  let titleRes = state.md.helpers.parseLinkTitle(str, pos, max);
  while (titleRes.can_continue) {
    const lineContent = getNextLine(nextLine);
    if (lineContent === null)
      break;
    str += lineContent;
    pos = max;
    max = str.length;
    nextLine++;
    titleRes = state.md.helpers.parseLinkTitle(str, pos, max, titleRes);
  }
  let title;
  if (pos < max && start !== pos && titleRes.ok) {
    title = titleRes.str;
    pos = titleRes.pos;
  } else {
    title = "";
    pos = destEndPos;
    nextLine = destEndLineNo;
  }
  while (pos < max) {
    if (!isSpace(str.charCodeAt(pos)))
      break;
    pos++;
  }
  if (pos < max && str.charCodeAt(pos) !== 10) {
    if (title) {
      title = "";
      pos = destEndPos;
      nextLine = destEndLineNo;
      while (pos < max) {
        if (!isSpace(str.charCodeAt(pos)))
          break;
        pos++;
      }
    }
  }
  if (pos < max && str.charCodeAt(pos) !== 10)
    return false;
  const label = normalizeReference(str.slice(1, labelEnd));
  if (!label)
    return false;
  if (silent)
    return true;
  if (typeof state.env.references === "undefined")
    state.env.references = {};
  if (typeof state.env.references[label] === "undefined")
    state.env.references[label] = {
      title,
      href
    };
  state.line = nextLine;
  const token = state.push("reference", "", 0);
  token.map = [startLine, state.line];
  token.info = label;
  token.meta = {
    title,
    href
  };
  return true;
}
var MAX_AUTOCOMPLETED_CELLS = 65536;
function getLine(state, line) {
  const pos = state.bMarks[line] + state.tShift[line];
  const max = state.eMarks[line];
  return state.src.slice(pos, max);
}
function escapedSplit(str) {
  const result = [];
  const max = str.length;
  let pos = 0;
  let ch = str.charCodeAt(pos);
  let isEscaped = false;
  let lastPos = 0;
  let current = "";
  while (pos < max) {
    if (ch === 124)
      if (!isEscaped) {
        result.push(current + str.substring(lastPos, pos));
        current = "";
        lastPos = pos + 1;
      } else {
        current += str.substring(lastPos, pos - 1);
        lastPos = pos;
      }
    isEscaped = ch === 92;
    pos++;
    ch = str.charCodeAt(pos);
  }
  result.push(current + str.substring(lastPos));
  return result;
}
function table(state, startLine, endLine, silent) {
  if (startLine + 2 > endLine)
    return false;
  let nextLine = startLine + 1;
  if (state.sCount[nextLine] < state.blkIndent)
    return false;
  if (state.sCount[nextLine] - state.blkIndent >= 4)
    return false;
  let pos = state.bMarks[nextLine] + state.tShift[nextLine];
  if (pos >= state.eMarks[nextLine])
    return false;
  const firstCh = state.src.charCodeAt(pos++);
  if (firstCh !== 124 && firstCh !== 45 && firstCh !== 58)
    return false;
  if (pos >= state.eMarks[nextLine])
    return false;
  const secondCh = state.src.charCodeAt(pos++);
  if (secondCh !== 124 && secondCh !== 45 && secondCh !== 58 && !isSpace(secondCh))
    return false;
  if (firstCh === 45 && isSpace(secondCh))
    return false;
  while (pos < state.eMarks[nextLine]) {
    const ch = state.src.charCodeAt(pos);
    if (ch !== 124 && ch !== 45 && ch !== 58 && !isSpace(ch))
      return false;
    pos++;
  }
  let lineText = getLine(state, startLine + 1);
  let columns = lineText.split("|");
  const aligns = [];
  for (let i = 0;i < columns.length; i++) {
    const t = columns[i].trim();
    if (!t)
      if (i === 0 || i === columns.length - 1)
        continue;
      else
        return false;
    if (!/^:?-+:?$/.test(t))
      return false;
    if (t.charCodeAt(t.length - 1) === 58)
      aligns.push(t.charCodeAt(0) === 58 ? "center" : "right");
    else if (t.charCodeAt(0) === 58)
      aligns.push("left");
    else
      aligns.push("");
  }
  lineText = getLine(state, startLine).trim();
  if (!lineText.includes("|"))
    return false;
  if (state.sCount[startLine] - state.blkIndent >= 4)
    return false;
  columns = escapedSplit(lineText);
  if (columns.length && columns[0] === "")
    columns.shift();
  if (columns.length && columns[columns.length - 1] === "")
    columns.pop();
  const columnCount = columns.length;
  if (columnCount === 0 || columnCount !== aligns.length)
    return false;
  if (silent)
    return true;
  const oldParentType = state.parentType;
  state.parentType = "table";
  const terminatorRules = state.md.block.ruler.getRules("blockquote");
  const token_to = state.push("table_open", "table", 1);
  const tableLines = [startLine, 0];
  token_to.map = tableLines;
  const token_tho = state.push("thead_open", "thead", 1);
  token_tho.map = [startLine, startLine + 1];
  const token_htro = state.push("tr_open", "tr", 1);
  token_htro.map = [startLine, startLine + 1];
  for (let i = 0;i < columns.length; i++) {
    const token_ho = state.push("th_open", "th", 1);
    if (aligns[i])
      token_ho.attrs = [["style", `text-align:${aligns[i]}`]];
    const token_il = state.push("inline", "", 0);
    token_il.content = columns[i].trim();
    token_il.children = [];
    state.push("th_close", "th", -1);
  }
  state.push("tr_close", "tr", -1);
  state.push("thead_close", "thead", -1);
  let tbodyLines;
  let autocompletedCells = 0;
  for (nextLine = startLine + 2;nextLine < endLine; nextLine++) {
    if (state.sCount[nextLine] < state.blkIndent)
      break;
    let terminate = false;
    for (let i = 0, l = terminatorRules.length;i < l; i++)
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break;
      }
    if (terminate)
      break;
    lineText = getLine(state, nextLine).trim();
    if (!lineText)
      break;
    if (state.sCount[nextLine] - state.blkIndent >= 4)
      break;
    columns = escapedSplit(lineText);
    if (columns.length && columns[0] === "")
      columns.shift();
    if (columns.length && columns[columns.length - 1] === "")
      columns.pop();
    autocompletedCells += columnCount - columns.length;
    if (autocompletedCells > MAX_AUTOCOMPLETED_CELLS)
      break;
    if (nextLine === startLine + 2) {
      const token_tbo = state.push("tbody_open", "tbody", 1);
      token_tbo.map = tbodyLines = [startLine + 2, 0];
    }
    const token_tro = state.push("tr_open", "tr", 1);
    token_tro.map = [nextLine, nextLine + 1];
    for (let i = 0;i < columnCount; i++) {
      const token_tdo = state.push("td_open", "td", 1);
      if (aligns[i])
        token_tdo.attrs = [["style", `text-align:${aligns[i]}`]];
      const token_il = state.push("inline", "", 0);
      token_il.content = columns[i] ? columns[i].trim() : "";
      token_il.children = [];
      state.push("td_close", "td", -1);
    }
    state.push("tr_close", "tr", -1);
  }
  if (tbodyLines) {
    state.push("tbody_close", "tbody", -1);
    tbodyLines[1] = nextLine;
  }
  state.push("table_close", "table", -1);
  tableLines[1] = nextLine;
  state.parentType = oldParentType;
  state.line = nextLine;
  return true;
}
var _rules$2 = [
  [
    "table",
    table,
    ["paragraph", "reference"]
  ],
  ["code", code],
  [
    "fence",
    fence,
    [
      "paragraph",
      "reference",
      "blockquote",
      "list"
    ]
  ],
  [
    "blockquote",
    blockquote,
    [
      "paragraph",
      "reference",
      "blockquote",
      "list"
    ]
  ],
  [
    "hr",
    hr,
    [
      "paragraph",
      "reference",
      "blockquote",
      "list"
    ]
  ],
  [
    "list",
    list,
    [
      "paragraph",
      "reference",
      "blockquote"
    ]
  ],
  ["reference", reference],
  [
    "html_block",
    html_block,
    [
      "paragraph",
      "reference",
      "blockquote"
    ]
  ],
  [
    "heading",
    heading2,
    [
      "paragraph",
      "reference",
      "blockquote"
    ]
  ],
  ["lheading", lheading],
  ["paragraph", paragraph2]
];
var ParserBlock = class {
  ruler;
  constructor() {
    this.ruler = new Ruler;
    for (let i = 0;i < _rules$2.length; i++)
      this.ruler.push(_rules$2[i][0], _rules$2[i][1], { alt: (_rules$2[i][2] || []).slice() });
  }
  tokenize(state, startLine, endLine, silent) {
    const rules = this.ruler.getRules("");
    const len = rules.length;
    const maxNesting = state.md.options.maxNesting;
    let line = startLine;
    let hasEmptyLines = false;
    while (line < endLine) {
      state.line = line = state.skipEmptyLines(line);
      if (line >= endLine)
        break;
      if (state.sCount[line] < state.blkIndent)
        break;
      if (state.level >= maxNesting) {
        state.line = endLine;
        break;
      }
      const prevLine = state.line;
      let ok = false;
      for (let i = 0;i < len; i++) {
        ok = rules[i](state, line, endLine, false);
        if (ok) {
          if (prevLine >= state.line)
            throw new Error("block rule didn't increment state.line");
          break;
        }
      }
      if (!ok)
        throw new Error("none of the block rules matched");
      state.tight = !hasEmptyLines;
      if (state.isEmpty(state.line - 1))
        hasEmptyLines = true;
      line = state.line;
      if (line < endLine && state.isEmpty(line)) {
        hasEmptyLines = true;
        line++;
        state.line = line;
      }
    }
  }
  parse(src, md, env, outTokens) {
    if (!src)
      return;
    const state = new this.State(src, md, env, outTokens);
    this.tokenize(state, state.line, state.lineMax);
  }
  State = StateBlock;
};
function block(state) {
  let token;
  if (state.inlineMode) {
    token = new state.Token("inline", "", 0);
    token.content = state.src;
    token.map = [0, 1];
    token.children = [];
    state.tokens.push(token);
  } else
    state.md.block.parse(state.src, state.md, state.env, state.tokens);
}
function inline(state) {
  const tokens = state.tokens;
  for (let i = 0, l = tokens.length;i < l; i++) {
    const tok = tokens[i];
    if (tok.type === "inline")
      state.md.inline.parse(tok.content, state.md, state.env, tok.children);
  }
}
function isLinkOpen$1(str) {
  return /^<a[>\s]/i.test(str);
}
function isLinkClose$1(str) {
  return /^<\/a\s*>/i.test(str);
}
function linkify$1(state) {
  if (!state.md.options.linkify)
    return;
  const blockTokens = state.tokens;
  const linkify$2 = state.md.linkify;
  for (let j = 0, l = blockTokens.length;j < l; j++) {
    if (blockTokens[j].type !== "inline" || !linkify$2.pretest(blockTokens[j].content))
      continue;
    const tokens = blockTokens[j].children;
    let htmlLinkLevel = 0;
    for (let i = tokens.length - 1;i >= 0; i--) {
      const currentToken = tokens[i];
      if (currentToken.type === "link_close") {
        i--;
        while (tokens[i].level !== currentToken.level && tokens[i].type !== "link_open")
          i--;
        continue;
      }
      if (currentToken.type === "html_inline") {
        if (isLinkOpen$1(currentToken.content) && htmlLinkLevel > 0)
          htmlLinkLevel--;
        if (isLinkClose$1(currentToken.content))
          htmlLinkLevel++;
      }
      if (htmlLinkLevel > 0)
        continue;
      if (currentToken.type === "text") {
        const text$1 = currentToken.content;
        if (!linkify$2.pretest(text$1))
          continue;
        const links = linkify$2.match(text$1);
        if (!links?.length)
          continue;
        const nodes = [];
        let level = currentToken.level;
        let lastPos = 0;
        const startFrom = links[0].index === 0 && i > 0 && tokens[i - 1].type === "text_special" ? 1 : 0;
        for (let ln = startFrom;ln < links.length; ln++) {
          const link$1 = links[ln];
          const fullUrl = state.md.normalizeLink(link$1.url);
          if (!state.md.validateLink(fullUrl))
            continue;
          let urlText = link$1.text;
          if (!link$1.schema)
            urlText = state.md.normalizeLinkText(`http://${urlText}`).replace(/^http:\/\//, "");
          else if (link$1.schema === "mailto:" && !/^mailto:/i.test(urlText))
            urlText = state.md.normalizeLinkText(`mailto:${urlText}`).replace(/^mailto:/, "");
          else
            urlText = state.md.normalizeLinkText(urlText);
          const pos = link$1.index;
          if (pos > lastPos) {
            const token = new state.Token("text", "", 0);
            token.content = text$1.slice(lastPos, pos);
            token.level = level;
            nodes.push(token);
          }
          const token_o = new state.Token("link_open", "a", 1);
          token_o.attrs = [["href", fullUrl]];
          token_o.level = level++;
          token_o.markup = "linkify";
          token_o.info = "auto";
          nodes.push(token_o);
          const token_t = new state.Token("text", "", 0);
          token_t.content = urlText;
          token_t.level = level;
          nodes.push(token_t);
          const token_c = new state.Token("link_close", "a", -1);
          token_c.level = --level;
          token_c.markup = "linkify";
          token_c.info = "auto";
          nodes.push(token_c);
          lastPos = link$1.lastIndex;
        }
        if (lastPos < text$1.length) {
          const token = new state.Token("text", "", 0);
          token.content = text$1.slice(lastPos);
          token.level = level;
          nodes.push(token);
        }
        tokens.splice(i, 1, ...nodes);
      }
    }
  }
}
var NEWLINES_RE = /\r\n?|\n/g;
var NULL_RE = /\0/g;
function normalize2(state) {
  let str = state.src;
  const hasCR = str.includes("\r");
  const hasNull = str.includes("\x00");
  if (!hasCR && !hasNull)
    return;
  if (hasCR)
    str = str.replace(NEWLINES_RE, `
`);
  if (hasNull)
    str = str.replace(NULL_RE, "�");
  state.src = str;
}
var RARE_RE = /\+-|\.\.|\?\?\?\?|!!!!|,,|--/;
var SCOPED_ABBR_TEST_RE = /\((?:c|tm|r)\)/i;
var SCOPED_ABBR_RE = /\((c|tm|r)\)/gi;
var SCOPED_ABBR = {
  c: "©",
  r: "®",
  tm: "™"
};
function replaceFn(match, name) {
  return SCOPED_ABBR[name.toLowerCase()];
}
function replace_scoped(inlineTokens) {
  let inside_autolink = 0;
  for (let i = inlineTokens.length - 1;i >= 0; i--) {
    const token = inlineTokens[i];
    if (token.type === "text" && !inside_autolink)
      token.content = token.content.replace(SCOPED_ABBR_RE, replaceFn);
    if (token.type === "link_open" && token.info === "auto")
      inside_autolink--;
    if (token.type === "link_close" && token.info === "auto")
      inside_autolink++;
  }
}
function replace_rare(inlineTokens) {
  let inside_autolink = 0;
  for (let i = inlineTokens.length - 1;i >= 0; i--) {
    const token = inlineTokens[i];
    if (token.type === "text" && !inside_autolink) {
      if (RARE_RE.test(token.content))
        token.content = token.content.replace(/\+-/g, "±").replace(/\.{2,}/g, "…").replace(/([?!])…/g, "$1..").replace(/([?!]){4,}/g, "$1$1$1").replace(/,{2,}/g, ",").replace(/(^|[^-])---(?=[^-]|$)/gm, "$1—").replace(/(^|\s)--(?=\s|$)/gm, "$1–").replace(/(^|[^-\s])--(?=[^-\s]|$)/gm, "$1–");
    }
    if (token.type === "link_open" && token.info === "auto")
      inside_autolink--;
    if (token.type === "link_close" && token.info === "auto")
      inside_autolink++;
  }
}
function replace(state) {
  let blkIdx;
  if (!state.md.options.typographer)
    return;
  for (blkIdx = state.tokens.length - 1;blkIdx >= 0; blkIdx--) {
    if (state.tokens[blkIdx].type !== "inline")
      continue;
    if (SCOPED_ABBR_TEST_RE.test(state.tokens[blkIdx].content))
      replace_scoped(state.tokens[blkIdx].children);
    if (RARE_RE.test(state.tokens[blkIdx].content))
      replace_rare(state.tokens[blkIdx].children);
  }
}
var QUOTE_TEST_RE = /['"]/;
var QUOTE_RE = /['"]/g;
var APOSTROPHE = "’";
function addReplacement(replacements, tokenIdx, pos, ch) {
  if (!replacements[tokenIdx])
    replacements[tokenIdx] = [];
  replacements[tokenIdx].push({
    pos,
    ch
  });
}
function applyReplacements(str, replacements) {
  let result = "";
  let lastPos = 0;
  replacements.sort((a, b) => a.pos - b.pos);
  for (let i = 0;i < replacements.length; i++) {
    const replacement = replacements[i];
    result += str.slice(lastPos, replacement.pos) + replacement.ch;
    lastPos = replacement.pos + 1;
  }
  return result + str.slice(lastPos);
}
function process_inlines(tokens, state) {
  let j;
  const stack = [];
  const replacements = {};
  for (let i = 0;i < tokens.length; i++) {
    const token = tokens[i];
    const thisLevel = tokens[i].level;
    for (j = stack.length - 1;j >= 0; j--)
      if (stack[j].level <= thisLevel)
        break;
    stack.length = j + 1;
    if (token.type !== "text")
      continue;
    const text$1 = token.content;
    let pos = 0;
    const max = text$1.length;
    OUTER:
      while (pos < max) {
        QUOTE_RE.lastIndex = pos;
        const t = QUOTE_RE.exec(text$1);
        if (!t)
          break;
        let canOpen = true;
        let canClose = true;
        pos = t.index + 1;
        const isSingle = t[0] === "'";
        let lastChar = 32;
        if (t.index - 1 >= 0)
          lastChar = text$1.charCodeAt(t.index - 1);
        else
          for (j = i - 1;j >= 0; j--) {
            if (tokens[j].type === "softbreak" || tokens[j].type === "hardbreak")
              break;
            if (!tokens[j].content)
              continue;
            lastChar = tokens[j].content.charCodeAt(tokens[j].content.length - 1);
            break;
          }
        let nextChar = 32;
        if (pos < max)
          nextChar = text$1.charCodeAt(pos);
        else
          for (j = i + 1;j < tokens.length; j++) {
            if (tokens[j].type === "softbreak" || tokens[j].type === "hardbreak")
              break;
            if (!tokens[j].content)
              continue;
            nextChar = tokens[j].content.charCodeAt(0);
            break;
          }
        const isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctCharCode(lastChar);
        const isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctCharCode(nextChar);
        const isLastWhiteSpace = isWhiteSpace(lastChar);
        const isNextWhiteSpace = isWhiteSpace(nextChar);
        if (isNextWhiteSpace)
          canOpen = false;
        else if (isNextPunctChar) {
          if (!(isLastWhiteSpace || isLastPunctChar))
            canOpen = false;
        }
        if (isLastWhiteSpace)
          canClose = false;
        else if (isLastPunctChar) {
          if (!(isNextWhiteSpace || isNextPunctChar))
            canClose = false;
        }
        if (nextChar === 34 && t[0] === '"') {
          if (lastChar >= 48 && lastChar <= 57)
            canClose = canOpen = false;
        }
        if (canOpen && canClose) {
          canOpen = isLastPunctChar;
          canClose = isNextPunctChar;
        }
        if (!canOpen && !canClose) {
          if (isSingle)
            addReplacement(replacements, i, t.index, APOSTROPHE);
          continue;
        }
        if (canClose)
          for (j = stack.length - 1;j >= 0; j--) {
            let item = stack[j];
            if (stack[j].level < thisLevel)
              break;
            if (item.single === isSingle && stack[j].level === thisLevel) {
              item = stack[j];
              let openQuote;
              let closeQuote;
              if (isSingle) {
                openQuote = state.md.options.quotes[2];
                closeQuote = state.md.options.quotes[3];
              } else {
                openQuote = state.md.options.quotes[0];
                closeQuote = state.md.options.quotes[1];
              }
              addReplacement(replacements, i, t.index, closeQuote);
              addReplacement(replacements, item.token, item.pos, openQuote);
              stack.length = j;
              continue OUTER;
            }
          }
        if (canOpen)
          stack.push({
            token: i,
            pos: t.index,
            single: isSingle,
            level: thisLevel
          });
        else if (canClose && isSingle)
          addReplacement(replacements, i, t.index, APOSTROPHE);
      }
  }
  Object.keys(replacements).forEach((tokenIdx) => {
    tokens[tokenIdx].content = applyReplacements(tokens[tokenIdx].content, replacements[tokenIdx]);
  });
}
function smartquotes(state) {
  if (!state.md.options.typographer)
    return;
  for (let blkIdx = state.tokens.length - 1;blkIdx >= 0; blkIdx--) {
    if (state.tokens[blkIdx].type !== "inline" || !QUOTE_TEST_RE.test(state.tokens[blkIdx].content))
      continue;
    process_inlines(state.tokens[blkIdx].children, state);
  }
}
function text_join(state) {
  let curr, last;
  const blockTokens = state.tokens;
  const l = blockTokens.length;
  for (let j = 0;j < l; j++) {
    if (blockTokens[j].type !== "inline")
      continue;
    const tokens = blockTokens[j].children;
    const max = tokens.length;
    for (curr = 0;curr < max; curr++)
      if (tokens[curr].type === "text_special")
        tokens[curr].type = "text";
    for (curr = last = 0;curr < max; curr++)
      if (tokens[curr].type === "text" && curr + 1 < max && tokens[curr + 1].type === "text")
        tokens[curr + 1].content = tokens[curr].content + tokens[curr + 1].content;
      else {
        if (curr !== last)
          tokens[last] = tokens[curr];
        last++;
      }
    if (curr !== last)
      tokens.length = last;
  }
}
var _rules$1 = [
  ["normalize", normalize2],
  ["block", block],
  ["inline", inline],
  ["linkify", linkify$1],
  ["replacements", replace],
  ["smartquotes", smartquotes],
  ["text_join", text_join]
];
var Core = class {
  ruler;
  constructor() {
    this.ruler = new Ruler;
    for (let i = 0;i < _rules$1.length; i++)
      this.ruler.push(_rules$1[i][0], _rules$1[i][1]);
  }
  process(state) {
    const rules = this.ruler.getRules("");
    for (let i = 0, l = rules.length;i < l; i++)
      rules[i](state);
  }
  State = StateCore;
};
function parseLinkDestination(str, start, max) {
  let code$1;
  let pos = start;
  const result = {
    ok: false,
    pos: 0,
    str: ""
  };
  if (str.charCodeAt(pos) === 60) {
    pos++;
    while (pos < max) {
      code$1 = str.charCodeAt(pos);
      if (code$1 === 10)
        return result;
      if (code$1 === 60)
        return result;
      if (code$1 === 62) {
        result.pos = pos + 1;
        result.str = unescapeAll(str.slice(start + 1, pos));
        result.ok = true;
        return result;
      }
      if (code$1 === 92 && pos + 1 < max) {
        pos += 2;
        continue;
      }
      pos++;
    }
    return result;
  }
  let level = 0;
  while (pos < max) {
    code$1 = str.charCodeAt(pos);
    if (code$1 === 32)
      break;
    if (code$1 < 32 || code$1 === 127)
      break;
    if (code$1 === 92 && pos + 1 < max) {
      if (str.charCodeAt(pos + 1) === 32)
        break;
      pos += 2;
      continue;
    }
    if (code$1 === 40) {
      level++;
      if (level > 32)
        return result;
    }
    if (code$1 === 41) {
      if (level === 0)
        break;
      level--;
    }
    pos++;
  }
  if (start === pos)
    return result;
  if (level !== 0)
    return result;
  result.str = unescapeAll(str.slice(start, pos));
  result.pos = pos;
  result.ok = true;
  return result;
}
function parseLinkLabel(state, start, disableNested = false) {
  let level;
  let found = false;
  let marker;
  let prevPos;
  const max = state.posMax;
  const oldPos = state.pos;
  state.pos = start + 1;
  level = 1;
  while (state.pos < max) {
    marker = state.src.charCodeAt(state.pos);
    if (marker === 93) {
      level--;
      if (level === 0) {
        found = true;
        break;
      }
    }
    prevPos = state.pos;
    state.md.inline.skipToken(state);
    if (marker === 91) {
      if (prevPos === state.pos - 1)
        level++;
      else if (disableNested) {
        state.pos = oldPos;
        return -1;
      }
    }
  }
  let labelEnd = -1;
  if (found)
    labelEnd = state.pos;
  state.pos = oldPos;
  return labelEnd;
}
function parseLinkTitle(str, start, max, prev_state) {
  let code$1;
  let pos = start;
  const state = {
    ok: false,
    can_continue: false,
    pos: 0,
    str: "",
    marker: 0
  };
  if (prev_state) {
    state.str = prev_state.str;
    state.marker = prev_state.marker;
  } else {
    if (pos >= max)
      return state;
    let marker = str.charCodeAt(pos);
    if (marker !== 34 && marker !== 39 && marker !== 40)
      return state;
    start++;
    pos++;
    if (marker === 40)
      marker = 41;
    state.marker = marker;
  }
  while (pos < max) {
    code$1 = str.charCodeAt(pos);
    if (code$1 === state.marker) {
      state.pos = pos + 1;
      state.str += unescapeAll(str.slice(start, pos));
      state.ok = true;
      return state;
    } else if (code$1 === 40 && state.marker === 41)
      return state;
    else if (code$1 === 92 && pos + 1 < max)
      pos++;
    pos++;
  }
  state.can_continue = true;
  state.str += unescapeAll(str.slice(start, pos));
  return state;
}
var helpers = {
  parseLinkDestination,
  parseLinkLabel,
  parseLinkTitle
};
var EMAIL_RE = /^([\w.!#$%&'*+/=?^`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*)$/i;
var AUTOLINK_RE = /^([a-z][a-z0-9+.-]{1,31}):([^<>\x00-\x20]*)$/i;
function autolink(state, silent) {
  let pos = state.pos;
  if (state.src.charCodeAt(pos) !== 60)
    return false;
  const start = state.pos;
  const max = state.posMax;
  for (;; ) {
    if (++pos >= max)
      return false;
    const ch = state.src.charCodeAt(pos);
    if (ch === 60)
      return false;
    if (ch === 62)
      break;
  }
  const url = state.src.slice(start + 1, pos);
  if (AUTOLINK_RE.test(url)) {
    const fullUrl = state.md.normalizeLink(url);
    if (!state.md.validateLink(fullUrl))
      return false;
    if (!silent) {
      const token_o = state.push("link_open", "a", 1);
      token_o.attrs = [["href", fullUrl]];
      token_o.markup = "autolink";
      token_o.info = "auto";
      const token_t = state.push("text", "", 0);
      token_t.content = state.md.normalizeLinkText(url);
      const token_c = state.push("link_close", "a", -1);
      token_c.markup = "autolink";
      token_c.info = "auto";
    }
    state.pos += url.length + 2;
    return true;
  }
  if (EMAIL_RE.test(url)) {
    const fullUrl = state.md.normalizeLink(`mailto:${url}`);
    if (!state.md.validateLink(fullUrl))
      return false;
    if (!silent) {
      const token_o = state.push("link_open", "a", 1);
      token_o.attrs = [["href", fullUrl]];
      token_o.markup = "autolink";
      token_o.info = "auto";
      const token_t = state.push("text", "", 0);
      token_t.content = state.md.normalizeLinkText(url);
      const token_c = state.push("link_close", "a", -1);
      token_c.markup = "autolink";
      token_c.info = "auto";
    }
    state.pos += url.length + 2;
    return true;
  }
  return false;
}
function backtick(state, silent) {
  let pos = state.pos;
  const src = state.src;
  if (src.charCodeAt(pos) !== 96)
    return false;
  const start = pos;
  pos++;
  const max = state.posMax;
  while (pos < max && src.charCodeAt(pos) === 96)
    pos++;
  const marker = src.slice(start, pos);
  const openerLength = marker.length;
  if (state.backticksScanned && (state.backticks[openerLength] || 0) <= start) {
    if (!silent)
      state.pending += marker;
    state.pos += openerLength;
    return true;
  }
  let matchEnd = pos;
  let matchStart;
  while (true) {
    matchStart = src.indexOf("`", matchEnd);
    if (matchStart === -1)
      break;
    matchEnd = matchStart + 1;
    while (matchEnd < max && src.charCodeAt(matchEnd) === 96)
      matchEnd++;
    const closerLength = matchEnd - matchStart;
    if (closerLength === openerLength) {
      if (!silent) {
        const token = state.push("code_inline", "code", 0);
        token.markup = marker;
        token.content = src.slice(pos, matchStart).replace(/\n/g, " ").replace(/^ (.+) $/, "$1");
      }
      state.pos = matchEnd;
      return true;
    }
    state.backticks[closerLength] = matchStart;
  }
  state.backticksScanned = true;
  if (!silent)
    state.pending += marker;
  state.pos += openerLength;
  return true;
}
function processDelimiters(delimiters) {
  const openersBottom = {};
  const max = delimiters.length;
  if (!max)
    return;
  let headerIdx = 0;
  let lastTokenIdx = -2;
  const jumps = [];
  for (let closerIdx = 0;closerIdx < max; closerIdx++) {
    const closer = delimiters[closerIdx];
    jumps.push(0);
    if (delimiters[headerIdx].marker !== closer.marker || lastTokenIdx !== closer.token - 1)
      headerIdx = closerIdx;
    lastTokenIdx = closer.token;
    closer.length = closer.length || 0;
    if (!closer.close)
      continue;
    if (!openersBottom.hasOwnProperty(closer.marker))
      openersBottom[closer.marker] = [
        -1,
        -1,
        -1,
        -1,
        -1,
        -1
      ];
    const minOpenerIdx = openersBottom[closer.marker][(closer.open ? 3 : 0) + closer.length % 3];
    let openerIdx = headerIdx - jumps[headerIdx] - 1;
    let newMinOpenerIdx = openerIdx;
    for (;openerIdx > minOpenerIdx; openerIdx -= jumps[openerIdx] + 1) {
      const opener = delimiters[openerIdx];
      if (opener.marker !== closer.marker)
        continue;
      if (opener.open && opener.end < 0) {
        let isOddMatch = false;
        if (opener.close || closer.open) {
          if ((opener.length + closer.length) % 3 === 0) {
            if (opener.length % 3 !== 0 || closer.length % 3 !== 0)
              isOddMatch = true;
          }
        }
        if (!isOddMatch) {
          const lastJump = openerIdx > 0 && !delimiters[openerIdx - 1].open ? jumps[openerIdx - 1] + 1 : 0;
          jumps[closerIdx] = closerIdx - openerIdx + lastJump;
          jumps[openerIdx] = lastJump;
          closer.open = false;
          opener.end = closerIdx;
          opener.close = false;
          newMinOpenerIdx = -1;
          lastTokenIdx = -2;
          break;
        }
      }
    }
    if (newMinOpenerIdx !== -1)
      openersBottom[closer.marker][(closer.open ? 3 : 0) + (closer.length || 0) % 3] = newMinOpenerIdx;
  }
}
function link_pairs(state) {
  const tokens_meta = state.tokens_meta;
  const max = state.tokens_meta.length;
  processDelimiters(state.delimiters);
  for (let curr = 0;curr < max; curr++) {
    const delimiters = tokens_meta[curr]?.delimiters;
    if (delimiters)
      processDelimiters(delimiters);
  }
}
function emphasis_tokenize(state, silent) {
  const start = state.pos;
  const marker = state.src.charCodeAt(start);
  if (silent)
    return false;
  if (marker !== 95 && marker !== 42)
    return false;
  const scanned = state.scanDelims(state.pos, marker === 42);
  for (let i = 0;i < scanned.length; i++) {
    const token = state.push("text", "", 0);
    token.content = String.fromCharCode(marker);
    state.delimiters.push({
      marker,
      length: scanned.length,
      token: state.tokens.length - 1,
      end: -1,
      open: scanned.can_open,
      close: scanned.can_close
    });
  }
  state.pos += scanned.length;
  return true;
}
function postProcess$1(state, delimiters) {
  const max = delimiters.length;
  for (let i = max - 1;i >= 0; i--) {
    const startDelim = delimiters[i];
    if (startDelim.marker !== 95 && startDelim.marker !== 42)
      continue;
    if (startDelim.end === -1)
      continue;
    const endDelim = delimiters[startDelim.end];
    const isStrong = i > 0 && delimiters[i - 1].end === startDelim.end + 1 && delimiters[i - 1].marker === startDelim.marker && delimiters[i - 1].token === startDelim.token - 1 && delimiters[startDelim.end + 1].token === endDelim.token + 1;
    const ch = String.fromCharCode(startDelim.marker);
    const token_o = state.tokens[startDelim.token];
    token_o.type = isStrong ? "strong_open" : "em_open";
    token_o.tag = isStrong ? "strong" : "em";
    token_o.nesting = 1;
    token_o.markup = isStrong ? ch + ch : ch;
    token_o.content = "";
    const token_c = state.tokens[endDelim.token];
    token_c.type = isStrong ? "strong_close" : "em_close";
    token_c.tag = isStrong ? "strong" : "em";
    token_c.nesting = -1;
    token_c.markup = isStrong ? ch + ch : ch;
    token_c.content = "";
    if (isStrong) {
      state.tokens[delimiters[i - 1].token].content = "";
      state.tokens[delimiters[startDelim.end + 1].token].content = "";
      i--;
    }
  }
}
function emphasis_post_process(state) {
  const tokens_meta = state.tokens_meta;
  const max = state.tokens_meta.length;
  postProcess$1(state, state.delimiters);
  for (let curr = 0;curr < max; curr++) {
    const delimiters = tokens_meta[curr]?.delimiters;
    if (delimiters)
      postProcess$1(state, delimiters);
  }
}
var emphasis_default = {
  tokenize: emphasis_tokenize,
  postProcess: emphasis_post_process
};
var DIGITAL_RE = /^&#(x[a-f0-9]{1,6}|\d{1,7});/i;
var NAMED_RE = /^&([a-z][a-z0-9]{1,31});/i;
function entity(state, silent) {
  const pos = state.pos;
  const max = state.posMax;
  if (state.src.charCodeAt(pos) !== 38)
    return false;
  if (pos + 1 >= max)
    return false;
  if (state.src.charCodeAt(pos + 1) === 35) {
    const match = state.src.slice(pos).match(DIGITAL_RE);
    if (match) {
      if (!silent) {
        const code$1 = match[1][0].toLowerCase() === "x" ? Number.parseInt(match[1].slice(1), 16) : Number.parseInt(match[1], 10);
        const token = state.push("text_special", "", 0);
        token.content = isValidEntityCode(code$1) ? fromCodePoint2(code$1) : fromCodePoint2(65533);
        token.markup = match[0];
        token.info = "entity";
      }
      state.pos += match[0].length;
      return true;
    }
  } else {
    const match = state.src.slice(pos).match(NAMED_RE);
    if (match) {
      const decoded = decodeHTMLStrict(match[0]);
      if (decoded !== match[0]) {
        if (!silent) {
          const token = state.push("text_special", "", 0);
          token.content = decoded;
          token.markup = match[0];
          token.info = "entity";
        }
        state.pos += match[0].length;
        return true;
      }
    }
  }
  return false;
}
var ESCAPED = [];
for (let i = 0;i < 256; i++)
  ESCAPED.push(0);
for (const ch of "\\!\"#$%&'()*+,./:;<=>?@[]^_`{|}~-".split(""))
  ESCAPED[ch.charCodeAt(0)] = 1;
function escape(state, silent) {
  let pos = state.pos;
  const max = state.posMax;
  if (state.src.charCodeAt(pos) !== 92)
    return false;
  pos++;
  if (pos >= max)
    return false;
  let ch1 = state.src.charCodeAt(pos);
  if (ch1 === 10) {
    if (!silent)
      state.push("hardbreak", "br", 0);
    pos++;
    while (pos < max) {
      ch1 = state.src.charCodeAt(pos);
      if (!isSpace(ch1))
        break;
      pos++;
    }
    state.pos = pos;
    return true;
  }
  if (ch1 === 32) {
    if (!silent) {
      const token = state.push("text_special", "", 0);
      token.content = "\\";
      token.markup = "\\";
      token.info = "escape";
    }
    state.pos = pos;
    return true;
  }
  let escapedStr = state.src[pos];
  if (ch1 >= 55296 && ch1 <= 56319 && pos + 1 < max) {
    const ch2 = state.src.charCodeAt(pos + 1);
    if (ch2 >= 56320 && ch2 <= 57343) {
      escapedStr += state.src[pos + 1];
      pos++;
    }
  }
  const origStr = `\\${escapedStr}`;
  if (!silent) {
    const token = state.push("text_special", "", 0);
    if (ch1 < 256 && ESCAPED[ch1] !== 0)
      token.content = escapedStr;
    else
      token.content = origStr;
    token.markup = origStr;
    token.info = "escape";
  }
  state.pos = pos + 1;
  return true;
}
function fragments_join(state) {
  let curr, last;
  let level = 0;
  const tokens = state.tokens;
  const max = state.tokens.length;
  for (curr = last = 0;curr < max; curr++) {
    if (tokens[curr].nesting < 0)
      level--;
    tokens[curr].level = level;
    if (tokens[curr].nesting > 0)
      level++;
    if (tokens[curr].type === "text" && curr + 1 < max && tokens[curr + 1].type === "text")
      tokens[curr + 1].content = tokens[curr].content + tokens[curr + 1].content;
    else {
      if (curr !== last)
        tokens[last] = tokens[curr];
      last++;
    }
  }
  if (curr !== last)
    tokens.length = last;
}
function isLinkOpen(str) {
  return /^<a[>\s]/i.test(str);
}
function isLinkClose(str) {
  return /^<\/a\s*>/i.test(str);
}
function isLetter(ch) {
  const lc = ch | 32;
  return lc >= 97 && lc <= 122;
}
function html_inline(state, silent) {
  if (!state.md.options.html)
    return false;
  const max = state.posMax;
  const pos = state.pos;
  if (state.src.charCodeAt(pos) !== 60 || pos + 2 >= max)
    return false;
  const ch = state.src.charCodeAt(pos + 1);
  if (ch !== 33 && ch !== 63 && ch !== 47 && !isLetter(ch))
    return false;
  const match = state.src.slice(pos).match(HTML_TAG_RE);
  if (!match)
    return false;
  if (!silent) {
    const token = state.push("html_inline", "", 0);
    token.content = match[0];
    if (isLinkOpen(token.content))
      state.linkLevel++;
    if (isLinkClose(token.content))
      state.linkLevel--;
  }
  state.pos += match[0].length;
  return true;
}
function image(state, silent) {
  let code$1, content, label, pos, ref, res, title, start;
  let href = "";
  const oldPos = state.pos;
  const max = state.posMax;
  if (state.src.charCodeAt(state.pos) !== 33)
    return false;
  if (state.src.charCodeAt(state.pos + 1) !== 91)
    return false;
  const labelStart = state.pos + 2;
  const labelEnd = state.md.helpers.parseLinkLabel(state, state.pos + 1, false);
  if (labelEnd < 0)
    return false;
  pos = labelEnd + 1;
  if (pos < max && state.src.charCodeAt(pos) === 40) {
    pos++;
    for (;pos < max; pos++) {
      code$1 = state.src.charCodeAt(pos);
      if (!isSpace(code$1) && code$1 !== 10)
        break;
    }
    if (pos >= max)
      return false;
    start = pos;
    res = state.md.helpers.parseLinkDestination(state.src, pos, state.posMax);
    if (res.ok) {
      href = state.md.normalizeLink(res.str);
      if (state.md.validateLink(href))
        pos = res.pos;
      else
        href = "";
    }
    start = pos;
    for (;pos < max; pos++) {
      code$1 = state.src.charCodeAt(pos);
      if (!isSpace(code$1) && code$1 !== 10)
        break;
    }
    res = state.md.helpers.parseLinkTitle(state.src, pos, state.posMax);
    if (pos < max && start !== pos && res.ok) {
      title = res.str;
      pos = res.pos;
      for (;pos < max; pos++) {
        code$1 = state.src.charCodeAt(pos);
        if (!isSpace(code$1) && code$1 !== 10)
          break;
      }
    } else
      title = "";
    if (pos >= max || state.src.charCodeAt(pos) !== 41) {
      state.pos = oldPos;
      return false;
    }
    pos++;
  } else {
    if (typeof state.env.references === "undefined")
      return false;
    if (pos < max && state.src.charCodeAt(pos) === 91) {
      start = pos + 1;
      pos = state.md.helpers.parseLinkLabel(state, pos);
      if (pos >= 0)
        label = state.src.slice(start, pos++);
      else
        pos = labelEnd + 1;
    } else
      pos = labelEnd + 1;
    if (!label)
      label = state.src.slice(labelStart, labelEnd);
    ref = state.env.references[normalizeReference(label)];
    if (!ref) {
      state.pos = oldPos;
      return false;
    }
    href = ref.href;
    title = ref.title;
  }
  if (!silent) {
    content = state.src.slice(labelStart, labelEnd);
    const tokens = [];
    state.md.inline.parse(content, state.md, state.env, tokens);
    const token = state.push("image", "img", 0);
    const attrs = [["src", href], ["alt", ""]];
    token.attrs = attrs;
    token.children = tokens;
    token.content = content;
    if (title)
      attrs.push(["title", title]);
  }
  state.pos = pos;
  state.posMax = max;
  return true;
}
function link(state, silent) {
  let code$1, label, res, ref;
  let href = "";
  let title = "";
  let start = state.pos;
  let parseReference = true;
  if (state.src.charCodeAt(state.pos) !== 91)
    return false;
  const oldPos = state.pos;
  const max = state.posMax;
  const labelStart = state.pos + 1;
  const labelEnd = state.md.helpers.parseLinkLabel(state, state.pos, true);
  if (labelEnd < 0)
    return false;
  let pos = labelEnd + 1;
  if (pos < max && state.src.charCodeAt(pos) === 40) {
    parseReference = false;
    pos++;
    for (;pos < max; pos++) {
      code$1 = state.src.charCodeAt(pos);
      if (!isSpace(code$1) && code$1 !== 10)
        break;
    }
    if (pos >= max)
      return false;
    start = pos;
    res = state.md.helpers.parseLinkDestination(state.src, pos, state.posMax);
    if (res.ok) {
      href = state.md.normalizeLink(res.str);
      if (state.md.validateLink(href))
        pos = res.pos;
      else
        href = "";
      start = pos;
      for (;pos < max; pos++) {
        code$1 = state.src.charCodeAt(pos);
        if (!isSpace(code$1) && code$1 !== 10)
          break;
      }
      res = state.md.helpers.parseLinkTitle(state.src, pos, state.posMax);
      if (pos < max && start !== pos && res.ok) {
        title = res.str;
        pos = res.pos;
        for (;pos < max; pos++) {
          code$1 = state.src.charCodeAt(pos);
          if (!isSpace(code$1) && code$1 !== 10)
            break;
        }
      }
    }
    if (pos >= max || state.src.charCodeAt(pos) !== 41)
      parseReference = true;
    pos++;
  }
  if (parseReference) {
    if (typeof state.env.references === "undefined")
      return false;
    if (pos < max && state.src.charCodeAt(pos) === 91) {
      start = pos + 1;
      pos = state.md.helpers.parseLinkLabel(state, pos);
      if (pos >= 0)
        label = state.src.slice(start, pos++);
      else
        pos = labelEnd + 1;
    } else
      pos = labelEnd + 1;
    if (!label)
      label = state.src.slice(labelStart, labelEnd);
    ref = state.env.references[normalizeReference(label)];
    if (!ref) {
      state.pos = oldPos;
      return false;
    }
    href = ref.href;
    title = ref.title;
  }
  if (!silent) {
    state.pos = labelStart;
    state.posMax = labelEnd;
    const token_o = state.push("link_open", "a", 1);
    const attrs = [["href", href]];
    token_o.attrs = attrs;
    if (title)
      attrs.push(["title", title]);
    state.linkLevel++;
    state.md.inline.tokenize(state);
    state.linkLevel--;
    state.push("link_close", "a", -1);
  }
  state.pos = pos;
  state.posMax = max;
  return true;
}
var SCHEME_RE = /(?:^|[^a-z0-9.+-])([a-z][a-z0-9.+-]*)$/i;
function linkify(state, silent) {
  if (!state.md.options.linkify)
    return false;
  if (state.linkLevel > 0)
    return false;
  const pos = state.pos;
  const max = state.posMax;
  if (pos + 3 > max)
    return false;
  if (state.src.charCodeAt(pos) !== 58)
    return false;
  if (state.src.charCodeAt(pos + 1) !== 47)
    return false;
  if (state.src.charCodeAt(pos + 2) !== 47)
    return false;
  const match = state.pending.match(SCHEME_RE);
  if (!match)
    return false;
  const proto = match[1];
  const link$1 = state.md.linkify.matchAtStart(state.src.slice(pos - proto.length));
  if (!link$1)
    return false;
  let url = link$1.url;
  if (url.length <= proto.length)
    return false;
  let urlEnd = url.length;
  while (urlEnd > 0 && url.charCodeAt(urlEnd - 1) === 42)
    urlEnd--;
  if (urlEnd !== url.length)
    url = url.slice(0, urlEnd);
  const fullUrl = state.md.normalizeLink(url);
  if (!state.md.validateLink(fullUrl))
    return false;
  if (!silent) {
    state.pending = state.pending.slice(0, -proto.length);
    const token_o = state.push("link_open", "a", 1);
    token_o.attrs = [["href", fullUrl]];
    token_o.markup = "linkify";
    token_o.info = "auto";
    const token_t = state.push("text", "", 0);
    token_t.content = state.md.normalizeLinkText(url);
    const token_c = state.push("link_close", "a", -1);
    token_c.markup = "linkify";
    token_c.info = "auto";
  }
  state.pos += url.length - proto.length;
  return true;
}
function newline(state, silent) {
  let pos = state.pos;
  if (state.src.charCodeAt(pos) !== 10)
    return false;
  const pmax = state.pending.length - 1;
  const max = state.posMax;
  if (!silent)
    if (pmax >= 0 && state.pending.charCodeAt(pmax) === 32)
      if (pmax >= 1 && state.pending.charCodeAt(pmax - 1) === 32) {
        let ws = pmax - 1;
        while (ws >= 1 && state.pending.charCodeAt(ws - 1) === 32)
          ws--;
        state.pending = state.pending.slice(0, ws);
        state.push("hardbreak", "br", 0);
      } else {
        state.pending = state.pending.slice(0, -1);
        state.push("softbreak", "br", 0);
      }
    else
      state.push("softbreak", "br", 0);
  pos++;
  while (pos < max && isSpace(state.src.charCodeAt(pos)))
    pos++;
  state.pos = pos;
  return true;
}
function strikethrough_tokenize(state, silent) {
  const start = state.pos;
  const marker = state.src.charCodeAt(start);
  if (silent)
    return false;
  if (marker !== 126)
    return false;
  const scanned = state.scanDelims(state.pos, true);
  let len = scanned.length;
  const ch = String.fromCharCode(marker);
  if (len < 2)
    return false;
  let token;
  if (len % 2) {
    token = state.push("text", "", 0);
    token.content = ch;
    len--;
  }
  for (let i = 0;i < len; i += 2) {
    token = state.push("text", "", 0);
    token.content = ch + ch;
    state.delimiters.push({
      marker,
      length: 0,
      token: state.tokens.length - 1,
      end: -1,
      open: scanned.can_open,
      close: scanned.can_close
    });
  }
  state.pos += scanned.length;
  return true;
}
function postProcess(state, delimiters) {
  let token;
  const loneMarkers = [];
  const max = delimiters.length;
  for (let i = 0;i < max; i++) {
    const startDelim = delimiters[i];
    if (startDelim.marker !== 126)
      continue;
    if (startDelim.end === -1)
      continue;
    const endDelim = delimiters[startDelim.end];
    token = state.tokens[startDelim.token];
    token.type = "s_open";
    token.tag = "s";
    token.nesting = 1;
    token.markup = "~~";
    token.content = "";
    token = state.tokens[endDelim.token];
    token.type = "s_close";
    token.tag = "s";
    token.nesting = -1;
    token.markup = "~~";
    token.content = "";
    if (state.tokens[endDelim.token - 1].type === "text" && state.tokens[endDelim.token - 1].content === "~")
      loneMarkers.push(endDelim.token - 1);
  }
  while (loneMarkers.length) {
    const i = loneMarkers.pop();
    let j = i + 1;
    while (j < state.tokens.length && state.tokens[j].type === "s_close")
      j++;
    j--;
    if (i !== j) {
      token = state.tokens[j];
      state.tokens[j] = state.tokens[i];
      state.tokens[i] = token;
    }
  }
}
function strikethrough_postProcess(state) {
  const tokens_meta = state.tokens_meta;
  const max = state.tokens_meta.length;
  postProcess(state, state.delimiters);
  for (let curr = 0;curr < max; curr++) {
    const delimiters = tokens_meta[curr]?.delimiters;
    if (delimiters)
      postProcess(state, delimiters);
  }
}
var strikethrough_default = {
  tokenize: strikethrough_tokenize,
  postProcess: strikethrough_postProcess
};
function isTerminatorChar(ch) {
  switch (ch) {
    case 10:
    case 33:
    case 35:
    case 36:
    case 37:
    case 38:
    case 42:
    case 43:
    case 45:
    case 58:
    case 60:
    case 61:
    case 62:
    case 64:
    case 91:
    case 92:
    case 93:
    case 94:
    case 95:
    case 96:
    case 123:
    case 125:
    case 126:
      return true;
    default:
      return false;
  }
}
function text(state, silent) {
  let pos = state.pos;
  const src = state.src;
  while (pos < state.posMax && !isTerminatorChar(src.charCodeAt(pos)))
    pos++;
  if (pos === state.pos)
    return false;
  if (!silent)
    state.pending += src.slice(state.pos, pos);
  state.pos = pos;
  return true;
}
var _rules = [
  ["text", text],
  ["linkify", linkify],
  ["newline", newline],
  ["escape", escape],
  ["backticks", backtick],
  ["strikethrough", strikethrough_default.tokenize],
  ["emphasis", emphasis_default.tokenize],
  ["link", link],
  ["image", image],
  ["autolink", autolink],
  ["html_inline", html_inline],
  ["entity", entity]
];
var _rules2 = [
  ["balance_pairs", link_pairs],
  ["strikethrough", strikethrough_default.postProcess],
  ["emphasis", emphasis_default.postProcess],
  ["fragments_join", fragments_join]
];
var ParserInline = class {
  ruler;
  ruler2;
  constructor() {
    this.ruler = new Ruler;
    for (let i = 0;i < _rules.length; i++)
      this.ruler.push(_rules[i][0], _rules[i][1]);
    this.ruler2 = new Ruler;
    for (let i = 0;i < _rules2.length; i++)
      this.ruler2.push(_rules2[i][0], _rules2[i][1]);
  }
  skipToken(state) {
    const pos = state.pos;
    const rules = this.ruler.getRules("");
    const len = rules.length;
    const maxNesting = state.md.options.maxNesting;
    const cache = state.cache;
    const cachedPos = cache[pos];
    if (cachedPos !== undefined) {
      state.pos = cachedPos;
      return;
    }
    let ok = false;
    if (state.level < maxNesting)
      for (let i = 0;i < len; i++) {
        state.level++;
        ok = rules[i](state, true);
        state.level--;
        if (ok) {
          if (pos >= state.pos)
            throw new Error("inline rule didn't increment state.pos");
          break;
        }
      }
    else
      state.pos = state.posMax;
    if (!ok)
      state.pos++;
    cache[pos] = state.pos;
  }
  tokenize(state) {
    const rules = this.ruler.getRules("");
    const len = rules.length;
    const end = state.posMax;
    const maxNesting = state.md.options.maxNesting;
    while (state.pos < end) {
      const prevPos = state.pos;
      let ok = false;
      if (state.level < maxNesting)
        for (let i = 0;i < len; i++) {
          ok = rules[i](state, false);
          if (ok) {
            if (prevPos >= state.pos)
              throw new Error("inline rule didn't increment state.pos");
            break;
          }
        }
      if (ok) {
        if (state.pos >= end)
          break;
        continue;
      }
      state.pending += state.src[state.pos++];
    }
    if (state.pending)
      state.pushPending();
  }
  parse(str, md, env, outTokens) {
    const state = new this.State(str, md, env, outTokens);
    this.tokenize(state);
    const rules = this.ruler2.getRules("");
    const len = rules.length;
    for (let i = 0;i < len; i++)
      rules[i](state);
  }
  State = StateInline;
};
var BAD_PROTO_RE = /^(vbscript|javascript|file|data):/;
var GOOD_DATA_RE = /^data:image\/(gif|png|jpeg|webp);/;
function validateLink(url) {
  const str = url.trim().toLowerCase();
  return BAD_PROTO_RE.test(str) ? GOOD_DATA_RE.test(str) : true;
}
var RECODE_HOSTNAME_FOR = [
  "http:",
  "https:",
  "mailto:"
];
function normalizeLink(url) {
  const parsed = parse_default(url, true);
  if (parsed.hostname) {
    if (!parsed.protocol || RECODE_HOSTNAME_FOR.includes(parsed.protocol))
      try {
        parsed.hostname = punycode_es6_default.toASCII(parsed.hostname);
      } catch {}
  }
  return encode_default(format2(parsed));
}
function normalizeLinkText(url) {
  const parsed = parse_default(url, true);
  if (parsed.hostname) {
    if (!parsed.protocol || RECODE_HOSTNAME_FOR.includes(parsed.protocol))
      try {
        parsed.hostname = punycode_es6_default.toUnicode(parsed.hostname);
      } catch {}
  }
  return decode_default(format2(parsed), `${decode_default.defaultChars}%`);
}
var defaultOptions2 = {
  html: false,
  linkify: false,
  typographer: false,
  quotes: "“”‘’",
  maxNesting: 100
};
var Parser = class {
  inline = new ParserInline;
  block = new ParserBlock;
  core = new Core;
  linkify = new linkify_it_default;
  validateLink = validateLink;
  normalizeLink = normalizeLink;
  normalizeLinkText = normalizeLinkText;
  helpers = { ...helpers };
  options = { ...defaultOptions2 };
  parse(src, env = {}) {
    if (typeof src !== "string")
      throw new TypeError("Input data should be a String");
    const state = new this.core.State(src, this, env);
    this.core.process(state);
    return state.tokens;
  }
  parseInline(src, env = {}) {
    const state = new this.core.State(src, this, env);
    state.inlineMode = true;
    this.core.process(state);
    return state.tokens;
  }
};
var commonmarkPreset = {
  options: {
    html: true,
    xhtmlOut: true,
    breaks: false,
    langPrefix: "language-",
    linkify: false,
    typographer: false,
    quotes: "“”‘’",
    highlight: null,
    maxNesting: 20
  },
  components: {
    core: { rules: [
      "normalize",
      "block",
      "inline",
      "text_join"
    ] },
    block: { rules: [
      "blockquote",
      "code",
      "fence",
      "heading",
      "hr",
      "html_block",
      "lheading",
      "list",
      "reference",
      "paragraph"
    ] },
    inline: {
      rules: [
        "autolink",
        "backticks",
        "emphasis",
        "entity",
        "escape",
        "html_inline",
        "image",
        "link",
        "newline",
        "text"
      ],
      rules2: [
        "balance_pairs",
        "emphasis",
        "fragments_join"
      ]
    }
  }
};
var commonmark_default = commonmarkPreset;
var defaultPreset = {
  options: {
    ...defaultOptions2,
    xhtmlOut: false,
    breaks: false,
    langPrefix: "language-",
    highlight: null
  },
  components: {
    core: {},
    block: {},
    inline: {}
  }
};
var default_default = defaultPreset;
var zeroPreset = {
  options: {
    html: false,
    xhtmlOut: false,
    breaks: false,
    langPrefix: "language-",
    linkify: false,
    typographer: false,
    quotes: "“”‘’",
    highlight: null,
    maxNesting: 20
  },
  components: {
    core: { rules: [
      "normalize",
      "block",
      "inline",
      "text_join"
    ] },
    block: { rules: ["paragraph"] },
    inline: {
      rules: ["text"],
      rules2: ["balance_pairs", "fragments_join"]
    }
  }
};
var zero_default = zeroPreset;
var default_rules = {};
default_rules.code_inline = function(tokens, idx, options, env, slf) {
  const token = tokens[idx];
  return `<code${slf.renderAttrs(token)}>${escapeHtml(token.content)}</code>`;
};
default_rules.code_block = function(tokens, idx, options, env, slf) {
  const token = tokens[idx];
  return `<pre${slf.renderAttrs(token)}><code>${escapeHtml(tokens[idx].content)}</code></pre>
`;
};
default_rules.fence = function(tokens, idx, options, env, slf) {
  const token = tokens[idx];
  const info = token.info ? unescapeAll(token.info).trim() : "";
  let langName = "";
  let langAttrs = "";
  if (info) {
    const arr = info.split(/(\s+)/g);
    langName = arr[0];
    langAttrs = arr.slice(2).join("");
  }
  function finalize(highlighted$1) {
    if (highlighted$1.indexOf("<pre") === 0)
      return `${highlighted$1}
`;
    if (info) {
      const i = token.attrIndex("class");
      const tmpAttrs = token.attrs ? token.attrs.slice() : [];
      if (i < 0)
        tmpAttrs.push(["class", options.langPrefix + langName]);
      else {
        tmpAttrs[i] = tmpAttrs[i].slice();
        tmpAttrs[i][1] += ` ${options.langPrefix}${langName}`;
      }
      const tmpToken = { attrs: tmpAttrs };
      return `<pre><code${slf.renderAttrs(tmpToken)}>${highlighted$1}</code></pre>
`;
    }
    return `<pre><code${slf.renderAttrs(token)}>${highlighted$1}</code></pre>
`;
  }
  const resolveHighlighted = () => {
    if (!options.highlight)
      return escapeHtml(token.content);
    const highlighted$1 = options.highlight(token.content, langName, langAttrs, env);
    if (isPromiseLike(highlighted$1))
      return highlighted$1.then((v) => v || escapeHtml(token.content));
    return highlighted$1 || escapeHtml(token.content);
  };
  const highlighted = resolveHighlighted();
  return isPromiseLike(highlighted) ? highlighted.then(finalize) : finalize(highlighted);
};
default_rules.image = function(tokens, idx, options, env, slf) {
  const token = tokens[idx];
  token.attrs[token.attrIndex("alt")][1] = slf.renderInlineAsText(token.children, options, env);
  return slf.renderToken(tokens, idx, options);
};
default_rules.hardbreak = function(tokens, idx, options) {
  return options.xhtmlOut ? `<br />
` : `<br>
`;
};
default_rules.softbreak = function(tokens, idx, options) {
  return options.breaks ? options.xhtmlOut ? `<br />
` : `<br>
` : `
`;
};
default_rules.text = function(tokens, idx) {
  return escapeHtml(tokens[idx].content);
};
default_rules.html_block = function(tokens, idx) {
  return tokens[idx].content;
};
default_rules.html_inline = function(tokens, idx) {
  return tokens[idx].content;
};
default_rules.reference = function(tokens, idx) {
  return tokens[idx].content;
};
var Renderer = class Renderer {
  rules = assign2({}, default_rules);
  constructor() {}
  renderAttrs(token) {
    const attrs = token.attrs;
    if (!attrs)
      return "";
    const len = attrs.length;
    if (len === 0)
      return "";
    let result = "";
    for (let i = 0;i < len; i++)
      result += ` ${escapeHtml(attrs[i][0])}="${escapeHtml(attrs[i][1])}"`;
    return result;
  }
  renderToken(tokens, idx, options, env = {}) {
    const token = tokens[idx];
    let result = "";
    if (token.hidden)
      return "";
    if (token.block && token.nesting !== -1 && idx && tokens[idx - 1].hidden)
      result += `
`;
    result += (token.nesting === -1 ? "</" : "<") + token.tag;
    result += this.renderAttrs(token);
    if (token.nesting === 0 && options.xhtmlOut)
      result += " /";
    let needLf = false;
    if (token.block) {
      needLf = true;
      if (token.nesting === 1) {
        if (idx + 1 < tokens.length) {
          const nextToken = tokens[idx + 1];
          if (nextToken.type === "inline" || nextToken.type === "reference" || nextToken.hidden)
            needLf = false;
          else if (nextToken.nesting === -1 && nextToken.tag === token.tag)
            needLf = false;
        }
      }
    }
    result += needLf ? `>
` : ">";
    return result;
  }
  renderInline(tokens, options, env = {}) {
    let result = "";
    const rules = this.rules;
    for (let i = 0, len = tokens.length;i < len; i++) {
      const rule = rules[tokens[i].type];
      if (rule) {
        const _result = rule(tokens, i, options, env, this);
        if (isPromiseLike(_result))
          throw new Error("Renderer.renderInline: async rule detected, use renderInlineAsync()");
        result += _result;
      } else
        result += this.renderToken(tokens, i, options, env);
    }
    return result;
  }
  renderInlineAsText(tokens, options, env = {}) {
    let result = "";
    for (let i = 0, len = tokens.length;i < len; i++) {
      const token = tokens[i];
      switch (token.type) {
        case "text":
          result += token.content;
          break;
        case "image":
          result += this.renderInlineAsText(token.children, options, env);
          break;
        case "html_inline":
        case "html_block":
          result += token.content;
          break;
        case "softbreak":
        case "hardbreak":
          result += `
`;
          break;
        default:
      }
    }
    return result;
  }
  render(tokens, options, env = {}) {
    let result = "";
    const rules = this.rules;
    for (let i = 0, len = tokens.length;i < len; i++) {
      const type = tokens[i].type;
      if (type === "inline")
        result += this.renderInline(tokens[i].children, options, env);
      else {
        const rule = rules[type];
        if (rule) {
          const _result = rule(tokens, i, options, env, this);
          if (isPromiseLike(_result))
            throw new Error("Renderer.render: async rule detected, use renderAsync()");
          result += _result;
        } else
          result += this.renderToken(tokens, i, options, env);
      }
    }
    return result;
  }
  async renderInlineAsync(tokens, options, env) {
    const renderInline = this.renderInline;
    if (renderInline !== Renderer.prototype.renderInline && this.renderInlineAsync === Renderer.prototype.renderInlineAsync)
      return renderInline.call(this, tokens, options, env);
    const tasks = [];
    const rules = this.rules;
    for (let i = 0, len = tokens.length;i < len; i++) {
      const rule = rules[tokens[i].type];
      if (rule)
        tasks.push(Promise.resolve(rule(tokens, i, options, env, this)));
      else
        tasks.push(Promise.resolve(this.renderToken(tokens, i, options, env)));
    }
    return (await Promise.all(tasks)).join("");
  }
  async renderAsync(tokens, options, env) {
    const render = this.render;
    if (render !== Renderer.prototype.render && this.renderAsync === Renderer.prototype.renderAsync)
      return render.call(this, tokens, options, env);
    const tasks = [];
    const rules = this.rules;
    for (let i = 0, len = tokens.length;i < len; i++) {
      const tok = tokens[i];
      const type = tok.type;
      if (type === "inline")
        tasks.push(this.renderInlineAsync(tok.children, options, env));
      else {
        const rule = rules[type];
        if (rule)
          tasks.push(Promise.resolve(rule(tokens, i, options, env, this)));
        else
          tasks.push(Promise.resolve(this.renderToken(tokens, i, options, env)));
      }
    }
    return (await Promise.all(tasks)).join("");
  }
};
var config = {
  default: default_default,
  zero: zero_default,
  commonmark: commonmark_default
};
var MarkdownExit = class extends Parser {
  renderer = new Renderer;
  utils = utils_exports;
  options = { ...config.default.options };
  constructor(presetNameOrOptions, options) {
    super();
    const [presetName, opts] = typeof presetNameOrOptions === "string" ? [presetNameOrOptions, options] : ["default", presetNameOrOptions];
    this.configure(presetName);
    if (opts)
      this.set(opts);
  }
  set(options) {
    assign2(this.options, options);
    return this;
  }
  configure(presets) {
    if (typeof presets === "string") {
      const presetName = presets;
      presets = config[presetName];
      if (!presets)
        throw new Error(`Wrong \`markdown-exit\` preset "${presetName}", check name`);
    }
    if (!presets)
      throw new Error("Wrong `markdown-exit` preset, can't be empty");
    if (presets.options)
      this.set(presets.options);
    if (presets.components)
      for (const name of Object.keys(presets.components)) {
        const component = presets.components[name];
        if (component.rules)
          this[name].ruler.enableOnly(component.rules);
        if (component.rules2)
          this[name].ruler2?.enableOnly(component.rules2);
      }
    return this;
  }
  enable(list$1, ignoreInvalid) {
    let result = [];
    if (!Array.isArray(list$1))
      list$1 = [list$1];
    for (const chain of [
      "core",
      "block",
      "inline"
    ])
      result = result.concat(this[chain].ruler.enable(list$1, true));
    result = result.concat(this.inline.ruler2.enable(list$1, true));
    const missed = list$1.filter((name) => !result.includes(name));
    if (missed.length && !ignoreInvalid)
      throw new Error(`MarkdownExit. Failed to enable unknown rule(s): ${missed}`);
    return this;
  }
  disable(list$1, ignoreInvalid) {
    let result = [];
    if (!Array.isArray(list$1))
      list$1 = [list$1];
    for (const chain of [
      "core",
      "block",
      "inline"
    ])
      result = result.concat(this[chain].ruler.disable(list$1, true));
    result = result.concat(this.inline.ruler2.disable(list$1, true));
    const missed = list$1.filter((name) => !result.includes(name));
    if (missed.length && !ignoreInvalid)
      throw new Error(`MarkdownExit. Failed to disable unknown rule(s): ${missed}`);
    return this;
  }
  use(plugin, ...params) {
    plugin.apply(plugin, [this, ...params]);
    return this;
  }
  render(src, env = {}) {
    return this.renderer.render(this.parse(src, env), this.options, env);
  }
  renderAsync(src, env = {}) {
    return this.renderer.renderAsync(this.parse(src, env), this.options, env);
  }
  renderInline(src, env = {}) {
    return this.renderer.render(this.parseInline(src, env), this.options, env);
  }
  renderInlineAsync(src, env = {}) {
    return this.renderer.renderAsync(this.parseInline(src, env), this.options, env);
  }
};
function createCallableClass(Class) {
  function callable(...args) {
    return new Class(...args);
  }
  Object.setPrototypeOf(callable, MarkdownExit);
  callable.prototype = MarkdownExit.prototype;
  callable.prototype.constructor = callable;
  return callable;
}
var MarkdownExitConstructor = createCallableClass(MarkdownExit);
var src_default = MarkdownExitConstructor;

// node_modules/comark/dist/utils/helpers.js
function dedupePlugins(defaultPlugins, userPlugins) {
  const plugins = new Map;
  for (const plugin of defaultPlugins) {
    plugins.set(plugin.name, plugin);
  }
  const seenUserPlugins = new Set;
  for (const plugin of userPlugins) {
    if (seenUserPlugins.has(plugin.name))
      continue;
    seenUserPlugins.add(plugin.name);
    plugins.delete(plugin.name);
    plugins.set(plugin.name, plugin);
  }
  return [...plugins.values()];
}
function defineComarkPlugin(fn) {
  return fn;
}

// node_modules/comark/dist/internal/parse/syntax/brackets.js
function findClosingBracket(str, openIndex) {
  if (str[openIndex] !== "[")
    return -1;
  let index = openIndex + 1;
  let depth = 0;
  while (index < str.length) {
    if (str[index] === "\\" && index + 1 < str.length) {
      index += 2;
      continue;
    }
    if (str[index] === "[") {
      depth++;
    } else if (str[index] === "]") {
      if (depth === 0)
        return index;
      depth--;
    }
    index += 1;
  }
  return -1;
}
function parseBracketContent(str, startIndex) {
  const close = findClosingBracket(str, startIndex);
  if (close === -1)
    return null;
  return { content: str.slice(startIndex + 1, close), endIndex: close + 1 };
}

// node_modules/entities/dist/decode-codepoint.js
var c1 = [
  8364,
  0,
  8218,
  402,
  8222,
  8230,
  8224,
  8225,
  710,
  8240,
  352,
  8249,
  338,
  0,
  381,
  0,
  0,
  8216,
  8217,
  8220,
  8221,
  8226,
  8211,
  8212,
  732,
  8482,
  353,
  8250,
  339,
  0,
  382,
  376
];
function isInvalidCodePoint(codePoint) {
  return codePoint === 0 || codePoint >= 55296 && codePoint <= 57343 || codePoint > 1114111;
}
function replaceCodePoint2(codePoint) {
  if (isInvalidCodePoint(codePoint)) {
    return 65533;
  }
  if (codePoint >= 128 && codePoint <= 159) {
    return c1[codePoint - 128] || codePoint;
  }
  return codePoint;
}
function codePointToString(codePoint) {
  return codePoint - 1 >>> 0 < 127 || codePoint - 160 >>> 0 < 55136 ? String.fromCharCode(codePoint) : String.fromCodePoint(replaceCodePoint2(codePoint));
}

// node_modules/entities/dist/internal/decode-shared.js
var BASE91_INVERSE = /* @__PURE__ */ (() => {
  const table = new Uint8Array(127);
  let code = 0;
  for (let char = 33;char <= 126; char++) {
    if (char !== 34 && char !== 36 && char !== 92) {
      table[char] = code++;
    }
  }
  return table;
})();
function decodeTrieDict(input, resultLength, atomCount, dict1AtomCount, ngramCount, dictSize) {
  const base = 91;
  const inputLength = input.length;
  const twoCharBias = dictSize * (base - 1);
  let pos = 0;
  const readSlotCode = () => {
    const c1 = BASE91_INVERSE[input.charCodeAt(pos++)];
    return c1 < dictSize ? c1 : c1 * base - twoCharBias + BASE91_INVERSE[input.charCodeAt(pos++)];
  };
  const dict2AtomCount = atomCount - dict1AtomCount;
  const slotCount = atomCount + ngramCount;
  const single = new Int32Array(slotCount);
  single.fill(-1, dict1AtomCount, dictSize);
  single.fill(-1, dictSize + dict2AtomCount, slotCount);
  const start = new Int32Array(slotCount);
  const length = new Int32Array(slotCount);
  function decodeDelta(count, off) {
    let previous = 0;
    let slot = off;
    const end = off + count;
    while (slot < end) {
      const code = BASE91_INVERSE[input.charCodeAt(pos++)];
      if (code < 89) {
        previous += code;
        single[slot++] = previous;
      } else if (code === 89) {
        let runLength = BASE91_INVERSE[input.charCodeAt(pos++)] + 2;
        while (runLength--)
          single[slot++] = ++previous;
      } else {
        const next = BASE91_INVERSE[input.charCodeAt(pos++)];
        previous += 89 + (next < 90 ? next * base + BASE91_INVERSE[input.charCodeAt(pos++)] : BASE91_INVERSE[input.charCodeAt(pos++)] * 8281 + BASE91_INVERSE[input.charCodeAt(pos++)] * base + BASE91_INVERSE[input.charCodeAt(pos++)]);
        single[slot++] = previous;
      }
    }
  }
  decodeDelta(dict1AtomCount, 0);
  decodeDelta(dict2AtomCount, dictSize);
  const references = new Int32Array(ngramCount * 2);
  let poolSize = 0;
  let ngramIndex = 0;
  function readNgramReferences(count, startSlot) {
    for (let index = 0;index < count; index++) {
      const slot = startSlot + index;
      const a = readSlotCode();
      const b = readSlotCode();
      references[ngramIndex * 2] = a;
      references[ngramIndex * 2 + 1] = b;
      ngramIndex += 1;
      start[slot] = poolSize;
      const entryLength = (single[a] < 0 ? length[a] : 1) + (single[b] < 0 ? length[b] : 1);
      length[slot] = entryLength;
      poolSize += entryLength;
    }
  }
  readNgramReferences(ngramCount - dictSize + dict1AtomCount, dictSize + dict2AtomCount);
  readNgramReferences(dictSize - dict1AtomCount, dict1AtomCount);
  const pool = new Uint16Array(poolSize);
  let write = 0;
  for (let index = 0;index < ngramIndex; index++) {
    for (let half = 0;half < 2; half++) {
      const source = references[index * 2 + half];
      const value = single[source];
      if (value < 0) {
        let read = start[source];
        const readEnd = read + length[source];
        while (read < readEnd)
          pool[write++] = pool[read++];
      } else {
        pool[write++] = value;
      }
    }
  }
  const out = new Uint16Array(resultLength);
  let outIndex = 0;
  while (pos < inputLength) {
    let slot = BASE91_INVERSE[input.charCodeAt(pos++)];
    if (slot >= dictSize) {
      slot = slot * base - twoCharBias + BASE91_INVERSE[input.charCodeAt(pos++)];
    }
    const value = single[slot];
    if (value < 0) {
      let read = start[slot];
      const readEnd = read + length[slot];
      while (read < readEnd)
        out[outIndex++] = pool[read++];
    } else {
      out[outIndex++] = value;
    }
  }
  return out;
}

// node_modules/entities/dist/generated/decode-data-html.js
var htmlDecodeTree2 = /* @__PURE__ */ decodeTrieDict("!}.&u%}'&}*'~!6*)%&,~!J~!J~%L~y<~!R,~~%Lu~~#GD~~#|)1#%}^%}2%+#.##%##%}&%##%'#%##&%#%#'%#&#%#&#'#%%#&#%##%#)%''%&%#%#'%#%%#%%}%%%#%#&(23#%%#&-%0%('1#(##%#'##+%'*.:1}#%#6-+(%'%%#%%%}#L'2351&('%}&/N'(0(/*-%(%%}#'+&T%7.2}#&%&#%#36/5##%&%%#&#%%#))2%%##%&&'0~!#*+&'%1~!%).'3q?&%'1~!.##%6(~!+%%%(Gw'rT~!E#<nA%#jZ~!H%(~!42##~!*31&~!G%U~#)5~#`3~!J~!Z~%]~%Y~%C~!q~!u~#kz~%#~!6'~!D~!U~!?~#T~!c%~!G#'~%7|~!G~!J~!G&~#pb~(Df}#%}*&}#%##%##%##&#-}&'#'&%#.++}%mI,#,@&(}*%}*'%&##&#%##%}&0}#.},U},%}+%}&%}#%##&}B%(}(%}+%)})%##%#&}&%##%&}<%}>%#%&}*%}(%}9%}/%})%}*%}*%}?&}&%}3%}&*#%})%#%#)}#&#-#+*%E%%'%'#%}#*V##&##I}#&&##%&%#&&Qf%%))w/0+&%#(#.%-''''++++7}>%4'',##1,#%#&%##&#'##&#*#9)%&%}#*}%,#+P(%A&%#'&##wSD',9E00#y#@}(+}&%&>~!#~!X}#*}(&&}(&}(,%}%&#+&}#&}I%#%}%)#(},'%#*}4%%#%}(''}#/##(##),%-##%%)#&}(.}&%#&}%%}*&#%},&&}&%}#%*'#%})%}D&}&%}-&}6&#&}-,%}#%})-(~+`~,=?~I9'9%~!,#%})%})%}@%}?%}(~!?~#<~#pP~#BG~#=1#%K+~#?#~%;)~#A~#mF1~#A'~'X%'~#lR~#N~'N~#r~#m#-~#i'?%#'%~#B%##%,%#~#_%#0%~#]732~,w~2+#:&#%&'0%&>%}#>##F+)#%&&#(+_}4&}-%}(&}@&}O7Fdf0@+/v4}&WU##&/0#&'('B#%}.%}'+#%}#%%&#&%#%##+#&#)#6#'#.},%}c%},%#%##%&#&%#&~#>'*-.%##%##%}#%%}%'~#)D1}#%*&~#_%%'(~#S2%'.}#~#=##*'*-%}&'%'##&&~'E%.#&~#M4}%%##&'%#~#O1##%&#'+~#<B%##%%'%+~#;#@%}#&%#&&%#(~#H1}'%'##&&~#?A}&'~#D#%32}'&&&&~#[}'(#%}'~#;C})&}%%#%~#=&%,3}%'(#%%~#^'#&&)#%'~#Y%-~#d-%'~#^%%&#&&&}#~#b~2t*&'~&(~&@~0%~e~3}%*''0})&}+~!9##-}#%-hD*)1fC#%/&/fB#40~!+#)*4~!+~!K'&:~!/*7~!.#~!H~!L':~%x&~!H#~!*~%1~!I#~!+A~#p'~!F~~#-#~,,(~.Z~!V~%;'B'mq-W~!N~%I%#&&#&}#%},%%}'%}+X#%}#&}(%}'%}<%}#%}%%'}'%}:~![)9@~%>~#UA%-%##&~!C%~!-.9:~!1~!-^2/:a~!y,D*J#-5)/4~%23,~#G~!L1~!0X3`~!2+~!!0-~&E~!W~!o,>Y&]~%cZx_&~#O*9#A#'#+I'%#)~!0B*-5A+-((F&*M#)(-7-5+'-3a5Vi~!Y~!?+[)%3),ERHm~!+:D,VG.+)?fB%%*(%)'(#&80%1'8`K8?`+'Z#&O&'H5#*9)A%%5&3))0%39+.*7#()&&*=4@**L)<'_&*+..;(#*+)./&0#3)%')-8(4ixD(&.}%,('aI:,)%,k2231T)I'#/-W7,/'Q#.'Y24+h')37</31&83##&0#),H(?'&?/1##%#&&#%''-%&&&#(&''&#.-'%#%%(,')*'&#&#'##%(%(#%('#&##%%%%('%#%#%%#%#&%##h>w+v<ayvyvcg.uuhKr}g/v|g>u9i[~>g5uI~=RvdwEg;v/g;uk!!TTSx]@RT!U!#!@VBRUU!'UTe-d0c`e&gSdicedFcrdTaqb.kYcAohdYd@a3e+d}dMdtd.aJ#bqcK`dle/e.e'dwdPdodddjbEb}ogd^ofdpduc6j?l%d{drdqc)d7bacOdQ%T#Y)X.sR[yH>6Vyv3[xwLu>vo'!*.[yBacahoj>6Rew3[xqdZa#!a&#^(X-[yG>6Vyu3[xvg3sEr|g.u/Ri9db0T#^(Xa)!-[y;>6Vylg4wKs{JwNZt3@3r=c4Z([xlg;wKt!cpq's@v7A'*a(a+!-a#[y<3Dt?3Dt'>6Vym3[xmg9rxsNJwLZt4~?r?db1T#`-!(Xa,!0[yS>6Vz%NuQs.g4wKtnJwNZtS@3r>c4Z([y%g;wKtrdga8!a(!#&T*Y-Xa#!a0<or[yc3Dtq>6Vz43[y3JwNZtf@3s!Ju}!%Dti:pm3c_%X#tjB5pkd6q!r]u?voC'*-a.a2!0a&a+[yI3DtI3Ds~3DtH>6Vyw3[xx;:s#~<5pKJwNZtE@3r~d`a)!a2T#a.(!+U.X1[yT3Dt`3Dtv>6Vz&3[y&g9rxwzcxstPu.<rAJwLZtT~?r@dZa%!a.&^*Za(/Reu[ya>6Vz23[y1g3sEr}wkg{NuQRg{ci(U#5@b`~,cg#U(2WnH5wugcRh7dX#T(Y,a'Ta!!a,[yZ<]mj>6Vz,3[y+Pv#5ReZKu+=,%!H}7ABwkaS?Rh:BcW(X#<]mrj:ubv/ARekdg%!(!a.*Ta(Y.X1!#sP>Rl*Dt6[y>>6Vyo3Wf*jOvuumvuRgRJuq*!:9<B@bX~3jVv&v@s@5Re[d/rQt{uAvo&a&a*)a2!,0Wf!3Dt0=Bs'>6Re}3[xy~<5s%JwJZt1~Gs)c;&!#2sJkNuXvzq7rxu,Re8dka4!a8(aEZ+a@Y.X1Xa)[yd=Bs(3DtP>6Vz53[y4cX#X&Re:avRe9~<5s&JwJZtQ~Gs*i^rzvdRg+Jv{%!2sbB@bX}kdga,!Za?&^*T1/!a'Dt+[y6>6Vyf3Wf%g/u;s4hGu6?Rh-JvZ,!c%#&RoX54Rivj7uyvf8RgTKvZB%*!2sGh<vu5Rgq<=C::9bb~#dZ#T&Ta6Y.X*Dt>[y93Wf)coZ(T,6VyifluvRgC@95@B@bX~/hFu34cC#T,k/unq8w8Q5RkUklwQuzunq8w8Q5Rk8d/rJu?v8w9)-&!a0a;a&aIWejg3sEr/h1s<DtDJvyZqY5aws3Jvy!&Wei~Hr1:au5@Bag>23E~5c:Z&bX};kKv?w&unuVu5Rjc;>bs)#~@:Rh.=ay<a]C;b`}Vd6s/t{uAvoaxa()!a,a7%-a#a2Dt,[yF2Wo[>6Vyt3[xuNuPRi&NuPwpi#RoWh?vf8Ri%Jv]!%Ri:KvxD!.'2WeAjZu`q9rxu,Re7woeAg-unLq(qA_/*2Wg_g3u5q^9:4E}/jTrxrzv=Wkkd~0UX#^^Xa-a1a5T&a=U1a'*aEa]!a*aPaA-adok[y54Rn>;:p3~Dp5g9rpsFNvZqjg3uJp4~<5p0Pw;5qlJwNZt*@3p1Pw:5p/Ou!5p2JvG'!6Vye=<qnJvh_[xhg3v,Rh3kOwOw-sDuev/Re^dha[a%!%!a+#Ta7)-5TaCaO!aka!a)sf[yb2>Rl!9ARiq5E}Qg=ucRkBE|oJrJ_@Wk~@Wk{JrJ_@Wk|@WkyJrJ_@Wk}@WkzJvO_[y2g-vMRmiKuYC!)&>Ri;>Ri<@3RkNc](X#@9Rk=g5vuRmhKvDB!+'=]meg3u4Rmgd)#Y'Vz3CARmfd`a+!%T'!+#Ta1Ta6TaM-sTDt9[yA9sYd'%Y#s[[xpj:ueunaXRgEjRq,v-vuqdd2'`#6Rev<32@5>:2<E}5xIo9a*X#Y(;5RePJvD_g>vyRgNj8w)v8<wggs:RgXiZt|vjx,hSq3ah!-(~@:Ro/Ou!5RhWj^v(pyw8unRhUdx-UY#^Ua.a3a70!)%UX1TaDa)'omRiRRhE[y:3Dsz=Br,>6Vyj3[xkg6ruwjcqsrPw;5r*Ku]D'Zt-@3r(~?r.i[vwv]dU1a--U#`a4(g/vsRhPOu!5RhLj:rmu9Wo!~@:wdh@g/vsRiTjXuvvNr}:RhBj^v(pyw8unRn]dz1UYa'a+^Y(!aETZalaRY.Ta?a4[yDJw1!#qLsW>6Vyrfzq-pLflpwRe|Js>%!Dt@3Dt&Jvy_[xs~HrnjMuwpsw'RecKu+D#'!t<~Grl~?rjg5u-x,gwp{ah!-(~@:Rg~Ou!5Rh'jXuvvNr}:Rh#cW#X/c;&!#2sLi[v7u7RgpJv)(!iLrxu,Re6j7v@s@5Se[e7d`aW!Za(a`T.a#!a3!&aDa-!9)Dt_=6s+3[x~~DR|h~DS6avhGun5RkZj3w)v-]mkKunB!&*]kb97R|i<ARk<c:Z(6Vy}Juh'!wziMRoS:F|vkLuauJv5vtvQRh1d='T+Y#VyO~DR|jcF#T'7R|g97R|kJv3'!ay<Rj,Jvh&!:ReXcsa6*a+#a#_aIRf9aLRf?c,Z&Rf5Rf7c.Z&Rf;Rf>cQ#%T'p-Rf8Rf=ct#%'(*!,p,Rf4p+Rf6Rf:Rf<d~'Ua%U*^UYa(!a,-!#a4YaTalaEX0a8a<Weo3Dt/3Dsx=Br93Wen~Dr;~<5p<JwNZt2@3p=Pw:5p;Ou!5r3c7&!#:p>3Ds}KvGB)_6Vyk2sM=<r7x'eovA(!hFu1ARf}cV#X&@r5j6rvwQa^Rf3c=Za'wkghJv__g;unRggA53B9=b^}%j6uduo5Jq;!(hIv%2Re`Ou4ARe_e%a#^^^Xa&!a*a2!&a6YaP!*ad!#a:aE/5Rn?[y@>6Vyp;:pE~DrY~<5pBJwNZt8@3pCh=rt3rWPw:5pAJup_[xoNuPpF9c!#'45pD5ARn)d8#X'X*3@rU72s]h>v<<sSjJpqvewOJq/(!hNw'5ReBk0s2u3w/w'5ReE5@Jq.!a+JQ!&WeU23d(#Y&RjG5]jBk!u7w&u0udARjEe#+^^^Ub#!a2/a`Z(agT1!a-a;|@TaG!aS[yV=Re~fow'RguNuPRe?bz#'>RoUWeL>:Cbb|?JwPZtVg6ruRmzJvD'!6Vz(g/vmRh~Jvy_[y(g9voRgyx*cy(#2>Ri2B9b]~9kIw9u7rluJu3Rg]dI#a%UY'@=p%CAx.gQZ&RhwwygtRm{x5g_Z'+ABqR9Woa=Bp&dV#^*Xa'!&@o{g4v]Rk;Jv{!%Rk[wkkiA5RkiwwfUB=x,fUuqC&*!>RfTg8v0RfV~ARfSd;rJsAuAv9wR'ae+/aO!a@aza/a#[yQ@Wg!2Wemg3sEr0JvB_g>uvReWg2v+Re=KupB_+[y!2AbY~-~Hr2AJwD!(h<~El>h<~El?Kun@+_:9b`}Kg-v/Ri3g;vtwyk_9]k_d=&T#*U.6qh@Ab`|K9:H|CJv[!&3Dtex'fDwC%!Rf[9WlMd[(^X,!a%Z06Vz!@WgBg=v~Rgvg,QRe@awd,#Y+jTv|Q~EfWj]uNr|~FRfXdy#Y&^Ua%!aO.!(a)Ua;=!a@aKap!a-,a!Ta]a[rSa]p?[y82sK=Bq~;:p:~<5p8Pw:5p7d'#Y'Wf(;RnRi[u4w&RgJJvG'!6Vyh=<r#ijuuv/sIKuYD'ZtG@3p9~Gr&d2#`(g<vtRgFj`u5w&rqpxRf2CJuY!+:wfnTOu!5Rg}jNs1ucv&RfwJvA!&3@q|BDcC#T,k/unq8w8Q5RkTklwQuzunq8w8Q5Rk9dga#!a'!a=#a0!:+Tb*b@aO.a4!aba8aFJv^}?!VyR~Dr<g;u%Rn.~<5p[x'e`wNZtR@3p]Pw:5pZhNvjBp.woe_g5u-r4JwF!%DtO3:ooc7&!#:p^3DtpLuGw(!+%)Dtk6Vz#2sd=<r8d'#Y([y#<x3gJt`w@!)%}MRiowzikRij=]ilxAf3,U(#B2Rf#g0v-Rm[ck{`U#]giKv3>)!&6Ri154s,KuGB_%@r68r:dJ|t`#X(9<E|u2@H|rx3gJu?w'!+'1Nu7Reg4=H~+9<wxgY95Rm]xLggZ-`(X}U2:Ri4h<uOawRmsJv__5@bb{jbV~3dka#a'a]!,#a+U=a>b6a3b%!/aKa/)!arwve^VyJ;:pR~DpTg3uJpS~<5pOPw;5qmPw:5pNOu!5pQJvG'!6Vyx=<qoJvA!{~Jup!%@qk7Rn/KvyD!}''[xz;>wkh'?Rh,x8gyt`w5D!&),(SgyccRgztJ@3pPB5p#d'(Y#<]mmifubw&RgoJvE&!82s^JvF&!8Rf,ADb]~;x=h'rNu]vK!,%'*0RnORh)4Rh*AqQg-vaRnNg;wHwkh'ba~4cE#Ta*x3gctyw@'!+%RnFRnD<4Rn@hFvK5RnCxWg[#`&a0Ua()`1Rm75Rg[c]%X#qi8Rg^NvdRj>BwzgZauwji7Rm6A4wgg]d1#&(*,.0a#Rm;Rm<Rm=Rm>Rm?Rm@RmARmBe%#^^^Xaea?aC/b+(,!a+a#!a/!>a&Ta<aKbD!2wphBRnk[yPw}hE|.=Br-3Dtm>6Vy~g6urRf.x,hPrNav!%'RnqRo%Ro#Nu;q[Pw;5r+JwNZtM@3r)d'#Y'Weh;xChL#`&RnmRnoKu}>%(!Rne~Bs-;2wjcussJv+'!aYSO}6@B<5?ba~8LrNvj!.%*ROwungw~ng~:9;Ri^>wtnig;wHRnixDh@|(UZ.x1h@|)!#:2<H|*xHn]#-UX'3Ro)z=iT}6ARns=Bwsn_wpnaRncw]aR(#UXa&Ua*a/=]iPd'#Y&Ro'WnXf{QRm2hNvj]nZd`'T~&1`{|`#9b]{}c:'!#Wl{>@=be}]?cl{{U#:5Abb}Jds#^YaF!a*b4a#a3aPa>&Tb!bH!*a_!Eau?/a&RjY<]gj>6Vz*;:pe~DrZg,QRj1JwNZtX@wihspcJvZ&!VyX9WmOJu|!|N2WmHJvh&!]ht~Bpbcn&T(!#RmQ<s7Nu;padH#X'`+WmJ@>RmKCARhnKup=!)&Wf+:RhqNuPpf9c!#'45pd5AwghpARn(Ls@w!%,)!RmP@Wfe<E|IJva!&WmNg8vsRmLd`*.`#Y'Xa!axRn*]hrA8Rhug5s@rXg8u!RmMd8#X'X*3@rV72smdI*#UY&RmICARho~GsgxVgd)Ta'U-Y&Xa!T#RnEWnA@Wffg1uDRi0hFvK5RnBxGnG&#`%owp)@wsf+bX}Ze-*1!a*^^^Ua|!#a.aq&Ya2!a>.a6!a:aO`aJDtL[y`@Wg#>6Vz12@wzoYRoZNuPRi!NuPRhzg=ucRi,@=b`{Yg=ucRi-ACJvB!&Sh[ebSh]ebi`wUuFRm4Jw2_[y0JvB!.<Ju(!&SoG}6Shd}6<Ju(!&SoH}6She}6Kur@._g5vHRieJvx!{L2G{Kx6gd'T#?Rh82Wi5cZ#X(g1w)Rm5dW-Y(Ta#!a)!#aYa=wnfE=su2>>bU{0j9udv:<svj8uQv-7RgHdE%#^'sq9sp=>Bb_{TJv`!&g/r|snj6v(us5d,#Y(56H}[978H}]Jw5!&g1rushJvB!+j;v{u5?zDhd}6}bj;v{u5?zDhe}6}ce*#`(^^^a[aea!=!a6a*aoXb1a.!aAbL!b>,b'aL!aV@Wf|2Wlg3[y/JwNZt^@3piPw:5pgJunZou3@rsJva&!Vy_g<v~Rm#JvG'!6Vz0=<r{Ju{%!:pj@WfsiXuJu3Rm:JvZ&!WfA~Bph@c4Z&Dtwax5rubx(#:awRk1@d,#Y&RfjRfid1#,Y(@Wfp2Wlrg5s@ryKu[@!,'=]ig9wlk?Rk>g5u-rqJvy'!@9RkQcH(T#=>Ri~@<wkj(Wj(KuZB*!&<7rw@9RkRcH(T#=>Ri}@<wkj)Wj)dg(Ta2Xa9X#`-!a*CARhg@@=I}d9x;c~#X%so=<sj>2@@=aybb}XjWv0Q~EfEj3vLv;<d,#Y(56H}`978H}_dgaPaFa'a/!#a3Y0a_a;a|!1(a7-[yE3[xt;:pJNvZrrg3uJrvJwNZt=@3pIh=rt3rxPw:5pGOu!5rpJvG'!6Vys=<rz@c4Z&Dt(ax5rtJvZ!&~BpH@wsfNg-vaRlNci*U#=<wei<F}a5@Jq.!a*JQ!%@qZ23d(#Y&RjH5]jCk!u7w&u0udARjFd/prq=tyvpaEa(a:.!a1aZ(@@=I}:9wpd%=<sX55w_h}@@=I{t=ay<aU@@=I}T=ay<2@@=I})?C9:9au@9Cb]}DP~=x-fAZ(2Wl1=ay<aU@@=I}>5@d##Y+jTv|vV~EfFj]uNpn~FRfGdgaK!Z2&!a8a-Tb({E!acTbM*!a(DtY[yYd'%Y#sl[y*hHvh>Re5x2c{Z}.j4uCvcawRiMd+#X+_x&d!},<5RkX;2Hzw@x,gavfB-!{CcF&T#Roe;RodwWbBg5urRgaKvHC*_6Vz+<4opieuew&Rmq@d]&Y)X,T#X0Rh}<BqP=4qS9:ReMg/ujReNJw0!/<Jui%!bd{kawwnemRelAxUa?a3#*.&UX(Ya+a/RhvRnQ<o}9Wmtd-#Y&RgSRmw9;Rmxay=Rmyg-vaRmuxEhSrNu,v-voC!%(aR.a(a7+1Ro1>Ro5CE{A9b]{@;5x#eO{:g;urRi+KrNA!%(Ro3>Ro79;Ri_Ku@>{;&!x%gX|{KunA_+g5QRj/g3u5Rj#g>uERj%wio/xRhS&!,!#^1U}wba{8>>@=be}qC@:D5ba{7Ku+A&!}x?ba}t>>@=be}se(aA^^^Uat!b0#{pa+awUazbGa#aLb9bgaWac'a5TbS=Br!d1#`%scp_Jvl!#rT>Re0JvX&!VyN=H{Fcm#U&:pY=ReaJv2&!]h0=]nUJvG'!6Vy|=<r%JrM_=]h2@Wlud'#)U'Wf'b]{i=]h/Jvh!&~BpWg=v]RnMx+ny#'Nu;pVwjnu=]nwxJnx,T#`&Reqwjnt=]nvieu9vrRjLLuYwP(#+!th@wih5pX~Gr'g5v/Rh4KunA'!-CARnP@wwiN:Rm_9x'cvw>!|l=<saKvAA!0&3@q}>w^e1bp#&Re2Re3BDx7gH#T|f5H|eKuZ>!%(:qNAH{]Jv6!+3B2B9=b^{X<5<B92:E{ZLvhwA(a;a%!igQuyRmad+#Y}m@3Rh5d8#X'X*:AqUAHzmaxwbh<aXRnVcF}RT#Nw&cj#U(BWnug/vsRntdka)(a3+.Zb7aYYan1!bVa@Xa}[y^@b[{G=H{+hFu73Rj&Pv#5ReQcK%T#sig1v{Rj'Ku+D#'!t]~Grm~?rkKuMB!01d5#`'Vy.ta3Dtu~Hroc8#'{^45s85AwZbP&!#Rn!wghxWn#KvEA!)&2RlA2RlBx:h|#(T,=]j09Wobz>x]z/@awRoTd+#Y(az]hFhCrm4d,#Y+jTv|Q~EfMj]uNr|~FRfOdCa!Xa9_X#@<plJvf!%b`{(9;Rgwc;.!#2x7cw#T|UDb]|T5Ju={(!=@E{&Jv)&!Ab`{'awJvf!~*>>@=be{#KuY>!+&4Ezyi[ugv&RjIdea+T)#UXa&T-T&a!Rh9auRmW=]kLg5vuRn+g3u4Rn-Ow6ARn,hHus5xNk?#UX(U~)/g8v0RkD~AwkkF?Ri.OuNBwkkA?Ri/d|a2`a*^UYa.!aBTZaTa'Xa;!(!2!-a#b2[yC>6Vyq3[xr2Wi?g1rusVh%s?DtF~<5rbJs;%!DtBfswKtCj[uvuSsEu3RgVx3o:u+wN'*Zt;@3rd~Grh~?rfg8w)Lq)qE&-a%!>bI|`jWv0vV~EfCjTv|vV~Ef@j]uNpn~FRfBcK#T']gWNu7x,k7q4ai(0!hHv8<RhmkMu9vrsBuev/RhlCJvB!,g<v{wchh~@:Rhji[vrv{wchi~@:RhkdS&a5UY#Ta!RgPwwiI5BwciI~@:Rh`x'iJvj'!5]iJPu8Bwch]~@:Rhach)U#h3rp]gLh@t|Ax,hTq3ah!-(~@:Ro0Ou!5RhXj^v(pyw8unRhVd|)`,^UYas!a?/a2Z'a^Ta{Tb7Ta(a#!a,Wf&9sZ3DtAadamov=Bqt3[xig8vsRm~>waiL2b`{QJv*_Ouv2qgj<v]v2BqfdR'X*X#Y-@3qr~Gqv~?p6hHv-]glPup5Lq+q?_%*b_{qF{n9b^{rOu4ARhpKvCD!+&~Bqp:5Dbb}nwoiKl&unuTuBv]v+ueunaXRf0=Jvh!0nKufu8v1w&w7q%w&uHrz:Rgnj5w,uxDJq/(!hNw'5ReCk0s2u3w/w'5ReFd>Za&!*UaA=<wkgsRnSJv^!%Refifw3vyRgOKu_B'!,<]gkiiu:w&Rh<=C@a^<B57@2F{[<B5@aW:=3away9A5aW=<B=C@a^<B57@2F{Ie-#`(^^^bCara.b8aza6!/bZ,!adTbnTbOb+aFaS!aAT9@Wf~2Wli3Dtl2@d,#Y&RfnRfmJwJZtN~GqyJva&!VyMg<v~Rm%iXuJu3Rm9Jv[_=]ih9wlkDRkCd1#`(@Wg>2Wls3cH#T(@<Rj*=>Ri|b~'#23s9h<~El.d'#Y&Dtxi^rzvdRl#d*#U%(o|B2s`hJwSaxRmDKv4B&!1:Rmdd5#`'Vx}to~Hq{x'f1v3(!BA5ba|bJv_&!Wfug1v]ReIdO+U/Y#&G}-8wze=Rh{g1v]ReHg/uQRf/by#)ibQwERl/cH#T(@<Rj+=>Ri{cNu+vlax-!(#a0qa9<Rii2;;bU{H;x<i=&X#Rk`<4wwi=C9H~8xAI(Y#<azRi@45wXI<B9;5bb~7dL(X#Xa(+!aL6Vy{g5QqOau:5au2@ay547EzbxOcU(UX-T#Ta#:Cbb|A?wjh/b_|SOw6ARgtihr}u7Rhy<d1#T)X1@@=I|~=ay<2@@=aybb}Sj3vLv;<d,#Y(56H}A978H}@dGpvs@uAu`vcw9*!aFa+ai%(b!aXa8.a?a[ozWey=sU2@G}Nch&U#Rf_WexKu+D#'!t:~Gr`~?r^j]uNr|~FRg*j^psurwJt|RmcKv)@&!)7Rkv~Br[@wxfO:Rl3co#U'6Rezj_q#vIuavjRltwzeyh@vr5JqD0!>aY?C9:9au@9Cb]}9cl#U*5;5<H||jbuus1ucv&Rfvg1v~d/pppzqFr^a--a~!aMat1(hFv;Wiz@@=Izoj5uuv-7Rix~Cw`fk2WlVcZ#X,k)u3vWs@u2]ktg;wEx'fBq(_2Wg/jTv|vV~EfoJv]!15x'hzqG!(P~EfU~CRl_j6v(us5x4i-#T(2WmZ?C2F|d>Kq<aj1!*jTqIsBv=Wl`~Cw`fi2WlWj`v0u*~>RlR=c>Z,k#u3vWs@u2]kr<c1Z+jTqIsBv=Wla~Cw`fm2WlXdmb3!a{(arZa`bkTa%TbQTa-a9+c'!aM!/[yL=Bqug.w'RifhFvyDRj.g>vgwyk^9]k^Jv3_@WfbAARkhJw2_[x|JvB_wkoIRoKwkoJRoLd'(Y#<]gm=<9<H|yd'%_X#skDtb3awwqkgNulRkgdB#^',9:p'hJwSaxRmEBwVb8@4=H|qLu+w50&!)@3qs~?pU>Awwn;;Rn=c:Z'ARn<=<qwKvC@!/&~BqqJv6!&]eVb^z^xRge'/a%+^`#Sge}6<4Rn3=]n0Pw2>Rn8Jw0!&>Rn:>Rn6cY#a7+!a&=<wkaNw~h3z_c5Z{=wjh#=]nLKv^D!&)Vyz=bW|swYb<WetcG#T(2wxa@qVx@gD#Y&b^|V5JwG&!5bb|pg/w&RgD@x=kHs=uAvn!a%%/'+RmSRh694Ro`g-vaRmRhHv-]mlxCcS#`&ba~.5cD#Ta)P~=d,#Y(56H{>978H{Dd_#{2^Y%_+qbbb{6g3sERhsbU{?dfa.,`a(Xa<!aiX#(55RiG54RiHcI#T'WiU3RiVNvdwtfcRlKNvdd,#Y&RlHRlExQgf.1*^T'X#Sgf}6Wn4=]hfPrk>Rn7Jw0!&>Rn5>Rn9Lunw?&a2!,5<oq@@wqfdRlJj5Q~=d,#Y(~ARfcOuN]fdDKw;ay(}i!547E}j?cI#T(@5bV}iCbV}hdv(^^Tb?a40,b##Tbo!a*bR!a<b|a/!aKai!aU[yK=]o^g:v>ReGJwPZtK<7Rh+h<~El,Pv#5ReR@awwxjCg,ulRjDJv6&!]j!z?aQeeg>w=Sh<eeJw;!&axEzOg,Qosc!#*:wkeJ]eJ>x'h-u(!%Ro.w~h.zPdNZ(X,Ya![x{;9ReY;wkgxRiF:x?ap#Y&RmUg<s2Rkod]+UY0TZ'!a&A9sw<=bczLNvuw{gqzNhJwSaxRmCKuLay!#&s_Rf-55b^{uJvZa!!c%#(55Ri654wmiu5RiuawLu,vp!+}^%b_}Y9;wkgxba}o>A9:=b^}zKuh=a''!3awRk3c*'!#aHRk6c+Z&Rk5Rk4Jv)&!awRjSawd9*`#0?C2@EzMj8u<uJ5RmbjQrquJu3x,k>uq@_+=ayb^|W~ARkEOuN]k@7dhzV^X/X&a-#zRzSb`zXcJzTT#2WkVKvDBzW!%FzY9;5bbzWjQrquJu3Jw3%!b`zU=ayb^zQd:#X(T-a!6Vyywxh}=b]{Jg=u1RiAdGp~qHtzv!w(wA+a+a;<!aJaYai'anasb(=azRmV:Cbb{MLq2vb!%')RjuRjrRjtRjqx3jnqCw3!%')Rk(Rk+Rk&Rk)Lq2vb!%')Rj{RjxRjzRjwLq2vb!%')RjsRjpRjfRjex3jcqCw3!%')Rk'Rk*RjkRjl9<CbbzfOu4ARhxLq2vb!%')RjyRjvRjhRjgx=joq*uKvb!%')+-Rk.Rk%Rj~Rk-Rk#Rj}x=jdq*uKvb!%')+-Rk,Rk!Rj|RjmRjjRjidAq&qKs@uAv8Aa.'*-a@a&0!aM@a5[y73Dsy3Ds|3Dt):wxgI2sHJwJZt.~Gqxwsf0ikrzt}Rl0Jvy_[xj~HqzKv_A|D!&WfP8axRoVcf,U#k(v]v+ueunaXRf1Ju}'!g8u#Ri=jQw!sCunLprq>!,')~<5qeGzq9F{W=c##%s5au:5aU3CBE|;d4#X(D!a&6Vygx(b;#(=]ed?C2F{N<capoq2r[a&!aPa9,'Pw;5s:@@=I|,55w_h|@@=IzcP~=x'fCqB_2Wl2>aU@@=I|1OuNBc1Z+jTqIsBv=Wlc~Cw`fl2WlZ~AcTa%!Z+jTqIsBv=Wlb~Cw`fh2WlYk+uNqJsBv=WlSg,u3dca3#UXaMYa)TaB-=cM|7T#<bI}l5@B932:aV2G{BOuNBJq:|M!5Ezt=<B=C@a^<B57@2F{v>cB{/T#=ay<bI{3Jv6!a.6BKq0ah&+!5E}HP~Ef{978BaU@@=Iza<7d#.Y#978BaU@@=IzH~AJq0!(@@=IzG978BaU@@=IzFe,aU*Y&^^^bvJb,b:bFad!a,c2Ta>aL.bo6!a#CbTa'T#Re{2Wlh2@G{yg6t~Ro_NvdRfticuRQRllJv3&!x&c|zs@Jw3!%RflwpfkRlpKuL;%(!Re<@G|C2GzdhIvuBwgjAg-u0RjAKQB%!(GzZ@G|5NuuRl7d='T+Y#Vy[g<v~Rm!==G|>JvA!)@wma=]m1ifuaw&RmnLs@vT'!|/+[y,g:v>ReTJw1!#qX=x!eC{bLu+wT&)ZtZauq_~Graci&U#F|89:r_Lupvq!.)&2RlG8RfaC=x!eF{_h?rpWlmd&'!#X|&]k::xJey#`'T|+<E|&2@H|%dE#(^,g;u.RiEg6vjRiC9xCkA{O|zY#g=ucRmXKs0@!&*@G|m@awRknJuh!,3d(}gY}eJvj!%Rm):Jw3!%Rm+Rm-Ls0w(&!a(a#@b[|6cZ#X'7RkxWgAOu4ARn'dH'U#Y*Vz-Wm'CARm}d]*#a%^a*T'aK!a<9bV{PC=p*Jw4!&SgxcbB5r]idw(wBRmF7xFkt#&`(Rm/Rm8E|!JuY_9:Rl5=wrgr2:bbxd@xXfB(a*#T+!.X0X1Ta/a'T&RlDRfL>RlyARl9b[z[>RfZ:RlL:RfRwlg/ARl;9;RlxKv,A/!%7s69<74=BA5ba{-8Bde#`a<XaKYa1,a'P~=wxfB2bZ}}?C972@@=I}r8@55B9;5bb}G978B2@@=aybb}3j3vLv;<Jw3&!>Rfk=ayb^}4~Ad1#`*@@=aybb{w2@>==<bbz]dx+UY#^UaF!a9!bB'Ya1.!ajXa#%olRhD[y=3Dt#Ov5BrHKuMB%!(Rf^Wep~HrJwkiQjKr|~FRg)Ku+D#'!t5~GrF~?rDdV)UY,Z/_7RkuG{<~BrBg,rlsO:235B@bX}|d?a1!#`(6Vyn5@d##Y+jTv|vV~EfIj]uNpn~FRfH7Lq2vb1!a9-978BaU@@=Iz9978BbU}#~AJq0!(@@=Iz8978BaU@@=Iz7~AJQ|}!978BbU}!JvkaK!AdUa21-U#`a+(g/vsRn~Ou!5RPj:rmu9WhOjXuvvNr}:RhAj^v(pyw8unRn[kPr}p|u7vwv]RiSBd;pppzq@qHQa?(b.!a.a`@.|xa(hFv;Wiyj5uuv-7Riw~Cw`fg2WlU978BbU|wOuNBJqG!(P~EfD~CRlQcZ#X,k)u3vWs@u2]ksg;wEx'f@q1_2Wg.j]uNpn~FRfqJv]!15x'h{qG!(@@=IzK~CRl^j6v(us5x4i,#T(2WmY?C2F{1>Kq<aj1!*jTqIsBv=Wld~Cw`fj2Wl[j`v0u*~>RlT=c>Z,k#u3vWs@u2]kq<c1Z+jTqIsBv=Wle~Cw`fn2Wl]dn1#c(a(b^a2!b/bAT(bj!aDa7bu,a_a{c0!2T0g:v>ReD2@G{42@G{5~DpM~<5rc=Bx6i>{RT#RnI@zCx]y]z:2Jv[!zr5Awyk]9]k]dD(Y+X#6Vz.g=wKtgwhaCwgmTWj2Lu,w%_+/[y-B;b^xeg3u3Rj-2@bX{*KrJ<!+'@Wg(g?QRlC@Jv`!%b[zIwsfII}8JQ_@w|kW|=Jv(%!AqcOuNBJvEzh!bYzjLs@wP#(0!oy@>RkdJwMZtc3Dtd@BcG#T'9bWxg2@2Fznd*#Y+;2x'c}w<zizixNgwa#Z'U+!/!a'!a+w~g~z6wcn{Rn}wcnzRn|5Rh%=]nJg5vuRmvNvdRlvcprJu}w*az*a#!%.a.'Bot9qT]kj@Wg'ay2Gzv@Jv`!%b[zEwsfHI}1;ck#Ux`<Cbbx_Lu+w!a&0*!wko*wwo,So,}6Juqxf!E}PigQuyRm`d3(`#8>Rn%:A5B;bZ~%KvhCa!a2!x>k7#Uxb@b{#xaRk7Jw0!)>wwhlShl}6>wwhmShm}6CJvB!.x'hhvj{!!5Bwkhhbaz}x'hivjz~!5Bwkhibaz|xEhTrNu,v-vpD!a%&/)a3a.,%Ro2t[CE{)@3re9b]{%wjo09:rgc:Z&Ro6=<riifuaw&RmoKrNA!%(Ro4>Ro89;Ri`dSaL'UYzxZb)7Rka3xRhT&!,!#^1U}vbaz{>>@=be}yC@:D5bazzKu+A&!}{?ba}y>>@=be}wxBh[t`u~vJvr!%a!a()a,a0a4RoC=]o;Ju(!%RoGRhdwjh`=]oAg>w#Ro?g5vuRo=NvdRl|Ku]C.!&;RoEJvB!%RoORoMBx'h[v+_?w~h`}~5?w~hd~!xKh]oiptu-utv.vp!#%&a30a@a'a+(a/aOp(o~p!RoDJu(!%RoHRhewjha=]oBNvdRl}g>w#Ro@g5vuRo>c[#X']o<CauRoRAd-#Y':RkpauRoQKu]C.!&;RoFJvB!%RoNRoPBx'h]v+_?w~ha}t5?w~he}ue!/UbhYacXaW^Tc&a;b:a-c/#b&aja1(!cL+!bKbt!bmcRc9aIc?8[yW3Dtt94Rg`Jv}!&SiRMzBhEebShEMNuPRe>x7gL#TzuwjirRipc<Z&>on;>z=h-MSh.Mwqczx'a7vj&!>Re4@=ResJt__NuPRi*NuPRi)j]uNr|~FRfzKrJ>_+@Wfy@Wf]2WocKrJ<!+'@Wg%g/QRl@@Jv`!&awRl<wsfFIzgLu(w*!.*&ShBMwvhIRhI9;RhNx1hK'!#Sn]Mx1hK~0!#:2<H~7cNu+w7D*'1ZtW>Rn1~?rOc:Z&Rn2=<rQ<7wjh&=BSnLMc]#X(6Vz)w[b=a!U#9wzgMc3#&(RgMRitRis<x,gKt`ax!&+SioM=BSilMc3#&(RgKRinRimKurB,!&SiQMzBhDebShDM6BJQ!(P~Efx978B2@@=I}WLrJw!!,a*&@G}O@9wkibRid@@x'fKwC!&SlDMSfLMjUv~Q~EfKKv3@a+!(hFv-]mpx/hYZ(C5RiWz<o/MwkhY?So/M@x,gbvfB*&!SgEM:SoeeehFu3:Rgbda(,^TZa)X/7Sg[eb:2RgI~BrMC@wgkc:wwkcRerx3h(uUvK!&*,SnOM4Sh*MArRg;wHRh(x=h;rJvPwI!a4',a'0@Wg&=BSh/Mg>w=Rh=g3w*wwgGRgGcW(X#;Sg}M2Gzk@Jv`!&awRl=wsfGIz`dKZ*T'Y-:RhR7RhQg5u-p`j6v(us5d,#Y+~Awkia?RicOuNBwkibba}Ld6p~tyu_vbAa'a+!a/'a3aEa8a!>Sh,ebJv{!&Sh@ebSaReb9;SgwebNuPRi(NvdRl)NuPRi'hHu^<Rm^Jvv_@Wl(g;u1Si/ebKu'B&!*Sh?eb@Wl'z@aPeb95Si.ebcpputyvjB)!,&a+0a%ShAMWeK@G}C@WfJ9;RhMwvhH9w{ia}ix,hJvRA1(!zAn[MRhHx1hJ~*!#hFv(BSn[MBJQ!(@@=I~'978B2@@=I}2db.Ua<'X}+T#a0XaG2G}E;wkg|wuh!Rh!x,hZu,@)!&So0MVy)C5RiXACJvB!&5RiY5RiZg8w)cG}*T#2@bU}=KsA>(!a.3wkhZba~(x,h^u(A!&(SoCMRhb5Bz=h[eb?w~hb~6x,h_u(A!&(SoDMRhc5Bz=h]eb?w~hc~6e)aA1T#T,^^^c-bMb&blcPaP(a/!0!bA=b5c@a(!bfbrc#2afwmhARnjwchORnp2Wlf3DtsNvdRl-2@wpa<]m0bx(#:awRk2@Jw3!%RfhwpfgRlnKQB%!(G{V@G|'NuuRl6d='T+Y#VyUg<v~Rl~==G|<Jv+'!aYShC}6@B<5?ba~8@Jw3'!g2QRljhLrpWlOd+#Y'g.w'rIg>w*wgj@g-u0Rj@Lu+wT&)ZtUauq]~GrGci&U#F|39:rELrNvj!.%*RhCwunfw~nf~:9;Ri]>wtnhg;wHRnhx3hDs@v~!/+'@Wfr@9RkSNu&Rlo=@<5GzoKs0@_+@Wl+@awRkmJuh!-3d(}pY#qWJvj!%Rm(:Jw3!%Rm,Rm*de&!1U-U#`)Re;@G|.@9Ri82@wjfvRlq=@<5GzpLvOvr!).&2RlF8Rf`C=x!eE{.Jw3_g2QRlkhLrpWlPde(!#U{s,UXa*Ta'[y'g:v>ReS;x0PZ&RnlRnn~HrKJw1}f!=x!eB|2w]aP(#Xa&a*Ta.Ua2a7=]iOd'#Y&Ro&WnWg;u.RiDg6vjRiBNvdRlzhNvj]nYJuW_2Wm3x)kFze{9d])!a.!,Y01!#&aC!a3RndC=ox~BrC@2b^{pg,rlse7x'ksuq!%Rm.E{xidw(wBRmGx9o+)X#wwo-So-}69:Rl4@xSf@a#XZ'X)X,Ta(/ARl8b[xc>RfY:RlI:RfQwlg.ARl:9;Rlwdn'#^XafaQa1X1TaHTa)@b[{zcZ#X'7RkwWg@Ou4ARn&x)kG#{,g7u/RkGdH'U#Y*Vz'Wm&CARm|bx#(A]gUbUzJj9Q~=d,#Y(56H}l978H{U7d,0#U*2>ABb_xZ978BbU{e~AJQ{g!978BbU{hxMh?ad{oUYZ.x1h?{l!#:2<H{mx3n[t{vl!,&a%3Ro(z=iS}6ARnr=Bwsn^wvn`Rnbd`*T}B0!#^X'BG{c9b]{a>>@=be}F?JvS!&BG{d7BG}(Bde#`a1X,Ya@!a'P~=wxf@2bZ}I56B2@@=aybb}08@55B9;5bb}<j3vLv;<Jw3&!>Rfg=ayb^}&OuNBKuLA!)a!P~=x#fD{f2@>==<bbzl?C972@@=Ix^d6rSu,v7w*C(0a)a6#B+a%!sQ[y?3Dt%3[xn~<5rLOu!5p@Ku+D#'!t7~GrP~?rNKvlaya7'!h+v-5qMg=t|cd,U#5AAaa5Abb{S@52B5@a[@52B5Gx[iXueu;d<#`a(!/549C;ag>23ExY5@Dah89b^~689Jv)!~2b[~1Lv'w(%*!a#bX|aPrmawRe]keu7uhv-q6rxu,q`xTo]/a5aU!bNaDXbi!b-!ao!b<bwA!#5@B932:aV2G|:d-)Y#hJrL>RhG<7@C5<H|_=Cau:5aj5@B932:bJ|ng>vIbs)#?C2F|9jPv0w.vISh-MKvUaz(.!9ABbb|[5;5<H|Eg>unwfh;9:4E|YjQsBt|vjx'hYq3!(?C2F|J:2<BaY?C2F|GOu!5x,g|p{ah!-(?C2F|c9:4E|OjXuvvNr}:Rh&i[w*t|cd+U#jJvsu)vsSn~Mkfrmu9p}u7vwv]So!McW#Xa!ax5@A5aY:5;5<H|>kJv~vYrquJu3x4ib#T)2@SmZM?C2F|Bj:rmu9@xPhI(a*a#U#`a3-5Abb|L~@:RhK9:4E|0@52B5G|#C::aY?C2F|-:2<BaY?C2F|.5Jvk!a)javYrquJu3x4ia#T)2@SmYM?C2F|HAxPhH(!a#U#`a*-5Abb|4~@:RhJ9:4E|R@52B5G|F:2<BaY?C2F|Sc^#Xa2j=Qq5CJvB!-g<v{z;hhM?C2F|Zi[vrv{z;hiM?C2F|XKsA>!a)-g<v{z;h[eb?C2F|]i[vrv{z;h]eb?C2F|^iZu.vix,hZq3ah!.(?C2F|QOu!5ShXM:2<BaY?C2F|P", 13494, 2713, 49, 25, 61);

// node_modules/entities/dist/internal/bin-trie-flags.js
var BinTrieFlags2;
(function(BinTrieFlags) {
  BinTrieFlags[BinTrieFlags["VALUE_LENGTH"] = 49152] = "VALUE_LENGTH";
  BinTrieFlags[BinTrieFlags["FLAG13"] = 8192] = "FLAG13";
  BinTrieFlags[BinTrieFlags["BRANCH_LENGTH"] = 8064] = "BRANCH_LENGTH";
  BinTrieFlags[BinTrieFlags["JUMP_TABLE"] = 127] = "JUMP_TABLE";
  BinTrieFlags[BinTrieFlags["VALUE_MASK"] = 8191] = "VALUE_MASK";
})(BinTrieFlags2 || (BinTrieFlags2 = {}));

// node_modules/entities/dist/decode.js
var CharCodes2;
(function(CharCodes) {
  CharCodes[CharCodes["AMP"] = 38] = "AMP";
  CharCodes[CharCodes["NUM"] = 35] = "NUM";
  CharCodes[CharCodes["SEMI"] = 59] = "SEMI";
  CharCodes[CharCodes["EQUALS"] = 61] = "EQUALS";
  CharCodes[CharCodes["ZERO"] = 48] = "ZERO";
  CharCodes[CharCodes["NINE"] = 57] = "NINE";
  CharCodes[CharCodes["LOWER_A"] = 97] = "LOWER_A";
  CharCodes[CharCodes["LOWER_X"] = 120] = "LOWER_X";
})(CharCodes2 || (CharCodes2 = {}));
var TO_LOWER_BIT2 = 32;
var CONSUMED_SHIFT = 21;
var CODE_POINT_MASK = 2097151;
var CONSUMED_OVERFLOW = 2047;
var longNumericConsumed = 0;
function unpackConsumed(packed) {
  const consumed = packed >>> CONSUMED_SHIFT;
  return consumed === CONSUMED_OVERFLOW ? longNumericConsumed : consumed;
}
function isNumber2(code) {
  return code - CharCodes2.ZERO >>> 0 <= 9;
}
function isHexadecimalCharacter2(code) {
  return (code | TO_LOWER_BIT2) - CharCodes2.LOWER_A >>> 0 <= 5;
}
function isAlpha(code) {
  return (code | TO_LOWER_BIT2) - CharCodes2.LOWER_A >>> 0 <= 25;
}
function isEntityInAttributeInvalidEnd2(code) {
  return code === CharCodes2.EQUALS || isAlpha(code) || isNumber2(code);
}
var EntityDecoderState2;
(function(EntityDecoderState) {
  EntityDecoderState[EntityDecoderState["EntityStart"] = 0] = "EntityStart";
  EntityDecoderState[EntityDecoderState["NumericStart"] = 1] = "NumericStart";
  EntityDecoderState[EntityDecoderState["NumericDecimal"] = 2] = "NumericDecimal";
  EntityDecoderState[EntityDecoderState["NumericHex"] = 3] = "NumericHex";
  EntityDecoderState[EntityDecoderState["NamedEntity"] = 4] = "NamedEntity";
})(EntityDecoderState2 || (EntityDecoderState2 = {}));
var DecodingMode2;
(function(DecodingMode) {
  DecodingMode[DecodingMode["Legacy"] = 0] = "Legacy";
  DecodingMode[DecodingMode["Strict"] = 1] = "Strict";
  DecodingMode[DecodingMode["Attribute"] = 2] = "Attribute";
})(DecodingMode2 || (DecodingMode2 = {}));
function determineBranch2(decodeTree, current, nodeIndex, char) {
  const branchCount = (current & BinTrieFlags2.BRANCH_LENGTH) >> 7;
  const jumpOffset = current & BinTrieFlags2.JUMP_TABLE;
  if (jumpOffset) {
    if (branchCount === 0) {
      return char === jumpOffset ? nodeIndex : -1;
    }
    const slot = char - jumpOffset;
    if (slot >>> 0 >= branchCount)
      return -1;
    const stored = decodeTree[nodeIndex + slot];
    return stored === 0 ? -1 : nodeIndex + branchCount + stored - 1 & 65535;
  }
  if (branchCount === 0)
    return -1;
  const packedKeySlots = branchCount + 1 >> 1;
  const branchEnd = nodeIndex + packedKeySlots + branchCount;
  for (let index = 0;index < branchCount; index++) {
    const packed = decodeTree[nodeIndex + (index >> 1)];
    const key = packed >> ((index & 1) << 3) & 255;
    if (key === char) {
      const pointerIndex = nodeIndex + packedKeySlots + index;
      return branchEnd + decodeTree[pointerIndex] & 65535;
    }
    if (key > char)
      return -1;
  }
  return -1;
}
function readTrieValue(decodeTree, nodeIndex, valueLength) {
  if (valueLength === 1) {
    return String.fromCharCode(decodeTree[nodeIndex] & BinTrieFlags2.VALUE_MASK);
  }
  if (valueLength === 2) {
    return String.fromCharCode(decodeTree[nodeIndex + 1]);
  }
  return String.fromCharCode(decodeTree[nodeIndex + 1], decodeTree[nodeIndex + 2]);
}
function parseNumericEntity(input, numberStart, inputLength) {
  let offset = numberStart + 1;
  let cp = 0;
  let digitStart = offset;
  if (offset < inputLength && (input.charCodeAt(offset) | TO_LOWER_BIT2) === CharCodes2.LOWER_X) {
    offset += 1;
    digitStart = offset;
    while (offset < inputLength) {
      const char = input.charCodeAt(offset);
      if (isNumber2(char)) {
        cp = cp * 16 + (char - CharCodes2.ZERO);
      } else if (isHexadecimalCharacter2(char)) {
        cp = cp * 16 + ((char | TO_LOWER_BIT2) - CharCodes2.LOWER_A + 10);
      } else {
        break;
      }
      offset += 1;
    }
  } else {
    while (offset < inputLength) {
      const digit = input.charCodeAt(offset) - CharCodes2.ZERO;
      if (digit >>> 0 > 9)
        break;
      cp = cp * 10 + digit;
      offset += 1;
    }
  }
  if (offset === digitStart)
    return 0;
  if (offset < inputLength && input.charCodeAt(offset) === CharCodes2.SEMI) {
    offset += 1;
  }
  if (cp > 1114111)
    cp = 1114112;
  let consumed = offset - numberStart;
  if (consumed >= CONSUMED_OVERFLOW) {
    longNumericConsumed = consumed;
    consumed = CONSUMED_OVERFLOW;
  }
  return consumed << CONSUMED_SHIFT | cp;
}
function decodeWithTrie(input, isStrict, isAttribute) {
  const decodeTree = htmlDecodeTree2;
  let offset = input.indexOf("&");
  if (offset < 0)
    return input;
  const inputLength = input.length;
  let chunkStart = 0;
  let result = "";
  const root = decodeTree[0];
  const rootJumpOffset = root & BinTrieFlags2.JUMP_TABLE;
  const rootBranchCount = (root & BinTrieFlags2.BRANCH_LENGTH) >> 7;
  do {
    const entityStart = offset + 1;
    const firstChar = input.charCodeAt(entityStart);
    let consumed;
    let value;
    if (firstChar === CharCodes2.NUM) {
      const packed = parseNumericEntity(input, entityStart, inputLength);
      consumed = unpackConsumed(packed);
      if (isStrict && consumed > 0 && input.charCodeAt(entityStart + consumed - 1) !== CharCodes2.SEMI) {
        consumed = 0;
      }
      value = consumed === 0 ? "" : codePointToString(packed & CODE_POINT_MASK);
    } else if (isAlpha(firstChar)) {
      consumed = 0;
      value = "";
      const rootSlotIndex = firstChar - rootJumpOffset;
      let nodeIndex;
      if (rootSlotIndex >>> 0 < rootBranchCount) {
        const stored = decodeTree[1 + rootSlotIndex];
        nodeIndex = stored === 0 ? -1 : rootBranchCount + stored & 65535;
      } else {
        nodeIndex = -1;
      }
      let bestNodeIndex = 0;
      let bestValueLength = 0;
      let current = nodeIndex < 0 ? 0 : decodeTree[nodeIndex];
      let index = entityStart + 1;
      trie:
        while (index < inputLength) {
          while ((current & (BinTrieFlags2.VALUE_LENGTH | BinTrieFlags2.FLAG13)) === 0 && (current & BinTrieFlags2.JUMP_TABLE) !== 0) {
            const jumpOffset = current & BinTrieFlags2.JUMP_TABLE;
            const branchCount = (current & BinTrieFlags2.BRANCH_LENGTH) >> 7;
            if (branchCount === 0) {
              if (input.charCodeAt(index) !== jumpOffset)
                break trie;
              nodeIndex += 1;
            } else {
              const slot = input.charCodeAt(index) - jumpOffset;
              if (slot >>> 0 >= branchCount)
                break trie;
              const stored = decodeTree[nodeIndex + 1 + slot];
              if (stored === 0)
                break trie;
              nodeIndex = nodeIndex + branchCount + stored & 65535;
            }
            current = decodeTree[nodeIndex];
            index += 1;
            if (index >= inputLength)
              break trie;
          }
          if ((current & (BinTrieFlags2.VALUE_LENGTH | BinTrieFlags2.FLAG13)) === BinTrieFlags2.FLAG13) {
            const runLength = (current & BinTrieFlags2.BRANCH_LENGTH) >> 7;
            if (input.charCodeAt(index) !== (current & BinTrieFlags2.JUMP_TABLE)) {
              break;
            }
            index += 1;
            const remaining = runLength - 1;
            let wordIndex = nodeIndex + 1;
            let charIndexInPacked = 0;
            for (;charIndexInPacked + 1 < remaining; charIndexInPacked += 2) {
              const packed = decodeTree[wordIndex];
              if (input.charCodeAt(index) !== (packed & 255))
                break trie;
              index += 1;
              if (input.charCodeAt(index) !== (packed >> 8 & 255))
                break trie;
              index += 1;
              wordIndex += 1;
            }
            if (charIndexInPacked < remaining) {
              if (input.charCodeAt(index) !== (decodeTree[wordIndex] & 255))
                break;
              index += 1;
            }
            nodeIndex += 1 + (runLength >> 1);
            current = decodeTree[nodeIndex];
            continue;
          }
          const valueLength = current >>> 14;
          const char = input.charCodeAt(index);
          if (valueLength !== 0) {
            if (char === CharCodes2.SEMI) {
              consumed = index - entityStart + 1;
              value = valueLength === 1 ? String.fromCharCode(current & BinTrieFlags2.VALUE_MASK) : readTrieValue(decodeTree, nodeIndex, valueLength);
              break;
            }
            if (!isStrict && (current & BinTrieFlags2.FLAG13) === 0) {
              consumed = index - entityStart;
              bestNodeIndex = nodeIndex;
              bestValueLength = valueLength;
            }
            if (valueLength === 1)
              break;
          }
          const next = determineBranch2(decodeTree, current, nodeIndex + (valueLength || 1), char);
          if (next < 0)
            break;
          nodeIndex = next;
          current = decodeTree[nodeIndex];
          index += 1;
        }
      if (value === "") {
        const finalVL = current >>> 14;
        if (finalVL !== 0 && !isStrict && (current & BinTrieFlags2.FLAG13) === 0) {
          consumed = index - entityStart;
          bestNodeIndex = nodeIndex;
          bestValueLength = finalVL;
        }
        if (consumed > 0) {
          value = readTrieValue(decodeTree, bestNodeIndex, bestValueLength);
        }
      }
    } else {
      consumed = 0;
      value = "";
    }
    if (consumed === 0 || isAttribute && firstChar !== CharCodes2.NUM && input.charCodeAt(entityStart + consumed - 1) !== CharCodes2.SEMI && entityStart + consumed < inputLength && isEntityInAttributeInvalidEnd2(input.charCodeAt(entityStart + consumed))) {
      offset = entityStart;
    } else {
      if (chunkStart < offset) {
        result += input.slice(chunkStart, offset);
      }
      result += value;
      offset = chunkStart = entityStart + consumed;
    }
    if (input.charCodeAt(offset) !== CharCodes2.AMP) {
      offset = input.indexOf("&", offset);
    }
  } while (offset >= 0);
  return result + input.slice(chunkStart);
}
function decodeHTML2(htmlString, mode = DecodingMode2.Legacy) {
  return decodeWithTrie(htmlString, mode === DecodingMode2.Strict, mode === DecodingMode2.Attribute);
}
// node_modules/entities/dist/index.js
var EntityLevel2;
(function(EntityLevel) {
  EntityLevel[EntityLevel["XML"] = 0] = "XML";
  EntityLevel[EntityLevel["HTML"] = 1] = "HTML";
})(EntityLevel2 || (EntityLevel2 = {}));
var EncodingMode2;
(function(EncodingMode) {
  EncodingMode[EncodingMode["UTF8"] = 0] = "UTF8";
  EncodingMode[EncodingMode["ASCII"] = 1] = "ASCII";
  EncodingMode[EncodingMode["Extensive"] = 2] = "Extensive";
  EncodingMode[EncodingMode["Attribute"] = 3] = "Attribute";
  EncodingMode[EncodingMode["Text"] = 4] = "Text";
})(EncodingMode2 || (EncodingMode2 = {}));
// node_modules/js-yaml/dist/js-yaml.mjs
/*! js-yaml 5.5.0 https://github.com/nodeca/js-yaml @license MIT */
var NOT_RESOLVED = Symbol("NOT_RESOLVED");
function defineScalarTag(tagName, options) {
  return {
    tagName,
    nodeKind: "scalar",
    implicit: options.implicit ?? false,
    matchByTagPrefix: options.matchByTagPrefix ?? false,
    implicitFirstChars: options.implicitFirstChars ?? null,
    resolve: options.resolve,
    identify: options.identify,
    represent: options.represent ?? ((data) => String(data)),
    representTagName: options.representTagName ?? (() => tagName)
  };
}
function defineSequenceTag(tagName, options) {
  const carrierIsResult = options.finalize === undefined;
  return {
    tagName,
    nodeKind: "sequence",
    implicit: false,
    matchByTagPrefix: options.matchByTagPrefix ?? false,
    create: options.create,
    addItem: options.addItem,
    finalize: options.finalize ?? ((carrier) => carrier),
    carrierIsResult,
    identify: options.identify,
    represent: options.represent ?? ((data) => data),
    representTagName: options.representTagName ?? (() => tagName)
  };
}
function defineMappingTag(tagName, options) {
  const carrierIsResult = options.finalize === undefined;
  return {
    tagName,
    nodeKind: "mapping",
    implicit: false,
    matchByTagPrefix: options.matchByTagPrefix ?? false,
    create: options.create,
    addPair: options.addPair,
    has: options.has,
    keys: options.keys,
    get: options.get,
    finalize: options.finalize ?? ((carrier) => carrier),
    carrierIsResult,
    identify: options.identify,
    represent: options.represent ?? ((data) => data),
    representTagName: options.representTagName ?? (() => tagName)
  };
}
var strTag = defineScalarTag("tag:yaml.org,2002:str", {
  resolve: (source) => source,
  identify: (data) => typeof data === "string"
});
var NULL_VALUES$1 = [
  "",
  "~",
  "null",
  "Null",
  "NULL"
];
var nullCoreTag = defineScalarTag("tag:yaml.org,2002:null", {
  implicit: true,
  implicitFirstChars: [
    "",
    "~",
    "n",
    "N"
  ],
  resolve: (source) => {
    if (NULL_VALUES$1.indexOf(source) !== -1)
      return null;
    return NOT_RESOLVED;
  },
  identify: (object) => object === null,
  represent: () => "null"
});
var nullJsonTag = defineScalarTag("tag:yaml.org,2002:null", {
  implicit: true,
  implicitFirstChars: ["n"],
  resolve: (source, isExplicit) => {
    if (source === "null" || isExplicit && source === "")
      return null;
    return NOT_RESOLVED;
  },
  identify: (object) => object === null,
  represent: () => "null"
});
var NULL_VALUES = [
  "",
  "~",
  "null",
  "Null",
  "NULL"
];
var nullYaml11Tag = defineScalarTag("tag:yaml.org,2002:null", {
  implicit: true,
  implicitFirstChars: [
    "",
    "~",
    "n",
    "N"
  ],
  resolve: (source) => {
    if (NULL_VALUES.indexOf(source) !== -1)
      return null;
    return NOT_RESOLVED;
  },
  identify: (object) => object === null,
  represent: () => "null"
});
var TRUE_VALUES$2 = [
  "true",
  "True",
  "TRUE"
];
var FALSE_VALUES$2 = [
  "false",
  "False",
  "FALSE"
];
var boolCoreTag = defineScalarTag("tag:yaml.org,2002:bool", {
  implicit: true,
  implicitFirstChars: [
    "t",
    "T",
    "f",
    "F"
  ],
  resolve: (source) => {
    if (TRUE_VALUES$2.indexOf(source) !== -1)
      return true;
    if (FALSE_VALUES$2.indexOf(source) !== -1)
      return false;
    return NOT_RESOLVED;
  },
  identify: (object) => Object.prototype.toString.call(object) === "[object Boolean]",
  represent: (object) => object ? "true" : "false"
});
var TRUE_VALUES$1 = ["true"];
var FALSE_VALUES$1 = ["false"];
var boolJsonTag = defineScalarTag("tag:yaml.org,2002:bool", {
  implicit: true,
  implicitFirstChars: ["t", "f"],
  resolve: (source) => {
    if (TRUE_VALUES$1.indexOf(source) !== -1)
      return true;
    if (FALSE_VALUES$1.indexOf(source) !== -1)
      return false;
    return NOT_RESOLVED;
  },
  identify: (object) => Object.prototype.toString.call(object) === "[object Boolean]",
  represent: (object) => object ? "true" : "false"
});
var TRUE_VALUES = [
  "true",
  "True",
  "TRUE",
  "y",
  "Y",
  "yes",
  "Yes",
  "YES",
  "on",
  "On",
  "ON"
];
var FALSE_VALUES = [
  "false",
  "False",
  "FALSE",
  "n",
  "N",
  "no",
  "No",
  "NO",
  "off",
  "Off",
  "OFF"
];
var boolYaml11Tag = defineScalarTag("tag:yaml.org,2002:bool", {
  implicit: true,
  implicitFirstChars: [
    "y",
    "Y",
    "n",
    "N",
    "t",
    "T",
    "f",
    "F",
    "o",
    "O"
  ],
  resolve: (source) => {
    if (TRUE_VALUES.indexOf(source) !== -1)
      return true;
    if (FALSE_VALUES.indexOf(source) !== -1)
      return false;
    return NOT_RESOLVED;
  },
  identify: (object) => Object.prototype.toString.call(object) === "[object Boolean]",
  represent: (object) => object ? "true" : "false"
});
var YAML_INTEGER_IMPLICIT_PATTERN$1 = /* @__PURE__ */ new RegExp("^(?:0o[0-7]+|0x[0-9a-fA-F]+|[-+]?[0-9]+)$");
var YAML_INTEGER_EXPLICIT_PATTERN$1 = /* @__PURE__ */ new RegExp("^(?:[-+]?0b[0-1]+|[-+]?0o[0-7]+|[-+]?0x[0-9a-fA-F]+|[-+]?[0-9]+)$");
function parseYamlInteger$2(source) {
  let value = source;
  let sign = 1;
  if (value[0] === "-" || value[0] === "+") {
    if (value[0] === "-")
      sign = -1;
    value = value.slice(1);
  }
  if (value.startsWith("0b"))
    return sign * parseInt(value.slice(2), 2);
  if (value.startsWith("0o"))
    return sign * parseInt(value.slice(2), 8);
  if (value.startsWith("0x"))
    return sign * parseInt(value.slice(2), 16);
  return sign * parseInt(value, 10);
}
function resolveYamlInteger$2(source, isExplicit) {
  if (isExplicit) {
    if (!YAML_INTEGER_EXPLICIT_PATTERN$1.test(source))
      return NOT_RESOLVED;
  } else if (!YAML_INTEGER_IMPLICIT_PATTERN$1.test(source))
    return NOT_RESOLVED;
  const result = parseYamlInteger$2(source);
  return Number.isFinite(result) ? result : NOT_RESOLVED;
}
var intCoreTag = defineScalarTag("tag:yaml.org,2002:int", {
  implicit: true,
  implicitFirstChars: [
    "-",
    "+",
    ..."0123456789"
  ],
  resolve: resolveYamlInteger$2,
  identify: (object) => Number.isInteger(object) && !Object.is(object, -0) && object.toString(10).indexOf("e") < 0,
  represent: (object) => object.toString(10)
});
var YAML_INTEGER_IMPLICIT_PATTERN = /* @__PURE__ */ new RegExp("^-?(?:0|[1-9][0-9]*)$");
var YAML_INTEGER_EXPLICIT_PATTERN = /* @__PURE__ */ new RegExp("^(?:[-+]?0b[0-1]+|[-+]?0o[0-7]+|[-+]?0x[0-9a-fA-F]+|[-+]?[0-9]+)$");
function parseYamlInteger$1(source) {
  let value = source;
  let sign = 1;
  if (value[0] === "-" || value[0] === "+") {
    if (value[0] === "-")
      sign = -1;
    value = value.slice(1);
  }
  if (value.startsWith("0b"))
    return sign * parseInt(value.slice(2), 2);
  if (value.startsWith("0o"))
    return sign * parseInt(value.slice(2), 8);
  if (value.startsWith("0x"))
    return sign * parseInt(value.slice(2), 16);
  return sign * parseInt(value, 10);
}
function resolveYamlInteger$1(source, isExplicit) {
  if (isExplicit) {
    if (!YAML_INTEGER_EXPLICIT_PATTERN.test(source))
      return NOT_RESOLVED;
  } else if (!YAML_INTEGER_IMPLICIT_PATTERN.test(source))
    return NOT_RESOLVED;
  const result = parseYamlInteger$1(source);
  return Number.isFinite(result) ? result : NOT_RESOLVED;
}
var intJsonTag = defineScalarTag("tag:yaml.org,2002:int", {
  implicit: true,
  implicitFirstChars: ["-", ..."0123456789"],
  resolve: resolveYamlInteger$1,
  identify: (object) => Number.isInteger(object) && !Object.is(object, -0) && object.toString(10).indexOf("e") < 0,
  represent: (object) => object.toString(10)
});
var YAML_INTEGER_PATTERN = /* @__PURE__ */ new RegExp("^(?:[-+]?0b[0-1_]+|[-+]?0[0-7_]+|[-+]?0x[0-9a-fA-F_]+|[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+|[-+]?(?:0|[1-9][0-9_]*))$");
function parseYamlInteger(source) {
  let value = source.replace(/_/g, "");
  let sign = 1;
  if (value[0] === "-" || value[0] === "+") {
    if (value[0] === "-")
      sign = -1;
    value = value.slice(1);
  }
  if (value.startsWith("0b"))
    return sign * parseInt(value.slice(2), 2);
  if (value.startsWith("0x"))
    return sign * parseInt(value.slice(2), 16);
  if (value.includes(":")) {
    let result = 0;
    for (const part of value.split(":"))
      result = result * 60 + Number(part);
    return sign * result;
  }
  if (value !== "0" && value[0] === "0")
    return sign * parseInt(value, 8);
  return sign * parseInt(value, 10);
}
function resolveYamlInteger(source) {
  if (!YAML_INTEGER_PATTERN.test(source))
    return NOT_RESOLVED;
  const result = parseYamlInteger(source);
  return Number.isFinite(result) ? result : NOT_RESOLVED;
}
var intYaml11Tag = defineScalarTag("tag:yaml.org,2002:int", {
  implicit: true,
  implicitFirstChars: [
    "-",
    "+",
    ..."0123456789"
  ],
  resolve: resolveYamlInteger,
  identify: (object) => Number.isInteger(object) && !Object.is(object, -0) && object.toString(10).indexOf("e") < 0,
  represent: (object) => object.toString(10)
});
var YAML_FLOAT_PATTERN$1 = /* @__PURE__ */ new RegExp("^(?:[-+]?[0-9]+(?:\\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|[-+]?\\.[0-9]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
var YAML_FLOAT_SPECIAL_PATTERN$1 = /* @__PURE__ */ new RegExp("^(?:[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
function resolveYamlFloat$2(source) {
  if (!YAML_FLOAT_PATTERN$1.test(source))
    return NOT_RESOLVED;
  let value = source.toLowerCase();
  const sign = value[0] === "-" ? -1 : 1;
  if ("+-".includes(value[0]))
    value = value.slice(1);
  if (value === ".inf")
    return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  if (value === ".nan")
    return NaN;
  const result = sign * parseFloat(value);
  if (Number.isFinite(result) || YAML_FLOAT_SPECIAL_PATTERN$1.test(source))
    return result;
  return NOT_RESOLVED;
}
function representYamlFloat$2(object) {
  if (isNaN(object))
    return ".nan";
  if (object === Number.POSITIVE_INFINITY)
    return ".inf";
  if (object === Number.NEGATIVE_INFINITY)
    return "-.inf";
  if (Object.is(object, -0))
    return "-0.0";
  const result = object.toString(10);
  return /^[-+]?[0-9]+e/.test(result) ? result.replace("e", ".e") : result;
}
var floatCoreTag = defineScalarTag("tag:yaml.org,2002:float", {
  implicit: true,
  implicitFirstChars: [
    "-",
    "+",
    ".",
    ..."0123456789"
  ],
  resolve: resolveYamlFloat$2,
  identify: (object) => typeof object === "number" && (!Number.isInteger(object) || Object.is(object, -0) || object.toString(10).indexOf("e") >= 0),
  represent: representYamlFloat$2
});
var YAML_FLOAT_IMPLICIT_PATTERN = /* @__PURE__ */ new RegExp("^-?(?:0|[1-9][0-9]*)(?:\\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$");
var YAML_FLOAT_EXPLICIT_PATTERN = /* @__PURE__ */ new RegExp("^(?:[-+]?[0-9]+(?:\\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|[-+]?\\.[0-9]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
function resolveYamlFloat$1(source, isExplicit) {
  if (isExplicit) {
    if (!YAML_FLOAT_EXPLICIT_PATTERN.test(source))
      return NOT_RESOLVED;
    let value = source.toLowerCase();
    const sign = value[0] === "-" ? -1 : 1;
    if ("+-".includes(value[0]))
      value = value.slice(1);
    if (value === ".inf")
      return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    if (value === ".nan")
      return NaN;
    const result = sign * parseFloat(value);
    return Number.isFinite(result) ? result : NOT_RESOLVED;
  }
  if (!YAML_FLOAT_IMPLICIT_PATTERN.test(source))
    return NOT_RESOLVED;
  const result = Number(source);
  if (Number.isFinite(result))
    return result;
  return NOT_RESOLVED;
}
function representYamlFloat$1(object) {
  if (isNaN(object))
    return ".nan";
  if (object === Number.POSITIVE_INFINITY)
    return ".inf";
  if (object === Number.NEGATIVE_INFINITY)
    return "-.inf";
  if (Object.is(object, -0))
    return "-0.0";
  const result = object.toString(10);
  return /^[-+]?[0-9]+e/.test(result) ? result.replace("e", ".e") : result;
}
var floatJsonTag = defineScalarTag("tag:yaml.org,2002:float", {
  implicit: true,
  implicitFirstChars: ["-", ..."0123456789"],
  resolve: resolveYamlFloat$1,
  identify: (object) => typeof object === "number" && (!Number.isInteger(object) || Object.is(object, -0) || object.toString(10).indexOf("e") >= 0),
  represent: representYamlFloat$1
});
var YAML_FLOAT_PATTERN = /* @__PURE__ */ new RegExp("^(?:[-+]?(?:(?:[0-9][0-9_]*)?\\.[0-9_]*)(?:[eE][-+][0-9]+)?|[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\\.[0-9_]*|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
var YAML_FLOAT_SPECIAL_PATTERN = /* @__PURE__ */ new RegExp("^(?:[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
function resolveYamlFloat(source) {
  if (!YAML_FLOAT_PATTERN.test(source))
    return NOT_RESOLVED;
  let value = source.toLowerCase().replace(/_/g, "");
  const sign = value[0] === "-" ? -1 : 1;
  if ("+-".includes(value[0]))
    value = value.slice(1);
  if (value === ".inf")
    return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  if (value === ".nan")
    return NaN;
  let result = 0;
  if (value.includes(":")) {
    for (const part of value.split(":"))
      result = result * 60 + Number(part);
    result *= sign;
  } else
    result = sign * parseFloat(value);
  if (Number.isFinite(result) || YAML_FLOAT_SPECIAL_PATTERN.test(source))
    return result;
  return NOT_RESOLVED;
}
function representYamlFloat(object) {
  if (isNaN(object))
    return ".nan";
  if (object === Number.POSITIVE_INFINITY)
    return ".inf";
  if (object === Number.NEGATIVE_INFINITY)
    return "-.inf";
  if (Object.is(object, -0))
    return "-0.0";
  const result = object.toString(10);
  return /^[-+]?[0-9]+e/.test(result) ? result.replace("e", ".e") : result;
}
var floatYaml11Tag = defineScalarTag("tag:yaml.org,2002:float", {
  implicit: true,
  implicitFirstChars: [
    "-",
    "+",
    ".",
    ..."0123456789"
  ],
  resolve: resolveYamlFloat,
  identify: (object) => typeof object === "number" && (!Number.isInteger(object) || Object.is(object, -0) || object.toString(10).indexOf("e") >= 0),
  represent: representYamlFloat
});
var mergeTag = defineScalarTag("tag:yaml.org,2002:merge", {
  implicit: true,
  implicitFirstChars: ["<"],
  resolve: (source, isExplicit) => {
    if (source === "<<" || isExplicit && source === "")
      return "<<";
    return NOT_RESOLVED;
  },
  identify: () => false
});
var BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;
function resolveYamlBinary(source) {
  const input = source.replace(/\s/g, "");
  if (input.length % 4 !== 0 || !BASE64_PATTERN.test(input))
    return NOT_RESOLVED;
  const binary = atob(input);
  const result = new Uint8Array(binary.length);
  for (let index = 0;index < binary.length; index++)
    result[index] = binary.charCodeAt(index);
  return result;
}
function representYamlBinary(object) {
  let binary = "";
  for (let index = 0;index < object.length; index++)
    binary += String.fromCharCode(object[index]);
  return btoa(binary);
}
var binaryTag = defineScalarTag("tag:yaml.org,2002:binary", {
  resolve: resolveYamlBinary,
  identify: (object) => Object.prototype.toString.call(object) === "[object Uint8Array]",
  represent: representYamlBinary
});
var YAML_DATE_REGEXP = /* @__PURE__ */ new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$");
var YAML_TIMESTAMP_REGEXP = /* @__PURE__ */ new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$");
function makeUtcDate(year, month, day, hour = 0, minute = 0, second = 0, fraction = 0) {
  const date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
  date.setUTCFullYear(year, month, day);
  return date;
}
function resolveYamlTimestamp(source) {
  let match = YAML_DATE_REGEXP.exec(source);
  if (match === null)
    match = YAML_TIMESTAMP_REGEXP.exec(source);
  if (match === null)
    return NOT_RESOLVED;
  const year = +match[1];
  const month = +match[2] - 1;
  const day = +match[3];
  if (!match[4]) {
    const date = makeUtcDate(year, month, day);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day)
      return NOT_RESOLVED;
    return date;
  }
  const hour = +match[4];
  const minute = +match[5];
  const second = +match[6];
  let fraction = 0;
  if (hour > 23 || minute > 59 || second > 59)
    return NOT_RESOLVED;
  if (match[7]) {
    let value = match[7].slice(0, 3);
    while (value.length < 3)
      value += "0";
    fraction = +value;
  }
  const date = makeUtcDate(year, month, day, hour, minute, second, fraction);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day)
    return NOT_RESOLVED;
  if (match[9]) {
    const offsetHour = +match[10];
    const offsetMinute = +(match[11] || 0);
    if (offsetHour > 23 || offsetMinute > 59)
      return NOT_RESOLVED;
    const offset = (offsetHour * 60 + offsetMinute) * 60000;
    date.setTime(date.getTime() - (match[9] === "-" ? -offset : offset));
  }
  return date;
}
var timestampTag = defineScalarTag("tag:yaml.org,2002:timestamp", {
  implicit: true,
  implicitFirstChars: [..."0123456789"],
  resolve: resolveYamlTimestamp,
  identify: (object) => object instanceof Date,
  represent: (object) => object.toISOString()
});
var seqTag = defineSequenceTag("tag:yaml.org,2002:seq", {
  create: () => [],
  addItem: (container, item) => {
    container.push(item);
  },
  identify: Array.isArray
});
function isPlainObject(data) {
  if (data === null || typeof data !== "object" || Array.isArray(data))
    return false;
  const prototype = Object.getPrototypeOf(data);
  return prototype === null || prototype === Object.prototype;
}
function pick(object, keys) {
  const result = {};
  for (const key of keys)
    if (object[key] !== undefined)
      result[key] = object[key];
  return result;
}
var omapTag = defineSequenceTag("tag:yaml.org,2002:omap", {
  create: () => ({
    list: [],
    seen: /* @__PURE__ */ new Set
  }),
  addItem: (carrier, item) => {
    let key;
    if (item instanceof Map) {
      if (item.size !== 1)
        return "cannot resolve an ordered map item";
      key = item.keys().next().value;
    } else if (isPlainObject(item)) {
      const itemKeys = Object.keys(item);
      if (itemKeys.length !== 1)
        return "cannot resolve an ordered map item";
      key = itemKeys[0];
    } else
      return "cannot resolve an ordered map item";
    if (carrier.seen.has(key))
      return "duplicate key in ordered map";
    carrier.seen.add(key);
    carrier.list.push(item);
    return "";
  },
  finalize: (carrier) => carrier.list,
  identify: () => false
});
var pairsTag = defineSequenceTag("tag:yaml.org,2002:pairs", {
  create: () => [],
  addItem: (container, item) => {
    if (item instanceof Map) {
      if (item.size !== 1)
        return "cannot resolve a pairs item";
      container.push(item.entries().next().value);
      return "";
    }
    if (Object.prototype.toString.call(item) !== "[object Object]")
      return "cannot resolve a pairs item";
    const object = item;
    const keys = Object.keys(object);
    if (keys.length !== 1)
      return "cannot resolve a pairs item";
    container.push([keys[0], object[keys[0]]]);
    return "";
  },
  identify: () => false
});
var mapTag = defineMappingTag("tag:yaml.org,2002:map", {
  create: () => ({}),
  identify: isPlainObject,
  represent: (o) => {
    const map = /* @__PURE__ */ new Map;
    for (const key of Object.keys(o))
      map.set(key, o[key]);
    return map;
  },
  addPair: (container, key, value) => {
    if (key !== null && typeof key === "object")
      return "object-based map does not support complex keys";
    const normalizedKey = String(key);
    if (normalizedKey === "__proto__")
      Object.defineProperty(container, normalizedKey, {
        value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    else
      container[normalizedKey] = value;
    return "";
  },
  has: (container, key) => {
    if (key !== null && typeof key === "object")
      return false;
    return Object.prototype.hasOwnProperty.call(container, String(key));
  },
  keys: (container) => Object.keys(container),
  get: (container, key) => {
    const normalizedKey = String(key);
    if (!Object.prototype.hasOwnProperty.call(container, normalizedKey))
      return null;
    return container[normalizedKey];
  }
});
var setTag = defineMappingTag("tag:yaml.org,2002:set", {
  create: () => /* @__PURE__ */ new Set,
  identify: (data) => data instanceof Set,
  represent: (data) => {
    const map = /* @__PURE__ */ new Map;
    for (const key of data)
      map.set(key, null);
    return map;
  },
  addPair: (container, key, value) => {
    if (value !== null)
      return "cannot resolve a set item";
    container.add(key);
    return "";
  },
  has: (container, key) => container.has(key),
  keys: (container) => container.keys(),
  get: () => null
});
function createTagDefinitionMap() {
  return {
    scalar: Object.create(null),
    sequence: Object.create(null),
    mapping: Object.create(null)
  };
}
function createTagDefinitionListMap() {
  return {
    scalar: [],
    sequence: [],
    mapping: []
  };
}
function compileTags(tags) {
  const result = [];
  for (const tag of tags) {
    let index = result.length;
    for (let previousIndex = 0;previousIndex < result.length; previousIndex++) {
      const previous = result[previousIndex];
      if (previous.nodeKind === tag.nodeKind && previous.tagName === tag.tagName && previous.matchByTagPrefix === tag.matchByTagPrefix) {
        index = previousIndex;
        break;
      }
    }
    result[index] = tag;
  }
  return result;
}
var Schema = class Schema {
  tags;
  implicitScalarTags;
  implicitScalarByFirstChar;
  implicitScalarAnyFirstChar;
  defaultScalarTag;
  defaultSequenceTag;
  defaultMappingTag;
  exact;
  prefix;
  constructor(tags) {
    const compiledTags = compileTags(tags);
    const implicitScalarTags = [];
    const exact = createTagDefinitionMap();
    const prefix = createTagDefinitionListMap();
    for (const tag of compiledTags) {
      if (tag.nodeKind === "scalar" && tag.implicit) {
        if (tag.matchByTagPrefix)
          throw new Error("Implicit scalar tags cannot match by tag prefix");
        implicitScalarTags.push(tag);
      }
      switch (tag.nodeKind) {
        case "scalar":
          if (tag.matchByTagPrefix)
            prefix.scalar.push(tag);
          else
            exact.scalar[tag.tagName] = tag;
          break;
        case "sequence":
          if (tag.matchByTagPrefix)
            prefix.sequence.push(tag);
          else
            exact.sequence[tag.tagName] = tag;
          break;
        case "mapping":
          if (tag.matchByTagPrefix)
            prefix.mapping.push(tag);
          else
            exact.mapping[tag.tagName] = tag;
      }
    }
    const implicitScalarAnyFirstChar = implicitScalarTags.filter((tag) => tag.implicitFirstChars === null);
    const keys = /* @__PURE__ */ new Set;
    for (const tag of implicitScalarTags)
      if (tag.implicitFirstChars !== null)
        for (const key of tag.implicitFirstChars)
          keys.add(key);
    const implicitScalarByFirstChar = /* @__PURE__ */ new Map;
    for (const key of keys)
      implicitScalarByFirstChar.set(key, implicitScalarTags.filter((tag) => tag.implicitFirstChars === null || tag.implicitFirstChars.indexOf(key) !== -1));
    const defaultScalarTag = exact.scalar["tag:yaml.org,2002:str"];
    if (!defaultScalarTag)
      throw new Error("schema does not define the default scalar tag (tag:yaml.org,2002:str)");
    this.tags = compiledTags;
    this.implicitScalarTags = implicitScalarTags;
    this.implicitScalarByFirstChar = implicitScalarByFirstChar;
    this.implicitScalarAnyFirstChar = implicitScalarAnyFirstChar;
    this.defaultScalarTag = defaultScalarTag;
    this.defaultSequenceTag = exact.sequence["tag:yaml.org,2002:seq"];
    this.defaultMappingTag = exact.mapping["tag:yaml.org,2002:map"];
    this.exact = exact;
    this.prefix = prefix;
  }
  lookupScalarTag(tagName) {
    const exactTag = this.exact.scalar[tagName];
    if (exactTag)
      return exactTag;
    for (const tag of this.prefix.scalar)
      if (tagName.startsWith(tag.tagName))
        return tag;
  }
  lookupSequenceTag(tagName) {
    const exactTag = this.exact.sequence[tagName];
    if (exactTag)
      return exactTag;
    for (const tag of this.prefix.sequence)
      if (tagName.startsWith(tag.tagName))
        return tag;
  }
  lookupMappingTag(tagName) {
    const exactTag = this.exact.mapping[tagName];
    if (exactTag)
      return exactTag;
    for (const tag of this.prefix.mapping)
      if (tagName.startsWith(tag.tagName))
        return tag;
  }
  resolveImplicitScalarTag(source) {
    const candidates = this.implicitScalarByFirstChar.get(source.charAt(0)) ?? this.implicitScalarAnyFirstChar;
    for (const tag of candidates) {
      const value = tag.resolve(source, false, tag.tagName);
      if (value !== NOT_RESOLVED)
        return {
          value,
          tag
        };
    }
    const tag = this.defaultScalarTag;
    return {
      value: tag.resolve(source, false, tag.tagName),
      tag
    };
  }
  withTags(...tags) {
    let flatTags = [];
    for (const tag of tags)
      flatTags = flatTags.concat(tag);
    return new Schema([...this.tags, ...flatTags]);
  }
};
var FAILSAFE_SCHEMA = new Schema([
  strTag,
  seqTag,
  mapTag
]);
var JSON_SCHEMA = new Schema([
  ...FAILSAFE_SCHEMA.tags,
  nullJsonTag,
  boolJsonTag,
  intJsonTag,
  floatJsonTag
]);
var CORE_SCHEMA = new Schema([
  ...FAILSAFE_SCHEMA.tags,
  nullCoreTag,
  boolCoreTag,
  intCoreTag,
  floatCoreTag
]);
var YAML11_SCHEMA = new Schema([
  ...FAILSAFE_SCHEMA.tags,
  nullYaml11Tag,
  boolYaml11Tag,
  intYaml11Tag,
  floatYaml11Tag,
  timestampTag,
  mergeTag,
  binaryTag,
  omapTag,
  pairsTag,
  setTag
]);
var DUMP_SCHEMA = YAML11_SCHEMA.withTags({
  ...intYaml11Tag,
  resolve: (source, isExplicit, tagName) => {
    const result = intYaml11Tag.resolve(source, isExplicit, tagName);
    return result === NOT_RESOLVED ? intCoreTag.resolve(source, isExplicit, tagName) : result;
  }
}, {
  ...floatYaml11Tag,
  resolve: (source, isExplicit, tagName) => {
    const result = floatYaml11Tag.resolve(source, isExplicit, tagName);
    return result === NOT_RESOLVED ? floatCoreTag.resolve(source, isExplicit, tagName) : result;
  }
});
var realMapTag = defineMappingTag("tag:yaml.org,2002:map", {
  create: () => /* @__PURE__ */ new Map,
  addPair: (container, key, value) => {
    container.set(key, value);
    return "";
  },
  has: (container, key) => container.has(key),
  keys: (container) => container.keys(),
  get: (container, key) => container.get(key),
  identify: (data) => data instanceof Map || isPlainObject(data),
  represent: (data) => {
    if (data instanceof Map)
      return data;
    const map = /* @__PURE__ */ new Map;
    const obj = data;
    for (const key of Object.keys(obj))
      map.set(key, obj[key]);
    return map;
  }
});
function normalizeKey(key) {
  if (Array.isArray(key)) {
    const array = Array.prototype.slice.call(key);
    for (let index = 0;index < array.length; index++) {
      if (Array.isArray(array[index]))
        return null;
      if (typeof array[index] === "object" && Object.prototype.toString.call(array[index]) === "[object Object]")
        array[index] = "[object Object]";
    }
    return String(array);
  }
  if (typeof key === "object" && Object.prototype.toString.call(key) === "[object Object]")
    return "[object Object]";
  return String(key);
}
var legacyMapTag = defineMappingTag("tag:yaml.org,2002:map", {
  create: () => ({}),
  identify: isPlainObject,
  represent: (o) => {
    const map = /* @__PURE__ */ new Map;
    for (const key of Object.keys(o))
      map.set(key, o[key]);
    return map;
  },
  addPair: (container, key, value) => {
    const normalizedKey = normalizeKey(key);
    if (normalizedKey === null)
      return "nested arrays are not supported inside keys";
    if (normalizedKey === "__proto__")
      Object.defineProperty(container, normalizedKey, {
        value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    else
      container[normalizedKey] = value;
    return "";
  },
  has: (container, key) => {
    const normalizedKey = normalizeKey(key);
    return normalizedKey !== null && Object.prototype.hasOwnProperty.call(container, normalizedKey);
  },
  keys: (container) => Object.keys(container),
  get: (container, key) => {
    const normalizedKey = String(key);
    if (!Object.prototype.hasOwnProperty.call(container, normalizedKey))
      return null;
    return container[normalizedKey];
  }
});
var DEFAULT_SNIPPET_OPTIONS = {
  maxLength: 79,
  indent: 1,
  linesBefore: 3,
  linesAfter: 2
};
function getLine2(buffer, lineStart, lineEnd, position, maxLineLength) {
  let head = "";
  let tail = "";
  const maxHalfLength = Math.floor(maxLineLength / 2) - 1;
  if (position - lineStart > maxHalfLength) {
    head = " ... ";
    lineStart = position - maxHalfLength + head.length;
  }
  if (lineEnd - position > maxHalfLength) {
    tail = " ...";
    lineEnd = position + maxHalfLength - tail.length;
  }
  return {
    str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "→") + tail,
    pos: position - lineStart + head.length
  };
}
function padStart(string, max) {
  return " ".repeat(Math.max(max - string.length, 0)) + string;
}
function makeSnippet(mark, options) {
  if (!mark.buffer)
    return null;
  const opts = {
    ...DEFAULT_SNIPPET_OPTIONS,
    ...options
  };
  const re = /\r?\n|\r|\0/g;
  const lineStarts = [0];
  const lineEnds = [];
  let match;
  let foundLineNo = -1;
  while (match = re.exec(mark.buffer)) {
    lineEnds.push(match.index);
    lineStarts.push(match.index + match[0].length);
    if (mark.position <= match.index && foundLineNo < 0)
      foundLineNo = lineStarts.length - 2;
  }
  if (foundLineNo < 0)
    foundLineNo = lineStarts.length - 1;
  let result = "";
  const lineNoLength = Math.min(mark.line + opts.linesAfter, lineEnds.length).toString().length;
  const maxLineLength = opts.maxLength - (opts.indent + lineNoLength + 3);
  for (let i = 1;i <= opts.linesBefore; i++) {
    if (foundLineNo - i < 0)
      break;
    const line = getLine2(mark.buffer, lineStarts[foundLineNo - i], lineEnds[foundLineNo - i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]), maxLineLength);
    result = `${" ".repeat(opts.indent)}${padStart((mark.line - i + 1).toString(), lineNoLength)} | ${line.str}
${result}`;
  }
  const line = getLine2(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
  result += `${" ".repeat(opts.indent)}${padStart((mark.line + 1).toString(), lineNoLength)} | ${line.str}
`;
  result += `${"-".repeat(opts.indent + lineNoLength + 3 + line.pos)}^
`;
  for (let i = 1;i <= opts.linesAfter; i++) {
    if (foundLineNo + i >= lineEnds.length)
      break;
    const line = getLine2(mark.buffer, lineStarts[foundLineNo + i], lineEnds[foundLineNo + i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]), maxLineLength);
    result += `${" ".repeat(opts.indent)}${padStart((mark.line + i + 1).toString(), lineNoLength)} | ${line.str}
`;
  }
  return result.replace(/\n$/, "");
}
function formatError(exception, compact) {
  let where = "";
  if (!exception.mark)
    return exception.reason;
  if (exception.mark.name)
    where += `in "${exception.mark.name}" `;
  where += `(${exception.mark.line + 1}:${exception.mark.column + 1})`;
  if (!compact && exception.mark.snippet)
    where += `

${exception.mark.snippet}`;
  return `${exception.reason} ${where}`;
}
var YAMLException = class YAMLException extends Error {
  reason;
  mark;
  constructor(reason, mark) {
    super();
    this.name = "YAMLException";
    this.reason = reason;
    this.mark = mark;
    this.message = formatError(this, false);
    if (Error.captureStackTrace)
      Error.captureStackTrace(this, this.constructor);
  }
  toString(compact) {
    return `${this.name}: ${formatError(this, compact)}`;
  }
  static throwAt(source, position, message, filename = "") {
    let line = 0;
    let lineStart = 0;
    for (let index = 0;index < position; index++) {
      const ch = source.charCodeAt(index);
      if (ch === 10) {
        line++;
        lineStart = index + 1;
      } else if (ch === 13) {
        line++;
        if (source.charCodeAt(index + 1) === 10)
          index++;
        lineStart = index + 1;
      }
    }
    const mark = {
      name: filename,
      buffer: source,
      position,
      line,
      column: position - lineStart
    };
    mark.snippet = makeSnippet(mark);
    throw new YAMLException(message, mark);
  }
};
var EVENT_ID = {
  DOCUMENT: 1,
  SEQUENCE: 2,
  MAPPING: 3,
  SCALAR: 4,
  ALIAS: 5,
  POP: 6
};
var SCALAR_STYLE = {
  PLAIN: 1,
  SINGLE_QUOTED: 2,
  DOUBLE_QUOTED: 3,
  LITERAL_BLOCK: 4,
  FOLDED_BLOCK: 5
};
var COLLECTION_STYLE = {
  BLOCK: 1,
  FLOW: 2
};
var CHOMPING_MODE = {
  CLIP: 1,
  STRIP: 2,
  KEEP: 3
};
var NO_RANGE$3 = -1;
function simpleEscapeSequence(c) {
  switch (c) {
    case 48:
      return "\x00";
    case 97:
      return "\x07";
    case 98:
      return "\b";
    case 116:
      return "\t";
    case 9:
      return "\t";
    case 110:
      return `
`;
    case 118:
      return "\v";
    case 102:
      return "\f";
    case 114:
      return "\r";
    case 101:
      return "\x1B";
    case 32:
      return " ";
    case 34:
      return '"';
    case 47:
      return "/";
    case 92:
      return "\\";
    case 78:
      return "";
    case 95:
      return " ";
    case 76:
      return "\u2028";
    case 80:
      return "\u2029";
    default:
      return "";
  }
}
var simpleEscapeCheck = new Array(256);
var simpleEscapeMap = new Array(256);
for (let i = 0;i < 256; i++) {
  simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
  simpleEscapeMap[i] = simpleEscapeSequence(i);
}
function charFromCodepoint(c) {
  if (c <= 65535)
    return String.fromCharCode(c);
  return String.fromCharCode((c - 65536 >> 10) + 55296, (c - 65536 & 1023) + 56320);
}
function fromHexCode$1(c) {
  if (c >= 48 && c <= 57)
    return c - 48;
  return (c | 32) - 97 + 10;
}
function escapedHexLen$1(c) {
  if (c === 120)
    return 2;
  if (c === 117)
    return 4;
  return 8;
}
function skipFoldedBreaks(input, position, end) {
  let breaks = 0;
  while (position < end) {
    const ch = input.charCodeAt(position);
    if (ch === 10) {
      breaks++;
      position++;
    } else if (ch === 13) {
      breaks++;
      position++;
      if (input.charCodeAt(position) === 10)
        position++;
    } else if (ch === 32 || ch === 9)
      position++;
    else
      break;
  }
  return {
    position,
    breaks
  };
}
function foldedBreaks(count) {
  if (count === 1)
    return " ";
  return `
`.repeat(count - 1);
}
function getPlainValue(input, start, end) {
  let result = "";
  let position = start;
  let captureStart = start;
  let captureEnd = start;
  while (position < end) {
    const ch = input.charCodeAt(position);
    if (ch === 10 || ch === 13) {
      result += input.slice(captureStart, captureEnd);
      const fold = skipFoldedBreaks(input, position, end);
      result += foldedBreaks(fold.breaks);
      position = captureStart = captureEnd = fold.position;
    } else {
      position++;
      if (ch !== 32 && ch !== 9)
        captureEnd = position;
    }
  }
  return result + input.slice(captureStart, captureEnd);
}
function getSingleQuotedValue(input, start, end) {
  let result = "";
  let position = start;
  let captureStart = start;
  let captureEnd = start;
  while (position < end) {
    const ch = input.charCodeAt(position);
    if (ch === 39) {
      result += input.slice(captureStart, position) + "'";
      position += 2;
      captureStart = captureEnd = position;
    } else if (ch === 10 || ch === 13) {
      result += input.slice(captureStart, captureEnd);
      const fold = skipFoldedBreaks(input, position, end);
      result += foldedBreaks(fold.breaks);
      position = captureStart = captureEnd = fold.position;
    } else {
      position++;
      if (ch !== 32 && ch !== 9)
        captureEnd = position;
    }
  }
  return result + input.slice(captureStart, end);
}
function getDoubleQuotedValue(input, start, end) {
  let result = "";
  let position = start;
  let captureStart = start;
  let captureEnd = start;
  while (position < end) {
    const ch = input.charCodeAt(position);
    if (ch === 92) {
      result += input.slice(captureStart, position);
      position++;
      const escaped = input.charCodeAt(position);
      if (escaped === 10 || escaped === 13)
        position = skipFoldedBreaks(input, position, end).position;
      else if (escaped < 256 && simpleEscapeCheck[escaped]) {
        result += simpleEscapeMap[escaped];
        position++;
      } else {
        let hexLength = escapedHexLen$1(escaped);
        let hexResult = 0;
        for (;hexLength > 0; hexLength--) {
          position++;
          const digit = fromHexCode$1(input.charCodeAt(position));
          hexResult = (hexResult << 4) + digit;
        }
        result += charFromCodepoint(hexResult);
        position++;
      }
      captureStart = captureEnd = position;
    } else if (ch === 10 || ch === 13) {
      result += input.slice(captureStart, captureEnd);
      const fold = skipFoldedBreaks(input, position, end);
      result += foldedBreaks(fold.breaks);
      position = captureStart = captureEnd = fold.position;
    } else {
      position++;
      if (ch !== 32 && ch !== 9)
        captureEnd = position;
    }
  }
  return result + input.slice(captureStart, end);
}
function getBlockValue(input, start, end, indent, chomping, folded) {
  const textIndent = indent < 0 ? 0 : indent;
  const region = input.slice(start, end).replace(/\r\n?/g, `
`);
  const lines = region === "" ? [] : (region.endsWith(`
`) ? region.slice(0, -1) : region).split(`
`);
  let result = "";
  let didReadContent = false;
  let emptyLines = 0;
  let atMoreIndented = false;
  for (const line of lines) {
    let column = 0;
    while (column < textIndent && line.charCodeAt(column) === 32)
      column++;
    if (indent < 0 || column >= line.length) {
      emptyLines++;
      continue;
    }
    const content = line.slice(textIndent);
    const first = content.charCodeAt(0);
    if (folded) {
      if (first === 32 || first === 9) {
        atMoreIndented = true;
        result += `
`.repeat(didReadContent ? 1 + emptyLines : emptyLines);
      } else if (atMoreIndented) {
        atMoreIndented = false;
        result += `
`.repeat(emptyLines + 1);
      } else if (emptyLines === 0) {
        if (didReadContent)
          result += " ";
      } else
        result += `
`.repeat(emptyLines);
    } else
      result += `
`.repeat(didReadContent ? 1 + emptyLines : emptyLines);
    result += content;
    didReadContent = true;
    emptyLines = 0;
  }
  if (chomping === CHOMPING_MODE.KEEP)
    result += `
`.repeat(didReadContent ? 1 + emptyLines : emptyLines);
  else if (chomping !== CHOMPING_MODE.STRIP) {
    if (didReadContent)
      result += `
`;
  }
  return result;
}
function getScalarValue(input, scalar) {
  if (scalar.valueStart === NO_RANGE$3)
    return "";
  const { valueStart, valueEnd } = scalar;
  if (scalar.fast)
    return input.slice(valueStart, valueEnd);
  switch (scalar.style) {
    case SCALAR_STYLE.SINGLE_QUOTED:
      return getSingleQuotedValue(input, valueStart, valueEnd);
    case SCALAR_STYLE.DOUBLE_QUOTED:
      return getDoubleQuotedValue(input, valueStart, valueEnd);
    case SCALAR_STYLE.LITERAL_BLOCK:
      return getBlockValue(input, valueStart, valueEnd, scalar.indent, scalar.chomping, false);
    case SCALAR_STYLE.FOLDED_BLOCK:
      return getBlockValue(input, valueStart, valueEnd, scalar.indent, scalar.chomping, true);
    default:
      return getPlainValue(input, valueStart, valueEnd);
  }
}
var DEFAULT_TAG_HANDLERS = Object.assign(Object.create(null), {
  "!": "!",
  "!!": "tag:yaml.org,2002:"
});
var TAG_SUFFIX_CHARS = "-#;/?:@&=+$_.~*'()";
var TAG_URI_CHARS = TAG_SUFFIX_CHARS + "!,[]";
var HEX = "0123456789ABCDEF";
function percentByte(byte) {
  return "%" + HEX[byte >> 4] + HEX[byte & 15];
}
function tagPercentEncode(source, isSuffix) {
  const allowed = isSuffix ? TAG_SUFFIX_CHARS : TAG_URI_CHARS;
  let result = "";
  for (let index = 0;index < source.length; index++) {
    let ch = source.charCodeAt(index);
    if (ch >= 48 && ch <= 57 || ch >= 65 && ch <= 90 || ch >= 97 && ch <= 122 || allowed.includes(source[index])) {
      result += source[index];
      continue;
    }
    if (ch >= 55296 && ch <= 56319)
      ch = 65536 + ((ch & 1023) << 10) + (source.charCodeAt(++index) & 1023);
    if (ch < 128)
      result += percentByte(ch);
    else if (ch < 2048)
      result += percentByte(192 | ch >> 6) + percentByte(128 | ch & 63);
    else if (ch < 65536)
      result += percentByte(224 | ch >> 12) + percentByte(128 | ch >> 6 & 63) + percentByte(128 | ch & 63);
    else
      result += percentByte(240 | ch >> 18) + percentByte(128 | ch >> 12 & 63) + percentByte(128 | ch >> 6 & 63) + percentByte(128 | ch & 63);
  }
  return result;
}
function tagPercentDecode(source) {
  let result = "";
  let index = 0;
  while (index < source.length) {
    if (source.charCodeAt(index) !== 37) {
      result += source[index++];
      continue;
    }
    let ch = parseInt(source.slice(index + 1, index + 3), 16);
    index += 3;
    if (ch >= 192) {
      let remaining = ch < 224 ? 1 : ch < 240 ? 2 : 3;
      ch &= (1 << 6 - remaining) - 1;
      while (remaining-- > 0) {
        ch = ch << 6 | parseInt(source.slice(index + 1, index + 3), 16) & 63;
        index += 3;
      }
    }
    if (ch < 65536)
      result += String.fromCharCode(ch);
    else {
      ch -= 65536;
      result += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
    }
  }
  return result;
}
function tagNameFull(rawTag, tagHandlers) {
  if (rawTag.startsWith("!<") && rawTag.endsWith(">"))
    return tagPercentDecode(rawTag.slice(2, -1));
  const handleEnd = rawTag.indexOf("!", 1);
  const handle = handleEnd === -1 ? "!" : rawTag.slice(0, handleEnd + 1);
  return tagPercentDecode(tagHandlers?.[handle] ?? DEFAULT_TAG_HANDLERS[handle] ?? handle) + tagPercentDecode(rawTag.slice(handle.length));
}
function tagNameShort(fullTag) {
  let tag = fullTag;
  if (tag.charCodeAt(0) === 33) {
    tag = tag.slice(1);
    return `!${tagPercentEncode(tag, true)}`;
  }
  if (tag.slice(0, 18) === "tag:yaml.org,2002:")
    return `!!${tagPercentEncode(tag.slice(18), true)}`;
  return `!<${tagPercentEncode(tag, false)}>`;
}
var NO_RANGE$2 = -1;
var MERGE_TAG_NAME = "tag:yaml.org,2002:merge";
var DEFAULT_CONSTRUCTOR_OPTIONS = {
  filename: "",
  schema: CORE_SCHEMA,
  json: false,
  maxTotalMergeKeys: 1e4,
  maxAliases: -1
};
function eventPosition$1(event) {
  if ("tagStart" in event && event.tagStart !== NO_RANGE$2)
    return event.tagStart;
  if ("anchorStart" in event && event.anchorStart !== NO_RANGE$2)
    return event.anchorStart;
  if ("valueStart" in event && event.valueStart !== NO_RANGE$2)
    return event.valueStart;
  if ("start" in event)
    return event.start;
  return 0;
}
function throwError$1(state, message) {
  YAMLException.throwAt(state.source, state.position, message, state.filename);
}
function finalizeCollection(state, position, tag, carrier) {
  try {
    return tag.finalize(carrier);
  } catch (error) {
    if (error instanceof YAMLException)
      throw error;
    YAMLException.throwAt(state.source, position, error instanceof Error ? error.message : String(error), state.filename);
  }
}
function constructScalar(state, event) {
  const source = getScalarValue(state.source, event);
  const rawTag = event.tagStart === NO_RANGE$2 ? "" : state.source.slice(event.tagStart, event.tagEnd);
  const strTag = state.schema.defaultScalarTag;
  if (rawTag !== "") {
    if (rawTag === "!")
      return {
        value: source,
        tag: strTag
      };
    const tagName = tagNameFull(rawTag, state.tagHandlers);
    const scalarTag = state.schema.lookupScalarTag(tagName);
    if (scalarTag) {
      const result = scalarTag.resolve(source, true, tagName);
      if (result === NOT_RESOLVED)
        throwError$1(state, `cannot resolve a node with !<${tagName}> explicit tag`);
      return {
        value: result,
        tag: scalarTag
      };
    }
    const collectionTagDef = state.schema.lookupMappingTag(tagName) ?? state.schema.lookupSequenceTag(tagName);
    if (collectionTagDef) {
      if (source !== "")
        throwError$1(state, `cannot resolve a node with !<${tagName}> explicit tag`);
      const carrier = collectionTagDef.create(tagName);
      return {
        value: collectionTagDef.carrierIsResult ? carrier : finalizeCollection(state, state.position, collectionTagDef, carrier),
        tag: collectionTagDef
      };
    }
    throwError$1(state, `unknown scalar tag !<${tagName}>`);
  }
  if (event.style === SCALAR_STYLE.PLAIN)
    return state.schema.resolveImplicitScalarTag(source);
  return {
    value: strTag.resolve(source, false, strTag.tagName),
    tag: strTag
  };
}
function collectionTagName(state, event, defaultTagName) {
  const rawTag = event.tagStart === NO_RANGE$2 ? "" : state.source.slice(event.tagStart, event.tagEnd);
  return rawTag === "" || rawTag === "!" ? defaultTagName : tagNameFull(rawTag, state.tagHandlers);
}
function isMappingTag(tag) {
  return tag.nodeKind === "mapping";
}
function chargeMergeWork(state) {
  state.totalMergeKeys++;
  if (state.maxTotalMergeKeys !== -1 && state.totalMergeKeys > state.maxTotalMergeKeys)
    throwError$1(state, `merge keys exceeded maxTotalMergeKeys (${state.maxTotalMergeKeys})`);
}
function mergeKeys(state, frame, source, sourceTag) {
  chargeMergeWork(state);
  for (const sourceKey of sourceTag.keys(source)) {
    chargeMergeWork(state);
    if (frame.tag.has(frame.value, sourceKey))
      continue;
    const err = frame.tag.addPair(frame.value, sourceKey, sourceTag.get(source, sourceKey));
    if (err)
      throwError$1(state, err);
    frame.overridable ??= /* @__PURE__ */ new Set;
    frame.overridable.add(sourceKey);
  }
}
function mergeSource(state, frame, source, sourceTag) {
  state.position = frame.keyPosition;
  if (isMappingTag(sourceTag))
    mergeKeys(state, frame, source, sourceTag);
  else if (sourceTag.nodeKind === "sequence" && Array.isArray(source)) {
    if (source.length > 100)
      throwError$1(state, "abnormal merge sequence size");
    for (const element of source) {
      const elementTag = state.nodeTags.get(element);
      if (!elementTag)
        throwError$1(state, "cannot merge mappings; the provided source object is unacceptable");
      mergeKeys(state, frame, element, elementTag);
    }
  } else
    throwError$1(state, "cannot merge mappings; the provided source object is unacceptable");
}
function addMappingValue(state, frame, key, value, tag) {
  state.position = frame.keyPosition;
  if (frame.keyIsMerge) {
    mergeSource(state, frame, value, tag);
    return;
  }
  if (!state.json && frame.tag.has(frame.value, key) && !frame.overridable?.has(key))
    throwError$1(state, "duplicated mapping key");
  const err = frame.tag.addPair(frame.value, key, value);
  if (err)
    throwError$1(state, err);
  frame.overridable?.delete(key);
}
function addValue(state, value, tag) {
  const frame = state.frames[state.frames.length - 1];
  if (frame.kind === "document") {
    frame.value = value;
    frame.hasValue = true;
  } else if (frame.kind === "sequence") {
    if (isMappingTag(tag))
      state.nodeTags.set(value, tag);
    const err = frame.tag.addItem(frame.value, value, frame.index++);
    if (err)
      throwError$1(state, err);
  } else if (frame.hasKey) {
    const key = frame.key;
    frame.key = undefined;
    frame.hasKey = false;
    addMappingValue(state, frame, key, value, tag);
  } else {
    frame.key = value;
    frame.keyPosition = state.position;
    frame.hasKey = true;
    frame.keyIsMerge = tag.tagName === MERGE_TAG_NAME;
  }
}
function storeAnchor(state, event, value, tag, isValueFinal) {
  if (event.anchorStart !== NO_RANGE$2) {
    const anchor = {
      value,
      tag,
      isValueFinal
    };
    state.anchors.set(state.source.slice(event.anchorStart, event.anchorEnd), anchor);
    return anchor;
  }
  return null;
}
function constructFromEvents(events, options) {
  const state = {
    ...DEFAULT_CONSTRUCTOR_OPTIONS,
    ...options,
    events,
    documents: [],
    eventIndex: 0,
    position: 0,
    frames: [],
    anchors: /* @__PURE__ */ new Map,
    nodeTags: /* @__PURE__ */ new Map,
    tagHandlers: Object.create(null),
    totalMergeKeys: 0,
    aliasCount: 0
  };
  while (state.eventIndex < state.events.length) {
    const event = state.events[state.eventIndex++];
    state.position = eventPosition$1(event);
    switch (event.type) {
      case EVENT_ID.DOCUMENT:
        state.anchors = /* @__PURE__ */ new Map;
        state.nodeTags = /* @__PURE__ */ new Map;
        state.aliasCount = 0;
        state.tagHandlers = Object.create(null);
        for (const directive of event.directives)
          if (directive.kind === "tag")
            state.tagHandlers[directive.handle] = directive.prefix;
        state.frames.push({
          kind: "document",
          position: state.position,
          value: undefined,
          hasValue: false
        });
        break;
      case EVENT_ID.SCALAR: {
        const { value, tag } = constructScalar(state, event);
        storeAnchor(state, event, value, tag, true);
        addValue(state, value, tag);
        break;
      }
      case EVENT_ID.SEQUENCE: {
        const tagName = collectionTagName(state, event, "tag:yaml.org,2002:seq");
        const tag = state.schema.lookupSequenceTag(tagName);
        if (!tag)
          throwError$1(state, `unknown sequence tag !<${tagName}>`);
        const value = tag.create(tagName);
        const anchor = storeAnchor(state, event, value, tag, tag.carrierIsResult);
        state.frames.push({
          kind: "sequence",
          position: state.position,
          value,
          tag,
          anchor,
          index: 0
        });
        break;
      }
      case EVENT_ID.MAPPING: {
        const tagName = collectionTagName(state, event, "tag:yaml.org,2002:map");
        const tag = state.schema.lookupMappingTag(tagName);
        if (!tag)
          throwError$1(state, `unknown mapping tag !<${tagName}>`);
        const value = tag.create(tagName);
        const anchor = storeAnchor(state, event, value, tag, tag.carrierIsResult);
        state.frames.push({
          kind: "mapping",
          position: state.position,
          value,
          tag,
          anchor,
          key: undefined,
          keyPosition: state.position,
          hasKey: false,
          keyIsMerge: false,
          overridable: null
        });
        break;
      }
      case EVENT_ID.ALIAS: {
        if (state.maxAliases !== -1 && ++state.aliasCount > state.maxAliases)
          throwError$1(state, `aliases exceeded maxAliases (${state.maxAliases})`);
        const name = state.source.slice(event.anchorStart, event.anchorEnd);
        const anchor = state.anchors.get(name);
        if (!anchor)
          throwError$1(state, `unidentified alias "${name}"`);
        if (!anchor.isValueFinal)
          throwError$1(state, `recursive alias "${name}" is not supported for tag ${anchor.tag.tagName} because it uses finalize()`);
        addValue(state, anchor.value, anchor.tag);
        break;
      }
      case EVENT_ID.POP: {
        const frame = state.frames.pop();
        if (frame.kind === "mapping" && frame.hasKey) {
          state.position = frame.keyPosition;
          throwError$1(state, "incomplete mapping pair in event stream");
        }
        if (frame.kind === "document")
          state.documents.push(frame.value);
        else {
          const value = frame.tag.carrierIsResult ? frame.value : finalizeCollection(state, frame.position, frame.tag, frame.value);
          if (frame.anchor) {
            frame.anchor.value = value;
            frame.anchor.isValueFinal = true;
          }
          addValue(state, value, frame.tag);
        }
        break;
      }
    }
  }
  return state.documents;
}
var NO_RANGE$1 = -1;
var HAS_OWN = Object.prototype.hasOwnProperty;
var CONTEXT_FLOW_IN = 1;
var CONTEXT_FLOW_OUT = 2;
var CONTEXT_BLOCK_IN = 3;
var CONTEXT_BLOCK_OUT = 4;
var PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
var PATTERN_FLOW_INDICATORS = /[,\[\]{}]/;
var PATTERN_TAG_HANDLE = /^(?:!|!!|![0-9A-Za-z-]+!)$/;
var NS_URI_CHAR = String.raw`(?:%[0-9A-Fa-f]{2}|[0-9A-Za-z\-#;/?:@&=+$,_.!~*'()\[\]])`;
var NS_TAG_CHAR = String.raw`(?:%[0-9A-Fa-f]{2}|[0-9A-Za-z\-#;/?:@&=+$.~*'()_])`;
var PATTERN_TAG_URI = new RegExp(`^(?:${NS_URI_CHAR})*$`);
var PATTERN_TAG_SUFFIX = new RegExp(`^(?:${NS_TAG_CHAR})+$`);
var PATTERN_TAG_PREFIX = new RegExp(`^(?:!(?:${NS_URI_CHAR})*|${NS_TAG_CHAR}(?:${NS_URI_CHAR})*)$`);
var DEFAULT_PARSER_OPTIONS = {
  filename: "",
  maxDepth: 100
};
function addDocumentEvent(state, explicitStart, explicitEnd) {
  state.events.push({
    type: EVENT_ID.DOCUMENT,
    explicitStart,
    explicitEnd,
    directives: state.directives
  });
}
function addSequenceEvent(state, start, anchorStart, anchorEnd, tagStart, tagEnd, style) {
  state.events.push({
    type: EVENT_ID.SEQUENCE,
    start,
    anchorStart,
    anchorEnd,
    tagStart,
    tagEnd,
    style
  });
}
function addMappingEvent(state, start, anchorStart, anchorEnd, tagStart, tagEnd, style) {
  state.events.push({
    type: EVENT_ID.MAPPING,
    start,
    anchorStart,
    anchorEnd,
    tagStart,
    tagEnd,
    style
  });
}
function insertFlowPairMappingEvent(state, snapshot) {
  state.events.splice(snapshot.eventsLength, 0, {
    type: EVENT_ID.MAPPING,
    start: snapshot.position,
    anchorStart: NO_RANGE$1,
    anchorEnd: NO_RANGE$1,
    tagStart: NO_RANGE$1,
    tagEnd: NO_RANGE$1,
    style: COLLECTION_STYLE.FLOW
  });
}
function addScalarEvent(state, valueStart, valueEnd, anchorStart, anchorEnd, tagStart, tagEnd, style, chomping = CHOMPING_MODE.CLIP, indent = -1, fast = false) {
  state.events.push({
    type: EVENT_ID.SCALAR,
    valueStart,
    valueEnd,
    anchorStart,
    anchorEnd,
    tagStart,
    tagEnd,
    style,
    chomping,
    indent,
    fast
  });
}
function addAliasEvent(state, anchorStart, anchorEnd) {
  state.events.push({
    type: EVENT_ID.ALIAS,
    anchorStart,
    anchorEnd
  });
}
function addPopEvent(state) {
  state.events.push({ type: EVENT_ID.POP });
}
function addEmptyScalarEvent(state) {
  addScalarEvent(state, NO_RANGE$1, NO_RANGE$1, NO_RANGE$1, NO_RANGE$1, NO_RANGE$1, NO_RANGE$1, SCALAR_STYLE.PLAIN);
}
function emptyProperties() {
  return {
    anchorStart: NO_RANGE$1,
    anchorEnd: NO_RANGE$1,
    tagStart: NO_RANGE$1,
    tagEnd: NO_RANGE$1
  };
}
function snapshotState(state) {
  return {
    position: state.position,
    line: state.line,
    lineStart: state.lineStart,
    lineIndent: state.lineIndent,
    firstTabInLine: state.firstTabInLine,
    eventsLength: state.events.length
  };
}
function restoreState(state, snapshot) {
  state.position = snapshot.position;
  state.line = snapshot.line;
  state.lineStart = snapshot.lineStart;
  state.lineIndent = snapshot.lineIndent;
  state.firstTabInLine = snapshot.firstTabInLine;
  state.events.length = snapshot.eventsLength;
}
function throwError(state, message) {
  YAMLException.throwAt(state.input.slice(0, state.length), state.position, message, state.filename);
}
function isEol(c) {
  return c === 10 || c === 13;
}
function isWhiteSpace2(c) {
  return c === 9 || c === 32;
}
function isWsOrEol(c) {
  return isWhiteSpace2(c) || isEol(c);
}
function isWsOrEolOrEnd(c) {
  return c === 0 || isWsOrEol(c);
}
function isFlowIndicator(c) {
  return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
}
function fromDecimalCode(c) {
  return c >= 48 && c <= 57 ? c - 48 : -1;
}
function fromHexCode(c) {
  if (c >= 48 && c <= 57)
    return c - 48;
  const lc = c | 32;
  if (lc >= 97 && lc <= 102)
    return lc - 97 + 10;
  return -1;
}
function escapedHexLen(c) {
  if (c === 120)
    return 2;
  if (c === 117)
    return 4;
  if (c === 85)
    return 8;
  return 0;
}
function isSimpleEscape(c) {
  return c === 48 || c === 97 || c === 98 || c === 116 || c === 9 || c === 110 || c === 118 || c === 102 || c === 114 || c === 101 || c === 32 || c === 34 || c === 47 || c === 92 || c === 78 || c === 95 || c === 76 || c === 80;
}
function consumeLineBreak(state) {
  if (state.input.charCodeAt(state.position) === 10)
    state.position++;
  else {
    state.position++;
    if (state.input.charCodeAt(state.position) === 10)
      state.position++;
  }
  state.line++;
  state.lineStart = state.position;
  state.lineIndent = 0;
  state.firstTabInLine = -1;
}
function skipSeparationSpace(state, allowComments) {
  let lineBreaks = 0;
  let ch = state.input.charCodeAt(state.position);
  let hasSeparation = state.position === state.lineStart || isWsOrEol(state.input.charCodeAt(state.position - 1));
  while (ch !== 0) {
    while (isWhiteSpace2(ch)) {
      hasSeparation = true;
      if (ch === 9 && state.firstTabInLine === -1)
        state.firstTabInLine = state.position;
      ch = state.input.charCodeAt(++state.position);
    }
    if (allowComments && hasSeparation && ch === 35)
      do
        ch = state.input.charCodeAt(++state.position);
      while (!isEol(ch) && ch !== 0);
    if (!isEol(ch))
      break;
    consumeLineBreak(state);
    lineBreaks++;
    hasSeparation = true;
    ch = state.input.charCodeAt(state.position);
    while (ch === 32) {
      state.lineIndent++;
      ch = state.input.charCodeAt(++state.position);
    }
  }
  return lineBreaks;
}
function testDocumentSeparator(state, position = state.position) {
  const ch = state.input.charCodeAt(position);
  if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(position + 1) && ch === state.input.charCodeAt(position + 2)) {
    const following = state.input.charCodeAt(position + 3);
    return following === 0 || isWsOrEol(following);
  }
  return false;
}
function skipByteOrderMark(state) {
  if (state.position === state.lineStart && state.input.charCodeAt(state.position) === 65279) {
    state.position++;
    state.lineStart = state.position;
  }
}
function testDocumentBoundary(state) {
  if (state.position !== state.lineStart)
    return false;
  if (testDocumentSeparator(state))
    return true;
  if (state.input.charCodeAt(state.position) !== 65279)
    return false;
  const snapshot = snapshotState(state);
  skipByteOrderMark(state);
  skipSeparationSpace(state, true);
  const ch = state.input.charCodeAt(state.position);
  const result = state.position === state.lineStart && (ch === 37 || ch === 45 && testDocumentSeparator(state));
  restoreState(state, snapshot);
  return result;
}
function skipUntilLineEnd(state) {
  let ch = state.input.charCodeAt(state.position);
  while (ch !== 0 && !isEol(ch))
    ch = state.input.charCodeAt(++state.position);
}
function checkPrintable(state, start, end) {
  const match = PATTERN_NON_PRINTABLE.exec(state.input.slice(start, end));
  if (match !== null) {
    state.position = start + match.index + match[0].length - 1;
    throwError(state, "the stream contains non-printable characters");
  }
}
function readTagProperty(state, props, inFlow) {
  if (state.input.charCodeAt(state.position) !== 33)
    return false;
  if (props.tagStart !== NO_RANGE$1)
    throwError(state, "duplication of a tag property");
  const start = state.position;
  let isVerbatim = false;
  let isNamed = false;
  let tagHandle = "!";
  let ch = state.input.charCodeAt(++state.position);
  if (ch === 60) {
    isVerbatim = true;
    ch = state.input.charCodeAt(++state.position);
  } else if (ch === 33) {
    isNamed = true;
    tagHandle = "!!";
    ch = state.input.charCodeAt(++state.position);
  }
  let suffixStart = state.position;
  let tagName;
  if (isVerbatim) {
    while (ch !== 0 && ch !== 62)
      ch = state.input.charCodeAt(++state.position);
    if (ch !== 62)
      throwError(state, "unexpected end of the stream within a verbatim tag");
    tagName = state.input.slice(suffixStart, state.position);
    state.position++;
  } else {
    while (ch !== 0 && !isWsOrEol(ch) && !(inFlow && isFlowIndicator(ch))) {
      if (ch === 33) {
        if (!isNamed) {
          tagHandle = state.input.slice(suffixStart - 1, state.position + 1);
          if (!PATTERN_TAG_HANDLE.test(tagHandle))
            throwError(state, "named tag handle cannot contain such characters");
          isNamed = true;
          suffixStart = state.position + 1;
        } else
          throwError(state, "tag suffix cannot contain exclamation marks");
      }
      ch = state.input.charCodeAt(++state.position);
    }
    tagName = state.input.slice(suffixStart, state.position);
    if (PATTERN_FLOW_INDICATORS.test(tagName))
      throwError(state, "tag suffix cannot contain flow indicator characters");
  }
  if (tagName && !(isVerbatim ? PATTERN_TAG_URI.test(tagName) : PATTERN_TAG_SUFFIX.test(tagName)))
    throwError(state, `tag name cannot contain such characters: ${tagName}`);
  if (!isVerbatim && tagHandle !== "!" && tagHandle !== "!!" && !HAS_OWN.call(state.tagHandlers, tagHandle))
    throwError(state, `undeclared tag handle "${tagHandle}"`);
  props.tagStart = start;
  props.tagEnd = state.position;
  return true;
}
function readAnchorProperty(state, props) {
  if (state.input.charCodeAt(state.position) !== 38)
    return false;
  if (props.anchorStart !== NO_RANGE$1)
    throwError(state, "duplication of an anchor property");
  state.position++;
  const start = state.position;
  while (state.input.charCodeAt(state.position) !== 0 && !isWsOrEol(state.input.charCodeAt(state.position)) && !isFlowIndicator(state.input.charCodeAt(state.position)))
    state.position++;
  if (state.position === start)
    throwError(state, "name of an anchor node must contain at least one character");
  props.anchorStart = start;
  props.anchorEnd = state.position;
  return true;
}
function readAlias(state, props) {
  if (state.input.charCodeAt(state.position) !== 42)
    return false;
  if (props.anchorStart !== NO_RANGE$1 || props.tagStart !== NO_RANGE$1)
    throwError(state, "alias node should not have any properties");
  state.position++;
  const start = state.position;
  while (state.input.charCodeAt(state.position) !== 0 && !isWsOrEol(state.input.charCodeAt(state.position)) && !isFlowIndicator(state.input.charCodeAt(state.position)))
    state.position++;
  if (state.position === start)
    throwError(state, "name of an alias node must contain at least one character");
  addAliasEvent(state, start, state.position);
  return true;
}
function readFlowScalarBreak(state, nodeIndent) {
  skipSeparationSpace(state, false);
  if (state.lineIndent < nodeIndent)
    throwError(state, "deficient indentation");
}
function readSingleQuotedScalar(state, nodeIndent, props) {
  if (state.input.charCodeAt(state.position) !== 39)
    return false;
  state.position++;
  const start = state.position;
  let simple = true;
  while (state.input.charCodeAt(state.position) !== 0) {
    const ch = state.input.charCodeAt(state.position);
    if (ch === 39) {
      if (state.input.charCodeAt(state.position + 1) === 39) {
        simple = false;
        state.position += 2;
        continue;
      }
      const end = state.position;
      state.position++;
      addScalarEvent(state, start, end, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, SCALAR_STYLE.SINGLE_QUOTED, CHOMPING_MODE.CLIP, -1, simple);
      return true;
    }
    if (isEol(ch)) {
      simple = false;
      readFlowScalarBreak(state, nodeIndent);
    } else if (state.position === state.lineStart && testDocumentSeparator(state))
      throwError(state, "unexpected end of the document within a single quoted scalar");
    else if (ch !== 9 && ch < 32)
      throwError(state, "expected valid JSON character");
    else
      state.position++;
  }
  throwError(state, "unexpected end of the stream within a single quoted scalar");
}
function readDoubleQuotedScalar(state, nodeIndent, props) {
  if (state.input.charCodeAt(state.position) !== 34)
    return false;
  state.position++;
  const start = state.position;
  let simple = true;
  while (state.input.charCodeAt(state.position) !== 0) {
    const ch = state.input.charCodeAt(state.position);
    if (ch === 34) {
      const end = state.position;
      state.position++;
      addScalarEvent(state, start, end, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, SCALAR_STYLE.DOUBLE_QUOTED, CHOMPING_MODE.CLIP, -1, simple);
      return true;
    }
    if (ch === 92) {
      simple = false;
      const escaped = state.input.charCodeAt(++state.position);
      if (isEol(escaped))
        readFlowScalarBreak(state, nodeIndent);
      else if (isSimpleEscape(escaped))
        state.position++;
      else {
        let hexLength = escapedHexLen(escaped);
        if (hexLength === 0)
          throwError(state, "unknown escape sequence");
        while (hexLength-- > 0) {
          state.position++;
          if (fromHexCode(state.input.charCodeAt(state.position)) < 0)
            throwError(state, "expected hexadecimal character");
        }
        state.position++;
      }
    } else if (isEol(ch)) {
      simple = false;
      readFlowScalarBreak(state, nodeIndent);
    } else if (state.position === state.lineStart && testDocumentSeparator(state))
      throwError(state, "unexpected end of the document within a double quoted scalar");
    else if (ch !== 9 && ch < 32)
      throwError(state, "expected valid JSON character");
    else
      state.position++;
  }
  throwError(state, "unexpected end of the stream within a double quoted scalar");
}
function readBlockScalar(state, parentIndent, props) {
  const ch = state.input.charCodeAt(state.position);
  let chomping = CHOMPING_MODE.CLIP;
  let indent = -1;
  let detectedIndent = false;
  if (ch !== 124 && ch !== 62)
    return false;
  const style = ch === 124 ? SCALAR_STYLE.LITERAL_BLOCK : SCALAR_STYLE.FOLDED_BLOCK;
  state.position++;
  while (state.input.charCodeAt(state.position) !== 0) {
    const current = state.input.charCodeAt(state.position);
    const digit = fromDecimalCode(current);
    if (current === 43 || current === 45) {
      if (chomping !== CHOMPING_MODE.CLIP)
        throwError(state, "repeat of a chomping mode identifier");
      chomping = current === 43 ? CHOMPING_MODE.KEEP : CHOMPING_MODE.STRIP;
      state.position++;
    } else if (digit >= 0) {
      if (digit === 0)
        throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
      if (detectedIndent)
        throwError(state, "repeat of an indentation width identifier");
      indent = parentIndent + digit - 1;
      detectedIndent = true;
      state.position++;
    } else
      break;
  }
  let hadWhitespace = false;
  while (isWhiteSpace2(state.input.charCodeAt(state.position))) {
    hadWhitespace = true;
    state.position++;
  }
  if (hadWhitespace && state.input.charCodeAt(state.position) === 35)
    skipUntilLineEnd(state);
  if (isEol(state.input.charCodeAt(state.position)))
    consumeLineBreak(state);
  else if (state.input.charCodeAt(state.position) !== 0)
    throwError(state, "a line break is expected");
  let contentIndent = detectedIndent ? indent : -1;
  let maxLeadingIndent = 0;
  const valueStart = state.position;
  let valueEnd = state.position;
  while (state.input.charCodeAt(state.position) !== 0) {
    const linePosition = state.position;
    let column = 0;
    while (state.input.charCodeAt(linePosition + column) === 32)
      column++;
    const first = state.input.charCodeAt(linePosition + column);
    if (first === 0) {
      if (contentIndent >= 0) {
        if (column > contentIndent)
          valueEnd = linePosition + column;
      } else if (column > 0)
        valueEnd = linePosition + column;
      break;
    }
    if (testDocumentBoundary(state))
      break;
    if (!detectedIndent && contentIndent === -1 && isEol(first))
      maxLeadingIndent = Math.max(maxLeadingIndent, column);
    if (!detectedIndent && contentIndent === -1 && !isEol(first)) {
      if (first === 9 && column < parentIndent) {
        state.position = linePosition + column;
        throwError(state, "tab characters must not be used in indentation");
      }
      if (column >= parentIndent && column < maxLeadingIndent) {
        state.position = linePosition + column;
        throwError(state, "bad indentation of a mapping entry");
      }
    }
    if (contentIndent === -1 && first !== 0 && !isEol(first) && column < parentIndent) {
      state.lineIndent = column;
      state.position = linePosition + column;
      break;
    }
    if (!detectedIndent && first !== 0 && !isEol(first) && contentIndent === -1)
      contentIndent = column;
    const requiredIndent = contentIndent === -1 ? parentIndent + 1 : contentIndent;
    if (first !== 0 && !isEol(first) && column < requiredIndent) {
      state.lineIndent = column;
      state.position = linePosition + column;
      break;
    }
    skipUntilLineEnd(state);
    valueEnd = state.position;
    if (isEol(state.input.charCodeAt(state.position))) {
      consumeLineBreak(state);
      valueEnd = state.position;
    }
  }
  checkPrintable(state, valueStart, valueEnd);
  addScalarEvent(state, valueStart, valueEnd, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, style, chomping, contentIndent);
  return true;
}
function canStartPlainScalar(state, nodeContext) {
  const ch = state.input.charCodeAt(state.position);
  const inFlow = nodeContext === CONTEXT_FLOW_IN;
  if (ch === 0 || isWsOrEol(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96 || isFlowIndicator(ch))
    return false;
  if (ch === 63 || ch === 45) {
    const following = state.input.charCodeAt(state.position + 1);
    if (isWsOrEolOrEnd(following) || inFlow && isFlowIndicator(following))
      return false;
  }
  return true;
}
function readPlainScalar(state, nodeIndent, nodeContext, props) {
  if (!canStartPlainScalar(state, nodeContext))
    return false;
  const start = state.position;
  let end = state.position;
  let ch = state.input.charCodeAt(state.position);
  const inFlow = nodeContext === CONTEXT_FLOW_IN;
  let multiline = false;
  while (ch !== 0) {
    if (testDocumentBoundary(state))
      break;
    if (ch === 58) {
      const following = state.input.charCodeAt(state.position + 1);
      if (isWsOrEolOrEnd(following) || inFlow && isFlowIndicator(following))
        break;
    } else if (ch === 35) {
      if (isWsOrEol(state.input.charCodeAt(state.position - 1)))
        break;
    } else if (inFlow && isFlowIndicator(ch))
      break;
    else if (isEol(ch)) {
      const savedPosition = state.position;
      const savedLine = state.line;
      const savedLineStart = state.lineStart;
      const savedLineIndent = state.lineIndent;
      skipSeparationSpace(state, false);
      if (state.lineIndent >= nodeIndent) {
        multiline = true;
        ch = state.input.charCodeAt(state.position);
        continue;
      }
      state.position = savedPosition;
      state.line = savedLine;
      state.lineStart = savedLineStart;
      state.lineIndent = savedLineIndent;
      break;
    }
    if (!isWhiteSpace2(ch))
      end = state.position + 1;
    ch = state.input.charCodeAt(++state.position);
  }
  if (end === start)
    return false;
  checkPrintable(state, start, end);
  addScalarEvent(state, start, end, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, SCALAR_STYLE.PLAIN, CHOMPING_MODE.CLIP, -1, !multiline);
  return true;
}
function skipFlowSeparationSpace(state, nodeIndent) {
  const startLine = state.line;
  skipSeparationSpace(state, true);
  if (state.line > startLine && state.lineIndent < nodeIndent || state.firstTabInLine !== -1 && state.lineIndent < nodeIndent)
    throwError(state, "deficient indentation");
}
function readFlowCollection(state, nodeIndent, props) {
  const ch = state.input.charCodeAt(state.position);
  const isMapping = ch === 123;
  const start = state.position;
  let readNext = true;
  if (ch !== 91 && ch !== 123)
    return false;
  const terminator = isMapping ? 125 : 93;
  if (isMapping)
    addMappingEvent(state, start, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, COLLECTION_STYLE.FLOW);
  else
    addSequenceEvent(state, start, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, COLLECTION_STYLE.FLOW);
  state.position++;
  while (state.input.charCodeAt(state.position) !== 0) {
    skipFlowSeparationSpace(state, nodeIndent);
    let ch = state.input.charCodeAt(state.position);
    if (ch === terminator) {
      state.position++;
      addPopEvent(state);
      return true;
    } else if (!readNext)
      throwError(state, "missed comma between flow collection entries");
    else if (ch === 44)
      throwError(state, "expected the node content, but found ','");
    let isPair = false;
    let isExplicitPair = false;
    if (ch === 63 && isWsOrEol(state.input.charCodeAt(state.position + 1))) {
      isPair = isExplicitPair = true;
      state.position += 1;
      skipFlowSeparationSpace(state, nodeIndent);
    }
    const entryLine = state.line;
    const entryStart = snapshotState(state);
    const keyWasRead = parseNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
    skipFlowSeparationSpace(state, nodeIndent);
    ch = state.input.charCodeAt(state.position);
    if ((isMapping || isExplicitPair || state.line === entryLine) && ch === 58) {
      isPair = true;
      state.position++;
      skipFlowSeparationSpace(state, nodeIndent);
      if (!isMapping) {
        insertFlowPairMappingEvent(state, entryStart);
        if (!keyWasRead)
          addEmptyScalarEvent(state);
      } else if (!keyWasRead)
        addEmptyScalarEvent(state);
      if (!parseNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true))
        addEmptyScalarEvent(state);
      skipFlowSeparationSpace(state, nodeIndent);
      if (!isMapping)
        addPopEvent(state);
    } else if (isMapping && isPair) {
      if (!keyWasRead)
        addEmptyScalarEvent(state);
      addEmptyScalarEvent(state);
    } else if (isMapping)
      addEmptyScalarEvent(state);
    else if (isPair) {
      insertFlowPairMappingEvent(state, entryStart);
      if (!keyWasRead)
        addEmptyScalarEvent(state);
      addEmptyScalarEvent(state);
      addPopEvent(state);
    }
    ch = state.input.charCodeAt(state.position);
    if (ch === 44) {
      readNext = true;
      state.position++;
    } else
      readNext = false;
  }
  throwError(state, "unexpected end of the stream within a flow collection");
}
function readBlockSequence(state, nodeIndent, props) {
  if (state.firstTabInLine !== -1 || state.input.charCodeAt(state.position) !== 45 || !isWsOrEolOrEnd(state.input.charCodeAt(state.position + 1)))
    return false;
  addSequenceEvent(state, state.position, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, COLLECTION_STYLE.BLOCK);
  while (state.input.charCodeAt(state.position) === 45 && isWsOrEolOrEnd(state.input.charCodeAt(state.position + 1))) {
    if (state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, "tab characters must not be used in indentation");
    }
    const entryLine = state.line;
    state.position++;
    const hadBreak = skipSeparationSpace(state, true) > 0;
    if (state.firstTabInLine !== -1 && state.input.charCodeAt(state.position) === 45 && isWsOrEolOrEnd(state.input.charCodeAt(state.position + 1)))
      throwError(state, "bad indentation of a sequence entry");
    if (hadBreak && state.lineIndent <= nodeIndent)
      addEmptyScalarEvent(state);
    else
      parseNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
    skipSeparationSpace(state, true);
    if (state.lineIndent < nodeIndent || state.position >= state.length)
      break;
    if (state.lineIndent > nodeIndent)
      throwError(state, "bad indentation of a sequence entry");
    if (state.line === entryLine && state.input.charCodeAt(state.position) === 45 && isWsOrEolOrEnd(state.input.charCodeAt(state.position + 1)))
      throwError(state, "bad indentation of a sequence entry");
  }
  addPopEvent(state);
  return true;
}
function readBlockMapping(state, nodeIndent, flowIndent, props) {
  let atExplicitKey = false;
  let detected = false;
  let mappingOpened = false;
  let pendingExplicitKey = false;
  if (state.firstTabInLine !== -1)
    return false;
  let ch = state.input.charCodeAt(state.position);
  while (ch !== 0) {
    if (!atExplicitKey && state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, "tab characters must not be used in indentation");
    }
    const following = state.input.charCodeAt(state.position + 1);
    const entryLine = state.line;
    if ((ch === 63 || ch === 58) && isWsOrEolOrEnd(following)) {
      if (!mappingOpened) {
        addMappingEvent(state, state.position, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, COLLECTION_STYLE.BLOCK);
        mappingOpened = true;
      }
      if (ch === 63) {
        if (atExplicitKey)
          addEmptyScalarEvent(state);
        detected = true;
        atExplicitKey = true;
      } else if (atExplicitKey)
        atExplicitKey = false;
      else {
        addEmptyScalarEvent(state);
        detected = true;
        atExplicitKey = false;
      }
      state.position += 1;
      pendingExplicitKey = true;
    } else {
      if (atExplicitKey) {
        addEmptyScalarEvent(state);
        atExplicitKey = false;
      }
      const beforeKey = snapshotState(state);
      if (!parseNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true))
        break;
      if (state.line === entryLine) {
        ch = state.input.charCodeAt(state.position);
        while (isWhiteSpace2(ch))
          ch = state.input.charCodeAt(++state.position);
        if (ch === 58) {
          ch = state.input.charCodeAt(++state.position);
          if (!isWsOrEolOrEnd(ch))
            throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
          if (!mappingOpened) {
            state.events.splice(beforeKey.eventsLength, 0, {
              type: EVENT_ID.MAPPING,
              start: beforeKey.position,
              anchorStart: props.anchorStart,
              anchorEnd: props.anchorEnd,
              tagStart: props.tagStart,
              tagEnd: props.tagEnd,
              style: COLLECTION_STYLE.BLOCK
            });
            mappingOpened = true;
          }
          detected = true;
          atExplicitKey = false;
          pendingExplicitKey = false;
        } else if (detected)
          throwError(state, "expected ':' after a mapping key");
        else {
          if (props.anchorStart !== NO_RANGE$1 || props.tagStart !== NO_RANGE$1) {
            restoreState(state, beforeKey);
            return false;
          }
          return true;
        }
      } else if (detected)
        throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
      else {
        if (props.anchorStart !== NO_RANGE$1 || props.tagStart !== NO_RANGE$1) {
          restoreState(state, beforeKey);
          return false;
        }
        return true;
      }
    }
    if (parseNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, pendingExplicitKey))
      pendingExplicitKey = false;
    if (!atExplicitKey) {
      if (pendingExplicitKey) {
        addEmptyScalarEvent(state);
        pendingExplicitKey = false;
      }
    }
    skipSeparationSpace(state, true);
    ch = state.input.charCodeAt(state.position);
    if ((state.line === entryLine || state.lineIndent > nodeIndent) && ch !== 0)
      throwError(state, "bad indentation of a mapping entry");
    else if (state.lineIndent < nodeIndent)
      break;
  }
  if (!detected)
    return false;
  if (atExplicitKey)
    addEmptyScalarEvent(state);
  if (mappingOpened)
    addPopEvent(state);
  return true;
}
function parseNode(state, parentIndent, nodeContext, allowToSeek, allowCompact, allowPropertyMapping = true) {
  if (state.depth >= state.maxDepth)
    throwError(state, `nesting exceeded maxDepth (${state.maxDepth})`);
  state.depth++;
  let indentStatus = 1;
  let atNewLine = false;
  let hasContent = false;
  let propertyStart = null;
  const props = emptyProperties();
  let allowBlockScalars = nodeContext === CONTEXT_BLOCK_OUT || nodeContext === CONTEXT_BLOCK_IN;
  let allowBlockCollections = allowBlockScalars;
  const allowBlockStyles = allowBlockScalars;
  if (allowToSeek && skipSeparationSpace(state, true)) {
    atNewLine = true;
    if (state.lineIndent > parentIndent)
      indentStatus = 1;
    else if (state.lineIndent === parentIndent)
      indentStatus = 0;
    else
      indentStatus = -1;
  }
  if (indentStatus === 1)
    while (true) {
      const ch = state.input.charCodeAt(state.position);
      const propertyState = snapshotState(state);
      if (atNewLine && indentStatus !== 1 && (ch === 33 || ch === 38))
        break;
      if (atNewLine && allowBlockStyles && (props.tagStart !== NO_RANGE$1 || props.anchorStart !== NO_RANGE$1) && (ch === 33 || ch === 38)) {
        const fallbackState = snapshotState(state);
        const flowIndent = parentIndent + 1;
        if (readBlockMapping(state, state.position - state.lineStart, flowIndent, props) && state.events[fallbackState.eventsLength]?.type === EVENT_ID.MAPPING) {
          state.depth--;
          return true;
        }
        restoreState(state, fallbackState);
      }
      if (atNewLine && (ch === 33 && props.tagStart !== NO_RANGE$1 || ch === 38 && props.anchorStart !== NO_RANGE$1))
        break;
      if (!readTagProperty(state, props, nodeContext === CONTEXT_FLOW_IN) && !readAnchorProperty(state, props))
        break;
      if (propertyStart === null)
        propertyStart = propertyState;
      if (skipSeparationSpace(state, true)) {
        atNewLine = true;
        allowBlockCollections = allowBlockStyles;
        if (state.lineIndent > parentIndent)
          indentStatus = 1;
        else if (state.lineIndent === parentIndent)
          indentStatus = 0;
        else
          indentStatus = -1;
      } else
        allowBlockCollections = false;
    }
  if (allowBlockCollections)
    allowBlockCollections = atNewLine || allowCompact;
  if (indentStatus === 1 || nodeContext === CONTEXT_BLOCK_OUT) {
    const flowIndent = nodeContext === CONTEXT_FLOW_IN || nodeContext === CONTEXT_FLOW_OUT ? parentIndent : parentIndent + 1;
    const blockIndent = state.position - state.lineStart;
    if (indentStatus === 1) {
      if (allowBlockCollections && (readBlockSequence(state, blockIndent, props) || readBlockMapping(state, blockIndent, flowIndent, props)) || readFlowCollection(state, flowIndent, props))
        hasContent = true;
      else {
        const ch = state.input.charCodeAt(state.position);
        if (propertyStart !== null && allowPropertyMapping && allowBlockStyles && !allowBlockCollections && ch !== 124 && ch !== 62) {
          const fallbackState = snapshotState(state);
          const propertyIndent = propertyStart.position - propertyStart.lineStart;
          restoreState(state, propertyStart);
          if (readBlockMapping(state, propertyIndent, flowIndent, emptyProperties()) && state.events[fallbackState.eventsLength]?.type === EVENT_ID.MAPPING)
            hasContent = true;
          else
            restoreState(state, fallbackState);
        }
        if (!hasContent && (allowBlockScalars && readBlockScalar(state, flowIndent, props) || readSingleQuotedScalar(state, flowIndent, props) || readDoubleQuotedScalar(state, flowIndent, props) || readAlias(state, props) || readPlainScalar(state, flowIndent, nodeContext, props)))
          hasContent = true;
      }
    } else if (indentStatus === 0)
      hasContent = allowBlockCollections && readBlockSequence(state, blockIndent, props);
  }
  allowBlockScalars = allowBlockScalars && !hasContent;
  if (!hasContent && (props.anchorStart !== NO_RANGE$1 || props.tagStart !== NO_RANGE$1 || allowBlockScalars)) {
    addScalarEvent(state, NO_RANGE$1, NO_RANGE$1, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, SCALAR_STYLE.PLAIN);
    hasContent = true;
  }
  state.depth--;
  return hasContent || props.anchorStart !== NO_RANGE$1 || props.tagStart !== NO_RANGE$1;
}
function readDirective(state) {
  if (state.lineIndent > 0 || state.input.charCodeAt(state.position) !== 37)
    return false;
  state.position++;
  const nameStart = state.position;
  while (state.input.charCodeAt(state.position) !== 0 && !isWsOrEol(state.input.charCodeAt(state.position)))
    state.position++;
  const name = state.input.slice(nameStart, state.position);
  const args = [];
  if (name.length === 0)
    throwError(state, "directive name must not be less than one character in length");
  while (state.input.charCodeAt(state.position) !== 0 && !isEol(state.input.charCodeAt(state.position))) {
    while (isWhiteSpace2(state.input.charCodeAt(state.position)))
      state.position++;
    if (state.input.charCodeAt(state.position) === 35 || isEol(state.input.charCodeAt(state.position)) || state.input.charCodeAt(state.position) === 0)
      break;
    const start = state.position;
    while (state.input.charCodeAt(state.position) !== 0 && !isWsOrEol(state.input.charCodeAt(state.position)))
      state.position++;
    args.push(state.input.slice(start, state.position));
  }
  if (isEol(state.input.charCodeAt(state.position)))
    consumeLineBreak(state);
  if (name === "YAML") {
    if (state.directives.some((directive) => directive.kind === "yaml"))
      throwError(state, "duplication of %YAML directive");
    if (args.length !== 1)
      throwError(state, "YAML directive accepts exactly one argument");
    const match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
    if (match === null)
      throwError(state, "ill-formed argument of the YAML directive");
    if (parseInt(match[1], 10) !== 1)
      throwError(state, "unacceptable YAML version of the document");
    state.directives.push({
      kind: "yaml",
      version: args[0]
    });
  } else if (name === "TAG") {
    if (args.length !== 2)
      throwError(state, "TAG directive accepts exactly two arguments");
    const [handle, prefix] = args;
    if (!PATTERN_TAG_HANDLE.test(handle))
      throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
    if (HAS_OWN.call(state.tagHandlers, handle))
      throwError(state, `there is a previously declared suffix for "${handle}" tag handle`);
    if (!PATTERN_TAG_PREFIX.test(prefix))
      throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
    state.tagHandlers[handle] = prefix;
    state.directives.push({
      kind: "tag",
      handle,
      prefix
    });
  }
  return true;
}
function readDocument(state) {
  state.directives = [];
  state.tagHandlers = Object.create(null);
  let hasDirectives = false;
  skipSeparationSpace(state, true);
  while (readDirective(state)) {
    hasDirectives = true;
    skipSeparationSpace(state, true);
  }
  let explicitStart = false;
  let explicitEnd = false;
  let allowCompact = true;
  if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45 && isWsOrEolOrEnd(state.input.charCodeAt(state.position + 3))) {
    explicitStart = true;
    const markerLine = state.line;
    state.position += 3;
    skipSeparationSpace(state, true);
    allowCompact = state.line > markerLine;
  } else if (hasDirectives)
    throwError(state, "directives end mark is expected");
  const documentEventIndex = state.events.length;
  if (!explicitStart && state.position === state.lineStart && state.input.charCodeAt(state.position) === 46 && testDocumentSeparator(state)) {
    state.position += 3;
    skipSeparationSpace(state, true);
    return;
  }
  addDocumentEvent(state, explicitStart, false);
  if (!parseNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, allowCompact, allowCompact))
    addEmptyScalarEvent(state);
  skipSeparationSpace(state, true);
  if (state.position === state.lineStart && testDocumentSeparator(state)) {
    explicitEnd = state.input.charCodeAt(state.position) === 46;
    if (explicitEnd) {
      const markerLine = state.line;
      state.position += 3;
      skipSeparationSpace(state, true);
      if (state.line === markerLine && state.position < state.length)
        throwError(state, "end of the stream or a document separator is expected");
    }
  }
  const documentEvent = state.events[documentEventIndex];
  if (documentEvent?.type === EVENT_ID.DOCUMENT)
    documentEvent.explicitEnd = explicitEnd;
  addPopEvent(state);
  if (!explicitEnd && state.position < state.length && !testDocumentBoundary(state))
    throwError(state, "end of the stream or a document separator is expected");
}
function parseEvents(input, options) {
  const length = input.length;
  const state = {
    ...DEFAULT_PARSER_OPTIONS,
    ...options,
    input: `${input}\x00`,
    length,
    position: 0,
    line: 0,
    lineStart: 0,
    lineIndent: 0,
    firstTabInLine: -1,
    depth: 0,
    directives: [],
    tagHandlers: Object.create(null),
    events: []
  };
  const nullpos = input.indexOf("\x00");
  if (nullpos !== -1)
    YAMLException.throwAt(input, nullpos, "null byte is not allowed in input", state.filename);
  while (state.position < state.length) {
    skipByteOrderMark(state);
    skipSeparationSpace(state, true);
    if (state.position >= state.length)
      break;
    const documentStart = state.position;
    readDocument(state);
    if (state.position === documentStart)
      throwError(state, "can not read a document");
  }
  return state.events;
}
var DEFAULT_LOAD_OPTIONS = {
  ...DEFAULT_PARSER_OPTIONS,
  ...DEFAULT_CONSTRUCTOR_OPTIONS
};
function loadDocuments(input, options = {}) {
  const opts = {
    ...DEFAULT_LOAD_OPTIONS,
    ...options
  };
  const source = String(input);
  const PARSER_OPT_KEYS = Object.keys(DEFAULT_PARSER_OPTIONS);
  const CONSTRUCTOR_OPT_KEYS = Object.keys(DEFAULT_CONSTRUCTOR_OPTIONS);
  return constructFromEvents(parseEvents(source, pick(opts, PARSER_OPT_KEYS)), {
    ...pick(opts, CONSTRUCTOR_OPT_KEYS),
    source
  });
}
function loadAll(input, iteratorOrOptions, options) {
  let iterator = null;
  if (typeof iteratorOrOptions === "function")
    iterator = iteratorOrOptions;
  else if (iteratorOrOptions !== null && typeof iteratorOrOptions === "object")
    options = iteratorOrOptions;
  const documents = loadDocuments(input, options);
  if (iterator === null)
    return documents;
  for (const document2 of documents)
    iterator(document2);
}
var INVALID = Symbol("INVALID");
function buildRepresentTypes(schema) {
  const defaultTags = new Set([
    schema.defaultScalarTag,
    schema.defaultSequenceTag,
    schema.defaultMappingTag
  ].filter((t) => t !== undefined));
  const implicitScalars = schema.implicitScalarTags;
  const explicitTags = schema.tags.filter((t) => !(t.nodeKind === "scalar" && t.implicit) && !defaultTags.has(t));
  const defaultTagsLast = schema.tags.filter((t) => defaultTags.has(t));
  return [
    ...implicitScalars.map((tag) => ({
      tag,
      implicitTag: true
    })),
    ...explicitTags.map((tag) => ({
      tag,
      implicitTag: false
    })),
    ...defaultTagsLast.map((tag) => ({
      tag,
      implicitTag: true
    }))
  ];
}
function matchTag(state, object) {
  for (let index = 0, length = state.representTypes.length;index < length; index += 1) {
    const { tag, implicitTag } = state.representTypes[index];
    if (tag.identify(object)) {
      let tagName;
      if (tag.matchByTagPrefix)
        tagName = tag.representTagName(object);
      else
        tagName = tag.tagName;
      return {
        tag,
        tagName,
        implicitTag
      };
    }
  }
  return null;
}
function build(state, object) {
  if (!state.noRefs && object !== null && typeof object === "object") {
    const existing = state.refs.get(object);
    if (existing) {
      if (existing.anchor === undefined)
        existing.anchor = `ref_${state.refCounter++}`;
      return {
        kind: "alias",
        anchor: existing.anchor
      };
    }
  }
  const matched = matchTag(state, object);
  if (!matched) {
    if (object === undefined)
      return INVALID;
    if (state.skipInvalid)
      return INVALID;
    throw new YAMLException(`unacceptable kind of an object to dump ${Object.prototype.toString.call(object)}`);
  }
  const { tag, tagName, implicitTag } = matched;
  const nodeTagName = implicitTag ? tagName : tagNameShort(tagName);
  if (tag.nodeKind === "scalar")
    return {
      kind: "scalar",
      tag: nodeTagName,
      tagged: !implicitTag,
      style: SCALAR_STYLE.PLAIN,
      value: tag.represent(object)
    };
  if (tag.nodeKind === "sequence") {
    const container = tag.represent(object);
    const node = {
      kind: "sequence",
      tag: nodeTagName,
      tagged: !implicitTag,
      style: COLLECTION_STYLE.BLOCK,
      items: []
    };
    if (!state.noRefs)
      state.refs.set(object, node);
    for (let index = 0, length = container.length;index < length; index += 1) {
      let item = build(state, container[index]);
      if (item === INVALID && container[index] === undefined)
        item = build(state, null);
      if (item === INVALID)
        continue;
      node.items.push(item);
    }
    return node;
  }
  const map = tag.represent(object);
  const node = {
    kind: "mapping",
    tag: nodeTagName,
    tagged: !implicitTag,
    style: COLLECTION_STYLE.BLOCK,
    items: []
  };
  if (!state.noRefs)
    state.refs.set(object, node);
  for (const [objectKey, objectValue] of map) {
    const key = build(state, objectKey);
    if (key === INVALID)
      continue;
    const value = build(state, objectValue);
    if (value === INVALID)
      continue;
    node.items.push({
      key,
      value
    });
  }
  return node;
}
function jsToAst(input, schema, options = {}) {
  const root = build({
    representTypes: buildRepresentTypes(schema),
    noRefs: options.noRefs ?? false,
    skipInvalid: options.skipInvalid ?? false,
    refs: /* @__PURE__ */ new Map,
    refCounter: 0
  }, input);
  return [{
    contents: root === INVALID ? null : root,
    directives: []
  }];
}
var VISIT_BREAK = Symbol("visit:break");
var VISIT_SKIP = Symbol("visit:skip");
function visitNode(node, visitor, ctx) {
  const control = visitor(node, ctx);
  if (control === VISIT_BREAK)
    return true;
  if (control === VISIT_SKIP)
    return false;
  const depth = ctx.depth + 1;
  switch (node.kind) {
    case "sequence":
      for (const item of node.items)
        if (visitNode(item, visitor, {
          depth,
          parent: node,
          isKey: false
        }))
          return true;
      break;
    case "mapping":
      for (const { key, value } of node.items) {
        if (visitNode(key, visitor, {
          depth,
          parent: node,
          isKey: true
        }))
          return true;
        if (visitNode(value, visitor, {
          depth,
          parent: node,
          isKey: false
        }))
          return true;
      }
  }
  return false;
}
function visit(documents, visitor) {
  for (const doc of documents)
    if (doc.contents && visitNode(doc.contents, visitor, {
      depth: 0,
      parent: null,
      isKey: false
    }))
      return;
}
function hasBit(mask, bit) {
  return (mask & 1 << bit) !== 0;
}
var DEFAULT_SCALAR_STYLE_RULES = {
  applyQuoteFlowKeysOption,
  doubleQuoteForInvisibles,
  doubleQuoteWhitespaceOnly,
  applyForceQuotesOption,
  tryLongOrMultilineAsBlock,
  quoteInvalidPlain,
  fallbackToDoubleQuoted
};
function _preferredQuotedStyle(layout) {
  if (layout.presenterOptions.quoteStyle === "single" && hasBit(layout.allowedStylesMask, SCALAR_STYLE.SINGLE_QUOTED))
    return SCALAR_STYLE.SINGLE_QUOTED;
  return SCALAR_STYLE.DOUBLE_QUOTED;
}
function applyQuoteFlowKeysOption(layout) {
  if (!layout.presenterOptions.quoteFlowKeys)
    return;
  if (!layout.isKey || !layout.flowOnly || layout.style !== SCALAR_STYLE.PLAIN)
    return;
  layout.style = SCALAR_STYLE.DOUBLE_QUOTED;
}
function doubleQuoteForInvisibles(layout) {
  if (layout.style === SCALAR_STYLE.PLAIN && /[\t\x7F-\xA0\u2028\u2029\uFEFF\uFFFE\uFFFF]/.test(layout.node.value))
    layout.style = SCALAR_STYLE.DOUBLE_QUOTED;
}
function doubleQuoteWhitespaceOnly(layout) {
  if (layout.style === SCALAR_STYLE.PLAIN && /^\s+$/.test(layout.node.value))
    layout.style = SCALAR_STYLE.DOUBLE_QUOTED;
}
function applyForceQuotesOption(layout) {
  if (!layout.presenterOptions.forceQuotes)
    return;
  if (layout.isKey || layout.style !== SCALAR_STYLE.PLAIN)
    return;
  if (layout.node.tag !== layout.presenterOptions.schema.defaultScalarTag.tagName)
    return;
  layout.style = layout.node.value.includes(`
`) ? SCALAR_STYLE.DOUBLE_QUOTED : _preferredQuotedStyle(layout);
}
function tryLongOrMultilineAsBlock(layout) {
  if (layout.style !== SCALAR_STYLE.PLAIN || layout.isKey)
    return;
  const value = layout.node.value;
  const multiline = value.indexOf(`
`) !== -1;
  if (!hasBit(layout.allowedStylesMask, SCALAR_STYLE.LITERAL_BLOCK)) {
    if (multiline)
      layout.style = SCALAR_STYLE.DOUBLE_QUOTED;
    return;
  }
  const w = layout.presenterOptions.lineWidth;
  if (w === -1) {
    if (multiline)
      layout.style = SCALAR_STYLE.LITERAL_BLOCK;
    return;
  }
  const availableWidth = Math.max(Math.min(w, 40), w - layout.shiftOfContent);
  let position = 0;
  let shouldFold = false;
  while (position <= value.length) {
    let lineEnd = value.length;
    const nextLineBreak = value.indexOf(`
`, position);
    if (nextLineBreak !== -1)
      lineEnd = nextLineBreak;
    const line = value.slice(position, lineEnd);
    if (line.length > availableWidth && line[0] !== " " && / [^ \t]/.test(line))
      shouldFold = true;
    if (nextLineBreak === -1)
      break;
    position = nextLineBreak + 1;
  }
  if (shouldFold)
    layout.style = SCALAR_STYLE.FOLDED_BLOCK;
  else if (multiline)
    layout.style = SCALAR_STYLE.LITERAL_BLOCK;
}
function quoteInvalidPlain(layout) {
  if (layout.style === SCALAR_STYLE.PLAIN && !hasBit(layout.allowedStylesMask, SCALAR_STYLE.PLAIN))
    layout.style = _preferredQuotedStyle(layout);
}
function fallbackToDoubleQuoted(layout) {
  if (!hasBit(layout.allowedStylesMask, layout.style))
    layout.style = SCALAR_STYLE.DOUBLE_QUOTED;
}
function setBit(mask, bit) {
  return mask | 1 << bit;
}
var SRC_C_PRINTABLE = "[\\x09\\x0A\\x0D\\x20-\\x7E\\x85\\xA0-\\uD7FF\\uE000-\\uFFFD\\u{10000}-\\u{10FFFF}]";
var SRC_B_CHAR = "[\\n\\r]";
var SRC_C_BYTE_ORDER_MARK = "\\uFEFF";
var SRC_S_WHITE = "[ \\t]";
var SRC_NB_CHAR = `(?:(?!(?:${SRC_B_CHAR}|${SRC_C_BYTE_ORDER_MARK}))${SRC_C_PRINTABLE})`;
var SRC_NS_CHAR = `(?:(?!${SRC_S_WHITE})${SRC_NB_CHAR})`;
var SRC_NB_JSON = "[\\x09\\x20-\\uD7FF\\uE000-\\uFFFF\\u{10000}-\\u{10FFFF}]";
var SRC_C_INDICATOR = "[-?:,\\[\\]{}#&*!|>'\"%@`]";
var SRC_C_FLOW_INDICATOR = "[,\\[\\]{}]";
var SRC_NS_PLAIN_SAFE_FLOW_OUT = SRC_NS_CHAR;
var SRC_NS_PLAIN_SAFE_FLOW_IN = `(?:(?!${SRC_C_FLOW_INDICATOR})${SRC_NS_CHAR})`;
var SRC_NS_PLAIN_FIRST_FLOW_OUT = `(?:(?:(?!${SRC_C_INDICATOR})${SRC_NS_CHAR})|[?:-](?=${SRC_NS_PLAIN_SAFE_FLOW_OUT}))`;
var SRC_NS_PLAIN_FIRST_FLOW_IN = `(?:(?:(?!${SRC_C_INDICATOR})${SRC_NS_CHAR})|[?:-](?=${SRC_NS_PLAIN_SAFE_FLOW_IN}))`;
var SRC_NS_PLAIN_CHAR_FLOW_OUT = `(?:(?:(?![:#])${SRC_NS_PLAIN_SAFE_FLOW_OUT})|:(?=${SRC_NS_PLAIN_SAFE_FLOW_OUT}))#*`;
var SRC_NS_PLAIN_CHAR_FLOW_IN = `(?:(?:(?![:#])${SRC_NS_PLAIN_SAFE_FLOW_IN})|:(?=${SRC_NS_PLAIN_SAFE_FLOW_IN}))#*`;
var SRC_NB_NS_PLAIN_IN_LINE_FLOW_OUT = `(?:${SRC_S_WHITE}*${SRC_NS_PLAIN_CHAR_FLOW_OUT})*`;
var SRC_NB_NS_PLAIN_IN_LINE_FLOW_IN = `(?:${SRC_S_WHITE}*${SRC_NS_PLAIN_CHAR_FLOW_IN})*`;
var SRC_NS_PLAIN_ONE_LINE_FLOW_OUT = `${SRC_NS_PLAIN_FIRST_FLOW_OUT}#*${SRC_NB_NS_PLAIN_IN_LINE_FLOW_OUT}`;
var SRC_NS_PLAIN_ONE_LINE_FLOW_IN = `${SRC_NS_PLAIN_FIRST_FLOW_IN}#*${SRC_NB_NS_PLAIN_IN_LINE_FLOW_IN}`;
var SRC_NS_PLAIN_ONE_LINE_BLOCK_KEY = SRC_NS_PLAIN_ONE_LINE_FLOW_OUT;
var SRC_NS_PLAIN_ONE_LINE_FLOW_KEY = SRC_NS_PLAIN_ONE_LINE_FLOW_IN;
var SRC_S_NS_PLAIN_NEXT_LINE_FLOW_OUT = `\\n+${SRC_NS_PLAIN_CHAR_FLOW_OUT}${SRC_NB_NS_PLAIN_IN_LINE_FLOW_OUT}`;
var SRC_S_NS_PLAIN_NEXT_LINE_FLOW_IN = `\\n+${SRC_NS_PLAIN_CHAR_FLOW_IN}${SRC_NB_NS_PLAIN_IN_LINE_FLOW_IN}`;
var SRC_NS_PLAIN_MULTI_LINE_FLOW_OUT = `${SRC_NS_PLAIN_ONE_LINE_FLOW_OUT}(?:${SRC_S_NS_PLAIN_NEXT_LINE_FLOW_OUT})*`;
var SRC_NS_PLAIN_MULTI_LINE_FLOW_IN = `${SRC_NS_PLAIN_ONE_LINE_FLOW_IN}(?:${SRC_S_NS_PLAIN_NEXT_LINE_FLOW_IN})*`;
var NS_PLAIN_FLOW_OUT = new RegExp(`^(?:${SRC_NS_PLAIN_MULTI_LINE_FLOW_OUT})$`, "u");
var NS_PLAIN_FLOW_IN = new RegExp(`^(?:${SRC_NS_PLAIN_MULTI_LINE_FLOW_IN})$`, "u");
var NS_PLAIN_BLOCK_KEY = new RegExp(`^(?:${SRC_NS_PLAIN_ONE_LINE_BLOCK_KEY})$`, "u");
var NS_PLAIN_FLOW_KEY = new RegExp(`^(?:${SRC_NS_PLAIN_ONE_LINE_FLOW_KEY})$`, "u");
var NB_SINGLE_ONE_LINE = new RegExp(`^(?:${SRC_NB_JSON})*$`, "u");
var NB_SINGLE_MULTI_LINE = new RegExp(`^(?:${SRC_NB_JSON}|\\n)*$`, "u");
var BLOCK_SCALAR_CONTENT = new RegExp(`^(?:${SRC_NB_CHAR}|\\n)*$`, "u");
var C_FORBIDDEN_FIRST_LINE = /^(?:---|\.\.\.)(?=$|[ \t\n\r])/;
var C_FORBIDDEN_CONTENT = /^(?:---|\.\.\.)(?=$|[ \t\n\r])/m;
function canUsePlain(layout) {
  const str = layout.node.value;
  if (str !== "") {
    if (!(layout.isKey ? layout.flowOnly ? NS_PLAIN_FLOW_KEY : NS_PLAIN_BLOCK_KEY : layout.flowOnly ? NS_PLAIN_FLOW_IN : NS_PLAIN_FLOW_OUT).test(str))
      return false;
    if (layout.shiftOfFirstLine === 0 && C_FORBIDDEN_FIRST_LINE.test(str))
      return false;
    if (layout.shiftOfContent === 0) {
      const firstLineBreak = str.indexOf(`
`);
      if (firstLineBreak !== -1) {
        const content = str.slice(firstLineBreak + 1);
        if (C_FORBIDDEN_CONTENT.test(content))
          return false;
      }
    }
  }
  const resolvedTag = layout.presenterOptions.schema.resolveImplicitScalarTag(str).tag.tagName;
  if (!layout.node.tagged && resolvedTag !== layout.node.tag)
    return false;
  if (!layout.node.tagged && str === "=" && resolvedTag === layout.presenterOptions.schema.defaultScalarTag.tagName)
    return false;
  return true;
}
function canUseSingleQuoted(layout) {
  const str = layout.node.value;
  if (!(layout.isKey ? NB_SINGLE_ONE_LINE : NB_SINGLE_MULTI_LINE).test(str))
    return false;
  if (/[ \t]\n|\n[ \t]/.test(str))
    return false;
  if (!layout.isKey && layout.shiftOfContent === 0) {
    const firstLineBreak = str.indexOf(`
`);
    if (firstLineBreak !== -1 && C_FORBIDDEN_CONTENT.test(str.slice(firstLineBreak + 1)))
      return false;
  }
  return true;
}
function canUseBlock(layout) {
  if (layout.flowOnly || !BLOCK_SCALAR_CONTENT.test(layout.node.value))
    return false;
  const contentIndent = layout.shiftOfContent - layout.shiftOfParent;
  if (contentIndent < 1)
    return false;
  if (contentIndent > 9 && /^\n* /.test(layout.node.value))
    return false;
  if (layout.shiftOfContent === 0 && C_FORBIDDEN_CONTENT.test(layout.node.value))
    return false;
  return true;
}
function detectAllowedStyles(layout) {
  let mask = setBit(0, SCALAR_STYLE.DOUBLE_QUOTED);
  if (canUsePlain(layout))
    mask = setBit(mask, SCALAR_STYLE.PLAIN);
  if (canUseSingleQuoted(layout))
    mask = setBit(mask, SCALAR_STYLE.SINGLE_QUOTED);
  if (canUseBlock(layout))
    mask = setBit(setBit(mask, SCALAR_STYLE.LITERAL_BLOCK), SCALAR_STYLE.FOLDED_BLOCK);
  layout.allowedStylesMask = mask;
}
function renderScalar(layout) {
  switch (layout.style) {
    case SCALAR_STYLE.PLAIN:
      return renderPlain(layout);
    case SCALAR_STYLE.SINGLE_QUOTED:
      return renderSingleQuoted(layout);
    case SCALAR_STYLE.LITERAL_BLOCK:
      return renderLiteralBlock(layout);
    case SCALAR_STYLE.FOLDED_BLOCK:
      return renderFoldedBlock(layout);
    case SCALAR_STYLE.DOUBLE_QUOTED:
      return renderDoubleQuoted(layout);
  }
}
function renderPlain(layout) {
  return encodeFlowBreaks(layout.node.value, layout.shiftOfContent);
}
function renderSingleQuoted(layout) {
  return `'${encodeFlowBreaks(layout.node.value, layout.shiftOfContent).replace(/'/g, "''")}'`;
}
function renderLiteralBlock(layout) {
  const value = layout.node.value;
  return "|" + blockHeader(value, layout.shiftOfParent, layout.shiftOfContent) + dropEndingNewline(indentString(value, layout.shiftOfContent));
}
function renderFoldedBlock(layout) {
  const value = layout.node.value;
  const w = layout.presenterOptions.lineWidth;
  let availableWidth = Infinity;
  if (w !== -1)
    availableWidth = Math.max(Math.min(w, 40), w - layout.shiftOfContent);
  return ">" + blockHeader(value, layout.shiftOfParent, layout.shiftOfContent) + dropEndingNewline(indentString(foldBlockScalar(value, availableWidth), layout.shiftOfContent));
}
function renderDoubleQuoted(layout) {
  return `"${escapeString(layout.node.value)}"`;
}
function encodeFlowBreaks(string, shiftOfContent) {
  let nextLF = string.indexOf(`
`);
  if (nextLF === -1)
    return string;
  const pad = " ".repeat(shiftOfContent);
  let result = string.slice(0, nextLF);
  const lineRe = /(\n+)([^\n]*)/g;
  lineRe.lastIndex = nextLF;
  let match;
  while (match = lineRe.exec(string)) {
    const breaks = match[1].length;
    const line = match[2];
    result += `
`.repeat(breaks + 1) + pad + line;
  }
  return result;
}
function indentString(string, spaces) {
  const indent = " ".repeat(spaces);
  let position = 0;
  let result = "";
  const length = string.length;
  while (position < length) {
    let line;
    const next = string.indexOf(`
`, position);
    if (next === -1) {
      line = string.slice(position);
      position = length;
    } else {
      line = string.slice(position, next + 1);
      position = next + 1;
    }
    if (line.length && line !== `
`)
      result += indent;
    result += line;
  }
  return result;
}
function needIndentIndicator(string) {
  return /^\n* /.test(string);
}
function blockHeader(string, shiftOfParent, shiftOfContent) {
  const indentIndicator = needIndentIndicator(string) ? String(shiftOfContent - shiftOfParent) : "";
  const clip = string[string.length - 1] === `
`;
  return `${indentIndicator}${clip && (string[string.length - 2] === `
` || string === `
`) ? "+" : clip ? "" : "-"}
`;
}
function dropEndingNewline(string) {
  return string[string.length - 1] === `
` ? string.slice(0, -1) : string;
}
function isMoreIndented(char) {
  return char === " " || char === "\t";
}
function foldLine(line, width) {
  if (line === "" || isMoreIndented(line[0]))
    return line;
  const breakRe = / [^ \t]/g;
  let match;
  let start = 0;
  let end;
  let curr = 0;
  let next = 0;
  let result = "";
  while (match = breakRe.exec(line)) {
    next = match.index;
    if (next - start > width) {
      end = curr > start ? curr : next;
      result += `
${line.slice(start, end)}`;
      start = end + 1;
    }
    curr = next;
  }
  result += `
`;
  if (line.length - start > width && curr > start)
    result += `${line.slice(start, curr)}
${line.slice(curr + 1)}`;
  else
    result += line.slice(start);
  return result.slice(1);
}
function foldBlockScalar(string, width) {
  const lineRe = /(\n+)([^\n]*)/g;
  let nextLF = string.indexOf(`
`);
  if (nextLF === -1)
    nextLF = string.length;
  lineRe.lastIndex = nextLF;
  let result = foldLine(string.slice(0, nextLF), width);
  let prevMoreIndented = string[0] === `
` || isMoreIndented(string[0]);
  let moreIndented;
  let match;
  while (match = lineRe.exec(string)) {
    const prefix = match[1];
    const line = match[2];
    moreIndented = line !== "" && isMoreIndented(line[0]);
    result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? `
` : "") + foldLine(line, width);
    prevMoreIndented = moreIndented;
  }
  return result;
}
var CHARACTERS_TO_ESCAPE = /["\\\x00-\x1F\x7F-\xA0\u2028\u2029\uD800-\uDFFF\uFEFF\uFFFE\uFFFF]/gu;
function escapeCharacter(character) {
  switch (character) {
    case "\x00":
      return "\\0";
    case "\x07":
      return "\\a";
    case "\b":
      return "\\b";
    case "\t":
      return "\\t";
    case `
`:
      return "\\n";
    case "\v":
      return "\\v";
    case "\f":
      return "\\f";
    case "\r":
      return "\\r";
    case "\x1B":
      return "\\e";
    case '"':
      return "\\\"";
    case "\\":
      return "\\\\";
    case "":
      return "\\N";
    case " ":
      return "\\_";
    case "\u2028":
      return "\\L";
    case "\u2029":
      return "\\P";
  }
  const code = character.charCodeAt(0);
  const hex = code.toString(16).toUpperCase();
  if (code <= 255)
    return `\\x${"0".repeat(2 - hex.length)}${hex}`;
  return `\\u${"0".repeat(4 - hex.length)}${hex}`;
}
function escapeString(string) {
  return string.replace(CHARACTERS_TO_ESCAPE, escapeCharacter);
}
var CHAR_LINE_FEED = 10;
var DEFAULT_PRESENTER_OPTIONS = {
  indent: 2,
  seqNoIndent: false,
  seqInlineFirst: true,
  lineWidth: 80,
  flowBracketPadding: false,
  flowSkipCommaSpace: false,
  flowSkipColonSpace: false,
  quoteFlowKeys: false,
  quoteStyle: "single",
  forceQuotes: false,
  scalarStyleRules: Object.keys(DEFAULT_SCALAR_STYLE_RULES).map((name) => Reflect.get(DEFAULT_SCALAR_STYLE_RULES, name)),
  tagBeforeAnchor: false
};
function nodeTagShort(node) {
  return node.tagged ? node.tag : tagNameShort(node.tag);
}
function createPresenterState(options) {
  const opts = {
    ...DEFAULT_PRESENTER_OPTIONS,
    ...options
  };
  if (opts.flowSkipColonSpace)
    opts.quoteFlowKeys = true;
  return {
    ...opts,
    defaultScalarTagName: opts.schema.defaultScalarTag.tagName,
    openEnded: false
  };
}
function generateNextLine(state, level) {
  return `
${" ".repeat(state.indent * level)}`;
}
function scalarLayout(state, node, parent, level, isKey, flowOnly) {
  return {
    node,
    parent,
    level,
    isKey,
    flowOnly,
    shiftOfParent: level === 0 ? -1 : state.indent * (level - 1),
    shiftOfContent: state.indent * Math.max(1, level),
    shiftOfFirstLine: level === 0 ? 0 : state.indent * level,
    presenterOptions: state,
    allowedStylesMask: 0,
    style: node.style
  };
}
function writeFlowSequence(state, level, node) {
  let result = "";
  for (let index = 0, length = node.items.length;index < length; index += 1) {
    const item = writeNode(state, level, node.items[index], node, {}).text;
    if (index > 0)
      result += `,${!state.flowSkipCommaSpace ? " " : ""}`;
    result += item;
  }
  const pad = state.flowBracketPadding && node.items.length > 0 ? " " : "";
  return `[${pad}${result}${pad}]`;
}
function writeBlockSequence(state, level, node, compact) {
  let result = "";
  for (let index = 0, length = node.items.length;index < length; index += 1) {
    const item = writeNode(state, level + 1, node.items[index], node, {
      block: true,
      compact: state.seqInlineFirst,
      isblockseq: true
    }).text;
    if (!compact || result !== "")
      result += generateNextLine(state, level);
    if (item === "" || CHAR_LINE_FEED === item.charCodeAt(0))
      result += "-";
    else
      result += "- ";
    result += item;
  }
  return result;
}
function writeFlowMapping(state, level, node) {
  let result = "";
  for (const { key, value } of node.items) {
    let pairBuffer = "";
    if (result !== "")
      pairBuffer += `,${!state.flowSkipCommaSpace ? " " : ""}`;
    const keyRender = writeNode(state, level, key, node, { iskey: true });
    const keyText = keyRender.text;
    const valueText = writeNode(state, level, value, node, {}).text;
    const sep = state.flowSkipColonSpace || valueText === "" ? "" : " ";
    const keyIsBareProps = key.kind === "scalar" && keyRender.noBody && (key.tagged || key.anchor !== undefined);
    const keyColonSep = key.kind === "alias" || keyIsBareProps ? " " : "";
    pairBuffer += `${keyText}${keyColonSep}:${sep}${valueText}`;
    result += pairBuffer;
  }
  const pad = state.flowBracketPadding && result !== "" ? " " : "";
  return `{${pad}${result}${pad}}`;
}
function writeBlockMapping(state, level, node, compact) {
  let result = "";
  for (let index = 0, length = node.items.length;index < length; index += 1) {
    let pairBuffer = "";
    if (!compact || result !== "")
      pairBuffer += generateNextLine(state, level);
    const { key, value } = node.items[index];
    const keyIsBlock = (key.kind === "mapping" || key.kind === "sequence") && key.style === COLLECTION_STYLE.BLOCK && key.items.length !== 0 || key.kind === "scalar" && (key.style === SCALAR_STYLE.LITERAL_BLOCK || key.style === SCALAR_STYLE.FOLDED_BLOCK);
    const keyRender = keyIsBlock ? writeNode(state, level + 1, key, node, {
      block: true,
      compact: true,
      isblockseq: !cannotBeCompact(state, key, level + 1)
    }) : writeNode(state, level + 1, key, node, {
      block: true,
      compact: true,
      iskey: true
    });
    const keyText = keyRender.text;
    const keyHasLineBreak = key.kind === "scalar" && key.value.indexOf(`
`) !== -1;
    const keyIsTooLong = keyText.length > 1024 && /^[\s\S]{1025}/u.test(keyText);
    const explicitPair = keyIsBlock || keyHasLineBreak || keyIsTooLong;
    if (explicitPair) {
      if (keyText && CHAR_LINE_FEED === keyText.charCodeAt(0))
        pairBuffer += "?";
      else
        pairBuffer += "? ";
    }
    pairBuffer += keyText;
    if (explicitPair)
      pairBuffer += generateNextLine(state, level);
    const valueText = writeNode(state, level + 1, value, node, {
      block: true,
      compact: explicitPair,
      isblockseq: explicitPair && !cannotBeCompact(state, value, level + 1)
    }).text;
    const keyIsBareProps = key.kind === "scalar" && keyRender.noBody && (key.tagged || key.anchor !== undefined);
    const keyColonSep = !explicitPair && (key.kind === "alias" || keyIsBareProps) ? " " : "";
    if (valueText === "" || CHAR_LINE_FEED === valueText.charCodeAt(0))
      pairBuffer += `${keyColonSep}:`;
    else
      pairBuffer += `${keyColonSep}: `;
    pairBuffer += valueText;
    result += pairBuffer;
  }
  return result;
}
function cannotBeCompact(state, node, level) {
  if (node.kind === "alias")
    return true;
  return node.tagged || node.anchor !== undefined || state.indent < 2 && level > 0;
}
function writeNode(state, level, node, parent, ctx) {
  if (node.kind === "alias") {
    state.openEnded = false;
    return {
      text: `*${node.anchor}`,
      noBody: false
    };
  }
  const { block = false, iskey = false, isblockseq = false } = ctx;
  let compact = ctx.compact ?? false;
  const hasAnchor = node.anchor !== undefined;
  if (cannotBeCompact(state, node, level))
    compact = false;
  let body;
  let shouldPrintTag = node.tagged;
  const useBlockCollection = block && (node.kind === "mapping" || node.kind === "sequence") && node.style === COLLECTION_STYLE.BLOCK && node.items.length !== 0;
  if (node.kind === "mapping") {
    if (useBlockCollection)
      body = writeBlockMapping(state, level, node, compact);
    else
      body = writeFlowMapping(state, level, node);
  } else if (node.kind === "sequence") {
    if (useBlockCollection) {
      if (state.seqNoIndent && !isblockseq && level > 0)
        body = writeBlockSequence(state, level - 1, node, compact);
      else
        body = writeBlockSequence(state, level, node, compact);
    } else
      body = writeFlowSequence(state, level, node);
  } else {
    const layout = scalarLayout(state, node, parent, level, iskey, !block);
    detectAllowedStyles(layout);
    for (const rule of state.scalarStyleRules)
      rule(layout);
    body = renderScalar(layout);
    state.openEnded = (layout.style === SCALAR_STYLE.LITERAL_BLOCK || layout.style === SCALAR_STYLE.FOLDED_BLOCK) && (node.value === `
` || node.value.endsWith(`

`));
    shouldPrintTag = node.tagged || body === "" && layout.flowOnly && parent?.kind === "sequence" && !hasAnchor || layout.style !== SCALAR_STYLE.PLAIN && node.tag !== state.defaultScalarTagName;
  }
  if ((node.kind === "mapping" || node.kind === "sequence") && !useBlockCollection)
    state.openEnded = false;
  if (useBlockCollection && compact && level > 0 && state.indent > 2)
    body = `${" ".repeat(state.indent - 2)}${body}`;
  const noBody = body === "";
  let text = body;
  if (shouldPrintTag || hasAnchor) {
    const props = [];
    const tag = shouldPrintTag ? nodeTagShort(node) : null;
    const anchor = hasAnchor ? `&${node.anchor}` : null;
    if (state.tagBeforeAnchor) {
      if (tag !== null)
        props.push(tag);
      if (anchor !== null)
        props.push(anchor);
    } else {
      if (anchor !== null)
        props.push(anchor);
      if (tag !== null)
        props.push(tag);
    }
    const sep = body === "" || body.charCodeAt(0) === CHAR_LINE_FEED ? "" : " ";
    text = `${props.join(" ")}${sep}${body}`;
  }
  return {
    text,
    noBody
  };
}
function rootStartsOwnLine(node) {
  return (node.kind === "sequence" || node.kind === "mapping") && node.style === COLLECTION_STYLE.BLOCK && node.items.length !== 0 && !node.tagged && node.anchor === undefined;
}
function writeDocumentDirectives(doc) {
  let result = "";
  for (const directive of doc.directives) {
    if (directive.kind === "yaml") {
      result += `%YAML ${directive.version}
`;
      continue;
    }
    const { handle, prefix } = directive;
    result += `%TAG ${handle} ${prefix}
`;
  }
  return result;
}
function present(documents, options) {
  const state = createPresenterState(options);
  let result = "";
  let previousEnded = false;
  for (let index = 0;index < documents.length; index += 1) {
    const doc = documents[index];
    state.openEnded = false;
    const directives = writeDocumentDirectives(doc);
    const hasDirectives = directives !== "";
    const marker = doc.explicitStart || hasDirectives || index > 0 && !previousEnded;
    result += directives;
    if (doc.contents === null) {
      if (marker)
        result += `---
`;
    } else if (marker) {
      const body = writeNode(state, 0, doc.contents, null, {
        block: true,
        compact: true
      }).text;
      const sep = body === "" ? "" : hasDirectives || rootStartsOwnLine(doc.contents) ? `
` : " ";
      result += `---${sep}${body}
`;
    } else
      result += writeNode(state, 0, doc.contents, null, {
        block: true,
        compact: true
      }).text + `
`;
    previousEnded = doc.explicitEnd || state.openEnded;
    if (previousEnded)
      result += `...
`;
  }
  return result;
}
var DEFAULT_DUMP_OPTIONS = {
  ...DEFAULT_PRESENTER_OPTIONS,
  schema: DUMP_SCHEMA,
  skipInvalid: false,
  noRefs: false,
  flowLevel: -1,
  sortKeys: false,
  transform: () => {}
};
function defaultCompareFn(a, b) {
  const x = String(a);
  const y = String(b);
  if (x < y)
    return -1;
  if (x > y)
    return 1;
  return 0;
}
function dump(input, options = {}) {
  const opts = {
    ...DEFAULT_DUMP_OPTIONS,
    ...options
  };
  const documents = jsToAst(input, opts.schema, {
    noRefs: opts.noRefs,
    skipInvalid: opts.skipInvalid
  });
  if (opts.flowLevel >= 0)
    visit(documents, (node, ctx) => {
      if (ctx.depth < opts.flowLevel)
        return;
      if (node.kind === "sequence" || node.kind === "mapping")
        node.style = COLLECTION_STYLE.FLOW;
      return VISIT_SKIP;
    });
  if (opts.sortKeys) {
    const compareFn = opts.sortKeys === true ? defaultCompareFn : opts.sortKeys;
    visit(documents, (node) => {
      if (node.kind !== "mapping")
        return;
      node.items.sort((a, b) => compareFn(a.key.kind === "scalar" ? a.key.value : "", b.key.kind === "scalar" ? b.key.value : ""));
    });
  }
  opts.transform(documents);
  return present(documents, {
    ...pick(opts, Object.keys(DEFAULT_PRESENTER_OPTIONS)),
    schema: opts.schema
  });
}
var EVENT_DOCUMENT = EVENT_ID.DOCUMENT;
var EVENT_SEQUENCE = EVENT_ID.SEQUENCE;
var EVENT_MAPPING = EVENT_ID.MAPPING;
var EVENT_SCALAR = EVENT_ID.SCALAR;
var EVENT_ALIAS = EVENT_ID.ALIAS;
var EVENT_POP = EVENT_ID.POP;
var SCALAR_STYLE_PLAIN = SCALAR_STYLE.PLAIN;
var SCALAR_STYLE_SINGLE_QUOTED = SCALAR_STYLE.SINGLE_QUOTED;
var SCALAR_STYLE_DOUBLE_QUOTED = SCALAR_STYLE.DOUBLE_QUOTED;
var SCALAR_STYLE_LITERAL_BLOCK = SCALAR_STYLE.LITERAL_BLOCK;
var SCALAR_STYLE_FOLDED_BLOCK = SCALAR_STYLE.FOLDED_BLOCK;
var COLLECTION_STYLE_BLOCK = COLLECTION_STYLE.BLOCK;
var COLLECTION_STYLE_FLOW = COLLECTION_STYLE.FLOW;
var CHOMPING_CLIP = CHOMPING_MODE.CLIP;
var CHOMPING_STRIP = CHOMPING_MODE.STRIP;
var CHOMPING_KEEP = CHOMPING_MODE.KEEP;

// node_modules/comark/dist/internal/yaml.js
function parseYaml(content) {
  const documents = loadAll(content, { schema: JSON_SCHEMA });
  if (documents.length > 1) {
    throw new YAMLException("expected a single document in the stream, but found more");
  }
  return documents[0];
}
function stringifyYaml(data, options) {
  const yamlOutput = dump(data, {
    indent: 2,
    lineWidth: -1,
    ...options
  });
  const lines = yamlOutput.split(`
`);
  for (let i = 0;i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    if (trimmed[0] === "'" || trimmed[0] === '"') {
      const quote = trimmed[0];
      if (trimmed[1] === ":") {
        const quoteEnd = trimmed.indexOf(quote, 1);
        if (quoteEnd > 1 && trimmed[quoteEnd + 1] === ":") {
          const indent = line.length - trimmed.length;
          lines[i] = " ".repeat(indent) + trimmed.slice(1, quoteEnd) + trimmed.slice(quoteEnd + 1);
        }
      }
    }
  }
  return lines.join(`
`);
}

// node_modules/comark/dist/internal/sanitize.js
var REJECTED_PROP = Symbol("comark:rejected-prop");
var unsafeTags = ["object"];
var unsafeAttributes = ["srcdoc", "formaction", "innerhtml", "dangerouslysetinnerhtml", "textcontent"];
var unsafeProtocols = ["javascript:", "vbscript:"];
function isUnsafeProtocol(url, allowDataImage) {
  if (unsafeProtocols.includes(url.protocol))
    return true;
  if (url.protocol !== "data:")
    return false;
  if (!allowDataImage)
    return true;
  const body = url.href.slice("data:".length);
  let end = 0;
  while (end < body.length && body[end] !== "," && body[end] !== ";")
    end++;
  return !body.slice(0, end).trim().toLowerCase().startsWith("image/");
}
function rewriteToDefaultOrigin(urlStr, defaultOrigin) {
  try {
    const parsed = new URL(urlStr);
    const origin = new URL(defaultOrigin);
    parsed.protocol = origin.protocol;
    parsed.host = origin.host;
    return parsed.href;
  } catch {
    return defaultOrigin;
  }
}
var NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  colon: ":",
  sol: "/",
  bsol: "\\",
  Tab: "\t",
  NewLine: `
`
};
function decodeHtmlEntities(value) {
  let result = value;
  for (let pass = 0;pass < 10; pass++) {
    const decoded = result.replace(/&#x([0-9a-f]+);?/gi, (match, hex) => {
      const code = Number.parseInt(hex, 16);
      return code <= 1114111 ? String.fromCodePoint(code) : match;
    }).replace(/&#(\d+);?/g, (match, dec) => {
      const code = Number.parseInt(dec, 10);
      return code <= 1114111 ? String.fromCodePoint(code) : match;
    }).replace(/&([a-z]+);?/gi, (match, name) => NAMED_ENTITIES[name] ?? match);
    if (decoded === result)
      break;
    result = decoded;
  }
  return result;
}
function validateUrl(value, mode, options) {
  const { allowedLinkPrefixes = ["*"], allowedImagePrefixes = ["*"], allowedProtocols = ["*"], defaultOrigin, allowDataImages = true } = options;
  let decodedUrl;
  try {
    decodedUrl = decodeURIComponent(value);
  } catch {
    decodedUrl = value;
  }
  const urlSanitized = decodeHtmlEntities(decodedUrl);
  const DUMMY_BASE = "http://comark.invalid";
  let url;
  try {
    url = new URL(urlSanitized);
  } catch {
    let resolved;
    try {
      resolved = new URL(urlSanitized, DUMMY_BASE);
    } catch {
      return value;
    }
    if (resolved.origin === DUMMY_BASE) {
      return value;
    }
    url = resolved;
  }
  if (isUnsafeProtocol(url, mode === "image" && allowDataImages)) {
    return REJECTED_PROP;
  }
  if (!allowedProtocols.includes("*")) {
    const protocol = url.protocol.replace(":", "");
    if (!allowedProtocols.includes(protocol)) {
      return REJECTED_PROP;
    }
  }
  const allowedPrefixes = mode === "link" ? allowedLinkPrefixes : allowedImagePrefixes;
  if (!allowedPrefixes.includes("*")) {
    const matchesPrefix = allowedPrefixes.some((prefix) => matchesAllowedPrefix(url, prefix));
    if (!matchesPrefix) {
      if (defaultOrigin) {
        return rewriteToDefaultOrigin(urlSanitized, defaultOrigin);
      }
      return REJECTED_PROP;
    }
  }
  return value;
}
function matchesAllowedPrefix(url, prefix) {
  const normalized = prefix.toLowerCase();
  if (!normalized.includes("://")) {
    return url.href.toLowerCase().startsWith(normalized);
  }
  let prefixUrl;
  try {
    prefixUrl = new URL(normalized);
  } catch {
    return url.href.toLowerCase().startsWith(normalized);
  }
  if (url.origin.toLowerCase() !== prefixUrl.origin.toLowerCase())
    return false;
  const prefixPath = prefixUrl.pathname;
  if (prefixPath === "/")
    return true;
  const path = url.pathname.toLowerCase();
  return path === prefixPath || path.startsWith(prefixPath.endsWith("/") ? prefixPath : `${prefixPath}/`);
}
function isUnsafeUrlValue(value) {
  if (!value.includes(":") && !value.includes("&") && !value.includes("%"))
    return false;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {}
  const sanitized = decodeHtmlEntities(decoded);
  let url;
  try {
    url = new URL(sanitized);
  } catch {
    return false;
  }
  return isUnsafeProtocol(url, true);
}
var URL_PROPS = new Set(["to", "action", "poster", "cite", "background", "ping"]);
var URL_PROP_SUFFIX = /(?:href|src|url|uri|link)s?$/;
function isUrlProp(name) {
  return URL_PROPS.has(name) || URL_PROP_SUFFIX.test(name);
}
function normalizePropName(attribute) {
  return attribute.toLowerCase().replace(/^(?:v-bind:|[:.^])+/, "").replace(/^(?:@|v-on:)/, "on").replace(/[:_-]/g, "");
}
function isUrlPropKey(key) {
  return isUrlProp(normalizePropName(key));
}
function isUnsafePropName(name) {
  return name.startsWith("on") || name.endsWith("html") || unsafeAttributes.includes(name);
}
var tagSelectors = ["as", "is"];
function isTagSelector(key) {
  return tagSelectors.includes(normalizePropName(key));
}
function createTagFilter(blockedTags = [], allowedTags = []) {
  const blocked = new Set([...blockedTags, ...unsafeTags].map((tag) => tag.toLowerCase()));
  const allowed = new Set(allowedTags.map((tag) => tag.toLowerCase()));
  return (tag) => {
    const name = tag.toLowerCase();
    return blocked.has(name) || allowed.size > 0 && !allowed.has(name);
  };
}
function isUnsafeTagSelector(key, value, isFilteredTag) {
  if (typeof value !== "string")
    return false;
  if (!/^(?::|v-bind:)/.test(key))
    return isFilteredTag(value);
  let decoded;
  try {
    decoded = JSON.parse(value);
  } catch {
    return true;
  }
  return typeof decoded === "string" && isFilteredTag(decoded);
}
function validateProp(attribute, value, options = {}) {
  const name = normalizePropName(attribute);
  if (isUnsafePropName(name)) {
    return REJECTED_PROP;
  }
  if (/^(?::|v-bind:)/.test(attribute) && typeof value === "string") {
    let decoded = value;
    try {
      decoded = JSON.parse(value);
    } catch {}
    if (typeof decoded === "object" && decoded !== null) {
      const result = validateValue(name, decoded, options);
      return result === REJECTED_PROP ? REJECTED_PROP : JSON.stringify(result);
    }
    const result = validateValue(name, typeof decoded === "string" ? decoded : value, options);
    return result === REJECTED_PROP ? REJECTED_PROP : value;
  }
  return validateValue(name, value, options);
}
function validateString(name, value, options) {
  if (name === "attributename") {
    return decodeHtmlEntities(value).toLowerCase().includes("href") ? REJECTED_PROP : value;
  }
  if (!isUrlProp(name))
    return value;
  return validateUrl(value, name.endsWith("src") || name === "poster" ? "image" : "link", options);
}
function validateValue(name, value, options) {
  if (typeof value === "string")
    return validateString(name, value, options);
  if (name === "href" || name === "xlinkhref" || name === "src")
    return REJECTED_PROP;
  if (Array.isArray(value)) {
    const result = [];
    for (const item of value) {
      const validated = validateValue(name, item, options);
      if (validated !== REJECTED_PROP)
        result.push(validated);
    }
    return result;
  }
  if (typeof value === "object" && value !== null) {
    const entries = [];
    for (const [key, item] of Object.entries(value)) {
      const validated = validateProp(key, item, options);
      if (validated !== REJECTED_PROP)
        entries.push([key, validated]);
    }
    return Object.fromEntries(entries);
  }
  return value;
}
function validateProps(type, props, options = {}) {
  if (unsafeTags.includes(type.toLowerCase())) {
    return {};
  }
  if (!props)
    return {};
  const entries = Object.entries(props);
  if (entries.length === 0)
    return {};
  props = Object.fromEntries(entries.flatMap(([name, value]) => {
    if (name === "id" && !value) {
      return [];
    }
    if (name === "$") {
      return [[name, value]];
    }
    const result = validateProp(name, value, options);
    if (result === REJECTED_PROP) {
      console.warn(`[comark/plugins/security] removing unsafe attribute: ${name}="${value}"`);
      return [];
    }
    return [[name, result]];
  }));
  return props;
}
function sanitizeData(data, options = {}) {
  const isFilteredTag = createTagFilter(options.blockedTags, options.allowedTags);
  const removed = [];
  const seen = new WeakMap;
  const sanitizeEntry = (name, key, value) => {
    if (key !== undefined) {
      if (isUnsafePropName(name))
        return REJECTED_PROP;
      if (tagSelectors.includes(name) && isUnsafeTagSelector(key, value, isFilteredTag))
        return REJECTED_PROP;
    }
    return typeof value === "string" ? validateString(name, value, options) : value;
  };
  const walk = (value, path, name) => {
    const isArray = Array.isArray(value);
    const seenAs = isArray ? name : "";
    const names = seen.get(value);
    if (names?.has(seenAs))
      return;
    if (names)
      names.add(seenAs);
    else
      seen.set(value, new Set([seenAs]));
    let deleted = false;
    for (const [key, child] of Object.entries(value)) {
      const at = path ? `${path}.${key}` : key;
      const childName = isArray ? name : normalizePropName(key);
      const result = sanitizeEntry(childName, isArray ? undefined : key, child);
      if (result === REJECTED_PROP) {
        Reflect.deleteProperty(value, key);
        removed.push(at);
        deleted = true;
      } else if (result !== child) {
        value[key] = result;
      } else if (child !== null && typeof child === "object") {
        walk(child, at, childName);
      }
    }
    if (deleted && isArray) {
      let length = 0;
      for (let index = 0;index < value.length; index++) {
        if (index in value)
          value[length++] = value[index];
      }
      value.length = length;
    }
  };
  if (data !== null && typeof data === "object")
    walk(data, "", "");
  return removed;
}

// node_modules/comark/dist/internal/stringify/fence.js
function pickFence(content) {
  let maxBackticks = 0;
  let maxTildes = 0;
  for (const line of content.split(`
`)) {
    const match = /^ {0,3}(`+|~+)/.exec(line);
    if (!match)
      continue;
    const run = match[1];
    if (run[0] === "`") {
      if (run.length > maxBackticks)
        maxBackticks = run.length;
    } else if (run.length > maxTildes) {
      maxTildes = run.length;
    }
  }
  const char = maxBackticks <= maxTildes ? "`" : "~";
  return char.repeat(Math.max(3, (char === "`" ? maxBackticks : maxTildes) + 1));
}

// node_modules/comark/dist/internal/stringify/attributes.js
var HTML_SINK_PROPS = new Set(["innerhtml", "dangerouslysetinnerhtml", "textcontent"]);
function resolveAttributes(attrs, renderData, options = {}) {
  const result = {};
  for (const key in attrs) {
    if (key === "$")
      continue;
    const value = attrs[key];
    const isBinding = key.charCodeAt(0) === 58;
    const outKey = isBinding ? key.slice(1) : key;
    const lowerOutKey = outKey.replace(/^[.^]/, "").toLowerCase();
    if (HTML_SINK_PROPS.has(lowerOutKey))
      continue;
    let outValue;
    let resultKey = key;
    if (options.parseJson && isBinding) {
      if (typeof value === "string") {
        try {
          outValue = JSON.parse(value);
        } catch {
          outValue = get(renderData, value);
        }
      } else {
        outValue = value;
      }
      resultKey = outKey;
    } else if (isBinding && typeof value === "string") {
      const resolved = get(renderData, value);
      if (resolved !== undefined) {
        outValue = resolved;
        resultKey = outKey;
      } else {
        outValue = value;
      }
    } else {
      outValue = value;
    }
    if (isBinding && isUrlPropKey(outKey) && typeof outValue === "string" && isUnsafeUrlValue(outValue)) {
      continue;
    }
    result[resultKey] = outValue;
  }
  return result;
}
var IMPLICIT_ATTRS = {
  blockquote: { drop: ["as"] },
  ol: { drop: ["start"] },
  ul: { classBlocklist: ["contains-task-list"] },
  li: { classBlocklist: ["task-list-item"] },
  pre: { drop: ["language", "filename", "highlights", "meta", "style"] }
};
function userBlockAttrs(tag, attributes) {
  const rule = IMPLICIT_ATTRS[tag];
  const highlighted = tag === "pre" || tag === "code";
  if (!rule && !highlighted)
    return { ...attributes };
  const result = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (rule?.drop?.includes(key))
      continue;
    if (key === "class" && rule?.classBlocklist && typeof value === "string") {
      const remaining = value.split(/\s+/).filter((c) => c && !rule.classBlocklist.includes(c)).join(" ");
      if (remaining)
        result[key] = remaining;
      continue;
    }
    if (key === "class" && highlighted && typeof value === "string" && (value.startsWith("shiki") || value.startsWith("shj"))) {
      const tokens = value.split(/\s+/);
      const cutoff = tokens.findIndex((t) => t === ".");
      const userClass = cutoff >= 0 ? tokens.slice(cutoff + 1).join(" ") : "";
      if (userClass)
        result[key] = userClass;
      continue;
    }
    result[key] = value;
  }
  return result;
}
function comarkAttributes(attributes) {
  const attrs = Object.entries(attributes).map(([key, value]) => {
    if (key.startsWith(":") && value === "true") {
      return key.slice(1);
    }
    if (key === "id") {
      return `#${value}`;
    }
    if (key === "class") {
      const classValue = Array.isArray(value) ? value.join(" ") : String(value);
      return classValue.split(" ").filter(Boolean).map((c) => `.${c}`).join("");
    }
    if (typeof value === "object") {
      return `${key}="${JSON.stringify(value).replace(/"/g, "\\\"")}"`;
    }
    const str = String(value);
    if (str.includes('"') && !str.includes("'")) {
      return `${key}='${str}'`;
    }
    return `${key}="${str.replace(/"/g, "\\\"")}"`;
  }).join(" ");
  return attrs.length > 0 ? `{${attrs}}` : "";
}
var SAFE_ATTR_NAME = /^[a-zA-Z_:][a-zA-Z0-9_:.-]*$/;
function htmlAttributes(attributes) {
  const parts = [];
  for (const [rawKey, value] of Object.entries(attributes)) {
    const key = rawKey.startsWith(":") ? rawKey.slice(1) : rawKey;
    if (!SAFE_ATTR_NAME.test(key))
      continue;
    if (rawKey.startsWith(":")) {
      if (value === "true") {
        parts.push(key);
        continue;
      }
      if (typeof value === "object" && value !== null) {
        parts.push(`${key}="${escapeHtml2(JSON.stringify(value))}"`);
        continue;
      }
      parts.push(`${key}="${escapeHtml2(String(value))}"`);
      continue;
    }
    if (value === true || value === "true") {
      parts.push(key);
      continue;
    }
    if (value === false || value === null || value === undefined)
      continue;
    if (typeof value === "object") {
      parts.push(`${key}="${escapeHtml2(JSON.stringify(value))}"`);
      continue;
    }
    parts.push(`${key}="${escapeHtml2(String(value))}"`);
  }
  return parts.join(" ");
}
function normalizeValue(value) {
  if (value === "true")
    return true;
  if (value === "false")
    return false;
  return value;
}
function comarkYamlAttributes(attributes, style = "codeblock") {
  const normalized = Object.fromEntries(Object.entries(attributes).map(([key, value]) => {
    if (key.startsWith(":")) {
      if (typeof value === "string") {
        try {
          return [key.slice(1), JSON.parse(value)];
        } catch {
          return [key, value];
        }
      }
      return [key.slice(1), value];
    }
    return [key, normalizeValue(value)];
  }));
  const yamlContent = stringifyYaml(normalized).trim();
  if (style === "frontmatter") {
    return `---
${yamlContent}
---`;
  }
  const fence = pickFence(yamlContent);
  return `${fence}yaml [props]
${yamlContent}
${fence}`;
}

// node_modules/comark/dist/utils/index.js
function textContent(node, options = {}) {
  if (typeof node === "string") {
    if (options.decodeUnicodeEntities) {
      return decodeHTML2(node);
    }
    return node;
  }
  let out = "";
  const len = node.length;
  for (let i = 2;i < len; i++) {
    out += textContent(node[i], options);
  }
  return out;
}
var TREE_WALK_MAX_DEPTH = 50;
function* walkGenerator(document2, checker) {
  function* walk(node, parent, index, depth) {
    if (depth >= TREE_WALK_MAX_DEPTH) {
      parent.splice(index, 1);
      return true;
    }
    let currentNode = node;
    if (checker(node)) {
      const res = yield node;
      if (res === false) {
        parent.splice(index, 1);
        return true;
      }
      if (res !== undefined) {
        parent[index] = res;
        currentNode = res;
      }
    }
    if (Array.isArray(currentNode) && currentNode.length > 2) {
      let i = 2;
      while (i < currentNode.length) {
        const childRemoved = yield* walk(currentNode[i], currentNode, i, depth + 1);
        if (childRemoved) {
          continue;
        }
        i += 1;
      }
    }
    return false;
  }
  let i = 0;
  while (i < document2.nodes.length) {
    const removed = yield* walk(document2.nodes[i], document2.nodes, i, 0);
    if (removed) {
      continue;
    }
    i += 1;
  }
}
function visit2(document2, checker, visitor) {
  const iterator = walkGenerator(document2, checker);
  let step = iterator.next();
  while (!step.done) {
    const res = visitor(step.value);
    step = iterator.next(res);
  }
}
async function visitAsync(document2, checker, visitor) {
  const iterator = walkGenerator(document2, checker);
  let step = iterator.next();
  while (!step.done) {
    const res = await visitor(step.value);
    step = iterator.next(res);
  }
}
var CODE_BLOCK_PROPS = new Set(["language", "filename", "highlights", "meta"]);
function toNativeAttributes(tag, node, attributes) {
  if (tag !== "pre" || !Array.isArray(node) || node[1]?.$?.html === 1)
    return attributes;
  let changed = false;
  const result = {};
  for (const key in attributes) {
    if (CODE_BLOCK_PROPS.has(key)) {
      changed = true;
      const value = attributes[key];
      result[`data-${key}`] = value !== null && typeof value === "object" ? JSON.stringify(value) : value;
    } else {
      result[key] = attributes[key];
    }
  }
  return changed ? result : attributes;
}
var HTML_VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);
function isHtmlVoidElement(tag) {
  return HTML_VOID_ELEMENTS.has(tag.toLowerCase());
}
var HTML_ESCAPE_RE = /[&<>"]/g;
var HTML_ESCAPED_RE = /^&[a-zA-Z][a-zA-Z0-9]*;|#[0-9]+;|#x[0-9a-fA-F]+;/;
function escapeHtml2(value, replace) {
  const escapeMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  };
  if (replace) {
    Object.assign(escapeMap, replace);
  }
  return value.replace(HTML_ESCAPE_RE, (char, index) => {
    switch (char) {
      case "&": {
        if (escapeMap[char] === "&" || value.slice(index).match(HTML_ESCAPED_RE)) {
          return char;
        }
        return escapeMap[char] ?? char;
      }
      default:
        return escapeMap[char] ?? char;
    }
  });
}
function indent(text, { ignoreFirstLine = false, level = 1, width } = {}) {
  const pad = width ? " ".repeat(width) : "  ".repeat(level);
  return text.split(`
`).map((line, index) => {
    if (ignoreFirstLine && index === 0) {
      return line;
    }
    return line ? pad + line : line;
  }).join(`
`);
}
function pascalCase(str) {
  return str ? splitByCase(str).map((p) => p ? p[0].toUpperCase() + p.slice(1) : "").join("") : "";
}
function kebabCase(str) {
  return str ? splitByCase(str).map((p) => p.toLowerCase()).join("-") : "";
}
function splitByCase(str) {
  const parts = [];
  if (!str) {
    return parts;
  }
  let buff = "";
  let previousUpper;
  let previousSplitter;
  for (let i = 0;i < str.length; i++) {
    const char = str[i];
    const isSplitter = char === "-" || char === "_" || char === "/" || char === ".";
    if (isSplitter === true) {
      parts.push(buff);
      buff = "";
      previousUpper = undefined;
      continue;
    }
    const charCode = char.charCodeAt(0);
    const isNumber = charCode >= 48 && charCode <= 57;
    const isUpper = isNumber ? undefined : charCode >= 65 && charCode <= 90;
    if (previousSplitter === false) {
      if (previousUpper === false && isUpper === true) {
        parts.push(buff);
        buff = char;
        previousUpper = isUpper;
        continue;
      }
      if (previousUpper === true && isUpper === false && buff.length > 1) {
        const lastChar = buff[buff.length - 1];
        parts.push(buff.slice(0, buff.length - 1));
        buff = lastChar + char;
        previousUpper = isUpper;
        continue;
      }
    }
    buff += char;
    previousUpper = isUpper;
    previousSplitter = isSplitter;
  }
  parts.push(buff);
  return parts;
}
function get(data, key) {
  const keys = key.split(".");
  let value = data;
  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = value[k];
    } else {
      return;
    }
  }
  return value;
}

// node_modules/comark/dist/internal/parse/syntax/props.js
var bracketPairs = {
  "[": "]",
  "{": "}",
  "(": ")"
};
var quotePairs = {
  "'": "'",
  '"': '"',
  "`": "`"
};
function searchProps(content, index = 0) {
  if (content[index] !== "{")
    throw new Error(`Invalid props, expected \`{\` but got '${content[index]}'`);
  const props = [];
  if (content[index + 1] === "{")
    return;
  index += 1;
  while (index < content.length) {
    if (content[index] === "\\") {
      index += 2;
    } else if (content[index] === "}") {
      index += 1;
      break;
    } else if (content[index] === " ") {
      index += 1;
    } else if (content[index] === ".") {
      index += 1;
      props.push(["class", searchUntil(" #.}", true)]);
    } else if (content[index] === "#") {
      index += 1;
      props.push(["id", searchUntil(" #.}")]);
    } else {
      const start = index;
      while (index < content.length) {
        index += 1;
        if (" }=".includes(content[index]))
          break;
      }
      const char = content[index];
      if (start !== index) {
        let key = content.slice(start, index).trim();
        let value = "";
        if (char === "=") {
          index += 1;
          value = searchValue();
        } else {
          key = key[0] === ":" ? key : `:${key}`;
          value = "true";
        }
        if (key.match(/^:?[a-z_][a-z0-9_-]*$/gi)) {
          props.push([key, value]);
        }
      }
    }
  }
  function searchUntil(str, bracketAware = false) {
    const start = index;
    while (index < content.length) {
      index += 1;
      if (content[index] === "\\")
        index += 2;
      if (bracketAware && content[index] in bracketPairs) {
        const open = index;
        if (searchBracket(bracketPairs[content[index]]))
          continue;
        index = open;
      }
      if (str.includes(content[index]))
        break;
    }
    return content.slice(start, index);
  }
  function searchValue() {
    const start = index;
    if (content[index] in bracketPairs) {
      searchBracket(bracketPairs[content[index]]);
      index += 1;
      return content.slice(start, index);
    } else if (content[index] in quotePairs) {
      searchString(quotePairs[content[index]]);
      index += 1;
      return content.slice(start, index);
    } else {
      return searchUntil(" }");
    }
  }
  function searchBracket(end) {
    while (index < content.length) {
      index++;
      if (content[index] in quotePairs)
        searchString(quotePairs[content[index]]);
      else if (content[index] in bracketPairs) {
        if (!searchBracket(bracketPairs[content[index]]))
          return false;
      } else if (content[index] === end)
        return true;
    }
    return false;
  }
  function searchString(end) {
    return searchUntil(end);
  }
  props.forEach((v) => {
    if (/^(['"`]).*\1$/.test(v[1]))
      v[1] = v[1].slice(1, -1);
  });
  return {
    props,
    index
  };
}

// node_modules/comark/dist/internal/parse/syntax/block-params.js
var RE_BLOCK_NAME = /^[a-z$][$\w.-]*/i;
function parseBlockParams(str) {
  str = str.trim();
  if (!str)
    return { name: "" };
  const name = str.match(RE_BLOCK_NAME)?.[0];
  if (!name)
    throw new Error(`Invalid block params: ${str}`);
  let remaining = str.slice(name.length).trim();
  let content;
  let props;
  let unparsedRemaining;
  if (remaining.startsWith("[")) {
    const result = parseBracketContent(remaining, 0);
    if (result) {
      content = result.content;
      remaining = remaining.slice(result.endIndex).trim();
    }
  }
  if (remaining.startsWith("{")) {
    const propsResult = searchProps(remaining, 0);
    if (propsResult) {
      props = propsResult.props;
      const afterProps = remaining.slice(propsResult.index).trim();
      if (afterProps)
        unparsedRemaining = afterProps;
    }
  } else if (remaining) {
    unparsedRemaining = remaining;
  }
  const result = {
    name: kebabCase(name)
  };
  if (content !== undefined)
    result.content = content;
  if (props !== undefined)
    result.props = props;
  if (unparsedRemaining)
    result.remaining = unparsedRemaining;
  return result;
}

// node_modules/comark/dist/internal/parse/indent.js
function dedentLine(state, line, columns) {
  const lineStart = state.bMarks[line];
  const max = state.eMarks[line];
  let pos = lineStart;
  let consumed = 0;
  while (pos < max && consumed < columns) {
    const code = state.src.charCodeAt(pos);
    if (code === 32) {
      consumed++;
    } else if (code === 9) {
      const width = 4 - (consumed + state.bsCount[line]) % 4;
      if (consumed + width > columns)
        return false;
      consumed += width;
    } else {
      break;
    }
    pos++;
  }
  if (consumed > 0) {
    state.bMarks[line] = pos;
    state.bsCount[line] += consumed;
    state.sCount[line] -= consumed;
    state.tShift[line] -= pos - lineStart;
  }
  return true;
}
function tokenizeDedented(state, from, to, shifts) {
  const bMarks = [];
  const bsCount = [];
  const sCount = [];
  const tShift = [];
  for (let line = from;line < to; line++) {
    bMarks.push(state.bMarks[line]);
    bsCount.push(state.bsCount[line]);
    sCount.push(state.sCount[line]);
    tShift.push(state.tShift[line]);
    if (!dedentLine(state, line, shifts[line - from])) {
      restoreLines(state, from, bMarks, bsCount, sCount, tShift);
      return false;
    }
  }
  const blkIndent = state.blkIndent;
  state.blkIndent = 0;
  state.md.block.tokenize(state, from, to);
  state.blkIndent = blkIndent;
  restoreLines(state, from, bMarks, bsCount, sCount, tShift);
  return true;
}
function restoreLines(state, from, bMarks, bsCount, sCount, tShift) {
  for (let i = 0;i < bMarks.length; i++) {
    const line = from + i;
    state.bMarks[line] = bMarks[i];
    state.bsCount[line] = bsCount[i];
    state.sCount[line] = sCount[i];
    state.tShift[line] = tShift[i];
  }
}

// node_modules/comark/dist/plugins/components.js
var RE_COMPONENT_NAME = /^[a-z$][\w$-]*/i;
function isValidComponentName(name) {
  return RE_COMPONENT_NAME.test(name);
}
var blockYamlLines = {
  "---": "---",
  "```yaml [props]": "```",
  "~~~yaml [props]": "~~~",
  "```yml [props]": "```",
  "~~~yml [props]": "~~~"
};
var markdownItComarkBlock = (md) => {
  const min_markers = 2;
  const marker_str = ":";
  const marker_char = marker_str.charCodeAt(0);
  md.block.ruler.before("fence", "comark_block_shorthand", function comark_block_shorthand(state, startLine, _endLine, silent) {
    const line = state.src.slice(state.bMarks[startLine] + state.tShift[startLine], state.eMarks[startLine]);
    if (line[0] !== ":" || !isValidComponentName(line.slice(1)))
      return false;
    const { name, content, props, remaining } = parseBlockParams(line.slice(1));
    if (remaining)
      return false;
    if (!silent) {
      if (content !== undefined) {
        const tokenOpen = state.push("mdc_block_shorthand_open", name, 1);
        props?.forEach(([key, value]) => {
          if (key === "class")
            tokenOpen.attrJoin(key, value);
          else
            tokenOpen.attrSet(key, value);
        });
        tokenOpen.map = [startLine, startLine + 1];
        const inline = state.push("inline", "", 0);
        inline.content = content;
        inline.children = [];
        const tokenClose = state.push("mdc_block_shorthand_close", name, -1);
        tokenClose.map = [startLine, startLine + 1];
      } else {
        const token = state.push("mdc_block_shorthand", name, 0);
        token.map = [startLine, startLine + 1];
        props?.forEach(([key, value]) => {
          if (key === "class")
            token.attrJoin(key, value);
          else
            token.attrSet(key, value);
        });
      }
    }
    state.line = startLine + 1;
    return true;
  });
  md.block.ruler.before("fence", "comark_block", function comark_block(state, startLine, endLine, silent) {
    let pos;
    let nextLine;
    let auto_closed = false;
    let start = state.bMarks[startLine] + state.tShift[startLine];
    let max = state.eMarks[startLine];
    const indent = state.sCount[startLine];
    let inCodeFence = false;
    let codeFenceCharCode = 0;
    let codeFenceCount = 0;
    let nestingDepth = 0;
    if (state.src[start] !== ":")
      return false;
    for (pos = start + 1;pos <= max; pos++) {
      if (marker_str !== state.src[pos])
        break;
    }
    const marker_count = Math.floor(pos - start);
    if (marker_count < min_markers)
      return false;
    const markup = state.src.slice(start, pos);
    const nameStart = state.skipSpaces(pos);
    if (nameStart < max && !isValidComponentName(state.src.slice(nameStart, max)))
      return false;
    const params = parseBlockParams(state.src.slice(pos, max));
    if (!params.name)
      return false;
    if (silent)
      return true;
    const childShifts = [];
    let codeFenceShift = 0;
    let hasOutdentedChild = false;
    nextLine = startLine;
    for (;; ) {
      nextLine++;
      if (nextLine >= endLine)
        break;
      start = state.bMarks[nextLine] + state.tShift[nextLine];
      max = state.eMarks[nextLine];
      if (start < max && state.sCount[nextLine] < state.blkIndent)
        break;
      const lineIndent = start >= max ? indent : state.sCount[nextLine];
      if (lineIndent < indent)
        hasOutdentedChild = true;
      childShifts.push(start >= max ? 0 : inCodeFence ? codeFenceShift : Math.min(indent, lineIndent));
      const lineCharCode = state.src.charCodeAt(start);
      if (inCodeFence) {
        if (lineCharCode === codeFenceCharCode) {
          let fencePos = start + 1;
          while (fencePos < max && state.src.charCodeAt(fencePos) === codeFenceCharCode)
            fencePos++;
          if (fencePos - start >= codeFenceCount) {
            const afterFence = state.skipSpaces(fencePos);
            if (afterFence >= max)
              inCodeFence = false;
          }
        }
        continue;
      }
      if (lineCharCode === 96 || lineCharCode === 126) {
        let fencePos = start + 1;
        while (fencePos < max && state.src.charCodeAt(fencePos) === lineCharCode)
          fencePos++;
        if (fencePos - start >= 3) {
          inCodeFence = true;
          codeFenceCharCode = lineCharCode;
          codeFenceCount = fencePos - start;
          codeFenceShift = childShifts[childShifts.length - 1];
          continue;
        }
      }
      if (marker_char !== lineCharCode)
        continue;
      for (pos = start + 1;pos <= max; pos++) {
        if (marker_str !== state.src[pos])
          break;
      }
      if (pos - start !== marker_count)
        continue;
      pos = state.skipSpaces(pos);
      if (pos < max) {
        nestingDepth++;
        continue;
      }
      if (nestingDepth > 0) {
        nestingDepth--;
        continue;
      }
      auto_closed = true;
      break;
    }
    const old_parent = state.parentType;
    const old_line_max = state.lineMax;
    state.parentType = "comark_block";
    state.lineMax = nextLine;
    const tokenOpen = state.push("mdc_block_open", params.name, 1);
    tokenOpen.markup = markup;
    tokenOpen.block = true;
    tokenOpen.info = params.name;
    tokenOpen.map = [startLine, nextLine];
    params.props?.forEach(([key, value]) => {
      if (key === "class")
        tokenOpen.attrJoin(key, value);
      else
        tokenOpen.attrSet(key, value);
    });
    if (params.content !== undefined) {
      const pOpen = state.push("paragraph_open", "p", 1);
      pOpen.map = [startLine, startLine + 1];
      const inline = state.push("inline", "", 0);
      inline.content = params.content;
      inline.children = [];
      state.push("paragraph_close", "p", -1);
    }
    state.env.comarkBlockTokens ||= [];
    state.env.comarkBlockTokens.unshift(tokenOpen);
    if (!hasOutdentedChild || !tokenizeDedented(state, startLine + 1, nextLine, childShifts)) {
      const blkIndent = state.blkIndent;
      state.blkIndent = indent;
      state.md.block.tokenize(state, startLine + 1, nextLine);
      state.blkIndent = blkIndent;
    }
    state.env.comarkBlockTokens.shift();
    const tokenClose = state.push("mdc_block_close", params.name, -1);
    tokenClose.map = [startLine, nextLine];
    tokenClose.markup = state.src.slice(start, pos);
    tokenClose.block = true;
    state.tokens.slice(state.tokens.indexOf(tokenOpen) + 1, state.tokens.indexOf(tokenClose)).filter((i) => i.level === tokenOpen.level + 1).forEach((i, _, arr) => {
      if (arr.length <= 2 && i.tag === "p")
        i.hidden = true;
    });
    state.parentType = old_parent;
    state.lineMax = old_line_max;
    state.line = nextLine + (auto_closed ? 1 : 0);
    return true;
  }, {
    alt: ["paragraph", "reference", "blockquote", "list"]
  });
  md.block.ruler.after("code", "comark_block_yaml", function comark_block_yaml(state, startLine, endLine, silent) {
    if (!state.env.comarkBlockTokens?.length)
      return false;
    const start = state.bMarks[startLine] + state.tShift[startLine];
    const end = state.eMarks[startLine];
    const line = state.src.slice(start, end);
    const blockAttributesClosingFence = blockYamlLines[line] || "";
    if (!blockAttributesClosingFence)
      return false;
    if (line === "---") {
      const parentOpenLine = state.env.comarkBlockTokens[0].map?.[0];
      if (parentOpenLine === undefined || startLine !== parentOpenLine + 1)
        return false;
    }
    let lineEnd = startLine + 1;
    let found = false;
    while (lineEnd < endLine) {
      const inner = state.src.slice(state.bMarks[lineEnd] + state.tShift[startLine], state.eMarks[lineEnd]);
      if (inner === blockAttributesClosingFence) {
        found = true;
        break;
      }
      lineEnd += 1;
    }
    if (!found)
      return false;
    if (!silent) {
      const yaml = state.getLines(startLine + 1, lineEnd, state.blkIndent, false);
      const data = parseYaml(yaml);
      const token = state.env.comarkBlockTokens[0];
      Object.entries(data || {}).forEach(([key, value]) => {
        if (key === "class") {
          token.attrJoin(key, value);
          return;
        }
        if (typeof value === "string") {
          token.attrSet(key, value);
        } else {
          token.attrSet(`:${key}`, JSON.stringify(value));
        }
      });
    }
    state.line = lineEnd + 1;
    return true;
  });
  md.block.ruler.after("code", "comark_block_slots", function comark_block_slots(state, startLine, endLine, silent) {
    if (!state.env.comarkBlockTokens?.length)
      return false;
    const start = state.bMarks[startLine] + state.tShift[startLine];
    if (!(state.src[start] === "#" && state.src[start + 1] !== " " && state.src[start + 1] !== "#"))
      return false;
    const line = state.src.slice(start, state.eMarks[startLine]);
    const slotParams = line.slice(1);
    if (!isValidComponentName(slotParams.trimStart()))
      return false;
    const { name, props, remaining } = parseBlockParams(slotParams);
    if (remaining)
      return false;
    if (silent)
      return true;
    let lineEnd = startLine + 1;
    let inCodeFence = false;
    let codeFenceChar = "";
    let codeFenceCount = 0;
    while (lineEnd < endLine) {
      const inner = state.src.slice(state.bMarks[lineEnd] + state.tShift[startLine], state.eMarks[lineEnd]);
      if (inCodeFence) {
        if (inner[0] === codeFenceChar) {
          let fencePos = 1;
          while (fencePos < inner.length && inner[fencePos] === codeFenceChar)
            fencePos++;
          if (fencePos >= codeFenceCount && inner.slice(fencePos).trim() === "") {
            inCodeFence = false;
          }
        }
        lineEnd += 1;
        continue;
      }
      if (inner[0] === "`" || inner[0] === "~") {
        const ch = inner[0];
        let fencePos = 1;
        while (fencePos < inner.length && inner[fencePos] === ch)
          fencePos++;
        if (fencePos >= 3) {
          inCodeFence = true;
          codeFenceChar = ch;
          codeFenceCount = fencePos;
          lineEnd += 1;
          continue;
        }
      }
      if (/^#\w+/.test(inner) || inner.startsWith("::"))
        break;
      lineEnd += 1;
    }
    const oldLineMax = state.lineMax;
    const slot = state.push("mdc_block_slot_open", "template", 1);
    slot.attrSet("name", `${name}`);
    props?.forEach(([key, value]) => {
      if (key === "class")
        slot.attrJoin(key, value);
      else
        slot.attrSet(key, value);
    });
    state.line = startLine + 1;
    state.lineMax = lineEnd;
    state.md.block.tokenize(state, startLine + 1, lineEnd);
    state.push("mdc_block_slot_close", "template", -1);
    state.line = lineEnd;
    state.lineMax = oldLineMax;
    return true;
  }, { alt: ["paragraph"] });
};
var ALLOWED_PREV_CHARS = new Set([" ", "\t", `
`, "*", "_", "[", "]", "}", ")", ">"]);
var markdownItInlineComponent = (md) => {
  md.inline.ruler.after("entity", "comark_inline_component", (state, silent) => {
    const start = state.pos;
    if (state.src[start] !== ":")
      return false;
    const prevChar = state.src[start - 1];
    if (start > 0 && !ALLOWED_PREV_CHARS.has(prevChar))
      return false;
    let index = start + 1;
    let nameEnd = -1;
    let contentStart = -1;
    let contentEnd = -1;
    while (index < state.src.length) {
      const char = state.src[index];
      if (char === "[") {
        nameEnd = index;
        const result = parseBracketContent(state.src, index);
        if (result) {
          contentStart = index + 1;
          contentEnd = result.endIndex - 1;
          index = result.endIndex;
        }
        break;
      }
      if (!/[\w$-]/.test(char))
        break;
      index += 1;
    }
    if (nameEnd === -1)
      nameEnd = index;
    if (nameEnd <= start + 1)
      return false;
    const name = state.src.slice(start + 1, nameEnd);
    if (!isValidComponentName(name))
      return false;
    state.pos = index;
    if (silent)
      return true;
    if (contentStart !== -1) {
      state.push("mdc_inline_component_open", name, 1);
      const oldPos = state.pos;
      const oldPosMax = state.posMax;
      state.pos = contentStart;
      state.posMax = contentEnd;
      state.md.inline.tokenize(state);
      state.pos = oldPos;
      state.posMax = oldPosMax;
      state.push("mdc_inline_component_close", name, -1);
    } else {
      state.push("mdc_inline_component", name, 0);
    }
    return true;
  });
};
var markdownItInlineSpan = (md) => {
  md.inline.ruler.before("link", "comark_inline_span", (state, silent) => {
    const start = state.pos;
    if (state.src[start] !== "[")
      return false;
    const close = findClosingBracket(state.src, start);
    const index = close === -1 ? state.src.length : close;
    const nextChar = state.src[index + 1];
    if (nextChar === "(" || nextChar === "[")
      return false;
    if (state.linkLevel > 0 && nextChar !== "{")
      return false;
    if (silent)
      return false;
    state.push("mdc_inline_span_open", "span", 1);
    const oldPos = state.pos;
    const oldPosMax = state.posMax;
    state.pos = start + 1;
    state.posMax = index;
    state.md.inline.tokenize(state);
    state.pos = oldPos;
    state.posMax = oldPosMax;
    state.push("mdc_inline_span_close", "span", -1);
    state.pos = index + 1;
    return true;
  });
};
var markdownItComponents = (md) => {
  md.use(markdownItComarkBlock);
  md.use(markdownItInlineSpan);
  md.use(markdownItInlineComponent);
};
var components_default = defineComarkPlugin(() => ({
  name: "components",
  markdownItPlugins: [markdownItComponents]
}));

// node_modules/comark/dist/plugins/attributes.js
var markdownItInlineProps = (md) => {
  md.inline.ruler.after("entity", "comark_inline_props", (state, silent) => {
    const start = state.pos;
    if (state.src[start] !== "{")
      return false;
    if (state.src[start + 1] === "{" || state.src[start - 1] === "{" || state.src[start - 1] === "$")
      return false;
    const search = searchProps(state.src, start);
    if (!search)
      return false;
    const { props, index: end } = search;
    if (end === start)
      return false;
    state.pos = end;
    if (silent)
      return true;
    const token = state.push("mdc_inline_props", "span", 0);
    token.attrs = props;
    token.hidden = true;
    return true;
  });
  md.renderer.rules.mdc_inline_props = () => "";
  const _parse = md.parse;
  md.parse = function(src, env) {
    const tokens = _parse.call(this, src, env);
    tokens.forEach((token, index) => {
      const prev = tokens[index - 1];
      const next = tokens[index + 1];
      if (!prev || !["heading_open", "paragraph_open", "list_item_open"].includes(prev.type) || prev.hidden)
        return;
      if (token.hidden && next?.type === "inline")
        token = next;
      if (token.type !== "inline" || !token.children?.length)
        return;
      const last = token.children[token.children.length - 1];
      if (last.type !== "mdc_inline_props")
        return;
      let beforeIdx = token.children.length - 2;
      while (beforeIdx >= 0) {
        const child = token.children[beforeIdx];
        if (child.type === "text" && !child.content) {
          beforeIdx--;
          continue;
        }
        break;
      }
      const beforeProps = beforeIdx >= 0 ? token.children[beforeIdx] : undefined;
      if (!beforeProps || beforeProps.type !== "text")
        return;
      if (typeof beforeProps.content === "string") {
        beforeProps.content = beforeProps.content.replace(/[ \t]+$/, "");
      }
      const props = last.attrs;
      token.children.length = beforeProps.content ? beforeIdx + 1 : beforeIdx;
      props?.forEach(([key, value]) => {
        if (key === "class")
          prev.attrJoin("class", value);
        else
          prev.attrSet(key, value);
      });
    });
    return tokens;
  };
  md.renderer.renderInline = wrapRenderInline(md.renderer.renderInline);
  if ("renderInlineAsync" in md.renderer) {
    md.renderer.renderInlineAsync = wrapRenderInline(md.renderer.renderInlineAsync);
  }
};
function wrapRenderInline(renderInline) {
  return function(tokens, options, env) {
    tokens = [...tokens];
    tokens.forEach((token, index) => {
      if (token.type !== "mdc_inline_props")
        return;
      let prevIndex = index - 1;
      let prev = tokens[prevIndex];
      while (prevIndex >= 0) {
        if (prev.type === "text" && !prev.content.trim()) {
          prevIndex--;
          prev = tokens[prevIndex];
        } else {
          break;
        }
      }
      if (!prev.tag && prev.type === "text") {
        prev = new Token("mdc_inline_span", "span", 1);
        tokens.splice(index - 1, 0, prev);
        const close = new Token("mdc_inline_span", "span", -1);
        tokens.splice(index + 2, 0, close);
      } else if (prev.nesting === -1) {
        let searchIndex = index - 1;
        while (searchIndex >= 0) {
          const searchToken = tokens[searchIndex];
          if (searchToken.nesting === 1 && searchToken.tag === prev.tag && searchToken.level === prev.level) {
            prev = searchToken;
            break;
          }
          searchIndex--;
        }
      }
      if (prev.nesting === -1)
        throw new Error(`No matching opening tag found for ${JSON.stringify(prev)}`);
      token.attrs?.forEach(([key, value]) => {
        if (key === "class")
          prev.attrJoin("class", value);
        else
          prev.attrSet(key, value);
      });
    });
    return renderInline.call(this, tokens, options, env);
  };
}
var markdownItAttributes = markdownItInlineProps;
var attributes_default = defineComarkPlugin(() => ({
  name: "attributes",
  markdownItPlugins: [markdownItAttributes]
}));

// node_modules/comark/dist/plugins/task-list.js
function attrSet(token, name, value) {
  const index = token.attrIndex(name);
  const attr = [name, value];
  if (index < 0) {
    if (!token.attrs) {
      token.attrs = [];
    }
    token.attrs.push(attr);
  } else {
    token.attrs[index] = attr;
  }
}
function markdownItTaskList(md, options) {
  const disableCheckboxes = !(options?.enabled ?? false);
  md.core.ruler.before("inline", "task-lists-mdc", (state) => {
    const tokens = state.tokens;
    const openItems = [];
    const openItemLists = [];
    const openLists = [];
    for (let i = 0;i < tokens.length; i++) {
      const token = tokens[i];
      if (token.type === "bullet_list_open" || token.type === "ordered_list_open") {
        openLists.push(i);
        continue;
      }
      if (token.type === "bullet_list_close" || token.type === "ordered_list_close") {
        openLists.pop();
        continue;
      }
      if (token.type === "list_item_open") {
        openItems.push(i);
        openItemLists.push(openLists.length > 0 ? openLists[openLists.length - 1] : -1);
        continue;
      }
      if (token.type === "list_item_close") {
        openItems.pop();
        openItemLists.pop();
        continue;
      }
      if (token.type === "inline" && token.content && openItems.length > 0) {
        const match = token.content.match(/^(\[[ x]\])\s+/i);
        if (match) {
          const isChecked = match[1].toLowerCase() === "[x]";
          attrSet(tokens[openItems[openItems.length - 1]], "class", "task-list-item");
          const listIdx = openItemLists[openItemLists.length - 1];
          if (listIdx >= 0) {
            attrSet(tokens[listIdx], "class", "contains-task-list");
          }
          const checkboxPlaceholder = `TASK_CHECKBOX_${isChecked ? "CHECKED" : "UNCHECKED"} `;
          token.content = token.content.replace(/^\[[ x]\]\s+/i, checkboxPlaceholder);
        }
      }
    }
  });
  md.core.ruler.after("inline", "task-lists-mdc-post", (state) => {
    const tokens = state.tokens;
    for (let i = 0;i < tokens.length; i++) {
      const token = tokens[i];
      if (token.type === "inline" && token.children) {
        for (let j = 0;j < token.children.length; j++) {
          const child = token.children[j];
          if (child.type === "text" && child.content) {
            const checkedMatch = child.content.match(/^TASK_CHECKBOX_CHECKED/);
            const uncheckedMatch = child.content.match(/^TASK_CHECKBOX_UNCHECKED/);
            if (checkedMatch || uncheckedMatch) {
              const isChecked = !!checkedMatch;
              const checkbox = new state.Token("mdc_inline_component", "input", 0);
              checkbox.attrs = [
                ["class", "task-list-item-checkbox"],
                ["type", "checkbox"]
              ];
              if (disableCheckboxes) {
                checkbox.attrs.push([":disabled", "true"]);
              }
              if (isChecked) {
                checkbox.attrs.push([":checked", "true"]);
              }
              child.content = child.content.replace(/^TASK_CHECKBOX_(CHECKED|UNCHECKED)/, "");
              token.children.splice(j, 0, checkbox);
              j++;
            }
          }
        }
      }
    }
  });
}
var task_list_default = defineComarkPlugin(() => ({
  name: "task-list",
  markdownItPlugins: [markdownItTaskList]
}));

// node_modules/comark/dist/plugins/alert.js
var markers = {
  "!TIP": {
    type: "tip",
    title: "Tip",
    color: "#238636"
  },
  "!NOTE": {
    type: "note",
    title: "Note",
    color: "#1f6feb"
  },
  "!IMPORTANT": {
    type: "important",
    title: "Important",
    color: "#8957e5"
  },
  "!WARNING": {
    type: "warning",
    title: "Warning",
    color: "#9e6a03"
  },
  "!CAUTION": {
    type: "caution",
    title: "Caution",
    color: "#da3633"
  }
};
var alert_default = defineComarkPlugin(() => ({
  name: "alert",
  post(state) {
    visit2(state.tree, (node) => Array.isArray(node) && node[0] === "blockquote", (node) => {
      const element = node;
      if (node[2]?.[0] === "span") {
        const content = String(node[2][2]).toUpperCase();
        const marker = markers[content];
        if (marker) {
          if (typeof node[3] === "string") {
            element[3] = String(element[3]).trimStart();
          }
          element.splice(2, 1);
          element[1].as = marker.type;
        }
      } else if (node[2]?.[0] === "p") {
        const paragraph = node[2];
        if (paragraph[2]?.[0] === "span") {
          const content = String(paragraph[2][2]).toUpperCase();
          const marker = markers[content];
          if (marker) {
            if (typeof paragraph[3] === "string") {
              paragraph[3] = String(paragraph[3]).trimStart();
            }
            paragraph.splice(2, 1);
            element[1].as = marker.type;
          }
        }
      }
    });
  }
}));

// node_modules/comark/dist/plugins/html.js
var html_default = defineComarkPlugin((opts = {}) => {
  const markdown = opts.markdown !== false;
  return {
    name: "html",
    markdownItPlugins: [markdown ? markdownItHtmlWithMarkdown : markdownItHtmlWithoutMarkdown],
    markdownItPost
  };
});
function markdownItHtmlWithoutMarkdown(md) {
  md.set({ html: true });
}
function markdownItHtmlWithMarkdown(md) {
  markdownItHtmlWithoutMarkdown(md);
  const html_block = md.block.ruler.__rules__.find((r) => r.name === "html_block");
  const fn = html_block.fn;
  html_block.fn = (state, startLine, endLine, silent) => {
    const pos = state.bMarks[startLine] + state.tShift[startLine];
    if (isRawTagBlock(state.src, pos))
      return fn(state, startLine, endLine, silent);
    if (!silent && state.src.startsWith("<!--", pos))
      return fn(state, startLine, endLine, silent);
  };
}
function markdownItPost(state) {
  let i = 0;
  while (i < state.tokens.length) {
    const token = state.tokens[i];
    if (token.type !== "html_block") {
      i += 1;
      continue;
    }
    const children = htmlToTokens(token.content || "");
    const open = new Token("paragraph_open", "p", 1);
    const inline = new Token("inline", "", 0);
    const close = new Token("paragraph_close", "p", -1);
    inline.children = children;
    inline.content = token.content || "";
    if (token.map) {
      open.map = token.map;
      inline.map = token.map;
    }
    state.tokens.splice(i, 1, open, inline, close);
    i += 3;
  }
}
var attr_name = "[a-zA-Z_:][a-zA-Z0-9:._-]*";
var unquoted = "[^\"'=<>`\\x00-\\x20]+";
var single_quoted = "'[^']*'";
var double_quoted = '"[^"]*"';
var attr_value = `(?:${unquoted}|${single_quoted}|${double_quoted})`;
var attribute = `(?:\\s+${attr_name}(?:\\s*=\\s*${attr_value})?)`;
var open_tag2 = `<[A-Za-z][A-Za-z0-9\\-]*${attribute}*\\s*\\/?>`;
var close_tag2 = "<\\/[A-Za-z][A-Za-z0-9\\-]*\\s*>";
var comment = "<!---?>|<!--(?:[^-]|-[^-]|--[^>])*-->";
var processing = "<[?][\\s\\S]*?[?]>";
var declaration = "<![A-Za-z][^>]*>";
var cdata = "<!\\[CDATA\\[[\\s\\S]*?\\]\\]>";
var HTML_TAG_RE2 = new RegExp(`^(?:${open_tag2}|${close_tag2}|${comment}|${processing}|${declaration}|${cdata})`);
function isLetter2(code) {
  return code >= 65 && code <= 90 || code >= 97 && code <= 122;
}
var RAW_HTML_TAGS = new Set(["style", "pre", "script", "textarea"]);
function readTag(src, pos) {
  if (src.charCodeAt(pos) !== 60)
    return null;
  let i = pos + 1;
  const close = src.charCodeAt(i) === 47;
  if (close)
    i += 1;
  const start = i;
  while (i < src.length && isLetter2(src.charCodeAt(i)))
    i += 1;
  if (i === start)
    return null;
  return { name: src.slice(start, i).toLowerCase(), close, after: i };
}
function isTagBoundary(src, pos) {
  if (pos >= src.length)
    return true;
  const next = src.charCodeAt(pos);
  return next === 62 || next === 47 || next <= 32;
}
function isRawTagBlock(src, pos) {
  const tag = readTag(src, pos);
  return !!tag && !tag.close && RAW_HTML_TAGS.has(tag.name) && isTagBoundary(src, tag.after);
}
function literalText(content) {
  if (!/[\r\n]/.test(content))
    return content;
  let start = 0;
  let end = content.length;
  if (/^\s*[\r\n]/.test(content)) {
    const nonSpace = content.search(/\S/);
    if (nonSpace < 0)
      return "";
    start = nonSpace;
  }
  const trailing = /[ \t]*(?:\r\n|\n|\r)[ \t]*$/.exec(content);
  if (trailing && trailing.index >= start)
    end = trailing.index;
  return start >= end ? "" : content.slice(start, end);
}
function pushText(tokens, content, verbatim = false) {
  const textContent = verbatim ? content : literalText(content);
  if (!textContent)
    return;
  const text = new Token("text", "", 0);
  text.content = textContent;
  tokens.push(text);
}
function pushHtml(tokens, content) {
  const html = new Token("html_inline", "", 0);
  html.content = content;
  tokens.push(html);
}
function rawCloserEnd(src, pos, name) {
  const tag = readTag(src, pos);
  if (!tag?.close || tag.name !== name)
    return -1;
  let j = tag.after;
  while (j < src.length && src.charCodeAt(j) <= 32)
    j += 1;
  return src.charCodeAt(j) === 62 ? j + 1 : -1;
}
function htmlToTokens(str) {
  const tokens = [];
  const len = str.length;
  let pos = 0;
  let textStart = 0;
  while (pos < len) {
    if (str.charCodeAt(pos) === 60 && pos + 1 < len) {
      const next = str.charCodeAt(pos + 1);
      if (next === 33 || next === 63 || next === 47 || isLetter2(next)) {
        const match = str.slice(pos).match(HTML_TAG_RE2);
        if (match) {
          if (pos > textStart)
            pushText(tokens, str.slice(textStart, pos));
          const raw = readTag(match[0], 0);
          if (raw && !raw.close && RAW_HTML_TAGS.has(raw.name) && match[0].charCodeAt(match[0].length - 2) !== 47) {
            pushHtml(tokens, match[0]);
            const from = pos + match[0].length;
            let end = -1;
            for (let i = from;i < len; i += 1) {
              if (str.charCodeAt(i) !== 60)
                continue;
              end = rawCloserEnd(str, i, raw.name);
              if (end < 0)
                continue;
              pushText(tokens, str.slice(from, i), true);
              pushHtml(tokens, str.slice(i, end));
              pos = end;
              break;
            }
            if (end < 0) {
              pushText(tokens, str.slice(from), true);
              return tokens;
            }
            textStart = pos;
            continue;
          }
          pushHtml(tokens, match[0]);
          pos += match[0].length;
          textStart = pos;
          continue;
        }
      }
    }
    pos++;
  }
  if (textStart < len)
    pushText(tokens, str.slice(textStart));
  return tokens;
}

// node_modules/comark/dist/internal/frontmatter.js
var FRONTMATTER_DELIMITER_DEFAULT = "---";
var LF = `
`;
var CR = "\r";
function parseFrontmatter(content) {
  let data = {};
  let frontmatter = "";
  if (content.startsWith(FRONTMATTER_DELIMITER_DEFAULT)) {
    const idx = content.indexOf(LF + FRONTMATTER_DELIMITER_DEFAULT);
    if (idx !== -1) {
      const hasCarriageReturn = content[idx - 1] === CR;
      frontmatter = content.slice(4, idx - (hasCarriageReturn ? 1 : 0));
      if (frontmatter) {
        data = parseYaml(frontmatter) ?? {};
        content = content.slice(idx + 4 + (hasCarriageReturn ? 1 : 0));
      }
    }
  }
  return {
    content,
    data,
    frontmatterText: frontmatter
  };
}

// node_modules/comark/dist/plugins/frontmatter.js
var frontmatter_default = defineComarkPlugin(() => ({
  name: "frontmatter",
  pre(state) {
    const { content, data, frontmatterText } = parseFrontmatter(state.markdown);
    state.markdown = content;
    state.frontmatter = data;
    state.frontmatterText = frontmatterText;
    if (content && frontmatterText) {
      state.parsedLines = (state.parsedLines ?? 0) + frontmatterText.split(`
`).length + 1;
    }
  }
}));

// node_modules/comark/dist/internal/parse/utils.js
function isBlankText(value) {
  for (let i = 0;i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c !== 32 && c !== 10 && c !== 9 && c !== 13 && c !== 12)
      return false;
  }
  return true;
}
function applyAutoUnwrap(node) {
  return applyAutoUnwrapAt(node, 0);
}
function applyAutoUnwrapAt(node, depth) {
  if (depth >= TREE_WALK_MAX_DEPTH || typeof node === "string" || node[0] === "p" || node[0] == null) {
    return node;
  }
  const length = node.length;
  if (length < 3) {
    return node;
  }
  let significant;
  let significantCount = 0;
  for (let i = 2;i < length; i++) {
    const child = node[i];
    if (typeof child === "string" && isBlankText(child))
      continue;
    significant = child;
    if (++significantCount > 1)
      break;
  }
  if (significantCount === 0) {
    return node;
  }
  if (significantCount === 1 && Array.isArray(significant) && significant[0] === "p") {
    const paragraphAttrs = significant[1];
    let mergedProps = node[1];
    if (paragraphAttrs) {
      for (const key in paragraphAttrs) {
        if (key !== undefined) {
          mergedProps = { ...paragraphAttrs, ...node[1] };
          break;
        }
      }
    }
    const unwrapped = significant.slice();
    unwrapped[0] = node[0];
    unwrapped[1] = mergedProps;
    return unwrapped;
  }
  let copy;
  for (let i = 2;i < length; i++) {
    const child = node[i];
    const next = applyAutoUnwrapAt(child, depth + 1);
    if (copy !== undefined) {
      copy.push(next);
    } else if (next !== child) {
      copy = node.slice(0, i);
      copy.push(next);
    }
  }
  return copy !== undefined ? copy : node;
}
function extractReusableNodes(markdown, lastOutput) {
  let lastValidNodeIndex = -1;
  let i = lastOutput.nodes.length - 1;
  let lastNodeIgnored = false;
  while (i >= 0) {
    const node = lastOutput.nodes[i];
    if (node[1] && node[1].$?.line) {
      if (lastNodeIgnored) {
        lastValidNodeIndex = i;
        break;
      } else {
        lastNodeIgnored = true;
      }
    }
    i--;
  }
  const lastNode = lastValidNodeIndex !== -1 ? lastOutput.nodes[lastValidNodeIndex] : null;
  if (lastNode) {
    const remainingMarkdownStartLine = lastNode[1].$?.line ?? 0;
    return {
      remainingMarkdownStartLine,
      reusedNodes: lastOutput.nodes.slice(0, lastValidNodeIndex + 1),
      remainingMarkdown: markdown.split(`
`).slice(remainingMarkdownStartLine).join(`
`) || ""
    };
  }
  return {
    remainingMarkdownStartLine: 0,
    remainingMarkdown: markdown,
    reusedNodes: []
  };
}
function normalizeTagName(tag) {
  for (let i = 0;i < tag.length; i++) {
    const c = tag.charCodeAt(i);
    if (c >= 97 && c <= 122)
      return tag;
  }
  return tag.toLowerCase();
}
function parseHtmlInline(content) {
  const trimmed = content.trim();
  if (trimmed.startsWith("<!--") && trimmed.endsWith("-->")) {
    return { kind: "comment", content: trimmed.slice(4, -3) };
  }
  const closeMatch = trimmed.match(/^<\/\s*([A-Za-z][\w:-]*)\s*>$/);
  if (closeMatch) {
    return { kind: "close", tag: normalizeTagName(closeMatch[1]) };
  }
  const openMatch = trimmed.match(/^<\s*([A-Za-z][\w:-]*)((?:\s+[\s\S]*?)?)\s*(\/?)>$/);
  if (openMatch) {
    const tag = normalizeTagName(openMatch[1]);
    const attrsStr = openMatch[2] || "";
    const slash = openMatch[3] === "/";
    const selfClosing = slash || isHtmlVoidElement(tag);
    return {
      kind: "open",
      tag,
      attrs: parseHtmlAttributes(attrsStr),
      selfClosing
    };
  }
  return { kind: "other", content: trimmed };
}
function parseHtmlAttributes(attrsStr) {
  const attrs = {};
  if (!attrsStr || !attrsStr.trim())
    return attrs;
  const re = /([:\w.-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = re.exec(attrsStr)) !== null) {
    const key = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4];
    attrs[key] = value === undefined ? true : decodeHTML2(value);
  }
  return attrs;
}

// node_modules/comark/dist/internal/parse/unwrap.js
function resolveUnwrapTags(unwrap) {
  if (!unwrap)
    return [];
  if (unwrap === true)
    return ["p"];
  if (typeof unwrap === "string") {
    return unwrap.split(/[,\s]/).map((tag) => tag.trim()).filter(Boolean);
  }
  return unwrap.filter(Boolean);
}
function isElement(node) {
  return Array.isArray(node) && typeof node[0] === "string";
}
function matchesTag(node, tag) {
  return isElement(node) && (tag === "*" || node[0] === tag);
}
function flatUnwrap(nodes, tags) {
  if (tags.length === 0)
    return nodes;
  const [head, ...rest] = tags;
  const result = [];
  for (const node of nodes) {
    const unwrapped = matchesTag(node, head) ? node.slice(2) : [node];
    for (const child of flatUnwrap(unwrapped, rest)) {
      result.push(child);
    }
  }
  return result.filter((node) => !(typeof node === "string" && node.trim() === ""));
}
function applyUnwrap(nodes, tags) {
  if (tags.length === 0)
    return nodes;
  const unwrapped = flatUnwrap(nodes, tags);
  const merged = [];
  for (const node of unwrapped) {
    if (typeof node === "string" && typeof merged[merged.length - 1] === "string") {
      merged[merged.length - 1] = merged[merged.length - 1] + node;
    } else {
      merged.push(node);
    }
  }
  return merged;
}

// node_modules/comark/dist/internal/parse/auto-close/table.js
function parseCellWidths(row) {
  const widths = [];
  let cellContent = "";
  let inCell = false;
  for (let i = 0;i < row.length; i++) {
    const ch = row[i];
    const isEscapedPipe = ch === "|" && i > 0 && row[i - 1] === "\\";
    if (ch === "|" && !isEscapedPipe) {
      if (inCell && cellContent) {
        widths.push(cellContent.length);
        cellContent = "";
      }
      inCell = true;
    } else if (inCell) {
      cellContent += ch;
    }
  }
  if (inCell && cellContent) {
    widths.push(cellContent.length);
  }
  return widths;
}
function parseCells(row) {
  const cells = [];
  let cell = "";
  let inCell = false;
  for (let i = 0;i < row.length; i++) {
    const ch = row[i];
    const isEscapedPipe = ch === "|" && i > 0 && row[i - 1] === "\\";
    if (ch === "|" && !isEscapedPipe) {
      if (inCell) {
        cells.push(cell.trim());
        cell = "";
      }
      inCell = true;
    } else if (inCell) {
      cell += ch;
    }
  }
  if (cell.trim()) {
    cells.push(cell.trim());
  }
  return cells;
}
function closeTables(markdown) {
  const lines = markdown.split(`
`);
  const tableBlocks = [];
  let blockStart = -1;
  for (let i = 0;i < lines.length; i++) {
    if (lines[i].trim().startsWith("|")) {
      if (blockStart === -1)
        blockStart = i;
    } else if (blockStart !== -1) {
      tableBlocks.push({ start: blockStart, end: i - 1 });
      blockStart = -1;
    }
  }
  if (blockStart !== -1) {
    tableBlocks.push({ start: blockStart, end: lines.length - 1 });
  }
  if (tableBlocks.length === 0)
    return markdown;
  const { start, end } = tableBlocks[tableBlocks.length - 1];
  const headerLine = lines[start].trim();
  if (!headerLine.endsWith("|")) {
    lines[start] += " |";
  }
  const columnCount = parseCellWidths(lines[start].trim()).length;
  const generateSeparator = () => "| " + Array(columnCount).fill("---").join(" | ") + " |";
  const secondLine = end - start >= 1 ? lines[start + 1].trim() : "";
  const hasSeparator = secondLine.startsWith("|") && (secondLine.includes("-") || secondLine.includes(":"));
  const lastLine = lines[end].trim();
  const isSeparator = lastLine.startsWith("|") && (lastLine.includes("-") || lastLine.includes(":"));
  if (isSeparator) {
    const sepCells = parseCells(lastLine);
    const completedCells = sepCells.map((cell) => {
      const hasLeftAlign = cell.startsWith(":");
      const hasRightAlign = cell.endsWith(":") && cell.length > 1;
      let dashes = cell.replace(/^:/, "").replace(/:$/, "");
      if (hasLeftAlign && hasRightAlign) {
        if (dashes.length < 1)
          dashes = "-";
        return ":" + dashes + ":";
      } else if (hasLeftAlign) {
        if (dashes.length < 1)
          dashes = "-";
        return ":" + dashes;
      } else if (hasRightAlign) {
        if (dashes.length < 1)
          dashes = "-";
        return dashes + ":";
      } else {
        while (dashes.length < 3)
          dashes += "-";
        return dashes;
      }
    });
    while (completedCells.length < columnCount) {
      completedCells.push("---");
    }
    lines[end] = "| " + completedCells.join(" | ") + " |";
  } else if (lastLine.startsWith("|") && !lastLine.endsWith("|")) {
    let refRow = lines[start].trim();
    for (let i = start + (hasSeparator ? 2 : 1);i < end; i++) {
      const row = lines[i].trim();
      if (row.startsWith("|") && row.endsWith("|") && !row.includes("-")) {
        refRow = row;
        break;
      }
    }
    const refWidths = parseCellWidths(refRow);
    const cells = parseCells(lastLine);
    const lastCell = cells[cells.length - 1] ?? "";
    const lastCellIncomplete = /(?:\*\*?|__?|~~|`|\$)$/.test(lastCell) || /(?:\*\*|__|~~|`)[^\s*_~`]+$/.test(lastCell);
    const padded = "| " + cells.map((cell, i) => {
      const targetWidth = refWidths[i] || cell.length + 2;
      const padding = " ".repeat(Math.max(0, targetWidth - cell.length - 2));
      return cell + padding;
    }).join(" | ");
    lines[end] = lastCellIncomplete ? padded : padded + " |";
  }
  if (!hasSeparator) {
    lines.splice(start + 1, 0, generateSeparator());
  }
  return lines.join(`
`);
}

// node_modules/comark/dist/internal/parse/auto-close/index.js
var INCOMPLETE_LINK_PLACEHOLDER = "comark:incomplete-link";
var INCOMPLETE_IMAGE_PLACEHOLDER = "comark:incomplete-image";
function autoCloseMarkdown(markdown, options = {}) {
  if (!markdown)
    return markdown;
  const math = options.math === true;
  const syntax = options.syntax !== false;
  const o = {
    frontmatter: options.frontmatter === true,
    syntax,
    attributes: options.attributes ?? syntax,
    linkMode: options.linkMode ?? "protocol",
    linkPh: options.incompleteLinkPlaceholder ?? INCOMPLETE_LINK_PLACEHOLDER,
    imagePh: options.incompleteImagePlaceholder ?? INCOMPLETE_IMAGE_PLACEHOLDER,
    blockMath: options.blockMath ?? math,
    inlineMath: options.inlineMath ?? math,
    links: options.links !== false,
    images: options.images !== false,
    bold: options.bold !== false,
    italic: options.italic !== false,
    strikethrough: options.strikethrough !== false,
    inlineCode: options.inlineCode !== false,
    boldItalic: options.boldItalic !== false,
    singleTilde: options.singleTilde !== false,
    comparisonOperators: options.comparisonOperators !== false,
    htmlTags: options.htmlTags !== false,
    tables: options.tables !== false
  };
  const source = options.dropTrailingOpeners === true ? dropTrailingOpeners(markdown, o.inlineCode) : markdown;
  const doc = scanBlocks(source, o);
  let result;
  if (doc.start < 0) {
    result = doc.docEnd === source.length ? source : source.slice(0, doc.docEnd);
  } else {
    result = source.slice(0, doc.start) + healRegion(source.slice(doc.start, doc.end), o) + source.slice(doc.end, doc.docEnd);
  }
  result = applySetextGuard(result);
  if (o.tables && doc.table)
    result = closeTables(result);
  if (o.blockMath && doc.mathOpen)
    result += result.endsWith(`
`) ? "$$" : `
$$`;
  if (doc.fmOpen && doc.fmContent)
    result = closeDelimiterLine(result, "-", 3);
  if (o.syntax)
    result = closeComponents(result, source, doc.comps, doc.start >= 0);
  return result;
}
var RAW_TEXT_OPEN_RE = /^<(script|pre|style|textarea)(\s|>|$)/i;
var RAW_TEXT_CLOSE_RE = {
  script: /<\/script\s*>/i,
  pre: /<\/pre\s*>/i,
  style: /<\/style\s*>/i,
  textarea: /<\/textarea\s*>/i
};
function scanBlocks(src, o) {
  const len = src.length;
  const starts = [0];
  for (let i = src.indexOf(`
`);i !== -1; i = src.indexOf(`
`, i + 1))
    starts.push(i + 1);
  let n = starts.length;
  let docEnd = len;
  const comps = [];
  let fenceLen = 0;
  let fenceCh = 0;
  let raw = null;
  let fmOpen = false;
  let fmContent = false;
  let mathOpen = false;
  let table = false;
  let shielded = -1;
  for (let i = 0;i < n; i++) {
    const ls = starts[i];
    const le = i + 1 < n ? starts[i + 1] - 1 : len;
    let st = ls;
    while (st < le && isIndentCode(src.charCodeAt(st)))
      st++;
    let en = le;
    while (en > st && isSpaceCode(src.charCodeAt(en - 1)))
      en--;
    const c0 = st < en ? src.charCodeAt(st) : -1;
    if (raw !== null) {
      if (RAW_TEXT_CLOSE_RE[raw].test(src.slice(ls, le)))
        raw = null;
      continue;
    }
    if (c0 === 60) {
      const m = RAW_TEXT_OPEN_RE.exec(src.slice(st, en));
      if (m !== null) {
        const tag = m[1].toLowerCase();
        if (!RAW_TEXT_CLOSE_RE[tag].test(src.slice(ls, le)))
          raw = tag;
        continue;
      }
    }
    if (c0 === 96 || c0 === 126) {
      let run = 1;
      while (st + run < en && src.charCodeAt(st + run) === c0)
        run++;
      if (run >= 3) {
        if (fenceLen === 0) {
          if (!(c0 === 96 && isIncompleteInlineFence(src, st, en))) {
            fenceLen = run;
            fenceCh = c0;
            shielded = i;
            continue;
          }
        } else if (c0 === fenceCh && run >= fenceLen && st + run === en) {
          fenceLen = 0;
          shielded = i;
          continue;
        } else {
          shielded = i;
          continue;
        }
      }
    }
    if (fenceLen !== 0)
      continue;
    if (c0 === 36 && en - st === 2 && src.charCodeAt(st + 1) === 36) {
      if (o.blockMath)
        mathOpen = !mathOpen;
      shielded = i;
      continue;
    }
    const dashes = c0 === 45 && en - st === 3 && src.charCodeAt(st + 1) === 45 && src.charCodeAt(st + 2) === 45;
    if (i === 0 && o.frontmatter && dashes) {
      fmOpen = true;
      continue;
    }
    if (fmOpen) {
      if (dashes)
        fmOpen = false;
      else if (c0 !== -1)
        fmContent = true;
      continue;
    }
    if (dashes && comps.length > 0) {
      const top = comps[comps.length - 1];
      top.yaml = !top.yaml;
      continue;
    }
    table = c0 === 124;
    if (o.syntax && c0 === 58) {
      let colons = 1;
      while (st + colons < en && src.charCodeAt(st + colons) === 58)
        colons++;
      const bare = st + colons === en;
      if (bare && i === n - 1 && comps.length === 0) {
        docEnd = ls;
        n--;
        break;
      }
      if (colons >= 2) {
        if (!bare && isNameStart(src.charCodeAt(st + colons))) {
          comps.push({ depth: colons, indent: src.slice(ls, st), yaml: false });
        } else if (bare && comps.length > 0 && comps[comps.length - 1].depth === colons) {
          comps.pop();
        }
      }
    }
  }
  const doc = { start: -1, end: -1, docEnd, fmOpen, fmContent, mathOpen, table, comps };
  if (fenceLen !== 0 || raw !== null || fmOpen || mathOpen)
    return doc;
  const lineEnd = (i) => i + 1 < n ? starts[i + 1] - 1 : docEnd;
  let e = n - 1;
  while (e > 0 && lineEnd(e) === starts[e])
    e--;
  while (e > shielded + 1 && isEmptyListItem(src, starts[e], lineEnd(e)) && isListItem(src, starts[e - 1], lineEnd(e - 1))) {
    docEnd = starts[e] - 1;
    n = e;
    e--;
    while (e > 0 && lineEnd(e) === starts[e])
      e--;
  }
  doc.docEnd = docEnd;
  if (lineEnd(e) === starts[e] || e <= shielded)
    return doc;
  let s = e;
  while (s > shielded + 1 && lineEnd(s - 1) !== starts[s - 1] && !isBlockStart(src, starts[s], lineEnd(s)))
    s--;
  if (s !== e) {
    let join = !isBlockStart(src, starts[s], lineEnd(s)) || isListItem(src, starts[s], lineEnd(s));
    for (let i = s + 1;join && i <= e; i++)
      if (isBlockStart(src, starts[i], lineEnd(i)))
        join = false;
    if (!join)
      s = e;
  }
  if (s === e && isIndentedCode(src, starts[e], lineEnd(e)) && !isListItem(src, starts[e], lineEnd(e)))
    return doc;
  doc.start = starts[s];
  doc.end = lineEnd(e);
  return doc;
}
function isIncompleteInlineFence(src, st, en) {
  if (en - st < 5)
    return false;
  if (src.charCodeAt(en - 1) !== 96 || src.charCodeAt(en - 2) !== 96 || src.charCodeAt(en - 3) === 96)
    return false;
  return !src.slice(st + 3, en).includes("```");
}
var ATX_HEADING_RE = /^#{1,6}(\s|$)/;
var THEMATIC_BREAK_RE = /^(\*{3,}|_{3,}|-{3,})\s*$/;
var ORDERED_LIST_RE = /^\d{1,9}[.)](\s|$)/;
function isIndentCode(c) {
  return c === 32 || c === 9;
}
function isBlockStart(src, ls, le) {
  if (ls >= le)
    return false;
  if (isIndentedCode(src, ls, le))
    return true;
  let st = ls;
  while (st < le && isIndentCode(src.charCodeAt(st)))
    st++;
  if (st >= le)
    return false;
  const c = src.charCodeAt(st);
  if (c === 96 || c === 126) {
    let run = 1;
    while (st + run < le && src.charCodeAt(st + run) === c)
      run++;
    if (run >= 3)
      return true;
  }
  if (c === 35)
    return ATX_HEADING_RE.test(src.slice(st, le));
  if (c === 62 || c === 124)
    return true;
  if ((c === 42 || c === 95 || c === 45) && THEMATIC_BREAK_RE.test(src.slice(st, le)))
    return true;
  return isListItem(src, st, le);
}
function isIndentedCode(src, ls, le) {
  if (ls >= le)
    return false;
  if (src.charCodeAt(ls) === 9)
    return true;
  let i = ls;
  while (i < le && src.charCodeAt(i) === 32)
    i++;
  return i - ls >= 4 && i < le;
}
function isListItem(src, ls, le) {
  let st = ls;
  while (st < le && isIndentCode(src.charCodeAt(st)))
    st++;
  if (st >= le)
    return false;
  const c = src.charCodeAt(st);
  if (c === 45 || c === 43 || c === 42) {
    const c1 = st + 1 < le ? src.charCodeAt(st + 1) : -1;
    return c1 === 32 || c1 === 9;
  }
  return c >= 48 && c <= 57 && ORDERED_LIST_RE.test(src.slice(st, le));
}
function isEmptyListItem(src, ls, le) {
  let st = ls;
  while (st < le && isIndentCode(src.charCodeAt(st)))
    st++;
  let en = le;
  while (en > st && isSpaceCode(src.charCodeAt(en - 1)))
    en--;
  if (st >= en)
    return false;
  const c = src.charCodeAt(st);
  if (c === 45 || c === 43 || c === 42)
    return st + 1 === en;
  let i = st;
  while (i < en && src.charCodeAt(i) >= 48 && src.charCodeAt(i) <= 57)
    i++;
  if (i === st || i === en)
    return false;
  const mark = src.charCodeAt(i);
  return (mark === 46 || mark === 41) && i + 1 === en;
}
function isNameStart(c) {
  return c >= 97 && c <= 122 || c >= 65 && c <= 90 || c === 36;
}
var F_STAR = 1;
var F_UNDER = 2;
var F_TILDE = 3;
var F_CODE = 4;
var F_MATH = 5;
var F_LINK = 6;
var LIST_COMPARE_PREFIX_RE = /^\s*(?:[-*+]|\d+[.)]) +$/;
var LIST_COMPARE_VALUE_RE = /^=?\s*\$?\d/;
function healRegion(text, o) {
  let len = text.length;
  if (text.charCodeAt(len - 1) === 32 && text.charCodeAt(len - 2) !== 32)
    len--;
  if (len === 0)
    return "";
  const frames = [];
  let edits = null;
  let lineStart = 0;
  let escEnd = -1;
  let attr = 0;
  let htmlLt = -1;
  let starInWord = false;
  let starDisabled = false;
  for (let i = 0;i < len; i++) {
    const c = text.charCodeAt(i);
    const top = frames.length === 0 ? null : frames[frames.length - 1];
    if (c === 10) {
      lineStart = i + 1;
      starInWord = false;
      htmlLt = -1;
      continue;
    }
    if (top !== null && top.k === F_CODE) {
      if (c === 96) {
        let n = 1;
        while (text.charCodeAt(i + n) === 96)
          n++;
        if (n >= top.len)
          frames.pop();
        else if (i + n === len)
          top.len -= n;
        i += n - 1;
      }
      continue;
    }
    if (c === 32 || c === 9 || c === 13) {
      starInWord = false;
      continue;
    }
    if (c === 92) {
      i++;
      escEnd = i + 1;
      continue;
    }
    if (attr > 0) {
      if (c === 125)
        attr--;
      continue;
    }
    if (htmlLt >= 0) {
      if (c === 62)
        htmlLt = -1;
      continue;
    }
    if (c === 96) {
      let n = 1;
      while (text.charCodeAt(i + n) === 96)
        n++;
      const after = i + n < len ? text.charCodeAt(i + n) : -1;
      if (o.inlineCode && after !== -1 && after !== 10)
        frames.push({ k: F_CODE, len: n, pos: i });
      i += n - 1;
      continue;
    }
    if (c === 36) {
      let n = 1;
      while (text.charCodeAt(i + n) === 36)
        n++;
      if (top !== null && top.k === F_MATH) {
        if (n >= top.len)
          frames.pop();
        else if (i + n === len)
          top.len -= n;
      } else {
        const after = i + n < len ? text.charCodeAt(i + n) : -1;
        if (n === 1) {
          const attached = after > 13 && after !== 32;
          if (o.inlineMath && attached && !(after >= 48 && after <= 57) && text.charCodeAt(i - 1) !== 58)
            frames.push({ k: F_MATH, len: 1, pos: i });
        } else if (n === 2 && o.blockMath) {
          if (after !== -1 && after !== 10 && after !== 13)
            frames.push({ k: F_MATH, len: 2, pos: i });
        }
      }
      i += n - 1;
      continue;
    }
    if (top !== null && top.k === F_MATH)
      continue;
    if (c === 42 || c === 95) {
      let n = 1;
      while (text.charCodeAt(i + n) === c)
        n++;
      const prev = codePointBefore(text, i);
      const next = i + n < len ? codePointAt(text, i + n) : "";
      const attachedLeft = prev !== "" && !isSpaceCp(prev) && i !== escEnd;
      const openLeft = !attachedLeft || c === 95 && (prev === "*" || prev === "_" || prev === "~");
      const openRight = next !== "" && !isSpaceCp(next);
      const enabled = n === 1 ? o.italic : n === 2 ? o.bold : o.boldItalic;
      if (c === 42) {
        const inWord = attachedLeft && isAlnum(prev) && isAlnum(next);
        if (!inWord || starInWord) {
          if (attachedLeft && top !== null && top.k === F_STAR && (!inWord || top.len === n)) {
            closeRun(frames, F_STAR, n);
            starInWord = true;
            i += n - 1;
            continue;
          }
          if (openRight && enabled) {
            frames.push({ k: F_STAR, len: n, pos: i });
            starInWord = true;
            i += n - 1;
            continue;
          }
          if (openRight && n === 1)
            starDisabled = true;
        }
      } else {
        if (attachedLeft && !isAlnum(next) && top !== null && top.k === F_UNDER) {
          closeRun(frames, F_UNDER, n);
          i += n - 1;
          continue;
        }
        if (openLeft && openRight && enabled)
          frames.push({ k: F_UNDER, len: n, pos: i });
      }
      i += n - 1;
      continue;
    }
    if (c === 126) {
      let n = 1;
      while (text.charCodeAt(i + n) === 126)
        n++;
      const prev = codePointBefore(text, i);
      const next = i + n < len ? codePointAt(text, i + n) : "";
      const attachedLeft = prev !== "" && !isSpaceCp(prev);
      if (top !== null && top.k === F_TILDE && attachedLeft) {
        closeRun(frames, F_TILDE, n);
      } else if (n === 2 && o.strikethrough && next !== "" && !isSpaceCp(next)) {
        frames.push({ k: F_TILDE, len: 2, pos: i });
      } else if (n === 1 && o.singleTilde && isAlnum(prev) && isAlnum(next) && !isSubscriptTilde(text, i)) {
        edits = push(edits, [i, "\\~"]);
      }
      i += n - 1;
      continue;
    }
    if (c === 91) {
      const image = text.charCodeAt(i - 1) === 33;
      if (image ? o.images : o.links)
        frames.push({ k: F_LINK, len: image ? 2 : 1, pos: image ? i - 1 : i });
      continue;
    }
    if (c === 93) {
      let b = frames.length - 1;
      while (b >= 0 && frames[b].k !== F_LINK)
        b--;
      if (b < 0)
        continue;
      const label = frames[b];
      frames.length = b;
      const after = i + 1 < len ? text.charCodeAt(i + 1) : -1;
      if (after === 40) {
        const end = scanDestination(text, i + 2, len);
        if (end > 0) {
          i = end;
          continue;
        }
        if (end < 0)
          continue;
      } else if (after === 91) {
        let j = i + 2;
        while (j < len && text.charCodeAt(j) !== 93)
          j++;
        if (j < len) {
          i = j;
          continue;
        }
      } else if (!(label.len === 2 && i + 1 === len && hasContent(text, label.pos + 2, i))) {
        continue;
      }
      if (label.len === 2 || o.linkMode === "protocol") {
        return apply(text, edits, i + 1, "(" + (label.len === 2 ? o.imagePh : o.linkPh) + ")");
      }
      return apply(text, push(edits, [label.pos, ""]), i, "");
    }
    if (c === 60) {
      const next = text.charCodeAt(i + 1);
      if (next === 47 || isAsciiAlpha(next))
        htmlLt = i;
      continue;
    }
    if (c === 62) {
      if (o.comparisonOperators && LIST_COMPARE_PREFIX_RE.test(text.slice(lineStart, i)) && LIST_COMPARE_VALUE_RE.test(text.slice(i + 1))) {
        edits = push(edits, [i, "\\>"]);
      }
      continue;
    }
    if (c === 123 && o.attributes) {
      const prev = text.charCodeAt(i - 1);
      if (i > 0 && prev !== 32 && prev !== 9 && prev !== 10)
        attr++;
      continue;
    }
  }
  let end = len;
  if (htmlLt >= 0 && o.htmlTags) {
    end = htmlLt;
    while (end > 0 && (text.charCodeAt(end - 1) === 32 || text.charCodeAt(end - 1) === 9))
      end--;
    while (frames.length > 0 && frames[frames.length - 1].pos >= htmlLt)
      frames.pop();
  }
  let b = frames.length - 1;
  while (b >= 0 && frames[b].k !== F_LINK)
    b--;
  if (b >= 0 && hasContent(text, frames[b].pos + frames[b].len, end)) {
    const label = frames[b];
    if (label.len === 2 || o.linkMode === "protocol") {
      return apply(text, edits, end, "](" + (label.len === 2 ? o.imagePh : o.linkPh) + ")");
    }
    for (let k = frames.length - 1;k >= 0; k--) {
      const f = frames[k];
      if (f.k !== F_LINK)
        continue;
      frames.length = k;
      if (f.len === 2)
        return apply(text, edits, end, "](" + o.imagePh + ")");
      edits = push(edits, [f.pos, ""]);
    }
  }
  return apply(text, edits, end, closers(frames, text, o, starDisabled));
}
function closeRun(frames, kind, n) {
  let m = n;
  while (m > 0 && frames.length > 0) {
    const f = frames[frames.length - 1];
    if (f.k !== kind)
      break;
    if (m >= f.len) {
      m -= f.len;
      frames.pop();
    } else {
      f.len -= m;
      m = 0;
    }
  }
}
function scanDestination(text, from, len) {
  let depth = 1;
  for (let i = from;i < len; i++) {
    const c = text.charCodeAt(i);
    if (c === 92)
      i++;
    else if (c === 40)
      depth++;
    else if (c === 41) {
      if (--depth === 0)
        return i;
    } else if (c === 32 || c === 9 || c === 10)
      return -1;
  }
  return 0;
}
function closers(frames, text, o, starDisabled) {
  const skipStar = starDisabled && !o.italic;
  let starSum = 0;
  let starCount = 0;
  let innerStar = -1;
  for (let i = frames.length - 1;i >= 0; i--) {
    if (frames[i].k !== F_STAR)
      continue;
    starSum += frames[i].len;
    starCount++;
    if (innerStar < 0)
      innerStar = i;
  }
  let crossOutside = false;
  for (let i = innerStar - 1;i >= 0; i--) {
    const k = frames[i].k;
    if (k === F_TILDE || k === F_UNDER || k === F_MATH) {
      crossOutside = true;
      break;
    }
  }
  let out = "";
  let starDone = false;
  for (let i = frames.length - 1;i >= 0; i--) {
    const f = frames[i];
    switch (f.k) {
      case F_STAR:
        if (starDone || skipStar)
          break;
        starDone = true;
        out += "*".repeat(starCount >= 2 && crossOutside ? f.len : starSum);
        break;
      case F_UNDER:
        out += "_".repeat(f.len);
        break;
      case F_TILDE:
        out += "~".repeat(f.len);
        break;
      case F_CODE:
        out += "`".repeat(f.len);
        break;
      case F_MATH:
        out += f.len === 2 && text.lastIndexOf(`
`) > f.pos ? `
$$` : "$".repeat(f.len);
        break;
    }
  }
  return out;
}
function push(edits, edit) {
  if (edits === null)
    return [edit];
  edits.push(edit);
  return edits;
}
function apply(text, edits, end, suffix) {
  if (edits === null)
    return end === text.length ? suffix === "" ? text : text + suffix : text.slice(0, end) + suffix;
  if (edits.length > 1)
    edits.sort(byPos);
  let out = "";
  let copied = 0;
  for (let i = 0;i < edits.length; i++) {
    const [pos, replacement] = edits[i];
    if (pos >= end)
      break;
    out += text.slice(copied, pos) + replacement;
    copied = pos + 1;
  }
  return out + text.slice(copied, end) + suffix;
}
function byPos(a, b) {
  return a[0] - b[0];
}
function closeDelimiterLine(text, ch, width) {
  const last = text.slice(text.lastIndexOf(`
`) + 1).trim().replace(ZWSP_RE, "");
  if (last.length > 0 && last.length < width && last === ch.repeat(last.length)) {
    return text.replace(TRAILING_ZWSP_RE, "") + ch.repeat(width - last.length);
  }
  return text + (text.endsWith(`
`) ? "" : `
`) + ch.repeat(width);
}
function closeComponents(result, source, comps, healShorthand) {
  const lineStart = result.lastIndexOf(`
`) + 1;
  const shorthand = healShorthand && /^:[a-z$][\w$-]*\{/i.test(result.slice(lineStart).trimStart());
  if (!source.includes("::") && !shorthand)
    return result;
  let brace = -1;
  for (let i = result.length - 1;i >= lineStart; i--) {
    const c = result.charCodeAt(i);
    if (c === 125)
      break;
    if (c === 123) {
      brace = i;
      break;
    }
  }
  if (brace >= 0) {
    let dq = 0;
    let sq = 0;
    for (let i = brace + 1;i < result.length; i++) {
      const c = result.charCodeAt(i);
      if (c === 34)
        dq++;
      else if (c === 39)
        sq++;
    }
    result += (dq % 2 === 1 ? '"' : "") + (sq % 2 === 1 ? "'" : "") + "}";
  }
  if (comps.length === 0)
    return result;
  const top = comps[comps.length - 1];
  if (top.yaml) {
    const last = result.slice(result.lastIndexOf(`
`) + 1).trim().replace(ZWSP_RE, "");
    if (last === "-" || last === "--") {
      result = result.replace(TRAILING_ZWSP_RE, "") + "-".repeat(3 - last.length);
      top.yaml = false;
    }
  }
  let out = result;
  for (let i = comps.length - 1;i >= 0; i--) {
    const c = comps[i];
    if (c.yaml)
      out += `
` + c.indent + "---";
    out += `
` + c.indent + ":".repeat(c.depth);
  }
  return out;
}
var ZWSP_RE = /\u200B/g;
var TRAILING_ZWSP_RE = /\u200B+$/;
var SETEXT_RE = /^(?:-{1,2}|={1,2})$/;
var YAML_KEY_RE = /^[A-Za-z_][\w.-]*\s*:/;
function applySetextGuard(text) {
  const lastNl = text.lastIndexOf(`
`);
  if (lastNl === -1)
    return text;
  const last = text.slice(lastNl + 1);
  const t = last.trim();
  if (!SETEXT_RE.test(t))
    return text;
  if (last !== t && /\s$/.test(last))
    return text;
  const head = text.slice(0, lastNl);
  const prev = head.slice(head.lastIndexOf(`
`) + 1).trim();
  if (prev === "" || prev === "---" || YAML_KEY_RE.test(prev))
    return text;
  return text + "​";
}
function isTrailingOpener(c) {
  return c === 42 || c === 95 || c === 36 || c === 58 || c === 96 || c === 126 || c === 91 || c === 123 || c === 33;
}
function dropTrailingOpeners(text, inlineCode) {
  let ws = text.length;
  while (ws > 0 && isSpaceCode(text.charCodeAt(ws - 1)))
    ws--;
  if (ws === 0)
    return text;
  let i = ws;
  while (i > 0 && isTrailingOpener(text.charCodeAt(i - 1))) {
    if (text.charCodeAt(i - 2) === 92)
      break;
    i--;
  }
  if (i === ws)
    return text;
  let allDollar = true;
  let allTick = true;
  for (let k = i;k < ws; k++) {
    const c = text.charCodeAt(k);
    if (c !== 36)
      allDollar = false;
    if (c !== 96)
      allTick = false;
  }
  if (allDollar && isAlnum(codePointBefore(text, i)))
    return text.slice(0, i) + text.slice(ws);
  if (allTick && inlineCode) {
    const span = openCodeSpan(text, i);
    if (span !== null) {
      if (ws - i >= span.len)
        return text;
      const gap = i - span.end;
      const pad = gap === 1 ? text.charCodeAt(span.end) : -1;
      if (gap > 1 || gap === 1 && pad !== 32 && pad !== 9)
        return text;
      return text.slice(0, trimBack(text, span.start)) + text.slice(ws);
    }
  }
  if (isAlnum(codePointBefore(text, i)))
    return text;
  return text.slice(0, trimBack(text, i)) + text.slice(ws);
}
function hasContent(text, from, to) {
  for (let i = from;i < to; i++)
    if (!isSpaceCode(text.charCodeAt(i)))
      return true;
  return false;
}
function trimBack(text, from) {
  const prev = text.charCodeAt(from - 1);
  return prev === 32 || prev === 9 ? from - 1 : from;
}
function openCodeSpan(text, limit) {
  let start = -1;
  let len = 0;
  let end = -1;
  let i = text.lastIndexOf(`
`, limit - 1) + 1;
  while (i < limit) {
    const c = text.charCodeAt(i);
    if (c === 92) {
      i += 2;
      continue;
    }
    if (c !== 96) {
      i++;
      continue;
    }
    let n = 1;
    while (i + n < limit && text.charCodeAt(i + n) === 96)
      n++;
    if (len === 0) {
      len = n;
      start = i;
      end = i + n;
    } else if (n >= len) {
      len = 0;
      start = -1;
      end = -1;
    }
    i += n;
  }
  return len === 0 ? null : { start, len, end };
}
var ALNUM_CP_RE = /\p{L}|\p{N}/u;
function isAlnum(cp) {
  if (cp === "")
    return false;
  const c = cp.charCodeAt(0);
  if (c <= 127)
    return c >= 48 && c <= 57 || c >= 65 && c <= 90 || c >= 97 && c <= 122;
  return ALNUM_CP_RE.test(cp);
}
function isAsciiAlpha(c) {
  return c >= 97 && c <= 122 || c >= 65 && c <= 90;
}
function isSpaceCp(cp) {
  return cp === " " || cp === "\t" || cp === `
` || cp === "\r";
}
function isSpaceCode(c) {
  return c === 32 || c === 9 || c === 10 || c === 13;
}
function codePointBefore(text, i) {
  if (i <= 0)
    return "";
  const c = text.charCodeAt(i - 1);
  if (c >= 56320 && c <= 57343 && i >= 2) {
    const hi = text.charCodeAt(i - 2);
    if (hi >= 55296 && hi <= 56319)
      return text.slice(i - 2, i);
  }
  return text[i - 1];
}
function codePointAt(text, i) {
  const c = text.charCodeAt(i);
  if (c >= 55296 && c <= 56319) {
    const lo = text.charCodeAt(i + 1);
    if (lo >= 56320 && lo <= 57343)
      return text.slice(i, i + 2);
  }
  return text[i];
}
function isSubscriptTilde(text, i) {
  for (let j = i - 1;j >= 0 && text.charCodeAt(j) !== 10; j--) {
    if (text.charCodeAt(j) === 126)
      return isSubscriptPair(text, j, i);
  }
  for (let j = i + 1;j < text.length && text.charCodeAt(j) !== 10; j++) {
    if (text.charCodeAt(j) === 126)
      return isSubscriptPair(text, i, j);
  }
  return false;
}
function isSubscriptPair(text, open, close) {
  if (close - open < 2)
    return false;
  if (text.charCodeAt(open - 1) === 126 || text.charCodeAt(open + 1) === 126)
    return false;
  if (text.charCodeAt(close + 1) === 126)
    return false;
  for (let k = open + 1;k < close; k++) {
    const c = text.charCodeAt(k);
    if (c < 48 || c > 57)
      return false;
  }
  return isAlnum(codePointBefore(text, open)) && isAlnum(codePointAt(text, close + 1));
}

// node_modules/comark/dist/utils/trace.js
var noopSpan = { end: () => {} };
var noopTracer = {
  startSpan: () => noopSpan,
  startActiveSpan: (_name, optionsOrFn, fn) => {
    const run = typeof optionsOrFn === "function" ? optionsOrFn : fn;
    return run(noopSpan);
  }
};
function withSpan(tracer, name, fn, options) {
  return tracer.startActiveSpan(name, options ?? {}, (span) => {
    try {
      const result = fn();
      if (result instanceof Promise) {
        return result.finally(() => span.end());
      }
      span.end();
      return result;
    } catch (error) {
      span.end();
      throw error;
    }
  });
}

// node_modules/comark/dist/internal/parse/tree-utils.js
var MAX_HIGHLIGHT_LINES = 1000;
function parseCodeblockInfo(info) {
  if (!info) {
    return {};
  }
  const result = {};
  let remaining = info.trim();
  const languageMatch = remaining.match(/^([^\s[{}"'<>`]+)/);
  if (languageMatch) {
    result.language = languageMatch[1];
    remaining = remaining.slice(languageMatch[1].length).trim();
  }
  while (remaining && (remaining.startsWith("{") || remaining.startsWith("["))) {
    if (remaining.startsWith("{")) {
      const highlightsMatch = remaining.match(/^\{([^}]+)\}/);
      if (highlightsMatch) {
        const highlightsStr = highlightsMatch[1];
        remaining = remaining.slice(highlightsMatch[0].length).trim();
        const highlights = [];
        const parts = highlightsStr.split(",");
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed.includes("-")) {
            const [start, end] = trimmed.split("-").map((s) => Number.parseInt(s.trim(), 10));
            if (!Number.isNaN(start) && !Number.isNaN(end) && end - start <= MAX_HIGHLIGHT_LINES) {
              for (let i = start;i <= end && highlights.length < MAX_HIGHLIGHT_LINES; i++) {
                highlights.push(i);
              }
            }
          } else {
            const num = Number.parseInt(trimmed, 10);
            if (!Number.isNaN(num) && highlights.length < MAX_HIGHLIGHT_LINES) {
              highlights.push(num);
            }
          }
        }
        if (highlights.length > 0) {
          result.highlights = highlights;
        }
      } else {
        break;
      }
    } else if (remaining.startsWith("[")) {
      let depth = 0;
      let i = 0;
      for (;i < remaining.length; i++) {
        if (remaining[i] === "[") {
          depth++;
        } else if (remaining[i] === "]") {
          depth--;
          if (depth === 0) {
            const filename = remaining.slice(1, i);
            result.filename = filename.replace(/\\\\/g, "");
            remaining = remaining.slice(i + 1).trim();
            break;
          }
        }
      }
      if (depth !== 0)
        break;
    }
  }
  if (remaining) {
    result.meta = remaining;
  }
  return result;
}
function processAttributes(attrsArray, options = {}) {
  const { handleJSON = true, filterEmpty = false } = options;
  const attrs = {};
  if (!attrsArray || !Array.isArray(attrsArray)) {
    return attrs;
  }
  for (const attr of attrsArray) {
    if (Array.isArray(attr) && attr.length >= 2) {
      const [key] = attr;
      let value = attr[1];
      if (filterEmpty && (value === "" || value === null || value === undefined)) {
        continue;
      }
      if (handleJSON && typeof value === "string") {
        if (value.startsWith("{") && value.endsWith("}")) {
          try {
            value = JSON.parse(value);
          } catch {}
        } else if (value.startsWith("[") && value.endsWith("]")) {
          try {
            value = JSON.parse(value);
          } catch {}
        }
      }
      if (key === "class" && typeof attrs[key] === "string") {
        attrs[key] = `${attrs[key]} ${value}`;
      } else {
        attrs[key] = value;
      }
    }
  }
  return attrs;
}
function extractAttributes(tokens, startIndex, skipEmptyText = true) {
  let propsIndex = startIndex;
  if (skipEmptyText) {
    while (propsIndex < tokens.length && tokens[propsIndex].type === "text" && !tokens[propsIndex].content?.trim()) {
      propsIndex++;
    }
  }
  if (propsIndex < tokens.length && tokens[propsIndex].type === "mdc_inline_props") {
    const propsToken = tokens[propsIndex];
    const attrs = processAttributes(propsToken.attrs);
    return { attrs, nextIndex: propsIndex + 1 };
  }
  return { attrs: {}, nextIndex: startIndex };
}
function mergeAdjacentTextNodes(nodes) {
  const merged = [];
  for (const node of nodes) {
    const lastNode = merged[merged.length - 1];
    if (typeof node === "string" && typeof lastNode === "string") {
      merged[merged.length - 1] = lastNode + node;
    } else {
      merged.push(node);
    }
  }
  return merged;
}

// node_modules/comark/dist/internal/heading-id.js
function createHeadingIdTracker(option = true) {
  if (option === false)
    return;
  return { nested: option === "nested", slugCounts: new Map, usedIds: new Set, stack: [] };
}
function slugify(text) {
  let slug = text.normalize("NFC").toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\p{L}\p{M}\p{Nd}\p{Nl}_-]+/gu, "").replace(/-{2,}/g, "-").replace(/^(?:\p{M}+|-+)+|-+$/gu, "");
  if (slug.charCodeAt(0) >= 48 && slug.charCodeAt(0) <= 57) {
    slug = "_" + slug;
  }
  return slug;
}
function reserveHeadingId(tracker, id) {
  if (typeof id === "string" && id)
    tracker.usedIds.add(id);
}
function nextHeadingId(text, level, tracker) {
  let slug = slugify(text);
  const { stack, slugCounts, usedIds } = tracker;
  if (tracker.nested) {
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    if (stack.length > 0) {
      const parent = stack[stack.length - 1];
      if (parent.level >= 2 && parent.id && slug) {
        slug = parent.id + "-" + slug;
      }
    }
    stack.push({ level, id: slug });
  }
  if (!slug)
    return;
  let count = slugCounts.get(slug) ?? 0;
  let id = count === 0 ? slug : `${slug}-${count}`;
  while (usedIds.has(id)) {
    count++;
    id = `${slug}-${count}`;
  }
  slugCounts.set(slug, count + 1);
  usedIds.add(id);
  return id;
}

// node_modules/comark/dist/internal/parse/tree.js
var inlineTags = new Set(["strong", "em", "del", "code", "a", "span", "sub", "sup", "kbd"]);
var WRAPPER_TAGS = new Set(["ul", "ol", "table", "blockquote", "pre"]);
function makeHtmlAttrs(attrs, block) {
  return {
    $: block ? { html: 1, block: 1 } : { html: 1, block: 0 },
    ...attrs
  };
}
function pushNode(nodes, node) {
  if (node[0] === "fragment")
    nodes.push(...node.slice(2));
  else
    nodes.push(node);
}
function isInlineish(node) {
  if (typeof node === "string")
    return true;
  if (!Array.isArray(node))
    return false;
  const tag = node[0];
  return tag === null || inlineTags.has(tag);
}
function flushPendingInline(frame) {
  if (frame.pendingInline.length === 0)
    return;
  const pending = frame.pendingInline;
  frame.pendingInline = [];
  frame.children.push(["p", {}, ...pending]);
}
function flattenText(nodes) {
  let out = "";
  for (const n of nodes) {
    if (typeof n === "string")
      out += n;
    else if (Array.isArray(n))
      out += flattenText(n.slice(2));
  }
  return out;
}
function frameToNode(frame) {
  flushPendingInline(frame);
  if (frame.tag === null) {
    const chunks = frame.children.map((c) => typeof c === "string" ? c : flattenText(Array.isArray(c) && c[0] === "p" ? c.slice(2) : [c]));
    const body = chunks.length > 0 ? `

${chunks.join(`

`)}

` : "";
    return [null, {}, body];
  }
  return [frame.tag, makeHtmlAttrs(frame.attrs, frame.block), ...frame.children];
}
function deliverBlock(state, node) {
  if (node === undefined)
    return;
  if (state.htmlStack.length === 0)
    return node;
  const top = state.htmlStack[state.htmlStack.length - 1];
  flushPendingInline(top);
  top.children.push(node);
  return;
}
function deliverInline(state, node) {
  if (node === undefined)
    return;
  if (state.htmlStack.length === 0)
    return node;
  const top = state.htmlStack[state.htmlStack.length - 1];
  if (top.block && isInlineish(node)) {
    top.pendingInline.push(node);
  } else {
    flushPendingInline(top);
    top.children.push(node);
  }
  return;
}
function tryCommentTag(content, state) {
  const top = state.htmlStack[state.htmlStack.length - 1];
  if (top?.tag === null && content.includes("-->")) {
    const i = content.indexOf("-->");
    if (i > 0)
      deliverInline(state, content.slice(0, i));
    const frame = state.htmlStack.pop();
    return { nextIndex: -1, node: frameToNode(frame) };
  }
  if (content.startsWith("<!--") && !content.includes("-->")) {
    const body = content.slice(4);
    state.htmlStack.push({ tag: null, attrs: {}, children: body ? [body] : [], block: true, pendingInline: [] });
    return { nextIndex: -1, node: undefined };
  }
  if (content.startsWith("<!--") && content.includes("-->")) {
    const end = content.indexOf("-->");
    return { nextIndex: -1, node: [null, {}, content.slice(4, end)] };
  }
  return null;
}
function processToken(tokens, i, state) {
  return processors[tokens[i].type]?.(tokens, i, state);
}
function processInline(inlineTokens, state, nestHtml = true) {
  const nodes = [];
  let i = 0;
  while (i < inlineTokens.length) {
    const result = processToken(inlineTokens, i, state);
    if (!result) {
      i += 1;
      continue;
    }
    const node = nestHtml ? deliverInline(state, result.node) : result.node;
    if (node !== undefined)
      pushNode(nodes, node);
    i = result.nextIndex;
  }
  return nodes;
}
function preserveLineNumber(tokens, node, start, nextIndex, state) {
  let endLine = state.startLine;
  if (!Array.isArray(node))
    return;
  for (let j = start;j < nextIndex; j++) {
    if (tokens[j].map && tokens[j].map?.[1]) {
      endLine = tokens[j].map?.[1] + state.startLine + (tokens[j].type?.endsWith("_close") ? 1 : 0);
    }
  }
  if (!node[1].$) {
    node[1].$ = {};
  }
  node[1].$.line = endLine;
}
function processChildren(tokens, start, closeType, state, nestHtml = false) {
  const children = [];
  let i = start + 1;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token.type === closeType) {
      return { children, nextIndex: i + 1 };
    }
    if (token.type === "inline") {
      children.push(...processInline(token.children ?? [], state, nestHtml));
      i += 1;
      continue;
    }
    const result = processToken(tokens, i, state);
    if (result) {
      const node = nestHtml ? deliverInline(state, result.node) : result.node;
      if (node !== undefined)
        pushNode(children, node);
      i = result.nextIndex;
    } else {
      i += 1;
    }
  }
  return { children, nextIndex: i };
}
function processPossibleAttributesSyntax(tokens, value) {
  const extractedAttributes = extractAttributes(tokens, value.nextIndex);
  if (value.nextIndex < extractedAttributes.nextIndex) {
    value.node[1] = Object.assign(value.node[1], extractedAttributes.attrs);
    value.nextIndex = extractedAttributes.nextIndex;
  }
  return value;
}
function processBlockChildrenWithSlots(tokens, start, closeType, state) {
  const nodes = [];
  let i = start + 1;
  let currentSlot = null;
  const flushSlot = () => {
    if (!currentSlot)
      return;
    nodes.push([currentSlot.tag, currentSlot.attrs, ...mergeAdjacentTextNodes(currentSlot.children)]);
    currentSlot = null;
  };
  const pushChild = (node) => {
    if (node === undefined)
      return;
    pushNode(currentSlot ? currentSlot.children : nodes, node);
  };
  while (i < tokens.length) {
    const token = tokens[i];
    if (token.type === closeType) {
      flushSlot();
      return { children: nodes, nextIndex: i + 1 };
    }
    if (token.type === "mdc_block_slot_open") {
      flushSlot();
      currentSlot = {
        tag: token.tag || "template",
        attrs: processAttributes(token.attrs),
        children: []
      };
      i += 1;
      continue;
    }
    if (token.type === "mdc_block_slot_close") {
      i += 1;
      continue;
    }
    if (token.type === "inline") {
      const free = processInline(token.children ?? [], state);
      if (currentSlot)
        currentSlot.children.push(...free);
      else
        nodes.push(...free);
      i += 1;
      continue;
    }
    const result = processToken(tokens, i, state);
    if (result) {
      pushChild(result.node);
      i = result.nextIndex;
    } else {
      i += 1;
    }
  }
  flushSlot();
  return { children: nodes, nextIndex: i };
}
function processMdcBlock(tokens, start, state) {
  const open = tokens[start];
  state.insideMarkdownContainer += 1;
  const { children, nextIndex } = processBlockChildrenWithSlots(tokens, start, "mdc_block_close", state);
  state.insideMarkdownContainer -= 1;
  const attrs = processAttributes(open.attrs);
  let node = [open.tag || "div", attrs, ...mergeAdjacentTextNodes(children)];
  if (WRAPPER_TAGS.has(node[0])) {
    if (children.length === 1 && children[0][0] === node[0]) {
      node = node[2];
      node[1] = { ...node[1], ...attrs };
    }
  }
  return processPossibleAttributesSyntax(tokens, {
    nextIndex,
    node
  });
}
function codeBlockProcessor(tokens, start, _state) {
  const token = tokens[start];
  const content = token.content || "";
  const info = token.info || token.params || "";
  const parsed = parseCodeblockInfo(info);
  const preAttrs = parsed;
  const codeAttrs = {};
  if (parsed.language && parsed.language.trim()) {
    preAttrs.language = parsed.language;
    codeAttrs["class"] = `language-${parsed.language}`;
  }
  const codeContentWithoutLastNewline = content.endsWith(`
`) ? content.slice(0, -1) : content;
  return {
    nextIndex: start + 1,
    node: ["pre", preAttrs, ["code", codeAttrs, codeContentWithoutLastNewline]]
  };
}
function singleToken(fn) {
  return (tokens, start) => processPossibleAttributesSyntax(tokens, { nextIndex: start + 1, node: fn(tokens[start]) });
}
function withHtmlScope(state, fn) {
  const outerStack = state.htmlStack;
  const outerContainer = state.insideMarkdownContainer;
  state.htmlStack = [];
  state.insideMarkdownContainer = 0;
  try {
    const result = fn();
    while (state.htmlStack.length > 0) {
      const frame = state.htmlStack.pop();
      frame.block = true;
      const node = frameToNode(frame);
      if (state.htmlStack.length > 0)
        state.htmlStack[state.htmlStack.length - 1].children.push(node);
      else
        result.children.push(node);
    }
    return result;
  } finally {
    state.htmlStack = outerStack;
    state.insideMarkdownContainer = outerContainer;
  }
}
function openCloseToken(closeType, tag = "", nest = false) {
  return (tokens, start, state) => {
    const open = tokens[start];
    const { children, nextIndex } = nest ? withHtmlScope(state, () => processChildren(tokens, start, closeType, state, true)) : processChildren(tokens, start, closeType, state);
    const attrs = processAttributes(open.attrs);
    return processPossibleAttributesSyntax(tokens, {
      nextIndex,
      node: [tag || open.tag, attrs, ...mergeAdjacentTextNodes(children)]
    });
  };
}
var processors = {
  mdc_block_slot_open: openCloseToken("mdc_block_slot_close"),
  mdc_inline_span_open: openCloseToken("mdc_inline_span_close"),
  mdc_block_shorthand_open: openCloseToken("mdc_block_shorthand_close"),
  mdc_inline_component_open: openCloseToken("mdc_inline_component_close"),
  blockquote_open: openCloseToken("blockquote_close", "", true),
  bullet_list_open: openCloseToken("bullet_list_close", "", true),
  ordered_list_open: openCloseToken("ordered_list_close", "", true),
  list_item_open: openCloseToken("list_item_close", "", true),
  strong_open: openCloseToken("strong_close"),
  link_open: openCloseToken("link_close"),
  em_open: openCloseToken("em_close"),
  table_open: openCloseToken("table_close", "", true),
  thead_open: openCloseToken("thead_close", "", true),
  tbody_open: openCloseToken("tbody_close", "", true),
  tr_open: openCloseToken("tr_close", "", true),
  th_open: openCloseToken("th_close", "", true),
  td_open: openCloseToken("td_close", "", true),
  sub_open: openCloseToken("sub_close"),
  sup_open: openCloseToken("sup_close"),
  s_open: openCloseToken("s_close", "del"),
  mdc_block_open: processMdcBlock,
  code_inline: singleToken((t) => ["code", {}, t.content]),
  math_inline: singleToken((t) => ["math", { class: "math inline", content: t.content }, t.content]),
  math_block: singleToken((t) => ["math", { class: "math block", content: t.content }, t.content]),
  emoji: singleToken((t) => t.content),
  hr: singleToken(() => ["hr", {}]),
  hardbreak: singleToken(() => ["br", {}]),
  reference: (_, s) => ({ node: undefined, nextIndex: s + 1 }),
  softbreak: (tokens, start, state) => ({
    nextIndex: start + 1,
    node: state.htmlStack.length > 0 || tokens[start - 1].type === "html_inline" ? undefined : `
`
  }),
  code_block: codeBlockProcessor,
  fenced_code_block: codeBlockProcessor,
  fence: codeBlockProcessor,
  mdc_block_shorthand: singleToken((t) => [t.tag, processAttributes(t.attrs)]),
  heading_open(tokens, start, state) {
    const { nextIndex, node } = openCloseToken("heading_close")(tokens, start, state);
    if (node.length === 2)
      return { node: undefined, nextIndex };
    if (state.headingIds) {
      const level = Number.parseInt((tokens[start].tag || "h1").replace("h", ""), 10) || 1;
      const headingId = nextHeadingId(textContent(node), level, state.headingIds);
      reserveHeadingId(state.headingIds, node[1].id);
      if (headingId) {
        node[1] = { id: headingId, ...node[1] };
      }
    }
    return { nextIndex, node };
  },
  paragraph_open(tokens, start, state) {
    const inline = tokens[start + 1];
    const depthBefore = state.htmlStack.length;
    const nestHtml = state.insideMarkdownContainer === 0;
    const { children, nextIndex } = processChildren(tokens, start, "paragraph_close", state, nestHtml);
    const asParagraph = () => children.length === 0 ? { nextIndex, node: undefined } : {
      nextIndex,
      node: ["p", processAttributes(tokens[start].attrs), ...mergeAdjacentTextNodes(children)]
    };
    const freeSiblings = (asSiblingOfStack) => {
      if (children.length === 0)
        return { nextIndex, node: undefined };
      const node = children.length === 1 ? children[0] : ["fragment", {}, ...children];
      return { nextIndex, node, siblingOfHtmlStack: asSiblingOfStack || undefined };
    };
    if (depthBefore > 0 && state.htmlStack.length === 0) {
      if (children.length === 1 && Array.isArray(children[0])) {
        return { nextIndex, node: children[0] };
      }
      return asParagraph();
    }
    if (state.htmlStack.length > 0) {
      if (nestHtml) {
        for (const frame of state.htmlStack)
          flushPendingInline(frame);
        return freeSiblings(children.length > 0);
      }
      return asParagraph();
    }
    const empty = asParagraph();
    if (empty.node === undefined)
      return empty;
    const result = processPossibleAttributesSyntax(tokens, { nextIndex, node: empty.node });
    const final = result.node;
    const canUnwrap = Array.isArray(final) && final.length === 3 && Array.isArray(final[2]) && inline?.type === "inline" && inline.children?.[0]?.type === "html_inline" && (!inlineTags.has(final[2]?.[0]) || Boolean(empty.node[2][1]?.$?.block));
    if (canUnwrap) {
      const unwrapped = final[2];
      if (unwrapped[1].$) {
        unwrapped[1].$.block = 1;
      }
      return { nextIndex: result.nextIndex, node: unwrapped };
    }
    if (result.node.every((n, i) => i < 2 || n?.[1]?.$?.html)) {
      result.node[0] = "fragment";
    }
    return result;
  },
  mdc_inline_component(tokens, start) {
    const token = tokens[start];
    const tokenAttrs = processAttributes(token.attrs);
    const { attrs, nextIndex } = extractAttributes(tokens, start + 1, false);
    return { node: [token.tag, { ...tokenAttrs, ...attrs }], nextIndex };
  },
  image(tokens, start) {
    const token = tokens[start];
    const attrs = processAttributes(token.attrs, { handleJSON: false, filterEmpty: true });
    if (token.content) {
      attrs.alt = token.content;
    }
    return processPossibleAttributesSyntax(tokens, { node: ["img", attrs], nextIndex: start + 1 });
  },
  text(tokens, start, state) {
    const content = tokens[start].content;
    if (content === "")
      return { nextIndex: start + 1, node: undefined };
    const comment = tryCommentTag(content, state);
    if (comment)
      return { nextIndex: start + 1, node: comment.node };
    return { nextIndex: start + 1, node: content };
  },
  html_inline(tokens, start, state) {
    const raw = tokens[start].content || "";
    const parsed = parseHtmlInline(raw);
    if (parsed.kind === "comment") {
      return { nextIndex: start + 1, node: [null, {}, parsed.content] };
    }
    if (parsed.kind === "other") {
      const comment = tryCommentTag(raw, state);
      if (comment)
        return { nextIndex: start + 1, node: comment.node };
      return { nextIndex: start + 1, node: [null, {}, raw] };
    }
    if (parsed.kind === "close") {
      const closeTag = parsed.tag.toLowerCase();
      let idx = state.htmlStack.length - 1;
      while (idx >= 0) {
        const frameTag = state.htmlStack[idx].tag;
        if (frameTag !== null && frameTag.toLowerCase() === closeTag)
          break;
        idx--;
      }
      if (idx < 0)
        return { nextIndex: start + 1, node: undefined };
      let closed;
      while (state.htmlStack.length > idx) {
        const node = frameToNode(state.htmlStack.pop());
        if (state.htmlStack.length > idx) {
          deliverInline(state, node);
        } else {
          closed = node;
        }
      }
      return { nextIndex: start + 1, node: closed };
    }
    if (parsed.selfClosing) {
      return {
        nextIndex: start + 1,
        node: [parsed.tag, makeHtmlAttrs(parsed.attrs, false)]
      };
    }
    state.htmlStack.push({
      tag: parsed.tag,
      attrs: parsed.attrs,
      children: [],
      block: false,
      pendingInline: []
    });
    return { nextIndex: start + 1, node: undefined };
  }
};
function tokenListToTree(tokens, options = {}) {
  const state = {
    preservePositions: options.preservePositions ?? false,
    headingIds: createHeadingIdTracker(options.headingIds ?? true),
    startLine: options.startLine ?? 0,
    htmlStack: [],
    insideMarkdownContainer: 0
  };
  const nodes = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token.type === "inline") {
      const free = processInline(token.children ?? [], state);
      if (state.htmlStack.length > 0) {
        for (const n of free)
          state.htmlStack[state.htmlStack.length - 1].children.push(n);
      } else {
        nodes.push(...free);
      }
      i += 1;
      continue;
    }
    const result = processToken(tokens, i, state);
    if (result) {
      for (const frame of state.htmlStack)
        frame.block = true;
      if (result.node !== undefined) {
        if (state.preservePositions) {
          preserveLineNumber(tokens, result.node, i, result.nextIndex, state);
        }
        if (result.siblingOfHtmlStack) {
          pushNode(nodes, result.node);
        } else {
          const free = deliverBlock(state, result.node);
          if (free !== undefined)
            pushNode(nodes, free);
        }
      }
      i = result.nextIndex;
    } else {
      nodes.push([token.tag || "component", processAttributes(token.attrs, { handleJSON: false })]);
      i += 1;
    }
  }
  while (state.htmlStack.length > 0) {
    const frame = state.htmlStack.pop();
    frame.block = true;
    const node = frameToNode(frame);
    if (state.htmlStack.length > 0) {
      state.htmlStack[state.htmlStack.length - 1].children.push(node);
    } else {
      nodes.push(node);
    }
  }
  return nodes;
}

// node_modules/comark/dist/parse.js
var MAX_SHARED_PARSERS = 32;
var nextPluginId = 0;
var pluginIds = new WeakMap;
var sharedParsers = new Map;
function createMarkdownParser(options = {}) {
  const { autoUnwrap = true, autoClose = true, tracer = noopTracer } = options;
  const unwrapTags = resolveUnwrapTags(options.unwrap);
  const userPlugins = options.plugins ?? [];
  if (options.html !== undefined) {
    console.warn("[comark] `ParserOptions.html` is deprecated and will be removed in a future major version. " + "Use `registerDefaultPlugins: false` and register `html()` from `comark/plugins/html` only when needed.");
  }
  const defaultPlugins = options.registerDefaultPlugins !== false ? [
    frontmatter_default(),
    ...options.html !== false ? [html_default()] : [],
    alert_default(),
    task_list_default(),
    components_default(),
    attributes_default()
  ] : [];
  const plugins = dedupePlugins(defaultPlugins, userPlugins);
  const hasPlugin = (name) => plugins.some((plugin) => plugin.name === name);
  const mdPlugins = [];
  for (const plugin of plugins) {
    for (const markdownItPlugin of plugin.markdownItPlugins || []) {
      mdPlugins.push(markdownItPlugin);
    }
  }
  const linkify = options.linkify ?? true;
  const key = [
    linkify,
    ...mdPlugins.map((fn) => pluginIds.get(fn) ?? (pluginIds.set(fn, nextPluginId), nextPluginId++))
  ].join(",");
  let parser = sharedParsers.get(key);
  if (parser) {
    sharedParsers.delete(key);
    sharedParsers.set(key, parser);
  } else {
    parser = new src_default({ linkify }).enable(["table", "strikethrough"]);
    for (const fn of mdPlugins)
      parser.use(fn);
    if (sharedParsers.size >= MAX_SHARED_PARSERS) {
      const oldestKey = sharedParsers.keys().next().value;
      if (oldestKey !== undefined)
        sharedParsers.delete(oldestKey);
    }
    sharedParsers.set(key, parser);
  }
  let lastOutput = null;
  let lastInput = null;
  const parseFn = async (markdown, opts = {}) => {
    return await withSpan(tracer, "comark:parse", async () => {
      const state = {
        options,
        tokens: [],
        markdown,
        tree: null,
        parsedLines: 0,
        reusableNodes: [],
        frontmatterText: "",
        frontmatter: {}
      };
      const prevOutput = lastOutput;
      const isStartsWithLastInput = markdown.startsWith(lastInput ?? "");
      if (opts.streaming && prevOutput && isStartsWithLastInput && !markdown.includes("]:")) {
        const { remainingMarkdownStartLine, reusedNodes, remainingMarkdown } = extractReusableNodes(markdown, prevOutput);
        if (!remainingMarkdown)
          return prevOutput;
        if (!/#|(?:^|\n)[^\n]*[=-][ \t]*\r?(?:\n|$)/.test(remainingMarkdown)) {
          state.parsedLines = remainingMarkdownStartLine;
          state.markdown = remainingMarkdown;
          state.reusableNodes = reusedNodes;
        }
      }
      if (typeof autoClose === "function") {
        state.markdown = withSpan(tracer, "comark:autoclose", () => autoClose(state.markdown));
      } else if (autoClose) {
        state.markdown = withSpan(tracer, "comark:autoclose", () => autoCloseMarkdown(state.markdown, {
          frontmatter: hasPlugin("frontmatter") && opts.streaming,
          syntax: hasPlugin("components"),
          attributes: hasPlugin("components") || hasPlugin("attributes"),
          math: hasPlugin("math"),
          dropTrailingOpeners: opts.streaming === true
        }));
      }
      for (const plugin of plugins) {
        if (!plugin.pre)
          continue;
        await withSpan(tracer, `comark:pre:${plugin.name}`, () => plugin.pre(state));
      }
      try {
        state.tokens = withSpan(tracer, "comark:tokenize", () => parser.parse(state.markdown, {}));
      } catch (e) {
        if (opts.streaming && prevOutput) {
          return prevOutput;
        }
        throw e;
      }
      for (const plugin of plugins) {
        if (!plugin.markdownItPost)
          continue;
        withSpan(tracer, `comark:markdownItPost:${plugin.name}`, () => plugin.markdownItPost(state));
      }
      const nodesSpan = tracer.startSpan("comark:nodes");
      let nodes = tokenListToTree(state.tokens, {
        startLine: state.parsedLines,
        preservePositions: opts.streaming ?? false,
        headingIds: options.headingIds ?? true
      });
      if (autoUnwrap) {
        nodes = nodes.map((node) => applyAutoUnwrap(node));
      }
      if (unwrapTags.length > 0) {
        nodes = applyUnwrap(nodes, unwrapTags);
      }
      nodesSpan.end();
      const frontmatterData = state.frontmatter ?? {};
      const frontmatterText = state.frontmatterText ?? "";
      if (opts.streaming) {
        state.tree = {
          frontmatter: frontmatterText || !isStartsWithLastInput ? frontmatterData : prevOutput?.frontmatter ?? frontmatterData,
          meta: {},
          nodes: [...state.reusableNodes, ...nodes]
        };
        lastOutput = state.tree;
        lastInput = markdown;
      } else {
        state.tree = {
          frontmatter: frontmatterData,
          meta: {},
          nodes
        };
        lastOutput = null;
        lastInput = null;
      }
      for (const plugin of plugins) {
        if (!plugin.post)
          continue;
        await withSpan(tracer, `comark:post:${plugin.name}`, () => plugin.post(state));
      }
      return state.tree;
    });
  };
  return parseFn;
}

// node_modules/comark/dist/internal/stringify/handlers/code.js
function code2(node, _state) {
  const [_, attributes] = node;
  const attrs = userBlockAttrs("code", attributes);
  const attrsString = Object.keys(attrs).length > 0 ? comarkAttributes(attrs) : "";
  const content = textContent(node);
  const fence = content.includes("`") ? "``" : "`";
  return `${fence}${content}${fence}${attrsString}`;
}

// node_modules/comark/dist/internal/stringify/handlers/pre.js
function pre(node, state) {
  const [_, attributes, ...children] = node;
  const codeClasses = children[0]?.[1]?.class;
  const language = attributes.language || codeClasses?.split(" ").find((cls) => cls.startsWith("language-"))?.slice(9) || "";
  const filename = attributes.filename ? " [" + String(attributes.filename).split("]").join("\\\\]") + "]" : "";
  const highlights = attributes.highlights ? " {" + formatHighlights(attributes.highlights) + "}" : "";
  const meta = attributes.meta ? " " + attributes.meta : "";
  const code = String(node[1]?.code || textContent(node)).trimEnd();
  const fence = pickFence(code);
  const fenceBlock = fence + language + filename + highlights + meta + `
` + code + `
` + fence;
  const attrs = comarkAttributes(userBlockAttrs("pre", attributes));
  if (attrs) {
    return `::pre${attrs}
${fenceBlock}
::` + state.context.blockSeparator;
  }
  return fenceBlock + state.context.blockSeparator;
}
function formatHighlights(highlights) {
  if (highlights.length === 0)
    return "";
  const sorted = [...highlights].sort((a, b) => a - b);
  const ranges = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1;i <= sorted.length; i++) {
    if (i < sorted.length && sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      if (start === end) {
        ranges.push(String(start));
      } else {
        ranges.push(start + "-" + end);
      }
      if (i < sorted.length) {
        start = sorted[i];
        end = sorted[i];
      }
    }
  }
  return ranges.join(",");
}

// node_modules/comark/dist/internal/stringify/handlers/hr.js
function hr2(_n, state, parent) {
  if (parent?.[0] === "p") {
    return ":hr";
  }
  return "---" + state.context.blockSeparator;
}

// node_modules/comark/dist/internal/stringify/handlers/heading.js
var trackers = new WeakMap;
function autoHeadingId(node, level, state, id) {
  let tracker = trackers.get(state);
  if (tracker === undefined) {
    tracker = createHeadingIdTracker(state.context.headingIds) ?? null;
    trackers.set(state, tracker);
  }
  if (!tracker)
    return;
  const text = node.slice(2).map((child) => textContent(child)).join("");
  const autoId = nextHeadingId(text, level, tracker);
  reserveHeadingId(tracker, id);
  return autoId;
}
async function heading3(node, state) {
  const [tag] = node;
  const level = Number(tag.slice(1));
  const content = await state.flow(node, state);
  const { id, ...rest } = node[1];
  const autoId = autoHeadingId(node, level, state, id);
  const attrs = comarkAttributes(id === undefined || id === autoId ? rest : { id, ...rest });
  const suffix = attrs ? ` ${attrs}` : "";
  return "#".repeat(level) + " " + content + suffix + state.context.blockSeparator;
}

// node_modules/comark/dist/internal/stringify/handlers/p.js
async function p(node, state, parent) {
  const children = node.slice(2);
  let result = "";
  for (const child of children) {
    result += await state.one(child, state, node, result === "" || result.endsWith(`
`));
  }
  const attrs = comarkAttributes(node[1]);
  if (attrs)
    result = `${result.replace(/[ \t]+$/, "")} ${attrs}`;
  if (parent?.[0] === "li") {
    return result;
  }
  return result + state.context.blockSeparator;
}

// node_modules/comark/dist/internal/stringify/handlers/a.js
async function a(node, state) {
  const [_, attrs] = node;
  const { href, ...rest } = attrs;
  const attrsString = Object.keys(rest).length > 0 ? comarkAttributes(rest) : "";
  const content = await state.flow(node, state);
  if (content === href && !attrsString) {
    return `<${href}>`;
  }
  return `[${content}](${href})${attrsString}`;
}

// node_modules/comark/dist/internal/stringify/handlers/ul.js
async function ul(node, state) {
  const children = node.slice(2);
  const revert = state.applyContext({ list: true, order: false, listIndent: 2 });
  let result = "";
  for (const child of children) {
    result += await state.one(child, state);
  }
  result = result.trim();
  state.applyContext(revert);
  const attrs = comarkAttributes(userBlockAttrs("ul", node[1]));
  if (attrs) {
    if (revert.list) {
      return `
` + indent(`::ul${attrs}
${result}
::`, { width: revert.listIndent || 2 });
    }
    return `::ul${attrs}
${result}
::` + state.context.blockSeparator;
  }
  if (revert.list) {
    result = `
` + indent(result, { width: revert.listIndent || 2 });
  } else {
    result = result + state.context.blockSeparator;
  }
  return result;
}

// node_modules/comark/dist/internal/stringify/handlers/ol.js
async function ol(node, state) {
  const children = node.slice(2);
  const start = Number(node[1].start);
  const order = Number.isInteger(start) && start >= 1 ? start : 1;
  const revert = state.applyContext({ list: true, order, listIndent: 3 });
  let result = "";
  for (const child of children) {
    result += await state.one(child, state);
  }
  result = result.trim();
  state.applyContext(revert);
  const attrs = comarkAttributes(userBlockAttrs("ol", node[1]));
  if (attrs) {
    if (revert.list) {
      return `
` + indent(`::ol${attrs}
${result}
::`, { width: revert.listIndent || 2 });
    }
    return `::ol${attrs}
${result}
::` + state.context.blockSeparator;
  }
  if (revert.list) {
    result = `
` + indent(result, { width: revert.listIndent || 2 });
  } else {
    result = result + state.context.blockSeparator;
  }
  return result;
}

// node_modules/comark/dist/internal/stringify/handlers/li.js
var blockElements = new Set(["pre", "blockquote", "table"]);
async function li(node, state) {
  const children = node.slice(2);
  const order = state.context.order;
  let prefix = order ? `${order}. ` : "- ";
  const className = node[1].className && Array.isArray(node[1].className) ? node[1].className.join(" ") : String(node[1].className || node[1].class);
  const taskList = className.includes("task-list-item");
  if (taskList) {
    const input = children.shift();
    prefix += input[1].checked || input[1][":checked"] ? "[x] " : "[ ] ";
  }
  const prefixWidth = prefix.length;
  const hasInlineContent = children.some((child) => typeof child === "string");
  let result = "";
  for (const child of children) {
    if (Array.isArray(child)) {
      const tag = child[0];
      if (result && blockElements.has(tag)) {
        const indented = indent(await state.one(child, state, node), { width: prefixWidth });
        result = result.trimEnd() + `
` + indented.trimEnd() + `
`;
        continue;
      }
      if (result && tag === "p") {
        const indented = indent(await state.one(child, state, node), { width: prefixWidth });
        result = result.trimEnd() + `

` + indented.trimEnd() + `
`;
        continue;
      }
      if (!hasInlineContent && !(tag in state.handlers)) {
        const indented = indent(await state.one(child, state), { width: prefixWidth, ignoreFirstLine: !result });
        result = result ? result.trimEnd() + `
` + indented.trimEnd() + `
` : indented.trimEnd() + `
`;
        continue;
      }
    }
    result += await state.one(child, state, node, result === "" || result.endsWith(`
`));
  }
  result = result.trim();
  const attrs = comarkAttributes(userBlockAttrs("li", node[1]));
  const suffix = attrs ? ` ${attrs}` : "";
  if (order) {
    state.applyContext({ order: order + 1 });
  }
  return `${prefix}${result}${suffix}
`;
}

// node_modules/comark/dist/internal/stringify/handlers/html.js
var textBlocks = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "td", "th"]);
var selfCloseTags = new Set(["br", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
var inlineTags2 = new Set(["strong", "em", "del", "code", "a", "br", "span", "img"]);
var blockTags = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "ul",
  "ol",
  "blockquote",
  "hr",
  "table",
  "td",
  "th"
]);
async function html(node, state, parent) {
  const [tag, attr, ...children] = node;
  const { $ = {}, ...rawAttributes } = attr;
  const rawHasAttrs = Object.keys(rawAttributes).length > 0;
  const attributes = state.context.html ? rawHasAttrs ? state.renderData.props : rawAttributes : rawAttributes;
  const hasOnlyTextChildren = children.every((child) => typeof child === "string" || inlineTags2.has(String(child?.[0])));
  const hasTextSibling = children.some((child) => typeof child === "string");
  const isBlock = textBlocks.has(String(tag));
  const isInline = inlineTags2.has(String(tag)) && $.block === 0;
  let oneLiner = isBlock && hasOnlyTextChildren;
  if (!oneLiner && inlineTags2.has(String(tag)) && hasOnlyTextChildren) {
    oneLiner = true;
  }
  if (tag === "pre") {
    oneLiner = true;
  }
  if (parent?.[0] === "p" || state.context.inline) {
    oneLiner = true;
  }
  if ($.block === 0) {
    oneLiner = true;
  }
  const isSelfClose = selfCloseTags.has(String(tag));
  const revert = state.applyContext({ inline: oneLiner });
  const childrenContent = [];
  for (const child of children) {
    childrenContent.push(await state.one(child, state, node));
  }
  const childSeparator = state.context.html ? state.context.blockSeparator : oneLiner ? "" : `
`;
  let content = "";
  let isPrevBlock = true;
  for (let i = 0;i < children.length; i++) {
    const childContent = childrenContent[i];
    const child = children[i];
    const isBlock = typeof child !== "string" && (blockTags.has(String(child?.[0])) || !inlineTags2.has(String(child?.[0])) && !hasTextSibling);
    if (i > 0 && !isPrevBlock && isBlock) {
      content += childSeparator;
    }
    content += childContent;
    isPrevBlock = isBlock;
    if (isBlock && i < children.length - 1) {
      content += childSeparator;
    }
  }
  if (revert) {
    state.applyContext(revert);
  }
  const nativeAttributes = toNativeAttributes(String(tag), node, attributes);
  const attrs = Object.keys(nativeAttributes).length > 0 ? ` ${htmlAttributes(nativeAttributes)}` : "";
  if (isSelfClose) {
    return `<${tag}${attrs}>` + (!parent && !isInline ? state.context.blockSeparator : "");
  }
  if (!oneLiner && content) {
    content = `
` + paddNoneHtmlContent(content, state, String(tag)).trimEnd() + `
`;
  }
  return `<${tag}${attrs}>${content}</${tag}>` + (!parent && !isInline ? state.context.blockSeparator : "");
}
var LITERAL_CONTENT_TAGS = new Set(["code", "kbd", "pre", "samp", "script", "style", "textarea", "var"]);
function paddNoneHtmlContent(content, state, tag) {
  if (state.context.html) {
    if (LITERAL_CONTENT_TAGS.has(tag.toLowerCase()))
      return content;
    return indent(content);
  }
  return (content.trim().startsWith("<") ? "" : "") + content + (content.trim().endsWith(">") ? "" : "");
}

// node_modules/comark/dist/internal/stringify/handlers/strong.js
async function strong(node, state) {
  const [_, attrs, ...children] = node;
  let content = "";
  for (const child of children) {
    content += await state.one(child, state, node);
  }
  content = content.trim();
  const attrsString = Object.keys(attrs).length > 0 ? comarkAttributes(attrs) : "";
  return `**${content}**${attrsString}`;
}

// node_modules/comark/dist/internal/stringify/handlers/emphesis.js
async function emphesis(node, state) {
  const [_, attrs, ...children] = node;
  let content = "";
  for (const child of children) {
    content += await state.one(child, state, node);
  }
  content = content.trim();
  const attrsString = Object.keys(attrs).length > 0 ? comarkAttributes(attrs) : "";
  return `*${content}*${attrsString}`;
}

// node_modules/comark/dist/internal/stringify/handlers/blockquote.js
async function blockquote2(node, state) {
  const children = node.slice(2);
  let childResult = "";
  for (const child of children) {
    childResult += await state.one(child, state, node, childResult === "" || childResult.endsWith(`
`));
  }
  const userAttrs = userBlockAttrs("blockquote", node[1]);
  const attrs = comarkAttributes(userAttrs);
  const hasBlockChildren = children.some((c) => Array.isArray(c));
  if (attrs && hasBlockChildren) {
    const content = childResult.trim().split(`
`).map((line) => line ? `> ${line}` : ">").join(`
`);
    return `::blockquote${attrs}
${content}
::` + state.context.blockSeparator;
  }
  if (attrs)
    childResult = `${childResult.replace(/[ \t]+$/, "")} ${attrs}`;
  const content = childResult.trim().split(`
`).map((line) => line ? `> ${line}` : ">").join(`
`);
  if (node[1].as) {
    return `> [!${String(node[1].as).toUpperCase()}]
` + content + state.context.blockSeparator;
  }
  return content + state.context.blockSeparator;
}

// node_modules/comark/dist/internal/stringify/handlers/img.js
function img(node, _state) {
  const [_, attrs] = node;
  const { title, src, alt = "", ...rest } = attrs;
  const attrsString = Object.keys(rest).length > 0 ? comarkAttributes(rest) : "";
  const link = title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
  return `${link}${attrsString}`;
}

// node_modules/comark/dist/internal/stringify/handlers/del.js
async function del(node, state) {
  const [_, attrs, ...children] = node;
  let content = "";
  for (const child of children) {
    content += await state.one(child, state, node);
  }
  content = content.trim();
  const attrsString = Object.keys(attrs).length > 0 ? comarkAttributes(attrs) : "";
  return `~~${content}~~${attrsString}`;
}

// node_modules/comark/dist/internal/stringify/handlers/mdc.js
var INLINE_HTML_ELEMENTS = new Set(["a", "strong", "em", "span"]);
async function mdc(node, state, parent) {
  const [tag, attr, ...children] = node;
  const { $: _, ...attributes } = attr;
  if (tag === "table") {
    return html(node, state);
  }
  const attributeEntries = Object.entries(attributes);
  const hasObjectAttributes = attributeEntries.some(([, value]) => typeof value === "object");
  const hasTextSiblings = parent?.some((child, index) => index > 1 && typeof child === "string") ?? false;
  const insideInlineElement = parent !== undefined && INLINE_HTML_ELEMENTS.has(String(parent[0]));
  let inline = hasTextSiblings || insideInlineElement || state.context.inline === true;
  if (hasObjectAttributes) {
    inline = false;
  }
  const revert = inline ? state.applyContext({ inline: true }) : undefined;
  let content = "";
  const childState = { ...state, nodeDepthInTree: (state.nodeDepthInTree || 0) + 1 };
  for (const child of children) {
    content += await state.one(child, childState, node);
  }
  content = content.trimEnd();
  if (revert) {
    state.applyContext(revert);
  }
  let attrs = attributeEntries.length > 0 ? comarkAttributes(attributes) : "";
  if (tag === "span") {
    if (!attrs && parent?.[0] == "a") {
      attrs ||= "{}";
    }
    return `[${content}]${attrs}` + (inline ? "" : state.context.blockSeparator);
  }
  const fence = ":".repeat((state.nodeDepthInTree || 0) + 2);
  let result = `:${tag}${content && `[${content}]`}${attrs}` + (!parent ? state.context.blockSeparator : "");
  if (!inline) {
    const maxInlineAttributes = state.context.maxInlineAttributes ?? 3;
    const useYaml = hasObjectAttributes || maxInlineAttributes === 0 || attributeEntries.length > maxInlineAttributes;
    if (useYaml) {
      const yamlAttrs = comarkYamlAttributes(attributes, state.context.blockAttributesStyle);
      result = `${fence}${tag}
${yamlAttrs}${content ? `
${content}` : ""}
${fence}` + state.context.blockSeparator;
    } else {
      result = `${fence}${tag}${attrs}${content ? `
${content}` : ""}
${fence}` + state.context.blockSeparator;
    }
  }
  return inline ? result : indent(result, { level: parent ? 1 : 0 });
}

// node_modules/comark/dist/internal/stringify/handlers/br.js
function br(_n, _state) {
  return `  
`;
}

// node_modules/comark/dist/internal/stringify/handlers/template.js
async function template(node, state, parent) {
  const [_, attrs] = node;
  const content = (await state.flow(node, state)).trimEnd();
  if (attrs.name === "default") {
    const siblings = parent ? parent.slice(2) : [];
    const templateCount = siblings.filter((child) => Array.isArray(child) && child[0] === "template").length;
    if (templateCount === 1) {
      return content + state.context.blockSeparator;
    }
  }
  const { name: _name, $: _$, ...rest } = attrs;
  const extraAttrs = comarkAttributes(rest);
  return `#${attrs.name}${extraAttrs}
${content}` + state.context.blockSeparator;
}

// node_modules/comark/dist/internal/stringify/handlers/table.js
function getAlignment(attributes) {
  const style = attributes.style;
  if (typeof style !== "string") {
    return null;
  }
  const normalized = style.toLowerCase().split(" ").join("").split("\t").join("");
  if (normalized.includes("text-align:left")) {
    return "left";
  }
  if (normalized.includes("text-align:center")) {
    return "center";
  }
  if (normalized.includes("text-align:right")) {
    return "right";
  }
  return null;
}
async function getCellContent(cell, state) {
  if (typeof cell === "string") {
    return escapePipes(cell);
  }
  const [, , ...children] = cell;
  let content = "";
  for (const child of children) {
    if (typeof child === "string") {
      content += child;
    } else {
      content += await state.one(child, state, cell);
    }
  }
  return escapePipes(content.trim());
}
function escapePipes(text) {
  return text.split(`
`).join(" ").split("|").join("\\|");
}
function getRows(element) {
  if (typeof element === "string") {
    return [];
  }
  const [tag, , ...children] = element;
  if (tag === "tr") {
    return [element];
  }
  if (tag === "thead" || tag === "tbody") {
    return children.filter((child) => typeof child !== "string" && child[0] === "tr");
  }
  return [];
}
function getCells(row) {
  const [, , ...children] = row;
  return children.filter((child) => typeof child !== "string" && (child[0] === "th" || child[0] === "td"));
}
async function table2(node, state) {
  const [, , ...children] = node;
  let headerRows = [];
  let bodyRows = [];
  for (const child of children) {
    if (typeof child === "string")
      continue;
    const [tag] = child;
    if (tag === "thead") {
      headerRows = getRows(child);
    } else if (tag === "tbody") {
      bodyRows = getRows(child);
    } else if (tag === "tr") {
      const cells = getCells(child);
      if (cells.length > 0 && cells[0][0] === "th") {
        headerRows.push(child);
      } else {
        bodyRows.push(child);
      }
    }
  }
  if (headerRows.length === 0 && bodyRows.length > 0) {
    const firstRow = bodyRows[0];
    const cells = getCells(firstRow);
    const headerCells = cells.map((_, i) => ["th", {}, `Column ${i + 1}`]);
    headerRows = [["tr", {}, ...headerCells]];
  }
  if (headerRows.length === 0) {
    return "";
  }
  const headerRow = headerRows[0];
  const headerCells = getCells(headerRow);
  const headerContent = [];
  for (const cell of headerCells) {
    headerContent.push(await getCellContent(cell, state));
  }
  const alignments = headerCells.map((cell) => {
    const [, attributes] = cell;
    return getAlignment(attributes);
  });
  const columnWidths = headerContent.map((content) => Math.max(3, content.length));
  for (const row of bodyRows) {
    const cells = getCells(row);
    for (let i = 0;i < cells.length; i++) {
      if (i < columnWidths.length) {
        const content = await getCellContent(cells[i], state);
        columnWidths[i] = Math.max(columnWidths[i], content.length);
      }
    }
  }
  let result = "| ";
  result += headerContent.map((content, i) => content.padEnd(columnWidths[i])).join(" | ");
  result += ` |
`;
  result += "| ";
  result += columnWidths.map((width, i) => {
    const alignment = alignments[i];
    if (alignment === "left") {
      return ":" + "-".repeat(width - 1);
    } else if (alignment === "center") {
      return ":" + "-".repeat(width - 2) + ":";
    } else if (alignment === "right") {
      return "-".repeat(width - 1) + ":";
    }
    return "-".repeat(width);
  }).join(" | ");
  result += ` |
`;
  for (const row of bodyRows) {
    const cells = getCells(row);
    const cellContents = [];
    for (let i = 0;i < cells.length; i++) {
      const content = await getCellContent(cells[i], state);
      cellContents.push(content.padEnd(columnWidths[i] || 0));
    }
    while (cellContents.length < columnWidths.length) {
      cellContents.push("".padEnd(columnWidths[cellContents.length]));
    }
    result += "| " + cellContents.join(" | ") + ` |
`;
  }
  const attrs = comarkAttributes(userBlockAttrs("table", node[1]));
  if (attrs) {
    return `::table${attrs}
${result.trimEnd()}
::

`;
  }
  return result + `
`;
}
function thead(_node, _state) {
  return "";
}
function tbody(_node, _state) {
  return "";
}
function tr(_node, _state) {
  return "";
}
function th(_node, _state) {
  return "";
}
function td(_node, _state) {
  return "";
}

// node_modules/comark/dist/internal/stringify/handlers/comment.js
function comment2(node, _state) {
  if (node[0] === null) {
    return `<!--${node[2]}-->` + _state.context.blockSeparator;
  }
  return "";
}

// node_modules/comark/dist/internal/stringify/handlers/math.js
function math(node, state, parent) {
  const content = textContent(node);
  const className = node[1].class;
  const classes = typeof className === "string" ? className.split(" ") : [];
  const hasInlineClass = classes.includes("inline");
  const hasBlockClass = classes.includes("block");
  const hasInlineSiblings = parent?.some((child, index) => index > 1 && typeof child === "string") ?? false;
  const isInline = hasInlineClass || !hasBlockClass && hasInlineSiblings;
  if (isInline) {
    return `$${content}$`;
  }
  return `$$
${content}
$$${state.context.blockSeparator}`;
}

// node_modules/comark/dist/internal/stringify/handlers/mermaid.js
function mermaid(node, state) {
  const [_, attributes] = node;
  const { content, ...rest } = attributes;
  const attrs = comarkAttributes(rest);
  const body = String(content ?? "").replace(/\n$/, "");
  const fence = pickFence(body);
  return `${fence}mermaid${attrs ? ` ${attrs}` : ""}
${body}
${fence}${state.context.blockSeparator}`;
}

// node_modules/comark/dist/internal/stringify/handlers/index.js
var handlers = {
  code: code2,
  pre,
  hr: hr2,
  br,
  h1: heading3,
  h2: heading3,
  h3: heading3,
  h4: heading3,
  h5: heading3,
  h6: heading3,
  p,
  a,
  ul,
  ol,
  li,
  html,
  strong,
  em: emphesis,
  blockquote: blockquote2,
  img,
  del,
  mdc,
  template,
  table: table2,
  thead,
  tbody,
  tr,
  th,
  td,
  comment: comment2,
  math,
  mermaid
};

// node_modules/comark/dist/internal/stringify/state.js
function findHandler(ctx, node) {
  const name = node[0];
  const userHandler = (Object.hasOwn(ctx.handlers, name) ? ctx.handlers[name] : undefined) || (Object.hasOwn(ctx.handlers, pascalCase(name)) ? ctx.handlers[pascalCase(name)] : undefined);
  if (typeof userHandler === "function") {
    return userHandler;
  }
  for (const handler of ctx.conditionalHandlers) {
    if (handler?.match(node)) {
      return handler.handler;
    }
  }
  return userHandler;
}
async function one(node, state, parent, atLineStart = false) {
  if (typeof node === "string") {
    if (state.context.html) {
      return escapeHtml2(node, { "&": undefined, '"': undefined });
    }
    if (parent?.[1].$?.html === 1 && parent[1].$?.block === 1) {
      return node;
    }
    return escapeTextNode(node, atLineStart);
  }
  if (node[0] === null) {
    return await state.handlers.comment(node, state);
  }
  const prevRenderData = state.renderData;
  if (state.renderData && node[1]) {
    let hasOwnAttrs = false;
    for (const key in node[1]) {
      if (key !== "$") {
        hasOwnAttrs = true;
        break;
      }
    }
    if (hasOwnAttrs) {
      state.renderData = {
        ...prevRenderData,
        props: resolveAttributes(node[1], prevRenderData)
      };
    }
  }
  try {
    const userHandler = findHandler(state.context, node);
    if (userHandler) {
      return await userHandler(node, state, parent);
    }
    if (state.context.html || node[1].$?.html === 1) {
      return await state.handlers.html(node, state, parent);
    }
    const nodeName = node[0];
    const nodeHandler = Object.hasOwn(state.handlers, nodeName) ? state.handlers[nodeName] : undefined;
    if (nodeHandler) {
      return await nodeHandler(node, state, parent);
    }
    return state.context.format === "markdown/comark" ? await state.handlers.mdc(node, state, parent) : await state.handlers.html(node, state, parent);
  } finally {
    state.renderData = prevRenderData;
  }
}
async function flow(node, state, parent) {
  const children = node.slice(2);
  let result = "";
  for (const child of children) {
    result += await one(child, state, parent || node);
  }
  return result;
}
function createState(ctx = {}) {
  const conditionalHandlers = [];
  const handlers2 = {};
  for (const [key, value] of Object.entries(ctx.handlers || {})) {
    if (typeof value === "function") {
      handlers2[key] = value;
    } else {
      conditionalHandlers.push(value);
    }
  }
  const context = {
    ...ctx,
    blockSeparator: ctx.blockSeparator || `

`,
    format: ctx.format || "markdown/comark",
    handlers: handlers2,
    conditionalHandlers,
    blockAttributesStyle: ctx.blockAttributesStyle || "codeblock",
    html: ctx.format === "text/html"
  };
  const tree = ctx.tree;
  const renderData = {
    frontmatter: tree?.frontmatter || {},
    meta: tree?.meta || {},
    data: ctx.data || {},
    props: {}
  };
  const state = {
    handlers,
    context,
    one,
    flow,
    data: ctx.data || {},
    renderData,
    render: async (input) => {
      if (Array.isArray(input) && typeof input[0] === "string" && input.length > 1) {
        return state.one(input, state);
      }
      let result = "";
      for (const child of input) {
        result += await state.one(child, state, undefined, result === "" || result.endsWith(`
`));
      }
      return result;
    },
    applyContext: (edit) => {
      const revert = {};
      for (const [key, value] of Object.entries(edit)) {
        revert[key] = context[key];
        context[key] = value;
      }
      return revert;
    }
  };
  return state;
}
var inlineSyntax = /[\\`*_<&~[\]{:]/g;
var COLON_PREV_CHARS = new Set([" ", "\t", `
`, "*", "_", "[", "]", "}", ")", ">"]);
function escapeTextNode(text, atLineStart = false) {
  const escaped = escapeInline(text);
  if (!atLineStart && !escaped.includes(`
`)) {
    return escaped;
  }
  return escaped.split(`
`).map((line, index) => index > 0 || atLineStart ? escapeLeadingBlock(line) : line).join(`
`);
}
function isAlphaNumeric(char) {
  return char !== undefined && /[a-zA-Z0-9]/.test(char);
}
function buildNextIndex(source, charCode) {
  const next = new Int32Array(source.length + 1);
  let last = -1;
  next[source.length] = -1;
  for (let i = source.length - 1;i >= 0; i--) {
    if (source.charCodeAt(i) === charCode)
      last = i;
    next[i] = last;
  }
  return next;
}
function escapeInline(text) {
  let nextGt;
  return text.replace(inlineSyntax, (char, offset, source) => {
    if (char === "_" && isAlphaNumeric(source[offset - 1]) && isAlphaNumeric(source[offset + 1])) {
      return char;
    }
    if (char === "<") {
      const next = source.charCodeAt(offset + 1);
      const tagStart = next >= 65 && next <= 90 || next >= 97 && next <= 122 || next === 33 || next === 63 || next === 47;
      if (!tagStart) {
        return char;
      }
      nextGt ??= buildNextIndex(source, 62);
      if (nextGt[offset + 1] === -1) {
        return char;
      }
      return `\\${char}`;
    }
    if (char === "&" && !/^&#?[a-zA-Z0-9]+;/.test(source.slice(offset))) {
      return char;
    }
    if (char === ":") {
      const prev = source[offset - 1];
      const prevAllowed = prev === undefined || COLON_PREV_CHARS.has(prev);
      const next = source[offset + 1];
      if (prevAllowed && next !== undefined && /[a-zA-Z$]/.test(next)) {
        return `\\${char}`;
      }
      return char;
    }
    if (char === "{") {
      const prev = source[offset - 1];
      if (prev === "{" || prev === "$") {
        return char;
      }
      if (/^\{[ \t]{0,3}[.#:a-zA-Z_]/.test(source.slice(offset, offset + 6))) {
        return `\\${char}`;
      }
      return char;
    }
    return `\\${char}`;
  });
}
function escapeLeadingBlock(line) {
  if (/^#{1,6}([ \t]|$)/.test(line))
    return `\\${line}`;
  if (line[0] === ">")
    return `\\${line}`;
  const ordered = /^(\d{1,9})[.)]([ \t]|$)/.exec(line);
  if (ordered)
    return `${ordered[1]}\\${line.slice(ordered[1].length)}`;
  if (/^-([ \t-]|$)/.test(line))
    return `\\${line}`;
  if (/^\+([ \t]|$)/.test(line))
    return `\\${line}`;
  if (/^=+[ \t]*$/.test(line))
    return `\\${line}`;
  if (line[0] === ":")
    return `\\${line}`;
  return line;
}

// node_modules/comark/dist/render.js
async function render(document2, context = {}) {
  const state = createState({ ...context, tree: document2, handlers: context.components });
  let result = "";
  for (const child of document2.nodes) {
    result += await one(child, state);
  }
  return result.trim() + `
`;
}

// node_modules/@comark/html/dist/render.js
async function renderHtmlFromDocument(document2, options) {
  return (await render(document2, { blockSeparator: `
`, format: "text/html", ...options })).trim();
}

// node_modules/@comark/html/dist/index.js
function createHtmlRenderer(options) {
  const parseMarkdown = createMarkdownParser(options);
  return async (markdown) => {
    const document2 = await parseMarkdown(markdown);
    return await renderHtmlFromDocument(document2, options);
  };
}

// node_modules/comark/dist/plugins/security.js
var security_default = defineComarkPlugin((options = {}) => {
  const { blockedTags = [], allowedTags = [], tagFallback = undefined, frontmatter = true, allowedLinkPrefixes, allowedImagePrefixes, allowedProtocols, defaultOrigin, allowDataImages } = options;
  const dropSet = new Set(blockedTags.map((t) => t.toLowerCase()));
  const allowSet = new Set(allowedTags.map((t) => t.toLowerCase()));
  const isFilteredTag = createTagFilter(blockedTags, allowedTags);
  const propsOptions = {
    allowedLinkPrefixes,
    allowedImagePrefixes,
    allowedProtocols,
    defaultOrigin,
    allowDataImages
  };
  return {
    name: "security",
    async post(state) {
      await visitAsync(state.tree, (node) => typeof node !== "string" && node[0] !== null, async (node) => {
        const element = node;
        const tagName = element[0].toLowerCase();
        const isBlocked = dropSet.has(tagName);
        const isNotAllowed = allowSet.size > 0 && !allowSet.has(tagName);
        if (isNotAllowed || isBlocked) {
          if (typeof tagFallback === "function") {
            return await tagFallback(element);
          }
          return false;
        }
        for (const key of Object.keys(element[1])) {
          if (isTagSelector(key) && isUnsafeTagSelector(key, element[1][key], isFilteredTag)) {
            console.warn(`[comark/plugins/security] removing unsafe attribute: ${key}="${element[1][key]}"`);
            delete element[1][key];
          }
        }
        const keys = Object.keys(element[1]);
        if (keys.length) {
          element[1] = validateProps(element[0], element[1], propsOptions);
        }
      });
      if (frontmatter) {
        const removed = sanitizeData(state.tree.frontmatter, { ...propsOptions, blockedTags, allowedTags });
        for (const path of removed) {
          console.warn(`[comark/plugins/security] removing unsafe frontmatter: ${path}`);
        }
      }
    }
  };
});

// src/viewers/web/project/editor.ts
var renderMarkdown = createHtmlRenderer({
  plugins: [security_default({
    allowedTags: ["p", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "em", "code", "pre", "blockquote", "ul", "ol", "li", "a", "br"],
    allowedProtocols: ["http", "https", "mailto"],
    allowDataImages: false
  })]
});
var VIEWPORT_INSET = 16;
var EDITOR_GAP = 24;
function clamp2(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}
function placeEditor(dialog, anchor, line) {
  const anchorRect = anchor.getBoundingClientRect();
  const editorRect = dialog.getBoundingClientRect();
  const left = clamp2(anchorRect.right + EDITOR_GAP, VIEWPORT_INSET, innerWidth - editorRect.width - VIEWPORT_INSET);
  const top = clamp2(anchorRect.top - editorRect.height - EDITOR_GAP, VIEWPORT_INSET, innerHeight - editorRect.height - VIEWPORT_INSET);
  dialog.style.left = `${left}px`;
  dialog.style.top = `${top}px`;
  const placed = dialog.getBoundingClientRect();
  const anchorX = anchorRect.left + anchorRect.width / 2;
  const anchorY = anchorRect.top + anchorRect.height / 2;
  const lineX = clamp2(anchorX, placed.left, placed.right);
  const lineY = clamp2(anchorY, placed.top, placed.bottom);
  const dx = anchorX - lineX;
  const dy = anchorY - lineY;
  line.style.left = `${lineX - placed.left}px`;
  line.style.top = `${lineY - placed.top}px`;
  line.style.width = `${Math.hypot(dx, dy)}px`;
  line.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
}
function createProjectEditor(save) {
  const dialog = document.createElement("dialog");
  dialog.id = "project-editor";
  dialog.innerHTML = '<span class="anchor-line" aria-hidden="true"></span><form><h1></h1><label>Title<input name="title" required></label><label>Description<input name="description"></label><div class="markdown-field"><div class="markdown-head"><span class="markdown-label">Overview</span><div class="markdown-modes" role="tablist"><button type="button" role="tab" data-mode="write" aria-selected="true">Write</button><button type="button" role="tab" data-mode="preview" aria-selected="false">Preview</button></div></div><textarea name="overview" required aria-label="Overview Markdown"></textarea><div class="markdown-preview" role="tabpanel" hidden></div></div><p class="error" role="status"></p><div class="actions"><button type="button" data-cancel>Cancel</button><button type="submit">Save</button></div></form>';
  document.body.append(dialog);
  const line = dialog.querySelector(".anchor-line");
  const form = dialog.querySelector("form");
  const heading = form.querySelector("h1");
  const title = form.elements.namedItem("title");
  const description = form.elements.namedItem("description");
  const overview = form.elements.namedItem("overview");
  const preview = form.querySelector(".markdown-preview");
  const modes = [...form.querySelectorAll("[data-mode]")];
  const cancel = form.querySelector("[data-cancel]");
  const submit = form.querySelector('button[type="submit"]');
  const error = form.querySelector(".error");
  let anchor;
  let original = {};
  window.addEventListener("resize", () => {
    if (dialog.open && anchor !== undefined)
      placeEditor(dialog, anchor, line);
  });
  let previewVersion = 0;
  const showMode = async (mode) => {
    modes.forEach((button) => {
      button.setAttribute("aria-selected", String(button.dataset.mode === mode));
    });
    overview.hidden = mode === "preview";
    preview.hidden = mode === "write";
    if (mode === "write")
      return;
    const version = ++previewVersion;
    const html = await renderMarkdown(overview.value);
    if (version !== previewVersion)
      return;
    preview.innerHTML = html;
  };
  modes.forEach((button) => {
    button.addEventListener("click", () => void showMode(button.dataset.mode));
  });
  overview.addEventListener("input", () => {
    if (!preview.hidden)
      showMode("preview");
  });
  cancel.addEventListener("click", () => dialog.close());
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    error.textContent = "";
    try {
      const input = changedEdit(original, {
        title: title.value,
        overview: overview.value,
        description: description.value
      });
      if (Object.keys(input.original).length)
        await save(input);
      dialog.close();
    } catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : String(cause);
    } finally {
      submit.disabled = false;
    }
  });
  return {
    open(profile) {
      anchor = document.querySelector("[data-project-edit]");
      heading.textContent = `Edit ${profile.title}`;
      title.value = profile.title;
      description.value = profile.description ?? "";
      overview.value = profile.overview;
      original = { title: title.value, description: description.value, overview: overview.value };
      error.textContent = "";
      showMode("write");
      dialog.showModal();
      placeEditor(dialog, anchor, line);
      title.focus();
    }
  };
}

// src/viewers/web/chrome/relate.ts
function createRelateDialog(add) {
  const dialog = document.createElement("dialog");
  dialog.id = "relate-dialog";
  dialog.className = "verb-dialog";
  dialog.innerHTML = "<form><h1></h1>" + '<label>Source file<select name="source" required></select></label>' + '<label>Target file<select name="target" required></select></label>' + '<label>Description<input name="description" required></label>' + '<label>Technology<input name="technology" required></label>' + '<p class="error" role="status"></p>' + '<div class="actions"><button type="button" data-cancel>Cancel</button><button type="submit">Save draft</button></div></form>';
  document.body.append(dialog);
  const form = dialog.querySelector("form");
  const heading = form.querySelector("h1");
  const source = form.elements.namedItem("source");
  const target = form.elements.namedItem("target");
  const description = form.elements.namedItem("description");
  const technology = form.elements.namedItem("technology");
  const error = form.querySelector(".error");
  const submit = form.querySelector('button[type="submit"]');
  let ends;
  form.querySelector("[data-cancel]").addEventListener("click", () => dialog.close());
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (ends === undefined)
      return;
    submit.disabled = true;
    error.textContent = "";
    try {
      await add({
        kind: "relation",
        name: source.value,
        relation: target.value,
        description: description.value,
        technology: technology.value
      });
      dialog.close();
    } catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : String(cause);
    } finally {
      submit.disabled = false;
    }
  });
  return {
    close: () => dialog.close(),
    open(next) {
      ends = next;
      heading.textContent = `Draft relationship: ${next.sourceTitle} to ${next.targetTitle}`;
      form.reset();
      for (const [select, files] of [[source, next.sourceFiles], [target, next.targetFiles]]) {
        select.replaceChildren(...files.map((file) => new Option(file, file)));
      }
      submit.disabled = next.sourceFiles.length === 0 || next.targetFiles.length === 0;
      error.textContent = "";
      dialog.showModal();
      description.focus();
    }
  };
}

// src/viewers/web/editing/create.ts
function createDialog(data) {
  const dialog = document.createElement("dialog");
  dialog.id = "create-dialog";
  dialog.className = "verb-dialog";
  dialog.innerHTML = '<form><h1></h1><label>Name<input name="name" required></label>' + '<label data-overview>Overview<textarea name="overview"></textarea></label>' + '<p class="error" role="status"></p><div class="actions">' + '<button type="button" data-cancel>Cancel</button><button type="submit">Save</button></div></form>';
  document.body.append(dialog);
  const form = dialog.querySelector("form");
  const name = form.elements.namedItem("name");
  const overview = form.elements.namedItem("overview");
  const error = form.querySelector(".error");
  const submit = form.querySelector("[type=submit]");
  let creation;
  form.querySelector("[data-cancel]").addEventListener("click", () => dialog.close());
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (creation === undefined)
      return;
    submit.disabled = true;
    error.textContent = "";
    try {
      if (creation.kind === "group")
        await data.add({ thing: "group", name: name.value, members: creation.members });
      else
        await data.draft({ kind: creation.kind, name: name.value, parent: creation.parent, overview: overview.value });
      dialog.close();
    } catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : String(cause);
    } finally {
      submit.disabled = false;
    }
  });
  return {
    close: () => dialog.close(),
    open(next) {
      creation = next;
      form.reset();
      error.textContent = "";
      form.querySelector("h1").textContent = next.kind === "group" ? `Group ${next.members.length} components` : `Draft ${next.kind}${next.parentTitle === undefined ? "" : ` in ${next.parentTitle}`}`;
      form.querySelector("[data-overview]").hidden = next.kind === "group";
      dialog.showModal();
      name.focus();
    }
  };
}

// src/viewers/web/editing/intent.ts
function creationParent(elements, kind, hitId) {
  if (kind === "system")
    return;
  const expected = kind === "component" ? "container" : "system";
  const byId = new Map(elements.map((element) => [element.id, element]));
  let element = hitId === undefined ? undefined : byId.get(hitId);
  while (element !== undefined && element.kind !== expected)
    element = byId.get(element.parent ?? "");
  if (element === undefined || element.external)
    throw new Error(`Drop onto a ${expected}`);
  return element.id;
}
function gestureBounds(start, end) {
  return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
}
function enclosed(bounds, component) {
  return component.x >= bounds.x && component.y >= bounds.y && component.x + component.width <= bounds.x + bounds.width && component.y + component.height <= bounds.y + bounds.height;
}

// src/viewers/web/editing/gestures.ts
function createMapEditor(host, map, data, elements, live) {
  const toolbar = document.createElement("div");
  toolbar.id = "map-tools";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", "Architecture editing");
  toolbar.setAttribute("aria-orientation", "vertical");
  const error = document.createElement("p");
  error.id = "editor-error";
  error.setAttribute("role", "status");
  host.append(toolbar);
  const preview = svg("svg", {}, "gesture-preview");
  const create = createDialog(data);
  const relate = data.draft === undefined ? undefined : createRelateDialog(data.draft);
  let tool;
  let gesture;
  const enabled = () => live() && data.draft !== undefined && data.add !== undefined;
  const element = (id) => elements().find((item) => item.id === id);
  const hit = (point) => map.hitId(document.elementFromPoint(point.x, point.y));
  const pointOf = (event) => ({ x: event.clientX, y: event.clientY });
  function choose(next) {
    tool = next;
    map.svg.toggleAttribute("data-editing", next !== undefined);
    for (const button of toolbar.querySelectorAll("[data-tool]"))
      button.setAttribute("aria-pressed", String(button.dataset.tool === next));
  }
  function cancel() {
    gesture = undefined;
    preview.remove();
    choose(undefined);
    error.textContent = "";
  }
  function start(event, next) {
    event.preventDefault();
    event.stopImmediatePropagation();
    error.textContent = "";
    gesture = next;
    document.body.append(preview);
    paintPreview(next);
  }
  for (const kind of ["system", "container", "component"]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `+ ${kind[0].toUpperCase()}${kind.slice(1)}`;
    button.dataset.create = kind;
    button.title = `Drag to create a draft ${kind}`;
    button.addEventListener("pointerdown", (event) => {
      if (!enabled() || event.button !== 0)
        return;
      choose(undefined);
      start(event, { tool: kind, pointerId: event.pointerId, start: pointOf(event), end: pointOf(event) });
    });
    toolbar.append(button);
  }
  for (const mode of ["group", "connect"]) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.tool = mode;
    button.textContent = mode === "group" ? "Group" : "Connect";
    button.title = mode === "group" ? "Draw around sibling components" : "Drag from a source component to a target component";
    button.addEventListener("click", () => choose(tool === mode ? undefined : mode));
    toolbar.append(button);
  }
  toolbar.append(error);
  map.svg.addEventListener("pointerdown", (event) => {
    if (!enabled() || tool === undefined || event.button !== 0)
      return;
    const base = { pointerId: event.pointerId, start: pointOf(event), end: pointOf(event) };
    if (tool === "group")
      start(event, { ...base, tool });
    else {
      const source = element(map.hitId(event.target));
      if (source?.kind === "component")
        start(event, { ...base, tool, source: source.id });
      else {
        event.stopImmediatePropagation();
        error.textContent = "Start on a component";
      }
    }
  }, { capture: true });
  function paintPreview(current) {
    preview.replaceChildren();
    if (current.tool === "group")
      preview.append(svg("rect", { ...gestureBounds(current.start, current.end) }));
    else if (current.tool === "connect")
      preview.append(svg("line", { x1: current.start.x, y1: current.start.y, x2: current.end.x, y2: current.end.y }));
    else {
      const label = svg("text", { x: current.end.x + 12, y: current.end.y - 12 });
      label.textContent = `+ Draft ${current.tool}`;
      preview.append(label);
    }
  }
  function membersOf(current) {
    const bounds = gestureBounds(current.start, current.end);
    return [...map.svg.querySelectorAll(".building.component[data-id]")].filter((node) => enclosed(bounds, node.getBoundingClientRect())).map((node) => node.dataset.id);
  }
  function connect(current) {
    const target = element(hit(current.end));
    if (target?.kind !== "component" || target.id === current.source)
      throw new Error("End on another component");
    const source = element(current.source);
    if (source.code.length === 0 || target.code.length === 0)
      throw new Error("Both components need source files");
    relate?.open({
      sourceTitle: source.title,
      targetTitle: target.title,
      sourceFiles: [...new Set(source.code.map((reference) => reference.file))].sort(),
      targetFiles: [...new Set(target.code.map((reference) => reference.file))].sort()
    });
  }
  function finish(current) {
    if (!enabled())
      return;
    if (current.tool === "group") {
      const members = membersOf(current);
      if (members.length === 0)
        throw new Error("Draw around at least one component");
      create.open({ kind: "group", members });
    } else if (current.tool === "connect") {
      connect(current);
    } else {
      if (!map.svg.contains(document.elementFromPoint(current.end.x, current.end.y)))
        return;
      const parent = creationParent(elements(), current.tool, hit(current.end));
      create.open({ kind: current.tool, parent, parentTitle: element(parent)?.title });
    }
  }
  document.addEventListener("pointermove", (event) => {
    if (gesture === undefined || gesture.pointerId !== event.pointerId)
      return;
    event.preventDefault();
    gesture.end = pointOf(event);
    paintPreview(gesture);
  }, { passive: false });
  document.addEventListener("pointerup", (event) => {
    if (gesture === undefined || gesture.pointerId !== event.pointerId)
      return;
    const completed = { ...gesture, end: pointOf(event) };
    cancel();
    try {
      finish(completed);
    } catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : String(cause);
    }
  });
  document.addEventListener("pointercancel", cancel);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || tool === undefined && gesture === undefined)
      return;
    event.preventDefault();
    event.stopImmediatePropagation();
    cancel();
  }, { capture: true });
  return {
    cancel,
    refresh() {
      toolbar.hidden = !enabled();
      if (!enabled()) {
        cancel();
        create.close();
        relate?.close();
      }
    }
  };
}

// src/viewers/web/authoring.ts
function createAuthoring(host, map, data, deps) {
  const gestures = createMapEditor(host, map, data, () => deps.world().elements, deps.live);
  const { accept, add, edit, remove } = data;
  const titleOf = (id) => deps.world().elements.find((element) => element.id === id)?.title ?? id;
  function selectionWrites(ids) {
    if (ids.length < 2 || add === undefined || edit === undefined)
      return;
    return {
      members: ids.map((id) => ({ id, title: titleOf(id) })),
      onGroup: (name) => add({ thing: "group", name, members: [...ids] }),
      onCombine: (survivor) => edit({ id: survivor, combine: ids.filter((id) => id !== survivor) })
    };
  }
  function paneWrites(selectedId, selectedIds) {
    if (!deps.live())
      return {};
    const selection = selectionWrites(selectedIds);
    return {
      onRead: deps.repaint,
      ...selection === undefined ? {} : { selection },
      ...remove === undefined ? {} : { onRemove: () => remove({ id: selectedId }) },
      ...accept === undefined ? {} : { onAccept: () => accept({ id: selectedId }) },
      ...edit === undefined ? {} : {
        onEdit: (input, original) => edit({ id: selectedId, ...input, original }),
        parents: deps.world().elements.filter((element) => element.kind === "container").map((element) => ({ id: element.id, title: element.title })).sort((left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id))
      }
    };
  }
  function relationWrites(source, target) {
    if (!deps.live())
      return {};
    return {
      onRead: deps.repaint,
      ...accept === undefined ? {} : { onAccept: () => accept({ id: source, relation: target }) },
      ...edit === undefined ? {} : { onEdit: (input, original) => edit({ id: source, relation: target, ...input, original }) },
      ...remove === undefined ? {} : { onRemove: () => remove({ id: source, relation: target }) }
    };
  }
  return { paneWrites, relationWrites, ...gestures };
}

// src/viewers/web/revision/view.ts
var motion = "calc(var(--chrome-motion) * 0.75) var(--chrome-ease)";
var NARROW_HEADER = "(max-width: 1080px)";
var revisionCss = `
  .time-machine { position: relative; display: flex; align-items: center; min-width: 0; flex: 0 1 auto; }
  .time-machine .revision-menu { right: auto; left: var(--field-left, 0px); }
  #revision { min-width: 0; gap: 6px; padding: 0 6px 0 10px; color: var(--ink); }
  /* One search input follows the fields in the DOM. The order property moves it into the first or second slot,
     which only works while the fields are the box's own flex items. */
  #revision .revision-fields { display: contents; }
  #revision .revision-loader { display: none; animation: revision-spin 700ms linear infinite; }
  #revision[aria-busy="true"] .revision-history { display: none; }
  #revision[aria-busy="true"] .revision-loader { display: block; }

  /* A field is as wide as its commit message; the two fields of a pair clip together. */
  .revision-field {
    order: 3; flex: 0 1 auto; min-width: 48px; height: 24px;
    display: inline-flex; align-items: center; gap: 6px;
    border: 0; border-radius: 5px; padding: 0 6px; background: transparent; color: var(--ink); font: inherit; cursor: pointer;
    transition: background-color ${motion};
  }
  .revision-field[data-field="from"] { order: 1; }
  .revision-field:hover, .revision-field:focus-visible { background: var(--hover); }
  .revision-message, .revision-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .revision-name { display: none; }
  .revision-field .chevron { width: 6px; height: 6px; flex: none; margin: -3px 2px 0; border-right: 1px solid var(--muted); border-bottom: 1px solid var(--muted); transform: rotate(45deg); }
  .revision-vs {
    order: 2; flex: none; align-self: stretch; display: inline-flex; align-items: center; margin: 0 2px; padding: 0 10px;
    border-left: 1px solid var(--hairline); border-right: 1px solid var(--hairline); color: var(--muted); font-size: 10px;
  }

  /* The edited field gives its place and width to the search; the other field does not move. */
  #revision .revision-search { order: 3; flex: 0 1 auto; width: var(--slot-width, 260px); padding: 0 6px; animation: revision-fade-in ${motion} both; }
  #revision[data-editing="from"] .revision-search { order: 1; }
  #revision[data-editing="from"] [data-field="from"],
  #revision[data-editing="to"] [data-field="to"],
  #revision[data-editing="revision"] [data-field="revision"] { display: none; }
  #revision[data-editing] .revision-field { max-width: var(--other-width, none); }

  /* Browsing: the open search keeps the field's place and width; only a newly selected commit's message resizes it.
     The width is a preferred one: a header with no room left still shrinks the box rather than cover Search. */
  #revision[data-editing="revision"] { width: var(--box-width, auto); min-width: 0; }
  #revision[data-editing="revision"] .revision-search { flex: 1 1 0; width: auto; }
  /* The way into a comparison ends the empty browsing search, inside a box with room for it, else just outside. */
  .revision-compare { order: 4; flex: none; display: inline-flex; align-items: center; gap: 6px; color: var(--muted); white-space: nowrap; animation: revision-slide-in ${motion} 60ms both; }
  .revision-compare[hidden] { display: none; }
  .time-machine > .revision-compare { margin-left: 10px; }
  .revision-compare button {
    height: 24px; border: 0; border-radius: 5px; padding: 0 6px; background: transparent; color: var(--ink); font: inherit; cursor: pointer;
    text-decoration: underline; text-decoration-color: color-mix(in srgb, var(--ink) 30%, transparent); text-underline-offset: 3px;
  }
  .revision-compare button:hover, .revision-compare button:focus-visible { background: var(--hover); text-decoration-color: var(--highlight); }
  /* A start is typed into a full-width slot: the waiting destination gives way long before the search does. */
  #revision[data-starting] .revision-field { flex-shrink: 1000; }
  #revision[data-starting] .revision-vs, #revision[data-starting] .revision-field { animation: revision-slide-in ${motion} both; }

  #end-comparison[hidden] { display: none; }
  #end-comparison { margin-left: 4px; font-size: 18px; padding: 6px 9px; animation: revision-fade-in ${motion} both; }
  @keyframes revision-spin { to { transform: rotate(360deg); } }
  @keyframes revision-fade-in { from { opacity: 0; } }
  @keyframes revision-slide-in { from { opacity: 0; transform: translateX(8px); } }

  .revision-option { display: grid; grid-template-columns: minmax(0, 1fr); gap: 3px; }
  .revision-menu .revision-option:disabled { opacity: .4; cursor: not-allowed; background: transparent; }
  .revision-subject { overflow: hidden; color: var(--ink); text-overflow: ellipsis; white-space: nowrap; }
  .revision-meta { min-width: 0; display: flex; align-items: center; font-size: 10px; white-space: nowrap; }
  .revision-meta > * { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .revision-meta > * + *::before { content: '·'; margin: 0 6px; color: var(--muted); }
  .revision-tag { flex: none; color: var(--highlight-text); }
  .revision-snapshot { padding: 12px; }
  .revision-snapshot strong { display: block; font-weight: 500; font-size: 12px; margin-bottom: 6px; overflow-wrap: anywhere; }
  .revision-snapshot p { font-size: 11px; color: var(--muted); white-space: pre-wrap; margin: 8px 0 0; }
  .revision-notice { padding: 12px; color: var(--muted); font-size: 12px; }
  .revision-error { color: var(--ink); white-space: pre-wrap; }
  .revision-tooltip {
    position: fixed; z-index: 100;
    max-width: min(420px, calc(100vw - 24px)); max-height: min(420px, calc(100vh - 24px));
    overflow: auto; padding: 8px 10px;
    border: 1px solid color-mix(in srgb, var(--ink) 16%, transparent); border-radius: 8px;
    background: color-mix(in srgb, var(--paper) 78%, transparent); backdrop-filter: blur(18px);
    box-shadow: 0 10px 28px color-mix(in srgb, var(--ink) 18%, transparent);
    color: var(--ink); font: 11px/1.45 'SF Mono', ui-monospace, Menlo, monospace;
    white-space: pre-wrap; pointer-events: auto;
  }
  /* Narrow headers name a revision by its tag or short ID, and an open search takes the whole box. */
  @media ${NARROW_HEADER} {
    .revision-message, .revision-field .chevron { display: none; }
    .revision-name { display: inline; }
    /* Below about 985px even two short IDs do not fit: they clip inside the box like messages do. */
    .revision-field { min-width: 0; }
    .revision-vs { padding: 0 8px; }
    #revision[data-editing] { flex: 1 1 auto; width: auto; min-width: 0; }
    #revision[data-editing] .revision-field, #revision[data-editing] .revision-vs { display: none; }
    #revision[data-editing] .revision-search { flex: 1 1 0; width: auto; }
    .time-machine:has(#revision[data-editing]) { flex: 1 1 auto; }
  }
  /* At the page's minimum width both short IDs still read whole once the gaps tighten. */
  @media (max-width: 1000px) {
    .revision-field { padding: 0 3px; }
    .revision-vs { margin: 0; padding: 0 4px; }
  }
  @media (prefers-reduced-motion: reduce) {
    #revision, #revision *, .revision-compare, #end-comparison { animation: none !important; transition: none !important; }
  }
`;
function revisionTitle(revision) {
  return revision === null ? "Current working tree" : `${revision.id} - ${revision.subject}`;
}
function revisionOption(revision, current) {
  const tag = revision.tag === undefined ? "" : `<span class="revision-tag">${escaped(revision.tag)}</span>`;
  const body = revision.body === "" ? "" : ` data-body="${escaped(revision.body)}"`;
  return `<button class="anchored-option revision-option" type="button" data-revision="${revision.id}"${body} title="${escaped(revisionTitle(revision))}" aria-current="${current}"><span class="revision-subject">${escaped(revision.subject)}</span><span class="revision-meta">${tag}<code>${revision.shortId}</code><time datetime="${revision.date}">${revision.date}</time></span></button>`;
}
function revisionOptions(revisions, held, query = "", workingTree = true) {
  const filter = query.trim().toLocaleLowerCase();
  const tree = workingTree && "current working tree".includes(filter) ? `<button class="anchored-option revision-option" type="button" data-revision="" aria-current="${held === ""}"><span class="revision-subject">Current working tree</span></button>` : "";
  const matches = revisions.filter((revision) => `${revision.id} ${revision.subject} ${revision.body}`.toLocaleLowerCase().includes(filter));
  return tree + matches.map((revision) => revisionOption(revision, revision.id === held)).join("") || '<div class="revision-notice">No matching revisions</div>';
}
function revisionField(field, revision) {
  const name = revision === null ? "Working tree" : revision.tag ?? revision.shortId;
  return `<button class="revision-field" type="button" data-field="${field}" title="${escaped(revisionTitle(revision))}"><span class="revision-message">${escaped(revision?.subject ?? "Current working tree")}</span><span class="revision-name">${escaped(name)}</span><span class="chevron" aria-hidden="true"></span></button>`;
}
var versus = '<span class="revision-vs">vs.</span>';
function revisionFields(payload) {
  return payload.comparison === undefined ? revisionField("revision", payload.revision) : revisionField("from", payload.comparison.from) + versus + revisionField("to", payload.revision);
}
function pendingPairFields(destination) {
  return versus + revisionField("revision", destination);
}
function snapshotNotice(revision) {
  const metadata = revision === null ? "<strong>Current working tree</strong>" : `<strong>${escaped(revision.subject)}</strong><span class="revision-meta"><code>${revision.shortId}</code><time datetime="${revision.date}">${revision.date}</time></span>${revision.body === "" ? "" : `<p>${escaped(revision.body)}</p>`}`;
  return `<div class="revision-snapshot">${metadata}</div><div class="revision-notice">No other revisions are available in this static Groma.</div>`;
}

// src/viewers/web/revision/control.ts
var placeholders = {
  revision: "Find a commit or message…",
  from: "Choose starting revision…",
  to: "Choose destination…"
};
var searchLabels = {
  revision: "Find revision by commit ID or message",
  from: "Find the starting revision by commit ID or message",
  to: "Find the destination revision by commit ID or message"
};
function localizeDates(root) {
  const format = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
  for (const time of root.querySelectorAll("time[datetime]")) {
    time.textContent = format.format(new Date(time.dateTime));
  }
}
function revisionTooltip(list) {
  const tooltip = document.createElement("div");
  tooltip.className = "revision-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  document.body.append(tooltip);
  const hide = () => {
    tooltip.hidden = true;
  };
  list.addEventListener("mouseover", (event) => {
    const option = event.target instanceof Element ? event.target.closest("[data-body]") : null;
    if (option === null)
      return;
    tooltip.textContent = option.dataset.body ?? "";
    tooltip.hidden = false;
    const optionBox = option.getBoundingClientRect();
    const tooltipBox = tooltip.getBoundingClientRect();
    const top = Math.max(12, Math.min(window.innerHeight - tooltipBox.height - 12, optionBox.top + optionBox.height / 2 - tooltipBox.height / 2));
    tooltip.style.left = `${Math.max(12, optionBox.left - tooltipBox.width + 2)}px`;
    tooltip.style.top = `${top}px`;
  });
  list.addEventListener("mouseout", (event) => {
    const option = event.target instanceof Element ? event.target.closest("[data-body]") : null;
    const next = event.relatedTarget;
    if (option === null || next instanceof Node && (option.contains(next) || tooltip.contains(next)))
      return;
    hide();
  });
  tooltip.addEventListener("mouseleave", hide);
  return { element: tooltip, hide };
}
function createRevisionControl(options) {
  const { box, body, boot, data, applyRevision, applyWorld, applyWork } = options;
  const root = box.parentElement;
  const fields = box.querySelector(".revision-fields");
  const search = box.querySelector(".revision-search");
  const compare = root.querySelector(".revision-compare");
  const measuring = document.createElement("canvas").getContext("2d");
  const narrowHeader = matchMedia(NARROW_HEADER);
  const menu = root.querySelector(".revision-menu");
  const results = menu.querySelector(".revision-results");
  const error = menu.querySelector(".revision-error");
  const end = document.getElementById("end-comparison");
  const { element: tooltip, hide: hideTooltip } = revisionTooltip(menu);
  let current = boot;
  let revisions = boot.revisions;
  const singleSnapshot = boot.delivery.kind === "published" && revisions.length < 2;
  const workingTree = boot.delivery.kind === "live" || boot.revision === null;
  let editing;
  let paintedFields = "";
  let historyLoaded = boot.delivery.kind === "published" || revisions.length > 0;
  let request = 0;
  let navigating = false;
  let pendingWorld;
  let appliedWork = boot.workGeneration;
  const selected = () => current.revision?.id;
  const from = () => current.comparison === undefined ? undefined : current.comparison.from?.id ?? "";
  const live = () => current.comparison === undefined && current.revision === null && boot.delivery.kind === "live";
  const starting = () => editing === "from" && current.comparison === undefined;
  function placeMenu() {
    const versus = editing === "to" ? box.querySelector(".revision-vs") : null;
    const left = versus !== null && versus.offsetParent !== null ? versus.getBoundingClientRect().right - root.getBoundingClientRect().left : 0;
    root.style.setProperty("--field-left", `${Math.round(left)}px`);
  }
  function paintResults() {
    if (singleSnapshot) {
      results.innerHTML = snapshotNotice(current.revision);
      localizeDates(results);
      return;
    }
    const viewed = selected() ?? "";
    const held = editing === "from" ? from() : viewed;
    const otherEndpoint = { revision: undefined, from: viewed, to: from() }[editing ?? "revision"];
    results.innerHTML = revisionOptions(revisions, held, search.value, workingTree);
    const position = new Map(["", ...revisions.map((revision) => revision.id)].map((id, index) => [id, index]));
    const other = position.get(otherEndpoint ?? "") ?? 0;
    for (const option of results.querySelectorAll("[data-revision]")) {
      const here = position.get(option.dataset.revision) ?? 0;
      option.disabled = editing === "from" ? here <= other : editing === "to" && here >= other;
    }
    localizeDates(results);
  }
  function paintCompareEntry() {
    compare.hidden = editing !== "revision" || search.value !== "" || singleSnapshot;
  }
  function paint() {
    const opened = editing !== undefined;
    root.toggleAttribute("data-open", opened);
    box.toggleAttribute("data-starting", starting());
    if (editing === undefined || singleSnapshot)
      delete box.dataset.editing;
    else
      box.dataset.editing = editing;
    const nextFields = starting() ? pendingPairFields(current.revision) : revisionFields(current);
    if (nextFields !== paintedFields) {
      fields.innerHTML = nextFields;
      paintedFields = nextFields;
    }
    search.hidden = !opened || singleSnapshot;
    search.placeholder = placeholders[editing ?? "revision"];
    search.setAttribute("aria-label", searchLabels[editing ?? "revision"]);
    paintCompareEntry();
    end.hidden = current.comparison === undefined && !starting();
    end.title = starting() ? "Cancel comparison" : "End comparison";
    end.setAttribute("aria-label", end.title);
    menu.hidden = !opened;
    placeMenu();
  }
  function close() {
    if (editing === undefined || navigating)
      return;
    editing = undefined;
    hideTooltip();
    paint();
  }
  function revealDestination() {
    const destination = starting() ? results.querySelector(`[data-revision="${selected() ?? ""}"]`) : null;
    if (destination !== null)
      menu.scrollTop = Math.max(0, destination.offsetTop - 6);
  }
  async function loadHistory() {
    if (historyLoaded)
      return;
    box.setAttribute("aria-busy", "true");
    try {
      revisions = await data.readRevisions();
      historyLoaded = true;
      if (editing !== undefined) {
        paintResults();
        revealDestination();
      }
    } catch (reason) {
      showError(reason);
    } finally {
      if (!navigating)
        box.removeAttribute("aria-busy");
    }
  }
  function showsPlaceholder() {
    const style = getComputedStyle(search);
    measuring.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    return search.clientWidth >= measuring.measureText(search.placeholder).width + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  }
  function edit(field, slotWidth, otherWidth) {
    box.style.setProperty("--box-width", `${Math.round(box.getBoundingClientRect().width)}px`);
    search.after(compare);
    box.style.setProperty("--slot-width", `${Math.round(slotWidth)}px`);
    box.style.setProperty("--other-width", otherWidth === undefined ? "none" : `${Math.round(otherWidth)}px`);
    editing = field;
    search.value = "";
    error.hidden = true;
    paint();
    if (!compare.hidden && !narrowHeader.matches && !showsPlaceholder())
      box.after(compare);
    paintResults();
    revealDestination();
    search.focus();
    loadHistory();
  }
  function open(field) {
    close();
    const width = (name) => fields.querySelector(`[data-field="${name}"]`)?.getBoundingClientRect().width;
    const other = field === "from" ? width("to") : field === "to" ? width("from") : undefined;
    edit(field, width(field) ?? 0, other);
  }
  function startComparison() {
    edit("from", 260);
  }
  function setRevision(payload) {
    current = payload;
    body.toggleAttribute("data-revision", !live());
    body.toggleAttribute("data-comparison", payload.comparison !== undefined);
    paint();
  }
  function showError(reason) {
    error.textContent = reason instanceof Error ? reason.message : String(reason);
    error.hidden = false;
    menu.scrollTop = 0;
    if (editing !== undefined)
      return;
    editing = current.comparison === undefined ? "revision" : "to";
    paint();
    paintResults();
  }
  async function load(revision, starting, reset = true) {
    const loading = ++request;
    navigating = true;
    error.hidden = true;
    hideTooltip();
    box.setAttribute("aria-busy", "true");
    try {
      const payload = await data.readWorld(revision, starting);
      if (loading !== request)
        return;
      appliedWork = payload.workGeneration;
      if (reset)
        editing = undefined;
      setRevision(payload);
      if (reset)
        applyRevision(payload);
      else
        applyWorld(payload);
    } catch (reason) {
      if (loading === request)
        showError(reason);
    } finally {
      if (loading === request) {
        navigating = false;
        box.removeAttribute("aria-busy");
        const pending = pendingWorld;
        pendingWorld = undefined;
        if (pending !== undefined)
          refreshWorld(pending);
      }
    }
  }
  function chooseRevision(revision) {
    if (editing === "from")
      load(selected(), revision);
    else if (editing === "to")
      load(revision || undefined, from());
    else
      load(revision || undefined);
  }
  bindPopover(root, { dismiss: close, companion: tooltip });
  search.addEventListener("input", () => {
    paintCompareEntry();
    paintResults();
    menu.scrollTop = 0;
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && editing !== undefined) {
      event.preventDefault();
      event.stopPropagation();
      const edited = editing;
      close();
      const field = fields.querySelector(`[data-field="${edited}"]`) ?? fields.querySelector(".revision-field");
      field?.focus();
    } else if (event.target === search && event.key === "ArrowDown") {
      event.preventDefault();
      results.querySelector("button:not(:disabled)")?.focus();
    } else if (event.target === search && event.key === "Enter") {
      event.preventDefault();
      results.querySelector("button:not(:disabled)")?.click();
    }
  });
  root.addEventListener("click", (event) => {
    if (navigating || !(event.target instanceof Element))
      return;
    const field = event.target.closest(".revision-field")?.dataset.field;
    if (field !== undefined) {
      if (editing === field)
        close();
      else
        open(field);
      return;
    }
    if (event.target.closest('[data-action="compare"]') !== null) {
      startComparison();
      return;
    }
    const option = event.target.closest(".revision-option");
    if (option !== null && !option.disabled)
      chooseRevision(option.dataset.revision);
  });
  end.addEventListener("click", () => {
    if (starting())
      close();
    else
      load(selected());
  });
  new ResizeObserver(placeMenu).observe(box);
  function refreshWorld(payload) {
    if (navigating) {
      pendingWorld = payload;
      return;
    }
    if (payload.generation <= current.generation)
      return;
    if (current.comparison !== undefined) {
      if (current.revision === null || current.comparison.from === null)
        load(selected(), from(), false);
    } else if (current.revision === null) {
      setRevision(payload);
      appliedWork = Math.max(appliedWork, payload.workGeneration);
      applyWorld(payload);
    }
  }
  data.subscribe({
    world: refreshWorld,
    work(payload) {
      if (!live() || payload.workGeneration <= appliedWork)
        return;
      appliedWork = payload.workGeneration;
      applyWork(payload);
    }
  });
  setRevision(boot);
  return {
    get selected() {
      return selected();
    },
    get from() {
      return from();
    },
    get comparison() {
      return current.comparison;
    },
    get live() {
      return live();
    },
    paintProjectEdit(root) {
      root.querySelector("[data-project-edit]")?.toggleAttribute("hidden", !live() || data.edit === undefined);
    }
  };
}

// node_modules/fuse.js/dist/fuse.basic.mjs
function isArray(value) {
  return !Array.isArray ? getTag(value) === "[object Array]" : Array.isArray(value);
}
function baseToString(value) {
  if (typeof value == "string")
    return value;
  if (typeof value === "bigint")
    return value.toString();
  const result = value + "";
  return result == "0" && 1 / value == -Infinity ? "-0" : result;
}
function toString(value) {
  return value == null ? "" : baseToString(value);
}
function isString3(value) {
  return typeof value === "string";
}
function isNumber3(value) {
  return typeof value === "number";
}
function isBoolean(value) {
  return value === true || value === false || isObjectLike(value) && getTag(value) == "[object Boolean]";
}
function isObject2(value) {
  return typeof value === "object";
}
function isObjectLike(value) {
  return isObject2(value) && value !== null;
}
function isDefined(value) {
  return value !== undefined && value !== null;
}
function isBlank(value) {
  return !value.trim().length;
}
function getTag(value) {
  return value == null ? value === undefined ? "[object Undefined]" : "[object Null]" : Object.prototype.toString.call(value);
}
var EXTENDED_SEARCH_UNAVAILABLE = "Extended search is not available";
var LOGICAL_SEARCH_UNAVAILABLE = "Logical search is not available";
var TOKEN_SEARCH_UNAVAILABLE = "Token search is not available";
var INCORRECT_INDEX_TYPE = "Incorrect 'index' type";
var INVALID_DOC_INDEX = "Invalid doc index: must be a non-negative integer within the bounds of the docs array";
var LOGICAL_SEARCH_INVALID_QUERY_FOR_KEY = (key) => `Invalid value for key ${key}`;
var PATTERN_LENGTH_TOO_LARGE = (max) => `Pattern length exceeds max of ${max}.`;
var MISSING_KEY_PROPERTY = (name) => `Missing ${name} property in key`;
var INVALID_KEY_WEIGHT_VALUE = (key) => `Property 'weight' in key '${key}' must be a positive integer`;
var FUSE_MATCH_TOKEN_SEARCH_UNSUPPORTED = "Fuse.match does not support useTokenSearch: token search requires corpus-level statistics (df, fieldCount) that a one-off string comparison does not have. Use new Fuse(...).search(...) instead.";
var hasOwn = Object.prototype.hasOwnProperty;
var KeyStore = class {
  constructor(keys) {
    this._keys = [];
    this._keyMap = {};
    let totalWeight = 0;
    keys.forEach((key) => {
      const obj = createKey(key);
      this._keys.push(obj);
      this._keyMap[obj.id] = obj;
      totalWeight += obj.weight;
    });
    this._keys.forEach((key) => {
      key.weight /= totalWeight;
    });
  }
  get(keyId) {
    return this._keyMap[keyId];
  }
  keys() {
    return this._keys;
  }
  toJSON() {
    return JSON.stringify(this._keys);
  }
};
function createKey(key) {
  let path = null;
  let id = null;
  let src = null;
  let weight = 1;
  let getFn = null;
  if (isString3(key) || isArray(key)) {
    src = key;
    path = createKeyPath(key);
    id = createKeyId(key);
  } else {
    if (!hasOwn.call(key, "name"))
      throw new Error(MISSING_KEY_PROPERTY("name"));
    const name = key.name;
    src = name;
    if (hasOwn.call(key, "weight") && key.weight !== undefined) {
      weight = key.weight;
      if (weight <= 0)
        throw new Error(INVALID_KEY_WEIGHT_VALUE(createKeyId(name)));
    }
    path = createKeyPath(name);
    id = createKeyId(name);
    getFn = key.getFn ?? null;
  }
  return {
    path,
    id,
    weight,
    src,
    getFn
  };
}
function createKeyPath(key) {
  return isArray(key) ? key : key.split(".");
}
function createKeyId(key) {
  return isArray(key) ? key.join(".") : key;
}
function get2(obj, path) {
  const list = [];
  let arr = false;
  const deepGet = (obj, path, index, arrayIndex) => {
    if (!isDefined(obj))
      return;
    if (!path[index])
      list.push(arrayIndex !== undefined ? {
        v: obj,
        i: arrayIndex
      } : obj);
    else {
      const value = obj[path[index]];
      if (!isDefined(value))
        return;
      if (index === path.length - 1 && (isString3(value) || isNumber3(value) || isBoolean(value) || typeof value === "bigint"))
        list.push(arrayIndex !== undefined ? {
          v: toString(value),
          i: arrayIndex
        } : toString(value));
      else if (isArray(value)) {
        arr = true;
        for (let i = 0, len = value.length;i < len; i += 1)
          deepGet(value[i], path, index + 1, i);
      } else if (path.length)
        deepGet(value, path, index + 1, arrayIndex);
    }
  };
  deepGet(obj, isString3(path) ? path.split(".") : path, 0);
  return arr ? list : list[0];
}
var MatchOptions = {
  includeMatches: false,
  findAllMatches: false,
  minMatchCharLength: 1
};
var BasicOptions = {
  isCaseSensitive: false,
  ignoreDiacritics: false,
  includeScore: false,
  keys: [],
  shouldSort: true,
  sortFn: (a, b) => a.score === b.score ? a.idx < b.idx ? -1 : 1 : a.score < b.score ? -1 : 1
};
var FuzzyOptions = {
  location: 0,
  threshold: 0.6,
  distance: 100
};
var AdvancedOptions = {
  useExtendedSearch: false,
  useTokenSearch: false,
  tokenize: undefined,
  tokenMatch: "any",
  getFn: get2,
  ignoreLocation: false,
  ignoreFieldNorm: false,
  fieldNormWeight: 1
};
var Config = Object.freeze({
  ...BasicOptions,
  ...MatchOptions,
  ...FuzzyOptions,
  ...AdvancedOptions
});
function isWordSeparator(code) {
  return code >= 9 && code <= 13 || code === 32 || code === 160;
}
function norm(weight = 1, mantissa = 3) {
  const cache = /* @__PURE__ */ new Map;
  const m = Math.pow(10, mantissa);
  return {
    get(value) {
      let numTokens = 0;
      let inWord = false;
      for (let i = 0;i < value.length; i++)
        if (!isWordSeparator(value.charCodeAt(i))) {
          if (!inWord) {
            numTokens++;
            inWord = true;
          }
        } else
          inWord = false;
      if (numTokens === 0)
        numTokens = 1;
      if (cache.has(numTokens))
        return cache.get(numTokens);
      const n = Math.round(m / Math.pow(numTokens, 0.5 * weight)) / m;
      cache.set(numTokens, n);
      return n;
    },
    clear() {
      cache.clear();
    }
  };
}
var FuseIndex = class {
  constructor({ getFn = Config.getFn, fieldNormWeight = Config.fieldNormWeight } = {}) {
    this.norm = norm(fieldNormWeight, 3);
    this.getFn = getFn;
    this.isCreated = false;
    this.docs = [];
    this.keys = [];
    this._keysMap = {};
    this.setIndexRecords();
  }
  setSources(docs = []) {
    this.docs = docs;
  }
  setIndexRecords(records = []) {
    this.records = records;
  }
  setKeys(keys = []) {
    this.keys = keys;
    this._keysMap = {};
    keys.forEach((key, idx) => {
      this._keysMap[key.id] = idx;
    });
  }
  create() {
    if (this.isCreated || !this.docs.length)
      return;
    this.isCreated = true;
    const len = this.docs.length;
    this.records = new Array(len);
    let recordCount = 0;
    if (isString3(this.docs[0]))
      for (let i = 0;i < len; i++) {
        const record = this._createStringRecord(this.docs[i], i);
        if (record)
          this.records[recordCount++] = record;
      }
    else
      for (let i = 0;i < len; i++)
        this.records[recordCount++] = this._createObjectRecord(this.docs[i], i);
    this.records.length = recordCount;
    this.norm.clear();
  }
  add(doc, docIndex) {
    if (!Number.isInteger(docIndex) || docIndex < 0)
      throw new Error(INVALID_DOC_INDEX);
    if (isString3(doc)) {
      const record = this._createStringRecord(doc, docIndex);
      if (record)
        this.records.push(record);
      return record;
    }
    const record = this._createObjectRecord(doc, docIndex);
    this.records.push(record);
    return record;
  }
  removeAt(idx) {
    if (!Number.isInteger(idx) || idx < 0)
      throw new Error(INVALID_DOC_INDEX);
    for (let i = 0, len = this.records.length;i < len; i += 1)
      if (this.records[i].i === idx) {
        this.records.splice(i, 1);
        break;
      }
    for (let i = 0, len = this.records.length;i < len; i += 1)
      if (this.records[i].i > idx)
        this.records[i].i -= 1;
  }
  removeAll(indices) {
    const toRemove = /* @__PURE__ */ new Set;
    for (const v of indices)
      if (Number.isInteger(v) && v >= 0)
        toRemove.add(v);
    if (toRemove.size === 0)
      return;
    this.records = this.records.filter((r) => !toRemove.has(r.i));
    const sorted = Array.from(toRemove).sort((a, b) => a - b);
    for (const record of this.records) {
      let lo = 0;
      let hi = sorted.length;
      while (lo < hi) {
        const mid = lo + hi >>> 1;
        if (sorted[mid] < record.i)
          lo = mid + 1;
        else
          hi = mid;
      }
      record.i -= lo;
    }
  }
  getValueForItemAtKeyId(item, keyId) {
    return item[this._keysMap[keyId]];
  }
  size() {
    return this.records.length;
  }
  _createStringRecord(doc, docIndex) {
    if (!isDefined(doc) || isBlank(doc))
      return null;
    return {
      v: doc,
      i: docIndex,
      n: this.norm.get(doc)
    };
  }
  _createObjectRecord(doc, docIndex) {
    const record = {
      i: docIndex,
      $: {}
    };
    for (let keyIndex = 0, keyLen = this.keys.length;keyIndex < keyLen; keyIndex++) {
      const key = this.keys[keyIndex];
      const value = key.getFn ? key.getFn(doc) : this.getFn(doc, key.path);
      if (!isDefined(value))
        continue;
      if (isArray(value)) {
        const subRecords = [];
        for (let i = 0, len = value.length;i < len; i += 1) {
          const item = value[i];
          if (!isDefined(item))
            continue;
          if (isString3(item)) {
            if (!isBlank(item)) {
              const subRecord = {
                v: item,
                i,
                n: this.norm.get(item)
              };
              subRecords.push(subRecord);
            }
          } else if (isDefined(item.v)) {
            const text = isString3(item.v) ? item.v : toString(item.v);
            if (!isBlank(text)) {
              const subRecord = {
                v: text,
                i: item.i,
                n: this.norm.get(text)
              };
              subRecords.push(subRecord);
            }
          }
        }
        record.$[keyIndex] = subRecords;
      } else if (isString3(value) && !isBlank(value)) {
        const subRecord = {
          v: value,
          n: this.norm.get(value)
        };
        record.$[keyIndex] = subRecord;
      }
    }
    return record;
  }
  toJSON() {
    return {
      keys: this.keys.map(({ getFn, ...key }) => key),
      records: this.records
    };
  }
};
function createIndex(keys, docs, { getFn = Config.getFn, fieldNormWeight = Config.fieldNormWeight } = {}) {
  const myIndex = new FuseIndex({
    getFn,
    fieldNormWeight
  });
  myIndex.setKeys(keys.map(createKey));
  myIndex.setSources(docs);
  myIndex.create();
  return myIndex;
}
function parseIndex(data, { getFn = Config.getFn, fieldNormWeight = Config.fieldNormWeight } = {}) {
  const { keys, records } = data;
  const myIndex = new FuseIndex({
    getFn,
    fieldNormWeight
  });
  myIndex.setKeys(keys);
  myIndex.setIndexRecords(records);
  return myIndex;
}
function convertMaskToIndices(matchmask = [], minMatchCharLength = Config.minMatchCharLength) {
  const indices = [];
  let start = -1;
  let end = -1;
  let i = 0;
  for (let len = matchmask.length;i < len; i += 1) {
    const match = matchmask[i];
    if (match && start === -1)
      start = i;
    else if (!match && start !== -1) {
      end = i - 1;
      if (end - start + 1 >= minMatchCharLength)
        indices.push([start, end]);
      start = -1;
    }
  }
  if (matchmask[i - 1] && i - start >= minMatchCharLength)
    indices.push([start, i - 1]);
  return indices;
}
function search(text, pattern, patternAlphabet, { location: location2 = Config.location, distance = Config.distance, threshold = Config.threshold, findAllMatches = Config.findAllMatches, minMatchCharLength = Config.minMatchCharLength, includeMatches = Config.includeMatches, ignoreLocation = Config.ignoreLocation } = {}) {
  if (pattern.length > 32)
    throw new Error(PATTERN_LENGTH_TOO_LARGE(32));
  const patternLen = pattern.length;
  const textLen = text.length;
  const expectedLocation = Math.max(0, Math.min(location2, textLen));
  let currentThreshold = threshold;
  let bestLocation = expectedLocation;
  const calcScore = (errors, currentLocation) => {
    const accuracy = errors / patternLen;
    if (ignoreLocation)
      return accuracy;
    const proximity = Math.abs(expectedLocation - currentLocation);
    if (!distance)
      return proximity ? 1 : accuracy;
    return accuracy + proximity / distance;
  };
  const computeMatches = minMatchCharLength > 1 || includeMatches;
  const matchMask = computeMatches ? Array(textLen) : [];
  let index;
  while ((index = text.indexOf(pattern, bestLocation)) > -1) {
    const score = calcScore(0, index);
    currentThreshold = Math.min(score, currentThreshold);
    bestLocation = index + patternLen;
    if (computeMatches) {
      let i = 0;
      while (i < patternLen) {
        matchMask[index + i] = 1;
        i += 1;
      }
    }
  }
  bestLocation = -1;
  let lastBitArr = [];
  let finalScore = 1;
  let bestErrors = 0;
  let binMax = patternLen + textLen;
  const mask = 1 << patternLen - 1;
  for (let i = 0;i < patternLen; i += 1) {
    let binMin = 0;
    let binMid = binMax;
    while (binMin < binMid) {
      if (calcScore(i, expectedLocation + binMid) <= currentThreshold)
        binMin = binMid;
      else
        binMax = binMid;
      binMid = Math.floor((binMax - binMin) / 2 + binMin);
    }
    binMax = binMid;
    let start = Math.max(1, expectedLocation - binMid + 1);
    const finish = findAllMatches ? textLen : Math.min(expectedLocation + binMid, textLen) + patternLen;
    const bitArr = Array(finish + 2);
    bitArr[finish + 1] = (1 << i) - 1;
    for (let j = finish;j >= start; j -= 1) {
      const currentLocation = j - 1;
      const charMatch = patternAlphabet[text[currentLocation]];
      bitArr[j] = (bitArr[j + 1] << 1 | 1) & charMatch;
      if (i)
        bitArr[j] |= (lastBitArr[j + 1] | lastBitArr[j]) << 1 | 1 | lastBitArr[j + 1];
      if (bitArr[j] & mask) {
        finalScore = calcScore(i, currentLocation);
        if (finalScore <= currentThreshold) {
          currentThreshold = finalScore;
          bestLocation = currentLocation;
          bestErrors = i;
          if (bestLocation <= expectedLocation)
            break;
          start = Math.max(1, 2 * expectedLocation - bestLocation);
        }
      }
    }
    if (calcScore(i + 1, expectedLocation) > currentThreshold)
      break;
    lastBitArr = bitArr;
  }
  if (computeMatches && bestLocation >= 0) {
    const matchEnd = Math.min(textLen - 1, bestLocation + patternLen - 1 + bestErrors);
    for (let k = bestLocation;k <= matchEnd; k += 1)
      if (patternAlphabet[text[k]])
        matchMask[k] = 1;
  }
  const result = {
    isMatch: bestLocation >= 0,
    score: Math.max(0.001, finalScore)
  };
  if (computeMatches) {
    const indices = convertMaskToIndices(matchMask, minMatchCharLength);
    if (!indices.length)
      result.isMatch = false;
    else if (includeMatches)
      result.indices = indices;
  }
  return result;
}
function createPatternAlphabet(pattern) {
  const mask = {};
  for (let i = 0, len = pattern.length;i < len; i += 1) {
    const char = pattern.charAt(i);
    mask[char] = (mask[char] || 0) | 1 << len - i - 1;
  }
  return mask;
}
function mergeIndices(indices) {
  if (indices.length <= 1)
    return indices;
  indices.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [indices[0]];
  for (let i = 1, len = indices.length;i < len; i += 1) {
    const last = merged[merged.length - 1];
    const curr = indices[i];
    if (curr[0] <= last[1] + 1)
      last[1] = Math.max(last[1], curr[1]);
    else
      merged.push(curr);
  }
  return merged;
}
var NON_DECOMPOSABLE_MAP = {
  "ł": "l",
  "Ł": "L",
  "đ": "d",
  "Đ": "D",
  "ø": "o",
  "Ø": "O",
  "ħ": "h",
  "Ħ": "H",
  "ŧ": "t",
  "Ŧ": "T",
  "ı": "i",
  "ß": "ss"
};
var NON_DECOMPOSABLE_RE = new RegExp("[" + Object.keys(NON_DECOMPOSABLE_MAP).join("") + "]", "g");
var stripDiacritics = typeof String.prototype.normalize === "function" ? (str) => str.normalize("NFD").replace(/[\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u08D3-\u08E1\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u09FE\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0AFA-\u0AFF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B62\u0B63\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0C00-\u0C04\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0D00-\u0D03\u0D3B\u0D3C\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D82\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EB9\u0EBB\u0EBC\u0EC8-\u0ECD\u0F18\u0F19\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F\u109A-\u109D\u135D-\u135F\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u180B-\u180D\u1885\u1886\u18A9\u1920-\u192B\u1930-\u193B\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F\u1AB0-\u1ABE\u1B00-\u1B04\u1B34-\u1B44\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BE6-\u1BF3\u1C24-\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF2-\u1CF4\u1CF7-\u1CF9\u1DC0-\u1DF9\u1DFB-\u1DFF\u20D0-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\uA66F-\uA672\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA880\uA881\uA8B4-\uA8C5\uA8E0-\uA8F1\uA8FF\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9E5\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F]/g, "").replace(NON_DECOMPOSABLE_RE, (ch) => NON_DECOMPOSABLE_MAP[ch]) : (str) => str;
var BitapSearch = class {
  constructor(pattern, { location: location2 = Config.location, threshold = Config.threshold, distance = Config.distance, includeMatches = Config.includeMatches, findAllMatches = Config.findAllMatches, minMatchCharLength = Config.minMatchCharLength, isCaseSensitive = Config.isCaseSensitive, ignoreDiacritics = Config.ignoreDiacritics, ignoreLocation = Config.ignoreLocation } = {}) {
    this.options = {
      location: location2,
      threshold,
      distance,
      includeMatches,
      findAllMatches,
      minMatchCharLength,
      isCaseSensitive,
      ignoreDiacritics,
      ignoreLocation
    };
    pattern = isCaseSensitive ? pattern : pattern.toLowerCase();
    pattern = ignoreDiacritics ? stripDiacritics(pattern) : pattern;
    this.pattern = pattern;
    this.chunks = [];
    if (!this.pattern.length)
      return;
    const addChunk = (pattern, startIndex) => {
      this.chunks.push({
        pattern,
        alphabet: createPatternAlphabet(pattern),
        startIndex
      });
    };
    const len = this.pattern.length;
    if (len > 32) {
      let i = 0;
      const remainder = len % 32;
      const end = len - remainder;
      while (i < end) {
        addChunk(this.pattern.substr(i, 32), i);
        i += 32;
      }
      if (remainder) {
        const startIndex = len - 32;
        addChunk(this.pattern.substr(startIndex), startIndex);
      }
    } else
      addChunk(this.pattern, 0);
  }
  searchIn(text) {
    const { isCaseSensitive, ignoreDiacritics, includeMatches } = this.options;
    text = isCaseSensitive ? text : text.toLowerCase();
    text = ignoreDiacritics ? stripDiacritics(text) : text;
    if (this.pattern === text) {
      if (text.length < this.options.minMatchCharLength)
        return {
          isMatch: false,
          score: 1
        };
      const result = {
        isMatch: true,
        score: 0
      };
      if (includeMatches)
        result.indices = [[0, text.length - 1]];
      return result;
    }
    const { location: location2, distance, threshold, findAllMatches, minMatchCharLength, ignoreLocation } = this.options;
    const allIndices = [];
    let totalScore = 0;
    let hasMatches = false;
    this.chunks.forEach(({ pattern, alphabet, startIndex }) => {
      const { isMatch, score, indices } = search(text, pattern, alphabet, {
        location: location2 + startIndex,
        distance,
        threshold,
        findAllMatches,
        minMatchCharLength,
        includeMatches,
        ignoreLocation
      });
      if (isMatch)
        hasMatches = true;
      totalScore += score;
      if (isMatch && indices)
        allIndices.push(...indices);
    });
    const result = {
      isMatch: hasMatches,
      score: hasMatches ? totalScore / this.chunks.length : 1
    };
    if (hasMatches && includeMatches)
      result.indices = mergeIndices(allIndices);
    return result;
  }
};
var registeredSearchers = [];
function register(...args) {
  registeredSearchers.push(...args);
}
function createSearcher(pattern, options) {
  for (let i = 0, len = registeredSearchers.length;i < len; i += 1) {
    const searcherClass = registeredSearchers[i];
    if (searcherClass.condition(pattern, options))
      return new searcherClass(pattern, options);
  }
  return new BitapSearch(pattern, options);
}
var LogicalOperator = {
  AND: "$and",
  OR: "$or"
};
var KeyType = {
  PATH: "$path",
  PATTERN: "$val"
};
var isExpression = (query) => !!(query[LogicalOperator.AND] || query[LogicalOperator.OR]);
var isPath = (query) => !!query[KeyType.PATH];
var isLeaf = (query) => !isArray(query) && isObject2(query) && !isExpression(query);
var convertToExplicit = (query) => ({ [LogicalOperator.AND]: Object.keys(query).map((key) => ({ [key]: query[key] })) });
function parse2(query, options, { auto = true } = {}) {
  const next = (query) => {
    if (isString3(query)) {
      const obj = {
        keyId: null,
        pattern: query
      };
      if (auto)
        obj.searcher = createSearcher(query, options);
      return obj;
    }
    const keys = Object.keys(query);
    const isQueryPath = isPath(query);
    if (!isQueryPath && keys.length > 1 && !isExpression(query))
      return next(convertToExplicit(query));
    if (isLeaf(query)) {
      const key = isQueryPath ? query[KeyType.PATH] : keys[0];
      const pattern = isQueryPath ? query[KeyType.PATTERN] : query[key];
      if (!isString3(pattern))
        throw new Error(LOGICAL_SEARCH_INVALID_QUERY_FOR_KEY(key));
      const obj = {
        keyId: createKeyId(key),
        pattern
      };
      if (auto)
        obj.searcher = createSearcher(pattern, options);
      return obj;
    }
    const node = {
      children: [],
      operator: keys[0]
    };
    keys.forEach((key) => {
      const value = query[key];
      if (isArray(value))
        value.forEach((item) => {
          node.children.push(next(item));
        });
    });
    return node;
  };
  if (!isExpression(query))
    query = convertToExplicit(query);
  return next(query);
}
function computeScoreSingle(matches, { ignoreFieldNorm = Config.ignoreFieldNorm }) {
  let totalScore = 1;
  matches.forEach(({ key, norm, score }) => {
    const weight = key ? key.weight : null;
    totalScore *= Math.pow(score === 0 && weight ? Number.EPSILON : score, (weight || 1) * (ignoreFieldNorm ? 1 : norm));
  });
  return totalScore;
}
function computeScore(results, { ignoreFieldNorm = Config.ignoreFieldNorm }) {
  results.forEach((result) => {
    result.score = computeScoreSingle(result.matches, { ignoreFieldNorm });
  });
}
var MaxHeap = class {
  constructor(limit, comparator) {
    this.limit = limit;
    this.heap = [];
    this.comparator = comparator;
  }
  get size() {
    return this.heap.length;
  }
  insert(item) {
    if (this.size < this.limit) {
      this.heap.push(item);
      this._bubbleUp(this.size - 1);
    } else if (this.comparator(item, this.heap[0]) < 0) {
      this.heap[0] = item;
      this._sinkDown(0);
    }
  }
  extractSorted() {
    return this.heap.sort(this.comparator);
  }
  _bubbleUp(i) {
    const heap = this.heap;
    while (i > 0) {
      const parent = i - 1 >> 1;
      if (this.comparator(heap[i], heap[parent]) <= 0)
        break;
      const tmp = heap[i];
      heap[i] = heap[parent];
      heap[parent] = tmp;
      i = parent;
    }
  }
  _sinkDown(i) {
    const heap = this.heap;
    const len = heap.length;
    let largest = i;
    do {
      i = largest;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < len && this.comparator(heap[left], heap[largest]) > 0)
        largest = left;
      if (right < len && this.comparator(heap[right], heap[largest]) > 0)
        largest = right;
      if (largest !== i) {
        const tmp = heap[i];
        heap[i] = heap[largest];
        heap[largest] = tmp;
      }
    } while (largest !== i);
  }
};
function formatMatches(result) {
  const matches = [];
  result.matches.forEach((match) => {
    if (!isDefined(match.indices) || !match.indices.length)
      return;
    const obj = {
      indices: match.indices,
      value: match.value
    };
    if (match.key)
      obj.key = match.key.id;
    if (match.idx > -1)
      obj.refIndex = match.idx;
    matches.push(obj);
  });
  return matches;
}
function format3(results, docs, { includeMatches = Config.includeMatches, includeScore = Config.includeScore } = {}) {
  return results.map((result) => {
    const { idx } = result;
    const data = {
      item: docs[idx],
      refIndex: idx
    };
    if (includeMatches)
      data.matches = formatMatches(result);
    if (includeScore)
      data.score = result.score;
    return data;
  });
}
var DEFAULT_TOKEN = /[\p{L}\p{M}\p{N}_]+/gu;
var warned = /* @__PURE__ */ new WeakSet;
function warnNonGlobal(regex) {
  if (!warned.has(regex)) {
    warned.add(regex);
    console.warn(`[Fuse] tokenize regex ${regex} lacks the global flag; only the first match per text will be returned. Add the 'g' flag.`);
  }
}
function resolveTokenize(tokenize) {
  if (typeof tokenize === "function") {
    let validated = false;
    return (text) => {
      const result = tokenize(text);
      if (!validated) {
        validated = true;
        if (!Array.isArray(result) || result.some((t) => typeof t !== "string"))
          throw new Error(`[Fuse] tokenize function must return string[]; received ${Array.isArray(result) ? "array containing non-strings" : typeof result}.`);
      }
      return result;
    };
  }
  if (tokenize instanceof RegExp) {
    if (!tokenize.global)
      warnNonGlobal(tokenize);
    return (text) => text.match(tokenize) || [];
  }
  return (text) => text.match(DEFAULT_TOKEN) || [];
}
function createAnalyzer({ isCaseSensitive = false, ignoreDiacritics = false, tokenize } = {}) {
  const tokenizeFn = resolveTokenize(tokenize);
  return { tokenize(text) {
    if (!isCaseSensitive)
      text = text.toLowerCase();
    if (ignoreDiacritics)
      text = stripDiacritics(text);
    return tokenizeFn(text);
  } };
}
function addField(index, text, docIdx, analyzer) {
  const tokens = analyzer.tokenize(text);
  if (!tokens.length)
    return;
  index.fieldCount++;
  index.docFieldCount.set(docIdx, (index.docFieldCount.get(docIdx) || 0) + 1);
  const distinctTerms = new Set(tokens);
  let perDocTerms = index.docTermFieldHits.get(docIdx);
  if (!perDocTerms) {
    perDocTerms = /* @__PURE__ */ new Map;
    index.docTermFieldHits.set(docIdx, perDocTerms);
  }
  for (const term of distinctTerms) {
    perDocTerms.set(term, (perDocTerms.get(term) || 0) + 1);
    index.df.set(term, (index.df.get(term) || 0) + 1);
  }
}
function ingestRecord(index, record, keyCount, analyzer) {
  const { i: docIdx, v, $: fields } = record;
  if (v !== undefined) {
    addField(index, v, docIdx, analyzer);
    return;
  }
  if (!fields)
    return;
  for (let keyIdx = 0;keyIdx < keyCount; keyIdx++) {
    const value = fields[keyIdx];
    if (!value)
      continue;
    if (Array.isArray(value))
      for (const sub of value)
        addField(index, sub.v, docIdx, analyzer);
    else
      addField(index, value.v, docIdx, analyzer);
  }
}
function buildInvertedIndex(records, keyCount, analyzer) {
  const index = {
    fieldCount: 0,
    df: /* @__PURE__ */ new Map,
    docFieldCount: /* @__PURE__ */ new Map,
    docTermFieldHits: /* @__PURE__ */ new Map
  };
  for (const record of records)
    ingestRecord(index, record, keyCount, analyzer);
  return index;
}
function addToInvertedIndex(index, record, keyCount, analyzer) {
  ingestRecord(index, record, keyCount, analyzer);
}
function removeFromInvertedIndex(index, docIdx) {
  const fieldCount = index.docFieldCount.get(docIdx);
  if (fieldCount === undefined)
    return;
  index.fieldCount -= fieldCount;
  index.docFieldCount.delete(docIdx);
  const perDocTerms = index.docTermFieldHits.get(docIdx);
  if (!perDocTerms)
    return;
  for (const [term, hits] of perDocTerms) {
    const next = (index.df.get(term) || 0) - hits;
    if (next <= 0)
      index.df.delete(term);
    else
      index.df.set(term, next);
  }
  index.docTermFieldHits.delete(docIdx);
}
function removeAndShiftInvertedIndex(index, removedIndices) {
  if (removedIndices.length === 0)
    return;
  const sorted = Array.from(new Set(removedIndices)).sort((a, b) => a - b);
  for (const idx of sorted)
    removeFromInvertedIndex(index, idx);
  const shift = (oldIdx) => {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = lo + hi >>> 1;
      if (sorted[mid] < oldIdx)
        lo = mid + 1;
      else
        hi = mid;
    }
    return oldIdx - lo;
  };
  const firstRemoved = sorted[0];
  const shiftedDocFieldCount = /* @__PURE__ */ new Map;
  for (const [oldKey, count] of index.docFieldCount)
    shiftedDocFieldCount.set(oldKey > firstRemoved ? shift(oldKey) : oldKey, count);
  index.docFieldCount = shiftedDocFieldCount;
  const shiftedDocTermFieldHits = /* @__PURE__ */ new Map;
  for (const [oldKey, terms] of index.docTermFieldHits)
    shiftedDocTermFieldHits.set(oldKey > firstRemoved ? shift(oldKey) : oldKey, terms);
  index.docTermFieldHits = shiftedDocTermFieldHits;
}
var Fuse = class {
  constructor(docs, options, index) {
    this.options = {
      ...Config,
      ...options
    };
    if (this.options.useExtendedSearch && true)
      throw new Error(EXTENDED_SEARCH_UNAVAILABLE);
    if (this.options.useTokenSearch && true)
      throw new Error(TOKEN_SEARCH_UNAVAILABLE);
    this._keyStore = new KeyStore(this.options.keys);
    this._docs = docs;
    this._myIndex = null;
    this._invertedIndex = null;
    this.setCollection(docs, index);
    this._lastQuery = null;
    this._lastSearcher = null;
  }
  _getSearcher(query) {
    if (this._lastQuery === query)
      return this._lastSearcher;
    const searcher = createSearcher(query, this._invertedIndex ? {
      ...this.options,
      _invertedIndex: this._invertedIndex
    } : this.options);
    this._lastQuery = query;
    this._lastSearcher = searcher;
    return searcher;
  }
  setCollection(docs, index) {
    this._docs = docs;
    if (index && !(index instanceof FuseIndex))
      throw new Error(INCORRECT_INDEX_TYPE);
    this._myIndex = index || createIndex(this.options.keys, this._docs, {
      getFn: this.options.getFn,
      fieldNormWeight: this.options.fieldNormWeight
    });
    if (this.options.useTokenSearch) {
      const analyzer = createAnalyzer({
        isCaseSensitive: this.options.isCaseSensitive,
        ignoreDiacritics: this.options.ignoreDiacritics,
        tokenize: this.options.tokenize
      });
      this._invertedIndex = buildInvertedIndex(this._myIndex.records, this._myIndex.keys.length, analyzer);
    }
    this._invalidateSearcherCache();
  }
  add(doc) {
    if (!isDefined(doc))
      return;
    this._docs.push(doc);
    const record = this._myIndex.add(doc, this._docs.length - 1);
    if (this._invertedIndex && record) {
      const analyzer = createAnalyzer({
        isCaseSensitive: this.options.isCaseSensitive,
        ignoreDiacritics: this.options.ignoreDiacritics,
        tokenize: this.options.tokenize
      });
      addToInvertedIndex(this._invertedIndex, record, this._myIndex.keys.length, analyzer);
    }
    this._invalidateSearcherCache();
  }
  remove(predicate = () => false) {
    const results = [];
    const indicesToRemove = [];
    for (let i = 0, len = this._docs.length;i < len; i += 1)
      if (predicate(this._docs[i], i)) {
        results.push(this._docs[i]);
        indicesToRemove.push(i);
      }
    if (indicesToRemove.length) {
      if (this._invertedIndex)
        removeAndShiftInvertedIndex(this._invertedIndex, indicesToRemove);
      const toRemove = new Set(indicesToRemove);
      this._docs = this._docs.filter((_, i) => !toRemove.has(i));
      this._myIndex.removeAll(indicesToRemove);
      this._invalidateSearcherCache();
    }
    return results;
  }
  removeAt(idx) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= this._docs.length)
      throw new Error(INVALID_DOC_INDEX);
    if (this._invertedIndex)
      removeAndShiftInvertedIndex(this._invertedIndex, [idx]);
    const doc = this._docs.splice(idx, 1)[0];
    this._myIndex.removeAt(idx);
    this._invalidateSearcherCache();
    return doc;
  }
  _invalidateSearcherCache() {
    this._lastQuery = null;
    this._lastSearcher = null;
  }
  getIndex() {
    return this._myIndex;
  }
  _normalizedKeys() {
    return this._myIndex.keys.map((key) => this._keyStore.get(key.id) || key);
  }
  search(query, options) {
    const { limit = -1 } = options || {};
    const { includeMatches, includeScore, shouldSort, sortFn, ignoreFieldNorm } = this.options;
    if (isString3(query) && !query.trim()) {
      let docs = this._docs.map((item, idx) => ({
        item,
        refIndex: idx
      }));
      if (isNumber3(limit) && limit > -1)
        docs = docs.slice(0, limit);
      return docs;
    }
    const useHeap = shouldSort && isNumber3(limit) && limit > 0 && isString3(query);
    const comparator = sortFn;
    const stable = (a, b) => comparator(a, b) || a.idx - b.idx;
    let results;
    if (useHeap) {
      const heap = new MaxHeap(limit, stable);
      if (isString3(this._docs[0]))
        this._searchStringList(query, {
          heap,
          ignoreFieldNorm
        });
      else
        this._searchObjectList(query, {
          heap,
          ignoreFieldNorm
        });
      results = heap.extractSorted();
    } else {
      results = isString3(query) ? isString3(this._docs[0]) ? this._searchStringList(query) : this._searchObjectList(query) : this._searchLogical(query);
      computeScore(results, { ignoreFieldNorm });
      if (shouldSort)
        results.sort(isString3(query) ? stable : comparator);
      if (isNumber3(limit) && limit > -1)
        results = results.slice(0, limit);
    }
    return format3(results, this._docs, {
      includeMatches,
      includeScore
    });
  }
  _searchStringList(query, { heap, ignoreFieldNorm } = {}) {
    const searcher = this._getSearcher(query);
    const requireAllTokens = this.options.useTokenSearch && this.options.tokenMatch === "all";
    const { records } = this._myIndex;
    const results = heap ? null : [];
    records.forEach(({ v: text, i: idx, n: norm }) => {
      if (!isDefined(text))
        return;
      const searchResult = searcher.searchIn(text);
      if (searchResult.isMatch) {
        const match = {
          score: searchResult.score,
          value: text,
          norm,
          indices: searchResult.indices
        };
        if (requireAllTokens) {
          match.matchedMask = searchResult.matchedMask;
          match.matchedTerms = searchResult.matchedTerms;
          match.termCount = searchResult.termCount;
        }
        const matches = [match];
        if (!requireAllTokens || this._coversAllTokens(matches)) {
          const result = {
            item: text,
            idx,
            matches
          };
          if (heap) {
            result.score = computeScoreSingle(result.matches, { ignoreFieldNorm });
            heap.insert(result);
          } else
            results.push(result);
        }
      }
    });
    return results;
  }
  _searchLogical(query) {
    throw new Error(LOGICAL_SEARCH_UNAVAILABLE);
  }
  _searchObjectList(query, { heap, ignoreFieldNorm } = {}) {
    const searcher = this._getSearcher(query);
    const requireAllTokens = this.options.useTokenSearch && this.options.tokenMatch === "all";
    const { records } = this._myIndex;
    const keys = this._normalizedKeys();
    const results = heap ? null : [];
    records.forEach(({ $: item, i: idx }) => {
      if (!isDefined(item))
        return;
      const matches = [];
      let anyKeyFailed = false;
      let hasInverse = false;
      keys.forEach((key, keyIndex) => {
        const keyMatches = this._findMatches({
          key,
          value: item[keyIndex],
          searcher
        });
        if (keyMatches.length) {
          matches.push(...keyMatches);
          if (keyMatches[0].hasInverse)
            hasInverse = true;
        } else
          anyKeyFailed = true;
      });
      if (hasInverse && anyKeyFailed)
        return;
      if (matches.length && (!requireAllTokens || this._coversAllTokens(matches))) {
        const result = {
          idx,
          item,
          matches
        };
        if (heap) {
          result.score = computeScoreSingle(result.matches, { ignoreFieldNorm });
          heap.insert(result);
        } else
          results.push(result);
      }
    });
    return results;
  }
  _findMatches({ key, value, searcher }) {
    if (!isDefined(value))
      return [];
    const matches = [];
    if (isArray(value))
      value.forEach(({ v: text, i: idx, n: norm }) => {
        if (!isDefined(text))
          return;
        const searchResult = searcher.searchIn(text);
        if (searchResult.isMatch) {
          const match = {
            score: searchResult.score,
            key,
            value: text,
            idx,
            norm,
            indices: searchResult.indices,
            hasInverse: searchResult.hasInverse
          };
          if (searchResult.termCount !== undefined) {
            match.matchedMask = searchResult.matchedMask;
            match.matchedTerms = searchResult.matchedTerms;
            match.termCount = searchResult.termCount;
          }
          matches.push(match);
        }
      });
    else {
      const { v: text, n: norm } = value;
      const searchResult = searcher.searchIn(text);
      if (searchResult.isMatch) {
        const match = {
          score: searchResult.score,
          key,
          value: text,
          norm,
          indices: searchResult.indices,
          hasInverse: searchResult.hasInverse
        };
        if (searchResult.termCount !== undefined) {
          match.matchedMask = searchResult.matchedMask;
          match.matchedTerms = searchResult.matchedTerms;
          match.termCount = searchResult.termCount;
        }
        matches.push(match);
      }
    }
    return matches;
  }
  _coversAllTokens(matches) {
    const termCount = matches.length ? matches[0].termCount : undefined;
    if (termCount === undefined)
      return true;
    if (termCount <= 31) {
      let coverage = 0;
      for (let i = 0;i < matches.length; i++)
        coverage |= matches[i].matchedMask || 0;
      return coverage === 2 ** termCount - 1;
    }
    const coverage = /* @__PURE__ */ new Set;
    for (let i = 0;i < matches.length; i++) {
      const terms = matches[i].matchedTerms;
      if (terms)
        for (const t of terms)
          coverage.add(t);
    }
    return coverage.size === termCount;
  }
};
Fuse.version = "7.5.0";
Fuse.createIndex = createIndex;
Fuse.parseIndex = parseIndex;
Fuse.config = Config;
Fuse.match = function(pattern, text, options) {
  if (options && options.useTokenSearch)
    throw new Error(FUSE_MATCH_TOKEN_SEARCH_UNSUPPORTED);
  return createSearcher(pattern, {
    ...Config,
    ...options
  }).searchIn(text);
};
Fuse.parseQuery = parse2;
Fuse.use = function(...plugins) {
  plugins.forEach((plugin) => register(plugin));
};
var entry_default = Fuse;

// src/search.ts
function ancestorPath(element, byId) {
  const path = [];
  let parent = element.parent === null ? undefined : byId.get(element.parent);
  while (parent !== undefined) {
    path.unshift(parent.title);
    parent = parent.parent === null ? undefined : byId.get(parent.parent);
  }
  return path;
}
function createArchitectureSearch(elements) {
  const byId = new Map(elements.map((element) => [element.representationId, element]));
  const records = [...elements].sort(compareSemanticElements).map((element) => {
    const path = ancestorPath(element, byId);
    return { element, path, pathText: path.join(" ") };
  });
  const fuse = new entry_default(records, {
    threshold: 0.35,
    ignoreLocation: true,
    includeScore: true,
    keys: [
      { name: "element.title", weight: 0.55 },
      { name: "element.id", weight: 0.25 },
      { name: "pathText", weight: 0.15 },
      { name: "element.overview", weight: 0.05 }
    ]
  });
  return {
    find(query) {
      const pattern = query.trim();
      if (pattern.length === 0)
        return [];
      return fuse.search(pattern).map(({ item, score }) => ({
        element: item.element,
        path: item.path,
        score
      }));
    }
  };
}

// src/viewers/web/search/model.ts
function taskIndex(tasks) {
  return new entry_default(tasks, {
    threshold: 0.35,
    ignoreLocation: true,
    includeScore: true,
    keys: [
      { name: "title", weight: 0.7 },
      { name: "id", weight: 0.3 }
    ]
  });
}
function createWebSearch(elements, tasks) {
  const architecture = createArchitectureSearch(elements);
  let work = taskIndex(tasks);
  return {
    updateTasks(tasks) {
      work = taskIndex(tasks);
    },
    find(query) {
      const pattern = query.trim();
      if (pattern.length === 0)
        return [];
      const results = [
        ...architecture.find(pattern).map((result) => ({ kind: "architecture", ...result })),
        ...work.search(pattern).map(({ item, score }) => ({ kind: "task", task: item, score }))
      ];
      return results.sort((left, right) => left.score - right.score);
    }
  };
}

// src/viewers/web/search/view.ts
function paintSearchResults(host, results, activeIndex) {
  host.replaceChildren();
  if (results.length === 0) {
    const empty = document.createElement("p");
    empty.className = "search-empty";
    empty.textContent = "No matches";
    host.append(empty);
    return;
  }
  results.forEach((result, index) => {
    const content = result.kind === "task" ? { mark: "#", title: result.task.title, meta: `Task · ${result.task.status}`, path: result.task.id } : {
      mark: kindGlyph(result.element.kind),
      title: result.element.title,
      meta: `${kindLabel(result.element.kind, result.element.external)} · ${result.element.origin}`,
      path: result.path.length === 0 ? result.element.id : result.path.join(" › ")
    };
    const row = document.createElement("button");
    row.type = "button";
    row.id = `web-search-result-${index}`;
    row.className = "anchored-option search-result";
    row.dataset.searchResult = String(index);
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", String(index === activeIndex));
    const rank = document.createElement("span");
    rank.className = "search-rank";
    rank.textContent = String(index + 1);
    const mark = document.createElement("span");
    mark.className = "search-mark";
    mark.textContent = content.mark;
    const name = document.createElement("span");
    name.className = "search-name";
    name.textContent = content.title;
    const meta = document.createElement("span");
    meta.className = "search-meta";
    meta.textContent = content.meta;
    const path = document.createElement("span");
    path.className = "search-path";
    path.textContent = content.path;
    row.append(rank, mark, name, meta, path);
    host.append(row);
  });
}

// src/viewers/web/search/control.ts
function editable(target) {
  return target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]') !== null;
}
function opensWebSearch(event, hasEditableTarget, applePlatform) {
  const commandKey = applePlatform ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  const modifiedK = event.key.toLowerCase() === "k" && commandKey && !event.altKey;
  const slash = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !hasEditableTarget;
  return modifiedK || slash;
}
function createSearchControl(options) {
  const { root, onOpen, onPreview, onAccept, onCancel } = options;
  const input = root.querySelector("input");
  const clear = root.querySelector(".search-clear");
  const menu = root.querySelector(".search-menu");
  const resultsHost = root.querySelector(".search-results");
  const count = root.querySelector(".result-count");
  const shortcut = root.querySelector(".search-shortcut");
  const applePlatform = /Mac|iPhone|iPad/.test(navigator.platform);
  shortcut.textContent = applePlatform ? "⌘K" : "Ctrl K";
  let search = createWebSearch(options.elements, options.tasks);
  let results = search.find("");
  let activeIndex = -1;
  let opened = false;
  function paint() {
    const hasQuery = input.value.trim().length > 0;
    root.toggleAttribute("data-has-query", hasQuery);
    menu.hidden = !hasQuery;
    const active = results[activeIndex];
    if (active === undefined)
      input.removeAttribute("aria-activedescendant");
    else
      input.setAttribute("aria-activedescendant", `web-search-result-${activeIndex}`);
    input.setAttribute("aria-expanded", String(hasQuery));
    if (!hasQuery)
      return;
    paintSearchResults(resultsHost, results, activeIndex);
    count.textContent = results.length === 1 ? "1 result" : `${results.length} results`;
  }
  function preview() {
    onPreview(results[activeIndex]);
  }
  function query() {
    results = search.find(input.value);
    activeIndex = -1;
    paint();
    resultsHost.scrollTop = 0;
    preview();
  }
  function open() {
    if (opened) {
      input.focus();
      return;
    }
    opened = true;
    root.setAttribute("data-open", "");
    onOpen();
    input.focus();
  }
  function close(accepted) {
    if (!opened)
      return;
    const result = results[Math.max(0, activeIndex)];
    opened = false;
    if (accepted && result !== undefined)
      onAccept(result);
    else
      onCancel();
    root.removeAttribute("data-open");
    input.value = "";
    results = [];
    paint();
    input.blur();
  }
  function move(step) {
    if (results.length === 0)
      return;
    activeIndex = activeIndex < 0 ? step > 0 ? 0 : results.length - 1 : (activeIndex + step + results.length) % results.length;
    paint();
    resultsHost.querySelector(`[data-search-result="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
    preview();
  }
  input.addEventListener("focus", open);
  input.addEventListener("input", query);
  input.parentElement.addEventListener("click", () => input.focus());
  clear.addEventListener("click", () => {
    input.value = "";
    query();
    input.focus();
  });
  resultsHost.addEventListener("click", (event) => {
    const row = event.target instanceof Element ? event.target.closest("[data-search-result]") : null;
    if (row === null)
      return;
    activeIndex = Number(row.dataset.searchResult);
    close(true);
  });
  bindPopover(root, { dismiss: () => close(false) });
  function handleOpenedKey(key) {
    if (key === "ArrowDown")
      move(1);
    else if (key === "ArrowUp")
      move(-1);
    else if (key === "Enter" && results.length > 0)
      close(true);
    else if (key === "Escape")
      close(false);
    else
      return false;
    return true;
  }
  document.addEventListener("keydown", (event) => {
    if (!opened) {
      if (!opensWebSearch(event, editable(event.target), applePlatform))
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      open();
      return;
    }
    if (!handleOpenedKey(event.key))
      return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  return {
    update(elements, tasks) {
      search = createWebSearch(elements, tasks);
      if (opened && input.value.trim().length > 0)
        query();
    },
    updateTasks(tasks) {
      search.updateTasks(tasks);
      if (opened && input.value.trim().length > 0)
        query();
    }
  };
}

// src/viewers/web/search/session.ts
function reveal(camera, point, frame) {
  if (point === undefined)
    return;
  const margin = Math.min(80, frame.width / 4, frame.height / 4);
  const screen = { x: point.x * camera.k + camera.x, y: point.y * camera.k + camera.y };
  const dx = screen.x < frame.x + margin ? frame.x + margin - screen.x : screen.x > frame.x + frame.width - margin ? frame.x + frame.width - margin - screen.x : 0;
  const dy = screen.y < frame.y + margin ? frame.y + margin - screen.y : screen.y > frame.y + frame.height - margin ? frame.y + frame.height - margin - screen.y : 0;
  return dx === 0 && dy === 0 ? undefined : pan(camera, dx, dy);
}
function createSearchSession(options) {
  let returnState;
  return createSearchControl({
    root: options.root,
    elements: options.elements,
    tasks: options.tasks,
    onOpen() {
      returnState = options.snapshot();
    },
    onPreview(result) {
      if (result === undefined) {
        options.previewMap(undefined);
        return;
      }
      const ids = result.kind === "architecture" ? [result.element.representationId] : options.taskElements(result.task);
      const current = options.snapshot();
      const point = ids.length === 0 ? undefined : options.anchorOf(ids[0]);
      const camera = reveal(current.camera, point, options.viewport());
      options.previewMap(ids, camera);
    },
    onAccept(result) {
      const current = options.snapshot();
      const previous = returnState;
      returnState = undefined;
      options.clearSource();
      if (result.kind === "task") {
        if (previous !== undefined)
          options.apply(previous, false);
        options.openTask(result.task.id);
        return;
      }
      const id = result.element.representationId;
      options.apply({
        ...current,
        selection: selectArchitecture(noSelection, id, false),
        detailsTab: detailsTabAfterSelection(current.detailsTab, primarySelection(current.selection), id)
      }, true);
    },
    onCancel() {
      const previous = returnState;
      returnState = undefined;
      if (previous === undefined)
        return;
      options.apply(previous, false);
    }
  });
}

// src/work/status-filter.ts
function preservedWorkStatuses(previousConfigured, enabled) {
  return previousConfigured.length === 0 ? undefined : enabled;
}
function workStatusFilters(configured, _defaultStatus, pinStatuses, enabled) {
  const present = new Set(pinStatuses);
  return {
    available: configured.filter((status) => present.has(status)),
    enabled: [...enabled ?? configured.filter((status) => status !== configured.at(-1))]
  };
}
function toggleWorkStatus(state, status) {
  return {
    ...state,
    enabled: state.enabled.includes(status) ? state.enabled.filter((item) => item !== status) : [...state.enabled, status]
  };
}

// src/viewers/web/work/summary.ts
var workSummaryCss = `
  #work .mark { position: relative; display: grid; place-items: center; width: 28px; height: 28px; }
  #work .mark .backlog-mark { filter: grayscale(1); }
  #work .mark .badge { position: absolute; top: -3px; right: -5px; width: 20px; height: 16px; }
  #work .mark .card { inset: 0; }
  #work .mark .face { border-radius: 8px; font-size: 10px; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }
  #work .mark .front { overflow: hidden; background: color-mix(in srgb, var(--accent) 85%, transparent); color: var(--on-colour); border: 0; }
  #work .mark .back { font-size: 11px; }
  #work .mark.empty .front { background: color-mix(in srgb, var(--muted) 85%, transparent); }
`;
function summarizeWork(pins, work, enabled) {
  const mapped = new Set(pins.map((pin) => pin.taskId));
  const items = work.items.filter((item) => mapped.has(item.id));
  const counts = work.statuses.map((status) => ({ status, count: items.filter((item) => item.status === status).length }));
  return {
    items,
    counts,
    enabled,
    terminal: work.statuses.at(-1),
    count: items.filter((item) => enabled.includes(item.status)).length
  };
}
function changedTask(item, old, previous, next) {
  const wasShown = old !== undefined && previous.enabled.includes(old.status);
  if (!wasShown && !next.enabled.includes(item.status))
    return;
  if (JSON.stringify(old) === JSON.stringify(item))
    return;
  if (wasShown && old?.status !== previous.terminal && item.status === next.terminal)
    return { kind: "completed", item };
  return { kind: old === undefined ? "added" : "updated", item };
}
function latestWorkChange(previous, next) {
  if (previous === undefined)
    return;
  const before = new Map(previous.items.map((item) => [item.id, item]));
  const after = new Set(next.items.map((item) => item.id));
  const changes = [];
  for (const item of next.items) {
    const change = changedTask(item, before.get(item.id), previous, next);
    if (change !== undefined)
      changes.push(change);
  }
  for (const item of previous.items) {
    if (!after.has(item.id) && previous.enabled.includes(item.status))
      changes.push({ kind: "removed", item });
  }
  return changes.sort((a, b) => Number(b.kind === "completed") - Number(a.kind === "completed") || b.item.updatedAt.localeCompare(a.item.updatedAt))[0];
}
function createWorkSummary(tip) {
  const element = document.createElement("span");
  element.className = "mark";
  element.setAttribute("role", "img");
  element.innerHTML = `${BACKLOG_MARK}<span class="badge"><span class="card"><span class="face front"><span class="count"></span></span><span class="face back">✓</span></span></span>`;
  tip.attach(element);
  const badge = element.querySelector(".badge");
  const card = element.querySelector(".card");
  const count = element.querySelector(".count");
  let previous;
  let latest;
  const animate = (change, delta) => {
    for (const animation of element.getAnimations({ subtree: true }))
      animation.cancel();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    if (change?.kind === "completed") {
      card.animate([
        { transform: "rotateY(0)", opacity: 1, offset: 0, easing: "ease" },
        { transform: "rotateY(180deg)", opacity: 1, offset: WORK_BADGE_FLIP_MS / WORK_BADGE_FINISH_MS },
        { transform: "rotateY(180deg)", opacity: 1, offset: (WORK_BADGE_FLIP_MS + WORK_BADGE_HOLD_MS) / WORK_BADGE_FINISH_MS },
        { transform: "rotateY(180deg)", opacity: 0, offset: 1 }
      ], { duration: WORK_BADGE_FINISH_MS });
    } else if (delta !== 0) {
      count.animate([{ transform: `translateY(${delta > 0 ? 100 : -100}%)`, opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], { duration: 300, easing: "ease-out" });
      badge.animate([{ transform: "translateY(0)" }, { transform: "translateY(-4px)", offset: 0.5 }, { transform: "translateY(0)", offset: 0.75 }, { transform: "translateY(0)" }], { duration: 700, easing: "ease-out" });
    } else if (change !== undefined) {
      badge.animate([{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 500, easing: "ease-out" });
    }
  };
  return {
    element,
    update(pins, work, enabled, folded) {
      if (work.statuses.length === 0) {
        previous = undefined;
        latest = undefined;
      }
      const next = summarizeWork(pins, work, enabled);
      const change = latestWorkChange(previous, next);
      const delta = previous === undefined ? 0 : next.count - previous.count;
      latest = change ?? latest;
      count.textContent = String(next.count);
      element.classList.toggle("empty", next.count === 0);
      const breakdown = next.counts.filter((row) => row.count > 0).map((row) => `${row.count} ${row.status}`).join(" · ");
      const event = latest === undefined ? "" : ` · ${latest.item.id} ${latest.kind}: ${latest.item.title}`;
      element.dataset.tip = `${next.count} shown · ${breakdown || "No mapped tasks"}${event}`;
      element.setAttribute("aria-label", element.dataset.tip);
      if (folded && (change !== undefined || delta !== 0))
        animate(change, delta);
      previous = work.statuses.length === 0 ? undefined : next;
    }
  };
}

// src/viewers/web/work/island.ts
var icon = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
var EYE_MARK = icon('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>');
var CHEVRON = icon('<path d="M6 15l6-6 6 6"/>');
var workCss = `
  ${workSummaryCss}
  /*
   * Centred by margins, not by a translate: a fractional transform would resample the blurred layer and soften the text.
   * Placed from the map, which fills the window, so the island adds an embedding page's chrome inset itself.
   */
  #work {
    --window-inset: var(--chrome-inset, 0px);
    position: absolute; left: 0; right: 0; bottom: calc(12px + var(--window-inset)); margin: 0 auto; width: fit-content; box-sizing: border-box; max-width: calc(100% - 24px);
    gap: 10px; padding: 6px 12px; overflow: hidden;
  }
  #work[hidden] { display: none; }
  #work .content { display: contents; }
  #work svg { width: 18px; height: 18px; flex: none; }
  #work .label .backlog-mark { filter: grayscale(1); }
  #work .divider { width: 1px; height: 24px; background: var(--hairline); flex: none; }
  #work button { display: flex; align-items: center; gap: 6px; border: 0; background: transparent; padding: 4px; border-radius: 14px; }
  #work .label { display: flex; align-items: center; gap: 8px; margin-right: 4px; padding-left: 8px; font-weight: 600; }
  #work .label .backlog-mark { width: 29px; height: 36px; }
  #work .toggle, #work .chip { height: 38px; border-radius: 20px; }
  #work .toggle { padding: 4px 10px; border: 1px solid var(--hairline); color: var(--muted); }
  #work .toggle[aria-pressed="true"] { color: var(--highlight-text); border-color: var(--highlight); }
  #work .strip { display: flex; align-items: flex-start; gap: 8px; overflow-x: auto; overflow-y: hidden; box-sizing: border-box; height: 54px; padding: 5px 0 0; min-width: 0; }
  #work .chip {
    flex: none; gap: 8px; padding: 4px 10px 4px 4px; border: 1px solid var(--hairline);
    font-size: 10px; letter-spacing: 0.08em; filter: grayscale(1);
  }
  #work .chip:hover { border-color: var(--ink); }
  #work .chip.active { filter: none; border-color: var(--highlight); color: var(--highlight-text); }
  #work .chip .badge { width: 28px; height: 28px; }
  #work .chip .badge .card { inset: 3px; }
  #work .chip .badge .face { font-size: 8px; }
  #work .chip .badge .ring { width: 100%; height: 100%; }
  #work .chip .badge .face svg { width: 12px; height: 12px; }
  #work .chip .badge .ring circle { stroke-width: 4; }
  #work .chip.work-done { --pin: var(--muted); }
  #work .chip.selected { font-weight: 700; }
  #work .fold svg { transition: transform 0.3s ease; }
  #work.open .fold svg { transform: rotate(180deg); }
  @media (prefers-reduced-motion: reduce) {
    #work .fold svg { transition: none; }
  }
`;
function button2(className, html, onClick) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = className;
  node.innerHTML = html;
  node.addEventListener("click", onClick);
  return node;
}
function chip(pin, finishingAt, onToggle, tip) {
  const node = button2("chip", `${WORK_BADGE}<span>${pin.taskId}</span>`, () => onToggle(pin.taskId));
  node.dataset.task = pin.taskId;
  node.style.setProperty("--pin", pin.colour);
  node.dataset.tip = `${pin.assignee ?? "Unassigned"} · ${pin.title}`;
  tip.attach(node);
  fillWorkBadge(node, pin, finishingAt);
  return node;
}
function createWorkIsland(host, onToggle, onShow, tip) {
  const island = document.createElement("div");
  island.id = "work";
  island.className = "floating-map-bar";
  island.hidden = true;
  const content = document.createElement("div");
  content.className = "content";
  let pins = [];
  let work = { statuses: [], defaultStatus: "", items: [] };
  const summary = createWorkSummary(tip);
  let statusFilters;
  const finishing = new Map;
  let open = false;
  let active = [];
  let selected;
  let foldRevision = 0;
  let foldAnimation;
  const toggle = (status) => {
    const pressed = statusFilters?.enabled.includes(status) ?? false;
    const node = button2("toggle", `${EYE_MARK}${status}`, () => {
      statusFilters = toggleWorkStatus(statusFilters, status);
      onShow(statusFilters.enabled);
      rebuild();
    });
    node.setAttribute("aria-pressed", String(pressed));
    return node;
  };
  const parts = () => {
    const divider = document.createElement("span");
    divider.className = "divider";
    if (!open)
      return [summary.element, divider];
    const label = document.createElement("span");
    label.className = "label";
    label.innerHTML = `${BACKLOG_MARK}<span>Backlog.md<br>Tasks</span>`;
    const strip = document.createElement("div");
    strip.className = "strip";
    const order = new Map(work.statuses.map((status, index) => [status, index]));
    const shown = pins.filter((pin) => statusFilters.enabled.includes(pin.status) || finishing.has(pin.key));
    shown.sort((left, right) => order.get(left.status) - order.get(right.status));
    strip.append(...shown.map((pin) => {
      const node = chip(pin, finishing.get(pin.key), onToggle, tip);
      node.classList.toggle("work-disappearing", finishing.has(pin.key) && !statusFilters.enabled.includes(pin.status));
      return node;
    }));
    return [
      label,
      ...statusFilters.available.map(toggle),
      divider,
      strip
    ];
  };
  const mark = () => {
    for (const chip of island.querySelectorAll(".chip")) {
      chip.classList.toggle("active", active.includes(chip.dataset.task));
      chip.classList.toggle("selected", chip.dataset.task === selected);
    }
    const chip = island.querySelector(".chip.selected");
    if (chip === null)
      return;
    const strip = chip.parentElement;
    const box = strip.getBoundingClientRect();
    const { left, right } = chip.getBoundingClientRect();
    if (left >= box.left && right <= box.right)
      return;
    strip.scrollBy({ left: (left + right - box.left - box.right) / 2, behavior: "smooth" });
  };
  const rebuild = () => {
    const scrolled = island.querySelector(".strip")?.scrollLeft ?? 0;
    foldAnimation?.cancel();
    foldAnimation = undefined;
    foldRevision += 1;
    content.replaceChildren(...parts());
    island.hidden = work.statuses.length === 0;
    island.classList.toggle("open", open);
    island.querySelector(".strip")?.scrollTo(scrolled, 0);
    mark();
    summary.update(pins, work, statusFilters?.enabled ?? [], !open);
  };
  const fold = button2("fold", CHEVRON, () => {
    open = !open;
    island.classList.toggle("open", open);
    fold.setAttribute("aria-expanded", String(open));
    const revision = ++foldRevision;
    foldAnimation?.cancel();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      rebuild();
      return;
    }
    const cover = island.animate([
      { clipPath: "inset(0 round 28px)", opacity: 1 },
      { clipPath: "inset(0 46% round 28px)", opacity: 0.25 }
    ], { duration: 120, easing: "ease-in", fill: "forwards" });
    foldAnimation = cover;
    cover.finished.then(() => {
      if (revision !== foldRevision)
        return;
      content.replaceChildren(...parts());
      mark();
      cover.cancel();
      foldAnimation = island.animate([
        { clipPath: "inset(0 46% round 28px)", opacity: 0.25 },
        { clipPath: "inset(0 round 28px)", opacity: 1 }
      ], { duration: 160, easing: "ease-out" });
    }).catch(() => {
      return;
    });
  });
  fold.setAttribute("aria-expanded", "false");
  island.append(content, fold);
  host.append(island);
  return {
    paint(nextPins, nextWork) {
      const visible = new Set(open ? pins.filter((pin) => statusFilters?.enabled.includes(pin.status) || finishing.has(pin.key)).map((pin) => pin.key) : []);
      const started = finishingWorkKeys(pins, nextPins);
      for (const key of started) {
        if (visible.has(key)) {
          finishing.set(key, Date.now());
        } else
          started.delete(key);
      }
      const enabled = preservedWorkStatuses(work.statuses, statusFilters?.enabled);
      pins = nextPins;
      work = nextWork;
      statusFilters = workStatusFilters(work.statuses, work.defaultStatus, pins.map((pin) => pin.status), enabled);
      onShow(statusFilters.enabled);
      rebuild();
      if (started.size > 0)
        setTimeout(() => {
          for (const key of started)
            finishing.delete(key);
          rebuild();
        }, WORK_BADGE_FINISH_MS);
    },
    activate(nextActive, nextSelected) {
      active = nextActive;
      selected = nextSelected;
      mark();
    }
  };
}

// src/viewers/web/work/selection.ts
function toggleWorkSelection(active, selected, clicked) {
  if (selected !== clicked) {
    return openWorkSelection(active, clicked);
  }
  const remaining = active.filter((id) => id !== clicked);
  return { active: remaining, selected: remaining.at(-1) };
}
function openWorkSelection(active, id) {
  return { active: active.includes(id) ? [...active] : [...active, id], selected: id };
}

// src/viewers/web/source/view.ts
function paintSource(host, component, file, line, payload, error, onBack) {
  leaveFileDiff(host);
  host.classList.add("file-open");
  host.classList.add("source-open");
  host.querySelector("h1").textContent = file;
  const toolbar = host.querySelector(".tabs");
  toolbar.hidden = false;
  toolbar.classList.remove("controls");
  toolbar.classList.add("file-toolbar", "source-toolbar");
  const back = chromeButton("Back", { glyph: "←" });
  back.classList.add("source-back");
  back.addEventListener("click", onBack);
  const context = document.createElement("span");
  context.className = "file-context";
  context.textContent = `Component · ${component.title}`;
  const sourceLines = payload?.source.replace(/\r\n/g, `
`).split(`
`);
  if (sourceLines?.at(-1) === "")
    sourceLines.pop();
  const facts = document.createElement("span");
  facts.className = "file-facts";
  facts.textContent = sourceLines === undefined ? "" : `${sourceLines.length} lines`;
  toolbar.replaceChildren(back, context, facts);
  const body = host.querySelector(".body");
  if (payload === undefined) {
    const status = document.createElement("p");
    status.className = "source-status";
    status.textContent = error ?? "Loading source";
    body.replaceChildren(status);
    return;
  }
  const lines = document.createElement("ol");
  lines.className = "source-lines";
  lines.setAttribute("aria-label", file);
  let selected;
  for (const [index, source] of sourceLines.entries()) {
    const row = document.createElement("li");
    row.className = "source-line";
    if (index + 1 === line) {
      row.classList.add("selected");
      row.setAttribute("aria-current", "location");
      selected = row;
    }
    const number = document.createElement("span");
    number.className = "source-line-number";
    number.setAttribute("aria-hidden", "true");
    number.textContent = String(index + 1);
    const code = document.createElement("code");
    code.append(highlightedLine(source));
    row.append(number, code);
    lines.append(row);
  }
  body.replaceChildren(lines);
  selected?.scrollIntoView({ block: "center" });
}
function leaveSource(host) {
  leaveFileDiff(host);
  host.classList.remove("file-open");
  host.classList.remove("source-open");
  host.querySelector(".tabs").classList.remove("file-toolbar", "source-toolbar");
  host.querySelector(".tabs").classList.add("controls");
}

// src/viewers/web/source/control.ts
function ownsFile(element, file, comparison) {
  return element.kind === "component" && (comparison?.files ?? element.code).some((reference) => reference.file === file);
}
function sameRequest(options, request, activeRequest, revision, elementId, from) {
  return request === activeRequest && options.revision() === revision && options.from?.() === from && options.element()?.representationId === elementId;
}
function errorMessage(reason) {
  return reason instanceof Error && reason.message !== "" ? reason.message : "Source unavailable";
}
function createSourceControl(options) {
  let file = options.initialFile;
  let line = options.initialLine;
  let payload;
  let error;
  let request = 0;
  let structureElement;
  let structureRevision;
  let codeFiles = [];
  let structureRequest = 0;
  let openedBy;
  let detailsScrollTop = 0;
  function closeSource() {
    request += 1;
    file = undefined;
    line = undefined;
    payload = undefined;
    error = undefined;
  }
  function clear() {
    closeSource();
    openedBy = undefined;
    structureRequest += 1;
    structureElement = undefined;
    structureRevision = undefined;
    codeFiles = [];
  }
  function back() {
    closeSource();
    const elementId = options.element()?.representationId;
    options.repaint();
    const restore = () => {
      if (file === undefined && options.element()?.representationId === elementId) {
        options.host.scrollTop = detailsScrollTop;
      }
    };
    restore();
    Promise.all(options.host.getAnimations().map((animation) => animation.finished)).then(restore, () => {});
  }
  function changedFile(file) {
    const diff = options.comparison?.()?.files.find((item) => item.file === file);
    return diff?.status === "unchanged" ? undefined : diff;
  }
  async function load(nextFile, nextLine) {
    const element = options.element();
    if (element?.kind !== "component")
      return;
    const elementId = element.representationId;
    const revision = options.revision();
    const from = options.from?.();
    const activeRequest = ++request;
    openedBy = elementId;
    file = nextFile;
    line = nextLine;
    payload = undefined;
    error = undefined;
    options.repaint();
    if (changedFile(nextFile) !== undefined)
      return;
    try {
      const loaded = await options.readSource(elementId, nextFile, revision, from);
      if (!sameRequest(options, request, activeRequest, revision, elementId, from))
        return;
      payload = loaded;
    } catch (reason) {
      if (activeRequest !== request)
        return;
      error = errorMessage(reason);
    }
    options.repaint();
  }
  function paintFileNavigation() {
    const files = options.comparison?.()?.files.filter((item) => item.status !== "unchanged") ?? [];
    if (files.length < 2)
      return;
    const index = files.findIndex((item) => item.file === file);
    const navigation = document.createElement("span");
    navigation.className = "file-stepper";
    const position = document.createElement("span");
    position.textContent = `${index + 1} / ${files.length}`;
    position.setAttribute("aria-live", "polite");
    const step = (direction, label, glyph) => {
      const button = chromeButton("", { glyph, ariaLabel: label });
      const target = files[index + direction];
      button.disabled = target === undefined;
      button.onclick = () => {
        if (target !== undefined)
          load(target.file);
      };
      return button;
    };
    navigation.append(step(-1, "Previous changed file", "←"), position, step(1, "Next changed file", "→"));
    options.host.querySelector(".tabs").append(navigation);
  }
  async function loadStructure(element, revision) {
    const activeRequest = ++structureRequest;
    try {
      const loaded = await options.readCode(element.representationId, revision, options.from?.());
      if (activeRequest !== structureRequest || structureElement !== element || structureRevision !== revision)
        return;
      codeFiles = loaded;
    } catch {
      if (activeRequest !== structureRequest || structureElement !== element || structureRevision !== revision)
        return;
      codeFiles = [];
    }
    options.repaint();
  }
  return {
    get file() {
      return file;
    },
    get line() {
      return line;
    },
    back,
    clear,
    code() {
      const element = options.element();
      if (element?.kind !== "component")
        return [];
      const revision = options.revision();
      if (structureElement === element && structureRevision === revision)
        return codeFiles;
      structureElement = element;
      structureRevision = revision;
      codeFiles = [];
      if (element.code.length > 0)
        loadStructure(element, revision);
      return codeFiles;
    },
    open(nextFile, nextLine) {
      if (file === undefined)
        detailsScrollTop = options.host.scrollTop;
      load(nextFile, nextLine);
    },
    paint(element) {
      if (file === undefined) {
        leaveSource(options.host);
        return false;
      }
      if (element === undefined || element.representationId !== openedBy && !ownsFile(element, file, options.comparison?.())) {
        clear();
        leaveSource(options.host);
        return false;
      }
      const diff = changedFile(file);
      if (diff === undefined)
        paintSource(options.host, element, file, line, payload, error, back);
      else {
        leaveSource(options.host);
        paintFileDiff(options.host, diff, element.title, back);
        paintFileNavigation();
      }
      return true;
    },
    restore() {
      if (file !== undefined)
        load(file, line);
    }
  };
}

// src/viewers/web/task-diff/updates.ts
function animateChange(node, added, offset = 0, changed = true) {
  for (const animation of node.getAnimations())
    animation.cancel();
  node.animate([
    { opacity: added ? 0 : 1, transform: `translateY(${offset || (added ? 6 : 0)}px)`, backgroundColor: changed ? "color-mix(in srgb, var(--highlight) 14%, transparent)" : "transparent" },
    { opacity: 1, transform: "translateY(0)", backgroundColor: "transparent" }
  ], { duration: 360, easing: "ease-out" });
}
function updateTaskText(node, text, animate) {
  if (node.textContent === text)
    return;
  node.textContent = text;
  if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches)
    animateChange(node, false);
}
function nodeKey(node, index) {
  return node instanceof HTMLElement && node.dataset.taskKey !== undefined ? node.dataset.taskKey : `${node.nodeName}:${index}`;
}
function updateNode(current, next) {
  if (current.nodeName !== next.nodeName)
    return next;
  if (!(current instanceof HTMLElement) || !(next instanceof HTMLElement)) {
    if (current.nodeValue !== next.nodeValue)
      current.nodeValue = next.nodeValue;
    return current;
  }
  for (const attribute of [...current.attributes]) {
    if (!next.hasAttribute(attribute.name))
      current.removeAttribute(attribute.name);
  }
  for (const attribute of [...next.attributes]) {
    if (current.getAttribute(attribute.name) !== attribute.value)
      current.setAttribute(attribute.name, attribute.value);
  }
  current.onclick = next.onclick;
  updateChildren(current, next);
  return current;
}
function updateChildren(current, next) {
  const previous = new Map([...current.childNodes].map((node, index) => [nodeKey(node, index), node]));
  for (const [index, child] of [...next.childNodes].entries()) {
    const key = nodeKey(child, index);
    const old = previous.get(key);
    const result = old === undefined ? child : updateNode(old, child);
    const at = current.childNodes[index] ?? null;
    if (at !== result)
      current.insertBefore(result, at);
    if (old !== undefined && result !== old)
      current.removeChild(old);
    previous.delete(key);
  }
  for (const node of previous.values())
    current.removeChild(node);
}
function updateTaskSummary(host, next) {
  const body = host.querySelector(".body");
  const current = body.firstElementChild;
  if (current === null || current.dataset.taskId !== next.dataset.taskId) {
    body.replaceChildren(next);
    return;
  }
  const scrollTop = host.scrollTop;
  const animate = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const selector = "h2, p, li, .task-diff-source";
  const before = new Map([...current.querySelectorAll(selector)].map((node) => [node, {
    html: node.innerHTML,
    top: node.offsetTop,
    checked: node.dataset.checked
  }]));
  updateChildren(current, next);
  host.scrollTop = scrollTop;
  if (!animate) {
    for (const animation of current.getAnimations({ subtree: true }))
      animation.cancel();
    return;
  }
  for (const node of current.querySelectorAll(selector)) {
    const old = before.get(node);
    const offset = old === undefined ? 0 : old.top - node.offsetTop;
    const changed = old?.html !== node.innerHTML;
    if (changed || offset !== 0)
      animateChange(node, old === undefined, offset, changed);
    if (old !== undefined && old.checked !== node.dataset.checked) {
      node.querySelector(".criterion-mark")?.animate([
        { transform: "scale(0.6)" },
        { transform: "scale(1.25)" },
        { transform: "scale(1)" }
      ], { duration: 320, easing: "ease-out" });
    }
  }
}

// src/viewers/web/task-diff/view.ts
function heading4(label) {
  const row = document.createElement("h2");
  row.className = "section";
  row.textContent = label;
  return row;
}
function marked2(kind, external, text) {
  const row = document.createElement("span");
  const mark = document.createElement("span");
  mark.className = "mark";
  mark.textContent = kindGlyph(kind);
  if (external)
    mark.classList.add("ghost");
  row.append(mark, " ", text);
  return row;
}
function sourceIdentity(payload) {
  const source = document.createElement("div");
  source.className = "task-diff-source";
  source.dataset.taskKey = "source";
  const kind = document.createElement("span");
  kind.textContent = payload.source.kind === "commit" ? "Commit" : "Working tree from HEAD";
  const revision = document.createElement("code");
  revision.textContent = payload.source.revision;
  const base = document.createElement("code");
  base.textContent = `base ${payload.source.base}`;
  source.append(kind, revision, base);
  return source;
}
function pendingFileRow(file, failed) {
  const row = document.createElement("li");
  row.dataset.taskKey = file;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "diff-file-row";
  button.disabled = true;
  const mark = document.createElement("span");
  mark.className = "diff-file-status pending";
  mark.textContent = failed ? "!" : "…";
  mark.title = failed ? "Unavailable" : "Loading";
  const name = document.createElement("span");
  name.className = "diff-file-name";
  name.textContent = file;
  button.append(mark, name);
  row.append(button);
  return row;
}
function section(body, key, label, rows) {
  if (rows.length === 0)
    return;
  const title = heading4(label);
  title.dataset.taskKey = `${key}-heading`;
  const list = document.createElement("ul");
  list.dataset.taskKey = key;
  const occurrences = new Map;
  for (const row of rows) {
    const identity = row.dataset.taskKey;
    const occurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, occurrence + 1);
    row.dataset.taskKey = `${identity}:${occurrence}`;
  }
  list.append(...rows);
  body.append(title, list);
}
function checklistRows(items) {
  return items.map((item) => {
    const row = document.createElement("li");
    row.dataset.taskKey = item.text;
    row.dataset.checked = String(item.checked);
    const check = document.createElement("span");
    check.className = `criterion-mark${item.checked ? " criterion-check" : ""}`;
    check.textContent = item.checked ? "✓" : "○";
    const text = document.createElement("span");
    text.className = item.checked ? "ghost" : "";
    text.textContent = ` ${item.text}`;
    row.append(check, text);
    return row;
  });
}
function textSection(body, label, text) {
  if (text === "")
    return;
  const content = document.createElement("p");
  content.className = "task-text";
  content.textContent = text;
  const title = heading4(label);
  title.dataset.taskKey = `${label}-heading`;
  content.dataset.taskKey = label;
  body.append(title, content);
}
function paintTaskSummary(host, item, details, detailsError, world, payload, error, onSelect, onOpen) {
  leaveFileDiff(host);
  const index = sourceIndex(world.elements);
  const continuing = host.querySelector(".task-summary")?.dataset.taskId === item.id;
  updateTaskText(host.querySelector("h1"), item.title, continuing);
  updateTaskText(host.querySelector(".meta"), [item.id, item.status, ...item.assignees].join(" · "), continuing);
  host.querySelector(".tabs").replaceChildren();
  const body = document.createElement("div");
  body.className = "task-summary";
  body.dataset.taskId = item.id;
  if (detailsError !== undefined) {
    const status = document.createElement("p");
    status.className = "diff-status";
    status.dataset.taskKey = "details-error";
    status.textContent = detailsError;
    body.append(status);
  }
  if (details !== undefined && details.description !== "") {
    const paragraph = document.createElement("p");
    paragraph.className = "description";
    paragraph.dataset.taskKey = "description";
    paragraph.textContent = details.description;
    body.append(paragraph);
  }
  if (details !== undefined) {
    section(body, "acceptance", `Acceptance criteria · ${details.acceptanceCriteria.filter((criterion) => criterion.checked).length} of ${details.acceptanceCriteria.length}`, checklistRows(details.acceptanceCriteria));
    const done = details.definitionOfDone.filter((criterion) => criterion.checked).length;
    section(body, "done", `Definition of Done · ${done} of ${details.definitionOfDone.length}`, checklistRows(details.definitionOfDone));
  }
  textSection(body, "Implementation plan", details?.implementationPlan ?? "");
  section(body, "references", "References", item.references.map((reference) => {
    const row = document.createElement("li");
    row.dataset.taskKey = reference;
    const element = index.resolve(reference);
    if (element === undefined)
      row.textContent = reference;
    else {
      const link = document.createElement("button");
      link.type = "button";
      link.className = "link";
      link.append(marked2(element.kind, element.external, reference === element.id ? element.title : reference));
      link.onclick = (event) => onSelect(element.representationId, event.shiftKey);
      row.append(link);
    }
    return row;
  }));
  const fileRows = item.modifiedFiles.map((file) => {
    const loaded = payload?.files.find((candidate) => candidate.file === file);
    if (loaded === undefined)
      return pendingFileRow(file, error !== undefined);
    const row = fileDiffRow(loaded, onOpen, loaded.shared);
    row.dataset.taskKey = file;
    return row;
  });
  section(body, "files", "Modified files", fileRows);
  if (payload !== undefined)
    body.append(sourceIdentity(payload));
  else if (error !== undefined) {
    const status = document.createElement("p");
    status.className = "diff-status";
    status.dataset.taskKey = "diff-error";
    status.textContent = error;
    body.append(status);
  }
  textSection(body, "Implementation notes", details?.implementationNotes ?? "");
  section(body, "comments", "Comments", (details?.comments ?? []).map((comment) => {
    const row = document.createElement("li");
    row.className = "task-comment";
    row.dataset.taskKey = `${comment.author}:${comment.createdAt}`;
    const meta = document.createElement("div");
    meta.className = "ghost";
    meta.textContent = `${comment.author} · ${comment.createdAt}`;
    const text = document.createElement("div");
    text.textContent = comment.body;
    row.append(meta, text);
    return row;
  }));
  updateTaskSummary(host, body);
}
function paintTaskFile(host, item, payload, file, onBack) {
  paintFileDiff(host, file, `${item.id}${file.shared ? " · Shared" : ""}`, onBack, sourceIdentity(payload));
}

// src/viewers/web/task-diff/control.ts
function diffKey(item) {
  return [item.id, item.title, item.status, ...item.modifiedFiles].join("\x00");
}
function detailsKey(item) {
  return JSON.stringify(item);
}
function errorMessage2(reason, fallback) {
  return reason instanceof Error && reason.message !== "" ? reason.message : fallback;
}
function createTaskDiffControl(options) {
  let activeDiffKey;
  let activeDetailsKey;
  let item;
  let details;
  let detailsError;
  let payload;
  let error;
  let file;
  let diffRequest = 0;
  let detailsRequest = 0;
  let summaryScrollTop = 0;
  function back() {
    file = undefined;
    options.repaint();
    const taskId = item?.id;
    const restore = () => {
      if (item?.id === taskId && file === undefined)
        options.host.scrollTop = summaryScrollTop;
    };
    restore();
    Promise.all(options.host.getAnimations().map((animation) => animation.finished)).then(restore, () => {});
  }
  function open(nextFile) {
    if (payload?.files.some((candidate) => candidate.file === nextFile) !== true)
      return;
    summaryScrollTop = options.host.scrollTop;
    file = nextFile;
    options.repaint();
  }
  async function loadDiff(nextItem, activeRequest) {
    try {
      const loaded = await options.readDiff(nextItem.id);
      if (activeRequest !== diffRequest || item?.id !== loaded.taskId)
        return;
      payload = loaded;
    } catch (reason) {
      if (activeRequest !== diffRequest)
        return;
      payload = undefined;
      error = errorMessage2(reason, "Diff unavailable");
    }
    options.repaint();
  }
  async function loadDetails(nextItem, activeRequest) {
    try {
      const loaded = await options.readDetails(nextItem.id);
      if (activeRequest !== detailsRequest || item?.id !== loaded.id)
        return;
      details = loaded;
      options.repaint();
    } catch (reason) {
      if (activeRequest !== detailsRequest)
        return;
      detailsError = errorMessage2(reason, "Task details unavailable");
      options.repaint();
    }
  }
  function refresh(nextItem) {
    const changedTask = item?.id !== nextItem.id;
    item = nextItem;
    if (changedTask) {
      details = undefined;
      payload = undefined;
      file = undefined;
    }
    const nextDetailsKey = detailsKey(nextItem);
    if (nextDetailsKey !== activeDetailsKey) {
      activeDetailsKey = nextDetailsKey;
      detailsError = undefined;
      loadDetails(nextItem, ++detailsRequest);
    }
    const nextDiffKey = diffKey(nextItem);
    if (nextDiffKey !== activeDiffKey) {
      activeDiffKey = nextDiffKey;
      error = undefined;
      loadDiff(nextItem, ++diffRequest);
    }
  }
  return {
    invalidate() {
      error = undefined;
      if (item !== undefined)
        loadDiff(item, ++diffRequest);
    },
    paint(nextItem) {
      if (nextItem === undefined) {
        diffRequest += 1;
        detailsRequest += 1;
        activeDiffKey = undefined;
        activeDetailsKey = undefined;
        item = undefined;
        details = undefined;
        detailsError = undefined;
        payload = undefined;
        error = undefined;
        file = undefined;
        leaveFileDiff(options.host);
        return false;
      }
      refresh(nextItem);
      const selected = payload?.files.find((candidate) => candidate.file === file);
      if (payload !== undefined && selected !== undefined) {
        paintTaskFile(options.host, nextItem, payload, selected, back);
      } else {
        paintTaskSummary(options.host, nextItem, details, detailsError, options.world(), payload, error, options.select, open);
      }
      return true;
    }
  };
}

// src/viewers/web/url.ts
var KINDS = ["actor", "system", "container", "component"];
function relationshipFor(value, byId, world) {
  const [from, to] = value.split("/");
  const source = byId.get(from ?? "")?.representationId;
  const target = byId.get(to ?? "")?.representationId;
  return world.relationships.find((item) => item.source === source && item.target === target);
}
function architectureId(name, value, byId, world) {
  const element = byId.get(value);
  if (KINDS.includes(name) && element?.kind === name)
    return element.representationId;
  return name === "relationship" ? relationshipFor(value, byId, world)?.id : undefined;
}
function architectureSelection(params, byId, world) {
  const ids = [];
  for (const [name, value] of params) {
    const id = architectureId(name, value, byId, world);
    if (id !== undefined && !ids.includes(id))
      ids.push(id);
  }
  return ids;
}
function activeFlows(params, world) {
  const flows = [...new Set(params.getAll("flow"))].filter((id) => world.flows.some((item) => item.id === id)).map((id) => ({ id }));
  const active = flows.at(-1);
  const flow = world.flows.find((item) => item.id === active?.id);
  if (flow === undefined || active === undefined)
    return flows;
  const requested = Number(params.get("step"));
  const step = Number.isInteger(requested) && requested >= 1 && requested <= flow.steps.length ? requested - 1 : undefined;
  if (step !== undefined)
    active.step = step;
  return flows;
}
function sourceState(params, selected, comparison) {
  if (selected?.kind !== "component")
    return {};
  const requestedFile = params.get("file");
  const file = (comparison?.components[selected.id]?.files ?? selected.code).find((reference) => reference.file === requestedFile)?.file;
  if (file === undefined)
    return {};
  const requestedLine = Number(params.get("line"));
  return Number.isInteger(requestedLine) && requestedLine > 0 ? { file, line: requestedLine } : { file };
}
function appendSourceState(pairs, state, selected, comparison) {
  if (state.file === undefined || selected?.kind !== "component")
    return;
  const file = (comparison?.components[selected.id]?.files ?? selected.code).find((reference) => reference.file === state.file)?.file;
  if (file === undefined)
    return;
  pairs.push(["file", file]);
  if (state.line !== undefined)
    pairs.push(["line", String(state.line)]);
}
function pathTheme(pathname) {
  const theme = pathname.match(/\/architecture\/([^/]+)\/?$/)?.[1];
  return isThemeMode(theme) ? theme : undefined;
}
function readTheme(url, defaultTheme = "auto") {
  const selected = new URLSearchParams(url.search).get("theme");
  return isThemeMode(selected) ? selected : pathTheme(url.pathname) ?? defaultTheme;
}
function readTab(params, file, change) {
  if (file !== undefined || params.get("tab") === "how")
    return "how";
  if (params.get("tab") === "tasks")
    return "tasks";
  return params.has("tab") ? "what" : comparisonDefaultTab(change);
}
function appendTab(pairs, state, change) {
  if (state.selection.kind !== "architecture")
    return;
  if (state.tab !== "what" || comparisonDefaultTab(change) === "how")
    pairs.push(["tab", state.tab]);
}
function readView(url, world, work, revisions = [], defaultTheme = "auto", comparison, defaultControls) {
  const params = new URLSearchParams(url.search);
  const inset = Number(params.get("inset"));
  const revision = revisions.find((candidate) => candidate.id === params.get("revision"))?.id;
  const byId = new Map(world.elements.map((element) => [element.id, element]));
  const architecture = architectureSelection(params, byId, world);
  const task = work.find((item) => item.id === params.get("task"));
  const flows = activeFlows(params, world);
  const flow = flows.at(-1);
  const selection = architecture.length > 0 ? { kind: "architecture", ids: architecture } : task !== undefined ? selectTask(task.id) : flow !== undefined ? { kind: "flow", id: flow.id } : noSelection;
  const selected = selection.kind === "architecture" ? world.elements.find((element) => element.representationId === selection.ids.at(-1)) : undefined;
  const source = sourceState(params, selected, comparison);
  return {
    ...readMapControls(params, defaultControls),
    ...revision === undefined ? {} : { revision },
    ...Number.isInteger(inset) && inset > 0 ? { inset } : {},
    ...source,
    selection,
    flows,
    tab: readTab(params, source.file, comparison?.components[selected?.id ?? ""]),
    theme: readTheme(url, defaultTheme),
    hudVisible: params.get("hud") !== "off"
  };
}
function relationshipEnds(relationshipId, elements, world) {
  const relationship = world.relationships.find((item) => item.id === relationshipId);
  const source = elements.get(relationship?.source ?? "");
  const target = elements.get(relationship?.target ?? "");
  return source === undefined || target === undefined ? undefined : `${source.id}/${target.id}`;
}
function appendSelection(pairs, state, elements, world, work) {
  if (state.selection.kind === "architecture") {
    for (const id of state.selection.ids) {
      const element = elements.get(id);
      const relationship = relationshipEnds(id, elements, world);
      if (element !== undefined)
        pairs.push([element.kind, element.id]);
      else if (relationship !== undefined)
        pairs.push(["relationship", relationship]);
    }
    return;
  }
  if (state.selection.kind !== "task")
    return;
  const taskId = state.selection.id;
  const task = work.find((item) => item.id === taskId);
  if (task !== undefined)
    pairs.push(["task", task.id]);
}
function appendFlow(pairs, flow, world) {
  const record = world.flows.find((item) => item.id === flow?.id);
  if (record === undefined)
    return;
  pairs.push(["flow", record.id]);
  if (flow?.step !== undefined && record.steps[flow.step] !== undefined)
    pairs.push(["step", String(flow.step + 1)]);
}
function writeView(state, world, work, pathname, comparison) {
  const elements = new Map(world.elements.map((element) => [element.representationId, element]));
  const selected = state.selection.kind === "architecture" ? elements.get(state.selection.ids.at(-1) ?? "") : undefined;
  const pairs = [];
  if (state.revision !== undefined)
    pairs.push(["revision", state.revision]);
  if (state.from !== undefined)
    pairs.push(["from", state.from]);
  appendSelection(pairs, state, elements, world, work);
  appendTab(pairs, state, comparison?.components[selected?.id ?? ""]);
  appendSourceState(pairs, state, selected, comparison);
  for (const flow of state.flows) {
    appendFlow(pairs, flow === state.flows.at(-1) ? flow : { id: flow.id }, world);
  }
  pairs.push(...mapControlEntries(state));
  if (state.theme !== (pathTheme(pathname) ?? "auto"))
    pairs.push(["theme", state.theme]);
  if (!state.hudVisible)
    pairs.push(["hud", "off"]);
  if (state.inset !== undefined)
    pairs.push(["inset", String(state.inset)]);
  return pairs.length === 0 ? "" : `?${pairs.map(([key, value]) => `${key}=${value}`).join("&")}`;
}

// src/viewers/web/render.ts
var ZOOM_STEP = 1.25;
var boot = openWebBoot(JSON.parse(document.getElementById("world").textContent), location);
var data = createWebDataSource(boot);
var world = boot.world;
var work = boot.work;
var sheet = boot.sheet;
var project2 = boot.project ?? undefined;
var currentPins = boot.pins;
var mapMeta = { generation: boot.generation, timings: boot.timings };
var opened = readView(location, world, work.items, boot.revisions, readSavedTheme(localStorage), boot.comparison, readSavedMapControls(localStorage));
saveMapControls(opened, localStorage);
var changes = createComparisonControl(document.body, select, () => {
  repaintScene(false);
  paintViewState();
});
changes.update(world, boot.comparison, boot.revision?.id, undefined);
var mapMotion = createMapMotion(sheet);
mapMotion.choose(opened.mapView, 0, false);
var filterC4 = bindC4Filter(document.getElementById("c4-filter"), opened.hiddenFilters, () => {
  repaintScene(false);
  rememberMapControls();
});
var debug = createMapDebugPanel(document.body, () => ({ ...mapMeta, world, sheet }));
function projectedScene() {
  return debug.project(() => changes.project(filterC4.project(presentScene(mapMotion.sheet, project2, mapMotion.pose))));
}
var scene = projectedScene();
var hosts = pageHosts();
var { host, treeHost, flowsHost, statsHost, revisionBox, searchRoot, detailsHost, zoomHost, hierarchyContent, hierarchyToggle } = hosts;
var paintFlows = createFlowList();
var map2 = createMap(host);
var highlights = createMapHighlights(map2);
var edit = data.edit;
var projectEditor = edit === undefined ? undefined : createProjectEditor((input) => edit({ id: "project", ...input }));
var emptyState = createEmptyState(hosts.emptyHost);
if (data.add !== undefined)
  createAddControl(document.getElementById("add"), data.add);
var shell = createWebShell(document.body, hierarchyContent, hierarchyToggle, detailsHost, map2.svg);
var tip = createTip(host);
var pins = createPins(host, (id) => map2.anchorOf(id), (id) => toggleTask(id, false), tip);
var island = createWorkIsland(host, (id) => toggleTask(id), pins.show, tip);
var hierarchy = createHierarchy(treeHost, select);
var themeControl = bindThemeControl(document.getElementById("theme"), opened.theme, syncUrl);
var hudVisible = opened.hudVisible;
shell.setHud(hudVisible);
var selection = opened.selection;
var activeFlows2 = opened.flows;
var initial = primarySystem(world);
if (boot.revision === null && selection.kind === "none" && initial !== undefined) {
  selection = selectArchitecture(noSelection, initial.representationId, false);
}
var activeTaskIds = selection.kind === "task" ? [selection.id] : [];
var detailsTab = opened.tab;
var revisionControl = createRevisionControl({
  box: revisionBox,
  body: document.body,
  boot,
  data,
  applyRevision: (payload) => applyWorld(payload, true),
  applyWorld,
  applyWork
});
var authoring = createAuthoring(host, map2, data, {
  live: () => revisionControl.live,
  world: () => world,
  repaint: () => paintViewState()
});
var source = createSourceControl({
  host: detailsHost,
  initialFile: opened.file,
  initialLine: opened.line,
  element: () => worldElement(primarySelection(selection)),
  readCode: data.readCode,
  readSource: data.readSource,
  revision: () => revisionControl.selected,
  from: () => revisionControl.from,
  comparison: () => revisionControl.comparison?.components[primarySelection(selection) ?? ""],
  repaint: paintViewState
});
createProjectSettings(data);
var review = createProjectReview({
  world: () => world,
  revision: () => revisionControl.selected,
  readSource: data.readSource,
  navigate(id, file, line) {
    select(id);
    if (file !== undefined)
      source.open(file, line);
  }
});
var taskDiff = createTaskDiffControl({
  host: detailsHost,
  world: () => world,
  readDetails: data.readTask,
  readDiff: data.readTaskDiff,
  repaint: paintViewState,
  select
});
var viewport = () => measureFrame(hosts, hudVisible);
emptyState.paint(world, project2, !revisionControl.live);
var camera = createCameraSession({
  frame: viewport,
  bounds: () => scene.bounds,
  focus: (frame, fitted) => fitHighlights(scene, changes.targets(), frame, zoomLimits(fitted).max),
  approach: map2.approach,
  readout: zoomHost,
  host,
  move(view, zoom) {
    const scaleChanged = map2.move(view, zoom);
    pins.place(view);
    return scaleChanged;
  }
});
var following = false;
function worldElement(id) {
  return id === undefined ? undefined : world.elements.find((element) => element.representationId === id);
}
function worldRelationship(id) {
  return id === undefined ? undefined : world.relationships.find((item) => item.id === id);
}
function unidentifiedGroup(id) {
  return sheet.zones.find((zone) => zone.unidentifiedContainer && zone.key === id);
}
function workItem(id) {
  return id === undefined ? undefined : work.items.find((item) => item.id === id);
}
function known(id) {
  return worldElement(id) !== undefined || worldRelationship(id) !== undefined || unidentifiedGroup(id) !== undefined || workItem(id) !== undefined || world.flows.some((flow) => flow.id === id);
}
function fitControl() {
  animateControl(document.getElementById("fit"), "fit");
  camera.refit();
}
function zoomStep(factor, control) {
  animateControl(control, "zoom");
  camera.zoomBy(factor);
}
function syncUrl() {
  const query = writeView({
    ...currentMapControls(),
    ...revisionControl.selected === undefined ? {} : { revision: revisionControl.selected },
    ...revisionControl.from === undefined ? {} : { from: revisionControl.from },
    ...source.file === undefined ? {} : { file: source.file },
    ...source.line === undefined ? {} : { line: source.line },
    selection,
    flows: activeFlows2,
    tab: detailsTab,
    theme: themeControl.mode,
    hudVisible,
    ...opened.inset === undefined ? {} : { inset: opened.inset }
  }, world, work.items, location.pathname, revisionControl.comparison);
  history.replaceState(null, "", `${location.pathname}${query}`);
}
function currentMapControls() {
  return { mapView: mapMotion.view, hiddenFilters: filterC4.hidden };
}
function rememberMapControls() {
  saveMapControls(currentMapControls(), localStorage);
  syncUrl();
}
function paintMapState() {
  const task = selection.kind === "task" ? workItem(selection.id) : undefined;
  map2.changes(changes.marks());
  highlights.paint(selection, world, activeFlows2, activeTaskIds.map((id) => workItem(id)).filter((item) => item !== undefined));
  pins.activate(activeTaskIds, task?.id);
  island.activate(activeTaskIds, task?.id);
}
function paintViewState(commitUrl = true) {
  if (commitUrl)
    syncUrl();
  const task = selection.kind === "task" ? workItem(selection.id) : undefined;
  changes.update(world, revisionControl.comparison, revisionControl.selected, primarySelection(selection));
  paintMapState();
  hierarchy.paint(world, selectedArchitecture(selection), revisionControl.comparison, changes.enabled);
  paintFlows(flowsHost, world, activeFlows2, toggleFlow, {
    title: "Actors",
    selectedIds: selectedArchitecture(selection),
    onSelectActor: select
  });
  paintHeaderSummary(statsHost, world, project2);
  paintDetailsState(task);
  shell.paint(selection);
}
var paintedDetail = "";
function paintDetailsState(task) {
  const detail = `${primarySelection(selection)}:${detailsTab}:${source.file}`;
  if (revisionControl.comparison !== undefined && detail !== paintedDetail)
    animateContent(detailsHost.querySelector(".body"));
  paintedDetail = detail;
  detailsHost.querySelector(".comparison-reasons")?.remove();
  const activeFlow = activeFlows2.at(-1);
  const selectedId = primarySelection(selection);
  const selected = worldElement(selectedId);
  const inspected = inspectSelection(selectedId, world, sheet.zones);
  const relationship = worldRelationship(selectedId);
  const paintedReader = source.paint(selected) || taskDiff.paint(task);
  paintFlowReturn(detailsHost, activeFlow, selection.kind === "flow", world, select, showFlows, source.file !== undefined);
  if (paintedReader)
    return;
  const flow = world.flows.find((item) => item.id === selectedId);
  if (selection.kind === "flow" && flow !== undefined && activeFlow !== undefined) {
    paintFlowDetails(detailsHost, flow, activeFlow, world, selectFlowStep, select);
    return;
  }
  if (relationship !== undefined) {
    paintRelationship(detailsHost, relationship, world, select, authoring.relationWrites);
  } else if (inspected !== undefined) {
    paintDetails(detailsHost, inspected, {
      world,
      comparison: revisionControl.comparison,
      onSelect: select,
      onToggleFlow: (flow) => toggleFlow(flow, selected?.representationId),
      activeFlows: activeFlows2,
      tab: detailsTab,
      onTab: (tab) => {
        detailsTab = tab;
        paintViewState();
      },
      code: detailsTab === "how" && revisionControl.comparison === undefined ? source.code() : [],
      onSource: source.open,
      workGroups: selected?.kind === "component" ? elementWorkGroups(work, selected.representationId, world) : [],
      onTask: toggleTask,
      ...selected === undefined ? {} : authoring.paneWrites(selected.id, selectedArchitecture(selection))
    });
  }
}
function select(id, additive = false, origin = "panel") {
  if (worldElement(id) === undefined && worldRelationship(id) === undefined && unidentifiedGroup(id) === undefined)
    return;
  source.clear();
  const next = origin === "map" ? selectMapArchitecture(selection, id, additive, world) : selectArchitecture(selection, id, additive);
  detailsTab = detailsTabAfterSelection(detailsTab, primarySelection(selection), primarySelection(next), comparisonDefaultTab(revisionControl.comparison?.components[worldElement(primarySelection(next))?.id ?? ""]));
  selection = next;
  camera.touched = true;
  paintViewState();
  if (origin === "panel")
    focusArchitecture(selectedArchitecture(selection));
}
function focusActiveTasks() {
  const elementIds = activeTaskIds.flatMap((id) => {
    const task = workItem(id);
    return task === undefined ? [] : touchedElements(task, world);
  });
  const frame = viewport();
  camera.focus(fitHighlights(scene, elementIds, frame, zoomLimits(camera.fitted).max), frame);
}
function focusArchitecture(ids) {
  const frame = viewport();
  camera.focus(fitArchitecture(scene, world, ids, frame), frame);
}
function applyTaskSelection(next, focus = true) {
  activeFlows2 = [];
  activeTaskIds = next.active;
  source.clear();
  selection = next.selected === undefined ? noSelection : selectTask(next.selected);
  camera.touched = true;
  if (!focus)
    camera.hold();
  paintViewState();
  if (focus)
    focusActiveTasks();
}
function toggleTask(id, focus = true) {
  applyTaskSelection(toggleWorkSelection(activeTaskIds, selection.kind === "task" ? selection.id : undefined, id), focus);
}
function deselect() {
  authoring.cancel();
  source.clear();
  selection = noSelection;
  activeTaskIds = [];
  activeFlows2 = [];
  paintViewState();
}
var searchControl = createSearchSession({
  root: searchRoot,
  elements: world.elements,
  tasks: work.items,
  viewport,
  clearSource: source.clear,
  anchorOf: (id) => map2.anchorOf(id),
  taskElements: (task) => touchedElements(task, world),
  openTask: (id) => applyTaskSelection(openWorkSelection(activeTaskIds, id)),
  snapshot: () => ({ selection, camera: { ...camera.current }, touched: camera.touched, detailsTab }),
  previewMap(ids, nextCamera) {
    if (nextCamera !== undefined) {
      camera.navigate(nextCamera);
      camera.touched = true;
    }
    map2.select(ids ?? selectedArchitecture(selection));
  },
  apply(next, commitUrl) {
    const previousId = primarySelection(selection);
    ({ selection, detailsTab } = next);
    if (commitUrl && previousId !== primarySelection(selection)) {
      detailsTab = comparisonDefaultTab(revisionControl.comparison?.components[worldElement(primarySelection(selection))?.id ?? ""]);
    }
    camera.touched = next.touched;
    if (!commitUrl)
      camera.navigate(next.camera);
    paintViewState(commitUrl);
    if (commitUrl)
      focusArchitecture(selectedArchitecture(selection));
  }
});
function showFlows() {
  source.clear();
  selection = flowSelection(activeFlows2);
  paintViewState();
  focusArchitecture([...flowHighlight(activeFlows2, world).routes]);
}
function selectFlowStep(step) {
  activeFlows2 = activeFlows2.map((flow, index) => index === activeFlows2.length - 1 ? { ...flow, step } : flow);
  paintViewState();
  focusArchitecture(flowFocus(activeFlows2, world));
}
function toggleFlow(flow, returnTo) {
  activeFlows2 = toggleFlowActivation(activeFlows2, flow, returnTo);
  activeTaskIds = [];
  showFlows();
}
bindMapPointer(host, map2, {
  orbiting: () => mapMotion.view === "layers",
  hold: camera.hold,
  zoom: camera.zoomAt,
  pan: camera.panBy,
  glide: camera.glide,
  orbit(dx, dy) {
    camera.touched = true;
    mapAnimator.orbit(dx, dy);
  },
  select: (id, additive) => select(id, additive, "map"),
  deselect,
  editProject: () => {
    if (revisionControl.live && project2 !== undefined)
      projectEditor?.open(project2);
  }
});
map2.svg.addEventListener("keydown", (event) => {
  if (!map2.isProjectEdit(event.target) || event.key !== "Enter" && event.key !== " ")
    return;
  event.preventDefault();
  if (revisionControl.live && project2 !== undefined)
    projectEditor?.open(project2);
});
function toggleHud() {
  hudVisible = !hudVisible;
  shell.setHud(hudVisible);
  camera.refit();
  syncUrl();
}
function focusOpened(kind) {
  if (kind === "task")
    focusActiveTasks();
  else if (kind === "architecture")
    focusArchitecture(selectedArchitecture(selection));
  else if (kind === "flow")
    focusArchitecture(flowFocus(activeFlows2, world));
  else
    camera.refit();
}
function openView(search) {
  const next = readView({ search, pathname: location.pathname }, world, work.items, boot.revisions, themeControl.mode, revisionControl.comparison, currentMapControls());
  if (next.hudVisible !== hudVisible)
    toggleHud();
  source.clear();
  selection = next.selection;
  activeFlows2 = next.flows;
  activeTaskIds = selection.kind === "task" ? [selection.id] : [];
  detailsTab = next.tab;
  filterC4.setHidden(next.hiddenFilters);
  mapAnimator.choose(next.mapView);
  repaintScene(false);
  saveMapControls(currentMapControls(), localStorage);
  paintViewState();
  if (next.file !== undefined)
    source.open(next.file, next.line);
  focusOpened(selection.kind);
}
var sceneCentre = (bounds) => ({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });
function repaintScene(fit) {
  const frame = viewport();
  const before = sceneCentre(scene.bounds);
  scene = projectedScene();
  const after = sceneCentre(scene.bounds);
  paintMapView(mapMotion.view);
  const rehighlight = debug.paint(() => map2.paint(scene));
  pins.paint(currentPins.filter((pin) => map2.anchorOf(pin.elementId) !== undefined));
  const fitted = camera.refitTo(frame);
  if (fit && (mapMotion.morphing || following)) {
    if (!camera.touched)
      camera.frame(fitted, 1);
  } else if (fit) {
    const focus = mapMotion.view === "layers" ? undefined : fitArchitecture(scene, world, selectedArchitecture(selection), frame);
    camera.frame(focus === undefined ? fitted : pan(focus, frame.x, frame.y), mapMotion.framing);
    camera.touched = focus !== undefined;
  } else
    camera.track(pan(camera.current, (before.x - after.x) * camera.current.k, (before.y - after.y) * camera.current.k));
  following = mapMotion.morphing;
  camera.paint();
  if (rehighlight)
    paintMapState();
}
var mapAnimator = createMapAnimator(mapMotion, repaintScene);
var paintMapView = bindMapView(document.getElementById("map-view"), (view) => {
  mapAnimator.choose(view);
  rememberMapControls();
});
paintMapView(mapMotion.view);
bindChromeActions({
  hud: toggleHud,
  layers: () => {
    mapAnimator.toggleLayers();
    rememberMapControls();
  },
  debug: debug.toggle,
  zoomIn: () => zoomStep(ZOOM_STEP, document.getElementById("zoom-in")),
  zoomOut: () => zoomStep(1 / ZOOM_STEP, document.getElementById("zoom-out")),
  fit: fitControl,
  deselect
});
function applyWorld(payload, reset = false) {
  mapMeta = { generation: payload.generation, timings: payload.timings };
  world = payload.world;
  changes.update(world, payload.comparison, payload.revision?.id, primarySelection(selection));
  work = payload.work;
  sheet = payload.sheet;
  project2 = payload.project ?? undefined;
  currentPins = payload.pins;
  emptyState.paint(world, project2, !revisionControl.live);
  mapAnimator.retarget(sheet);
  scene = projectedScene();
  const fitted = camera.refitTo(viewport());
  const settle = () => mapMotion.morphing ? camera.frame(fitted, 0) : camera.navigate(fitted);
  if (reset) {
    authoring.cancel();
    source.clear();
    hierarchy.reset();
    activeTaskIds = [];
    activeFlows2 = [];
    selection = retainSelection(selection, (id) => worldElement(id) !== undefined);
    if (!new URLSearchParams(location.search).has("tab")) {
      detailsTab = comparisonDefaultTab(payload.comparison?.components[worldElement(primarySelection(selection))?.id ?? ""]);
    } else if (detailsTab === "tasks")
      detailsTab = "what";
    settle();
    camera.touched = false;
  } else {
    if (!camera.touched)
      settle();
    activeTaskIds = activeTaskIds.filter((id) => workItem(id) !== undefined);
    activeFlows2 = retainFlows(activeFlows2, world);
    if (selection.kind === "flow")
      selection = flowSelection(activeFlows2);
    selection = retainSelection(selection, (id) => known(id));
  }
  taskDiff.invalidate();
  paintWorld();
  searchControl.update(world.elements, work.items);
}
function applyWork(payload) {
  work = payload.work;
  currentPins = payload.pins;
  const selected = worldElement(primarySelection(selection));
  const hasTasks = selected?.kind === "component" && elementWorkGroups(work, selected.representationId, world).length > 0;
  detailsTab = detailsTabAfterWork(detailsTab, hasTasks);
  activeTaskIds = activeTaskIds.filter((id) => workItem(id) !== undefined);
  selection = retainSelection(selection, (id) => known(id));
  pins.paint(currentPins.filter((pin) => map2.anchorOf(pin.elementId) !== undefined));
  island.paint(payload.pins, work);
  paintViewState();
  searchControl.updateTasks(work.items);
}
function paintWorld() {
  review.refresh();
  debug.paint(() => map2.paint(scene));
  revisionControl.paintProjectEdit(map2.svg);
  authoring.refresh();
  pins.paint(currentPins.filter((pin) => map2.anchorOf(pin.elementId) !== undefined));
  island.paint(currentPins, work);
  camera.paint();
  paintViewState();
  source.restore();
}
paintWorld();
focusOpened(opened.selection.kind);
listenForEmbeddedViews(window, openView);
