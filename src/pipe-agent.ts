import { Subscribable } from "./subscribable";
import { ClientAddonMethod, Pipe } from "./pipe";
import { uuid } from "./util";
import { Mocket } from "./mocket";
import { Connection, Doc } from 'sharedb/lib/client';
import sharedb = require("sharedb");

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
    JOIN = 'join',
    SDB = 'sdb',
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

export const GET_METHODS_COMMAND = '__getmethods__';
export interface SpecialMethodInvocation {
    specialMethod: string,
    invocationID: string
}
export interface MethodInvocation {
    method: string,
    args: any[],
    invocationID: string
}
export interface ShareDBOp {
    method: 'sharedb',
    args: any[]
}

export class PipeAgent extends Subscribable<any> {
    private state: PipeState = PipeState.CONNECTING;
    private readonly operationQueue: PipeOperation[] = [];
    private readonly awaitingResponse: Map<string, (response: any) => void> = new Map();
    private readonly shareDBMocket: Mocket;
    private readonly sdbConnection: Connection;
    constructor(private readonly websocket: WebSocket, private readonly pipe: Pipe<any>) {
        super();
        this.shareDBMocket = new Mocket(this.websocket, (dataString: string) => {
            const op: SendPipeOperation<ShareDBOp> = {
                type: PipeOperationType.SEND,
                data: { method: 'sharedb', args: [JSON.parse(dataString)] }
            };
            this.enqueueOperation(op);
            if(this.state === PipeState.OPEN) { this.runOperationQueue(); }
        });
        this.sdbConnection = new Connection(this.shareDBMocket as any);

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

                if(payload.method === 'sharedb') {
                    const { args } = payload;
                    this.shareDBMocket.pushData(args[0]);
                } else {
                    this.forEachSubscriber((subscriber) => {
                        subscriber(payload);
                    });
                }
            } else if(parsedData[pipeActionTypeKey] === PipeActionType.MESSAGE &&
                parsedData[pipeNameKey] === 'invocationResponse') {
                const payload = parsedData[pipeMessageKey];

                const responseToInvocation = payload['responseToInvocation'];
                if(this.awaitingResponse.has(responseToInvocation)) {
                    const func = this.awaitingResponse.get(responseToInvocation);
                    const response = payload['response'];
                    func(response);
                    this.awaitingResponse.delete(responseToInvocation);
                }
            }
        });
    }

    public getShareDBDoc(documentID: string): Doc {
        return this.sdbConnection.get(this.pipe.getName(), documentID);
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

    public do(method: string, ...args: any[]): Promise<void> {
        const invocationID = uuid();
        const op: SendPipeOperation<MethodInvocation> = {
            type: PipeOperationType.SEND,
            data: { method, args, invocationID }
        };
        return new Promise((resolve, reject) => {
            this.awaitingResponse.set(invocationID, (response) => {
                resolve(response);
            });
            this.enqueueOperation(op);
            if(this.state === PipeState.OPEN) { this.runOperationQueue(); }
        });
    }

    public getMethods(): Promise<ClientAddonMethod> {
        const invocationID = uuid();
        const op: SendPipeOperation<SpecialMethodInvocation> = {
            type: PipeOperationType.SEND,
            data: { specialMethod: GET_METHODS_COMMAND, invocationID }
        };
        return new Promise((resolve, reject) => {
            this.awaitingResponse.set(invocationID, (response) => {
                resolve(response);
            });
            this.enqueueOperation(op);
            if(this.state === PipeState.OPEN) { this.runOperationQueue(); }
        });
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