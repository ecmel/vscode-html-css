'use strict';

// (c) 2016 Ecmel Ercan

import * as ls from 'vscode-languageserver';
import * as css from 'vscode-css-languageservice';

let html = require("htmlparser2");

let conn = ls.createConnection(new ls.IPCMessageReader(process), new ls.IPCMessageWriter(process));
let docs = new ls.TextDocuments();

docs.listen(conn);

conn.onInitialize((params): ls.InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: docs.syncKind
    }
  }
});

docs.onDidChangeContent((change) => {
  let doc = change.document;

  let found = false;
  let parser = new html.Parser({
    onopentag: function (name, attribs) {
      if (name === "style") {
        found = true;
      }
    },
    ontext: function (text) {
      if (found) {
        let start = doc.positionAt(parser.startIndex);
        let end = doc.positionAt(parser.endIndex + 1);
        let range = ls.Range.create(start, end);
        console.log(range);
      }
    },
    onclosetag: function (tagname) {
      if (tagname === "style") {
        found = false;
      }
    }
  }, { decodeEntities: true });

  parser.parseComplete(change.document.getText());
});

conn.listen();
