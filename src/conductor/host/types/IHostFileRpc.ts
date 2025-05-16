export interface IHostFileRpc {
    requestFile(fileName: string): Promise<string | undefined>;
}
