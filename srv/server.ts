'use strict';

// (c) 2016 Ecmel Ercan

import * as ls from 'vscode-languageserver';
import * as lst from 'vscode-languageserver-types';
import * as css from 'vscode-css-languageservice';
import * as htm from 'htmlparser2';

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
  console.log("Changed: " + change.document.uri);
});


conn.listen();
