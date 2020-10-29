import * as ShareDB from 'sharedb';
import { Doc } from "sharedb/lib/client";
import { PipeAgent } from "./pipe-agent";
import { Plumber } from "./plumber";
import { Subscribable } from "./subscribable";

export interface ClientAddonMethod {
    name: string,
    description?: string,
}

export class Pipe extends Subscribable<any> {
    protected readonly agent: PipeAgent;

    constructor(private readonly name: string, plumber: Plumber) {
        super();
        this.agent = new PipeAgent(plumber, this);
        this.agent.subscribe((data: any) => {
            this.forEachSubscriber((sub) => {
                sub(data);
            });
        });
        if(this.getName() !== Plumber.ADMIN_PIPE_NAME) {
            this.agent.join(this.name);
        }
    }

    public getMethods(): Promise<ClientAddonMethod> {
        return this.agent.getMethods();
    }

    public do(opName: string, ...args: any[]): Promise<any> {
        return this.agent.do(opName, ...args);
    }

    public getDoc(documentID: string): Doc {
        return this.agent.getShareDBDoc(documentID);
    }

    public close(): void {
        this.agent.close();
    }

    public getName() {
        return this.name;
    }

    public updateWebsocket(): void {
        this.agent.updateWebsocket();
    }
}

export class AdminPipe extends Pipe {
    public async setAPIKey(key: string): Promise<void> {
        await this.agent.setAPIKey(key);
    }
    public getPipesDoc(): ShareDB.Doc {
        return this.agent.getAllPipesDoc();
    }
}