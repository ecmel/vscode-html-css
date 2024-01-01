/*
 * Copyright (c) 1986-2023 Ecmel Ercan <ecmel.ercan@gmail.com>
 * Licensed under the MIT License
 */

import lineColumn from "line-column";

const regex =
  /([.#])(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)(?=[#.,()\s\[\]\^:*"'>=_a-zA-Z0-9-]*{[^}]*})/g;

export const enum StyleType {
  ID = "#",
  CLASS = ".",
}

export interface Style {
  index: number;
  line: number;
  col: number;
  type: StyleType;
  selector: string;
}

export function parse(text: string) {
  const styles: Style[] = [];
  const lc = lineColumn(text, { origin: 0 });
  let match,
    lci,
    index,
    line = 0,
    col = 0;
  while ((match = regex.exec(text))) {
    index = match.index;
    lci = lc.fromIndex(index);
    if (lci) {
      line = lci.line;
      col = lci.col + 1;
    }
    styles.push({
      index,
      line,
      col,
      type: match[1] as StyleType,
      selector: match[2],
    });
  }
  return styles;
}
