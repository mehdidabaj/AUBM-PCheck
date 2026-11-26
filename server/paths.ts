import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export function findProjectRoot(fromFileUrl: string) {
  let cur = path.dirname(fileURLToPath(fromFileUrl));
  for (;;) {
    if (fs.existsSync(path.join(cur, "package.json"))) {
      return cur;
    }
    const parent = path.dirname(cur);
    if (parent === cur) {
      return path.dirname(fileURLToPath(fromFileUrl));
    }
    cur = parent;
  }
}
