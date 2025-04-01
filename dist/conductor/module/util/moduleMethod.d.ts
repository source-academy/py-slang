import { DataType, ExternCallable, IFunctionSignature } from "../../types";
export declare function moduleMethod<const Args extends DataType[], Ret extends DataType>(args: Args, returnType: Ret): (method: ExternCallable<{
    readonly args: Args;
    readonly returnType: DataType;
}> & {
    signature?: IFunctionSignature;
}, _context: ClassMemberDecoratorContext) => void;
