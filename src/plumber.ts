import { Pipe, PipeType } from './pipe';

const DEFAULT_PIPE_TYPE = PipeType.VALUE;
const DEFAULT_PIPE_NAME = 'default';

const plumber = {
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
};

export default plumber;