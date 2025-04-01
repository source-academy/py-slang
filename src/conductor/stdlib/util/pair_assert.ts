import { EvaluatorTypeError } from "../../../common/errors";
import { DataType, IDataHandler, PairIdentifier } from "../../types";
import { isSameType } from "../../util";

export function pair_assert(this: IDataHandler, p: PairIdentifier, headType?: DataType, tailType?: DataType): void {
    if (headType) {
        const head = this.pair_head(p);
        if (!isSameType(head.type, headType)) throw new EvaluatorTypeError("Pair head assertion failure", DataType[headType], DataType[head.type]);
    }
    if (tailType) {
        const tail = this.pair_tail(p);
        if (!isSameType(tail.type, tailType)) throw new EvaluatorTypeError("Pair tail assertion failure", DataType[tailType], DataType[tail.type]);
    }
}
