import { Subscribable } from "./subscribable";
import { ClientAddonMethod, Pipe } from "./pipe";
import { uuid } from "./util";
import { Mocket } from "./mocket";
import { Connection, Doc } from 'sharedb/lib/client';
import * as ShareDB from 'sharedb';
import { Plumber } from "./plumber";

export const pipeActionTypeKey      = 'type';
export const pipeNameKey            = 'pipe-name';
export const pipeScopeKey           = 'pipe-scope';
export const pipeMessageKey         = 'message';
export const methodNameKey          = 'method';
export const methodArgsKey          = 'arguments';
export const methodIIDKey           = 'invocation-id';
export const shareDBDataKey         = 'sharedb-data';
export const methodResponseDataKey  = 'response';
export const methodResponseErrorKey = 'method-error';

export const GET_METHODS_COMMAND = '__getmethods__';
export const SET_API_KEY_COMMAND = '__setapikey__';


export enum PipeActionType {
    JOIN = 'join',
    LEAVE = 'leave',
    METHOD_INVOCATION = 'invoke',
    METHOD_INVOCATION_RESPONSE = 'response',
    SHAREDB_OP = 'sdb',
    MESSAGE = 'message'
}
export interface PipeAction {
    [pipeActionTypeKey]: PipeActionType,
    [pipeNameKey]: string,
    [pipeScopeKey]?: string
}
export interface JoinPipeAction extends PipeAction {
    [pipeActionTypeKey]: PipeActionType.JOIN,
}
export interface LeavePipeAction extends PipeAction {
    [pipeActionTypeKey]: PipeActionType.LEAVE,
}
export interface MethodInvocationPipeAction extends PipeAction {
    [pipeActionTypeKey]: PipeActionType.METHOD_INVOCATION,
    [methodNameKey]: string,
    [methodArgsKey]?: any[],
    [methodIIDKey]?: string
}
export interface ShareDBPipeAction extends PipeAction {
    [pipeActionTypeKey]: PipeActionType.SHAREDB_OP,
    [shareDBDataKey]: any
}
export interface MethodInvocationResponsePipeAction extends PipeAction {
    [pipeActionTypeKey]: PipeActionType.METHOD_INVOCATION_RESPONSE,
    [methodIIDKey]: string,
    [methodResponseErrorKey]: any
    [methodResponseDataKey]: any
}

export interface MessagePipeAction extends PipeAction {
    [pipeActionTypeKey]: PipeActionType.MESSAGE,
    [pipeMessageKey]: any
}

enum PipeState {
    CONNECTING = 0, //WebSocket.CONNECTING,
    OPEN       = 1, //WebSocket.OPEN,
    CLOSING    = 2, //WebSocket.CLOSING,
    CLOSED     = 3 //WebSocket.CLOSED,
};

export class PipeAgent extends Subscribable<any> {
    public static PIPES_ADMIN_DOC_ID = '|';
    private state: PipeState = PipeState.CONNECTING;
    private readonly authOperationQueue: PipeAction[] = [];
    private readonly operationQueue: PipeAction[] = [];
    private readonly awaitingResponse: Map<string, (err: any|null, response: any) => void> = new Map();
    private readonly shareDBMocket: Mocket;
    private sdbConnection: Connection;
    private isAuthenticated: boolean = false;
    private websocket: WebSocket;
    constructor(private readonly plumber: Plumber, private readonly pipe: Pipe) {
        super();

        this.updateWebsocket();
        this.shareDBMocket = new Mocket(this.websocket, (dataString: string) => {
            const op: ShareDBPipeAction = {
                [pipeActionTypeKey]: PipeActionType.SHAREDB_OP,
                [shareDBDataKey]:    JSON.parse(dataString),
                [pipeNameKey]:       this.pipe.getName()
            }
            this.enqueueOperation(op);
        });
        this.sdbConnection = new Connection(this.shareDBMocket as any);
        // (this.sdbConnection as any).debug = true;
    }

    public updateWebsocket(): void {
        this.setWebsocket(this.plumber.getWebsocket());
    }

    private setWebsocket(ws: WebSocket): void {
        this.websocket = ws;

        if(this.websocket) {
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
                // console.log('IN <=', data);
                const parsedData = JSON.parse(data) as PipeAction;
                const pipeName = parsedData[pipeNameKey];

                if(pipeName === this.pipe.getName()) {
                    const actionType = parsedData[pipeActionTypeKey];
                    if(actionType === PipeActionType.SHAREDB_OP) {
                        const sharedbAction = parsedData as ShareDBPipeAction;
                        const sdbData = sharedbAction[shareDBDataKey];
                        this.shareDBMocket.pushData(sdbData);
                    } else if(actionType === PipeActionType.METHOD_INVOCATION_RESPONSE) {
                        const methodInvocationResponse = parsedData as MethodInvocationResponsePipeAction;
                        const invocationID = methodInvocationResponse[methodIIDKey];

                        if(this.awaitingResponse.has(invocationID)) {
                            const responseFunc = this.awaitingResponse.get(invocationID);
                            const responseErr = methodInvocationResponse[methodResponseErrorKey];
                            const responseData = methodInvocationResponse[methodResponseDataKey];
                            responseFunc(responseErr, responseData);
                            this.awaitingResponse.delete(invocationID);
                        }
                    } else if(actionType === PipeActionType.MESSAGE) {
                        const messageAction = parsedData as MessagePipeAction;
                        const message = messageAction[pipeMessageKey];

                        this.forEachSubscriber((subscriber) => {
                            subscriber(message);
                        });
                    }
                }
            });
        }

        if(this.shareDBMocket) { // the first time we run this (fromm the constructor), the mocket isn't set. TODO: fix
            this.shareDBMocket.setWebsocket(this.websocket);
        }
    }

    public getShareDBDoc(documentID: string): Doc {
        return this.sdbConnection.get(this.pipe.getName(), documentID);
    }

    public join(channel: string): void {
        const op: JoinPipeAction = { [pipeActionTypeKey]: PipeActionType.JOIN, [pipeNameKey]: channel };
        this.enqueueOperation(op);
    }


    private enqueueAuthOperation(op: PipeAction): void {
        this.authOperationQueue.push(op);
        if(this.state === PipeState.OPEN) { this.runOperationQueue(); }
    }
    private enqueueOperation(op: PipeAction): void {
        this.operationQueue.push(op);
        if(this.state === PipeState.OPEN) { this.runOperationQueue(); }
    }

    private async runOperationQueue(): Promise<void> {
        while(this.authOperationQueue.length > 0) {
            const op = this.authOperationQueue.shift();
            // console.log('OUT =>', op);
            this.websocket.send(JSON.stringify(op));
        }
        if(this.plumber.isAuthenticated()) {
            while(this.operationQueue.length > 0) {
                const op = this.operationQueue.shift();
                // console.log('OUT =>', op);
                this.websocket.send(JSON.stringify(op));
            }
        }
    }

    private doCallMethod(method: string, args: any[], expectResponse: boolean, isAuthMethod: boolean = false): Promise<any> {
        const invocationID = expectResponse ? uuid() : false;
        const op: MethodInvocationPipeAction = {
            [pipeActionTypeKey]: PipeActionType.METHOD_INVOCATION,
            [pipeNameKey]: this.pipe.getName(),
            [methodNameKey]: method
        };
        if(args.length > 0) { op[methodArgsKey] = args; }
        if(invocationID)    { op[methodIIDKey]  = invocationID; }

        return new Promise((resolve, reject) => {
            if(invocationID) {
                this.awaitingResponse.set(invocationID, (err: any, response: any) => {
                    if(err) {
                        reject(err);
                    } else {
                        resolve(response);
                    }
                });
            }

            if(isAuthMethod) {
                this.enqueueAuthOperation(op);
            } else {
                this.enqueueOperation(op);
            }
        });
    }

    public do(method: string, ...args: any[]): Promise<any> {
        return this.doCallMethod(method, args, true, false);
    }

    public getAllPipesDoc(): ShareDB.Doc {
        return this.getShareDBDoc(PipeAgent.PIPES_ADMIN_DOC_ID);
    }

    public getMethods(): Promise<ClientAddonMethod> {
        return this.do(GET_METHODS_COMMAND);
    }

    public setAPIKey(key: string): Promise<boolean> {
        return this.doCallMethod(SET_API_KEY_COMMAND, [key], true, true).then((success: boolean) => {
            this.isAuthenticated = success;
            if(!this.isAuthenticated) {
                throw new Error(`Invalid Plumber API key "${key}". Please see ${this.plumber.getWebsocketURL().replace('ws://', 'http://').replace('wss://', 'https://')}`);
            }
            this.runOperationQueue();
            return this.isAuthenticated;
        });
    }

    public onAuthenticated(): void {
        this.shareDBMocket.markOpen();
        this.runOperationQueue();
    }

    public close(): void {
        const op: LeavePipeAction = { [pipeActionTypeKey]: PipeActionType.LEAVE, [pipeNameKey]: this.pipe.getName() };
        this.enqueueOperation(op);
    }
}