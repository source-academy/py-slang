import type { IDataHandler } from "../../types";
import type { IEvaluator } from "./IEvaluator";

export type IInterfacableEvaluator = IEvaluator & IDataHandler;
