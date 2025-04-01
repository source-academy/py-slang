import { EvaluatorTypeError } from "../../../common/errors";
import { IDataHandler, ClosureIdentifier, DataType } from "../../types";

export function closure_arity_assert(this: IDataHandler, c: ClosureIdentifier<DataType>, arity: number): void {
    const a = this.closure_arity(c);
    if (this.closure_is_vararg(c) ? arity < a : arity !== a) {
        throw new EvaluatorTypeError("Closure arity assertion failure", String(arity), String(a));
    }
}
