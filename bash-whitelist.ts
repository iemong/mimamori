import type { BashWhitelist } from "./src/bash-guard";

const whitelist = {
  patterns: [
    "git log*",
    "git status*",
    "git diff*",
    "git branch*",
    "git show*",
    "bun test*",
    "ls *",
    "ls",
    "pwd",
    "cat *",
    "wc *",
    "head *",
    "tail *",
  ],
} as const satisfies BashWhitelist;

export default whitelist;
