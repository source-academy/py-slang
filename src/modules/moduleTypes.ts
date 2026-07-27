import { IModuleExport } from "@sourceacademy/conductor/module";

export type ModuleFunctions = {
  [name: string]: IModuleExport;
};
