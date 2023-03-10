/*
* Full disclosure:
* Some function names and signatures are from
* https://craftinginterpreters.com/representing-code.html.
* Book copyright by Robert Nystrom. I've included the MIT license that code
* snippets from the book is licensed under down below. See
* https://github.com/munificent/craftinginterpreters/blob/master/LICENSE
*
*
* The changes I've made: I've basically reworked the whole thing:
*     - The book was written in Java. I have written this in TypeScript.
*     - This generates TypeScript code. The book generates Java code.
*     - Added the ability for the generator to format indents properly.
*
* Run this file with `npm run regen`.
*

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to
    deal in the Software without restriction, including without limitation the
    rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
    sell copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
    IN THE SOFTWARE.
**/
import fs from "fs";
import path from "path";

const FILE_NAME: string = path.join(path.resolve(__dirname, '.'), "../src/ast-types.ts");


export class AstWriter {
    indentationLevel: number;
    fp?: fs.WriteStream;

    constructor() {
        this.indentationLevel = 0;
        this.fp = fs.createWriteStream(FILE_NAME);
    }

    main() {
        this.setup();
        this.defineAst("Expr", [
            "Binary    -> left: Expr, operator: Token, right: Expr",
            // Semantically different from Binary - for logical comparisons.
            "Compare   -> left: Expr, operator: Token, right: Expr",
            // For boolean operations
            "BoolOp    -> left: Expr, operator: Token, right: Expr",
            "Grouping  -> expression: Expr",
            "Literal   -> value: true | false | number | string",
            "Unary     -> operator: Token, right: Expr",
            "Ternary   -> predicate: Expr, consequent: Expr, alternative: Expr",
            "Lambda    -> parameters: Token[], body: Expr",
            "MultiLambda -> parameters: Token[], body: StmtNS.Stmt[], varDecls: Token[]",
            "Variable  -> name: Token",
            "Call      -> callee: Expr, args: Expr[]"
        ]);
        this.defineAst("Stmt", [
            "Pass       -> ()",
            "Assign     -> name: Token, value: ExprNS.Expr",
            "AnnAssign  -> name: Token, value: ExprNS.Expr, ann: ExprNS.Expr",
            "Break      -> ()",
            "Continue   -> ()",
            "Return     -> value: ExprNS.Expr | null",
            "FromImport -> module: Token, names: Token[]",
            "Global     -> name: Token",
            "NonLocal   -> name: Token",
            "Assert     -> value: ExprNS.Expr",
            "If         -> condition: ExprNS.Expr, body: Stmt[], elseBlock: Stmt[] | null",
            "While      -> condition: ExprNS.Expr, body: Stmt[]",
            "For        -> target: Token, iter: ExprNS.Expr, body: Stmt[]",
            "FunctionDef -> name: Token, parameters: Token[], body: Stmt[], varDecls: Token[]",
            "SimpleExpr  -> expression: ExprNS.Expr",
            // Mainly two types of input - file and interactive (repl)
            "FileInput   -> statements: Stmt[], varDecls: Token[]"
        ]);
        this.tearDown();
    }

    private setup() {
        // Clear the file.
        fs.writeFileSync(FILE_NAME, "");
        this.writeSingleLine('// This file is autogenerated by generate-ast.ts. DO NOT EDIT THIS FILE DIRECTLY.');
        // Imports
        this.writeSingleLine('import {Token} from "./tokenizer";')
        this.writeSingleLine('');
    }

    private tearDown() {
        // Check that indentation is correct.
        console.assert(this.indentationLevel == 0, "Indentation level should be 0 at end.");
        this.fp?.close();
    }

    private convertToReadableForm(definitions: string[]) {
        /*
        * Converts to the form:
        * [Name, [[attribute, type], [attribute, type], ...]
        * ...
        * */
        return definitions.map(s => s.split('->'))
            .map(pair => [pair[0].trim(), pair[1]
                .split(",")
                .map(s => s.split(':')
                    .map(s => s.trim()))])
    }

    private defineAst(baseClass: string, definitions: any) {
        definitions = this.convertToReadableForm(definitions);
        this.writeSingleLine(`export namespace ${baseClass}NS {`);
        this.defineVisitorInterface(baseClass, definitions);

        // Base class
        this.writeSingleLine(`export abstract class ${baseClass} {`);
        this.writeSingleLine('startToken: Token;')
        this.writeSingleLine('endToken: Token;')
        this.writeSingleLine('protected constructor(startToken: Token, endToken: Token) {')
        this.writeSingleLine('this.startToken = startToken;')
        this.writeSingleLine('this.endToken = endToken;')
        this.writeSingleLine('}')
        this.writeSingleLine('abstract accept(visitor: Visitor<any>): any;');
        this.writeSingleLine('}');

        // Classes
        for (const classDefinition of definitions) {
            const [className, attributes] = classDefinition;
            const isEmpty = attributes[0][0] === "()";
            this.classDef(baseClass, className, attributes, isEmpty);
        }
        this.writeSingleLine("");
        this.writeSingleLine("");
        this.writeSingleLine('}')
    }

    private classDef(baseClass: string, name: string, attributes: string[], isEmpty: boolean) {
        this.writeSingleLine(`export class ${name} extends ${baseClass} {`);
        if (!isEmpty) {
            for (const [name, type] of attributes) {
                this.writeSingleLine(`${name}: ${type};`);
            }
        }
        let parameters = !isEmpty ? ', ' + attributes.map(attribute => `${attribute[0]}: ${attribute[1]}`).join(', ') : '';
        parameters = 'startToken: Token, endToken: Token' + parameters;
        this.writeSingleLine(`constructor(${parameters}){`)
        this.writeSingleLine('super(startToken, endToken)');
        if (!isEmpty) {
            for (const attribute of attributes) {
                const name = attribute[0];
                this.writeSingleLine(`this.${name} = ${name};`);
            }
        }
        this.writeSingleLine('}');
        // Visitor pattern
        this.writeSingleLine('override accept(visitor: Visitor<any>): any {');
        this.writeSingleLine(`return visitor.visit${name}${baseClass}(this)`);
        this.writeSingleLine('}');
        this.writeSingleLine('}');
    }

    private defineVisitorInterface(baseClass: string, definitions: any) {
        this.writeSingleLine(`export interface Visitor<T> {`);
        for (const classDefinition of definitions) {
            const className = classDefinition[0];
            this.writeSingleLine(`visit${className}${baseClass}(${baseClass.toLowerCase()}: ${className}): T`);
        }
        this.writeSingleLine('}');
    }

    private indent() {
        this.indentationLevel += 4;
    }

    private dedent() {
        this.indentationLevel -= 4;
    }

    private writeSingleLine(chunk: string) {
        if (this.fp === undefined) {
            throw new Error("File not initialised");
        }
        let dedentFirst = (chunk.startsWith('}') || chunk.startsWith(')')) ? 1 : 0;
        if (dedentFirst) {
            this.dedent();
        }
        this.fp.write(''.padEnd(this.indentationLevel, ' '));
        this.fp.write(chunk);
        this.fp.write('\n');
        for (let i = dedentFirst; i < chunk.length; ++i) {
            const c = chunk[i];
            switch (c) {
                case '{':
                case '(':
                    this.indent();
                    continue;
                case '}':
                case ')':
                    this.dedent();
            }
        }
    }

    writeRaw(chunk: string) {
        if (this.fp === undefined) {
            throw new Error("File not initialised");
        }
        this.fp.write(chunk);
    }
}
