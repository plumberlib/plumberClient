import { AdminPipe, Pipe } from './pipe';

export interface PlumberConfig {
    apiKey?: string|boolean,
    websocketURL?: string
}

export class Plumber {
    public static ADMIN_PIPE_NAME: string = '@';
    public static DEFAULT_PIPE_NAME: string = 'default';
    private readonly configuration: PlumberConfig = {
        apiKey: false,
        websocketURL: 'wss://plumberlib.com/'
    };
    private websocket: WebSocket|null = null;
    private readonly pipes: Map<string, Pipe> = new Map([ [ Plumber.ADMIN_PIPE_NAME, new AdminPipe(Plumber.ADMIN_PIPE_NAME, this) ] ]);

    public constructor() { }

    public config(configOptions: PlumberConfig): void {
        Object.entries(configOptions).forEach(([key, value]) => {
            this.configuration[key] = value;
        });

        if(configOptions.hasOwnProperty('websocketURL')) {
            if(this.websocket) {
                this.websocket.close();
            }
            this.updateWebsocket();
        }
        if(configOptions.hasOwnProperty('apiKey')) {
            const adminPipe = this.getAdminPipe();
            adminPipe.setAPIKey(this.configuration.apiKey as string);
        }
    }
    public createPipe(name: string = Plumber.DEFAULT_PIPE_NAME): Pipe {
        if(name === Plumber.ADMIN_PIPE_NAME) { throw new Error(`${name} is a reserved pipe name`); }
        if(!this.websocket) {
            this.updateWebsocket();
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
        await adminPipe.setAPIKey(this.configuration.apiKey as string);
    }
    private updateWebsocket(): void {
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