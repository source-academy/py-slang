/*
* Script to autogenerate our things.
*
* So far it's just the AST data types that need generating.
* */

import {AstWriter} from "./generate-ast";
const writer = new AstWriter();
writer.main();