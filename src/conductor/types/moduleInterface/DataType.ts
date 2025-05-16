export enum DataType {
    /** The return type of functions with no returned value. As a convention, the associated JS value is undefined. */
    VOID = 0,

    /** A Boolean value. */
    BOOLEAN = 1,

    /** A numerical value. */
    NUMBER = 2,

    /** An immutable string of characters. */
    CONST_STRING = 3,

    /** The empty list. As a convention, the associated JS value is null. */
    EMPTY_LIST = 4,

    /** A pair of values. Reference type. */
    PAIR = 5,

    /** An array of values of a single type. Reference type. */
    ARRAY = 6,

    /** A value that can be called with fixed arity. Reference type. */
    CLOSURE = 7,

    /** An opaque value that cannot be manipulated from user code. */
    OPAQUE = 8,

    /** A list (either a pair or the empty list). */
    LIST = 9,
};
