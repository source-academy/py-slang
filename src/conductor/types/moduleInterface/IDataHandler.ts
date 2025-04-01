import type { ArrayIdentifier, ClosureIdentifier, DataType, ExternCallable, Identifier, IFunctionSignature, List, OpaqueIdentifier, PairIdentifier, TypedValue } from ".";

export interface IDataHandler {
    readonly hasDataInterface: true;

    ///// Data Handling Functions

    /**
     * Makes a new Pair.
     * @param head The typed value to be the head of the new Pair.
     * @param tail The typed value to be the tail of the new Pair.
     * @returns An identifier to the new Pair.
     */
    pair_make(head: TypedValue<DataType>, tail: TypedValue<DataType>): PairIdentifier;

    /**
     * Gets the typed value in the head of a Pair.
     * @param p The Pair to retrieve the head of.
     * @returns The typed value in the head of the Pair.
     */
    pair_head(p: PairIdentifier): TypedValue<DataType>;

    /**
     * Sets the head of a Pair.
     * @param p The Pair to set the head of.
     * @param tv The typed value to set the head of the Pair to.
     */
    pair_sethead(p: PairIdentifier, tv: TypedValue<DataType>): void;

    /**
     * Gets the typed value in the tail of a Pair.
     * @param p The Pair to retrieve the tail of.
     * @returns The typed value in the tail of the Pair.
     */
    pair_tail(p: PairIdentifier): TypedValue<DataType>;

    /**
     * Sets the tail of a Pair.
     * @param p The Pair to set the tail of.
     * @param tv The typed value to set the tail of the Pair to.
     */
    pair_settail(p: PairIdentifier, tv: TypedValue<DataType>): void;

    /**
     * Asserts the type of a Pair.
     * @param p The Pair to assert the type of.
     * @param headType The expected type of the head of the Pair.
     * @param tailType The expected type of the tail of the Pair.
     * @throws If the Pair's type is not as expected.
     */
    pair_assert(p: PairIdentifier, headType?: DataType, tailType?: DataType): void;

    /**
     * Makes a new Array.
     * 
     * Creation of untyped arrays (with type `VOID`) should be avoided.
     * @param t The type of the elements of the Array
     * @param len The length of the Array
     * @param init An optional initial typed value for the elements of the Array
     * @returns An identifier to the new Array.
     */
    array_make<T extends DataType>(t: T, len: number, init?: TypedValue<NoInfer<T>>): ArrayIdentifier<NoInfer<T>>;

    /**
     * Gets the length of an Array.
     * @param a The Array to retrieve the length of.
     * @returns The length of the given Array.
     */
    array_length(a: ArrayIdentifier<DataType>): number;

    /**
     * Gets the typed value at a specific index of an Array.
     * Arrays are 0-indexed.
     * @param a The Array to retrieve the value from.
     * @param idx The index of the value wanted.
     * @returns The typed value at the given index of the given Array.
     */
    array_get(a: ArrayIdentifier<DataType.VOID>, idx: number): TypedValue<DataType>;
    array_get<T extends DataType>(a: ArrayIdentifier<T>, idx: number): TypedValue<NoInfer<T>>;

    /**
     * Gets the type of the elements of an Array.
     * 
     * If the Array is untyped, `VOID` is returned.
     * @param a The Array to retrieve the element type of.
     * @returns The type of the elements of the Array.
     */
    array_type<T extends DataType>(a: ArrayIdentifier<T>): NoInfer<T>;

    /**
     * Sets a value at a specific index of an Array.
     * Arrays are 0-indexed.
     * @param a The Array to be modified.
     * @param idx The index to be modified.
     * @param tv The new typed value at the given index of the given Array.
     * @throws If the array is typed and v's type does not match the Array's type.
     */
    array_set(a: ArrayIdentifier<DataType.VOID>, idx: number, tv: TypedValue<DataType>): void;
    array_set<T extends DataType>(a: ArrayIdentifier<T>, idx: number, tv: TypedValue<NoInfer<T>>): void;

    /**
     * Asserts the type and/or length of an Array.
     * @param a The Array to assert.
     * @param type The expected type of the elements of the Array.
     * @param length The expected length of the Array.
     * @throws If the Array's type is not as expected.
     */
    array_assert<T extends DataType>(a: ArrayIdentifier<DataType>, type?: T, length?: number): asserts a is ArrayIdentifier<NoInfer<T>>;

    /**
     * Makes a new Closure.
     * @param sig The signature of the new Closure.
     * @param func A callback to be called when the Closure is called.
     * @param dependsOn An optional array of Identifiers the Closure will depend on.
     * @returns An identifier to the new Closure.
     */
    closure_make<const T extends IFunctionSignature>(sig: T, func: ExternCallable<T>, dependsOn?: (Identifier | null)[]): ClosureIdentifier<T["returnType"]>;

    /**
     * Checks if a Closure accepts variable number of arguments.
     * @param c The Closure to check.
     * @returns `true` if the Closure accepts variable number of arguments.
     */
    closure_is_vararg(c: ClosureIdentifier<DataType>): boolean;

    /**
     * Gets the arity (number of parameters) of a Closure.
     * For vararg Closures, the arity is the minimum number of parameters required.
     * @param c The Closure to get the arity of.
     * @returns The arity of the Closure.
     */
    closure_arity(c: ClosureIdentifier<DataType>): number;

    /**
     * Calls a Closure and checks the type of the returned value.
     * @param c The Closure to be called.
     * @param args An array of typed arguments to be passed to the Closure.
     * @param returnType The expected type of the returned value.
     * @returns The returned typed value.
     */
    closure_call<T extends DataType>(c: ClosureIdentifier<DataType>, args: TypedValue<DataType>[], returnType: T): Promise<TypedValue<NoInfer<T>>>;

    /**
     * Calls a Closure of known return type.
     * @param c The Closure to be called.
     * @param args An array of typed arguments to be passed to the Closure.
     * @returns The returned typed value.
     */
    closure_call_unchecked<T extends DataType>(c: ClosureIdentifier<T>, args: TypedValue<DataType>[]): Promise<TypedValue<NoInfer<T>>>;

    /**
     * Asserts the arity of a Closure.
     * @param c The Closure to assert the arity of.
     * @param arity The expected arity of the Closure.
     * @throws If the Closure's arity is not as expected.
     */
    closure_arity_assert(c: ClosureIdentifier<DataType>, arity: number): void;

    /**
     * Makes a new Opaque object.
     * @param v The value to be stored under this Opaque object.
     * @param immutable Mark this Opaque object as immutable. Mutable Opaque objects are not rollback-friendly,
     * and evaluators should disable any rollback functionality upon receiving such an object.
     * @returns An identifier to the new Opaque object.
     */
    opaque_make(v: any, immutable?: boolean): OpaqueIdentifier;

    /**
     * Gets the value stored under an Opaque object.
     * @param o The identifier to the Opaque object.
     * @returns The value stored under this new Opaque object.
     */
    opaque_get(o: OpaqueIdentifier): any;

    /**
     * Update the value stored under an Opaque object.
     * @param o The identifier to the Opaque object.
     * @param v The new value to store under this Opaque object.
     */
    opaque_update(o: OpaqueIdentifier, v: any): void;

    /**
     * Ties the lifetime of the dependee to the dependent.
     * @param dependent The object that requires the existence of the dependee.
     * @param dependee The object whose existence is required by the dependent.
     */
    tie(dependent: Identifier, dependee: Identifier | null): void;

    /**
     * Unties the lifetime of the dependee from the dependent.
     * @param dependent The tied dependent object.
     * @param dependee The tied dependee object.
     */
    untie(dependent: Identifier, dependee: Identifier | null): void;

    ///// Standard library functions

    list(...elements: TypedValue<DataType>[]): TypedValue<DataType.LIST>;
    is_list(xs: List): boolean;
    list_to_vec(xs: List): TypedValue<DataType>[];
    accumulate<T extends Exclude<DataType, DataType.VOID>>(op: ClosureIdentifier<DataType>, initial: TypedValue<T>, sequence: List, resultType: T): Promise<TypedValue<T>>;
    length(xs: List): number;
}
