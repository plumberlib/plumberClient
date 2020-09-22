enum PipeType {
    VALUE = 'value'
};
const DEFAULT_PIPE_TYPE = PipeType.VALUE;
const DEFAULT_PIPE_NAME = 'default';

export const plumber = {
    websocketURL: 'wss://plumberlib.com/',
    createPipe: (name: string = DEFAULT_PIPE_NAME, type: PipeType = DEFAULT_PIPE_TYPE): Pipe<any> => {
        return new Pipe(name, plumber.websocketURL);
    },
    getPipe: (name: string = DEFAULT_PIPE_NAME): Pipe<any> => {
        return new Pipe(name, plumber.websocketURL);
    },
    getOrCreatePipe: (name: string = DEFAULT_PIPE_NAME, type: PipeType = DEFAULT_PIPE_TYPE): Pipe<any> => {
        if (plumber.hasPipe(name)) {
            return plumber.getPipe(name);
        } else {
            return plumber.createPipe(name, type);
        }
    },
    hasPipe: (name: string): boolean => {
        return false;
    }
}

type Subscriber = Function;

class Pipe<T> {
    private websocket: WebSocket;
    private subscribers: Subscriber[] = [];
    constructor(private name: string, private serverURL: string) {
        this.websocket = new WebSocket(serverURL);
        this._doWebsocketAddEventListener('message', (event) => {
            this.subscribers.forEach((subscriber) => {
                subscriber(event);
            });
        });
    }

    public subscribe(subscriber: Subscriber): void { this.subscribers.push(subscriber); }
    public unsubscribe(subscriber: Subscriber): void {
    }
    protected _doWebsocketSend(data: string|ArrayBuffer|Blob|ArrayBufferView): void {
        this.websocket.send(data);
    }
    protected _doWebsocketAddEventListener(eventType: 'message'|'open'|'close'|'error', listener: (this: WebSocket, ev: MessageEvent<any> | Event | CloseEvent) => any): void {
        this.websocket.addEventListener(eventType, listener);
    }
    protected _doWebsocketRemoveEventListener(eventType: 'message'|'open'|'close'|'error', listener: (this: WebSocket, ev: MessageEvent<any> | Event | CloseEvent) => any): void {
        this.websocket.removeEventListener(eventType, listener);
    }
    protected _doWebsocketClose(code?: number, reason?: string): void {
        this.websocket.close(code, reason);
    }
    protected _getWebsocketReadyState(): number {
        return this.websocket.readyState;
    }

    public send(data: T): void {
        this._doWebsocketSend(JSON.stringify(data));
    }

    public close(): void {
        this._doWebsocketClose();
    }
}