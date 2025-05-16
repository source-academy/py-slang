import { EvaluatorTypeError } from "../../../common/errors";
import { ArrayIdentifier, DataType, IDataHandler } from "../../types";
import { isSameType } from "../../util";

export function array_assert<T extends DataType>(this: IDataHandler, a: ArrayIdentifier<DataType>, type?: T, length?: number): asserts a is ArrayIdentifier<T> {
    if (type) {
        const t = this.array_type(a);
        if (!isSameType(t, type)) throw new EvaluatorTypeError("Array type assertion failure", DataType[type], DataType[t]);
    }
    if (length) {
        const l = this.array_length(a);
        if (l !== length) throw new EvaluatorTypeError("Array length assertion failure", String(length), String(l));
    }
}
