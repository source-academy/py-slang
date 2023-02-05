// Failed attempt at a parser generator.
// import fs from "fs";
// import path from "path";
// import {BaseWriter} from "./writer";
//
// const FILE_NAME: string = path.join(path.resolve(__dirname, '.'), "generated-parser.ts");
// const GRAMMAR_FILE: string = path.join(path.resolve(__dirname, '.'), "Grammar.gram");
//
// export class ParserWriter extends BaseWriter {
//     current: number;
//     start: number;
//     source: string;
//     sourceLines: string[];
//     constructor() {
//         super();
//         this.fp = fs.createWriteStream(FILE_NAME);
//         const gram = fs.readFileSync(GRAMMAR_FILE).toString();
//         this.sourceLines = gram.split('\n');
//         this.source = gram;
//         this.current = 0;
//         this.start = 0;
//     }
//     override main() {
//         this.setup();
//         this.parseGrammar();
//         this.tearDown();
//     }
//
//
//     advance() {
//         this.current += 1;
//     }
//
//     override setup() {
//         // Clear the file.
//         fs.writeFileSync(FILE_NAME, "");
//         this.writeSingleLine('// This file is autogenerated by generate-parser.ts. DO NOT EDIT THIS FILE DIRECTLY.');
//         // Imports
//         this.writeRaw(`
// import {Token} from "./tokenizer";
// import {TokenType} from "./tokens";
// import {ExprNS, StmtNS} from "./ast-types";
// import {BaseParser} from "./parser";
// import Expr = ExprNS.Expr;
// import Stmt = StmtNS.Stmt;
//         `);
//         this.writeSingleLine('');
//     }
//
//     parseGrammar() {
//         this.writeSingleLine('class Parser extends BaseParser {');
//         this.writeSingleLine('constructor(tokens: Token[]) {super(tokens);}');
//         for (let line of this.sourceLines) {
//             if (line.startsWith('#')) {
//                 this.current += line.length+1;
//                 continue;
//             }
//             if (/^[a-z_]+:/i.test(line)) {
//                 const rule = line.split(/:(.*)/s)[0];
//                 this.current += rule.length+1;
//                 this.defineRule(rule.trim());
//             }
//             this.current += line.length+1;
//         }
//         this.writeSingleLine('}')
//     }
//
//     defineRule(ruleName: string) {
//         this.writeSingleLine(`${ruleName}(){`)
//         switch(this.current) {
//             case '(':
//
//         }
//         this.writeSingleLine('}')
//
//     }
//
// }
//