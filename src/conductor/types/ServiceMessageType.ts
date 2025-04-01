export const enum ServiceMessageType {
    /** A handshake message. See `HelloServiceMessage`. */
    HELLO = 0,

    /** Abort the connection, due to incompatible protocol versions. See `AbortServiceMessage`. */
    ABORT = 1,

    /** The evaluation entry point, sent from the host. See `EntryServiceMessage`. */
    ENTRY = 2,

    /** Plugin advisory sent from the runner so the host may load a corresponding plugin. See `PluginServiceMessage`. */
    PLUGIN = 3,
};
