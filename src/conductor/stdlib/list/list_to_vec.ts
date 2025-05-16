import { EvaluatorTypeError } from "../../../common/errors";
import { DataType, IDataHandler, List, TypedValue } from "../../types";

export function list_to_vec(this: IDataHandler, xs: List): TypedValue<DataType>[] {
    const vec: TypedValue<DataType>[] = [];
    if (xs === null) return vec;
    while (true) {
        vec.push(this.pair_head(xs));
        const tail = this.pair_tail(xs);
        if (tail.type === DataType.EMPTY_LIST) return vec;
        if (tail.type !== DataType.PAIR) throw new EvaluatorTypeError("Input is not a list", DataType[DataType.LIST], DataType[tail.type]);
        xs = tail.value;
    }
}
