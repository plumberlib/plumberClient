export const pipeActionTypeKey        = 'type';
export const pipeNameKey              = 'pipe-name';
export const pipeScopeKey             = 'pipe-scope';
export const pipeMessageKey           = 'message';
export const methodNameKey            = 'method';
export const methodArgsKey            = 'arguments';
export const methodIIDKey             = 'invocation-id';
export const shareDBDataKey           = 'sharedb-data';
export const methodResponseDataKey    = 'response';
export const methodResponseErrorKey   = 'method-error';

export const GET_METHODS_COMMAND      = '__getmethods__';
export const SET_API_KEY_COMMAND      = '__setapikey__';

export const RATE_LIMIT_EXCEEDED_TYPE = '__rate_limit_exceeded__'


export const PIPES_ADMIN_DOC_ID = '|';
export const ADMIN_PIPE_NAME    = '@';
export const DEFAULT_PIPE_NAME  = 'default';

export enum PipeActionType {
    JOIN                       = 'join',
    LEAVE                      = 'leave',
    METHOD_INVOCATION          = 'invoke',
    METHOD_INVOCATION_RESPONSE = 'response',
    SHAREDB_OP                 = 'sdb',
    MESSAGE                    = 'message'
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

export interface ClientAddonMethod {
    name: string,
    description?: string,
}