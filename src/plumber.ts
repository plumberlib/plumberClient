enum PipeType {
    VALUE = 'value'
};
const DEFAULT_PIPE_TYPE = PipeType.VALUE;
const DEFAULT_PIPE_NAME = 'default';

export const plumber = {
    websocketURL: 'wss://plumberlib.com/',
    websocket: null,
    createPipe: (name: string = DEFAULT_PIPE_NAME, type: PipeType = DEFAULT_PIPE_TYPE): Pipe<any> => {
        if(!plumber.websocket) { plumber.websocket = new WebSocket(plumber.websocketURL); }
        return new Pipe(name, plumber.websocket);
    },
    getPipe: (name: string = DEFAULT_PIPE_NAME): Pipe<any> => {
        if(!plumber.websocket) { plumber.websocket = new WebSocket(plumber.websocketURL); }
        return new Pipe(name, plumber.websocket);
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

type Subscriber<T> = (data: T) => any;

enum PipeOperationType {
    SEND = 'send',
    CLOSE = 'close'
};
interface PipeOperation {
    type: PipeOperationType
}
interface SendPipeOperation<T> extends PipeOperation {
    type: PipeOperationType.SEND,
    data: T
}
interface ClosePipeOperation extends PipeOperation {
    type: PipeOperationType.CLOSE
}

enum PipeState {
    CONNECTING = WebSocket.CONNECTING,
    OPEN       = WebSocket.OPEN,
    CLOSED     = WebSocket.CLOSED,
    CLOSING    = WebSocket.CLOSING
};

class Pipe<T> {
    private subscribers: Subscriber<T>[] = [];
    private operationQueue: PipeOperation[] = [];
    private state: PipeState = PipeState.CONNECTING;

    constructor(private name: string, private websocket: WebSocket) {
        this.websocket.addEventListener('open', () => {
            this.state = PipeState.OPEN;
            this.runOperationQueue();
        });
        this.websocket.addEventListener('close', () => {
            this.state = PipeState.CLOSED;
        });
        this.websocket.addEventListener('message', (event) => {
            const { data } = event;
            const parsedData = JSON.parse(data) as T;
            this.subscribers.forEach((subscriber) => {
                subscriber(parsedData);
            });
        });
    }

    public subscribe(subscriber: Subscriber<T>): void {
        this.subscribers.push(subscriber);
    }
    public unsubscribe(subscriber: Subscriber<T>): void {
        for(let i: number = this.subscribers.length - 1; i>=0; i--) {
            if(subscriber === this.subscribers[i]) {
                this.subscribers.splice(i, 1);
            }
        }
    }

    private enqueueOperation(op: PipeOperation): void {
        this.operationQueue.push(op);
    }

    private async runOperationQueue(): Promise<void> {
        while(this.operationQueue.length > 0) {
            const op = this.operationQueue.shift();
            await this.executeOperation(op);
        }
    }

    private async executeOperation(op: PipeOperation): Promise<void> {
        const { type } = op;
        if(type === PipeOperationType.SEND) {
            const { data } = op as SendPipeOperation<T>;
            return this.websocket.send(JSON.stringify(data));
        } else if (type === PipeOperationType.CLOSE) {
            const {} = op as ClosePipeOperation;
            this.state = PipeState.CLOSING;
            return this.websocket.close();
        } else {
            throw new Error(`Unknown op type ${type}`)
        }
    }

    public send(data: T): void {
        const op: SendPipeOperation<T> = { type: PipeOperationType.SEND, data };
        this.enqueueOperation(op);
        if(this.state === PipeState.OPEN) { this.runOperationQueue(); }
    }

    public close(): void {
        const op: ClosePipeOperation = { type: PipeOperationType.CLOSE };
        this.enqueueOperation(op);
        if(this.state === PipeState.OPEN) { this.runOperationQueue(); }
    }
}