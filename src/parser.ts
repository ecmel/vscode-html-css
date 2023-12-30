/*
 * Copyright (c) 1986-2023 Ecmel Ercan <ecmel.ercan@gmail.com>
 * Licensed under the MIT License
 */

const regex = /([.#])(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)(?=.*?{([^}]*)})/gs;

export const enum StyleType {
  ID = "#",
  CLASS = ".",
}

export interface Style {
  index: number;
  type: StyleType;
  selector: string;
  block: string;
}

export function parse(text: string) {
  const styles: Style[] = [];
  let match;
  while ((match = regex.exec(text))) {
    styles.push({
      index: match.index,
      type: match[1] as StyleType,
      selector: match[2],
      block: match[3].replace(/\s+/g, " ").trim(),
    });
  }
  return styles;
}
