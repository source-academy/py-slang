export type AutoCompleteRequest = {
  type: "request";
  code: string;
  row: number;
  column: number;
};
export type AutoCompleteResponse = {
  type: "response";
  declarations: AutoCompleteEntry[];
};

export type AutoCompleteMessage = AutoCompleteRequest | AutoCompleteResponse;

export type SyntaxHighlightData = {
  highlightRules: AceRules;
  foldingRules: {
    hookFrom: string;
    args: string[];
  };
  lineCommentStart: string;
  pairQuotesAfter: Record<string, RegExp>;
  indents: {
    hookFrom: string;
  };
  outdents: {
    hookFrom: string;
  };
  autoOutdent: {
    hookFrom: string;
  };
  id: string;
  snippetFileId: string;
};

export type KeywordMapperArgs = {
  map: Record<string, string>;
  defaultToken: string;
};

export type AceRule =
  | {
      token: string | string[] | KeywordMapperArgs;
      regex: string;
      next?: string;
      push?: string;
    }
  | {
      include: string;
    }
  | {
      defaultToken: string;
    };

export type AceRules = {
  [state: string]: AceRule[];
};

export type SyntaxHighlightMessage =
  | {
      type: "message";
      data: SyntaxHighlightData;
    }
  | { type: "ack" };

// Adapted from https://learn.microsoft.com/en-us/dotnet/api/microsoft.visualstudio.languageserver.protocol.completionitemkind?view=visualstudiosdk-2022
export enum CompletionItemKind {
  Text = "text",
  Method = "method",
  Function = "func",
  Constructor = "constructor",
  Field = "field",
  Variable = "var",
  Class = "class",
  Interface = "interface",
  Module = "module",
  Property = "property",
  Unit = "unit",
  Value = "value",
  Enum = "enum",
  Keyword = "keyword",
  Snippet = "snippet",
  Color = "color",
  File = "file",
  Reference = "reference",
  Folder = "folder",
  EnumMember = "enumMember",
  Constant = "constant",
  Struct = "struct",
  Event = "event",
  Operator = "operator",
  TypeParameter = "typeParameter",
}

export interface AutoCompleteEntry {
  name: string;
  meta: CompletionItemKind;
  score?: number;
  docHTML?: string;
}
