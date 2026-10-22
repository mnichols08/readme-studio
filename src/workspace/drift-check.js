import { marked } from "marked";
import { visitTokens } from "../markdown/visit-tokens.js";
import { isRelativeUrl } from "../markdown/resolve-urls.js";
import { tokenUrls } from "../github/health.js";
import {
  resolveRelativePath,
  OUTSIDE_ROOT,
  compareEvidence,
} from "./evidence-snapshots.js";

// A Drift check compares Claims in the document's own Source (commands,
// paths, links and config keys) with repository Evidence read now. It is
// pure and read-only: commands are tokenized as text and never run, file
// content is parsed as data (JSON.parse, line scans) and discarded, and the
// Source is never changed. Results are not persisted.
//
// Every result has one status:
//   mismatch  – an observed mismatch: Evidence directly contradicts the claim;
//   uncertain – a heuristic suggests drift, but the claim may be fine;
//   unknown   – Evidence could not be read or does not cover the claim;
//   matches   – Evidence supports the claim.
// Unknown is never drift.
export const CLAIM_LIMIT = 200,
  READ_LIMIT = 256_000,
  ANCHOR_FILE_LIMIT = 10;
export const driftStatuses = ["mismatch", "uncertain", "unknown", "matches"];
export const driftCategories = ["command", "path", "link", "config"];
export const ENV_EXAMPLES = Object.freeze([
  ".env.example",
  ".env.sample",
  ".env.template",
  ".env.dist",
  "example.env",
]);
const LOCKFILES = {
  npm: ["package-lock.json", "npm-shrinkwrap.json"],
  yarn: ["yarn.lock"],
  pnpm: ["pnpm-lock.yaml"],
  bun: ["bun.lock", "bun.lockb"],
};
const SHELLS = new Set([
  "",
  "sh",
  "bash",
  "shell",
  "zsh",
  "fish",
  "console",
  "shellsession",
  "shell-session",
  "bash-session",
  "terminal",
  "powershell",
  "pwsh",
  "ps",
  "ps1",
  "cmd",
  "bat",
  "batch",
]);
// Session-style blocks mix commands with output; only prompted lines count.
const PROMPTED = new Set([
  "console",
  "shellsession",
  "shell-session",
  "bash-session",
  "terminal",
]);
const POWERSHELL = new Set(["powershell", "pwsh", "ps", "ps1"]),
  CMD = new Set(["cmd", "bat", "batch"]);
const ENV_LANGS = new Set(["env", "dotenv", ".env"]);
// Paths under these folders are usually created by a build or install, and
// files like `.env` are usually ignored by Git, so their absence is uncertain.
const GENERATED =
  /(?:^|\/)(?:dist|build|out|target|node_modules|\.venv|venv|coverage|\.next|\.nuxt|\.output|\.cache|tmp)\//;
const IGNORED = /(?:^|\/)\.env(?:\.[\w-]+)?$/;
const MARKDOWN = /\.(?:md|markdown|mdx)$/i;

const yarnBuiltins = new Set(
  "add audit autoclean bin cache check config create dedupe dlx exec explain generate-lock-entry global help import info init install licenses link list login logout node npm outdated owner pack patch patch-commit plugin policies publish rebuild remove search set tag team unlink unplug up upgrade upgrade-interactive version versions why workspace workspaces constraints".split(
    " ",
  ),
);
const pnpmBuiltins = new Set(
  "add audit bin config create dedupe deploy dlx env exec fetch help i import init install install-test it licenses link list ll ls outdated pack patch patch-commit patch-remove prune publish rb rebuild remove rm root server setup store un uninstall unlink up update upgrade why self-update doctor approve-builds ignored-builds cat-file find-hash".split(
    " ",
  ),
);
const npmRun = new Set(["run", "run-script", "rum", "urn"]),
  npmTest = new Set(["test", "t", "tst"]),
  npmLifecycle = new Set(["start", "stop", "restart"]),
  npmCi = new Set(["ci", "clean-install", "ic", "install-clean"]),
  npmInstall = new Set(["install", "i", "in", "ins", "inst", "add"]);
// Flags that move a package-manager command away from the root package.
const scoped = new Set([
  "-w",
  "--workspace",
  "--workspaces",
  "-ws",
  "--prefix",
  "-C",
  "--dir",
  "--filter",
  "-F",
  "-r",
  "--recursive",
  "--cwd",
]);
const valued = new Set([
  "-w",
  "--workspace",
  "--prefix",
  "-C",
  "--dir",
  "--filter",
  "-F",
  "--cwd",
  "--registry",
  "--loglevel",
  "--userconfig",
  "--cache",
]);
// Interpreters that take a script file, by family.
const runners = {
  node: "node",
  nodejs: "node",
  tsx: "node",
  "ts-node": "node",
  python: "python",
  python3: "python",
  py: "python",
  bash: "shell",
  sh: "shell",
  zsh: "shell",
  pwsh: "pwsh",
  ruby: "ruby",
  perl: "perl",
  php: "php",
  source: "source",
  ".": "source",
};
// Per family: options that mean no script file is run, options whose value
// is the next word, and short options known to take no value. Any other
// short option before the script makes the claimed file uncertain, since it
// may have consumed the word.
const runnerFlags = {
  node: {
    none: ["-e", "--eval", "-p", "--print", "-c", "--check", "-h", "--help"],
    valued: [
      "-r",
      "--require",
      "--import",
      "--loader",
      "--experimental-loader",
      "-C",
      "--conditions",
      "--env-file",
      "--env-file-if-exists",
      "--input-type",
      "--title",
      "--watch-path",
      "-P",
      "--project",
      "-O",
      "--compiler-options",
      "--compiler",
      "--tsconfig",
    ],
    plain: ["-i", "-v", "-T"],
  },
  python: {
    none: ["-m", "-c", "-h", "--help", "-V", "--version"],
    valued: ["-W", "-X", "-Q"],
    plain: ["-u", "-O", "-OO", "-B", "-E", "-I", "-s", "-S", "-q", "-b", "-d"],
  },
  shell: {
    none: ["-c", "-s", "--help", "--version"],
    valued: ["-o", "-O", "+o", "+O"],
    plain: ["-e", "-u", "-x", "-v", "-l", "-i", "-n"],
  },
  pwsh: {
    none: ["-c", "-Command", "-command", "-EncodedCommand", "-h", "-Help"],
    valued: ["-ExecutionPolicy", "-ep", "-ex"],
    plain: ["-NoProfile", "-nop", "-NoLogo", "-NonInteractive", "-File", "-f"],
  },
  ruby: {
    none: ["-e", "-h", "--help", "-v", "--version", "-C"],
    valued: ["-I", "-r", "-E", "-F"],
    plain: ["-w", "-W", "-d"],
  },
  perl: {
    none: ["-e", "-E", "-h", "-v"],
    valued: ["-I", "-M", "-m"],
    plain: ["-w", "-W", "-T", "-d"],
  },
  php: {
    none: ["-r", "-S", "-h", "-v", "-i", "-a", "-m"],
    valued: ["-t", "-c", "-d", "-z", "-f"],
    plain: ["-n", "-q", "-e"],
  },
  source: { none: [], valued: [], plain: [] },
  deno: {
    none: ["-h", "--help"],
    valued: [
      "-c",
      "--config",
      "--import-map",
      "--lock",
      "--cert",
      "--location",
      "--seed",
    ],
    plain: ["-A", "-q", "-r", "-L"],
  },
};
// Node resolves an extensionless entry point (`node server`) by trying these
// suffixes; tsx and ts-node add TypeScript ones.
const NODE_SUFFIXES = [
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".node",
  ".ts",
  ".mts",
  ".cts",
  ".tsx",
  ".jsx",
];
const makefiles = ["Makefile", "makefile", "GNUmakefile"],
  composeFiles = [
    "compose.yaml",
    "compose.yml",
    "docker-compose.yml",
    "docker-compose.yaml",
  ];

// A word that names a repository path: relative, no variables, globs,
// placeholders, URLs, specifiers such as `npm:vite` or `localhost:8000`, or
// home/absolute/Windows paths.
function pathWord(word) {
  if (
    !word ||
    word.length > 300 ||
    /^[-~/]|[$*?{}<>%`\\|:]|^path\/to\//i.test(word)
  )
    return null;
  try {
    return resolveRelativePath(word.replace(/\/+$/, ""));
  } catch {
    return null;
  }
}
// The path a command word may produce: an option's `=value`, a downloaded
// URL's file name, or the word itself.
function mentionedPath(word) {
  let value = word.startsWith("-") ? word.split("=")[1] || "" : word;
  if (/^https?:\/\//i.test(value))
    try {
      value = decodeURIComponent(new URL(value).pathname.split("/").pop());
    } catch {
      return null;
    }
  return pathWord(value);
}
// Splits one command line into segments of words. Quotes group words,
// `&&`, `||`, `;`, `|` and `&` end a segment, `#` at a word start begins a
// comment, and redirects become ">" / "<" markers before their target.
function segments(line) {
  const out = [[]];
  let word = "",
    quote = "",
    started = false;
  const push = () => {
    if (started) out.at(-1).push(word);
    word = "";
    started = false;
  };
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = "";
      else word += c;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      started = true;
    } else if (/\s/.test(c)) push();
    else if (c === "#" && !started) break;
    else if (c === "&" || c === "|" || c === ";") {
      push();
      if (line[i + 1] === c) i++;
      out.push([]);
    } else if (c === ">" || c === "<") {
      if (c === ">" && /^\d$/.test(word)) {
        word = "";
        started = false;
      } else push();
      if (line[i + 1] === ">") i++;
      if (line[i + 1] === "&") {
        i++;
        while (/[\d-]/.test(line[i + 1] || "")) i++;
      } else out.at(-1).push(c);
    } else {
      word += c;
      started = true;
    }
  }
  push();
  return out.filter((segment) => segment.length);
}
// Shell-ish lines of a fenced block, with prompts and continuations handled,
// each tagged with its line offset inside the block.
function commandLines(text, lang) {
  const lines = [];
  let pending = null;
  // Continuations: a backtick in PowerShell, `^` in cmd and `\` elsewhere
  // (in POSIX shells a trailing backtick closes a command substitution).
  const continued = POWERSHELL.has(lang) ? /`$/ : CMD.has(lang) ? /\^$/ : /\\$/;
  // npm and others echo `> pkg@1.0.0 build` lines as output, so in session
  // blocks a bare `>` is not a prompt.
  const prompts = PROMPTED.has(lang)
    ? /^(?:PS(?: [^>]*)?>|\$|%)\s+/
    : /^(?:PS(?: [^>]*)?>|\$|>|%)\s+/;
  text.split("\n").forEach((raw, index) => {
    let line = raw.trim();
    if (pending) {
      pending.text += " " + line.replace(continued, "");
      if (!continued.test(line)) {
        lines.push(pending);
        pending = null;
      }
      return;
    }
    const prompt = line.match(prompts);
    if (PROMPTED.has(lang) && !prompt) return;
    if (prompt) line = line.slice(prompt[0].length);
    if (!line || line.startsWith("#") || line.startsWith("//")) return;
    if (continued.test(line))
      pending = { text: line.replace(continued, ""), index };
    else lines.push({ text: line, index });
  });
  if (pending) lines.push(pending);
  return lines;
}

// Interprets one command segment. `context` carries what earlier commands in
// the same block did: `cd` steps, created paths, clone directory names and
// words that earlier commands mentioned (which may be files they created).
function commandClaims(words, context, claim) {
  while (/^[A-Za-z_]\w*=/.test(words[0] || "")) words = words.slice(1);
  while (["sudo", "env", "time", "exec", "command"].includes(words[0]))
    words = words.slice(1);
  while (/^[A-Za-z_]\w*=/.test(words[0] || "")) words = words.slice(1);
  const [tool, ...args] = words;
  if (!tool) return;
  // Redirect targets are created (">") or read ("<"); neither is a word.
  const plain = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === ">") {
      const created = pathWord(args[++i]);
      if (created) context.created.add(created);
    } else if (args[i] === "<") i++;
    else plain.push(args[i]);
  }
  const positional = plain.filter((word) => !word.startsWith("-"));
  const under = (value, base) => value === base || value.startsWith(base + "/");
  const path = (word, extra = {}) => {
    const value = pathWord(word);
    if (!value || [...context.created].some((made) => under(value, made)))
      return;
    // An earlier command that is not modelled (a compiler's `-o`, a
    // download, `python -m venv env`) may have created it.
    const made = [...context.mentioned].find((word) => under(value, word));
    claim({ kind: "path", path: value, ...(made ? { made } : {}), ...extra });
  };
  const help = ["--version", "-V", "--help", "-h"];
  switch (tool) {
    case "cd": {
      // `cd` alone, `cd -`, `cd ..` and unusual targets make the working
      // directory unknown (null) rather than guessed.
      const dir = positional[0];
      if (dir === "." || dir === "./") return;
      context.cd.push(pathWord(dir || "") ?? null);
      return;
    }
    case "git":
      if (plain[0] === "clone") {
        const [url, dir] = positional.slice(1);
        const cloned = (url || "")
          .replace(/\/+$/, "")
          .replace(/\.git$/, "")
          .split(/[/:]/)
          .pop();
        const name = dir || cloned;
        // Only a clone of this repository (or a fork, which keeps its name)
        // is this repository's root; `cd` into any other clone leaves it.
        if (!name) return;
        if (cloned.toLowerCase() === context.repository.toLowerCase())
          context.clones.add(name);
        else context.foreign.add(name);
      }
      return;
    case "mkdir":
    case "touch":
      for (const word of positional) {
        const value = pathWord(word);
        if (value) context.created.add(value);
      }
      return;
    case "cp":
    case "mv":
    case "ln": {
      if (positional.length < 2) return;
      for (const word of positional.slice(0, -1)) path(word);
      const value = pathWord(positional.at(-1));
      if (value) context.created.add(value);
      return;
    }
    case "chmod":
      for (const word of positional.slice(1)) path(word);
      return;
    case "npm":
    case "pnpm":
    case "yarn":
    case "bun":
      return packageClaims(tool, plain, context, claim, path);
    case "make": {
      const file = flagValue(plain, ["-f", "--file", "--makefile"]);
      if (flagValue(plain, ["-C", "--directory"]) !== undefined) return;
      if (plain.some((word) => [...help, "-v"].includes(word))) return;
      return file
        ? path(file, { tool: "make" })
        : claim({ kind: "path", anyOf: makefiles, tool: "make" });
    }
    case "cargo": {
      const manifest = flagValue(plain, ["--manifest-path"]);
      if (manifest) return path(manifest, { tool: "cargo" });
      if (plain.some((word) => [...help, "--list"].includes(word))) return;
      if (
        [
          "install",
          "uninstall",
          "new",
          "init",
          "search",
          "login",
          "logout",
          "help",
          "version",
        ].includes(positional[0])
      )
        return;
      return claim({
        kind: "path",
        anyOf: ["Cargo.toml"],
        ancestors: true,
        tool: "cargo",
      });
    }
    case "docker-compose":
    case "docker": {
      if (tool === "docker" && positional[0] !== "compose") return;
      const sub = positional[tool === "docker" ? 1 : 0];
      if (
        ["version", "ls"].includes(sub) ||
        plain.some((word) => [...help, "-v"].includes(word))
      )
        return;
      const file = flagValue(plain, ["-f", "--file"]);
      return file
        ? path(file, { tool: "docker compose" })
        : claim({ kind: "path", anyOf: composeFiles, tool: "docker compose" });
    }
    case "pip":
    case "pip3": {
      const requirements = flagValue(plain, ["-r", "--requirement"]);
      if (positional[0] === "install" && requirements) path(requirements);
      return;
    }
    case "deno":
      if (positional[0] === "run")
        runnerFile("deno", plain.slice(plain.indexOf("run") + 1), path);
      return;
    case "go":
      if (positional[0] === "run" && /\.go$/.test(positional[1] || ""))
        path(positional[1]);
      return;
  }
  if (runners[tool]) return runnerFile(runners[tool], plain, path, tool);
  if (/^\.\.?\//.test(tool)) path(tool);
}
// The script an interpreter runs: the first word that is not an option or
// an option's value. `python -m module` and `node -e code` name no file.
function runnerFile(family, words, path, tool = "") {
  const flags = runnerFlags[family];
  let loose = false;
  for (let i = 0; i < words.length; i++) {
    let word = words[i];
    if (word === "--") word = words[i + 1];
    else if (/^[-+]./.test(word)) {
      const [flag] = word.split("=");
      if (flags.none.includes(flag)) return;
      if (flags.valued.includes(flag)) {
        if (!word.includes("=")) i++;
      } else if (!flags.plain.includes(flag) && !flag.startsWith("--"))
        loose = true;
      continue;
    }
    if (!word) return;
    // `tsx watch src/index.ts`
    if (tool === "tsx" && word === "watch" && i + 1 < words.length) continue;
    const extra = loose ? { loose: true } : {};
    // `node server` runs server.js, server/index.js and so on.
    if (family === "node" && !/\.[^/]*$/.test(word))
      extra.suffixes = NODE_SUFFIXES;
    return path(word, extra);
  }
}
function flagValue(words, names) {
  for (let i = 0; i < words.length; i++) {
    const [flag, value] = words[i].split(/=(.*)/s);
    if (names.includes(flag)) return value ?? words[i + 1] ?? "";
  }
  return undefined;
}
// npm, pnpm, yarn and bun commands that depend on package.json scripts or a
// lockfile. `strict` means the command fails when the script is missing
// (npm run, npm test, pnpm run, pnpm test); other forms can fall back to a
// binary, a file or a default, so a missing script is only uncertain.
function packageClaims(manager, words, context, claim, path) {
  let scope = "root",
    ifPresent = false;
  const positional = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word === "--") break;
    if (word.startsWith("-")) {
      const [flag] = word.split("=");
      if (flag === "-g" || flag === "--global") return;
      if (scoped.has(flag)) scope = "workspace";
      if (flag === "--if-present") ifPresent = true;
      if (!word.includes("=") && valued.has(flag)) i++;
      continue;
    }
    positional.push(word);
  }
  const [command, name] = positional;
  const script = (script, strict) => {
    if (!script || !/^[\w:.@/+-]{1,100}$/.test(script)) return;
    claim({
      kind: "script",
      manager,
      script,
      strict: strict && !ifPresent,
      ifPresent,
      scope,
    });
  };
  const install = (strict) =>
    claim({ kind: "install", manager, strict, scope });
  if (manager === "yarn" && command === "workspace") return;
  if (manager === "npm") {
    if (npmRun.has(command)) return script(name, true);
    if (npmTest.has(command)) return script("test", true);
    if (npmLifecycle.has(command)) return script(command, false);
    if (npmCi.has(command)) return install(true);
    if (npmInstall.has(command) && positional.length === 1)
      return install(false);
    return;
  }
  if (manager === "bun") {
    if (["install", "i"].includes(command) && positional.length === 1)
      return install(false);
    if (command !== "run" || !name) return;
    // `bun run file.ts` runs a file, not a script.
    return /[./]/.test(name) ? path(name) : script(name, false);
  }
  // Bare `yarn` installs; `yarn --version` and `yarn --help` do not.
  if (!command)
    return manager === "yarn" &&
      !words.some((word) => ["--version", "-v", "--help", "-h"].includes(word))
      ? install(false)
      : undefined;
  if (command === "install" || (manager === "pnpm" && command === "i"))
    return positional.length === 1 ? install(false) : undefined;
  if (command === "run") return script(name, manager === "pnpm");
  if (manager === "pnpm" && ["test", "t"].includes(command))
    return script("test", true);
  if ((manager === "yarn" ? yarnBuiltins : pnpmBuiltins).has(command)) return;
  script(command, false);
}

// GitHub's heading anchors (github-slugger): lower-case, punctuation removed,
// spaces to hyphens, duplicates suffixed -1, -2. Explicit HTML id/name
// attributes count too. Approximate for unusual punctuation, which is why a
// near match makes a missing anchor uncertain rather than a mismatch.
export function slug(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\s-]/gu, "")
    .replace(/\s/g, "-");
}
const loose = (value) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
// Heading text keeps character references as written (`Q&amp;A`); GitHub
// slugs the rendered text (`Q&A`), so the common ones are decoded.
const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  copy: "©",
  reg: "®",
  trade: "™",
  hellip: "…",
  mdash: "—",
  ndash: "–",
};
function decodeEntities(text) {
  return text.replace(/&(#\d{1,7}|#x[\da-f]{1,6}|[a-z]+);/gi, (all, name) => {
    if (name[0] !== "#") return ENTITIES[name.toLowerCase()] ?? all;
    const code =
      name[1] === "x" || name[1] === "X"
        ? parseInt(name.slice(2), 16)
        : Number(name.slice(1));
    try {
      return String.fromCodePoint(code);
    } catch {
      return all;
    }
  });
}
function inlineText(tokens = []) {
  return tokens
    .map((token) =>
      token.type === "image"
        ? ""
        : token.type === "html"
          ? ""
          : token.tokens?.length
            ? inlineText(token.tokens)
            : token.type === "text"
              ? decodeEntities(token.text || "")
              : token.text || "",
    )
    .join("");
}
export function markdownAnchors(markdown) {
  const anchors = new Set(),
    counts = new Map();
  visitTokens(marked.lexer(String(markdown).replace(/^﻿/, "")), (token) => {
    if (token.type === "heading") {
      const base = slug(inlineText(token.tokens));
      const count = counts.get(base) || 0;
      counts.set(base, count + 1);
      anchors.add(count ? `${base}-${count}` : base);
    }
    // Commented-out HTML renders nothing, so its anchors do not count.
    const html =
      token.type === "html"
        ? token.text.replace(/<!--[\s\S]*?(?:-->|$)/g, "")
        : "";
    for (const match of html.matchAll(
      /\s(?:id|name)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    ))
      anchors.add((match[1] ?? match[2] ?? match[3]).toLowerCase());
  });
  return [...anchors];
}
// Script names and a few fields from package.json, parsed as data only.
// Script bodies are never kept.
export function packageEvidence(text) {
  const data = JSON.parse(String(text).replace(/^﻿/, ""));
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw Error("package.json does not contain an object.");
  const scripts =
    data.scripts &&
    typeof data.scripts === "object" &&
    !Array.isArray(data.scripts)
      ? Object.keys(data.scripts).filter(
          (key) => typeof data.scripts[key] === "string",
        )
      : [];
  return {
    scripts,
    workspaces: !!data.workspaces,
    node: typeof data.engines?.node === "string" ? data.engines.node : "",
    packageManager:
      typeof data.packageManager === "string"
        ? data.packageManager.split("@")[0]
        : "",
  };
}
export function envKeys(text) {
  const keys = new Set();
  for (const line of String(text).replace(/^﻿/, "").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match) keys.add(match[1]);
  }
  return [...keys];
}
// The smallest major version an engines.node range accepts, or null.
export function minimumMajor(range) {
  let min = null;
  for (const part of String(range).split("||")) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === "*" || /^<(?!=)/.test(trimmed)) return null;
    const match = trimmed.match(/(\d+)/);
    if (!match) return null;
    let major = Number(match[1]);
    if (/^>(?!=)/.test(trimmed) && !/\d+\.\d+/.test(trimmed)) major += 1;
    min = min === null ? major : Math.min(min, major);
  }
  return min;
}
const NODE_CLAIMS = [
  /\bnode(?:\.?js)?\s*(?:version\s*)?v?(\d{1,2})(?:\.\d+){0,2}\s*(?:\+|or (?:later|newer|higher|above|greater))/gi,
  /\bnode(?:\.?js)?\s*(?:version\s*)?(?:>=|≥)\s*v?(\d{1,2})/gi,
  /\b(?:requires?|required|minimum|at least)\s+node(?:\.?js)?\s*(?:version\s*)?(?:v|>=\s*)?(\d{1,2})\b/gi,
];

// Extracts the document's Claims. Bounded to CLAIM_LIMIT; extra claims and
// links that cannot be resolved are counted in notes, never guessed.
export function driftClaims(markdown, destination) {
  const source = String(markdown ?? "").replace(/\r\n?/g, "\n");
  const readmeDir = destination.path.split("/").slice(0, -1);
  const repository = destination.repository.split("/")[1] || "";
  const newlines = [];
  for (let i = source.indexOf("\n"); i !== -1; i = source.indexOf("\n", i + 1))
    newlines.push(i);
  const lineAt = (offset) => {
    let low = 0,
      high = newlines.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (newlines[mid] < offset) low = mid + 1;
      else high = mid;
    }
    return low + 1;
  };
  const claims = [],
    seen = new Set();
  let extra = 0,
    outside = 0,
    undecodable = 0,
    otherRefs = 0,
    cursor = 0,
    carried = [];
  const add = (value) => {
    const key = JSON.stringify([
      value.kind,
      value.line,
      value.text,
      value.script ?? value.path ?? value.anchor ?? value.key ?? value.major,
    ]);
    if (seen.has(key)) return;
    seen.add(key);
    if (claims.length >= CLAIM_LIMIT) extra++;
    else claims.push({ id: `claim-${claims.length + 1}`, ...value });
  };
  const command = (text, line, where, context) => {
    for (const words of segments(text)) {
      const claimed = new Set();
      commandClaims(words, context, (value) => {
        if (value.path) claimed.add(value.path);
        add({
          category: "command",
          ...value,
          text: text.slice(0, 300),
          line,
          where,
          cd: [...context.cd],
          bases: context.bases,
          clones: [...context.clones],
          foreign: [...context.foreign],
        });
      });
      // Later commands in the block may use what this one produced.
      for (const word of words) {
        const value = mentionedPath(word);
        if (value && !claimed.has(value)) context.mentioned.add(value);
      }
    }
  };
  const freshContext = (bases) => ({
    cd: [],
    created: new Set(),
    mentioned: new Set(),
    clones: new Set([repository]),
    foreign: new Set(),
    repository,
    bases,
  });
  const link = (value, image, line) => {
    const text = value.trim();
    if (!text || /[\x00-\x1f\x7f\\]/.test(text) || /^mailto:/i.test(text))
      return;
    const hash = text.indexOf("#");
    const anchor = hash === -1 ? "" : decodeSafe(text.slice(hash + 1));
    if (isRelativeUrl(text) || text.startsWith("#")) {
      const raw = (hash === -1 ? text : text.slice(0, hash)).split("?")[0];
      if (!raw) {
        if (anchor)
          add({ category: "link", kind: "anchor", anchor, text, line });
        return;
      }
      let path;
      try {
        path = resolveRelativePath(raw, readmeDir);
      } catch (error) {
        if (error === OUTSIDE_ROOT) outside++;
        else undecodable++;
        return;
      }
      if (path === destination.path) {
        if (anchor)
          add({ category: "link", kind: "anchor", anchor, text, line });
        return;
      }
      add({
        category: "link",
        kind: "link",
        path,
        anchor: anchor || "",
        image,
        text,
        line,
      });
      return;
    }
    const github = githubLink(text, destination);
    if (github?.other) otherRefs++;
    else if (github?.path === destination.path) {
      // A link to this document itself: its anchors are checked against the
      // local Markdown, not the README currently on GitHub.
      if (github.anchor)
        add({
          category: "link",
          kind: "anchor",
          anchor: github.anchor,
          text,
          line,
        });
    } else if (github?.path)
      add({
        category: "link",
        kind: "link",
        path: github.path,
        anchor: github.anchor,
        ...(github.ref ? { ref: github.ref } : {}),
        image,
        text,
        line,
      });
  };
  for (const block of marked.lexer(source)) {
    const found = source.indexOf(block.raw, cursor);
    const offset = found === -1 ? cursor : found;
    if (found !== -1) cursor = found + block.raw.length;
    // Separate cursors keep repeated text in code, prose and links on the
    // right line; text not found verbatim (nested list content is
    // de-indented by the lexer) falls back to the block's first line.
    const cursors = { code: 0, prose: 0, link: 0 };
    const lineOf = (text, cursor = "code") => {
      const index = text ? block.raw.indexOf(text, cursors[cursor]) : -1;
      if (index === -1) return lineAt(offset);
      cursors[cursor] = index + 1;
      return lineAt(offset + index);
    };
    const prose = new Set();
    visitTokens([block], (token) => {
      if (token.type === "code" && token.codeBlockStyle !== "indented") {
        const lang = (token.lang || "").trim().split(/\s+/)[0].toLowerCase();
        // The first content line, or the line after the opening fence. The
        // search starts at the opening fence, so list prose before it that
        // repeats the text is not taken for the command.
        const fence = /^[ \t>]*(?:`{3,}|~{3,})/gm;
        fence.lastIndex = cursors.code;
        const opening = fence.exec(block.raw);
        if (opening) cursors.code = opening.index + opening[0].length;
        const first = token.text.split("\n")[0];
        const start = first
          ? lineOf(first)
          : (opening ? lineAt(offset + opening.index) : lineOf(token.raw)) + 1;
        // Continue after the closing fence.
        if (opening) {
          let end = block.raw.indexOf("\n", opening.index);
          const lines = token.text ? token.text.split("\n").length : 0;
          for (let n = lines + 1; n > 0 && end !== -1; n--)
            end = block.raw.indexOf("\n", end + 1);
          if (end !== -1) cursors.code = Math.max(cursors.code, end);
        }
        if (ENV_LANGS.has(lang)) {
          token.text.split("\n").forEach((line, index) => {
            const key = line.match(/^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=/)?.[1];
            if (key)
              add({
                category: "config",
                kind: "env",
                key,
                text: line.trim().slice(0, 300),
                line: start + index,
              });
          });
          return;
        }
        if (!SHELLS.has(lang)) return;
        // A block starts at the repository root, or wherever the previous
        // block's `cd` steps left off, or in the README's own folder: each
        // extra base (a list of `cd` steps from the root) makes the working
        // directory ambiguous.
        const bases = [[]];
        if (carried.length) bases.push(carried);
        if (readmeDir.length) bases.push([readmeDir.join("/")]);
        const context = freshContext(bases);
        for (const { text, index } of commandLines(token.text, lang)) {
          const exported = text.match(/^export\s+([A-Za-z_]\w*)=/);
          if (exported)
            add({
              category: "config",
              kind: "env",
              key: exported[1],
              text: text.slice(0, 300),
              line: start + index,
            });
          else command(text, start + index, "block", context);
        }
        carried = context.cd.length ? context.cd : carried;
        return;
      }
      if (token.type === "codespan") {
        const text = token.text.trim();
        const line = lineOf(token.raw);
        const word = text.split(/\s+/)[0];
        if (
          /\s/.test(text) &&
          (/^(?:npm|pnpm|yarn|bun|make|cargo|docker|docker-compose|pip|pip3|deno|go)$/.test(
            word,
          ) ||
            runners[word] ||
            /^\.\.?\//.test(word))
        )
          command(text, line, "inline", freshContext([[]]));
        else if (
          /^\.?\/?[\w.@-]+(?:\/[\w.@-]+)+\/?$/.test(text) &&
          !text.startsWith("@") &&
          (/\.\w+$/.test(text) ||
            text.endsWith("/") ||
            text.split("/").length > 2)
        ) {
          const path = pathWord(text);
          if (path)
            add({
              category: "path",
              kind: "path",
              path,
              text,
              line,
              where: "inline",
              cd: [],
              bases: [[]],
              clones: [],
            });
        }
      }
      if (["paragraph", "heading", "text"].includes(token.type) && token.text) {
        const text = token.text.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1");
        for (const pattern of NODE_CLAIMS)
          for (const match of text.matchAll(pattern)) {
            const line = lineOf(match[0], "prose");
            // A paragraph and its own text token, or two patterns, can match
            // the same statement; one claim per line and version.
            const key = `${line}:${match[1]}`;
            if (prose.has(key)) continue;
            prose.add(key);
            add({
              category: "config",
              kind: "node",
              major: Number(match[1]),
              text: match[0].trim(),
              line,
            });
          }
      }
    });
    for (const { value, image } of tokenUrls([block]))
      link(value, image, lineOf(value, "link"));
  }
  const notes = [];
  if (extra)
    notes.push(
      `Only the first ${CLAIM_LIMIT} claims were checked; ${extra} more were not.`,
    );
  if (outside)
    notes.push(
      `${outside} relative link(s) point above the repository root and were not checked.`,
    );
  if (undecodable)
    notes.push(`${undecodable} relative link(s) could not be decoded.`);
  if (otherRefs)
    notes.push(
      `${otherRefs} link(s) to this repository point at another branch or commit and were not checked.`,
    );
  return { claims, notes, anchors: markdownAnchors(source) };
}
function decodeSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
// A github.com blob/tree/raw or raw.githubusercontent.com URL into the
// document's own repository. Paths on the document's branch are returned;
// links pinned to other refs are reported as `other`, never checked.
export function githubLink(url, destination) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(parsed.protocol)) return null;
  const host = parsed.hostname.toLowerCase();
  const parts = parsed.pathname.split("/").filter(Boolean);
  let owner, repo, rest, kind;
  if (host === "github.com" || host === "www.github.com") {
    [owner, repo, kind, ...rest] = parts;
    if (!["blob", "tree", "raw"].includes(kind)) return null;
  } else if (host === "raw.githubusercontent.com")
    [owner, repo, ...rest] = parts;
  else return null;
  if (`${owner}/${repo}`.toLowerCase() !== destination.repository.toLowerCase())
    return null;
  let reference = rest.map(decodeSafe).join("/");
  if (reference.startsWith("refs/heads/"))
    reference = reference.slice("refs/heads/".length);
  const branch = destination.branch;
  if (reference !== branch && !reference.startsWith(branch + "/"))
    return { other: true };
  const path = reference.slice(branch.length + 1);
  if (!path) return null;
  try {
    const resolved = resolveRelativePath(path);
    // The URL could instead name a longer branch (`release/1.0` when the
    // document's branch is `release`): its first segment may be a ref part.
    const ref =
      resolved.includes("/") || kind === "tree"
        ? `${branch}/${resolved.split("/")[0]}`
        : "";
    return {
      path: resolved,
      anchor: decodeSafe(parsed.hash.slice(1)),
      ...(ref ? { ref } : {}),
    };
  } catch {
    return null;
  }
}

// Which files' content a plan needs, given the tree that was read. Bounded:
// package.json, one .env example and up to ANCHOR_FILE_LIMIT linked
// Markdown files with anchors. Files absent from the listing are not read.
export function driftFiles(plan, read) {
  const paths = [],
    notes = [];
  const kinds = new Set(plan.claims.map((claim) => claim.kind));
  const listed = (path) => read.listing.get(path)?.type === "blob";
  if (
    (kinds.has("script") || kinds.has("install") || kinds.has("node")) &&
    listed("package.json")
  )
    paths.push("package.json");
  if (kinds.has("env")) {
    const example = ENV_EXAMPLES.find(listed);
    if (example) paths.push(example);
  }
  const markdown = [
    ...new Set(
      plan.claims
        .filter(
          (claim) =>
            claim.kind === "link" &&
            claim.anchor &&
            MARKDOWN.test(claim.path) &&
            listed(claim.path),
        )
        .map((claim) => claim.path),
    ),
  ];
  paths.push(...markdown.slice(0, ANCHOR_FILE_LIMIT));
  if (markdown.length > ANCHOR_FILE_LIMIT)
    notes.push(
      `Only the first ${ANCHOR_FILE_LIMIT} linked Markdown files were read for anchors; anchors into ${markdown.length - ANCHOR_FILE_LIMIT} more are unknown.`,
    );
  return { paths, notes };
}
// Whether checking a plan needs GitHub at all: anchors into the document
// itself are checked against its own headings, offline.
export const needsGitHub = (plan) =>
  plan.claims.some((claim) => claim.kind !== "anchor");

const join = (dir, path) => (dir ? `${dir}/${path}` : path);
const short = (sha) => String(sha || "").slice(0, 7);
const list = (values, limit = 10) =>
  values.length
    ? values.slice(0, limit).join(", ") +
      (values.length > limit ? `, and ${values.length - limit} more` : "")
    : "none";

// Evaluates a plan against evidence read by `readDriftEvidence` (or null when
// no GitHub evidence was needed). `baseline` is an optional same-target
// Baseline snapshot; when given, each result whose evidence file the Baseline
// recorded says whether that file changed since. Pure; saves nothing.
export function evaluateDrift(plan, evidence, { baseline = null } = {}) {
  const tree = evidence?.tree || "failed",
    listing = evidence?.listing || new Map(),
    files = evidence?.files || new Map();
  const lower = new Map();
  const nearPath = (path) => {
    if (!lower.size)
      for (const key of listing.keys())
        if (!lower.has(key.toLowerCase())) lower.set(key.toLowerCase(), key);
    const near = lower.get(path.toLowerCase());
    return near && near !== path ? near : "";
  };
  // The Git submodule a path is inside, if any: the tree lists a submodule
  // as one commit entry, not its files.
  const submodule = (path) => {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) {
      const prefix = parts.slice(0, i).join("/");
      if (listing.get(prefix)?.type === "commit") return prefix;
    }
    return "";
  };
  // "present", "absent" (confirmed by a complete tree) or "unknown".
  const state = (path) =>
    listing.has(path)
      ? "present"
      : tree === "complete" && !submodule(path)
        ? "absent"
        : "unknown";
  const treeNote =
    tree === "truncated"
      ? "Not in GitHub's truncated tree listing, so its state is unknown."
      : "The repository tree could not be read, so its state is unknown.";
  const unknownNote = (path) => {
    const sub = submodule(path);
    return sub
      ? `It is inside the Git submodule ${sub}, whose files this tree does not list, so its state is unknown.`
      : treeNote;
  };
  // Heading anchors per linked file, computed once each.
  const anchorCache = new Map();
  const anchorsOf = (path, text) => {
    if (!anchorCache.has(path)) anchorCache.set(path, markdownAnchors(text));
    return anchorCache.get(path);
  };
  // Follows `cd` steps from the root. Returns a repository directory ("" is
  // the root) or null when the directory is unknown. Changing into a clone
  // of this repository stays at the root; into a clone of another
  // repository, the directory is unknown.
  const resolveCd = (steps, clones, foreign = []) => {
    let dir = "";
    for (const step of steps) {
      if (step === null) return null;
      if (!dir && foreign.includes(step)) return null;
      if (!dir && clones.includes(step)) continue;
      const next = resolvePath(dir, step);
      if (next === null || listing.get(next)?.type !== "tree") return null;
      dir = next;
    }
    return dir;
  };
  // The claim's possible working directories, one per base.
  const directories = (claim) => [
    ...new Set(
      (claim.bases || [[]]).map((base) =>
        resolveCd(
          [...base, ...(claim.cd || [])],
          claim.clones || [],
          claim.foreign || [],
        ),
      ),
    ),
  ];
  const packageJson = (() => {
    const file = files.get("package.json");
    if (file?.status !== "read") return file || null;
    try {
      return { status: "read", data: packageEvidence(file.text) };
    } catch (error) {
      return {
        status: "failed",
        note: `package.json could not be parsed: ${String(error.message).slice(0, 120)}`,
      };
    }
  })();
  const results = [];
  const result = (claim, status, message, path = "") =>
    results.push({
      id: claim.id,
      category: claim.category,
      kind: claim.kind,
      status,
      text: claim.text,
      line: claim.line,
      where: claim.where || "",
      message,
      evidencePath: path,
    });
  const inlineNote = (claim) =>
    claim.where === "inline"
      ? " It is mentioned inline, which may not be an instruction."
      : "";
  // package.json at the root: { ok, data } or a reason it is unknown/absent.
  const rootPackage = () => {
    const where = state("package.json");
    if (where === "absent") return { absent: true };
    if (where === "unknown") return { unknown: `package.json: ${treeNote}` };
    if (!packageJson)
      return { unknown: "package.json was not read (not a regular file)." };
    if (packageJson.status !== "read")
      return {
        unknown: `package.json could not be read: ${packageJson.note}`,
      };
    return { data: packageJson.data };
  };

  for (const claim of plan.claims) {
    if (claim.kind === "anchor") {
      const anchor = claim.anchor.toLowerCase().replace(/^user-content-/, "");
      if (["top", "readme"].includes(anchor) || /^l\d+/.test(anchor)) continue;
      if (plan.anchors.includes(anchor))
        result(claim, "matches", "A heading in this Markdown has this anchor.");
      else {
        const near = plan.anchors.find((a) => loose(a) === loose(anchor));
        result(
          claim,
          near ? "uncertain" : "mismatch",
          near
            ? `No exact heading anchor #${anchor} in this Markdown; #${near} is similar. GitHub's anchor rules are approximated here.`
            : `No heading or HTML anchor in this Markdown produces #${anchor}.`,
        );
      }
      continue;
    }
    if (!evidence) {
      result(claim, "unknown", "GitHub was not read.");
      continue;
    }
    if (claim.kind === "link") {
      const where = state(claim.path);
      const what = claim.image ? "Image" : "Linked path";
      if (where === "unknown") {
        result(
          claim,
          "unknown",
          `${claim.path}: ${unknownNote(claim.path)}`,
          claim.path,
        );
        continue;
      }
      if (where === "absent") {
        const near = nearPath(claim.path);
        // `blob/release/1.0/x` on branch `release` may name branch
        // `release/1.0` when no `1.0` folder exists.
        const ref =
          claim.ref && state(claim.path.split("/")[0]) === "absent"
            ? claim.ref
            : "";
        result(
          claim,
          ref ? "uncertain" : "mismatch",
          `${what} ${claim.path} is not in the repository at ${short(evidence.head)}.${near ? ` ${near} exists; GitHub paths are case-sensitive.` : ""}${ref ? ` The URL may point at another branch, such as ${ref}, which was not checked.` : ""}`,
          claim.path,
        );
        continue;
      }
      if (
        !claim.anchor ||
        !MARKDOWN.test(claim.path) ||
        /^L\d+/.test(claim.anchor)
      ) {
        result(claim, "matches", `${claim.path} exists.`, claim.path);
        continue;
      }
      const file = files.get(claim.path);
      if (file?.status !== "read") {
        result(
          claim,
          "unknown",
          `${claim.path} exists, but its anchors could not be checked: ${file?.note || "not read (only the first linked Markdown files are read)."}`,
          claim.path,
        );
        continue;
      }
      const anchors = anchorsOf(claim.path, file.text);
      const anchor = claim.anchor.toLowerCase().replace(/^user-content-/, "");
      if (anchors.includes(anchor))
        result(claim, "matches", `${claim.path} has #${anchor}.`, claim.path);
      else {
        const near = anchors.find((a) => loose(a) === loose(anchor));
        result(
          claim,
          near ? "uncertain" : "mismatch",
          near
            ? `${claim.path} has no exact #${anchor}; #${near} is similar. GitHub's anchor rules are approximated here.`
            : `${claim.path} exists but has no heading or HTML anchor #${anchor}.`,
          claim.path,
        );
      }
      continue;
    }
    if (claim.kind === "path") {
      const dirs = directories(claim);
      const candidates = (dir) => {
        const names = claim.anyOf || [claim.path];
        const out = [];
        for (const name of names) {
          const path = resolvePath(dir, name);
          if (path) {
            out.push(path);
            for (const suffix of claim.suffixes || []) out.push(path + suffix);
          }
          if (claim.ancestors) {
            const parts = dir ? dir.split("/") : [];
            while (parts.length) {
              parts.pop();
              out.push(join(parts.join("/"), name));
            }
          }
        }
        return out;
      };
      const label = claim.anyOf
        ? `${claim.tool} needs ${claim.anyOf.join(" or ")}`
        : claim.path;
      const known = dirs.filter((dir) => dir !== null);
      const paths = known.flatMap(candidates);
      const present = paths.find((path) => state(path) === "present");
      if (present) {
        result(claim, "matches", `${present} exists.`, present);
        continue;
      }
      if (!known.length) {
        result(
          claim,
          "unknown",
          `${label}: the working directory after cd is not in the repository, so it was not checked.`,
        );
        continue;
      }
      const unread = paths.find((path) => state(path) === "unknown");
      if (unread !== undefined) {
        result(claim, "unknown", `${label}: ${unknownNote(unread)}`);
        continue;
      }
      const target = paths[0] || claim.path;
      const generated = !claim.anyOf && GENERATED.test(target);
      const ignored = !claim.anyOf && IGNORED.test(target);
      const ambiguous = known.length > 1 || dirs.length > known.length;
      // An earlier command mentioned it (or a folder above it) and that
      // word is not in the tree either, so the command may have created it.
      const made =
        claim.made &&
        state(resolvePath(known[0], claim.made) ?? claim.made) !== "present"
          ? claim.made
          : "";
      const near = !claim.anyOf && nearPath(target);
      const where = known[0] ? ` in ${known[0]}/` : "";
      const reason = generated
        ? " It is under a folder that builds or installs usually create, so it may be generated."
        : ignored
          ? " Files like this are usually ignored by Git, so it may be created locally."
          : made
            ? ` An earlier command in this block mentions ${made}, so it may create it.`
            : claim.loose
              ? " An option before it may take it as a value, so it may not be a file."
              : ambiguous
                ? " The command may run from another directory."
                : inlineNote(claim);
      const extensions = claim.suffixes
        ? " No file with a Node.js extension or folder of that name exists either."
        : "";
      result(
        claim,
        generated ||
          ignored ||
          made ||
          claim.loose ||
          ambiguous ||
          claim.where === "inline"
          ? "uncertain"
          : "mismatch",
        `${claim.anyOf ? `${label}${where}` : `${target}`}: not in the repository at ${short(evidence.head)}.${extensions}${near ? ` ${near} exists; GitHub paths are case-sensitive.` : ""}${reason}`,
        claim.anyOf ? "" : target,
      );
      continue;
    }
    if (claim.kind === "script" || claim.kind === "install") {
      if (claim.scope !== "root") {
        result(
          claim,
          "unknown",
          "Runs in a workspace package or another folder; only the root package.json is read.",
        );
        continue;
      }
      const dirs = directories(claim);
      if (!dirs.includes("")) {
        result(
          claim,
          "unknown",
          "Runs outside the repository root; only the root package.json and lockfiles are read.",
        );
        continue;
      }
      const ambiguous = dirs.length > 1;
      const pkg = rootPackage();
      if (claim.kind === "install") {
        const lockfiles = LOCKFILES[claim.manager];
        const states = lockfiles.map(state);
        if (states.includes("present")) {
          const declared = pkg.data?.packageManager;
          if (declared && declared !== claim.manager)
            result(
              claim,
              "uncertain",
              `package.json declares packageManager ${declared}; this command uses ${claim.manager}.`,
              "package.json",
            );
          else
            result(
              claim,
              "matches",
              `${lockfiles.find((path) => state(path) === "present")} exists.`,
              lockfiles.find((path) => state(path) === "present"),
            );
          continue;
        }
        if (states.includes("unknown")) {
          result(claim, "unknown", `Lockfiles: ${treeNote}`);
          continue;
        }
        if (claim.strict) {
          result(
            claim,
            ambiguous || claim.where === "inline" ? "uncertain" : "mismatch",
            `npm ci needs package-lock.json or npm-shrinkwrap.json; neither is in the repository at ${short(evidence.head)}.${ambiguous ? " The command may run from another directory." : inlineNote(claim)}`,
          );
          continue;
        }
        const others = Object.entries(LOCKFILES).flatMap(([manager, paths]) =>
          manager !== claim.manager
            ? paths.filter((path) => state(path) === "present")
            : [],
        );
        const declared = pkg.data?.packageManager;
        if (others.length || (declared && declared !== claim.manager))
          result(
            claim,
            "uncertain",
            others.length
              ? `The repository has ${others.join(", ")} but no ${lockfiles.join(" or ")}, which suggests a different package manager than ${claim.manager}.`
              : `package.json declares packageManager ${declared}; this command uses ${claim.manager}.`,
            others[0] || "package.json",
          );
        // No lockfile at all: the install depends only on package.json.
        else if (pkg.unknown)
          result(claim, "unknown", pkg.unknown, "package.json");
        else if (pkg.absent)
          result(
            claim,
            "uncertain",
            `No package.json or lockfile at the repository root at ${short(evidence.head)}, so there is nothing to install.${ambiguous ? " The command may run from another directory." : inlineNote(claim)}`,
          );
        else
          result(
            claim,
            "matches",
            "package.json exists; the repository has no lockfile, so nothing suggests another package manager.",
            "package.json",
          );
        continue;
      }
      if (pkg.unknown) {
        result(claim, "unknown", pkg.unknown, "package.json");
        continue;
      }
      if (pkg.absent) {
        result(
          claim,
          claim.strict && !ambiguous && claim.where !== "inline"
            ? "mismatch"
            : "uncertain",
          `No package.json at the repository root at ${short(evidence.head)}, so there is no "${claim.script}" script.${ambiguous ? " The command may run from another directory." : inlineNote(claim)}`,
        );
        continue;
      }
      const scripts = pkg.data.scripts;
      if (scripts.includes(claim.script)) {
        result(
          claim,
          "matches",
          `package.json defines the "${claim.script}" script.`,
          "package.json",
        );
        continue;
      }
      const observed = claim.strict && !ambiguous && claim.where !== "inline";
      const reason = claim.ifPresent
        ? " With --if-present the command succeeds without it, doing nothing."
        : !claim.strict
          ? claim.manager === "npm"
            ? ` npm ${claim.script} has a default when the script is missing.`
            : ` ${claim.manager} can also run a binary or file named ${claim.script}.`
          : ambiguous
            ? " The command may run from another directory."
            : inlineNote(claim);
      result(
        claim,
        observed ? "mismatch" : "uncertain",
        `package.json has no "${claim.script}" script (scripts: ${list(scripts)}).${reason}`,
        "package.json",
      );
      continue;
    }
    if (claim.kind === "node") {
      const pkg = rootPackage();
      if (pkg.absent) continue;
      if (pkg.unknown) {
        result(claim, "unknown", pkg.unknown, "package.json");
        continue;
      }
      if (!pkg.data.node) continue;
      const minimum = minimumMajor(pkg.data.node);
      if (minimum === null)
        result(
          claim,
          "unknown",
          `package.json engines.node is "${pkg.data.node}", which could not be compared.`,
          "package.json",
        );
      else if (claim.major < minimum)
        result(
          claim,
          "uncertain",
          `This text suggests Node ${claim.major}; package.json engines.node is "${pkg.data.node}" (Node ${minimum} or newer). Reading prose is a heuristic.`,
          "package.json",
        );
      else
        result(
          claim,
          "matches",
          `package.json engines.node is "${pkg.data.node}".`,
          "package.json",
        );
      continue;
    }
    if (claim.kind === "env") {
      const example = ENV_EXAMPLES.find((path) => listing.get(path));
      if (!example) {
        if (tree !== "complete")
          result(claim, "unknown", `.env example file: ${treeNote}`);
        continue;
      }
      const file = files.get(example);
      if (file?.status !== "read") {
        result(
          claim,
          "unknown",
          `${example} could not be read: ${file?.note || "not a regular file."}`,
          example,
        );
        continue;
      }
      const keys = envKeys(file.text);
      result(
        claim,
        keys.includes(claim.key) ? "matches" : "uncertain",
        keys.includes(claim.key)
          ? `${example} lists ${claim.key}.`
          : `${example} does not list ${claim.key} (lists: ${list(keys)}). The code may still read it.`,
        example,
      );
    }
  }
  // Annotate with the Baseline's view of each result's evidence file.
  if (baseline && evidence) {
    const current = {
      head: evidence.head,
      tree,
      notes: [],
      entries: baseline.entries.map((entry) => {
        const item = listing.get(entry.path);
        return item
          ? { ...entry, status: "captured", sha: item.sha }
          : tree === "complete"
            ? { path: entry.path, kind: entry.kind, status: "missing" }
            : { path: entry.path, kind: entry.kind, status: "failed" };
      }),
    };
    const since = new Map(
      compareEvidence(baseline, current).entries.map((entry) => [
        entry.path,
        entry.status,
      ]),
    );
    for (const item of results)
      if (since.has(item.evidencePath))
        item.baseline = since.get(item.evidencePath);
  }
  const order = { mismatch: 0, uncertain: 1, unknown: 2, matches: 3 };
  results.sort((a, b) => order[a.status] - order[b.status] || a.line - b.line);
  const notes = [...plan.notes, ...(evidence?.notes || [])];
  const envClaims = plan.claims.filter((claim) => claim.kind === "env").length;
  if (
    envClaims &&
    evidence &&
    tree === "complete" &&
    !ENV_EXAMPLES.some((path) => listing.has(path))
  )
    notes.push(
      `${envClaims} environment variable(s) were not checked: the repository has no ${ENV_EXAMPLES[0]} or similar file.`,
    );
  return {
    head: evidence?.head || "",
    tree: evidence ? tree : "",
    results,
    counts: Object.fromEntries(
      driftStatuses.map((status) => [
        status,
        results.filter((item) => item.status === status).length,
      ]),
    ),
    notes,
  };
}
// Joins a relative path onto a repository directory; null if it climbs
// above the root or is not a valid evidence path.
function resolvePath(dir, path) {
  try {
    return resolveRelativePath(path, dir ? dir.split("/") : []);
  } catch {
    return null;
  }
}
