/*
 * Copyright (c) 1986-2023 Ecmel Ercan <ecmel.ercan@gmail.com>
 * Licensed under the MIT License
 */

import path from "path";
import Mocha from "mocha";
import { glob } from "fast-glob";

export function run(): Promise<void> {
  const mocha = new Mocha({ ui: "tdd", color: true });
  const testsRoot = path.resolve(__dirname, "..");
  return new Promise(async (resolve, reject) => {
    try {
      const files = await glob("**/**.test.js", { cwd: testsRoot });
      files.forEach((file) => mocha.addFile(path.resolve(testsRoot, file)));
      mocha.run((failures) => {
        if (failures > 0) {
          const err = new Error(`${failures} test(s) failed.`);
          setTimeout(() => reject(err), 500);
        } else {
          setTimeout(() => resolve(), 500);
        }
      });
    } catch (err) {
      setTimeout(() => reject(err), 500);
    }
  });
}
