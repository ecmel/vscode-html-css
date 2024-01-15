/*
 * Copyright (c) 1986-2024 Ecmel Ercan (https://ecmel.dev/)
 * Licensed under the MIT License
 */

import path from "path";
import Mocha from "mocha";
import { glob } from "fast-glob";

export function run(): Promise<void> {
  const mocha = new Mocha({ ui: "tdd", color: true });
  const testsRoot = path.resolve(__dirname, "..");
  return new Promise((resolve, reject) => {
    const files = glob.sync("**/**.test.js", { cwd: testsRoot });
    files.forEach((file) => mocha.addFile(path.resolve(testsRoot, file)));
    mocha.run((failures) =>
      setTimeout(
        () =>
          failures > 0
            ? reject(new Error(`${failures} test(s) failed.`))
            : resolve(),
        500
      )
    );
  });
}
