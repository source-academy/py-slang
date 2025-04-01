import fs from "fs";
export declare class AstWriter {
    indentationLevel: number;
    fp?: fs.WriteStream;
    constructor();
    main(): void;
    private setup;
    private tearDown;
    private convertToReadableForm;
    private defineAst;
    private classDef;
    private defineVisitorInterface;
    private indent;
    private dedent;
    private writeSingleLine;
    writeRaw(chunk: string): void;
}
