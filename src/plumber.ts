import { ADMIN_PIPE_NAME, DEFAULT_PIPE_NAME, PIPES_ADMIN_DOC_ID } from './constants';
import { AdminPipe, Pipe } from './pipe';

export interface PlumberConfig {
    apiKey?: string|boolean,
    websocketURL?: string
}

export class Plumber extends Pipe {
    public static WebSocket = typeof(window) === 'undefined' ? null : WebSocket;
    private readonly configuration: PlumberConfig = {
        apiKey: false,
        websocketURL: 'wss://plumberlib.com/'
    };
    private _isAuthenticated: boolean = false;
    private _isAuthenticating: boolean = false;
    public websocket: WebSocket|null = null;
    private readonly pipes: Map<string, Pipe> = new Map([ [ ADMIN_PIPE_NAME, new AdminPipe(ADMIN_PIPE_NAME, this) ] ]);

    public readonly ADMIN_PIPE_NAME = ADMIN_PIPE_NAME;
    public readonly DEFAULT_PIPE    = DEFAULT_PIPE_NAME;
    public readonly ADMIN_DOC_ID    = PIPES_ADMIN_DOC_ID;
    public constructor() {
        super(DEFAULT_PIPE_NAME, null);
        this.pipes.set(DEFAULT_PIPE_NAME, this);
    }

    public getWebsocketURL(): string {
        return this.configuration.websocketURL;
    }

    public config(configOptions: PlumberConfig): Promise<void> {
        Object.keys(configOptions).forEach((key) => {
            this.configuration[key] = configOptions[key];
        });

        if(configOptions.hasOwnProperty('websocketURL')) {
            if(this.websocket) {
                this.websocket.close();
            }
            this.updatePipeWebsockets();
        }
        if(configOptions.hasOwnProperty('apiKey')) {
            this._isAuthenticating = true;
            return this.updateAPIKey().then(() => {
                this._isAuthenticating = false;
            });
        }
        return Promise.resolve();
    }
    public createPipe(name: string = DEFAULT_PIPE_NAME): Pipe {
        if(name === ADMIN_PIPE_NAME) { throw new Error(`${name} is a reserved pipe name`); }
        if(!this.websocket) {
            this.updatePipeWebsockets();
        }

        this.updateAPIKey();
        const pipe = new Pipe(name, this);
        this.pipes.set(name, pipe);
        return pipe;
    }
    public getPipe(name: string = DEFAULT_PIPE_NAME): Pipe {
        if (this.hasPipe(name)) {
            return this.pipes.get(name);
        } else {
            return this.createPipe(name);
        }
    }
    public closePipe(name: string = DEFAULT_PIPE_NAME): void {
        if(this.hasPipe(name)) {
            const pipe = this.pipes.get(name);
            pipe.__destroy();
            this.pipes.delete(name);
        }
    }
    public hasPipe(name: string): boolean {
        return this.pipes.has(name);
    }
    private getAdminPipe(): AdminPipe {
        return this.pipes.get(ADMIN_PIPE_NAME) as AdminPipe;
    }
    public getAPIKey(): string {
        return this.configuration.apiKey as string;
    }
    private async updateAPIKey(): Promise<void> {
        if(!this.isAuthenticated()) {
            const adminPipe = this.getAdminPipe();
            const isValid = await adminPipe.setAPIKey(this.getAPIKey());
            if(isValid) {
                this._isAuthenticated = true;
                this.pipes.forEach((pipe: Pipe) => {
                    pipe.onAuthenticated();
                });
            }
        }
    }
    public isAuthenticated(): boolean { 
        return this._isAuthenticated;
    }
    public isAuthenticating(): boolean { 
        return this._isAuthenticating;
    }
    private updatePipeWebsockets(): void {
        this.websocket = new Plumber.WebSocket(this.configuration.websocketURL);
        this.pipes.forEach((pipe: Pipe) => {
            pipe.updateWebsocket();
        });
    }

    public _getAdminPipe(): AdminPipe {
        return this.getAdminPipe();
    }

    public getWebsocket(): WebSocket {
        return this.websocket;
    }

    public teardown(): void {
        Array.from(this.pipes.keys()).map((key) => {
            // if(key !== ADMIN_PIPE_NAME) {
                this.closePipe(key);
            // }
        });
        if(this.websocket) {
            if(this.websocket.readyState === Plumber.WebSocket.OPEN) {
                this.websocket.close();
            }
            this.websocket = null;
        }
    }
}

const plumber = new Plumber();
export default plumber;