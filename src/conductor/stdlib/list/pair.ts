import { DataType, IDataHandler, PairIdentifier, TypedValue } from "../../types";

/**
 * Makes a pair with x as head and y as tail.
 * @param x - given head
 * @param y - given tail
 * @returns pair with x as head and y as tail.
 */
export function pair(this: IDataHandler, x: TypedValue<DataType>, y: TypedValue<DataType>): PairIdentifier {
    return this.pair_make(x, y);
}

/**
 * @param x - given value
 * @returns whether x is a pair
 */
export function is_pair(this: IDataHandler, x: any): boolean {

    return typeof x === 'object' && x !== null && x.__brand === 'pair';
}

/**
 * Returns the head of given pair p.
 * @param p - given pair
 * @returns head of p
 */
export function head(this: IDataHandler, p: PairIdentifier): TypedValue<DataType> {
    return this.pair_head(p);
}

/**
 * Returns the tail of given pair p.
 * @param p - given pair
 * @returns tail of p
 */
export function tail(this: IDataHandler, p: PairIdentifier): TypedValue<DataType> {
    return this.pair_tail(p);
} 