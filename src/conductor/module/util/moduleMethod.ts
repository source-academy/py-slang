import { DataType, ExternCallable, IFunctionSignature } from "../../types";

export function moduleMethod<const Args extends DataType[], Ret extends DataType>(args: Args, returnType: Ret) {
    const signature = {args, returnType} as const satisfies IFunctionSignature;
    function externalClosureDecorator(method: ExternCallable<typeof signature> & {signature?: IFunctionSignature}, _context: ClassMemberDecoratorContext) {
        method.signature = signature;
    }
    return externalClosureDecorator;
}
