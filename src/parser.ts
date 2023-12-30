/*
 * Copyright (c) 1986-2023 Ecmel Ercan <ecmel.ercan@gmail.com>
 * Licensed under the MIT License
 */

const regex = /([.#])(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)\s*{([^}]*)}/g;

export const enum StyleType {
  ID = "#",
  CLASS = ".",
}

export interface Style {
  type: StyleType;
  label: string;
  definition: string;
}

export function parse(text: string) {
  const styles: Style[] = [];
  let match;
  while ((match = regex.exec(text))) {
    styles.push({
      type: match[1] as StyleType,
      label: match[2],
      definition: match[3].replace(/\s+/g, " ").trim(),
    });
  }
  return styles;
}
