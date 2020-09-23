enum PipeType {
    VALUE = 'value'
};
const DEFAULT_PIPE_TYPE = PipeType.VALUE;
const DEFAULT_PIPE_NAME = 'default';

export const plumber = {
    websocketURL: 'wss://plumberlib.com/',
    websocket: null,
    pipes: new Map<string, Pipe<any>>(),
    createPipe: (name: string = DEFAULT_PIPE_NAME, type: PipeType = DEFAULT_PIPE_TYPE): Pipe<any> => {
        if(!plumber.websocket) { plumber.websocket = new WebSocket(plumber.websocketURL); }
        const pipe = new Pipe<any>(name, plumber.websocket);
        plumber.pipes.set(name, pipe);
        return pipe;
    },
    getPipe: (name: string = DEFAULT_PIPE_NAME): Pipe<any> => {
        return plumber.pipes.get(name);
    },
    getOrCreatePipe: (name: string = DEFAULT_PIPE_NAME, type: PipeType = DEFAULT_PIPE_TYPE): Pipe<any> => {
        if (plumber.hasPipe(name)) {
            return plumber.getPipe(name);
        } else {
            return plumber.createPipe(name, type);
        }
    },
    hasPipe: (name: string): boolean => {
        return plumber.pipes.has(name);
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
    CONNECTING = 0, //WebSocket.CONNECTING,
    OPEN       = 1, //WebSocket.OPEN,
    CLOSING    = 2, //WebSocket.CLOSING,
    CLOSED     = 3 //WebSocket.CLOSED,
};

export enum PipeActionType { JOIN, LEAVE, MESSAGE }
export interface PipeAction {
    t: PipeActionType
}
export interface JoinPipeAction {
    t: PipeActionType.JOIN,
    p: string
}
export interface LeavePipeAction {
    t: PipeActionType.LEAVE,
    p: string
}
export interface MessagePipeAction<E> {
    t: PipeActionType.MESSAGE,
    p: string,
    m: E
}

class Pipe<T> {
    private subscribers: Subscriber<T>[] = [];
    private operationQueue: PipeOperation[] = [];
    private state: PipeState = PipeState.CONNECTING;

    constructor(private name: string, private websocket: WebSocket) {
        if(this.websocket.readyState === WebSocket.OPEN) {
            this.joinPipe();
        }
        this.websocket.addEventListener('open', () => {
            this.state = PipeState.OPEN;
            this.joinPipe();
            this.runOperationQueue();
        });
        this.websocket.addEventListener('close', () => {
            this.state = PipeState.CLOSED;
        });
        this.websocket.addEventListener('message', (event) => {
            const { data } = event;
            const parsedData = JSON.parse(data) as MessagePipeAction<T>;
            if(parsedData.t === PipeActionType.MESSAGE && parsedData.p === this.name) {
                const payload = parsedData.m;
                this.subscribers.forEach((subscriber) => {
                    subscriber(payload);
                });
            }
        });
    }

    private joinPipe(): void {
        this.websocket.send(JSON.stringify({ t: PipeActionType.JOIN, p: this.name } as JoinPipeAction));
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
            return this.websocket.send(JSON.stringify({
                t: PipeActionType.MESSAGE, p: this.name, m: data
            } as MessagePipeAction<T>));
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
        this.websocket.send(JSON.stringify({ t: PipeActionType.LEAVE, p: this.name } as LeavePipeAction));
        this.enqueueOperation(op);
        if(this.state === PipeState.OPEN) { this.runOperationQueue(); }
    }
}