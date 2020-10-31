import { AdminPipe, Pipe } from './pipe';

export interface PlumberConfig {
    apiKey?: string|boolean,
    websocketURL?: string
}

export class Plumber extends Pipe {
    public static ADMIN_PIPE_NAME: string = '@';
    public static DEFAULT_PIPE_NAME: string = 'default';
    private readonly configuration: PlumberConfig = {
        apiKey: false,
        websocketURL: 'wss://plumberlib.com/'
    };
    private _isAuthenticated: boolean = false;
    private websocket: WebSocket|null = null;
    private readonly pipes: Map<string, Pipe> = new Map([ [ Plumber.ADMIN_PIPE_NAME, new AdminPipe(Plumber.ADMIN_PIPE_NAME, this) ] ]);

    public constructor() {
        super(Plumber.DEFAULT_PIPE_NAME, null);
        this.pipes.set(Plumber.DEFAULT_PIPE_NAME, this);
    }

    public getWebsocketURL(): string {
        return this.configuration.websocketURL;
    }

    public config(configOptions: PlumberConfig): void {
        Object.entries(configOptions).forEach(([key, value]) => {
            this.configuration[key] = value;
        });

        if(configOptions.hasOwnProperty('websocketURL')) {
            if(this.websocket) {
                this.websocket.close();
            }
            this.updatePipeWebsockets();
        }
        if(configOptions.hasOwnProperty('apiKey')) {
            this.updateAPIKey();
        }
    }
    public createPipe(name: string = Plumber.DEFAULT_PIPE_NAME): Pipe {
        if(name === Plumber.ADMIN_PIPE_NAME) { throw new Error(`${name} is a reserved pipe name`); }
        if(!this.websocket) {
            this.updatePipeWebsockets();
        }

        this.updateAPIKey();
        const pipe = new Pipe(name, this);
        this.pipes.set(name, pipe);
        return pipe;
    }
    public getPipe(name: string = Plumber.DEFAULT_PIPE_NAME): Pipe {
        if (this.hasPipe(name)) {
            return this.pipes.get(name);
        } else {
            return this.createPipe(name);
        }
    }
    public hasPipe(name: string): boolean {
        return this.pipes.has(name);
    }
    private getAdminPipe(): AdminPipe {
        return this.pipes.get(Plumber.ADMIN_PIPE_NAME) as AdminPipe;
    }
    private async updateAPIKey(): Promise<void> {
        const adminPipe = this.getAdminPipe();
        const isValid = await adminPipe.setAPIKey(this.configuration.apiKey as string);
        if(isValid) {
            this._isAuthenticated = true;
            this.pipes.forEach((pipe: Pipe) => {
                pipe.onAuthenticated();
            });
        }
    }
    public isAuthenticated(): boolean { 
        return this._isAuthenticated;
    }
    private updatePipeWebsockets(): void {
        this.websocket = new WebSocket(this.configuration.websocketURL);
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
}

const plumber = new Plumber();
export default plumber;