/**
 * Adapted from https://github.com/ajaxorg/ace/blob/master/src/mode/python_highlight_rules.js
 *
 * Copyright (c) 2010, Ajax.org B.V.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *    * Redistributions of source code must retain the above copyright
 *      notice, this list of conditions and the following disclaimer.
 *    * Redistributions in binary form must reproduce the above copyright
 *      notice, this list of conditions and the following disclaimer in the
 *      documentation and/or other materials provided with the distribution.
 *    * Neither the name of Ajax.org B.V. nor the
 *      names of its contributors may be used to endorse or promote products
 *      derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL AJAX.ORG B.V. BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 */

import { AceRules } from "@sourceacademy/autocomplete";
import constants from "../../../stdlib/py_s1_constants.json";
import { getIllegalKeywords, getKeywords } from "./keywords";

export default (variant: number) => {
  const keywords = getKeywords(variant).join("|");
  const illegalKeywords = getIllegalKeywords(variant).join("|");

  const builtinConstants = constants.constants.join("|");

  const builtinFunctions = constants.builtInFuncs.join("|");

  //var futureReserved = "";
  const keywordMapper = {
    map: {
      "invalid.deprecated": "debugger",
      "support.function": builtinFunctions,
      "variable.language": "self|cls",
      "constant.language": builtinConstants,
      keyword: keywords,
      "invalid.illegal": illegalKeywords,
    },
    defaultToken: "identifier",
  };

  const decimalInteger = "(?:(?:[1-9]\\d*)|(?:0))";
  const octInteger = "(?:0[oO]?[0-7]+)";
  const hexInteger = "(?:0[xX][\\dA-Fa-f]+)";
  const binInteger = "(?:0[bB][01]+)";
  const integer =
    "(?:" + decimalInteger + "|" + octInteger + "|" + hexInteger + "|" + binInteger + ")";

  const exponent = "(?:[eE][+-]?\\d+)";
  const fraction = "(?:\\.\\d+)";
  const intPart = "(?:\\d+)";
  const pointFloat = "(?:(?:" + intPart + "?" + fraction + ")|(?:" + intPart + "\\.))";
  const exponentFloat = "(?:(?:" + pointFloat + "|" + intPart + ")" + exponent + ")";
  const floatNumber = "(?:" + exponentFloat + "|" + pointFloat + ")";

  const stringEscape =
    "\\\\(x[0-9A-Fa-f]{2}|[0-7]{3}|[\\\\abfnrtv'\"]|U[0-9A-Fa-f]{8}|u[0-9A-Fa-f]{4})";
  const rules: AceRules = {
    start: [
      {
        token: "comment",
        regex: "#.*$",
      },
      {
        token: "string", // multi line """ string start
        regex: '"{3}',
        next: "qqstring3",
      },
      {
        token: "string", // " string
        regex: '"(?=.)',
        next: "qqstring",
      },
      {
        token: "string", // multi line ''' string start
        regex: "'{3}",
        next: "qstring3",
      },
      {
        token: "string", // ' string
        regex: "'(?=.)",
        next: "qstring",
      },
      {
        token: "keyword.operator",
        regex: "\\+|\\-|\\*|\\*\\*|\\/|\\/\\/|%|@|<<|>>|&|\\||\\^|~|<|>|<=|=>|==|!=|<>|=",
      },
      {
        token: "punctuation",
        regex: ",|:|;|\\->|\\+=|\\-=|\\*=|\\/=|\\/\\/=|%=|@=|&=|\\|=|^=|>>=|<<=|\\*\\*=",
      },
      {
        token: "paren.lparen",
        regex: "[\\[\\(\\{]",
      },
      {
        token: "paren.rparen",
        regex: "[\\]\\)\\}]",
      },
      {
        token: ["keyword", "text", "entity.name.function"],
        regex: "(def|class)(\\s+)([\\u00BF-\\u1FFF\\u2C00-\\uD7FF\\w]+)",
      },
      {
        token: "text",
        regex: "\\s+",
      },
      {
        include: "constants",
      },
    ],
    qqstring3: [
      {
        token: "constant.language.escape",
        regex: stringEscape,
      },
      {
        token: "string", // multi line """ string end
        regex: '"{3}',
        next: "start",
      },
      {
        defaultToken: "string",
      },
    ],
    qstring3: [
      {
        token: "constant.language.escape",
        regex: stringEscape,
      },
      {
        token: "string", // multi line ''' string end
        regex: "'{3}",
        next: "start",
      },
      {
        defaultToken: "string",
      },
    ],
    qqstring: [
      {
        token: "constant.language.escape",
        regex: stringEscape,
      },
      {
        token: "string",
        regex: "\\\\$",
        next: "qqstring",
      },
      {
        token: "string",
        regex: '"|$',
        next: "start",
      },
      {
        defaultToken: "string",
      },
    ],
    qstring: [
      {
        token: "constant.language.escape",
        regex: stringEscape,
      },
      {
        token: "string",
        regex: "\\\\$",
        next: "qstring",
      },
      {
        token: "string",
        regex: "'|$",
        next: "start",
      },
      {
        defaultToken: "string",
      },
    ],
    constants: [
      {
        token: "constant.numeric", // imaginary
        regex: "(?:" + floatNumber + "|\\d+)[jJ]\\b",
      },
      {
        token: "constant.numeric", // float
        regex: floatNumber,
      },
      {
        token: "constant.numeric", // long integer
        regex: integer + "[lL]\\b",
      },
      {
        token: "constant.numeric", // integer
        regex: integer + "\\b",
      },
      {
        token: ["punctuation", "function.support"], // method
        regex: "(\\.)([a-zA-Z_]+)\\b",
      },
      {
        token: keywordMapper,
        regex: "[a-zA-Z_$][a-zA-Z0-9_$]*\\b",
      },
    ],
  };

  return rules;
};
