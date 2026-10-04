import { createRequire } from "node:module";
import { isAbsolute } from "node:path";

const guardInstalled = Symbol.for("verve.next-lint-directory-glob.guard-v1");

function validatePattern(pattern) {
  if (typeof pattern !== "string" || pattern.length > 2048) {
    throw new TypeError("Next lint root pattern must be a string of at most 2048 characters");
  }
  let depth = 0;
  let openings = 0;
  for (let index = 0; index < pattern.length; index++) {
    const character = pattern[index];
    if (character === "\\") {
      index++;
      continue;
    }
    if (character === "{" || character === "(" || character === "[") {
      if (++depth > 16 || ++openings > 64) throw new RangeError("Next lint root pattern is too complex");
    } else if (character === "}" || character === ")" || character === "]") {
      depth = Math.max(0, depth - 1);
    }
  }
}

export default function installNextLintGlobGuard(projectRequire) {
  const pluginRequire = createRequire(projectRequire.resolve("@next/eslint-plugin-next"));
  const identity = pluginRequire("fast-glob/package.json");
  if (identity.name !== "tinyglobby" || identity.version !== "0.2.17") {
    throw new Error("Review the pinned Next lint glob replacement before changing dependencies");
  }
  // Only this replacement is modified. Next's get-root-dirs utility reads its
  // named property at call time. Do not mutate the unrelated copy used by the
  // TypeScript resolver or any application dependency.
  const matcher = pluginRequire("fast-glob");
  if (matcher[guardInstalled]) return;
  const matchDirectories = matcher.globSync;
  matcher.globSync = function boundedDirectoryGlob(patterns, options = {}) {
    const inputs = typeof patterns === "string" ? [patterns] : patterns;
    if (!Array.isArray(inputs) || inputs.length > 32) throw new TypeError("Invalid Next lint root patterns");
    for (const pattern of inputs) validatePattern(pattern);
    if (options.onlyDirectories !== true) throw new TypeError("Next lint glob supports only directory matching");
    // Preserve absolute input paths, including across Windows drive letters.
    const absolute = options.absolute ?? inputs.every((pattern) => isAbsolute(pattern.replace(/^!/, "")));
    return matchDirectories(inputs, { ...options, absolute, expandDirectories: false, onlyDirectories: true })
      .map((path) => path.replace(/\/$/, "") || "/");
  };
  Object.defineProperty(matcher, guardInstalled, { value: true });
}
