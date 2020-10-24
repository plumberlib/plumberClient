import { Pipe } from './pipe';

const DEFAULT_PIPE_NAME = 'default';
export const ADMIN_PIPE_NAME = '<<admin>>'

export interface PlumberConfig {
    apiKey?: string|boolean,
    websocketURL?: string
}

export interface Plumber {
    _configuration: PlumberConfig,
    config(options: PlumberConfig): void,
    websocket: null | WebSocket,
    pipes: Map<string, Pipe<any>>,
    createPipe(name: string): Pipe<any>,
    getPipe(name: string): Pipe<any>,
    getOrCreatePipe(name: string): Pipe<any>,
    hasPipe(name: string): boolean
}

const plumber: Plumber = {
    _configuration: {
        apiKey: false,
        websocketURL: 'wss://plumberlib.com/'
    },
    config(configOptions: PlumberConfig): void {
        Object.entries(configOptions).forEach(([key, value]) => {
            plumber._configuration[key] = value;
        });

        if(configOptions.hasOwnProperty('apiKey')) {
            const adminPipe = plumber.getPipe(ADMIN_PIPE_NAME);
            adminPipe.do('set-api-key', this._configuration.apiKey);
            console.log('set api key');
        }
    },
    websocket: null,
    pipes: new Map<string, Pipe<any>>(),
    createPipe: (name: string = DEFAULT_PIPE_NAME): Pipe<any> => {
        if(name === ADMIN_PIPE_NAME) {
            throw new Error(`${name} is a reserved pipe name`);
        }
        if(!plumber.websocket) { plumber.websocket = new WebSocket(plumber._configuration.websocketURL); }
        const pipe = new Pipe<any>(name, plumber);
        plumber.pipes.set(name, pipe);
        return pipe;
    },
    getPipe: (name: string = DEFAULT_PIPE_NAME): Pipe<any> => {
        return plumber.pipes.get(name);
    },
    getOrCreatePipe: (name: string = DEFAULT_PIPE_NAME): Pipe<any> => {
        if (plumber.hasPipe(name)) {
            return plumber.getPipe(name);
        } else {
            return plumber.createPipe(name);
        }
    },
    hasPipe: (name: string): boolean => {
        return plumber.pipes.has(name);
    }
};
plumber.pipes.set(ADMIN_PIPE_NAME, new Pipe<any>(ADMIN_PIPE_NAME, plumber));

export default plumber;