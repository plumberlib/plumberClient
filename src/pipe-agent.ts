import { Subscribable } from "./subscribable";
import { Pipe } from "./pipe";

export const pipeActionTypeKey = 't';
export const pipeNameKey       = 'p';
export const pipeMessageKey    = 'm';

export enum PipeActionType { JOIN, LEAVE, MESSAGE }
export interface PipeAction {
    [pipeActionTypeKey]: PipeActionType
}
export interface JoinPipeAction {
    [pipeActionTypeKey]: PipeActionType.JOIN,
    [pipeNameKey]: string
}
export interface LeavePipeAction {
    [pipeActionTypeKey]: PipeActionType.LEAVE,
    [pipeNameKey]: string
}
export interface MessagePipeAction<E> {
    [pipeActionTypeKey]: PipeActionType.MESSAGE,
    [pipeNameKey]: string,
    [pipeMessageKey]: E
}

enum PipeState {
    CONNECTING = 0, //WebSocket.CONNECTING,
    OPEN       = 1, //WebSocket.OPEN,
    CLOSING    = 2, //WebSocket.CLOSING,
    CLOSED     = 3 //WebSocket.CLOSED,
};

enum PipeOperationType {
    SEND = 'send',
    CLOSE = 'close',
    JOIN = 'join'
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
interface JoinPipeOperation extends PipeOperation {
    type: PipeOperationType.JOIN,
    channel: string
}

export class PipeAgent extends Subscribable<any> {
    private operationQueue: PipeOperation[] = [];
    private state: PipeState = PipeState.CONNECTING;
    constructor(private websocket: WebSocket, private pipe: Pipe<any>) {
        super();
        if(this.websocket.readyState === WebSocket.OPEN) {
            this.state = PipeState.OPEN;
            this.runOperationQueue();
        }
        this.websocket.addEventListener('open', () => {
            this.state = PipeState.OPEN;
            this.runOperationQueue();
        });

        this.websocket.addEventListener('close', () => {
            this.state = PipeState.CLOSED;
        });

        this.websocket.addEventListener('message', (event) => {
            const { data } = event;
            const parsedData = JSON.parse(data) as MessagePipeAction<any>;
            if(parsedData[pipeActionTypeKey] === PipeActionType.MESSAGE &&
                parsedData[pipeNameKey] === this.pipe.getName()) {
                const payload = parsedData[pipeMessageKey];
                this.forEachSubscriber((subscriber) => {
                    subscriber(payload);
                });
            }
        });
    }

    public join(channel: string): void {
        const op: JoinPipeOperation = { type: PipeOperationType.JOIN, channel };
        this.enqueueOperation(op);
        if(this.state === PipeState.OPEN) { this.runOperationQueue(); }
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
            const { data } = op as SendPipeOperation<any>;
            return this.websocket.send(JSON.stringify({
                [pipeActionTypeKey]: PipeActionType.MESSAGE,
                [pipeNameKey]: this.pipe.getName(),
                [pipeMessageKey]: data
            } as MessagePipeAction<any>));
        } else if (type === PipeOperationType.CLOSE) {
            const {} = op as ClosePipeOperation;
            this.state = PipeState.CLOSING;
            return this.websocket.close();
        } else if (type === PipeOperationType.JOIN) {
            const { channel } = op as JoinPipeOperation;
            this.websocket.send(JSON.stringify({
                [pipeActionTypeKey]: PipeActionType.JOIN,
                [pipeNameKey]: channel
            } as JoinPipeAction));
        } else {
            throw new Error(`Unknown op type ${type}`)
        }
    }

    public send(data: any): void {
        const op: SendPipeOperation<any> = { type: PipeOperationType.SEND, data };
        this.enqueueOperation(op);
        if(this.state === PipeState.OPEN) { this.runOperationQueue(); }
    }

    public close(): void {
        const op: ClosePipeOperation = { type: PipeOperationType.CLOSE };
        this.websocket.send(JSON.stringify({
            [pipeActionTypeKey]: PipeActionType.LEAVE,
            [pipeNameKey]: this.pipe.getName()
        } as LeavePipeAction));
        this.enqueueOperation(op);
        if(this.state === PipeState.OPEN) { this.runOperationQueue(); }
    }
}